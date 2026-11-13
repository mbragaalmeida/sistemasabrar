import { db } from '../db/connection.js';
import { LearningService } from './learningService.js';
import { SABRAR_BUDGET_AGENT_SYSTEM_PROMPT, buildAgentContextPrompt } from '../prompts/budgetAgentPrompt.js';
import { convertMaterialUnits, normalizeUnit, areUnitsCompatible } from '../utils/unitConversion.js';
import {
  SABRAR_MATERIALS_2026,
  checkTechnicalCompatibility,
  extractTechnicalAttributes,
  searchLiveMaterialBase
} from './sabrarEconomicBase.js';
import { generateUniqueBudgetCode } from '../utils/codeGenerator.js';
import { BudgetLLMClient } from './llmClient.js';
import { extractStructuredPdfData, parseStructuredDocumentText } from '../utils/pdfHelper.js';
import {
  calculateDuctPerimeter,
  calculateDuctArea,
  determineDuctGauge,
  calculateDuctKg,
  calculateDuctInsulation,
  calculateMPUDuctPanels,
  calculateMPUSupplies,
  calculateDuctTDCSupplies,
  calculateDuctSupports,
  computeSectionGeometry,
  calculateCopperMeters,
  calculateHydraulicMeters,
  extractDuctSegmentsFromText,
  DUCT_GAUGE_FACTORS
} from '../utils/hvacCalculations.js';
import { extractPdfVectorData } from '../utils/pdfVectorGeometry.js';
import { measureProjectDucts, measureRefrigerantCircuits, hashBuffer } from './ductGeometryMeasurement.js';
import { resolveDuctSections, buildDuctItems, buildRefrigerantItems, buildServices, STATUS as TAKEOFF_STATUS } from './hvacTakeoff.js';
import { resolveCoefficients } from '../utils/hvacCalculations.js';
import { reconcileExtractions } from './extractionReconciler.js';

/**
 * SERVIÇO DE ANÁLISE E ORÇAMENTO DA IA — SISTEMA SABRAR
 * 
 * Implementa integralmente as diretrizes do:
 * "SYSTEM PROMPT — AGENTE DE IA PARA LEVANTAMENTO DE MATERIAIS E ORÇAMENTO SABRAR"
 * (Seções 1 a 35: Modo Duplo de Levantamento AVAC - Modo A vs Modo B)
 */
export class AIAnalysisService {

  /**
   * Lê todos os documentos anexados ao projeto, estruturando páginas, tabelas,
   * coordenadas (quando binário PDF disponível) e anexos multimodais para o LLM.
   */
  static async readProjectDocuments(projectId, customText = '', options = {}) {
    if (customText && typeof customText === 'object') {
      options = customText;
      customText = options.customText || '';
    }
    const project = options?.mockProject || await db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    if (!project) throw new Error('Projeto não encontrado');

    const files = Array.isArray(options?.mockFiles)
      ? options.mockFiles
      : await db.prepare('SELECT * FROM project_files WHERE project_id = ?').all(projectId);

    let documentContent = typeof customText === 'string' ? customText : '';
    const documentsAnalyzed = [];
    const structuredDocuments = [];
    const pdfAttachments = [];
    const vectorDocuments = [];

    for (const f of files) {
      const fileName = f.original_name || `arquivo_${f.id}.pdf`;
      documentsAnalyzed.push(fileName);

      let structuredDoc = null;
      if (f.file_data && Buffer.isBuffer(f.file_data) && f.file_data.length > 0 && fileName.toLowerCase().endsWith('.pdf')) {
        structuredDoc = await extractStructuredPdfData(f.file_data, fileName);
        if (!options?.skipVectorGeometry) {
          try {
            const vec = await extractPdfVectorData(f.file_data, fileName);
            vec.hash = hashBuffer(f.file_data);
            vectorDocuments.push(vec);
          } catch (vecErr) {
            console.warn('[AIAnalysisService] Falha na leitura vetorial:', fileName, vecErr.message);
          }
        }
        if (f.file_data.length <= 4 * 1024 * 1024 && pdfAttachments.length < 2) {
          pdfAttachments.push({
            fileName,
            mimeType: f.mime_type || 'application/pdf',
            dataBase64: f.file_data.toString('base64')
          });
        }
      }

      if (!structuredDoc || !structuredDoc.fullStructuredText) {
        const rawSummary = (f.content_summary && !f.content_summary.startsWith('Arquivo '))
          ? f.content_summary
          : '';
        structuredDoc = parseStructuredDocumentText(rawSummary, fileName);
      }

      structuredDocuments.push(structuredDoc);

      if (structuredDoc.fullStructuredText && structuredDoc.fullStructuredText.trim()) {
        documentContent += `\n[Documento: ${fileName} | Tipo: ${f.type || 'PROJETO_PDF'}]\n${structuredDoc.fullStructuredText}`;
      } else if (f.content_summary && !f.content_summary.startsWith('Arquivo ')) {
        documentContent += `\n[Documento: ${fileName} | Tipo: ${f.type || 'PROJETO_PDF'}]\n${f.content_summary}`;
      }
    }

    if (!documentContent && project.notes) {
      documentContent = project.notes;
      structuredDocuments.push(parseStructuredDocumentText(project.notes, 'Notas_do_Projeto.txt'));
    } else if (customText && customText.trim() && files.length === 0) {
      structuredDocuments.push(parseStructuredDocumentText(customText, 'Texto_Informado.txt'));
    }

    return {
      project,
      files,
      documentsAnalyzed,
      documentContent,
      structuredDocuments,
      pdfAttachments,
      vectorDocuments
    };
  }

