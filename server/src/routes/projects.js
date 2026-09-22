import express from 'express';
import { db } from '../db/connection.js';
import { AIAnalysisService } from '../services/aiService.js';
import { SpreadsheetService } from '../services/spreadsheetService.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { PDFParse } = require('pdf-parse');

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
projectsRouter.get('/', (req, res) => {
  try {
    const { status, search, project_type } = req.query;
    let query = 'SELECT * FROM projects WHERE 1=1';
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

    const projects = db.prepare(query).all(...params);

    // Adiciona contagens rápidas de solicitações e arquivos
    const enriched = projects.map(p => {
      const fileCount = db.prepare('SELECT COUNT(*) as count FROM project_files WHERE project_id = ?').get(p.id).count;
      const requestCount = db.prepare('SELECT COUNT(*) as count FROM material_requests WHERE project_id = ?').get(p.id).count;
      const budget = db.prepare('SELECT id, code, status, total_final FROM budgets WHERE project_id = ?').get(p.id);

      return {
        ...p,
        fileCount,
        requestCount,
        budget: budget || null
      };
    });

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Detalhe completo de um projeto específico
projectsRouter.get('/:id', (req, res) => {
  try {
    const projectId = req.params.id;
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    if (!project) return res.status(404).json({ error: 'Projeto não encontrado' });

    // Documentos anexados
    const files = db.prepare('SELECT * FROM project_files WHERE project_id = ? ORDER BY id DESC').all(projectId);

    // Orçamento vinculado
    const budget = db.prepare('SELECT * FROM budgets WHERE project_id = ?').get(projectId);
    let budgetItems = [];
    let services = [];

    if (budget) {
      budgetItems = db.prepare(`
        SELECT bi.*, m.code as material_code, m.brand, m.stock_physical, m.stock_reserved
        FROM budget_items bi
        LEFT JOIN materials m ON bi.material_id = m.id
        WHERE bi.budget_id = ?
        ORDER BY bi.id ASC
      `).all(budget.id);

      services = db.prepare('SELECT * FROM services WHERE budget_id = ? ORDER BY id ASC').all(budget.id);
    }

    // Solicitações de materiais
    const requests = db.prepare(`
      SELECT mr.*, u.name as requested_by_name
      FROM material_requests mr
      JOIN users u ON mr.requested_by = u.id
      WHERE mr.project_id = ?
      ORDER BY mr.id DESC
    `).all(projectId);

    const enrichedRequests = requests.map(r => {
      const items = db.prepare(`
        SELECT mri.*, m.name as material_name, m.code as material_code, m.unit as material_unit
        FROM material_request_items mri
        JOIN materials m ON mri.material_id = m.id
        WHERE mri.request_id = ?
      `).all(r.id);
      return { ...r, items };
    });

    // Devoluções de materiais
    const returns = db.prepare(`
      SELECT ret.*, m.name as material_name, m.code as material_code, m.unit as material_unit, u.name as received_by_name
      FROM returns ret
      JOIN materials m ON ret.material_id = m.id
      JOIN users u ON ret.received_by = u.id
      WHERE ret.project_id = ?
      ORDER BY ret.id DESC
    `).all(projectId);

    // Análises de IA
    const aiAnalyses = db.prepare(`
      SELECT * FROM ai_analyses WHERE project_id = ? ORDER BY id DESC
    `).all(projectId);

    // Tabela comparativa PREVISTO x REALIZADO por material (Seções 21, 22)
    const comparisonMap = new Map();

    // 1. Itens do orçamento
    for (const item of budgetItems) {
      comparisonMap.set(item.material_id || item.material_name, {
        materialId: item.material_id,
        materialName: item.material_name,
        materialCode: item.material_code,
        unit: item.unit,
        aiPredicted: item.ai_suggested_quantity || item.quantity,
        budgetApproved: item.quantity,
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
            materialId: it.material_id,
            materialName: it.material_name,
            materialCode: it.material_code,
            unit: it.material_unit,
            aiPredicted: 0,
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
    const withdrawals = db.prepare(`
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
      project,
      files,
      budget: budget ? { ...budget, items: budgetItems, services } : null,
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
      notes, initial_spec_text, uploadedDocuments, autoAnalyze
    } = req.body;

    if (!name || !client) {
      return res.status(400).json({ error: 'Nome do projeto e cliente são obrigatórios' });
    }

    // Gera código automático: PRJ-2026-00X
    const count = db.prepare('SELECT COUNT(*) as count FROM projects').get().count + 1;
    const code = `PRJ-2026-${String(count).padStart(3, '0')}`;

    const insert = db.prepare(`
      INSERT INTO projects (
        code, name, client, client_email, client_phone, address, city, state,
        project_type, start_date, expected_end_date, responsible_engineer, notes, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Novo')
    `);

    const result = insert.run(
      code, name, client, client_email || null, client_phone || null,
      address || 'Endereço a definir', city || 'São Paulo', state || 'SP',
      project_type || 'Comercial', start_date || null, expected_end_date || null,
      responsible_engineer || 'Eng. Rafael Santos', notes || null
    );

    const projectId = result.lastInsertRowid;

    // Salva documentos técnicos anexados
    if (Array.isArray(uploadedDocuments) && uploadedDocuments.length > 0) {
      for (const doc of uploadedDocuments) {
        db.prepare(`
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
      db.prepare(`
        INSERT INTO project_files (project_id, type, original_name, file_path, file_size, mime_type, content_summary, uploaded_by)
        VALUES (?, 'MEMORIAL_DESCRITIVO', 'Memorial_Descritivo.txt', '/uploads/memorial.txt', ?, 'text/plain', ?, 1)
      `).run(projectId, initial_spec_text.length, initial_spec_text);
    }

    // Auditoria
    db.prepare(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, project_id, details)
      VALUES (1, 'CRIAR_PROJETO', 'PROJETO', ?, ?, ?)
    `).run(projectId, projectId, `Projeto cadastrado: ${name} (${code}) para o cliente ${client} com ${(uploadedDocuments?.length || 0)} documento(s)`);

    // Análise por IA automática se solicitado
    let aiAnalysis = null;
    if (autoAnalyze || (uploadedDocuments && uploadedDocuments.length > 0)) {
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
          const parser = new PDFParse(new Uint8Array(buffer));
          const pdfRes = await parser.getText();
          if (pdfRes && pdfRes.text && pdfRes.text.trim()) {
            contentSummary = pdfRes.text.slice(0, 100000);
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

      const resInsert = db.prepare(`
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

    const result = SpreadsheetService.processRealSurveySpreadsheet(
      projectId,
      file.path,
      file.originalname,
      userId ? Number(userId) : 1
    );

    // Registra o arquivo em project_files
    db.prepare(`
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
projectsRouter.patch('/:id/status', (req, res) => {
  try {
    const { status, userId } = req.body;
    const projectId = req.params.id;

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    if (!project) return res.status(404).json({ error: 'Projeto não encontrado' });

    db.prepare(`
      UPDATE projects 
      SET status = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(status, projectId);

    // Auditoria
    db.prepare(`
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

// Adiciona arquivo ou memorial ao projeto
projectsRouter.post('/:id/files', (req, res) => {
  try {
    const { type, original_name, content_summary, userId } = req.body;
    const projectId = req.params.id;

    const insert = db.prepare(`
      INSERT INTO project_files (project_id, type, original_name, file_path, file_size, mime_type, content_summary, uploaded_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = insert.run(
      projectId,
      type || 'MEMORIAL_DESCRITIVO',
      original_name || 'Documento_Tecnico.pdf',
      `/uploads/${original_name || 'doc.pdf'}`,
      (content_summary || '').length * 10,
      'application/pdf',
      content_summary || '',
      userId || 1
    );

    res.status(201).json({ id: result.lastInsertRowid, original_name, type });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
