/**
 * FÓRMULAS E CRITÉRIOS OFICIAIS SABRAR
 * "PASSO A PASSO PARA LEVANTAMENTO DE PROJETOS DE AR-CONDICIONADO E EXAUSTÃO"
 */

export const DUCT_GAUGE_FACTORS = {
  '#26': 4.0,  // Até 60 cm
  '#24': 5.2,  // Acima de 60 até 90 cm
  '#22': 6.4,  // Acima de 90 até 120 cm
  '#20': 7.6,  // Acima de 120 até 150 cm
  '#18': 10.0, // Acima de 150 até 300 cm (ou pressurização)
  '#16': 12.0  // Chapa preta soldada (exaustão cozinha)
};

/**
 * Passo 5: Perímetro = 2 × (A + B) em metros
 */
export function calculateDuctPerimeter(widthCm, heightCm) {
  const a = Number(widthCm) / 100;
  const b = Number(heightCm) / 100;
  return Number((2 * (a + b)).toFixed(3));
}

/**
 * Passo 6: Área = Perímetro × Comprimento em m²
 */
export function calculateDuctArea(perimeterM, lengthM) {
  return Number((Number(perimeterM) * Number(lengthM)).toFixed(3));
}

/**
 * Passo 7: Definição da bitola da chapa pela maior dimensão entre A e B
 * Exceções:
 * 1. Chapa preta -> #16
 * 2. Pressurização -> #18
 */
export function determineDuctGauge(widthCm, heightCm, isBlackSteel = false, isPressurization = false) {
  if (isBlackSteel) return '#16';
  if (isPressurization) return '#18';

  const maxDim = Math.max(Number(widthCm) || 0, Number(heightCm) || 0);
  if (maxDim <= 60) return '#26';
  if (maxDim <= 90) return '#24';
  if (maxDim <= 120) return '#22';
  if (maxDim <= 150) return '#20';
  return '#18';
}

/**
 * Passo 8: Cálculo do KG do duto com fator da bitola e perda de 20% (1,20)
 * KG Total = Área × Fator da bitola × 1,20
 */
export function calculateDuctKg(areaSqm, gauge) {
  const factor = DUCT_GAUGE_FACTORS[gauge];
  if (!factor) return null;
  return Number((Number(areaSqm) * factor * COMPANY_COEFFICIENTS.sheetLossFactor.value).toFixed(2));
}

/**
 * Passo 9: Levantamento do isolamento do duto com fator 1,40 (perdas e sobras)
 * Isolamento = Área do duto × 1,40
 */
export function calculateDuctInsulation(areaSqm) {
  return Number((Number(areaSqm) * 1.40).toFixed(2));
}

/**
 * COEFICIENTES EMPRESARIAIS EXPLÍCITOS
 * Cada coeficiente informa valor, unidade, fonte e se está VALIDADO pela empresa.
 * Itens cuja quantidade depende de coeficiente não validado são classificados como PREVISAO,
 * com a premissa visível. Os valores podem ser substituídos por opções da análise
 * (options.companyCoefficients = { chave: { value, validated, source } }).
 */
