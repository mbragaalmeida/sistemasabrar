import express from 'express';
import { db } from '../db/connection.js';

export const receivingChecklistsRouter = express.Router();

/**
 * GET /api/receiving-checklists
 * Lista todos os checklists de recebimento de materiais
 */
receivingChecklistsRouter.get('/', async (req, res) => {
  try {
    const checklists = await db.prepare(`
      SELECT 
        rc.*,
        p.name as project_name,
        p.code as project_code,
        u.name as received_by_name,
        (SELECT COUNT(*) FROM receiving_checklist_items rci WHERE rci.checklist_id = rc.id) as total_items,
        (SELECT COUNT(*) FROM receiving_checklist_items rci WHERE rci.checklist_id = rc.id AND rci.status = 'Recebido') as received_items
      FROM receiving_checklists rc
      LEFT JOIN projects p ON p.id = rc.project_id
      LEFT JOIN users u ON u.id = rc.received_by
      ORDER BY rc.created_at DESC
    `).all();

    res.json(checklists);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/receiving-checklists/:id
 * Retorna os detalhes completos do checklist com itens, fotos e status (Print 3)
 */
receivingChecklistsRouter.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const checklist = await db.prepare(`
      SELECT 
        rc.*,
        p.name as project_name,
        p.code as project_code,
        u.name as received_by_name
      FROM receiving_checklists rc
      LEFT JOIN projects p ON p.id = rc.project_id
      LEFT JOIN users u ON u.id = rc.received_by
      WHERE rc.id = ?
    `).get(id);

    if (!checklist) return res.status(404).json({ error: 'Checklist de recebimento não encontrado.' });

    const items = await db.prepare(`
      SELECT 
        rci.*,
        COALESCE(rci.material_name, m.name, 'Material') as item_description,
        COALESCE(rci.brand || ' ' || rci.model, m.brand, '') as brand_model,
        m.image_url as material_image_url,
        COALESCE(m.unit, 'und') as unit,
        m.unit as material_unit
      FROM receiving_checklist_items rci
      LEFT JOIN materials m ON m.id = rci.material_id
      WHERE rci.checklist_id = ?
      ORDER BY rci.id ASC
    `).all(id);

    res.json({
      checklist,
      items
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/receiving-checklists
 * Cria um novo checklist de conferência física
 */
receivingChecklistsRouter.post('/', async (req, res) => {
  try {
    const {
      request_code,
      project_id,
      purchase_id,
      supplier_id,
      supplier_name,
      conference_date,
      notes,
      userId,
      items
    } = req.body;

    const countRes = await db.prepare('SELECT COUNT(*) as count FROM receiving_checklists').get();
    const seq = (countRes?.count || 0) + 1;
    const code = `CR-2026-${String(seq).padStart(4, '0')}`;

    const insertC = await db.prepare(`
      INSERT INTO receiving_checklists (
        code, request_code, project_id, purchase_id, supplier_id,
        supplier_name, conference_date, status, received_by, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Em conferência', ?, ?)
    `).run(
      code,
      request_code || null,
      project_id || null,
      purchase_id || null,
      supplier_id || null,
      supplier_name || 'Fornecedor Diversos',
      conference_date || new Date().toISOString().split('T')[0],
      userId || 1,
      notes || null
    );

    const checklistId = insertC.lastInsertRowid;

    if (Array.isArray(items) && items.length > 0) {
      for (const it of items) {
        await db.prepare(`
          INSERT INTO receiving_checklist_items (
            checklist_id, material_id, material_name, brand, model,
            image_url, quantity_requested, quantity_received, status, invoice_number
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          checklistId,
          it.material_id || null,
          it.material_name || 'Material',
          it.brand || null,
          it.model || null,
          it.image_url || null,
          Number(it.quantity_requested) || 0,
          Number(it.quantity_received) || 0,
          it.status || 'Pendente',
          it.invoice_number || null
        );
      }
    }

    res.status(201).json({
      success: true,
      checklistId,
      code,
      message: `Checklist de recebimento ${code} criado com sucesso.`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/receiving-checklists/:id/items
 * Atualiza as quantidades recebidas e status dos itens no checklist
 */
receivingChecklistsRouter.put('/:id/items', async (req, res) => {
  try {
    const { id } = req.params;
    const { items } = req.body;

    if (!Array.isArray(items)) {
      return res.status(400).json({ error: 'Array de itens inválido.' });
    }

    for (const it of items) {
      if (it.id) {
        await db.prepare(`
          UPDATE receiving_checklist_items
          SET quantity_received = ?,
              status = ?,
              invoice_number = ?
          WHERE id = ? AND checklist_id = ?
        `).run(
          Number(it.quantity_received) || 0,
          it.status || 'Pendente',
          it.invoice_number || null,
          it.id,
          id
        );
      }
    }

    res.json({ success: true, message: 'Itens do checklist atualizados.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/receiving-checklists/:id/finalize
 * Finaliza a conferência de recebimento e dá entrada física no estoque
 */
receivingChecklistsRouter.post('/:id/finalize', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    const checklist = await db.prepare('SELECT * FROM receiving_checklists WHERE id = ?').get(id);
    if (!checklist) return res.status(404).json({ error: 'Checklist não encontrado.' });

    const items = await db.prepare('SELECT * FROM receiving_checklist_items WHERE checklist_id = ?').all(id);

    for (const it of items) {
      const receivedQty = Number(it.quantity_received || 0);
      if (receivedQty > 0 && it.material_id) {
        // Incrementa o estoque físico
        await db.prepare(`
          UPDATE materials 
          SET stock_physical = stock_physical + ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(receivedQty, it.material_id);

        // Registra movimentação de entrada
        await db.prepare(`
          INSERT INTO stock_movements (
            material_id, type, quantity, previous_stock, new_stock, user_id, notes
          ) VALUES (?, 'ENTRADA', ?, 0, ?, ?, ?)
        `).run(
          it.material_id,
          receivedQty,
          receivedQty,
          userId || 1,
          `Entrada via Checklist de Recebimento ${checklist.code} (NF: ${it.invoice_number || 'S/N'})`
        );
      }
    }

    await db.prepare(`UPDATE receiving_checklists SET status = 'Concluído' WHERE id = ?`).run(id);

    res.json({
      success: true,
      message: `Checklist ${checklist.code} finalizado com sucesso e materiais inseridos no estoque.`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
