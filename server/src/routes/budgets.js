import express from 'express';
import { db } from '../db/connection.js';
import { LearningService } from '../services/learningService.js';
import { generateUniqueBudgetCode } from '../utils/codeGenerator.js';

export const budgetsRouter = express.Router();

// Busca orçamento de um projeto
budgetsRouter.get('/project/:projectId', async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const budget = await db.prepare('SELECT * FROM budgets WHERE project_id = ?').get(projectId);
    if (!budget) return res.status(404).json({ error: 'Orçamento não encontrado' });

    const items = await db.prepare(`
      SELECT bi.*, m.code as material_code, m.brand, m.stock_physical, m.stock_reserved
      FROM budget_items bi
      LEFT JOIN materials m ON bi.material_id = m.id
      WHERE bi.budget_id = ?
      ORDER BY bi.id ASC
    `).all(budget.id);

    const services = await db.prepare('SELECT * FROM services WHERE budget_id = ? ORDER BY id ASC').all(budget.id);

    res.json({ ...budget, items, services });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Salva ou atualiza um orçamento completo (Materiais + Serviços + Custos adicionais)
budgetsRouter.post('/save', async (req, res) => {
  try {
    const {
      projectId,
      materials = [],
      services = [],
      validityDays = 15,
      commercialTerms = '',
      userId = 1,
      userName = 'Orçamentista'
    } = req.body;

    const project = await db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    if (!project) return res.status(404).json({ error: 'Projeto não encontrado' });

    // Calcula subtotais
    const totalMaterials = materials.reduce((acc, m) => acc + (Number(m.quantity) * Number(m.unitPrice)), 0);
    
    let totalLabor = 0;
    let totalEquipment = 0;
    let totalLogistics = 0;
    let totalTaxes = 0;
    let totalAdditional = 0;

    for (const s of services) {
      const sub = Number(s.quantity) * Number(s.unitPrice);
      if (s.category === 'MÃO DE OBRA') totalLabor += sub;
      else if (s.category === 'EQUIPAMENTO') totalEquipment += sub;
      else if (s.category === 'LOGÍSTICA') totalLogistics += sub;
      else if (s.category === 'IMPOSTOS') totalTaxes += sub;
      else totalAdditional += sub;
    }

    const totalServices = totalLabor + totalEquipment + totalLogistics + totalTaxes + totalAdditional;
    const totalFinal = totalMaterials + totalServices;

    // Busca ou cria o registro do orçamento
    let budget = await db.prepare('SELECT * FROM budgets WHERE project_id = ?').get(projectId);
    let budgetId;

    if (!budget) {
      const budgetCode = await generateUniqueBudgetCode(db);

      const insertBudget = db.prepare(`
        INSERT INTO budgets (
          project_id, code, status, total_materials, total_services,
          total_labor, total_equipment, total_logistics, total_taxes,
          total_additional, total_final, validity_days, commercial_terms
        ) VALUES (?, ?, 'Em revisão', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = await insertBudget.run(
        projectId, budgetCode, totalMaterials, totalServices,
        totalLabor, totalEquipment, totalLogistics, totalTaxes,
        totalAdditional, totalFinal, validityDays, commercialTerms
      );
      budgetId = result.lastInsertRowid;
    } else {
      budgetId = budget.id;
      await db.prepare(`
        UPDATE budgets SET
          total_materials = ?, total_services = ?, total_labor = ?,
          total_equipment = ?, total_logistics = ?, total_taxes = ?,
          total_additional = ?, total_final = ?, validity_days = ?,
          commercial_terms = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        totalMaterials, totalServices, totalLabor,
        totalEquipment, totalLogistics, totalTaxes,
        totalAdditional, totalFinal, validityDays, commercialTerms,
        budgetId
      );
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
    `).run(totalMaterials, totalLabor + totalEquipment, totalLogistics + totalTaxes + totalAdditional, totalFinal, projectId);

    // Salva itens de materiais e registra correções humanas para aprendizado (Regra 27)
    // Limpa itens antigos deste orçamento
    await db.prepare('DELETE FROM budget_items WHERE budget_id = ?').run(budgetId);

    const insertItem = db.prepare(`
      INSERT INTO budget_items (
        budget_id, material_id, material_name, quantity, unit,
        unit_price, subtotal, ai_suggested_quantity, ai_reasoning, human_notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const m of materials) {
      const sub = Number(m.quantity) * Number(m.unitPrice);
      await insertItem.run(
        budgetId, m.materialId || null, m.materialName || m.material,
        m.quantity, m.unit, m.unitPrice, sub,
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

    for (const s of services) {
      const sub = Number(s.quantity) * Number(s.unitPrice);
      await insertService.run(
        budgetId, s.category || 'MÃO DE OBRA', s.description,
        s.quantity || 1, s.unit || 'vb', s.unitPrice, sub, s.notes || null
      );
    }

    // Atualiza status do projeto para 'Orçamento finalizado'
    await db.prepare("UPDATE projects SET status = 'Orçamento finalizado', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(projectId);

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