export const COMPANY_COEFFICIENTS = Object.freeze({
  sheetLossFactor: { value: 1.20, unit: 'fator', validated: true, source: 'OP Passo 8 (perda de chapa TDC)' },
  tdcInsulationFactor: { value: 1.40, unit: 'fator', validated: true, source: 'OP Passo 9 (isolamento de duto TDC)' },
  supportSpacingM: { value: 1.50, unit: 'm', validated: true, source: 'OP Passo 12 (suportes a cada 1,50 m)' },
  perfiladoExtraWidthM: { value: 0.10, unit: 'm', validated: true, source: 'OP Passo 12 (perfilado = largura do duto + 10 cm)' },
  rodsPerSupport: { value: 2, unit: 'un/suporte', validated: true, source: 'OP Passo 12 (2 tirantes)' },
  rodBarsPerRod: { value: 1, unit: 'barra 3 m/tirante', validated: true, source: 'OP Passo 12 ("2 tirantes barras 3m")' },
  anchorsPerSupport: { value: 2, unit: 'un/suporte', validated: true, source: 'OP Passo 12 (2 chumbadores)' },
  nutsPerSupport: { value: 4, unit: 'un/suporte', validated: true, source: 'OP Passo 12 (4 porcas)' },
  washersPerSupport: { value: 4, unit: 'un/suporte', validated: true, source: 'OP Passo 12 (4 arruelas)' },
  copperLossFactor: { value: 1.25, unit: 'fator', validated: true, source: 'OP Passo 13 (perda de 25% do cobre)' },
  insulationPerCopperMeter: { value: 1.0, unit: 'm/m', validated: true, source: 'OP Passo 13.3 (isolamento elastomérico 1:1 com a linha)' },
  tdcPieceLengthM: { value: 1.10, unit: 'm', validated: true, source: 'OP Passo 11 (divisor 1,1 m)' },
  tdcCornersPerJoint: { value: 8, unit: 'un/junta', validated: true, source: 'OP Passo 11.1' },
  tdcWasteFactor: { value: 1.15, unit: 'fator', validated: true, source: 'OP Passo 11 (+15%)' },
  tdcTapeRollM: { value: 10, unit: 'm/rolo', validated: true, source: 'OP Passo 11.4 (rolos de 10 m)' },
  mpuPanelLossFactor: { value: 1.20, unit: 'fator', validated: false, source: 'Critério MPU citado no código anterior (20% de perda); aguardando validação' },
  mpuPanelAreaM2: { value: 2.40, unit: 'm²/painel', validated: true, source: 'Especificação comercial do painel 2,0 x 1,2 m' },
  mpuPanelsPerBox: { value: 10, unit: 'painel/caixa', validated: false, source: 'Embalagem do fornecedor (caixa com 10); confirmar' },
  mpuJointSpacingM: { value: 1.20, unit: 'm', validated: false, source: 'Junta transversal a cada 1,20 m (largura do painel); confirmar' },
  mpuProfileWasteFactor: { value: 1.15, unit: 'fator', validated: false, source: 'Margem de perfil +15%; confirmar' },
  mpuCornersPerJoint: { value: 4, unit: 'un/junta', validated: false, source: '4 cantos de reforço por junta; confirmar' },
  mpuGlueM2PerUnit: { value: 20, unit: 'm²/un', validated: false, source: '1 cola por 20 m² de duto; confirmar' },
  mpuSealantM2PerUnit: { value: 25, unit: 'm²/un', validated: false, source: '1 selante por 25 m² de duto; confirmar' },
  mpuTapeWasteFactor: { value: 1.15, unit: 'fator', validated: false, source: 'Fita nas arestas longitudinais e juntas +15%; confirmar' },
  armafixSpacingM: { value: 1.50, unit: 'm', validated: false, source: 'Abraçadeira isolada a cada 1,50 m de linha; confirmar' },
  shieldCablePerRouteM: { value: 1.25, unit: 'm/m', validated: false, source: 'Cabo de comando acompanha o percurso frigorígeno com 25% de sobra; confirmar' },
  ductLaborAreaFactor: { value: 1.0, unit: 'fator', validated: false, source: 'Mão de obra de duteiro sobre a área líquida medida; confirmar' },
  liftingUnitsPerDay: { value: 3, unit: 'equip./diária', validated: false, source: 'Produtividade de içamento; confirmar com logística' },
  ductInstallM2PerDay: { value: 12, unit: 'm²/dia', validated: false, source: 'Produtividade de equipe de duteiros; confirmar' },
  systemInstallDays: { value: 2, unit: 'dia/sistema', validated: false, source: 'Instalação/interligação por sistema; confirmar' },
  workDaysPerMonth: { value: 22, unit: 'dia/mês', validated: true, source: 'Supervisor 6 h - 22 dias/mês (base de serviços)' }
});

export function resolveCoefficients(overrides = {}) {
  const out = {};
  for (const [k, v] of Object.entries(COMPANY_COEFFICIENTS)) {
    const o = overrides?.[k];
    out[k] = o == null
      ? { ...v }
      : (typeof o === 'object' ? { ...v, ...o } : { ...v, value: Number(o), validated: false, source: 'Parâmetro informado na análise' });
  }
  return out;
}

const r2 = n => Number((Number(n) || 0).toFixed(2));

