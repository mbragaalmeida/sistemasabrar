/**
 * MÓDULO DE CONVERSÃO INTELIGENTE DE UNIDADES DE MEDIDA — SABRAR
 *
 * Realiza conversões exatas e proporcionais entre unidades de compra (ex: NF-e em KG, Fardo, Rolo)
 * e unidades de controle/levantamento/orçamento (ex: metros, m², barras, unidades).
 */

// Pesos lineares nominais de Tubos de Cobre (kg por metro) segundo ABNT NBR 13206 / ASTM B280
export const COPPER_WEIGHTS_KG_PER_METER = {
  '1/4': 0.118,
  '3/8': 0.183,
  '1/2': 0.249,
  '5/8': 0.314,
  '3/4': 0.380,
  '7/8': 0.446,
  '1': 0.510,
  '1.1/8': 0.577,
  '1 1/8': 0.577,
  '1-1/8': 0.577,
  '1.3/8': 0.730,
  '1 3/8': 0.730,
  '1-3/8': 0.730,
  '1.5/8': 0.900,
  '1 5/8': 0.900,
  '1-5/8': 0.900,
  '2.1/8': 1.250,
  '2 1/8': 1.250,
  '2-1/8': 1.250
};

// Pesos de chapas galvanizadas para dutos (kg por m²)
export const GALVANIZED_SHEET_KG_PER_SQM = {
  '26': 4.10,
  '#26': 4.10,
  '24': 5.30,
  '#24': 5.30,
  '22': 6.50,
  '#22': 6.50,
  '20': 7.70,
  '#20': 7.70,
  '18': 10.15,
  '#18': 10.15
};

// Pesos nominais aproximados de cabos elétricos de cobre (kg por metro)
export const CABLE_WEIGHTS_KG_PER_METER = {
  '1.5': 0.021,
  '2.5': 0.032,
  '4': 0.050,
  '6': 0.072,
  '10': 0.118,
  '16': 0.180,
  '25': 0.280,
  '35': 0.380,
  '50': 0.530
};

// Cilindros padrão de gases refrigerantes (kg por botija/cilindro)
export const REFRIGERANT_CYLINDER_KG = {
  'R-410A': 11.3,
  'R410A': 11.3,
  'R-32': 9.5,
  'R32': 9.5,
  'R-134A': 13.6,
  'R134A': 13.6,
  'R-404A': 10.9,
  'R404A': 10.9,
  'R-22': 13.6,
  'R22': 13.6
};

/**
 * Normaliza strings de unidade para comparação (maiúsculo, sem pontuações)
 */
export function normalizeUnit(unit) {
  if (!unit) return 'UN';
  const u = String(unit).trim().toUpperCase();
  if (['KG', 'QUILO', 'KGS', 'KILO', 'KILOGRAMA'].includes(u)) return 'KG';
  if (['M', 'METRO', 'METROS', 'MT', 'MTS'].includes(u)) return 'M';
  if (['M2', 'M²', 'METRO QUADRADO', 'METROS QUADRADOS'].includes(u)) return 'M²';
  if (['UN', 'UND', 'UNIDADE', 'UNIDADES', 'PC', 'PÇA', 'PECA', 'PECAS'].includes(u)) return 'UN';
  if (['BARRA', 'BAR', 'BARRAS'].includes(u)) return 'BARRA';
  if (['ROLO', 'ROLOS', 'RL'].includes(u)) return 'ROLO';
  if (['CX', 'CAIXA', 'CAIXAS'].includes(u)) return 'CX';
  if (['L', 'LT', 'LITRO', 'LITROS'].includes(u)) return 'L';
  if (['LATA', 'LATAS'].includes(u)) return 'LATA';
  if (['SACO', 'SACOS', 'SC'].includes(u)) return 'SACO';
  if (['BALDE', 'BALDES', 'BD'].includes(u)) return 'BALDE';
  if (u.includes('BOTIJA') || u.includes('CILINDRO') || u.includes('BUJAO')) return 'BOTIJA';
  return u;
}

/**
 * Extrai a capacidade em KG de botija/cilindro de gás refrigerante ou industrial
 */
