import express from 'express';
import { db } from '../db/connection.js';

export const auditRouter = express.Router();

// Lista logs de auditoria imutáveis com filtros (Seção 37)
auditRouter.get('/', async (req, res) => {
  try {
    const { entity_type, project_id, search } = req.query;
    let query = `
      SELECT al.*, u.name as current_user_name, p.name as project_name, p.code as project_code
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      LEFT JOIN projects p ON al.project_id = p.id
      WHERE 1=1
    `;
    const params = [];

    if (entity_type) {
      query += ' AND al.entity_type = ?';
      params.push(entity_type);
    }
    if (project_id) {
      query += ' AND al.project_id = ?';
      params.push(project_id);
    }
    if (search) {
      query += ' AND (al.details LIKE ? OR al.action LIKE ? OR al.user_name LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY al.id DESC LIMIT 100';

    const logs = await db.prepare(query).all(...params);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
