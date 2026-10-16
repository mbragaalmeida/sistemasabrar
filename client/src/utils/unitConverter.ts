/**
 * Utilitário de Conversão e Detecção de Unidades e Pacotes / Fracionamento
 * Suporta cabos elétricos (rolo -> metros), botijões de gás (botija -> kg), fitas (rolo -> metros), etc.
 */

export interface PackageInfo {
  hasPackage: boolean;
  standardUnit: string;
  fractionalUnit: string | null;
  packageMultiplier: number;
  standardPrice: number;
  fractionalPrice: number | null;
}

export interface UnitOption {
  value: string;
  label: string;
  shortLabel: string;
  isFractional: boolean;
  multiplier: number; // Multiplica pela quantidade nesta unidade para obter a quantidade em unidade padrão
  unitPrice: number;
}

export const COMMON_UNITS = [
  'un',
  'm',
  'kg',
  'L',
  'cx',
  'rolo',
  'barra',
  'par',
  'kit',
  'pç'
];

/**
 * Analisa e extrai informações de pacote e conversão de um material
 */
export function parsePackageInfo(material?: {
  name?: string;
  unit?: string;
  package_content?: number | null;
  converted_unit?: string | null;
  reference_price?: number | null;
  converted_price?: number | null;
} | null): PackageInfo {
  if (!material) {
    return {
      hasPackage: false,
      standardUnit: 'un',
      fractionalUnit: null,
      packageMultiplier: 1,
      standardPrice: 0,
      fractionalPrice: null
    };
  }

  const normName = (material.name || '').trim();
  const normUnit = (material.unit || 'un').trim();
  const refPrice = Number(material.reference_price) || 0;

  // 1. Se o banco de dados já possui package_content e converted_unit explícitos
  if (material.package_content && Number(material.package_content) > 0 && material.converted_unit) {
    const pkg = Number(material.package_content);
    const convUnit = material.converted_unit.trim();
    const convPrice = material.converted_price != null
      ? Number(material.converted_price)
      : (pkg > 0 ? Number((refPrice / pkg).toFixed(4)) : refPrice);

    return {
      hasPackage: true,
      standardUnit: normUnit,
      fractionalUnit: convUnit,
      packageMultiplier: pkg,
      standardPrice: refPrice,
      fractionalPrice: convPrice
    };
  }

  // 2. Detecção por Regex para Rolos (cabos, fitas, mangueiras)
  const rollMatch = normName.match(/rolo\s*(?:c\/|de|\:)?\s*(\d+(?:[\,\.]\d+)?)\s*(?:metros?|m\b)/i) ||
                    normUnit.match(/rolo\s*(?:c\/|de|\:)?\s*(\d+(?:[\,\.]\d+)?)\s*(?:metros?|mt?|m\b)/i) ||
                    normName.match(/\((\s*rolo\s*(\d+)\s*metros?\s*)\)/i) ||
                    normName.match(/(\d+(?:[\,\.]\d+)?)\s*(?:metros?)\b/i);

  if (rollMatch) {
    const rawVal = rollMatch[2] || rollMatch[1];
    const pkg = parseFloat(String(rawVal).replace(',', '.'));
    if (pkg > 0 && (normName.toLowerCase().includes('rolo') || normUnit.toLowerCase().includes('rolo') || normName.toLowerCase().includes('cabo') || normName.toLowerCase().includes('fita'))) {
      return {
        hasPackage: true,
        standardUnit: normUnit || 'rolo',
        fractionalUnit: 'm',
        packageMultiplier: pkg,
        standardPrice: refPrice,
        fractionalPrice: Number((refPrice / pkg).toFixed(4))
      };
    }
  }

  // 3. Detecção por Regex para Botijões de Gás / Refrigerantes / Químicos em KG
  const kgMatch = normName.match(/(\d+(?:[\,\.]\d+)?)\s*k(?:g|ilos?)\b/i) ||
                  normUnit.match(/(\d+(?:[\,\.]\d+)?)\s*k(?:g|ilos?)\b/i);

  if (kgMatch && (normName.toLowerCase().includes('gás') || normUnit.toLowerCase().includes('botij') || normUnit.toLowerCase().includes('lata') || normName.toLowerCase().includes('refrigerante'))) {
    const pkg = parseFloat(kgMatch[1].replace(',', '.'));
    if (pkg > 0) {
      return {
        hasPackage: true,
        standardUnit: normUnit || 'botija',
        fractionalUnit: 'kg',
        packageMultiplier: pkg,
        standardPrice: refPrice,
        fractionalPrice: Number((refPrice / pkg).toFixed(4))
      };
    }
  }

  // 4. Detecção de Caixas ou Pacotes com unidades internas (CX C/ 100, PCT C/ 50)
  const boxMatch = normName.match(/(?:cx|caixa|pct|pacote)\s*(?:c\/|de|\:)?\s*(\d+)\s*(?:un|und|peças|pçs)?/i) ||
                   normUnit.match(/(?:cx|caixa|pct|pacote)\s*(?:c\/|de|\:)?\s*(\d+)\s*(?:un|und|peças|pçs)?/i);

  if (boxMatch) {
    const pkg = parseInt(boxMatch[1], 10);
    if (pkg > 1) {
      return {
        hasPackage: true,
        standardUnit: normUnit || 'cx',
        fractionalUnit: 'un',
        packageMultiplier: pkg,
        standardPrice: refPrice,
        fractionalPrice: Number((refPrice / pkg).toFixed(4))
      };
    }
  }

  // 5. Padrão sem fracionamento identificado
  return {
    hasPackage: false,
    standardUnit: normUnit,
    fractionalUnit: null,
    packageMultiplier: 1,
    standardPrice: refPrice,
    fractionalPrice: null
  };
}

