import express from 'express';
import { db } from '../db/connection.js';
import { StockService } from '../services/stockService.js';

export const materialsRouter = express.Router();

// Lista todos os materiais da Base Central com cálculo de estoque físico, reservado e disponível
materialsRouter.get('/', (req, res) => {
  try {
    const { category, search, below_minimum } = req.query;
    let query = `
      SELECT m.*, s.name as supplier_name
      FROM materials m
      LEFT JOIN suppliers s ON m.supplier_id = s.id
      WHERE 1=1
    `;
    const params = [];

    if (category) {
      query += ' AND m.category = ?';
      params.push(category);
    }
    if (search) {
      query += ' AND (m.name LIKE ? OR m.code LIKE ? OR m.brand LIKE ? OR m.description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (below_minimum === 'true') {
      query += ' AND m.stock_physical <= m.stock_minimum';
    }

    query += ' ORDER BY m.id ASC';

    const materials = db.prepare(query).all(...params);

    const enriched = materials.map(m => {
      const stock_available = Math.max(0, m.stock_physical - m.stock_reserved);
      const isBelowMinimum = m.stock_physical <= m.stock_minimum;
      const isCritical = m.stock_physical === 0;

      return {
        ...m,
        stock_available,
        isBelowMinimum,
        isCritical
      };
    });

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Detalhe de um material específico
materialsRouter.get('/:id', (req, res) => {
  try {
    const mat = StockService.getMaterialStock(req.params.id);
    const movements = db.prepare(`
      SELECT sm.*, u.name as user_name, p.name as project_name, p.code as project_code
      FROM stock_movements sm
      LEFT JOIN users u ON sm.user_id = u.id
      LEFT JOIN projects p ON sm.project_id = p.id
      WHERE sm.material_id = ?
      ORDER BY sm.id DESC
      LIMIT 20
    `).all(req.params.id);

    res.json({ ...mat, movements });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Cadastra novo material na Base Central (Seção 11)
materialsRouter.post('/', (req, res) => {
  try {
    const { name, description, category, unit, brand, reference_price, supplier_id, stock_physical, stock_minimum, status, userId } = req.body;

    if (!name || !category || !unit) {
      return res.status(400).json({ error: 'Nome, categoria e unidade de medida são obrigatórios' });
    }

    // Código automático: MAT-000XXX (Seção 11 e 12)
    const count = db.prepare('SELECT COUNT(*) as count FROM materials').get().count + 1;
    const code = `MAT-${String(100 + count).padStart(6, '0')}`;

    const insert = db.prepare(`
      INSERT INTO materials (
        code, name, description, category, unit, brand,
        reference_price, supplier_id, stock_physical, stock_reserved,
        stock_minimum, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `);

    const result = insert.run(
      code, name, description || null, category, unit, brand || null,
      Number(reference_price) || 0, supplier_id || null,
      Number(stock_physical) || 0, Number(stock_minimum) || 10,
      status || 'Ativo'
    );

    const materialId = result.lastInsertRowid;

    // Se começou com estoque físico > 0, registra movimentação inicial
    if (Number(stock_physical) > 0) {
      db.prepare(`
        INSERT INTO stock_movements (material_id, type, quantity, previous_stock, new_stock, user_id, notes)
        VALUES (?, 'ENTRADA', ?, 0, ?, ?, 'Saldo inicial no cadastro do material')
      `).run(materialId, Number(stock_physical), Number(stock_physical), userId || 1);
    }

    // Auditoria
    db.prepare(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
      VALUES (?, 'CRIAR_MATERIAL', 'ESTOQUE', ?, ?)
    `).run(userId || 1, materialId, `Material cadastrado: ${name} (${code}) na categoria ${category}`);

    res.status(201).json({ id: materialId, code, name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Atualiza material
materialsRouter.put('/:id', (req, res) => {
  try {
    const { name, description, category, unit, brand, reference_price, supplier_id, stock_minimum, status, userId } = req.body;
    const materialId = req.params.id;

    db.prepare(`
      UPDATE materials SET
        name = ?, description = ?, category = ?, unit = ?, brand = ?,
        reference_price = ?, supplier_id = ?, stock_minimum = ?,
        status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      name, description, category, unit, brand,
      Number(reference_price), supplier_id, Number(stock_minimum),
      status, materialId
    );

    res.json({ success: true, materialId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Entrada simplificada de estoque (Seção 12: Selecionar material -> Informar quantidade -> Confirmar)
materialsRouter.post('/quick-entry', (req, res) => {
  try {
    const { materialId, quantity, notes, userId } = req.body;
    const result = StockService.recordSimplifiedEntry(materialId, quantity, userId || 1, notes);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