export function extractGasCylinderKg(materialName = '', unit = ''): number {
  const combined = `${materialName} ${unit}`.toUpperCase();

  // 1. Procura especificação direta de kg na unidade ou nome (ex: "botija c/ 13,6kg", "13.6 KG", "9KG", "1KG", "3KG", "11,3KG")
  const directMatch = combined.match(/(\d+(?:[.,]\d+)?)\s*k(?:g|ilos?|gs?)\b/i);
  if (directMatch) {
    const val = parseFloat(directMatch[1].replace(',', '.'));
    if (!isNaN(val) && val > 0) return val;
  }

  // 2. Procura pelo tipo de gás nos padrões conhecidos
  const gasType = detectRefrigerant(combined);
  if (gasType && (REFRIGERANT_CYLINDER_KG as any)[gasType]) {
    return (REFRIGERANT_CYLINDER_KG as any)[gasType];
  }

  // Se for R-410A / R-407C padrão
  if (combined.includes('R410') || combined.includes('R-410') || combined.includes('R407') || combined.includes('R-407')) return 11.3;
  // Se for R-22 / R-134A / R-141B padrão
  if (combined.includes('R22') || combined.includes('R-22') || combined.includes('R134') || combined.includes('R-134') || combined.includes('R141') || combined.includes('R-141')) return 13.6;
  // Se for R-32 padrão
  if (combined.includes('R32') || combined.includes('R-32')) return 3.0;

  return 11.3; // Default refrigerante
}

/**
 * Detecta bitola de tubo de cobre na descrição (ex.: '1/2', '3/8', '5/8')
 */
export function detectCopperBitola(text) {
  if (!text) return null;
  const match = text.match(/(?:(?:1|2)\s*[-./]?\s*)?[1357]\/[248]/i);
  if (match) {
    let clean = match[0].replace(/\s+/g, '').replace('-', '.');
    if (COPPER_WEIGHTS_KG_PER_METER[clean]) return clean;
  }
  return null;
}

/**
 * Detecta bitola/número de chapa galvanizada (ex.: '#24', 'chapa 24')
 */
