/**
 * LEVANTAMENTO TÉCNICO HVAC (MODO A) A PARTIR DE UMA ÚNICA BASE DE TRECHOS E CIRCUITOS
 *
 * Entrada: trechos de duto (medidos/revisados), circuitos frigorígenos, máquinas documentadas e
 * coeficientes empresariais. Saída: itens técnicos (quantidade física + unidade física + status +
 * premissas + origem) e serviços. Preços NÃO são definidos aqui.
 *
 * Status:
 *   DOCUMENTADO  – quantidade lida no projeto (tabela/lista/cota);
 *   MEDIDO       – medida na geometria do desenho com escala validada (ou revisada manualmente);
 *   CALCULADO    – derivada de MEDIDO/DOCUMENTADO por regra empresarial validada;
 *   PREVISAO     – depende de coeficiente não validado ou de percurso não desenhado;
 *   PENDENTE     – sem base para quantificar (quantidade preservada como nula/zero, com motivo).
 */
import {
  resolveCoefficients,
  premisesFor,
  computeSectionGeometry,
  calculateMPUDuctPanels,
  calculateMPUSupplies,
  calculateDuctTDCSupplies,
  calculateDuctSupports,
  calculateRefrigerantTakeoff,
  determineDuctGauge,
  calculateDuctKg,
  calculateDuctInsulation
} from '../utils/hvacCalculations.js';
import { findServiceTariff } from './sabrarEconomicBase.js';

export const STATUS = Object.freeze({
  DOCUMENTADO: 'DOCUMENTADO',
  MEDIDO: 'MEDIDO',
  CALCULADO: 'CALCULADO',
  PREVISAO: 'PREVISAO',
  PENDENTE: 'PENDENTE_MEDICAO'
});

const MEASURED_SECTION_STATUSES = new Set(['MEDIDO', 'MEDIDO_REVISADO', 'DOCUMENTADO']);

/** Status de um item derivado: herda a pior base e cai para PREVISAO se algum coeficiente não é validado. */
function derivedStatus(baseStatus, allValidated) {
  if (baseStatus === STATUS.PENDENTE) return STATUS.PENDENTE;
  if (baseStatus === STATUS.PREVISAO || !allValidated) return STATUS.PREVISAO;
  return STATUS.CALCULADO;
}

// Seleção de diâmetros quando o projeto NÃO informa (sempre PREVISAO; confirmar no manual do fabricante)
function capacityBasedCopperSpec(tr) {
  if (!tr) return null;
  if (tr < 3) return { liquid: '3/8"', suction: '5/8"', liquidWall: '1/32"', suctionWall: '1/32"', liquidTemper: 'FLEXÍVEL', suctionTemper: 'FLEXÍVEL' };
  if (tr <= 12) return { liquid: '1/2"', suction: '7/8"', liquidWall: '1/32"', suctionWall: '1/16"', liquidTemper: 'FLEXÍVEL', suctionTemper: 'RÍGIDO' };
  return { liquid: '5/8"', suction: '1.1/8"', liquidWall: '1/32"', suctionWall: '1/16"', liquidTemper: 'FLEXÍVEL', suctionTemper: 'RÍGIDO' };
}

const ARMAFLEX_BY_DIAMETER = {
  '1/4"': 'M006', '3/8"': 'M010', '1/2"': 'M012', '5/8"': 'M015', '3/4"': 'M018',
  '7/8"': 'M022', '1"': 'M025', '1.1/8"': 'M028', '1.3/8"': 'M035', '1.5/8"': 'M042'
};
const ARMAFIX_BY_DIAMETER = {
  '1/4"': '006/010', '3/8"': '006/010', '1/2"': '012/015', '5/8"': '012/015', '3/4"': '018/022',
  '7/8"': '018/022', '1.1/8"': '025/028', '1.3/8"': '032/035', '1.5/8"': '040/042'
};

const copperName = (diam, wall, temper) => `TUBO COBRE ${temper === 'RÍGIDO' ? 'RÍGIDO' : 'FLEXÍVEL'} (${wall}) - ${diam}`;

/**
 * Define a base de trechos: revisão manual > geometria medida > cotas textuais > declarações do LLM.
 */
