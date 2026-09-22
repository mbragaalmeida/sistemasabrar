import express from 'express';
import { db } from '../db/connection.js';

export const searchRouter = express.Router();

// Busca global em todo o sistema (Seção 38)
searchRouter.get('/', async (req, res) => {
  try {
    const q = req.query.q ? String(req.query.q).trim() : '';
    if (!q || q.length < 2) {
      return res.json({ projects: [], materials: [], suppliers: [], purchases: [], requests: [] });
    }

    const term = `%${q}%`;

    // 1. Projetos
    const projects = await db.prepare(`
      SELECT id, code, name, client, status, 'project' as entity_type
      FROM projects
      WHERE name LIKE ? OR client LIKE ? OR code LIKE ? OR address LIKE ?
      LIMIT 8
    `).all(term, term, term, term);

    // 2. Materiais
    const materials = await db.prepare(`
      SELECT id, code, name, category, unit, stock_physical, stock_reserved, 'material' as entity_type
      FROM materials
      WHERE name LIKE ? OR code LIKE ? OR brand LIKE ? OR category LIKE ?
      LIMIT 8
    `).all(term, term, term, term);

    // 3. Fornecedores
    const suppliers = await db.prepare(`
      SELECT id, name, corporate_name, cnpj, phone, 'supplier' as entity_type
      FROM suppliers
      WHERE name LIKE ? OR corporate_name LIKE ? OR cnpj LIKE ?
      LIMIT 6
    `).all(term, term, term);

    // 4. Compras
    const purchases = await db.prepare(`
      SELECT p.id, p.code, p.status, p.quantity, m.name as material_name, 'purchase' as entity_type
      FROM purchases p
      JOIN materials m ON p.material_id = m.id
      WHERE p.code LIKE ? OR m.name LIKE ?
      LIMIT 6
    `).all(term, term);

    // 5. Solicitações
    const requests = await db.prepare(`
      SELECT mr.id, mr.code, mr.status, mr.priority, p.name as project_name, 'request' as entity_type
      FROM material_requests mr
      JOIN projects p ON mr.project_id = p.id
      WHERE mr.code LIKE ? OR p.name LIKE ?
      LIMIT 6
    `).all(term, term);

    res.json({
      projects,
      materials,
      suppliers,
      purchases,
      requests
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
