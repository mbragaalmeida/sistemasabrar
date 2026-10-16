import { db } from '../db/connection.js';
import { LearningService } from './learningService.js';

export async function generateNextRequestCode() {
  const rows = await db.prepare("SELECT code FROM material_requests WHERE code LIKE 'SOL-%'").all();
  let maxNum = 0;
  for (const r of rows) {
    const m = r.code ? r.code.match(/SOL-\d{4}-(\d+)/) : null;
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > maxNum) maxNum = n;
    }
  }
  let nextNum = maxNum + 1;
  let code = `SOL-2026-${String(nextNum).padStart(4, '0')}`;
  while (await db.prepare('SELECT id FROM material_requests WHERE code = ?').get(code)) {
    nextNum++;
    code = `SOL-2026-${String(nextNum).padStart(4, '0')}`;
  }
  return code;
}

export async function generateNextPurchaseCode() {
  const rows = await db.prepare("SELECT code FROM purchases WHERE code LIKE 'COM-%'").all();
  let maxNum = 0;
  for (const r of rows) {
    const m = r.code ? r.code.match(/COM-\d{4}-(\d+)/) : null;
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > maxNum) maxNum = n;
    }
  }
  let nextNum = maxNum + 1;
  let code = `COM-2026-${String(nextNum).padStart(4, '0')}`;
  while (await db.prepare('SELECT id FROM purchases WHERE code = ?').get(code)) {
    nextNum++;
    code = `COM-2026-${String(nextNum).padStart(4, '0')}`;
  }
  return code;
}

export async function generateNextReturnCode() {
  const rows = await db.prepare("SELECT code FROM returns WHERE code LIKE 'DEV-%'").all();
  let maxNum = 0;
  for (const r of rows) {
    const m = r.code ? r.code.match(/DEV-\d{4}-(\d+)/) : null;
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > maxNum) maxNum = n;
    }
  }
  let nextNum = maxNum + 1;
  let code = `DEV-2026-${String(nextNum).padStart(4, '0')}`;
  while (await db.prepare('SELECT id FROM returns WHERE code = ?').get(code)) {
    nextNum++;
    code = `DEV-2026-${String(nextNum).padStart(4, '0')}`;
  }
  return code;
}

export class StockService {
  /**
   * Retorna os níveis de estoque calculados com a regra:
   * Estoque Disponível = Estoque Físico - Estoque Reservado
   */
  static async getMaterialStock(materialId) {
    const mat = await db.prepare('SELECT * FROM materials WHERE id = ?').get(materialId);
    if (!mat) throw new Error('Material não encontrado');

    const available = Math.max(0, mat.stock_physical - mat.stock_reserved);
    const isBelowMinimum = mat.stock_physical <= mat.stock_minimum;

    return {
      ...mat,
      stock_available: available,
      isBelowMinimum
    };
  }

  /**
   * Entrada simplificada de material no estoque (Seção 12).
   * Sem burocracia: Selecionar material -> Informar quantidade -> Confirmar entrada.
   */
  static async recordSimplifiedEntry(materialId, quantity, userId, notes = '') {
    const qty = Number(quantity);
    if (qty <= 0) throw new Error('Quantidade deve ser superior a zero');

    const mat = await db.prepare('SELECT * FROM materials WHERE id = ?').get(materialId);
    if (!mat) throw new Error('Material não encontrado');

    const prevStock = mat.stock_physical;
    const newStock = prevStock + qty;

    await db.prepare(`
      UPDATE materials 
      SET stock_physical = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(newStock, materialId);

    // Registra a movimentação
    await db.prepare(`
      INSERT INTO stock_movements (material_id, type, quantity, previous_stock, new_stock, user_id, notes)
      VALUES (?, 'ENTRADA', ?, ?, ?, ?, ?)
    `).run(materialId, qty, prevStock, newStock, userId, notes || 'Entrada simplificada de estoque');

    // Registra log de auditoria
    await db.prepare(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_value, new_value, details)
      VALUES (?, 'ENTRADA_ESTOQUE', 'ESTOQUE', ?, ?, ?, ?)
    `).run(
      userId, materialId,
      `${prevStock} ${mat.unit}`,
      `${newStock} ${mat.unit}`,
      `Entrada de ${qty} ${mat.unit} no material ${mat.name} (${mat.code})`
    );

    return {
      success: true,
      materialId,
      previousStock: prevStock,
      newStock: newStock,
      available: Math.max(0, newStock - mat.stock_reserved)
    };
  }

  /**
   * Processa solicitação de material (individual ou em lote) emitida pela Engenharia.
   * - Se houver estoque disponível: Reserva total e gera movimentação de reserva.
   * - Se houver déficit: Reserva o disponível e gera Demanda de Compra automática para o setor de Compras!
   */
  static async createMaterialRequest(projectId, materialId, requestedQty, priority, userId, notes = '', pickupDate = null) {
    return await StockService.createBatchMaterialRequest(
      projectId,
      [{ materialId, quantity: requestedQty }],
      priority,
      userId,
      notes,
      pickupDate
    );
  }

