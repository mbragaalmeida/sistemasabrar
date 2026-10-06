import { db } from '../db/connection.js';
import { LearningService } from './learningService.js';

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

    const nextReqCount = (await db.prepare('SELECT COUNT(*) as count FROM material_requests WHERE (is_hidden IS FALSE OR is_hidden IS NULL)').get())?.count + 1 || 1;
    const reqCode = `SOL-2026-${String(nextReqCount).padStart(4, '0')}`;

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
    const isEmilyOrAdmin = reqUser && (
      reqUser.role_name === 'admin' || 
      reqUser.email === 'emily@sabrar.com.br' || 
      /emily/i.test(reqUser.name)
    );

    for (const item of items) {
      let materialId = item.materialId || item.material_id;
      const isCustom = Boolean(item.isCustom || (!materialId && item.customName));
      const customName = item.customName ? String(item.customName).trim() : null;
      const qty = Number(item.quantity || item.quantity_requested);

      if (qty <= 0) continue;

      // Se for material fora da base (avulso): apenas Emily ou Admin podem solicitar
      if (isCustom || (!materialId && customName)) {
        if (!isEmilyOrAdmin) {
          throw new Error('Apenas Emily (Compras) possui autorização para solicitar materiais que não constam na Base Central de Materiais.');
        }

        // Cadastra ou reutiliza o material avulso na tabela materials para integridade de chaves estrangeiras
        let customMat = await db.prepare("SELECT * FROM materials WHERE LOWER(name) = LOWER(?)").get(customName);
        if (!customMat) {
          const countRes = await db.prepare("SELECT COUNT(*) as count FROM materials").get();
          const customCode = `MAT-EXT-${String((countRes?.count || 0) + 1).padStart(5, '0')}`;
          const insMat = await db.prepare(`
            INSERT INTO materials (code, name, category, unit, reference_price, status, description, created_at, updated_at)
            VALUES (?, ?, 'DIVERSOS / AVULSO', ?, 0.00, 'Ativo', 'Material avulso fora da base solicitado por Emily Bueno', NOW(), NOW())
          `).run(customCode, customName, item.unit || 'und');
          customMat = { id: insMat.lastInsertRowid, name: customName, unit: item.unit || 'und', stock_physical: 0, stock_reserved: 0 };
        }
        materialId = customMat.id;
      }

      if (!materialId) continue;

      if (isInternal) {
        // Solicitações internas não possuem cota de obra
        itemsQuotaAnalysis.push({
          materialId,
          quantity: qty,
          isExtra: false,
          budgetQuantity: 0,
          previouslyRequested: 0,
          extraQuantity: 0,
          isCustom,
          customName
        });
        continue;
      }

      const budgetItem = budgetItems.find(b => b.material_id === materialId);
      let isExtra = false;
      let budgetQuantity = 0;
      let previouslyRequested = prevRequestedMap.get(materialId) || 0;
      let extraQuantity = 0;

      if (!budgetItem || isCustom) {
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
        isCustom,
        customName
      });
    }

    // Se houver itens extras ou acima do limite, a solicitação de obra fica pendente de aprovação (Administrador, Sabrina ou Emily)
    const requiresAdminApproval = !isInternal && hasExtraItems;
    const initialStatus = requiresAdminApproval ? 'Aguardando aprovação' : 'Processando';
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
      const mat = await db.prepare('SELECT * FROM materials WHERE id = ?').get(analysis.materialId);
      if (!mat) continue;

      // Se requer aprovação do administrador, NÃO reserva estoque nem cria compras até aprovação
      if (requiresAdminApproval) {
        await db.prepare(`
          INSERT INTO material_request_items (
            request_id, material_id, quantity_requested, quantity_reserved, quantity_delivered,
            deficit, is_extra, budget_quantity, previously_requested, extra_quantity,
            is_custom, custom_name
          ) VALUES (?, ?, ?, 0, 0, 0, ?, ?, ?, ?, ?, ?)
        `).run(
          requestId, analysis.materialId, analysis.quantity,
          analysis.isExtra, analysis.budgetQuantity, analysis.previouslyRequested, analysis.extraQuantity,
          Boolean(analysis.isCustom), analysis.customName || null
        );

        processedItems.push({
          materialId: analysis.materialId,
          materialName: mat.name,
          materialUnit: mat.unit,
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

      // Fluxo normal (dentro do orçamento ou interno): Reserva e Déficit imediatos
      const available = Math.max(0, mat.stock_physical - mat.stock_reserved);
      const deficit = Math.max(0, analysis.quantity - available);
      const reservable = Math.min(analysis.quantity, available);

      const itemResult = await db.prepare(`
        INSERT INTO material_request_items (
          request_id, material_id, quantity_requested, quantity_reserved, quantity_delivered,
          deficit, is_extra, budget_quantity, previously_requested, extra_quantity,
          is_custom, custom_name
        ) VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        requestId, analysis.materialId, analysis.quantity, reservable, deficit,
        analysis.isExtra, analysis.budgetQuantity, analysis.previouslyRequested, analysis.extraQuantity,
        Boolean(analysis.isCustom), analysis.customName || null
      );

      const requestItemId = itemResult.lastInsertRowid;

      if (reservable > 0) {
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
          `Reserva de ${reservable} ${mat.unit} para obra ${project.name} (${reqCode})`
        );
        totalReservedItems++;
      }

      if (deficit > 0) {
        const nextPurchaseCount = (await db.prepare('SELECT COUNT(*) as count FROM purchases WHERE (is_hidden IS FALSE OR is_hidden IS NULL)').get())?.count + 1 || 1;
        const purchaseCode = `COM-2026-${String(nextPurchaseCount).padStart(4, '0')}`;

        const purResult = await db.prepare(`
          INSERT INTO purchases (code, project_id, request_item_id, material_id, quantity, supplier_id, unit_price, total_price, status, priority, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Solicitado', ?, ?)
        `).run(
          purchaseCode, projectId, requestItemId, analysis.materialId, deficit,
          mat.supplier_id, mat.reference_price,
          Number((deficit * mat.reference_price).toFixed(2)),
          priority === 'Urgente' ? 'Alta' : priority,
          `Demanda automática gerada por déficit na solicitação ${reqCode} da obra ${project.name}. Solicitado: ${analysis.quantity}, Disponível: ${available}, Comprar: ${deficit}.`
        );

        purchasesCreated.push({
          id: purResult.lastInsertRowid,
          code: purchaseCode,
          materialName: mat.name,
          deficitQuantity: deficit
        });
        totalDeficitItems++;
      }

      processedItems.push({
        materialId: analysis.materialId,
        materialName: mat.name,
        materialUnit: mat.unit,
        requestedQuantity: analysis.quantity,
        reservedQuantity: reservable,
        deficit,
        isExtra: analysis.isExtra,
        extraQuantity: analysis.extraQuantity,
        budgetQuantity: analysis.budgetQuantity,
        previouslyRequested: analysis.previouslyRequested
      });
    }

    // Se requereu aprovação do administrador:
    if (requiresAdminApproval) {
      // Dispara notificação urgente para o perfil Administrador Geral
      await db.prepare(`
        INSERT INTO notifications (role_target, title, message, type, link)
        VALUES ('admin', 'Materiais Extras - Aprovação de Administrador Necessária', ?, 'urgent', '/solicitacoes')
      `).run(`A obra ${project.name} (${reqCode}) teve uma solicitação contendo materiais adicionais ou acima do orçamento previsto. Aprovação de um administrador é necessária.`);

      // Log de auditoria
      await db.prepare(`
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, project_id, old_value, new_value, details)
        VALUES (?, 'SOLICITACAO_EXTRA_PENDENTE', 'SOLICITACAO', ?, ?, null, 'Aguardando aprovação', ?)
      `).run(
        userId, requestId, projectId,
        `Solicitação ${reqCode} com materiais adicionais / acima do orçamento gerada para a obra ${project.name}. Aguarda aprovação de um Administrador.`
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
        message: 'Solicitação registrada. Por conter materiais extras ou acima da cota orçada, aguarda aprovação de um Administrador.'
      };
    }

    // Define status final da solicitação (quando aprovada / dentro do orçamento)
    let requestStatus = 'Reservado';
    if (totalDeficitItems > 0 && totalReservedItems === 0) {
      requestStatus = 'Solicitado';
    } else if (totalDeficitItems > 0 && totalReservedItems > 0) {
      requestStatus = 'Parcialmente Atendido';
    } else {
      requestStatus = 'Reservado';
    }

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
   * Aprovação de solicitação com materiais extras por um Administrador (Requisito 2 e 4).
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
      const mat = await db.prepare('SELECT * FROM materials WHERE id = ?').get(it.material_id);
      if (!mat) continue;

      const qty = Number(it.quantity_requested);
      const available = Math.max(0, mat.stock_physical - mat.stock_reserved);
      const deficit = Math.max(0, qty - available);
      const reservable = Math.min(qty, available);

      await db.prepare(`
        UPDATE material_request_items 
        SET quantity_reserved = ?, deficit = ?
        WHERE id = ?
      `).run(reservable, deficit, it.id);

      if (reservable > 0) {
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
          `Reserva autorizada pelo Admin (${reservable} ${mat.unit}) para obra ${project.name} (${req.code})`
        );
        totalReserved++;
      }

      if (deficit > 0) {
        const nextPurchaseCount = (await db.prepare('SELECT COUNT(*) as count FROM purchases WHERE (is_hidden IS FALSE OR is_hidden IS NULL)').get())?.count + 1 || 1;
        const purchaseCode = `COM-2026-${String(nextPurchaseCount).padStart(4, '0')}`;

        await db.prepare(`
          INSERT INTO purchases (code, project_id, request_item_id, material_id, quantity, supplier_id, unit_price, total_price, status, priority, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Solicitado', ?, ?)
        `).run(
          purchaseCode, project.id, it.id, mat.id, deficit,
          mat.supplier_id, mat.reference_price,
          Number((deficit * mat.reference_price).toFixed(2)),
          req.priority === 'Urgente' ? 'Alta' : req.priority,
          `Compra automática por déficit em solicitação extra autorizada pelo Admin (${req.code}) para a obra ${project.name}.`
        );

        purchasesCreated.push({ code: purchaseCode, materialName: mat.name, deficitQuantity: deficit });
        totalDeficit++;
      }
    }

    let newStatus = 'Reservado';
    if (totalDeficit > 0 && totalReserved === 0) {
      newStatus = 'Solicitado';
    } else if (totalDeficit > 0 && totalReserved > 0) {
      newStatus = 'Parcialmente Atendido';
    }

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
   * 'Em separação' -> 'Separado' -> 'Entregue'
   * Quando 'Entregue': baixa efetivamente todos os itens do estoque físico e do reservado!
   */
  static async updateRequestStatus(requestId, newStatus, userId, notes = '') {
    const req = await db.prepare('SELECT * FROM material_requests WHERE id = ?').get(requestId);
    if (!req) throw new Error('Solicitação não encontrada');

    const items = await db.prepare('SELECT * FROM material_request_items WHERE request_id = ?').all(requestId);
    if (!items || items.length === 0) throw new Error('Itens da solicitação não encontrados');

    const project = await db.prepare('SELECT * FROM projects WHERE id = ?').get(req.project_id);

    if (newStatus === 'Entregue' && req.status !== 'Entregue') {
      for (const item of items) {
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
          `Retirada física confirmada pelo Almoxarifado para obra ${project.name} (${req.code})`
        );
      }

      // Registra log de auditoria
      await db.prepare(`
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, project_id, old_value, new_value, details)
        VALUES (?, 'ENTREGA_MATERIAL', 'SOLICITACAO', ?, ?, ?, 'Entregue', ?)
      `).run(
        userId, requestId, project.id, req.status,
        `Almoxarifado entregou ${items.length} material(is) da solicitação ${req.code} para a obra ${project.name}`
      );

      // Notifica Engenharia que foi entregue
      await db.prepare(`
        INSERT INTO notifications (user_id, role_target, title, message, type, link)
        VALUES (?, 'Engenharia', 'Material Entregue no Canteiro', ?, 'success', '/solicitacoes')
      `).run(req.requested_by, `Solicitação ${req.code} (${items.length} materiais) foi entregue no canteiro da obra ${project.name}.`);
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
    const nextDevCount = (await db.prepare('SELECT COUNT(*) as count FROM returns').get())?.count + 1 || 1;
    const devCode = `DEV-2026-${String(nextDevCount).padStart(4, '0')}`;

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

    const mat = await db.prepare('SELECT * FROM materials WHERE id = ?').get(purchase.material_id);
    const prevStock = mat.stock_physical;
    const newStock = prevStock + purchase.quantity;

    // Atualiza estoque físico
    await db.prepare(`
      UPDATE materials 
      SET stock_physical = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(newStock, mat.id);

    // Atualiza status do pedido de compra
    const now = new Date().toISOString().split('T')[0];
    await db.prepare(`
      UPDATE purchases 
      SET status = 'Recebido', received_date = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(now, purchaseId);

    // Registra movimentação de entrada no estoque
    await db.prepare(`
      INSERT INTO stock_movements (material_id, type, quantity, previous_stock, new_stock, project_id, reference_id, user_id, notes)
      VALUES (?, 'ENTRADA', ?, ?, ?, ?, ?, ?, ?)
    `).run(
      mat.id, purchase.quantity, prevStock, newStock,
      purchase.project_id, purchaseId, userId,
      `Recebimento de compra ${purchase.code}: +${purchase.quantity} ${mat.unit}`
    );

    // Auditoria
    await db.prepare(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, project_id, old_value, new_value, details)
      VALUES (?, 'RECEBIMENTO_COMPRA', 'COMPRA', ?, ?, 'Aguardando entrega', 'Recebido', ?)
    `).run(
      userId, purchaseId, purchase.project_id,
      `Recebimento de ${purchase.quantity} ${mat.unit} de ${mat.name} da compra ${purchase.code}. Estoque atualizado de ${prevStock} para ${newStock}.`
    );

    // Notifica Almoxarifado e Engenharia
    await db.prepare(`
      INSERT INTO notifications (role_target, title, message, type, link)
      VALUES ('Almoxarifado', 'Material de Compra Recebido', ?, 'success', '/estoque')
    `).run(`Chegaram ${purchase.quantity} ${mat.unit} de ${mat.name} (${purchase.code}). Já disponível no estoque físico.`);

    return {
      success: true,
      purchaseId,
      code: purchase.code,
      materialName: mat.name,
      quantityReceived: purchase.quantity,
      newStock: newStock
    };
  }
}
