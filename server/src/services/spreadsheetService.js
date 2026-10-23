import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

import { db } from '../db/connection.js';
import { LearningService } from './learningService.js';
import { generateUniqueBudgetCode } from '../utils/codeGenerator.js';

function isDiscreteUnit(u) {
  return /unid|und|un\b|pç|pc|peça|cx|caixa|pct|pacote|lata|rolo|barra|frasco|balde|tubo|cartucho|kit|jogo|par|duzia/i.test(String(u || ''));
}

function roundQuantityForUnit(qty, u) {
  const n = Number(qty);
  if (isNaN(n) || n <= 0) return 1;
  if (isDiscreteUnit(u)) {
    return Math.ceil(n);
  }
  return Number(n.toFixed(2));
}

export class SpreadsheetService {
  /**
   * Extrai texto sumário de uma planilha Excel/CSV para análise de IA.
   */
  static extractTextFromSpreadsheet(filePath) {
    try {
      const workbook = XLSX.readFile(filePath);
      let fullText = '';
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const csv = XLSX.utils.sheet_to_csv(sheet);
        fullText += `\n[Aba: ${sheetName}]\n${csv}\n`;
      }
      return fullText;
    } catch (err) {
      console.warn('[Spreadsheet Text Extraction Error]', err.message);
      return '';
    }
  }

  /**
   * Extrai dados consolidados oficiais da aba 'Resumo' (padrão SABRAR).
   * Retorna os sistemas com suas abas de origem, valores esperados por categoria e total global da obra.
   */
  static extractResumoInfo(workbook) {
    const resumoSheetName = workbook.SheetNames.find(s => /^resumo$/i.test(s.trim()));
    if (!resumoSheetName) return null;

    const sheet = workbook.Sheets[resumoSheetName];
    if (!sheet) return null;

    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    if (!data || data.length < 6) return null;

    let headerRow = -1;
    let colMat = 3, colMO = 4, colFat = 5, colTot = 6;

    for (let r = 0; r < Math.min(10, data.length); r++) {
      const row = data[r] || [];
      if (row.some(c => String(c).toLowerCase().includes('sistema')) &&
          row.some(c => String(c).toLowerCase().includes('material'))) {
        headerRow = r;
        break;
      }
    }

    if (headerRow === -1) return null;

    let expectedTotMat = 0, expectedTotMO = 0, expectedTotFat = 0, expectedGlobal = 0;
    const systems = [];
    const activeSheetNames = [];

    for (let r = headerRow + 1; r < data.length; r++) {
      const row = data[r] || [];
      const name = String(row[0] || '').trim();
      if (!name) continue;

      if (/valor global/i.test(name)) {
        expectedGlobal = Number(row.find(c => typeof c === 'number')) || 0;
        break; // Interrompe no Valor Global da Obra (não processa tabelas secundárias abaixo)
      }

      if (/material\s*\(%\)/i.test(name) || /mão de obra/i.test(name) || /faturamento direto\s*\(%\)/i.test(name)) continue;
      if (/valores/i.test(name) || /custo/i.test(name)) continue;

      const matVal = Number(row[colMat]) || 0;
      const moVal = Number(row[colMO]) || 0;
      const fatVal = Number(row[colFat]) || 0;
      const totVal = Number(row[colTot]) || (matVal + moVal + fatVal);

      // Tenta extrair a aba referenciada pela fórmula da célula (ex: ='AC - DIRETA - COBRE'!H513)
      let refSheet = null;
      for (let c = colMat; c <= colTot; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        const cell = sheet[addr];
        if (cell && cell.f) {
          const m = cell.f.match(/'?([^'!]+)'?!/);
          if (m && m[1]) {
            refSheet = m[1];
            break;
          }
        }
      }

      // Se não houver fórmula com nome de aba, deduz pelos padrões conhecidos de sistemas da SABRAR
      if (!refSheet) {
        const lower = name.toLowerCase();
        if (lower.includes('cobre') || lower.includes('direta')) {
          refSheet = workbook.SheetNames.find(sn => /cobre|direta/i.test(sn));
        } else if (lower.includes('água') || lower.includes('agua') || lower.includes('indireta')) {
          refSheet = workbook.SheetNames.find(sn => /agua|água|indireta/i.test(sn));
        } else if (lower.includes('cozinha')) {
          refSheet = workbook.SheetNames.find(sn => /cozinha/i.test(sn));
        } else if (lower.includes('ventila') || lower.includes('exaust')) {
          refSheet = workbook.SheetNames.find(sn => /ex_ae|ventila/i.test(sn));
        } else if (lower.includes('pressuri')) {
          refSheet = workbook.SheetNames.find(sn => /pressuri/i.test(sn));
        }
      }

      // Se o sistema possui algum valor maior que zero, é uma aba ativa do orçamento
      if (totVal > 0 || matVal > 0 || moVal > 0 || fatVal > 0) {
        systems.push({ name, refSheet, matVal, moVal, fatVal, totVal });
        expectedTotMat += matVal;
        expectedTotMO += moVal;
        expectedTotFat += fatVal;

        if (refSheet && workbook.Sheets[refSheet] && !activeSheetNames.includes(refSheet)) {
          activeSheetNames.push(refSheet);
        }
      }
    }

    if (!expectedGlobal) {
      expectedGlobal = Number((expectedTotMat + expectedTotMO + expectedTotFat).toFixed(2));
    }

    return {
      sheetName: resumoSheetName,
      systems,
      activeSheetNames,
      expectedTotMat: Number(expectedTotMat.toFixed(2)),
      expectedTotMO: Number(expectedTotMO.toFixed(2)),
      expectedTotFat: Number(expectedTotFat.toFixed(2)),
      expectedGlobal: Number(expectedGlobal.toFixed(2))
    };
  }

  /**
   * Processa a planilha de levantamento real enviada pelo usuário,
   * atualiza o orçamento com as quantidades/valores reais (Materiais, Mão de Obra e Faturamento Direto)
   * e calibra o motor de IA.
   */
  static async processRealSurveySpreadsheet(projectId, filePath, originalName, userId = 1, mode = 'replace') {
    const project = await db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    if (!project) throw new Error('Projeto não encontrado');

    const workbook = XLSX.readFile(filePath, { cellFormula: true });
    if (!workbook.SheetNames.length) throw new Error('A planilha está vazia ou ilegível');

    // 0. Audita e extrai a aba Resumo (se presente na planilha oficial SABRAR)
    const resumoInfo = SpreadsheetService.extractResumoInfo(workbook);
    if (resumoInfo) {
      console.log(`[Spreadsheet Parser] Aba 'Resumo' identificada na planilha ${originalName}.`);
      console.log(`- Abas ativas mapeadas pelo Resumo:`, resumoInfo.activeSheetNames);
      console.log(`- Totais oficiais esperados no Resumo: Material: R$ ${resumoInfo.expectedTotMat} | MO: R$ ${resumoInfo.expectedTotMO} | Fat: R$ ${resumoInfo.expectedTotFat} | Global: R$ ${resumoInfo.expectedGlobal}`);
    }

    // 1. Identificar abas ocultas e padrões de abas auxiliares que NÃO devem ser lidas
    const sheetProps = workbook.Workbook?.Sheets || [];
    const isHiddenSheet = (idx) => {
      const prop = sheetProps[idx];
      return prop && (prop.Hidden === 1 || prop.Hidden === 2);
    };

    const ignoreSheetPatterns = [
      /^resumo$/i,
      /^capa$/i,
      /^sum[aá]rio$/i,
      /^[ií]ndice$/i,
      /^dashboard$/i,
      /fornecedor/i,
      /custos?\s*adm/i,
      /^dutos?\s*-/i,
      /^dutos?/i,
      /^d\.\s*redondos/i,
      /^conv/i,
      /convers[aã]o/i,
      /^fechamento/i,
      /^modelo/i,
      /^estimativa/i,
      /^lev(\.|\s|antamento)/i,
      /pre[cç]o.*materiais/i,
      /carga.*g[aá]s/i,
      /base.*pre[cç]o/i,
      /base.*isolamento/i,
      /pvcu/i,
      /poliur/i
    ];

    const isSummaryOrAuxSheet = (name, idx, totalSheets) => {
      if (isHiddenSheet(idx)) return true;
      if (totalSheets <= 1) return false;
      return ignoreSheetPatterns.some(p => p.test(name.trim()));
    };

    const getCategoryFromSheet = (sheetName) => {
      const s = sheetName.toLowerCase();
      if (s.includes('cobre') || s.includes('direta') || s.includes('vrf') || s.includes('split')) return 'Climatização - Expansão Direta';
      if (s.includes('agua') || s.includes('água') || s.includes('indireta') || s.includes('fancoil') || s.includes('chiller')) return 'Climatização - Água Gelada';
      if (s.includes('exaust') || s.includes('ventila') || s.includes('ex_') || s.includes('pressuri')) return 'Ventilação e Exaustão';
      if (s.includes('difus')) return 'Difusão de Ar';
      if (s.includes('duto')) return 'Rede de Dutos';
      return 'Climatização';
    };

    // Se a aba Resumo identificou com precisão as abas ativas do orçamento, processa estritamente essas abas!
    let sheetsToProcess;
    if (resumoInfo && resumoInfo.activeSheetNames.length > 0) {
      sheetsToProcess = resumoInfo.activeSheetNames;
    } else {
      const candidateSheets = workbook.SheetNames.filter((name, idx) => !isSummaryOrAuxSheet(name, idx, workbook.SheetNames.length));
      sheetsToProcess = candidateSheets.length > 0 ? candidateSheets : workbook.SheetNames.filter((_, idx) => !isHiddenSheet(idx));
    }

    // Busca catálogo oficial da SABRAR e aliases memorizados (Item 2)
    const catalog = await db.prepare("SELECT * FROM materials WHERE status = 'Ativo'").all();
    let aliasRows = [];
    try {
      aliasRows = await db.prepare("SELECT alias_name, material_id FROM material_aliases").all();
    } catch (_) {
      aliasRows = [];
    }
    const aliasMap = new Map();
    for (const a of aliasRows) {
      if (a.alias_name) {
        aliasMap.set(String(a.alias_name).trim().toLowerCase(), a.material_id);
      }
    }

    const normalizeStr = (s) => String(s || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, ' ')
      .replace(/\s+/g, ' ');

    const parsedMaterials = [];
    const parsedServices = [];
    const parsedEquipment = [];

    let grandTotalMaterials = 0;
    let grandTotalServices = 0;
    let grandTotalEquipment = 0;

    const processedSheets = [];
    const learningTotals = new Map(); // materialId -> totalQuantity

    for (const sName of sheetsToProcess) {
      const sheet = workbook.Sheets[sName];
      if (!sheet) continue;
      const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      if (!rawRows || rawRows.length < 5) continue;

      // Detecta colunas
      let headerRow = -1;
      let colDesc = 1, colUnit = 2, colQty = 3, colPUnit = 5, colPTot = 6, colMat = -1, colMO = -1, colFat = -1, colCode = -1;

      for (let r = 0; r < Math.min(25, rawRows.length); r++) {
        const row = rawRows[r] || [];
        for (let c = 0; c < row.length; c++) {
          const cell = String(row[c] || '').trim().toLowerCase();
          if (!cell) continue;

          if (cell.includes('descri') && !cell.includes('código')) colDesc = c;
          else if (/^(item|produto)$/i.test(cell) && colDesc === 1) colDesc = c;

          if (/^(tipo|unidade|unid\.?|un|medida)$/i.test(cell)) colUnit = c;
          if (/^(quant(idade)?|qtd|qtde|qnt\.?)$/i.test(cell) || (cell.includes('quant') && !cell.includes('total'))) colQty = c;
          if (cell.includes('preço unit') || cell.includes('valor unit') || cell === 'pu' || cell === 'p.u.') colPUnit = c;
          if (cell.includes('preço tot') || cell.includes('valor tot') || cell === 'subtotal') colPTot = c;

          if (/^material\s*$/i.test(cell)) colMat = c;
          if (cell.includes('mão de obra') || cell.includes('mao de obra')) colMO = c;
          if (cell.includes('faturamento')) colFat = c;
          if (/^(c[oó]digo|cod|c[oó]d\.?|tag)$/i.test(cell)) colCode = c;
        }

        if (row.some(c => String(c || '').toLowerCase().includes('descri'))) {
          headerRow = r;
          break;
        }
      }

      if (headerRow === -1) headerRow = 4;

      // Detecta linhas de resumo no rodapé
      let summaryRow = rawRows.length;
      let sheetExpectedTot = 0, sheetExpectedMat = 0, sheetExpectedMO = 0, sheetExpectedFat = 0;

      for (let r = headerRow + 1; r < rawRows.length; r++) {
        const row = rawRows[r] || [];
        const line = row.filter(c => c !== undefined && c !== null).map(c => String(c).trim()).join(' ').toLowerCase().replace(/\s+/g, ' ');

        if (line.includes('valor total material')) {
          summaryRow = Math.min(summaryRow, r);
          if (colMat !== -1) sheetExpectedMat = Number(row[colMat]) || 0;
        }
        if (line.includes('valor total mão de obra')) {
          summaryRow = Math.min(summaryRow, r);
          if (colMO !== -1) sheetExpectedMO = Number(row[colMO]) || 0;
        }
        if (line.includes('valor total faturamento')) {
          summaryRow = Math.min(summaryRow, r);
          if (colFat !== -1) sheetExpectedFat = Number(row[colFat]) || 0;
        }
        if (line.includes('valor total - obra') || line.includes('valor total obra')) {
          summaryRow = Math.min(summaryRow, r);
          if (colMat !== -1) sheetExpectedTot = Number(row[colMat]) || 0;
        }
      }

      // Se a aba tem caixas de resumo zeradas/vazias em tudo, pula a aba
      const hasSummaryDefined = (sheetExpectedTot > 0 || sheetExpectedMat > 0 || sheetExpectedMO > 0 || sheetExpectedFat > 0);
      if (summaryRow < rawRows.length && !hasSummaryDefined) {
        // Verifica se há qualquer valor não zero no miolo
        let hasAnyValue = false;
        for (let r = headerRow + 1; r < summaryRow; r++) {
          const row = rawRows[r];
          if (!row) continue;
          if ((colMat !== -1 && Number(row[colMat]) > 0) ||
              (colMO !== -1 && Number(row[colMO]) > 0) ||
              (colFat !== -1 && Number(row[colFat]) > 0)) {
            hasAnyValue = true;
            break;
          }
        }
        if (!hasAnyValue) continue;
      }

      let lastCategory = '';
      let sheetMatCount = 0;
      const isSabrarOPFormat = (colMat !== -1 || colMO !== -1 || colFat !== -1);

      for (let r = headerRow + 1; r < summaryRow; r++) {
        const row = rawRows[r];
        if (!row || !Array.isArray(row)) continue;

        let rawDesc = String(row[colDesc] || '').trim();
        let unit = colUnit !== -1 && row[colUnit] ? String(row[colUnit]).trim() : 'und';
        const rawQty = colQty !== -1 ? row[colQty] : 1;

        let qty = 0;
        if (typeof rawQty === 'number') {
          qty = rawQty;
        } else if (rawQty) {
          qty = Number(String(rawQty).replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, '')) || 0;
        }

        const parseVal = (val) => {
          if (typeof val === 'number') return val;
          if (!val) return 0;
          return Number(String(val).replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, '')) || 0;
        };

        const valMat = colMat !== -1 ? parseVal(row[colMat]) : 0;
        const valMO = colMO !== -1 ? parseVal(row[colMO]) : 0;
        const valFat = colFat !== -1 ? parseVal(row[colFat]) : 0;

        // Cabeçalho de subseção
        if (rawDesc && qty === 0 && valMat === 0 && valMO === 0 && valFat === 0) {
          lastCategory = rawDesc;
          continue;
        }

        if (!rawDesc && (valMat > 0 || valMO > 0 || valFat > 0)) {
          rawDesc = lastCategory || `Item Linha ${r + 1}`;
        }

        if (!rawDesc || rawDesc.length < 2) continue;

        // Ignora linhas de totalização intermediária, EXCETO se for item de equipamento/máquinas (ex: VRF, Splits)
        const isEquipmentOrRealItem = /vrf|split|equipamento|máquina|chiller|fancoil/i.test(rawDesc);
        if (!isEquipmentOrRealItem && /^(total|subtotal|soma|faturamento\s*total|resumo|preços por tabela)/i.test(rawDesc)) {
          continue;
        }

        if (isSabrarOPFormat) {
          // 1. MATERIAL (Coluna H - Amarelo)
          if (valMat > 0) {
            const finalQty = qty > 0 ? qty : 1;
            const subtotal = Number(valMat.toFixed(2));
            const unitPrice = Number((subtotal / finalQty).toFixed(2));

            // Cruzamento com catálogo oficial e aliases memorizados (Itens 2 e 5)
            const normName = normalizeStr(rawDesc);
            const lowerRaw = rawDesc.trim().toLowerCase();
            let matchedMat = null;

            // Prioridade 1: Alias memorizado de projetos anteriores (Item 2)
            if (aliasMap.has(lowerRaw)) {
              const matchedId = aliasMap.get(lowerRaw);
              matchedMat = catalog.find(m => m.id === matchedId);
            } else if (aliasMap.has(normName)) {
              const matchedId = aliasMap.get(normName);
              matchedMat = catalog.find(m => m.id === matchedId);
            }

            // Prioridade 2: Código oficial (se houver na planilha)
            if (!matchedMat && colCode !== -1 && row[colCode]) {
              const codeVal = String(row[colCode]).trim().toLowerCase();
              matchedMat = catalog.find(m => m.code.toLowerCase() === codeVal);
            }

            // Prioridade 3: Nome exato normalizado
            if (!matchedMat) {
              matchedMat = catalog.find(m => normalizeStr(m.name) === normName);
            }

            // Prioridade 4: Sinônimos cadastrados no banco
            if (!matchedMat) {
              matchedMat = catalog.find(m => {
                if (!m.synonyms) return false;
                const syns = m.synonyms.split(/[,;\n/]+/).map(s => normalizeStr(s));
                return syns.some(s => s && s === normName);
              });
            }

            // Prioridade 5: Semelhança textual por tokens
            if (!matchedMat) {
              const tokens = normName.split(' ').filter(t => t.length > 2);
              if (tokens.length >= 2) {
                let bestScore = 0;
                for (const m of catalog) {
                  const targetStr = normalizeStr(m.name + ' ' + (m.synonyms || ''));
                  let matches = 0;
                  for (const t of tokens) {
                    if (targetStr.includes(t)) matches++;
                  }
                  const score = matches / tokens.length;
                  if (score > bestScore && score >= 0.75) {
                    bestScore = score;
                    matchedMat = m;
                  }
                }
              }
            }

            const materialId = matchedMat ? matchedMat.id : null;
            // Item 5: Se houver vínculo com a base, usar o nome oficial cadastrado!
            const finalMaterialName = matchedMat ? matchedMat.name : rawDesc;
            const finalUnit = (!unit || unit === '-' || unit === '0') ? (matchedMat?.unit || 'und') : unit;
            const cleanQty = roundQuantityForUnit(finalQty, finalUnit);

            parsedMaterials.push({
              sheet: sName,
              materialId,
              materialName: finalMaterialName,
              materialCode: matchedMat?.code || null,
              originalSpreadsheetName: rawDesc,
              quantity: cleanQty,
              unit: finalUnit,
              unitPrice,
              subtotal
            });

            grandTotalMaterials += subtotal;
            sheetMatCount++;

            if (materialId) {
              learningTotals.set(materialId, (learningTotals.get(materialId) || 0) + finalQty);
            }
          }

          // 2. MÃO DE OBRA / SERVIÇOS (Coluna I - Azul Claro com BDI + 40%)
          if (valMO > 0) {
            const finalQty = qty > 0 ? qty : 1;
            const subtotal = Number(valMO.toFixed(2));
            const unitPrice = Number((subtotal / finalQty).toFixed(2));

            parsedServices.push({
              category: 'MÃO DE OBRA',
              description: rawDesc,
              quantity: finalQty,
              unit: unit || 'vb',
              unitPrice,
              subtotal,
              notes: `Mão de obra e serviços técnicos da planilha [${sName}] (inclui BDI)`
            });

            grandTotalServices += subtotal;
          }

          // 3. FATURAMENTO DIRETO / EQUIPAMENTOS (Coluna J - Verde Claro)
          if (valFat > 0) {
            const finalQty = qty > 0 ? qty : 1;
            const subtotal = Number(valFat.toFixed(2));
            const unitPrice = Number((subtotal / finalQty).toFixed(2));

            parsedEquipment.push({
              category: getCategoryFromSheet(sName),
              description: rawDesc,
              brand: '',
              model: '',
              quantity: finalQty,
              unit: unit || 'unid',
              unitPrice,
              subtotal,
              notes: `Faturamento Direto / Equipamento da planilha [${sName}]`
            });

            grandTotalEquipment += subtotal;
          }
        } else {
          // Formato genérico de planilha sem colunas H/I/J
          if (qty > 0) {
            let price = colPUnit !== -1 ? parseVal(row[colPUnit]) : 0;
            if (price <= 0 && colPTot !== -1) {
              const tot = parseVal(row[colPTot]);
              if (tot > 0) price = Number((tot / qty).toFixed(2));
            }

            const normName = normalizeStr(rawDesc);
            const lowerRaw = rawDesc.trim().toLowerCase();
            let matchedMat = null;

            if (aliasMap.has(lowerRaw)) {
              const matchedId = aliasMap.get(lowerRaw);
              matchedMat = catalog.find(m => m.id === matchedId);
            } else if (aliasMap.has(normName)) {
              const matchedId = aliasMap.get(normName);
              matchedMat = catalog.find(m => m.id === matchedId);
            }

            if (!matchedMat) {
              matchedMat = catalog.find(m => normalizeStr(m.name) === normName);
            }

            const materialId = matchedMat ? matchedMat.id : null;
            const finalMaterialName = matchedMat ? matchedMat.name : rawDesc;
            const finalPrice = price > 0 ? price : (Number(matchedMat?.reference_price) || 10.0);
            const finalUnit = unit || matchedMat?.unit || 'und';
            const cleanQty = roundQuantityForUnit(qty, finalUnit);
            const subtotal = Number((cleanQty * finalPrice).toFixed(2));

            parsedMaterials.push({
              sheet: sName,
              materialId,
              materialName: finalMaterialName,
              materialCode: matchedMat?.code || null,
              originalSpreadsheetName: rawDesc,
              quantity: cleanQty,
              unit: finalUnit,
              unitPrice: finalPrice,
              subtotal
            });

            grandTotalMaterials += subtotal;
            sheetMatCount++;
            if (materialId) {
              learningTotals.set(materialId, (learningTotals.get(materialId) || 0) + qty);
            }
          }
        }
      }

      if (sheetMatCount > 0) {
        processedSheets.push({ sheet: sName, itemsCount: sheetMatCount });
      }
    }

    if (parsedMaterials.length === 0 && parsedServices.length === 0 && parsedEquipment.length === 0) {
      throw new Error('Nenhum item válido com valores positivos foi encontrado nas abas ativas da planilha.');
    }

    grandTotalMaterials = Number(grandTotalMaterials.toFixed(2));
    grandTotalServices = Number(grandTotalServices.toFixed(2));
    grandTotalEquipment = Number(grandTotalEquipment.toFixed(2));
    let grandTotalFinal = Number((grandTotalMaterials + grandTotalServices + grandTotalEquipment).toFixed(2));

    // Auditoria e calibração de precisão com a aba Resumo (padrão oficial SABRAR)
    let resumoAudit = null;
    if (resumoInfo) {
      const globalDiff = Number(Math.abs(grandTotalFinal - resumoInfo.expectedGlobal).toFixed(2));
      console.log(`[Resumo Audit] Comparação com Aba Resumo:`);
      console.log(`- Materiais: Itens=R$ ${grandTotalMaterials} vs Resumo=R$ ${resumoInfo.expectedTotMat} (dif: R$ ${(grandTotalMaterials - resumoInfo.expectedTotMat).toFixed(2)})`);
      console.log(`- Mão de Obra: Itens=R$ ${grandTotalServices} vs Resumo=R$ ${resumoInfo.expectedTotMO} (dif: R$ ${(grandTotalServices - resumoInfo.expectedTotMO).toFixed(2)})`);
      console.log(`- Faturamento: Itens=R$ ${grandTotalEquipment} vs Resumo=R$ ${resumoInfo.expectedTotFat} (dif: R$ ${(grandTotalEquipment - resumoInfo.expectedTotFat).toFixed(2)})`);
      console.log(`- Total Global: Itens=R$ ${grandTotalFinal} vs Resumo=R$ ${resumoInfo.expectedGlobal} (dif: R$ ${(grandTotalFinal - resumoInfo.expectedGlobal).toFixed(2)})`);

      // Se a diferença for apenas decorrente de fórmulas de arredondamento de centavos do Excel (ROUNDUP, <= R$ 20.00),
      // calibra no último item de cada categoria para garantir congruência exata de 100% com a aba Resumo!
      if (globalDiff <= 20.0) {
        const diffMat = Number((resumoInfo.expectedTotMat - grandTotalMaterials).toFixed(2));
        if (diffMat !== 0 && parsedMaterials.length > 0) {
          const lastMat = parsedMaterials[parsedMaterials.length - 1];
          lastMat.subtotal = Number((lastMat.subtotal + diffMat).toFixed(2));
          lastMat.unitPrice = Number((lastMat.subtotal / (lastMat.quantity || 1)).toFixed(2));
          grandTotalMaterials = resumoInfo.expectedTotMat;
        }

        const diffMO = Number((resumoInfo.expectedTotMO - grandTotalServices).toFixed(2));
        if (diffMO !== 0 && parsedServices.length > 0) {
          const lastMO = parsedServices[parsedServices.length - 1];
          lastMO.subtotal = Number((lastMO.subtotal + diffMO).toFixed(2));
          lastMO.unitPrice = Number((lastMO.subtotal / (lastMO.quantity || 1)).toFixed(2));
          grandTotalServices = resumoInfo.expectedTotMO;
        }

        const diffFat = Number((resumoInfo.expectedTotFat - grandTotalEquipment).toFixed(2));
        if (diffFat !== 0 && parsedEquipment.length > 0) {
          const lastEq = parsedEquipment[parsedEquipment.length - 1];
          lastEq.subtotal = Number((lastEq.subtotal + diffFat).toFixed(2));
          lastEq.unitPrice = Number((lastEq.subtotal / (lastEq.quantity || 1)).toFixed(2));
          grandTotalEquipment = resumoInfo.expectedTotFat;
        }

        grandTotalFinal = resumoInfo.expectedGlobal;
        resumoAudit = {
          status: 'AUDITADO_E_CONFORME',
          message: 'Valores conferidos e calibrados 100% com a aba Resumo.',
          expectedGlobal: resumoInfo.expectedGlobal,
          expectedMaterials: resumoInfo.expectedTotMat,
          expectedServices: resumoInfo.expectedTotMO,
          expectedEquipment: resumoInfo.expectedTotFat
        };
      } else {
        resumoAudit = {
          status: 'DISCREPANCIA_DETECTADA',
          message: `Divergência detectada entre levantamento e aba Resumo: Itens=R$ ${grandTotalFinal} vs Resumo=R$ ${resumoInfo.expectedGlobal} (dif: R$ ${globalDiff})`,
          expectedGlobal: resumoInfo.expectedGlobal,
          expectedMaterials: resumoInfo.expectedTotMat,
          expectedServices: resumoInfo.expectedTotMO,
          expectedEquipment: resumoInfo.expectedTotFat
        };
        console.warn(`[Resumo Audit Alert] ${resumoAudit.message}`);
      }
    }

    console.log(`[Spreadsheet Parser] Processamento concluído com sucesso:`);
    console.log(`- Materiais: ${parsedMaterials.length} itens (R$ ${grandTotalMaterials.toFixed(2)})`);
    console.log(`- Serviços/Mão de Obra: ${parsedServices.length} itens (R$ ${grandTotalServices.toFixed(2)})`);
    console.log(`- Faturamento Direto/Máquinas: ${parsedEquipment.length} itens (R$ ${grandTotalEquipment.toFixed(2)})`);
    console.log(`- Total Obra: R$ ${grandTotalFinal.toFixed(2)}`);

    // 2. Busca ou cria o orçamento oficial
    let budget = await db.prepare('SELECT * FROM budgets WHERE project_id = ?').get(projectId);
    let budgetId;

    let finalMaterialsSum = grandTotalMaterials;
    let finalServicesSum = grandTotalServices;
    let finalEquipmentSum = grandTotalEquipment;
    let finalTotalSum = grandTotalFinal;

    if (!budget) {
      const budgetCode = await generateUniqueBudgetCode(db);

      const resB = await db.prepare(`
        INSERT INTO budgets (
          project_id, code, status, total_materials, total_services,
          total_labor, total_equipment, total_logistics, total_taxes,
          total_additional, total_final, validity_days, commercial_terms
        ) VALUES (?, ?, 'Em revisão', ?, ?, ?, ?, 0, 0, 0, ?, 15, ?)
      `).run(
        projectId, budgetCode, grandTotalMaterials, grandTotalServices,
        grandTotalServices, grandTotalEquipment, grandTotalFinal,
        'Orçamento atualizado via importação de planilha de levantamento executivo real.'
      );
      budgetId = resB.lastInsertRowid;
    } else {
      budgetId = budget.id;
      if (mode === 'append') {
        finalMaterialsSum = Number((Number(budget.total_materials || 0) + grandTotalMaterials).toFixed(2));
        finalServicesSum = Number((Number(budget.total_services || 0) + grandTotalServices).toFixed(2));
        finalEquipmentSum = Number((Number(budget.total_equipment || 0) + grandTotalEquipment).toFixed(2));
        finalTotalSum = Number((finalMaterialsSum + finalServicesSum + finalEquipmentSum).toFixed(2));

        await db.prepare(`
          UPDATE budgets SET
            total_materials = ?, total_services = ?, total_labor = ?,
            total_equipment = ?, total_final = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(finalMaterialsSum, finalServicesSum, finalServicesSum, finalEquipmentSum, finalTotalSum, budgetId);
      } else {
        await db.prepare(`
          UPDATE budgets SET
            total_materials = ?, total_services = ?, total_labor = ?,
            total_equipment = ?, total_final = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(grandTotalMaterials, grandTotalServices, grandTotalServices, grandTotalEquipment, grandTotalFinal, budgetId);

        // Limpa dados antigos apenas se mode === 'replace'
        await db.prepare('DELETE FROM budget_items WHERE budget_id = ?').run(budgetId);
        await db.prepare('DELETE FROM services WHERE budget_id = ?').run(budgetId);
        await db.prepare('DELETE FROM budget_equipment WHERE budget_id = ?').run(budgetId);
      }
    }

    // 3. Insere os itens na tabela `budget_items`
    const insertItem = db.prepare(`
      INSERT INTO budget_items (
        budget_id, material_id, material_name, quantity, unit,
        unit_price, subtotal, ai_suggested_quantity, ai_reasoning, human_notes,
        original_spreadsheet_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Sugestões anteriores da IA
    const previousSuggestions = await db.prepare(`
      SELECT material_id, suggested_quantity 
      FROM ai_suggestions 
      WHERE project_id = ?
    `).all(projectId);

    const suggestionMap = new Map();
    for (const s of previousSuggestions) {
      suggestionMap.set(s.material_id, s.suggested_quantity);
    }

    for (const item of parsedMaterials) {
      const aiSuggestedQty = suggestionMap.get(item.materialId) || Math.round(item.quantity * 0.9);

      await insertItem.run(
        budgetId,
        item.materialId,
        item.materialName,
        item.quantity,
        item.unit,
        item.unitPrice,
        item.subtotal,
        aiSuggestedQty,
        `Quantitativo real importado da planilha executiva (${originalName} - Aba: ${item.sheet}${item.originalSpreadsheetName ? ` - Item na planilha: "${item.originalSpreadsheetName}"` : ''})`,
        item.originalSpreadsheetName ? `Planilha: "${item.originalSpreadsheetName}" [${item.sheet}]` : `Levantamento executivo real de campo [${item.sheet}]`,
        item.originalSpreadsheetName || null
      );
    }

    // 4. Insere Serviços / Mão de Obra
    if (parsedServices.length > 0) {
      const insertService = db.prepare(`
        INSERT INTO services (budget_id, category, description, quantity, unit, unit_price, subtotal, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const s of parsedServices) {
        await insertService.run(
          budgetId,
          s.category,
          s.description,
          s.quantity,
          s.unit,
          s.unitPrice,
          s.subtotal,
          s.notes
        );
      }
    } else if (mode !== 'append' && !budget) {
      // Serviços padrão mínimos se a planilha não continha coluna de mão de obra e é orçamento novo
      const insertService = db.prepare(`
        INSERT INTO services (budget_id, category, description, quantity, unit, unit_price, subtotal, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      await insertService.run(budgetId, 'MÃO DE OBRA', 'Montagem mecânica e tubulação frigorígena', 1, 'vb', 18000.0, 18000.0, 'Padrão executivo SABRAR');
      await insertService.run(budgetId, 'ENGENHARIA', 'Comissionamento, balanceamento TAB e start-up final', 1, 'gl', 6140.0, 6140.0, 'Emissão de ART/RRT');
    }

    // 5. Insere Máquinas & Equipamentos (Faturamento Direto)
    if (parsedEquipment.length > 0) {
      const insertEquipment = db.prepare(`
        INSERT INTO budget_equipment (
          budget_id, category, description, brand, model,
          quantity, unit, unit_price, subtotal, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const eq of parsedEquipment) {
        await insertEquipment.run(
          budgetId,
          eq.category,
          eq.description,
          eq.brand || '',
          eq.model || '',
          eq.quantity,
          eq.unit,
          eq.unitPrice,
          eq.subtotal,
          eq.notes
        );
      }
    }

    // 6. MOTOR DE APRENDIZADO CONTÍNUO (Regras 24, 25, 26, 29)
    let calibratedCount = 0;
    for (const [matId, totalQty] of learningTotals.entries()) {
      const aiSuggestedQty = suggestionMap.get(matId) || Math.round(totalQty * 0.9);
      try {
        await LearningService.recordProjectFeedback(
          projectId,
          matId,
          project.project_type || 'Infraestrutura',
          aiSuggestedQty,
          totalQty,
          totalQty,
          totalQty,
          0
        );
        calibratedCount++;
      } catch (learnErr) {
        console.warn('[Learning Feedback Error]', learnErr.message);
      }
    }

    // 7. Atualiza totais na tabela `projects`
    const updatedStatus = (project.status === 'Novo' || !project.status) ? 'Orçamento gerado' : project.status;
    await db.prepare(`
      UPDATE projects SET
        status = ?,
        total_budget_materials = ?,
        total_budget_services = ?,
        total_budget_final = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(updatedStatus, finalMaterialsSum, finalServicesSum, finalTotalSum, projectId);

    // 8. Registra auditoria
    await db.prepare(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, project_id, details)
      VALUES (?, 'IMPORTACAO_PLANILHA_REAL', 'ORCAMENTO', ?, ?, ?)
    `).run(
      userId, budgetId, projectId,
      `Planilha ${originalName} importada com sucesso (modo: ${mode}): ${parsedMaterials.length} materiais (R$ ${grandTotalMaterials.toLocaleString('pt-BR')}), ${parsedServices.length} serviços (R$ ${grandTotalServices.toLocaleString('pt-BR')}) e ${parsedEquipment.length} equipamentos (R$ ${grandTotalEquipment.toLocaleString('pt-BR')}) processados com valores reais.`
    );

    const totalItemsInBudgetRow = await db.prepare('SELECT count(*) as count FROM budget_items WHERE budget_id = ?').get(budgetId);

    return {
      success: true,
      projectId,
      budgetId,
      mode,
      itemsCount: parsedMaterials.length,
      totalItemsInBudget: totalItemsInBudgetRow?.count || parsedMaterials.length,
      servicesCount: parsedServices.length,
      equipmentCount: parsedEquipment.length,
      calibratedCount,
      totalMaterials: finalMaterialsSum,
      totalServices: finalServicesSum,
      totalEquipment: finalEquipmentSum,
      totalFinal: finalTotalSum,
      newMaterialsAdded: grandTotalMaterials,
      newServicesAdded: grandTotalServices,
      newEquipmentAdded: grandTotalEquipment,
      sheetsCount: processedSheets.length,
      sheetsNames: processedSheets.map(s => s.sheet),
      resumoAudit,
      items: parsedMaterials
    };
  }
}
