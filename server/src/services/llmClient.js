/**
 * CLIENTE OFICIAL DE INTEGRAÇÃO COM MODELOS DE IA (LLM/VISÃO)
 * 
 * Permite que o Sistema SABRAR envie o Prompt Oficial do Agente,
 * documentos de projeto (texto por página com coordenadas + binário PDF multimodal)
 * e memoriais para modelos de IA modernos (Gemini / OpenAI),
 * garantindo saída estruturada validada por Schema e separando interpretação de cálculo.
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

export const LLM_EXTRACTION_JSON_CONTRACT = `
=======================================================
CONTRATO OBRIGATÓRIO DE SAÍDA JSON (SCHEMA ESTRITO):
=======================================================
Retorne EXCLUSIVAMENTE um objeto JSON válido seguindo exatamente esta estrutura de interpretação documental (NÃO invente preços; a precificação e os cálculos de engenharia serão validados deterministicamente pelo sistema):
{
  "scope_flags": {
    "equipment_supplied_by_client": false,
    "has_external_30mm_duct_note": false,
    "external_30mm_duct_measured": false
  },
  "equipment": [
    {
      "type": "Splitão | Split | Cassete | Piso Teto | Exaustor | Caixa Ventiladora | Fancoil | Chiller",
      "tag": "TAG se houver",
      "brand": "Marca se especificada ou null",
      "model": "Modelo exato se especificado ou null",
      "tr": 10,
      "btu": 120000,
      "qty": 1,
      "supply_by_client": false,
      "source_file": "nome_do_arquivo.pdf",
      "source_page": 1,
      "evidence": "Trecho literal da tabela ou nota"
    }
  ],
  "duct_segments": [
    {
      "width_cm": 60,
      "height_cm": 40,
      "length_m": null,
      "qty": 1,
      "type": "Insuflamento | Retorno | Exaustão | Ar Externo",
      "material_type": "MPU | Chapa Galvanizada | Chapa Preta | Inox",
      "insulation_mm": 20,
      "is_external": false,
      "measurement_status": "MEDIDO | PENDENTE_MEDICAO",
      "source_file": "nome_do_arquivo.pdf",
      "source_page": 1,
      "evidence": "60x40"
    }
  ],
  "refrigerant_lines": [
    {
      "liquid_diameter": "5/8\"",
      "suction_diameter": "1.1/8\"",
      "wall_thickness": "1/16\"",
      "length_m": null,
      "circuits_qty": 2,
      "insulation_type": "Armaflex | Elastômero",
      "insulation_thickness_mm": 19,
      "measurement_status": "MEDIDO | PENDENTE_MEDICAO",
      "source_file": "nome_do_arquivo.pdf",
      "source_page": 1,
      "evidence": "Trecho literal da nota ou planta"
    }
  ],
  "materials": [
    {
      "name": "Descrição técnica completa do item com dimensões, bitola e espessura",
      "category": "Difusão e Grelhas | Dutos e MPU | Tubulação de Cobre | Isolamento Térmico | Acessórios de Dutos | Suportação e Fixação | Elétrica e Comando | Automação e Controles | Drenagem",
      "quantity": 2,
      "unit": "un | m | m² | kg | cj | rolo | barra",
      "measurement_status": "DOCUMENTADO | MEDIDO | PENDENTE_MEDICAO",
      "source_file": "nome_do_arquivo.pdf",
      "source_page": 1,
      "evidence": "Trecho literal da tabela/legenda/planta"
    }
  ],
  "services": [
    {
      "name": "Descrição do serviço explicitamente documentado",
      "quantity": 1,
      "unit": "un | m² | dia | mês | vb",
      "measurement_status": "DOCUMENTADO | MEDIDO | PENDENTE_DEFINICAO_ESCOPO",
      "source_file": "nome_do_arquivo.pdf",
      "source_page": 1,
      "evidence": "Trecho literal"
    }
  ],
  "pending_items": [
    {
      "item": "Descrição do item pendente",
      "reason": "PENDENTE_MEDICAO | LOCALIZACAO_TRECHO_EXTERNO_PENDENTE | PENDENTE_DEFINICAO_ESCOPO | DIVERGENCIA_DOCUMENTAL",
      "details": "Explicação objetiva da pendência documental",
      "source_file": "nome_do_arquivo.pdf",
      "source_page": 1
    }
  ]
}
`;

export class BudgetLLMClient {
  /**
   * Identifica provedores de IA configurados no ambiente
   */
  static getProviderConfig() {
    const rawGemini = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GEMINI_KEY || process.env.GOOGLE_GEMINI_API_KEY || '';
    const geminiKey = typeof rawGemini === 'string' && rawGemini.trim().length > 0 ? rawGemini.trim() : null;

    const rawOpenAI = process.env.OPENAI_API_KEY || '';
    const openaiKey = typeof rawOpenAI === 'string' && rawOpenAI.trim().length > 0 ? rawOpenAI.trim() : null;

    if (geminiKey) {
      return {
        provider: 'gemini',
        apiKey: geminiKey,
        model: process.env.GEMINI_MODEL || 'gemini-flash-latest'
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
   * Valida e normaliza a saída de qualquer LLM (ou resposta simulada em testes)
   * contra o contrato de esquema obrigatório, descartando preços arbitrários do modelo.
   */
  static validateLLMExtractionSchema(rawResponse) {
    const errors = [];
    if (!rawResponse || typeof rawResponse !== 'object' || Array.isArray(rawResponse)) {
      return {
        valid: false,
        errors: ['Resposta do modelo nula ou não é um objeto JSON estruturado.'],
        data: null
      };
    }

    // Suporta formato direto ({ materials, equipment, duct_segments, ... })
    // ou aninhado ({ budget: { materials, pending_items }, analysis_metadata: { items } })
    const rawMaterials = Array.isArray(rawResponse.materials)
      ? rawResponse.materials
      : Array.isArray(rawResponse.items)
        ? rawResponse.items
        : Array.isArray(rawResponse.budget?.materials)
          ? rawResponse.budget.materials
          : Array.isArray(rawResponse.analysis_metadata?.items)
            ? rawResponse.analysis_metadata.items
            : [];

    const rawEquipment = Array.isArray(rawResponse.equipment)
      ? rawResponse.equipment
      : Array.isArray(rawResponse.machines)
        ? rawResponse.machines
        : [];

    const rawDuctSegments = Array.isArray(rawResponse.duct_segments)
      ? rawResponse.duct_segments
      : Array.isArray(rawResponse.ductSegments)
        ? rawResponse.ductSegments
        : [];

    const rawRefrigerantLines = Array.isArray(rawResponse.refrigerant_lines)
      ? rawResponse.refrigerant_lines
      : Array.isArray(rawResponse.refrigerantLines)
        ? rawResponse.refrigerantLines
        : [];

    const rawServices = Array.isArray(rawResponse.services)
      ? rawResponse.services
      : [];

    const rawPending = Array.isArray(rawResponse.pending_items)
      ? rawResponse.pending_items
      : Array.isArray(rawResponse.pendingItems)
        ? rawResponse.pendingItems
        : Array.isArray(rawResponse.budget?.pending_items)
          ? rawResponse.budget.pending_items
          : [];

    const normalizedMaterials = [];
    for (let i = 0; i < rawMaterials.length; i++) {
      const m = rawMaterials[i];
      if (!m || typeof m !== 'object') {
        errors.push(`materials[${i}] inválido: esperado objeto.`);
        continue;
      }
      const name = String(m.name || m.material_name || m.description || m.item || '').trim();
      if (!name) {
        errors.push(`materials[${i}] sem nome/descrição.`);
        continue;
      }
      const rawQty = m.quantity ?? m.final_quantity ?? m.technical_quantity ?? m.qty ?? null;
      const qtyNum = rawQty !== null && rawQty !== undefined && rawQty !== '' ? Number(rawQty) : null;
      if (qtyNum !== null && (Number.isNaN(qtyNum) || qtyNum < 0)) {
        errors.push(`materials[${i}] (${name}) possui quantidade inválida: ${rawQty}.`);
        continue;
      }

      const measurementStatus = String(
        m.measurement_status || m.measurementStatus || (qtyNum === null || qtyNum === 0 ? 'PENDENTE_MEDICAO' : 'DOCUMENTADO')
      ).toUpperCase();

      // NUNCA preserva unit_price vindo do LLM: preços vêm exclusivamente do catálogo oficial SABRAR
      normalizedMaterials.push({
        name,
        category: String(m.category || 'Materiais Extraídos (IA)').trim(),
        quantity: qtyNum !== null ? qtyNum : 0,
        unit: String(m.unit || 'un').trim(),
        measurementStatus,
        sourceFile: m.source_file || m.sourceFile || 'Documento do Projeto',
        sourcePage: Number(m.source_page || m.sourcePage || 1) || 1,
        evidence: String(m.evidence || m.notes || m.calculation_summary || name).trim()
      });
    }

    const normalizedEquipment = [];
    for (let i = 0; i < rawEquipment.length; i++) {
      const eq = rawEquipment[i];
      if (!eq || typeof eq !== 'object') {
        errors.push(`equipment[${i}] inválido.`);
        continue;
      }
      const type = String(eq.type || eq.name || eq.description || 'Equipamento HVAC').trim();
      const qty = Number(eq.qty ?? eq.quantity ?? 1);
      if (Number.isNaN(qty) || qty <= 0) {
        errors.push(`equipment[${i}] (${type}) com quantidade inválida.`);
        continue;
      }
      const tr = eq.tr != null ? Number(eq.tr) : (eq.capacity_tr != null ? Number(eq.capacity_tr) : null);
      const btu = eq.btu != null ? Number(eq.btu) : (eq.capacity_btu != null ? Number(eq.capacity_btu) : (tr ? tr * 12000 : null));

      normalizedEquipment.push({
        type,
        tag: eq.tag ? String(eq.tag).trim() : null,
        brand: eq.brand ? String(eq.brand).trim() : null,
        model: eq.model ? String(eq.model).trim() : null,
        tr: tr && !Number.isNaN(tr) ? tr : null,
        btu: btu && !Number.isNaN(btu) ? btu : null,
        qty,
        supplyByClient: Boolean(eq.supply_by_client ?? eq.supplyByClient ?? false),
        sourceFile: eq.source_file || eq.sourceFile || 'Documento do Projeto',
        sourcePage: Number(eq.source_page || eq.sourcePage || 1) || 1,
        evidence: String(eq.evidence || `${qty}x ${type}`).trim()
      });
    }

    const normalizedDuctSegments = [];
    for (let i = 0; i < rawDuctSegments.length; i++) {
      const d = rawDuctSegments[i];
      if (!d || typeof d !== 'object') {
        errors.push(`duct_segments[${i}] inválido.`);
        continue;
      }
      const widthCm = Number(d.width_cm ?? d.widthCm ?? 0);
      const heightCm = Number(d.height_cm ?? d.heightCm ?? 0);
      if (Number.isNaN(widthCm) || widthCm <= 0 || Number.isNaN(heightCm) || heightCm <= 0) {
        errors.push(`duct_segments[${i}] com dimensões inválidas (${widthCm}x${heightCm}).`);
        continue;
      }
      const rawLen = d.length_m ?? d.lengthM ?? null;
      const lengthM = rawLen !== null && rawLen !== undefined && rawLen !== '' && Number(rawLen) > 0
        ? Number(rawLen)
        : null;
      const qty = Math.max(1, Number(d.qty ?? d.quantity ?? 1) || 1);

      normalizedDuctSegments.push({
        widthCm,
        heightCm,
        lengthM,
        qty,
        type: String(d.type || 'Insuflamento').trim(),
        materialType: String(d.material_type || d.materialType || 'MPU').trim(),
        insulationMm: Number(d.insulation_mm ?? d.insulationMm ?? 20) || 20,
        isExternal: Boolean(d.is_external ?? d.isExternal ?? false),
        measurementStatus: lengthM ? 'MEDIDO' : 'PENDENTE_MEDICAO',
        sourceFile: d.source_file || d.sourceFile || 'Documento do Projeto',
        sourcePage: Number(d.source_page || d.sourcePage || 1) || 1,
        evidence: String(d.evidence || `${widthCm}x${heightCm}`).trim()
      });
    }

    const normalizedRefrigerantLines = [];
    for (let i = 0; i < rawRefrigerantLines.length; i++) {
      const r = rawRefrigerantLines[i];
      if (!r || typeof r !== 'object') continue;
      const rawLen = r.length_m ?? r.lengthM ?? null;
      const lengthM = rawLen !== null && rawLen !== undefined && Number(rawLen) > 0 ? Number(rawLen) : null;
      normalizedRefrigerantLines.push({
        liquidDiameter: r.liquid_diameter || r.liquidDiameter || null,
        suctionDiameter: r.suction_diameter || r.suctionDiameter || null,
        wallThickness: r.wall_thickness || r.wallThickness || null,
        lengthM,
        circuitsQty: Number(r.circuits_qty ?? r.circuitsQty ?? 1) || 1,
        insulationType: r.insulation_type || r.insulationType || 'Elastômero',
        insulationThicknessMm: Number(r.insulation_thickness_mm ?? r.insulationThicknessMm ?? 19) || 19,
        measurementStatus: lengthM ? 'MEDIDO' : 'PENDENTE_MEDICAO',
        sourceFile: r.source_file || r.sourceFile || 'Documento do Projeto',
        sourcePage: Number(r.source_page || r.sourcePage || 1) || 1,
        evidence: String(r.evidence || '').trim()
      });
    }

    const normalizedServices = [];
    for (let i = 0; i < rawServices.length; i++) {
      const s = rawServices[i];
      if (!s || typeof s !== 'object') continue;
      const name = String(s.name || s.description || '').trim();
      if (!name) continue;
      const qty = s.quantity != null ? Number(s.quantity) : null;
      normalizedServices.push({
        name,
        quantity: qty !== null && !Number.isNaN(qty) ? qty : 0,
        unit: String(s.unit || 'un').trim(),
        measurementStatus: String(s.measurement_status || s.measurementStatus || (qty > 0 ? 'DOCUMENTADO' : 'PENDENTE_DEFINICAO_ESCOPO')).toUpperCase(),
        sourceFile: s.source_file || s.sourceFile || 'Documento do Projeto',
        sourcePage: Number(s.source_page || s.sourcePage || 1) || 1,
        evidence: String(s.evidence || name).trim()
      });
    }

    const normalizedPending = [];
    for (let i = 0; i < rawPending.length; i++) {
      const p = rawPending[i];
      if (!p) continue;
      if (typeof p === 'string') {
        normalizedPending.push({
          item: p,
          reason: 'PENDENTE_REVISAO_HUMANA',
          details: p,
          sourceFile: 'Documento do Projeto',
          sourcePage: 1
        });
      } else if (typeof p === 'object') {
        normalizedPending.push({
          item: String(p.item || p.name || p.description || 'Item pendente').trim(),
          reason: String(p.reason || p.status || 'PENDENTE_REVISAO_HUMANA').trim(),
          details: String(p.details || p.notes || p.reason || '').trim(),
          sourceFile: p.source_file || p.sourceFile || 'Documento do Projeto',
          sourcePage: Number(p.source_page || p.sourcePage || 1) || 1
        });
      }
    }

    const scopeFlags = {
      equipmentSuppliedByClient: Boolean(rawResponse.scope_flags?.equipment_supplied_by_client ?? rawResponse.scopeFlags?.equipmentSuppliedByClient ?? false),
      hasExternal30mmDuctNote: Boolean(rawResponse.scope_flags?.has_external_30mm_duct_note ?? rawResponse.scopeFlags?.hasExternal30mmDuctNote ?? false),
      external30mmDuctMeasured: Boolean(rawResponse.scope_flags?.external_30mm_duct_measured ?? rawResponse.scopeFlags?.external30mmDuctMeasured ?? false)
    };

    const hasAnyStructuredContent =
      normalizedMaterials.length > 0 ||
      normalizedEquipment.length > 0 ||
      normalizedDuctSegments.length > 0 ||
      normalizedRefrigerantLines.length > 0 ||
      normalizedServices.length > 0 ||
      normalizedPending.length > 0;

    return {
      valid: hasAnyStructuredContent || errors.length === 0,
      hasContent: hasAnyStructuredContent,
      errors,
      data: {
        materials: normalizedMaterials,
        equipment: normalizedEquipment,
        ductSegments: normalizedDuctSegments,
        refrigerantLines: normalizedRefrigerantLines,
        services: normalizedServices,
        pendingItems: normalizedPending,
        scopeFlags
      }
    };
  }

  /**
   * Executa a análise do projeto através do LLM (ou fallback determinístico se sem chave)
   */
  static async analyzeProject({
    project,
    documentsContent,
    structuredDocuments = [],
    pdfAttachments = [],
    catalogSample = [],
    historicalContext = ''
  }) {
    const config = this.getProviderConfig();
    console.log(`[BudgetLLMClient] Executando motor de análise com provedor: ${config.provider} (${config.model})`);

    let structuredSummaryBlock = '';
    if (Array.isArray(structuredDocuments) && structuredDocuments.length > 0) {
      structuredSummaryBlock = '\n\nESTRUTURA POR PÁGINA E TABELAS DETECTADAS:\n' + structuredDocuments.map(doc => {
        const pageSummaries = (doc.pages || []).map(p => {
          const tbls = (p.tables || []).map(t => `  [Tabela linha ${t.lineStart}: ${t.header}]`).join('\n');
          return `- Arquivo ${doc.fileName} | Página ${p.pageNumber} (${p.lineCount || 0} linhas)${tbls ? '\n' + tbls : ''}`;
        }).join('\n');
        return pageSummaries;
      }).join('\n');
    }

    const fullPrompt = `${buildAgentContextPrompt(
      project,
      `${documentsContent || ''}${structuredSummaryBlock}`,
      catalogSample,
      historicalContext
    )}\n${LLM_EXTRACTION_JSON_CONTRACT}`;

    if (config.provider === 'gemini') {
      try {
        return await this.callGemini(config, fullPrompt, pdfAttachments);
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
   * Chamada à API Google Gemini com saída JSON estruturada, suporte multimodal (PDF/Imagem inlineData)
   * e tolerância a versões de modelo
   */
  static async callGemini(config, fullPrompt, pdfAttachments = []) {
    const candidateModels = [
      config.model,
      'gemini-flash-latest',
      'gemini-2.5-flash-lite',
      'gemini-3.7-flash',
      'gemini-3.5-flash',
      'gemini-2.5-pro'
    ].filter(Boolean);
    const uniqueModels = [...new Set(candidateModels)];

    const parts = [{ text: fullPrompt }];
    if (Array.isArray(pdfAttachments)) {
      for (const att of pdfAttachments) {
        if (att && att.dataBase64 && att.mimeType) {
          parts.push({
            inlineData: {
              mimeType: att.mimeType,
              data: att.dataBase64
            }
          });
        }
      }
    }

    let lastError = null;

    for (const model of uniqueModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.apiKey}`;

        const payload = {
          contents: [
            {
              role: 'user',
              parts
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
          if ((res.status === 404 || res.status === 503 || res.status === 429) && uniqueModels.indexOf(model) < uniqueModels.length - 1) {
            console.warn(`[BudgetLLMClient] Modelo ${model} retornou status ${res.status}, tentando alternativa...`);
            continue;
          }
          throw new Error(`Gemini API Error (${res.status}): ${errText}`);
        }

        const data = await res.json();
        const rawJson = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!rawJson) throw new Error('Resposta vazia da API do Gemini');

        return JSON.parse(rawJson);
      } catch (err) {
        lastError = err;
        if (err.message?.includes('404') && uniqueModels.indexOf(model) < uniqueModels.length - 1) {
          continue;
        }
        throw err;
      }
    }

    throw lastError || new Error('Falha na comunicação com a API do Gemini');
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

  /**
   * Testa a conectividade com o provedor de IA sem vazar credenciais
   */
  static async testConnection(targetModel = null) {
    const config = this.getProviderConfig();
    if (!config.apiKey) {
      return {
        configured: false,
        provider: config.provider,
        model: config.model,
        operational: false,
        message: 'Nenhuma chave de API detectada no ambiente (GEMINI_API_KEY ou OPENAI_API_KEY).'
      };
    }

    if (config.provider === 'gemini') {
      const candidateModels = targetModel
        ? [targetModel]
        : [
            config.model,
            'gemini-flash-latest',
            'gemini-2.5-flash-lite',
            'gemini-3.7-flash',
            'gemini-3.5-flash',
            'gemini-2.5-pro'
          ];
      const uniqueModels = [...new Set(candidateModels.filter(Boolean))];

      let lastErrResult = null;

      for (const model of uniqueModels) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.apiKey}`;
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: 'Ping Sabrar' }] }],
              generationConfig: { maxOutputTokens: 5 }
            })
          });

          if (!res.ok) {
            const errText = await res.text();
            let parsed;
            try { parsed = JSON.parse(errText); } catch (_) {}
            const errMsg = parsed?.error?.message || errText;
            lastErrResult = {
              configured: true,
              provider: 'gemini',
              model,
              operational: false,
              status: res.status,
              error: errMsg
            };
            if ((res.status === 404 || res.status === 503 || res.status === 429) && uniqueModels.indexOf(model) < uniqueModels.length - 1) {
              continue;
            }
            return lastErrResult;
          }

          return {
            configured: true,
            provider: 'gemini',
            model,
            operational: true,
            message: 'Gemini API conectada e respondendo com sucesso!'
          };
        } catch (err) {
          lastErrResult = {
            configured: true,
            provider: 'gemini',
            model,
            operational: false,
            error: err.message
          };
        }
      }

      return lastErrResult;
    }

    if (config.provider === 'openai') {
      try {
        const url = 'https://api.openai.com/v1/chat/completions';
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`
          },
          body: JSON.stringify({
            model: config.model,
            messages: [{ role: 'user', content: 'Ping Sabrar' }],
            max_tokens: 5
          })
        });

        if (!res.ok) {
          const errText = await res.text();
          let parsed;
          try { parsed = JSON.parse(errText); } catch (_) {}
          return {
            configured: true,
            provider: 'openai',
            model: config.model,
            operational: false,
            status: res.status,
            error: parsed?.error?.message || errText
          };
        }

        return {
          configured: true,
          provider: 'openai',
          model: config.model,
          operational: true,
          message: 'OpenAI API conectada e respondendo com sucesso!'
        };
      } catch (err) {
        return {
          configured: true,
          provider: 'openai',
          model: config.model,
          operational: false,
          error: err.message
        };
      }
    }

    return {
      configured: false,
      provider: config.provider,
      model: config.model,
      operational: false,
      message: 'Provedor determinístico ativo.'
    };
  }

  /**
   * Lista modelos disponíveis na conta Gemini (sem expor a chave)
   */
  static async listGeminiModels() {
    const config = this.getProviderConfig();
    if (!config.apiKey || config.provider !== 'gemini') {
      return { ok: false, error: 'Chave Gemini não configurada no ambiente.' };
    }

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${config.apiKey}`;
      const res = await fetch(url);
      if (!res.ok) {
        const errText = await res.text();
        return { ok: false, status: res.status, error: errText };
      }
      const data = await res.json();
      const models = (data?.models || []).map(m => ({
        name: m.name.replace(/^models\//, ''),
        displayName: m.displayName,
        description: m.description,
        supportedMethods: m.supportedGenerationMethods
      }));
      return { ok: true, total: models.length, models };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }
}
