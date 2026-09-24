import express from 'express';
import { db } from '../db/connection.js';
import { DuctAnalysisService } from '../services/ductAnalysisService.js';

export const ductsRouter = express.Router();

// Executa a IA especializada de levantamento de dutos para um projeto
ductsRouter.post('/analyze', async (req, res) => {
  try {
    const { projectId, customText } = req.body;
    if (!projectId) {
      return res.status(400).json({ error: 'ID do projeto é obrigatório para a análise de dutos' });
    }

    const result = await DuctAnalysisService.analyzeProjectDucts(Number(projectId), customText);
    res.json(result);
  } catch (err) {
    console.error('[Ducts Analyze Error]', err);
    res.status(500).json({ error: err.message });
  }
});

// Busca a análise de dutos mais recente para o projeto especificado
ductsRouter.get('/project/:projectId', async (req, res) => {
  try {
    const projectId = Number(req.params.projectId);
    const analysis = await DuctAnalysisService.getLatestDuctAnalysis(projectId);
    if (!analysis) {
      return res.status(404).json({ error: 'Nenhuma análise de dutos encontrada para este projeto' });
    }
    res.json(analysis);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Lista o histórico de análises de dutos de todos os projetos
ductsRouter.get('/', async (req, res) => {
  try {
    const rows = await db.prepare(`
      SELECT da.*, p.name as project_name, p.code as project_code, p.client
      FROM duct_analyses da
      JOIN projects p ON da.project_id = p.id
      ORDER BY da.id DESC
      LIMIT 50
    `).all();

    const formatted = rows.map(r => ({
      id: r.id,
      projectId: r.project_id,
      projectName: r.project_name,
      projectCode: r.project_code,
      client: r.client,
      totalMeters: Number(r.total_meters),
      totalKg: Number(r.total_kg),
      sheetAreaSqm: Number(r.sheet_area_sqm || 0),
      ductBreakdown: typeof r.duct_breakdown === 'string' ? JSON.parse(r.duct_breakdown) : r.duct_breakdown,
      technicalNotes: r.technical_notes,
      createdAt: r.created_at
    }));

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