/** Premissas e status derivados dos coeficientes efetivamente usados. */
export function premisesFor(coefs, keys) {
  const used = keys.map(k => ({ key: k, ...coefs[k] }));
  return {
    premises: used.map(u => `${u.key}=${u.value} ${u.unit} (${u.validated ? 'validado' : 'NÃO VALIDADO'}: ${u.source})`),
    allValidated: used.every(u => u.validated)
  };
}

/**
 * Geometria por trecho: perímetro e área líquida (sem perdas).
 * Base única para materiais, acessórios e mão de obra.
 */
export function computeSectionGeometry(sections = []) {
  const rows = sections
    .filter(s => Number(s.lengthM) > 0 && Number(s.widthCm) > 0 && Number(s.heightCm) > 0)
    .map(s => {
      const perimeterM = calculateDuctPerimeter(s.widthCm, s.heightCm);
      return { ...s, perimeterM, netAreaM2: Number((perimeterM * Number(s.lengthM)).toFixed(4)) };
    });
  return {
    rows,
    totalLinearM: r2(rows.reduce((a, s) => a + Number(s.lengthM), 0)),
    totalNetAreaM2: r2(rows.reduce((a, s) => a + s.netAreaM2, 0)),
    // Σ perímetro × comprimento = área; Σ perímetro isolado só tem sentido por junta (ver acessórios)
    weightedAvgWidthCm: rows.length
      ? r2(rows.reduce((a, s) => a + s.widthCm * s.lengthM, 0) / rows.reduce((a, s) => a + Number(s.lengthM), 0))
      : 0
  };
}

/**
 * Painéis MPU: área líquida → perda (uma única vez) → área de compra → peças → caixas.
 * O fator de isolamento 1,40 (TDC) NÃO é usado aqui.
 */
export function calculateMPUDuctPanels(netAreaSqm, options = {}) {
  const coefs = options.coefficients || resolveCoefficients();
  const area = Math.max(0, Number(netAreaSqm) || 0);
  const lossFactor = Number(options.lossFactor ?? coefs.mpuPanelLossFactor.value);
  const panelAreaSqm = coefs.mpuPanelAreaM2.value;
  const boxSize = coefs.mpuPanelsPerBox.value;
  const packagingMode = options.packagingMode || 'AVULSO';

  // Aceita os dois nomes históricos do parâmetro (corrige divergência externalAreaSqm x externalAreaMeasured)
  const externalNet = Math.min(area, Math.max(0, Number(options.externalAreaSqm ?? options.externalAreaMeasured ?? 0) || 0));
  const internalNet = Math.max(0, area - externalNet);

  const build = (net) => {
    const purchaseArea = net * lossFactor;
    const pieces = purchaseArea > 0 ? Math.ceil(purchaseArea / panelAreaSqm) : 0;
    const boxes = pieces > 0 ? Math.ceil(pieces / boxSize) : 0;
    return {
      netAreaSqm: r2(net),
      lossAreaSqm: r2(purchaseArea - net),
      purchaseAreaSqm: r2(purchaseArea),
      requiredPieces: pieces,
      boxes,
      commercialPieces: packagingMode === 'CAIXA_FECHADA' || packagingMode === 'CAIXA_FECHADA_10' ? boxes * boxSize : pieces
    };
  };
  const internal = build(internalNet);
  const external = build(externalNet);
  return {
    netAreaSqm: r2(area),
    lossFactor,
    panelAreaSqm,
    boxSize,
    packagingMode,
    internal,
    external,
    pendingExternalLocation: Boolean(options.hasExternalDeckNote && externalNet === 0)
  };
}

/**
 * Insumos MPU por trecho (perfis, cantos, fita, cola, selante) — quantidades técnicas
 * em unidades físicas (m, un); a conversão para barras/rolos/latas é feita na precificação
 * pela embalagem cadastrada.
 */