  /**
   * Processa uma lista de materiais de uma obra em lote (ou orçamento completo).
   * - Controla cotas previstas no orçamento aprovado (Requisito 4)
   * - Se houver itens extras ou quantidades que excedam a cota, exige aprovação de Administrador (Requisito 2)
   * - Se dentro do orçamento: reserva estoque e gera déficit automaticamente
   */
  static async createBatchMaterialRequest(projectId, items, priority, userId, notes = '', pickupDate = null) {
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('Lista de materiais solicitados não pode estar vazia');
    }

    const project = await db.prepare('SELECT * FROM projects WHERE id = ? AND (is_hidden IS FALSE OR is_hidden IS NULL)').get(projectId);
    if (!project) throw new Error('Projeto não encontrado');

    if (project.status === 'Concluído' || project.status === 'Concluída' || project.status === 'Finalizado') {
      throw new Error('Não é possível solicitar novos materiais para uma obra já concluída.');
    }

    const reqCode = await generateNextRequestCode();

    // 1. Identifica se é Solicitação Interna (SABRAR)
    const isInternal = project.code === 'SAB-INTERNO';

    // 2. Busca orçamento da obra para controle de limites (se for obra de cliente)
    const budget = isInternal ? null : await db.prepare('SELECT id, status FROM budgets WHERE project_id = ? AND (is_hidden IS FALSE OR is_hidden IS NULL)').get(projectId);
    let budgetItems = [];
    if (budget) {
      budgetItems = await db.prepare('SELECT * FROM budget_items WHERE budget_id = ?').all(budget.id);
    }

    // 3. Busca histórico de solicitações já realizadas para calcular saldo consumido de cada material
    const prevRequests = isInternal ? [] : await db.prepare(`
      SELECT mri.material_id, SUM(mri.quantity_requested) as total_requested
      FROM material_request_items mri
      JOIN material_requests mr ON mri.request_id = mr.id
      WHERE mr.project_id = ? AND mr.status != 'Cancelado' AND (mr.is_hidden IS FALSE OR mr.is_hidden IS NULL)
      GROUP BY mri.material_id
    `).all(projectId);

    const prevRequestedMap = new Map();
    for (const pr of prevRequests) {
      prevRequestedMap.set(pr.material_id, Number(pr.total_requested || 0));
    }

    // 4. Verifica se algum item da solicitação é extra ou ultrapassa o saldo do orçamento
    let hasExtraItems = false;
    const itemsQuotaAnalysis = [];

    // Busca perfil do usuário solicitante para validação de materiais avulsos
    const reqUser = await db.prepare('SELECT u.*, r.name as role_name FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ?').get(userId);
    if (reqUser && reqUser.role_name === 'compras' && !isInternal) {
      throw new Error('Usuários do setor de compras podem solicitar materiais exclusivamente para uso interno (SAB-INTERNO).');
    }

    const isEmilyOrAdmin = reqUser && (
      reqUser.role_name === 'admin' || 
      reqUser.email === 'emily@sabrar.com.br' || 
      /emily/i.test(reqUser.name)
    );

    let hasCustomItems = false;

    for (const item of items) {
      let materialId = item.materialId || item.material_id || null;
      const isCustom = Boolean(item.isCustom || (!materialId && (item.customName || item.materialName)));
      const customName = (item.customName || item.materialName) ? String(item.customName || item.materialName).trim() : null;
      const customUnit = item.unit ? String(item.unit).trim() : 'un';
      const qty = Number(item.quantity || item.quantity_requested);

      if (qty <= 0) continue;

      // Material fora da base: qualquer usuário pode solicitar (Item 9), sem criar registro na tabela oficial materials (Item 8)
      if (isCustom || !materialId) {
        if (!customName) continue;
        materialId = null;
        hasCustomItems = true;
        hasExtraItems = true;

        itemsQuotaAnalysis.push({
          materialId: null,
          quantity: qty,
          isExtra: true,
          budgetQuantity: 0,
          previouslyRequested: 0,
          extraQuantity: qty,
          isCustom: true,
          customName,
          customUnit
        });
        continue;
      }

      if (isInternal) {
        // Solicitações internas de materiais da base não possuem cota de obra
        itemsQuotaAnalysis.push({
          materialId,
          quantity: qty,
          isExtra: false,
          budgetQuantity: 0,
          previouslyRequested: 0,
          extraQuantity: 0,
          isCustom: false,
          customName: null,
          customUnit
        });
        continue;
      }

      const budgetItem = budgetItems.find(b => b.material_id === materialId);
      let isExtra = false;
      let budgetQuantity = 0;
      let previouslyRequested = prevRequestedMap.get(materialId) || 0;
      let extraQuantity = 0;

      if (!budgetItem) {
        // Material não consta no orçamento da obra -> 100% Extra
        isExtra = true;
        budgetQuantity = 0;
        extraQuantity = qty;
        hasExtraItems = true;
      } else {
        budgetQuantity = Number(budgetItem.quantity || 0);
        const remainingQuota = Math.max(0, budgetQuantity - previouslyRequested);
        if (qty > remainingQuota) {
          // Solicitação ultrapassa o saldo disponível do orçamento
          isExtra = true;
          extraQuantity = Number((qty - remainingQuota).toFixed(2));
          hasExtraItems = true;
        }
      }

      itemsQuotaAnalysis.push({
        materialId,
        quantity: qty,
        isExtra,
        budgetQuantity,
        previouslyRequested,
        extraQuantity,
        isCustom: false,
        customName: null,
        customUnit
      });
    }

