import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

import { db } from '../db/connection.js';
import { LearningService } from './learningService.js';
import { generateUniqueBudgetCode } from '../utils/codeGenerator.js';

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
   * Processa a planilha de levantamento real enviada pelo usuário,
   * atualiza o orçamento com as quantidades/valores reais (Materiais, Mão de Obra e Faturamento Direto)
   * e calibra o motor de IA.
   */
  static async processRealSurveySpreadsheet(projectId, filePath, originalName, userId = 1, mode = 'replace') {
    const project = await db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    if (!project) throw new Error('Projeto não encontrado');

    const workbook = XLSX.readFile(filePath);
    if (!workbook.SheetNames.length) throw new Error('A planilha está vazia ou ilegível');

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
      /^lev\.\s*(difus|rede|cobre)/i,
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

    // Identifica quais abas devem ser processadas (ignora ocultas e auxiliares)
    const candidateSheets = workbook.SheetNames.filter((name, idx) => !isSummaryOrAuxSheet(name, idx, workbook.SheetNames.length));
    const sheetsToProcess = candidateSheets.length > 0 ? candidateSheets : workbook.SheetNames.filter((_, idx) => !isHiddenSheet(idx));

    // Busca catálogo oficial da SABRAR
    const catalog = await db.prepare("SELECT * FROM materials WHERE status = 'Ativo'").all();

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

    // Conjuntos de controle para evitar duplicação de blocos idênticos dentro da mesma planilha
    const seenMaterialKeys = new Set();
    const seenServiceKeys = new Set();
    const seenEquipmentKeys = new Set();

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
        const line = row.filter(c => c !== undefined && c !== null).map(c => String(c).trim()).join(' ').toLowerCase();

        if (line.includes('valor total material') || line.includes('valor total  material')) {
          summaryRow = Math.min(summaryRow, r);
          if (colMat !== -1) sheetExpectedMat = Number(row[colMat]) || 0;
        }
        if (line.includes('valor total mão de obra') || line.includes('valor total  mão de obra')) {
          summaryRow = Math.min(summaryRow, r);
          if (colMO !== -1) sheetExpectedMO = Number(row[colMO]) || 0;
        }
        if (line.includes('valor total faturamento') || line.includes('valor total  faturamento')) {
          summaryRow = Math.min(summaryRow, r);
          if (colFat !== -1) sheetExpectedFat = Number(row[colFat]) || 0;
        }
        if (line.includes('valor total - obra') || line.includes('valor total  - obra')) {
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

        // Ignora linhas de totalização intermediária
        if (/^(total|subtotal|soma|faturamento|preço total|resumo|preços por tabela)/i.test(rawDesc)) {
          continue;
        }

        if (isSabrarOPFormat) {
          // 1. MATERIAL (Coluna H - Amarelo)
          if (valMat > 0) {
            const finalQty = qty > 0 ? qty : 1;
            const subtotal = Number(valMat.toFixed(2));
            const unitPrice = Number((subtotal / finalQty).toFixed(2));

            // Cruzamento com catálogo oficial
            const normName = normalizeStr(rawDesc);
            let matchedMat = null;

            if (colCode !== -1 && row[colCode]) {
              const codeVal = String(row[colCode]).trim().toLowerCase();
              matchedMat = catalog.find(m => m.code.toLowerCase() === codeVal);
            }
            if (!matchedMat) {
              matchedMat = catalog.find(m => normalizeStr(m.name) === normName);
            }
            if (!matchedMat) {
              matchedMat = catalog.find(m => {
                if (!m.synonyms) return false;
                const syns = m.synonyms.split(/[,;\n/]+/).map(s => normalizeStr(s));
                return syns.some(s => s && s === normName);
              });
            }
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
            const finalUnit = (!unit || unit === '-' || unit === '0') ? (matchedMat?.unit || 'und') : unit;

            const dedupeKey = `${sName.toLowerCase()}|${rawDesc.trim().toLowerCase()}|${finalQty}|${finalUnit.toLowerCase()}|${subtotal}`;
            if (seenMaterialKeys.has(dedupeKey)) {
              continue;
            }
            seenMaterialKeys.add(dedupeKey);

            parsedMaterials.push({
              sheet: sName,
              materialId,
              materialName: rawDesc,
              quantity: finalQty,
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

            const dedupeSrvKey = `${sName.toLowerCase()}|${rawDesc.trim().toLowerCase()}|${finalQty}|${subtotal}`;
            if (seenServiceKeys.has(dedupeSrvKey)) {
              continue;
            }
            seenServiceKeys.add(dedupeSrvKey);

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

            const dedupeEqKey = `${sName.toLowerCase()}|${rawDesc.trim().toLowerCase()}|${finalQty}|${subtotal}`;
            if (seenEquipmentKeys.has(dedupeEqKey)) {
              continue;
            }
            seenEquipmentKeys.add(dedupeEqKey);

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
            const matchedMat = catalog.find(m => normalizeStr(m.name) === normName);
            const materialId = matchedMat ? matchedMat.id : null;
            const finalPrice = price > 0 ? price : (Number(matchedMat?.reference_price) || 10.0);
            const subtotal = Number((qty * finalPrice).toFixed(2));

            const dedupeGenKey = `${sName.toLowerCase()}|${rawDesc.trim().toLowerCase()}|${qty}|${subtotal}`;
            if (seenMaterialKeys.has(dedupeGenKey)) {
              continue;
            }
            seenMaterialKeys.add(dedupeGenKey);

            parsedMaterials.push({
              sheet: sName,
              materialId,
              materialName: rawDesc,
              quantity: qty,
              unit: unit || matchedMat?.unit || 'und',
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
    const grandTotalFinal = Number((grandTotalMaterials + grandTotalServices + grandTotalEquipment).toFixed(2));

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
        unit_price, subtotal, ai_suggested_quantity, ai_reasoning, human_notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        `Quantitativo real importado da planilha executiva (${originalName} - Aba: ${item.sheet})`,
        `Levantamento executivo real de campo [${item.sheet}]`
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
      items: parsedMaterials
    };
  }
}