export function resolveDuctSections({ reviewedSections, measuredSections, textSegments = [], llmSegments = [] }) {
  if (Array.isArray(reviewedSections) && reviewedSections.length > 0) {
    return {
      source: 'REVISAO_MANUAL',
      sections: reviewedSections.map((s, i) => ({ id: s.id || i + 1, ...s, measurementStatus: s.measurementStatus || 'MEDIDO_REVISADO' }))
    };
  }
  if (Array.isArray(measuredSections) && measuredSections.length > 0) {
    return { source: 'GEOMETRIA_VETORIAL', sections: measuredSections };
  }
  const cotadas = textSegments.filter(s => s.lengthM > 0 && s.measurementStatus === 'MEDIDO');
  if (cotadas.length > 0) {
    return {
      source: 'COTA_TEXTUAL',
      sections: cotadas.map((s, i) => ({ id: i + 1, system: s.system, label: s.evidence, widthCm: s.widthCm, heightCm: s.heightCm, lengthM: s.lengthM, sourceFile: s.sourceFile, sourcePage: s.sourcePage, measurementStatus: 'DOCUMENTADO', evidence: { method: 'COTA_TEXTUAL', text: s.evidence } }))
    };
  }
  const llm = llmSegments.filter(s => s.lengthM > 0);
  if (llm.length > 0) {
    // Comprimento devolvido pelo LLM sem corroboração geométrica: PREVISAO (nunca MEDIDO)
    return {
      source: 'DECLARACAO_IA',
      sections: llm.map((s, i) => ({ id: i + 1, system: s.type || 'Insuflamento', label: `${s.widthCm}x${s.heightCm}`, widthCm: s.widthCm, heightCm: s.heightCm, lengthM: s.lengthM * (s.qty || 1), sourceFile: s.sourceFile, sourcePage: s.sourcePage, measurementStatus: 'PREVISAO', evidence: { method: 'DECLARACAO_LLM', text: s.evidence } }))
    };
  }
  return { source: 'NENHUMA', sections: [] };
}

/**
 * Gera itens técnicos de dutos (MPU ou TDC), acessórios e suportação.
 */