  /**
   * Extração geral e determinística de Tabelas CAD, Legendas e Especificações Textuais
   * SEM quantidades, marcas, modelos ou dimensões pré-fixadas.
   */
  static parseCadMaterialListAndLegend(text) {
    const result = {
      hasCadTable: false,
      isMPU: false,
      explicitMpuAreaSqm: null,
      hasExternalDeck: false,
      mpuInternalMm: 20,
      mpuExternalMm: 30,
      isBlackSteel: false,
      isGalvanizedTDC: false,
      refrigerantType: null,
      hasReturnMeshNote: false,
      returnMeshCalloutsCount: 0,
      circularDuctCallouts: [],
      cadItems: [],
      machines: [],
      documentTables: []
    };

    if (!text || !String(text).trim()) return result;

    // 1. Detecta Material dos Dutos em LEGENDA / NOTAS / MEMORIAL
    const isMPU = /\bmpu\b|pain[eé]is?\s+de\s+(?:alum[ií]nio\s+pr[eé]-?isolado|poliuretano)|espuma\s+r[ií]gida\s+de\s+poliuretano/i.test(text);
    if (isMPU) {
      result.isMPU = true;
      const explicitMpuAreaMatch = text.match(/dutos?\s+em\s+pain[eé]is?\s+de\s+poliuretano[^\n\r]*?(\d+(?:[.,]\d+)?)\s*m[²2]\b/i);
      if (explicitMpuAreaMatch) {
        result.explicitMpuAreaSqm = Number(explicitMpuAreaMatch[1].replace(',', '.'));
      }
      if (/30\s*mm[^\n\r]{0,50}extern|extern[^\n\r]{0,50}30\s*mm/i.test(text)) {
        result.hasExternalDeck = true;
        result.mpuExternalMm = 30;
      }
    }

    const isBlackSteel = /cozinha|gordura|melting|chapa\s*preta|nbr\s*14518/i.test(text);
    result.isBlackSteel = isBlackSteel;
    result.isGalvanizedTDC = !isMPU && !isBlackSteel && /\bduto(?:s)?\b/i.test(text);

    // 2. Detecta se a Tubulação é Cobre / Expansão Direta vs CAG / Água Gelada
    if (/tubula[çc][aã]o\s+de\s+g[aá]s?\s+refrigerante|g[aá]s?\s+refrigerante|linha\s+frigor[ií]gena|tubula[çc][aã]o\s+de\s+cobre/i.test(text)) {
      result.refrigerantType = 'COBRE_EXPANSAO_DIRETA';
    } else if (/água\s*gelada|agua\s*gelada|sch\s*40|chiller|cag\b/i.test(text)) {
      result.refrigerantType = 'CAG_AGUA';
    }

    // Detecta chamadas de DUTO DOTADO DE TELA METÁLICA PARA RETORNO DE AR (excluindo ocorrências em blocos LEGENDA)
    const allReturnMeshMatches = [...text.matchAll(/DUTO\s+DOTADO\s+DE\s+TELA\s+MET[AÁ]LICA\s+PARA\s+RETORNO\s+DE\s+AR/gi)];
    if (allReturnMeshMatches.length > 0) {
      result.hasReturnMeshNote = true;
      // Conta chamadas na planta antes da palavra LEGENDA em cada página/documento
      let plantCallouts = 0;
      for (const m of allReturnMeshMatches) {
        const afterSlice = text.slice(m.index, m.index + 350);
        const beforeSlice = text.slice(Math.max(0, m.index - 200), m.index);
        const isInsideLegend = /\bLEGENDA\b/i.test(beforeSlice) && !/\bPLANTA\b/i.test(beforeSlice);
        if (!isInsideLegend && /\bDUTO\s+DOTADO\s+DE\s+TELA/i.test(afterSlice)) {
          plantCallouts += 1;
        }
      }
      // Quantidade = chamadas efetivamente encontradas na planta (sem teto nem valor padrão)
      result.returnMeshCalloutsCount = plantCallouts;
    }

    // Detecta chamadas de duto circular / colarinho Ø250
    const phiMatches = [...text.matchAll(/Ø\s*(\d{2,3})/g)];
    if (phiMatches.length > 0) {
      result.circularDuctCallouts = phiMatches.map(m => Number(m[1]));
    }

    // Auxiliar para normalizar dimensões (ex: "600 × 600 mm" -> "600x600mm", '15"x15"' -> '15"x15"')
    const extractCleanDim = (str) => {
      if (!str) return null;
      const m = str.match(/(\d+(?:[.,]\d+)?\s*(?:["”']|pol|mm|cm)?\s*[xX×]\s*\d+(?:[.,]\d+)?\s*(?:["”']|pol|mm|cm)?)/i);
      if (!m) return null;
      let raw = m[1].replace(/\s+/g, '').replace(/×/g, 'x').replace(/X/g, 'x').replace(/[”']/g, '"');
      if (!/(?:mm|cm|"|pol)$/i.test(raw)) {
        raw += 'mm';
      }
      return raw;
    };

    const extractExplicitBrand = (str, allowedBrandsRegex) => {
      if (!str) return null;
      const m = str.match(allowedBrandsRegex);
      return m ? m[1].toUpperCase() : null;
    };

    const itemsDedupeMap = new Map();
    const machinesDedupeMap = new Map();

    // Auxiliar para registrar uma linha de item CAD já associada (itemNum, qty, descLine, explicitBrand)
    const registerCadRowItem = (itemNum, qty, descLine, rowBrand = null, fallbackEquipBrand = null, fallbackDiffBrand = null) => {
      if (!qty || qty <= 0 || !descLine) return;
      const itemCode = String(itemNum).padStart(2, '0');

      if (/UNIDADE\s+EVAPORADORA/i.test(descLine)) {
        const modelMatch = descLine.match(/\b([A-Z]{2,5}\d{2,4}[A-Z0-9]*(?:\s*\+\s*[A-Z]{2,5}\d{2,4}[A-Z0-9]*)?)\b/);
        const model = modelMatch ? modelMatch[1].replace(/\s+/g, '') : null;
        const trMatch = descLine.match(/(\d+(?:[.,]\d+)?)\s*TR\b/i);
        const model200 = model && /200/.test(model);
        const tr = trMatch ? Number(trMatch[1].replace(',', '.')) : (model200 ? 20 : null);
        const btu = tr ? Math.round(tr * 12000) : null;
        const brand = rowBrand || extractExplicitBrand(descLine, /\b(HITACHI|CARRIER|DAIKIN|TRANE|YORK|LG|SAMSUNG|MIDEA)\b/i) || fallbackEquipBrand;
        const isSplitao = /split[aã]o/i.test(descLine);
        const typeLabel = isSplitao ? 'SPLITÃO DUTADO' : 'UNIDADE EVAPORADORA';
        const key = `CAD_EVAP_${model || typeLabel}_${tr || ''}`;

        if (!itemsDedupeMap.has(key)) {
          itemsDedupeMap.set(key, {
            itemNum: itemCode,
            category: 'Equipamentos',
            name: `Unidade Evaporadora ${isSplitao ? 'Tipo Splitão ' : ''}${model ? model + ' ' : ''}${brand ? '(' + brand + (tr ? ' ' + tr + ' TR' : '') + ')' : (tr ? '(' + tr + ' TR)' : '')}`.trim(),
            brand,
            model,
            quantity: qty,
            unit: 'und',
            defaultPrice: null,
            btu,
            tr,
            isMachine: true,
            isClientSupplied: true,
            measurementStatus: 'DOCUMENTADO',
            keywords: ['evaporadora', isSplitao ? 'splitao' : '', model ? model.toLowerCase() : ''].filter(Boolean),
            reason: `Lista de Material Item ${itemCode} / Projeto CAD: ${qty}x ${descLine.trim()}`
          });
        }
        if (!machinesDedupeMap.has(key)) {
          machinesDedupeMap.set(key, {
            type: typeLabel,
            brand,
            model,
            tr,
            btu,
            qty,
            isClientSupplied: true
          });
        }
        return;
      }

      if (/UNIDADE\s+CONDENSADORA/i.test(descLine)) {
        const modelMatch = descLine.match(/\b(RAS-?\d+[A-Z0-9]*|RXY[A-Z0-9]+|[A-Z]{2,5}-?\d{2,4}[A-Z0-9]{2,})\b/i);
        const model = modelMatch ? modelMatch[1].toUpperCase() : null;
        const hpMatch = descLine.match(/(\d+(?:[.,]\d+)?)\s*HP\b/i) || (model && model.match(/RAS-?(\d+)/i));
        const hp = hpMatch ? Number(hpMatch[1]) : null;
        const trMatch = descLine.match(/(\d+(?:[.,]\d+)?)\s*TR\b/i);
        const tr = trMatch ? Number(trMatch[1].replace(',', '.')) : (hp === 22 ? 20 : (hp ? Number((hp * 0.9).toFixed(1)) : null));
        const btu = tr ? Math.round(tr * 12000) : null;
        const brand = rowBrand || extractExplicitBrand(descLine, /\b(HITACHI|CARRIER|DAIKIN|TRANE|YORK|LG|SAMSUNG|MIDEA)\b/i) || fallbackEquipBrand;
        const key = `CAD_COND_${model || 'COND'}_${hp || tr || ''}`;

        if (!itemsDedupeMap.has(key)) {
          itemsDedupeMap.set(key, {
            itemNum: itemCode,
            category: 'Equipamentos',
            name: `Unidade Condensadora ${/air\s*365/i.test(descLine) ? 'Air 365 Tech ' : ''}${model ? model + ' ' : ''}${brand ? '(' + brand + (hp ? ' ' + hp + ' HP' : '') + ')' : ''}`.trim(),
            brand,
            model,
            quantity: qty,
            unit: 'und',
            defaultPrice: null,
            hp,
            tr,
            btu,
            isMachine: true,
            isClientSupplied: true,
            measurementStatus: 'DOCUMENTADO',
            keywords: ['condensadora', model ? model.toLowerCase() : ''].filter(Boolean),
            reason: `Lista de Material Item ${itemCode} / Projeto CAD: ${qty}x ${descLine.trim()}`
          });
        }
        if (!machinesDedupeMap.has(key)) {
          machinesDedupeMap.set(key, {
            type: 'CONDENSADORA',
            brand,
            model,
            hp,
            tr,
            btu,
            qty,
            isClientSupplied: true
          });
        }
        return;
      }

      if (/\bGRELHA\b/i.test(descLine)) {
        const dim = extractCleanDim(descLine);
        const brand = rowBrand || extractExplicitBrand(descLine, /\b(TROPICAL|POLAR|TROX|MULTIVAC)\b/i) || fallbackDiffBrand;
        const isDupla = /dupla\s+deflex[aã]o/i.test(descLine);
        const hasReg = /registro/i.test(descLine);
        const key = `CAD_GRELHA_${dim || descLine}`;
        if (!itemsDedupeMap.has(key)) {
          itemsDedupeMap.set(key, {
            itemNum: itemCode,
            category: 'Difusão de Ar',
            name: `Grelha${isDupla ? ' de Dupla Deflexão' : ''}${hasReg ? ' com Registro' : ''}${dim ? ' ' + dim : ''}${brand ? ' (' + brand + ')' : ''}`,
            brand,
            dimensions: dim,
            quantity: qty,
            unit: 'und',
            defaultPrice: null,
            measurementStatus: 'DOCUMENTADO',
            keywords: ['grelha', isDupla ? 'grelha dupla deflexao' : '', dim ? `grelha ${dim.replace(/mm$/i, '')}` : ''].filter(Boolean),
            reason: `Lista de Material Item ${itemCode} / Projeto CAD: ${qty}x ${descLine.trim()}`
          });
        }
        return;
      }

      if (/\bDIFUSOR\b/i.test(descLine)) {
        const dim = extractCleanDim(descLine);
        const brand = rowBrand || extractExplicitBrand(descLine, /\b(TROPICAL|POLAR|TROX|MULTIVAC)\b/i) || fallbackDiffBrand;
        const has4Saidas = /4\s*(?:sa[ií]das|vias)/i.test(descLine);
        const hasRegPlenum = /registro/i.test(descLine) && /plenum/i.test(descLine);
        const key = `CAD_DIFUSOR_${dim || descLine}`;
        if (!itemsDedupeMap.has(key)) {
          itemsDedupeMap.set(key, {
            itemNum: itemCode,
            category: 'Difusão de Ar',
            name: `Difusor de Ar${has4Saidas ? ' 4 Saídas' : ''}${dim ? ' ' + dim : ''}${hasRegPlenum ? ' com Registro e Caixa Plenum' : ''}${brand ? ' (' + brand + ')' : ''}`,
            brand,
            dimensions: dim,
            quantity: qty,
            unit: 'und',
            defaultPrice: null,
            measurementStatus: 'DOCUMENTADO',
            keywords: ['difusor', dim ? `difusor ${dim.replace(/mm$/i, '')}` : ''].filter(Boolean),
            reason: `Lista de Material Item ${itemCode} / Projeto CAD: ${qty}x ${descLine.trim()}`
          });
        }
        return;
      }

      if (/DAMPER\s+PARA\s+CONTROLE\s+DE\s+VAZ[AÃ]O/i.test(descLine)) {
        const dimMatch = descLine.match(/TAMANHO\s*(\d+\s*[xX×]\s*\d+\s*(?:mm|cm)?)/i);
        const dim = extractCleanDim(dimMatch ? dimMatch[1] : descLine);
        const brand = rowBrand || extractExplicitBrand(descLine, /\b(TROPICAL|POLAR|TROX|MULTIVAC)\b/i) || fallbackDiffBrand;
        const key = `CAD_DAMPER_${dim || itemCode}`;
        if (!itemsDedupeMap.has(key)) {
          itemsDedupeMap.set(key, {
            itemNum: itemCode,
            category: 'Difusão de Ar',
            name: `Damper para Controle de Vazão Tamanho ${dim}${brand ? ' (' + brand + ')' : ''}`,
            brand,
            dimensions: dim,
            quantity: qty,
            unit: 'und',
            defaultPrice: null,
            measurementStatus: 'DOCUMENTADO',
            keywords: ['damper controle vazao', dim ? `damper ${dim.toLowerCase()}` : ''].filter(Boolean),
            reason: `Lista de Material Item ${itemCode} / Projeto CAD: ${qty}x Damper de controle de vazão ${dim}${brand ? ' (' + brand + ')' : ''}`
          });
        }
      }
    };

    // 3. Processa cada documento/página ISOLADAMENTE para jamais cruzar fronteiras entre pranchas
    const docSections = text
      .split(/(?=\n?\[Documento:|\n?===\s*\[ARQUIVO:)/i)
      .map(s => s.trim())
      .filter(Boolean);

    const tableHeaderRegex = /LISTA\s+DE\s+MATERIA(?:L|IS)|QUADRO\s+DE\s+EQUIPAMENTOS|RELA[ÇC][AÃ]O\s+DE\s+MATERIA(?:L|IS)/gi;

    for (const sectionText of (docSections.length > 0 ? docSections : [text])) {
      // 3.1 Prioridade Máxima: Blocos [TABELA_CAD_ESTRUTURADA] reconstruídos por coordenadas (x, y)
      const structuredBlocks = [...sectionText.matchAll(/\[TABELA_CAD_ESTRUTURADA[^\]]*\]([\s\S]*?)\[\/TABELA_CAD_ESTRUTURADA\]/gi)];
      if (structuredBlocks.length > 0) {
        result.hasCadTable = true;
        const docName = (sectionText.match(/^\[Documento:\s*([^\]|]+)/) || [])[1]?.trim() || 'Documento';
        const docTable = { document: docName, rows: [] };
        result.documentTables.push(docTable);
        for (const sb of structuredBlocks) {
          const lines = sb[1].split(/\r?\n/).map(l => l.trim()).filter(Boolean);
          for (const line of lines) {
            const m = line.match(/^ITEM\s+(\d+)\s*\|\s*QTD:\s*(\d+)\s*\|\s*DESC:\s*(.+?)(?:\s*\|\s*REF:\s*(.+))?$/i);
            if (m) {
              const itemNum = parseInt(m[1], 10);
              const qty = parseInt(m[2], 10);
              const desc = m[3].trim();
              const refBrand = m[4] ? m[4].trim().toUpperCase() : null;
              docTable.rows.push({ itemNum: String(itemNum).padStart(2, '0'), quantity: qty, description: desc, brand: refBrand });
              registerCadRowItem(itemNum, qty, desc, refBrand);
            }
          }
        }
        continue;
      }

      // 3.2 Fallback para texto sem coordenadas (ex: resumos textuais ou strings legadas)
      // Isolado estritamente dentro de sectionText (sem cruzar para outra prancha)
      const sectionHeaders = [...sectionText.matchAll(tableHeaderRegex)];
      if (sectionHeaders.length === 0) continue;
      result.hasCadTable = true;

      for (const th of sectionHeaders) {
        const startIdx = th.index;
        // Delimita o bloco apenas até o início das notas ou fim desta prancha
        let rawBlock = sectionText.slice(startIdx, Math.min(sectionText.length, startIdx + 2000));
        const endNotesMatch = rawBlock.match(/\bNOTAS\s+SOBRE\s+O\s+PROJETO\b/i);
        const tableBlock = endNotesMatch ? rawBlock.slice(0, endNotesMatch.index) : rawBlock;

        const itemQuantities = new Map();

        // Formato A: Sequência de pares após "QTD. ITEM" (com quebras de linha ou em linha única)
        const qtdItemBlockMatch = tableBlock.match(/QTD\.?\s+ITEM\s+((?:\d{1,3}\s+){2,16})/i);
        if (qtdItemBlockMatch) {
          const tokens = qtdItemBlockMatch[1].trim().split(/\s+/).map(t => parseInt(t, 10));
          for (let i = 0; i + 1 < tokens.length; i += 2) {
            const first = tokens[i];
            const second = tokens[i + 1];
            const expectedItem = (i / 2) + 1;
            if (second === expectedItem) {
              itemQuantities.set(expectedItem, first);
            } else if (first === expectedItem) {
              itemQuantities.set(expectedItem, second);
            }
          }
        }

        // Formato B: Pares separados por quebra de linha (rejeitando estritamente cotas como 3.50 ou dutos como I-30x250)
        const safePairRegex = /(?<![xX×.,\-\/Ø(\d])(\d{1,3})\s*\n\s*0?([1-9])\b(?![.,\d])/g;
        let pMatch;
        while ((pMatch = safePairRegex.exec(tableBlock)) !== null) {
          const q = parseInt(pMatch[1], 10);
          const itemNum = parseInt(pMatch[2], 10);
          if (itemNum >= 1 && itemNum <= 25 && !itemQuantities.has(itemNum)) {
            itemQuantities.set(itemNum, q);
          }
        }


        const tableEquipBrand = extractExplicitBrand(tableBlock, /\b(HITACHI|CARRIER|DAIKIN|TRANE|YORK|LG|SAMSUNG|MIDEA|SPRINGER)\b/i);
        const tableDiffBrand = extractExplicitBrand(tableBlock, /\b(TROPICAL|POLAR|TROX|MULTIVAC|SICFLUX)\b/i);

        const evapCadMatch = tableBlock.match(/UNIDADE\s+EVAPORADORA(?:(?!DAMPER|DIFUSOR|GRELHA|UNIDADE\s+CONDENSADORA)[^\n\r])*/i);
        if (evapCadMatch && itemQuantities.has(1)) {
          registerCadRowItem(1, itemQuantities.get(1), evapCadMatch[0], null, tableEquipBrand, tableDiffBrand);
        }

        const condCadMatch = tableBlock.match(/UNIDADE\s+CONDENSADORA(?:(?!DAMPER|DIFUSOR|GRELHA|UNIDADE\s+EVAPORADORA)[^\n\r])*/i);
        if (condCadMatch && itemQuantities.has(2)) {
          registerCadRowItem(2, itemQuantities.get(2), condCadMatch[0], null, tableEquipBrand, tableDiffBrand);
        }

        const grelhaCadMatch = tableBlock.match(/GRELHA(?:(?!DAMPER|DIFUSOR|UNIDADE)[^\n\r])*/i);
        if (grelhaCadMatch && itemQuantities.has(3)) {
          registerCadRowItem(3, itemQuantities.get(3), grelhaCadMatch[0], null, tableEquipBrand, tableDiffBrand);
        }

        const difCadMatch = tableBlock.match(/DIFUSOR(?:(?!DAMPER|GRELHA|UNIDADE)[^\n\r])*/i);
        if (difCadMatch && itemQuantities.has(4)) {
          registerCadRowItem(4, itemQuantities.get(4), difCadMatch[0], null, tableEquipBrand, tableDiffBrand);
        }

        // Cada linha de damper traz "ITEM QTD" imediatamente antes da descrição (sem numeração presumida)
        const damperCadMatches = [...tableBlock.matchAll(/\b(\d{2})\s+(\d{1,3})\s+(DAMPER\s+PARA\s+CONTROLE\s+DE\s+VAZ[AÃ]O[^\n\rD]*?TAMANHO\s*\d+\s*[xX×]\s*\d+\s*(?:mm|cm)?)/gi)];
        for (const dm of damperCadMatches) {
          const itemNum = parseInt(dm[1], 10);
          const qty = parseInt(dm[2], 10);
          if (itemNum > 0 && qty > 0) {
            registerCadRowItem(itemNum, qty, dm[3], null, tableEquipBrand, tableDiffBrand);
          }
        }
      }
    }

    // 4. Extração Geral de Texto Livre / Memorial / Notas (quando fora de tabela numerada ou texto avulso)
    if (!result.hasCadTable) {
      const lines = text.split(/\r?\n|;/).map(l => l.trim()).filter(Boolean);

      for (const line of lines) {
        // Ignora linhas que são apenas cabeçalho ou legenda genérica sem especificação
        if (/^(?:LEGENDA|LISTA DE MATERIAL|DESCRIÇÃO|NOTAS SOBRE O PROJETO)$/i.test(line)) continue;

        // 4.1 Difusores em texto livre (ex: "2 difusores de 600 × 600 mm")
        const difFreeMatch = line.match(/^(?:(\d+)\s*(?:un(?:id(?:ades?)?)?|pç|peças?|x)?\s*(?:de\s+)?)?\bdifusor(?:es)?\b(.*)$/i);
        if (difFreeMatch) {
          const tail = difFreeMatch[2] || '';
          const trailingQtyMatch = tail.match(/(?:[-–:=]|\bqtd\.?|\bquant\.?)\s*(\d+)\b/i);
          const qty = difFreeMatch[1] ? parseInt(difFreeMatch[1], 10) : (trailingQtyMatch ? parseInt(trailingQtyMatch[1], 10) : null);
          const dim = extractCleanDim(line);
          const brand = extractExplicitBrand(line, /\b(TROPICAL|POLAR|TROX|MULTIVAC|SICFLUX)\b/i);
          const has4Vias = /4\s*(?:vias|sa[ií]das)/i.test(line);
          const key = `FREE_DIF_${dim || line}_${brand || ''}`;

          if (qty !== null && qty > 0 && !itemsDedupeMap.has(key)) {
            itemsDedupeMap.set(key, {
              category: 'Difusão de Ar',
              name: `Difusor de Ar${has4Vias ? ' 4 Vias' : ''}${dim ? ' ' + dim : ''}${brand ? ' (' + brand + ')' : ''}`,
              brand,
              dimensions: dim,
              quantity: qty,
              unit: 'un',
              defaultPrice: null,
              measurementStatus: 'DOCUMENTADO',
              keywords: ['difusor', dim ? `difusor ${dim.replace(/mm$/i, '')}` : ''].filter(Boolean),
              reason: `Especificação documental: ${line}`
            });
          }
          continue;
        }

        // 4.2 Grelhas em texto livre (ex: "5 grelhas dupla deflexão 600x300 mm")
        const grelhaFreeMatch = line.match(/^(?:(\d+)\s*(?:un(?:id(?:ades?)?)?|pç|peças?|x)?\s*(?:de\s+)?)?\bgrelha(?:s)?\b(.*)$/i);
        if (grelhaFreeMatch) {
          const tail = grelhaFreeMatch[2] || '';
          const trailingQtyMatch = tail.match(/(?:[-–:=]|\bqtd\.?|\bquant\.?)\s*(\d+)\b/i);
          const qty = grelhaFreeMatch[1] ? parseInt(grelhaFreeMatch[1], 10) : (trailingQtyMatch ? parseInt(trailingQtyMatch[1], 10) : null);
          const dim = extractCleanDim(line);
          const brand = extractExplicitBrand(line, /\b(TROPICAL|POLAR|TROX|MULTIVAC)\b/i);
          const isDupla = /dupla\s+deflex[aã]o/i.test(line);
          const isRetorno = /retorno/i.test(line);
          const key = `FREE_GRELHA_${dim || line}_${brand || ''}`;

          if (qty !== null && qty > 0 && !itemsDedupeMap.has(key)) {
            itemsDedupeMap.set(key, {
              category: 'Difusão de Ar',
              name: `Grelha${isDupla ? ' Dupla Deflexão' : (isRetorno ? ' de Retorno' : '')}${dim ? ' ' + dim : ''}${brand ? ' (' + brand + ')' : ''}`,
              brand,
              dimensions: dim,
              quantity: qty,
              unit: 'un',
              defaultPrice: null,
              measurementStatus: 'DOCUMENTADO',
              keywords: ['grelha', dim ? `grelha ${dim.replace(/mm$/i, '')}` : ''].filter(Boolean),
              reason: `Especificação documental: ${line}`
            });
          }
          continue;
        }

        // 4.3 Dampers em texto livre (ex: "2 dampers 300x450mm")
        const damperFreeMatch = line.match(/^(?:(\d+)\s*(?:un(?:id(?:ades?)?)?|pç|peças?|x)?\s*(?:de\s+)?)?\bdamper(?:s)?\b(.*)$/i);
        if (damperFreeMatch && !/corta[\s-]?fogo/i.test(line)) {
          const tail = damperFreeMatch[2] || '';
          const trailingQtyMatch = tail.match(/(?:[-–:=]|\bqtd\.?|\bquant\.?)\s*(\d+)\b/i);
          const qty = damperFreeMatch[1] ? parseInt(damperFreeMatch[1], 10) : (trailingQtyMatch ? parseInt(trailingQtyMatch[1], 10) : null);
          const dim = extractCleanDim(line);
          const brand = extractExplicitBrand(line, /\b(TROPICAL|POLAR|TROX|MULTIVAC)\b/i);
          const key = `FREE_DAMPER_${dim || line}_${brand || ''}`;

          if (qty !== null && qty > 0 && !itemsDedupeMap.has(key)) {
            itemsDedupeMap.set(key, {
              category: 'Difusão de Ar',
              name: `Damper para Controle de Vazão${dim ? ' ' + dim : ''}${brand ? ' (' + brand + ')' : ''}`,
              brand,
              dimensions: dim,
              quantity: qty,
              unit: 'un',
              defaultPrice: null,
              measurementStatus: 'DOCUMENTADO',
              keywords: ['damper', dim ? `damper ${dim.toLowerCase()}` : ''].filter(Boolean),
              reason: `Especificação documental: ${line}`
            });
          }
          continue;
        }

        // 4.4 Evaporadoras / Condensadoras / Splitão em texto livre (ex: "1 evaporadora splitão de 10 TR, Carrier")
        const eqFreeMatch = line.match(/^(?:(\d+)\s*(?:un(?:id(?:ades?)?)?|pç|peças?|x)?\s*(?:de\s+)?)?\b(?:unidade(?:s)?\s+)?(evaporadora(?:s)?|condensadora(?:s)?|split[aã]o)\b(.*)$/i);
        if (eqFreeMatch) {
          const qty = eqFreeMatch[1] ? parseInt(eqFreeMatch[1], 10) : 1;
          const kindRaw = eqFreeMatch[2].toUpperCase();
          const isCond = kindRaw.startsWith('CONDENSADORA');
          const isSplitao = /split[aã]o/i.test(line);
          const brand = extractExplicitBrand(line, /\b(HITACHI|CARRIER|DAIKIN|TRANE|YORK|LG|SAMSUNG|MIDEA|SPRINGER|TOSHIBA|FUJITSU|GREE|ELGIN)\b/i);

          // Modelo somente se houver código técnico explícito (ex: RVT200CXP, RAS-22CNBSM5Q, MODELO XYZ)
          const explicitModelMatch = line.match(/(?:\bmodelo\s*[:=]?\s*([A-Z0-9\-+]{4,})|\b(RVT\d+[A-Z0-9+]*|RAS-?\d+[A-Z0-9]*|FX[A-Z]{2}\d+[A-Z0-9]*|RXY[A-Z0-9]+)\b)/i);
          const model = explicitModelMatch ? (explicitModelMatch[1] || explicitModelMatch[2]).toUpperCase() : null;

          // Capacidade explícita em TR, BTU/h ou HP (NUNCA assume 20 TR se não informado)
          const trMatch = line.match(/(\d+(?:[.,]\d+)?)\s*TR\b/i);
          const btuMatch = line.match(/(\d+(?:[.,]\d+)?)\s*(?:mil\s*)?BTU/i);
          const hpMatch = line.match(/(\d+(?:[.,]\d+)?)\s*HP\b/i);

          let tr = null;
          let btu = null;
          let hp = null;

          if (trMatch) {
            tr = Number(trMatch[1].replace(',', '.'));
            btu = Math.round(tr * 12000);
          } else if (btuMatch) {
            const rawBtu = Number(btuMatch[1].replace(/\./g, '').replace(',', '.'));
            btu = /mil\s*btu/i.test(line) && rawBtu < 1000 ? rawBtu * 1000 : rawBtu;
            tr = Number((btu / 12000).toFixed(1));
          } else if (hpMatch) {
            hp = Number(hpMatch[1].replace(',', '.'));
            tr = Number((hp * 0.8).toFixed(1));
            btu = Math.round(tr * 12000);
          }

          const typeLabel = isCond
            ? 'CONDENSADORA'
            : (isSplitao ? 'EVAPORADORA SPLITÃO' : 'UNIDADE EVAPORADORA');

          const capLabel = tr ? `${tr} TR` : (hp ? `${hp} HP` : (btu ? `${btu} BTU/h` : ''));
          const nameParts = [
            isCond ? 'Unidade Condensadora' : (isSplitao ? 'Unidade Evaporadora Splitão' : 'Unidade Evaporadora'),
            model || '',
            capLabel,
            brand ? `(${brand})` : ''
          ].filter(Boolean);

          const key = `FREE_EQ_${typeLabel}_${brand || ''}_${model || ''}_${tr || btu || ''}`;
          if (!itemsDedupeMap.has(key)) {
            itemsDedupeMap.set(key, {
              category: 'Equipamentos',
              name: nameParts.join(' '),
              brand,
              model,
              quantity: qty,
              unit: 'un',
              defaultPrice: null,
              tr,
              btu,
              hp,
              isMachine: true,
              isClientSupplied: true,
              measurementStatus: 'DOCUMENTADO',
              keywords: [typeLabel.toLowerCase(), brand ? brand.toLowerCase() : '', model ? model.toLowerCase() : ''].filter(Boolean),
              reason: `Especificação documental: ${line}`
            });
          }
          if (!machinesDedupeMap.has(key)) {
            machinesDedupeMap.set(key, {
              type: typeLabel,
              brand,
              model,
              tr,
              btu,
              hp,
              qty,
              isClientSupplied: true
            });
          }
        }
      }
    }

    result.cadItems = [...itemsDedupeMap.values()];
    result.machines = [...machinesDedupeMap.values()];
    return result;
  }

  static detectDisciplines(normalizedText, projectType) {
    const disciplines = [];

    const hasAC = (
      normalizedText.includes('ar condicionado') ||
      normalizedText.includes('climatiza') ||
      normalizedText.includes('split') ||
      normalizedText.includes('vrf') ||
      normalizedText.includes('vrv') ||
      normalizedText.includes('chiller') ||
      normalizedText.includes('evaporadora') ||
      normalizedText.includes('condensadora') ||
      normalizedText.includes('built in') ||
      normalizedText.includes('built-in') ||
      normalizedText.includes('cassete') ||
      normalizedText.includes('hi wall') ||
      normalizedText.includes('hi-wall') ||
      normalizedText.includes('piso teto') ||
      normalizedText.includes('linha frigorígena') ||
      normalizedText.includes('tubulação de cobre') ||
      normalizedText.includes('difusor') ||
      normalizedText.includes('grelha') ||
      normalizedText.includes('damper') ||
      normalizedText.includes('r410') ||
      normalizedText.includes('r-410') ||
      normalizedText.includes('r32')
    );

    const hasExhaust = (
      normalizedText.includes('exaust') ||
      normalizedText.includes('ventilador') ||
      normalizedText.includes('renovador') ||
      normalizedText.includes('sicflux') ||
      normalizedText.includes('sicflu') ||
      normalizedText.includes('aci-400') ||
      normalizedText.includes('aci 400') ||
      normalizedText.includes('inline') ||
      normalizedText.includes('in line') ||
      normalizedText.includes('ar exterior') ||
      normalizedText.includes('renovação de ar') ||
      normalizedText.includes('aludec') ||
      normalizedText.includes('coifa') ||
      normalizedText.includes('berliner luft') ||
      normalizedText.includes('caixa ventiladora') ||
      normalizedText.includes('damper corta-fogo') ||
      normalizedText.includes('veneziana autofechante') ||
      normalizedText.includes('dvk')
    );

    const isKitchenExhaust = (
      normalizedText.includes('coifa') ||
      normalizedText.includes('melting') ||
      normalizedText.includes('berliner luft') ||
      normalizedText.includes('nbr 14518') ||
      normalizedText.includes('exaustão de cozinha')
    );

    const isHVAC = hasAC || hasExhaust || normalizedText.includes('hvac');

    if (hasAC) {
      disciplines.push('Climatização / Ar Condicionado (Expansão Direta)');
      disciplines.push('Rede Frigorígena & Isolamento');
    }

    if (hasExhaust) {
      disciplines.push('Ventilação & Exaustão Mecânica');
      disciplines.push('Rede de Dutos & Difusão de Exaustão');
    }

    if (isKitchenExhaust) {
      disciplines.push('Exaustão Industrial de Cozinha (NBR 14518)');
    }

    if (normalizedText.includes('duto') || hasAC || hasExhaust) {
      disciplines.push('Rede de Dutos & Difusão');
    }

    if (normalizedText.includes('eletric') || normalizedText.includes('quadro') || normalizedText.includes('cabo') || isHVAC) {
      disciplines.push('Comandos Elétricos & Força');
    }

    if (normalizedText.includes('hidraul') || normalizedText.includes('agua gelada') || normalizedText.includes('valvula')) {
      disciplines.push('Hidráulica & Drenagem');
    }

    if (disciplines.length === 0) {
      disciplines.push('Instalações Gerais / Climatização');
    }

    return { disciplines, isHVAC, hasAC, hasExhaust, isKitchenExhaust };
  }

  /**
   * Extrai equipamentos de climatização e ventilação explicitamente especificados em plantas/documentos CAD
   */
  static extractEquipmentFromDocuments(text) {
    const uniqueMachines = new Map();
    const cadData = this.parseCadMaterialListAndLegend(text);

    if (cadData.machines && cadData.machines.length > 0) {
      for (const cm of cadData.machines) {
        uniqueMachines.set(`${cm.type}_${cm.model || ''}_${cm.brand || ''}_${cm.tr || cm.btu || ''}`, {
          type: cm.type,
          brand: cm.brand || null,
          model: cm.model || null,
          tr: cm.tr || (cm.btu ? Number((cm.btu / 12000).toFixed(1)) : null),
          btu: cm.btu || (cm.tr ? Math.round(cm.tr * 12000) : null),
          qty: cm.qty || 1,
          isClientSupplied: cm.isClientSupplied !== false
        });
      }
    }

    const normalizeType = (raw) => {
      const up = (raw || '').toUpperCase().trim();
      if (up.includes('BUILT') || up.includes('DUTAD')) return 'BUILT IN';
      if (up.includes('CASSET')) return 'CASSETE';
      if (up.includes('WALL')) return 'HI WALL';
      if (up.includes('PISO')) return 'PISO TETO';
      return up;
    };

    // 1. Padrão completo: SPLIT TIPO X FABRICANTE Y CAPACIDADE Z BTU/h [VAZÃO W m³/h]
    const fullPattern = /split\s+tipo\s+([a-zá-ú\s\d]+?)\s+fabricante\s+([a-z]+)\s+capacidade\s+([\d.,]+)\s*btu\/h(?:\s*-\s*vaz[aã]o\s+de\s+ar\s+([\d.,]+)\s*m[³3]\/h)?/gi;
    let m;
    while ((m = fullPattern.exec(text)) !== null) {
      const type = normalizeType(m[1]);
      const brand = m[2].trim().toUpperCase();
      const btu = parseInt(m[3].replace(/[.,]/g, ''), 10);
      const m3h = m[4] ? parseInt(m[4].replace(/[.,]/g, ''), 10) : null;
      const key = `${type}_${btu}`;
      if (!uniqueMachines.has(key)) {
        uniqueMachines.set(key, { type, brand, model: null, tr: Number((btu / 12000).toFixed(1)), btu, m3h, qty: 1 });
      } else {
        const ex = uniqueMachines.get(key);
        if (!ex.m3h && m3h) ex.m3h = m3h;
      }
    }

    // 2. Padrão direto de Splits por capacidade (somente se não tiver sido capturado pelo padrão 1)
    const directPattern = /(?:split\s+(?:tipo\s+)?(built[\s-]?in|cassete|hi[\s-]?wall|piso[\s-]?teto))\s*(?:(?:fabricante\s+[a-z]+\s+)?capacidade\s*)?([\d.,]+)\s*btu/gi;
    while ((m = directPattern.exec(text)) !== null) {
      const type = normalizeType(m[1]);
      const btu = parseInt(m[2].replace(/[.,]/g, ''), 10);
      const key = `${type}_${btu}`;
      if (!uniqueMachines.has(key)) {
        uniqueMachines.set(key, { type, brand: null, model: null, tr: Number((btu / 12000).toFixed(1)), btu, m3h: null, qty: 1 });
      }
    }

    // 3. Padrão Daikin VRV — Condensadoras (ex: RXYMQ8TTLT = 8 HP = ~76.800 BTU/h)
    const daikinCondenserMatches = [...text.matchAll(/(?:(\d+)\s+)?(?:UNIDADE\s+CONDENSADORA\s+(?:MODELO\s+)?)?(RXYMQ\w+)/gi)];
    let vrvCondensersCount = 0;
    let vrvCondenserBtu = 0;
    for (const dcm of daikinCondenserMatches) {
      const rawQty = dcm[1] ? parseInt(dcm[1], 10) : 1;
      const model = dcm[2].toUpperCase();
      const hpMatch = model.match(/RXYMQ(\d+)/i);
      const hp = hpMatch ? parseInt(hpMatch[1], 10) : 8;
      const btuPerHp = 9600;
      const btu = hp * btuPerHp;
      vrvCondensersCount = Math.max(vrvCondensersCount, rawQty);
      vrvCondenserBtu += (rawQty * btu);
      uniqueMachines.set(`COND_${model}`, { type: 'CONDENSADORA VRV', brand: 'DAIKIN', model, tr: Number((btu / 12000).toFixed(1)), btu, qty: rawQty });
    }
    const hasDaikinVRV = /rxymq|daikin|vrv|vrf/i.test(text) && (vrvCondensersCount > 0 || /rxy/i.test(text));

    // 4. Padrão Daikin VRV — Evaporadoras (FXAQ, FXFQ, FXSQ, FXHQ)
    const daikinEvapMatches = [...text.matchAll(/(?:(\d+)\s+)?UNIDADE\s+EVAPORADORA\s+DO\s+TIPO\s+([A-Z\s\d]+?)\s+MODELO\s+(FX[A-Z0-9]+)/gi)];
    let vrvEvaporatorsCount = 0;
    for (const dem of daikinEvapMatches) {
      const rawQty = dem[1] ? parseInt(dem[1], 10) : 1;
      const rawType = dem[2].trim();
      const modelClean = dem[3].match(/FX[A-Z0-9]+/i)?.[0]?.toUpperCase() || dem[3].toUpperCase();
      vrvEvaporatorsCount += rawQty;
      
      let btu = 18000;
      if (modelClean.includes('20')) btu = 7000;
      else if (modelClean.includes('25')) btu = 9500;
      else if (modelClean.includes('50')) btu = 19000;
      else if (modelClean.includes('100')) btu = 36000;
      
      const type = normalizeType(rawType);
      uniqueMachines.set(`EVAP_${modelClean}`, { type, brand: 'DAIKIN', model: modelClean, tr: Number((btu / 12000).toFixed(1)), btu, qty: rawQty });
    }

    // 5. Coifas Industriais de Restaurante / Cocção (Melting Multi Vortex UV)
    const meltingHoodMatches = [...text.matchAll(/COIFA\s+EM\s+AÇO\s+INOX[\s\S]*?FABRICANTE\s+MELTING[\s\S]*?DIMENSÕES\s*-\s*([\d.,]+)\s*x\s*([\d.,]+)/gi)];
    const hasMeltingHoods = meltingHoodMatches.length > 0 || (/melting/i.test(text) && /coifa/i.test(text));
    const numHoods = hasMeltingHoods ? Math.max(1, meltingHoodMatches.length) : 0;

    // 6. Exaustores e Caixas Ventiladoras Industriais (Berliner Luft ou vazões de grande porte)
    const fanMatches = [...text.matchAll(/(EXAUSTOR|CAIXA\s+VENTILADORA)[\s\S]*?BERLINER\s*LUFT[\s\S]*?VAZÃO\s+DE\s*([\d.,]+)\s*m[³3]\/h/gi)];
    const hasBerlinerLuft = fanMatches.length > 0 || /berliner\s*luft/i.test(text);
    let totalIndustrialAirflow = 0;
    for (const fm of fanMatches) {
      const val = parseInt(fm[2].replace(/[.,]/g, ''), 10);
      if (val > 0) totalIndustrialAirflow += val;
    }

    // 7. Dampers Corta-Fogo Motorizados com Solenoide
    const damperMatches = [...text.matchAll(/DAMPER\s+CORTA\s+FOGO[\s\S]*?SOLENOIDE/gi)];
    const numDampers = damperMatches.length > 0 ? damperMatches.length : (text.match(/damper\s+corta\s+fogo/gi)?.length || 0);

    // 8. Sicflux / Ventilação e Exaustão Mecânica
    const hasSicflux = /sicflu|aci-?400|inline\s*100|in\s*line\s*b/i.test(text);
    const numSicfluxExhaust = hasSicflux ? (text.match(/sicflu|aci-?400|inline\s*100|in\s*line\s*b/gi)?.length || 1) : 0;

    // 9. Central de Água Gelada (CAG) e Dutos Explícitos
    const hasCAG = cadData.refrigerantType === 'CAG_AGUA';
    const explicitDuctSegments = extractDuctSegmentsFromText(text);
    const hasDucts = explicitDuctSegments.length > 0;

    const machines = [...uniqueMachines.values()];
    const evapMachines = machines.filter(m => !m.type.includes('CONDENSADORA'));
    const condMachines = machines.filter(m => m.type.includes('CONDENSADORA'));
    const totalEvapBtu = evapMachines.reduce((s, m) => s + ((m.btu || 0) * (m.qty || 1)), 0);
    const totalCondBtu = condMachines.reduce((s, m) => s + ((m.btu || 0) * (m.qty || 1)), 0);

    // REGRA DE ENGENHARIA SABRAR:
    // Evaporadora e condensadora formam o mesmo circuito frigorígeno.
    // NUNCA somar ambas como cargas térmicas independentes (evita duplicar capacidade de 60 TR para 120 TR).
    const totalBtu = hasDaikinVRV
      ? (vrvCondenserBtu || totalEvapBtu)
      : (totalEvapBtu > 0 && totalCondBtu > 0
          ? Math.max(totalEvapBtu, totalCondBtu)
          : (totalEvapBtu || totalCondBtu || machines.reduce((s, m) => s + ((m.btu || 0) * (m.qty || 1)), 0)));
    const totalTR = Number((totalBtu / 12000).toFixed(1));
    const numBuiltIn = machines.filter(m => m.type.includes('BUILT')).reduce((s, m) => s + (m.qty || 1), 0);
    const numCassete = machines.filter(m => m.type.includes('CASSETE')).reduce((s, m) => s + (m.qty || 1), 0);
    const numHiWall = machines.filter(m => m.type.includes('HI WALL')).reduce((s, m) => s + (m.qty || 1), 0);
    const totalDuctAirflow = machines
      .filter(m => m.type.includes('BUILT') || m.type.includes('DUTAD') || m.type.includes('SPLITÃO'))
      .reduce((s, m) => s + (m.m3h || 0), 0);

    const isKitchenExhaust = hasMeltingHoods || hasBerlinerLuft || totalIndustrialAirflow >= 5000 || /nbr\s*14518/i.test(text);
    const hasExplicitDiffusion = (cadData.cadItems || []).some(i => i.category === 'Difusão de Ar');
    const hasACSystem = machines.length > 0 || hasExplicitDiffusion || hasDaikinVRV || /ar\s*condicionado|split|climatiza|chiller|vrf|vrv|evaporadora|condensadora|built[\s-]?in|cassete|hi[\s-]?wall|difusor|grelha/i.test(text);
    const hasGeneralExhaust = hasSicflux || isKitchenExhaust || /exaustor|ventilador\s+fabricante|caixa\s*ventiladora|rede\s+de\s+dutos\s+de\s+exaust|renovador|duto\s+de\s+exaust|veneziana\s+autofechante|difusor\s+fabricante\s+multivac|dvk/i.test(text);

    const hasAC = machines.length > 0 || hasExplicitDiffusion || hasDaikinVRV || hasCAG || hasDucts || hasACSystem;

    return {
      hasExplicitEquipment: machines.length > 0 || hasExplicitDiffusion || hasDaikinVRV || isKitchenExhaust || hasSicflux || hasCAG || hasDucts,
      hasACSystem: hasAC,
      hasExhaustSystem: hasGeneralExhaust,
      hasCAG,
      hasDucts,
      explicitDuctSegments,
      machines,
      totalBtu,
      totalTR,
      numBuiltIn,
      numCassete,
      numHiWall,
      totalDuctAirflow,
      hasSicflux,
      numSicfluxExhaust,
      numExhaust: isKitchenExhaust ? (fanMatches.length || 1) : (hasSicflux ? numSicfluxExhaust : 0),
      isVRV: hasDaikinVRV,
      vrvCondensersCount,
      vrvEvaporatorsCount,
      isKitchenExhaust,
      hasMeltingHoods,
      numHoods,
      hasBerlinerLuft,
      totalIndustrialAirflow,
      numDampers,
      cadData,
      isMPU: cadData.isMPU
    };
  }

  /**
   * Extração e dimensionamento inteligente da área real da edificação
   * Evita falsos positivos como aberturas de retorno e áreas livres de grelhas (ex: 0,14m² livre)
   */
  static extractAreaFromDocuments(normalizedDoc, text, project, detectedTotalBtu, eqData = null) {
    // 1. Procura tags explícitas de área total nas notas do projeto ou texto
    const explicitTag = normalizedDoc.match(/(?:área|area)\s*(?:total|construída|útil|da obra)?\s*(?:[:=]|de)\s*(\d+(?:[.,]\d+)?)\s*(?:m²|m2)/i);
    if (explicitTag) {
      const a = Number(explicitTag[1].replace(',', '.'));
      if (a >= 25 && a <= 15000) return a;
    }

    // 2. Soma áreas de cômodos técnicos/arquitetônicos identificados no projeto (ex: área = 15,59m², área = 23,69m²)
    const roomAreaRegex = /(?:área|area)\s*=\s*(\d+(?:[.,]\d+)?)\s*m[²2]/gi;
    const roomMatches = [];
    let rm;
    while ((rm = roomAreaRegex.exec(text)) !== null) {
      const val = Number(rm[1].replace(',', '.'));
      if (val >= 2.0 && val <= 180) {
        roomMatches.push(val);
      }
    }
    if (roomMatches.length >= 3) {
      const sumRooms = Math.round(roomMatches.reduce((s, a) => s + a, 0));
      if (sumRooms >= 40) {
        const hasMultipleFloors = /pavimento|térreo|subsolo|cobertura|1º|2º|duplo/i.test(normalizedDoc);
        return hasMultipleFloors ? Math.round(sumRooms * 1.6) : sumRooms;
      }
    }

    // 3. Se for sistema VRV + Exaustão Industrial de Restaurante (ex: Bibi Sucos)
    if (eqData?.isKitchenExhaust || eqData?.isVRV) {
      return 260; // Área operacional mista restaurante (salão 140m² + cozinha/bar 70m² + mezanino/varanda 50m²)
    }

    // 4. Validação cruzada por capacidade térmica total de máquinas extraídas
    if (detectedTotalBtu && detectedTotalBtu > 0) {
      const isRes = project.project_type === 'Residencial' || /resid[eê]nc/i.test(project.name || '') || /resid[eê]nc/i.test(project.client || '');
      const btuPerM2 = isRes ? 550 : 750;
      return Math.round(detectedTotalBtu / btuPerM2);
    }

    // 2. Busca por salão principal ou áreas expressivas (ex: SALÃO DE VENDAS 854,80 m²)
    const mainHallMatch = normalizedDoc.match(/(?:sal[aã]o|vendas|galp[aã]o|piso|pavimento|t[eé]rreo)[^.\n\r\d]{0,40}?(\d+(?:[.,]\d+)?)\s*(?:m²|m2|metros\s*quadrados)/i);
    if (mainHallMatch) {
      const val = Number(mainHallMatch[1].replace(',', '.'));
      if (val >= 50 && val <= 10000) {
        const otherMatches = [...normalizedDoc.matchAll(/(?:loja|padaria|a[çc]ougue|administra|panifica)[^.\n\r\d]{0,30}?(\d+(?:[.,]\d+)?)\s*(?:m²|m2)/gi)];
        let sumAnnexes = 0;
        for (const om of otherMatches) {
          const oval = Number(om[1].replace(',', '.'));
          if (oval >= 10 && oval <= 200 && oval !== val) sumAnnexes += oval;
        }
        return Math.round(val + sumAnnexes);
      }
    }

    // 5. Busca genérica por m², rejeitando explicitamente áreas de grelha/retorno/damper menores que 20 m²
    const genericMatches = [...normalizedDoc.matchAll(/(\d+(?:[.,]\d+)?)\s*(?:m²|m2|metros quadrados)/gi)];
    for (const gm of genericMatches) {
      const val = Number(gm[1].replace(',', '.'));
      const surrounding = normalizedDoc.slice(Math.max(0, gm.index - 30), gm.index + 35);
      const isDuctOrGrilleOpening = /(?:livre|abertura|retorno|duto|grelha|veneziana|filtro|vão|damper)/i.test(surrounding);
      if (!isDuctOrGrilleOpening && val >= 35 && val <= 10000) {
        return val;
      }
    }

    // 6. Dimensionamento de quiosques de shopping Havaianas SEM áreas no memorial
    const isSmallMallKiosk = (
      (project.client && project.client.toLowerCase().includes('havaianas')) ||
      (project.name && project.name.toLowerCase().includes('havaianas'))
    );
    if (isSmallMallKiosk) {
      return 159;
    }

    const isRes = project.project_type === 'Residencial' || /resid/i.test(project.name || '');
    if (isRes) return 380;
    if (project.project_type === 'Industrial') return 600;
    return 220;
  }

  /**
   * Detecta se a documentação contém projeto executivo de HVAC explícito (Modo A)
   * ou se consiste apenas em plantas de arquitetura / layout civil (Modo B).
   */
  static detectHVACMode(normalizedDoc, hasExplicitEquipment = false, hasDucts = false) {
    if (hasExplicitEquipment || hasDucts) return 'MODO_A_DIRETO';

    const explicitHVACPatterns = [
      'quadro de cargas termicas',
      'quadro de materiais hvac',
      'projeto executivo de climatizacao',
      'planta executiva de dutos',
      'diagrama unifilar hvac',
      'isométrico frigorigeno',
      'especificacao de bitolas de cobre',
      'tabela suporte metálico',
      'detalhe do armafix',
      'dutos de insuflamento e retorno',
      'sonodec',
      'aludec',
      'sicflux',
      'split tipo built in',
      'split tipo cassete',
      'unidade condensadora',
      'unidade evaporadora',
      'vazao cfm',
      'm3/h insuflamento'
    ];

    const hasExplicit = explicitHVACPatterns.some(pat => normalizedDoc.includes(pat));
    return hasExplicit ? 'MODO_A_DIRETO' : 'MODO_B_ENGENHARIA_REVERSA';
  }

  /**
   * Calcula a carga térmica estimada da edificação em BTU/h e TR conforme NBR 16401 e ASHRAE 90.1
   */
  static calculateThermalLoad(areaSqm, projectType, normalizedDoc, explicitBtu = null) {
    if (explicitBtu && explicitBtu > 0) {
      return {
        btuPerSqm: Math.round(explicitBtu / (areaSqm || 1)),
        totalBtu: explicitBtu,
        totalTR: Number((explicitBtu / 12000).toFixed(1)),
        standardApplied: 'Levantamento Direto de Projeto Executivo HVAC Carrier / NBR 16401',
        recommendedSystem: explicitBtu > 180000 ? 'Sistema Multi-Split / Built-In Dutado com Dutos MPU' : 'Splits Inverter'
      };
    }

    let btuPerSqm = 750; // Padrão comercial / escritório
    const isRes = projectType === 'Residencial' || /resid/i.test(normalizedDoc);

    if (projectType === 'Hospitalar' || normalizedDoc.includes('hospital') || normalizedDoc.includes('sala limpa')) {
      btuPerSqm = 950;
    } else if (projectType === 'Industrial' || normalizedDoc.includes('fabrica') || normalizedDoc.includes('galpao')) {
      btuPerSqm = 900;
    } else if (normalizedDoc.includes('vidro') || normalizedDoc.includes('fachada envidracada') || normalizedDoc.includes('cobertura')) {
      btuPerSqm = 850;
    } else if (isRes) {
      btuPerSqm = 550;
    }

    const totalBtu = Math.round(areaSqm * btuPerSqm);
    const totalTR = Number((totalBtu / 12000).toFixed(1));

    return {
      btuPerSqm,
      totalBtu,
      totalTR,
      standardApplied: 'ABNT NBR 16401:2008 (Partes 1, 2 e 3) & ASHRAE Standard 90.1',
      recommendedSystem: totalTR > 25 ? 'Sistema VRF Inverter com Dutos MPU' : (totalTR > 10 ? 'Multi-Split / Built-in Dutado' : 'Splits Cassete / Hi-Wall Inverter')
    };
  }

  /**
   * Encontra material correspondente na Base Central SABRAR (materials) sem poluir a base oficial,
   * priorizando a base viva (banco de dados PostgreSQL, aliases, sinônimos e atributos técnicos)
   * antes de qualquer JSON ou fallback (Codex Regras 4 e 5).
   */
  static async findOrCreateMaterial(itemDef, systemContext = '', options = {}) {
    // options.materialDb permite consultar uma base isolada (testes / simulação) sem tocar a produção
    return await searchLiveMaterialBase(options.materialDb || db, itemDef, {
      ...options,
      systemContext
    });
  }

  /**
   * Executa a análise integral dos documentos e gera o orçamento estimado (Seções 1 a 35)
   */
  static async analyzeProjectDocuments(projectId, customText = '', options = {}) {
    if (customText && typeof customText === 'object') {
      options = customText;
      customText = options.customText || '';
    }
    const isDryRun = Boolean(options?.dryRun);
    const packagingMode = options?.packagingMode || 'CAIXA_FECHADA_10';
    const commercialMarkupPercent = Number(options?.commercialMarkupPercent || 0);

    // ETAPA 1 & 2: Inventariar documentos por página com coordenadas e tabelas
    const {
      project,
      files,
      documentsAnalyzed,
      documentContent,
      structuredDocuments,
      pdfAttachments,
      vectorDocuments
    } = await this.readProjectDocuments(projectId, customText, options);
    const coefficients = resolveCoefficients(options?.companyCoefficients);

    // Validação estrita: se não há documentos nem anotações técnicas, não gera orçamento fictício
    if ((!files || files.length === 0) && (!documentContent || !documentContent.trim())) {
      return {
        analysisId: null,
        budgetId: null,
        projectId,
        projectName: project.name,
        hvacMode: 'SEM_DOCUMENTACAO',
        confidenceScore: 0.0,
        confidence_metrics: {
          document_coverage_percent: 0,
          geometry_completeness_percent: 0,
          price_coverage_percent: 0,
          overall_completeness_percent: 0
        },
        thermalLoad: null,
        totalEstimatedMaterialsCost: 0,
        pricedMaterialsSubtotal: 0,
        totalServicesCost: 0,
        totalEquipmentCost: 0,
        totalFinalCost: 0,
        budgetCompletenessStatus: 'SEM_DOCUMENTACAO',
        materials: [],
        services: [],
        equipment: [],
        unpriced_items: [],
        unmeasured_items: [],
        budget: {
          materials: [],
          materials_total: 0,
          priced_materials_subtotal: 0,
          unpriced_items: [],
          unmeasured_items: [],
          pending_items: ['Nenhum documento técnico (plantas CAD, memoriais descritivos ou notas) foi anexado ao projeto. Faça o upload dos arquivos para processar o levantamento executivo.'],
          thermal_load: null,
          hvac_mode: 'SEM_DOCUMENTACAO',
          completeness_status: 'SEM_DOCUMENTACAO'
        },
        analysis_metadata: {
          project_id: projectId,
          documents_analyzed: [],
          structured_pages_count: 0,
          disciplines_detected: [],
          hvac_mode: 'SEM_DOCUMENTACAO',
          thermal_load: null,
          validated_geometry: null,
          confidence_metrics: {
            document_coverage_percent: 0,
            geometry_completeness_percent: 0,
            price_coverage_percent: 0,
            overall_completeness_percent: 0
          },
          items: [],
          historical_suggestions: [],
          document_conflicts: ['Documentação Técnica Ausente']
        },
        message: 'Nenhum documento técnico encontrado. Não é possível gerar levantamento executivo sem documentação base.'
      };
    }

    // Execução e captura real do Agente de IA via LLM (Gemini / OpenAI) com validação por Schema
    const llmConfig = BudgetLLMClient.getProviderConfig();
    let rawLLMResponse = null;
    let llmValidation = { valid: false, hasContent: false, errors: [], data: null };
    let llmErrorMsg = null;
    try {
      if (options?.mockLLMResponse !== undefined) {
        rawLLMResponse = options.mockLLMResponse;
      } else if (!options?.skipLLM) {
        rawLLMResponse = await BudgetLLMClient.analyzeProject({
          project,
          documentsContent: documentContent,
          structuredDocuments,
          pdfAttachments,
          catalogSample: SABRAR_MATERIALS_2026.slice(0, 40),
          historicalContext: ''
        });
      }
      if (rawLLMResponse) {
        llmValidation = BudgetLLMClient.validateLLMExtractionSchema(rawLLMResponse);
      }
    } catch (llmErr) {
      llmErrorMsg = llmErr.message;
      console.warn('[AIAnalysisService] LLM não executou, utilizando motor determinístico oficial:', llmErr.message);
    }

    const llmData = (llmValidation.valid && llmValidation.hasContent) ? llmValidation.data : null;

    const normalizedDoc = (
      documentContent + ' ' +
      (project.name || '') + ' ' +
      (project.project_type || '') + ' ' +
      (project.notes || '')
    ).toLowerCase();

    const { disciplines, isHVAC } = this.detectDisciplines(normalizedDoc, project.project_type);

    // Extrai equipamentos e tabelas de plantas/especificações CAD
    const eqData = this.extractEquipmentFromDocuments(documentContent);
    const cadData = eqData.cadData || this.parseCadMaterialListAndLegend(documentContent);

    // Integra equipamentos extraídos e validados pela IA (LLM) ao conjunto de máquinas do projeto
    if (llmData && Array.isArray(llmData.equipment) && llmData.equipment.length > 0) {
      for (const llmEq of llmData.equipment) {
        const alreadyExists = eqData.machines.some(m =>
          (llmEq.model && m.model && m.model.toLowerCase() === llmEq.model.toLowerCase()) ||
          (m.type.toLowerCase().includes(llmEq.type.toLowerCase()) && m.tr === llmEq.tr && m.qty === llmEq.qty)
        );
        if (!alreadyExists) {
          eqData.machines.push({
            type: llmEq.type.toUpperCase(),
            brand: llmEq.brand || null,
            model: llmEq.model || null,
            tr: llmEq.tr || (llmEq.btu ? Number((llmEq.btu / 12000).toFixed(1)) : null),
            btu: llmEq.btu || (llmEq.tr ? Math.round(llmEq.tr * 12000) : null),
            qty: llmEq.qty || 1,
            isClientSupplied: llmEq.supplyByClient !== false,
            sourceFile: llmEq.sourceFile,
            sourcePage: llmEq.sourcePage,
            evidence: llmEq.evidence
          });
          eqData.hasExplicitEquipment = true;
          eqData.hasACSystem = true;
        }
      }
      // Recalcula carga térmica das máquinas sem duplicar evaporadora + condensadora
      const evaps = eqData.machines.filter(m => !m.type.includes('CONDENSADORA'));
      const conds = eqData.machines.filter(m => m.type.includes('CONDENSADORA'));
      const evapBtu = evaps.reduce((s, m) => s + ((m.btu || 0) * (m.qty || 1)), 0);
      const condBtu = conds.reduce((s, m) => s + ((m.btu || 0) * (m.qty || 1)), 0);
      eqData.totalBtu = (evapBtu > 0 && condBtu > 0) ? Math.max(evapBtu, condBtu) : (evapBtu || condBtu);
      eqData.totalTR = Number((eqData.totalBtu / 12000).toFixed(1));
    }

    // Identifica Modo A vs Modo B (Seção 35)
    const hasLLMExplicitItems = Boolean(llmData && (llmData.materials.length > 0 || llmData.equipment.length > 0 || llmData.ductSegments.length > 0));
    const hvacMode = this.detectHVACMode(normalizedDoc, eqData.hasExplicitEquipment || hasLLMExplicitItems, eqData.hasDucts);

    // Identifica Contexto da Obra para a Base Econômica SABRAR (Regra 3)
    let systemContext = 'AC - DIRETA - COBRE';
    if (cadData.refrigerantType === 'COBRE_EXPANSAO_DIRETA') {
      systemContext = 'AC - DIRETA - COBRE';
    } else if (normalizedDoc.includes('cozinha')) {
      systemContext = 'EX Cozinha';
    } else if (normalizedDoc.includes('pressuriz')) {
      systemContext = 'Pressurização';
    } else if (normalizedDoc.includes('exaust') || normalizedDoc.includes('ventilacao')) {
      systemContext = 'EX_AE';
    } else if (eqData.hasCAG || normalizedDoc.includes('chiller') || normalizedDoc.includes('fancoil') || normalizedDoc.includes('agua gelada') || normalizedDoc.includes('água gelada') || normalizedDoc.includes('sch 40') || normalizedDoc.includes('indireta')) {
      systemContext = 'AC - INDIRETA - AGUA';
    }

    // Estimativa da área da obra (informativa no Modo A; usada para engenharia reversa apenas no Modo B)
    const estimatedArea = this.extractAreaFromDocuments(normalizedDoc, documentContent, project, eqData.totalBtu, eqData);

    // Cálculo da Carga Térmica (NBR 16401 & ASHRAE)
    const thermalLoad = this.calculateThermalLoad(estimatedArea, project.project_type, normalizedDoc, eqData.totalBtu);

    // =========================================================================
    // GEOMETRIA UNIFICADA (BASE ÚNICA PARA MATERIAIS, ACESSÓRIOS E MÃO DE OBRA)
    // Prioridade: revisão manual > geometria vetorial com escala validada > cota textual > IA (PREVISAO)
    // =========================================================================
    const ductMeasurement = options?.precomputedDuctMeasurement || measureProjectDucts(vectorDocuments || []);
    const sectionBase = resolveDuctSections({
      reviewedSections: options?.reviewedDuctSections,
      measuredSections: ductMeasurement.sections,
      textSegments: eqData.explicitDuctSegments || [],
      llmSegments: llmData?.ductSegments || []
    });
    const rawDuctSegments = sectionBase.sections;

    const modelsOf = (re) => eqData.machines.filter(m => re.test(m.type || '')).map(m => m.model).filter(Boolean);
    const refrigerantGeometry = measureRefrigerantCircuits(vectorDocuments || [], {
      evaporatorModels: modelsOf(/EVAPORADORA|SPLIT/i),
      condenserModels: modelsOf(/CONDENSADORA/i)
    });

    // Diâmetros documentados: somente quando o texto do projeto contém os diâmetros citados
    const llmSpecLine = (llmData?.refrigerantLines || []).find(r => r.liquidDiameter && r.suctionDiameter);
    const documentedCopperSpec = llmSpecLine &&
      documentContent.includes(String(llmSpecLine.liquidDiameter).replace(/"/g, '')) &&
      documentContent.includes(String(llmSpecLine.suctionDiameter).replace(/"/g, ''))
      ? {
          liquid: llmSpecLine.liquidDiameter,
          suction: llmSpecLine.suctionDiameter,
          liquidWall: llmSpecLine.wallThickness || '1/32"',
          suctionWall: llmSpecLine.wallThickness || '1/16"',
          liquidTemper: 'FLEXÍVEL',
          suctionTemper: 'RÍGIDO'
        }
      : null;

    const ductGeo = computeSectionGeometry(rawDuctSegments);
    const validatedGeometry = {
      ductSource: sectionBase.source,
      ductSections: rawDuctSegments,
      ductViews: ductMeasurement.views,
      ductExcluded: ductMeasurement.excluded,
      ductMeasurementSummary: ductMeasurement.summary,
      totalDuctOccurrences: rawDuctSegments.length,
      ductNetAreaSqm: ductGeo.totalNetAreaM2,
      ductLinearMeters: ductGeo.totalLinearM,
      ductMeasurementStatus: rawDuctSegments.length > 0
        ? (sectionBase.source === 'DECLARACAO_IA' ? 'PREVISAO' : 'MEDIDO')
        : ((eqData.explicitDuctSegments || []).length > 0 || cadData.isMPU ? 'PENDENTE_MEDICAO' : 'NAO_APLICAVEL'),
      documentedMpuAreaSqm: cadData.explicitMpuAreaSqm || null,
      hasExternal30mmDuctNote: Boolean(cadData.hasExternalDeck || llmData?.scopeFlags?.hasExternal30mmDuctNote),
      externalDuctAreaSqm: options?.measuredExternalDuctAreaSqm != null ? Number(options.measuredExternalDuctAreaSqm) : null,
      refrigerantCircuits: refrigerantGeometry.circuits,
      refrigerantMeasurementStatus: refrigerantGeometry.status,
      refrigerantNotes: refrigerantGeometry.notes,
      packagingMode,
      coefficients
    };

    // Estruturas de saída das 2 camadas (Seção 29, 30 e 31)
    const auditItems = [];
    const budgetMaterials = [];
    const pendingItems = [];
    const unpricedItems = [];
    const unmeasuredItems = [];
    const historicalSuggestions = [];
    const documentConflicts = [];

    const isMaintenanceProject = Boolean(
      (project.name && /manuten/i.test(project.name)) ||
      (project.project_type && /manuten/i.test(project.project_type))
    );

    const isHeavyKitchenVRVSystem = !isMaintenanceProject && (
      eqData.isKitchenExhaust && (eqData.isVRV || eqData.hasMeltingHoods || eqData.totalIndustrialAirflow >= 5000)
    );

    let requiredItems = [];

    let ductTakeoff = null;
    let refrigerantTakeoff = null;
    const interpretationIssues = [];

    if (isHVAC) {
      if (hvacMode === 'MODO_A_DIRETO' || isHeavyKitchenVRVSystem) {
        // =========================================================================
        // MODO A — PROJETO EXECUTIVO: DOCUMENTADO → MEDIDO → CALCULADO → PREVISÃO → PENDENTE
        // =========================================================================
        requiredItems = [];
        const isMPU = cadData.isMPU || eqData.isMPU;

        // 1. DIFUSÃO E ELEMENTOS DOCUMENTADOS NA LISTA DE MATERIAL (uma ocorrência física, mesmo repetida em pranchas)
        for (const cItem of (cadData.cadItems || []).filter(item => item.category === 'Difusão de Ar')) {
          requiredItems.push({
            itemNum: cItem.itemNum || null,
            name: cItem.name,
            category: 'Difusão de Ar',
            unit: normalizeUnit(cItem.unit || 'und'),
            quantity: cItem.quantity,
            dimensions: cItem.dimensions || null,
            brand: cItem.brand || null,
            defaultPrice: null,
            measurementStatus: 'DOCUMENTADO',
            origin: cItem.reason,
            sourceFiles: documentsAnalyzed,
            keywords: cItem.keywords,
            reason: cItem.reason,
            evidence: cItem.reason
          });
        }

        // Chamadas "DUTO DOTADO DE TELA METÁLICA PARA RETORNO" na planta (contagem real de chamadas)
        if (cadData.hasReturnMeshNote) {
          const n = cadData.returnMeshCalloutsCount || 0;
          requiredItems.push({
            name: 'TELA METÁLICA PARA DUTO DE RETORNO DE AR',
            category: 'Difusão de Ar',
            unit: 'un',
            quantity: n > 0 ? n : null,
            defaultPrice: null,
            measurementStatus: n > 0 ? 'DOCUMENTADO' : 'PENDENTE_MEDICAO',
            origin: 'Chamadas na planta: "DUTO DOTADO DE TELA METÁLICA PARA RETORNO DE AR"',
            premises: ['Dimensão da tela = seção do duto de retorno indicado; confirmar especificação da malha.'],
            reason: n > 0 ? `${n} chamada(s) na planta` : 'Nota de legenda sem chamada localizada na planta'
          });
        }

        // Conexões circulares Ø (colarinhos/flexíveis): quantidade de conexões documentada; comprimento de flexível pendente
        const phiCount = (cadData.circularDuctCallouts || []).length;
        if (phiCount > 0) {
          const diam = [...new Set(cadData.circularDuctCallouts)].join('/');
          requiredItems.push({
            name: `DUTO FLEXIVEL ISOLADO Ø${diam}MM`,
            category: 'Dutos',
            unit: 'm',
            quantity: null,
            defaultPrice: null,
            measurementStatus: 'PENDENTE_MEDICAO',
            origin: `${phiCount} chamada(s) Ø${diam} na planta`,
            reason: `${phiCount} conexão(ões) circulares Ø${diam} localizadas; comprimento do flexível não cotado`
          });
          unmeasuredItems.push({ item: `Duto flexível Ø${diam}`, reason: 'PENDENTE_MEDICAO', details: `${phiCount} conexões localizadas; informar comprimento por conexão na revisão.` });
        }

        // 2. DUTOS, ACESSÓRIOS E SUPORTAÇÃO — mesma base de trechos
        if (isMPU || rawDuctSegments.length > 0 || (eqData.explicitDuctSegments || []).length > 0) {
          ductTakeoff = buildDuctItems({
            sections: rawDuctSegments,
            isMPU,
            isBlackSteel: Boolean(cadData.isBlackSteel && !isMPU),
            hasExternalNote: validatedGeometry.hasExternal30mmDuctNote,
            externalAreaSqm: validatedGeometry.externalDuctAreaSqm,
            coefficients,
            packagingMode
          });
          requiredItems.push(...ductTakeoff.items);
          unmeasuredItems.push(...ductTakeoff.pending);
        }

        // 3. REDE FRIGORÍGENA — por circuito
        const hasRefrigerantScope = cadData.refrigerantType === 'COBRE_EXPANSAO_DIRETA' ||
          (eqData.machines.some(m => /CONDENSADORA/i.test(m.type)) && /refrigerante|cobre/i.test(documentContent));
        if (hasRefrigerantScope) {
          refrigerantTakeoff = buildRefrigerantItems({
            circuits: validatedGeometry.refrigerantCircuits,
            machines: eqData.machines,
            documentedSpec: documentedCopperSpec,
            reviewedRuns: options?.reviewedRefrigerantRuns,
            coefficients
          });
          requiredItems.push(...refrigerantTakeoff.items);
          unmeasuredItems.push(...refrigerantTakeoff.pending);
        }

        // 4. RECONCILIAÇÃO PARSER × IA × PDFs (identidade técnica e ocorrência física)
        const reconciliation = reconcileExtractions({
          requiredItems,
          llmMaterials: llmData?.materials || [],
          documentTables: cadData.documentTables || [],
          geometryOwnedFamilies: ['mpu', 'cobre', 'isolamento', 'perfilado', 'tirante', 'chumbador', 'cabo']
        });
        documentConflicts.push(...reconciliation.documentConflicts);
        interpretationIssues.push(...reconciliation.interpretationIssues);
      } else {
        // MODO B — Engenharia Reversa por Arquitetura & NBR 16401 (Somente quando o documento NÃO tem itens executivos)
        const modeExplanation = `Engenharia reversa por arquitetura (Carga Térmica: ${thermalLoad.totalTR} TR / ${thermalLoad.totalBtu.toLocaleString('pt-BR')} BTU/h segundo NBR 16401)`;
        requiredItems = [
          {
            name: 'PAINEL MPU 20MM x 2,0 x 1,2M (2,4m²)',
            category: 'Rede de Dutos',
            unit: 'PÇ',
            quantity: Math.ceil((estimatedArea * 0.35 * 1.40) / 2.4),
            defaultPrice: null,
            measurementStatus: 'PREVISAO',
            premises: ['Modo B: estimativa preliminar por área da edificação (sem projeto executivo)'],
            keywords: ['mpu', 'painel duto', 'pre-isolado'],
            reason: `Estimativa Preliminar Modo B: ${estimatedArea}m² × 0.35 × 1.40 / 2.4m² (${modeExplanation})`
          },
          {
            name: '3/8" – 9,53mm – e=1/32" tubulação de cobre FLEXÍVEL',
            category: 'Climatização - Expansão Direta',
            unit: 'm',
            quantity: Math.round(estimatedArea * 0.22),
            defaultPrice: null,
            measurementStatus: 'PREVISAO',
            premises: ['Modo B: estimativa preliminar por área da edificação (sem projeto executivo)'],
            keywords: ['cobre 3/8', 'tubo cobre 3/8'],
            reason: `Estimativa Preliminar Modo B: Linha de líquido frigorígeno (${Math.round(estimatedArea * 0.22)} m)`
          },
          {
            name: '5/8" – 15,88mm – e=1/32" tubulação de cobre FLEXÍVEL',
            category: 'Climatização - Expansão Direta',
            unit: 'm',
            quantity: Math.round(estimatedArea * 0.16),
            defaultPrice: null,
            measurementStatus: 'PREVISAO',
            premises: ['Modo B: estimativa preliminar por área da edificação (sem projeto executivo)'],
            keywords: ['cobre 5/8', 'tubo cobre 5/8'],
            reason: `Estimativa Preliminar Modo B: Linha de sucção frigorígena (${Math.round(estimatedArea * 0.16)} m)`
          },
          {
            name: 'GÁS REFRIGERANTE R410A - 11,3KG - FREON',
            category: 'Climatização - Expansão Direta',
            unit: 'pç',
            quantity: Math.max(1, Math.round(thermalLoad.totalTR * 0.20)),
            defaultPrice: null,
            measurementStatus: 'PREVISAO',
            premises: ['Modo B: estimativa preliminar por área da edificação (sem projeto executivo)'],
            keywords: ['r-410a', 'r410a', 'fluido refrigerante'],
            reason: `Estimativa Preliminar Modo B: Fluido refrigerante R-410A`
          }
        ];

        // Se o LLM retornou materiais específicos mesmo no Modo B, incorpora-os
        if (llmData && Array.isArray(llmData.materials) && llmData.materials.length > 0) {
          for (const llmMat of llmData.materials) {
            requiredItems.push({
              name: llmMat.name,
              category: llmMat.category || 'Materiais Extraídos (IA)',
              unit: llmMat.unit || 'un',
              quantity: llmMat.quantity,
              defaultPrice: null,
              measurementStatus: llmMat.measurementStatus || 'DOCUMENTADO',
              sourceFiles: [llmMat.sourceFile || 'Documento do Projeto'],
              keywords: [llmMat.name.toLowerCase()],
              reason: `Extraído pela IA (${llmMat.sourceFile} pág. ${llmMat.sourcePage}): ${llmMat.evidence}`
            });
          }
        }
      }
    } else {
      // Instalações Gerais Civis / Elétricas
      if (llmData && Array.isArray(llmData.materials) && llmData.materials.length > 0) {
        requiredItems = llmData.materials.map(llmMat => ({
          name: llmMat.name,
          category: llmMat.category || 'Instalações Gerais',
          unit: llmMat.unit || 'un',
          quantity: llmMat.quantity,
          defaultPrice: null,
          measurementStatus: llmMat.measurementStatus || 'DOCUMENTADO',
          sourceFiles: [llmMat.sourceFile || 'Documento do Projeto'],
          keywords: [llmMat.name.toLowerCase()],
          reason: `Extraído pela IA (${llmMat.sourceFile} pág. ${llmMat.sourcePage}): ${llmMat.evidence}`
        }));
      } else {
        requiredItems = [];
      }
    }

    // Processa cada material: identidade técnica → base viva → conversão de embalagem → preço de referência.
    // REGRA: quantidades documentadas/medidas nunca são multiplicadas por fator histórico; falta de preço não zera quantidade.
    for (const itemDef of requiredItems) {
      const mat = await this.findOrCreateMaterial(itemDef, systemContext, { commercialMarkupPercent, materialDb: options?.materialDb });
      const technicalQuantity = itemDef.quantity == null ? null : Number(itemDef.quantity);
      const measurementStatus = itemDef.measurementStatus || (technicalQuantity > 0 ? 'DOCUMENTADO' : 'PENDENTE_MEDICAO');
      const isPendingMeasurement = /^PENDENTE|LOCALIZACAO/.test(measurementStatus) || !(technicalQuantity > 0);
      const isForecast = measurementStatus === 'PREVISAO';
      const conv = mat.conversion || null;

      const purchaseQuantity = isPendingMeasurement
        ? 0
        : (conv ? conv.purchaseQuantity : Number(technicalQuantity.toFixed(2)));
      const purchaseUnit = conv ? conv.purchaseUnit : (itemDef.unit || mat.unit);

      const historyAdj = mat.id && !options?.skipHistory ? await LearningService.getHistoricalAdjustment(project.project_type, mat.id) : null;
      if (historyAdj?.hasHistory && purchaseQuantity > 0 && historyAdj.factor !== 1) {
        historicalSuggestions.push({
          material_id: mat.id,
          material_code: mat.code,
          material_name: mat.name,
          documented_or_measured_quantity: purchaseQuantity,
          historical_factor: historyAdj.factor,
          historical_suggested_quantity: Number((purchaseQuantity * historyAdj.factor).toFixed(2)),
          explanation: historyAdj.explanation,
          applied_to_budget: false
        });
      }

      const hasValidPrice = Number(mat.reference_price) > 0 && (conv != null || !itemDef.unit);
      const unitPrice = hasValidPrice ? Number(Number(mat.reference_price).toFixed(2)) : null;
      const subtotal = (!isPendingMeasurement && hasValidPrice) ? Number((purchaseQuantity * unitPrice).toFixed(2)) : 0.00;

      const classification = itemDef.classification === 'CONFLITO_DOCUMENTAL'
        ? 'CONFLITO_DOCUMENTAL'
        : (isPendingMeasurement ? 'QUANTIDADE_PENDENTE' : (isForecast ? 'PREVISAO' : (!hasValidPrice ? 'PRECO_PENDENTE' : 'CONFIRMADO')));

      const description = itemDef.name;
      if (isPendingMeasurement) {
        pendingItems.push({
          material_id: mat.id,
          material_code: mat.code,
          material_name: description,
          reason: itemDef.reason || 'QUANTIDADE PENDENTE DE MEDIÇÃO',
          suggested_quantity: technicalQuantity,
          unit: itemDef.unit,
          type: measurementStatus,
          price_available: unitPrice,
          failure_reason: mat.failure_reason
        });
      } else if (!hasValidPrice) {
        unpricedItems.push({
          material_id: mat.id,
          material_code: mat.code,
          material_name: description,
          quantity: purchaseQuantity,
          unit: purchaseUnit,
          technical_quantity: technicalQuantity,
          technical_unit: itemDef.unit,
          reason: mat.failure_reason || 'PREÇO NÃO CADASTRADO NA BASE SABRAR',
          rejected_candidates: mat.rejected_candidates || [],
          type: 'PRECO_PENDENTE'
        });
      }

      budgetMaterials.push({
        material_id: mat.id,
        material_code: mat.code,
        // Descrição técnica preservada; o item de cadastro associado aparece em matched_catalog_name
        material_name: description,
        matched_catalog_name: mat.is_genuine_match ? mat.name : null,
        quantity: purchaseQuantity,
        unit: purchaseUnit,
        technical_quantity: technicalQuantity,
        technical_unit: itemDef.unit,
        unit_conversion: conv?.note || null,
        base_cost: mat.base_cost,
        commercial_markup_percent: mat.commercial_markup_percent,
        unit_price: unitPrice,
        subtotal,
        supplier: mat.supplier,
        reference_date: mat.reference_date,
        price_source: hasValidPrice ? mat.price_source : null,
        failure_reason: hasValidPrice ? null : (mat.failure_reason || (conv == null && mat.is_genuine_match ? 'Unidade de compra não conversível' : null)),
        measurement_status: measurementStatus,
        premises: itemDef.premises || [],
        origin: itemDef.origin || null,
        source_section_ids: itemDef.sourceSectionIds || null,
        is_forecast: isForecast,
        is_pending_quote: !hasValidPrice,
        is_pending_measurement: isPendingMeasurement,
        price_status: hasValidPrice ? 'PRECIFICADO_CATALOGO' : 'PENDENTE_COTACAO',
        classification,
        conflict_description: itemDef.conflict_description || null,
        evidence: itemDef.evidence || itemDef.reason || null,
        technical_calculation: itemDef.technicalCalculation || null,
        reason: itemDef.reason
      });

      auditItems.push({
        material_id: mat.id,
        material_code: mat.code,
        material_name: description,
        technical_quantity: technicalQuantity,
        technical_unit: itemDef.unit,
        final_quantity: purchaseQuantity,
        purchase_unit: purchaseUnit,
        measurement_status: measurementStatus,
        premises: itemDef.premises || [],
        origin: itemDef.origin || null,
        match_status: isPendingMeasurement ? 'MEASUREMENT_REQUIRED' : (hasValidPrice ? 'SAFE_MATCH' : 'REVIEW_REQUIRED'),
        supplier: mat.supplier,
        reference_date: mat.reference_date,
        price_source: mat.price_source,
        failure_reason: mat.failure_reason,
        historical_adjustment: historyAdj?.hasHistory ? { factor: historyAdj.factor, explanation: historyAdj.explanation, applied: false } : null,
        sources: itemDef.sourceFiles || (documentsAnalyzed.length > 0 ? documentsAnalyzed : ['Documento do Projeto']),
        calculation_summary: itemDef.reason,
        notes: isPendingMeasurement
          ? 'Item identificado no projeto, aguardando medição/definição.'
          : (!hasValidPrice
              ? `Preço PENDENTE_COTACAO (${mat.failure_reason || 'sem preço cadastrado na base'}).`
              : `Precificado pelo preço de referência do cadastro (${mat.code}).`)
      });
    }

    // Incorpora pendências explícitas reportadas pelo LLM
    if (llmData && Array.isArray(llmData.pendingItems)) {
      for (const lp of llmData.pendingItems) {
        if (!pendingItems.some(p => (p.material_name || p.item) === lp.item)) {
          pendingItems.push({
            material_id: null,
            material_code: null,
            material_name: lp.item,
            reason: lp.details || lp.reason,
            suggested_quantity: 0,
            unit: 'un',
            type: lp.reason
          });
        }
      }
    }

    // Subtotal exclusivamente dos materiais precificados e medidos
    const materialsTotal = Number(budgetMaterials.reduce((acc, m) => acc + (m.subtotal || 0), 0).toFixed(2));

    // =========================================================================
    // COMPOSIÇÃO DE SERVIÇOS E MÃO DE OBRA (CONSOME EXATAMENTE validatedGeometry)
    // =========================================================================
    let defaultServices = [];

    if (isHVAC) {
      if (hvacMode === 'MODO_A_DIRETO' || isHeavyKitchenVRVSystem) {
        // Serviços derivados da MESMA geometria e das máquinas documentadas; tarifas da base de serviços
        defaultServices = buildServices({
          geometry: ductTakeoff ? ductTakeoff.geometry : null,
          ductBaseStatus: ductTakeoff?.baseStatus,
          machines: eqData.machines,
          refrigerant: refrigerantTakeoff,
          hasLiftingScope: /patamar\s*t[eé]cnico|i[çc]amento|cobertura/i.test(documentContent),
          context: systemContext,
          coefficients,
          options: { liftingDays: options?.liftingDays, supervisorMonths: options?.supervisorMonths }
        });
        for (const s of defaultServices) {
          if (s.quantity == null || s.measurementStatus === TAKEOFF_STATUS.PENDENTE) {
            pendingItems.push({ material_id: null, material_code: 'SERVICO', material_name: s.description, reason: s.notes, suggested_quantity: s.quantity, unit: s.unit, type: s.measurementStatus });
          } else if (s.unitPrice == null) {
            pendingItems.push({ material_id: null, material_code: 'SERVICO', material_name: s.description, reason: 'TARIFA PENDENTE_COTACAO', suggested_quantity: s.quantity, unit: s.unit, type: 'PRECO_PENDENTE' });
          }
        }
      } else {
        // Modo B preliminar: quantidade estimada por área (PREVISAO); tarifa não definida na base
        defaultServices = [
          {
            category: 'MÃO DE OBRA',
            description: 'Montagem mecânica preliminar estimada (Modo B)',
            quantity: Math.round(estimatedArea * 0.15),
            unit: 'h',
            unitPrice: null,
            priceStatus: 'PENDENTE_COTACAO',
            measurementStatus: 'PREVISAO',
            classification: 'PREVISAO',
            premises: ['Modo B: 0,15 h/m² da edificação (estimativa preliminar, coeficiente não validado)'],
            notes: 'Estimativa preliminar por área (Modo B)'
          }
        ];
      }
    }

    const totalServicesCost = Number(defaultServices.reduce((acc, s) => acc + ((s.quantity || 0) * (s.unitPrice || 0)), 0).toFixed(2));
    const forecastServicesSubtotal = Number(defaultServices.filter(s => s.classification === 'PREVISAO').reduce((acc, s) => acc + ((s.quantity || 0) * (s.unitPrice || 0)), 0).toFixed(2));

    // Faturamento Direto (Máquinas e Equipamentos Principais)
    let defaultEquipment = [];
    if (cadData.cadItems && cadData.cadItems.some(i => i.category === 'Equipamentos')) {
      const cadEquip = cadData.cadItems.filter(i => i.category === 'Equipamentos');
      defaultEquipment = cadEquip.map(eq => {
        const isClientSupplied = eq.isClientSupplied !== false && !options?.includeEquipmentSupplyPrice;
        const unitPrice = isClientSupplied ? 0.00 : Number(eq.defaultPrice || 0);
        return {
          category: eq.type || 'Equipamentos de Climatização',
          description: eq.name,
          brand: eq.brand || null,
          model: eq.model || null,
          tr: eq.tr || null,
          btu: eq.btu || null,
          quantity: eq.quantity || 1,
          unit: 'und',
          unit_price: unitPrice,
          subtotal: Number(((eq.quantity || 1) * unitPrice).toFixed(2)),
          notes: isClientSupplied
            ? 'Fornecido pelo Cliente / Faturamento Direto Fabricante (Escopo de Instalação SABRAR)'
            : (eq.reason || 'Conforme Lista de Material e Legenda do Projeto CAD')
        };
      });
    } else if (eqData.machines && eqData.machines.length > 0) {
      defaultEquipment = eqData.machines.map(m => ({
        category: m.type,
        description: `${m.type}${m.brand ? ' ' + m.brand : ''}${m.model ? ' (' + m.model + ')' : ''}${m.tr ? ' - ' + m.tr + ' TR' : ''}`,
        brand: m.brand || null,
        model: m.model || null,
        tr: m.tr || null,
        btu: m.btu || null,
        quantity: m.qty || 1,
        unit: 'un',
        unit_price: 0.00,
        subtotal: 0.00,
        notes: 'Faturamento direto fabricante / Fornecido pelo Cliente (Escopo de Instalação SABRAR)'
      }));
    }

    const totalEquipmentCost = Number(defaultEquipment.reduce((acc, eq) => acc + (eq.subtotal || 0), 0).toFixed(2));
    const totalFinalCost = Number((materialsTotal + totalServicesCost + totalEquipmentCost).toFixed(2));

    // =========================================================================
    // INDICADORES VERIFICÁVEIS DE COBERTURA E COMPLETUDE (REGRA 8 CODEX)
    // =========================================================================
    const totalFilesCount = Math.max(1, files.length || 1);
    const readableDocsCount = structuredDocuments.filter(d => d && d.numPages > 0 && d.fullStructuredText?.trim().length > 0).length;
    const documentCoveragePercent = Number(Math.min(100, (readableDocsCount / totalFilesCount) * 100).toFixed(1));

    const totalMaterialLines = budgetMaterials.length;
    const measuredMaterialLines = budgetMaterials.filter(m => !m.is_pending_measurement && m.quantity > 0).length;
    const geometryCompletenessPercent = totalMaterialLines > 0
      ? Number(((measuredMaterialLines / totalMaterialLines) * 100).toFixed(1))
      : 0.0;

    const pricedMaterialLines = budgetMaterials.filter(m => !m.is_pending_quote && m.unit_price > 0).length;
    const priceCoveragePercent = totalMaterialLines > 0
      ? Number(((pricedMaterialLines / totalMaterialLines) * 100).toFixed(1))
      : 0.0;

    const overallCompletenessPercent = Number(
      ((documentCoveragePercent * 0.25) + (geometryCompletenessPercent * 0.40) + (priceCoveragePercent * 0.35)).toFixed(1)
    );

    const confidenceMetrics = {
      document_coverage_percent: documentCoveragePercent,
      geometry_completeness_percent: geometryCompletenessPercent,
      price_coverage_percent: priceCoveragePercent,
      overall_completeness_percent: overallCompletenessPercent
    };

    // Subtotais parciais confirmados e pendências explícitas (Codex Regras 6 e 7)
    const confirmedServicesSubtotal = Number(
      defaultServices
        .filter(s => s.classification === 'CONFIRMADO')
        .reduce((acc, s) => acc + (Number(s.quantity || 0) * Number(s.unitPrice || 0)), 0)
        .toFixed(2)
    );

    const confirmedMaterialsSubtotal = Number(
      budgetMaterials
        .filter(m => m.classification === 'CONFIRMADO' && m.price_status === 'PRECIFICADO_CATALOGO')
        .reduce((acc, m) => acc + Number(m.subtotal || 0), 0)
        .toFixed(2)
    );

    const hasAnyPendingItems = budgetMaterials.some(m => ['QUANTIDADE_PENDENTE', 'PRECO_PENDENTE', 'PREVISAO', 'CONFLITO_DOCUMENTAL'].includes(m.classification)) ||
      defaultServices.some(s => ['QUANTIDADE_PENDENTE', 'PRECO_PENDENTE', 'PREVISAO'].includes(s.classification));
    const forecastMaterialsSubtotal = Number(budgetMaterials.filter(m => m.classification === 'PREVISAO').reduce((a, m) => a + Number(m.subtotal || 0), 0).toFixed(2));

    const isPartialBudget = hasAnyPendingItems;

    const confirmedPartialSubtotal = isPartialBudget
      ? confirmedServicesSubtotal
      : Number((confirmedServicesSubtotal + confirmedMaterialsSubtotal).toFixed(2));

    const budgetPartialSubtotal = isPartialBudget ? confirmedServicesSubtotal : totalFinalCost;
    const completenessStatus = isPartialBudget ? 'SUBTOTAL_PARCIAL_COM_PENDENCIAS' : 'ORCAMENTO_COMPLETO';

    const pendenciesSummary = {
      quantidade_pendente_count: budgetMaterials.filter(m => m.classification === 'QUANTIDADE_PENDENTE').length + defaultServices.filter(s => s.classification === 'QUANTIDADE_PENDENTE').length,
      preco_pendente_count: budgetMaterials.filter(m => m.classification === 'PRECO_PENDENTE').length + defaultServices.filter(s => s.classification === 'PRECO_PENDENTE').length,
      previsao_count: budgetMaterials.filter(m => m.classification === 'PREVISAO').length + defaultServices.filter(s => s.classification === 'PREVISAO').length,
      forecast_materials_subtotal: forecastMaterialsSubtotal,
      forecast_services_subtotal: forecastServicesSubtotal,
      interpretation_issues_count: interpretationIssues.length,
      conflito_documental_count: documentConflicts.length,
      fornecimento_cliente_count: defaultEquipment.length,
      confirmed_services_subtotal: confirmedServicesSubtotal,
      confirmed_materials_subtotal: confirmedMaterialsSubtotal,
      partial_subtotal: budgetPartialSubtotal
    };

    const hasPendencies = isPartialBudget || unpricedItems.length > 0 || unmeasuredItems.length > 0 || pendingItems.length > 0;
    const budgetCompletenessStatus = hasPendencies
      ? 'SUBTOTAL_PARCIAL_COM_PENDENCIAS'
      : 'ORCAMENTO_COMPLETO';

    const budgetOutput = {
      materials: budgetMaterials,
      materials_total: materialsTotal,
      priced_materials_subtotal: materialsTotal,
      services_subtotal: totalServicesCost,
      equipment_subtotal: totalEquipmentCost,
      priced_grand_subtotal: totalFinalCost,
      is_partial: isPartialBudget,
      partial_subtotal: budgetPartialSubtotal,
      pendencies_summary: pendenciesSummary,
      document_conflicts: documentConflicts,
      interpretation_issues: interpretationIssues,
      completeness_status: budgetCompletenessStatus,
      unpriced_items: unpricedItems,
      unmeasured_items: unmeasuredItems,
      pending_items: pendingItems,
      thermal_load: isHVAC ? thermalLoad : null,
      hvac_mode: hvacMode
    };

    const totalStructuredPages = structuredDocuments.reduce((s, d) => s + (d?.numPages || 0), 0);

    const analysisMetadata = {
      project_id: projectId,
      documents_analyzed: documentsAnalyzed,
      structured_pages_count: totalStructuredPages,
      structured_documents_summary: structuredDocuments.map(d => ({
        fileName: d.fileName,
        numPages: d.numPages,
        tablesDetected: d.tablesDetected || [],
        scalesDetected: d.scalesDetected || []
      })),
      // Extração validada do LLM (reaproveitada pela revisão de geometria sem nova chamada ao modelo)
      llm_extraction: llmData || null,
      llm_validation: {
        executed: Boolean(rawLLMResponse),
        provider: rawLLMResponse?._llmTelemetry?.provider || llmConfig.provider,
        configured_model: rawLLMResponse?._llmTelemetry?.configuredModel || llmConfig.model,
        model_used: rawLLMResponse?._llmTelemetry?.modelUsed || (rawLLMResponse ? llmConfig.model : null),
        latency_ms: rawLLMResponse?._llmTelemetry?.latencyMs || null,
        valid: llmValidation.valid,
        has_content: llmValidation.hasContent,
        errors: llmErrorMsg ? [...llmValidation.errors, llmErrorMsg] : llmValidation.errors
      },
      disciplines_detected: disciplines,
      hvac_mode: hvacMode,
      thermal_load: isHVAC ? thermalLoad : null,
      validated_geometry: validatedGeometry,
      confidence_metrics: confidenceMetrics,
      completeness_status: budgetCompletenessStatus,
      items: auditItems,
      historical_suggestions: historicalSuggestions,
      document_conflicts: documentConflicts,
      interpretation_issues: interpretationIssues,
      company_coefficients: coefficients
    };

    const modeLabel = hvacMode === 'MODO_A_DIRETO'
      ? 'Modo A (Levantamento Direto de Projeto Executivo HVAC)'
      : 'Modo B (Engenharia Reversa por Arquitetura & NBR 16401)';

    const summaryText = `Levantamento técnico via ${modeLabel} [${budgetCompletenessStatus}]. Carga térmica: ${thermalLoad.totalBtu.toLocaleString('pt-BR')} BTU/h (${thermalLoad.totalTR} TR). Subtotal de Materiais Precificados: R$ ${materialsTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}. Subtotal de Serviços Medidos: R$ ${totalServicesCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}. Subtotal Parcial Precificado: R$ ${totalFinalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}. Pendências: ${unpricedItems.length} item(ns) sem cotação na base e ${unmeasuredItems.length} grupo(s) pendente(s) de medição/escopo. Cobertura documental: ${documentCoveragePercent}% | Completude geométrica: ${geometryCompletenessPercent}% | Cobertura de preços: ${priceCoveragePercent}%.`;

    let analysisId = null;
    let budgetId = null;

    // PERSISTÊNCIA NO BANCO DE DADOS (IGNORADA INTEGRALMENTE QUANDO dryRun: true)
    if (!isDryRun) {
      const insertAnalysis = db.prepare(`
        INSERT INTO ai_analyses (project_id, analyzed_documents, confidence_score, historical_factors_applied, summary, raw_extracted_data)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      const analysisResult = await insertAnalysis.run(
        projectId,
        JSON.stringify(documentsAnalyzed),
        overallCompletenessPercent,
        JSON.stringify(historicalSuggestions),
        summaryText,
        JSON.stringify({ budget: budgetOutput, analysis_metadata: analysisMetadata })
      );

      analysisId = analysisResult.lastInsertRowid;

      const insertSuggestion = db.prepare(`
        INSERT INTO ai_suggestions (analysis_id, project_id, material_id, material_name, suggested_quantity, unit, unit_price, subtotal, reasoning, confidence)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const item of budgetMaterials) {
        const auditMeta = auditItems.find(a => (item.material_id && a.material_id === item.material_id) || a.material_name === item.material_name);
        await insertSuggestion.run(
          analysisId,
          projectId,
          item.material_id,
          item.material_name,
          item.quantity,
          item.unit,
          item.unit_price ?? 0,
          item.subtotal,
          auditMeta?.calculation_summary || 'Sugestão calculada a partir dos projetos técnicos',
          overallCompletenessPercent
        );
      }

      let budget = await db.prepare('SELECT * FROM budgets WHERE project_id = ?').get(projectId);
      const isApproved = budget && budget.status === 'Aprovado';

      if (!budget) {
        const budgetCode = await generateUniqueBudgetCode(db);

        const resBudget = await db.prepare(`
          INSERT INTO budgets (
            project_id, code, status, total_materials, total_services,
            total_labor, total_equipment, total_logistics, total_taxes,
            total_additional, total_final, validity_days, commercial_terms,
            is_partial, partial_subtotal, pendencies_summary, document_conflicts, completeness_status
          ) VALUES (?, ?, 'Em revisão', ?, ?, ?, ?, 0, 0, 0, ?, 15, ?, ?, ?, ?, ?, ?)
        `).run(
          projectId,
          budgetCode,
          materialsTotal,
          totalServicesCost,
          totalServicesCost,
          totalEquipmentCost,
          totalFinalCost,
          'Condições de pagamento: 30% sinal na assinatura, 40% na entrega dos materiais no canteiro, 30% no comissionamento e entrega da obra. Validade: 15 dias.',
          isPartialBudget,
          budgetPartialSubtotal,
          JSON.stringify(pendenciesSummary),
          JSON.stringify(documentConflicts),
          completenessStatus
        );
        budgetId = resBudget.lastInsertRowid;
      } else {
        budgetId = budget.id;
        if (isApproved) {
          const versionCountRes = await db.prepare('SELECT COUNT(*) as count FROM budget_versions WHERE budget_id = ?').get(budgetId);
          const nextVer = (versionCountRes?.count || 0) + 1;
          await db.prepare(`
            INSERT INTO budget_versions (
              budget_id, project_id, version_number, justification, change_type,
              total_materials, total_services, total_equipment, total_final, discount_amount,
              items_snapshot, services_snapshot, equipment_snapshot, notes, created_by_name
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, 'Agente IA SABRAR')
          `).run(
            budgetId,
            projectId,
            nextVer,
            'Reanálise por IA mantendo orçamento aprovado preservado',
            'Revisão IA',
            materialsTotal,
            totalServicesCost,
            totalEquipmentCost,
            totalFinalCost,
            JSON.stringify(budgetMaterials),
            JSON.stringify(defaultServices),
            JSON.stringify(defaultEquipment),
            'Orçamento de referência aprovado por engenheiro foi integralmente preservado.'
          );
        } else {
          const existingItems = await db.prepare('SELECT * FROM budget_items WHERE budget_id = ?').all(budgetId);
          const existingServices = await db.prepare('SELECT * FROM services WHERE budget_id = ?').all(budgetId);
          let existingEquip = [];
          try {
            existingEquip = await db.prepare('SELECT * FROM budget_equipment WHERE budget_id = ?').all(budgetId);
          } catch (_) {}

          const humanEditedItems = existingItems.filter(i => i.human_notes && !i.human_notes.includes('Item orçado pela Base Central SABRAR'));

          const versionCountRes = await db.prepare('SELECT COUNT(*) as count FROM budget_versions WHERE budget_id = ?').get(budgetId);
          const nextVer = (versionCountRes?.count || 0) + 1;
          await db.prepare(`
            INSERT INTO budget_versions (
              budget_id, project_id, version_number, justification, change_type,
              total_materials, total_services, total_equipment, total_final, discount_amount,
              items_snapshot, services_snapshot, equipment_snapshot, notes, created_by_name
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, 'Agente IA SABRAR')
          `).run(
            budgetId,
            projectId,
            nextVer,
            'Snapshot automático pré-atualização IA',
            'Atualização IA',
            budget.total_materials || 0,
            budget.total_services || 0,
            budget.total_equipment || 0,
            budget.total_final || 0,
            JSON.stringify(existingItems),
            JSON.stringify(existingServices),
            JSON.stringify(existingEquip),
            'Versão anterior arquivada antes do recálculo por IA.'
          );

          await db.prepare(`
            UPDATE budgets SET
              total_materials = ?, total_services = ?, total_labor = ?, total_equipment = ?, total_final = ?,
              status = 'Em revisão', updated_at = CURRENT_TIMESTAMP,
              is_partial = ?, partial_subtotal = ?, pendencies_summary = ?, document_conflicts = ?, completeness_status = ?
            WHERE id = ?
          `).run(
            materialsTotal,
            totalServicesCost,
            totalServicesCost,
            totalEquipmentCost,
            totalFinalCost,
            isPartialBudget,
            budgetPartialSubtotal,
            JSON.stringify(pendenciesSummary),
            JSON.stringify(documentConflicts),
            completenessStatus,
            budgetId
          );

          await db.prepare('DELETE FROM budget_items WHERE budget_id = ?').run(budgetId);
          await db.prepare('DELETE FROM services WHERE budget_id = ?').run(budgetId);

          const getMatFamily = (n = '') => {
            const str = String(n).toLowerCase();
            if (/\bgrelha\b/i.test(str)) return 'grelha';
            if (/\bdifusor\b/i.test(str)) return 'difusor';
            if (/\bdamper\b/i.test(str)) return 'damper';
            return 'outro';
          };

          for (const hItem of humanEditedItems) {
            const hFamily = getMatFamily(hItem.material_name);
            const hAttrs = extractTechnicalAttributes(hItem.material_name);
            const alreadyInBudget = budgetMaterials.some(m => {
              if (m.material_name.toLowerCase() === hItem.material_name.toLowerCase()) return true;
              const mFamily = getMatFamily(m.material_name);
              if (mFamily !== 'outro' && mFamily === hFamily) {
                const mAttrs = extractTechnicalAttributes(m.material_name);
                if (mAttrs.rectDimensions.length > 0 && hAttrs.rectDimensions.length > 0) {
                  return mAttrs.rectDimensions.some(d => hAttrs.rectDimensions.includes(d));
                }
              }
              return false;
            });

            if (!alreadyInBudget) {
              budgetMaterials.push({
                material_id: hItem.material_id,
                material_code: null,
                material_name: hItem.material_name,
                quantity: hItem.quantity,
                unit: hItem.unit,
                unit_price: hItem.unit_price,
                subtotal: hItem.subtotal,
                human_notes: hItem.human_notes,
                classification: hItem.classification || 'CONFIRMADO',
                price_status: hItem.price_status || (hItem.unit_price > 0 ? 'PRECIFICADO_CATALOGO' : 'PENDENTE_COTACAO')
              });
            }
          }
        }
      }

      if (!isApproved) {
        const insertBudgetItem = db.prepare(`
          INSERT INTO budget_items (
            budget_id, material_id, material_name, quantity, unit,
            unit_price, subtotal, ai_suggested_quantity, ai_reasoning, human_notes,
            classification, price_status, evidence, conflict_description
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const m of budgetMaterials) {
          const auditMeta = auditItems.find(a => (m.material_id && a.material_id === m.material_id) || a.material_name === m.material_name);
          const isDiscrete = /unid|und|un\b|pç|pc|peça|cx|caixa|pct|pacote|lata|rolo|barra|frasco|balde|tubo|cartucho|kit|jogo|par|duzia/i.test(m.unit || '');
          const cleanQty = m.is_pending_measurement
            ? 0
            : (isDiscrete ? Math.ceil(Number(m.quantity || 0) - 1e-9) : Number(Number(m.quantity || 0).toFixed(2)));
          const cleanSubtotal = Number((cleanQty * Number(m.unit_price || 0)).toFixed(2));
          const noteText = [
            m.is_pending_measurement
              ? `Item identificado no projeto - ${m.measurement_status}`
              : (m.is_pending_quote
                  ? `PENDENTE_COTACAO (${m.failure_reason || 'sem correspondência segura'})`
                  : (m.human_notes || `Item orçado pela Base Central SABRAR via ${modeLabel}`)),
            m.measurement_status ? `Status: ${m.measurement_status}` : null,
            m.technical_quantity != null && m.technical_unit ? `Qtd técnica: ${m.technical_quantity} ${m.technical_unit}` : null,
            m.unit_conversion ? `Conversão: ${m.unit_conversion}` : null,
            m.origin ? `Origem: ${m.origin}` : null,
            ...((m.premises || []).map(p => `Premissa: ${p}`))
          ].filter(Boolean).join(' | ');

          await insertBudgetItem.run(
            budgetId,
            m.material_id,
            m.material_name,
            cleanQty,
            m.unit,
            m.unit_price ?? 0,
            cleanSubtotal,
            cleanQty,
            auditMeta?.calculation_summary || 'Sugestão da IA SABRAR',
            noteText,
            m.classification || (m.is_pending_measurement ? 'QUANTIDADE_PENDENTE' : (m.is_pending_quote ? 'PRECO_PENDENTE' : 'CONFIRMADO')),
            m.price_status || (m.unit_price > 0 ? 'PRECIFICADO_CATALOGO' : 'PENDENTE_COTACAO'),
            m.evidence || m.reason || null,
            m.conflict_description || null
          );
        }

        const insertService = db.prepare(`
          INSERT INTO services (
            budget_id, category, description, quantity, unit, unit_price, subtotal, notes,
            classification, measurement_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const s of defaultServices) {
          await insertService.run(
            budgetId,
            s.category,
            s.description,
            s.quantity,
            s.unit,
            s.unitPrice ?? 0,
            Number(((s.quantity || 0) * (s.unitPrice || 0)).toFixed(2)),
            [s.notes, ...(s.premises || []).map(p => `Premissa: ${p}`), s.priceStatus === 'PENDENTE_COTACAO' ? 'Tarifa PENDENTE_COTACAO' : null].filter(Boolean).join(' | '),
            s.classification || 'QUANTIDADE_PENDENTE',
            s.measurementStatus || 'DOCUMENTADO'
          );
        }

        if (defaultEquipment.length > 0) {
          await db.prepare('DELETE FROM budget_equipment WHERE budget_id = ?').run(budgetId);
          const insertEquipment = db.prepare(`
            INSERT INTO budget_equipment (
              budget_id, category, description, brand, model,
              quantity, unit, unit_price, subtotal, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          for (const eq of defaultEquipment) {
            await insertEquipment.run(
              budgetId,
              eq.category,
              eq.description,
              eq.brand || '',
              eq.model || '',
              eq.quantity,
              eq.unit,
              eq.unit_price,
              eq.subtotal,
              eq.notes || ''
            );
          }
        }

        await db.prepare(`
          UPDATE projects SET
            status = 'Orçamento gerado',
            total_budget_materials = ?,
            total_budget_services = ?,
            total_budget_additional = 0,
            total_budget_final = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(materialsTotal, totalServicesCost, totalFinalCost, projectId);
      }
    }

    return {
      analysisId,
      budgetId,
      projectId,
      projectName: project.name,
      hvacMode,
      thermalLoad: isHVAC ? thermalLoad : null,
      totalEstimatedMaterialsCost: materialsTotal,
      pricedMaterialsSubtotal: materialsTotal,
      totalServicesCost: totalServicesCost,
      totalEquipmentCost: totalEquipmentCost,
      totalFinalCost: totalFinalCost,
      budgetCompletenessStatus,
      confidenceScore: overallCompletenessPercent,
      confidence_metrics: confidenceMetrics,
      validated_geometry: validatedGeometry,
      historical_suggestions: historicalSuggestions,
      unpriced_items: unpricedItems,
      unmeasured_items: unmeasuredItems,
      services: defaultServices,
      equipment: defaultEquipment,
      materials: budgetMaterials.map(m => ({
        materialId: m.material_id,
        material: m.material_name,
        materialCode: m.material_code,
        quantity: m.quantity,
        unit: m.unit,
        baseCost: m.base_cost,
        commercialMarkupPercent: m.commercial_markup_percent,
        unitPrice: m.unit_price,
        subtotal: m.subtotal,
        supplier: m.supplier,
        referenceDate: m.reference_date,
        priceSource: m.price_source,
        failureReason: m.failure_reason,
        measurementStatus: m.measurement_status,
        isPendingQuote: Boolean(m.is_pending_quote),
        isPendingMeasurement: Boolean(m.is_pending_measurement),
        priceStatus: m.price_status || (m.unit_price > 0 ? 'PRECIFICADO_CATALOGO' : 'PENDENTE_COTACAO'),
        technicalCalculation: m.technical_calculation || null,
        technicalQuantity: m.technical_quantity ?? null,
        technicalUnit: m.technical_unit || null,
        unitConversion: m.unit_conversion || null,
        premises: m.premises || [],
        origin: m.origin || null,
        classification: m.classification,
        matchedCatalogName: m.matched_catalog_name || null,
        reason: auditItems.find(a => (m.material_id && a.material_id === m.material_id) || a.material_name === m.material_name)?.calculation_summary || '',
        confidence: overallCompletenessPercent
      })),
      budget: budgetOutput,
      analysis_metadata: analysisMetadata
    };
  }
}