export function detectSheetGauge(text) {
  if (!text) return null;
  const match = text.match(/(?:chapa|ch\.|#)\s*(26|24|22|20|18)/i);
  if (match) {
    return match[1];
  }
  return null;
}

/**
 * Detecta bitola de cabo elétrico (ex.: '2,5mm²', '10mm')
 */
export function detectCableGauge(text) {
  if (!text) return null;
  const match = text.match(/(\d+(?:[.,]\d+)?)\s*(?:mm²|mm2|mm)/i);
  if (match) {
    const val = match[1].replace(',', '.');
    if (CABLE_WEIGHTS_KG_PER_METER[val]) return val;
  }
  return null;
}

/**
 * Detecta tipo de gás refrigerante (ex.: 'R-410A', 'R32')
 */
export function detectRefrigerant(text) {
  if (!text) return null;
  const match = text.match(/R-?(410A|32|134A|404A|22)/i);
  if (match) {
    return `R-${match[1].toUpperCase()}`;
  }
  return null;
}

/**
 * Converte quantidade e preço unitário entre a unidade de compra e a unidade de estoque/orçamento
 *
 * @param {string} materialName Nome ou descrição do produto
 * @param {string} fromUnit Unidade de origem (ex: da NF-e)
 * @param {string} toUnit Unidade de destino (ex: do banco SABRAR)
 * @param {number} quantity Quantidade original
 * @param {number} unitPrice Preço unitário original
 * @returns {object} { convertedQuantity, convertedUnitPrice, factor, explanation, isConverted }
 */
export function convertMaterialUnits(materialName, fromUnit, toUnit, quantity = 1, unitPrice = 0) {
  const normFrom = normalizeUnit(fromUnit);
  const normTo = normalizeUnit(toUnit);

  // Se as unidades já forem equivalentes
  if (normFrom === normTo) {
    return {
      convertedQuantity: Number(quantity),
      convertedUnitPrice: Number(unitPrice),
      factor: 1,
      explanation: 'Unidades idênticas — sem necessidade de conversão.',
      isConverted: false
    };
  }

  const nameUpper = String(materialName).toUpperCase();

  // 1. CASO: TUBO DE COBRE (Comprado em KG e orçado/estocado em Metros)
  const isCopper = (nameUpper.includes('COBRE') || nameUpper.includes('FRIGOR') || nameUpper.includes('PANQUECA') || nameUpper.includes('TUBO COBRE'));
  if (isCopper && normFrom === 'KG' && normTo === 'M') {
    const bitola = detectCopperBitola(nameUpper);
    const kgPerMeter = bitola ? COPPER_WEIGHTS_KG_PER_METER[bitola] : 0.280;
    const metersPerKg = 1 / kgPerMeter;
    const convertedQty = Number((quantity * metersPerKg).toFixed(2));
    const convertedPrice = Number((unitPrice * kgPerMeter).toFixed(2));

    return {
      convertedQuantity: convertedQty,
      convertedUnitPrice: convertedPrice,
      factor: metersPerKg,
      explanation: `Conversão Cobre ${bitola || 'padrão'}: 1 kg = ${metersPerKg.toFixed(2)}m (peso linear: ${kgPerMeter} kg/m). Preço convertido: R$ ${convertedPrice.toFixed(2)}/m`,
      isConverted: true
    };
  }

  // Cobre inverso: Comprado em Metros e estocado em KG
  if (isCopper && normFrom === 'M' && normTo === 'KG') {
    const bitola = detectCopperBitola(nameUpper);
    const kgPerMeter = bitola ? COPPER_WEIGHTS_KG_PER_METER[bitola] : 0.280;
    const convertedQty = Number((quantity * kgPerMeter).toFixed(2));
    const convertedPrice = Number((unitPrice / kgPerMeter).toFixed(2));

    return {
      convertedQuantity: convertedQty,
      convertedUnitPrice: convertedPrice,
      factor: kgPerMeter,
      explanation: `Conversão Cobre ${bitola || 'padrão'}: 1 metro = ${kgPerMeter} kg.`,
      isConverted: true
    };
  }

  // 2. CASO: CHAPA GALVANIZADA (Comprada em KG e orçada/estocada em M²)
  const isSheet = (nameUpper.includes('CHAPA') || nameUpper.includes('GALVANIZADA') || nameUpper.includes('DUTO'));
  if (isSheet && normFrom === 'KG' && (normTo === 'M²' || normTo === 'M2')) {
    const gauge = detectSheetGauge(nameUpper);
    const kgPerSqm = gauge ? GALVANIZED_SHEET_KG_PER_SQM[gauge] : 5.30; // default #24
    const sqmPerKg = 1 / kgPerSqm;
    const convertedQty = Number((quantity * sqmPerKg).toFixed(2));
    const convertedPrice = Number((unitPrice * kgPerSqm).toFixed(2));

    return {
      convertedQuantity: convertedQty,
      convertedUnitPrice: convertedPrice,
      factor: sqmPerKg,
      explanation: `Conversão Chapa Galvanizada ${gauge ? '#' + gauge : '#24'}: 1 kg = ${sqmPerKg.toFixed(2)} m² (densidade: ${kgPerSqm} kg/m²). Preço convertido: R$ ${convertedPrice.toFixed(2)}/m²`,
      isConverted: true
    };
  }

  // 3. CASO: CABOS ELÉTRICOS (Comprados em Rolo de 100m e estocados em Metros)
  const isCable = (nameUpper.includes('CABO') || nameUpper.includes('FIO'));
  if (isCable && normFrom === 'ROLO' && normTo === 'M') {
    const convertedQty = Number((quantity * 100).toFixed(2));
    const convertedPrice = Number((unitPrice / 100).toFixed(2));

    return {
      convertedQuantity: convertedQty,
      convertedUnitPrice: convertedPrice,
      factor: 100,
      explanation: `Conversão Cabo: 1 rolo padrão = 100 metros. Preço convertido: R$ ${convertedPrice.toFixed(2)}/m`,
      isConverted: true
    };
  }

  // Cabo comprado em KG e estocado em Metros
  if (isCable && normFrom === 'KG' && normTo === 'M') {
    const gauge = detectCableGauge(nameUpper);
    const kgPerMeter = gauge ? CABLE_WEIGHTS_KG_PER_METER[gauge] : 0.032; // default 2.5mm²
    const metersPerKg = 1 / kgPerMeter;
    const convertedQty = Number((quantity * metersPerKg).toFixed(2));
    const convertedPrice = Number((unitPrice * kgPerMeter).toFixed(2));

    return {
      convertedQuantity: convertedQty,
      convertedUnitPrice: convertedPrice,
      factor: metersPerKg,
      explanation: `Conversão Cabo ${gauge ? gauge + 'mm²' : 'cobre'}: 1 kg = ${metersPerKg.toFixed(1)} metros. Preço convertido: R$ ${convertedPrice.toFixed(2)}/m`,
      isConverted: true
    };
  }

  // 4. CASO: GÁS REFRIGERANTE E GASES INDUSTRIAIS (Botija/Cilindro <-> KG)
  const isGas = (
    nameUpper.includes('GAS') ||
    nameUpper.includes('GÁS') ||
    nameUpper.includes('REFRIGERANTE') ||
    nameUpper.includes('ACETILENO') ||
    nameUpper.includes('NITROGÊNIO') ||
    nameUpper.includes('NITROGENIO') ||
    nameUpper.includes('OXIGÊNIO') ||
    nameUpper.includes('OXIGENIO') ||
    nameUpper.includes('R-410') ||
    nameUpper.includes('R410') ||
    nameUpper.includes('R-22') ||
    nameUpper.includes('R22') ||
    nameUpper.includes('R-134') ||
    nameUpper.includes('R134') ||
    nameUpper.includes('R-32') ||
    nameUpper.includes('R32') ||
    nameUpper.includes('R-407') ||
    nameUpper.includes('R407') ||
    nameUpper.includes('R-141') ||
    nameUpper.includes('R141')
  );

  // 4A: Gás em Botija/Cilindro/Unidade -> convertendo para KG
  if (isGas && (normFrom === 'UN' || normFrom === 'CX' || normFrom === 'LATA' || normFrom === 'BOTIJA') && normTo === 'KG') {
    const kgPerCylinder = extractGasCylinderKg(nameUpper, fromUnit);
    const convertedQty = Number((quantity * kgPerCylinder).toFixed(2));
    const convertedPrice = Number((unitPrice / kgPerCylinder).toFixed(2));

    return {
      convertedQuantity: convertedQty,
      convertedUnitPrice: convertedPrice,
      factor: kgPerCylinder,
      explanation: `Conversão Gás: 1 botija/cilindro = ${kgPerCylinder} kg. Preço convertido: R$ ${convertedPrice.toFixed(2)}/kg`,
      isConverted: true
    };
  }

  // 4B: Gás informado em KG -> convertendo para Botija/Cilindro/Unidade de estoque
  if (isGas && normFrom === 'KG' && (normTo === 'UN' || normTo === 'CX' || normTo === 'LATA' || normTo === 'BOTIJA')) {
    const kgPerCylinder = extractGasCylinderKg(nameUpper, toUnit);
    const convertedQty = Number((quantity / kgPerCylinder).toFixed(2));
    const convertedPrice = Number((unitPrice * kgPerCylinder).toFixed(2));

    return {
      convertedQuantity: convertedQty,
      convertedUnitPrice: convertedPrice,
      factor: 1 / kgPerCylinder,
      explanation: `Conversão Gás em KG: ${quantity} kg = ${convertedQty} botija(s) (capacidade: ${kgPerCylinder} kg/botija). Preço convertido: R$ ${convertedPrice.toFixed(2)}/${toUnit}`,
      isConverted: true
    };
  }

  // 5. CASO: TUBOS EM BARRAS (Comprados em Barra e estocados em Metros)
  if (normFrom === 'BARRA' && normTo === 'M') {
    const length = nameUpper.includes('PVC') ? 6 : (nameUpper.includes('DRYWALL') || nameUpper.includes('PERFIL') ? 3 : 3);
    const convertedQty = Number((quantity * length).toFixed(2));
    const convertedPrice = Number((unitPrice / length).toFixed(2));

    return {
      convertedQuantity: convertedQty,
      convertedUnitPrice: convertedPrice,
      factor: length,
      explanation: `Conversão Barra: 1 barra = ${length} metros. Preço convertido: R$ ${convertedPrice.toFixed(2)}/m`,
      isConverted: true
    };
  }

  // 6. CASO: BARRAS ORÇADAS EM BARRAS E COMPRADAS EM METROS
  if (normFrom === 'M' && normTo === 'BARRA') {
    const length = nameUpper.includes('PVC') ? 6 : 3;
    const convertedQty = Number((quantity / length).toFixed(2));
    const convertedPrice = Number((unitPrice * length).toFixed(2));

    return {
      convertedQuantity: convertedQty,
      convertedUnitPrice: convertedPrice,
      factor: 1 / length,
      explanation: `Conversão Metros para Barra: ${length} metros = 1 barra. Preço convertido: R$ ${convertedPrice.toFixed(2)}/barra`,
      isConverted: true
    };
  }

  // Padrão se não houver regra específica de conversão
  return {
    convertedQuantity: Number(quantity),
    convertedUnitPrice: Number(unitPrice),
    factor: 1,
    explanation: `Conversão direta de ${normFrom} para ${normTo} (1:1)`,
    isConverted: false
  };
}
