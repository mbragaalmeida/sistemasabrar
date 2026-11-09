import express from 'express';
import { db } from '../db/connection.js';
import { LearningService } from '../services/learningService.js';
import { generateUniqueBudgetCode } from '../utils/codeGenerator.js';

export const budgetsRouter = express.Router();

// Busca orçamento de um projeto
budgetsRouter.get('/project/:projectId', async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const budget = await db.prepare('SELECT * FROM budgets WHERE project_id = ? AND (is_hidden IS FALSE OR is_hidden IS NULL)').get(projectId);
    if (!budget) return res.status(404).json({ error: 'Orçamento não encontrado' });

    const items = await db.prepare(`
      SELECT bi.*, m.code as material_code, m.brand, m.stock_physical, m.stock_reserved
      FROM budget_items bi
      LEFT JOIN materials m ON bi.material_id = m.id
      WHERE bi.budget_id = ?
      ORDER BY bi.id ASC
    `).all(budget.id);

    const services = await db.prepare('SELECT * FROM services WHERE budget_id = ? ORDER BY id ASC').all(budget.id);
    let equipment = [];
    try {
      equipment = await db.prepare('SELECT * FROM budget_equipment WHERE budget_id = ? ORDER BY id ASC').all(budget.id);
    } catch (e) {
      console.warn('Tabela budget_equipment consulta aviso:', e.message);
    }

    res.json({ ...budget, items, services, equipment });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Salva ou atualiza um orçamento completo (Materiais + Serviços + Máquinas/Equipamentos)
budgetsRouter.post('/save', async (req, res) => {
  try {
    const {
      projectId,
      materials = [],
      services = [],
      equipment = [],
      validityDays = 15,
      commercialTerms = '',
      userId = 1,
      userName = 'Orçamentista',
      totalEquipment: reqTotalEquipment,
      materialsMarginPercent = 0,
      laborMarginPercent = 0,
      discountAmount = 0,
      discount_amount = 0
    } = req.body;

    const finalDiscount = Number(discountAmount || discount_amount || 0);

    const project = await db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    if (!project) return res.status(404).json({ error: 'Projeto não encontrado' });

    // Sanitiza e normaliza itens de materiais para evitar colunas nulas ou falhas de constraint (ex: NOT NULL material_name)
    // REGRA CRÍTICA DEFINITIVA: NUNCA deduplicar ou descartar linhas que estejam no orçamento.
    // Todas as linhas cadastradas/importadas devem ser integralmente preservadas com seus respectivos subtotais.
    const validMaterials = [];
    for (const m of (materials || [])) {
      const rawName = String(m.materialName || m.material || '').trim();
      const materialId = m.materialId ? Number(m.materialId) : null;
      // Se a linha foi adicionada manualmente e ficou completamente sem nome e sem ID de material, descarta com segurança
      if (!rawName && !materialId) continue;

      const finalName = rawName || `Material #${materialId}`;
      const qty = Math.max(0.0001, Number(m.quantity) || 1);
      const unitPrice = Number(m.unitPrice !== undefined ? m.unitPrice : (m.unit_price || 0)) || 0;
      const sub = (m.subtotal !== undefined && m.subtotal !== null && Number(m.subtotal) > 0)
        ? Number(Number(m.subtotal).toFixed(2))
        : Number((qty * unitPrice).toFixed(2));

      validMaterials.push({
        ...m,
        materialId,
        materialName: finalName,
        quantity: qty,
        unit: (m.unit && String(m.unit).trim()) ? String(m.unit).trim() : 'und',
        unitPrice,
        subtotal: sub,
        originalSpreadsheetName: m.originalSpreadsheetName || m.original_spreadsheet_name || null
      });
    }

    // Calcula subtotais de materiais com base nos subtotais exatos dos itens sanitizados
    const totalMaterials = Number(validMaterials.reduce((acc, m) => acc + m.subtotal, 0).toFixed(2));
    
    // Sanitiza e normaliza serviços
    const validServices = [];
    let totalLabor = 0;
    let totalEquipmentServices = 0;
    let totalLogistics = 0;
    let totalTaxes = 0;
    let totalAdditional = 0;

    // Primeiro passo: processa serviços que NÃO são porcentagem
    const nonPercentServices = [];
    const percentServices = [];

    for (const s of (services || [])) {
      const desc = String(s.description || '').trim();
      if (!desc) continue;
      if (s.unit === '%' || s.unit === 'pct' || s.unit === 'porcentagem') {
        percentServices.push(s);
      } else {
        nonPercentServices.push(s);
      }
    }

    for (const s of nonPercentServices) {
      const desc = String(s.description || '').trim();
      const qty = Math.max(0.0001, Number(s.quantity) || 1);
      const unitPrice = Number(s.unitPrice !== undefined ? s.unitPrice : (s.unit_price || 0)) || 0;
      const sub = (s.subtotal !== undefined && s.subtotal !== null && Number(s.subtotal) > 0)
        ? Number(Number(s.subtotal).toFixed(2))
        : Number((qty * unitPrice).toFixed(2));
      validServices.push({
        ...s,
        category: s.category || 'MÃO DE OBRA',
        description: desc,
        quantity: qty,
        unit: s.unit || 'h',
        unitPrice,
        subtotal: sub,
        notes: s.notes || ''
      });

      if (s.category === 'MÃO DE OBRA') totalLabor += sub;
      else if (s.category === 'EQUIPAMENTO') totalEquipmentServices += sub;
      else if (s.category === 'LOGÍSTICA') totalLogistics += sub;
      else if (s.category === 'IMPOSTOS') totalTaxes += sub;
      else totalAdditional += sub;
    }

    // Busca orçamento existente
    let budget = await db.prepare('SELECT * FROM budgets WHERE project_id = ? AND (is_hidden IS FALSE OR is_hidden IS NULL)').get(projectId);
    
    // Calcula o total de equipamentos / faturamento direto
    const validEquipment = [];
    let equipmentTotal = 0;
    if (Array.isArray(equipment)) {
      for (const eq of equipment) {
        const desc = String(eq.description || eq.name || '').trim();
        if (!desc) continue;
        const uPrice = Number(eq.unitPrice !== undefined ? eq.unitPrice : (eq.unit_price || 0)) || 0;
        const q = Math.max(0.0001, Number(eq.quantity || 1));
        const sub = (eq.subtotal !== undefined && eq.subtotal !== null && Number(eq.subtotal) > 0)
          ? Number(Number(eq.subtotal).toFixed(2))
          : Number((q * uPrice).toFixed(2));
        validEquipment.push({
          ...eq,
          category: eq.category || 'Climatização',
          description: desc,
          brand: eq.brand || '',
          model: eq.model || '',
          quantity: q,
          unit: eq.unit || 'un',
          unitPrice: uPrice,
          subtotal: sub,
          notes: eq.notes || ''
        });
        equipmentTotal += sub;
      }
    } else if (reqTotalEquipment !== undefined) {
      equipmentTotal = Number(reqTotalEquipment);
    } else if (budget && budget.total_equipment) {
      equipmentTotal = Number(budget.total_equipment);
    }

    const finalTotalEquipment = Number(equipmentTotal.toFixed(2));

    // Base global para serviços percentuais (ex: remuneração comercial da Natália / comissão)
    const baseGlobalForPercent = totalMaterials + totalLabor + totalEquipmentServices + totalLogistics + totalTaxes + totalAdditional + finalTotalEquipment;

    for (const s of percentServices) {
      const desc = String(s.description || '').trim();
      const pct = (Number(s.unit_price) > 0 && Number(s.quantity) === 1) ? Number(s.unit_price) : (Number(s.quantity) || Number(s.unit_price) || 0);
      const sub = Number(((baseGlobalForPercent * pct) / 100).toFixed(2));
      const uPrice = Number(s.unit_price) > 0 ? Number(s.unit_price) : pct;

      validServices.push({
        ...s,
        category: s.category || 'MÃO DE OBRA',
        description: desc,
        quantity: Number(s.quantity) || 1,
        unit: '%',
        unitPrice: uPrice,
        subtotal: sub,
        notes: s.notes || `Calculado em ${pct}% sobre o valor global da obra (R$ ${baseGlobalForPercent.toFixed(2)})`
      });

      if (s.category === 'MÃO DE OBRA') totalLabor += sub;
      else if (s.category === 'EQUIPAMENTO') totalEquipmentServices += sub;
      else if (s.category === 'LOGÍSTICA') totalLogistics += sub;
      else if (s.category === 'IMPOSTOS') totalTaxes += sub;
      else totalAdditional += sub;
    }

    totalLabor = Number(totalLabor.toFixed(2));
    totalEquipmentServices = Number(totalEquipmentServices.toFixed(2));
    totalLogistics = Number(totalLogistics.toFixed(2));
    totalTaxes = Number(totalTaxes.toFixed(2));
    totalAdditional = Number(totalAdditional.toFixed(2));
    const totalServices = Number((totalLabor + totalEquipmentServices + totalLogistics + totalTaxes + totalAdditional).toFixed(2));

    const totalFinal = Number(Math.max(0, (totalMaterials + totalServices + finalTotalEquipment) - finalDiscount).toFixed(2));
    let budgetId;

    if (!budget) {
      const budgetCode = await generateUniqueBudgetCode(db);

      const insertBudget = db.prepare(`
        INSERT INTO budgets (
          project_id, code, status, total_materials, total_services,
          total_labor, total_equipment, total_logistics, total_taxes,
          total_additional, total_final, discount_amount, validity_days, commercial_terms,
          materials_margin_percent, labor_margin_percent
        ) VALUES (?, ?, 'Em revisão', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = await insertBudget.run(
        projectId, budgetCode, totalMaterials, totalServices,
        totalLabor, finalTotalEquipment, totalLogistics, totalTaxes,
        totalAdditional, totalFinal, finalDiscount, validityDays, commercialTerms,
        Number(materialsMarginPercent || 0), Number(laborMarginPercent || 0)
      );
      budgetId = result.lastInsertRowid;
    } else {
      budgetId = budget.id;
      await db.prepare(`
        UPDATE budgets SET
          total_materials = ?, total_services = ?, total_labor = ?,
          total_equipment = ?, total_logistics = ?, total_taxes = ?,
          total_additional = ?, total_final = ?, discount_amount = ?, validity_days = ?,
          commercial_terms = ?, materials_margin_percent = ?, labor_margin_percent = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        totalMaterials, totalServices, totalLabor,
        finalTotalEquipment, totalLogistics, totalTaxes,
        totalAdditional, totalFinal, finalDiscount, validityDays, commercialTerms,
        Number(materialsMarginPercent || 0), Number(laborMarginPercent || 0),
        budgetId
      );
    }

    // Salva itens da 3ª sessão: Máquinas & Equipamentos (Faturamento Direto)
    // Limpa equipamentos anteriores sempre que o array equipment for enviado (mesmo vazio)
    if (Array.isArray(equipment)) {
      await db.prepare('DELETE FROM budget_equipment WHERE budget_id = ?').run(budgetId);
      if (validEquipment.length > 0) {
        const insertEquipment = db.prepare(`
          INSERT INTO budget_equipment (
            budget_id, category, description, brand, model,
            quantity, unit, unit_price, subtotal, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const eq of validEquipment) {
          await insertEquipment.run(
            budgetId,
            eq.category,
            eq.description,
            eq.brand,
            eq.model,
            eq.quantity,
            eq.unit,
            eq.unitPrice,
            eq.subtotal,
            eq.notes
          );
        }
      }
    }

    // Atualiza totais na tabela de projetos
    await db.prepare(`
      UPDATE projects SET
        total_budget_materials = ?,
        total_budget_services = ?,
        total_budget_additional = ?,
        total_budget_final = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(totalMaterials, totalServices, totalLogistics + totalTaxes + totalAdditional, totalFinal, projectId);

    // Salva itens de materiais e registra correções humanas para aprendizado (Regra 27)
    // Limpa itens antigos deste orçamento
    await db.prepare('DELETE FROM budget_items WHERE budget_id = ?').run(budgetId);

    const insertItem = db.prepare(`
      INSERT INTO budget_items (
        budget_id, material_id, material_name, quantity, unit,
        unit_price, subtotal, ai_suggested_quantity, ai_reasoning, human_notes,
        original_spreadsheet_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const m of validMaterials) {
      await insertItem.run(
        budgetId,
        m.materialId || null,
        m.materialName,
        m.quantity,
        m.unit,
        m.unitPrice,
        m.subtotal,
        m.aiSuggestedQuantity || m.quantity,
        m.aiReasoning || null,
        m.humanNotes || null,
        m.originalSpreadsheetName || null
      );

      // Se o usuário alterou a quantidade sugerida pela IA, registra no log de auditoria (Seção 27 e 37)
      if (m.aiSuggestedQuantity && Number(m.aiSuggestedQuantity) !== Number(m.quantity)) {
        await db.prepare(`
          INSERT INTO audit_logs (user_id, user_name, action, entity_type, entity_id, project_id, old_value, new_value, details)
          VALUES (?, ?, 'AJUSTE_ORCAMENTO_HUMANO', 'ORCAMENTO', ?, ?, ?, ?, ?)
        `).run(
          userId, userName, budgetId, projectId,
          `${m.aiSuggestedQuantity} ${m.unit}`,
          `${m.quantity} ${m.unit}`,
          `Orçamentista ajustou quantidade do material '${m.materialName || m.material}' sugerida pela IA (${m.aiSuggestedQuantity}) para ${m.quantity} ${m.unit}. Nota: ${m.humanNotes || 'Ajuste técnico'}`
        );

        // Alimenta base preliminar de aprendizado
        if (m.materialId) {
          await LearningService.recordProjectFeedback(
            projectId, m.materialId, project.project_type,
            m.aiSuggestedQuantity, m.quantity, 0, 0, 0
          );
        }
      }
    }

    // Salva serviços complementares
    await db.prepare('DELETE FROM services WHERE budget_id = ?').run(budgetId);
    const insertService = db.prepare(`
      INSERT INTO services (budget_id, category, description, quantity, unit, unit_price, subtotal, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const s of validServices) {
      await insertService.run(
        budgetId, s.category || 'MÃO DE OBRA', s.description,
        s.quantity, s.unit || 'vb', s.unitPrice, s.subtotal, s.notes || null
      );
    }

    // Atualiza status do projeto para 'Orçamento finalizado' apenas se ainda não tiver sido aprovado ou iniciado
    const currentProj = await db.prepare('SELECT status FROM projects WHERE id = ?').get(projectId);
    if (currentProj && currentProj.status !== 'Em execução' && currentProj.status !== 'Aprovado') {
      await db.prepare("UPDATE projects SET status = 'Orçamento finalizado', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(projectId);
    }

    res.json({
      success: true,
      budgetId,
      totalMaterials,
      totalServices,
      totalFinal
    });
  } catch (err) {
    console.error('[Budget Save Error]', err);
    res.status(500).json({ error: err.message });
  }
});

// Marca orçamento como enviado ao cliente (Seção 10)
budgetsRouter.post('/:id/send-to-client', async (req, res) => {
  try {
    const budgetId = req.params.id;
    const { userId } = req.body;

    const budget = await db.prepare('SELECT * FROM budgets WHERE id = ?').get(budgetId);
    if (!budget) return res.status(404).json({ error: 'Orçamento não encontrado' });

    const now = new Date().toISOString();
    await db.prepare("UPDATE budgets SET sent_to_client_at = ?, status = 'Enviado ao cliente' WHERE id = ?").run(now, budgetId);
    await db.prepare("UPDATE projects SET status = 'Enviado ao cliente', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(budget.project_id);

    // Auditoria
    await db.prepare(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, project_id, details)
      VALUES (?, 'ENVIAR_PROPOSTA_CLIENTE', 'ORCAMENTO', ?, ?, ?)
    `).run(userId || 1, budgetId, budget.project_id, `Proposta comercial do orçamento ${budget.code} registrada como enviada ao cliente.`);

    res.json({ success: true, budgetId, sentAt: now });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Aprova orçamento (Desbloqueia início das obras e solicitações de materiais)
budgetsRouter.post('/:id/approve', async (req, res) => {
  try {
    const budgetId = req.params.id;
    const { userId, userName, responsibleEngineer, engineerId, engineerIds } = req.body;

    const budget = await db.prepare('SELECT * FROM budgets WHERE id = ?').get(budgetId);
    if (!budget) return res.status(404).json({ error: 'Orçamento não encontrado' });

    const project = await db.prepare('SELECT * FROM projects WHERE id = ?').get(budget.project_id);
    if (!project) return res.status(404).json({ error: 'Projeto associado não encontrado' });

    // Pilar 1 do Fluxo HVAC: Atribuição Obrigatória do Engenheiro Responsável ao aprovar obra externa
    let finalResponsible = responsibleEngineer || project.responsible_engineer;
    if (!finalResponsible && project.code !== 'SAB-INTERNO') {
      return res.status(400).json({
        error: 'Para aprovar o orçamento e iniciar a obra oficialmente, é obrigatório designar o Engenheiro Responsável pelo projeto.'
      });
    }

    const { scope_summary } = req.body;
    if (scope_summary && scope_summary.trim()) {
      await db.prepare('UPDATE projects SET scope_summary = ? WHERE id = ?').run(scope_summary.trim(), project.id);
    }

    // Se informou engenheiro, atualiza o projeto e a tabela de vínculos
    if (finalResponsible && finalResponsible !== project.responsible_engineer) {
      await db.prepare('UPDATE projects SET responsible_engineer = ? WHERE id = ?').run(finalResponsible, project.id);
    }

    // Vincula IDs de engenheiros em project_engineers se informados
    const allEngineerIds = Array.isArray(engineerIds) ? engineerIds : (engineerId ? [engineerId] : []);
    for (const engId of allEngineerIds) {
      const exists = await db.prepare('SELECT 1 FROM project_engineers WHERE project_id = ? AND user_id = ?').get(project.id, engId);
      if (!exists) {
        await db.prepare('INSERT INTO project_engineers (project_id, user_id) VALUES (?, ?)').run(project.id, engId);
      }
    }

    const now = new Date().toISOString();
    await db.prepare(`
      UPDATE budgets 
      SET status = 'Aprovado', approved_by = ?, approved_at = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(userId || 1, now, budgetId);

    // Atualiza status do projeto para 'Aprovado' e em seguida 'Em execução'
    await db.prepare("UPDATE projects SET status = 'Em execução', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(budget.project_id);

    // Notifica Engenharia que o projeto foi aprovado e solicitações estão liberadas
    await db.prepare(`
      INSERT INTO notifications (role_target, title, message, type, link)
      VALUES ('Engenharia', 'Projeto Aprovado - Obras Liberadas', ?, 'success', ?)
    `).run(`O projeto ${project.name} foi aprovado pela diretoria/cliente. Módulo de solicitações de materiais liberado.`, `/projetos/${budget.project_id}`);

    // Auditoria
    await db.prepare(`
      INSERT INTO audit_logs (user_id, user_name, action, entity_type, entity_id, project_id, old_value, new_value, details)
      VALUES (?, ?, 'APROVAR_ORCAMENTO', 'ORCAMENTO', ?, ?, 'Enviado ao cliente', 'Aprovado', ?)
    `).run(
      userId || 1, userName || 'Diretoria', budgetId, budget.project_id,
      `Orçamento ${budget.code} no valor total de R$ ${Number(budget.total_final).toFixed(2)} aprovado. Engenheiro: ${finalResponsible || 'Sabrar Interno'}. Obra em execução.`
    );

    res.json({ success: true, budgetId, status: 'Aprovado', projectStatus: 'Em execução', responsibleEngineer: finalResponsible });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Item 16: Marcar orçamento como perdido
budgetsRouter.post('/:id/mark-lost', async (req, res) => {
  try {
    const budgetId = req.params.id;
    const { reason, userId = 1, userName = 'Orçamentista' } = req.body;

    const budget = await db.prepare('SELECT * FROM budgets WHERE id = ?').get(budgetId);
    if (!budget) return res.status(404).json({ error: 'Orçamento não encontrado' });

    await db.prepare("UPDATE budgets SET status = 'Perdido', updated_at = NOW() WHERE id = ?").run(budgetId);
    await db.prepare("UPDATE projects SET status = 'Perdido', updated_at = NOW() WHERE id = ?").run(budget.project_id);

    await db.prepare(`
      INSERT INTO audit_logs (user_id, user_name, action, entity_type, entity_id, project_id, details)
      VALUES (?, ?, 'ORCAMENTO_PERDIDO', 'ORCAMENTO', ?, ?, ?)
    `).run(userId, userName, budgetId, budget.project_id, `Orçamento marcado como PERDIDO por ${userName}. Motivo: ${reason || 'Não informado'}`);

    res.json({ success: true, status: 'Perdido' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Item 8: Histórico de Versões do Orçamento (sem sobrescrever a versão original)
budgetsRouter.get('/project/:projectId/versions', async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const versions = await db.prepare(`
      SELECT * FROM budget_versions WHERE project_id = ? ORDER BY version_number ASC
    `).all(projectId);
    res.json(versions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

budgetsRouter.post('/project/:projectId/versions', async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const {
      justification,
      change_type = 'geral',
      total_materials = 0,
      total_services = 0,
      total_equipment = 0,
      total_final = 0,
      discount_amount = 0,
      items_snapshot = [],
      services_snapshot = [],
      equipment_snapshot = [],
      notes = '',
      userId = 1,
      userName = 'Orçamentista'
    } = req.body;

    if (!justification || !justification.trim()) {
      return res.status(400).json({ error: 'A justificativa da nova versão é obrigatória.' });
    }

    const budget = await db.prepare('SELECT id FROM budgets WHERE project_id = ?').get(projectId);
    const budgetId = budget?.id || null;

    // Próxima versão
    const maxRow = await db.prepare('SELECT COALESCE(MAX(version_number), 0) as max_v FROM budget_versions WHERE project_id = ?').get(projectId);
    const nextVersion = Number(maxRow?.max_v || 0) + 1;

    const insert = db.prepare(`
      INSERT INTO budget_versions (
        budget_id, project_id, version_number, justification, change_type,
        total_materials, total_services, total_equipment, total_final,
        discount_amount, items_snapshot, services_snapshot, equipment_snapshot,
        notes, created_by, created_by_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = await insert.run(
      budgetId,
      projectId,
      nextVersion,
      justification.trim(),
      change_type,
      Number(total_materials) || 0,
      Number(total_services) || 0,
      Number(total_equipment) || 0,
      Number(total_final) || 0,
      Number(discount_amount) || 0,
      JSON.stringify(items_snapshot),
      JSON.stringify(services_snapshot),
      JSON.stringify(equipment_snapshot),
      notes,
      userId,
      userName
    );

    // Sincroniza orçamento ativo e projeto com os totais da nova versão
    if (budgetId) {
      await db.prepare(`
        UPDATE budgets SET
          total_materials = COALESCE(?, total_materials),
          total_services = COALESCE(?, total_services),
          total_equipment = COALESCE(?, total_equipment),
          discount_amount = ?,
          total_final = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        Number(total_materials) || 0,
        Number(total_services) || 0,
        Number(total_equipment) || 0,
        Number(discount_amount) || 0,
        Number(total_final) || 0,
        budgetId
      );
    }

    await db.prepare(`
      UPDATE projects SET
        total_budget_materials = COALESCE(?, total_budget_materials),
        total_budget_services = COALESCE(?, total_budget_services),
        total_budget_final = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      Number(total_materials) || 0,
      Number(total_services) || 0,
      Number(total_final) || 0,
      projectId
    );

    // Auditoria
    await db.prepare(`
      INSERT INTO audit_logs (user_id, user_name, action, entity_type, entity_id, project_id, details)
      VALUES (?, ?, 'CRIAR_VERSAO_ORCAMENTO', 'ORCAMENTO', ?, ?, ?)
    `).run(userId, userName, budgetId, projectId, `Versão ${nextVersion} registrada. Tipo: ${change_type}. Justificativa: ${justification.trim()}`);

    res.status(201).json({ id: result.lastInsertRowid, version_number: nextVersion });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
