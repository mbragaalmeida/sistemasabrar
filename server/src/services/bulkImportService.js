import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

import { db } from '../db/connection.js';
import { LearningService } from './learningService.js';

export class BulkImportService {
  /**
   * Gera a planilha modelo oficial (.xlsx) da SABRAR com 4 abas estruturadas
   * e dados de exemplo realistas de engenharia de climatizacao (HVAC).
   */
  static generateTemplate() {
    const wb = XLSX.utils.book_new();

    // 1. Aba: Obras
    const obrasData = [
      {
        'Codigo_Obra': 'PRJ-2025-010',
        'Nome_Obra': 'Centro Empresarial Berrini - Torre A',
        'Cliente': 'Berrini Empreendimentos Comerciais S.A.',
        'Tipo_Obra': 'Comercial',
        'Cidade': 'Sao Paulo',
        'UF': 'SP',
        'Area_m2': 3500,
        'Receita_Contrato_R$': 580000.00,
        'Data_Inicio': '2025-02-15',
        'Data_Fim': '2025-08-30',
        'Engenheiro_Responsavel': 'Eng. Rafael Santos',
        'Status': 'Finalizado'
      },
      {
        'Codigo_Obra': 'PRJ-2025-011',
        'Nome_Obra': 'Fabrica BioPharma Labs - Salas Limpas',
        'Cliente': 'BioPharma Industria Farmaceutica Ltda',
        'Tipo_Obra': 'Industrial',
        'Cidade': 'Campinas',
        'UF': 'SP',
        'Area_m2': 4800,
        'Receita_Contrato_R$': 940000.00,
        'Data_Inicio': '2025-04-10',
        'Data_Fim': '2025-11-25',
        'Engenheiro_Responsavel': 'Eng. Rafael Santos',
        'Status': 'Finalizado'
      },
      {
        'Codigo_Obra': 'PRJ-2025-012',
        'Nome_Obra': 'Hospital Sao Lucas - Expansao Bloco Cirurgico',
        'Cliente': 'Rede Hospitalar Sao Lucas S.A.',
        'Tipo_Obra': 'Hospitalar',
        'Cidade': 'Sao Paulo',
        'UF': 'SP',
        'Area_m2': 2100,
        'Receita_Contrato_R$': 760000.00,
        'Data_Inicio': '2025-06-01',
        'Data_Fim': '2025-12-20',
        'Engenheiro_Responsavel': 'Eng. Rafael Santos',
        'Status': 'Finalizado'
      }
    ];

    // 2. Aba: Levantamento_Materiais (Orcado)
    const levantamentoData = [
      // Obra Berrini
      {
        'Codigo_Obra': 'PRJ-2025-010',
        'Codigo_Material': 'MAT-HVAC-001',
        'Descricao_Material': 'Duto MPU Painel Duplo Aluminio Pre-Isolado 20mm',
        'Categoria': 'Rede de Dutos',
        'Unidade': 'm²',
        'Quantidade_Prevista': 850,
        'Preco_Unitario_R$': 145.00
      },
      {
        'Codigo_Obra': 'PRJ-2025-010',
        'Codigo_Material': 'MAT-HVAC-002',
        'Descricao_Material': 'Tubulacao de Cobre Rigido 1.1/8 pol com Isolamento Termico Elastoflex',
        'Categoria': 'Climatizacao - Expansao Direta',
        'Unidade': 'm',
        'Quantidade_Prevista': 420,
        'Preco_Unitario_R$': 118.50
      },
      {
        'Codigo_Obra': 'PRJ-2025-010',
        'Codigo_Material': 'MAT-HVAC-003',
        'Descricao_Material': 'Difusor de Ar 4 Vias 600x600 Aluminio com Registro',
        'Categoria': 'Difusao de Ar',
        'Unidade': 'un',
        'Quantidade_Prevista': 64,
        'Preco_Unitario_R$': 185.00
      },
      {
        'Codigo_Obra': 'PRJ-2025-010',
        'Codigo_Material': 'MAT-HVAC-004',
        'Descricao_Material': 'Fluido Refrigerante R-410A Cilindro 11.3kg',
        'Categoria': 'Climatizacao - Expansao Direta',
        'Unidade': 'un',
        'Quantidade_Prevista': 12,
        'Preco_Unitario_R$': 590.00
      },

      // Obra BioPharma
      {
        'Codigo_Obra': 'PRJ-2025-011',
        'Codigo_Material': 'MAT-HVAC-005',
        'Descricao_Material': 'Filtro Absoluto HEPA H14 para Sala Limpa com Caixilho Aluminio',
        'Categoria': 'Ventilacao e Exaustao',
        'Unidade': 'un',
        'Quantidade_Prevista': 48,
        'Preco_Unitario_R$': 680.00
      },
      {
        'Codigo_Obra': 'PRJ-2025-011',
        'Codigo_Material': 'MAT-HVAC-006',
        'Descricao_Material': 'Chapa Aco Inox 304 para Dutos Farmaceuticos 1.2mm',
        'Categoria': 'Rede de Dutos',
        'Unidade': 'm²',
        'Quantidade_Prevista': 920,
        'Preco_Unitario_R$': 240.00
      },
      {
        'Codigo_Obra': 'PRJ-2025-011',
        'Codigo_Material': 'MAT-HVAC-007',
        'Descricao_Material': 'Valvula de Controle 2 Vias Modulante 0-10V DN65',
        'Categoria': 'Climatizacao - Agua Gelada',
        'Unidade': 'un',
        'Quantidade_Prevista': 14,
        'Preco_Unitario_R$': 2450.00
      },

      // Obra Hospital Sao Lucas
      {
        'Codigo_Obra': 'PRJ-2025-012',
        'Codigo_Material': 'MAT-HVAC-008',
        'Descricao_Material': 'Fancoil Hidronico de Embutir Capacidade 7.5 TR',
        'Categoria': 'Climatizacao - Agua Gelada',
        'Unidade': 'un',
        'Quantidade_Prevista': 8,
        'Preco_Unitario_R$': 8900.00
      },
      {
        'Codigo_Obra': 'PRJ-2025-012',
        'Codigo_Material': 'MAT-HVAC-009',
        'Descricao_Material': 'Isolamento Termico Espuma Elastomerica Tubo 2.1/8 pol',
        'Categoria': 'Climatizacao - Agua Gelada',
        'Unidade': 'm',
        'Quantidade_Prevista': 380,
        'Preco_Unitario_R$': 46.00
      },
      {
        'Codigo_Obra': 'PRJ-2025-012',
        'Codigo_Material': 'MAT-HVAC-010',
        'Descricao_Material': 'Grelha de Retorno com Porta Filtro 1000x500',
        'Categoria': 'Difusao de Ar',
        'Unidade': 'un',
        'Quantidade_Prevista': 22,
        'Preco_Unitario_R$': 310.00
      }
    ];

    // 3. Aba: Consumo_Real_Final (Efetivamente utilizado ao termino da obra)
    const consumoRealData = [
      // Obra Berrini
      {
        'Codigo_Obra': 'PRJ-2025-010',
        'Codigo_Material': 'MAT-HVAC-001',
        'Descricao_Material': 'Duto MPU Painel Duplo Aluminio Pre-Isolado 20mm',
        'Quantidade_Real_Consumida': 892,
        'Custo_Unitario_Real_R$': 142.00
      },
      {
        'Codigo_Obra': 'PRJ-2025-010',
        'Codigo_Material': 'MAT-HVAC-002',
        'Descricao_Material': 'Tubulacao de Cobre Rigido 1.1/8 pol com Isolamento Termico Elastoflex',
        'Quantidade_Real_Consumida': 438,
        'Custo_Unitario_Real_R$': 119.00
      },
      {
        'Codigo_Obra': 'PRJ-2025-010',
        'Codigo_Material': 'MAT-HVAC-003',
        'Descricao_Material': 'Difusor de Ar 4 Vias 600x600 Aluminio com Registro',
        'Quantidade_Real_Consumida': 64,
        'Custo_Unitario_Real_R$': 180.00
      },
      {
        'Codigo_Obra': 'PRJ-2025-010',
        'Codigo_Material': 'MAT-HVAC-004',
        'Descricao_Material': 'Fluido Refrigerante R-410A Cilindro 11.3kg',
        'Quantidade_Real_Consumida': 13,
        'Custo_Unitario_Real_R$': 575.00
      },

      // Obra BioPharma
      {
        'Codigo_Obra': 'PRJ-2025-011',
        'Codigo_Material': 'MAT-HVAC-005',
        'Descricao_Material': 'Filtro Absoluto HEPA H14 para Sala Limpa com Caixilho Aluminio',
        'Quantidade_Real_Consumida': 48,
        'Custo_Unitario_Real_R$': 670.00
      },
      {
        'Codigo_Obra': 'PRJ-2025-011',
        'Codigo_Material': 'MAT-HVAC-006',
        'Descricao_Material': 'Chapa Aco Inox 304 para Dutos Farmaceuticos 1.2mm',
        'Quantidade_Real_Consumida': 955,
        'Custo_Unitario_Real_R$': 238.00
      },
      {
        'Codigo_Obra': 'PRJ-2025-011',
        'Codigo_Material': 'MAT-HVAC-007',
        'Descricao_Material': 'Valvula de Controle 2 Vias Modulante 0-10V DN65',
        'Quantidade_Real_Consumida': 14,
        'Custo_Unitario_Real_R$': 2400.00
      },

      // Obra Hospital Sao Lucas
      {
        'Codigo_Obra': 'PRJ-2025-012',
        'Codigo_Material': 'MAT-HVAC-008',
        'Descricao_Material': 'Fancoil Hidronico de Embutir Capacidade 7.5 TR',
        'Quantidade_Real_Consumida': 8,
        'Custo_Unitario_Real_R$': 8850.00
      },
      {
        'Codigo_Obra': 'PRJ-2025-012',
        'Codigo_Material': 'MAT-HVAC-009',
        'Descricao_Material': 'Isolamento Termico Espuma Elastomerica Tubo 2.1/8 pol',
        'Quantidade_Real_Consumida': 395,
        'Custo_Unitario_Real_R$': 45.50
      },
      {
        'Codigo_Obra': 'PRJ-2025-012',
        'Codigo_Material': 'MAT-HVAC-010',
        'Descricao_Material': 'Grelha de Retorno com Porta Filtro 1000x500',
        'Quantidade_Real_Consumida': 22,
        'Custo_Unitario_Real_R$': 305.00
      }
    ];

    // 4. Aba: Instrucoes
    const instrucoesData = [
      {
        'Campo_Coluna': 'Codigo_Obra',
        'Aba': 'Todas',
        'Obrigatorio': 'SIM',
        'Descricao': 'Codigo unico da obra (Ex: PRJ-2025-010). Deve ser identico nas 3 abas para correlacionar o orcamento ao consumo real.'
      },
      {
        'Campo_Coluna': 'Receita_Contrato_R$',
        'Aba': 'Obras',
        'Obrigatorio': 'SIM',
        'Descricao': 'Valor total contratado da obra. Alimenta diretamente os graficos de Receita x Custo de Materiais do painel executivo.'
      },
      {
        'Campo_Coluna': 'Tipo_Obra',
        'Aba': 'Obras',
        'Obrigatorio': 'SIM',
        'Descricao': 'Comercial, Industrial, Hospitalar, Residencial, Varejo, Reforma. A IA usa esta tipologia para calcular fatores de consumo especificos.'
      },
      {
        'Campo_Coluna': 'Descricao_Material',
        'Aba': 'Levantamento & Consumo',
        'Obrigatorio': 'SIM',
        'Descricao': 'Nome do material. Caso nao exista no catalogo da SABRAR, sera automaticamente cadastrado.'
      },
      {
        'Campo_Coluna': 'Quantidade_Prevista',
        'Aba': 'Levantamento_Materiais',
        'Obrigatorio': 'SIM',
        'Descricao': 'Quantidade orcada inicialmente pela engenharia ou proposta comercial.'
      },
      {
        'Campo_Coluna': 'Quantidade_Real_Consumida',
        'Aba': 'Consumo_Real_Final',
        'Obrigatorio': 'SIM',
        'Descricao': 'Quantidade efetivamente instalada na obra (Retiradas - Devolucoes). A IA compara esta quantidade com a orcada para calibrar a margem de perda e recortes.'
      },
      {
        'Campo_Coluna': 'Custo_Unitario_Real_R$',
        'Aba': 'Consumo_Real_Final',
        'Obrigatorio': 'SIM',
        'Descricao': 'Preco de custo real de compra pago pelo material, usado para calcular o custo total real e a margem bruta da obra.'
      }
    ];

    const wsObras = XLSX.utils.json_to_sheet(obrasData);
    const wsLevantamento = XLSX.utils.json_to_sheet(levantamentoData);
    const wsConsumo = XLSX.utils.json_to_sheet(consumoRealData);
    const wsInstrucoes = XLSX.utils.json_to_sheet(instrucoesData);

    wsObras['!cols'] = [{ wch: 15 }, { wch: 38 }, { wch: 35 }, { wch: 14 }, { wch: 16 }, { wch: 6 }, { wch: 10 }, { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 22 }, { wch: 14 }];
    wsLevantamento['!cols'] = [{ wch: 15 }, { wch: 16 }, { wch: 55 }, { wch: 28 }, { wch: 8 }, { wch: 20 }, { wch: 18 }];
    wsConsumo['!cols'] = [{ wch: 15 }, { wch: 16 }, { wch: 55 }, { wch: 24 }, { wch: 22 }];
    wsInstrucoes['!cols'] = [{ wch: 24 }, { wch: 22 }, { wch: 14 }, { wch: 70 }];

    XLSX.utils.book_append_sheet(wb, wsObras, 'Obras');
    XLSX.utils.book_append_sheet(wb, wsLevantamento, 'Levantamento_Materiais');
    XLSX.utils.book_append_sheet(wb, wsConsumo, 'Consumo_Real_Final');
    XLSX.utils.book_append_sheet(wb, wsInstrucoes, 'Instrucoes');

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }

