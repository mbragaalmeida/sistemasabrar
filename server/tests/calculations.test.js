import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveCoefficients,
  computeSectionGeometry,
  calculateMPUDuctPanels,
  calculateMPUSupplies,
  calculateDuctSupports,
  calculateRefrigerantTakeoff
} from '../src/utils/hvacCalculations.js';
import { buildDuctItems, buildRefrigerantItems, resolveDuctSections } from '../src/services/hvacTakeoff.js';

const sections = [
  { id: 1, system: 'Insuflamento', widthCm: 60, heightCm: 45, lengthM: 6, measurementStatus: 'MEDIDO' },
  { id: 2, system: 'Insuflamento', widthCm: 35, heightCm: 45, lengthM: 4, measurementStatus: 'MEDIDO' }
];

test('área líquida = Σ perímetro × comprimento por trecho (sem perdas)', () => {
  const g = computeSectionGeometry(sections);
  assert.equal(g.totalLinearM, 10);
  assert.equal(g.totalNetAreaM2, Number((2.1 * 6 + 1.6 * 4).toFixed(2)));
});

test('painéis MPU: perda aplicada uma única vez; 1,40 de isolamento TDC não é usado; caixas separadas de peças', () => {
  const coefs = resolveCoefficients({ mpuPanelLossFactor: { value: 1.2, validated: true } });
  const p = calculateMPUDuctPanels(19, { coefficients: coefs, packagingMode: 'CAIXA_FECHADA_10' });
  assert.equal(p.lossFactor, 1.2);
  assert.equal(p.internal.purchaseAreaSqm, 22.8);
  assert.equal(p.internal.requiredPieces, Math.ceil(22.8 / 2.4)); // 10
  assert.equal(p.internal.boxes, 1);
  assert.equal(p.internal.commercialPieces, 10);
  const avulso = calculateMPUDuctPanels(19, { coefficients: coefs, packagingMode: 'AVULSO' });
  assert.equal(avulso.internal.commercialPieces, 10);
  const p2 = calculateMPUDuctPanels(25, { coefficients: coefs, packagingMode: 'CAIXA_FECHADA_10' });
  assert.equal(p2.internal.requiredPieces, 13);
  assert.equal(p2.internal.commercialPieces, 20);
});

test('área externa aceita os dois nomes históricos do parâmetro', () => {
  const coefs = resolveCoefficients();
  const a = calculateMPUDuctPanels(50, { coefficients: coefs, externalAreaSqm: 10 });
  const b = calculateMPUDuctPanels(50, { coefficients: coefs, externalAreaMeasured: 10 });
  assert.deepEqual(a.external, b.external);
  assert.equal(a.internal.netAreaSqm, 40);
});

test('insumos MPU por trecho: juntas por trecho, perfil = perímetro × juntas (sem perda dupla)', () => {
  const coefs = resolveCoefficients();
  const s = calculateMPUSupplies(sections, coefs);
  // trecho 1: ceil(6/1.2)=5 juntas, trecho 2: ceil(4/1.2)=4 juntas
  assert.equal(s.joints, 9);
  assert.equal(s.profileMeters, Number(((2.1 * 5 + 1.6 * 4) * 1.15).toFixed(2)));
  assert.equal(s.cornerPieces, 36);
  assert.equal(s.glueUnits, Math.ceil(19 / 20));
});

test('suportação: 1 suporte a cada 1,50 m por trecho, perfilado = largura de cada trecho + 0,10 m', () => {
  const s = calculateDuctSupports(sections, resolveCoefficients());
  assert.equal(s.numSupports, 4 + 3);
  assert.equal(s.perfiladoMeters, Number((4 * 0.7 + 3 * 0.45).toFixed(2)));
  assert.equal(s.rods, 14);
  assert.equal(s.anchors, 14);
  assert.equal(s.nuts, 28);
  assert.equal(s.washers, 28);
});

test('cobre: cada circuito com seu percurso; 25% de perda uma vez; isolamento 1:1', () => {
  const t = calculateRefrigerantTakeoff([
    { circuit: 1, runM: 4 },
    { circuit: 2, runM: 9 },
    { circuit: 3, runM: 2.5 }
  ], resolveCoefficients());
  assert.deepEqual(t.rows.map(r => r.liquidLineM), [5, 11.25, 3.13]);
  assert.equal(t.liquidLineM, 19.38);
  assert.equal(t.liquidInsulationM, t.liquidLineM);
  assert.equal(t.totalRunM, 15.5);
});

test('itens de duto: quantidades derivadas de coeficiente não validado são PREVISAO com premissa visível', () => {
  const { items } = buildDuctItems({ sections, isMPU: true, coefficients: resolveCoefficients() });
  const panel = items.find(i => /PAINEL MPU 20MM/.test(i.name));
  assert.equal(panel.measurementStatus, 'PREVISAO');
  assert.ok(panel.premises.some(p => /mpuPanelLossFactor.*NÃO VALIDADO/.test(p)));
  const perfilado = items.find(i => /PERFILADO/.test(i.name));
  assert.equal(perfilado.measurementStatus, 'CALCULADO');
  assert.equal(perfilado.unit, 'm');
  // com coeficiente validado pela empresa o painel passa a CALCULADO
  const validated = buildDuctItems({ sections, isMPU: true, coefficients: resolveCoefficients({ mpuPanelLossFactor: { value: 1.2, validated: true } }) });
  assert.equal(validated.items.find(i => /PAINEL MPU 20MM/.test(i.name)).measurementStatus, 'CALCULADO');
});

test('comprimento devolvido pela IA nunca vira MEDIDO; geometria medida tem prioridade', () => {
  const llm = [{ widthCm: 60, heightCm: 45, lengthM: 121.4, evidence: 'IA' }];
  const onlyLLM = resolveDuctSections({ llmSegments: llm });
  assert.equal(onlyLLM.source, 'DECLARACAO_IA');
  assert.equal(onlyLLM.sections[0].measurementStatus, 'PREVISAO');
  const { items } = buildDuctItems({ sections: onlyLLM.sections, isMPU: true });
  assert.ok(items.every(i => i.measurementStatus !== 'CALCULADO'));
  const withGeo = resolveDuctSections({ measuredSections: sections, llmSegments: llm });
  assert.equal(withGeo.source, 'GEOMETRIA_VETORIAL');
});

test('diâmetros do projeto prevalecem sobre a seleção por capacidade', () => {
  const machines = [{ type: 'UNIDADE EVAPORADORA', tr: 20, qty: 1 }, { type: 'CONDENSADORA', qty: 1 }];
  const circuits = [{ circuit: 1, measuredRunM: 8, measurementStatus: 'MEDIDO' }];
  const doc = buildRefrigerantItems({ circuits, machines, documentedSpec: { liquid: '1/2"', suction: '7/8"', liquidWall: '1/32"', suctionWall: '1/16"', liquidTemper: 'FLEXÍVEL', suctionTemper: 'RÍGIDO' } });
  assert.ok(doc.items.some(i => i.name.includes('7/8"')));
  assert.ok(!doc.items.some(i => i.name.includes('1.1/8"')));
  const byCap = buildRefrigerantItems({ circuits, machines });
  const suction = byCap.items.find(i => i.lineFunction === 'suction' && /TUBO/.test(i.name));
  assert.equal(suction.measurementStatus, 'PREVISAO');
  assert.ok(suction.premises.some(p => /confirmar no manual do fabricante/.test(p)));
});
