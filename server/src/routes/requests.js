import express from 'express';
import { db } from '../db/connection.js';
import { StockService } from '../services/stockService.js';

export const requestsRouter = express.Router();

// Lista todas as solicitações de materiais
requestsRouter.get('/', async (req, res) => {
  try {
    const { project_id, status, priority } = req.query;
    let query = `
      SELECT mr.*, 
             COALESCE(p.name, 'Solicitações Internas - SABRAR') as project_name, 
             COALESCE(p.code, 'SAB-INTERNO') as project_code, 
             p.responsible_engineer,
             u.name as requested_by_name, u_admin.name as admin_approved_by_name
      FROM material_requests mr
      LEFT JOIN projects p ON mr.project_id = p.id
      LEFT JOIN users u ON mr.requested_by = u.id
      LEFT JOIN users u_admin ON mr.admin_approved_by = u_admin.id
      WHERE (mr.is_hidden IS FALSE OR mr.is_hidden IS NULL)
        AND (p.id IS NULL OR p.is_hidden IS FALSE OR p.is_hidden IS NULL)
    `;
    const params = [];

    if (project_id) {
      if (project_id === 'internal') {
        query += " AND (p.code = 'SAB-INTERNO' OR mr.project_id IS NULL)";
      } else {
        query += ' AND mr.project_id = ?';
        params.push(project_id);
      }
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
        SELECT mri.*, m.name as material_name, m.code as material_code, m.unit as material_unit,
               m.stock_physical, m.stock_reserved, m.image_url
        FROM material_request_items mri
        JOIN materials m ON mri.material_id = m.id
        WHERE mri.request_id = ?
        ORDER BY mri.id ASC
      `).all(r.id);

      return { ...r, items };
    }));

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Cria solicitação de material (Engenharia / Compras - individual ou em lote)
requestsRouter.post('/', async (req, res) => {
  try {
    let { projectId, materialId, quantity, items, priority, notes, userId } = req.body;

    if (projectId === 'internal' || !projectId) {
      const internalProj = await db.prepare("SELECT id FROM projects WHERE code = 'SAB-INTERNO' LIMIT 1").get();
      if (internalProj) {
        projectId = internalProj.id;
      }
    }

    if (!projectId) {
      return res.status(400).json({ error: 'Projeto de destino é obrigatório' });
    }

    const project = await db.prepare('SELECT id, name, code, responsible_engineer FROM projects WHERE id = ?').get(projectId);
    const isInternal = project?.code === 'SAB-INTERNO';

    // Validação de responsabilidade técnica do engenheiro (apenas para obras externas)
    if (userId && !isInternal) {
      const user = await db.prepare(`
        SELECT u.*, r.name as role_name 
        FROM users u 
        JOIN roles r ON u.role_id = r.id 
        WHERE u.id = ?
      `).get(userId);

      if (user && user.role_name === 'engenharia') {
        if (project) {
          // Verifica se o usuário está associado em project_engineers
          const isAssigned = await db.prepare('SELECT 1 FROM project_engineers WHERE project_id = ? AND user_id = ?').get(projectId, userId);
          
          if (!isAssigned) {
            const normUser = user.name.toLowerCase().replace(/^eng\.?\s*/i, '').trim();
            const normProj = (project.responsible_engineer || '').toLowerCase().replace(/^eng\.?\s*/i, '').trim();
            if (!normProj.includes(normUser) && !normUser.includes(normProj)) {
              return res.status(403).json({
                error: `Acesso restrito: Como engenheiro, você só pode solicitar materiais para obras sob sua responsabilidade técnica. Esta obra está sob responsabilidade de: ${project.responsible_engineer || 'Pendente de atribuição pelo administrador'}.`
              });
            }
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
        userId || 3,
        notes
      );
    }

    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Aprovação de solicitação com materiais extras por Administrador, Sabrina ou Emily
requestsRouter.post('/:id/approve-extra', async (req, res) => {
  try {
    const requestId = req.params.id;
    const { userId, notes } = req.body;

    if (userId) {
      const user = await db.prepare(`
        SELECT u.*, r.name as role_name 
        FROM users u 
        JOIN roles r ON u.role_id = r.id 
        WHERE u.id = ?
      `).get(userId);

      const isAllowed = user && (
        user.role_name === 'admin' ||
        user.email === 'sabrina@sabrar.com.br' ||
        user.email === 'emily@sabrar.com.br' ||
        /sabrina|emily/i.test(user.name)
      );

      if (!isAllowed) {
        return res.status(403).json({
          error: 'Acesso restrito: Apenas Administradores, Sabrina ou Emily têm permissão para aprovar materiais extras.'
        });
      }
    }

    const result = await StockService.approveExtraRequest(requestId, userId || 1, notes);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Rejeição de solicitação com materiais extras por Administrador, Sabrina ou Emily
requestsRouter.post('/:id/reject-extra', async (req, res) => {
  try {
    const requestId = req.params.id;
    const { userId, reason } = req.body;

    if (userId) {
      const user = await db.prepare(`
        SELECT u.*, r.name as role_name 
        FROM users u 
        JOIN roles r ON u.role_id = r.id 
        WHERE u.id = ?
      `).get(userId);

      const isAllowed = user && (
        user.role_name === 'admin' ||
        user.email === 'sabrina@sabrar.com.br' ||
        user.email === 'emily@sabrar.com.br' ||
        /sabrina|emily/i.test(user.name)
      );

      if (!isAllowed) {
        return res.status(403).json({
          error: 'Acesso restrito: Apenas Administradores, Sabrina ou Emily têm permissão para reprovar materiais extras.'
        });
      }
    }

    const result = await StockService.rejectExtraRequest(requestId, userId || 1, reason);
    res.json(result);
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