export function buildDuctItems({ sections, isMPU, isBlackSteel = false, hasExternalNote = false, externalAreaSqm = null, coefficients, packagingMode }) {
  const coefs = coefficients || resolveCoefficients();
  const items = [];
  const pending = [];
  const geo = computeSectionGeometry(sections);
  const allMeasured = geo.rows.length > 0 && geo.rows.every(r => MEASURED_SECTION_STATUSES.has(r.measurementStatus));
  const baseStatus = geo.rows.length === 0 ? STATUS.PENDENTE : (allMeasured ? STATUS.MEDIDO : STATUS.PREVISAO);
  const sectionRefs = geo.rows.map(r => r.id);
  const geometryNote = `${geo.rows.length} trecho(s), ${geo.totalLinearM} m lineares, área líquida ${geo.totalNetAreaM2} m²`;

  if (geo.rows.length === 0) {
    pending.push({ item: 'Rede de dutos', reason: 'PENDENTE_MEDICAO', details: 'Nenhum trecho de duto medido (geometria/escala não validadas ou ausentes). Use a revisão de geometria para informar os trechos.' });
  }

  const push = (def, keys, extraStatus = null) => {
    const { premises, allValidated } = premisesFor(coefs, keys);
    const status = extraStatus || derivedStatus(baseStatus, allValidated);
    items.push({
      ...def,
      measurementStatus: status,
      premises,
      origin: `Geometria de dutos (${geometryNote})`,
      sourceSectionIds: sectionRefs,
      defaultPrice: null
    });
  };

  if (isMPU) {
    const panels = calculateMPUDuctPanels(geo.totalNetAreaM2, { coefficients: coefs, externalAreaSqm, hasExternalDeckNote: hasExternalNote, packagingMode });
    push({
      name: 'PAINEL MPU 20MM x 2,0 x 1,2M (2,4m²)',
      category: 'ISOLAMENTO',
      unit: 'PÇ',
      quantity: panels.internal.commercialPieces,
      technicalCalculation: { ...panels.internal, lossFactor: panels.lossFactor, panelAreaSqm: panels.panelAreaSqm, packagingMode: panels.packagingMode },
      reason: `Área líquida ${panels.internal.netAreaSqm} m² × perda ${panels.lossFactor} = ${panels.internal.purchaseAreaSqm} m² de compra ÷ ${panels.panelAreaSqm} m²/painel = ${panels.internal.requiredPieces} painéis${panels.packagingMode !== 'AVULSO' ? ` (${panels.internal.boxes} caixas)` : ''}`
    }, ['mpuPanelLossFactor', 'mpuPanelAreaM2', ...(panels.packagingMode !== 'AVULSO' ? ['mpuPanelsPerBox'] : [])]);

    if (hasExternalNote) {
      const hasExt = panels.external.netAreaSqm > 0;
      push({
        name: 'PAINEL MPU 30MM x 2,0 x 1,2M (2,4m²)',
        category: 'ISOLAMENTO',
        unit: 'PÇ',
        quantity: hasExt ? panels.external.commercialPieces : 0,
        technicalCalculation: panels.external,
        reason: hasExt
          ? `Trecho externo informado: ${panels.external.netAreaSqm} m² líquidos × ${panels.lossFactor} = ${panels.external.requiredPieces} painéis`
          : 'Legenda especifica MPU 30 mm em área externa, mas o trecho externo não está delimitado na prancha: informar área externa na revisão.'
      }, ['mpuPanelLossFactor', 'mpuPanelAreaM2'], hasExt ? null : STATUS.PENDENTE);
      if (!hasExt) pending.push({ item: 'PAINEL MPU 30MM (trecho externo)', reason: 'LOCALIZACAO_TRECHO_EXTERNO_PENDENTE', details: 'Delimitar trecho externo na revisão de geometria.' });
    }

    const sup = calculateMPUSupplies(geo.rows, coefs);
    push({ name: 'PERFIL DE CONEXÃO ALUMINIO PARA PAINEL DE MPU 20MM BARRA C/ 3MTS', category: 'MPU E ACESSÓRIOS', unit: 'm', quantity: sup.profileMeters, technicalCalculation: { joints: sup.joints, profileMeters: sup.profileMeters }, reason: `${sup.joints} juntas transversais × perímetro de cada trecho × margem = ${sup.profileMeters} m de perfil` }, ['mpuJointSpacingM', 'mpuProfileWasteFactor']);
    push({ name: 'CANTO DE REFORÇO PARA MPU - 20MM', category: 'MPU E ACESSÓRIOS', unit: 'un', quantity: sup.cornerPieces, technicalCalculation: { joints: sup.joints }, reason: `${sup.joints} juntas × cantos por junta = ${sup.cornerPieces} un` }, ['mpuJointSpacingM', 'mpuCornersPerJoint']);
    push({ name: 'FITA ALUMINIO 50MMx50M MPU', category: 'MPU E ACESSÓRIOS', unit: 'm', quantity: sup.tapeMeters, technicalCalculation: { tapeMeters: sup.tapeMeters }, reason: `Arestas longitudinais (4 × comprimento) + juntas (perímetro) × margem = ${sup.tapeMeters} m de fita` }, ['mpuJointSpacingM', 'mpuTapeWasteFactor']);
    push({ name: 'COLA ADESIVA PARA PERFIL DE MPU', category: 'MPU E ACESSÓRIOS', unit: 'un', quantity: sup.glueUnits, reason: `${sup.netAreaM2} m² líquidos ÷ m² por unidade = ${sup.glueUnits} un` }, ['mpuGlueM2PerUnit']);
    push({ name: 'SELANTE PARA DUTOS MPU', category: 'MPU E ACESSÓRIOS', unit: 'un', quantity: sup.sealantUnits, reason: `${sup.netAreaM2} m² líquidos ÷ m² por unidade = ${sup.sealantUnits} un` }, ['mpuSealantM2PerUnit']);
  } else if (geo.rows.length > 0) {
    // TDC / chapa: kg por bitola (cada trecho com sua bitola), isolamento conforme OP
    const byGauge = new Map();
    for (const r of geo.rows) {
      const gauge = determineDuctGauge(r.widthCm, r.heightCm, isBlackSteel, r.system === 'Pressurização');
      if (!byGauge.has(gauge)) byGauge.set(gauge, { area: 0, len: 0 });
      const g = byGauge.get(gauge);
      g.area += r.netAreaM2;
      g.len += Number(r.lengthM);
    }
    for (const [gauge, g] of byGauge.entries()) {
      const kg = calculateDuctKg(g.area, gauge);
      push({
        name: isBlackSteel ? 'Chapa Preta #16 - Dutos soldados' : `Chapa Galvanizada ${gauge} - Dutos TDC`,
        category: 'Dutos',
        unit: 'KG',
        quantity: kg,
        technicalCalculation: { gauge, netAreaM2: Number(g.area.toFixed(2)), linearM: Number(g.len.toFixed(2)), kg },
        reason: `${g.area.toFixed(2)} m² × fator da bitola ${gauge} × perda = ${kg} kg`
      }, ['sheetLossFactor']);
    }
    const insulated = geo.rows.filter(r => r.system !== 'Retorno');
    const insArea = insulated.reduce((a, r) => a + r.netAreaM2, 0);
    if (insArea > 0) {
      push({ name: 'Isolamento de dutos TDC (manta)', category: 'Isolamento', unit: 'm²', quantity: calculateDuctInsulation(insArea), reason: `${insArea.toFixed(2)} m² × fator de isolamento` }, ['tdcInsulationFactor']);
    }
    const tdc = calculateDuctTDCSupplies(geo.rows, coefs);
    push({ name: 'CANTO PARA DUTO TDC', category: 'TDC E ACESSÓRIOS', unit: 'un', quantity: tdc.corners, reason: `${tdc.joints} juntas × cantos/junta + 15%` }, ['tdcPieceLengthM', 'tdcCornersPerJoint', 'tdcWasteFactor']);
    push({ name: 'SILICONE PARA DUTO TDC', category: 'TDC E ACESSÓRIOS', unit: 'un', quantity: tdc.siliconeUnits, reason: `${tdc.joints} juntas ÷ 3 + 15%` }, ['tdcPieceLengthM', 'tdcWasteFactor']);
    push({ name: 'FITA DE VEDACAO AUTOADESIVA DO TIPO TDC (ROLO C/10 METROS)', category: 'TDC E ACESSÓRIOS', unit: 'm', quantity: tdc.tapeMeters, reason: `Perímetro das juntas + 15% = ${tdc.tapeMeters} m` }, ['tdcPieceLengthM', 'tdcWasteFactor']);
  }

  if (geo.rows.length > 0) {
    const s = calculateDuctSupports(geo.rows, coefs);
    const base = `${s.numSupports} suportes (1 a cada ${coefs.supportSpacingM.value} m por trecho)`;
    push({ name: 'PERFILADO PERFURADO LEVE BAIXO 19X38X3000 #20', category: 'Fixação e Suportação', unit: 'm', quantity: s.perfiladoMeters, technicalCalculation: s, reason: `${base}; perfilado = largura de cada trecho + ${coefs.perfiladoExtraWidthM.value} m → ${s.perfiladoMeters} m` }, ['supportSpacingM', 'perfiladoExtraWidthM']);
    push({ name: 'BARRA ROSCADA (TIRANTE) GALVANIZADA -1/4x3MT', category: 'Fixação e Suportação', unit: 'un', quantity: s.rodBars, reason: `${base} × ${coefs.rodsPerSupport.value} tirantes = ${s.rods} tirantes (barras de 3 m)` }, ['supportSpacingM', 'rodsPerSupport', 'rodBarsPerRod']);
    push({ name: 'CHUMBADOR (JAQUETA + CONE) - 1/4', category: 'Fixação e Suportação', unit: 'un', quantity: s.anchors, reason: `${base} × ${coefs.anchorsPerSupport.value}` }, ['supportSpacingM', 'anchorsPerSupport']);
    push({ name: 'PORCA SEXTAVADA UNC ZB 1/4"', category: 'Fixação e Suportação', unit: 'un', quantity: s.nuts, reason: `${base} × ${coefs.nutsPerSupport.value}` }, ['supportSpacingM', 'nutsPerSupport']);
    push({ name: 'ARRUELA LISA ZINCADA -1/4', category: 'Fixação e Suportação', unit: 'un', quantity: s.washers, reason: `${base} × ${coefs.washersPerSupport.value}` }, ['supportSpacingM', 'washersPerSupport']);
  }

  return { items, pending, geometry: geo, baseStatus };
}

