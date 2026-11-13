import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchLiveMaterialBase, convertToPurchase, materialFamily } from '../src/services/sabrarEconomicBase.js';
import { createMemoryMaterialDb } from './helpers/memoryDb.js';

// Cadastro sintético (nomes no padrão do cadastro real; preços fictícios de teste)
const catalog = [
  { id: 1, code: 'T-001', name: 'SELADOR ACRÍLICO - LATA 18L', unit: 'lata', reference_price: 210, synonyms: 'tela, pintura, acabamento', category: 'QUÍMICOS' },
  { id: 2, code: 'T-002', name: 'ARAME GALVANIZADO FIO 18 - 1KG - 1,24MM', unit: 'rolo c/ 1kg', reference_price: 14.66, synonyms: 'perfilado arame', category: 'FIXAÇÃO' },
  { id: 3, code: 'T-003', name: 'CAMBOTA DE BORRACHA FECHADA 19MM PARA TUBO DE COBRE 5/8" - PERFILADO', unit: 'und', reference_price: 3.15, category: 'CAMBOTAS' },
  { id: 4, code: 'T-004', name: 'PERFILADO PERFURADO LEVE BAIXO 19X38X3000 #20', unit: 'peça c/ 3 mt', package_content: 3, converted_unit: 'm', reference_price: 26.2, category: 'FIXAÇÃO' },
  { id: 5, code: 'T-005', name: 'TUBO COBRE RÍGIDO (1/32") - 1.1/8" - 0,614kg/m - 28,57mm', unit: 'metro', reference_price: 75.73, category: 'COBRE' },
  { id: 6, code: 'T-006', name: 'TUBO COBRE RÍGIDO (1/16") - 1.1/8" - 1,20kg/m - 28,57mm', unit: 'metro', reference_price: 152.67, category: 'COBRE' },
  { id: 7, code: 'T-007', name: 'TUBO COBRE FLEXÍVEL (1/32") - 3/4" - 0,403kg/m - 19,05mm', unit: 'metro', reference_price: 52.73, category: 'COBRE' },
  { id: 8, code: 'T-008', name: 'FITA ALUMINIO 50MMx50M MPU', unit: 'und', reference_price: 41.41, category: 'MPU E ACESSÓRIOS' },
  { id: 9, code: 'T-009', name: 'GÁS REFRIGERANTE R410A - 11,3KG - FREON', unit: 'botija c/ 11,3kg', package_content: 11.3, converted_unit: 'kg', reference_price: 1442, category: 'GASES' },
  { id: 10, code: 'T-010', name: 'DUTO FLEXÍVEL EM ALUMÍNIO 250MM', unit: 'cx c/ 10m', reference_price: 300, category: 'DUTOS' },
  { id: 11, code: 'T-011', name: 'DUTO FLEXÍVEL ISOLADO 250MM', unit: 'cx c/ 10m', reference_price: 420, category: 'DUTOS' },
  { id: 12, code: 'T-012', name: 'BARRA ROSCADA (TIRANTE) GALVANIZADA -1/4x3MT', unit: 'und', reference_price: 7.81, category: 'FIXAÇÃO' },
  { id: 13, code: 'T-013', name: 'ALONGADOR/PROLONGADOR PARA BARRA ROSCADA (TIRANTE) - 1/4"', unit: 'und', reference_price: 0.61, category: 'FIXAÇÃO' }
];
const db = createMemoryMaterialDb(catalog);

test('tela de retorno não pode virar lata de produto químico (sinônimo não muda a família)', async () => {
  const r = await searchLiveMaterialBase(db, { name: 'TELA METÁLICA PARA DUTO DE RETORNO DE AR', unit: 'un', quantity: 3 });
  assert.equal(r.price_status, 'PENDENTE_COTACAO');
  assert.equal(r.reference_price, null);
  assert.equal(r.name, 'TELA METÁLICA PARA DUTO DE RETORNO DE AR');
  assert.ok(r.rejected_candidates.some(c => c.code === 'T-001'));
});

test('perfilado não pode virar rolo de arame nem cambota "- PERFILADO"', async () => {
  assert.equal(materialFamily('CAMBOTA DE BORRACHA FECHADA 19MM PARA TUBO DE COBRE 5/8" - PERFILADO'), 'cambota');
  const r = await searchLiveMaterialBase(db, { name: 'PERFILADO PERFURADO LEVE', unit: 'm', quantity: 10 });
  assert.equal(r.code, 'T-004');
  assert.equal(r.conversion.purchaseQuantity, 4); // 10 m ÷ 3 m por peça
  const noMatch = await searchLiveMaterialBase(createMemoryMaterialDb(catalog.filter(c => c.id !== 4)), { name: 'PERFILADO PERFURADO LEVE', unit: 'm', quantity: 10 });
  assert.equal(noMatch.price_status, 'PENDENTE_COTACAO');
});

test('cobre: diâmetro, espessura e têmpera obrigatórios', async () => {
  const ok = await searchLiveMaterialBase(db, { name: 'TUBO COBRE RÍGIDO (1/16") - 1.1/8"', unit: 'm', quantity: 12 });
  assert.equal(ok.code, 'T-006');
  const wrongWall = await searchLiveMaterialBase(createMemoryMaterialDb(catalog.filter(c => c.id !== 6)), { name: 'TUBO COBRE RÍGIDO (1/16") - 1.1/8"', unit: 'm', quantity: 12 });
  assert.equal(wrongWall.price_status, 'PENDENTE_COTACAO');
  const wrongTemper = await searchLiveMaterialBase(db, { name: 'TUBO COBRE RÍGIDO (1/32") - 3/4"', unit: 'm', quantity: 5 });
  assert.equal(wrongTemper.price_status, 'PENDENTE_COTACAO'); // só existe 3/4" FLEXÍVEL
});

test('conversões de embalagem: m → rolo de 50 m, kg → botija, m → barra de 3 m', () => {
  assert.equal(convertToPurchase(120, 'm', catalog[7]).purchaseQuantity, 3);
  assert.equal(convertToPurchase(12, 'kg', catalog[8]).purchaseQuantity, 2);
  assert.equal(convertToPurchase(7, 'm', catalog[11]).purchaseQuantity, 3);
  assert.equal(convertToPurchase(5, 'un', catalog[11]).purchaseQuantity, 5);
  assert.equal(convertToPurchase(5, 'm²', catalog[11]), null); // incompatível
});

test('tirante não casa com alongador', async () => {
  const r = await searchLiveMaterialBase(db, { name: 'BARRA ROSCADA (TIRANTE) GALVANIZADA -1/4x3MT', unit: 'un', quantity: 10 });
  assert.equal(r.code, 'T-012');
});

test('ambiguidade entre produtos diferentes: não escolhe nem calcula média — fica pendente com candidatos', async () => {
  const r = await searchLiveMaterialBase(db, { name: 'DUTO FLEXIVEL 250MM', unit: 'm', quantity: 6 });
  assert.equal(r.price_status, 'PENDENTE_COTACAO');
  assert.match(r.failure_reason, /ambígua/);
});

test('sem preço cadastrado: descrição e quantidade preservadas', async () => {
  const dbNoPrice = createMemoryMaterialDb([{ ...catalog[3], reference_price: null }]);
  const r = await searchLiveMaterialBase(dbNoPrice, { name: 'PERFILADO PERFURADO LEVE BAIXO 19X38X3000 #20', unit: 'm', quantity: 9 });
  assert.equal(r.reference_price, null);
  assert.equal(r.price_status, 'PENDENTE_COTACAO');
  assert.equal(r.conversion.purchaseQuantity, 3);
});
