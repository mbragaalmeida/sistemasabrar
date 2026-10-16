import express from 'express';
import { db } from '../db/connection.js';
import { StockService } from '../services/stockService.js';

export const purchasesRouter = express.Router();

// Lista fila de demandas e pedidos de compra
purchasesRouter.get('/', async (req, res) => {
  try {
    const { status, priority, project_id } = req.query;
    let query = `
      SELECT p.*,
             COALESCE(m.name, p.custom_name, 'Material Fora da Base') as material_name,
             COALESCE(m.code, 'FORA-BASE') as material_code,
             COALESCE(m.unit, p.custom_unit, 'un') as material_unit,
             s.name as supplier_name, pr.name as project_name, pr.code as project_code,
             u.name as buyer_name
      FROM purchases p
      LEFT JOIN materials m ON p.material_id = m.id
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      LEFT JOIN projects pr ON p.project_id = pr.id
      LEFT JOIN users u ON p.buyer_id = u.id
      WHERE (p.is_hidden IS FALSE OR p.is_hidden IS NULL)
    `;
    const params = [];

    if (status) {
      query += ' AND p.status = ?';
      params.push(status);
    }
    if (priority) {
      query += ' AND p.priority = ?';
      params.push(priority);
    }
    if (project_id) {
      query += ' AND p.project_id = ?';
      params.push(project_id);
    }

    query += ' ORDER BY p.id DESC';

    const purchases = await db.prepare(query).all(...params);
    res.json(purchases);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Cadastra uma nova solicitação manual de compra
purchasesRouter.post('/', async (req, res) => {
  try {
    const {
      material_id,
      quantity,
      project_id,
      supplier_id,
      unit_price,
      priority,
      notes,
      buyer_id,
      expected_delivery_date,
      status
    } = req.body;

    if (!material_id || !quantity || Number(quantity) <= 0) {
      return res.status(400).json({ error: 'Material e quantidade válida (> 0) são obrigatórios.' });
    }

    const mat = await db.prepare('SELECT * FROM materials WHERE id = ?').get(material_id);
    if (!mat) return res.status(404).json({ error: 'Material não encontrado.' });

    const nextPurchaseCount = ((await db.prepare('SELECT COUNT(*) as count FROM purchases WHERE (is_hidden IS FALSE OR is_hidden IS NULL)').get())?.count || 0) + 1;
    const purchaseCode = `COM-2026-${String(nextPurchaseCount).padStart(4, '0')}`;

    const price = (unit_price !== undefined && unit_price !== null && unit_price !== '') ? Number(unit_price) : mat.reference_price;
    const totalPrice = Number((Number(quantity) * price).toFixed(2));
    const finalSupplierId = supplier_id ? Number(supplier_id) : (mat.supplier_id || null);

    const result = await db.prepare(`
      INSERT INTO purchases (
        code, project_id, material_id, quantity, supplier_id,
        unit_price, total_price, status, priority, purchase_date,
        expected_delivery_date, buyer_id, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      purchaseCode,
      project_id ? Number(project_id) : null,
      Number(material_id),
      Number(quantity),
      finalSupplierId,
      price,
      totalPrice,
      status || 'Em cotação',
      priority || 'Média',
      new Date().toISOString().split('T')[0],
      expected_delivery_date || null,
      buyer_id || null,
      notes?.trim() || 'Solicitação manual de compra.'
    );

    const created = await db.prepare(`
      SELECT p.*, m.name as material_name, m.code as material_code, m.unit as material_unit,
             s.name as supplier_name, pr.name as project_name, pr.code as project_code,
             u.name as buyer_name
      FROM purchases p
      JOIN materials m ON p.material_id = m.id
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      LEFT JOIN projects pr ON p.project_id = pr.id
      LEFT JOIN users u ON p.buyer_id = u.id
      WHERE p.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Atualiza informações de cotação ou compra (Seção 17)
purchasesRouter.put('/:id', async (req, res) => {
  try {
    const purchaseId = req.params.id;
    const { supplier_id, unit_price, total_price, status, priority, purchase_date, expected_delivery_date, notes, buyer_id } = req.body;

    const pur = await db.prepare('SELECT * FROM purchases WHERE id = ?').get(purchaseId);
    if (!pur) return res.status(404).json({ error: 'Pedido de compra não encontrado' });

    const calcTotal = total_price || (unit_price && pur.quantity ? unit_price * pur.quantity : pur.total_price);

    await db.prepare(`
      UPDATE purchases SET
        supplier_id = ?, unit_price = ?, total_price = ?, status = ?,
        priority = ?, purchase_date = ?, expected_delivery_date = ?,
        notes = ?, buyer_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      supplier_id || pur.supplier_id,
      unit_price !== undefined ? unit_price : pur.unit_price,
      calcTotal,
      status || pur.status,
      priority || pur.priority,
      purchase_date || pur.purchase_date,
      expected_delivery_date || pur.expected_delivery_date,
      notes || pur.notes,
      buyer_id || pur.buyer_id,
      purchaseId
    );

    res.json({ success: true, purchaseId, status: status || pur.status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Confirma recebimento de material no estoque (Seção 18)
purchasesRouter.post('/:id/receive', async (req, res) => {
  try {
    const purchaseId = req.params.id;
    const { userId } = req.body;

    const result = await StockService.confirmPurchaseReceipt(purchaseId, userId || 5);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
