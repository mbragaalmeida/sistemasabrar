import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reconcileExtractions, detectCrossDocumentConflicts } from '../src/services/extractionReconciler.js';
import { AIAnalysisService } from '../src/services/aiService.js';

const table = (doc, rows) => `\n[Documento: ${doc} | Tipo: PROJETO_PDF]\n[TABELA_CAD_ESTRUTURADA: LISTA DE MATERIAL]\n${rows.join('\n')}\n[/TABELA_CAD_ESTRUTURADA]\n`;
const SMART_ROWS = [
  'ITEM 03 | QTD: 55 | DESC: GRELHA DUPLA DEFLEXÃO DOTADA DE REGISTRO TAMANHO 600x300mm | REF: TROPICAL',
  'ITEM 04 | QTD: 04 | DESC: DIFUSOR 4 SAÍDAS DOTADO DE REGISTRO E CAIXA PLENUM - TAMANHO 15"x15" | REF: TROPICAL',
  'ITEM 05 | QTD: 01 | DESC: DAMPER PARA CONTROLE DE VAZÃO TAMANHO 300X450mm | REF: TROPICAL',
  'ITEM 06 | QTD: 01 | DESC: DAMPER PARA CONTROLE DE VAZÃO TAMANHO 900X450mm | REF: TROPICAL',
  'ITEM 07 | QTD: 03 | DESC: DAMPER PARA CONTROLE DE VAZÃO TAMANHO 300X150mm | REF: TROPICAL'
];

function diffusionItems(text) {
  const cad = AIAnalysisService.parseCadMaterialListAndLegend(text);
  return { cad, items: cad.cadItems.map(c => ({ ...c, measurementStatus: 'DOCUMENTADO', unit: 'UN' })) };
}

test('mesma lista em dois PDFs da mesma obra = uma ocorrência (sem soma) e sem conflito', () => {
  const { cad, items } = diffusionItems(table('01-02.pdf', SMART_ROWS) + table('02-02.pdf', SMART_ROWS));
  const q = n => items.filter(i => i.itemNum === n).reduce((a, i) => a + i.quantity, 0);
  assert.equal(q('03'), 55);
  assert.equal(q('04'), 4);
  assert.deepEqual(['05', '06', '07'].map(q), [1, 1, 3]);
  assert.deepEqual(items.filter(i => /damper/i.test(i.name)).map(i => i.dimensions), ['300x450mm', '900x450mm', '300x150mm']);
  assert.equal(detectCrossDocumentConflicts(cad.documentTables).length, 0);
});

test('diferença real entre PDFs → conflito documental com opções de resolução (nada é somado)', () => {
  const altered = SMART_ROWS.map(r => r.replace('ITEM 07 | QTD: 03', 'ITEM 07 | QTD: 04'));
  const { cad } = diffusionItems(table('01-02.pdf', SMART_ROWS) + table('02-02.pdf', altered));
  const conflicts = detectCrossDocumentConflicts(cad.documentTables);
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].item_num, '07');
  assert.deepEqual(conflicts[0].resolution_options.map(o => o.quantity).sort(), [3, 4]);
});

test('damper 300x450 citando o item 07 (300x150) é erro de interpretação da IA, não conflito documental', () => {
  const { cad, items } = diffusionItems(table('01-02.pdf', SMART_ROWS));
  const before = JSON.stringify(items);
  const r = reconcileExtractions({
    requiredItems: items,
    documentTables: cad.documentTables,
    llmMaterials: [{
      name: 'Damper para Controle de Vazão Tamanho 300x450mm', unit: 'UN', quantity: 3,
      sourceFile: '01-02.pdf', sourcePage: 1, evidence: 'Item 07 - Damper para controle de vazão 300x150mm (TROPICAL)'
    }]
  });
  assert.equal(r.documentConflicts.length, 0);
  assert.equal(r.interpretationIssues.length, 1);
  assert.equal(r.interpretationIssues[0].type, 'ERRO_INTERPRETACAO_IA');
  assert.equal(r.interpretationIssues[0].dimension_owner.itemNum, '05');
  assert.equal(r.interpretationIssues[0].cited_item.itemNum, '07');
  assert.equal(JSON.stringify(items), before); // itens documentais intactos
});

test('grelha extraída pelo parser e pelo LLM consolida em uma linha (identidade técnica)', () => {
  const { cad, items } = diffusionItems(table('01-02.pdf', SMART_ROWS));
  const n = items.length;
  const r = reconcileExtractions({
    requiredItems: items,
    documentTables: cad.documentTables,
    llmMaterials: [{ name: 'Grelha de Dupla Deflexão 600x300mm', unit: 'UN', quantity: 55, sourceFile: 'x', sourcePage: 1, evidence: 'Item 03 - 55x GRELHA 600x300mm' }]
  });
  assert.equal(items.length, n);
  assert.equal(r.merged, 1);
  assert.equal(items.find(i => i.itemNum === '03').quantity, 55);
});

test('IA não substitui quantidades de famílias medidas por geometria (MPU/cobre)', () => {
  const items = [];
  const r = reconcileExtractions({
    requiredItems: items,
    documentTables: [],
    llmMaterials: [{ name: 'PAINEL MPU 20MM', unit: 'PÇ', quantity: 160, evidence: 'estimado por área' }],
    geometryOwnedFamilies: ['mpu']
  });
  assert.equal(items.length, 0);
  assert.equal(r.interpretationIssues[0].type, 'IGNORADO_GEOMETRIA_PROPRIA');
});
