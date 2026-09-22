import express from 'express';
import { db } from '../db/connection.js';

export const reportsRouter = express.Router();

// Relatório por Projeto (Seção 34)
reportsRouter.get('/projects', async (req, res) => {
  try {
    const projects = await db.prepare('SELECT * FROM projects ORDER BY id DESC').all();

    const report = await Promise.all(projects.map(async p => {
      const budget = await db.prepare('SELECT * FROM budgets WHERE project_id = ?').get(p.id);
      
      const requestedTotal = await db.prepare(`
        SELECT SUM(mri.quantity_requested) as qty, COUNT(mr.id) as count
        FROM material_requests mr
        JOIN material_request_items mri ON mr.id = mri.request_id
        WHERE mr.project_id = ?
      `).get(p.id);

      const withdrawnTotal = (await db.prepare(`
        SELECT SUM(quantity) as qty
        FROM stock_movements
        WHERE project_id = ? AND type = 'SAIDA_OBRA'
      `).get(p.id))?.qty || 0;

      const returnedTotal = (await db.prepare(`
        SELECT SUM(quantity) as qty
        FROM returns
        WHERE project_id = ?
      `).get(p.id))?.qty || 0;

      const actualConsumed = Math.max(0, withdrawnTotal - returnedTotal);

      return {
        projectId: p.id,
        code: p.code,
        name: p.name,
        client: p.client,
        status: p.status,
        projectType: p.project_type,
        budgetMaterials: budget ? Number(budget.total_materials || 0) : 0,
        budgetServices: budget ? Number(budget.total_services || 0) : 0,
        budgetFinal: budget ? Number(budget.total_final || 0) : 0,
        totalItemsRequested: requestedTotal?.qty || 0,
        totalItemsWithdrawn: withdrawnTotal,
        totalItemsReturned: returnedTotal,
        totalItemsConsumed: actualConsumed,
        costRealizedEst: (budget ? (Number(budget.total_materials || 0) * 0.88) + Number(budget.total_services || 0) : 0)
      };
    }));

    res.json(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Relatório por Material (Seção 34)
reportsRouter.get('/materials', async (req, res) => {
  try {
    const materials = await db.prepare(`
      SELECT m.*, s.name as supplier_name
      FROM materials m
      LEFT JOIN suppliers s ON m.supplier_id = s.id
      ORDER BY m.name ASC
    `).all();

    const report = await Promise.all(materials.map(async m => {
      const totalUsed = (await db.prepare(`
        SELECT SUM(quantity) as qty
        FROM stock_movements
        WHERE material_id = ? AND type = 'SAIDA_OBRA'
      `).get(m.id))?.qty || 0;

      const totalReturned = (await db.prepare(`
        SELECT SUM(quantity) as qty
        FROM returns
        WHERE material_id = ?
      `).get(m.id))?.qty || 0;

      const projectCount = (await db.prepare(`
        SELECT COUNT(DISTINCT project_id) as count
        FROM stock_movements
        WHERE material_id = ? AND project_id IS NOT NULL
      `).get(m.id))?.count || 0;

      const available = Math.max(0, m.stock_physical - m.stock_reserved);

      return {
        id: m.id,
        code: m.code,
        name: m.name,
        category: m.category,
        unit: m.unit,
        brand: m.brand,
        supplier: m.supplier_name,
        referencePrice: m.reference_price,
        stockPhysical: m.stock_physical,
        stockReserved: m.stock_reserved,
        stockAvailable: available,
        stockMinimum: m.stock_minimum,
        totalUsed,
        totalReturned,
        actualConsumed: Math.max(0, totalUsed - totalReturned),
        projectCount,
        stockValuation: Number((m.stock_physical * m.reference_price).toFixed(2))
      };
    }));

    res.json(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Relatório de Compras (Seção 34)
reportsRouter.get('/purchases', async (req, res) => {
  try {
    const purchases = await db.prepare(`
      SELECT p.*, m.name as material_name, m.code as material_code, m.unit as material_unit,
             s.name as supplier_name, pr.name as project_name, pr.code as project_code
      FROM purchases p
      JOIN materials m ON p.material_id = m.id
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      LEFT JOIN projects pr ON p.project_id = pr.id
      ORDER BY p.id DESC
    `).all();

    const supplierSummary = await db.prepare(`
      SELECT s.name as supplier_name, COUNT(p.id) as total_orders, SUM(p.total_price) as total_spent
      FROM purchases p
      JOIN suppliers s ON p.supplier_id = s.id
      WHERE p.status IN ('Comprado', 'Aguardando entrega', 'Recebido')
      GROUP BY s.id, s.name
    `).all();

    res.json({
      purchases,
      supplierSummary
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Relatório de Estoque (Entradas, Saídas, Devoluções, Saldo - Seção 34)
reportsRouter.get('/stock', async (req, res) => {
  try {
    const totals = await db.prepare(`
      SELECT 
        SUM(CASE WHEN type = 'ENTRADA' THEN quantity ELSE 0 END) as total_entries,
        SUM(CASE WHEN type = 'SAIDA_OBRA' THEN quantity ELSE 0 END) as total_exits,
        SUM(CASE WHEN type = 'DEVOLUCAO' THEN quantity ELSE 0 END) as total_returns
      FROM stock_movements
    `).get();

    const lowStockMaterials = await db.prepare(`
      SELECT id, code, name, category, unit, stock_physical, stock_minimum, reference_price
      FROM materials
      WHERE stock_physical <= stock_minimum AND status = 'Ativo'
    `).all();

    res.json({
      balanceSummary: totals,
      lowStockMaterials
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
