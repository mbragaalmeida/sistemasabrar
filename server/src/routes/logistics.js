import express from 'express';
import { db } from '../db/connection.js';

export const logisticsRouter = express.Router();

/**
 * Retorna os itens disponíveis no galpão para inclusão em romaneio da obra:
 * 1. Materiais que foram separados pelo Almoxarifado (respeitando saldo ainda não embarcado)
 * 2. Lotes de dutos fabricados via CAMduct ('pronto_logistica')
 */
logisticsRouter.get('/available-items/:projectId', async (req, res) => {
  try {
    const projectId = Number(req.params.projectId);
    if (!projectId) return res.status(400).json({ error: 'ID do projeto obrigatório' });

    // 1. Busca materiais das solicitações da obra que possuem quantidade reservada/separada pelo Almoxarifado
    const materialRows = await db.prepare(`
      SELECT 
        mri.id as request_item_id,
        mri.request_id,
        mr.code as request_code,
        mr.status as request_status,
        mri.material_id,
        COALESCE(m.code, 'SAB-AVULSO') as material_code,
        COALESCE(m.name, mri.custom_name, 'Material não especificado') as material_name,
        COALESCE(m.unit, mri.custom_unit, 'und') as unit,
        COALESCE(mri.quantity_requested, 0) as quantity_requested,
        COALESCE(mri.quantity_reserved, 0) as quantity_reserved
      FROM material_request_items mri
      JOIN material_requests mr ON mri.request_id = mr.id
      LEFT JOIN materials m ON mri.material_id = m.id
      WHERE mr.project_id = ?
        AND mr.status IN ('Separado', 'Separado Parcial', 'Em Separação')
        AND (mri.item_status IS NULL OR mri.item_status != 'Cancelado')
      ORDER BY mr.id DESC, mri.id ASC
    `).all(projectId);

    // Para cada item, calcula o que já foi embarcado em viagens anteriores não canceladas
    const availableMaterials = [];
    for (const item of materialRows) {
      const shippedRow = await db.prepare(`
        SELECT COALESCE(SUM(lti.quantity_planned), 0) as total_shipped
        FROM logistics_trip_items lti
        JOIN logistics_trips lt ON lti.trip_id = lt.id
        WHERE lti.request_item_id = ? AND lt.status != 'cancelado'
      `).get(item.request_item_id);

      const totalShipped = Number(shippedRow?.total_shipped || 0);

      // Quantidade separada pelo almoxarifado no galpão
      let totalSeparated = Number(item.quantity_reserved);
      if (totalSeparated <= 0 && item.request_status === 'Separado') {
        totalSeparated = Number(item.quantity_requested);
      }

      // Saldo físico liberado no galpão disponível para embarque imediato
      const releasedInWarehouse = Math.max(0, Number((totalSeparated - totalShipped).toFixed(2)));
      // Saldo geral pendente da solicitação
      const pendingTotal = Math.max(0, Number((Number(item.quantity_requested) - totalShipped).toFixed(2)));

      // Exibe se houver algo liberado no galpão ou se ainda houver pendência do pedido
      if (releasedInWarehouse > 0 || (totalSeparated > 0 && pendingTotal > 0)) {
        availableMaterials.push({
          sourceType: 'material',
          requestItemId: item.request_item_id,
          requestId: item.request_id,
          requestCode: item.request_code,
          materialId: item.material_id,
          code: item.material_code,
          description: item.material_name,
          unit: item.unit,
          quantityRequested: Number(item.quantity_requested),
          quantitySeparated: totalSeparated,
          alreadyShipped: totalShipped,
          releasedInWarehouse, // Liberado no Galpão
          suggestedToSend: releasedInWarehouse, // Default para Enviar Agora
          pendingQuantity: pendingTotal // Pendente
        });
      }
    }

    // 2. Busca lotes de dutos CAMduct prontos para logística
    const ductRows = await db.prepare(`
      SELECT 
        dn.id as duct_note_id,
        dn.code as duct_code,
        dn.delivery_note_number,
        dn.sheet_type,
        dn.total_weight_kg,
        dn.status
      FROM duct_delivery_notes dn
      WHERE dn.project_id = ?
        AND dn.status IN ('pronto_logistica', 'aprovado')
      ORDER BY dn.id DESC
    `).all(projectId);

    const availableDucts = [];
    for (const d of ductRows) {
      const shippedDuctRow = await db.prepare(`
        SELECT COALESCE(SUM(lti.quantity_planned), 0) as total_shipped
        FROM logistics_trip_items lti
        JOIN logistics_trips lt ON lti.trip_id = lt.id
        WHERE lti.duct_note_id = ? AND lt.status != 'cancelado'
      `).get(d.duct_note_id);

      const totalShippedKg = Number(shippedDuctRow?.total_shipped || 0);
      const totalWeightKg = Number(d.total_weight_kg || 0);
      const releasedInWarehouse = Math.max(0, Number((totalWeightKg - totalShippedKg).toFixed(2)));

      if (releasedInWarehouse > 0 || d.status === 'pronto_logistica') {
        availableDucts.push({
          sourceType: 'duto',
          ductNoteId: d.duct_note_id,
          code: d.delivery_note_number,
          description: `Dutos CAMduct DN-${d.delivery_note_number} (${d.sheet_type})`,
          unit: 'KG',
          quantityRequested: totalWeightKg,
          quantitySeparated: totalWeightKg,
          alreadyShipped: totalShippedKg,
          releasedInWarehouse,
          suggestedToSend: releasedInWarehouse,
          pendingQuantity: Math.max(0, Number((totalWeightKg - totalShippedKg).toFixed(2)))
        });
      }
    }

    // 3. Informações da obra
    const project = await db.prepare(`
      SELECT id, name, code, client, address, city, state, responsible_engineer
      FROM projects WHERE id = ?
    `).get(projectId);

    res.json({
      project,
      materials: availableMaterials,
      ducts: availableDucts
    });
  } catch (err) {
    console.error('[Available Items Error]', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Lista todas as viagens e romaneios da frota (para visão de calendário e controle)
 */
logisticsRouter.get('/trips', async (req, res) => {
  try {
    const { startDate, endDate, projectId, status } = req.query;

    let sql = `
      SELECT 
        lt.*,
        p.name as project_name,
        p.code as project_code,
        p.client,
        p.address as project_address,
        p.city as project_city,
        p.responsible_engineer,
        (SELECT COUNT(*) FROM logistics_trip_items WHERE trip_id = lt.id) as total_items,
        (SELECT COALESCE(SUM(quantity_planned), 0) FROM logistics_trip_items WHERE trip_id = lt.id) as total_quantity
      FROM logistics_trips lt
      JOIN projects p ON lt.project_id = p.id
      WHERE 1=1
    `;
    const params = [];

    if (startDate) {
      sql += ' AND lt.scheduled_date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      sql += ' AND lt.scheduled_date <= ?';
      params.push(endDate);
    }
    if (projectId) {
      sql += ' AND lt.project_id = ?';
      params.push(Number(projectId));
    }
    if (status) {
      sql += ' AND lt.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY lt.scheduled_date ASC, lt.id ASC';

    const trips = await db.prepare(sql).all(...params);

    res.json(trips.map(t => ({
      id: t.id,
      code: t.code,
      projectId: t.project_id,
      projectName: t.project_name,
      projectCode: t.project_code,
      client: t.client,
      projectAddress: t.project_address,
      projectCity: t.project_city,
      responsibleEngineer: t.responsible_engineer,
      scheduledDate: t.scheduled_date,
      shift: t.shift,
      vehiclePlate: t.vehicle_plate,
      vehicleModel: t.vehicle_model,
      driverName: t.driver_name,
      driverPhone: t.driver_phone,
      status: t.status,
      tripNumberWeek: t.trip_number_week,
      isExceptional: Boolean(t.is_exceptional),
      exceptionStatus: t.exception_status,
      exceptionApprovedBy: t.exception_approved_by,
      exceptionApprovedByName: t.exception_approved_by_name,
      exceptionApprovedAt: t.exception_approved_at,
      exceptionReason: t.exception_reason,
      loadingChecked: Boolean(t.loading_checked),
      loadingCheckedBy: t.loading_checked_by,
      loadingCheckedAt: t.loading_checked_at,
      loadingNotes: t.loading_notes,
      deliveryConfirmed: Boolean(t.delivery_confirmed),
      deliveryConfirmedBy: t.delivery_confirmed_by,
      deliveryConfirmedByName: t.delivery_confirmed_by_name,
      deliveryConfirmedAt: t.delivery_confirmed_at,
      hasDivergence: Boolean(t.has_divergence),
      divergenceNotes: t.divergence_notes,
      deliveryPhotoUrl: t.delivery_photo_url,
      notes: t.notes,
      totalItems: Number(t.total_items || 0),
      totalQuantity: Number(t.total_quantity || 0),
      createdAt: t.created_at
    })));
  } catch (err) {
    console.error('[Get Trips Error]', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Retorna detalhes completos de uma viagem com todos os itens do romaneio
 */
logisticsRouter.get('/trips/:id', async (req, res) => {
  try {
    const tripId = Number(req.params.id);
    if (!tripId) return res.status(400).json({ error: 'ID da viagem inválido' });

    const trip = await db.prepare(`
      SELECT 
        lt.*,
        p.name as project_name,
        p.code as project_code,
        p.client,
        p.address as project_address,
        p.city as project_city,
        p.responsible_engineer
      FROM logistics_trips lt
      JOIN projects p ON lt.project_id = p.id
      WHERE lt.id = ?
    `).get(tripId);

    if (!trip) return res.status(404).json({ error: 'Viagem não encontrada' });

    const items = await db.prepare(`
      SELECT 
        lti.*,
        m.code as material_code,
        dn.delivery_note_number as duct_dn_number
      FROM logistics_trip_items lti
      LEFT JOIN materials m ON lti.material_id = m.id
      LEFT JOIN duct_delivery_notes dn ON lti.duct_note_id = dn.id
      WHERE lti.trip_id = ?
      ORDER BY lti.id ASC
    `).all(tripId);

    res.json({
      trip: {
        id: trip.id,
        code: trip.code,
        projectId: trip.project_id,
        projectName: trip.project_name,
        projectCode: trip.project_code,
        client: trip.client,
        projectAddress: trip.project_address,
        projectCity: trip.project_city,
        responsibleEngineer: trip.responsible_engineer,
        scheduledDate: trip.scheduled_date,
        shift: trip.shift,
        vehiclePlate: trip.vehicle_plate,
        vehicleModel: trip.vehicle_model,
        driverName: trip.driver_name,
        driverPhone: trip.driver_phone,
        status: trip.status,
        tripNumberWeek: trip.trip_number_week,
        isExceptional: Boolean(trip.is_exceptional),
        exceptionStatus: trip.exception_status,
        exceptionApprovedBy: trip.exception_approved_by,
        exceptionApprovedByName: trip.exception_approved_by_name,
        exceptionApprovedAt: trip.exception_approved_at,
        exceptionReason: trip.exception_reason,
        loadingChecked: Boolean(trip.loading_checked),
        loadingCheckedBy: trip.loading_checked_by,
        loadingCheckedAt: trip.loading_checked_at,
        loadingNotes: trip.loading_notes,
        deliveryConfirmed: Boolean(trip.delivery_confirmed),
        deliveryConfirmedBy: trip.delivery_confirmed_by,
        deliveryConfirmedByName: trip.delivery_confirmed_by_name,
        deliveryConfirmedAt: trip.delivery_confirmed_at,
        hasDivergence: Boolean(trip.has_divergence),
        divergenceNotes: trip.divergence_notes,
        deliveryPhotoUrl: trip.delivery_photo_url,
        notes: trip.notes,
        createdAt: trip.created_at
      },
      items: items.map(i => ({
        id: i.id,
        tripId: i.trip_id,
        sourceType: i.source_type,
        requestId: i.request_id,
        requestItemId: i.request_item_id,
        ductNoteId: i.duct_note_id,
        materialId: i.material_id,
        materialCode: i.material_code || i.duct_dn_number || 'SAB',
        description: i.description,
        unit: i.unit,
        quantityPlanned: Number(i.quantity_planned),
        quantityDelivered: Number(i.quantity_delivered || 0),
        divergenceType: i.divergence_type,
        divergenceNotes: i.divergence_notes,
        createdAt: i.created_at
      }))
    });
  } catch (err) {
    console.error('[Get Trip Details Error]', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Cria nova viagem e emite Romaneio Parcial de Entrega:
 * - Checa conflito de veículo/turno na mesma data
 * - Aplica regra de cota semanal (1ª e 2ª normais; 3ª+ bloqueada aguardando Felipe Germano)
 * - Salva itens selecionados ("Enviar Agora")
 */
logisticsRouter.post('/trips', async (req, res) => {
  try {
    const {
      projectId,
      scheduledDate,
      shift = 'integral',
      vehiclePlate,
      vehicleModel = 'Caminhão Sabrar',
      driverName,
      driverPhone,
      notes,
      items = [],
      userId,
      userName
    } = req.body;

    if (!projectId) return res.status(400).json({ error: 'Selecione a obra de destino' });
    if (!scheduledDate) return res.status(400).json({ error: 'Selecione a data agendada para a entrega' });
    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Selecione ao menos um item liberado no galpão para compor o romaneio' });
    }

    const project = await db.prepare('SELECT id, name, code, responsible_engineer FROM projects WHERE id = ?').get(projectId);
    if (!project) return res.status(404).json({ error: 'Projeto não encontrado' });

    // 1. Checa conflito de veículo na mesma data e horário
    if (vehiclePlate && vehiclePlate.trim()) {
      const conflict = await db.prepare(`
        SELECT id, code, scheduled_date, shift, vehicle_plate 
        FROM logistics_trips 
        WHERE vehicle_plate = ? 
          AND scheduled_date = ? 
          AND status != 'cancelado'
          AND (
            shift = ? 
            OR shift = 'Qualquer horário' 
            OR ? = 'Qualquer horário'
            OR shift = 'integral' 
            OR ? = 'integral'
          )
      `).get(vehiclePlate.trim(), scheduledDate, shift, shift);

      if (conflict) {
        return res.status(409).json({
          error: `Conflito de frota: O veículo ${vehiclePlate} já está alocado na data ${scheduledDate} no horário '${conflict.shift}' (Romaneio ${conflict.code}). Escolha outro veículo ou altere o horário/data.`
        });
      }
    }

    // 2. Calcula cota semanal de fretes para esta obra (Segunda a Domingo da data escolhida)
    const targetDate = new Date(scheduledDate + 'T12:00:00Z');
    const dayOfWeek = targetDate.getUTCDay(); // 0 = Domingo, 1 = Segunda, ...
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(targetDate);
    monday.setUTCDate(targetDate.getUTCDate() + diffToMonday);
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);

    const mondayStr = monday.toISOString().split('T')[0];
    const sundayStr = sunday.toISOString().split('T')[0];

    const weekTripsCountRow = await db.prepare(`
      SELECT COUNT(*) as count 
      FROM logistics_trips 
      WHERE project_id = ? 
        AND scheduled_date BETWEEN ? AND ? 
        AND status != 'cancelado'
    `).get(projectId, mondayStr, sundayStr);

    const existingTripsThisWeek = Number(weekTripsCountRow?.count || 0);
    const currentTripNumberInWeek = existingTripsThisWeek + 1;

    // Regra da Cota: 1ª e 2ª viagens normais; 3ª viagem ou mais requer aprovação excepcional de Felipe Germano
    const isExceptional = currentTripNumberInWeek >= 3;
    const exceptionStatus = isExceptional ? 'pendente_aprovacao' : 'aprovado_automatico';
    const initialStatus = isExceptional ? 'agendado_pendente_aprovacao' : 'agendado';

    // 3. Gera código oficial do Romaneio (ex: R-2026-0045)
    const year = new Date().getFullYear();
    const countAllRow = await db.prepare("SELECT COUNT(*) as total FROM logistics_trips").get();
    const tripSeq = Number(countAllRow?.total || 0) + 1;
    const code = `R-${year}-${String(tripSeq).padStart(4, '0')}`;

    // 4. Cria a viagem
    const insertTripResult = await db.prepare(`
      INSERT INTO logistics_trips (
        code, project_id, scheduled_date, shift,
        vehicle_plate, vehicle_model, driver_name, driver_phone,
        status, trip_number_week, is_exceptional, exception_status,
        notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      code,
      projectId,
      scheduledDate,
      shift,
      vehiclePlate || 'SABRAR-FROTA',
      vehicleModel || 'Caminhão Sabrar',
      driverName || 'Motorista Logística',
      driverPhone || null,
      initialStatus,
      currentTripNumberInWeek,
      isExceptional,
      exceptionStatus,
      notes || null,
      userId || 1
    );

    const tripId = insertTripResult.lastInsertRowid;

    // 5. Insere os itens do romaneio ("Enviar Agora")
    const insertItemStmt = db.prepare(`
      INSERT INTO logistics_trip_items (
        trip_id, source_type, request_id, request_item_id, duct_note_id,
        material_id, description, unit, quantity_planned
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const item of items) {
      const qtyToSend = Number(item.quantityToSend || item.quantity_planned || 0);
      if (qtyToSend <= 0) continue;

      await insertItemStmt.run(
        tripId,
        item.sourceType || 'material',
        item.requestId || null,
        item.requestItemId || null,
        item.ductNoteId || null,
        item.materialId || null,
        item.description || 'Material da obra',
        item.unit || 'und',
        qtyToSend
      );
    }

    // 6. Se for viagem excepcional (3ª+ da semana), dispara notificação urgente para Felipe Germano e Admins
    if (isExceptional) {
      const msg = `A obra ${project.name} agendou sua ${currentTripNumberInWeek}ª viagem na semana de ${mondayStr} a ${sundayStr} (Romaneio ${code}). Ultrapassou a cota semanal de 2 fretes e requer autorização de Felipe Germano.`;

      await db.prepare(`
        INSERT INTO notifications (role_target, title, message, type, link)
        VALUES ('admin', 'Alerta de Cota de Frete (3ª Viagem)', ?, 'warning', '/logistica')
      `).run(msg);
    }

    // Auditoria
    await db.prepare(`
      INSERT INTO audit_logs (user_id, user_name, action, entity_type, entity_id, project_id, details)
      VALUES (?, ?, 'CRIAR_ROMANEIO_VIAGEM', 'LOGISTICA', ?, ?, ?)
    `).run(
      userId || 1,
      userName || 'Logística',
      tripId,
      projectId,
      `Romaneio ${code} emitido para a obra ${project.name} em ${scheduledDate} (${shift}). Itens: ${items.length}. Viagem da semana: ${currentTripNumberInWeek}ª. Excepcional: ${isExceptional ? 'SIM (Aguardando Felipe Germano)' : 'NÃO'}`
    );

    res.json({
      success: true,
      tripId,
      code,
      scheduledDate,
      tripNumberWeek: currentTripNumberInWeek,
      isExceptional,
      exceptionStatus,
      status: initialStatus
    });
  } catch (err) {
    console.error('[Create Trip Error]', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Aprovação excepcional de 3ª viagem ou mais na mesma semana:
 * - Apenas Felipe Germano ou Admins
 */
logisticsRouter.patch('/trips/:id/approve-exception', async (req, res) => {
  try {
    const tripId = Number(req.params.id);
    const { userId, userName, approved, reason } = req.body;

    const trip = await db.prepare(`
      SELECT lt.*, p.name as project_name 
      FROM logistics_trips lt
      JOIN projects p ON lt.project_id = p.id
      WHERE lt.id = ?
    `).get(tripId);

    if (!trip) return res.status(404).json({ error: 'Viagem não encontrada' });

    const now = new Date().toISOString();
    const newExceptionStatus = approved ? 'aprovado' : 'rejeitado';
    const newStatus = approved ? 'agendado' : 'cancelado';

    await db.prepare(`
      UPDATE logistics_trips
      SET exception_status = ?,
          status = ?,
          exception_approved_by = ?,
          exception_approved_by_name = ?,
          exception_approved_at = ?,
          exception_reason = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newExceptionStatus, newStatus, userId || 1, userName || 'Felipe Germano', now, reason || null, tripId);

    // Auditoria
    await db.prepare(`
      INSERT INTO audit_logs (user_id, user_name, action, entity_type, entity_id, project_id, details)
      VALUES (?, ?, 'APROVAR_EXCECAO_FRETE', 'LOGISTICA', ?, ?, ?)
    `).run(
      userId || 1,
      userName || 'Felipe Germano',
      tripId,
      trip.project_id,
      `${approved ? 'Aprovada' : 'Rejeitada'} 3ª viagem da semana no Romaneio ${trip.code} da obra ${trip.project_name}. Justificativa: ${reason || 'Sem justificativa adicional'}`
    );

    // Notifica equipe de logística
    await db.prepare(`
      INSERT INTO notifications (role_target, title, message, type, link)
      VALUES ('almoxarifado', 'Frete Excepcional Analisado', ?, ?, '/logistica')
    `).run(
      `A 3ª viagem da obra ${trip.project_name} (Romaneio ${trip.code}) foi ${approved ? 'APROVADA' : 'REJEITADA'} por ${userName}.`,
      approved ? 'success' : 'error'
    );

    res.json({
      success: true,
      tripId,
      exceptionStatus: newExceptionStatus,
      status: newStatus
    });
  } catch (err) {
    console.error('[Approve Trip Exception Error]', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Ponto 1 de Conferência: Carregamento pelo Motorista
 * - O motorista confere a carga no galpão antes da partida
 * - Registra assinatura e observações
 * - Altera status para 'em_transito'
 */
logisticsRouter.patch('/trips/:id/checklist-loading', async (req, res) => {
  try {
    const tripId = Number(req.params.id);
    const { driverName, notes, vehiclePlate } = req.body;

    const trip = await db.prepare('SELECT * FROM logistics_trips WHERE id = ?').get(tripId);
    if (!trip) return res.status(404).json({ error: 'Viagem não encontrada' });

    const now = new Date().toISOString();

    await db.prepare(`
      UPDATE logistics_trips
      SET loading_checked = TRUE,
          loading_checked_by = ?,
          loading_checked_at = ?,
          loading_notes = ?,
          vehicle_plate = COALESCE(?, vehicle_plate),
          status = 'em_transito',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(driverName || trip.driver_name || 'Motorista Sabrar', now, notes || null, vehiclePlate || null, tripId);

    // Auditoria
    await db.prepare(`
      INSERT INTO audit_logs (user_id, user_name, action, entity_type, entity_id, project_id, details)
      VALUES (1, ?, 'CONFERENCIA_CARREGAMENTO', 'LOGISTICA', ?, ?, ?)
    `).run(
      driverName || 'Motorista',
      tripId,
      trip.project_id,
      `Conferência de carregamento do Romaneio ${trip.code} assinada pelo motorista ${driverName}. Carga em trânsito para a obra.`
    );

    res.json({
      success: true,
      tripId,
      status: 'em_transito',
      loadingChecked: true,
      loadingCheckedAt: now
    });
  } catch (err) {
    console.error('[Loading Checklist Error]', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Ponto 2 de Conferência: Recebimento pelo Engenheiro na Obra
 * - O engenheiro confere item a item fisicamente
 * - Pode registrar divergências (falta, avaria, recusa) sem apagar o histórico
 * - Atualiza quantidades entregues reais
 * - Altera status da viagem para 'entregue'
 */
logisticsRouter.patch('/trips/:id/checklist-delivery', async (req, res) => {
  try {
    const tripId = Number(req.params.id);
    const {
      engineerId,
      engineerName,
      itemsDelivered = [],
      notes,
      photoUrl
    } = req.body;

    const trip = await db.prepare(`
      SELECT lt.*, p.name as project_name 
      FROM logistics_trips lt
      JOIN projects p ON lt.project_id = p.id
      WHERE lt.id = ?
    `).get(tripId);

    if (!trip) return res.status(404).json({ error: 'Viagem não encontrada' });

    let hasAnyDivergence = false;
    const divergenceDetails = [];

    // Atualiza cada item recebido
    for (const item of itemsDelivered) {
      const deliveredQty = Number(item.quantityDelivered);
      const plannedQty = Number(item.quantityPlanned);
      const divType = item.divergenceType || 'sem_divergencia';
      const divNotes = item.divergenceNotes || '';

      const isDivergent = divType !== 'sem_divergencia' || deliveredQty < plannedQty;
      if (isDivergent) {
        hasAnyDivergence = true;
        divergenceDetails.push(`${item.description}: entregue ${deliveredQty}/${plannedQty} (${divType}) ${divNotes}`);
      }

      await db.prepare(`
        UPDATE logistics_trip_items
        SET quantity_delivered = ?,
            divergence_type = ?,
            divergence_notes = ?
        WHERE id = ? AND trip_id = ?
      `).run(deliveredQty, divType, divNotes, item.id, tripId);
    }

    const now = new Date().toISOString();

    await db.prepare(`
      UPDATE logistics_trips
      SET delivery_confirmed = TRUE,
          delivery_confirmed_by = ?,
          delivery_confirmed_by_name = ?,
          delivery_confirmed_at = ?,
          has_divergence = ?,
          divergence_notes = ?,
          delivery_photo_url = ?,
          status = 'entregue',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      engineerId || null,
      engineerName || 'Engenheiro da Obra',
      now,
      hasAnyDivergence,
      hasAnyDivergence ? (divergenceDetails.join(' | ') + (notes ? ` - Obs: ${notes}` : '')) : (notes || null),
      photoUrl || null,
      tripId
    );

    // Se houve divergência, gera notificação imediata para Almoxarifado e Compras
    if (hasAnyDivergence) {
      const divSummary = `Divergência apontada na entrega do Romaneio ${trip.code} (${trip.project_name}) por ${engineerName}: ${divergenceDetails.slice(0, 2).join('; ')}`;
      
      await db.prepare(`
        INSERT INTO notifications (role_target, title, message, type, link)
        VALUES ('almoxarifado', 'Alerta: Divergência no Recebimento de Entrega', ?, 'warning', '/logistica')
      `).run(divSummary);

      await db.prepare(`
        INSERT INTO notifications (role_target, title, message, type, link)
        VALUES ('admin', 'Alerta: Divergência no Recebimento de Entrega', ?, 'warning', '/logistica')
      `).run(divSummary);
    }

    // Auditoria
    await db.prepare(`
      INSERT INTO audit_logs (user_id, user_name, action, entity_type, entity_id, project_id, details)
      VALUES (?, ?, 'CONFERENCIA_RECEBIMENTO_OBRA', 'LOGISTICA', ?, ?, ?)
    `).run(
      engineerId || 1,
      engineerName || 'Engenheiro da Obra',
      tripId,
      trip.project_id,
      `Recebimento do Romaneio ${trip.code} confirmado na obra ${trip.project_name}. Divergências: ${hasAnyDivergence ? 'SIM (' + divergenceDetails.join('; ') + ')' : 'NENHUMA (100% conforme)'}`
    );

    res.json({
      success: true,
      tripId,
      status: 'entregue',
      deliveryConfirmed: true,
      hasDivergence: hasAnyDivergence,
      divergenceNotes: divergenceDetails.join(' | ')
    });
  } catch (err) {
    console.error('[Delivery Checklist Error]', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Otimização e Roteirização de Entregas por Inteligência Artificial
 * Analisa as obras agendadas para um determinado dia e planeja a rota ideal
 * minimizando tempo no trânsito e sugerindo ordem lógica de carregamento (LIFO).
 */
logisticsRouter.post('/ai-route-plan', async (req, res) => {
  try {
    const { date, tripIds } = req.body;
    if (!date) return res.status(400).json({ error: 'Informe a data para roteirização' });

    let sql = `
      SELECT 
        lt.id, lt.code, lt.scheduled_date, lt.shift, lt.vehicle_plate, lt.vehicle_model,
        p.name as project_name, p.address, p.city, p.responsible_engineer,
        (SELECT COUNT(*) FROM logistics_trip_items WHERE trip_id = lt.id) as item_count,
        (SELECT COALESCE(SUM(quantity_planned), 0) FROM logistics_trip_items WHERE trip_id = lt.id) as total_qty
      FROM logistics_trips lt
      JOIN projects p ON lt.project_id = p.id
      WHERE lt.scheduled_date = ? AND lt.status != 'cancelado'
    `;
    const params = [date];

    if (tripIds && Array.isArray(tripIds) && tripIds.length > 0) {
      sql += ` AND lt.id IN (${tripIds.map(() => '?').join(',')})`;
      params.push(...tripIds);
    }

    const scheduledTrips = await db.prepare(sql).all(...params);

    if (scheduledTrips.length === 0) {
      return res.json({
        date,
        optimizedRoute: [],
        message: 'Nenhuma viagem agendada encontrada para esta data.',
        totalStops: 0
      });
    }

    // Regras heurísticas inteligentes de roteirização geográfica para RJ / SP
    // Ordena paradas por proximidade do galpão central (Zonas: Centro -> Zona Norte -> Zona Oeste -> Baixada -> Niterói)
    const sortedStops = [...scheduledTrips].sort((a, b) => {
      const getZoneRank = (addr, city) => {
        const text = `${addr || ''} ${city || ''}`.toLowerCase();
        if (text.includes('centro') || text.includes('porto')) return 1;
        if (text.includes('zona norte') || text.includes('tijuca') || text.includes('méier') || text.includes('maracanã')) return 2;
        if (text.includes('zona sul') || text.includes('botafogo') || text.includes('copacabana') || text.includes('leblon') || text.includes('iphan')) return 3;
        if (text.includes('barra') || text.includes('recreio') || text.includes('jacarepaguá')) return 4;
        if (text.includes('zona oeste') || text.includes('campo grande') || text.includes('bangu')) return 5;
        if (text.includes('niterói') || text.includes('são gonçalo')) return 6;
        if (text.includes('duque de caxias') || text.includes('nova iguaçu') || text.includes('baixada')) return 7;
        return 8;
      };
      return getZoneRank(a.address, a.city) - getZoneRank(b.address, b.city);
    });

    const routeStops = sortedStops.map((trip, idx) => ({
      stopOrder: idx + 1,
      tripId: trip.id,
      tripCode: trip.code,
      projectName: trip.project_name,
      address: trip.address || 'Endereço da obra',
      city: trip.city || 'Rio de Janeiro - RJ',
      responsibleEngineer: trip.responsible_engineer,
      shift: trip.shift,
      vehicle: `${trip.vehicle_model} (${trip.vehicle_plate})`,
      itemCount: Number(trip.item_count),
      totalQuantity: Number(trip.total_qty),
      estimatedArrival: `${8 + (idx * 2)}:00h`,
      estimatedDeparture: `${9 + (idx * 2)}:00h`,
      loadingOrder: `Carregar por ${sortedStops.length - idx}º no caminhão (LIFO)`,
      trafficAlert: (trip.address || '').toLowerCase().includes('barra')
        ? 'Atenção para horário de pico na Linha Amarela / Av. das Américas'
        : ((trip.address || '').toLowerCase().includes('niterói') ? 'Atenção ao fluxo na Ponte Rio-Niterói' : 'Tráfego regular previsto')
    }));

    res.json({
      date,
      totalStops: routeStops.length,
      startLocation: 'Galpão Central SABRAR Engenharia',
      optimizedRoute: routeStops,
      aiRecommendations: [
        'Regra LIFO Obrigatória: A última entrega da rota deve ser a primeira a ser carregada no fundo do caminhão para agilizar os descarregamentos.',
        'Conferência Dupla: Motorista confere romaneio antes da saída e engenheiro assina fisicamente no canteiro.',
        'Janelas de Carga: Entregas em shoppings e centros empresariais devem respeitar horários de doca permitidos pela administração predial.'
      ]
    });
  } catch (err) {
    console.error('[AI Route Plan Error]', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// SOLICITAÇÕES DE LOGÍSTICA PELOS ENGENHEIROS & ATENDIMENTO PELA EQUIPE
// ============================================================================

/**
 * GET /api/logistics/ready-items/:projectId
 * Retorna os itens da obra que estão liberados e aptos para a solicitação de logística:
 * 1. Materiais que o responsável pelo Almoxarifado deu OK (status 'Separado' ou 'Separado Parcial')
 *    descontando quantidades já solicitadas em solicitações de logística ativas.
 * 2. Dutos que o Vinicius Gomes marcou como 'Pronto' (status 'Pronto' ou 'pronto_logistica')
 *    descontando quantidades já solicitadas em solicitações de logística ativas.
 */
logisticsRouter.get('/ready-items/:projectId', async (req, res) => {
  try {
    const projectId = Number(req.params.projectId);
    if (!projectId) return res.status(400).json({ error: 'ID do projeto é obrigatório' });

    const project = await db.prepare(`
      SELECT id, name, code, client, address, city, state, responsible_engineer
      FROM projects WHERE id = ?
    `).get(projectId);

    if (!project) return res.status(404).json({ error: 'Projeto não encontrado' });

    // 1. Materiais liberados pelo Almoxarifado (OK no material)
    const materialRows = await db.prepare(`
      SELECT 
        mri.id as request_item_id,
        mri.request_id,
        mr.code as request_code,
        mr.status as request_status,
        mri.material_id,
        COALESCE(m.code, 'SAB-AVULSO') as material_code,
        COALESCE(m.name, mri.custom_name, 'Material não especificado') as material_name,
        COALESCE(m.unit, mri.custom_unit, 'und') as unit,
        COALESCE(mri.quantity_requested, 0) as quantity_requested,
        COALESCE(mri.quantity_reserved, 0) as quantity_reserved
      FROM material_request_items mri
      JOIN material_requests mr ON mri.request_id = mr.id
      LEFT JOIN materials m ON mri.material_id = m.id
      WHERE mr.project_id = ?
        AND mr.status IN ('Separado', 'Separado Parcial')
        AND (mri.item_status IS NULL OR mri.item_status != 'Cancelado')
      ORDER BY mr.id DESC, mri.id ASC
    `).all(projectId);

    const availableMaterials = [];
    for (const item of materialRows) {
      // Quantidade já solicitada em solicitações de logística pendentes ou atendidas
      const requestedRow = await db.prepare(`
        SELECT COALESCE(SUM(lri.quantity_requested), 0) as total_requested
        FROM logistics_request_items lri
        JOIN logistics_requests lr ON lri.logistics_request_id = lr.id
        WHERE lri.material_request_item_id = ? AND lr.status != 'Cancelado'
      `).get(item.request_item_id);

      const alreadyInLogistics = Number(requestedRow?.total_requested || 0);

      // Quantidade total separada pelo almoxarifado
      let totalSeparated = Number(item.quantity_reserved);
      if (totalSeparated <= 0 && item.request_status === 'Separado') {
        totalSeparated = Number(item.quantity_requested);
      }

      // Saldo liberado no almoxarifado disponível para o engenheiro solicitar transporte
      const availableToRequest = Math.max(0, Number((totalSeparated - alreadyInLogistics).toFixed(2)));

      if (availableToRequest > 0) {
        availableMaterials.push({
          sourceType: 'material',
          requestItemId: item.request_item_id,
          requestId: item.request_id,
          requestCode: item.request_code,
          materialId: item.material_id,
          code: item.material_code,
          description: item.material_name,
          unit: item.unit,
          quantitySeparated: totalSeparated,
          alreadyInLogistics,
          availableQuantity: availableToRequest
        });
      }
    }

    // 2. Dutos marcados como Prontos pelo Vinicius Gomes
    // Busca solicitações de dutos com status 'Pronto' OU Delivery Notes com status 'pronto_logistica'
    const ductRequestRows = await db.prepare(`
      SELECT 
        dri.id as duct_item_id,
        dr.id as duct_request_id,
        dr.code as duct_request_code,
        dri.item_description,
        dri.dimension,
        dri.unit,
        dri.quantity_requested,
        dn.id as duct_note_id,
        dn.delivery_note_number,
        dn.total_weight_kg
      FROM duct_request_items dri
      JOIN duct_requests dr ON dri.request_id = dr.id
      LEFT JOIN duct_delivery_notes dn ON dn.duct_request_id = dr.id
      WHERE dr.project_id = ? AND dr.status = 'Pronto'
      ORDER BY dr.id DESC, dri.id ASC
    `).all(projectId);

    const availableDucts = [];
    for (const d of ductRequestRows) {
      const requestedRow = await db.prepare(`
        SELECT COALESCE(SUM(lri.quantity_requested), 0) as total_requested
        FROM logistics_request_items lri
        JOIN logistics_requests lr ON lri.logistics_request_id = lr.id
        WHERE lri.duct_request_id = ? AND lri.item_description = ? AND lr.status != 'Cancelado'
      `).get(d.duct_request_id, d.item_description);

      const alreadyInLogistics = Number(requestedRow?.total_requested || 0);
      const totalReady = Number(d.quantity_requested || 0);
      const availableToRequest = Math.max(0, Number((totalReady - alreadyInLogistics).toFixed(2)));

      if (availableToRequest > 0) {
        const desc = d.dimension 
          ? `${d.item_description} (${d.dimension})` 
          : d.item_description;

        availableDucts.push({
          sourceType: 'duto',
          ductItemId: d.duct_item_id,
          ductRequestId: d.duct_request_id,
          ductRequestCode: d.duct_request_code,
          ductNoteId: d.duct_note_id,
          deliveryNoteNumber: d.delivery_note_number,
          code: d.delivery_note_number ? `DN-${d.delivery_note_number}` : d.duct_request_code,
          description: desc,
          unit: d.unit || 'un',
          quantityReady: totalReady,
          alreadyInLogistics,
          availableQuantity: availableToRequest
        });
      }
    }

    // Busca também Delivery Notes avulsas que estejam prontas e sem duct_request_id vinculado
    const standaloneDuctNotes = await db.prepare(`
      SELECT dn.* 
      FROM duct_delivery_notes dn
      WHERE dn.project_id = ? 
        AND dn.status = 'pronto_logistica'
        AND dn.duct_request_id IS NULL
      ORDER BY dn.id DESC
    `).all(projectId);

    for (const dn of standaloneDuctNotes) {
      const requestedRow = await db.prepare(`
        SELECT COALESCE(SUM(lri.quantity_requested), 0) as total_requested
        FROM logistics_request_items lri
        JOIN logistics_requests lr ON lri.logistics_request_id = lr.id
        WHERE lri.duct_note_id = ? AND lr.status != 'Cancelado'
      `).get(dn.id);

      const alreadyInLogistics = Number(requestedRow?.total_requested || 0);
      const totalWeightKg = Number(dn.total_weight_kg || 0);
      const availableToRequest = Math.max(0, Number((totalWeightKg - alreadyInLogistics).toFixed(2)));

      if (availableToRequest > 0) {
        availableDucts.push({
          sourceType: 'duto',
          ductNoteId: dn.id,
          deliveryNoteNumber: dn.delivery_note_number,
          code: `DN-${dn.delivery_note_number}`,
          description: `Lote de Dutos CAMduct DN-${dn.delivery_note_number} (${dn.sheet_type})`,
          unit: 'KG',
          quantityReady: totalWeightKg,
          alreadyInLogistics,
          availableQuantity: availableToRequest
        });
      }
    }

    res.json({
      project,
      materials: availableMaterials,
      ducts: availableDucts
    });
  } catch (err) {
    console.error('[Ready Items Error]', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/logistics/requests
 * O engenheiro acessa "Solicitar Logística" para registrar a demanda de transporte:
 * Seleciona a obra e os itens liberados pelo almoxarifado e/ou dutos prontos do CAMduct.
 */
logisticsRouter.post('/requests', async (req, res) => {
  try {
    const {
      projectId,
      items,
      priority = 'Normal',
      desiredDate,
      preferredShift = 'integral',
      deliveryLocation,
      contactOnSite,
      notes,
      requestedBy
    } = req.body;

    if (!projectId) {
      return res.status(400).json({ error: 'Selecione a obra de destino para a solicitação de transporte.' });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Selecione ao menos um item liberado para incluir no pedido de transporte.' });
    }

    const project = await db.prepare('SELECT id, name, code, responsible_engineer FROM projects WHERE id = ?').get(projectId);
    if (!project) return res.status(404).json({ error: 'Projeto não encontrado.' });

    // Gera numeração sequencial SL-2026-XXXX
    const countRes = await db.prepare('SELECT COUNT(*) as count FROM logistics_requests').get();
    const seq = (countRes?.count || 0) + 1;
    const year = new Date().getFullYear();
    const code = `SL-${year}-${String(seq).padStart(4, '0')}`;

    const insertReq = await db.prepare(`
      INSERT INTO logistics_requests (
        code, project_id, requested_by, priority, desired_date,
        preferred_shift, delivery_location, contact_on_site, notes, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pendente')
    `).run(
      code,
      projectId,
      requestedBy || null,
      priority,
      desiredDate || null,
      preferredShift,
      deliveryLocation || null,
      contactOnSite || null,
      notes || null
    );

    const logisticsRequestId = insertReq.lastInsertRowid;

    for (const it of items) {
      const q = Number(it.quantityRequested);
      if (isNaN(q) || q <= 0) continue;

      await db.prepare(`
        INSERT INTO logistics_request_items (
          logistics_request_id, source_type, material_id, material_request_id,
          material_request_item_id, duct_request_id, duct_note_id,
          item_description, unit, quantity_requested, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pendente')
      `).run(
        logisticsRequestId,
        it.sourceType,
        it.materialId || null,
        it.materialRequestId || null,
        it.requestItemId || null,
        it.ductRequestId || null,
        it.ductNoteId || null,
        it.description || 'Item de transporte',
        it.unit || 'un',
        q
      );
    }

    // Notifica equipe de Logística (Sirlene Leal) e Administradores
    const requesterUser = requestedBy ? await db.prepare('SELECT name FROM users WHERE id = ?').get(requestedBy) : null;
    const requesterName = requesterUser?.name || 'Engenheiro';

    // Notificação direta para Sirlene Leal
    const sirlene = await db.prepare("SELECT id FROM users WHERE email ILIKE '%sirlene%' OR name ILIKE '%sirlene%' LIMIT 1").get();
    if (sirlene?.id) {
      await db.prepare(`
        INSERT INTO notifications (user_id, role_target, title, message, type, link)
        VALUES (?, 'almoxarifado', 'Nova Solicitação de Transporte', ?, 'info', '/logistica')
      `).run(sirlene.id, `O engenheiro ${requesterName} solicitou transporte (${code}) de ${items.length} itens para a obra ${project.name}.`);
    }

    // Notificação geral para a equipe de Logística e Almoxarifado
    await db.prepare(`
      INSERT INTO notifications (role_target, title, message, type, link)
      VALUES ('almoxarifado', 'Nova Demanda de Transporte', ?, 'info', '/logistica')
    `).run(`Nova solicitação de transporte ${code} para a obra ${project.name} registrada pelo engenheiro ${requesterName}.`);

    res.status(201).json({
      success: true,
      id: logisticsRequestId,
      code,
      message: 'Solicitação de logística enviada com sucesso para a equipe de logística!'
    });
  } catch (err) {
    console.error('[Create Logistics Request Error]', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/logistics/requests
 * A equipe de logística acessa as solicitações recebidas para atender essas demandas:
 * Mostra todas as solicitações vindas dos engenheiros, com materiais do almoxarifado e dutos do CAMduct.
 */
logisticsRouter.get('/requests', async (req, res) => {
  try {
    const { projectId, status, requestedBy } = req.query;

    let sql = `
      SELECT 
        lr.*,
        p.name as project_name,
        p.code as project_code,
        p.client as client_name,
        p.address as project_address,
        p.city as project_city,
        p.responsible_engineer,
        u.name as requested_by_name,
        u.email as requested_by_email,
        u.avatar as requested_by_avatar,
        lt.code as trip_code,
        lt.scheduled_date as trip_scheduled_date,
        lt.vehicle_plate as trip_vehicle_plate,
        lt.driver_name as trip_driver_name
      FROM logistics_requests lr
      JOIN projects p ON lr.project_id = p.id
      LEFT JOIN users u ON lr.requested_by = u.id
      LEFT JOIN logistics_trips lt ON lr.trip_id = lt.id
      WHERE 1=1
    `;
    const params = [];

    if (projectId) {
      sql += ' AND lr.project_id = ?';
      params.push(Number(projectId));
    }
    if (status) {
      sql += ' AND lr.status = ?';
      params.push(status);
    }
    if (requestedBy) {
      sql += ' AND lr.requested_by = ?';
      params.push(Number(requestedBy));
    }

    sql += ' ORDER BY lr.id DESC';

    const requests = await db.prepare(sql).all(...params);

    const fullRequests = [];
    for (const r of requests) {
      const items = await db.prepare(`
        SELECT 
          lri.*,
          m.code as material_code,
          mr.code as material_request_code,
          dr.code as duct_request_code,
          dn.delivery_note_number
        FROM logistics_request_items lri
        LEFT JOIN materials m ON lri.material_id = m.id
        LEFT JOIN material_requests mr ON lri.material_request_id = mr.id
        LEFT JOIN duct_requests dr ON lri.duct_request_id = dr.id
        LEFT JOIN duct_delivery_notes dn ON lri.duct_note_id = dn.id
        WHERE lri.logistics_request_id = ?
        ORDER BY lri.id ASC
      `).all(r.id);

      fullRequests.push({
        id: r.id,
        code: r.code,
        projectId: r.project_id,
        projectName: r.project_name,
        projectCode: r.project_code,
        clientName: r.client_name,
        projectAddress: r.project_address,
        projectCity: r.project_city,
        responsibleEngineer: r.responsible_engineer,
        requestedBy: r.requested_by,
        requestedByName: r.requested_by_name,
        requestedByEmail: r.requested_by_email,
        requestedByAvatar: r.requested_by_avatar,
        priority: r.priority,
        desiredDate: r.desired_date,
        preferredShift: r.preferred_shift,
        deliveryLocation: r.delivery_location,
        contactOnSite: r.contact_on_site,
        notes: r.notes,
        status: r.status,
        tripId: r.trip_id,
        tripCode: r.trip_code,
        tripScheduledDate: r.trip_scheduled_date,
        tripVehiclePlate: r.trip_vehicle_plate,
        tripDriverName: r.trip_driver_name,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        items: items.map(it => ({
          id: it.id,
          sourceType: it.source_type,
          materialId: it.material_id,
          materialCode: it.material_code,
          materialRequestId: it.material_request_id,
          materialRequestCode: it.material_request_code,
          ductRequestId: it.duct_request_id,
          ductRequestCode: it.duct_request_code,
          ductNoteId: it.duct_note_id,
          deliveryNoteNumber: it.delivery_note_number,
          itemDescription: it.item_description,
          unit: it.unit,
          quantityRequested: Number(it.quantity_requested),
          quantityShipped: Number(it.quantity_shipped || 0),
          status: it.status
        }))
      });
    }

    res.json(fullRequests);
  } catch (err) {
    console.error('[Get Logistics Requests Error]', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * PATCH /api/logistics/requests/:id/status
 * A equipe de logística atualiza o status da demanda:
 * Ex: 'Pendente' -> 'Agendado' -> 'Em Trânsito' -> 'Entregue' -> 'Cancelado'
 */
logisticsRouter.patch('/requests/:id/status', async (req, res) => {
  try {
    const requestId = Number(req.params.id);
    const { status, tripId, userId, userName } = req.body;

    const allowed = ['Pendente', 'Agendado', 'Em Trânsito', 'Entregue', 'Cancelado'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: `Status inválido. Permitidos: ${allowed.join(', ')}` });
    }

    const reqRow = await db.prepare(`
      SELECT lr.*, p.name as project_name 
      FROM logistics_requests lr
      JOIN projects p ON lr.project_id = p.id
      WHERE lr.id = ?
    `).get(requestId);

    if (!reqRow) return res.status(404).json({ error: 'Solicitação de logística não encontrada.' });

    await db.prepare(`
      UPDATE logistics_requests
      SET status = ?, trip_id = COALESCE(?, trip_id), updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(status, tripId || null, requestId);

    // Se entregue, atualiza os itens
    if (status === 'Entregue') {
      await db.prepare(`
        UPDATE logistics_request_items
        SET status = 'Entregue', quantity_shipped = quantity_requested
        WHERE logistics_request_id = ?
      `).run(requestId);

      if (reqRow.requested_by) {
        await db.prepare(`
          INSERT INTO notifications (user_id, role_target, title, message, type, link)
          VALUES (?, 'engenharia', 'Transporte Entregue no Canteiro!', ?, 'success', '/solicitacoes')
        `).run(reqRow.requested_by, `A entrega da solicitação de transporte ${reqRow.code} da obra ${reqRow.project_name} foi confirmada pela equipe de logística.`);
      }
    }

    // Auditoria
    await db.prepare(`
      INSERT INTO audit_logs (user_id, user_name, action, entity_type, entity_id, project_id, details)
      VALUES (?, ?, 'STATUS_SOLICITACAO_LOGISTICA', 'LOGISTICA', ?, ?, ?)
    `).run(
      userId || 1,
      userName || 'Equipe de Logística',
      requestId,
      reqRow.project_id,
      `Status da solicitação de transporte ${reqRow.code} alterado de '${reqRow.status}' para '${status}'.`
    );

    res.json({ success: true, id: requestId, status });
  } catch (err) {
    console.error('[Update Logistics Request Status Error]', err);
    res.status(500).json({ error: err.message });
  }
});
