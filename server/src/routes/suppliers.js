import express from 'express';
import { db } from '../db/connection.js';

export const suppliersRouter = express.Router();

// Lista fornecedores ordenados alfabeticamente (A-Z)
suppliersRouter.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    let query = 'SELECT * FROM suppliers WHERE 1=1';
    const params = [];

    if (search && search.trim()) {
      const q = `%${search.trim()}%`;
      query += ' AND (name ILIKE ? OR corporate_name ILIKE ? OR cnpj ILIKE ? OR materials_supplied ILIKE ? OR contact_person ILIKE ? OR notes ILIKE ? OR categories ILIKE ?)';
      params.push(q, q, q, q, q, q, q);
    }

    // Item 14: ordenar fornecedores em ordem alfabética (A-Z)
    query += ' ORDER BY name ASC';

    const suppliers = await db.prepare(query).all(...params);
    res.json(suppliers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Cadastra fornecedor
suppliersRouter.post('/', async (req, res) => {
  try {
    const {
      name,
      corporate_name,
      cnpj,
      contact_person,
      phone,
      email,
      materials_supplied,
      notes,
      categories,
      contacts,
      userId
    } = req.body;

    if (!name) return res.status(400).json({ error: 'Nome do fornecedor é obrigatório' });

    // Se houver lista de contatos, sincroniza o primeiro para contact_person, phone, email
    let primaryContact = contact_person || null;
    let primaryPhone = phone || null;
    let primaryEmail = email || null;

    let contactsJson = '[]';
    if (Array.isArray(contacts) && contacts.length > 0) {
      contactsJson = JSON.stringify(contacts);
      if (!primaryContact && contacts[0].name) primaryContact = contacts[0].name;
      if (!primaryPhone && contacts[0].phone) primaryPhone = contacts[0].phone;
      if (!primaryEmail && contacts[0].email) primaryEmail = contacts[0].email;
    } else if (contacts && typeof contacts === 'object') {
      contactsJson = JSON.stringify(contacts);
    }

    const categoriesStr = Array.isArray(categories) ? categories.join(', ') : (categories || null);

    const insert = db.prepare(`
      INSERT INTO suppliers (
        name, corporate_name, cnpj, contact_person, phone, email,
        materials_supplied, notes, categories, contacts
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = await insert.run(
      name,
      corporate_name || null,
      cnpj || null,
      primaryContact,
      primaryPhone,
      primaryEmail,
      materials_supplied || null,
      notes || null,
      categoriesStr,
      contactsJson
    );

    const supplierId = result.lastInsertRowid;

    // Auditoria
    await db.prepare(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
      VALUES (?, 'CRIAR_FORNECEDOR', 'FORNECEDOR', ?, ?)
    `).run(userId || 1, supplierId, `Fornecedor cadastrado: ${name} com categorias: ${categoriesStr || 'Geral'}`);

    res.status(201).json({ id: supplierId, name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Atualiza fornecedor
suppliersRouter.put('/:id', async (req, res) => {
  try {
    const {
      name,
      corporate_name,
      cnpj,
      contact_person,
      phone,
      email,
      materials_supplied,
      notes,
      categories,
      contacts,
      userId
    } = req.body;
    const supplierId = req.params.id;

    let primaryContact = contact_person || null;
    let primaryPhone = phone || null;
    let primaryEmail = email || null;

    let contactsJson = '[]';
    if (Array.isArray(contacts)) {
      contactsJson = JSON.stringify(contacts);
      if (contacts.length > 0) {
        if (contacts[0].name) primaryContact = contacts[0].name;
        if (contacts[0].phone) primaryPhone = contacts[0].phone;
        if (contacts[0].email) primaryEmail = contacts[0].email;
      }
    } else if (contacts && typeof contacts === 'object') {
      contactsJson = JSON.stringify(contacts);
    }

    const categoriesStr = Array.isArray(categories) ? categories.join(', ') : (categories !== undefined ? categories : null);

    await db.prepare(`
      UPDATE suppliers SET
        name = ?, corporate_name = ?, cnpj = ?, contact_person = ?,
        phone = ?, email = ?, materials_supplied = ?, notes = ?,
        categories = ?, contacts = ?
      WHERE id = ?
    `).run(
      name, corporate_name, cnpj, primaryContact,
      primaryPhone, primaryEmail, materials_supplied, notes,
      categoriesStr, contactsJson, supplierId
    );

    // Auditoria
    await db.prepare(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
      VALUES (?, 'EDITAR_FORNECEDOR', 'FORNECEDOR', ?, ?)
    `).run(userId || 1, supplierId, `Fornecedor atualizado: ${name}`);

    res.json({ success: true, supplierId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Exclui fornecedor (apenas administradores e Emily)
suppliersRouter.delete('/:id', async (req, res) => {
  try {
    const supplierId = req.params.id;
    const userId = req.body?.userId || req.query?.userId;

    if (userId) {
      const user = await db.prepare(`
        SELECT u.*, r.name as role_name 
        FROM users u 
        JOIN roles r ON u.role_id = r.id 
        WHERE u.id = ?
      `).get(userId);

      const isAllowed = user && (
        user.role_name === 'admin' ||
        user.role_name === 'compras_solicitacoes' ||
        user.email === 'emily@sabrar.com.br' ||
        /emily/i.test(user.name || '')
      );

      if (!isAllowed) {
        return res.status(403).json({ error: 'Apenas Administradores ou Emily possuem autorização para excluir fornecedores.' });
      }
    }

    await db.prepare('DELETE FROM suppliers WHERE id = ?').run(supplierId);

    await db.prepare(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
      VALUES (?, 'EXCLUIR_FORNECEDOR', 'FORNECEDOR', ?, ?)
    `).run(userId || 1, supplierId, `Fornecedor ID ${supplierId} excluído.`);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
