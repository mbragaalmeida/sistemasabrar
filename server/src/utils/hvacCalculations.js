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
  const factor = DUCT_GAUGE_FACTORS[gauge] || 5.2;
  return Number((Number(areaSqm) * factor * 1.20).toFixed(2));
}

/**
 * Passo 9: Levantamento do isolamento do duto com fator 1,40 (perdas e sobras)
 * Isolamento = Área do duto × 1,40
 */
export function calculateDuctInsulation(areaSqm) {
  return Number((Number(areaSqm) * 1.40).toFixed(2));
}

/**
 * Passo 11: Insumos para instalação dos dutos TDC
 */
export function calculateDuctTDCSupplies(totalPerimeterM) {
  const p = Number(totalPerimeterM) || 0;
  // 11.1 Cantos: (Somatório do perímetro / 1,1) * 8 arredondado para cima + 15%
  const baseCantos = Math.ceil((p / 1.1) * 8);
  const cantos = Math.ceil(baseCantos * 1.15);

  // 11.3 Silicone para TDC: ((Somatório do perímetro / 1,1) / 3) + 15%
  const silicone = Number((((p / 1.1) / 3) * 1.15).toFixed(1));

  // 11.4 Fita TDC: (Somatório do perímetro / 10) + 15% (rolos de 10m)
  const fitaTDC = Number(((p / 10) * 1.15).toFixed(1));

  return {
    cantos,
    silicone,
    fitaTDC
  };
}

/**
 * Passo 12: Levantamento da suportação dos dutos
 * Suportes a cada 1,50 m
 * Cada conjunto contém:
 * - 1 perfilado (largura do duto + 10 cm);
 * - 2 tirantes barras 3m (1/4" para dutos);
 * - 2 chumbadores 1/4";
 * - 4 porcas 1/4";
 * - 4 arruelas 1/4".
 */
export function calculateDuctSupports(lengthM, averageWidthCm = 60) {
  const len = Number(lengthM) || 0;
  const numSupports = Math.ceil(len / 1.50);
  const widthM = (Number(averageWidthCm) || 60) / 100;
  const perfiladoPerSupport = widthM + 0.10; // 10 cm a mais que a largura
  const totalPerfiladoMeters = Number((numSupports * perfiladoPerSupport).toFixed(2));
  const numTirantes = numSupports * 2;
  const tirantesMeters = numTirantes * 3; // Tirante padrão de 3 metros
  const chumbadores = numSupports * 2; // 1/4" para dutos
  const porcas = numSupports * 4;
  const arruelas = numSupports * 4;

  return {
    numSupports,
    totalPerfiladoMeters,
    numTirantes,
    tirantesMeters,
    chumbadores,
    porcas,
    arruelas,
    perfiladoPerSupport: Number(perfiladoPerSupport.toFixed(2))
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
 * Extrai trechos explícitos de dutos presentes no texto de plantas, memoriais ou anotações CAD
 * Reconhece formatos: "60x40", "70 x 40 cm", "duto 100x50", "800x400 mm", etc.
 */
export function extractDuctSegmentsFromText(text) {
  if (!text) return [];

  const segments = [];
  // Procura padrões como "duto 60x40", "70x40 cm", "seção 100x50", "800x400", "L=5m", "comprimento 12m"
  const regex = /(?:(?:duto|dutos|se[çc][aã]o|dimens[aã]o|trecho)\s*)?(\d{2,4})\s*[xX*×]\s*(\d{2,4})(?:\s*(cm|mm))?(?:[^\n\r\d]{1,25}?(?:comp(?:rimento)?|extens[aã]o|l)\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*m)?/gi;

  const isBlackSteelContext = /cozinha|gordura|melting|chapa\s*preta|nbr\s*14518/i.test(text);
  const isPressurizationContext = /pressuriz/i.test(text);

  let match;
  while ((match = regex.exec(text)) !== null) {
    let dim1 = parseInt(match[1], 10);
    let dim2 = parseInt(match[2], 10);
    const unit = (match[3] || '').toLowerCase();
    const lengthRaw = match[4];

    // Se a unidade for mm ou valores típicos em milímetros (> 200), converte para cm
    if (unit === 'mm' || (dim1 > 150 && dim1 % 50 === 0 && dim2 > 150 && dim2 % 50 === 0)) {
      dim1 = Math.round(dim1 / 10);
      dim2 = Math.round(dim2 / 10);
    }

    // Filtra falsos positivos (como 1920x1080 ou 600x600 de difusor/luminária ou dimensões espúrias)
    if (dim1 < 10 || dim1 > 400 || dim2 < 10 || dim2 > 400) continue;
    if (dim1 === 600 && dim2 === 600) continue; // Difusor modular 600x600

    const lengthM = lengthRaw ? parseFloat(lengthRaw.replace(',', '.')) : 3.0; // Padrão 3m por vara/trecho se não informado
    const widthCm = dim1;  // 1ª medida = largura
    const heightCm = dim2; // 2ª medida = altura

    const perimeterM = calculateDuctPerimeter(widthCm, heightCm);
    const areaM2 = calculateDuctArea(perimeterM, lengthM);
    const gauge = determineDuctGauge(widthCm, heightCm, isBlackSteelContext, isPressurizationContext);
    const weightKg = calculateDuctKg(areaM2, gauge);
    const insulationM2 = calculateDuctInsulation(areaM2);

    segments.push({
      widthCm,
      heightCm,
      lengthM,
      perimeterM,
      areaM2,
      gauge,
      weightKg,
      insulationM2,
      isBlackSteel: isBlackSteelContext,
      isPressurization: isPressurizationContext
    });
  }

  return segments;
}

