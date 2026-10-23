import express from 'express';
import { db } from '../db/connection.js';

export const transfersRouter = express.Router();

/**
 * GET /api/transfers
 * Lista todas as transferências de materiais entre obras com status de reposição
 */
transfersRouter.get('/', async (req, res) => {
  try {
    const transfers = await db.prepare(`
      SELECT 
        mt.*,
        mt.transfer_code as code,
        mt.created_at as transfer_date,
        po.name as origin_project_name,
        po.name as from_project_name,
        po.code as origin_project_code,
        po.code as from_project_code,
        pd.name as destination_project_name,
        pd.name as to_project_name,
        pd.code as destination_project_code,
        pd.code as to_project_code,
        m.name as material_name,
        m.code as material_code,
        m.unit as material_unit,
        m.image_url as material_image_url,
        uo.name as requested_by_name,
        ua.name as approved_by_name
      FROM material_transfers mt
      LEFT JOIN projects po ON po.id = mt.origin_project_id
      LEFT JOIN projects pd ON pd.id = mt.destination_project_id
      LEFT JOIN materials m ON m.id = mt.material_id
      LEFT JOIN users uo ON uo.id = mt.requested_by
      LEFT JOIN users ua ON ua.id = mt.approved_by
      ORDER BY mt.created_at DESC
    `).all();

    res.json(transfers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/transfers/reserved-by-project
 * Retorna consolidado de materiais reservados por obra
 */
transfersRouter.get('/reserved-by-project', async (req, res) => {
  try {
    const reserved = await db.prepare(`
      SELECT 
        p.id as project_id,
        p.code as project_code,
        p.name as project_name,
        m.id as material_id,
        m.code as material_code,
        m.name as material_name,
        m.unit as material_unit,
        m.image_url as material_image_url,
        SUM(mri.quantity_requested) as total_requested,
        COALESCE(SUM(mri.quantity_reserved), 0) as total_reserved
      FROM material_request_items mri
      JOIN material_requests mr ON mr.id = mri.request_id
      JOIN projects p ON p.id = mr.project_id
      JOIN materials m ON m.id = mri.material_id
      WHERE mr.status NOT IN ('Cancelado')
      GROUP BY p.id, p.code, p.name, m.id, m.code, m.name, m.unit, m.image_url
      HAVING COALESCE(SUM(mri.quantity_reserved), 0) > 0
      ORDER BY p.name, m.name
    `).all();

    res.json(reserved);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/transfers
 * Cria uma nova transferência/empréstimo de material da Obra Origem para a Obra Destino
 */
transfersRouter.post('/', async (req, res) => {
  try {
    const {
      origin_project_id,
      destination_project_id,
      material_id,
      quantity,
      unit,
      reason,
      userId
    } = req.body;

    const qty = Number(quantity);
    if (!origin_project_id || !destination_project_id || !material_id || qty <= 0) {
      return res.status(400).json({ error: 'Dados incompletos para a transferência de material.' });
    }

    if (Number(origin_project_id) === Number(destination_project_id)) {
      return res.status(400).json({ error: 'A obra de origem deve ser diferente da obra de destino.' });
    }

    const mat = await db.prepare('SELECT id, name, code, unit FROM materials WHERE id = ?').get(material_id);
    if (!mat) return res.status(404).json({ error: 'Material não encontrado.' });

    // Gera código sequencial TRF-2026-XXXX
    const countRes = await db.prepare('SELECT COUNT(*) as count FROM material_transfers').get();
    const seq = (countRes?.count || 0) + 1;
    const transfer_code = `TRF-2026-${String(seq).padStart(4, '0')}`;

    const insertTransfer = await db.prepare(`
      INSERT INTO material_transfers (
        transfer_code, origin_project_id, destination_project_id,
        material_id, quantity, unit, reason, requested_by, approved_by,
        status, repayment_status, repaid_quantity
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Concluído', 'Pendente', 0)
    `).run(
      transfer_code,
      origin_project_id,
      destination_project_id,
      material_id,
      qty,
      unit || mat.unit,
      reason || 'Empréstimo emergencial entre obras',
      userId || 1,
      userId || 1
    );

    const transferId = insertTransfer.lastInsertRowid;

    // Registra no log de auditoria
    await db.prepare(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
      VALUES (?, 'TRANSFERENCIA_OBRAS', 'ESTOQUE', ?, ?)
    `).run(
      userId || 1,
      transferId,
      `Transferência emergencial ${transfer_code}: ${qty} ${unit || mat.unit} de ${mat.name} cedidos da Obra #${origin_project_id} para Obra #${destination_project_id}`
    );

    res.status(201).json({
      success: true,
      transferId,
      transfer_code,
      message: `Transferência ${transfer_code} registrada com sucesso. Pendência de reposição criada para a obra de origem.`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/transfers/:id/repay
 * Registra a reposição (total ou parcial) do material cedido pela obra de origem
 */
transfersRouter.post('/:id/repay', async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity, notes, userId } = req.body;

    const repayQty = Number(quantity);
    if (repayQty <= 0) return res.status(400).json({ error: 'Quantidade de reposição inválida.' });

    const transfer = await db.prepare('SELECT * FROM material_transfers WHERE id = ?').get(id);
    if (!transfer) return res.status(404).json({ error: 'Transferência não encontrada.' });

    const totalQty = Number(transfer.quantity);
    const currentRepaid = Number(transfer.repaid_quantity || 0);
    const newRepaid = Number((currentRepaid + repayQty).toFixed(4));

    if (newRepaid > totalQty) {
      return res.status(400).json({
        error: `A reposição (${repayQty}) excede a pendência restante (${totalQty - currentRepaid}).`
      });
    }

    const newStatus = newRepaid >= totalQty ? 'Reposto' : 'Reposto Parcial';

    await db.prepare(`
      UPDATE material_transfers
      SET repaid_quantity = ?,
          repayment_status = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newRepaid, newStatus, id);

    await db.prepare(`
      INSERT INTO material_repayments (transfer_id, quantity, notes, repaid_by)
      VALUES (?, ?, ?, ?)
    `).run(id, repayQty, notes || 'Reposição de material transferido', userId || 1);

    res.json({
      success: true,
      newRepaidQuantity: newRepaid,
      repayment_status: newStatus,
      message: `Reposição de ${repayQty} registrada com sucesso. Status atual: ${newStatus}.`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
