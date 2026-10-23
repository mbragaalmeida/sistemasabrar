import express from 'express';
import { db } from '../db/connection.js';
import { StockService, generateNextPurchaseCode } from '../services/stockService.js';

export const requestsRouter = express.Router();

// Lista todas as solicitações de materiais
requestsRouter.get('/', async (req, res) => {
  try {
    const { project_id, status, priority } = req.query;
    const userRole = req.headers['x-user-role'] || req.query.role;
    const userId = req.headers['x-user-id'] || req.query.user_id;

    let query = `
      SELECT mr.*, 
             COALESCE(p.name, 'Solicitações Internas - SABRAR') as project_name, 
             COALESCE(p.code, 'SAB-INTERNO') as project_code, 
             p.client as client_name,
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

    let requests = await db.prepare(query).all(...params);

    // Item 3: Aparecer apenas solicitações de materiais das obras de cada engenheiro (Admins, Emily e Sabrina veem todas)
    if (userRole === 'engenharia' && userId) {
      const engUser = await db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(Number(userId));
      const assignedRows = await db.prepare('SELECT project_id FROM project_engineers WHERE user_id = ?').all(Number(userId));
      const assignedProjectIds = new Set(assignedRows.map(r => Number(r.project_id)));
      const normUser = (engUser?.name || '').toLowerCase().replace(/^eng\.?\s*/i, '').trim();

      requests = requests.filter(r => {
        if (assignedProjectIds.has(Number(r.project_id))) return true;
        if (r.project_code === 'SAB-INTERNO' && Number(r.requested_by) === Number(userId)) return true;
        if (normUser && r.responsible_engineer) {
          const normProj = String(r.responsible_engineer).toLowerCase().replace(/^eng\.?\s*/i, '').trim();
          if (normProj.includes(normUser) || normUser.includes(normProj)) return true;
        }
        return false;
      });
    }

    const allItems = await db.prepare(`
      SELECT mri.*,
             COALESCE(m.name, mri.custom_name, 'Material Fora da Base') as material_name,
             COALESCE(m.code, 'FORA-BASE') as material_code,
             COALESCE(mri.custom_unit, m.unit, 'un') as material_unit,
             COALESCE(m.stock_physical, 0) as stock_physical,
             COALESCE(m.stock_reserved, 0) as stock_reserved,
             COALESCE(mri.availability_status, 'disponivel') as availability_status,
             m.image_url
      FROM material_request_items mri
      LEFT JOIN materials m ON mri.material_id = m.id
      ORDER BY mri.id ASC
    `).all();

    const itemsByRequestId = new Map();
    for (const item of allItems) {
      if (item.material_unit) {
        item.material_unit = String(item.material_unit).replace(/^[\d.,]+\s*/, '').trim() || 'un';
      }
      if (!itemsByRequestId.has(item.request_id)) {
        itemsByRequestId.set(item.request_id, []);
      }
      itemsByRequestId.get(item.request_id).push(item);
    }

    const enriched = requests.map(r => ({
      ...r,
      items: itemsByRequestId.get(r.id) || []
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

    const result = await StockService.updateRequestStatus(requestId, status, userId || 22, notes);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Solicitar troca de material pelo Almoxarifado (Item 8)
requestsRouter.post('/substitutions', async (req, res) => {
  try {
    const { requestItemId, requestId, substituteMaterialId, quantity, substituteUnit, reason, userId } = req.body;
    if (!requestItemId || !substituteMaterialId) {
      return res.status(400).json({ error: 'Item da solicitação e material substituto são obrigatórios' });
    }

    const item = await db.prepare('SELECT * FROM material_request_items WHERE id = ?').get(requestItemId);
    if (!item) return res.status(404).json({ error: 'Item não encontrado' });

    const origMat = item.material_id ? await db.prepare('SELECT name, code FROM materials WHERE id = ?').get(item.material_id) : null;
    const subMat = await db.prepare('SELECT name, code, unit FROM materials WHERE id = ?').get(substituteMaterialId);
    const originalName = origMat?.name || item.custom_name || 'Material Fora da Base';
    const finalUnit = (substituteUnit && String(substituteUnit).trim()) || subMat?.unit || item.custom_unit || 'un';

    const subResult = await db.prepare(`
      INSERT INTO material_substitutions (
        request_item_id, request_id, original_material_id, substitute_material_id,
        quantity, substitute_unit, reason, requested_by, status, original_custom_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Pendente', ?)
    `).run(
      requestItemId, requestId || item.request_id, item.material_id || null, substituteMaterialId,
      quantity || item.quantity_requested, finalUnit, reason || '', userId || 22,
      item.custom_name || originalName
    );

    // Notifica Administradores, Sabrina e Emily
    await db.prepare(`
      INSERT INTO notifications (role_target, title, message, type, link)
      VALUES ('admin', 'Almoxarifado Solicitou Troca de Material', ?, 'urgent', '/estoque')
    `).run(`Almoxarifado solicitou substituir "${originalName}" por "${subMat?.name}" (${quantity || item.quantity_requested} ${finalUnit}). Motivo: ${reason || 'Não informado'}. Requer autorização de Admin, Sabrina ou Emily.`);

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
             COALESCE(m_orig.name, ms.original_custom_name, 'Material Fora da Base') as original_material_name,
             COALESCE(m_orig.code, 'FORA-BASE') as original_material_code,
             m_sub.name as substitute_material_name, m_sub.code as substitute_material_code,
             COALESCE(ms.substitute_unit, m_sub.unit, 'un') as substitute_material_unit,
             m_sub.image_url as substitute_image_url,
             u.name as requested_by_name,
             u_rev.name as reviewed_by_name,
             mr.code as request_code,
             p.name as project_name
      FROM material_substitutions ms
      LEFT JOIN materials m_orig ON ms.original_material_id = m_orig.id
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
        user.role_name === 'compras_solicitacoes' ||
        user.role_name === 'orcamento_engenharia' ||
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

    const item = await db.prepare('SELECT * FROM material_request_items WHERE id = ?').get(sub.request_item_id);
    if (!item) return res.status(404).json({ error: 'Item não encontrado' });

    // Libera reserva prévia do material anterior se existia
    if (sub.original_material_id && item.quantity_reserved > 0) {
      await db.prepare(`
        UPDATE materials 
        SET stock_reserved = GREATEST(0, stock_reserved - ?)
        WHERE id = ?
      `).run(item.quantity_reserved, sub.original_material_id);
    }

    // Verifica disponibilidade do novo material para reservar automaticamente
    const newMat = await db.prepare('SELECT stock_physical, stock_reserved FROM materials WHERE id = ?').get(sub.substitute_material_id);
    let toReserve = 0;
    const subQty = Number(sub.quantity);
    let deficit = subQty;
    if (newMat) {
      const available = Math.max(0, (newMat.stock_physical || 0) - (newMat.stock_reserved || 0));
      toReserve = Math.min(available, subQty);
      deficit = Math.max(0, subQty - toReserve);
      if (toReserve > 0) {
        await db.prepare('UPDATE materials SET stock_reserved = stock_reserved + ? WHERE id = ?').run(toReserve, sub.substitute_material_id);
      }
    }

    // Atualiza o item da solicitação com o novo material e nova unidade (Item 11)
    const approvedUnit = sub.substitute_unit || newMat?.unit || 'un';
    await db.prepare(`
      UPDATE material_request_items 
      SET material_id = ?, quantity_requested = ?, quantity_reserved = ?, deficit = ?,
          is_custom = false, custom_name = NULL, custom_unit = ?
      WHERE id = ?
    `).run(sub.substitute_material_id, sub.quantity, toReserve, deficit, approvedUnit, sub.request_item_id);

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
        user.role_name === 'compras_solicitacoes' ||
        user.role_name === 'orcamento_engenharia' ||
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

// Solicitar alteração de quantidade pelo Almoxarifado (Item 3)
requestsRouter.post('/quantity-changes', async (req, res) => {
  try {
    const { requestItemId, requestId, newQuantity, reason, userId } = req.body;
    if (!requestItemId || newQuantity === undefined || newQuantity === null || Number(newQuantity) <= 0) {
      return res.status(400).json({ error: 'Item da solicitação e nova quantidade válida são obrigatórios' });
    }

    const item = await db.prepare('SELECT * FROM material_request_items WHERE id = ?').get(requestItemId);
    if (!item) return res.status(404).json({ error: 'Item não encontrado' });

    const mat = item.material_id ? await db.prepare('SELECT name, code, unit FROM materials WHERE id = ?').get(item.material_id) : null;
    const materialName = mat ? mat.name : (item.custom_name || 'Material Fora da Base');
    const unit = mat ? mat.unit : (item.custom_unit || 'un');

    const result = await db.prepare(`
      INSERT INTO material_quantity_changes (
        request_item_id, request_id, original_quantity, new_quantity,
        reason, requested_by, status
      ) VALUES (?, ?, ?, ?, ?, ?, 'Pendente')
    `).run(
      requestItemId, requestId || item.request_id, item.quantity_requested, Number(newQuantity),
      reason || '', userId || 22
    );

    // Notifica Administradores, Sabrina e Emily
    await db.prepare(`
      INSERT INTO notifications (role_target, title, message, type, link)
      VALUES ('admin', 'Almoxarifado Solicitou Alteração de Quantidade', ?, 'urgent', '/estoque')
    `).run(`Almoxarifado solicitou alterar quantidade de "${materialName}" de ${item.quantity_requested} ${unit} para ${newQuantity} ${unit}. Motivo: ${reason || 'Não informado'}. Requer autorização de Admin, Sabrina ou Emily.`);

    res.status(201).json({ success: true, id: result.lastInsertRowid, message: 'Solicitação de alteração de quantidade enviada para aprovação.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Listar alterações de quantidade
requestsRouter.get('/quantity-changes', async (req, res) => {
  try {
    const changes = await db.prepare(`
      SELECT mqc.*,
             COALESCE(m.name, mri.custom_name, 'Material Fora da Base') as material_name,
             COALESCE(m.code, 'FORA-BASE') as material_code,
             COALESCE(m.unit, mri.custom_unit, 'un') as material_unit,
             m.image_url,
             u.name as requested_by_name,
             u_rev.name as reviewed_by_name,
             mr.code as request_code,
             p.name as project_name
      FROM material_quantity_changes mqc
      JOIN material_request_items mri ON mqc.request_item_id = mri.id
      LEFT JOIN materials m ON mri.material_id = m.id
      LEFT JOIN users u ON mqc.requested_by = u.id
      LEFT JOIN users u_rev ON mqc.reviewed_by = u_rev.id
      LEFT JOIN material_requests mr ON mqc.request_id = mr.id
      LEFT JOIN projects p ON mr.project_id = p.id
      ORDER BY mqc.id DESC
    `).all();

    res.json(changes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Aprovar alteração de quantidade (Admin, Sabrina ou Emily)
requestsRouter.post('/quantity-changes/:id/approve', async (req, res) => {
  try {
    const changeId = req.params.id;
    const { userId, notes } = req.body;

    if (userId) {
      const user = await db.prepare(`
        SELECT u.*, r.name as role_name FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ?
      `).get(userId);

      const isAllowed = user && (
        user.role_name === 'admin' ||
        user.role_name === 'compras_solicitacoes' ||
        user.role_name === 'orcamento_engenharia' ||
        user.email === 'sabrina@sabrar.com.br' ||
        user.email === 'emily@sabrar.com.br' ||
        /sabrina|emily/i.test(user.name)
      );

      if (!isAllowed) {
        return res.status(403).json({
          error: 'Acesso restrito: Apenas Administradores, Sabrina ou Emily têm permissão para aprovar alterações de quantidade.'
        });
      }
    }

    const change = await db.prepare('SELECT * FROM material_quantity_changes WHERE id = ?').get(changeId);
    if (!change) return res.status(404).json({ error: 'Solicitação de alteração não encontrada' });
    if (change.status !== 'Pendente') return res.status(400).json({ error: 'Esta solicitação já foi analisada' });

    const item = await db.prepare('SELECT * FROM material_request_items WHERE id = ?').get(change.request_item_id);
    if (!item) return res.status(404).json({ error: 'Item não encontrado' });

    const newQty = Number(change.new_quantity);
    let newReserved = Number(item.quantity_reserved || 0);
    let newDeficit = 0;

    if (item.material_id) {
      const mat = await db.prepare('SELECT stock_physical, stock_reserved FROM materials WHERE id = ?').get(item.material_id);
      if (mat) {
        if (newQty < newReserved) {
          // Quantidade reduzida abaixo do que estava reservado: libera o excesso de estoque reservado
          const excess = newReserved - newQty;
          await db.prepare('UPDATE materials SET stock_reserved = GREATEST(0, stock_reserved - ?) WHERE id = ?').run(excess, item.material_id);
          newReserved = newQty;
          newDeficit = 0;
        } else if (newQty > newReserved) {
          // Quantidade aumentada: tenta reservar o adicional se houver estoque livre
          const needed = newQty - newReserved;
          const available = Math.max(0, (mat.stock_physical || 0) - (mat.stock_reserved || 0));
          const canReserveExtra = Math.min(available, needed);
          if (canReserveExtra > 0) {
            await db.prepare('UPDATE materials SET stock_reserved = stock_reserved + ? WHERE id = ?').run(canReserveExtra, item.material_id);
            newReserved += canReserveExtra;
          }
          newDeficit = Math.max(0, newQty - newReserved);
        } else {
          newDeficit = 0;
        }
      } else {
        newDeficit = Math.max(0, newQty - newReserved);
      }
    } else {
      newDeficit = Math.max(0, newQty - newReserved);
    }

    // Atualiza o item da solicitação
    await db.prepare(`
      UPDATE material_request_items 
      SET quantity_requested = ?, quantity_reserved = ?, deficit = ?
      WHERE id = ?
    `).run(newQty, newReserved, newDeficit, change.request_item_id);

    // Atualiza status da solicitação de alteração
    await db.prepare(`
      UPDATE material_quantity_changes
      SET status = 'Aprovado', reviewed_by = ?, reviewed_at = NOW(), review_notes = ?
      WHERE id = ?
    `).run(userId || 1, notes || 'Aprovado', changeId);

    // Notifica Almoxarifado
    await db.prepare(`
      INSERT INTO notifications (role_target, title, message, type, link)
      VALUES ('almoxarifado', 'Alteração de Quantidade Autorizada', ?, 'info', '/estoque')
    `).run(`A alteração de quantidade para ${newQty} na solicitação #${change.request_id} foi autorizada com sucesso.`);

    res.json({ success: true, message: 'Alteração de quantidade aprovada e aplicada.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Recusar alteração de quantidade
requestsRouter.post('/quantity-changes/:id/reject', async (req, res) => {
  try {
    const changeId = req.params.id;
    const { userId, notes } = req.body;

    if (userId) {
      const user = await db.prepare(`
        SELECT u.*, r.name as role_name FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ?
      `).get(userId);

      const isAllowed = user && (
        user.role_name === 'admin' ||
        user.role_name === 'compras_solicitacoes' ||
        user.role_name === 'orcamento_engenharia' ||
        user.email === 'sabrina@sabrar.com.br' ||
        user.email === 'emily@sabrar.com.br' ||
        /sabrina|emily/i.test(user.name)
      );

      if (!isAllowed) {
        return res.status(403).json({
          error: 'Acesso restrito: Apenas Administradores, Sabrina ou Emily têm permissão para recusar alterações de quantidade.'
        });
      }
    }

    await db.prepare(`
      UPDATE material_quantity_changes
      SET status = 'Recusado', reviewed_by = ?, reviewed_at = NOW(), review_notes = ?
      WHERE id = ?
    `).run(userId || 1, notes || 'Recusado', changeId);

    // Notifica Almoxarifado
    await db.prepare(`
      INSERT INTO notifications (role_target, title, message, type, link)
      VALUES ('almoxarifado', 'Alteração de Quantidade Não Autorizada', ?, 'urgent', '/estoque')
    `).run(`A solicitação de alteração de quantidade foi recusada. Motivo: ${notes || 'Não informado'}.`);

    res.json({ success: true, message: 'Alteração de quantidade recusada.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Alterna disponibilidade do item (Almoxarifado: Disponível / Não disponível [Em Falta])
requestsRouter.patch('/items/:itemId/availability', async (req, res) => {
  try {
    const { itemId } = req.params;
    const { status, userId } = req.body; // status: 'disponivel' | 'em_falta'

    if (!['disponivel', 'em_falta'].includes(status)) {
      return res.status(400).json({ error: 'Status de disponibilidade inválido.' });
    }

    const item = await db.prepare(`
      SELECT mri.*, mr.code as request_code, mr.project_id, p.name as project_name,
             m.name as mat_name, m.unit as mat_unit, m.reference_price, m.converted_price, m.package_content
      FROM material_request_items mri
      JOIN material_requests mr ON mri.request_id = mr.id
      LEFT JOIN projects p ON mr.project_id = p.id
      LEFT JOIN materials m ON mri.material_id = m.id
      WHERE mri.id = ?
    `).get(itemId);

    if (!item) {
      return res.status(404).json({ error: 'Item não encontrado.' });
    }

    await db.prepare(`
      UPDATE material_request_items
      SET availability_status = ?
      WHERE id = ?
    `).run(status, itemId);

    const materialName = item.mat_name || item.custom_name || 'Material';
    const materialUnit = (item.custom_unit || item.mat_unit || 'un').replace(/^[\d.,]+\s*/, '').trim() || 'un';
    const itemQty = Number(item.quantity_requested || item.quantity || 1);

    if (status === 'em_falta') {
      // Verifica se já existe compra ativa gerada para este item
      const existingPurchase = await db.prepare(`
        SELECT id, code, status FROM purchases 
        WHERE request_item_id = ? AND status NOT IN ('Cancelado')
        LIMIT 1
      `).get(itemId);

      if (!existingPurchase) {
        const purchaseCode = await generateNextPurchaseCode();
        const unitPrice = Number(item.converted_price || item.reference_price || 0);
        const totalPrice = Number((itemQty * unitPrice).toFixed(2)) || 0;

        await db.prepare(`
          INSERT INTO purchases (
            code, project_id, request_item_id, material_id, custom_name, custom_unit,
            quantity, unit_price, total_price, status, priority, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Solicitado', 'Alta', ?)
        `).run(
          purchaseCode, item.project_id, itemId, item.material_id,
          item.mat_name ? null : item.custom_name, materialUnit,
          itemQty, unitPrice, totalPrice,
          `Demanda gerada pelo Almoxarifado: item marcado como NÃO DISPONÍVEL na solicitação ${item.request_code} (Obra: ${item.project_name || 'Sabrar'}).`
        );
      }

      // Notifica setor de Compras
      await db.prepare(`
        INSERT INTO notifications (role_target, title, message, type, link)
        VALUES ('compras', 'Item Não Disponível no Estoque', ?, 'urgent', '/compras')
      `).run(`O almoxarifado marcou o item "${materialName}" (${itemQty} ${materialUnit}) como NÃO DISPONÍVEL na solicitação ${item.request_code} (${item.project_name || 'Obra'}). Compra necessária.`);

      // Log de auditoria
      await db.prepare(`
        INSERT INTO stock_movements (material_id, type, quantity, previous_stock, new_stock, project_id, reference_id, user_id, notes)
        VALUES (?, 'DISPONIBILIDADE_INDISPONIVEL', ?, 0, 0, ?, ?, ?, ?)
      `).run(
        item.material_id || null, itemQty, item.project_id, item.request_id, userId || null,
        `Item "${materialName}" marcado como NÃO DISPONÍVEL pelo Almoxarifado na solicitação ${item.request_code}`
      );
    } else {
      // Se voltou para 'disponivel', cancela compra pendente que ainda não foi efetuada
      await db.prepare(`
        UPDATE purchases
        SET status = 'Cancelado', notes = notes || ' (Cancelado: almoxarifado marcou item como disponível no estoque)'
        WHERE request_item_id = ? AND status = 'Solicitado'
      `).run(itemId);

      // Log de auditoria
      await db.prepare(`
        INSERT INTO stock_movements (material_id, type, quantity, previous_stock, new_stock, project_id, reference_id, user_id, notes)
        VALUES (?, 'DISPONIBILIDADE_DISPONIVEL', ?, 0, 0, ?, ?, ?, ?)
      `).run(
        item.material_id || null, itemQty, item.project_id, item.request_id, userId || null,
        `Item "${materialName}" marcado como DISPONÍVEL pelo Almoxarifado na solicitação ${item.request_code}`
      );
    }

    res.json({
      success: true,
      availability_status: status,
      message: status === 'em_falta'
        ? `Item "${materialName}" marcado como Não Disponível. Demanda enviada para Compras!`
        : `Item "${materialName}" marcado como Disponível.`
    });
  } catch (err) {
    console.error('Erro ao atualizar disponibilidade do item:', err);
    res.status(500).json({ error: err.message });
  }
});

// Cancelar um item específico da solicitação (Almoxarifado)
requestsRouter.patch('/items/:itemId/cancel', async (req, res) => {
  try {
    const { itemId } = req.params;
    const { reason, userId } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'Informe a justificativa do cancelamento deste item.' });
    }

    const item = await db.prepare(`
      SELECT mri.*, mr.code as request_code, mr.project_id, p.name as project_name,
             m.name as mat_name, m.unit as mat_unit
      FROM material_request_items mri
      JOIN material_requests mr ON mri.request_id = mr.id
      LEFT JOIN projects p ON mr.project_id = p.id
      LEFT JOIN materials m ON mri.material_id = m.id
      WHERE mri.id = ?
    `).get(itemId);

    if (!item) {
      return res.status(404).json({ error: 'Item não encontrado.' });
    }

    if (item.item_status === 'Cancelado') {
      return res.status(400).json({ error: 'Este item já se encontra cancelado.' });
    }

    // Marca como cancelado
    await db.prepare(`
      UPDATE material_request_items
      SET item_status = 'Cancelado',
          cancellation_reason = ?,
          cancelled_by = ?,
          cancelled_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(reason.trim(), userId || null, itemId);

    // Se havia reserva de estoque neste item, estorna a reserva
    if (item.material_id && item.quantity_reserved && item.quantity_reserved > 0) {
      await db.prepare(`
        UPDATE materials
        SET stock_reserved = GREATEST(0, stock_reserved - ?), updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(item.quantity_reserved, item.material_id);
    }

    // Se havia compra gerada para este item, cancela
    await db.prepare(`
      UPDATE purchases
      SET status = 'Cancelado', notes = notes || ' (Cancelado: item da solicitação foi cancelado pelo almoxarifado)'
      WHERE request_item_id = ? AND status NOT IN ('Entregue', 'Concluído')
    `).run(itemId);

    const materialName = item.mat_name || item.custom_name || 'Material';

    const itemQty = Number(item.quantity_requested || item.quantity || 1);

    // Registro imutável de auditoria no histórico de movimentações (stock_movements)
    await db.prepare(`
      INSERT INTO stock_movements (material_id, type, quantity, previous_stock, new_stock, project_id, reference_id, user_id, notes)
      VALUES (?, 'CANCELAMENTO_ITEM', ?, 0, 0, ?, ?, ?, ?)
    `).run(
      item.material_id || null, itemQty, item.project_id, item.request_id, userId || null,
      `Item "${materialName}" da solicitação ${item.request_code} (${item.project_name || 'Obra'}) CANCELADO pelo Almoxarifado. Motivo: ${reason.trim()}`
    );

    // Também registra em audit_logs
    await db.prepare(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, project_id, old_value, new_value, details)
      VALUES (?, 'CANCELAR_ITEM_SOLICITACAO', 'SOLICITACAO_ITEM', ?, ?, 'Ativo', 'Cancelado', ?)
    `).run(
      userId || null, itemId, item.project_id,
      `Item "${materialName}" (${itemQty} ${item.custom_unit || item.mat_unit || 'un'}) cancelado na solicitação ${item.request_code}. Justificativa: ${reason.trim()}`
    );

    res.json({
      success: true,
      message: `Item "${materialName}" cancelado com sucesso.`
    });
  } catch (err) {
    console.error('Erro ao cancelar item:', err);
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

    // 1. Estorna quantidades reservadas no estoque de materiais, se ainda não tiverem sido entregues/separadas
    if (request.status !== 'Entregue' && request.status !== 'Separado') {
      const items = await db.prepare('SELECT material_id, quantity_reserved FROM material_request_items WHERE request_id = ?').all(requestId);
      for (const item of items) {
        if (item.material_id && item.quantity_reserved && item.quantity_reserved > 0) {
          await db.prepare(`
            UPDATE materials 
            SET stock_reserved = GREATEST(0, stock_reserved - ?), updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(item.quantity_reserved, item.material_id);
        }
      }
    }

    // 2. Desvincula compras associadas aos itens desta solicitação e remove substituições/alterações de quantidade
    await db.prepare('UPDATE purchases SET request_item_id = NULL WHERE request_item_id IN (SELECT id FROM material_request_items WHERE request_id = ?)').run(requestId);
    await db.prepare('DELETE FROM material_substitutions WHERE request_id = ?').run(requestId);
    await db.prepare('DELETE FROM material_quantity_changes WHERE request_id = ?').run(requestId);

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

