import db from '../src/db/connection.js';
import { AIAnalysisService } from '../src/services/aiService.js';
import { DuctAnalysisService } from '../src/services/ductAnalysisService.js';
import { normalizeUnit, areUnitsCompatible } from '../src/utils/unitConversion.js';
import { searchLiveMaterialBase } from '../src/services/sabrarEconomicBase.js';

async function run() {
  console.log('===================================================================');
  console.log('TESTE E AUDITORIA COMPLETA DE DIVERGÊNCIAS - PROJETO 142 VS 125');
  console.log('===================================================================\n');

  // 0. VERIFICAÇÃO INICIAL DO BENCHMARK: PROJETO 125 (APROVADO)
  console.log('--- 0. Proteção do Benchmark: Projeto 125 ---');
  const b125_before = await db.prepare('SELECT id, project_id, code, status, total_final, is_partial FROM budgets WHERE project_id = 125').get();
  console.log(`Projeto 125 Inicial: Status=${b125_before?.status}, Total=R$ ${b125_before?.total_final}`);
  if (b125_before?.status !== 'Aprovado' || Number(b125_before?.total_final) !== 222936.00) {
    throw new Error(`VIOLAÇÃO: Projeto 125 deveria estar Aprovado com R$ 222.936,00. Encontrado: ${JSON.stringify(b125_before)}`);
  }

  // 1. EXECUÇÃO DA ANÁLISE DOCUMENTAL COM CENÁRIO DE DIVERGÊNCIA LLM
  // Simula as 3 extrações do LLM descritas pelo Codex:
  // - Grelha 600x300 (qty 55) -> Deve deduplicar com Item 03 da lista CAD (55 un)
  // - Difusor 15"x15" (qty 4) -> Deve deduplicar com Item 04 da lista CAD (4 un)
  // - Damper 300x450 (qty 3, mas evidência aponta Item 07 300x150) -> Deve gerar CONFLITO DOCUMENTAL explícito sem criar duplicata corrompida
  console.log('\n--- 1. Executando AIAnalysisService.analyzeProjectDocuments(142) com cenário Codex ---');
  const mockLLMResponse = {
    materials: [
      {
        name: 'Grelha de Dupla Deflexão com Registro 600x300mm (TROPICAL)',
        category: 'Difusão de Ar',
        quantity: 55,
        unit: 'UN',
        sourceFile: '0578-SUPER-SMART-HVAC-R00-01-02.pdf',
        sourcePage: 1,
        evidence: 'Lista de Material Item 03 / Projeto CAD: 55x GRELHA DUPLA DEFLEXÃO DOTADA DE REGISTRO TAMANHO 600x300mm'
      },
      {
        name: 'Difusor de Ar 4 Saídas 15"x15" com Registro e Caixa Plenum (TROPICAL)',
        category: 'Difusão de Ar',
        quantity: 4,
        unit: 'UN',
        sourceFile: '0578-SUPER-SMART-HVAC-R00-01-02.pdf',
        sourcePage: 1,
        evidence: 'Lista de Material Item 04 / Projeto CAD: 4x DIFUSOR 4 SAÍDAS DOTADO DE REGISTRO E CAIXA PLENUM - TAMANHO 15"x15"'
      },
      {
        name: 'Damper para Controle de Vazão Tamanho 300x450mm',
        category: 'Dutos',
        quantity: 3,
        unit: 'UN',
        sourceFile: '0578-SUPER-SMART-HVAC-R00-01-02.pdf',
        sourcePage: 1,
        evidence: 'Item 07 - Damper para controle de vazão 300x150mm (TROPICAL)'
      }
    ],
    equipment: [],
    duct_segments: []
  };

  const analysisResult = await AIAnalysisService.analyzeProjectDocuments(142, '', { mockLLMResponse });
  console.log(`Análise concluída com sucesso! Budget ID gerado: ${analysisResult?.budgetId || analysisResult?.budget?.id}`);

  // 2. AUDITORIA DO ORÇAMENTO GERADO NO PROJETO 142 (Requisitos 6 e 7)
  console.log('\n--- 2. Verificação do Orçamento e Subtotal Parcial (Requisitos 6 e 7) ---');
  const b142 = await db.prepare(`
    SELECT id, project_id, code, status, total_materials, total_services,
           total_labor, total_equipment, total_final, is_partial, partial_subtotal,
           completeness_status, pendencies_summary, document_conflicts
    FROM budgets
    WHERE project_id = 142
  `).get();

  console.log('Orçamento 142:', {
    id: b142.id,
    code: b142.code,
    status: b142.status,
    total_materials: b142.total_materials,
    total_services: b142.total_services,
    total_final: b142.total_final,
    is_partial: b142.is_partial,
    partial_subtotal: b142.partial_subtotal,
    completeness_status: b142.completeness_status
  });

  const isPartialOk = Boolean(b142.is_partial) === true;
  const partialSubtotalOk = Number(b142.partial_subtotal) === 26040.00;
  const statusOk = b142.completeness_status === 'SUBTOTAL_PARCIAL_COM_PENDENCIAS';
  console.log(`> Requisito 7: is_partial === true: ${isPartialOk ? 'OK' : 'FALHA'}`);
  console.log(`> Requisito 7: partial_subtotal === R$ 26.040,00: ${partialSubtotalOk ? 'OK' : 'FALHA'}`);
  console.log(`> Requisito 7: completeness_status === 'SUBTOTAL_PARCIAL_COM_PENDENCIAS': ${statusOk ? 'OK' : 'FALHA'}`);

  // 3. AUDITORIA DE MATERIAIS: DEDUPLICAÇÃO E CONFLITOS (Requisitos 1, 2, 4, 5, 6)
  console.log('\n--- 3. Auditoria de Materiais e Classificações (Requisitos 1, 2, 4, 5, 6) ---');
  const items142 = await db.prepare(`
    SELECT id, material_name, quantity, unit, unit_price, subtotal,
           classification, price_status, evidence, conflict_description
    FROM budget_items
    WHERE budget_id = ?
    ORDER BY id ASC
  `).all(b142.id);

  console.log(`Total de itens de materiais: ${items142.length}`);

  // Caso 1: Grelha 600x300 (deve haver 1 linha com qty 55, sem duplicata)
  const grelhas = items142.filter(it => it.material_name.toLowerCase().includes('grelha') && it.material_name.includes('600x300'));
  console.log('Grelhas 600x300 encontradas:', grelhas.map(g => ({ name: g.material_name, qty: g.quantity, class: g.classification })));
  const grelhaOk = grelhas.length === 1 && Number(grelhas[0].quantity) === 55;
  console.log(`> Requisito 1: Grelha 600x300 deduplicada para exatamente 1 linha de 55: ${grelhaOk ? 'OK' : 'FALHA'}`);

  // Caso 2: Difusor 15x15 (deve haver 1 linha com qty 4, sem duplicata)
  const difusores = items142.filter(it => it.material_name.toLowerCase().includes('difusor') && /15["'”]?\s*[xX×]\s*15/.test(it.material_name));
  console.log('Difusores 15x15 encontrados:', difusores.map(d => ({ name: d.material_name, qty: d.quantity, class: d.classification })));
  const difusorOk = difusores.length === 1 && Number(difusores[0].quantity) === 4;
  console.log(`> Requisito 1: Difusor 15x15 deduplicado para exatamente 1 linha de 4: ${difusorOk ? 'OK' : 'FALHA'}`);

  // Caso 3: Damper 300x450 vs 300x150 (conflito documental explícito)
  const dampers = items142.filter(it => it.material_name.toLowerCase().includes('damper'));
  console.log('Dampers encontrados:');
  dampers.forEach(d => {
    console.log(`  - [${d.classification}] ${d.material_name} | Qtd: ${d.quantity} | Preço: ${d.unit_price} | Conflito: ${d.conflict_description || 'nenhum'}`);
  });

  const damperConflictRow = items142.find(it => it.classification === 'CONFLITO_DOCUMENTAL');
  const damper450Rows = items142.filter(it => it.material_name.toLowerCase().includes('damper') && it.material_name.includes('300x450'));
  const damper150Rows = items142.filter(it => it.material_name.toLowerCase().includes('damper') && it.material_name.includes('300x150'));

  const conflictDetectedOk = Boolean(damperConflictRow && damperConflictRow.conflict_description);
  const damper450Ok = damper450Rows.length === 1 && Number(damper450Rows[0].quantity) === 1; // Item 05 preservado
  const damper150Ok = damper150Rows.length === 1 && Number(damper150Rows[0].quantity) === 3; // Item 07 preservado com flag de conflito
  console.log(`> Requisito 1 & 2: Conflito documental gerado sem substituir o item correto: ${conflictDetectedOk ? 'OK' : 'FALHA'}`);
  console.log(`> Requisito 1: Damper 300x450 preservado com qty 1: ${damper450Ok ? 'OK' : 'FALHA'}`);
  console.log(`> Requisito 1: Damper 300x150 sinalizado como conflito com qty 3: ${damper150Ok ? 'OK' : 'FALHA'}`);

  // Caso 4: Preservação de preços e marcação PRECO_PENDENTE (Requisitos 4, 5, 6)
  const pendingPriceItems = items142.filter(it => it.classification === 'PRECO_PENDENTE' || it.price_status === 'PENDENTE_COTACAO');
  console.log(`Itens com Preço Pendente: ${pendingPriceItems.length}`);
  const pricingOk = pendingPriceItems.length > 0;
  console.log(`> Requisito 4 & 5: Materiais sem correspondência com preço preservados como PRECO_PENDENTE: ${pricingOk ? 'OK' : 'FALHA'}`);

  // Caso 5: Segregação de classificações no BD (Requisito 6)
  const classCounts = items142.reduce((acc, it) => {
    acc[it.classification || 'INDEFINIDO'] = (acc[it.classification || 'INDEFINIDO'] || 0) + 1;
    return acc;
  }, {});
  console.log('Distribuição de classificações de materiais:', classCounts);
  const segregationOk = Boolean(classCounts['PRECO_PENDENTE'] && classCounts['QUANTIDADE_PENDENTE'] && classCounts['CONFLITO_DOCUMENTAL']);
  console.log(`> Requisito 6: Segregação explícita das classificações: ${segregationOk ? 'OK' : 'FALHA'}`);

  // 4. AUDITORIA DE SERVIÇOS (Requisitos 6 e 7)
  console.log('\n--- 4. Auditoria de Serviços e Confirmação Parcial (Requisitos 6 e 7) ---');
  const services142 = await db.prepare(`
    SELECT id, category, description, quantity, unit, unit_price, subtotal, classification, measurement_status
    FROM services
    WHERE budget_id = ?
    ORDER BY id ASC
  `).all(b142.id);

  let confirmedServicesSum = 0;
  services142.forEach(s => {
    console.log(`  - [${s.classification || 'SEM_CLASS'}] ${s.description} | Qtd: ${s.quantity} ${s.unit} | Unit: R$ ${s.unit_price} | Sub: R$ ${s.subtotal}`);
    if (s.classification === 'CONFIRMADO') {
      confirmedServicesSum += Number(s.subtotal);
    }
  });

  console.log(`Soma de serviços CONFIRMADO: R$ ${confirmedServicesSum.toFixed(2)}`);
  const servicesOk = confirmedServicesSum === 26040.00;
  console.log(`> Requisito 7: Serviços confirmados somam exatamente R$ 26.040,00: ${servicesOk ? 'OK' : 'FALHA'}`);

  // 5. MEDIÇÃO GEOMÉTRICA DE DUTOS (Requisito 3)
  console.log('\n--- 5. Medição Geométrica de Dutos por Escala 1:75 (Requisito 3) ---');
  const ductMeasurement = await DuctAnalysisService.measureDuctsByGeometryAndScale(142);
  const ductSummary = ductMeasurement.summary || {};
  console.log('Resultado da medição geométrica:', {
    sections_count: ductMeasurement.sectionsCount,
    scale: ductMeasurement.scale,
    total_linear_meters: ductSummary.totalLinearMeters,
    total_net_area_m2: ductSummary.totalNetAreaM2,
    total_gross_area_m2: ductSummary.totalGrossAreaM2,
    mpu_panels_count: ductSummary.mpuPanelsCount,
    mpu_boxes_count: ductSummary.mpuBoxesCount,
    duteiro_labor_m2: ductSummary.duteiroLaborM2
  });

  const ductOk = ductMeasurement.sectionsCount === 32 &&
                 ductSummary.totalLinearMeters >= 120 &&
                 ductSummary.totalNetAreaM2 > 0 &&
                 ductSummary.totalGrossAreaM2 > 0 &&
                 ductSummary.mpuPanelsCount > 0 &&
                 ductSummary.duteiroLaborM2 === ductSummary.totalGrossAreaM2;
  console.log(`> Requisito 3: 32 seções de dutos medidas com relação Planta x Corte (${ductSummary.totalLinearMeters}m lineares, ${ductSummary.mpuPanelsCount} painéis / ${ductSummary.mpuBoxesCount} caixas, ${ductSummary.duteiroLaborM2} m² duteiro): ${ductOk ? 'OK' : 'FALHA'}`);

  // 6. VERIFICAÇÃO FINAL DO BENCHMARK: PROJETO 125 (APROVADO)
  console.log('\n--- 6. Verificação Final de Integridade do Benchmark (Projeto 125) ---');
  const b125_after = await db.prepare('SELECT id, project_id, code, status, total_final, is_partial FROM budgets WHERE project_id = 125').get();
  console.log(`Projeto 125 Final: Status=${b125_after?.status}, Total=R$ ${b125_after?.total_final}`);
  const benchmarkPreserved = b125_after?.status === 'Aprovado' && Number(b125_after?.total_final) === 222936.00;
  console.log(`> Preservação Estrita do Projeto 125: ${benchmarkPreserved ? 'PRESERVADO COM SUCESSO' : 'VIOLAÇÃO DETECTADA'}`);

  console.log('\n===================================================================');
  const allPassed = isPartialOk && partialSubtotalOk && statusOk && grelhaOk && difusorOk &&
                    conflictDetectedOk && damper450Ok && damper150Ok && pricingOk &&
                    segregationOk && servicesOk && ductOk && benchmarkPreserved;
  console.log(`STATUS GERAL DOS 7 REQUISITOS DO CODEX: ${allPassed ? 'TODOS OS 7 PONTOS APROVADOS COM SUCESSO!' : 'PENDÊNCIA ENCONTRADA'}`);
  console.log('===================================================================\n');

  if (!allPassed) {
    process.exit(1);
  }
}

run().catch(err => {
  console.error('ERRO NO TESTE:', err);
  process.exit(1);
});
