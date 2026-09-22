import { db } from '../db/connection.js';
import { SABRAR_BUDGET_AGENT_SYSTEM_PROMPT } from '../prompts/budgetAgentPrompt.js';

export class LearningService {
  /**
   * Obtém fatores históricos de ajuste calculados a partir de obras concluídas da SABRAR.
   * Regra 26: IA aprende com tipo de obra, características, consumo real e correções humanas.
   */
  static getHistoricalAdjustment(projectType, materialId) {
    try {
      const row = db.prepare(`
        SELECT 
          COUNT(*) as sample_count,
          AVG(CASE WHEN ai_suggested_qty > 0 THEN human_approved_qty / ai_suggested_qty ELSE 1.0 END) as avg_human_factor,
          AVG(CASE WHEN human_approved_qty > 0 THEN actual_consumed_qty / human_approved_qty ELSE 1.0 END) as avg_consumption_factor,
          AVG(variance_percent) as avg_variance_pct
        FROM historical_usage
        WHERE material_id = ? AND (project_type = ? OR project_type IS NULL)
      `).get(materialId, projectType);

      if (row && row.sample_count > 0 && row.avg_human_factor !== null) {
        // Fator combinado ponderando a correção humana e o consumo real histórico
        const combinedFactor = (row.avg_human_factor * 0.6) + (row.avg_consumption_factor * 0.4);
        return {
          hasHistory: true,
          sampleCount: row.sample_count,
          factor: Math.max(0.7, Math.min(1.3, Number(combinedFactor.toFixed(2)))),
          avgVariancePct: Number((row.avg_variance_pct || 0).toFixed(1)),
          explanation: `Ajustado com base em ${row.sample_count} obra(s) anterior(es) do tipo ${projectType} (fator de correção: ${Math.round((combinedFactor - 1) * 100)}%)`
        };
      }
    } catch (err) {
      console.error('[LearningService] Erro ao buscar ajuste histórico:', err);
    }

    return {
      hasHistory: false,
      sampleCount: 0,
      factor: 1.0,
      avgVariancePct: 0,
      explanation: 'Estimativa teórica padrão (primeira amostragem para esta tipologia)'
    };
  }

