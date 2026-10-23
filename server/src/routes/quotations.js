import express from 'express';
import { db } from '../db/connection.js';

export const quotationsRouter = express.Router();

/**
 * GET /api/quotations
 * Lista todas as cotações com resumo de fornecedores e status
 */
quotationsRouter.get('/', async (req, res) => {
  try {
    const quotations = await db.prepare(`
      SELECT 
        pq.*,
        p.name as project_name,
        p.code as project_code,
        u.name as created_by_name,
        (SELECT COUNT(*) FROM purchase_quotation_suppliers pqs WHERE pqs.quotation_id = pq.id) as suppliers_count
      FROM purchase_quotations pq
      LEFT JOIN projects p ON p.id = pq.project_id
      LEFT JOIN users u ON u.id = pq.created_by
      ORDER BY pq.created_at DESC
    `).all();

    res.json(quotations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/quotations/:id
 * Retorna os detalhes completos da cotação com a matriz comparativa lado a lado (Print 2)
 */
quotationsRouter.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const quotation = await db.prepare(`
      SELECT pq.*, p.name as project_name, p.code as project_code, u.name as created_by_name
      FROM purchase_quotations pq
      LEFT JOIN projects p ON p.id = pq.project_id
      LEFT JOIN users u ON u.id = pq.created_by
      WHERE pq.id = ?
    `).get(id);

    if (!quotation) return res.status(404).json({ error: 'Cotação não encontrada.' });

    const suppliers = await db.prepare(`
      SELECT 
        pqs.*,
        COALESCE(pqs.total_cost, pqs.subtotal) as total_amount,
        COALESCE(pqs.tax_aliquot_percent, 0) as tax_rate,
        COALESCE(pqs.tax_total, 0) as tax_amount,
        COALESCE(pqs.transport_cost, 0) as freight_amount,
        s.name as registered_supplier_name,
        s.cnpj,
        s.contact_person as contact_name,
        s.phone
      FROM purchase_quotation_suppliers pqs
      LEFT JOIN suppliers s ON s.id = pqs.supplier_id
      WHERE pqs.quotation_id = ?
      ORDER BY pqs.id ASC
    `).all(id);

    const items = await db.prepare(`
      SELECT DISTINCT ON (COALESCE(pqi.material_id, pqi.id))
        pqi.id,
        pqi.material_id,
        COALESCE(pqi.material_description, m.name, 'Material') as mat_name,
        COALESCE(m.code, 'MAT') as mat_code,
        pqi.quantity,
        COALESCE(pqi.unit, m.unit, 'und') as unit
      FROM purchase_quotation_items pqi
      LEFT JOIN materials m ON m.id = pqi.material_id
      WHERE pqi.quotation_id = ?
      ORDER BY COALESCE(pqi.material_id, pqi.id), pqi.id ASC
    `).all(id);

    res.json({
      quotation,
      suppliers,
      items
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/quotations
 * Cria um novo processo de cotação
 */
quotationsRouter.post('/', async (req, res) => {
  try {
    const { title, project_id, purchase_id, deadline, notes, userId, initialItems } = req.body;

    const countRes = await db.prepare('SELECT COUNT(*) as count FROM purchase_quotations').get();
    const seq = (countRes?.count || 0) + 1;
    const quotation_number = `COT-2026-${String(seq).padStart(4, '0')}`;

    const insertQ = await db.prepare(`
      INSERT INTO purchase_quotations (
        quotation_number, title, project_id, purchase_id, deadline, notes, created_by, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Em Cotação')
    `).run(
      quotation_number,
      title || `Cotação de Materiais ${quotation_number}`,
      project_id || null,
      purchase_id || null,
      deadline || null,
      notes || null,
      userId || 1
    );

    const quotationId = insertQ.lastInsertRowid;

    res.status(201).json({
      success: true,
      quotationId,
      quotation_number,
      message: `Cotação ${quotation_number} aberta com sucesso.`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/quotations/:id/suppliers
 * Insere a proposta comercial de um fornecedor (Print 2)
 */
quotationsRouter.post('/:id/suppliers', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      supplier_id,
      supplier_name,
      delivery_deadline_days,
      tax_aliquot_percent,
      transport_cost,
      items,
      notes
    } = req.body;

    if (!supplier_name) {
      return res.status(400).json({ error: 'O nome do fornecedor é obrigatório.' });
    }

    // Calcula subtotais dos itens
    let subtotal = 0;
    const cleanItems = (items || []).map(it => {
      const q = Number(it.quantity) || 0;
      const p = Number(it.unit_price) || 0;
      const st = Number((q * p).toFixed(2));
      subtotal += st;
      return {
        material_id: it.material_id || null,
        material_description: it.material_description || it.material_name,
        quantity: q,
        unit: it.unit || 'und',
        unit_price: p,
        subtotal: st
      };
    });

    const taxPercent = Number(tax_aliquot_percent) || 0;
    const taxTotal = Number(((subtotal * taxPercent) / 100).toFixed(2));
    const transport = Number(transport_cost) || 0;
    const totalCost = Number((subtotal + taxTotal + transport).toFixed(2));

    const insertSup = await db.prepare(`
      INSERT INTO purchase_quotation_suppliers (
        quotation_id, supplier_id, supplier_name, delivery_deadline_days,
        tax_aliquot_percent, tax_total, transport_cost, subtotal, total_cost, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      supplier_id || null,
      supplier_name,
      Number(delivery_deadline_days) || 0,
      taxPercent,
      taxTotal,
      transport,
      subtotal,
      totalCost,
      notes || null
    );

    const supId = insertSup.lastInsertRowid;

    for (const it of cleanItems) {
      await db.prepare(`
        INSERT INTO purchase_quotation_items (
          quotation_id, quotation_supplier_id, material_id, material_description,
          quantity, unit, unit_price, subtotal
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        supId,
        it.material_id,
        it.material_description,
        it.quantity,
        it.unit,
        it.unit_price,
        it.subtotal
      );
    }

    res.status(201).json({
      success: true,
      quotationSupplierId: supId,
      subtotal,
      taxTotal,
      transport,
      totalCost,
      message: `Proposta de ${supplier_name} cadastrada com sucesso.`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PATCH /api/quotations/:id/winner
 * Marca a proposta do fornecedor selecionado como vencedora
 */
quotationsRouter.patch('/:id/winner', async (req, res) => {
  try {
    const { id } = req.params;
    const { quotationSupplierId } = req.body;

    await db.prepare(`UPDATE purchase_quotation_suppliers SET is_winner = false WHERE quotation_id = ?`).run(id);
    await db.prepare(`UPDATE purchase_quotation_suppliers SET is_winner = true WHERE id = ? AND quotation_id = ?`).run(quotationSupplierId, id);
    await db.prepare(`UPDATE purchase_quotations SET status = 'Pronto para Decisão', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(id);

    res.json({ success: true, message: 'Proposta vencedora definida.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
