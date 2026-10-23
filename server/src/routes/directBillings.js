import express from 'express';
import { db } from '../db/connection.js';

export const directBillingsRouter = express.Router();

/**
 * GET /api/direct-billings
 * Lista todos os pedidos com esteira de Faturamento Direto (Print 4)
 */
directBillingsRouter.get('/', async (req, res) => {
  try {
    const records = await db.prepare(`
      SELECT 
        db.*,
        p.name as project_name,
        p.code as project_code,
        pc.code as purchase_code,
        COALESCE(m.name, pc.custom_name, 'Material') as material_name,
        pc.quantity,
        COALESCE(pc.custom_unit, m.unit, 'un') as unit,
        pc.total_price as purchase_total
      FROM direct_billings db
      LEFT JOIN projects p ON p.id = db.project_id
      LEFT JOIN purchases pc ON pc.id = db.purchase_id
      LEFT JOIN materials m ON pc.material_id = m.id
      ORDER BY db.created_at DESC
    `).all();

    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/direct-billings
 * Cria um novo registro de faturamento direto para obra/pedido
 */
directBillingsRouter.post('/', async (req, res) => {
  try {
    const {
      purchase_id,
      project_id,
      supplier_name,
      client_billing_cnpj,
      authorized_ceiling,
      billed_amount,
      notes
    } = req.body;

    const countRes = await db.prepare('SELECT COUNT(*) as count FROM direct_billings').get();
    const seq = (countRes?.count || 0) + 1;
    const code = `FD-2026-${String(seq).padStart(4, '0')}`;

    const insertB = await db.prepare(`
      INSERT INTO direct_billings (
        code, purchase_id, project_id, supplier_name, client_billing_cnpj,
        authorized_ceiling, billed_amount, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      code,
      purchase_id || null,
      project_id || null,
      supplier_name || 'Fornecedor',
      client_billing_cnpj || null,
      Number(authorized_ceiling) || 0,
      Number(billed_amount) || 0,
      notes || null
    );

    res.status(201).json({
      success: true,
      id: insertB.lastInsertRowid,
      code,
      message: 'Faturamento direto registrado com sucesso.'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PATCH /api/direct-billings/:id/step
 * Alterna o status (OK / Pendente) de uma etapa específica da esteira Compras x Financeiro (Print 4)
 */
directBillingsRouter.patch('/:id/step', async (req, res) => {
  try {
    const { id } = req.params;
    const { stepName, value } = req.body;

    const allowedSteps = [
      'step_compra_enviada',
      'step_nf_recebida',
      'step_xml_recebido',
      'step_boleto_recebido',
      'step_enviado_cliente'
    ];

    if (!allowedSteps.includes(stepName)) {
      return res.status(400).json({ error: 'Etapa de faturamento inválida.' });
    }

    await db.prepare(`
      UPDATE direct_billings 
      SET ${stepName} = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(Boolean(value), id);

    res.json({ success: true, message: `Etapa ${stepName} atualizada para ${value ? 'OK' : 'Pendente'}.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/direct-billings/web-purchases
 * Lista compras efetuadas pela internet (Mercado Livre, etc.) sem faturamento no CNPJ
 */
directBillingsRouter.get('/web-purchases', async (req, res) => {
  try {
    const purchases = await db.prepare(`
      SELECT 
        wp.*,
        p.name as project_name,
        p.code as project_code,
        u.name as purchaser_name
      FROM web_purchases wp
      LEFT JOIN projects p ON p.id = wp.project_id
      LEFT JOIN users u ON u.id = wp.purchased_by
      ORDER BY wp.purchase_date DESC, wp.created_at DESC
    `).all();

    res.json(purchases);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/direct-billings/web-purchases
 * Cadastra uma compra online / Mercado Livre sem CNPJ
 */
directBillingsRouter.post('/web-purchases', async (req, res) => {
  try {
    const {
      product_description,
      project_id,
      platform,
      amount,
      payment_method,
      delivery_status,
      invoice_receipt_number,
      receipt_url,
      userId,
      notes
    } = req.body;

    if (!product_description || !amount) {
      return res.status(400).json({ error: 'Descrição e valor da compra são obrigatórios.' });
    }

    const insertW = await db.prepare(`
      INSERT INTO web_purchases (
        product_description, project_id, platform, amount, payment_method,
        delivery_status, invoice_receipt_number, receipt_url, purchased_by, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      product_description,
      project_id || null,
      platform || 'Mercado Livre',
      Number(amount) || 0,
      payment_method || 'Cartão Corporativo',
      delivery_status || 'Pendente',
      invoice_receipt_number || null,
      receipt_url || null,
      userId || 1,
      notes || null
    );

    res.status(201).json({
      success: true,
      id: insertW.lastInsertRowid,
      message: 'Compra online registrada para prestação de contas.'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
