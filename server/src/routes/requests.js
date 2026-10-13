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
    let { projectId, materialId, quantity, items, priority, notes, userId, pickupDate } = req.body;

    if (projectId === 'internal' || !projectId) {
      const internalProj = await db.prepare("SELECT id FROM projects WHERE code = 'SAB-INTERNO' LIMIT 1").get();
      if (internalProj) {
        projectId = internalProj.id;
      }
    }

    if (!projectId) {
      return res.status(400).json({ error: 'Projeto de destino é obrigatório' });
    }

    const project = await db.prepare('SELECT id, name, code, responsible_engineer, status FROM projects WHERE id = ?').get(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Projeto não encontrado' });
    }

    if (project.status === 'Concluído' || project.status === 'Concluída' || project.status === 'Finalizado') {
      return res.status(400).json({ error: 'Não é possível solicitar novos materiais para uma obra já concluída.' });
    }

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
        notes,
        pickupDate
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
        notes,
        pickupDate
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

// Solicitar troca de material pelo Almoxarifado (Item 8)
requestsRouter.post('/substitutions', async (req, res) => {
  try {
    const { requestItemId, requestId, substituteMaterialId, quantity, reason, userId } = req.body;
    if (!requestItemId || !substituteMaterialId) {
      return res.status(400).json({ error: 'Item da solicitação e material substituto são obrigatórios' });
    }

    const item = await db.prepare('SELECT * FROM material_request_items WHERE id = ?').get(requestItemId);
    if (!item) return res.status(404).json({ error: 'Item não encontrado' });

    const origMat = await db.prepare('SELECT name FROM materials WHERE id = ?').get(item.material_id);
    const subMat = await db.prepare('SELECT name FROM materials WHERE id = ?').get(substituteMaterialId);

    const subResult = await db.prepare(`
      INSERT INTO material_substitutions (
        request_item_id, request_id, original_material_id, substitute_material_id,
        quantity, reason, requested_by, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Pendente')
    `).run(
      requestItemId, requestId || item.request_id, item.material_id, substituteMaterialId,
      quantity || item.quantity_requested, reason || '', userId || 4
    );

    // Notifica Administradores, Sabrina e Emily
    await db.prepare(`
      INSERT INTO notifications (role_target, title, message, type, link)
      VALUES ('admin', 'Almoxarifado Solicitou Troca de Material', ?, 'urgent', '/estoque')
    `).run(`Almoxarifado solicitou substituir "${origMat?.name}" por "${subMat?.name}". Motivo: ${reason || 'Não informado'}. Requer autorização de Admin, Sabrina ou Emily.`);

    res.status(201).json({ success: true, id: subResult.lastInsertRowid, message: 'Solicitação de troca enviada para aprovação.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Listar substituições pendentes/gerais
requestsRouter.get('/substitutions', async (req, res) => {
  try {
    const subs = await db.prepare(`
      SELECT ms.*,
             m_orig.name as original_material_name, m_orig.code as original_material_code,
             m_sub.name as substitute_material_name, m_sub.code as substitute_material_code, m_sub.unit as substitute_material_unit,
             m_sub.image_url as substitute_image_url,
             u.name as requested_by_name,
             u_rev.name as reviewed_by_name,
             mr.code as request_code,
             p.name as project_name
      FROM material_substitutions ms
      JOIN materials m_orig ON ms.original_material_id = m_orig.id
      JOIN materials m_sub ON ms.substitute_material_id = m_sub.id
      LEFT JOIN users u ON ms.requested_by = u.id
      LEFT JOIN users u_rev ON ms.reviewed_by = u_rev.id
      LEFT JOIN material_requests mr ON ms.request_id = mr.id
      LEFT JOIN projects p ON mr.project_id = p.id
      ORDER BY ms.id DESC
    `).all();

    res.json(subs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Aprovar troca de material (Admin, Sabrina ou Emily)
requestsRouter.post('/substitutions/:id/approve', async (req, res) => {
  try {
    const subId = req.params.id;
    const { userId, notes } = req.body;

    if (userId) {
      const user = await db.prepare(`
        SELECT u.*, r.name as role_name FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ?
      `).get(userId);

      const isAllowed = user && (
        user.role_name === 'admin' ||
        user.email === 'sabrina@sabrar.com.br' ||
        user.email === 'emily@sabrar.com.br' ||
        /sabrina|emily/i.test(user.name)
      );

      if (!isAllowed) {
        return res.status(403).json({
          error: 'Acesso restrito: Apenas Administradores, Sabrina ou Emily têm permissão para aprovar a troca de materiais.'
        });
      }
    }

    const sub = await db.prepare('SELECT * FROM material_substitutions WHERE id = ?').get(subId);
    if (!sub) return res.status(404).json({ error: 'Substituição não encontrada' });
    if (sub.status !== 'Pendente') return res.status(400).json({ error: 'Esta solicitação já foi analisada' });

    // Atualiza o item da solicitação com o novo material
    await db.prepare(`
      UPDATE material_request_items 
      SET material_id = ?, quantity_requested = ?
      WHERE id = ?
    `).run(sub.substitute_material_id, sub.quantity, sub.request_item_id);

    // Atualiza o registro de substituição
    await db.prepare(`
      UPDATE material_substitutions
      SET status = 'Aprovado', reviewed_by = ?, reviewed_at = NOW(), review_notes = ?
      WHERE id = ?
    `).run(userId || 1, notes || 'Aprovado', subId);

    // Notifica Almoxarifado
    await db.prepare(`
      INSERT INTO notifications (role_target, title, message, type, link)
      VALUES ('almoxarifado', 'Troca de Material Autorizada', ?, 'info', '/estoque')
    `).run(`A troca de material para a solicitação #${sub.request_id} foi autorizada com sucesso.`);

    res.json({ success: true, message: 'Substituição de material aprovada e aplicada.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Recusar troca de material
requestsRouter.post('/substitutions/:id/reject', async (req, res) => {
  try {
    const subId = req.params.id;
    const { userId, notes } = req.body;

    if (userId) {
      const user = await db.prepare(`
        SELECT u.*, r.name as role_name FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ?
      `).get(userId);

      const isAllowed = user && (
        user.role_name === 'admin' ||
        user.email === 'sabrina@sabrar.com.br' ||
        user.email === 'emily@sabrar.com.br' ||
        /sabrina|emily/i.test(user.name)
      );

      if (!isAllowed) {
        return res.status(403).json({
          error: 'Acesso restrito: Apenas Administradores, Sabrina ou Emily têm permissão para recusar a troca de materiais.'
        });
      }
    }

    await db.prepare(`
      UPDATE material_substitutions
      SET status = 'Recusado', reviewed_by = ?, reviewed_at = NOW(), review_notes = ?
      WHERE id = ?
    `).run(userId || 1, notes || 'Recusado', subId);

    // Notifica Almoxarifado
    await db.prepare(`
      INSERT INTO notifications (role_target, title, message, type, link)
      VALUES ('almoxarifado', 'Troca de Material Não Autorizada', ?, 'urgent', '/estoque')
    `).run(`A solicitação de troca de material foi recusada. Motivo: ${notes || 'Não informado'}.`);

    res.json({ success: true, message: 'Substituição recusada.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Excluir solicitação de material (Admin, Sabrina ou Emily)
requestsRouter.delete('/:id', async (req, res) => {
  try {
    const requestId = req.params.id;
    const userId = req.body?.userId || req.query?.userId;

    if (userId) {
      const user = await db.prepare(`
        SELECT u.*, r.name as role_name FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ?
      `).get(userId);

      const isAllowed = user && (
        user.role_name === 'admin' ||
        user.email === 'sabrina@sabrar.com.br' ||
        user.email === 'emily@sabrar.com.br' ||
        /sabrina|emily/i.test(user.name)
      );

      if (!isAllowed) {
        return res.status(403).json({
          error: 'Acesso restrito: Apenas Administradores, Sabrina ou Emily têm permissão para excluir solicitações de materiais.'
        });
      }
    }

    const request = await db.prepare('SELECT * FROM material_requests WHERE id = ?').get(requestId);
    if (!request) {
      return res.status(404).json({ error: 'Solicitação não encontrada' });
    }

    // 1. Estorna quantidades reservadas no estoque de materiais, se ainda não tiverem sido entregues
    if (request.status !== 'Entregue') {
      const items = await db.prepare('SELECT material_id, quantity_reserved FROM material_request_items WHERE request_id = ?').all(requestId);
      for (const item of items) {
        if (item.quantity_reserved && item.quantity_reserved > 0) {
          await db.prepare(`
            UPDATE materials 
            SET stock_reserved = GREATEST(0, stock_reserved - ?), updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(item.quantity_reserved, item.material_id);
        }
      }
    }

    // 2. Remove substituições vinculadas à solicitação
    await db.prepare('DELETE FROM material_substitutions WHERE request_id = ?').run(requestId);

    // 3. Remove os itens da solicitação
    await db.prepare('DELETE FROM material_request_items WHERE request_id = ?').run(requestId);

    // 4. Remove a solicitação
    await db.prepare('DELETE FROM material_requests WHERE id = ?').run(requestId);

    res.json({ success: true, message: `Solicitação #${request.code || requestId} excluída com sucesso.` });
  } catch (err) {
    console.error('Erro ao excluir solicitação:', err);
    res.status(500).json({ error: err.message });
  }
});

