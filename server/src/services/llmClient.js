/**
 * CLIENTE OFICIAL DE INTEGRAÇÃO COM MODELOS DE IA (LLM/VISÃO)
 * 
 * Permite que o Sistema SABRAR envie o Prompt Oficial do Agente,
 * documentos de projeto e memoriais para modelos de IA modernos (Gemini / OpenAI),
 * garantindo saída estruturada (JSON Schema) e validação técnica determinística.
 */

import fs from 'node:fs';
import { SABRAR_BUDGET_AGENT_SYSTEM_PROMPT, buildAgentContextPrompt } from '../prompts/budgetAgentPrompt.js';

// Tenta carregar variáveis de .env local se existirem (Node 20+)
try {
  if (typeof process.loadEnvFile === 'function') {
    if (fs.existsSync('.env')) process.loadEnvFile('.env');
    else if (fs.existsSync('server/.env')) process.loadEnvFile('server/.env');
    else if (fs.existsSync('../.env')) process.loadEnvFile('../.env');
  }
} catch (_) {}

export class BudgetLLMClient {
  /**
   * Identifica provedores de IA configurados no ambiente
   */
  static getProviderConfig() {
    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || null;
    const openaiKey = process.env.OPENAI_API_KEY || null;

    if (geminiKey) {
      return {
        provider: 'gemini',
        apiKey: geminiKey,
        model: process.env.GEMINI_MODEL || 'gemini-2.5-flash'
      };
    }

    if (openaiKey) {
      return {
        provider: 'openai',
        apiKey: openaiKey,
        model: process.env.OPENAI_MODEL || 'gpt-4o'
      };
    }

    return {
      provider: 'deterministic_fallback',
      apiKey: null,
      model: 'sabrar-deterministic-v2'
    };
  }

  /**
   * Executa a análise do projeto através do LLM (ou fallback determinístico se sem chave)
   */
  static async analyzeProject({ project, documentsContent, catalogSample = [], historicalContext = '' }) {
    const config = this.getProviderConfig();
    console.log(`[BudgetLLMClient] Executando motor de análise com provedor: ${config.provider} (${config.model})`);

    const fullPrompt = buildAgentContextPrompt(project, documentsContent, catalogSample, historicalContext);

    if (config.provider === 'gemini') {
      try {
        return await this.callGemini(config, fullPrompt);
      } catch (err) {
        console.warn('[BudgetLLMClient] Falha na chamada ao Gemini, recorrendo ao motor determinístico:', err.message);
      }
    } else if (config.provider === 'openai') {
      try {
        return await this.callOpenAI(config, fullPrompt);
      } catch (err) {
        console.warn('[BudgetLLMClient] Falha na chamada à OpenAI, recorrendo ao motor determinístico:', err.message);
      }
    }

    // Sem chave configurada ou fallback
    return null;
  }

  /**
   * Chamada à API Google Gemini com saída JSON estruturada
   */
  static async callGemini(config, fullPrompt) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`;

    const payload = {
      contents: [
        {
          role: 'user',
          parts: [{ text: fullPrompt }]
        }
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1
      }
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini API Error (${res.status}): ${errText}`);
    }

    const data = await res.json();
    const rawJson = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawJson) throw new Error('Resposta vazia da API do Gemini');

    return JSON.parse(rawJson);
  }

  /**
   * Chamada à API OpenAI com JSON Mode
   */
  static async callOpenAI(config, fullPrompt) {
    const url = 'https://api.openai.com/v1/chat/completions';

    const payload = {
      model: config.model,
      messages: [
        { role: 'system', content: SABRAR_BUDGET_AGENT_SYSTEM_PROMPT },
        { role: 'user', content: fullPrompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenAI API Error (${res.status}): ${errText}`);
    }

    const data = await res.json();
    const rawJson = data?.choices?.[0]?.message?.content;
    if (!rawJson) throw new Error('Resposta vazia da API da OpenAI');

    return JSON.parse(rawJson);
  }
}
