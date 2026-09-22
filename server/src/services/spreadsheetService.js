import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

import { db } from '../db/connection.js';
import { LearningService } from './learningService.js';

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
   * atualiza o orçamento com as quantidades/valores reais e calibra a IA.
   */
  static async processRealSurveySpreadsheet(projectId, filePath, originalName, userId = 1) {
    const project = await db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    if (!project) throw new Error('Projeto não encontrado');

    const workbook = XLSX.readFile(filePath);
    if (!workbook.SheetNames.length) throw new Error('A planilha está vazia ou ilegível');

    const ignoreSheetPatterns = [
      /^resumo$/i,
      /^capa$/i,
      /^sum[aá]rio$/i,
      /^[ií]ndice$/i,
      /^dashboard$/i,
      /fornecedor/i,
      /custos?\s*adm/i,
      /conv/i,
      /convers[aã]o/i,
      /^fechamento/i,
      /^modelo/i
    ];

    const isSummaryOrAuxSheet = (name, totalSheets) => {
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

    const detectColumns = (rows) => {
      for (let r = 0; r < Math.min(25, rows.length); r++) {
        const row = rows[r];
        if (!Array.isArray(row)) continue;

        let colDesc = -1;
        let colQty = -1;
        let colUnit = -1;
        let colUnitPrice = -1;
        let colTotalPrice = -1;
        let colMatCost = -1;
        let colCode = -1;

        for (let c = 0; c < row.length; c++) {
          const cell = String(row[c] || '').trim().toLowerCase();
          if (!cell) continue;

          // Descrição
          if (/^(descri[cç][aã]o|especifica[cç][aã]o|discrimina[cç][aã]o|produto)$/i.test(cell) || (cell.includes('descri') && !cell.includes('código'))) {
            if (colDesc === -1) colDesc = c;
          } else if (/^(item|nome)$/i.test(cell) && colDesc === -1) {
            colDesc = c;
          } else if (/^material\s*$/i.test(cell)) {
            colMatCost = c;
          }

          // Quantidade
          if (/^(quant(idade)?|qtd|qtde|qnt\.?|volume|consumo)$/i.test(cell) || cell.includes('quant') || cell.includes('qtd') || cell.includes('qnt')) {
            if (colQty === -1) colQty = c;
          }

          // Unidade
          if (/^(unidade|unid\.?|un|tipo|medida)$/i.test(cell)) {
            if (colUnit === -1) colUnit = c;
          }

          // Preço Unitário
          if (/^(pre[cç]o unit[aá]rio|valor unit[aá]rio|pu|p\.u\.|custo unit[aá]rio)$/i.test(cell) || (cell.includes('unit') && (cell.includes('pre') || cell.includes('val') || cell.includes('custo')))) {
            if (colUnitPrice === -1) colUnitPrice = c;
          }

          // Preço Total
          if (/^(pre[cç]o total|valor total|subtotal|total)$/i.test(cell) || (cell.includes('total') && (cell.includes('pre') || cell.includes('val')))) {
            if (colTotalPrice === -1) colTotalPrice = c;
          }

          // Código / Tag
          if (/^(c[oó]digo|cod|c[oó]d\.?|tag)$/i.test(cell)) {
            if (colCode === -1) colCode = c;
          }
        }

        if (colDesc === -1 && colMatCost !== -1) {
          colDesc = colMatCost;
          colMatCost = -1;
        }

        if (colDesc !== -1 && colQty !== -1) {
          return {
            headerRow: r,
            colDesc,
            colQty,
            colUnit,
            colUnitPrice,
            colTotalPrice,
            colMatCost,
            colCode
          };
        }
      }
      return null;
    };

    // Identifica quais abas devem ser processadas
    const candidateSheets = workbook.SheetNames.filter(name => !isSummaryOrAuxSheet(name, workbook.SheetNames.length));
    const sheetsToProcess = candidateSheets.length > 0 ? candidateSheets : workbook.SheetNames;

    // Busca catálogo atual da SABRAR e id máximo para códigos únicos
    const catalog = await db.prepare("SELECT * FROM materials WHERE status = 'Ativo'").all();
    const maxMatId = (await db.prepare("SELECT MAX(id) as max_id FROM materials").get())?.max_id || 0;
    let newMatCounter = 0;

    const parsedItems = [];
    let grandTotalMaterials = 0;
    const processedSheets = [];
    const learningTotals = new Map(); // materialId -> totalQuantity para calibração da IA

    for (const sName of sheetsToProcess) {
      const sheet = workbook.Sheets[sName];
      if (!sheet) continue;
      const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      if (!rawRows || rawRows.length < 2) continue;

      const cols = detectColumns(rawRows);
      if (!cols) continue;

      let sheetItemCount = 0;
      for (let r = cols.headerRow + 1; r < rawRows.length; r++) {
        const row = rawRows[r];
        if (!row || !Array.isArray(row)) continue;

        const rawMatName = String(row[cols.colDesc] || '').trim();
        if (!rawMatName || rawMatName.length < 2) continue;

        // Ignora linhas de totalização ou cabeçalhos de seção disfarçados
        if (/^(total|subtotal|soma|faturamento|preço total|resumo|equipamentos|outros|preços por tabela)/i.test(rawMatName)) {
          continue;
        }

        const rawQty = row[cols.colQty];
        let qty = 0;
        if (typeof rawQty === 'number') {
          qty = rawQty;
        } else if (rawQty) {
          qty = Number(String(rawQty).replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, '')) || 0;
        }

        if (qty <= 0 || isNaN(qty)) continue;

        // Trata unidade
        const unit = cols.colUnit !== -1 && row[cols.colUnit] ? String(row[cols.colUnit]).trim() : 'un';

        // Trata preço
        let price = 0;
        if (cols.colUnitPrice !== -1 && row[cols.colUnitPrice] !== undefined) {
          const rawPrice = row[cols.colUnitPrice];
          if (typeof rawPrice === 'number') {
            price = rawPrice;
          } else {
            price = Number(String(rawPrice).replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, '')) || 0;
          }
        }

        if (price <= 0 && cols.colTotalPrice !== -1 && row[cols.colTotalPrice] !== undefined) {
          const t = row[cols.colTotalPrice];
          const tot = typeof t === 'number' ? t : (Number(String(t).replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, '')) || 0);
          if (tot > 0 && qty > 0) price = Number((tot / qty).toFixed(2));
        }

        if (price <= 0 && cols.colMatCost !== -1 && row[cols.colMatCost] !== undefined) {
          const m = row[cols.colMatCost];
          const matTot = typeof m === 'number' ? m : (Number(String(m).replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, '')) || 0);
          if (matTot > 0 && qty > 0) price = Number((matTot / qty).toFixed(2));
        }

        // Tenta cruzar com material do catálogo
        const rawLower = rawMatName.toLowerCase();
        let matchedMat = null;

        if (cols.colCode !== -1 && row[cols.colCode]) {
          const codeVal = String(row[cols.colCode]).trim().toLowerCase();
          matchedMat = catalog.find(m => m.code.toLowerCase() === codeVal);
        }

        if (!matchedMat) {
          // Busca exata ou por similaridade de tokens
          matchedMat = catalog.find(m => m.name.toLowerCase() === rawLower) ||
            catalog.find(m => {
              const mTokens = m.name.toLowerCase().split(/\s+/).filter(t => t.length > 3);
              return mTokens.filter(t => rawLower.includes(t)).length >= 2;
            });
        }

        let materialId = null;
        let finalPrice = price;

        if (matchedMat) {
          materialId = matchedMat.id;
          if (finalPrice <= 0) finalPrice = matchedMat.reference_price || 10.0;
        } else {
          // Cadastra dinamicamente o novo material no catálogo e adiciona à memória para reutilização
          newMatCounter++;
          const newCode = `MAT-EXP-${String(maxMatId + newMatCounter).padStart(5, '0')}`;
          if (finalPrice <= 0) finalPrice = 50.0;
          const category = getCategoryFromSheet(sName);

          const resNewMat = await db.prepare(`
            INSERT INTO materials (code, name, description, category, unit, reference_price, stock_physical, stock_reserved, stock_minimum, status)
            VALUES (?, ?, ?, ?, ?, ?, 100, 0, 20, 'Ativo')
          `).run(
            newCode,
            rawMatName,
            `Material importado da planilha de levantamento: ${originalName} (${sName})`,
            category,
            unit,
            finalPrice
          );

          materialId = resNewMat.lastInsertRowid;
          catalog.push({
            id: materialId,
            code: newCode,
            name: rawMatName,
            category,
            unit,
            reference_price: finalPrice
          });
        }

        const subtotal = Number((qty * finalPrice).toFixed(2));
        grandTotalMaterials += subtotal;

        parsedItems.push({
          sheet: sName,
          materialId,
          materialName: rawMatName,
          quantity: qty,
          unit,
          unitPrice: finalPrice,
          subtotal
        });

        learningTotals.set(materialId, (learningTotals.get(materialId) || 0) + qty);
        sheetItemCount++;
      }

      if (sheetItemCount > 0) {
        processedSheets.push({ sheet: sName, itemsCount: sheetItemCount });
      }
    }

    if (parsedItems.length === 0) {
      throw new Error('Nenhum item válido com descrição e quantidade foi encontrado na planilha. Verifique se as colunas possuem cabeçalhos como Descrição/Material e Quantidade.');
    }

    console.log(`[Spreadsheet Parser] Sucesso: ${parsedItems.length} materiais processados de ${processedSheets.length} aba(s):`, processedSheets.map(s => s.sheet).join(', '));

    // 2. Busca ou cria o orçamento oficial
    let budget = await db.prepare('SELECT * FROM budgets WHERE project_id = ?').get(projectId);
    let budgetId;

    const defaultServicesCost = 24140.00; // Serviços de montagem, comissionamento e balanceamento
    const totalFinal = grandTotalMaterials + defaultServicesCost;

    if (!budget) {
      const count = ((await db.prepare('SELECT COUNT(*) as count FROM budgets').get())?.count || 0) + 1;
      const budgetCode = `ORC-2026-${String(count).padStart(3, '0')}`;

      const resB = await db.prepare(`
        INSERT INTO budgets (
          project_id, code, status, total_materials, total_services,
          total_labor, total_equipment, total_logistics, total_taxes,
          total_additional, total_final, validity_days, commercial_terms
        ) VALUES (?, ?, 'Em revisão', ?, ?, ?, 0, 0, 0, 0, ?, 15, ?)
      `).run(
        projectId, budgetCode, grandTotalMaterials, defaultServicesCost,
        defaultServicesCost, totalFinal,
        'Orçamento atualizado via importação de planilha de levantamento executivo real.'
      );
      budgetId = resB.lastInsertRowid;
    } else {
      budgetId = budget.id;
      await db.prepare(`
        UPDATE budgets SET
          total_materials = ?, total_final = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(grandTotalMaterials, grandTotalMaterials + (budget.total_services || defaultServicesCost), budgetId);

      // Limpa itens antigos para substituir pelos reais
      await db.prepare('DELETE FROM budget_items WHERE budget_id = ?').run(budgetId);
    }

    // 3. Insere os itens na tabela `budget_items`
    const insertItem = db.prepare(`
      INSERT INTO budget_items (
        budget_id, material_id, material_name, quantity, unit,
        unit_price, subtotal, ai_suggested_quantity, ai_reasoning, human_notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Busca sugestões anteriores da IA para calcular desvio de aprendizado
    const previousSuggestions = await db.prepare(`
      SELECT material_id, suggested_quantity 
      FROM ai_suggestions 
      WHERE project_id = ?
    `).all(projectId);

    const suggestionMap = new Map();
    for (const s of previousSuggestions) {
      suggestionMap.set(s.material_id, s.suggested_quantity);
    }

    for (const item of parsedItems) {
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

    // 4. MOTOR DE APRENDIZADO CONTÍNUO (Regras 24, 25, 26, 29)
    // Alimenta o histórico agregado por material para calibrar futuras obras
    let calibratedCount = 0;
    for (const [matId, totalQty] of learningTotals.entries()) {
      const aiSuggestedQty = suggestionMap.get(matId) || Math.round(totalQty * 0.9);
      try {
        await LearningService.recordProjectFeedback(
          projectId,
          matId,
          project.project_type || 'Infraestrutura',
          aiSuggestedQty,
          totalQty, // aprovado/real
          totalQty, // solicitado
          totalQty, // retirado
          0 // devolvido
        );
        calibratedCount++;
      } catch (learnErr) {
        console.warn('[Learning Feedback Error]', learnErr.message);
      }
    }

    // 5. Se não havia serviços cadastrados, insere serviços padrão
    const existingServices = (await db.prepare('SELECT COUNT(*) as count FROM services WHERE budget_id = ?').get(budgetId))?.count || 0;
    if (existingServices === 0) {
      const insertService = db.prepare(`
        INSERT INTO services (budget_id, category, description, quantity, unit, unit_price, subtotal, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      await insertService.run(budgetId, 'MÃO DE OBRA', 'Montagem mecânica de dutos MPU e difusores de ar', 120, 'h', 85.0, 10200.0, 'Padrão SMACNA');
      await insertService.run(budgetId, 'MÃO DE OBRA', 'Instalação de tubulação frigorígena e brasagem VRF', 80, 'h', 95.0, 7600.0, 'Técnicos certificados');
      await insertService.run(budgetId, 'SERVIÇOS TÉCNICOS', 'Pressurização N2 (450 PSI) e ensaio de estanqueidade', 1, 'gl', 3500.0, 3500.0, 'Protocolo de estanqueidade');
      await insertService.run(budgetId, 'ENGENHARIA', 'Balanceamento TAB, automação BMS e start-up final', 1, 'gl', 2840.0, 2840.0, 'Emissão de ART/RRT');
    }

    // 6. Atualiza totais na tabela `projects`
    await db.prepare(`
      UPDATE projects SET
        status = 'Orçamento gerado',
        total_budget_materials = ?,
        total_budget_final = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(grandTotalMaterials, totalFinal, projectId);

    // 7. Registra auditoria
    await db.prepare(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, project_id, details)
      VALUES (?, 'IMPORTACAO_PLANILHA_REAL', 'ORCAMENTO', ?, ?, ?)
    `).run(
      userId, budgetId, projectId,
      `Planilha ${originalName} importada com sucesso: ${parsedItems.length} materiais reais processados e calibrados no motor de IA da SABRAR.`
    );

    return {
      success: true,
      projectId,
      budgetId,
      itemsCount: parsedItems.length,
      calibratedCount,
      totalMaterials: grandTotalMaterials,
      totalFinal,
      sheetsCount: processedSheets.length,
      sheetsNames: processedSheets.map(s => s.sheet),
      items: parsedItems
    };
  }
}