export function calculateMPUSupplies(sections = [], coefs = resolveCoefficients()) {
  const geo = computeSectionGeometry(sections);
  const s = coefs.mpuJointSpacingM.value;
  let joints = 0;
  let profileM = 0;
  let longitudinalEdgesM = 0;
  for (const row of geo.rows) {
    const j = Math.ceil(Number(row.lengthM) / s);
    joints += j;
    profileM += row.perimeterM * j;
    longitudinalEdgesM += 4 * Number(row.lengthM);
  }
  const tapeM = (longitudinalEdgesM + profileM) * coefs.mpuTapeWasteFactor.value;
  return {
    joints,
    profileMeters: r2(profileM * coefs.mpuProfileWasteFactor.value),
    cornerPieces: joints * coefs.mpuCornersPerJoint.value,
    tapeMeters: r2(tapeM),
    glueUnits: geo.totalNetAreaM2 > 0 ? Math.ceil(geo.totalNetAreaM2 / coefs.mpuGlueM2PerUnit.value) : 0,
    sealantUnits: geo.totalNetAreaM2 > 0 ? Math.ceil(geo.totalNetAreaM2 / coefs.mpuSealantM2PerUnit.value) : 0,
    netAreaM2: geo.totalNetAreaM2,
    linearM: geo.totalLinearM
  };
}

/**
 * Passo 11: insumos TDC por trecho (juntas a cada 1,10 m).
 */
export function calculateDuctTDCSupplies(sections = [], coefs = resolveCoefficients()) {
  const geo = computeSectionGeometry(sections);
  let joints = 0;
  let jointPerimeterM = 0;
  for (const row of geo.rows) {
    const j = Number(row.lengthM) / coefs.tdcPieceLengthM.value;
    joints += j;
    jointPerimeterM += row.perimeterM * j;
  }
  const w = coefs.tdcWasteFactor.value;
  return {
    joints: r2(joints),
    corners: Math.ceil(Math.ceil(joints * coefs.tdcCornersPerJoint.value) * w),
    siliconeUnits: Math.ceil((joints / 3) * w),
    tapeMeters: r2(jointPerimeterM * w),
    tapeRolls: Math.ceil((jointPerimeterM * w) / coefs.tdcTapeRollM.value)
  };
}

/**
 * Passo 12: suportação por trecho (cada trecho com sua largura).
 */
export function calculateDuctSupports(sections = [], coefs = resolveCoefficients()) {
  const geo = computeSectionGeometry(sections);
  let supports = 0;
  let perfiladoM = 0;
  for (const row of geo.rows) {
    const n = Math.ceil(Number(row.lengthM) / coefs.supportSpacingM.value);
    supports += n;
    perfiladoM += n * (row.widthCm / 100 + coefs.perfiladoExtraWidthM.value);
  }
  const rods = supports * coefs.rodsPerSupport.value;
  return {
    numSupports: supports,
    perfiladoMeters: r2(perfiladoM),
    rods,
    rodBars: Math.ceil(rods * coefs.rodBarsPerRod.value),
    anchors: supports * coefs.anchorsPerSupport.value,
    nuts: supports * coefs.nutsPerSupport.value,
    washers: supports * coefs.washersPerSupport.value
  };
}

/**
 * Passo 13: linhas frigorígenas por circuito. Perda de 25% aplicada UMA vez sobre o percurso.
 * @param {Array<{circuit:number, runM:number, status:string}>} circuits
 */
export function calculateRefrigerantTakeoff(circuits = [], coefs = resolveCoefficients()) {
  const loss = coefs.copperLossFactor.value;
  const rows = circuits.map(c => {
    const run = Number(c.runM) || 0;
    const pipeM = r2(run * loss);
    return {
      ...c,
      runM: r2(run),
      liquidLineM: pipeM,
      suctionLineM: pipeM,
      liquidInsulationM: r2(pipeM * coefs.insulationPerCopperMeter.value),
      suctionInsulationM: r2(pipeM * coefs.insulationPerCopperMeter.value),
      liquidClamps: pipeM > 0 ? Math.ceil(pipeM / coefs.armafixSpacingM.value) : 0,
      suctionClamps: pipeM > 0 ? Math.ceil(pipeM / coefs.armafixSpacingM.value) : 0,
      shieldCableM: r2(run * coefs.shieldCablePerRouteM.value)
    };
  });
  const sum = k => r2(rows.reduce((a, r) => a + (r[k] || 0), 0));
  return {
    rows,
    totalRunM: sum('runM'),
    liquidLineM: sum('liquidLineM'),
    suctionLineM: sum('suctionLineM'),
    liquidInsulationM: sum('liquidInsulationM'),
    suctionInsulationM: sum('suctionInsulationM'),
    liquidClamps: rows.reduce((a, r) => a + r.liquidClamps, 0),
    suctionClamps: rows.reduce((a, r) => a + r.suctionClamps, 0),
    shieldCableM: sum('shieldCableM')
  };
}