/**
 * Itens frigorígenos por circuito (diâmetros do projeto quando informados; senão previsão por capacidade).
 */
export function buildRefrigerantItems({ circuits = [], machines = [], documentedSpec = null, reviewedRuns = null, coefficients }) {
  const coefs = coefficients || resolveCoefficients();
  const items = [];
  const pending = [];
  const evaps = machines.filter(m => !/CONDENSADORA/i.test(m.type));
  const numSystems = evaps.reduce((a, m) => a + (m.qty || 1), 0) || machines.filter(m => /CONDENSADORA/i.test(m.type)).reduce((a, m) => a + (m.qty || 1), 0);
  if (numSystems === 0) return { items, pending, circuits: [] };

  // Circuitos: revisão manual > medição/previsão geométrica > pendente
  let runRows;
  if (Array.isArray(reviewedRuns) && reviewedRuns.length > 0) {
    runRows = reviewedRuns.map((r, i) => ({ circuit: r.circuit || i + 1, runM: Number(r.runM) || 0, status: 'MEDIDO', evidence: r.evidence || 'Revisão manual' }));
  } else if (circuits.length > 0) {
    runRows = circuits.map(c => ({
      circuit: c.circuit,
      runM: c.measuredRunM ?? c.forecastRunM ?? 0,
      status: c.measurementStatus === 'MEDIDO' ? 'MEDIDO' : 'PREVISAO',
      evidence: `${c.evaporatorTag} ↔ ${c.condenserTag} (${c.sourceFile} p.${c.sourcePage}, ${c.scale}): ${c.premise}`
    }));
  } else {
    runRows = [];
  }
  if (runRows.length === 0) {
    pending.push({ item: 'Rede frigorígena', reason: 'PENDENTE_MEDICAO', details: `${numSystems} sistema(s) sem percurso medido ou localizável entre equipamentos.` });
  } else if (runRows.length < numSystems) {
    pending.push({ item: 'Rede frigorígena', reason: 'PENDENTE_MEDICAO', details: `${numSystems - runRows.length} circuito(s) sem percurso localizado.` });
  }

  const tk = calculateRefrigerantTakeoff(runRows, coefs);
  const runStatus = runRows.length === 0 ? STATUS.PENDENTE : (runRows.every(r => r.status === 'MEDIDO') ? STATUS.MEDIDO : STATUS.PREVISAO);
  const maxTr = Math.max(0, ...evaps.map(m => m.tr || 0));
  const spec = documentedSpec || capacityBasedCopperSpec(maxTr);
  const specFromProject = Boolean(documentedSpec);
  const circuitNote = tk.rows.map(r => `C${r.circuit}: ${r.runM} m (${r.status})`).join('; ');

  if (!spec) {
    pending.push({ item: 'Diâmetros da rede frigorígena', reason: 'PENDENTE_ESPECIFICACAO', details: 'Projeto não informa diâmetros e a capacidade das máquinas não foi identificada.' });
    return { items, pending, circuits: tk.rows };
  }

  const specPremise = specFromProject
    ? 'Diâmetros/espessuras conforme especificação documental do projeto.'
    : `Projeto não informa diâmetros: seleção preliminar por capacidade (${maxTr} TR); confirmar no manual do fabricante.`;
  const mk = (def, keys, specDependent = true) => {
    const { premises, allValidated } = premisesFor(coefs, keys);
    let status = derivedStatus(runStatus, allValidated);
    if (specDependent && !specFromProject && status !== STATUS.PENDENTE) status = STATUS.PREVISAO;
    items.push({ ...def, measurementStatus: status, premises: [...premises, ...(specDependent ? [specPremise] : [])], origin: `Circuitos frigorígenos (${circuitNote || 'sem percurso'})`, defaultPrice: null });
  };

  const lines = [
    { fn: 'liquid', label: 'linha de líquido', diam: spec.liquid, wall: spec.liquidWall, temper: spec.liquidTemper, meters: tk.liquidLineM, ins: tk.liquidInsulationM, clamps: tk.liquidClamps },
    { fn: 'suction', label: 'linha de sucção', diam: spec.suction, wall: spec.suctionWall, temper: spec.suctionTemper, meters: tk.suctionLineM, ins: tk.suctionInsulationM, clamps: tk.suctionClamps }
  ];
  for (const l of lines) {
    mk({ name: copperName(l.diam, l.wall, l.temper), category: 'Linha frigorígena', unit: 'm', quantity: l.meters, lineFunction: l.fn, technicalCalculation: { perCircuit: tk.rows.map(r => ({ circuit: r.circuit, runM: r.runM, withLossM: r[`${l.fn}LineM`] })) }, reason: `${l.label} ${l.diam}: Σ percursos ${tk.totalRunM} m × ${coefs.copperLossFactor.value} = ${l.meters} m` }, ['copperLossFactor']);
    const af = ARMAFLEX_BY_DIAMETER[l.diam];
    if (af) mk({ name: `ESPUMA ELASTOMÉRICA DO TIPO ARMAFLEX - ${af}`, category: 'Isolamento', unit: 'm', quantity: l.ins, lineFunction: l.fn, reason: `Isolamento da ${l.label} ${l.diam}: 1:1 com a linha = ${l.ins} m` }, ['copperLossFactor', 'insulationPerCopperMeter']);
    const ax = ARMAFIX_BY_DIAMETER[l.diam];
    if (ax) mk({ name: `ARMAFIX H/M ${ax}`, category: 'Linha frigorígena', unit: 'un', quantity: l.clamps, lineFunction: l.fn, reason: `${l.meters} m ÷ espaçamento = ${l.clamps} un` }, ['copperLossFactor', 'armafixSpacingM']);
  }
  mk({ name: 'CABO SHIELD AFT 300V 3X18 AWG BLINDADO', category: 'Elétrica', unit: 'm', quantity: tk.shieldCableM, reason: `Cabo de comando pelo percurso de cada circuito: Σ ${tk.totalRunM} m × fator próprio = ${tk.shieldCableM} m` }, ['shieldCablePerRouteM'], false);
  items.push({
    name: 'GÁS REFRIGERANTE R410A - 11,3KG - FREON',
    category: 'Linha frigorígena',
    unit: 'kg',
    quantity: null,
    measurementStatus: 'PENDENTE_DADO_FABRICANTE',
    premises: ['Carga adicional depende da carga de fábrica e do g/m informado pelo fabricante para o diâmetro da linha de líquido.'],
    origin: `Circuitos frigorígenos (${circuitNote || 'sem percurso'})`,
    reason: 'Carga adicional de refrigerante pendente de dado do fabricante (g/m excedente ao comprimento pré-carregado).',
    defaultPrice: null
  });
  return { items, pending, circuits: tk.rows, spec, specFromProject };
}