    // Se houver itens fora da base (qualquer obra/interno) ou itens extras acima do orçamento da obra, exige aprovação (Admin, Sabrina ou Emily)
    const requiresAdminApproval = hasCustomItems || (!isInternal && hasExtraItems);
    const initialStatus = requiresAdminApproval ? 'Aguardando aprovação' : 'Solicitado';
    const initialApprovalStatus = requiresAdminApproval ? 'Pendente' : 'Aprovado';

    // Cria a solicitação no banco
    const reqResult = await db.prepare(`
      INSERT INTO material_requests (
        code, project_id, requested_by, priority, status, notes,
        requires_admin_approval, admin_approval_status, has_extra_items, pickup_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      reqCode, projectId, userId, priority || 'Média', initialStatus, notes,
      requiresAdminApproval, initialApprovalStatus, hasExtraItems, pickupDate || null
    );

    const requestId = reqResult.lastInsertRowid;

    let totalReservedItems = 0;
    let totalDeficitItems = 0;
    const processedItems = [];
    const purchasesCreated = [];

    for (const analysis of itemsQuotaAnalysis) {
      const mat = analysis.materialId
        ? await db.prepare('SELECT * FROM materials WHERE id = ?').get(analysis.materialId)
        : null;

      if (!mat && !analysis.isCustom) continue;

      const matName = mat ? mat.name : (analysis.customName || 'Material Fora da Base');
      const matUnit = analysis.customUnit || (mat ? mat.unit : 'un');

      // Se requer aprovação (Admin, Sabrina ou Emily), NÃO reserva estoque nem cria compras até aprovação
      if (requiresAdminApproval) {
        await db.prepare(`
          INSERT INTO material_request_items (
            request_id, material_id, quantity_requested, quantity_reserved, quantity_delivered,
            deficit, is_extra, budget_quantity, previously_requested, extra_quantity,
            is_custom, custom_name, custom_unit
          ) VALUES (?, ?, ?, 0, 0, 0, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          requestId, analysis.materialId, analysis.quantity,
          analysis.isExtra, analysis.budgetQuantity, analysis.previouslyRequested, analysis.extraQuantity,
          Boolean(analysis.isCustom), analysis.customName || null, matUnit
        );

        processedItems.push({
          materialId: analysis.materialId,
          materialName: matName,
          materialUnit: matUnit,
          requestedQuantity: analysis.quantity,
          reservedQuantity: 0,
          deficit: 0,
          isExtra: analysis.isExtra,
          extraQuantity: analysis.extraQuantity,
          budgetQuantity: analysis.budgetQuantity,
          previouslyRequested: analysis.previouslyRequested,
          isCustom: Boolean(analysis.isCustom),
          customName: analysis.customName || null
        });
        continue;
      }

      // Fluxo normal (dentro do orçamento ou interno com material da base): Reserva e Déficit imediatos
      const available = mat ? Math.max(0, mat.stock_physical - mat.stock_reserved) : 0;
      const deficit = Math.max(0, analysis.quantity - available);
      const reservable = Math.min(analysis.quantity, available);

