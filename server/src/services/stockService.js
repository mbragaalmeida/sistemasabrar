import { db } from '../db/connection.js';
import { LearningService } from './learningService.js';

export class StockService {
  /**
   * Retorna os níveis de estoque calculados com a regra:
   * Estoque Disponível = Estoque Físico - Estoque Reservado
   */
  static getMaterialStock(materialId) {
    const mat = db.prepare('SELECT * FROM materials WHERE id = ?').get(materialId);
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
  static recordSimplifiedEntry(materialId, quantity, userId, notes = '') {
    const qty = Number(quantity);
    if (qty <= 0) throw new Error('Quantidade deve ser superior a zero');

    const mat = db.prepare('SELECT * FROM materials WHERE id = ?').get(materialId);
    if (!mat) throw new Error('Material não encontrado');

    const prevStock = mat.stock_physical;
    const newStock = prevStock + qty;

    db.prepare(`
      UPDATE materials 
      SET stock_physical = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(newStock, materialId);

    // Registra a movimentação
    db.prepare(`
      INSERT INTO stock_movements (material_id, type, quantity, previous_stock, new_stock, user_id, notes)
      VALUES (?, 'ENTRADA', ?, ?, ?, ?, ?)
    `).run(materialId, qty, prevStock, newStock, userId, notes || 'Entrada simplificada de estoque');

    // Registra log de auditoria
    db.prepare(`
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
   * Processa uma solicitação de material emitida pela Engenharia (Seções 14, 15, 16).
   * Se houver estoque disponível: Reserva total e status = 'Reservado'.
   * Se houver déficit: Reserva parcial do disponível, calcula déficit e gera Demanda de Compra automática!
   */
  /**
   * Processa solicitação de material (individual ou em lote) emitida pela Engenharia.
   * - Se houver estoque disponível: Reserva total e gera movimentação de reserva.
   * - Se houver déficit: Reserva o disponível e gera Demanda de Compra automática para o setor de Compras!
   */
  static createMaterialRequest(projectId, materialId, requestedQty, priority, userId, notes = '') {
    return StockService.createBatchMaterialRequest(
      projectId,
      [{ materialId, quantity: requestedQty }],
      priority,
      userId,
      notes
    );
  }

  /**
   * Processa uma lista de materiais de uma obra em lote (ou orçamento completo).
   */
  static createBatchMaterialRequest(projectId, items, priority, userId, notes = '') {
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('Lista de materiais solicitados não pode estar vazia');
    }

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    if (!project) throw new Error('Projeto não encontrado');

    const nextReqCount = db.prepare('SELECT COUNT(*) as count FROM material_requests').get().count + 1;
    const reqCode = `SOL-2026-${String(nextReqCount).padStart(4, '0')}`;

    // Cria a solicitação provisória
    const reqResult = db.prepare(`
      INSERT INTO material_requests (code, project_id, requested_by, priority, status, notes)
      VALUES (?, ?, ?, ?, 'Processando', ?)
    `).run(reqCode, projectId, userId, priority || 'Média', notes);

    const requestId = reqResult.lastInsertRowid;

    let totalReservedItems = 0;
    let totalDeficitItems = 0;
    const processedItems = [];
    const purchasesCreated = [];

    for (const item of items) {
      const materialId = item.materialId || item.material_id;
      const qty = Number(item.quantity || item.quantity_requested);
      if (!materialId || qty <= 0) continue;

      const mat = db.prepare('SELECT * FROM materials WHERE id = ?').get(materialId);
      if (!mat) continue;

      const available = Math.max(0, mat.stock_physical - mat.stock_reserved);
      const deficit = Math.max(0, qty - available);
      const reservable = Math.min(qty, available);

      const itemResult = db.prepare(`
        INSERT INTO material_request_items (request_id, material_id, quantity_requested, quantity_reserved, quantity_delivered, deficit)
        VALUES (?, ?, ?, ?, 0, ?)
      `).run(requestId, materialId, qty, reservable, deficit);

      const requestItemId = itemResult.lastInsertRowid;

      if (reservable > 0) {
        db.prepare(`
          UPDATE materials 
          SET stock_reserved = stock_reserved + ?, updated_at = CURRENT_TIMESTAMP 
          WHERE id = ?
        `).run(reservable, materialId);

        db.prepare(`
          INSERT INTO stock_movements (material_id, type, quantity, previous_stock, new_stock, project_id, reference_id, user_id, notes)
          VALUES (?, 'RESERVA', ?, ?, ?, ?, ?, ?, ?)
        `).run(
          materialId, reservable, mat.stock_physical, mat.stock_physical,
          projectId, requestId, userId,
          `Reserva de ${reservable} ${mat.unit} para obra ${project.name} (${reqCode})`
        );
        totalReservedItems++;
      }

      if (deficit > 0) {
        const nextPurchaseCount = db.prepare('SELECT COUNT(*) as count FROM purchases').get().count + 1;
        const purchaseCode = `COM-2026-${String(nextPurchaseCount).padStart(4, '0')}`;

        const purResult = db.prepare(`
          INSERT INTO purchases (code, project_id, request_item_id, material_id, quantity, supplier_id, unit_price, total_price, status, priority, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Solicitado', ?, ?)
        `).run(
          purchaseCode, projectId, requestItemId, materialId, deficit,
          mat.supplier_id, mat.reference_price,
          Number((deficit * mat.reference_price).toFixed(2)),
          priority === 'Urgente' ? 'Alta' : priority,
          `Demanda automática gerada por déficit na solicitação ${reqCode} da obra ${project.name}. Solicitado: ${qty}, Disponível: ${available}, Comprar: ${deficit}.`
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
        materialId,
        materialName: mat.name,
        materialUnit: mat.unit,
        requestedQuantity: qty,
        reservedQuantity: reservable,
        deficit
      });
    }

    // Define status da solicitação
    let requestStatus = 'Reservado';
    if (totalDeficitItems > 0 && totalReservedItems === 0) {
      requestStatus = 'Solicitado';
    } else if (totalDeficitItems > 0 && totalReservedItems > 0) {
      requestStatus = 'Parcialmente Atendido';
    } else {
      requestStatus = 'Reservado';
    }

    db.prepare('UPDATE material_requests SET status = ? WHERE id = ?').run(requestStatus, requestId);

    // Dispara notificações
    if (totalReservedItems > 0) {
      db.prepare(`
        INSERT INTO notifications (role_target, title, message, type, link)
        VALUES ('Almoxarifado', 'Nova Solicitação para Separação', ?, 'info', '/estoque')
      `).run(`Engenharia solicitou ${processedItems.length} materiais para a obra ${project.name} (${reqCode}). ${totalReservedItems} item(ns) reservados para separação.`);
    }

    if (totalDeficitItems > 0) {
      db.prepare(`
        INSERT INTO notifications (role_target, title, message, type, link)
        VALUES ('Compras', 'Déficit de Estoque - Demanda Gerada', ?, 'urgent', '/compras')
      `).run(`Obra ${project.name} (${reqCode}): ${totalDeficitItems} materiais sem estoque suficiente geraram demandas de compra.`);
    }

    // Log de auditoria
    db.prepare(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, project_id, old_value, new_value, details)
      VALUES (?, 'CRIAR_SOLICITACAO', 'SOLICITACAO', ?, ?, null, ?, ?)
    `).run(
      userId, requestId, projectId, requestStatus,
      `Solicitação ${reqCode} criada com ${processedItems.length} materiais (${totalReservedItems} reservados no estoque, ${totalDeficitItems} em déficit enviados para compras).`
    );

    const firstProcessed = processedItems[0] || {};
    return {
      requestId,
      code: reqCode,
      status: requestStatus,
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
   * Almoxarifado altera status de atendimento:
   * 'Em separação' -> 'Separado' -> 'Entregue'
   * Quando 'Entregue': baixa efetivamente todos os itens do estoque físico e do reservado!
   */
  static updateRequestStatus(requestId, newStatus, userId, notes = '') {
    const req = db.prepare('SELECT * FROM material_requests WHERE id = ?').get(requestId);
    if (!req) throw new Error('Solicitação não encontrada');

    const items = db.prepare('SELECT * FROM material_request_items WHERE request_id = ?').all(requestId);
    if (!items || items.length === 0) throw new Error('Itens da solicitação não encontrados');

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.project_id);

    if (newStatus === 'Entregue' && req.status !== 'Entregue') {
      for (const item of items) {
        const mat = db.prepare('SELECT * FROM materials WHERE id = ?').get(item.material_id);
        if (!mat) continue;

        const deliveredQty = item.quantity_reserved > 0 ? item.quantity_reserved : item.quantity_requested;
        const prevStock = mat.stock_physical;
        const newStock = Math.max(0, prevStock - deliveredQty);
        const newReserved = Math.max(0, mat.stock_reserved - deliveredQty);

        // Baixa no estoque físico e reservado do material
        db.prepare(`
          UPDATE materials 
          SET stock_physical = ?, stock_reserved = ?, updated_at = CURRENT_TIMESTAMP 
          WHERE id = ?
        `).run(newStock, newReserved, mat.id);

        // Atualiza o item da solicitação
        db.prepare(`
          UPDATE material_request_items 
          SET quantity_delivered = ?, quantity_reserved = 0 
          WHERE id = ?
        `).run(deliveredQty, item.id);

        // Registra movimentação de saída definitiva para a obra
        db.prepare(`
          INSERT INTO stock_movements (material_id, type, quantity, previous_stock, new_stock, project_id, reference_id, user_id, notes)
          VALUES (?, 'SAIDA_OBRA', ?, ?, ?, ?, ?, ?, ?)
        `).run(
          mat.id, deliveredQty, prevStock, newStock,
          project.id, requestId, userId,
          `Retirada física confirmada pelo Almoxarifado para obra ${project.name} (${req.code})`
        );
      }

      // Registra log de auditoria
      db.prepare(`
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, project_id, old_value, new_value, details)
        VALUES (?, 'ENTREGA_MATERIAL', 'SOLICITACAO', ?, ?, ?, 'Entregue', ?)
      `).run(
        userId, requestId, project.id, req.status,
        `Almoxarifado entregou ${items.length} material(is) da solicitação ${req.code} para a obra ${project.name}`
      );

      // Notifica Engenharia que foi entregue
      db.prepare(`
        INSERT INTO notifications (user_id, role_target, title, message, type, link)
        VALUES (?, 'Engenharia', 'Material Entregue no Canteiro', ?, 'success', '/solicitacoes')
      `).run(req.requested_by, `Solicitação ${req.code} (${items.length} materiais) foi entregue no canteiro da obra ${project.name}.`);
    }

    db.prepare(`
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
  static recordMaterialReturn(projectId, materialId, returnedQty, userId, reason = '') {
    const qty = Number(returnedQty);
    if (qty <= 0) throw new Error('Quantidade devolvida deve ser maior que zero');

    const mat = db.prepare('SELECT * FROM materials WHERE id = ?').get(materialId);
    if (!mat) throw new Error('Material não encontrado');

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    if (!project) throw new Error('Projeto não encontrado');

    const prevStock = mat.stock_physical;
    const newStock = prevStock + qty;

    // Incrementa estoque físico
    db.prepare(`
      UPDATE materials 
      SET stock_physical = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(newStock, materialId);

    // Gera código de devolução
    const nextDevCount = db.prepare('SELECT COUNT(*) as count FROM returns').get().count + 1;
    const devCode = `DEV-2026-${String(nextDevCount).padStart(4, '0')}`;

    // Cria registro de devolução
    const devResult = db.prepare(`
      INSERT INTO returns (code, project_id, material_id, quantity, received_by, reason)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(devCode, projectId, materialId, qty, userId, reason);

    const returnId = devResult.lastInsertRowid;

    // Movimentação de estoque do tipo DEVOLUCAO
    db.prepare(`
      INSERT INTO stock_movements (material_id, type, quantity, previous_stock, new_stock, project_id, reference_id, user_id, notes)
      VALUES (?, 'DEVOLUCAO', ?, ?, ?, ?, ?, ?, ?)
    `).run(
      materialId, qty, prevStock, newStock,
      projectId, returnId, userId,
      `Devolução de ${qty} ${mat.unit} da obra ${project.name} (${devCode}). ${reason}`
    );

    // Auditoria
    db.prepare(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, project_id, old_value, new_value, details)
      VALUES (?, 'DEVOLUCAO_MATERIAL', 'DEVOLUCAO', ?, ?, '0', ?, ?)
    `).run(
      userId, returnId, projectId, `${qty} ${mat.unit}`,
      `Almoxarifado registrou devolução de ${qty} ${mat.unit} de ${mat.name} da obra ${project.name}. Estoque atualizado para ${newStock} ${mat.unit}.`
    );

    // Recalcula dados de consumo real para o projeto e alimenta a base de aprendizado (Seção 20 e 24)
    const withdrawalTotal = db.prepare(`
      SELECT SUM(quantity) as total 
      FROM stock_movements 
      WHERE project_id = ? AND material_id = ? AND type = 'SAIDA_OBRA'
    `).get(projectId, materialId)?.total || 0;

    const returnTotal = db.prepare(`
      SELECT SUM(quantity) as total 
      FROM returns 
      WHERE project_id = ? AND material_id = ?
    `).get(projectId, materialId)?.total || 0;

    const actualConsumed = Math.max(0, withdrawalTotal - returnTotal);

    // Atualiza base histórica se existir item de orçamento correspondente
    const budgetItem = db.prepare(`
      SELECT bi.* FROM budget_items bi
      JOIN budgets b ON bi.budget_id = b.id
      WHERE b.project_id = ? AND bi.material_id = ?
    `).get(projectId, materialId);

    if (budgetItem) {
      LearningService.recordProjectFeedback(
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
  static confirmPurchaseReceipt(purchaseId, userId, notes = '') {
    const purchase = db.prepare('SELECT * FROM purchases WHERE id = ?').get(purchaseId);
    if (!purchase) throw new Error('Pedido de compra não encontrado');

    if (purchase.status === 'Recebido') {
      throw new Error('Este pedido já foi marcado como recebido');
    }

    const mat = db.prepare('SELECT * FROM materials WHERE id = ?').get(purchase.material_id);
    const prevStock = mat.stock_physical;
    const newStock = prevStock + purchase.quantity;

    // Atualiza estoque físico
    db.prepare(`
      UPDATE materials 
      SET stock_physical = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(newStock, mat.id);

    // Atualiza status do pedido de compra
    const now = new Date().toISOString().split('T')[0];
    db.prepare(`
      UPDATE purchases 
      SET status = 'Recebido', received_date = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(now, purchaseId);

    // Registra movimentação de entrada no estoque
    db.prepare(`
      INSERT INTO stock_movements (material_id, type, quantity, previous_stock, new_stock, project_id, reference_id, user_id, notes)
      VALUES (?, 'ENTRADA', ?, ?, ?, ?, ?, ?, ?)
    `).run(
      mat.id, purchase.quantity, prevStock, newStock,
      purchase.project_id, purchaseId, userId,
      `Recebimento de compra ${purchase.code}: +${purchase.quantity} ${mat.unit}`
    );

    // Auditoria
    db.prepare(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, project_id, old_value, new_value, details)
      VALUES (?, 'RECEBIMENTO_COMPRA', 'COMPRA', ?, ?, 'Aguardando entrega', 'Recebido', ?)
    `).run(
      userId, purchaseId, purchase.project_id,
      `Recebimento de ${purchase.quantity} ${mat.unit} de ${mat.name} da compra ${purchase.code}. Estoque atualizado de ${prevStock} para ${newStock}.`
    );

    // Notifica Almoxarifado e Engenharia
    db.prepare(`
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
