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
      laborMarginPercent = 0
    } = req.body;

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
        subtotal: sub
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

    for (const s of (services || [])) {
      const desc = String(s.description || '').trim();
      if (!desc) continue;
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

    totalLabor = Number(totalLabor.toFixed(2));
    totalEquipmentServices = Number(totalEquipmentServices.toFixed(2));
    totalLogistics = Number(totalLogistics.toFixed(2));
    totalTaxes = Number(totalTaxes.toFixed(2));
    totalAdditional = Number(totalAdditional.toFixed(2));
    const totalServices = Number((totalLabor + totalEquipmentServices + totalLogistics + totalTaxes + totalAdditional).toFixed(2));

    // Busca orçamento existente
    let budget = await db.prepare('SELECT * FROM budgets WHERE project_id = ? AND (is_hidden IS FALSE OR is_hidden IS NULL)').get(projectId);
    
    // Calcula o total de equipamentos / faturamento direto
    const validEquipment = [];
    let equipmentTotal = 0;
    if (equipment && equipment.length > 0) {
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
    const totalFinal = Number((totalMaterials + totalServices + finalTotalEquipment).toFixed(2));
    let budgetId;

    if (!budget) {
      const budgetCode = await generateUniqueBudgetCode(db);

      const insertBudget = db.prepare(`
        INSERT INTO budgets (
          project_id, code, status, total_materials, total_services,
          total_labor, total_equipment, total_logistics, total_taxes,
          total_additional, total_final, validity_days, commercial_terms,
          materials_margin_percent, labor_margin_percent
        ) VALUES (?, ?, 'Em revisão', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = await insertBudget.run(
        projectId, budgetCode, totalMaterials, totalServices,
        totalLabor, finalTotalEquipment, totalLogistics, totalTaxes,
        totalAdditional, totalFinal, validityDays, commercialTerms,
        Number(materialsMarginPercent || 0), Number(laborMarginPercent || 0)
      );
      budgetId = result.lastInsertRowid;
    } else {
      budgetId = budget.id;
      await db.prepare(`
        UPDATE budgets SET
          total_materials = ?, total_services = ?, total_labor = ?,
          total_equipment = ?, total_logistics = ?, total_taxes = ?,
          total_additional = ?, total_final = ?, validity_days = ?,
          commercial_terms = ?, materials_margin_percent = ?, labor_margin_percent = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        totalMaterials, totalServices, totalLabor,
        finalTotalEquipment, totalLogistics, totalTaxes,
        totalAdditional, totalFinal, validityDays, commercialTerms,
        Number(materialsMarginPercent || 0), Number(laborMarginPercent || 0),
        budgetId
      );
    }

    // Salva itens da 3ª sessão: Máquinas & Equipamentos (Faturamento Direto)
    if (validEquipment && validEquipment.length > 0) {
      await db.prepare('DELETE FROM budget_equipment WHERE budget_id = ?').run(budgetId);
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
        unit_price, subtotal, ai_suggested_quantity, ai_reasoning, human_notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        m.humanNotes || null
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
    const { userId, userName } = req.body;

    const budget = await db.prepare('SELECT * FROM budgets WHERE id = ?').get(budgetId);
    if (!budget) return res.status(404).json({ error: 'Orçamento não encontrado' });

    const now = new Date().toISOString();
    await db.prepare(`
      UPDATE budgets 
      SET status = 'Aprovado', approved_by = ?, approved_at = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(userId || 1, now, budgetId);

    // Atualiza status do projeto para 'Aprovado' e em seguida 'Em execução'
    await db.prepare("UPDATE projects SET status = 'Em execução', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(budget.project_id);

    // Notifica Engenharia que o projeto foi aprovado e solicitações estão liberadas
    const project = await db.prepare('SELECT name FROM projects WHERE id = ?').get(budget.project_id);
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
      `Orçamento ${budget.code} no valor total de R$ ${Number(budget.total_final).toFixed(2)} aprovado. Obra em execução.`
    );

    res.json({ success: true, budgetId, status: 'Aprovado', projectStatus: 'Em execução' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