  /**
   * Processa uma planilha de carga em massa com multiplas obras,
   * levantamento de materiais e consumo real final.
   */
  static async parseAndImportBulkData(filePath, originalName, userId = 1) {
    const workbook = XLSX.readFile(filePath);
    if (!workbook.SheetNames.length) throw new Error('A planilha esta vazia ou ilegivel');

    let sheetObras = null;
    let sheetLevantamento = null;
    let sheetConsumo = null;

    for (const name of workbook.SheetNames) {
      const lower = name.trim().toLowerCase();
      if (lower.includes('obra') || lower.includes('projeto')) sheetObras = workbook.Sheets[name];
      else if (lower.includes('levant') || lower.includes('orc') || lower.includes('previst')) sheetLevantamento = workbook.Sheets[name];
      else if (lower.includes('consum') || lower.includes('real') || lower.includes('utiliz') || lower.includes('final')) sheetConsumo = workbook.Sheets[name];
    }

    if (!sheetObras && workbook.SheetNames.length >= 1) sheetObras = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheetLevantamento && workbook.SheetNames.length >= 2) sheetLevantamento = workbook.Sheets[workbook.SheetNames[1]];
    if (!sheetConsumo && workbook.SheetNames.length >= 3) sheetConsumo = workbook.Sheets[workbook.SheetNames[2]];

