import express from 'express';
import { AIAnalysisService } from '../services/aiService.js';
import { LearningService } from '../services/learningService.js';
import { db } from '../db/connection.js';

export const aiRouter = express.Router();

// Dispara análise por IA dos documentos técnicos e memorial descritivo
aiRouter.post('/analyze/:projectId', async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const { customText, userId } = req.body;

    // Atualiza status do projeto para 'Em análise pela IA'
    db.prepare("UPDATE projects SET status = 'Em análise pela IA', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(projectId);

    // Executa o serviço de análise estruturado (Seção 44 e 28)
    const analysisResult = await AIAnalysisService.analyzeProjectDocuments(projectId, customText);

    // Auditoria
    db.prepare(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, project_id, details)
      VALUES (?, 'ANALISE_IA', 'PROJETO', ?, ?, ?)
    `).run(
      userId || 1, projectId, projectId,
      `IA analisou documentos e identificou ${analysisResult.materials.length} materiais com sugestão inicial de R$ ${analysisResult.totalEstimatedMaterialsCost.toFixed(2)}`
    );

    // Dispara notificação para o Setor de Orçamento (Seção 35)
    db.prepare(`
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
aiRouter.get('/metrics', (req, res) => {
  try {
    const metrics = LearningService.getLearningMetrics();
    res.json(metrics);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Benchmarks históricos e contexto estruturado para enriquecer o Prompt do Agente de IA
aiRouter.get('/agent-context', (req, res) => {
  try {
    const context = LearningService.getAgentContext();
    res.json(context);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Lista todas as análises de IA de um projeto
aiRouter.get('/analyses/:projectId', (req, res) => {
  try {
    const projectId = req.params.projectId;
    const analyses = db.prepare('SELECT * FROM ai_analyses WHERE project_id = ? ORDER BY id DESC').all(projectId);
    
    const enriched = analyses.map(a => {
      const suggestions = db.prepare('SELECT * FROM ai_suggestions WHERE analysis_id = ?').all(a.id);
      return { ...a, suggestions };
    });

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
