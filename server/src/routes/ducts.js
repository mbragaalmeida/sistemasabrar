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
      taggerName
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
        status, approval_status, approved_at, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      notes || null
    );

    const newId = result.lastInsertRowid;

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

    // Se mudou para pronto_logistica, notifica Logística
    if (status === 'pronto_logistica') {
      await db.prepare(`
        INSERT INTO notifications (role_target, title, message, type, link)
        VALUES ('almoxarifado', 'Lote de Dutos Pronto para Envio', ?, 'info', '/logistica')
      `).run(`A Delivery Note ${note.delivery_note_number} (${note.total_weight_kg} KG) da obra ${note.project_name} está fabricada e liberada para romaneio na Logística.`);
    }

    res.json({ success: true, id: noteId, status });
  } catch (err) {
    console.error('[Update Duct Status Error]', err);
    res.status(500).json({ error: err.message });
  }
});