/**
 * Serviços derivados da mesma geometria e das máquinas documentadas, com tarifa da base de serviços.
 */
export function buildServices({ geometry, ductBaseStatus, machines = [], refrigerant, hasLiftingScope, context, coefficients, options = {} }) {
  const coefs = coefficients || resolveCoefficients();
  const services = [];
  const conds = machines.filter(m => /CONDENSADORA/i.test(m.type));
  const evaps = machines.filter(m => !/CONDENSADORA/i.test(m.type));
  const numSystems = conds.reduce((a, m) => a + (m.qty || 1), 0) || evaps.reduce((a, m) => a + (m.qty || 1), 0);
  const maxTr = Math.max(0, ...evaps.map(m => m.tr || 0));

  const add = (description, unit, quantity, status, premises, origin) => {
    const tariff = findServiceTariff(description, unit, context);
    const priced = tariff && !tariff.ambiguous;
    services.push({
      category: 'MÃO DE OBRA',
      description,
      quantity: quantity == null ? null : Number(Number(quantity).toFixed(2)),
      unit,
      unitPrice: priced ? tariff.price : null,
      priceSource: priced ? `${tariff.source} (${tariff.context})` : null,
      priceStatus: priced ? 'PRECIFICADO_CATALOGO' : 'PENDENTE_COTACAO',
      measurementStatus: status,
      classification: status === STATUS.PENDENTE ? 'QUANTIDADE_PENDENTE' : (status === STATUS.PREVISAO ? 'PREVISAO' : (priced ? 'CONFIRMADO' : 'PRECO_PENDENTE')),
      premises,
      notes: `${origin}${priced ? '' : (tariff?.ambiguous ? ' | Tarifa ambígua na base de serviços.' : ' | Tarifa não cadastrada na base de serviços.')}`
    });
  };

  if (numSystems > 0) {
    const special = maxTr >= 10 || evaps.some(m => /SPLIT[AÃ]O/i.test(m.type));
    add(
      `Preço Mão de Obra Unidade Condensadora (1 por sistema) (MO)${special ? ' - ESPECIAIS' : ''}`,
      'Unid.',
      numSystems,
      STATUS.DOCUMENTADO,
      [special ? `Faixa "ESPECIAIS" adotada por capacidade ${maxTr} TR / splitão (regra a confirmar).` : 'Faixa padrão por capacidade.'],
      `${numSystems} sistema(s) da lista de material`
    );
  }

  if (geometry && geometry.rows.length > 0) {
    const { premises, allValidated } = premisesFor(coefs, ['ductLaborAreaFactor']);
    const area = geometry.totalNetAreaM2 * coefs.ductLaborAreaFactor.value;
    add('Duteiro (fabricação e montagem)', 'm²', area, derivedStatus(ductBaseStatus, allValidated), premises, `Mesma área líquida dos materiais: ${geometry.totalNetAreaM2} m² (${geometry.rows.length} trechos)`);
  } else if (geometry) {
    add('Duteiro (fabricação e montagem)', 'm²', null, STATUS.PENDENTE, [], 'Área de dutos pendente de medição');
  }

  if (refrigerant && refrigerant.circuits?.length) {
    const meters = refrigerant.circuits.reduce((a, r) => a + (r.liquidLineM || 0) + (r.suctionLineM || 0), 0);
    const status = refrigerant.circuits.every(r => r.status === 'MEDIDO') ? STATUS.CALCULADO : STATUS.PREVISAO;
    add('Pipeiro - Tubulação frigorígena (instalação)', 'm', meters, status, ['Metros de tubo (líquido + sucção) com perda, por circuito.'], `${refrigerant.circuits.length} circuito(s)`);
  }

  if (numSystems > 0) {
    add('Fechamento', 'unid', numSystems, STATUS.DOCUMENTADO, ['1 fechamento por sistema (interligação plenum/difusão).'], `${numSystems} sistema(s)`);
  }

  if (hasLiftingScope && numSystems > 0) {
    const liftUnits = machines.reduce((a, m) => a + (m.qty || 1), 0);
    if (options.liftingDays != null) {
      add('Içamento', 'diária', Number(options.liftingDays), STATUS.DOCUMENTADO, ['Diárias informadas na análise.'], 'Parâmetro informado');
    } else {
      const { premises } = premisesFor(coefs, ['liftingUnitsPerDay']);
      add('Içamento', 'diária', Math.ceil(liftUnits / coefs.liftingUnitsPerDay.value), STATUS.PREVISAO, premises, `${liftUnits} equipamento(s) para patamar/cobertura`);
    }
  }

  if (numSystems > 0) {
    if (options.supervisorMonths != null) {
      add('Supervisor - 6 Horas - 22 Dias/ Mês', 'mês', Number(options.supervisorMonths), STATUS.DOCUMENTADO, ['Prazo informado na análise.'], 'Parâmetro informado');
    } else {
      const area = geometry?.totalNetAreaM2 || 0;
      const days = area / coefs.ductInstallM2PerDay.value + numSystems * coefs.systemInstallDays.value;
      const { premises } = premisesFor(coefs, ['ductInstallM2PerDay', 'systemInstallDays', 'workDaysPerMonth']);
      add('Supervisor - 6 Horas - 22 Dias/ Mês', 'mês', days / coefs.workDaysPerMonth.value, STATUS.PREVISAO, [...premises, `Prazo estimado ${days.toFixed(1)} dias úteis`], 'Prazo derivado da geometria e do número de sistemas');
    }
  }
  return services;
}
