import express from 'express';
import { db } from '../db/connection.js';
import { StockService } from '../services/stockService.js';

export const requestsRouter = express.Router();

// Lista todas as solicitações de materiais
requestsRouter.get('/', async (req, res) => {
  try {
    const { project_id, status, priority } = req.query;
    let query = `
      SELECT mr.*, p.name as project_name, p.code as project_code, u.name as requested_by_name
      FROM material_requests mr
      JOIN projects p ON mr.project_id = p.id
      JOIN users u ON mr.requested_by = u.id
      WHERE 1=1
    `;
    const params = [];

    if (project_id) {
      query += ' AND mr.project_id = ?';
      params.push(project_id);
    }
    if (status) {
      query += ' AND mr.status = ?';
      params.push(status);
    }
    if (priority) {
      query += ' AND mr.priority = ?';
      params.push(priority);
    }

    query += ' ORDER BY mr.id DESC';

    const requests = await db.prepare(query).all(...params);

    const enriched = await Promise.all(requests.map(async r => {
      const items = await db.prepare(`
        SELECT mri.*, m.name as material_name, m.code as material_code, m.unit as material_unit, m.stock_physical, m.stock_reserved
        FROM material_request_items mri
        JOIN materials m ON mri.material_id = m.id
        WHERE mri.request_id = ?
      `).all(r.id);

      return { ...r, items };
    }));

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Cria solicitação de material (Engenharia - individual ou em lote)
requestsRouter.post('/', async (req, res) => {
  try {
    const { projectId, materialId, quantity, items, priority, notes, userId } = req.body;

    if (!projectId) {
      return res.status(400).json({ error: 'Projeto de destino é obrigatório' });
    }

    // Validação de responsabilidade técnica do engenheiro (Requisito 3)
    if (userId) {
      const user = await db.prepare(`
        SELECT u.*, r.name as role_name 
        FROM users u 
        JOIN roles r ON u.role_id = r.id 
        WHERE u.id = ?
      `).get(userId);

      if (user && user.role_name === 'engenharia') {
        const project = await db.prepare('SELECT id, name, responsible_engineer FROM projects WHERE id = ?').get(projectId);
        if (project) {
          const normUser = user.name.toLowerCase().replace(/^eng\.?\s*/i, '').trim();
          const normProj = (project.responsible_engineer || '').toLowerCase().replace(/^eng\.?\s*/i, '').trim();
          if (!normProj.includes(normUser) && !normUser.includes(normProj)) {
            return res.status(403).json({
              error: `Acesso restrito: Como engenheiro, você só pode solicitar materiais para obras sob sua responsabilidade técnica. Esta obra está sob responsabilidade de: ${project.responsible_engineer || 'Não atribuído'}.`
            });
          }
        }
      }
    }

    let result;
    if (items && Array.isArray(items) && items.length > 0) {
      // Envio em lote (múltiplos materiais da obra)
      result = await StockService.createBatchMaterialRequest(
        projectId,
        items,
        priority || 'Média',
        userId || 3,
        notes
      );
    } else {
      // Envio individual avulso
      if (!materialId || !quantity) {
        return res.status(400).json({ error: 'Material e quantidade são obrigatórios para solicitação individual' });
      }

      result = await StockService.createMaterialRequest(
        projectId,
        materialId,
        quantity,
        priority || 'Média',
        userId || 3, // Default Eng. Rafael
        notes
      );
    }

    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Atualiza status da solicitação pelo Almoxarifado (Seção 15: Em separação -> Separado -> Entregue)
requestsRouter.patch('/:id/status', async (req, res) => {
  try {
    const requestId = req.params.id;
    const { status, notes, userId } = req.body;

    const result = await StockService.updateRequestStatus(requestId, status, userId || 4, notes);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
