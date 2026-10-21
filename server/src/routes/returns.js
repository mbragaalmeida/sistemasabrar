import express from 'express';
import { db } from '../db/connection.js';
import { StockService } from '../services/stockService.js';

export const returnsRouter = express.Router();

// Lista devoluções de materiais
returnsRouter.get('/', async (req, res) => {
  try {
    const { project_id, material_id } = req.query;
    let query = `
      SELECT ret.*, m.name as material_name, m.code as material_code, m.unit as material_unit,
             p.name as project_name, p.code as project_code, u.name as received_by_name
      FROM returns ret
      JOIN materials m ON ret.material_id = m.id
      JOIN projects p ON ret.project_id = p.id
      JOIN users u ON ret.received_by = u.id
      WHERE 1=1
    `;
    const params = [];

    if (project_id) {
      query += ' AND ret.project_id = ?';
      params.push(project_id);
    }
    if (material_id) {
      query += ' AND ret.material_id = ?';
      params.push(material_id);
    }

    query += ' ORDER BY ret.id DESC';

    const returns = await db.prepare(query).all(...params);
    res.json(returns);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Registra devolução de material ao almoxarifado (Seção 19 & 20)
returnsRouter.post('/', async (req, res) => {
  try {
    const { projectId, materialId, quantity, reason, userId } = req.body;

    if (!projectId || !materialId || !quantity) {
      return res.status(400).json({ error: 'Projeto, material e quantidade são obrigatórios' });
    }

    const result = await StockService.recordMaterialReturn(
      projectId,
      materialId,
      quantity,
      userId || 22, // Default Almoxarifado Central
      reason
    );

    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
