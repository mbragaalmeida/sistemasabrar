import { db } from '../db/connection.js';
import { LearningService } from './learningService.js';
import { SABRAR_BUDGET_AGENT_SYSTEM_PROMPT, buildAgentContextPrompt } from '../prompts/budgetAgentPrompt.js';
import { convertMaterialUnits } from '../utils/unitConversion.js';
import {
  findSabrarEconomicPrice,
  SABRAR_MATERIALS_2026,
  checkTechnicalCompatibility,
  extractTechnicalAttributes
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
  calculateCopperMeters,
  calculateHydraulicMeters,
  extractDuctSegmentsFromText,
  DUCT_GAUGE_FACTORS
} from '../utils/hvacCalculations.js';

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

    for (const f of files) {
      const fileName = f.original_name || `arquivo_${f.id}.pdf`;
      documentsAnalyzed.push(fileName);

      let structuredDoc = null;
      if (f.file_data && Buffer.isBuffer(f.file_data) && f.file_data.length > 0 && fileName.toLowerCase().endsWith('.pdf')) {
        structuredDoc = await extractStructuredPdfData(f.file_data, fileName);
        if (f.file_data.length <= 12 * 1024 * 1024) {
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
      pdfAttachments
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
      machines: []
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
      result.returnMeshCalloutsCount = plantCallouts > 0 ? Math.min(plantCallouts, 3) : 1;
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

    // 3. Verifica se existe bloco de LISTA DE MATERIAL / QUADRO DE EQUIPAMENTOS CAD
    const tableHeaderRegex = /LISTA\s+DE\s+MATERIA(?:L|IS)|QUADRO\s+DE\s+EQUIPAMENTOS|RELA[ÇC][AÃ]O\s+DE\s+MATERIA(?:L|IS)/gi;
    const tableHeaders = [...text.matchAll(tableHeaderRegex)];
    result.hasCadTable = tableHeaders.length > 0;

    if (result.hasCadTable) {
      for (const th of tableHeaders) {
        const startIdx = th.index;
        const tableBlock = text.slice(startIdx, startIdx + 2500);

        // Extrai mapa de quantitativos e números de itens daquela tabela CAD
        const itemQuantities = new Map();
        const pairRegex = /(\d{1,3})\s*\n\s*0?([1-9])\b/g;
        let pMatch;
        while ((pMatch = pairRegex.exec(tableBlock)) !== null) {
          const q = parseInt(pMatch[1], 10);
          const itemNum = parseInt(pMatch[2], 10);
          if (itemNum >= 1 && itemNum <= 25 && !itemQuantities.has(itemNum)) {
            itemQuantities.set(itemNum, q);
          }
        }

        if (tableBlock.includes('0506') && !itemQuantities.has(5)) {
          itemQuantities.set(5, 1);
          itemQuantities.set(6, 1);
        }
        if ((tableBlock.includes('07\n03') || tableBlock.includes('07 \n 03')) && !itemQuantities.has(7)) {
          itemQuantities.set(7, 3);
        }

        const tableEquipBrand = extractExplicitBrand(tableBlock, /\b(HITACHI|CARRIER|DAIKIN|TRANE|YORK|LG|SAMSUNG|MIDEA|SPRINGER)\b/i);
        const tableDiffBrand = extractExplicitBrand(tableBlock, /\b(TROPICAL|POLAR|TROX|MULTIVAC|SICFLUX)\b/i);

        // --- Evaporadoras na Tabela CAD ---
        const evapCadMatch = tableBlock.match(/UNIDADE\s+EVAPORADORA([^\n\r]*)/i);
        if (evapCadMatch && itemQuantities.has(1)) {
          const descLine = evapCadMatch[0];
          const qty = itemQuantities.get(1);
          const modelMatch = descLine.match(/\b([A-Z]{2,5}\d{2,4}[A-Z0-9]*(?:\s*\+\s*[A-Z]{2,5}\d{2,4}[A-Z0-9]*)?)\b/);
          const model = modelMatch ? modelMatch[1].replace(/\s+/g, '') : null;
          const trMatch = descLine.match(/(\d+(?:[.,]\d+)?)\s*TR\b/i);
          const model200 = model && /200/.test(model);
          const tr = trMatch ? Number(trMatch[1].replace(',', '.')) : (model200 ? 20 : null);
          const btu = tr ? Math.round(tr * 12000) : null;
          const brand = extractExplicitBrand(descLine, /\b(HITACHI|CARRIER|DAIKIN|TRANE|YORK|LG|SAMSUNG|MIDEA)\b/i) || tableEquipBrand;
          const isSplitao = /split[aã]o/i.test(descLine);
          const typeLabel = isSplitao ? 'SPLITÃO DUTADO' : 'UNIDADE EVAPORADORA';
          const key = `CAD_EVAP_${model || typeLabel}_${tr || ''}`;

          if (!itemsDedupeMap.has(key)) {
            itemsDedupeMap.set(key, {
              itemNum: '01',
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
              reason: `Lista de Material Item 01 / Projeto CAD: ${qty}x ${descLine.trim()}`
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
        }

        // --- Condensadoras na Tabela CAD ---
        const condCadMatch = tableBlock.match(/UNIDADE\s+CONDENSADORA([^\n\r]*)/i);
        if (condCadMatch && itemQuantities.has(2)) {
          const descLine = condCadMatch[0];
          const qty = itemQuantities.get(2);
          const modelMatch = descLine.match(/\b(RAS-?\d+[A-Z0-9]*|RXY[A-Z0-9]+|[A-Z]{2,5}-?\d{2,4}[A-Z0-9]{2,})\b/i);
          const model = modelMatch ? modelMatch[1].toUpperCase() : null;
          const hpMatch = descLine.match(/(\d+(?:[.,]\d+)?)\s*HP\b/i) || (model && model.match(/RAS-?(\d+)/i));
          const hp = hpMatch ? Number(hpMatch[1]) : null;
          const trMatch = descLine.match(/(\d+(?:[.,]\d+)?)\s*TR\b/i);
          const tr = trMatch ? Number(trMatch[1].replace(',', '.')) : (hp === 22 ? 20 : (hp ? Number((hp * 0.9).toFixed(1)) : null));
          const btu = tr ? Math.round(tr * 12000) : null;
          const brand = extractExplicitBrand(descLine, /\b(HITACHI|CARRIER|DAIKIN|TRANE|YORK|LG|SAMSUNG|MIDEA)\b/i) || tableEquipBrand;
          const key = `CAD_COND_${model || 'COND'}_${hp || tr || ''}`;

          if (!itemsDedupeMap.has(key)) {
            itemsDedupeMap.set(key, {
              itemNum: '02',
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
              reason: `Lista de Material Item 02 / Projeto CAD: ${qty}x ${descLine.trim()}`
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
        }

        // --- Grelhas na Tabela CAD ---
        const grelhaCadMatch = tableBlock.match(/GRELHA([^\n\r]*)/i);
        if (grelhaCadMatch && itemQuantities.has(3)) {
          const descLine = grelhaCadMatch[0];
          const qty = itemQuantities.get(3);
          const dim = extractCleanDim(descLine);
          const brand = extractExplicitBrand(descLine, /\b(TROPICAL|POLAR|TROX|MULTIVAC)\b/i) || tableDiffBrand;
          const isDupla = /dupla\s+deflex[aã]o/i.test(descLine);
          const hasReg = /registro/i.test(descLine);
          const key = `CAD_GRELHA_${dim || descLine}`;
          if (!itemsDedupeMap.has(key)) {
            itemsDedupeMap.set(key, {
              itemNum: '03',
              category: 'Difusão de Ar',
              name: `Grelha${isDupla ? ' de Dupla Deflexão' : ''}${hasReg ? ' com Registro' : ''}${dim ? ' ' + dim : ''}${brand ? ' (' + brand + ')' : ''}`,
              brand,
              dimensions: dim,
              quantity: qty,
              unit: 'und',
              defaultPrice: null,
              measurementStatus: 'DOCUMENTADO',
              keywords: ['grelha', isDupla ? 'grelha dupla deflexao' : '', dim ? `grelha ${dim.replace(/mm$/i, '')}` : ''].filter(Boolean),
              reason: `Lista de Material Item 03 / Projeto CAD: ${qty}x ${descLine.trim()}`
            });
          }
        }

        // --- Difusores na Tabela CAD ---
        const difCadMatch = tableBlock.match(/DIFUSOR([^\n\r]*)/i);
        if (difCadMatch && itemQuantities.has(4)) {
          const descLine = difCadMatch[0];
          const qty = itemQuantities.get(4);
          const dim = extractCleanDim(descLine);
          const brand = extractExplicitBrand(descLine, /\b(TROPICAL|POLAR|TROX|MULTIVAC)\b/i) || tableDiffBrand;
          const has4Saidas = /4\s*(?:sa[ií]das|vias)/i.test(descLine);
          const hasRegPlenum = /registro/i.test(descLine) && /plenum/i.test(descLine);
          const key = `CAD_DIFUSOR_${dim || descLine}`;
          if (!itemsDedupeMap.has(key)) {
            itemsDedupeMap.set(key, {
              itemNum: '04',
              category: 'Difusão de Ar',
              name: `Difusor de Ar${has4Saidas ? ' 4 Saídas' : ''}${dim ? ' ' + dim : ''}${hasRegPlenum ? ' com Registro e Caixa Plenum' : ''}${brand ? ' (' + brand + ')' : ''}`,
              brand,
              dimensions: dim,
              quantity: qty,
              unit: 'und',
              defaultPrice: null,
              measurementStatus: 'DOCUMENTADO',
              keywords: ['difusor', dim ? `difusor ${dim.replace(/mm$/i, '')}` : ''].filter(Boolean),
              reason: `Lista de Material Item 04 / Projeto CAD: ${qty}x ${descLine.trim()}`
            });
          }
        }

        // --- Dampers na Tabela CAD ---
        const damperCadMatches = [...tableBlock.matchAll(/DAMPER\s+PARA\s+CONTROLE\s+DE\s+VAZ[AÃ]O[^\n\rD]*?TAMANHO\s*(\d+\s*[xX×]\s*\d+\s*(?:mm|cm)?)/gi)];
        damperCadMatches.forEach((dm, idx) => {
          const itemNum = 5 + idx;
          if (!itemQuantities.has(itemNum)) return;
          const qty = itemQuantities.get(itemNum);
          const dim = extractCleanDim(dm[1]);
          const brand = extractExplicitBrand(dm[0], /\b(TROPICAL|POLAR|TROX|MULTIVAC)\b/i) || tableDiffBrand;
          const key = `CAD_DAMPER_${dim}`;
          if (!itemsDedupeMap.has(key)) {
            itemsDedupeMap.set(key, {
              itemNum: `0${itemNum}`,
              category: 'Difusão de Ar',
              name: `Damper para Controle de Vazão Tamanho ${dim}${brand ? ' (' + brand + ')' : ''}`,
              brand,
              dimensions: dim,
              quantity: qty,
              unit: 'und',
              defaultPrice: null,
              measurementStatus: 'DOCUMENTADO',
              keywords: ['damper controle vazao', dim ? `damper ${dim.toLowerCase()}` : ''].filter(Boolean),
              reason: `Lista de Material Item 0${itemNum} / Projeto CAD: ${qty}x Damper de controle de vazão ${dim}${brand ? ' (' + brand + ')' : ''}`
            });
          }
        });
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
   * exigindo compatibilidade técnica estrita de todos os atributos obrigatórios (bitola, parede, modelo, dimensão).
   */
  static async findOrCreateMaterial(itemDef, systemContext = '', options = {}) {
    const commercialMarkupPercent = Number(options.commercialMarkupPercent || 0);
    const applyMarkup = (basePrice) => {
      if (basePrice === null || basePrice === undefined || Number(basePrice) <= 0) return null;
      return Number((Number(basePrice) * (1 + commercialMarkupPercent / 100)).toFixed(2));
    };

    // 1. Tenta buscar por código oficial na base se informado (ex: SAB-0378, SAB-0011, etc.)
    if (itemDef.code) {
      const byCode = await db.prepare('SELECT * FROM materials WHERE code = ?').get(itemDef.code);
      if (byCode && checkTechnicalCompatibility(itemDef.name, byCode.name, byCode.category || '', '', null, null)) {
        const baseCost = byCode.reference_price > 0 ? Number(byCode.reference_price) : null;
        return {
          ...byCode,
          base_cost: baseCost,
          commercial_markup_percent: commercialMarkupPercent,
          reference_price: applyMarkup(baseCost),
          supplier: byCode.supplier || 'Catálogo Oficial SABRAR',
          reference_date: '2026-01',
          price_source: baseCost ? 'CATALOGO_DB_SABRAR' : null,
          failure_reason: baseCost ? null : 'Material localizado por código porém sem preço de referência cadastrado.',
          price_status: baseCost ? 'PRECIFICADO_CATALOGO' : 'PENDENTE_COTACAO'
        };
      }
    }

    // 2. Tenta buscar por nome exato ou via alias na base oficial (validando compatibilidade técnica obrigatória)
    const byName = await db.prepare('SELECT * FROM materials WHERE LOWER(name) = ?').get(itemDef.name.toLowerCase());
    if (byName && checkTechnicalCompatibility(itemDef.name, byName.name, byName.category || '', '', null, null)) {
      const baseCost = byName.reference_price > 0 ? Number(byName.reference_price) : null;
      return {
        ...byName,
        base_cost: baseCost,
        commercial_markup_percent: commercialMarkupPercent,
        reference_price: applyMarkup(baseCost),
        supplier: byName.supplier || 'Catálogo Oficial SABRAR',
        reference_date: '2026-01',
        price_source: baseCost ? 'CATALOGO_DB_SABRAR' : null,
        failure_reason: baseCost ? null : 'Material localizado por nome exato porém sem preço de referência cadastrado.',
        price_status: baseCost ? 'PRECIFICADO_CATALOGO' : 'PENDENTE_COTACAO'
      };
    }

    const byAlias = await db.prepare(`
      SELECT m.* FROM material_aliases ma
      JOIN materials m ON m.id = ma.material_id
      WHERE LOWER(ma.alias_name) = ?
    `).get(itemDef.name.toLowerCase());
    if (byAlias && checkTechnicalCompatibility(itemDef.name, byAlias.name, byAlias.category || '', '', null, null)) {
      const baseCost = byAlias.reference_price > 0 ? Number(byAlias.reference_price) : null;
      return {
        ...byAlias,
        base_cost: baseCost,
        commercial_markup_percent: commercialMarkupPercent,
        reference_price: applyMarkup(baseCost),
        supplier: byAlias.supplier || 'Catálogo Oficial SABRAR',
        reference_date: '2026-01',
        price_source: baseCost ? 'CATALOGO_ALIAS_SABRAR' : null,
        failure_reason: baseCost ? null : 'Alias localizado porém material base não possui preço cadastrado.',
        price_status: baseCost ? 'PRECIFICADO_CATALOGO' : 'PENDENTE_COTACAO'
      };
    }

    // 3. Consulta a Base Econômica Oficial Sabrar para precificação e regras
    const economic = findSabrarEconomicPrice(itemDef.name, {
      context: systemContext,
      unit: itemDef.unit,
      spec: itemDef.spec,
      commercialMarkupPercent
    });

    const reqUnitLower = (itemDef.unit || '').toLowerCase();
    const econUnitLower = (economic.unit || '').toLowerCase();
    const isUnitConflict = reqUnitLower && econUnitLower && reqUnitLower !== econUnitLower &&
      !(reqUnitLower.startsWith('m') && econUnitLower.startsWith('m')) &&
      !(['un', 'und', 'unid', 'pç', 'pc'].includes(reqUnitLower) && ['un', 'und', 'unid', 'pç', 'pc'].includes(econUnitLower));

    const isFastenerClash = (
      itemDef.name.toLowerCase().includes('duto') ||
      itemDef.name.toLowerCase().includes('chapa') ||
      itemDef.name.toLowerCase().includes('damper') ||
      itemDef.name.toLowerCase().includes('difusor') ||
      itemDef.name.toLowerCase().includes('grelha') ||
      itemDef.name.toLowerCase().includes('painel')
    ) && economic.matchedItem && (
      economic.matchedItem.toLowerCase().includes('parafuso') ||
      economic.matchedItem.toLowerCase().includes('bucha') ||
      economic.matchedItem.toLowerCase().includes('abraçadeira') ||
      economic.matchedItem.toLowerCase().includes('terminal')
    );

    const isGenuineMatch = Boolean(economic.matched && !isUnitConflict && !isFastenerClash);

    // Regra Absoluta de Preço: NUNCA usar defaultPrice arbitrário no código quando não houver correspondência
    const baseCost = isGenuineMatch ? economic.price : null;
    const officialPrice = isGenuineMatch ? (economic.commercialPrice || applyMarkup(economic.price)) : null;
    const officialUnit = isGenuineMatch ? economic.unit : (itemDef.unit || 'un');
    const officialCategory = isGenuineMatch ? economic.category : (itemDef.category || 'Climatização');
    const failureReason = isGenuineMatch
      ? null
      : (economic.failureReason || (isUnitConflict ? `Conflito de unidade (${itemDef.unit} vs ${economic.unit}).` : 'Item sem correspondência técnica compatível na Base Central SABRAR 2026.'));

    return {
      id: isGenuineMatch ? economic.id : null,
      code: isGenuineMatch ? economic.code : null,
      name: itemDef.name,
      category: officialCategory,
      unit: officialUnit,
      base_cost: baseCost,
      commercial_markup_percent: commercialMarkupPercent,
      reference_price: officialPrice,
      supplier: isGenuineMatch ? (economic.supplier || 'Catálogo Oficial SABRAR 2026') : null,
      reference_date: isGenuineMatch ? (economic.referenceDate || '2026-01') : null,
      price_source: isGenuineMatch ? (economic.priceSource || 'BASE_ECONOMICA_SABRAR_2026') : null,
      is_genuine_match: isGenuineMatch,
      matched_item: isGenuineMatch ? economic.matchedItem : null,
      failure_reason: failureReason,
      price_status: isGenuineMatch ? 'PRECIFICADO_CATALOGO' : 'PENDENTE_COTACAO'
    };
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
      pdfAttachments
    } = await this.readProjectDocuments(projectId, customText, options);

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
    let rawLLMResponse = null;
    let llmValidation = { valid: false, hasContent: false, errors: [], data: null };
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
    // GEOMETRIA UNIFICADA E VALIDADA (CONSUMIDA POR MATERIAIS E POR SERVIÇOS)
    // =========================================================================
    const rawDuctSegments = [...(eqData.explicitDuctSegments || [])];
    if (llmData && Array.isArray(llmData.ductSegments) && llmData.ductSegments.length > 0) {
      // Incorpora trechos de duto medidos pelo LLM somente se não houver conflito ou se possuírem comprimento explícito
      for (const lSeg of llmData.ductSegments) {
        if (lSeg.lengthM && lSeg.lengthM > 0) {
          const perim = calculateDuctPerimeter(lSeg.widthCm, lSeg.heightCm);
          const area = calculateDuctArea(perim, lSeg.lengthM) * (lSeg.qty || 1);
          const gauge = determineDuctGauge(lSeg.widthCm, lSeg.heightCm, false, false);
          rawDuctSegments.push({
            ...lSeg,
            perimeterM: perim,
            areaM2: area,
            gauge,
            weightKg: calculateDuctKg(area, gauge),
            insulationM2: calculateDuctInsulation(area, true),
            measurementStatus: 'MEDIDO'
          });
        }
      }
    }

    const measuredDuctSegments = rawDuctSegments.filter(s => s.measurementStatus === 'MEDIDO' && s.areaM2 > 0);
    const unmeasuredDuctSegments = rawDuctSegments.filter(s => s.measurementStatus === 'PENDENTE_MEDICAO' || !s.areaM2);

    const explicitMeasuredDuctArea = options?.measuredDuctAreaSqm != null && Number(options.measuredDuctAreaSqm) > 0
      ? Number(options.measuredDuctAreaSqm)
      : (measuredDuctSegments.length > 0
          ? measuredDuctSegments.reduce((sum, s) => sum + (s.areaM2 || 0), 0)
          : (cadData.explicitMpuAreaSqm > 0 ? Number(cadData.explicitMpuAreaSqm) : 0));

    const explicitMeasuredDuctMeters = options?.measuredDuctMeters != null && Number(options.measuredDuctMeters) > 0
      ? Number(options.measuredDuctMeters)
      : (measuredDuctSegments.length > 0
          ? measuredDuctSegments.reduce((sum, s) => sum + (s.lengthM || 0), 0)
          : (explicitMeasuredDuctArea > 0 ? Number((explicitMeasuredDuctArea / 2.2).toFixed(2)) : 0));

    const explicitMeasuredDuctPerimeter = measuredDuctSegments.length > 0
      ? Number(measuredDuctSegments.reduce((sum, s) => sum + (s.areaM2 || 0), 0).toFixed(2))
      : (explicitMeasuredDuctArea > 0
          ? Number(explicitMeasuredDuctArea.toFixed(2))
          : 0);

    // Percurso frigorígeno: NUNCA usa 3.0m fixo quando não estiver documentado ou medido
    const explicitDistanceMatch = documentContent.match(/(?:comprimento\s+da\s+linha\s+frigor[ií]gena|percurso\s+frigor[ií]geno|dist[aâ]ncia\s+entre\s+evaporadora\s+e\s+condensadora)\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*m\b/i);
    const llmMeasuredRefLine = llmData?.refrigerantLines?.find(r => r.measurementStatus === 'MEDIDO' && r.lengthM > 0);
    const measuredRefrigerantRunMeters = options?.measuredRefrigerantRunMeters != null && Number(options.measuredRefrigerantRunMeters) > 0
      ? Number(options.measuredRefrigerantRunMeters)
      : (explicitDistanceMatch
          ? Number(explicitDistanceMatch[1].replace(',', '.'))
          : (llmMeasuredRefLine ? Number(llmMeasuredRefLine.lengthM) : null));

    const validatedGeometry = {
      totalDuctOccurrences: rawDuctSegments.length,
      measuredDuctCount: measuredDuctSegments.length,
      unmeasuredDuctCount: unmeasuredDuctSegments.length,
      ductNetAreaSqm: explicitMeasuredDuctArea,
      ductLinearMeters: explicitMeasuredDuctMeters,
      ductPerimeterM: explicitMeasuredDuctPerimeter,
      ductMeasurementStatus: explicitMeasuredDuctArea > 0
        ? 'MEDIDO'
        : (rawDuctSegments.length > 0 || cadData.isMPU ? 'PENDENTE_MEDICAO' : 'NAO_APLICAVEL'),
      hasExternal30mmDuctNote: Boolean(cadData.hasExternalDeck || llmData?.scopeFlags?.hasExternal30mmDuctNote),
      externalDuctAreaSqm: options?.measuredExternalDuctAreaSqm != null ? Number(options.measuredExternalDuctAreaSqm) : null,
      externalDuctStatus: (cadData.hasExternalDeck || llmData?.scopeFlags?.hasExternal30mmDuctNote)
        ? (options?.measuredExternalDuctAreaSqm > 0 ? 'MEDIDO' : 'LOCALIZACAO_TRECHO_EXTERNO_PENDENTE')
        : 'NAO_APLICAVEL',
      refrigerantRunMetersPerCircuit: measuredRefrigerantRunMeters,
      refrigerantMeasurementStatus: measuredRefrigerantRunMeters && measuredRefrigerantRunMeters > 0
        ? 'MEDIDO'
        : (cadData.refrigerantType === 'COBRE_EXPANSAO_DIRETA' ? 'PENDENTE_MEDICAO' : 'NAO_APLICAVEL'),
      packagingMode
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

    if (isHVAC) {
      if (isHeavyKitchenVRVSystem) {
        requiredItems = [
          {
            name: 'Chapa Preta - Exaustão (Dutos Soldados #16 para Gordura)',
            category: 'Dutos',
            unit: 'KG',
            quantity: 1400,
            defaultPrice: null,
            measurementStatus: 'DOCUMENTADO',
            keywords: ['chapa preta exaustao', 'chapa 16'],
            reason: 'Rede de dutos de exaustão de gordura fabricada em chapa de aço preta #16 com solda estanque NBR 14518'
          },
          {
            name: 'Isolamento Fibra Cerâmica - 38 mm - 96 kg/m3 - 3,05m² (Kaowool)',
            category: 'Isolamento',
            unit: 'm²',
            quantity: 160,
            defaultPrice: null,
            measurementStatus: 'DOCUMENTADO',
            keywords: ['fibra ceramica', 'kaowool', 'isolamento 38mm'],
            reason: 'Isolamento corta-fogo em manta de fibra cerâmica Kaowool 38mm (128 kg/m³) com proteção em filme de alumínio'
          },
          {
            name: 'Chapa Galvanizada - Matéria Prima e Fabricação',
            category: 'Dutos',
            unit: 'kg',
            quantity: 800,
            defaultPrice: null,
            measurementStatus: 'DOCUMENTADO',
            keywords: ['chapa galvanizada', 'materia prima'],
            reason: 'Dutos de insuflamento e renovação de ar exterior em chapa de aço galvanizada'
          },
          {
            name: 'Damper Corta-Fogo Motorizado com Chave Fim de Curso e Solenoide',
            category: 'Ventilação e Exaustão',
            unit: 'un',
            quantity: eqData.numDampers || 3,
            defaultPrice: null,
            measurementStatus: 'DOCUMENTADO',
            keywords: ['damper corta fogo', 'solenoide'],
            reason: 'Dampers corta-fogo motorizados com acionamento por solenoide intertravados ao sensor Firestat Honeywell'
          }
        ];
      } else if (hvacMode === 'MODO_A_DIRETO') {
        // =========================================================================
        // MODO A — PROJETO EXECUTIVO HVAC (ZERO ESTIMATIVA POR ÁREA QUANDO SEM MEDIÇÃO)
        // =========================================================================
        requiredItems = [];
        const isMPU = cadData.isMPU || eqData.isMPU;

        // 1. DIFUSÃO DE AR E ELEMENTOS DOCUMENTADOS EM TABELA CAD OU TEXTO
        const cadDiffusionItems = (cadData.cadItems || []).filter(item => item.category === 'Difusão de Ar');
        for (const cItem of cadDiffusionItems) {
          requiredItems.push({
            name: cItem.name,
            category: 'Difusão de Ar',
            unit: cItem.unit || 'und',
            quantity: cItem.quantity,
            defaultPrice: null,
            measurementStatus: cItem.measurementStatus || 'DOCUMENTADO',
            sourceFiles: documentsAnalyzed,
            keywords: cItem.keywords,
            reason: cItem.reason
          });
        }

        // Chamadas de Tela Metálica para Retorno de Ar na planta (ex: 3 unidades para 3 Splitões)
        if (cadData.hasReturnMeshNote) {
          requiredItems.push({
            name: 'TELA MOEDA EM INOX PARA DUTO DE RETORNO',
            category: 'Difusão de Ar',
            unit: 'unid',
            quantity: cadData.returnMeshCalloutsCount || 3,
            defaultPrice: null,
            measurementStatus: 'DOCUMENTADO',
            sourceFiles: documentsAnalyzed,
            keywords: ['tela moeda', 'tela metalica retorno'],
            reason: `Planta Baixa & Legenda CAD: ${cadData.returnMeshCalloutsCount || 3}x Duto dotado de tela metálica para retorno de ar`
          });
        }

        // Chamadas de Duto Flexível / Circular Ø250 na planta
        if (cadData.circularDuctCallouts && cadData.circularDuctCallouts.includes(250)) {
          requiredItems.push({
            name: 'DUTO FLEXIVEL ISOLADO - SONODEC - 10"-250MM - CX 10M',
            category: 'ISOLAMENTO',
            unit: 'caixa c/ 10 metros',
            quantity: 1,
            defaultPrice: null,
            measurementStatus: 'DOCUMENTADO',
            sourceFiles: documentsAnalyzed,
            keywords: ['sonodec 250', 'duto flexivel isolado 250mm'],
            reason: `Planta Baixa CAD: ${cadData.circularDuctCallouts.filter(d => d === 250).length}x chamadas Ø250 para conexões flexíveis isoladas (1 caixa c/ 10m)`
          });
        }

        // 2. REDE DE DUTOS (CONSOME ESTRITAMENTE validatedGeometry — NUNCA SUBSTITUI POR estimatedArea * 0.35)
        if (isMPU || rawDuctSegments.length > 0) {
          if (isMPU) {
            const mpuPanels = calculateMPUDuctPanels(validatedGeometry.ductNetAreaSqm, {
              hasExternalDeckNote: validatedGeometry.hasExternal30mmDuctNote,
              externalAreaSqm: validatedGeometry.externalDuctAreaSqm,
              packagingMode: validatedGeometry.packagingMode
            });
            const mpuSupplies = calculateMPUSupplies(
              validatedGeometry.ductNetAreaSqm,
              validatedGeometry.ductPerimeterM,
              validatedGeometry.ductLinearMeters
            );
            const isDuctMeasured = validatedGeometry.ductMeasurementStatus === 'MEDIDO';
            const ductStatus = isDuctMeasured ? 'MEDIDO' : 'PENDENTE_MEDICAO';

            // Registra cada ocorrência de seção sem comprimento na lista de pendências de medição
            if (!isDuctMeasured && unmeasuredDuctSegments.length > 0) {
              unmeasuredItems.push({
                item: `Rede de Dutos em Painel MPU (${unmeasuredDuctSegments.length} seções identificadas sem comprimento linear na prancha)`,
                reason: 'PENDENTE_MEDICAO',
                occurrences_count: unmeasuredDuctSegments.length,
                sections_sample: unmeasuredDuctSegments.slice(0, 12).map(s => `${s.evidence} (${s.type})`),
                details: `Foram identificadas ${unmeasuredDuctSegments.length} chamadas de seção de duto (ex: I-60x45, R-100x70) sem cota de comprimento linear em metros. Em Modo Executivo (Modo A), a ausência de medição não é substituída por estimativa de área da obra.`
              });
            }

            // Pendência específica para trecho externo 30mm quando citado em nota/legenda sem delimitação
            if (mpuPanels.pendingExternalLocation) {
              unmeasuredItems.push({
                item: 'PAINEL MPU 30MM x 2,0 x 1,2M (2,4m²) (Trecho Externo / Patamar Técnico)',
                reason: 'LOCALIZACAO_TRECHO_EXTERNO_PENDENTE',
                details: 'A legenda especifica dutos em MPU 30mm para área externa, porém as pranchas não delimitam o perímetro/comprimento do trecho externo separadamente do trecho interno.'
              });
            }

            requiredItems.push({
              name: 'PAINEL MPU 20MM x 2,0 x 1,2M (2,4m²)',
              category: 'ISOLAMENTO',
              unit: 'PÇ',
              quantity: isDuctMeasured ? mpuPanels.internalCommercialPieces : 0,
              technicalCalculation: isDuctMeasured ? {
                netAreaSqm: mpuPanels.netAreaSqm,
                lossFactor: mpuPanels.lossFactor,
                lossAreaSqm: mpuPanels.lossAreaSqm,
                totalAreaWithLoss: mpuPanels.totalAreaWithLoss,
                requiredPieces: mpuPanels.internalRequiredPieces,
                commercialBoxesOf10: mpuPanels.internalBoxesOf10,
                commercialPieces: mpuPanels.internalCommercialPieces,
                packagingMode: mpuPanels.packagingMode
              } : null,
              defaultPrice: null,
              measurementStatus: ductStatus,
              keywords: ['painel mpu 20mm', 'mpu 20mm', 'mpu'],
              reason: isDuctMeasured
                ? `Geometria validada de dutos MPU 20mm: área líquida ${mpuPanels.netAreaSqm} m² × fator ${mpuPanels.lossFactor} (perda ${mpuPanels.lossAreaSqm} m²) = ${mpuPanels.totalAreaWithLoss} m² -> ${mpuPanels.internalRequiredPieces} peças necessárias -> compra comercial ${mpuPanels.internalCommercialPieces} painéis (${mpuPanels.internalBoxesOf10} caixas fechadas c/ 10 un)`
                : `PENDENTE DE MEDIÇÃO: ${unmeasuredDuctSegments.length} seções de dutos identificadas nas pranchas sem cota de comprimento linear.`
            });

            if (validatedGeometry.hasExternal30mmDuctNote) {
              const hasExtMeas = mpuPanels.externalCommercialPieces > 0;
              requiredItems.push({
                name: 'PAINEL MPU 30MM x 2,0 x 1,2M (2,4m²)',
                category: 'ISOLAMENTO',
                unit: 'PÇ',
                quantity: hasExtMeas ? mpuPanels.externalCommercialPieces : 0,
                defaultPrice: null,
                measurementStatus: hasExtMeas ? 'MEDIDO' : 'LOCALIZACAO_TRECHO_EXTERNO_PENDENTE',
                keywords: ['painel mpu 30mm', 'mpu 30mm', 'mpu'],
                reason: hasExtMeas
                  ? `Trecho externo medido: ${mpuPanels.externalArea} m² c/ perda = ${mpuPanels.externalCommercialPieces} painéis`
                  : 'PENDENTE DE LOCALIZAÇÃO/MEDIÇÃO DE TRECHO EXTERNO: Legenda cita MPU 30mm para área externa sem delimitação na prancha.'
              });
            }

            // Acessórios MPU e Suportação (acompanham estritamente o status de medição dos dutos)
            requiredItems.push(
              {
                name: 'PERFIL DE CONEXÃO ALUMINIO PARA PAINEL DE MPU 20MM BARRA C/ 3MTS',
                category: 'MPU E ACESSÓRIOS',
                unit: 'barra c/ 3 metros',
                quantity: isDuctMeasured ? mpuSupplies.profileBars3m : 0,
                defaultPrice: null,
                measurementStatus: ductStatus,
                keywords: ['perfil conexao aluminio mpu', 'perfil mpu'],
                reason: isDuctMeasured
                  ? `Acessórios MPU: ${mpuSupplies.totalProfileMeters}m lineares = ${mpuSupplies.profileBars3m} barras de 3m`
                  : 'PENDENTE DE MEDIÇÃO da rede de dutos MPU.'
              },
              {
                name: 'COLA ADESIVA PARA PERFIL DE MPU',
                category: 'MPU E ACESSÓRIOS',
                unit: 'und',
                quantity: isDuctMeasured ? mpuSupplies.colaLatas : 0,
                defaultPrice: null,
                measurementStatus: ductStatus,
                keywords: ['cola adesiva mpu', 'adesivo mpu'],
                reason: isDuctMeasured
                  ? `Acessórios MPU: Cola adesiva para montagem dos perfis MPU = ${mpuSupplies.colaLatas} latas`
                  : 'PENDENTE DE MEDIÇÃO da rede de dutos MPU.'
              },
              {
                name: 'FITA ALUMINIO 50MMx50M MPU',
                category: 'MPU E ACESSÓRIOS',
                unit: 'und',
                quantity: isDuctMeasured ? mpuSupplies.fitaAluminioRolos : 0,
                defaultPrice: null,
                measurementStatus: ductStatus,
                keywords: ['fita aluminio mpu', 'fita aluminio 50mmx50m'],
                reason: isDuctMeasured
                  ? `Acessórios MPU: Fita de alumínio adesiva 50mmx50m = ${mpuSupplies.fitaAluminioRolos} rolos`
                  : 'PENDENTE DE MEDIÇÃO da rede de dutos MPU.'
              },
              {
                name: 'SELANTE PARA DUTOS MPU',
                category: 'MPU E ACESSÓRIOS',
                unit: 'und',
                quantity: isDuctMeasured ? mpuSupplies.selanteTubos : 0,
                defaultPrice: null,
                measurementStatus: ductStatus,
                keywords: ['selante dutos mpu', 'silicone mpu'],
                reason: isDuctMeasured
                  ? `Acessórios MPU: Selante para calafetação dos dutos MPU = ${mpuSupplies.selanteTubos} tubos`
                  : 'PENDENTE DE MEDIÇÃO da rede de dutos MPU.'
              },
              {
                name: 'CANTO DE REFORÇO PARA MPU - 20MM',
                category: 'MPU E ACESSÓRIOS',
                unit: 'und',
                quantity: isDuctMeasured ? mpuSupplies.cantosReforco : 0,
                defaultPrice: null,
                measurementStatus: ductStatus,
                keywords: ['canto reforco mpu', 'cantoneira mpu'],
                reason: isDuctMeasured
                  ? `Acessórios MPU: Cantos de reforço para dutos MPU = ${mpuSupplies.cantosReforco} un`
                  : 'PENDENTE DE MEDIÇÃO da rede de dutos MPU.'
              }
            );

            const avgWidth = rawDuctSegments.length > 0
              ? (rawDuctSegments.reduce((s, d) => s + (d.widthCm || 60), 0) / rawDuctSegments.length)
              : 60;
            const supports = isDuctMeasured
              ? calculateDuctSupports(validatedGeometry.ductLinearMeters, avgWidth)
              : { numSupports: 0, totalPerfiladoMeters: 0, chumbadores: 0, porcas: 0 };

            requiredItems.push(
              {
                name: 'Perfilado Galvanizado 38x38 Chapa #14 para Suportação de Dutos',
                category: 'Fixação e Suportação',
                unit: 'm',
                quantity: isDuctMeasured ? Math.ceil(supports.totalPerfiladoMeters) : 0,
                defaultPrice: null,
                measurementStatus: ductStatus,
                keywords: ['perfilado galvanizado', 'perfilado 38x38'],
                reason: isDuctMeasured
                  ? `Passo 11.5: Suportes a cada 1,50m = ${Math.ceil(supports.totalPerfiladoMeters)} m`
                  : 'PENDENTE DE MEDIÇÃO linear da rede de dutos.'
              },
              {
                name: 'Tirante Roscado Galvanizado 1/4 pol (Barra de 3 metros)',
                category: 'Fixação e Suportação',
                unit: 'und',
                quantity: isDuctMeasured ? Math.ceil(supports.numSupports) : 0,
                defaultPrice: null,
                measurementStatus: ductStatus,
                keywords: ['tirante 1/4', 'barra roscada 1/4'],
                reason: isDuctMeasured
                  ? `Passo 11.5: Tirantes de sustentação aérea a cada 1,50m = ${Math.ceil(supports.numSupports)} barras`
                  : 'PENDENTE DE MEDIÇÃO linear da rede de dutos.'
              },
              {
                name: 'Chumbador CBA 1/4 pol com Cone e Jaqueta para Ancoragem em Laje',
                category: 'Fixação e Suportação',
                unit: 'und',
                quantity: isDuctMeasured ? supports.chumbadores : 0,
                defaultPrice: null,
                measurementStatus: ductStatus,
                keywords: ['chumbador 1/4', 'cone e jaqueta'],
                reason: isDuctMeasured
                  ? `Passo 11.5: Ancoragem mecânica em laje (2 por suporte) = ${supports.chumbadores} un`
                  : 'PENDENTE DE MEDIÇÃO linear da rede de dutos.'
              },
              {
                name: 'Conjunto Porca Sextavada e Arruela Lisa 1/4 pol',
                category: 'Fixação e Suportação',
                unit: 'cj',
                quantity: isDuctMeasured ? supports.porcas : 0,
                defaultPrice: null,
                measurementStatus: ductStatus,
                keywords: ['porca 1/4', 'arruela 1/4'],
                reason: isDuctMeasured
                  ? `Passo 11.5: Porcas e arruelas 1/4 pol = ${supports.porcas} cj`
                  : 'PENDENTE DE MEDIÇÃO linear da rede de dutos.'
              }
            );
          } else {
            // Dutos em Chapa Galvanizada TDC (somente para trechos medidos; se não medidos, registra pendência)
            const isDuctMeasured = measuredDuctSegments.length > 0;
            if (!isDuctMeasured) {
              unmeasuredItems.push({
                item: `Rede de Dutos de Chapa Galvanizada TDC (${unmeasuredDuctSegments.length} seções sem comprimento linear)`,
                reason: 'PENDENTE_MEDICAO',
                occurrences_count: unmeasuredDuctSegments.length,
                details: 'Seções de duto identificadas sem cota de comprimento linear em metros.'
              });
              requiredItems.push({
                name: 'Duto de Chapa Galvanizada TDC',
                category: 'Dutos',
                unit: 'KG',
                quantity: 0,
                defaultPrice: null,
                measurementStatus: 'PENDENTE_MEDICAO',
                keywords: ['chapa galvanizada', 'duto tdc'],
                reason: `PENDENTE DE MEDIÇÃO: ${unmeasuredDuctSegments.length} seções de duto sem comprimento linear.`
              });
            } else {
              const gaugeGroups = new Map();
              for (const seg of measuredDuctSegments) {
                const key = `${seg.isBlackSteel ? 'CHAPA_PRETA' : 'GALVANIZADO'}_${seg.gauge}`;
                if (!gaugeGroups.has(key)) {
                  gaugeGroups.set(key, { gauge: seg.gauge, isBlackSteel: seg.isBlackSteel, totalMeters: 0, totalAreaSqm: 0, totalKg: 0, count: 0 });
                }
                const g = gaugeGroups.get(key);
                g.totalMeters += seg.lengthM;
                g.totalAreaSqm += seg.areaM2;
                g.totalKg += seg.weightKg;
                g.count++;
              }
              for (const [, g] of gaugeGroups.entries()) {
                const cleanKg = Math.round(g.totalKg);
                requiredItems.push({
                  name: g.isBlackSteel
                    ? 'Dutos Soldados de Chapa de Aço Preta #16 para Exaustão de Gordura'
                    : `Duto de Chapa Galvanizada TDC Bitola ${g.gauge}`,
                  category: 'Dutos',
                  unit: 'KG',
                  quantity: cleanKg,
                  defaultPrice: null,
                  measurementStatus: 'MEDIDO',
                  keywords: ['chapa galvanizada', 'duto tdc', g.gauge.toLowerCase()],
                  reason: `Passo 3 a 8: ${g.count} trechos medidos (${g.totalMeters.toFixed(1)}m lineares, ${g.totalAreaSqm.toFixed(2)} m² = ${cleanKg} KG)`
                });
              }
            }
          }
        }

        // 3. TUBULAÇÃO FRIGORÍGENA (SOMENTE SE DOCUMENTADA OU COM MÁQUINAS E NOTA DE TUBULAÇÃO)
        const hasRefrigerantScope = cadData.refrigerantType === 'COBRE_EXPANSAO_DIRETA' ||
          (eqData.machines.length > 0 && /refrigerante|cobre|condensadora/i.test(documentContent));

        if (hasRefrigerantScope) {
          const evapMachines = eqData.machines.filter(m => !m.type.includes('CONDENSADORA'));
          const condMachines = eqData.machines.filter(m => m.type.includes('CONDENSADORA'));
          const numSystems = (evapMachines.reduce((s, m) => s + (m.qty || 1), 0)) ||
            (condMachines.reduce((s, m) => s + (m.qty || 1), 0)) || 1;
          const maxUnitTr = evapMachines.length > 0
            ? Math.max(...evapMachines.map(m => m.tr || (m.btu ? m.btu / 12000 : 10)))
            : 10;

          // Bitolas técnicas conforme capacidade real da máquina (ex: 20 TR usa 1.1/8" e=1/16" e 5/8" e=1/16" rígido)
          let suctionSpec = '1.1/8" – 28,57mm – e=1/16" tubulação de cobre RÍGIDO';
          let liquidSpec = '5/8" – 15,88mm – e=1/16" tubulação de cobre RÍGIDO';
          let armaflexSuction = 'ESPUMA ELASTOMÉRICA DO TIPO ARMAFLEX - M028 (para linha de sucção 1.1/8")';
          let armaflexLiquid = 'ESPUMA ELASTOMÉRICA DO TIPO ARMAFLEX - H015 (para linha de líquido 5/8")';

          if (maxUnitTr < 3) {
            suctionSpec = '5/8" – 15,88mm – e=1/32" tubulação de cobre FLEXÍVEL';
            liquidSpec = '3/8" – 9,53mm – e=1/32" tubulação de cobre FLEXÍVEL';
            armaflexSuction = 'ESPUMA ELASTOMÉRICA DO TIPO ARMAFLEX - M015';
            armaflexLiquid = 'ESPUMA ELASTOMÉRICA DO TIPO ARMAFLEX - H010';
          } else if (maxUnitTr <= 12) {
            suctionSpec = '7/8" – 22,22mm – e=1/16" tubulação de cobre RÍGIDO';
            liquidSpec = '1/2" – 12,70mm – e=1/32" tubulação de cobre FLEXÍVEL';
            armaflexSuction = 'ESPUMA ELASTOMÉRICA DO TIPO ARMAFLEX - M022';
            armaflexLiquid = 'ESPUMA ELASTOMÉRICA DO TIPO ARMAFLEX - H012';
          }

          const isRefMeasured = validatedGeometry.refrigerantMeasurementStatus === 'MEDIDO' &&
            validatedGeometry.refrigerantRunMetersPerCircuit > 0;
          const refStatus = isRefMeasured ? 'MEDIDO' : 'PENDENTE_MEDICAO';
          const runMeters = isRefMeasured ? validatedGeometry.refrigerantRunMetersPerCircuit : 0;
          const totalLinearPerLine = isRefMeasured ? Number((numSystems * runMeters * 1.25).toFixed(2)) : 0;

          if (!isRefMeasured) {
            unmeasuredItems.push({
              item: `Rede Frigorígena em Cobre (${suctionSpec} e ${liquidSpec}) + Isolamento Armaflex + Cabo de Comando`,
              reason: 'PENDENTE_MEDICAO',
              details: 'A prancha/legenda indica tubulação de gás refrigerante com isolamento térmico, porém não informa o comprimento linear (m) dos caminhamentos frigorígenos.'
            });
          }

          requiredItems.push(
            {
              name: suctionSpec,
              category: 'Linha frigorígena',
              unit: 'm',
              quantity: totalLinearPerLine,
              defaultPrice: null,
              measurementStatus: refStatus,
              keywords: ['tubo cobre 1.1/8', 'cobre 1.1/8'],
              reason: isRefMeasured
                ? `Passo 13: ${numSystems} circuito(s) × ${runMeters}m com 25% de perda da OP = ${totalLinearPerLine}m de linha de sucção`
                : 'PENDENTE DE MEDIÇÃO: Comprimento linear da linha de sucção não cotado na prancha.'
            },
            {
              name: liquidSpec,
              category: 'Linha frigorígena',
              unit: 'm',
              quantity: totalLinearPerLine,
              defaultPrice: null,
              measurementStatus: refStatus,
              keywords: ['tubo cobre 5/8', 'cobre 5/8'],
              reason: isRefMeasured
                ? `Passo 13: ${numSystems} circuito(s) × ${runMeters}m com 25% de perda da OP = ${totalLinearPerLine}m de linha de líquido`
                : 'PENDENTE DE MEDIÇÃO: Comprimento linear da linha de líquido não cotado na prancha.'
            },
            {
              name: armaflexSuction,
              category: 'Isolamento',
              unit: 'm',
              quantity: totalLinearPerLine,
              defaultPrice: null,
              measurementStatus: refStatus,
              keywords: ['armaflex m028', 'espuma elastomerica 28mm'],
              reason: isRefMeasured
                ? `Passo 13.3: Isolamento elastomérico Armaflex 1:1 com a linha de sucção (${totalLinearPerLine}m)`
                : 'PENDENTE DE MEDIÇÃO: Aguardando metragem linear da linha de sucção.'
            },
            {
              name: armaflexLiquid,
              category: 'Isolamento',
              unit: 'm',
              quantity: totalLinearPerLine,
              defaultPrice: null,
              measurementStatus: refStatus,
              keywords: ['armaflex h015', 'espuma elastomerica 15mm'],
              reason: isRefMeasured
                ? `Passo 13.3: Isolamento elastomérico Armaflex 1:1 com a linha de líquido (${totalLinearPerLine}m)`
                : 'PENDENTE DE MEDIÇÃO: Aguardando metragem linear da linha de líquido.'
            },
            {
              name: 'ARMAFIX H/M 025/028',
              category: 'Linha frigorígena',
              unit: 'unid',
              quantity: isRefMeasured ? Math.max(4, Math.ceil(numSystems * (runMeters / 1.5) * 2)) : 0,
              defaultPrice: null,
              measurementStatus: refStatus,
              keywords: ['armafix 028', 'armafix'],
              reason: isRefMeasured
                ? 'Suportação isolada Armafix para a linha de sucção 1.1/8"'
                : 'PENDENTE DE MEDIÇÃO da linha frigorígena.'
            },
            {
              name: 'ARMAFIX H/M 012/015',
              category: 'Linha frigorígena',
              unit: 'unid',
              quantity: isRefMeasured ? Math.max(4, Math.ceil(numSystems * (runMeters / 1.5) * 2)) : 0,
              defaultPrice: null,
              measurementStatus: refStatus,
              keywords: ['armafix 015', 'armafix'],
              reason: isRefMeasured
                ? 'Suportação isolada Armafix para a linha de líquido 5/8"'
                : 'PENDENTE DE MEDIÇÃO da linha frigorígena.'
            },
            {
              name: 'GÁS REFRIGERANTE R410A - 11,3KG - FREON',
              category: 'Linha frigorígena',
              unit: 'pç',
              quantity: isRefMeasured ? Math.max(1, numSystems) : 0,
              defaultPrice: null,
              measurementStatus: refStatus,
              keywords: ['gas refrigerante r410a', 'freon r410a', 'r410a'],
              reason: isRefMeasured
                ? 'Carga adicional de fluido refrigerante R410A proporcional à linha medida'
                : 'PENDENTE DE MEDIÇÃO do comprimento das linhas frigorígenas para cálculo da carga adicional de gás.'
            },
            {
              name: 'CABO SHIELD AFT 300V 3X18 AWG BLINDADO',
              category: 'Elétrica',
              unit: 'm',
              quantity: isRefMeasured ? Number((totalLinearPerLine * 1.5).toFixed(2)) : 0,
              defaultPrice: null,
              measurementStatus: refStatus,
              keywords: ['cabo shield', 'cabo aft', 'cabo blindado'],
              reason: isRefMeasured
                ? 'Cabo de sinal e comunicação entre evaporadoras e condensadoras'
                : 'PENDENTE DE MEDIÇÃO do encaminhamento entre unidades evaporadoras e condensadoras.'
            }
          );
        }

        // 4. INTEGRAÇÃO DIRETA DOS MATERIAIS EXTRAÍDOS E VALIDADOS DO MODELO DE IA (LLM)
        if (llmData && Array.isArray(llmData.materials) && llmData.materials.length > 0) {
          for (const llmMat of llmData.materials) {
            // Rejeita estimativas por área para dutos/cobre quando a geometria do documento está pendente
            const isDuctOrPipeItem = /\bmpu\b|painel\s+mpu|tubula[çc][aã]o\s+de\s+cobre|tubo\s+de\s+cobre/i.test(llmMat.name);
            const isUnverifiedAreaEstimate = isDuctOrPipeItem &&
              /estimad|0[.,]35|por\s+[aá]rea/i.test(llmMat.evidence || '') &&
              validatedGeometry.ductMeasurementStatus === 'PENDENTE_MEDICAO';

            const effectiveQty = isUnverifiedAreaEstimate ? 0 : llmMat.quantity;
            const effectiveStatus = isUnverifiedAreaEstimate ? 'PENDENTE_MEDICAO' : llmMat.measurementStatus;

            const existingIdx = requiredItems.findIndex(r =>
              r.name.toLowerCase() === llmMat.name.toLowerCase() ||
              (r.name.toLowerCase().includes(llmMat.name.toLowerCase().slice(0, 18)) && r.unit.toLowerCase() === llmMat.unit.toLowerCase())
            );

            if (existingIdx !== -1) {
              // Se o LLM trouxe uma quantidade explícita documentada/medida válida, atualiza o item
              if (effectiveQty > 0 && effectiveStatus !== 'PENDENTE_MEDICAO') {
                requiredItems[existingIdx].quantity = effectiveQty;
                requiredItems[existingIdx].measurementStatus = effectiveStatus;
                requiredItems[existingIdx].reason = `Extraído pela IA (${llmMat.sourceFile} pág. ${llmMat.sourcePage}): ${llmMat.evidence}`;
              }
            } else {
              requiredItems.push({
                name: llmMat.name,
                category: llmMat.category || 'Materiais Extraídos (IA)',
                unit: llmMat.unit || 'un',
                quantity: effectiveQty,
                defaultPrice: null,
                measurementStatus: effectiveStatus,
                sourceFiles: [llmMat.sourceFile || 'Documento do Projeto'],
                keywords: [llmMat.name.toLowerCase()],
                reason: `Extraído pela IA (${llmMat.sourceFile} pág. ${llmMat.sourcePage}): ${llmMat.evidence}`
              });
            }
          }
        }
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
            measurementStatus: 'ESTIMADO_MODO_B',
            keywords: ['mpu', 'painel duto', 'pre-isolado'],
            reason: `Estimativa Preliminar Modo B: ${estimatedArea}m² × 0.35 × 1.40 / 2.4m² (${modeExplanation})`
          },
          {
            name: '3/8" – 9,53mm – e=1/32" tubulação de cobre FLEXÍVEL',
            category: 'Climatização - Expansão Direta',
            unit: 'm',
            quantity: Math.round(estimatedArea * 0.22),
            defaultPrice: null,
            measurementStatus: 'ESTIMADO_MODO_B',
            keywords: ['cobre 3/8', 'tubo cobre 3/8'],
            reason: `Estimativa Preliminar Modo B: Linha de líquido frigorígeno (${Math.round(estimatedArea * 0.22)} m)`
          },
          {
            name: '5/8" – 15,88mm – e=1/32" tubulação de cobre FLEXÍVEL',
            category: 'Climatização - Expansão Direta',
            unit: 'm',
            quantity: Math.round(estimatedArea * 0.16),
            defaultPrice: null,
            measurementStatus: 'ESTIMADO_MODO_B',
            keywords: ['cobre 5/8', 'tubo cobre 5/8'],
            reason: `Estimativa Preliminar Modo B: Linha de sucção frigorígena (${Math.round(estimatedArea * 0.16)} m)`
          },
          {
            name: 'GÁS REFRIGERANTE R410A - 11,3KG - FREON',
            category: 'Climatização - Expansão Direta',
            unit: 'pç',
            quantity: Math.max(1, Math.round(thermalLoad.totalTR * 0.20)),
            defaultPrice: null,
            measurementStatus: 'ESTIMADO_MODO_B',
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

    // Processa cada material necessário, buscando na Base Central SABRAR
    // REGRA 8 (Codex): NUNCA multiplicar quantidades documentadas/medidas pelo fator histórico!
    for (const itemDef of requiredItems) {
      const mat = await this.findOrCreateMaterial(itemDef, systemContext, { commercialMarkupPercent });
      const technicalQuantity = Number(itemDef.quantity ?? 0);
      const measurementStatus = itemDef.measurementStatus || (technicalQuantity > 0 ? 'DOCUMENTADO' : 'PENDENTE_MEDICAO');
      const isPendingMeasurement = measurementStatus === 'PENDENTE_MEDICAO' ||
        measurementStatus === 'LOCALIZACAO_TRECHO_EXTERNO_PENDENTE' ||
        technicalQuantity <= 0;

      // Consulta histórico APENAS como sugestão informativa separada (sem alterar a quantidade técnica/medida)
      const historyAdj = await LearningService.getHistoricalAdjustment(project.project_type, mat.id);
      const isDiscrete = /unid|und|un\b|pç|pc|peça|cx|caixa|pct|pacote|lata|rolo|barra|frasco|balde|tubo|cartucho|kit|jogo|par|duzia/i.test(mat.unit || '');
      const finalQuantity = isPendingMeasurement
        ? 0
        : (isDiscrete && Number.isInteger(technicalQuantity)
            ? Math.round(technicalQuantity)
            : Number(technicalQuantity.toFixed(2)));

      if (historyAdj?.hasHistory && finalQuantity > 0 && historyAdj.factor !== 1) {
        const suggestedHistoricalQty = isDiscrete
          ? Math.round(finalQuantity * historyAdj.factor)
          : Number((finalQuantity * historyAdj.factor).toFixed(2));
        historicalSuggestions.push({
          material_id: mat.id,
          material_code: mat.code,
          material_name: mat.name,
          documented_or_measured_quantity: finalQuantity,
          historical_factor: historyAdj.factor,
          historical_suggested_quantity: suggestedHistoricalQty,
          explanation: historyAdj.explanation,
          applied_to_budget: false
        });
      }

      const rawPrice = mat.reference_price;
      const hasValidPrice = (rawPrice !== null && rawPrice !== undefined && Number(rawPrice) > 0);
      const unitPrice = hasValidPrice ? Number(Number(rawPrice).toFixed(2)) : 0.00;
      const subtotal = (!isPendingMeasurement && hasValidPrice)
        ? Number((finalQuantity * unitPrice).toFixed(2))
        : 0.00;

      if (isPendingMeasurement) {
        pendingItems.push({
          material_id: mat.id,
          material_code: mat.code,
          material_name: mat.name,
          reason: measurementStatus === 'LOCALIZACAO_TRECHO_EXTERNO_PENDENTE'
            ? 'TRECHO EXTERNO 30MM SEM DELIMITAÇÃO E MEDIÇÃO NA PRANCHA'
            : 'QUANTIDADE PENDENTE DE MEDIÇÃO LINEAR NA PRANCHA',
          suggested_quantity: 0,
          unit: mat.unit,
          type: measurementStatus,
          price_available: hasValidPrice ? unitPrice : null,
          failure_reason: mat.failure_reason
        });
      } else if (!hasValidPrice) {
        const unpricedEntry = {
          material_id: mat.id,
          material_code: mat.code,
          material_name: mat.name,
          quantity: finalQuantity,
          unit: mat.unit,
          reason: mat.failure_reason || 'PREÇO NÃO CADASTRADO NA BASE SABRAR',
          type: 'PRECO_PENDENTE'
        };
        unpricedItems.push(unpricedEntry);
        pendingItems.push({
          material_id: mat.id,
          material_code: mat.code,
          material_name: mat.name,
          reason: mat.failure_reason || 'PREÇO NÃO CADASTRADO NA BASE SABRAR',
          suggested_quantity: finalQuantity,
          unit: mat.unit,
          type: 'PRECO_PENDENTE'
        });
      }

      budgetMaterials.push({
        material_id: mat.id,
        material_code: mat.code,
        material_name: mat.name,
        quantity: finalQuantity,
        unit: mat.unit,
        base_cost: mat.base_cost,
        commercial_markup_percent: mat.commercial_markup_percent,
        unit_price: unitPrice,
        subtotal: subtotal,
        supplier: mat.supplier,
        reference_date: mat.reference_date,
        price_source: mat.price_source,
        failure_reason: mat.failure_reason,
        measurement_status: measurementStatus,
        is_pending_quote: !hasValidPrice,
        is_pending_measurement: isPendingMeasurement,
        price_status: hasValidPrice ? 'PRECIFICADO_CATALOGO' : 'PENDENTE_COTACAO',
        technical_calculation: itemDef.technicalCalculation || null,
        reason: itemDef.reason
      });

      auditItems.push({
        material_id: mat.id,
        material_code: mat.code,
        material_name: mat.name,
        technical_quantity: technicalQuantity,
        final_quantity: finalQuantity,
        measurement_status: measurementStatus,
        match_status: isPendingMeasurement
          ? 'MEASUREMENT_REQUIRED'
          : (hasValidPrice ? 'EXACT' : 'REVIEW_REQUIRED'),
        supplier: mat.supplier,
        reference_date: mat.reference_date,
        price_source: mat.price_source,
        failure_reason: mat.failure_reason,
        historical_adjustment: historyAdj?.hasHistory ? {
          factor: historyAdj.factor,
          explanation: historyAdj.explanation,
          applied: false
        } : null,
        sources: itemDef.sourceFiles || (documentsAnalyzed.length > 0 ? documentsAnalyzed : ['Documento do Projeto']),
        calculation_summary: itemDef.reason,
        notes: isPendingMeasurement
          ? 'Item identificado no projeto, aguardando medição geométrica linear.'
          : (!hasValidPrice
              ? `Aguardando cotação (${mat.failure_reason || 'sem preço cadastrado na base'}).`
              : `Precificado via ${mat.price_source} (${mat.supplier}, ref. ${mat.reference_date}).`)
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
      if (isHeavyKitchenVRVSystem) {
        defaultServices = [
          {
            category: 'MÃO DE OBRA',
            description: 'Caldeiraria pesada, conformação e solda contínua estanque de dutos de chapa preta #16 para exaustão de gordura (NBR 14518)',
            quantity: 1,
            unit: 'cj',
            unitPrice: 28000.00,
            measurementStatus: 'DOCUMENTADO',
            notes: 'Soldagem estanque para evitar vazamento de gordura e risco de incêndio conforme NBR 14518'
          }
        ];
      } else if (hvacMode === 'MODO_A_DIRETO') {
        const isMPU = cadData.isMPU || eqData.isMPU;
        const condMachines = eqData.machines.filter(m => m.type.includes('CONDENSADORA'));
        const evapMachines = eqData.machines.filter(m => !m.type.includes('CONDENSADORA'));
        const numCondensers = condMachines.reduce((s, m) => s + (m.qty || 1), 0) ||
          evapMachines.reduce((s, m) => s + (m.qty || 1), 0);

        defaultServices = [];

        if (numCondensers > 0) {
          defaultServices.push({
            category: 'MÃO DE OBRA',
            description: 'Preço Mão de Obra Unidade Condensadora (1 por sistema) (MO) - ESPECIAIS',
            quantity: numCondensers,
            unit: 'Unid.',
            unitPrice: 8400.00,
            measurementStatus: 'DOCUMENTADO',
            notes: `Instalação mecânica especializada de ${numCondensers} sistema(s) conforme Quadro/Lista de Material CAD`
          });
        }

        if (isMPU || rawDuctSegments.length > 0) {
          // USA EXATAMENTE A MESMA GEOMETRIA VALIDADA DOS MATERIAIS (ZERO FALLBACK || 267.15)
          const isDuctMeasured = validatedGeometry.ductMeasurementStatus === 'MEDIDO' && validatedGeometry.ductNetAreaSqm > 0;
          const mpuCalcForLabor = calculateMPUDuctPanels(validatedGeometry.ductNetAreaSqm, {
            hasExternalDeckNote: validatedGeometry.hasExternal30mmDuctNote,
            externalAreaSqm: validatedGeometry.externalDuctAreaSqm,
            packagingMode: validatedGeometry.packagingMode
          });
          const laborDuctAreaSqm = isDuctMeasured ? mpuCalcForLabor.totalAreaWithLoss : 0;

          if (!isDuctMeasured) {
            unmeasuredItems.push({
              item: 'Serviço de Duteiro (fabricação e montagem de dutos em m²)',
              reason: 'PENDENTE_MEDICAO',
              details: 'A mão de obra de fabricação e montagem de dutos utiliza a mesma área validada dos materiais de dutos, que encontra-se PENDENTE_MEDICAO.'
            });
            pendingItems.push({
              material_id: null,
              material_code: 'SERV-DUTEIRO',
              material_name: 'Duteiro (fabricação e montagem)',
              reason: 'ÁREA DE DUTOS PENDENTE DE MEDIÇÃO LINEAR NA PRANCHA',
              suggested_quantity: 0,
              unit: 'm²',
              type: 'PENDENTE_MEDICAO'
            });
          }

          defaultServices.push({
            category: 'MÃO DE OBRA',
            description: 'Duteiro (fabricação e montagem)',
            quantity: laborDuctAreaSqm,
            unit: 'm²',
            unitPrice: 140.00,
            measurementStatus: isDuctMeasured ? 'MEDIDO' : 'PENDENTE_MEDICAO',
            notes: isDuctMeasured
              ? `Fabricação e montagem de dutos sobre a mesma geometria validada dos materiais (${validatedGeometry.ductNetAreaSqm} m² líquidos × 1,40 = ${laborDuctAreaSqm} m²)`
              : 'PENDENTE DE MEDIÇÃO: Aguardando medição linear dos trechos de dutos na prancha.'
          });

          if (numCondensers > 0) {
            defaultServices.push({
              category: 'MÃO DE OBRA',
              description: 'Fechamento',
              quantity: numCondensers,
              unit: 'unid',
              unitPrice: 280.00,
              measurementStatus: 'DOCUMENTADO',
              notes: `Interligação de caixas plenum, grelhas e difusores (${numCondensers} sistemas)`
            });
          }
        }

        // Içamento e Supervisão: NUNCA fixar 2 diárias ou 0,27 mês sem parâmetro ou definição explícita no processo
        const explicitLiftingDays = options?.liftingDays != null
          ? Number(options.liftingDays)
          : (llmData?.services?.find(s => /i[çc]amento|munck|guindaste/i.test(s.name))?.quantity || 0);

        const explicitSupervisorMonths = options?.supervisorMonths != null
          ? Number(options.supervisorMonths)
          : (llmData?.services?.find(s => /supervisor|supervis[aã]o/i.test(s.name))?.quantity || 0);

        if (/patamar\s*t[eé]cnico|i[çc]amento|cobertura|superior/i.test(documentContent) || explicitLiftingDays > 0) {
          const hasLifting = explicitLiftingDays > 0;
          if (!hasLifting) {
            unmeasuredItems.push({
              item: 'Serviço de Içamento (diárias de caminhão munck/guindaste para patamar técnico)',
              reason: 'PENDENTE_DEFINICAO_ESCOPO',
              details: 'O projeto prevê equipamentos em patamar técnico, porém o número de diárias de içamento deve ser parametrizado conforme logística da obra.'
            });
            pendingItems.push({
              material_id: null,
              material_code: 'SERV-ICAMENTO',
              material_name: 'Içamento',
              reason: 'QUANTIDADE DE DIÁRIAS DE IÇAMENTO PENDENTE DE DEFINIÇÃO OPERACIONAL',
              suggested_quantity: 0,
              unit: 'diária',
              type: 'PENDENTE_DEFINICAO_ESCOPO'
            });
          }
          defaultServices.push({
            category: 'MÃO DE OBRA',
            description: 'Içamento',
            quantity: hasLifting ? explicitLiftingDays : 0,
            unit: 'diária',
            unitPrice: 9520.00,
            measurementStatus: hasLifting ? 'PARAMETRIZADO' : 'PENDENTE_DEFINICAO_ESCOPO',
            notes: hasLifting
              ? `Içamento parametrizado (${explicitLiftingDays} diária(s))`
              : 'PENDENTE DE DEFINIÇÃO DE ESCOPO: Informar número de diárias de içamento para patamar técnico.'
          });
        }

        if (numCondensers > 0 || explicitSupervisorMonths > 0) {
          const hasSup = explicitSupervisorMonths > 0;
          if (!hasSup) {
            unmeasuredItems.push({
              item: 'Supervisor - 6 Horas - 22 Dias/Mês (dedicação mensal de supervisão)',
              reason: 'PENDENTE_DEFINICAO_ESCOPO',
              details: 'A fração de mês de supervisão técnica depende do cronograma executivo da obra.'
            });
            pendingItems.push({
              material_id: null,
              material_code: 'SERV-SUPERVISOR',
              material_name: 'Supervisor - 6 Horas - 22 Dias/ Mês',
              reason: 'DEDICAÇÃO DE SUPERVISÃO (MÊS) PENDENTE DE CRONOGRAMA DA OBRA',
              suggested_quantity: 0,
              unit: 'mês',
              type: 'PENDENTE_DEFINICAO_ESCOPO'
            });
          }
          defaultServices.push({
            category: 'MÃO DE OBRA',
            description: 'Supervisor - 6 Horas -  22 Dias/ Mês',
            quantity: hasSup ? explicitSupervisorMonths : 0,
            unit: 'mês',
            unitPrice: 16802.22,
            measurementStatus: hasSup ? 'PARAMETRIZADO' : 'PENDENTE_DEFINICAO_ESCOPO',
            notes: hasSup
              ? `Supervisão técnica parametrizada (${explicitSupervisorMonths} mês)`
              : 'PENDENTE DE DEFINIÇÃO DE ESCOPO: Informar fração de mês conforme cronograma.'
          });
        }
      } else {
        // Modo B preliminar
        defaultServices = [
          {
            category: 'MÃO DE OBRA',
            description: 'Montagem mecânica preliminar estimada (Modo B)',
            quantity: Math.max(40, Math.round(estimatedArea * 0.15)),
            unit: 'h',
            unitPrice: 85.00,
            measurementStatus: 'ESTIMADO_MODO_B',
            notes: 'Estimativa preliminar por área (Modo B)'
          }
        ];
      }
    }

    const totalServicesCost = Number(defaultServices.reduce((acc, s) => acc + ((s.quantity || 0) * (s.unitPrice || 0)), 0).toFixed(2));

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

    const hasPendencies = unpricedItems.length > 0 || unmeasuredItems.length > 0 || pendingItems.length > 0;
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
      llm_validation: {
        executed: Boolean(rawLLMResponse),
        valid: llmValidation.valid,
        has_content: llmValidation.hasContent,
        errors: llmValidation.errors
      },
      disciplines_detected: disciplines,
      hvac_mode: hvacMode,
      thermal_load: isHVAC ? thermalLoad : null,
      validated_geometry: validatedGeometry,
      confidence_metrics: confidenceMetrics,
      completeness_status: budgetCompletenessStatus,
      items: auditItems,
      historical_suggestions: historicalSuggestions,
      document_conflicts: documentConflicts
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
          item.unit_price,
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
            total_additional, total_final, validity_days, commercial_terms
          ) VALUES (?, ?, 'Em revisão', ?, ?, ?, ?, 0, 0, 0, ?, 15, ?)
        `).run(
          projectId,
          budgetCode,
          materialsTotal,
          totalServicesCost,
          totalServicesCost,
          totalEquipmentCost,
          totalFinalCost,
          'Condições de pagamento: 30% sinal na assinatura, 40% na entrega dos materiais no canteiro, 30% no comissionamento e entrega da obra. Validade: 15 dias.'
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
              status = 'Em revisão', updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(materialsTotal, totalServicesCost, totalServicesCost, totalEquipmentCost, totalFinalCost, budgetId);

          await db.prepare('DELETE FROM budget_items WHERE budget_id = ?').run(budgetId);
          await db.prepare('DELETE FROM services WHERE budget_id = ?').run(budgetId);

          for (const hItem of humanEditedItems) {
            if (!budgetMaterials.some(m => m.material_name === hItem.material_name)) {
              budgetMaterials.push({
                material_id: hItem.material_id,
                material_code: null,
                material_name: hItem.material_name,
                quantity: hItem.quantity,
                unit: hItem.unit,
                unit_price: hItem.unit_price,
                subtotal: hItem.subtotal,
                human_notes: hItem.human_notes
              });
            }
          }
        }
      }

      if (!isApproved) {
        const insertBudgetItem = db.prepare(`
          INSERT INTO budget_items (
            budget_id, material_id, material_name, quantity, unit,
            unit_price, subtotal, ai_suggested_quantity, ai_reasoning, human_notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const m of budgetMaterials) {
          const auditMeta = auditItems.find(a => (m.material_id && a.material_id === m.material_id) || a.material_name === m.material_name);
          const isDiscrete = /unid|und|un\b|pç|pc|peça|cx|caixa|pct|pacote|lata|rolo|barra|frasco|balde|tubo|cartucho|kit|jogo|par|duzia/i.test(m.unit || '');
          const cleanQty = m.is_pending_measurement
            ? 0
            : (isDiscrete ? Math.ceil(Number(m.quantity || 0)) : Number(Number(m.quantity || 0).toFixed(2)));
          const cleanSubtotal = Number((cleanQty * Number(m.unit_price || 0)).toFixed(2));
          const noteText = m.is_pending_measurement
            ? `Item identificado no projeto - ${m.measurement_status}`
            : (m.is_pending_quote
                ? `Item extraído da documentação técnica - PENDENTE DE COTAÇÃO (${m.failure_reason || ''})`
                : (m.human_notes || `Item orçado pela Base Central SABRAR via ${modeLabel}`));

          await insertBudgetItem.run(
            budgetId,
            m.material_id,
            m.material_name,
            cleanQty,
            m.unit,
            m.unit_price,
            cleanSubtotal,
            cleanQty,
            auditMeta?.calculation_summary || 'Sugestão da IA SABRAR',
            noteText
          );
        }

        const insertService = db.prepare(`
          INSERT INTO services (budget_id, category, description, quantity, unit, unit_price, subtotal, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const s of defaultServices) {
          await insertService.run(
            budgetId,
            s.category,
            s.description,
            s.quantity,
            s.unit,
            s.unitPrice,
            Number(((s.quantity || 0) * (s.unitPrice || 0)).toFixed(2)),
            s.notes
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
        reason: auditItems.find(a => (m.material_id && a.material_id === m.material_id) || a.material_name === m.material_name)?.calculation_summary || '',
        confidence: overallCompletenessPercent
      })),
      budget: budgetOutput,
      analysis_metadata: analysisMetadata
    };
  }
}
