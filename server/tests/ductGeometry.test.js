import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSyntheticDuctPdf } from './helpers/syntheticPdf.js';
import { extractPdfVectorData } from '../src/utils/pdfVectorGeometry.js';
import { measureProjectDucts, hashBuffer } from '../src/services/ductGeometryMeasurement.js';

async function vectorDoc(spec, name) {
  const buf = await buildSyntheticDuctPdf(spec);
  const d = await extractPdfVectorData(buf, name);
  d.hash = hashBuffer(buf);
  return d;
}

const near = (a, b, tol = 0.02) => Math.abs(a - b) <= tol;
const byLabel = (r, label, viewType = 'PLANTA') => r.sections.filter(s => s.label === label && s.viewType === viewType);

test('obra sintética 1:50 — comprimentos medidos na geometria, transição excluída, prumada do corte contada uma vez', async () => {
  const doc = await vectorDoc({
    scale: 50,
    withSection: true,
    ducts: [
      { label: 'I-80x40', x: 1, y: 1, lengthM: 10, widthCm: 80, dir: 'h' },
      { label: 'I-50x40', x: 11.5, y: 1.15, lengthM: 6, widthCm: 50, dir: 'h' },
      { label: 'I-30x30', x: 4, y: 3, lengthM: 3.2, widthCm: 30, dir: 'v' },
      { label: 'I-80x40', x: 1, y: 1, lengthM: 10, widthCm: 40, dir: 'h', view: 'section' },
      { label: 'I-80x40', x: 0.2, y: 1.4, lengthM: 3, widthCm: 80, dir: 'v', view: 'section' }
    ],
    transitions: [{ x: 11, y: 1, lengthM: 0.5, fromWidthCm: 80, toWidthCm: 50 }],
    distractor: { x: 1, y: 5, lengthM: 8, widthCm: 80 },
    extraTexts: [{ text: 'I-80x40', x: 4, y: 4.8 }]
  }, 'obra-b.pdf');
  const r = measureProjectDucts([doc]);

  const plan = r.views.find(v => v.viewType === 'PLANTA');
  assert.equal(plan.scaleStatus, 'VALIDADA');
  assert.equal(plan.declaredScale, '1:50');
  assert.ok(near(plan.impliedScaleMedian, 50, 1));

  assert.ok(near(byLabel(r, 'I-80X40').reduce((a, s) => a + s.lengthM, 0), 10));
  assert.ok(near(byLabel(r, 'I-50X40').reduce((a, s) => a + s.lengthM, 0), 6));
  assert.ok(near(byLabel(r, 'I-30X30').reduce((a, s) => a + s.lengthM, 0), 3.2));

  const risers = r.sections.filter(s => s.orientation === 'PRUMADA_VERTICAL');
  assert.equal(risers.length, 1);
  assert.ok(near(risers[0].lengthM, 3));
  // trecho horizontal do corte repete a planta → excluído
  assert.ok(r.excluded.some(e => e.reason === 'DUPLICIDADE_PLANTA_CORTE'));
  // transição trapezoidal não vira trecho reto
  assert.ok(r.excluded.some(e => e.reason === 'CONEXAO_OU_TRANSICAO'));
  // linhas de arquitetura (outro estilo) com afastamento coincidente não entram
  assert.ok(r.sections.every(s => s.evidence.lineStyle === '0,200,0|0.8'));

  // evidência rastreável por trecho
  for (const s of r.sections) {
    assert.equal(s.sourceFile, 'obra-b.pdf');
    assert.equal(s.sourcePage, 1);
    assert.equal(s.scale, '1:50');
    assert.ok(s.evidence.drawnSpacingPt > 0 && s.evidence.labelText);
  }
  assert.ok(near(r.summary.totalLinearMeters, 10 + 6 + 3.2 + 3, 0.05));
});

test('segunda geometria em 1:100 — totais acompanham o desenho (sem comprimento ou total fixo)', async () => {
  const doc = await vectorDoc({
    scale: 100,
    ducts: [
      { label: 'R-120x60', x: 2, y: 2, lengthM: 7.5, widthCm: 120, dir: 'h' },
      { label: 'R-40x40', x: 3, y: 6, lengthM: 4.2, widthCm: 40, dir: 'v' }
    ]
  }, 'obra-c.pdf');
  const r = measureProjectDucts([doc]);
  assert.equal(r.views[0].scaleStatus, 'VALIDADA');
  assert.ok(near(byLabel(r, 'R-120X60').reduce((a, s) => a + s.lengthM, 0), 7.5));
  assert.ok(near(byLabel(r, 'R-40X40').reduce((a, s) => a + s.lengthM, 0), 4.2));
  assert.ok(r.sections.every(s => s.system === 'Retorno'));
  const expectedArea = 2 * (1.2 + 0.6) * 7.5 + 2 * (0.4 + 0.4) * 4.2;
  assert.ok(near(r.summary.totalNetAreaM2, expectedArea, 0.1));
  assert.notEqual(r.summary.totalLinearMeters, 121.4);
});

test('escala declarada divergente da escala implícita pelos rótulos → não mede (pendente de revisão)', async () => {
  // desenhado em 1:50, mas a prancha declara 1/75
  const doc = await vectorDoc({
    scale: 50,
    declaredScale: 75,
    ducts: [{ label: 'I-80x40', x: 1, y: 1, lengthM: 10, widthCm: 80, dir: 'h' }, { label: 'I-50x40', x: 1, y: 4, lengthM: 5, widthCm: 50, dir: 'h' }]
  }, 'divergente.pdf');
  const r = measureProjectDucts([doc]);
  assert.equal(r.views[0].scaleStatus, 'DIVERGENTE');
  assert.equal(r.sections.length, 0);
});

test('mesmo PDF anexado duas vezes não duplica trechos', async () => {
  const spec = { scale: 50, ducts: [{ label: 'I-60x40', x: 1, y: 1, lengthM: 8, widthCm: 60, dir: 'h' }] };
  const buf = await buildSyntheticDuctPdf(spec); // upload repetido = mesmos bytes
  const a = await extractPdfVectorData(buf, 'prancha.pdf');
  const b = await extractPdfVectorData(buf, 'prancha (1).pdf');
  a.hash = hashBuffer(buf);
  b.hash = hashBuffer(buf);
  const r = measureProjectDucts([a, b]);
  assert.ok(near(r.summary.totalLinearMeters, 8));
});

test('mesma planta em duas pranchas diferentes: conta uma vez e registra a repetição', async () => {
  const ducts = [{ label: 'I-60x40', x: 1, y: 1, lengthM: 8, widthCm: 60, dir: 'h' }];
  const a = await vectorDoc({ scale: 50, ducts }, 'prancha-01.pdf');
  const b = await vectorDoc({ scale: 50, ducts, extraTexts: [{ text: 'REVISÃO DE LAYOUT', x: 20, y: 9 }] }, 'prancha-02.pdf');
  const r = measureProjectDucts([a, b]);
  assert.ok(near(r.summary.totalLinearMeters, 8));
  assert.ok(r.excluded.some(e => e.reason === 'PLANTA_REPETIDA_EM_OUTRA_PRANCHA'));
});
