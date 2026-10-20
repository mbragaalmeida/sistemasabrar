import express from 'express';
import { db } from '../db/connection.js';

export const stockRouter = express.Router();

// Histórico de movimentações de estoque (Seção 23)
stockRouter.get('/movements', async (req, res) => {
  try {
    const { material_id, project_id, type } = req.query;
    let query = `
      SELECT sm.*,
             COALESCE(m.name, sm.custom_name, 'Material Fora da Base') as material_name,
             COALESCE(m.code, 'FORA-BASE') as material_code,
             COALESCE(m.unit, sm.custom_unit, 'un') as material_unit,
             p.name as project_name, p.code as project_code, u.name as user_name
      FROM stock_movements sm
      LEFT JOIN materials m ON sm.material_id = m.id
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

// Lista solicitações de ajuste de estoque (Item 9)
stockRouter.get('/adjustments', async (req, res) => {
  try {
    const { status } = req.query;
    let query = `
      SELECT sa.*,
             m.name as material_name, m.code as material_code, m.unit as material_unit,
             req_u.name as requested_by_name,
             rev_u.name as reviewed_by_name
      FROM stock_adjustments sa
      JOIN materials m ON sa.material_id = m.id
      LEFT JOIN users req_u ON sa.requested_by = req_u.id
      LEFT JOIN users rev_u ON sa.reviewed_by = rev_u.id
      WHERE 1=1
    `;
    const params = [];
    if (status) {
      query += ' AND sa.status = ?';
      params.push(status);
    }
    query += ' ORDER BY sa.created_at DESC LIMIT 100';

    const adjustments = await db.prepare(query).all(...params);
    res.json(adjustments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Solicita ou aplica ajuste de estoque (Item 9)
// Todos com acesso à aba podem propor. Confirmação imediata para Admins, Sabrina ou Emily; demais exigem aprovação.
stockRouter.post('/adjustments', async (req, res) => {
  try {
    const { material_id, requested_stock, reason, user_id } = req.body;

    if (!material_id || requested_stock === undefined || requested_stock === null || requested_stock < 0) {
      return res.status(400).json({ error: 'Material e quantidade física válida (>= 0) são obrigatórios.' });
    }
    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'Justificativa do ajuste de estoque é obrigatória.' });
    }

    const mat = await db.prepare('SELECT * FROM materials WHERE id = ?').get(material_id);
    if (!mat) return res.status(404).json({ error: 'Material não encontrado.' });

    const prevStock = Number(mat.stock_physical || 0);
    const targetStock = Number(requested_stock);
    const diff = Number((targetStock - prevStock).toFixed(2));

    const user = user_id ? await db.prepare('SELECT u.*, r.name as role_name FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ?').get(user_id) : null;

    const isDirectApprover = user && (
      user.role_name === 'admin' ||
      user.role_name === 'orcamento_engenharia' ||
      user.role_name === 'compras_solicitacoes' ||
      (user.email || '').toLowerCase().includes('sabrina') ||
      (user.email || '').toLowerCase().includes('emily')
    );

    if (isDirectApprover) {
      // Aplica imediatamente
      await db.prepare('UPDATE materials SET stock_physical = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(targetStock, material_id);

      await db.prepare(`
        INSERT INTO stock_movements (material_id, type, quantity, previous_stock, new_stock, user_id, notes)
        VALUES (?, 'ENTRADA', ?, ?, ?, ?, ?)
      `).run(
        material_id,
        Math.abs(diff),
        prevStock,
        targetStock,
        user_id || null,
        `Ajuste direto de inventário (${diff >= 0 ? '+' : ''}${diff}): ${reason.trim()}`
      );

      const adjResult = await db.prepare(`
        INSERT INTO stock_adjustments (
          material_id, previous_stock, requested_stock, difference, reason,
          requested_by, status, reviewed_by, reviewed_at, review_notes
        ) VALUES (?, ?, ?, ?, ?, ?, 'Aprovado', ?, CURRENT_TIMESTAMP, 'Aprovado diretamente pelo gestor')
      `).run(material_id, prevStock, targetStock, diff, reason.trim(), user_id || null, user_id || null);

      return res.json({
        success: true,
        direct: true,
        message: `Estoque de "${mat.name}" corrigido de ${prevStock} para ${targetStock} ${mat.unit} com sucesso!`,
        adjustment_id: adjResult.lastInsertRowid
      });
    } else {
      // Exige aprovação de Admin, Sabrina ou Emily
      const adjResult = await db.prepare(`
        INSERT INTO stock_adjustments (
          material_id, previous_stock, requested_stock, difference, reason,
          requested_by, status
        ) VALUES (?, ?, ?, ?, ?, ?, 'Pendente')
      `).run(material_id, prevStock, targetStock, diff, reason.trim(), user_id || null);

      const requester = user_id ? await db.prepare('SELECT name FROM users WHERE id = ?').get(user_id) : null;
      const requesterName = requester?.name || 'Jennifer Souza';

      // Dispara notificação urgente para Administradores, Sabrina e Emily
      await db.prepare(`
        INSERT INTO notifications (role_target, title, message, type, link)
        VALUES ('admin', 'Ajuste de Estoque Aguardando Aprovação', ?, 'urgent', '/materiais')
      `).run(`${requesterName} solicitou ajuste de saldo no item "${mat.name}" (de ${prevStock} para ${targetStock} ${mat.unit}). Motivo: "${reason.trim()}".`);

      return res.json({
        success: true,
        direct: false,
        message: `Solicitação de ajuste de estoque enviada com sucesso! Aguardando confirmação de Administradores, Sabrina ou Emily.`,
        adjustment_id: adjResult.lastInsertRowid
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Aprovar ajuste de estoque pendente (Item 9)
stockRouter.post('/adjustments/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id, notes } = req.body;

    const user = user_id ? await db.prepare('SELECT u.*, r.name as role_name FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ?').get(user_id) : null;
    const isApprover = user && (
      user.role_name === 'admin' ||
      user.role_name === 'orcamento_engenharia' ||
      user.role_name === 'compras_solicitacoes' ||
      (user.email || '').toLowerCase().includes('sabrina') ||
      (user.email || '').toLowerCase().includes('emily')
    );

    if (!isApprover) {
      return res.status(403).json({ error: 'Apenas Administradores, Sabrina ou Emily possuem permissão para aprovar correções de estoque.' });
    }

    const adj = await db.prepare('SELECT * FROM stock_adjustments WHERE id = ?').get(id);
    if (!adj) return res.status(404).json({ error: 'Ajuste de estoque não encontrado.' });
    if (adj.status !== 'Pendente') {
      return res.status(400).json({ error: `Este ajuste já foi processado (Status: ${adj.status}).` });
    }

    const mat = await db.prepare('SELECT * FROM materials WHERE id = ?').get(adj.material_id);
    if (!mat) return res.status(404).json({ error: 'Material não encontrado.' });

    const currentStock = Number(mat.stock_physical || 0);
    const targetStock = Number(adj.requested_stock);
    const diff = Number((targetStock - currentStock).toFixed(2));

    await db.prepare('UPDATE materials SET stock_physical = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(targetStock, mat.id);

    await db.prepare(`
      INSERT INTO stock_movements (material_id, type, quantity, previous_stock, new_stock, user_id, notes)
      VALUES (?, 'ENTRADA', ?, ?, ?, ?, ?)
    `).run(
      mat.id,
      Math.abs(diff),
      currentStock,
      targetStock,
      user_id,
      `Ajuste aprovado por ${user.name}: ${adj.reason}`
    );

    await db.prepare(`
      UPDATE stock_adjustments
      SET status = 'Aprovado', reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, review_notes = ?
      WHERE id = ?
    `).run(user_id, notes || 'Aprovado', id);

    if (adj.requested_by) {
      await db.prepare(`
        INSERT INTO notifications (user_id, role_target, title, message, type, link)
        VALUES (?, 'almoxarifado', 'Ajuste de Estoque Aprovado', ?, 'info', '/materiais')
      `).run(adj.requested_by, `Ajuste no material "${mat.name}" foi aprovado por ${user.name}. Novo estoque: ${targetStock} ${mat.unit}.`);
    }

    res.json({ success: true, message: `Ajuste aprovado! Novo estoque físico de "${mat.name}": ${targetStock} ${mat.unit}.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Rejeitar ajuste de estoque pendente (Item 9)
stockRouter.post('/adjustments/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id, notes } = req.body;

    const user = user_id ? await db.prepare('SELECT u.*, r.name as role_name FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ?').get(user_id) : null;
    const isApprover = user && (
      user.role_name === 'admin' ||
      user.role_name === 'orcamento_engenharia' ||
      user.role_name === 'compras_solicitacoes' ||
      (user.email || '').toLowerCase().includes('sabrina') ||
      (user.email || '').toLowerCase().includes('emily')
    );

    if (!isApprover) {
      return res.status(403).json({ error: 'Apenas Administradores, Sabrina ou Emily possuem permissão para recusar correções de estoque.' });
    }

    const adj = await db.prepare('SELECT * FROM stock_adjustments WHERE id = ?').get(id);
    if (!adj) return res.status(404).json({ error: 'Ajuste de estoque não encontrado.' });
    if (adj.status !== 'Pendente') {
      return res.status(400).json({ error: `Este ajuste já foi processado (Status: ${adj.status}).` });
    }

    await db.prepare(`
      UPDATE stock_adjustments
      SET status = 'Rejeitado', reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, review_notes = ?
      WHERE id = ?
    `).run(user_id, notes || 'Recusado', id);

    if (adj.requested_by) {
      const mat = await db.prepare('SELECT name FROM materials WHERE id = ?').get(adj.material_id);
      await db.prepare(`
        INSERT INTO notifications (user_id, role_target, title, message, type, link)
        VALUES (?, 'almoxarifado', 'Ajuste de Estoque Recusado', ?, 'urgent', '/materiais')
      `).run(adj.requested_by, `Ajuste no material "${mat?.name || 'Material'}" foi recusado por ${user.name}. Motivo: ${notes || 'Não informado'}.`);
    }

    res.json({ success: true, message: 'Solicitação de ajuste de estoque recusada com sucesso.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

