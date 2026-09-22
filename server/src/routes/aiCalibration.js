import express from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { AICalibrationService } from '../services/aiCalibrationService.js';
import { LearningService } from '../services/learningService.js';
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
    cb(null, 'calib-' + uniqueSuffix + '-' + file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_'));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB por arquivo
});

export const aiCalibrationRouter = express.Router();

/**
 * Upload múltiplo de documentos técnicos de projetos (PDFs) e planilhas de levantamento/consumo real
 */
aiCalibrationRouter.post('/upload', upload.array('files', 20), async (req, res) => {
  try {
    const files = req.files;
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado para calibração.' });
    }

    const userId = req.body.userId ? parseInt(req.body.userId) : 1;
    const result = await AICalibrationService.processCalibrationFiles(files, userId);

    res.json(result);
  } catch (err) {
    console.error('[AI Calibration Upload Error]', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Status e métricas da calibração contínua da IA
 */
aiCalibrationRouter.get('/status', (req, res) => {
  try {
    const metrics = LearningService.getLearningMetrics();
    const totalCalibratedProjects = db.prepare(`
      SELECT COUNT(DISTINCT project_id) as count FROM historical_usage
    `).get()?.count || 0;

    res.json({
      ...metrics,
      totalCalibratedProjects
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Histórico detalhado de materiais e obras calibradas
 */
aiCalibrationRouter.get('/history', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT 
        h.*,
        m.name as material_name,
        m.code as material_code,
        m.unit as material_unit,
        m.category as material_category,
        p.name as project_name,
        p.code as project_code,
        p.project_type
      FROM historical_usage h
      JOIN materials m ON h.material_id = m.id
      JOIN projects p ON h.project_id = p.id
      ORDER BY h.id DESC
      LIMIT 100
    `).all();

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
