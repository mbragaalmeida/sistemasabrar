/**
 * Conferência do SMART (projeto 142) em ambiente isolado.
 * Requer SMART_FIXTURE_DIR com os PDFs (p142_*.pdf) e uma cópia somente leitura do cadastro
 * (materials.json / aliases.json). Nada é gravado: dryRun + banco de materiais em memória.
 * Os números de difusão abaixo são apenas o RESULTADO ESPERADO da conferência; o código não os usa.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { AIAnalysisService } from '../src/services/aiService.js';
import { createMemoryMaterialDb } from './helpers/memoryDb.js';

const dir = process.env.SMART_FIXTURE_DIR;
const available = dir && fs.existsSync(dir) && fs.readdirSync(dir).some(f => /^p142_.*\.pdf$/.test(f));

test('SMART: difusão preservada, dutos medidos com escala validada, sem gravação', { skip: !available && 'SMART_FIXTURE_DIR não definido' }, async () => {
  const files = fs.readdirSync(dir).filter(f => /^p142_.*\.pdf$/.test(f)).map((f, i) => ({
    id: i + 1, original_name: f.replace(/^p142_\d+_/, ''), mime_type: 'application/pdf', file_data: fs.readFileSync(path.join(dir, f))
  }));
  const materials = fs.existsSync(path.join(dir, 'materials.json')) ? JSON.parse(fs.readFileSync(path.join(dir, 'materials.json'))) : [];
  const aliases = fs.existsSync(path.join(dir, 'aliases.json')) ? JSON.parse(fs.readFileSync(path.join(dir, 'aliases.json'))) : [];

  const r = await AIAnalysisService.analyzeProjectDocuments(142, {
    mockProject: { id: 142, name: 'smart super teste 4', project_type: 'Climatização' },
    mockFiles: files,
    skipLLM: true,
    dryRun: true,
    skipHistory: true,
    materialDb: createMemoryMaterialDb(materials, aliases),
    mockLLMResponse: {
      materials: [{ name: 'Damper para Controle de Vazão Tamanho 300x450mm', unit: 'UN', quantity: 3, sourceFile: 'x', sourcePage: 1, evidence: 'Item 07 - Damper para controle de vazão 300x150mm (TROPICAL)' }],
      equipment: [],
      duct_segments: [{ width_cm: 60, height_cm: 45, length_m: 121.4 }]
    }
  });

  assert.equal(r.analysisId, null);
  const mats = r.budget.materials;
  const qty = re => mats.filter(m => re.test(m.material_name)).reduce((a, m) => a + Number(m.technical_quantity), 0);
  assert.equal(qty(/grelha/i), 55);
  assert.equal(qty(/difusor/i), 4);
  assert.equal(qty(/damper.*300x450/i), 1);
  assert.equal(qty(/damper.*900x450/i), 1);
  assert.equal(qty(/damper.*300x150/i), 3);
  assert.equal(r.budget.document_conflicts.length, 0);
  assert.ok(r.budget.interpretation_issues.some(i => i.type === 'ERRO_INTERPRETACAO_IA'));

  const g = r.validated_geometry;
  assert.equal(g.ductSource, 'GEOMETRIA_VETORIAL'); // comprimento da IA (121,4 m) ignorado
  assert.ok(g.ductViews.find(v => /PLANTA BAIXA/.test(v.name)).scaleStatus === 'VALIDADA');
  assert.ok(g.ductLinearMeters > 0 && g.ductLinearMeters !== 121.4);

  // Circuitos distintos (não replica o primeiro comprimento)
  const runs = g.refrigerantCircuits.map(c => c.forecastRunM ?? c.measuredRunM);
  assert.equal(runs.length, 3);
  assert.ok(new Set(runs).size > 1);

  // Falta de preço nunca zera quantidade técnica
  for (const m of mats.filter(m => m.price_status === 'PENDENTE_COTACAO' && !m.is_pending_measurement)) {
    assert.ok(m.technical_quantity > 0, m.material_name);
    assert.equal(m.unit_price, null);
  }
});