    if (!sheetObras) {
      throw new Error('Nao foi possivel identificar a aba de Obras/Projetos na planilha.');
    }

    const rawObras = XLSX.utils.sheet_to_json(sheetObras);
    const rawLevantamento = sheetLevantamento ? XLSX.utils.sheet_to_json(sheetLevantamento) : [];
    const rawConsumo = sheetConsumo ? XLSX.utils.sheet_to_json(sheetConsumo) : [];

    if (!rawObras || rawObras.length === 0) {
      throw new Error('Nenhuma linha de obra encontrada na aba de Obras.');
    }

    return await this.importStructuredData({
      projects: rawObras,
      materialsBudget: rawLevantamento,
      materialsReal: rawConsumo,
      originalName,
      userId
    });
  }

  /**
   * Importacao a partir de estrutura unificada (usada tanto por Excel quanto por JSON).
   */
  static async importStructuredData({ projects, materialsBudget = [], materialsReal = [], originalName = 'Carga em Massa', userId = 1 }) {
    const catalog = await db.prepare('SELECT * FROM materials').all();
    const maxMatId = (await db.prepare('SELECT MAX(id) as max_id FROM materials').get())?.max_id || 0;
    let newMatCounter = 0;

    const findOrCreateMaterial = async (code, name, category, unit, price) => {
      const cleanName = String(name || '').trim();
      const cleanCode = code ? String(code).trim() : '';

      let found = null;
      if (cleanCode) {
        found = catalog.find(m => m.code.toLowerCase() === cleanCode.toLowerCase());
      }
      if (!found && cleanName) {
        const lower = cleanName.toLowerCase();
        found = catalog.find(m => m.name.toLowerCase() === lower);
      }

      if (found) return found;

      newMatCounter++;
      const assignedCode = cleanCode || `MAT-MASSA-${String(maxMatId + newMatCounter).padStart(5, '0')}`;
      const cat = category || 'Climatizacao';
      const u = unit || 'un';
      const p = Number(price) > 0 ? Number(price) : 50.0;

      const res = await db.prepare(`
        INSERT INTO materials (code, name, description, category, unit, reference_price, stock_physical, stock_reserved, stock_minimum, status)
        VALUES (?, ?, ?, ?, ?, ?, 100, 0, 10, 'Ativo')
      `).run(
        assignedCode,
        cleanName,
        `Cadastrado automaticamente via carga em massa: ${originalName}`,
        cat,
        u,
        p
      );

      const newMat = {
        id: res.lastInsertRowid,
        code: assignedCode,
        name: cleanName,
        category: cat,
        unit: u,
        reference_price: p
      };
      catalog.push(newMat);
      return newMat;
    };

    const normalizeNumber = (val) => {
      if (typeof val === 'number') return val;
      if (!val) return 0;
      const str = String(val).replace(/R\$\s?/g, '').replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, '');
      const n = parseFloat(str);
      return isNaN(n) ? 0 : n;
    };

    const results = {
      projectsImported: 0,
      materialsCataloged: 0,
      historicalRowsCreated: 0,
      totalRevenue: 0,
      totalBudgetMaterials: 0,
      totalActualMaterialsCost: 0,
      projectDetails: []
    };

    for (const rawP of projects) {
      const pCode = String(rawP.Codigo_Obra || rawP.codigo || rawP.code || `PRJ-HIST-${Date.now()}-${results.projectsImported + 1}`).trim();
      const pName = String(rawP.Nome_Obra || rawP.nome || rawP.name || 'Obra Sem Nome').trim();
      const pClient = String(rawP.Cliente || rawP.cliente || rawP.client || 'Cliente Padrao').trim();
      const pType = String(rawP.Tipo_Obra || rawP.tipo || rawP.project_type || 'Comercial').trim();
      const pCity = String(rawP.Cidade || rawP.cidade || rawP.city || 'Sao Paulo').trim();
      const pState = String(rawP.UF || rawP.uf || rawP.state || 'SP').trim();
      const pArea = normalizeNumber(rawP.Area_m2 || rawP.area || rawP.project_size_sqm || 0);
      const pRevenue = normalizeNumber(rawP['Receita_Contrato_R$'] || rawP.receita || rawP.total_budget_final || 0);
      const pStart = String(rawP.Data_Inicio || rawP.data_inicio || '2025-01-01').trim();
      const pEnd = String(rawP.Data_Fim || rawP.data_fim || '2025-12-31').trim();
      const pEngineer = String(rawP.Engenheiro_Responsavel || rawP.engenheiro || 'Eng. Rafael Santos').trim();
      const pStatus = String(rawP.Status || rawP.status || 'Finalizado').trim();

      let project = await db.prepare('SELECT * FROM projects WHERE code = ?').get(pCode);
      let projectId;

      if (project) {
        projectId = project.id;
        await db.prepare(`
          UPDATE projects SET
            name = ?, client = ?, project_type = ?, city = ?, state = ?,
            start_date = ?, expected_end_date = ?, responsible_engineer = ?,
            status = ?, total_budget_final = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(pName, pClient, pType, pCity, pState, pStart, pEnd, pEngineer, pStatus, pRevenue, projectId);
      } else {
        const resP = await db.prepare(`
          INSERT INTO projects (
            code, name, client, address, city, state, project_type,
            start_date, expected_end_date, responsible_engineer, status,
            total_budget_final, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          pCode, pName, pClient, `${pCity} - ${pState}`, pCity, pState, pType,
          pStart, pEnd, pEngineer, pStatus, pRevenue,
          `Obra importada em massa para calibracao historica da IA (${originalName})`
        );
        projectId = resP.lastInsertRowid;
      }

      results.projectsImported++;
      results.totalRevenue += pRevenue;

      const pBudgetItems = materialsBudget.filter(item => {
        const c = String(item.Codigo_Obra || item.codigo_obra || item.project_code || '').trim();
        return c.toLowerCase() === pCode.toLowerCase();
      });

      const pRealItems = materialsReal.filter(item => {
        const c = String(item.Codigo_Obra || item.codigo_obra || item.project_code || '').trim();
        return c.toLowerCase() === pCode.toLowerCase();
      });

      const budgetMap = new Map();
      let pTotalBudgetMaterials = 0;

      let budget = await db.prepare('SELECT * FROM budgets WHERE project_id = ?').get(projectId);
      let budgetId;

      if (!budget) {
        const bCount = ((await db.prepare('SELECT COUNT(*) as count FROM budgets').get())?.count || 0) + 1;
        const bCode = `ORC-HIST-${String(bCount).padStart(4, '0')}`;
        const resB = await db.prepare(`
          INSERT INTO budgets (
            project_id, code, status, total_materials, total_services,
            total_final, commercial_terms
          ) VALUES (?, ?, 'Aprovado', 0, 0, ?, 'Orcamento aprovado consolidado historicamente.')
        `).run(projectId, bCode, pRevenue);
        budgetId = resB.lastInsertRowid;
      } else {
        budgetId = budget.id;
        await db.prepare('DELETE FROM budget_items WHERE budget_id = ?').run(budgetId);
      }

      const insertBudgetItem = db.prepare(`
        INSERT INTO budget_items (
          budget_id, material_id, material_name, quantity, unit,
          unit_price, subtotal, ai_suggested_quantity, ai_reasoning, human_notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const item of pBudgetItems) {
        const matDesc = String(item.Descricao_Material || item.descricao || item.material_name || '').trim();
        if (!matDesc) continue;
        const matCode = item.Codigo_Material || item.codigo_material;
        const matCat = item.Categoria || item.categoria;
        const matUnit = item.Unidade || item.unidade || 'un';
        const matQty = normalizeNumber(item.Quantidade_Prevista || item.quantidade || item.quantity);
        const matPrice = normalizeNumber(item['Preco_Unitario_R$'] || item.preco_unitario || item.unit_price);
        if (matQty <= 0) continue;

        const mat = await findOrCreateMaterial(matCode, matDesc, matCat, matUnit, matPrice);
        const subtotal = Number((matQty * (matPrice > 0 ? matPrice : mat.reference_price)).toFixed(2));
        pTotalBudgetMaterials += subtotal;

        await insertBudgetItem.run(
          budgetId,
          mat.id,
          mat.name,
          matQty,
          mat.unit,
          matPrice > 0 ? matPrice : mat.reference_price,
          subtotal,
          matQty,
          'Levantamento historico de engenharia SABRAR',
          'Importado em lote para base de referencia'
        );

        budgetMap.set(mat.id, {
          materialId: mat.id,
          name: mat.name,
          unit: mat.unit,
          qty: matQty,
          price: matPrice > 0 ? matPrice : mat.reference_price,
          subtotal
        });
      }

      let pTotalActualMaterialsCost = 0;

      for (const item of pRealItems) {
        const matDesc = String(item.Descricao_Material || item.descricao || item.material_name || '').trim();
        if (!matDesc) continue;
        const matCode = item.Codigo_Material || item.codigo_material;
        const realQty = normalizeNumber(item.Quantidade_Real_Consumida || item.quantidade_real || item.real_qty);
        const realUnitCost = normalizeNumber(item['Custo_Unitario_Real_R$'] || item.custo_unitario || item.real_cost);
        if (realQty <= 0) continue;

        const mat = await findOrCreateMaterial(matCode, matDesc, null, null, realUnitCost);
        const finalUnitCost = realUnitCost > 0 ? realUnitCost : mat.reference_price;
        const itemActualCost = Number((realQty * finalUnitCost).toFixed(2));
        pTotalActualMaterialsCost += itemActualCost;

        const budgeted = budgetMap.get(mat.id);
        const budgetedQty = budgeted ? budgeted.qty : realQty;
        const varianceUnits = Number((realQty - budgetedQty).toFixed(2));
        const variancePercent = budgetedQty > 0 ? Number(((varianceUnits / budgetedQty) * 100).toFixed(2)) : 0;
        const learnedFactor = budgetedQty > 0 ? Number((realQty / budgetedQty).toFixed(2)) : 1.0;

        const existingHist = await db.prepare('SELECT id FROM historical_usage WHERE project_id = ? AND material_id = ?').get(projectId, mat.id);
        if (existingHist) {
          await db.prepare(`
            UPDATE historical_usage SET
              project_type = ?, project_size_sqm = ?,
              ai_suggested_qty = ?, human_approved_qty = ?,
              total_requested_qty = ?, total_withdrawn_qty = ?,
              total_returned_qty = 0, actual_consumed_qty = ?,
              variance_units = ?, variance_percent = ?,
              learned_adjustment_factor = ?, is_immutable = 1,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(
            pType, pArea,
            budgetedQty, budgetedQty,
            realQty, realQty,
            realQty, varianceUnits, variancePercent,
            learnedFactor, existingHist.id
          );
        } else {
          await db.prepare(`
            INSERT INTO historical_usage (
              project_id, material_id, project_type, project_size_sqm,
              ai_suggested_qty, human_approved_qty, total_requested_qty,
              total_withdrawn_qty, total_returned_qty, actual_consumed_qty,
              variance_units, variance_percent, learned_adjustment_factor,
              is_immutable
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, 1)
          `).run(
            projectId, mat.id, pType, pArea,
            budgetedQty, budgetedQty, realQty, realQty,
            realQty, varianceUnits, variancePercent,
            learnedFactor
          );
        }

        results.historicalRowsCreated++;

        await db.prepare(`
          INSERT INTO stock_movements (
            material_id, type, quantity, previous_stock, new_stock,
            project_id, user_id, notes
          ) VALUES (?, 'SAIDA_OBRA', ?, 100, 100, ?, ?, ?)
        `).run(
          mat.id, realQty, projectId, userId,
          `Consumo real registrado via carga em massa: ${pName} (${originalName})`
        );
      }

      await db.prepare(`
        UPDATE budgets SET
          total_materials = ?,
          total_services = ?,
          total_final = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        pTotalBudgetMaterials,
        Math.max(0, pRevenue - pTotalBudgetMaterials),
        pRevenue,
        budgetId
      );

      await db.prepare(`
        UPDATE projects SET
          total_budget_materials = ?,
          total_budget_final = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        pTotalBudgetMaterials,
        pRevenue,
        projectId
      );

      results.totalBudgetMaterials += pTotalBudgetMaterials;
      results.totalActualMaterialsCost += pTotalActualMaterialsCost;

      results.projectDetails.push({
        id: projectId,
        code: pCode,
        name: pName,
        type: pType,
        revenue: pRevenue,
        budgetMaterials: pTotalBudgetMaterials,
        actualMaterialsCost: pTotalActualMaterialsCost,
        margin: pRevenue - pTotalActualMaterialsCost,
        marginPercent: pRevenue > 0 ? Number(((pRevenue - pTotalActualMaterialsCost) / pRevenue * 100).toFixed(1)) : 0,
        itemsBudgeted: pBudgetItems.length,
        itemsReal: pRealItems.length
      });
    }

    results.materialsCataloged = newMatCounter;

    await db.prepare(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
      VALUES (?, 'CARGA_MASSA_OBRAS', 'PROJETO', 0, ?)
    `).run(
      userId,
      `Carga em massa executada com sucesso (${originalName}): ${results.projectsImported} obras processadas, ${results.historicalRowsCreated} registros de consumo calibrados no motor de IA da SABRAR.`
    );

    console.log(`[BulkImportService] Sucesso: ${results.projectsImported} obras, ${results.historicalRowsCreated} registros de aprendizado.`);
    return results;
  }
}
