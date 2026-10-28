import express from 'express';
import { db } from '../db/connection.js';
import { DuctAnalysisService } from '../services/ductAnalysisService.js';

export const ductsRouter = express.Router();

// Executa a IA especializada de levantamento de dutos para um projeto
ductsRouter.post('/analyze', async (req, res) => {
  try {
    const { projectId, customText } = req.body;
    if (!projectId) {
      return res.status(400).json({ error: 'ID do projeto é obrigatório para a análise de dutos' });
    }

    const result = await DuctAnalysisService.analyzeProjectDucts(Number(projectId), customText);
    res.json(result);
  } catch (err) {
    console.error('[Ducts Analyze Error]', err);
    res.status(500).json({ error: err.message });
  }
});

// Busca a análise de dutos mais recente para o projeto especificado
ductsRouter.get('/project/:projectId', async (req, res) => {
  try {
    const projectId = Number(req.params.projectId);
    const analysis = await DuctAnalysisService.getLatestDuctAnalysis(projectId);
    if (!analysis) {
      return res.status(404).json({ error: 'Nenhuma análise de dutos encontrada para este projeto' });
    }
    res.json(analysis);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Lista o histórico de análises de dutos de todos os projetos
ductsRouter.get('/', async (req, res) => {
  try {
    const rows = await db.prepare(`
      SELECT da.*, p.name as project_name, p.code as project_code, p.client
      FROM duct_analyses da
      JOIN projects p ON da.project_id = p.id
      ORDER BY da.id DESC
      LIMIT 50
    `).all();

    const formatted = rows.map(r => ({
      id: r.id,
      projectId: r.project_id,
      projectName: r.project_name,
      projectCode: r.project_code,
      client: r.client,
      totalMeters: Number(r.total_meters),
      totalKg: Number(r.total_kg),
      sheetAreaSqm: Number(r.sheet_area_sqm || 0),
      ductBreakdown: typeof r.duct_breakdown === 'string' ? JSON.parse(r.duct_breakdown) : r.duct_breakdown,
      technicalNotes: r.technical_notes,
      createdAt: r.created_at
    }));

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// NOVO FLUXO OFICIAL CAMDUCT — AUTODESK CAMDUCT, DELIVERY NOTES E APROVAÇÕES
// ============================================================================

/**
 * Retorna o resumo de dutos e chapas da obra:
 * - KG orçado (via itens de orçamento ou levantamento de dutos)
 * - KG tagueado acumulado (via Delivery Notes ativas no CAMduct)
 * - Saldo restante (KG orçado - KG tagueado)
 * - Percentual de consumo
 * - Lista completa de Delivery Notes do projeto
 */
ductsRouter.get('/summary/:projectId', async (req, res) => {
  try {
    const projectId = Number(req.params.projectId);
    if (!projectId) return res.status(400).json({ error: 'ID do projeto inválido' });

    const project = await db.prepare(`
      SELECT id, name, code, client, responsible_engineer
      FROM projects 
      WHERE id = ?
    `).get(projectId);

    if (!project) return res.status(404).json({ error: 'Projeto não encontrado' });

    // 1. Busca peso de chapa orçado nos itens de orçamento aprovado
    const budgetKgRow = await db.prepare(`
      SELECT COALESCE(SUM(bi.quantity), 0) as total_kg
      FROM budget_items bi
      JOIN budgets b ON bi.budget_id = b.id
      WHERE b.project_id = ? 
        AND (bi.material_name ILIKE '%chapa%' OR bi.material_name ILIKE '%duto%')
        AND LOWER(bi.unit) IN ('kg', 'quilo', 'quilos')
    `).get(projectId);

    let budgetKg = Number(budgetKgRow?.total_kg || 0);

    // Se não encontrou nos itens diretos de orçamento, tenta puxar da análise de dutos
    if (budgetKg <= 0) {
      const ductAnalysis = await db.prepare(`
        SELECT total_kg FROM duct_analyses WHERE project_id = ? ORDER BY id DESC LIMIT 1
      `).get(projectId);
      if (ductAnalysis?.total_kg) {
        budgetKg = Number(ductAnalysis.total_kg);
      }
    }

    // 2. Busca Delivery Notes já lançadas para esta obra
    const deliveryNotes = await db.prepare(`
      SELECT 
        dn.*,
        p.name as project_name,
        p.code as project_code,
        u.name as tagger_user_name
      FROM duct_delivery_notes dn
      JOIN projects p ON dn.project_id = p.id
      LEFT JOIN users u ON dn.tagger_id = u.id
      WHERE dn.project_id = ?
      ORDER BY dn.id DESC
    `).all(projectId);

    // 3. Calcula KG acumulado tagueado (excluindo notas rejeitadas)
    const validNotes = deliveryNotes.filter(n => n.status !== 'rejeitado');
    const taggedKg = validNotes.reduce((acc, n) => acc + Number(n.total_weight_kg || 0), 0);
    const balanceKg = budgetKg > 0 ? (budgetKg - taggedKg) : 0;
    const percentUsed = budgetKg > 0 ? Number(((taggedKg / budgetKg) * 100).toFixed(1)) : 0;

    res.json({
      project: {
        id: project.id,
        name: project.name,
        code: project.code,
        client: project.client,
        responsibleEngineer: project.responsible_engineer
      },
      budgetKg: Number(budgetKg.toFixed(2)),
      taggedKg: Number(taggedKg.toFixed(2)),
      balanceKg: Number(balanceKg.toFixed(2)),
      percentUsed,
      isExceeded: taggedKg > budgetKg && budgetKg > 0,
      excessKg: (taggedKg > budgetKg && budgetKg > 0) ? Number((taggedKg - budgetKg).toFixed(2)) : 0,
      deliveryNotes: deliveryNotes.map(n => ({
        id: n.id,
        code: n.code,
        deliveryNoteNumber: n.delivery_note_number,
        projectId: n.project_id,
        projectName: n.project_name,
        projectCode: n.project_code,
        taggerId: n.tagger_id,
        taggerName: n.tagger_name || n.tagger_user_name || 'Tagueador Vinicius Gomes',
        engineerId: n.engineer_id,
        fileUrl: n.file_url,
        fileName: n.file_name,
        totalWeightKg: Number(n.total_weight_kg),
        sheetType: n.sheet_type,
        budgetTotalKg: Number(n.budget_total_kg),
        accumulatedKg: Number(n.accumulated_kg),
        exceedsBudget: Boolean(n.exceeds_budget),
        excessKg: Number(n.excess_kg),
        status: n.status,
        approvalStatus: n.approval_status,
        approvedBy: n.approved_by,
        approvedByName: n.approved_by_name,
        approvedAt: n.approved_at,
        approvalReason: n.approval_reason,
        notes: n.notes,
        createdAt: n.created_at,
        updatedAt: n.updated_at
      }))
    });
  } catch (err) {
    console.error('[Ducts Summary Error]', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Lista todas as Delivery Notes cadastradas (visão geral)
 */
ductsRouter.get('/delivery-notes', async (req, res) => {
  try {
    const { projectId, status } = req.query;
    let sql = `
      SELECT 
        dn.*,
        p.name as project_name,
        p.code as project_code,
        p.client,
        u.name as tagger_user_name
      FROM duct_delivery_notes dn
      JOIN projects p ON dn.project_id = p.id
      LEFT JOIN users u ON dn.tagger_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (projectId) {
      sql += ' AND dn.project_id = ?';
      params.push(Number(projectId));
    }

    if (status) {
      sql += ' AND dn.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY dn.id DESC';

    const notes = await db.prepare(sql).all(...params);

    res.json(notes.map(n => ({
      id: n.id,
      code: n.code,
      deliveryNoteNumber: n.delivery_note_number,
      projectId: n.project_id,
      projectName: n.project_name,
      projectCode: n.project_code,
      client: n.client,
      taggerId: n.tagger_id,
      taggerName: n.tagger_name || n.tagger_user_name || 'Tagueador Vinicius Gomes',
      fileUrl: n.file_url,
      fileName: n.file_name,
      totalWeightKg: Number(n.total_weight_kg),
      sheetType: n.sheet_type,
      budgetTotalKg: Number(n.budget_total_kg),
      accumulatedKg: Number(n.accumulated_kg),
      exceedsBudget: Boolean(n.exceeds_budget),
      excessKg: Number(n.excess_kg),
      status: n.status,
      approvalStatus: n.approval_status,
      approvedBy: n.approved_by,
      approvedByName: n.approved_by_name,
      approvedAt: n.approved_at,
      approvalReason: n.approval_reason,
      notes: n.notes,
      createdAt: n.created_at
    })));
  } catch (err) {
    console.error('[Get Delivery Notes Error]', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Anexa nova Delivery Note do Autodesk CAMduct:
 * - Valida unicidade estrita do número da Delivery Note (duplicidade proibida)
 * - Registra peso total em KG
 * - Calcula saldo acumulado em relação ao orçamento
 * - Se ultrapassar o orçado: bloqueia e gera solicitação de aprovação para Diretoria/Sabrina/Emily
 * - Se dentro do orçamento: aprova automaticamente para fabricação
 */
ductsRouter.post('/delivery-note', async (req, res) => {
  try {
    const {
      projectId,
      deliveryNoteNumber,
      totalWeightKg,
      sheetType = 'Chapa Galvanizada',
      fileName,
      fileUrl,
      notes,
      taggerId,
      taggerName,
      ductRequestId
    } = req.body;

    if (!projectId) {
      return res.status(400).json({ error: 'Selecione a obra de destino' });
    }

    const cleanDnNumber = String(deliveryNoteNumber || '').trim();
    if (!cleanDnNumber) {
      return res.status(400).json({ error: 'O número da Delivery Note gerada pelo CAMduct é obrigatório' });
    }

    const weightNum = Number(totalWeightKg);
    if (isNaN(weightNum) || weightNum <= 0) {
      return res.status(400).json({ error: 'Informe o peso total em KG válido da Delivery Note' });
    }

    // 1. Validação estrita de duplicidade de Delivery Note
    const existingDn = await db.prepare(`
      SELECT id, delivery_note_number, code, project_id 
      FROM duct_delivery_notes 
      WHERE LOWER(delivery_note_number) = LOWER(?)
    `).get(cleanDnNumber);

    if (existingDn) {
      return res.status(400).json({
        error: `O número de Delivery Note "${cleanDnNumber}" já está cadastrado no sistema (Código: ${existingDn.code}). Duplicidade de Delivery Note é expressamente bloqueada.`
      });
    }

    const project = await db.prepare('SELECT id, name, code, responsible_engineer FROM projects WHERE id = ?').get(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Projeto não encontrado' });
    }

    // 2. Busca KG orçado
    const budgetKgRow = await db.prepare(`
      SELECT COALESCE(SUM(bi.quantity), 0) as total_kg
      FROM budget_items bi
      JOIN budgets b ON bi.budget_id = b.id
      WHERE b.project_id = ? 
        AND (bi.material_name ILIKE '%chapa%' OR bi.material_name ILIKE '%duto%')
        AND LOWER(bi.unit) IN ('kg', 'quilo', 'quilos')
    `).get(projectId);

    let budgetKg = Number(budgetKgRow?.total_kg || 0);
    if (budgetKg <= 0) {
      const da = await db.prepare('SELECT total_kg FROM duct_analyses WHERE project_id = ? ORDER BY id DESC LIMIT 1').get(projectId);
      if (da?.total_kg) budgetKg = Number(da.total_kg);
    }

    // 3. Busca peso acumulado anterior
    const prevTaggedRow = await db.prepare(`
      SELECT COALESCE(SUM(total_weight_kg), 0) as total
      FROM duct_delivery_notes
      WHERE project_id = ? AND status != 'rejeitado'
    `).get(projectId);

    const prevTaggedKg = Number(prevTaggedRow?.total || 0);
    const newAccumulatedKg = Number((prevTaggedKg + weightNum).toFixed(2));

    // 4. Checa excedente de orçamento
    const exceedsBudget = budgetKg > 0 && newAccumulatedKg > budgetKg;
    const excessKg = exceedsBudget ? Number((newAccumulatedKg - budgetKg).toFixed(2)) : 0;

    const status = exceedsBudget ? 'pendente_aprovacao' : 'aprovado';
    const approvalStatus = exceedsBudget ? 'pendente' : 'aprovado_automatico';
    const approvedAt = exceedsBudget ? null : new Date().toISOString();

    // 5. Gera código da Delivery Note interna
    const code = `DN-${new Date().getFullYear()}-${cleanDnNumber.replace(/[^a-zA-Z0-9]/g, '')}`;

    // Insere no banco
    const result = await db.prepare(`
      INSERT INTO duct_delivery_notes (
        code, delivery_note_number, project_id, tagger_id, tagger_name,
        file_url, file_name, total_weight_kg, sheet_type,
        budget_total_kg, accumulated_kg, exceeds_budget, excess_kg,
        status, approval_status, approved_at, notes, duct_request_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      code,
      cleanDnNumber,
      projectId,
      taggerId || null,
      taggerName || 'Vinicius Gomes',
      fileUrl || null,
      fileName || null,
      weightNum,
      sheetType,
      budgetKg,
      newAccumulatedKg,
      exceedsBudget,
      excessKg,
      status,
      approvalStatus,
      approvedAt,
      notes || null,
      ductRequestId ? Number(ductRequestId) : null
    );

    const newId = result.lastInsertRowid;

    // Se vinculado a uma solicitação de duto do engenheiro, sincroniza o status
    if (ductRequestId) {
      const nextRequestStatus = exceedsBudget ? 'Aguardando Aprovação' : 'Aprovado';
      await db.prepare(`
        UPDATE duct_requests 
        SET status = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(nextRequestStatus, Number(ductRequestId));
    }

    // 6. Se ultrapassou o orçamento, dispara notificações urgentes para Diretoria/Sabrina/Emily
    if (exceedsBudget) {
      const alertMsg = `A Delivery Note "${cleanDnNumber}" da obra ${project.name} totalizou ${newAccumulatedKg} KG tagueados, ultrapassando o orçamento em ${excessKg} KG. Requer aprovação técnica para liberar fabricação.`;
      
      const rolesToNotify = ['admin', 'orcamento_engenharia', 'compras_solicitacoes'];
      for (const role of rolesToNotify) {
        await db.prepare(`
          INSERT INTO notifications (role_target, title, message, type, link)
          VALUES (?, 'Alerta: Excedente de Dutos CAMduct', ?, 'warning', '/dutos')
        `).run(role, alertMsg);
      }
    }

    // Auditoria
    await db.prepare(`
      INSERT INTO audit_logs (user_id, user_name, action, entity_type, entity_id, project_id, details)
      VALUES (?, ?, 'ANEXAR_DELIVERY_NOTE_CAMDUCT', 'DUTOS', ?, ?, ?)
    `).run(
      taggerId || 26,
      taggerName || 'Vinicius Gomes',
      newId,
      projectId,
      `Delivery Note ${cleanDnNumber} anexada com ${weightNum} KG (Chapa: ${sheetType}). Acumulado: ${newAccumulatedKg} KG / Orçado: ${budgetKg} KG. Status: ${status}`
    );

    res.json({
      success: true,
      id: newId,
      code,
      deliveryNoteNumber: cleanDnNumber,
      totalWeightKg: weightNum,
      accumulatedKg: newAccumulatedKg,
      budgetKg,
      exceedsBudget,
      excessKg,
      status,
      approvalStatus
    });
  } catch (err) {
    console.error('[Attach Delivery Note Error]', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Aprova ou Rejeita formalmente o excedente de peso de uma Delivery Note:
 * - Apenas Diretoria (Admin), Sabrina Gonçalves ou Emily Bueno
 */
ductsRouter.patch('/delivery-note/:id/approve-excess', async (req, res) => {
  try {
    const noteId = Number(req.params.id);
    const { userId, userName, approved, approvalReason } = req.body;

    const note = await db.prepare(`
      SELECT dn.*, p.name as project_name 
      FROM duct_delivery_notes dn
      JOIN projects p ON dn.project_id = p.id
      WHERE dn.id = ?
    `).get(noteId);

    if (!note) {
      return res.status(404).json({ error: 'Delivery Note não encontrada' });
    }

    const now = new Date().toISOString();
    const newStatus = approved ? 'aprovado' : 'rejeitado';
    const newApprovalStatus = approved ? 'aprovado' : 'rejeitado';

    await db.prepare(`
      UPDATE duct_delivery_notes
      SET status = ?,
          approval_status = ?,
          approved_by = ?,
          approved_by_name = ?,
          approved_at = ?,
          approval_reason = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newStatus, newApprovalStatus, userId || 1, userName || 'Diretoria/Responsável', now, approvalReason || null, noteId);

    // Se vinculado a uma solicitação de dutos, atualiza o status correspondente
    if (note.duct_request_id) {
      await db.prepare(`
        UPDATE duct_requests
        SET status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(approved ? 'Aprovado' : 'Rejeitado', note.duct_request_id);
    }

    // Auditoria
    await db.prepare(`
      INSERT INTO audit_logs (user_id, user_name, action, entity_type, entity_id, project_id, details)
      VALUES (?, ?, ?, 'DUTOS', ?, ?, ?)
    `).run(
      userId || 1,
      userName || 'Diretoria',
      approved ? 'APROVACAO_EXCESSO_DUTOS' : 'REJEICAO_EXCESSO_DUTOS',
      noteId,
      note.project_id,
      `${approved ? 'Aprovado' : 'Rejeitado'} excesso de peso de ${note.excess_kg} KG na Delivery Note ${note.delivery_note_number} da obra ${note.project_name}. Justificativa: ${approvalReason || 'Sem justificativa adicional'}`
    );

    // Notifica engenharia e tagueador
    await db.prepare(`
      INSERT INTO notifications (role_target, title, message, type, link)
      VALUES ('engenharia', ?, ?, ?, '/dutos')
    `).run(
      approved ? 'Delivery Note Aprovada' : 'Delivery Note Rejeitada',
      `A Delivery Note ${note.delivery_note_number} da obra ${note.project_name} foi ${approved ? 'aprovada' : 'rejeitada'} por ${userName}.`,
      approved ? 'success' : 'error'
    );

    res.json({
      success: true,
      id: noteId,
      status: newStatus,
      approvalStatus: newApprovalStatus,
      approvedByName: userName,
      approvedAt: now
    });
  } catch (err) {
    console.error('[Approve Excess Error]', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Atualiza status da Delivery Note:
 * Ex: 'aprovado' -> 'em_fabricacao' -> 'pronto_logistica' -> 'entregue'
 * Quando 'pronto_logistica': fica automaticamente visível para seleção na aba Logística!
 */
ductsRouter.patch('/delivery-note/:id/status', async (req, res) => {
  try {
    const noteId = Number(req.params.id);
    const { status, userId, userName } = req.body;

    const allowedStatuses = ['aprovado', 'em_fabricacao', 'pronto_logistica', 'entregue', 'cancelado'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ error: `Status inválido. Permitidos: ${allowedStatuses.join(', ')}` });
    }

    const note = await db.prepare(`
      SELECT dn.*, p.name as project_name 
      FROM duct_delivery_notes dn
      JOIN projects p ON dn.project_id = p.id
      WHERE dn.id = ?
    `).get(noteId);

    if (!note) return res.status(404).json({ error: 'Delivery Note não encontrada' });

    await db.prepare(`
      UPDATE duct_delivery_notes
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(status, noteId);

    // Se vinculado a uma solicitação de dutos, sincroniza o status
    if (note.duct_request_id) {
      let mappedRequestStatus = null;
      if (status === 'em_fabricacao') mappedRequestStatus = 'Em Fabricação';
      else if (status === 'pronto_logistica') mappedRequestStatus = 'Pronto';
      else if (status === 'entregue') mappedRequestStatus = 'Entregue';
      else if (status === 'cancelado') mappedRequestStatus = 'Cancelado';

      if (mappedRequestStatus) {
        await db.prepare(`
          UPDATE duct_requests
          SET status = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(mappedRequestStatus, note.duct_request_id);
      }
    }

    // Auditoria
    await db.prepare(`
      INSERT INTO audit_logs (user_id, user_name, action, entity_type, entity_id, project_id, details)
      VALUES (?, ?, 'STATUS_DUTO_CAMDUCT', 'DUTOS', ?, ?, ?)
    `).run(
      userId || 1,
      userName || 'Sistema',
      noteId,
      note.project_id,
      `Status da Delivery Note ${note.delivery_note_number} alterado de '${note.status}' para '${status}'.`
    );

    // Se mudou para pronto_logistica, notifica Logística e Engenharia
    if (status === 'pronto_logistica') {
      await db.prepare(`
        INSERT INTO notifications (role_target, title, message, type, link)
        VALUES ('almoxarifado', 'Lote de Dutos Pronto para Envio', ?, 'info', '/logistica')
      `).run(`A Delivery Note ${note.delivery_note_number} (${note.total_weight_kg} KG) da obra ${note.project_name} está fabricada e liberada para romaneio na Logística.`);

      await db.prepare(`
        INSERT INTO notifications (role_target, title, message, type, link)
        VALUES ('engenharia', 'Dutos Prontos no Galpão', ?, 'success', '/solicitacoes')
      `).run(`Os dutos da Delivery Note ${note.delivery_note_number} da obra ${note.project_name} estão prontos! Já estão disponíveis para solicitação de logística.`);
    }

    res.json({ success: true, id: noteId, status });
  } catch (err) {
    console.error('[Update Duct Status Error]', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// SOLICITAÇÕES DE DUTOS PELOS ENGENHEIROS (ÁREA DO ENGENHEIRO / CAMDUCT)
// ============================================================================

/**
 * GET /api/ducts/requests
 * Lista as solicitações de dutos feitas pelos engenheiros:
 * - Quem solicitou
 * - Obra correspondente
 * - Dutos solicitados e quantidades
 * - Delivery note anexada (se houver)
 * - Status atual
 */
ductsRouter.get('/requests', async (req, res) => {
  try {
    const { projectId, status, requested_by } = req.query;
    let sql = `
      SELECT 
        dr.*,
        p.name as project_name,
        p.code as project_code,
        p.client as client_name,
        p.responsible_engineer,
        u.name as requested_by_name,
        u.email as requested_by_email,
        u.avatar as requested_by_avatar,
        dn.id as delivery_note_id,
        dn.delivery_note_number,
        dn.total_weight_kg,
        dn.sheet_type,
        dn.file_url as delivery_note_file_url,
        dn.file_name as delivery_note_file_name,
        dn.exceeds_budget,
        dn.excess_kg,
        dn.approval_status as dn_approval_status
      FROM duct_requests dr
      JOIN projects p ON dr.project_id = p.id
      LEFT JOIN users u ON dr.requested_by = u.id
      LEFT JOIN duct_delivery_notes dn ON dn.duct_request_id = dr.id
      WHERE 1=1
    `;
    const params = [];

    if (projectId) {
      sql += ' AND dr.project_id = ?';
      params.push(Number(projectId));
    }
    if (status) {
      sql += ' AND dr.status = ?';
      params.push(status);
    }
    if (requested_by) {
      sql += ' AND dr.requested_by = ?';
      params.push(Number(requested_by));
    }

    sql += ' ORDER BY dr.id DESC';

    const requests = await db.prepare(sql).all(...params);

    // Carrega os itens de cada solicitação
    const fullRequests = [];
    for (const r of requests) {
      const items = await db.prepare(`
        SELECT * FROM duct_request_items WHERE request_id = ? ORDER BY id ASC
      `).all(r.id);

      fullRequests.push({
        id: r.id,
        code: r.code,
        projectId: r.project_id,
        projectName: r.project_name,
        projectCode: r.project_code,
        clientName: r.client_name,
        responsibleEngineer: r.responsible_engineer,
        requestedBy: r.requested_by,
        requestedByName: r.requested_by_name,
        requestedByEmail: r.requested_by_email,
        requestedByAvatar: r.requested_by_avatar,
        priority: r.priority,
        status: r.status,
        notes: r.notes,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        deliveryNote: r.delivery_note_id ? {
          id: r.delivery_note_id,
          deliveryNoteNumber: r.delivery_note_number,
          totalWeightKg: Number(r.total_weight_kg || 0),
          sheetType: r.sheet_type,
          fileUrl: r.delivery_note_file_url,
          fileName: r.delivery_note_file_name,
          exceedsBudget: Boolean(r.exceeds_budget),
          excessKg: Number(r.excess_kg || 0),
          approvalStatus: r.dn_approval_status
        } : null,
        items: items.map(it => ({
          id: it.id,
          requestId: it.request_id,
          itemDescription: it.item_description,
          dimension: it.dimension,
          unit: it.unit,
          quantityRequested: Number(it.quantity_requested),
          quantityTagged: Number(it.quantity_tagged || 0),
          notes: it.notes
        }))
      });
    }

    res.json(fullRequests);
  } catch (err) {
    console.error('[Get Duct Requests Error]', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/ducts/requests
 * Cria uma nova solicitação de dutos (Engenheiro seleciona a obra e informa itens e quantidades)
 */
ductsRouter.post('/requests', async (req, res) => {
  try {
    const { projectId, items, priority = 'Normal', notes, requestedBy } = req.body;

    if (!projectId) {
      return res.status(400).json({ error: 'Selecione a obra de destino para a solicitação de dutos.' });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Informe ao menos um item de duto na solicitação.' });
    }

    const project = await db.prepare('SELECT id, name, code, responsible_engineer FROM projects WHERE id = ?').get(projectId);
    if (!project) return res.status(404).json({ error: 'Projeto não encontrado.' });

    // Gera numeração sequencial SD-2026-XXXX
    const countRes = await db.prepare('SELECT COUNT(*) as count FROM duct_requests').get();
    const seq = (countRes?.count || 0) + 1;
    const year = new Date().getFullYear();
    const code = `SD-${year}-${String(seq).padStart(4, '0')}`;

    const insertResult = await db.prepare(`
      INSERT INTO duct_requests (code, project_id, requested_by, priority, status, notes)
      VALUES (?, ?, ?, ?, 'Pendente', ?)
    `).run(
      code,
      projectId,
      requestedBy || null,
      priority,
      notes || null
    );

    const requestId = insertResult.lastInsertRowid;

    for (const it of items) {
      if (!it.itemDescription || !it.itemDescription.trim()) continue;
      await db.prepare(`
        INSERT INTO duct_request_items (request_id, item_description, dimension, unit, quantity_requested, notes)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        requestId,
        it.itemDescription.trim(),
        it.dimension ? it.dimension.trim() : null,
        it.unit || 'un',
        Number(it.quantityRequested) || 1,
        it.notes || null
      );
    }

    // Notifica Vinicius Gomes e Admins sobre a nova solicitação de dutos
    const requesterUser = requestedBy ? await db.prepare('SELECT name FROM users WHERE id = ?').get(requestedBy) : null;
    const requesterName = requesterUser?.name || 'Engenheiro';

    await db.prepare(`
      INSERT INTO notifications (role_target, title, message, type, link)
      VALUES ('admin', 'Nova Solicitação de Dutos', ?, 'info', '/dutos')
    `).run(`O engenheiro ${requesterName} solicitou ${items.length} itens de dutos para a obra ${project.name} (${code}).`);

    // Notificação direta para Vinicius Gomes
    const vinicius = await db.prepare("SELECT id FROM users WHERE email ILIKE '%vinicius%' OR name ILIKE '%vinicius%' LIMIT 1").get();
    if (vinicius?.id) {
      await db.prepare(`
        INSERT INTO notifications (user_id, role_target, title, message, type, link)
        VALUES (?, 'engenharia', 'Nova Demanda de Dutos CAMduct', ?, 'warning', '/dutos')
      `).run(vinicius.id, `Nova solicitação ${code} de dutos para a obra ${project.name} recebida para tagueamento.`);
    }

    res.status(201).json({
      success: true,
      id: requestId,
      code,
      message: 'Solicitação de dutos registrada com sucesso! Ela já está disponível na Gestão de Dutos & Autodesk CAMduct.'
    });
  } catch (err) {
    console.error('[Create Duct Request Error]', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * PATCH /api/ducts/requests/:id/status
 * Vinicius Gomes / Admins alteram o andamento da solicitação de dutos:
 * Ex: 'Pendente' -> 'Em Tagueamento' -> 'Em Fabricação' -> 'Pronto' -> 'Entregue'
 * Quando 'Pronto': libera automaticamente para solicitação de logística correspondente pelo engenheiro!
 */
ductsRouter.patch('/requests/:id/status', async (req, res) => {
  try {
    const requestId = Number(req.params.id);
    const { status, userId, userName } = req.body;

    const allowed = ['Pendente', 'Em Tagueamento', 'Aguardando Aprovação', 'Aprovado', 'Em Fabricação', 'Pronto', 'Entregue', 'Cancelado'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: `Status inválido. Permitidos: ${allowed.join(', ')}` });
    }

    const reqRow = await db.prepare(`
      SELECT dr.*, p.name as project_name, u.name as requester_name 
      FROM duct_requests dr
      JOIN projects p ON dr.project_id = p.id
      LEFT JOIN users u ON dr.requested_by = u.id
      WHERE dr.id = ?
    `).get(requestId);

    if (!reqRow) return res.status(404).json({ error: 'Solicitação de dutos não encontrada.' });

    await db.prepare(`
      UPDATE duct_requests
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(status, requestId);

    // Se houver Delivery Note vinculada, atualiza seu status sincronizadamente
    if (status === 'Pronto') {
      await db.prepare(`
        UPDATE duct_delivery_notes
        SET status = 'pronto_logistica', updated_at = CURRENT_TIMESTAMP
        WHERE duct_request_id = ?
      `).run(requestId);

      // Notifica o engenheiro solicitante que os dutos estão prontos para logística
      if (reqRow.requested_by) {
        await db.prepare(`
          INSERT INTO notifications (user_id, role_target, title, message, type, link)
          VALUES (?, 'engenharia', 'Dutos Prontos para Logística!', ?, 'success', '/solicitacoes')
        `).run(
          reqRow.requested_by,
          `Os dutos da solicitação ${reqRow.code} da obra ${reqRow.project_name} foram marcados como prontos por Vinicius Gomes! Você já pode solicitar a logística correspondente na aba "Solicitar Logística".`
        );
      }
    } else if (status === 'Em Fabricação') {
      await db.prepare(`
        UPDATE duct_delivery_notes
        SET status = 'em_fabricacao', updated_at = CURRENT_TIMESTAMP
        WHERE duct_request_id = ?
      `).run(requestId);
    }

    // Auditoria
    await db.prepare(`
      INSERT INTO audit_logs (user_id, user_name, action, entity_type, entity_id, project_id, details)
      VALUES (?, ?, 'STATUS_SOLICITACAO_DUTO', 'DUTOS', ?, ?, ?)
    `).run(
      userId || 1,
      userName || 'Vinicius Gomes',
      requestId,
      reqRow.project_id,
      `Status da solicitação de dutos ${reqRow.code} alterado de '${reqRow.status}' para '${status}'.`
    );

    res.json({ success: true, id: requestId, status });
  } catch (err) {
    console.error('[Update Duct Request Status Error]', err);
    res.status(500).json({ error: err.message });
  }
});