/**
 * Passo 13: Rede de cobre com perda de 25% (fator multiplicador 1,25)
 */
export function calculateCopperMeters(linearMeters) {
  return Number((Number(linearMeters) * 1.25).toFixed(2));
}

/**
 * Passo 14: Rede hidráulica CAG com perda de 25% (fator multiplicador 1,25)
 */
export function calculateHydraulicMeters(linearMeters) {
  return Number((Number(linearMeters) * 1.25).toFixed(2));
}

/**
 * Extrai trechos explícitos de dutos presentes no texto de plantas, memoriais ou anotações CAD.
 * Reconhece formatos: "I-120x45", "R-100x70", "duto 60x40", "seção 100x50", etc.
 * Aplica as diretrizes oficiais da SABRAR (Passo 3 a 10).
 * 
 * REGRA ABSOLUTA DE ENGENHARIA SABRAR:
 * - Filtra rigorosamente falsos positivos (dimensões de difusores, grelhas, dampers, portas e vãos).
 * - Elimina comprimento arbitrário padrão de 3.0m quando não cotado em projeto.
 * - Registra pendência de medição para trechos sem cota linear confirmada.
 */
export function extractDuctSegmentsFromText(text, options = {}) {
  if (!text) return [];

  const { allowEstimateFallback = false, sourceFile = null, sourcePage = null } = options;
  const segments = [];

  // Padrão de identificação de trechos de duto (com limite estrito de fronteira de palavra \b)
  const regex = /(?:(?:duto|dutos|se[çc][aã]o|dimens[aã]o|trecho)\s*)?(?:\b(I|R|V|A|E|P|EX|AE|AR|RET|INS|PRESS)[-_ ])?(\d{2,4})\s*[xX*×]\s*(\d{2,4})(?:\s*(cm|mm))?(?:[^\n\r\d]{1,30}?(?:comp(?:rimento)?|extens[aã]o|l|c)\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*m)?/gi;

  const isGlobalBlackSteel = /cozinha|gordura|melting|chapa\s*preta|nbr\s*14518/i.test(text);
  const isGlobalPressurization = /pressuriz/i.test(text);
  const isGlobalMPU = /mpu|pain[eé]is?\s+de\s+alum[ií]nio\s+pr[eé]-?isolado|espuma\s+r[ií]gida\s+de\s+poliuretano/i.test(text);

  // Rastreia marcadores de documento/página no texto concatenado
  const docMarkers = [...text.matchAll(/\[Documento:\s*([^\]|]+?)(?:\s*\|\s*[^\]]*)?\]/gi)];
  const pageMarkers = [...text.matchAll(/\[P[áa]gina:\s*(\d+)\]/gi)];

  const findDocAt = (idx) => {
    if (sourceFile) return sourceFile;
    let current = 'Documento do Projeto';
    for (const dm of docMarkers) {
      if (dm.index <= idx) current = dm[1].trim();
      else break;
    }
    return current;
  };

  const findPageAt = (idx) => {
    if (sourcePage) return sourcePage;
    let current = 1;
    for (const pm of pageMarkers) {
      if (pm.index <= idx) current = parseInt(pm[1], 10);
      else break;
    }
    return current;
  };

  let match;
  while ((match = regex.exec(text)) !== null) {
    const matchIdx = match.index;
    const windowStart = Math.max(0, matchIdx - 60);
    const windowEnd = Math.min(text.length, matchIdx + match[0].length + 60);
    const surrounding = text.slice(windowStart, windowEnd).toLowerCase();

    // 1. FILTRO DE FALSOS POSITIVOS:
    // Se no entorno imediato da dimensão houver difusor, grelha, damper, veneziana, porta, janela, esquadria, NÃO é duto!
    if (/(?:grelha|difusor|difuso|damper|veneziana|plenum|porta|janela|esquadria|alvenaria|vao|tamanho|item\s*\d+|qtd)/i.test(surrounding)) {
      continue;
    }

    const rawPrefix = (match[1] || '').toUpperCase();
    let dim1 = parseInt(match[2], 10);
    let dim2 = parseInt(match[3], 10);
    const unit = (match[4] || '').toLowerCase();
    const lengthRaw = match[5];

    // Se a unidade for mm ou valores típicos em milímetros (> 150 e múltiplos de 50 sem prefixo), converte para cm
    if (unit === 'mm' || (dim1 > 150 && dim1 % 50 === 0 && dim2 > 150 && dim2 % 50 === 0 && !rawPrefix)) {
      dim1 = Math.round(dim1 / 10);
      dim2 = Math.round(dim2 / 10);
    }

    // Filtros de dimensões implausíveis para dutos
    if (dim1 < 10 || dim1 > 400 || dim2 < 10 || dim2 > 400) continue;
    // Difusor 60x60cm (600x600mm) ou 15x15 pol
    if (dim1 === 60 && dim2 === 60 && !rawPrefix) continue;
    if (dim1 === 600 && dim2 === 600) continue;
    if (dim1 === 250 && dim2 === 100 && !rawPrefix) continue; // vão típico de porta 250x100
    if (dim1 === 60 && dim2 === 30 && !rawPrefix && /grelha/i.test(text.slice(Math.max(0, matchIdx - 80), matchIdx + 80))) continue; // grelha 600x300

    const isSupply = rawPrefix.startsWith('I') || rawPrefix.startsWith('INS');
    const isReturn = rawPrefix.startsWith('R') || rawPrefix.startsWith('RET');
    const isExhaust = rawPrefix.startsWith('EX');
    const isOutdoorAir = rawPrefix.startsWith('AE') || rawPrefix.startsWith('AR');
    const isPressurization = rawPrefix.startsWith('P') || rawPrefix.startsWith('PRESS') || isGlobalPressurization;
    const isBlackSteel = isGlobalBlackSteel || (isExhaust && /cozinha|gordura/i.test(text));
    const isMPU = isGlobalMPU && !isBlackSteel;

    let system = 'Insuflamento';
    if (isReturn) system = 'Retorno';
    else if (isExhaust) system = 'Exaustão';
    else if (isOutdoorAir) system = 'Ar Exterior';
    else if (isPressurization) system = 'Pressurização';

    // REGRA: Elimina comprimento padrão de 3.0m no levantamento executivo
    let lengthM = null;
    let measurementStatus = 'PENDENTE_MEDICAO';

    if (lengthRaw) {
      lengthM = parseFloat(lengthRaw.replace(',', '.'));
      measurementStatus = 'MEDIDO';
    } else if (allowEstimateFallback) {
      lengthM = 3.0; // Apenas se explicitamente autorizado pelo chamador para estimativas conceituais
      measurementStatus = 'ESTIMADO_PRELIMINAR';
    }

    const widthCm = dim1;
    const heightCm = dim2;
    const perimeterM = calculateDuctPerimeter(widthCm, heightCm);
    const areaM2 = lengthM ? calculateDuctArea(perimeterM, lengthM) : null;
    const gauge = determineDuctGauge(widthCm, heightCm, isBlackSteel, isPressurization);
    const weightKg = areaM2 ? calculateDuctKg(areaM2, gauge) : null;

    let insulationM2 = 0;
    if (!isMPU && areaM2) {
      if (isSupply || isOutdoorAir) {
        insulationM2 = calculateDuctInsulation(areaM2);
      } else if (isBlackSteel) {
        insulationM2 = calculateDuctInsulation(areaM2);
      }
    }

    const detectedDoc = findDocAt(matchIdx);
    const detectedPage = findPageAt(matchIdx);

    segments.push({
      prefix: rawPrefix || (system === 'Retorno' ? 'R' : 'I'),
      system,
      widthCm,
      heightCm,
      lengthM,
      measurementStatus,
      perimeterM,
      areaM2,
      gauge,
      weightKg,
      insulationM2,
      isBlackSteel,
      isPressurization,
      isMPU,
      sourceFile: detectedDoc,
      sourcePage: detectedPage,
      evidence: match[0].trim(),
      notes: lengthM
        ? `Seção ${widthCm}x${heightCm} cm - Comprimento: ${lengthM}m [${detectedDoc}, p.${detectedPage}]`
        : `Seção ${widthCm}x${heightCm} cm - Comprimento linear pendente de cota/medição em prancha [${detectedDoc}, p.${detectedPage}]`
    });
  }

  return segments;
}

