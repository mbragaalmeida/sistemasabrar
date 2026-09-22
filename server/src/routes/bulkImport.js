import express from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { BulkImportService } from '../services/bulkImportService.js';
import { db } from '../db/connection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import os from 'node:os';

const uploadDir = process.env.VERCEL
  ? path.join(os.tmpdir(), 'uploads')
  : path.resolve(__dirname, '../../uploads');
try {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
} catch (e) {
  console.warn('[UploadDir] Using temp fallback:', e.message);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'bulk-' + uniqueSuffix + '-' + file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_'));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

export const bulkImportRouter = express.Router();

/**
 * Download da planilha modelo oficial da SABRAR para carga em massa
 */
bulkImportRouter.get('/template', (req, res) => {
  try {
    const buffer = BulkImportService.generateTemplate();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="Modelo_Carga_Massa_Obras_SABRAR.xlsx"');
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  } catch (err) {
    console.error('[Bulk Template Error]', err);
    res.status(500).json({ error: 'Erro ao gerar planilha modelo: ' + err.message });
  }
});

/**
 * Upload e processamento de planilha (.xlsx, .xls, .csv) de carga em massa
 */
bulkImportRouter.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    }

    const userId = req.body.userId ? parseInt(req.body.userId) : 1;
    const result = await BulkImportService.parseAndImportBulkData(req.file.path, req.file.originalname, userId);

    res.json({
      success: true,
      message: 'Carga em massa processada com sucesso!',
      ...result
    });
  } catch (err) {
    console.error('[Bulk Upload Error]', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Carga de dados em massa diretamente via JSON (para scripts e integrações)
 */
bulkImportRouter.post('/json', async (req, res) => {
  try {
    const { projects, materialsBudget, materialsReal, userId, originalName } = req.body;

    if (!Array.isArray(projects) || projects.length === 0) {
      return res.status(400).json({ error: 'Array de projetos inválido ou vazio.' });
    }

    const result = await BulkImportService.importStructuredData({
      projects,
      materialsBudget: materialsBudget || [],
      materialsReal: materialsReal || [],
      originalName: originalName || 'Importação via API JSON',
      userId: userId ? parseInt(userId) : 1
    });

    res.json({
      success: true,
      message: 'Dados importados e motor de IA calibrado com sucesso!',
      ...result
    });
  } catch (err) {
    console.error('[Bulk JSON Import Error]', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Sumário da base histórica importada
 */
bulkImportRouter.get('/summary', async (req, res) => {
  try {
    const totalProjects = (await db.prepare("SELECT COUNT(*) as count FROM projects").get())?.count || 0;
    const totalHistory = (await db.prepare("SELECT COUNT(*) as count FROM historical_usage").get())?.count || 0;
    const totalRevenue = (await db.prepare("SELECT SUM(total_budget_final) as total FROM projects").get())?.total || 0;
    const totalMaterialsBudget = (await db.prepare("SELECT SUM(total_budget_materials) as total FROM projects").get())?.total || 0;

    res.json({
      totalProjects,
      totalHistoryRows: totalHistory,
      totalRevenue,
      totalMaterialsBudget
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
