import { normalizeUnit, areUnitsCompatible } from '../src/utils/unitConversion.js';
import { searchLiveMaterialBase } from '../src/services/sabrarEconomicBase.js';
import db from '../src/db/connection.js';

async function testGenericRules() {
  console.log('===================================================================');
  console.log('TESTES GENÉRICOS DE REGRAS DE ORÇAMENTO (NÃO ESPECÍFICAS DO SMART)');
  console.log('===================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  // 1. TESTES DE NORMALIZAÇÃO E COMPATIBILIDADE DE UNIDADES
  console.log('--- 1. Normalização e Compatibilidade de Unidades ---');
  assert(normalizeUnit('unidade') === 'UN', 'Normaliza "unidade" -> "UN"');
  assert(normalizeUnit('pç') === 'UN', 'Normaliza "pç" -> "UN"');
  assert(normalizeUnit('und') === 'UN', 'Normaliza "und" -> "UN"');
  assert(normalizeUnit('metros') === 'M', 'Normaliza "metros" -> "M"');
  assert(normalizeUnit('m2') === 'M²', 'Normaliza "m2" -> "M²"');
  assert(normalizeUnit('diária') === 'DIARIA', 'Normaliza "diária" -> "DIARIA"');
  assert(normalizeUnit('vb') === 'VB', 'Normaliza "vb" -> "VB"');

  assert(areUnitsCompatible('un', 'UNIDADE') === true, 'UN e UNIDADE são compatíveis');
  assert(areUnitsCompatible('m', 'METROS') === true, 'M e METROS são compatíveis');
  assert(areUnitsCompatible('un', 'm') === false, 'UN e M são incompatíveis');
  assert(areUnitsCompatible('m²', 'kg') === false, 'M² e KG são incompatíveis');

  // 2. TESTE DE BUSCA NA BASE VIVA DE MATERIAIS
  console.log('\n--- 2. Pesquisa de Candidatos na Base Viva de Materiais ---');
  // Teste A: Busca de chapa MPU existente
  const mpuCandidate = await searchLiveMaterialBase(db, {
    name: 'Painel MPU Pir 20mm',
    unit: 'UN'
  });
  assert(mpuCandidate && (mpuCandidate.id !== null || mpuCandidate.code !== null), 'Encontra painel MPU cadastrado na base viva');
  assert(mpuCandidate && (Number(mpuCandidate.reference_price) > 0 || Number(mpuCandidate.base_cost) > 0), `Preço retornado do cadastro: R$ ${mpuCandidate?.reference_price || mpuCandidate?.base_cost}`);

  // Teste B: Rejeição de família incompatível
  // Se pesquisamos um damper, o sistema NUNCA deve associar a uma grelha
  const damperCandidate = await searchLiveMaterialBase(db, {
    name: 'Damper de Gravidade 300x150mm',
    unit: 'UN'
  });
  if (damperCandidate?.name) {
    const isGrelha = damperCandidate.name.toLowerCase().includes('grelha');
    assert(!isGrelha, 'Rejeita materiais de famílias incompatíveis (Damper não deve virar Grelha)');
  }
  assert(damperCandidate?.classification === 'PRECO_PENDENTE' || damperCandidate?.price_status === 'PENDENTE_COTACAO', 'Sem correspondência com preço, marca como PRECO_PENDENTE');

  // Teste C: Item sem correspondência segura preserva preço pendente
  const unknownItem = await searchLiveMaterialBase(db, {
    name: 'Difusor Linear Especial XYZ 123 456mm',
    unit: 'UN'
  });
  assert(unknownItem.classification === 'PRECO_PENDENTE', 'Item desconhecido preserva PRECO_PENDENTE para cotação humana');
  assert(unknownItem.price_status === 'PENDENTE_COTACAO', 'Status de preço definido como PENDENTE_COTACAO');

  // 3. TESTE DE CÁLCULO DE SUBTOTAL PARCIAL GENÉRICO
  console.log('\n--- 3. Lógica de Subtotal Parcial e Segregação ---');
  const sampleItems = [
    { name: 'Condensadora 1', classification: 'CONFIRMADO', subtotal: 1000 },
    { name: 'Condensadora 2', classification: 'CONFIRMADO', subtotal: 1500 },
    { name: 'Duto MPU', classification: 'QUANTIDADE_PENDENTE', subtotal: 0 },
    { name: 'Grelha 1', classification: 'PRECO_PENDENTE', subtotal: 0 },
    { name: 'Damper Conflitante', classification: 'CONFLITO_DOCUMENTAL', subtotal: 0 },
    { name: 'Split Cliente', classification: 'FORNECIMENTO_CLIENTE', subtotal: 0 },
  ];

  const confirmedSum = sampleItems
    .filter(i => i.classification === 'CONFIRMADO')
    .reduce((sum, i) => sum + i.subtotal, 0);

  const hasPendencies = sampleItems.some(i => i.classification !== 'CONFIRMADO');

  assert(confirmedSum === 2500, 'Subtotal parcial soma apenas itens CONFIRMADO (R$ 2.500,00)');
  assert(hasPendencies === true, 'Detecta pendências técnicas no orçamento');

  console.log('\n===================================================================');
  console.log(`TOTAL DE TESTES GENÉRICOS: ${passed} PASSOU, ${failed} FALHOU`);
  console.log('===================================================================\n');

  if (failed > 0) process.exit(1);
}

testGenericRules().catch(err => {
  console.error('Erro nos testes genéricos:', err);
  process.exit(1);
});
