import express from 'express';
import { db } from '../db/connection.js';

export const costControlRouter = express.Router();

/**
 * GET /api/cost-control/projects/:projectId
 * Retorna o comparativo consolidado Orçado x Realizado da obra com materiais, terceirizados, fretes e dutos
 */
costControlRouter.get('/projects/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;

    const project = await db.prepare('SELECT id, code, name, client_name, budget_total FROM projects WHERE id = ?').get(projectId);
    if (!project) return res.status(404).json({ error: 'Obra não encontrada.' });

    // 1. Orçado (Previsto na OP)
    const budgetItemsRes = await db.prepare(`
      SELECT 
        COALESCE(SUM(bi.subtotal), 0) as materials_budgeted,
        COUNT(bi.id) as materials_count
      FROM budget_items bi
      JOIN budgets b ON b.id = bi.budget_id
      WHERE b.project_id = ?
    `).get(projectId);

    const servicesRes = await db.prepare(`
      SELECT COALESCE(SUM(s.subtotal), 0) as services_budgeted
      FROM services s
      JOIN budgets b ON b.id = s.budget_id
      WHERE b.project_id = ?
    `).get(projectId);

    const materialsBudgeted = Number(budgetItemsRes?.materials_budgeted || 0);
    const servicesBudgeted = Number(servicesRes?.services_budgeted || 0);
    const totalBudgeted = materialsBudgeted + servicesBudgeted;

    // 2. Realizado - Materiais (Compras registradas)
    const purchasesActualRes = await db.prepare(`
      SELECT COALESCE(SUM(total_price), 0) as materials_actual
      FROM purchases
      WHERE project_id = ? AND status != 'Cancelado'
    `).get(projectId);

    const materialsActual = Number(purchasesActualRes?.materials_actual || 0);

    // 3. Realizado - Custos Extras por Categoria (Empreiteiros, Fretes, Dutos)
    const extraCosts = await db.prepare(`
      SELECT 
        pec.*,
        u.name as created_by_name
      FROM project_extra_costs pec
      LEFT JOIN users u ON u.id = pec.created_by
      WHERE pec.project_id = ?
      ORDER BY pec.cost_date DESC, pec.created_at DESC
    `).all(projectId);

    let contractorsActual = 0;
    let freightActual = 0;
    let ductsActual = 0;
    let othersActual = 0;

    for (const c of extraCosts) {
      const val = Number(c.amount) || 0;
      if (c.category === 'Empreiteiro / Terceirizado') contractorsActual += val;
      else if (c.category === 'Frete / Transporte') freightActual += val;
      else if (c.category === 'Fabricação de Dutos') ductsActual += val;
      else othersActual += val;
    }

    const totalActual = materialsActual + contractorsActual + freightActual + ductsActual + othersActual;
    const variance = totalBudgeted - totalActual;
    const variancePercent = totalBudgeted > 0 ? Number(((totalActual / totalBudgeted) * 100).toFixed(1)) : 0;

    res.json({
      project,
      summary: {
        totalBudgeted,
        materialsBudgeted,
        servicesBudgeted,
        totalActual,
        materialsActual,
        contractorsActual,
        freightActual,
        ductsActual,
        othersActual,
        variance,
        variancePercent,
        isOverBudget: totalActual > totalBudgeted
      },
      extraCosts
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/cost-control/projects/:projectId/costs
 * Cadastra custo extra na obra (Empreiteiro terceirizado, Frete ou Dutos)
 */
costControlRouter.post('/projects/:projectId/costs', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { category, description, provider_name, amount, document_ref, cost_date, notes, userId } = req.body;

    const val = Number(amount);
    if (!category || !description || val <= 0) {
      return res.status(400).json({ error: 'Categoria, descrição e valor positivo são obrigatórios.' });
    }

    const insert = await db.prepare(`
      INSERT INTO project_extra_costs (
        project_id, category, description, provider_name, amount,
        document_ref, cost_date, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      projectId,
      category,
      description,
      provider_name || null,
      val,
      document_ref || null,
      cost_date || new Date().toISOString().split('T')[0],
      notes || null,
      userId || 1
    );

    res.status(201).json({
      success: true,
      id: insert.lastInsertRowid,
      message: 'Custo registrado na obra com sucesso.'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/cost-control/costs/:id
 * Remove um lançamento de custo da obra
 */
costControlRouter.delete('/costs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.prepare('DELETE FROM project_extra_costs WHERE id = ?').run(id);
    res.json({ success: true, message: 'Lançamento de custo removido.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
