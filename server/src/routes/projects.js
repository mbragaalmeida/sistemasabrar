import express from 'express';
import { db } from '../db/connection.js';
import { AIAnalysisService } from '../services/aiService.js';
import { SpreadsheetService } from '../services/spreadsheetService.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { extractTextFromPdfBuffer } from '../utils/pdfHelper.js';
import { generateUniqueProjectCode } from '../utils/codeGenerator.js';

import os from 'os';

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
    const { status, search, project_type } = req.query;
    let query = 'SELECT * FROM projects WHERE (is_hidden IS FALSE OR is_hidden IS NULL)';
    const params = [];

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

    const projects = await db.prepare(query).all(...params);

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
        SELECT mri.*, m.name as material_name, m.code as material_code, m.unit as material_unit
        FROM material_request_items mri
        JOIN materials m ON mri.material_id = m.id
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
      project_type, start_date, expected_end_date, responsible_engineer,
      notes, initial_spec_text, uploadedDocuments, autoAnalyze,
      engineerIds, engineer_ids
    } = req.body;

    if (!name || !client) {
      return res.status(400).json({ error: 'Nome do projeto e cliente são obrigatórios' });
    }

    // Gera código automático único: PRJ-2026-00X
    const code = await generateUniqueProjectCode(db);

    // Engenheiro(s) responsável(is) - opcional na elaboração do orçamento (Requisitos 1 e 3)
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
        project_type, start_date, expected_end_date, responsible_engineer, notes, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Novo')
    `);

    const result = await insert.run(
      code, name, client, client_email || null, client_phone || null,
      address || 'Endereço a definir', city || 'São Paulo', state || 'SP',
      project_type || 'Comercial', start_date || null, expected_end_date || null,
      finalResponsible, notes || null
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
          const pdfText = await extractTextFromPdfBuffer(buffer);
          if (pdfText && pdfText.trim()) {
            contentSummary = pdfText.slice(0, 100000);
            console.log(`[PDF Parser] Extraídos ${contentSummary.length} caracteres de ${f.originalname}`);
          }
        } catch (pdfErr) {
          console.warn(`[PDF Parser Error] ${f.originalname}:`, pdfErr.message);
        }
      } else if (f.originalname.toLowerCase().endsWith('.xlsx') || f.originalname.toLowerCase().endsWith('.xls') || f.originalname.toLowerCase().endsWith('.ods')) {
        try {
          contentSummary = SpreadsheetService.extractTextFromSpreadsheet(f.path).slice(0, 100000);
          console.log(`[Spreadsheet Parser] Extraídos ${contentSummary.length} caracteres de planilha ${f.originalname}`);
        } catch (sErr) {
          console.warn(`[Spreadsheet Parser Error] ${f.originalname}:`, sErr.message);
        }
      }

      // Remove placeholder record prévio se tiver sido inserido na criação sem conteúdo extraído
      await db.prepare(`
        DELETE FROM project_files
        WHERE project_id = ? AND original_name = ?
      `).run(projectId, f.originalname);

      const resInsert = await db.prepare(`
        INSERT INTO project_files (project_id, type, original_name, file_path, file_size, mime_type, content_summary, uploaded_by)
        VALUES (?, 'PROJETO_TECNICO', ?, ?, ?, ?, ?, 1)
      `).run(
        projectId,
        f.originalname,
        `/uploads/${f.filename}`,
        f.size,
        f.mimetype,
        contentSummary
      );

      inserted.push({ id: resInsert.lastInsertRowid, original_name: f.originalname, size: f.size });
    }

    let aiResult = null;
    if (autoAnalyze === 'true' || autoAnalyze === true) {
      aiResult = await AIAnalysisService.analyzeProjectDocuments(projectId);
    }

    res.json({ success: true, uploadedCount: inserted.length, files: inserted, aiResult });
  } catch (err) {
    console.error('[Upload Route Error]', err);
    res.status(500).json({ error: err.message });
  }
});

// Importação e processamento de planilha de levantamento executivo real (Excel/CSV)
projectsRouter.post('/:id/import-spreadsheet', upload.single('file'), async (req, res) => {
  try {
    const projectId = req.params.id;
    const file = req.file;
    const { userId } = req.body || {};

    if (!file) {
      return res.status(400).json({ error: 'Nenhum arquivo de planilha foi selecionado' });
    }

    console.log(`[Import Spreadsheet] Processando planilha ${file.originalname} para o projeto ${projectId}...`);

    const result = await SpreadsheetService.processRealSurveySpreadsheet(
      projectId,
      file.path,
      file.originalname,
      userId ? Number(userId) : 1
    );

    // Registra o arquivo em project_files
    await db.prepare(`
      INSERT INTO project_files (project_id, type, original_name, file_path, file_size, mime_type, content_summary, uploaded_by)
      VALUES (?, 'PLANILHA_LEVANTAMENTO', ?, ?, ?, ?, ?, ?)
    `).run(
      projectId,
      file.originalname,
      `/uploads/${file.filename}`,
      file.size,
      file.mimetype || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      `Planilha de levantamento real importada: ${result.itemsCount} materiais processados e calibrados no motor de IA.`,
      userId || 1
    );

    res.json(result);
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

// Adiciona arquivo ou memorial ao projeto (suporta payloads JSON com texto extraído de arquivos grandes)
projectsRouter.post('/:id/files', async (req, res) => {
  try {
    const { type, original_name, file_size, mime_type, content_summary, userId, autoAnalyze } = req.body;
    const projectId = req.params.id;

    // Remove registro prévio se existir para evitar duplicidade
    await db.prepare(`
      DELETE FROM project_files
      WHERE project_id = ? AND original_name = ?
    `).run(projectId, original_name || 'Documento_Tecnico.pdf');

    const insert = db.prepare(`
      INSERT INTO project_files (project_id, type, original_name, file_path, file_size, mime_type, content_summary, uploaded_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = await insert.run(
      projectId,
      type || 'PROJETO_TECNICO',
      original_name || 'Documento_Tecnico.pdf',
      `/uploads/${original_name || 'doc.pdf'}`,
      file_size || (content_summary || '').length,
      mime_type || 'application/pdf',
      content_summary || '',
      userId || 1
    );

    let aiResult = null;
    if (autoAnalyze === 'true' || autoAnalyze === true) {
      aiResult = await AIAnalysisService.analyzeProjectDocuments(projectId);
    }

    res.status(201).json({ id: result.lastInsertRowid, original_name, type, aiResult });
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
      const remainingQuota = Math.max(0, budgetQuantity - previouslyRequested);
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
        budgetQuantity,
        previouslyRequested,
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