      const itemResult = await db.prepare(`
        INSERT INTO material_request_items (
          request_id, material_id, quantity_requested, quantity_reserved, quantity_delivered,
          deficit, is_extra, budget_quantity, previously_requested, extra_quantity,
          is_custom, custom_name, custom_unit
        ) VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        requestId, analysis.materialId, analysis.quantity, reservable, deficit,
        analysis.isExtra, analysis.budgetQuantity, analysis.previouslyRequested, analysis.extraQuantity,
        Boolean(analysis.isCustom), analysis.customName || null, matUnit
      );

      const requestItemId = itemResult.lastInsertRowid;

      if (mat && reservable > 0) {
        await db.prepare(`
          UPDATE materials 
          SET stock_reserved = stock_reserved + ?, updated_at = CURRENT_TIMESTAMP 
          WHERE id = ?
        `).run(reservable, analysis.materialId);

        await db.prepare(`
          INSERT INTO stock_movements (material_id, type, quantity, previous_stock, new_stock, project_id, reference_id, user_id, notes)
          VALUES (?, 'RESERVA', ?, ?, ?, ?, ?, ?, ?)
        `).run(
          analysis.materialId, reservable, mat.stock_physical, mat.stock_physical,
          projectId, requestId, userId,
          `Reserva de ${reservable} ${matUnit} para obra ${project.name} (${reqCode})`
        );
        totalReservedItems++;
      }

      if (deficit > 0) {
        const purchaseCode = await generateNextPurchaseCode();
        const refPrice = mat ? Number(mat.reference_price || 0) : 0;

        const purResult = await db.prepare(`
          INSERT INTO purchases (code, project_id, request_item_id, material_id, custom_name, custom_unit, quantity, supplier_id, unit_price, total_price, status, priority, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Solicitado', ?, ?)
        `).run(
          purchaseCode, projectId, requestItemId, analysis.materialId,
          mat ? null : matName, matUnit, deficit,
          mat ? mat.supplier_id : null, refPrice,
          Number((deficit * refPrice).toFixed(2)),
          priority === 'Urgente' ? 'Alta' : priority,
          `Demanda automática gerada por déficit na solicitação ${reqCode} da obra ${project.name}. Solicitado: ${analysis.quantity}, Disponível: ${available}, Comprar: ${deficit}.`
        );

        purchasesCreated.push({
          id: purResult.lastInsertRowid,
          code: purchaseCode,
          materialName: matName,
          deficitQuantity: deficit
        });
        totalDeficitItems++;
      }

      processedItems.push({
        materialId: analysis.materialId,
        materialName: matName,
        materialUnit: matUnit,
        requestedQuantity: analysis.quantity,
        reservedQuantity: reservable,
        deficit,
        isExtra: analysis.isExtra,
        extraQuantity: analysis.extraQuantity,
        budgetQuantity: analysis.budgetQuantity,
        previouslyRequested: analysis.previouslyRequested
      });
    }

    // Se requereu aprovação (Admin, Sabrina ou Emily):
    if (requiresAdminApproval) {
      // Dispara notificação urgente para o perfil Administrador Geral / Aprovadores
      await db.prepare(`
        INSERT INTO notifications (role_target, title, message, type, link)
        VALUES ('admin', 'Materiais Extras / Fora da Base - Aprovação Necessária', ?, 'urgent', '/solicitacoes')
      `).run(`A obra ${project.name} (${reqCode}) teve uma solicitação contendo materiais fora da base ou acima do orçamento previsto. Aprovação necessária.`);

      // Log de auditoria
      await db.prepare(`
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, project_id, old_value, new_value, details)
        VALUES (?, 'SOLICITACAO_EXTRA_PENDENTE', 'SOLICITACAO', ?, ?, null, 'Aguardando aprovação', ?)
      `).run(
        userId, requestId, projectId,
        `Solicitação ${reqCode} com materiais fora da base / acima do orçamento gerada para a obra ${project.name}. Aguarda aprovação (Admin, Sabrina ou Emily).`
      );

      const firstProcessed = processedItems[0] || {};
      return {
        requestId,
        code: reqCode,
        status: 'Aguardando aprovação',
        requiresAdminApproval: true,
        adminApprovalStatus: 'Pendente',
        hasExtraItems: true,
        totalItems: processedItems.length,
        reservedItemsCount: 0,
        deficitItemsCount: 0,
        processedItems,
        purchasesCreated: [],
        materialName: firstProcessed.materialName,
        requestedQuantity: firstProcessed.requestedQuantity,
        reservedQuantity: 0,
        deficit: 0,
        message: 'Solicitação registrada. Por conter materiais fora da base ou acima da cota orçada, aguarda aprovação (Admin, Sabrina ou Emily).'
      };
    }

    // Define status inicial padrão da solicitação: 'Solicitado' (Item 4)
    const requestStatus = 'Solicitado';

    await db.prepare('UPDATE material_requests SET status = ? WHERE id = ?').run(requestStatus, requestId);

    // Dispara notificações normais para Almoxarifado e Compras
    if (totalReservedItems > 0) {
      await db.prepare(`
        INSERT INTO notifications (role_target, title, message, type, link)
        VALUES ('Almoxarifado', 'Nova Solicitação para Separação', ?, 'info', '/estoque')
      `).run(`Engenharia solicitou ${processedItems.length} materiais para a obra ${project.name} (${reqCode}). ${totalReservedItems} item(ns) reservados para separação.`);
    }

    if (totalDeficitItems > 0) {
      await db.prepare(`
        INSERT INTO notifications (role_target, title, message, type, link)
        VALUES ('Compras', 'Déficit de Estoque - Demanda Gerada', ?, 'urgent', '/compras')
      `).run(`Obra ${project.name} (${reqCode}): ${totalDeficitItems} materiais sem estoque suficiente geraram demandas de compra.`);
    }

    // Log de auditoria
    await db.prepare(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, project_id, old_value, new_value, details)
      VALUES (?, 'CRIAR_SOLICITACAO', 'SOLICITACAO', ?, ?, null, ?, ?)
    `).run(
      userId, requestId, projectId, requestStatus,
      `Solicitação ${reqCode} criada dentro do orçamento com ${processedItems.length} materiais (${totalReservedItems} reservados no estoque, ${totalDeficitItems} em déficit enviados para compras).`
    );

