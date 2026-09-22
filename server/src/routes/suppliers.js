import express from 'express';
import { db } from '../db/connection.js';

export const suppliersRouter = express.Router();

// Lista fornecedores (Seção 36)
suppliersRouter.get('/', (req, res) => {
  try {
    const { search } = req.query;
    let query = 'SELECT * FROM suppliers WHERE 1=1';
    const params = [];

    if (search) {
      query += ' AND (name LIKE ? OR corporate_name LIKE ? OR cnpj LIKE ? OR materials_supplied LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY id ASC';

    const suppliers = db.prepare(query).all(...params);
    res.json(suppliers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Cadastra fornecedor
suppliersRouter.post('/', (req, res) => {
  try {
    const { name, corporate_name, cnpj, contact_person, phone, email, materials_supplied, notes, userId } = req.body;

    if (!name) return res.status(400).json({ error: 'Nome do fornecedor é obrigatório' });

    const insert = db.prepare(`
      INSERT INTO suppliers (name, corporate_name, cnpj, contact_person, phone, email, materials_supplied, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = insert.run(
      name, corporate_name || null, cnpj || null,
      contact_person || null, phone || null, email || null,
      materials_supplied || null, notes || null
    );

    const supplierId = result.lastInsertRowid;

    // Auditoria
    db.prepare(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
      VALUES (?, 'CRIAR_FORNECEDOR', 'FORNECEDOR', ?, ?)
    `).run(userId || 1, supplierId, `Fornecedor cadastrado: ${name}`);

    res.status(201).json({ id: supplierId, name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Atualiza fornecedor
suppliersRouter.put('/:id', (req, res) => {
  try {
    const { name, corporate_name, cnpj, contact_person, phone, email, materials_supplied, notes } = req.body;
    const supplierId = req.params.id;

    db.prepare(`
      UPDATE suppliers SET
        name = ?, corporate_name = ?, cnpj = ?, contact_person = ?,
        phone = ?, email = ?, materials_supplied = ?, notes = ?
      WHERE id = ?
    `).run(
      name, corporate_name, cnpj, contact_person,
      phone, email, materials_supplied, notes, supplierId
    );

    res.json({ success: true, supplierId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