  /**
   * Registra ou atualiza um ciclo de aprendizado quando um projeto avança ou é concluído.
   * Regra 29: Não altera retrospectivamente dados de auditoria, apenas adiciona ou refina a base de aprendizado.
   */
  static recordProjectFeedback(projectId, materialId, projectType, aiQty, approvedQty, requestedQty, withdrawnQty, returnedQty) {
    const actualConsumed = Math.max(0, withdrawnQty - returnedQty);
    const varianceUnits = actualConsumed - approvedQty;
    const variancePercent = approvedQty > 0 ? (varianceUnits / approvedQty) * 100 : 0;
    const adjustmentFactor = aiQty > 0 ? Number((actualConsumed / aiQty).toFixed(2)) : 1.0;

    const existing = db.prepare(`
      SELECT id FROM historical_usage 
      WHERE project_id = ? AND material_id = ?
    `).get(projectId, materialId);

    if (existing) {
      db.prepare(`
        UPDATE historical_usage SET
          human_approved_qty = ?,
          total_requested_qty = ?,
          total_withdrawn_qty = ?,
          total_returned_qty = ?,
          actual_consumed_qty = ?,
          variance_units = ?,
          variance_percent = ?,
          learned_adjustment_factor = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        approvedQty, requestedQty, withdrawnQty, returnedQty,
        actualConsumed, varianceUnits, variancePercent,
        adjustmentFactor, existing.id
      );
    } else {
      db.prepare(`
        INSERT INTO historical_usage (
          project_id, material_id, project_type,
          ai_suggested_qty, human_approved_qty, total_requested_qty,
          total_withdrawn_qty, total_returned_qty, actual_consumed_qty,
          variance_units, variance_percent, learned_adjustment_factor
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        projectId, materialId, projectType,
        aiQty, approvedQty, requestedQty,
        withdrawnQty, returnedQty, actualConsumed,
        varianceUnits, variancePercent, adjustmentFactor
      );
    }
  }

  /**
   * Estatísticas globais do motor de IA para exibição no Dashboard e no Hub de Aprendizado.
   */
  static getLearningMetrics() {
    const totalSamples = db.prepare('SELECT COUNT(*) as total FROM historical_usage').get().total;
    const avgRow = db.prepare(`
      SELECT AVG(100 - ABS(variance_percent)) as accuracy 
      FROM historical_usage 
      WHERE actual_consumed_qty > 0
    `).get();

    const avgAccuracy = (totalSamples > 0 && avgRow && avgRow.accuracy !== null && avgRow.accuracy !== undefined)
      ? Number(Math.max(60, Math.min(99, avgRow.accuracy)).toFixed(1))
      : 0;

    const historyItems = db.prepare(`
      SELECT 
        h.*,
        m.name as material_name,
        m.code as material_code,
        m.unit as material_unit,
        p.name as project_name,
        p.code as project_code
      FROM historical_usage h
      JOIN materials m ON h.material_id = m.id
      JOIN projects p ON h.project_id = p.id
      ORDER BY h.id DESC
      LIMIT 20
    `).all();

    return {
      totalSamples,
      averageModelAccuracy: avgAccuracy,
      historicalCases: historyItems
    };
  }

  /**
   * Consolida métricas históricas reais e benchmarks empíricos
   * para enriquecer o prompt do Agente de IA com dados reais da SABRAR.
   */
  static getAgentContext() {
    const totalProjects = db.prepare("SELECT COUNT(*) as count FROM projects").get().count;
    const completedProjects = db.prepare("SELECT COUNT(*) as count FROM projects WHERE status IN ('Finalizado', 'Em execução')").get().count;
    const totalHistoricalRecords = db.prepare("SELECT COUNT(*) as count FROM historical_usage").get().count;

    const typologies = db.prepare(`
      SELECT 
        p.project_type,
        COUNT(DISTINCT p.id) as project_count,
        SUM(p.total_budget_final) as total_revenue,
        SUM(p.total_budget_materials) as total_materials_budget,
        AVG(hu.learned_adjustment_factor) as avg_adjustment_factor,
        AVG(hu.variance_percent) as avg_variance_pct
      FROM projects p
      LEFT JOIN historical_usage hu ON hu.project_id = p.id
      WHERE p.project_type IS NOT NULL
      GROUP BY p.project_type
      ORDER BY project_count DESC
    `).all();

    const topMaterialsCalibrated = db.prepare(`
      SELECT 
        m.id,
        m.code,
        m.name,
        m.category,
        m.unit,
        COUNT(hu.id) as occurrences,
        AVG(hu.learned_adjustment_factor) as avg_learned_factor,
        AVG(hu.variance_percent) as avg_variance_pct,
        SUM(hu.human_approved_qty) as total_budgeted_qty,
        SUM(hu.actual_consumed_qty) as total_actual_consumed_qty
      FROM historical_usage hu
      JOIN materials m ON hu.material_id = m.id
      GROUP BY hu.material_id
      ORDER BY occurrences DESC, total_actual_consumed_qty DESC
      LIMIT 15
    `).all();

    const globalMetrics = this.getLearningMetrics();

    // Gera prompt estruturado para o Agente de IA combinando o SYSTEM PROMPT oficial e os benchmarks reais
    const historicalLines = [];
    if (totalHistoricalRecords === 0) {
      historicalLines.push('Base de calibração histórica está 100% limpa (0 amostras registradas).');
      historicalLines.push('Aguardando importação em massa de dados reais de obras concluídas da SABRAR.');
      historicalLines.push('Até a inserção de novos dados reais, todos os cálculos devem seguir os métodos diretos e memoriais técnicos descritos nas Seções 1 a 22.');
    } else {
      historicalLines.push(`Base calibrada com ${completedProjects} obras iniciadas/concluídas e ${totalHistoricalRecords} amostras reais de consumo.`);
      historicalLines.push(`Acurácia média global do modelo: ${globalMetrics.averageModelAccuracy}%.\n`);

      historicalLines.push('## FATORES DE CALIBRAÇÃO POR TIPOLOGIA DE OBRA:');
      for (const t of typologies) {
        const avgFactor = t.avg_adjustment_factor ? Number(t.avg_adjustment_factor).toFixed(2) : '1.00';
        const avgVar = t.avg_variance_pct ? (t.avg_variance_pct > 0 ? `+${Number(t.avg_variance_pct).toFixed(1)}%` : `${Number(t.avg_variance_pct).toFixed(1)}%`) : '0.0%';
        historicalLines.push(`- **Tipologia ${t.project_type}** (${t.project_count} obra(s)): Fator médio histórico ${avgFactor}x | Variação média observada: ${avgVar}`);
      }
      historicalLines.push('');

      if (topMaterialsCalibrated.length > 0) {
        historicalLines.push('## DESVIOS TÍPICOS DE CONSUMO REAL EM CAMPO (BENCHMARKS SABRAR):');
        for (const m of topMaterialsCalibrated) {
          const f = Number(m.avg_learned_factor || 1.0).toFixed(2);
          const v = m.avg_variance_pct ? (m.avg_variance_pct > 0 ? `+${Number(m.avg_variance_pct).toFixed(1)}%` : `${Number(m.avg_variance_pct).toFixed(1)}%`) : '0.0%';
          historicalLines.push(`- **${m.name}** [${m.category || 'Geral'}] (${m.unit}): Fator ${f}x (desvio típico de campo: ${v} em ${m.occurrences} obra(s))`);
        }
      }
    }

    const historicalSummary = historicalLines.join('\n');
    const formattedPromptContext = `${SABRAR_BUDGET_AGENT_SYSTEM_PROMPT}\n\n${historicalSummary}`;

    return {
      systemPrompt: SABRAR_BUDGET_AGENT_SYSTEM_PROMPT,
      totalProjects,
      completedProjects,
      totalHistoricalRecords,
      averageModelAccuracy: globalMetrics.averageModelAccuracy,
      typologies,
      topMaterialsCalibrated,
      historicalSummary,
      formattedPromptContext
    };
  }
}
