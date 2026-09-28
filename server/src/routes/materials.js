import express from 'express';
import { db } from '../db/connection.js';
import { StockService } from '../services/stockService.js';

export const materialsRouter = express.Router();

// Lista todos os materiais da Base Central com cálculo de estoque físico, reservado e disponível
materialsRouter.get('/', async (req, res) => {
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
      query += ' AND (m.name LIKE ? OR m.code LIKE ? OR m.brand LIKE ? OR m.description LIKE ? OR m.synonyms LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (below_minimum === 'true') {
      query += ' AND m.stock_physical <= m.stock_minimum';
    }

    query += ' ORDER BY m.id ASC';

    const materials = await db.prepare(query).all(...params);

    const enriched = materials.map(m => {
      const stock_physical = Number(m.stock_physical || 0);
      const stock_reserved = Number(m.stock_reserved || 0);
      const stock_minimum = Number(m.stock_minimum || 0);
      const stock_available = Math.max(0, stock_physical - stock_reserved);
      const isBelowMinimum = stock_physical <= stock_minimum;
      const isCritical = stock_physical === 0;

      return {
        ...m,
        reference_price: Number(m.reference_price) || 0,
        converted_price: m.converted_price != null ? Number(m.converted_price) : null,
        package_content: m.package_content != null ? Number(m.package_content) : null,
        linear_weight: m.linear_weight != null ? Number(m.linear_weight) : null,
        stock_physical,
        stock_reserved,
        stock_available,
        stock_minimum,
        isBelowMinimum,
        isCritical
      };
    });

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Lista todas as categorias existentes na Base Central
materialsRouter.get('/categories', async (req, res) => {
  try {
    const categories = await db.prepare(`
      SELECT category, COUNT(*) as count 
      FROM materials 
      WHERE status = 'Ativo'
      GROUP BY category 
      ORDER BY category ASC
    `).all();

    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Detalhe de um material específico
materialsRouter.get('/:id', async (req, res) => {
  try {
    const mat = await StockService.getMaterialStock(req.params.id);
    const movements = await db.prepare(`
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
materialsRouter.post('/', async (req, res) => {
  try {
    const { 
      name, description, category, unit, brand, reference_price, supplier_id, 
      stock_physical, stock_minimum, status, userId,
      synonyms, linear_weight, linear_weight_unit, package_content, converted_unit, converted_price, validation_status, pending_notes
    } = req.body;

    if (!name || !category || !unit) {
      return res.status(400).json({ error: 'Nome, categoria e unidade de medida são obrigatórios' });
    }

    // Código automático: MAT-000XXX (Seção 11 e 12)
    const count = ((await db.prepare('SELECT COUNT(*) as count FROM materials').get())?.count || 0) + 1;
    const code = `MAT-${String(100 + count).padStart(6, '0')}`;

    const insert = db.prepare(`
      INSERT INTO materials (
        code, name, description, category, unit, brand,
        reference_price, supplier_id, stock_physical, stock_reserved,
        stock_minimum, status, synonyms, linear_weight, linear_weight_unit,
        package_content, converted_unit, converted_price, validation_status, pending_notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = await insert.run(
      code, name, description || null, category, unit, brand || null,
      Number(reference_price) || 0, supplier_id || null,
      Number(stock_physical) || 0, Number(stock_minimum) || 10,
      status || 'Ativo',
      synonyms || null, linear_weight || null, linear_weight_unit || null,
      package_content || null, converted_unit || null, converted_price || null,
      validation_status || 'OK', pending_notes || null
    );

    const materialId = result.lastInsertRowid;

    // Se começou com estoque físico > 0, registra movimentação inicial
    if (Number(stock_physical) > 0) {
      await db.prepare(`
        INSERT INTO stock_movements (material_id, type, quantity, previous_stock, new_stock, user_id, notes)
        VALUES (?, 'ENTRADA', ?, 0, ?, ?, 'Saldo inicial no cadastro do material')
      `).run(materialId, Number(stock_physical), Number(stock_physical), userId || 1);
    }

    // Auditoria
    await db.prepare(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
      VALUES (?, 'CRIAR_MATERIAL', 'ESTOQUE', ?, ?)
    `).run(userId || 1, materialId, `Material cadastrado: ${name} (${code}) na categoria ${category}`);

    res.status(201).json({ id: materialId, code, name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Atualiza material
materialsRouter.put('/:id', async (req, res) => {
  try {
    const { 
      name, description, category, unit, brand, reference_price, supplier_id, 
      stock_minimum, status, userId,
      synonyms, linear_weight, linear_weight_unit, package_content, converted_unit, converted_price, validation_status, pending_notes
    } = req.body;
    const materialId = req.params.id;

    await db.prepare(`
      UPDATE materials SET
        name = ?, description = ?, category = ?, unit = ?, brand = ?,
        reference_price = ?, supplier_id = ?, stock_minimum = ?,
        status = ?, synonyms = ?, linear_weight = ?, linear_weight_unit = ?,
        package_content = ?, converted_unit = ?, converted_price = ?,
        validation_status = ?, pending_notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      name, description, category, unit, brand,
      Number(reference_price), supplier_id, Number(stock_minimum),
      status, synonyms || null, linear_weight || null, linear_weight_unit || null,
      package_content || null, converted_unit || null, converted_price || null,
      validation_status || 'OK', pending_notes || null, materialId
    );

    res.json({ success: true, materialId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Entrada simplificada de estoque (Seção 12: Selecionar material -> Informar quantidade -> Confirmar)
materialsRouter.post('/quick-entry', async (req, res) => {
  try {
    const { materialId, quantity, notes, userId } = req.body;
    const result = await StockService.recordSimplifiedEntry(materialId, quantity, userId || 1, notes);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
