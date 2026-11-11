import express from 'express';
import { db } from '../db/connection.js';
import { AIAnalysisService } from '../services/aiService.js';
import { SpreadsheetService } from '../services/spreadsheetService.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { extractTextFromPdfBuffer } from '../utils/pdfHelper.js';
import { extractCadTextFromBuffer } from '../utils/cadHelper.js';
import { generateUniqueProjectCode } from '../utils/codeGenerator.js';
import os from 'os';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';

const uploadsDir = process.env.VERCEL
  ? path.join(os.tmpdir(), 'uploads')
  : path.join(process.cwd(), 'server', 'uploads');
try {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
} catch (e) {
  console.warn('[Uploads] Using temp dir fallback:', e.message);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});
const upload = multer({ storage });

export const projectsRouter = express.Router();

// Lista todos os projetos com filtros e resumos
projectsRouter.get('/', async (req, res) => {
  try {
    const { status, search, project_type, category } = req.query;
    const userRole = req.headers['x-user-role'] || req.query.role;
    const userId = req.headers['x-user-id'] || req.query.user_id;
    const isEngineer = userRole === 'engenharia' || userRole === 'engineer';

    let query = 'SELECT * FROM projects WHERE (is_hidden IS FALSE OR is_hidden IS NULL)';
    const params = [];

    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    if (project_type) {
      query += ' AND project_type = ?';
      params.push(project_type);
    }
    if (search) {
      query += ' AND (name LIKE ? OR client LIKE ? OR code LIKE ? OR address LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY id DESC';

    let projects = await db.prepare(query).all(...params);

    // Filtro estrito para perfil Engenharia: apenas obras atribuídas a ele
    if (isEngineer && userId) {
      const engUser = await db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(Number(userId));
      const assignedRows = await db.prepare('SELECT project_id FROM project_engineers WHERE user_id = ?').all(Number(userId));
      const assignedProjectIds = new Set(assignedRows.map(r => Number(r.project_id)));
      const normUser = (engUser?.name || '').toLowerCase().replace(/^eng\.?\s*/i, '').trim();

      projects = projects.filter(p => {
        if (assignedProjectIds.has(Number(p.id))) return true;
        if (normUser && p.responsible_engineer) {
          const normProj = String(p.responsible_engineer).toLowerCase().replace(/^eng\.?\s*/i, '').trim();
          if (normProj.includes(normUser) || normUser.includes(normProj)) return true;
        }
        return false;
      });
    }

    // Adiciona contagens rápidas de solicitações, arquivos e engenheiros designados
    const enriched = await Promise.all(projects.map(async p => {
      const fileCount = (await db.prepare('SELECT COUNT(*) as count FROM project_files WHERE project_id = ?').get(p.id))?.count || 0;
      const requestCount = (await db.prepare('SELECT COUNT(*) as count FROM material_requests WHERE project_id = ? AND (is_hidden IS FALSE OR is_hidden IS NULL)').get(p.id))?.count || 0;
      const budget = await db.prepare('SELECT id, code, status, total_final FROM budgets WHERE project_id = ? AND (is_hidden IS FALSE OR is_hidden IS NULL)').get(p.id);

      const assignedEngineers = await db.prepare(`
        SELECT u.id, u.name, u.email, u.phone, u.avatar
        FROM project_engineers pe
        JOIN users u ON pe.user_id = u.id
        WHERE pe.project_id = ?
        ORDER BY u.name ASC
      `).all(p.id);

      return {
        ...p,
        fileCount,
        requestCount,
        budget: budget || null,
        assigned_engineers: assignedEngineers,
        assigned_engineer_ids: assignedEngineers.map(e => e.id)
      };
    }));

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Detalhe completo de um projeto específico
projectsRouter.get('/:id', async (req, res) => {
  try {
    const projectId = req.params.id;
    const project = await db.prepare('SELECT * FROM projects WHERE id = ? AND (is_hidden IS FALSE OR is_hidden IS NULL)').get(projectId);
    if (!project) return res.status(404).json({ error: 'Projeto não encontrado' });

    // Engenheiros designados
    const assignedEngineers = await db.prepare(`
      SELECT u.id, u.name, u.email, u.phone, u.avatar
      FROM project_engineers pe
      JOIN users u ON pe.user_id = u.id
      WHERE pe.project_id = ?
      ORDER BY u.name ASC
    `).all(projectId);

    // Documentos anexados
    const files = await db.prepare('SELECT * FROM project_files WHERE project_id = ? ORDER BY id DESC').all(projectId);

    // Orçamento vinculado
    const budget = await db.prepare('SELECT * FROM budgets WHERE project_id = ? AND (is_hidden IS FALSE OR is_hidden IS NULL)').get(projectId);
    let budgetItems = [];
    let services = [];
    let equipment = [];

    if (budget) {
      budgetItems = await db.prepare(`
        SELECT bi.*, m.code as material_code, m.brand, m.stock_physical, m.stock_reserved
        FROM budget_items bi
        LEFT JOIN materials m ON bi.material_id = m.id
        WHERE bi.budget_id = ?
        ORDER BY bi.id ASC
      `).all(budget.id);

      services = await db.prepare('SELECT * FROM services WHERE budget_id = ? ORDER BY id ASC').all(budget.id);

      try {
        equipment = await db.prepare('SELECT * FROM budget_equipment WHERE budget_id = ? ORDER BY id ASC').all(budget.id);
      } catch (e) {
        console.warn('Erro ao buscar equipamentos:', e.message);
      }
    }

    // Solicitações de materiais
    const requests = await db.prepare(`
      SELECT mr.*, u.name as requested_by_name
      FROM material_requests mr
      LEFT JOIN users u ON mr.requested_by = u.id
      WHERE mr.project_id = ? AND (mr.is_hidden IS FALSE OR mr.is_hidden IS NULL)
      ORDER BY mr.id DESC
    `).all(projectId);

    const enrichedRequests = await Promise.all(requests.map(async r => {
      const items = await db.prepare(`
        SELECT mri.*,
               COALESCE(m.name, mri.custom_name, 'Material Fora da Base') as material_name,
               COALESCE(m.code, 'FORA-BASE') as material_code,
               COALESCE(m.unit, mri.custom_unit, 'un') as material_unit
        FROM material_request_items mri
        LEFT JOIN materials m ON mri.material_id = m.id
        WHERE mri.request_id = ?
      `).all(r.id);
      return { ...r, items };
    }));

    // Devoluções de materiais
    const returns = await db.prepare(`
      SELECT ret.*, m.name as material_name, m.code as material_code, m.unit as material_unit, u.name as received_by_name
      FROM returns ret
      JOIN materials m ON ret.material_id = m.id
      JOIN users u ON ret.received_by = u.id
      WHERE ret.project_id = ?
      ORDER BY ret.id DESC
    `).all(projectId);

    // Análises de IA
    const aiAnalyses = await db.prepare(`
      SELECT * FROM ai_analyses WHERE project_id = ? ORDER BY id DESC
    `).all(projectId);

    // Tabela comparativa PREVISTO x REALIZADO por material (Seções 21, 22)
    const comparisonMap = new Map();

    // 1. Quantidades orçadas
    for (const bi of budgetItems) {
      comparisonMap.set(bi.material_id, {
        materialId: bi.material_id,
        code: bi.material_code,
        name: bi.material_name,
        unit: bi.unit,
        unitPrice: bi.unit_price,
        budgetOriginalAi: bi.ai_suggested_quantity,
        budgetApproved: bi.quantity,
        requested: 0,
        withdrawn: 0,
        returned: 0,
        actualConsumed: 0,
        varianceUnits: 0,
        variancePercent: 0
      });
    }

    // 2. Quantidades solicitadas
    for (const req of enrichedRequests) {
      for (const it of req.items) {
        const key = it.material_id;
        if (!comparisonMap.has(key)) {
          comparisonMap.set(key, {
            materialId: key,
            code: it.material_code,
            name: it.material_name,
            unit: it.material_unit,
            unitPrice: 0,
            budgetOriginalAi: 0,
            budgetApproved: 0,
            requested: 0,
            withdrawn: 0,
            returned: 0,
            actualConsumed: 0,
            varianceUnits: 0,
            variancePercent: 0
          });
        }
        const record = comparisonMap.get(key);
        record.requested += it.quantity_requested;
      }
    }

    // 3. Quantidades retiradas (movimentações SAIDA_OBRA)
    const withdrawals = await db.prepare(`
      SELECT material_id, SUM(quantity) as total
      FROM stock_movements
      WHERE project_id = ? AND type = 'SAIDA_OBRA'
      GROUP BY material_id
    `).all(projectId);

    for (const w of withdrawals) {
      if (comparisonMap.has(w.material_id)) {
        comparisonMap.get(w.material_id).withdrawn += w.total;
      }
    }

    // 4. Quantidades devolvidas
    for (const ret of returns) {
      if (comparisonMap.has(ret.material_id)) {
        comparisonMap.get(ret.material_id).returned += ret.quantity;
      }
    }

    // 5. Calcula consumo real e variações
    const comparisonTable = Array.from(comparisonMap.values()).map(row => {
      const actualConsumed = Math.max(0, row.withdrawn - row.returned);
      const varianceUnits = actualConsumed - row.budgetApproved;
      const variancePercent = row.budgetApproved > 0 ? Number(((varianceUnits / row.budgetApproved) * 100).toFixed(1)) : 0;

      return {
        ...row,
        actualConsumed,
        varianceUnits,
        variancePercent
      };
    });

    res.json({
      project: {
        ...project,
        assigned_engineers: assignedEngineers,
        assigned_engineer_ids: assignedEngineers.map(e => e.id)
      },
      files,
      budget: budget ? { ...budget, items: budgetItems, services, equipment } : null,
      requests: enrichedRequests,
      returns,
      aiAnalyses,
      comparisonTable
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Cria novo projeto (com suporte a upload de documentos e análise IA automática)
projectsRouter.post('/', async (req, res) => {
  try {
    const {
      name, client, client_email, client_phone, address, city, state,
      project_type, category, start_date, expected_end_date, responsible_engineer,
      responsible_estimator, return_deadline, scope_summary,
      notes, initial_spec_text, uploadedDocuments, autoAnalyze,
      engineerIds, engineer_ids
    } = req.body;

    if (!name || !client) {
      return res.status(400).json({ error: 'Nome do projeto e cliente são obrigatórios' });
    }

    const finalCategory = (category || '').trim() || (/manuten/i.test(name) ? 'Manutenção' : 'Obra');

    // Requisito 2: Orçamentista responsável é obrigatório
    const finalEstimator = (responsible_estimator || '').trim();
    if (!finalEstimator) {
      return res.status(400).json({ error: 'O campo "Orçamentista responsável" é obrigatório para cadastrar a obra.' });
    }

    // Gera código automático único: PRJ-2026-00X
    const code = await generateUniqueProjectCode(db);

    // Engenheiro(s) responsável(is) - opcional na elaboração do orçamento
    const selectedEngineerIds = engineerIds || engineer_ids || [];
    let finalResponsible = responsible_engineer ? responsible_engineer.trim() : null;

    if (Array.isArray(selectedEngineerIds) && selectedEngineerIds.length > 0) {
      const users = await db.prepare(`
        SELECT name FROM users WHERE id IN (${selectedEngineerIds.map(() => '?').join(',')})
      `).all(...selectedEngineerIds);
      if (users.length > 0) {
        finalResponsible = users.map(u => u.name).join(', ');
      }
    }

    const insert = db.prepare(`
      INSERT INTO projects (
        code, name, client, client_email, client_phone, address, city, state,
        project_type, category, start_date, expected_end_date, return_deadline,
        responsible_engineer, responsible_estimator, scope_summary, notes, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Novo')
    `);

    const result = await insert.run(
      code, name, client, client_email || null, client_phone || null,
      address || 'Endereço a definir', city || 'São Paulo', state || 'SP',
      project_type || 'Comercial', finalCategory, start_date || null, expected_end_date || null,
      return_deadline || null,
      finalResponsible, finalEstimator, scope_summary || null, notes || null
    );

    const projectId = result.lastInsertRowid;

    // Vincula engenheiros na tabela relacional project_engineers
    if (Array.isArray(selectedEngineerIds) && selectedEngineerIds.length > 0) {
      for (const eId of selectedEngineerIds) {
        await db.prepare('INSERT INTO project_engineers (project_id, user_id) VALUES (?, ?) ON CONFLICT DO NOTHING').run(projectId, eId);
      }
    }

    // Salva documentos técnicos anexados
    if (Array.isArray(uploadedDocuments) && uploadedDocuments.length > 0) {
      for (const doc of uploadedDocuments) {
        await db.prepare(`
          INSERT INTO project_files (project_id, type, original_name, file_path, file_size, mime_type, content_summary, uploaded_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, 1)
        `).run(
          projectId,
          doc.type || 'PROJETO_TECNICO',
          doc.name || 'Documento_Projeto.pdf',
          `/uploads/${doc.name || 'doc.pdf'}`,
          doc.size || 1024,
          doc.mime || 'application/pdf',
          doc.content || `Arquivo técnico ${doc.name} submetido para análise estrutural e levantamento quantitativo pela IA da SABRAR.`
        );
      }
    }

    // Se o usuário digitou texto do memorial ou descrição inicial, salva também como arquivo
    if (initial_spec_text && initial_spec_text.trim()) {
      await db.prepare(`
        INSERT INTO project_files (project_id, type, original_name, file_path, file_size, mime_type, content_summary, uploaded_by)
        VALUES (?, 'MEMORIAL_DESCRITIVO', 'Memorial_Descritivo.txt', '/uploads/memorial.txt', ?, 'text/plain', ?, 1)
      `).run(projectId, initial_spec_text.length, initial_spec_text);
    }

    // Auditoria
    await db.prepare(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, project_id, details)
      VALUES (1, 'CRIAR_PROJETO', 'PROJETO', ?, ?, ?)
    `).run(projectId, projectId, `Projeto cadastrado: ${name} (${code}) para o cliente ${client} com ${(uploadedDocuments?.length || 0)} documento(s)`);

    // Análise por IA automática se explicitamente solicitado (sem uploads físicos pendentes)
    let aiAnalysis = null;
    if (autoAnalyze) {
      try {
        aiAnalysis = await AIAnalysisService.analyzeProjectDocuments(projectId);
      } catch (aiErr) {
        console.warn('[Auto AI Analysis Warning]', aiErr.message);
      }
    }

    res.status(201).json({ id: projectId, code, name, status: aiAnalysis ? 'Orçamento gerado' : 'Novo', aiAnalysis });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Upload multipart de arquivos para o projeto com extração de texto via PDFParse
projectsRouter.post('/:id/upload', upload.array('files', 15), async (req, res) => {
  try {
    const projectId = req.params.id;
    const files = req.files || [];
    const { autoAnalyze } = req.body;

    const inserted = [];
    for (const f of files) {
      let contentSummary = `Arquivo ${f.originalname} anexado ao projeto.`;
      
      // Se for arquivo de texto ou csv
      if (f.mimetype.includes('text') || f.originalname.endsWith('.txt') || f.originalname.endsWith('.csv')) {
        try {
          contentSummary = fs.readFileSync(f.path, 'utf8');
        } catch (e) {
          // fallback
        }
      } else if (f.mimetype === 'application/pdf' || f.originalname.toLowerCase().endsWith('.pdf')) {
        try {
          const buffer = fs.readFileSync(f.path);
          const pdfText = await extractTextFromPdfBuffer(buffer, f.originalname);
          if (pdfText && pdfText.trim()) {
            contentSummary = pdfText.slice(0, 1000000);
            console.log(`[PDF Parser] Extraídos ${contentSummary.length} caracteres estruturados por página de ${f.originalname}`);
          }
        } catch (pdfErr) {
          console.warn(`[PDF Parser Error] ${f.originalname}:`, pdfErr.message);
        }
      } else if (f.originalname.toLowerCase().endsWith('.xlsx') || f.originalname.toLowerCase().endsWith('.xls') || f.originalname.toLowerCase().endsWith('.ods')) {
        try {
          contentSummary = SpreadsheetService.extractTextFromSpreadsheet(f.path).slice(0, 1000000);
          console.log(`[Spreadsheet Parser] Extraídos ${contentSummary.length} caracteres de planilha ${f.originalname}`);
        } catch (sErr) {
          console.warn(`[Spreadsheet Parser Error] ${f.originalname}:`, sErr.message);
        }
      } else if (f.originalname.toLowerCase().endsWith('.dwg') || f.originalname.toLowerCase().endsWith('.dxf')) {
        try {
          const buffer = fs.readFileSync(f.path);
          contentSummary = extractCadTextFromBuffer(buffer, f.originalname);
          console.log(`[CAD Parser] Extraídas anotações de ${f.originalname} (${contentSummary.length} caracteres)`);
        } catch (cadErr) {
          console.warn(`[CAD Parser Error] ${f.originalname}:`, cadErr.message);
        }
      }

      // Remove placeholder record prévio se tiver sido inserido na criação sem conteúdo extraído
      await db.prepare(`
        DELETE FROM project_files
        WHERE project_id = ? AND original_name = ?
      `).run(projectId, f.originalname);

      const isCad = f.originalname.toLowerCase().endsWith('.dwg') || f.originalname.toLowerCase().endsWith('.dxf');
      const fileType = f.originalname.toLowerCase().endsWith('.pdf') ? 'PROJETO_PDF' : (isCad ? 'PROJETO_CAD' : 'PROJETO_TECNICO');

      let fileBuffer = null;
      try {
        if (f.buffer) {
          fileBuffer = f.buffer;
        } else if (f.path && fs.existsSync(f.path)) {
          fileBuffer = fs.readFileSync(f.path);
        }
      } catch (bufErr) {
        console.warn('Erro ao ler buffer do upload:', bufErr);
      }

      const resInsert = await db.prepare(`
        INSERT INTO project_files (project_id, type, original_name, file_path, file_size, mime_type, content_summary, uploaded_by, file_data)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
      `).run(
        projectId,
        fileType,
        f.originalname,
        `/uploads/${f.filename}`,
        f.size,
        f.mimetype,
        contentSummary,
        fileBuffer
      );

      inserted.push({ id: resInsert.lastInsertRowid, original_name: f.originalname, size: f.size });
    }

    let aiResult = null;
    let aiWarning = null;
    if (autoAnalyze === 'true' || autoAnalyze === true) {
      try {
        aiResult = await AIAnalysisService.analyzeProjectDocuments(projectId);
      } catch (aiErr) {
        console.warn('[Upload Route AI Analysis Warning]', aiErr.message);
        aiWarning = aiErr.message;
      }
    }

    res.json({ success: true, uploadedCount: inserted.length, files: inserted, aiResult, aiWarning });
  } catch (err) {
    console.error('[Upload Route Error]', err);
    res.status(500).json({ error: err.message });
  }
});

// Importação e processamento de planilha(s) de levantamento executivo real (Excel/CSV)
projectsRouter.post('/:id/import-spreadsheet', upload.any(), async (req, res) => {
  try {
    const projectId = req.params.id;
    const files = req.files || (req.file ? [req.file] : []);
    const { userId, mode = 'replace' } = req.body || {};

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'Nenhum arquivo de planilha foi selecionado' });
    }

    console.log(`[Import Spreadsheet] Processando ${files.length} planilha(s) para o projeto ${projectId} (modo: ${mode})...`);

    let finalResult = null;
    let totalItemsAdded = 0;
    const processedFilesInfo = [];
    const allSheetsNames = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      // Se for múltiplos arquivos e o primeiro for 'replace', os seguintes devem ser 'append'
      const currentMode = (i === 0) ? mode : 'append';

      console.log(`[Import Spreadsheet] (${i + 1}/${files.length}) Processando arquivo: ${file.originalname} (modo: ${currentMode})`);

      const resSpreadsheet = await SpreadsheetService.processRealSurveySpreadsheet(
        projectId,
        file.path,
        file.originalname,
        userId ? Number(userId) : 1,
        currentMode
      );

      finalResult = resSpreadsheet;
      totalItemsAdded += resSpreadsheet.itemsCount || 0;
      if (resSpreadsheet.sheetsNames) {
        allSheetsNames.push(...resSpreadsheet.sheetsNames);
      }

      let sheetBuffer = null;
      try {
        if (file.buffer) sheetBuffer = file.buffer;
        else if (file.path && fs.existsSync(file.path)) sheetBuffer = fs.readFileSync(file.path);
      } catch (e) {}

      // Registra o arquivo em project_files com o binário original no banco
      await db.prepare(`
        INSERT INTO project_files (project_id, type, original_name, file_path, file_size, mime_type, content_summary, uploaded_by, file_data)
        VALUES (?, 'PLANILHA_LEVANTAMENTO', ?, ?, ?, ?, ?, ?, ?)
      `).run(
        projectId,
        file.originalname,
        `/uploads/${file.filename}`,
        file.size,
        file.mimetype || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        `Planilha de levantamento real importada: ${resSpreadsheet.itemsCount} materiais processados e calibrados no motor de IA.`,
        userId || 1,
        sheetBuffer
      );

      processedFilesInfo.push({
        filename: file.originalname,
        itemsCount: resSpreadsheet.itemsCount,
        sheets: resSpreadsheet.sheetsNames
      });
    }

    res.json({
      ...finalResult,
      totalFilesProcessed: files.length,
      processedFiles: processedFilesInfo,
      sheetsNames: Array.from(new Set(allSheetsNames)),
      itemsCountTotalAdded: totalItemsAdded
    });
  } catch (err) {
    console.error('[Import Spreadsheet Error]', err);
    res.status(500).json({ error: err.message });
  }
});

// Reanálise sob demanda com IA para o projeto
projectsRouter.post('/:id/analyze', async (req, res) => {
  try {
    const projectId = req.params.id;
    const { customText } = req.body || {};
    const aiResult = await AIAnalysisService.analyzeProjectDocuments(projectId, customText);
    res.json({ success: true, aiResult });
  } catch (err) {
    console.error('[Analyze Route Error]', err);
    res.status(500).json({ error: err.message });
  }
});

// Atualiza status do projeto (Seção 5)
projectsRouter.patch('/:id/status', async (req, res) => {
  try {
    const { status, userId } = req.body;
    const projectId = req.params.id;

    const project = await db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    if (!project) return res.status(404).json({ error: 'Projeto não encontrado' });

    await db.prepare(`
      UPDATE projects 
      SET status = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(status, projectId);

    // Auditoria
    await db.prepare(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, project_id, old_value, new_value, details)
      VALUES (?, 'ALTERAR_STATUS_PROJETO', 'PROJETO', ?, ?, ?, ?, ?)
    `).run(
      userId || 1, projectId, projectId, project.status, status,
      `Status do projeto ${project.name} alterado de '${project.status}' para '${status}'`
    );

    res.json({ success: true, projectId, oldStatus: project.status, newStatus: status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Edita informações cadastrais do projeto (Item 2)
projectsRouter.put('/:id', async (req, res) => {
  try {
    const projectId = req.params.id;
    const {
      name,
      client,
      client_email,
      client_phone,
      address,
      city,
      state,
      project_type,
      category,
      responsible_engineer,
      responsible_estimator,
      return_deadline,
      scope_summary,
      start_date,
      expected_end_date,
      status,
      notes,
      userId
    } = req.body;

    const project = await db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    if (!project) return res.status(404).json({ error: 'Projeto não encontrado' });

    await db.prepare(`
      UPDATE projects SET
        name = COALESCE(?, name),
        client = COALESCE(?, client),
        client_email = ?,
        client_phone = ?,
        address = COALESCE(?, address),
        city = ?,
        state = ?,
        project_type = COALESCE(?, project_type),
        category = COALESCE(?, category),
        status = COALESCE(?, status),
        responsible_engineer = COALESCE(?, responsible_engineer),
        responsible_estimator = COALESCE(?, responsible_estimator),
        return_deadline = COALESCE(?, return_deadline),
        scope_summary = COALESCE(?, scope_summary),
        start_date = COALESCE(?, start_date),
        expected_end_date = COALESCE(?, expected_end_date),
        notes = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      name !== undefined ? name.trim() : project.name,
      client !== undefined ? client.trim() : project.client,
      client_email !== undefined ? client_email?.trim() : project.client_email,
      client_phone !== undefined ? client_phone?.trim() : project.client_phone,
      address !== undefined ? address.trim() : project.address,
      city !== undefined ? city?.trim() : project.city,
      state !== undefined ? state?.trim() : project.state,
      project_type || project.project_type,
      category !== undefined ? category?.trim() : project.category,
      status !== undefined ? status?.trim() : project.status,
      responsible_engineer !== undefined ? responsible_engineer?.trim() : project.responsible_engineer,
      responsible_estimator !== undefined ? responsible_estimator?.trim() : project.responsible_estimator,
      return_deadline !== undefined ? return_deadline : project.return_deadline,
      scope_summary !== undefined ? scope_summary : project.scope_summary,
      start_date !== undefined ? start_date : project.start_date,
      expected_end_date !== undefined ? expected_end_date : project.expected_end_date,
      notes !== undefined ? notes?.trim() : project.notes,
      projectId
    );

    // Auditoria
    await db.prepare(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, project_id, details)
      VALUES (?, 'EDITAR_PROJETO', 'PROJETO', ?, ?, ?)
    `).run(
      userId || 1, projectId, projectId,
      `Dados cadastrais da obra ${name || project.name} atualizados.`
    );

    const updated = await db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Adiciona arquivo ou memorial ao projeto (suporta payloads JSON com texto extraído e/ou binário base64 preservado)
projectsRouter.post('/:id/files', async (req, res) => {
  try {
    const { type, original_name, file_size, mime_type, content_summary, file_data_base64, userId, autoAnalyze } = req.body;
    const projectId = req.params.id;
    const targetName = original_name || 'Documento_Tecnico.pdf';

    // Preserva binário já salvo anteriormente caso este request seja apenas atualização de metadado/resumo
    const existingRow = await db.prepare(`
      SELECT file_data, content_summary FROM project_files
      WHERE project_id = ? AND original_name = ? AND file_data IS NOT NULL
      ORDER BY id DESC LIMIT 1
    `).get(projectId, targetName);

    let fileBuffer = existingRow?.file_data || null;
    if (file_data_base64 && typeof file_data_base64 === 'string') {
      try {
        fileBuffer = Buffer.from(file_data_base64, 'base64');
      } catch (_) {}
    }

    let finalSummary = content_summary || '';
    if (fileBuffer && targetName.toLowerCase().endsWith('.pdf')) {
      try {
        const structuredText = await extractTextFromPdfBuffer(fileBuffer, targetName);
        if (structuredText && structuredText.trim()) {
          finalSummary = structuredText.slice(0, 1000000);
        }
      } catch (_) {}
    } else if (existingRow?.content_summary && existingRow.content_summary.includes('[TABELA_CAD_ESTRUTURADA')) {
      finalSummary = existingRow.content_summary;
    }

    // Remove registro prévio se existir para evitar duplicidade, mantendo o fileBuffer preservado
    await db.prepare(`
      DELETE FROM project_files
      WHERE project_id = ? AND original_name = ?
    `).run(projectId, targetName);

    const insert = db.prepare(`
      INSERT INTO project_files (project_id, type, original_name, file_path, file_size, mime_type, content_summary, uploaded_by, file_data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = await insert.run(
      projectId,
      type || 'PROJETO_TECNICO',
      targetName,
      `/uploads/${targetName}`,
      file_size || (fileBuffer ? fileBuffer.length : finalSummary.length),
      mime_type || 'application/pdf',
      finalSummary,
      userId || 1,
      fileBuffer
    );

    let aiResult = null;
    let aiWarning = null;
    if (autoAnalyze === 'true' || autoAnalyze === true) {
      try {
        aiResult = await AIAnalysisService.analyzeProjectDocuments(projectId);
      } catch (aiErr) {
        console.warn('[Files Route AI Analysis Warning]', aiErr.message);
        aiWarning = aiErr.message;
      }
    }

    res.status(201).json({ id: result.lastInsertRowid, original_name: targetName, type, aiResult, aiWarning });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Atribui / atualiza engenheiros responsáveis da obra (Administrador - Requisitos 1 e 3)
projectsRouter.patch('/:id/engineers', async (req, res) => {
  try {
    const projectId = req.params.id;
    const { engineerIds = [], userId } = req.body;

    const project = await db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    if (!project) return res.status(404).json({ error: 'Projeto não encontrado' });

    // Remove atribuições anteriores
    await db.prepare('DELETE FROM project_engineers WHERE project_id = ?').run(projectId);

    // Insere novos engenheiros atribuídos
    let engineerNames = [];
    if (Array.isArray(engineerIds) && engineerIds.length > 0) {
      for (const engId of engineerIds) {
        await db.prepare('INSERT INTO project_engineers (project_id, user_id) VALUES (?, ?) ON CONFLICT DO NOTHING').run(projectId, engId);
      }
      const users = await db.prepare(`
        SELECT u.id, u.name, u.email 
        FROM users u 
        WHERE u.id IN (${engineerIds.map(() => '?').join(',')})
      `).all(...engineerIds);

      engineerNames = users.map(u => u.name);

      // Notifica cada engenheiro designado
      for (const u of users) {
        await db.prepare(`
          INSERT INTO notifications (user_id, role_target, title, message, type, link)
          VALUES (?, 'engenharia', 'Designação como Responsável Técnico', ?, 'info', ?)
        `).run(
          u.id,
          `Você foi atribuído como engenheiro responsável pela obra ${project.name} (${project.code}).`,
          `/projetos/${projectId}`
        );
      }
    }

    const responsibleEngineerString = engineerNames.length > 0 ? engineerNames.join(', ') : null;

    // Atualiza campo na tabela projects
    await db.prepare(`
      UPDATE projects 
      SET responsible_engineer = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(responsibleEngineerString, projectId);

    // Auditoria
    await db.prepare(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, project_id, old_value, new_value, details)
      VALUES (?, 'ATRIBUIR_ENGENHEIROS', 'PROJETO', ?, ?, ?, ?, ?)
    `).run(
      userId || 1, projectId, projectId,
      project.responsible_engineer || 'Nenhum',
      responsibleEngineerString || 'Nenhum',
      `Administrador atualizou os engenheiros responsáveis da obra ${project.name}: ${responsibleEngineerString || 'Nenhum atribuído'}`
    );

    const assignedEngineers = await db.prepare(`
      SELECT u.id, u.name, u.email, u.phone, u.avatar
      FROM project_engineers pe
      JOIN users u ON pe.user_id = u.id
      WHERE pe.project_id = ?
      ORDER BY u.name ASC
    `).all(projectId);

    res.json({
      success: true,
      projectId,
      responsible_engineer: responsibleEngineerString,
      assigned_engineers: assignedEngineers,
      assigned_engineer_ids: assignedEngineers.map(e => e.id)
    });
  } catch (err) {
    console.error('[Assign Engineers Error]', err);
    res.status(500).json({ error: err.message });
  }
});

// Retorna cotas orçadas, acumulado solicitado e saldo disponível de cada material da obra (Requisitos 2 e 4)
projectsRouter.get('/:id/material-quotas', async (req, res) => {
  try {
    const projectId = req.params.id;
    const project = await db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    if (!project) return res.status(404).json({ error: 'Projeto não encontrado' });

    const budget = await db.prepare('SELECT id, status FROM budgets WHERE project_id = ?').get(projectId);
    let budgetItems = [];
    if (budget) {
      budgetItems = await db.prepare(`
        SELECT bi.*, m.code as material_code, m.unit as material_unit, m.stock_physical, m.stock_reserved
        FROM budget_items bi
        LEFT JOIN materials m ON bi.material_id = m.id
        WHERE bi.budget_id = ?
        ORDER BY bi.id ASC
      `).all(budget.id);
    }

    // Calcula acumulado solicitado de cada material para esta obra (excluindo solicitações canceladas)
    const requestsItems = await db.prepare(`
      SELECT mri.material_id, SUM(mri.quantity_requested) as total_requested
      FROM material_request_items mri
      JOIN material_requests mr ON mri.request_id = mr.id
      WHERE mr.project_id = ? AND mr.status != 'Cancelado' AND (mr.is_hidden IS FALSE OR mr.is_hidden IS NULL)
      GROUP BY mri.material_id
    `).all(projectId);

    const requestedMap = new Map();
    for (const r of requestsItems) {
      requestedMap.set(r.material_id, Number(r.total_requested || 0));
    }

    const quotas = budgetItems.map(bi => {
      const previouslyRequested = requestedMap.get(bi.material_id) || 0;
      const budgetQuantity = Number(bi.quantity || 0);
      const isDiscrete = /unid|und|un\b|pç|pc|peça|cx|caixa|pct|pacote|lata|rolo|barra|frasco|balde|tubo|cartucho|kit|jogo|par|duzia/i.test(bi.unit || bi.material_unit || '');
      const cleanBudgetQuantity = isDiscrete ? Math.ceil(budgetQuantity) : Number(budgetQuantity.toFixed(2));
      const cleanPreviouslyRequested = isDiscrete ? Math.ceil(previouslyRequested) : Number(previouslyRequested.toFixed(2));
      const remainingQuota = isDiscrete ? Math.ceil(Math.max(0, cleanBudgetQuantity - cleanPreviouslyRequested)) : Number(Math.max(0, cleanBudgetQuantity - cleanPreviouslyRequested).toFixed(2));
      const physical = Number(bi.stock_physical || 0);
      const reserved = Number(bi.stock_reserved || 0);
      const availableStock = Math.max(0, physical - reserved);

      return {
        budgetItemId: bi.id,
        materialId: bi.material_id,
        materialName: bi.material_name,
        materialCode: bi.material_code,
        unit: bi.unit || bi.material_unit,
        unitPrice: bi.unit_price,
        budgetQuantity: cleanBudgetQuantity,
        previouslyRequested: cleanPreviouslyRequested,
        remainingQuota,
        physicalStock: physical,
        reservedStock: reserved,
        availableStock
      };
    });

    res.json({
      projectId,
      hasBudget: Boolean(budget),
      budgetStatus: budget?.status,
      quotas
    });
  } catch (err) {
    console.error('[Material Quotas Error]', err);
    res.status(500).json({ error: err.message });
  }
});

// Exclusão definitiva de projeto (Restrito a Administradores e à Sabrina - Item 1)
projectsRouter.delete('/:id', async (req, res) => {
  try {
    const projectId = req.params.id;
    const userRole = req.headers['x-user-role'];
    const userId = req.headers['x-user-id'];

    // 1. Verificação estrita de permissão: Admins ou Sabrina
    let isAllowed = userRole === 'admin';
    let user = null;

    if (userId) {
      user = await db.prepare('SELECT id, name, email, role_id FROM users WHERE id = ?').get(userId);
    }

    if (user) {
      const emailLower = (user.email || '').toLowerCase();
      const nameLower = (user.name || '').toLowerCase();
      if (emailLower.includes('sabrina') || nameLower.includes('sabrina')) {
        isAllowed = true;
      }
    }

    if (!isAllowed) {
      return res.status(403).json({
        error: 'Acesso negado: a exclusão de projetos é permitida exclusivamente aos Administradores e à Sabrina.'
      });
    }

    const project = await db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Projeto não encontrado' });
    }

    console.log(`[Delete Project] Excluindo projeto ID ${projectId} ("${project.name}") por ${user?.name || userRole}...`);

    // 2. Libera estoques reservados de solicitações pendentes/aprovadas da obra para não travar estoque
    const reservedItems = await db.prepare(`
      SELECT mri.material_id, SUM(mri.quantity_requested) as reserved_qty
      FROM material_request_items mri
      JOIN material_requests mr ON mri.request_id = mr.id
      WHERE mr.project_id = ? AND mr.status IN ('Pendente', 'Aprovado Parcial', 'Aprovado')
      GROUP BY mri.material_id
    `).all(projectId);

    for (const item of reservedItems) {
      await db.prepare(`
        UPDATE materials 
        SET stock_reserved = GREATEST(0, stock_reserved - ?), updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(item.reserved_qty, item.material_id);
    }

    // 3. Remove solicitações de materiais da obra
    const requests = await db.prepare('SELECT id FROM material_requests WHERE project_id = ?').all(projectId);
    for (const r of requests) {
      await db.prepare('DELETE FROM material_request_items WHERE request_id = ?').run(r.id);
    }
    await db.prepare('DELETE FROM material_requests WHERE project_id = ?').run(projectId);

    // 4. Remove orçamentos, itens, serviços e máquinas
    const budgets = await db.prepare('SELECT id FROM budgets WHERE project_id = ?').all(projectId);
    for (const b of budgets) {
      await db.prepare('DELETE FROM budget_items WHERE budget_id = ?').run(b.id);
      await db.prepare('DELETE FROM services WHERE budget_id = ?').run(b.id);
      await db.prepare('DELETE FROM budget_equipment WHERE budget_id = ?').run(b.id);
    }
    await db.prepare('DELETE FROM budgets WHERE project_id = ?').run(projectId);

    // 5. Remove arquivos físicos e registros associados
    await db.prepare('DELETE FROM project_files WHERE project_id = ?').run(projectId);
    await db.prepare('DELETE FROM ai_analyses WHERE project_id = ?').run(projectId);
    await db.prepare('DELETE FROM ai_suggestions WHERE project_id = ?').run(projectId);
    await db.prepare('DELETE FROM duct_analyses WHERE project_id = ?').run(projectId);
    await db.prepare('DELETE FROM project_engineers WHERE project_id = ?').run(projectId);
    await db.prepare('DELETE FROM returns WHERE project_id = ?').run(projectId);

    // 6. Desvincula movimentações de estoque e compras para preservar integridade contábil
    await db.prepare('UPDATE stock_movements SET project_id = NULL WHERE project_id = ?').run(projectId);
    await db.prepare('UPDATE purchases SET project_id = NULL WHERE project_id = ?').run(projectId);
    await db.prepare('DELETE FROM historical_usage WHERE project_id = ?').run(projectId);

    // 7. Remove notificações vinculadas a esta obra
    await db.prepare("DELETE FROM notifications WHERE link LIKE ?").run(`%/projetos/${projectId}%`);

    // 8. Remove o projeto definitivamente
    await db.prepare('DELETE FROM projects WHERE id = ?').run(projectId);

    // 9. Registra log de auditoria
    await db.prepare(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
      VALUES (?, 'EXCLUIR_PROJETO', 'PROJETO', ?, ?)
    `).run(
      userId || 1,
      projectId,
      `Projeto "${project.name}" (${project.code}) foi excluído com sucesso pelo usuário ${user?.name || userRole}.`
    );

    res.json({ success: true, message: `Projeto "${project.name}" excluído com sucesso.` });
  } catch (err) {
    console.error('[Delete Project Error]', err);
    res.status(500).json({ error: err.message });
  }
});

// Localizador inteligente de arquivos físicos em múltiplas pastas possíveis
function findPhysicalFile(fileRecord) {
  if (!fileRecord) return null;
  const filename = path.basename(fileRecord.file_path || fileRecord.original_name || '');
  const candidatePaths = [
    fileRecord.file_path,
    path.join(uploadsDir, filename),
    path.join(process.cwd(), 'server', 'uploads', filename),
    path.join(process.cwd(), 'uploads', filename),
    path.join(os.tmpdir(), 'uploads', filename),
    fileRecord.original_name ? path.join(uploadsDir, fileRecord.original_name) : null,
    fileRecord.original_name ? path.join(process.cwd(), 'server', 'uploads', fileRecord.original_name) : null
  ].filter(Boolean);

  for (const p of candidatePaths) {
    try {
      if (fs.existsSync(p) && fs.statSync(p).isFile()) {
        return p;
      }
    } catch (e) {}
  }
  return null;
}

// Fallback robusto que gera um arquivo PDF/Excel válido quando o binário original não está salvo fisicamente no disco
async function streamFileFallback(res, fileRecord, projectId) {
  const origName = fileRecord.original_name || 'documento';
  const isPdf = origName.toLowerCase().endsWith('.pdf') || fileRecord.mime_type === 'application/pdf';
  const isXlsx = origName.toLowerCase().endsWith('.xlsx') || origName.toLowerCase().endsWith('.xls');

  let project = null;
  if (projectId) {
    try {
      project = await db.prepare('SELECT id, code, name, client FROM projects WHERE id = ?').get(projectId);
    } catch (e) {}
  }

  // 1. Geração de planilha Excel real e válida
  if (isXlsx) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Levantamento Sabrar');
    sheet.columns = [
      { header: 'Item / Parâmetro', key: 'col1', width: 35 },
      { header: 'Conteúdo / Especificação', key: 'col2', width: 60 }
    ];
    sheet.addRow({ col1: 'Projeto / Obra:', col2: project ? `${project.code} - ${project.name}` : 'Sabrar Engenharia' });
    sheet.addRow({ col1: 'Cliente:', col2: project?.client || 'SABRAR' });
    sheet.addRow({ col1: 'Arquivo Original:', col2: origName });
    sheet.addRow({ col1: 'Tipo de Documento:', col2: fileRecord.type || 'Planilha de Levantamento' });
    sheet.addRow({ col1: 'Data de Extração:', col2: new Date(fileRecord.created_at || Date.now()).toLocaleDateString('pt-BR') });
    sheet.addRow({});
    sheet.addRow({ col1: 'Resumo / Memória de Cálculo:', col2: fileRecord.content_summary || 'Planilha registrada no sistema.' });

    // Se houver materiais do projeto, inclui aba detalhada de materiais
    if (projectId) {
      try {
        const materials = await db.prepare('SELECT code, name, quantity, unit, unit_price, total_price FROM budget_materials WHERE project_id = ? LIMIT 500').all(projectId);
        if (materials && materials.length > 0) {
          const matSheet = workbook.addWorksheet('Materiais Levantados');
          matSheet.columns = [
            { header: 'Código', key: 'code', width: 15 },
            { header: 'Descrição', key: 'name', width: 45 },
            { header: 'Quantidade', key: 'quantity', width: 14 },
            { header: 'Unidade', key: 'unit', width: 10 },
            { header: 'Preço Unitário (R$)', key: 'unit_price', width: 18 },
            { header: 'Total (R$)', key: 'total_price', width: 18 }
          ];
          materials.forEach(m => matSheet.addRow(m));
        }
      } catch (e) {}
    }

    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(origName)}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    await workbook.xlsx.write(res);
    return res.end();
  }

  // 2. Geração de PDF real e válido
  if (isPdf) {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(origName)}"`);
    res.setHeader('Content-Type', 'application/pdf');
    doc.pipe(res);

    doc.fontSize(15).font('Helvetica-Bold').text('SABRAR ENGENHARIA - DOCUMENTO DE PROJETO', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(11).font('Helvetica-Bold').text(`Arquivo: ${origName}`);
    if (project) {
      doc.text(`Obra: ${project.code} - ${project.name}`);
      if (project.client) doc.text(`Cliente: ${project.client}`);
    }
    doc.text(`Data: ${new Date(fileRecord.created_at || Date.now()).toLocaleDateString('pt-BR')}`);
    doc.moveDown();
    doc.strokeColor('#cccccc').lineWidth(1).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown();

    const summary = fileRecord.content_summary || 'Documento técnico cadastrado no sistema SABRAR.';
    doc.fontSize(9).font('Helvetica').text(summary, {
      align: 'left',
      lineGap: 3
    });
    return doc.end();
  }

  // 3. Arquivo de texto ou genérico
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(origName)}"`);
  res.setHeader('Content-Type', fileRecord.mime_type || 'text/plain; charset=utf-8');
  return res.send(fileRecord.content_summary || '');
}

// Item 1: Download fácil e direto de arquivos do projeto
projectsRouter.get('/:id/files/:fileId/download', async (req, res) => {
  try {
    const { id, fileId } = req.params;
    const fileRecord = await db.prepare('SELECT * FROM project_files WHERE id = ? AND project_id = ?').get(fileId, id);
    if (!fileRecord) {
      return res.status(404).json({ error: 'Arquivo não encontrado' });
    }

    // 1. Arquivo gravado diretamente no banco de dados (BYTEA)
    if (fileRecord.file_data && fileRecord.file_data.length > 0) {
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileRecord.original_name)}"`);
      res.setHeader('Content-Type', fileRecord.mime_type || 'application/octet-stream');
      res.setHeader('Content-Length', fileRecord.file_data.length);
      return res.end(fileRecord.file_data);
    }

    // 2. Arquivo gravado no disco físico
    const physicalPath = findPhysicalFile(fileRecord);
    if (physicalPath) {
      return res.download(physicalPath, fileRecord.original_name);
    }

    if (fileRecord.content_summary) {
      return await streamFileFallback(res, fileRecord, id);
    }

    return res.status(404).json({ error: 'Conteúdo do arquivo não localizado' });
  } catch (err) {
    console.error('[File Download Error]', err);
    res.status(500).json({ error: err.message });
  }
});

// Download direto por ID do arquivo
projectsRouter.get('/files/:fileId/download', async (req, res) => {
  try {
    const { fileId } = req.params;
    const fileRecord = await db.prepare('SELECT * FROM project_files WHERE id = ?').get(fileId);
    if (!fileRecord) {
      return res.status(404).json({ error: 'Arquivo não encontrado' });
    }

    // 1. Arquivo gravado diretamente no banco de dados (BYTEA)
    if (fileRecord.file_data && fileRecord.file_data.length > 0) {
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileRecord.original_name)}"`);
      res.setHeader('Content-Type', fileRecord.mime_type || 'application/octet-stream');
      res.setHeader('Content-Length', fileRecord.file_data.length);
      return res.end(fileRecord.file_data);
    }

    // 2. Arquivo gravado no disco físico
    const physicalPath = findPhysicalFile(fileRecord);
    if (physicalPath) {
      return res.download(physicalPath, fileRecord.original_name);
    }

    if (fileRecord.content_summary) {
      return await streamFileFallback(res, fileRecord, fileRecord.project_id);
    }

    return res.status(404).json({ error: 'Conteúdo do arquivo não localizado' });
  } catch (err) {
    console.error('[Direct File Download Error]', err);
    res.status(500).json({ error: err.message });
  }
});

// Item 5: Aditivos de Obras vinculados ao projeto original
projectsRouter.get('/:id/addenda', async (req, res) => {
  try {
    const projectId = req.params.id;
    const addenda = await db.prepare(`
      SELECT * FROM project_addenda WHERE project_id = ? ORDER BY number ASC
    `).all(projectId);
    res.json(addenda);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

projectsRouter.post('/:id/addenda', async (req, res) => {
  try {
    const projectId = req.params.id;
    const {
      title,
      description,
      date,
      items = [],
      services = [],
      files = [],
      total_materials = 0,
      total_services = 0,
      total_final = 0,
      userId = 1
    } = req.body;

    const project = await db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    if (!project) return res.status(404).json({ error: 'Projeto original não encontrado' });

    // Calcula próximo número de aditivo sequencial
    const maxRow = await db.prepare('SELECT COALESCE(MAX(number), 0) as max_num FROM project_addenda WHERE project_id = ?').get(projectId);
    const nextNumber = Number(maxRow?.max_num || 0) + 1;
    const aditivoTitle = title && title.trim() ? title.trim() : `Aditivo ${nextNumber}`;

    const insert = db.prepare(`
      INSERT INTO project_addenda (
        project_id, number, title, description, date,
        total_materials, total_services, total_final,
        items, services, files, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = await insert.run(
      projectId,
      nextNumber,
      aditivoTitle,
      description || '',
      date || new Date().toISOString().split('T')[0],
      Number(total_materials) || 0,
      Number(total_services) || 0,
      Number(total_final) || 0,
      JSON.stringify(items),
      JSON.stringify(services),
      JSON.stringify(files),
      userId
    );

    // Registra log de auditoria
    await db.prepare(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, project_id, details)
      VALUES (?, 'CRIAR_ADITIVO', 'ADITIVO', ?, ?, ?)
    `).run(userId, result.lastInsertRowid, projectId, `Aditivo ${nextNumber} ("${aditivoTitle}") cadastrado para a obra ${project.name}`);

    res.status(201).json({ id: result.lastInsertRowid, number: nextNumber, title: aditivoTitle });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Processa e extrai itens de documento (AP / Excel / PDF / CAD) para criação facilitada de Aditivo (Item 2)
projectsRouter.post('/:id/addenda/parse-document', upload.single('file'), async (req, res) => {
  try {
    const projectId = req.params.id;
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    }

    const origName = file.originalname || 'documento';
    const isSpreadsheet = origName.toLowerCase().endsWith('.xlsx') || origName.toLowerCase().endsWith('.xls') || origName.toLowerCase().endsWith('.csv');
    const isPdf = origName.toLowerCase().endsWith('.pdf') || file.mimetype === 'application/pdf';
    const isCad = origName.toLowerCase().endsWith('.dwg') || origName.toLowerCase().endsWith('.dxf');

    let extractedItems = [];
    let extractedServices = [];
    let extractedEquipment = [];
    let summaryText = '';

    if (isSpreadsheet) {
      const parsed = await SpreadsheetService.processRealSurveySpreadsheet(
        projectId,
        file.path,
        origName,
        1,
        'parse_only'
      );
      extractedItems = (parsed.items || []).map(it => ({
        material_id: it.materialId || null,
        code: it.code || '',
        material_name: it.materialName || '',
        quantity: it.quantity || 1,
        unit: it.unit || 'und',
        unit_price: it.unitPrice || 0,
        subtotal: it.subtotal || 0
      }));
      extractedServices = (parsed.services || []).map(s => ({
        service_name: s.description || s.category || '',
        quantity: s.quantity || 1,
        unit: s.unit || 'vb',
        unit_price: s.unitPrice || 0,
        subtotal: s.subtotal || 0
      }));
      extractedEquipment = parsed.equipment || [];
      summaryText = `Planilha de levantamento executivo (AP) processada com sucesso: ${extractedItems.length} materiais e ${extractedServices.length} serviços identificados.`;
    } else if (isPdf) {
      const buffer = fs.readFileSync(file.path);
      const pdfText = await extractTextFromPdfBuffer(buffer);
      summaryText = `PDF técnico analisado: ${pdfText ? pdfText.slice(0, 300) : ''}...`;
      if (pdfText) {
        const lines = pdfText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        for (const line of lines) {
          const matchQty = line.match(/^(\d+(?:[.,]\d+)?)\s*(un|und|m|kg|cx|pç|rolo)?\s+(.+)$/i);
          if (matchQty && matchQty[3].length > 2) {
            extractedItems.push({
              material_id: null,
              code: '',
              material_name: matchQty[3].trim(),
              quantity: parseFloat(matchQty[1].replace(',', '.')) || 1,
              unit: matchQty[2] || 'un'
            });
          }
        }
      }
    } else if (isCad) {
      const buffer = fs.readFileSync(file.path);
      const cadSummary = extractCadTextFromBuffer(buffer, origName);
      summaryText = `Projeto CAD processado. Anotações técnicas extraídas com sucesso.`;
    }

    // Salva o documento no histórico de arquivos do projeto vinculado a este futuro aditivo
    let fileBuffer = null;
    try {
      if (file.path && fs.existsSync(file.path)) fileBuffer = fs.readFileSync(file.path);
    } catch (e) {}

    await db.prepare(`
      INSERT INTO project_files (project_id, type, original_name, file_path, file_size, mime_type, content_summary, uploaded_by, file_data)
      VALUES (?, 'ADITIVO_DOC', ?, ?, ?, ?, ?, 1, ?)
    `).run(
      projectId,
      `[Aditivo] ${origName}`,
      `/uploads/${file.filename}`,
      file.size,
      file.mimetype || 'application/octet-stream',
      summaryText || `Arquivo de Aditivo ${origName}`,
      fileBuffer
    );

    res.json({
      success: true,
      original_name: origName,
      file_path: `/uploads/${file.filename}`,
      file_size: file.size,
      items: extractedItems,
      services: extractedServices,
      equipment: extractedEquipment,
      summary: summaryText
    });
  } catch (err) {
    console.error('[Addendum Parse Document Error]', err);
    res.status(500).json({ error: err.message });
  }
});

projectsRouter.delete('/:id/addenda/:addendumId', async (req, res) => {
  try {
    const { id, addendumId } = req.params;
    const addendum = await db.prepare('SELECT * FROM project_addenda WHERE id = ? AND project_id = ?').get(addendumId, id);
    if (!addendum) return res.status(404).json({ error: 'Aditivo não encontrado' });

    // Se o aditivo teve origem em um projeto avulso vinculado, desoculta o projeto original
    if (addendum.origin_project_id) {
      await db.prepare(`
        UPDATE projects 
        SET is_hidden = false, parent_project_id = NULL, status = 'Em andamento', updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(addendum.origin_project_id);
    }

    // Limpa arquivos copiados deste aditivo na obra principal
    if (addendum.number) {
      await db.prepare(`
        DELETE FROM project_files 
        WHERE project_id = ? AND original_name LIKE ?
      `).run(id, `[Aditivo ${addendum.number}]%`);
    }

    await db.prepare('DELETE FROM project_addenda WHERE id = ? AND project_id = ?').run(addendumId, id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Lista projetos candidatos que podem ser vinculados como aditivo da obra principal
projectsRouter.get('/:id/linkable-projects', async (req, res) => {
  try {
    const parentId = Number(req.params.id);
    const { search } = req.query;

    let sql = `
      SELECT p.id, p.code, p.name, p.client, p.project_type, p.status, p.created_at,
             (SELECT count(*) FROM budget_items bi JOIN budgets b ON b.id = bi.budget_id WHERE b.project_id = p.id) as materials_count,
             (SELECT count(*) FROM project_files pf WHERE pf.project_id = p.id) as files_count
      FROM projects p
      WHERE p.id != ?
        AND (p.is_hidden IS FALSE OR p.is_hidden IS NULL)
        AND (p.parent_project_id IS NULL)
    `;
    const params = [parentId];

    if (search && search.trim()) {
      sql += ` AND (p.name ILIKE ? OR p.code ILIKE ? OR p.client ILIKE ?)`;
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    sql += ` ORDER BY p.id DESC LIMIT 100`;

    const candidates = await db.prepare(sql).all(...params);
    res.json(candidates);
  } catch (err) {
    console.error('[Linkable Projects Error]', err);
    res.status(500).json({ error: err.message });
  }
});

// Vincula um projeto avulso existente como um novo Aditivo desta obra
projectsRouter.post('/:id/link-project-as-addendum', async (req, res) => {
  try {
    const parentId = Number(req.params.id);
    const { sourceProjectId, customTitle, customDescription, customDate, userId = 1 } = req.body;

    if (!sourceProjectId || Number(sourceProjectId) === parentId) {
      return res.status(400).json({ error: 'Projeto de origem inválido' });
    }

    const parentProject = await db.prepare('SELECT * FROM projects WHERE id = ?').get(parentId);
    if (!parentProject) return res.status(404).json({ error: 'Obra principal não encontrada' });

    const sourceProject = await db.prepare('SELECT * FROM projects WHERE id = ?').get(sourceProjectId);
    if (!sourceProject) return res.status(404).json({ error: 'Projeto avulso não encontrado' });

    // Calcula próximo número sequencial de aditivo da obra principal
    const maxRow = await db.prepare('SELECT COALESCE(MAX(number), 0) as max_num FROM project_addenda WHERE project_id = ?').get(parentId);
    const nextNumber = Number(maxRow?.max_num || 0) + 1;

    // Busca materiais orçados no projeto avulso
    const budget = await db.prepare('SELECT * FROM budgets WHERE project_id = ? ORDER BY id DESC LIMIT 1').get(sourceProjectId);
    let addendumItems = [];
    if (budget) {
      const bItems = await db.prepare('SELECT * FROM budget_items WHERE budget_id = ? ORDER BY id ASC').all(budget.id);
      addendumItems = bItems.map(it => ({
        material_id: it.material_id,
        code: it.code || '',
        material_name: it.material_name || it.description || '',
        quantity: Number(it.quantity) || 1,
        unit: it.unit || 'un',
        unit_price: Number(it.unit_price) || 0,
        subtotal: Number(it.subtotal || ((it.quantity || 1) * (it.unit_price || 0))) || 0
      }));
    }

    // Busca arquivos do projeto avulso e cria cópias vinculadas à obra principal
    const sourceFiles = await db.prepare('SELECT * FROM project_files WHERE project_id = ?').all(sourceProjectId);
    for (const f of sourceFiles) {
      await db.prepare(`
        INSERT INTO project_files (project_id, type, original_name, file_path, file_size, mime_type, content_summary, uploaded_by, file_data)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        parentId,
        f.type || 'PROJETO_TECNICO',
        `[Aditivo ${nextNumber}] ${f.original_name}`,
        f.file_path,
        f.file_size,
        f.mime_type,
        f.content_summary,
        f.uploaded_by || 1,
        f.file_data
      );
    }

    // Se houver solicitações de materiais criadas no projeto avulso, transfere para a obra mãe
    await db.prepare(`
      UPDATE material_requests 
      SET project_id = ?
      WHERE project_id = ?
    `).run(parentId, sourceProjectId);

    const title = customTitle && customTitle.trim() ? customTitle.trim() : `Aditivo ${nextNumber} - ${sourceProject.name}`;
    const description = customDescription && customDescription.trim()
      ? customDescription.trim()
      : (sourceProject.notes || sourceProject.scope_summary || `Aditivo incorporado a partir do projeto avulso ${sourceProject.code} - ${sourceProject.name}`);
    const date = customDate || (sourceProject.created_at ? new Date(sourceProject.created_at).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));

    const totalMaterials = addendumItems.reduce((acc, it) => acc + (it.subtotal || 0), 0);

    const resInsert = await db.prepare(`
      INSERT INTO project_addenda (
        project_id, number, title, description, date,
        total_materials, total_services, total_final,
        items, services, files, created_by, origin_project_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      parentId,
      nextNumber,
      title,
      description,
      date,
      totalMaterials,
      0,
      totalMaterials,
      JSON.stringify(addendumItems),
      JSON.stringify([]),
      JSON.stringify(sourceFiles.map(f => f.original_name)),
      userId,
      sourceProjectId
    );

    // Oculta e arquiva o projeto avulso da listagem principal
    await db.prepare(`
      UPDATE projects 
      SET is_hidden = true, 
          parent_project_id = ?, 
          status = 'Vinculado a Obra',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(parentId, sourceProjectId);

    // Auditoria
    await db.prepare(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, project_id, details)
      VALUES (?, 'VINCULAR_PROJETO_COMO_ADITIVO', 'PROJETO', ?, ?, ?)
    `).run(
      userId,
      sourceProjectId,
      parentId,
      `Projeto "${sourceProject.code} - ${sourceProject.name}" vinculado como Aditivo ${nextNumber} na obra principal "${parentProject.code} - ${parentProject.name}"`
    );

    res.status(201).json({
      success: true,
      addendumId: resInsert.lastInsertRowid,
      number: nextNumber,
      title,
      itemsCount: addendumItems.length
    });
  } catch (err) {
    console.error('[Link Project As Addendum Error]', err);
    res.status(500).json({ error: err.message });
  }
});

// Item 7: Resumo descritivo do escopo para engenheiros
projectsRouter.patch('/:id/scope-summary', async (req, res) => {
  try {
    const projectId = req.params.id;
    const { scope_summary, userId } = req.body;
    await db.prepare('UPDATE projects SET scope_summary = ?, updated_at = NOW() WHERE id = ?').run(scope_summary || '', projectId);

    await db.prepare(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, project_id, details)
      VALUES (?, 'ATUALIZAR_ESCOPO', 'PROJETO', ?, ?, ?)
    `).run(userId || 1, projectId, projectId, `Resumo descritivo do escopo atualizado pelo orçamentista`);

    res.json({ success: true, scope_summary });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Item 16: Marcar orçamento como perdido
projectsRouter.post('/:id/mark-lost', async (req, res) => {
  try {
    const projectId = req.params.id;
    const { reason, userId = 1, userName = 'Orçamentista' } = req.body;

    await db.prepare("UPDATE projects SET status = 'Perdido', updated_at = NOW() WHERE id = ?").run(projectId);
    await db.prepare("UPDATE budgets SET status = 'Perdido', updated_at = NOW() WHERE project_id = ?").run(projectId);

    await db.prepare(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, project_id, details)
      VALUES (?, 'ORCAMENTO_PERDIDO', 'PROJETO', ?, ?, ?)
    `).run(userId, projectId, projectId, `Orçamento marcado como PERDIDO por ${userName}. Motivo: ${reason || 'Não informado'}`);

    res.json({ success: true, status: 'Perdido' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

