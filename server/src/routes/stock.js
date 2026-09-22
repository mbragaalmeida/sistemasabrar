import express from 'express';
import { db } from '../db/connection.js';

export const stockRouter = express.Router();

// Histórico de movimentações de estoque (Seção 23)
stockRouter.get('/movements', async (req, res) => {
  try {
    const { material_id, project_id, type } = req.query;
    let query = `
      SELECT sm.*, m.name as material_name, m.code as material_code, m.unit as material_unit,
             p.name as project_name, p.code as project_code, u.name as user_name
      FROM stock_movements sm
      JOIN materials m ON sm.material_id = m.id
      LEFT JOIN projects p ON sm.project_id = p.id
      LEFT JOIN users u ON sm.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (material_id) {
      query += ' AND sm.material_id = ?';
      params.push(material_id);
    }
    if (project_id) {
      query += ' AND sm.project_id = ?';
      params.push(project_id);
    }
    if (type) {
      query += ' AND sm.type = ?';
      params.push(type);
    }

    query += ' ORDER BY sm.id DESC LIMIT 100';

    const movements = await db.prepare(query).all(...params);
    res.json(movements);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Resumo geral do estoque (Valuation, itens baixos, disponíveis)
stockRouter.get('/summary', async (req, res) => {
  try {
    const materials = await db.prepare("SELECT * FROM materials WHERE status = 'Ativo'").all();

    let totalPhysicalValuation = 0;
    let totalItems = materials.length;
    let belowMinimumCount = 0;
    let totalReservedItems = 0;

    for (const m of materials) {
      totalPhysicalValuation += (m.stock_physical * m.reference_price);
      if (m.stock_physical <= m.stock_minimum) {
        belowMinimumCount++;
      }
      if (m.stock_reserved > 0) {
        totalReservedItems++;
      }
    }

    res.json({
      totalItems,
      totalPhysicalValuation: Number(totalPhysicalValuation.toFixed(2)),
      belowMinimumCount,
      totalReservedItems
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
