import express from 'express';
import { db } from '../db/connection.js';

export const clientsRouter = express.Router();

// Lista clientes (com suporte a busca e ordenação alfabética A-Z)
clientsRouter.get('/', async (req, res) => {
  try {
    const { search, recurrent } = req.query;
    let query = 'SELECT * FROM clients WHERE 1=1';
    const params = [];

    if (search && search.trim()) {
      const q = `%${search.trim()}%`;
      query += ' AND (name ILIKE ? OR corporate_name ILIKE ? OR cnpj_cpf ILIKE ? OR contact_person ILIKE ? OR email ILIKE ? OR phone ILIKE ? OR city ILIKE ? OR segment ILIKE ? OR notes ILIKE ?)';
      params.push(q, q, q, q, q, q, q, q, q);
    }

    if (recurrent !== undefined && recurrent !== '') {
      query += ' AND is_recurrent = ?';
      params.push(recurrent === 'true' || recurrent === '1');
    }

    query += ' ORDER BY name ASC';

    const clients = await db.prepare(query).all(...params);
    res.json(clients);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Detalhes de um cliente
clientsRouter.get('/:id', async (req, res) => {
  try {
    const client = await db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
    if (!client) return res.status(404).json({ error: 'Cliente não encontrado' });
    res.json(client);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Cadastra novo cliente
clientsRouter.post('/', async (req, res) => {
  try {
    const {
      name,
      corporate_name,
      cnpj_cpf,
      contact_person,
      phone,
      email,
      address,
      city,
      state,
      segment,
      is_recurrent = true,
      notes,
      rating = 5.0,
      userId = 1
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Nome do cliente é obrigatório' });
    }

    const insert = db.prepare(`
      INSERT INTO clients (
        name, corporate_name, cnpj_cpf, contact_person, phone, email,
        address, city, state, segment, is_recurrent, notes, rating
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = await insert.run(
      name.trim(),
      corporate_name ? corporate_name.trim() : null,
      cnpj_cpf ? cnpj_cpf.trim() : null,
      contact_person ? contact_person.trim() : null,
      phone ? phone.trim() : null,
      email ? email.trim() : null,
      address ? address.trim() : null,
      city ? city.trim() : null,
      state ? state.trim() : null,
      segment ? segment.trim() : null,
      Boolean(is_recurrent),
      notes ? notes.trim() : null,
      Number(rating) || 5.0
    );

    const clientId = result.lastInsertRowid;

    // Auditoria
    await db.prepare(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
      VALUES (?, 'CRIAR_CLIENTE', 'CLIENTE', ?, ?)
    `).run(userId || 1, clientId, `Cliente cadastrado: ${name.trim()}`);

    res.status(201).json({ id: clientId, name: name.trim() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Atualiza cliente
clientsRouter.put('/:id', async (req, res) => {
  try {
    const clientId = req.params.id;
    const {
      name,
      corporate_name,
      cnpj_cpf,
      contact_person,
      phone,
      email,
      address,
      city,
      state,
      segment,
      is_recurrent = true,
      notes,
      rating = 5.0,
      userId = 1
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Nome do cliente é obrigatório' });
    }

    await db.prepare(`
      UPDATE clients SET
        name = ?, corporate_name = ?, cnpj_cpf = ?, contact_person = ?,
        phone = ?, email = ?, address = ?, city = ?, state = ?,
        segment = ?, is_recurrent = ?, notes = ?, rating = ?, updated_at = NOW()
      WHERE id = ?
    `).run(
      name.trim(),
      corporate_name ? corporate_name.trim() : null,
      cnpj_cpf ? cnpj_cpf.trim() : null,
      contact_person ? contact_person.trim() : null,
      phone ? phone.trim() : null,
      email ? email.trim() : null,
      address ? address.trim() : null,
      city ? city.trim() : null,
      state ? state.trim() : null,
      segment ? segment.trim() : null,
      Boolean(is_recurrent),
      notes ? notes.trim() : null,
      Number(rating) || 5.0,
      clientId
    );

    // Auditoria
    await db.prepare(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
      VALUES (?, 'EDITAR_CLIENTE', 'CLIENTE', ?, ?)
    `).run(userId || 1, clientId, `Cliente atualizado: ${name.trim()}`);

    res.json({ success: true, clientId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Exclui cliente
clientsRouter.delete('/:id', async (req, res) => {
  try {
    const clientId = req.params.id;
    const userId = req.body?.userId || req.query?.userId || 1;

    await db.prepare('DELETE FROM clients WHERE id = ?').run(clientId);

    await db.prepare(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
      VALUES (?, 'EXCLUIR_CLIENTE', 'CLIENTE', ?, ?)
    `).run(userId, clientId, `Cliente ID ${clientId} excluído.`);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
