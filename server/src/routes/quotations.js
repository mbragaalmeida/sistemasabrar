import express from 'express';
import { db } from '../db/connection.js';
import { PurchaseOrderExportService } from '../services/purchaseOrderExportService.js';

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
    const itemsPrices = req.body.items_prices || {};
    const itemsPricesJson = typeof itemsPrices === 'object' ? JSON.stringify(itemsPrices) : String(itemsPrices);

    const insertSup = await db.prepare(`
      INSERT INTO purchase_quotation_suppliers (
        quotation_id, supplier_id, supplier_name, delivery_deadline_days,
        tax_aliquot_percent, tax_total, transport_cost, subtotal, total_cost, notes, items_prices
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      notes || null,
      itemsPricesJson
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
 * POST /api/quotations/:id/items
 * Adiciona um item para comparação na cotação
 */
quotationsRouter.post('/:id/items', async (req, res) => {
  try {
    const { id } = req.params;
    const { material_id, material_description, quantity, unit, unit_price } = req.body;

    let matName = material_description;
    let matUnit = unit;
    let matId = material_id ? parseInt(material_id, 10) : null;

    if (matId) {
      const mat = await db.prepare('SELECT name, unit FROM materials WHERE id = ?').get(matId);
      if (mat) {
        if (!matName) matName = mat.name;
        if (!matUnit) matUnit = mat.unit;
      }
    }

    if (!matName) {
      return res.status(400).json({ error: 'Descrição ou material é obrigatório.' });
    }

    const q = Number(quantity) > 0 ? Number(quantity) : 1;
    const p = Number(unit_price) >= 0 ? Number(unit_price) : 0;
    const st = Number((q * p).toFixed(2));

    const insert = await db.prepare(`
      INSERT INTO purchase_quotation_items (
        quotation_id, quotation_supplier_id, material_id, material_description,
        quantity, unit, unit_price, subtotal
      ) VALUES (?, NULL, ?, ?, ?, ?, ?, ?)
    `).run(id, matId, matName, q, matUnit || 'und', p, st);

    res.status(201).json({ success: true, itemId: insert.lastInsertRowid, message: 'Item adicionado à cotação.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/quotations/:id/items/:itemId
 * Atualiza um item da cotação (quantidade, unidade, descrição)
 */
quotationsRouter.put('/:id/items/:itemId', async (req, res) => {
  try {
    const { id, itemId } = req.params;
    const { material_description, quantity, unit, material_id } = req.body;

    const existing = await db.prepare('SELECT * FROM purchase_quotation_items WHERE id = ? AND quotation_id = ?').get(itemId, id);
    if (!existing) {
      return res.status(404).json({ error: 'Item não encontrado na cotação.' });
    }

    const q = quantity !== undefined ? Number(quantity) : existing.quantity;
    const u = unit || existing.unit;
    const desc = material_description || existing.material_description;
    const matId = material_id !== undefined ? material_id : existing.material_id;

    if (existing.material_id) {
      await db.prepare(`
        UPDATE purchase_quotation_items
        SET quantity = ?, unit = ?, material_description = ?, material_id = ?, subtotal = ROUND((unit_price * ?)::numeric, 2)
        WHERE quotation_id = ? AND (id = ? OR material_id = ?)
      `).run(q, u, desc, matId, q, id, itemId, existing.material_id);
    } else {
      await db.prepare(`
        UPDATE purchase_quotation_items
        SET quantity = ?, unit = ?, material_description = ?, material_id = ?, subtotal = ROUND((unit_price * ?)::numeric, 2)
        WHERE quotation_id = ? AND id = ?
      `).run(q, u, desc, matId, q, id, itemId);
    }

    res.json({ success: true, message: 'Item atualizado com sucesso.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/quotations/:id/items/:itemId
 * Remove um item do mapa comparativo de cotações
 */
quotationsRouter.delete('/:id/items/:itemId', async (req, res) => {
  try {
    const { id, itemId } = req.params;

    const existing = await db.prepare('SELECT * FROM purchase_quotation_items WHERE id = ? AND quotation_id = ?').get(itemId, id);
    if (!existing) {
      return res.status(404).json({ error: 'Item não encontrado na cotação.' });
    }

    if (existing.material_id) {
      await db.prepare(`DELETE FROM purchase_quotation_items WHERE quotation_id = ? AND (id = ? OR material_id = ?)`).run(id, itemId, existing.material_id);
    } else {
      await db.prepare(`DELETE FROM purchase_quotation_items WHERE quotation_id = ? AND id = ?`).run(id, itemId);
    }

    res.json({ success: true, message: 'Item removido da cotação com sucesso.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/quotations/:id/suppliers/:supplierId
 * Atualiza proposta de fornecedor (preços, prazos, totais)
 */
quotationsRouter.put('/:id/suppliers/:supplierId', async (req, res) => {
  try {
    const { id, supplierId } = req.params;
    const {
      supplier_name,
      delivery_deadline_days,
      tax_aliquot_percent,
      transport_cost,
      items_prices,
      subtotal,
      total_amount,
      notes,
      payment_terms
    } = req.body;

    const itemsPricesJson = typeof items_prices === 'object' ? JSON.stringify(items_prices) : String(items_prices || '{}');
    const taxPercent = Number(tax_aliquot_percent) || 0;
    const sub = Number(subtotal) || 0;
    const taxTotal = Number(((sub * taxPercent) / 100).toFixed(2));
    const transport = Number(transport_cost) || 0;
    const total = Number(total_amount) || Number((sub + taxTotal + transport).toFixed(2));

    await db.prepare(`
      UPDATE purchase_quotation_suppliers
      SET supplier_name = COALESCE(?, supplier_name),
          delivery_deadline_days = COALESCE(?, delivery_deadline_days),
          tax_aliquot_percent = ?,
          tax_total = ?,
          transport_cost = ?,
          subtotal = ?,
          total_cost = ?,
          notes = COALESCE(?, notes),
          items_prices = ?
      WHERE id = ? AND quotation_id = ?
    `).run(
      supplier_name || null,
      delivery_deadline_days !== undefined ? Number(delivery_deadline_days) : null,
      taxPercent,
      taxTotal,
      transport,
      sub,
      total,
      notes || null,
      itemsPricesJson,
      supplierId,
      id
    );

    res.json({ success: true, message: 'Proposta do fornecedor atualizada com sucesso.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/quotations/:id/suppliers/:supplierId
 * Remove um fornecedor do mapa comparativo
 */
quotationsRouter.delete('/:id/suppliers/:supplierId', async (req, res) => {
  try {
    const { id, supplierId } = req.params;
    await db.prepare('DELETE FROM purchase_quotation_suppliers WHERE id = ? AND quotation_id = ?').run(supplierId, id);
    await db.prepare('DELETE FROM purchase_quotation_items WHERE quotation_supplier_id = ? AND quotation_id = ?').run(supplierId, id);
    res.json({ success: true, message: 'Fornecedor removido do mapa comparativo.' });
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

/**
 * GET /api/quotations/:id/export-oc
 * Exporta uma Ordem de Compra editável em formato Excel (.xlsx)
 * preenchida com os dados da cotação e da proposta do fornecedor selecionado
 */
quotationsRouter.get('/:id/export-oc', async (req, res) => {
  try {
    const quotationId = Number(req.params.id);
    const supplierId = req.query.supplierId ? Number(req.query.supplierId) : null;
    const buyerUserId = req.query.userId ? Number(req.query.userId) : null;

    let buyerUser = null;
    if (buyerUserId) {
      buyerUser = await db.prepare('SELECT id, name, email, phone FROM users WHERE id = ?').get(buyerUserId);
    }

    const buffer = await PurchaseOrderExportService.exportFromQuotation(quotationId, supplierId, buyerUser);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Ordem_de_Compra_Cotacao_${quotationId}.xlsx"`);
    res.send(buffer);
  } catch (err) {
    console.error('[Export OC Quotation Error]', err);
    res.status(500).json({ error: err.message });
  }
});