    const firstProcessed = processedItems[0] || {};
    return {
      requestId,
      code: reqCode,
      status: requestStatus,
      requiresAdminApproval: false,
      adminApprovalStatus: 'Aprovado',
      hasExtraItems: false,
      totalItems: processedItems.length,
      reservedItemsCount: totalReservedItems,
      deficitItemsCount: totalDeficitItems,
      processedItems,
      purchasesCreated,
      materialName: firstProcessed.materialName,
      requestedQuantity: firstProcessed.requestedQuantity,
      reservedQuantity: firstProcessed.reservedQuantity,
      deficit: firstProcessed.deficit,
      purchaseDemand: purchasesCreated[0] || null
    };
  }

  /**
   * Aprovação de solicitação com materiais extras / fora da base por um Administrador, Sabrina ou Emily.
   * Libera a reserva no estoque físico e gera pedidos de compra para eventuais déficits.
   */
  static async approveExtraRequest(requestId, adminUserId, notes = '') {
    const req = await db.prepare('SELECT * FROM material_requests WHERE id = ?').get(requestId);
    if (!req) throw new Error('Solicitação não encontrada');

    if (req.admin_approval_status === 'Aprovado' && req.status !== 'Aguardando aprovação') {
      throw new Error('Esta solicitação já foi aprovada anteriormente');
    }

    const project = await db.prepare('SELECT * FROM projects WHERE id = ?').get(req.project_id);
    const items = await db.prepare('SELECT * FROM material_request_items WHERE request_id = ?').all(requestId);

    let totalReserved = 0;
    let totalDeficit = 0;
    const purchasesCreated = [];

    for (const it of items) {
      const mat = it.material_id
        ? await db.prepare('SELECT * FROM materials WHERE id = ?').get(it.material_id)
        : null;
      if (!mat && !it.is_custom && !it.custom_name) continue;

      const matName = mat ? mat.name : (it.custom_name || 'Material Fora da Base');
      const matUnit = it.custom_unit || (mat ? mat.unit : 'un');
      const qty = Number(it.quantity_requested);
      const available = mat ? Math.max(0, mat.stock_physical - mat.stock_reserved) : 0;
      const deficit = Math.max(0, qty - available);
      const reservable = Math.min(qty, available);

      await db.prepare(`
        UPDATE material_request_items 
        SET quantity_reserved = ?, deficit = ?
        WHERE id = ?
      `).run(reservable, deficit, it.id);

      if (mat && reservable > 0) {
        await db.prepare(`
          UPDATE materials 
          SET stock_reserved = stock_reserved + ?, updated_at = CURRENT_TIMESTAMP 
          WHERE id = ?
        `).run(reservable, mat.id);

        await db.prepare(`
          INSERT INTO stock_movements (material_id, type, quantity, previous_stock, new_stock, project_id, reference_id, user_id, notes)
          VALUES (?, 'RESERVA', ?, ?, ?, ?, ?, ?, ?)
        `).run(
          mat.id, reservable, mat.stock_physical, mat.stock_physical,
          project.id, requestId, adminUserId,
          `Reserva autorizada (${reservable} ${matUnit}) para obra ${project.name} (${req.code})`
        );
        totalReserved++;
      }

      if (deficit > 0) {
        const purchaseCode = await generateNextPurchaseCode();
        const refPrice = mat ? Number(mat.reference_price || 0) : 0;

        await db.prepare(`
          INSERT INTO purchases (code, project_id, request_item_id, material_id, custom_name, custom_unit, quantity, supplier_id, unit_price, total_price, status, priority, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Solicitado', ?, ?)
        `).run(
          purchaseCode, project.id, it.id, mat ? mat.id : null,
          mat ? null : matName, matUnit, deficit,
          mat ? mat.supplier_id : null, refPrice,
          Number((deficit * refPrice).toFixed(2)),
          req.priority === 'Urgente' ? 'Alta' : req.priority,
          `Compra automática por déficit em solicitação autorizada (${req.code}) para a obra ${project.name}.`
        );

        purchasesCreated.push({ code: purchaseCode, materialName: matName, deficitQuantity: deficit });
        totalDeficit++;
      }
    }

    const newStatus = 'Solicitado';

    const approverUser = await db.prepare('SELECT name FROM users WHERE id = ?').get(adminUserId);
    const approverName = approverUser?.name || 'Administrador';

    await db.prepare(`
      UPDATE material_requests 
      SET status = ?, admin_approval_status = 'Aprovado', admin_approved_by = ?,
          admin_approved_at = CURRENT_TIMESTAMP, admin_approval_notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newStatus, adminUserId, notes || `Aprovado por ${approverName}`, requestId);

    // Notifica Almoxarifado que os materiais foram liberados para separação
    await db.prepare(`
      INSERT INTO notifications (role_target, title, message, type, link)
      VALUES ('Almoxarifado', 'Solicitação Extra Aprovada', ?, 'info', '/estoque')
    `).run(`${approverName} aprovou a solicitação de materiais extras ${req.code} da obra ${project.name}. Itens liberados para separação.`);

    // Notifica o Engenheiro que fez a solicitação
    await db.prepare(`
      INSERT INTO notifications (user_id, role_target, title, message, type, link)
      VALUES (?, 'engenharia', 'Solicitação Extra Aprovada', ?, 'success', '/solicitacoes')
    `).run(req.requested_by, `Sua solicitação de materiais extras ${req.code} da obra ${project.name} foi APROVADA por ${approverName}.`);

    // Auditoria
    await db.prepare(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, project_id, old_value, new_value, details)
      VALUES (?, 'APROVAR_SOLICITACAO_EXTRA', 'SOLICITACAO', ?, ?, 'Aguardando aprovação', ?, ?)
    `).run(
      adminUserId, requestId, project.id, newStatus,
      `${approverName} aprovou a solicitação com materiais extras ${req.code} da obra ${project.name}. ${totalReserved} reservado(s), ${totalDeficit} em compras.`
    );

    return {
      success: true,
      requestId,
      newStatus,
      adminApprovalStatus: 'Aprovado',
      purchasesCreated
    };
  }

  /**
   * Rejeição de solicitação com materiais extras por um Administrador, Sabrina ou Emily.
   */
  static async rejectExtraRequest(requestId, adminUserId, reason = '') {
    const req = await db.prepare('SELECT * FROM material_requests WHERE id = ?').get(requestId);
    if (!req) throw new Error('Solicitação não encontrada');

    const project = await db.prepare('SELECT * FROM projects WHERE id = ?').get(req.project_id);
    const approverUser = await db.prepare('SELECT name FROM users WHERE id = ?').get(adminUserId);
    const approverName = approverUser?.name || 'Administrador';

    await db.prepare(`
      UPDATE material_requests 
      SET status = 'Cancelado', admin_approval_status = 'Rejeitado', admin_approved_by = ?,
          admin_approved_at = CURRENT_TIMESTAMP, admin_approval_notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(adminUserId, reason || `Rejeitado por ${approverName}`, requestId);

    // Notifica o Engenheiro
    await db.prepare(`
      INSERT INTO notifications (user_id, role_target, title, message, type, link)
      VALUES (?, 'engenharia', 'Solicitação Extra Recusada', ?, 'warning', '/solicitacoes')
    `).run(
      req.requested_by,
      `Sua solicitação com materiais extras ${req.code} da obra ${project.name} foi REJEITADA por ${approverName}. Motivo: ${reason || 'Não aprovado pelo controle de custos'}`
    );

    // Auditoria
    await db.prepare(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, project_id, old_value, new_value, details)
      VALUES (?, 'REJEITAR_SOLICITACAO_EXTRA', 'SOLICITACAO', ?, ?, 'Aguardando aprovação', 'Cancelado', ?)
    `).run(
      adminUserId, requestId, project.id,
      `${approverName} rejeitou a solicitação com materiais extras ${req.code} da obra ${project.name}. Motivo: ${reason || 'Não informado'}`
    );

    return {
      success: true,
      requestId,
      status: 'Cancelado',
      adminApprovalStatus: 'Rejeitado'
    };
  }

  /**
   * Almoxarifado altera status de atendimento:
   * 'Solicitado' -> 'Em Separação' -> 'Separado Parcial' / 'Separado'
   * Quando 'Separado': baixa efetivamente todos os itens do estoque físico e do reservado!
   */
  static async updateRequestStatus(requestId, newStatus, userId, notes = '') {
    const req = await db.prepare('SELECT * FROM material_requests WHERE id = ?').get(requestId);
    if (!req) throw new Error('Solicitação não encontrada');

    const items = await db.prepare('SELECT * FROM material_request_items WHERE request_id = ?').all(requestId);
    if (!items || items.length === 0) throw new Error('Itens da solicitação não encontrados');

    const project = await db.prepare('SELECT * FROM projects WHERE id = ?').get(req.project_id);

    if ((newStatus === 'Separado' || newStatus === 'Entregue') && req.status !== 'Separado' && req.status !== 'Entregue') {
      for (const item of items) {
        if (!item.material_id) {
          const deliveredQty = item.quantity_reserved > 0 ? item.quantity_reserved : item.quantity_requested;
          await db.prepare(`
            UPDATE material_request_items 
            SET quantity_delivered = ?, quantity_reserved = 0 
            WHERE id = ?
          `).run(deliveredQty, item.id);
          continue;
        }

        const mat = await db.prepare('SELECT * FROM materials WHERE id = ?').get(item.material_id);
        if (!mat) continue;

        const deliveredQty = item.quantity_reserved > 0 ? item.quantity_reserved : item.quantity_requested;
        const prevStock = mat.stock_physical;
        const newStock = Math.max(0, prevStock - deliveredQty);
        const newReserved = Math.max(0, mat.stock_reserved - deliveredQty);

        // Baixa no estoque físico e reservado do material
        await db.prepare(`
          UPDATE materials 
          SET stock_physical = ?, stock_reserved = ?, updated_at = CURRENT_TIMESTAMP 
          WHERE id = ?
        `).run(newStock, newReserved, mat.id);

        // Atualiza o item da solicitação
        await db.prepare(`
          UPDATE material_request_items 
          SET quantity_delivered = ?, quantity_reserved = 0 
          WHERE id = ?
        `).run(deliveredQty, item.id);

        // Registra movimentação de saída definitiva para a obra
        await db.prepare(`
          INSERT INTO stock_movements (material_id, type, quantity, previous_stock, new_stock, project_id, reference_id, user_id, notes)
          VALUES (?, 'SAIDA_OBRA', ?, ?, ?, ?, ?, ?, ?)
        `).run(
          mat.id, deliveredQty, prevStock, newStock,
          project.id, requestId, userId,
          `Separação/saída física confirmada pelo Almoxarifado para obra ${project.name} (${req.code})`
        );
      }

      // Registra log de auditoria
      await db.prepare(`
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, project_id, old_value, new_value, details)
        VALUES (?, 'ENTREGA_MATERIAL', 'SOLICITACAO', ?, ?, ?, ?, ?)
      `).run(
        userId, requestId, project.id, req.status, newStatus,
        `Almoxarifado marcou como ${newStatus} ${items.length} material(is) da solicitação ${req.code} para a obra ${project.name}`
      );

      // Notifica Engenharia que foi separado
      await db.prepare(`
        INSERT INTO notifications (user_id, role_target, title, message, type, link)
        VALUES (?, 'Engenharia', 'Material Separado no Almoxarifado', ?, 'success', '/solicitacoes')
      `).run(req.requested_by, `Solicitação ${req.code} (${items.length} materiais) da obra ${project.name} foi marcada como ${newStatus}.`);
    }

    await db.prepare(`
      UPDATE material_requests 
      SET status = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(newStatus, requestId);

    return { success: true, requestId, newStatus };
  }

  /**
   * Registro de Devoluções de Materiais ao Almoxarifado (Seção 19 & 20).
   * Aumenta o estoque físico com a sobra utilizável, vincula ao projeto e
   * recalcula o Consumo Real da Obra: Consumo Real = Retirado - Devolvido.
   */
  static async recordMaterialReturn(projectId, materialId, returnedQty, userId, reason = '') {
    const qty = Number(returnedQty);
    if (qty <= 0) throw new Error('Quantidade devolvida deve ser maior que zero');

    const mat = await db.prepare('SELECT * FROM materials WHERE id = ?').get(materialId);
    if (!mat) throw new Error('Material não encontrado');

    const project = await db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    if (!project) throw new Error('Projeto não encontrado');

    const prevStock = mat.stock_physical;
    const newStock = prevStock + qty;

    // Incrementa estoque físico
    await db.prepare(`
      UPDATE materials 
      SET stock_physical = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(newStock, materialId);

    // Gera código de devolução
    const devCode = await generateNextReturnCode();

    // Cria registro de devolução
    const devResult = await db.prepare(`
      INSERT INTO returns (code, project_id, material_id, quantity, received_by, reason)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(devCode, projectId, materialId, qty, userId, reason);

    const returnId = devResult.lastInsertRowid;

    // Movimentação de estoque do tipo DEVOLUCAO
    await db.prepare(`
      INSERT INTO stock_movements (material_id, type, quantity, previous_stock, new_stock, project_id, reference_id, user_id, notes)
      VALUES (?, 'DEVOLUCAO', ?, ?, ?, ?, ?, ?, ?)
    `).run(
      materialId, qty, prevStock, newStock,
      projectId, returnId, userId,
      `Devolução de ${qty} ${mat.unit} da obra ${project.name} (${devCode}). ${reason}`
    );

    // Auditoria
    await db.prepare(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, project_id, old_value, new_value, details)
      VALUES (?, 'DEVOLUCAO_MATERIAL', 'DEVOLUCAO', ?, ?, '0', ?, ?)
    `).run(
      userId, returnId, projectId, `${qty} ${mat.unit}`,
      `Almoxarifado registrou devolução de ${qty} ${mat.unit} de ${mat.name} da obra ${project.name}. Estoque atualizado para ${newStock} ${mat.unit}.`
    );

    // Recalcula dados de consumo real para o projeto e alimenta a base de aprendizado (Seção 20 e 24)
    const withdrawalTotal = (await db.prepare(`
      SELECT SUM(quantity) as total 
      FROM stock_movements 
      WHERE project_id = ? AND material_id = ? AND type = 'SAIDA_OBRA'
    `).get(projectId, materialId))?.total || 0;

    const returnTotal = (await db.prepare(`
      SELECT SUM(quantity) as total 
      FROM returns 
      WHERE project_id = ? AND material_id = ?
    `).get(projectId, materialId))?.total || 0;

    const actualConsumed = Math.max(0, withdrawalTotal - returnTotal);

    // Atualiza base histórica se existir item de orçamento correspondente
    const budgetItem = await db.prepare(`
      SELECT bi.* FROM budget_items bi
      JOIN budgets b ON bi.budget_id = b.id
      WHERE b.project_id = ? AND bi.material_id = ?
    `).get(projectId, materialId);

    if (budgetItem) {
      await LearningService.recordProjectFeedback(
        projectId,
        materialId,
        project.project_type,
        budgetItem.ai_suggested_quantity || budgetItem.quantity,
        budgetItem.quantity,
        withdrawalTotal,
        withdrawalTotal,
        returnTotal
      );
    }

    return {
      returnId,
      code: devCode,
      materialName: mat.name,
      quantityReturned: qty,
      newPhysicalStock: newStock,
      projectTotalWithdrawn: withdrawalTotal,
      projectTotalReturned: returnTotal,
      actualConsumed: actualConsumed
    };
  }

  /**
   * Recebimento de material comprado (Seção 18).
   * Incrementa o estoque físico e marca a compra como recebida.
   */
  static async confirmPurchaseReceipt(purchaseId, userId, notes = '') {
    const purchase = await db.prepare('SELECT * FROM purchases WHERE id = ?').get(purchaseId);
    if (!purchase) throw new Error('Pedido de compra não encontrado');

    if (purchase.status === 'Recebido') {
      throw new Error('Este pedido já foi marcado como recebido');
    }

    const mat = purchase.material_id
      ? await db.prepare('SELECT * FROM materials WHERE id = ?').get(purchase.material_id)
      : null;
    const matName = mat ? mat.name : (purchase.custom_name || 'Material Fora da Base');
    const matUnit = mat ? mat.unit : (purchase.custom_unit || 'un');
    const prevStock = mat ? Number(mat.stock_physical || 0) : 0;
    const newStock = prevStock + Number(purchase.quantity || 0);

    // Atualiza estoque físico se for material da base oficial
    if (mat) {
      await db.prepare(`
        UPDATE materials 
        SET stock_physical = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(newStock, mat.id);
    }

    // Atualiza status do pedido de compra
    const now = new Date().toISOString().split('T')[0];
    await db.prepare(`
      UPDATE purchases 
      SET status = 'Recebido', received_date = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(now, purchaseId);

    // Registra movimentação de entrada no estoque
    await db.prepare(`
      INSERT INTO stock_movements (material_id, custom_name, custom_unit, type, quantity, previous_stock, new_stock, project_id, reference_id, user_id, notes)
      VALUES (?, ?, ?, 'ENTRADA', ?, ?, ?, ?, ?, ?, ?)
    `).run(
      mat ? mat.id : null,
      mat ? null : matName,
      matUnit,
      purchase.quantity, prevStock, newStock,
      purchase.project_id, purchaseId, userId,
      `Recebimento de compra ${purchase.code}: +${purchase.quantity} ${matUnit}`
    );

    // Auditoria
    await db.prepare(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, project_id, old_value, new_value, details)
      VALUES (?, 'RECEBIMENTO_COMPRA', 'COMPRA', ?, ?, 'Aguardando entrega', 'Recebido', ?)
    `).run(
      userId, purchaseId, purchase.project_id,
      `Recebimento de ${purchase.quantity} ${matUnit} de ${matName} da compra ${purchase.code}.`
    );

    // Notifica Almoxarifado e Engenharia
    await db.prepare(`
      INSERT INTO notifications (role_target, title, message, type, link)
      VALUES ('Almoxarifado', 'Material de Compra Recebido', ?, 'success', '/estoque')
    `).run(`Chegaram ${purchase.quantity} ${matUnit} de ${matName} (${purchase.code}). Já disponível no almoxarifado.`);

    return {
      success: true,
      purchaseId,
      code: purchase.code,
      materialName: matName,
      quantityReceived: purchase.quantity,
      newStock: newStock
    };
  }
}
