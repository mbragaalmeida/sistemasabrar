import express from 'express';
import { db } from '../db/connection.js';

export const suppliersRouter = express.Router();

// Lista fornecedores (Seção 36)
suppliersRouter.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    let query = 'SELECT * FROM suppliers WHERE 1=1';
    const params = [];

    if (search) {
      query += ' AND (name LIKE ? OR corporate_name LIKE ? OR cnpj LIKE ? OR materials_supplied LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY id ASC';

    const suppliers = await db.prepare(query).all(...params);
    res.json(suppliers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Cadastra fornecedor
suppliersRouter.post('/', async (req, res) => {
  try {
    const { name, corporate_name, cnpj, contact_person, phone, email, materials_supplied, notes, userId } = req.body;

    if (!name) return res.status(400).json({ error: 'Nome do fornecedor é obrigatório' });

    const insert = db.prepare(`
      INSERT INTO suppliers (name, corporate_name, cnpj, contact_person, phone, email, materials_supplied, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = await insert.run(
      name, corporate_name || null, cnpj || null,
      contact_person || null, phone || null, email || null,
      materials_supplied || null, notes || null
    );

    const supplierId = result.lastInsertRowid;

    // Auditoria
    await db.prepare(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
      VALUES (?, 'CRIAR_FORNECEDOR', 'FORNECEDOR', ?, ?)
    `).run(userId || 1, supplierId, `Fornecedor cadastrado: ${name}`);

    res.status(201).json({ id: supplierId, name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Atualiza fornecedor
suppliersRouter.put('/:id', async (req, res) => {
  try {
    const { name, corporate_name, cnpj, contact_person, phone, email, materials_supplied, notes } = req.body;
    const supplierId = req.params.id;

    await db.prepare(`
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
        return res.status(403).json({ error: 'Permissão negada. Apenas Administradores e Emily têm autorização para excluir fornecedores.' });
      }
    }

    // Desvincula fornecedor de materiais, compras e cotações para integridade relacional
    await db.prepare('UPDATE materials SET supplier_id = NULL WHERE supplier_id = ?').run(supplierId);
    await db.prepare('UPDATE purchases SET supplier_id = NULL WHERE supplier_id = ?').run(supplierId);
    await db.prepare('UPDATE purchase_quotation_suppliers SET supplier_id = NULL WHERE supplier_id = ?').run(supplierId);

    const sup = await db.prepare('SELECT name FROM suppliers WHERE id = ?').get(supplierId);
    const supName = sup?.name || `ID ${supplierId}`;

    await db.prepare('DELETE FROM suppliers WHERE id = ?').run(supplierId);

    // Registro no log de auditoria
    await db.prepare(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
      VALUES (?, 'EXCLUIR_FORNECEDOR', 'FORNECEDOR', ?, ?)
    `).run(userId || 1, supplierId, `Fornecedor excluído: ${supName}`);

    res.json({ success: true, message: `Fornecedor "${supName}" excluído com sucesso.` });
  } catch (err) {
    console.error('Erro ao excluir fornecedor:', err);
    res.status(500).json({ error: err.message });
  }
});
