import express from 'express';
import { AIAnalysisService } from '../services/aiService.js';
import { LearningService } from '../services/learningService.js';
import { BudgetLLMClient } from '../services/llmClient.js';
import { db } from '../db/connection.js';
import { SABRAR_ECONOMIC_BASE_ITEMS } from '../services/sabrarEconomicBase.js';

export const aiRouter = express.Router();

// Diagnóstico de conectividade e status do Agente de IA (sem expor credenciais)
aiRouter.get('/status', async (req, res) => {
  try {
    const status = await BudgetLLMClient.testConnection(req.query.model);
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Lista modelos Gemini disponíveis para a chave configurada
aiRouter.get('/models', async (req, res) => {
  try {
    const models = await BudgetLLMClient.listGeminiModels();
    res.json(models);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Dispara análise por IA dos documentos técnicos e memorial descritivo
aiRouter.post('/analyze/:projectId', async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const { customText, userId } = req.body;

    // Atualiza status do projeto para 'Em análise pela IA'
    await db.prepare("UPDATE projects SET status = 'Em análise pela IA', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(projectId);

    // Executa o serviço de análise estruturado (Seção 44 e 28)
    const analysisResult = await AIAnalysisService.analyzeProjectDocuments(projectId, customText);

    // Auditoria
    await db.prepare(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, project_id, details)
      VALUES (?, 'ANALISE_IA', 'PROJETO', ?, ?, ?)
    `).run(
      userId || 1, projectId, projectId,
      `IA analisou documentos e identificou ${analysisResult.materials.length} materiais com sugestão inicial de R$ ${Number(analysisResult.totalEstimatedMaterialsCost).toFixed(2)}`
    );

    // Dispara notificação para o Setor de Orçamento (Seção 35)
    await db.prepare(`
      INSERT INTO notifications (role_target, title, message, type, link)
      VALUES ('Setor de orçamento', 'IA Finalizou Análise Técnica', ?, 'info', ?)
    `).run(
      `A IA gerou a sugestão inicial de materiais para o projeto ${analysisResult.projectName}. Aguardando revisão humana.`,
      `/projetos/${projectId}`
    );

    res.json(analysisResult);
  } catch (err) {
    console.error('[AI Route Error]', err);
    res.status(500).json({ error: err.message });
  }
});

// Métricas do motor de aprendizado contínuo da IA
aiRouter.get('/metrics', async (req, res) => {
  try {
    const metrics = await LearningService.getLearningMetrics();
    res.json(metrics);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// Benchmarks históricos e contexto estruturado para enriquecer o Prompt do Agente de IA
aiRouter.get('/agent-context', async (req, res) => {
  try {
    const context = await LearningService.getAgentContext();
    context.economicBase = {
      totalRecords: SABRAR_ECONOMIC_BASE_ITEMS.length,
      categories: [...new Set(SABRAR_ECONOMIC_BASE_ITEMS.map(i => i.category))],
      contexts: [...new Set(SABRAR_ECONOMIC_BASE_ITEMS.map(i => i.context))]
    };
    res.json(context);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Consulta registros da Base Econômica Oficial Sabrar
aiRouter.get('/economic-base', (req, res) => {
  try {
    const { category, context, q } = req.query;
    let items = SABRAR_ECONOMIC_BASE_ITEMS;
    if (category) items = items.filter(i => i.category === category);
    if (context) items = items.filter(i => i.context === context);
    if (q) {
      const qNorm = q.toLowerCase();
      items = items.filter(i => i.item.toLowerCase().includes(qNorm));
    }
    res.json({
      total: items.length,
      items: items.slice(0, 100)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Lista todas as análises de IA de um projeto
aiRouter.get('/analyses/:projectId', async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const analyses = await db.prepare('SELECT * FROM ai_analyses WHERE project_id = ? ORDER BY id DESC').all(projectId);
    
    const enriched = await Promise.all(analyses.map(async a => {
      const suggestions = await db.prepare('SELECT * FROM ai_suggestions WHERE analysis_id = ?').all(a.id);
      return { ...a, suggestions };
    }));

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