/**
 * Retorna as opções de unidade selecionáveis para o material
 */
export function getUnitOptions(material?: {
  name?: string;
  unit?: string;
  package_content?: number | null;
  converted_unit?: string | null;
  reference_price?: number | null;
  converted_price?: number | null;
} | null): UnitOption[] {
  const pkgInfo = parsePackageInfo(material);

  const options: UnitOption[] = [
    {
      value: pkgInfo.standardUnit,
      label: pkgInfo.hasPackage
        ? `${pkgInfo.standardUnit} (emb. inteira - R$ ${formatMoney(pkgInfo.standardPrice)})`
        : `${pkgInfo.standardUnit} (R$ ${formatMoney(pkgInfo.standardPrice)})`,
      shortLabel: pkgInfo.standardUnit,
      isFractional: false,
      multiplier: 1,
      unitPrice: pkgInfo.standardPrice
    }
  ];

  if (pkgInfo.hasPackage && pkgInfo.fractionalUnit && pkgInfo.fractionalUnit !== pkgInfo.standardUnit) {
    const fracLabel = pkgInfo.fractionalUnit === 'm' ? 'metros (m)' :
                      pkgInfo.fractionalUnit === 'kg' ? 'quilos (kg)' :
                      pkgInfo.fractionalUnit;

    options.push({
      value: pkgInfo.fractionalUnit,
      label: `${fracLabel} - R$ ${formatMoney(pkgInfo.fractionalPrice || 0)}/${pkgInfo.fractionalUnit}`,
      shortLabel: pkgInfo.fractionalUnit,
      isFractional: true,
      multiplier: 1 / pkgInfo.packageMultiplier,
      unitPrice: pkgInfo.fractionalPrice || 0
    });
  }

  return options;
}

/**
 * Converte a quantidade ao alternar de uma unidade para outra
 */
export function convertQuantity(
  qty: number,
  fromUnit: string,
  toUnit: string,
  pkgInfo: PackageInfo
): number {
  if (!qty || isNaN(qty) || fromUnit === toUnit || !pkgInfo.hasPackage) {
    return qty;
  }

  const isFromStandard = fromUnit.toLowerCase().trim() === pkgInfo.standardUnit.toLowerCase().trim();
  const isToStandard = toUnit.toLowerCase().trim() === pkgInfo.standardUnit.toLowerCase().trim();

  const isFromFractional = pkgInfo.fractionalUnit && fromUnit.toLowerCase().trim() === pkgInfo.fractionalUnit.toLowerCase().trim();
  const isToFractional = pkgInfo.fractionalUnit && toUnit.toLowerCase().trim() === pkgInfo.fractionalUnit.toLowerCase().trim();

  // De Padrão (ex: rolo) para Fracionada (ex: m) -> Multiplica pelo pacote (1 rolo = 100m)
  if (isFromStandard && isToFractional) {
    const converted = qty * pkgInfo.packageMultiplier;
    return Number(converted.toFixed(2));
  }

  // De Fracionada (ex: m) para Padrão (ex: rolo) -> Divide pelo pacote (10m = 0.1 rolo)
  if (isFromFractional && isToStandard) {
    const converted = qty / pkgInfo.packageMultiplier;
    return Number(converted.toFixed(4));
  }

  return qty;
}

/**
 * Obtém o preço unitário para a unidade escolhida
 */
export function getUnitPriceForUnit(unit: string, pkgInfo: PackageInfo): number {
  if (pkgInfo.hasPackage && pkgInfo.fractionalUnit && unit.toLowerCase().trim() === pkgInfo.fractionalUnit.toLowerCase().trim()) {
    return pkgInfo.fractionalPrice || 0;
  }
  return pkgInfo.standardPrice;
}

export function formatMoney(val: number): string {
  return Number(val || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}
