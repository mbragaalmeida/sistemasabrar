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
 * Retorna as opções de unidade selecionáveis para o material (sempre com opções de troca)
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
  const rawUnit = (material?.unit || pkgInfo.standardUnit || 'un').trim();

  const options: UnitOption[] = [];
  const addedValues = new Set<string>();

  // 1. Unidade padrão do item / embalagem inteira
  options.push({
    value: rawUnit,
    label: pkgInfo.hasPackage
      ? `${rawUnit} (embalagem inteira - R$ ${formatMoney(pkgInfo.standardPrice)})`
      : `${rawUnit} (R$ ${formatMoney(pkgInfo.standardPrice)})`,
    shortLabel: rawUnit,
    isFractional: false,
    multiplier: 1,
    unitPrice: pkgInfo.standardPrice
  });
  addedValues.add(rawUnit.toLowerCase());

  // Se o standardUnit for diferente do rawUnit (ex: "rolo" vs "rolo c/ 100 metros")
  if (pkgInfo.standardUnit && !addedValues.has(pkgInfo.standardUnit.toLowerCase())) {
    options.push({
      value: pkgInfo.standardUnit,
      label: `${pkgInfo.standardUnit} (embalagem inteira)`,
      shortLabel: pkgInfo.standardUnit,
      isFractional: false,
      multiplier: 1,
      unitPrice: pkgInfo.standardPrice
    });
    addedValues.add(pkgInfo.standardUnit.toLowerCase());
  }

  // 2. Unidade fracionada calculada (ex: rolo de 100m -> m; botijão 13,6kg -> kg)
  if (pkgInfo.hasPackage && pkgInfo.fractionalUnit && !addedValues.has(pkgInfo.fractionalUnit.toLowerCase())) {
    const fracLabel = pkgInfo.fractionalUnit === 'm' ? 'metro(s) (m)' :
                      pkgInfo.fractionalUnit === 'kg' ? 'quilo(s) (kg)' :
                      pkgInfo.fractionalUnit;

    options.push({
      value: pkgInfo.fractionalUnit,
      label: `${fracLabel} - R$ ${formatMoney(pkgInfo.fractionalPrice || 0)}/${pkgInfo.fractionalUnit}`,
      shortLabel: pkgInfo.fractionalUnit,
      isFractional: true,
      multiplier: 1 / pkgInfo.packageMultiplier,
      unitPrice: pkgInfo.fractionalPrice || 0
    });
    addedValues.add(pkgInfo.fractionalUnit.toLowerCase());
  }

  // 3. Unidades comuns para permitir troca de unidade em qualquer material
  const commonToAdd = ['un', 'm', 'kg', 'rolo', 'cx', 'barra', 'L', 'par', 'kit', 'pç'];
  for (const u of commonToAdd) {
    if (!addedValues.has(u.toLowerCase())) {
      const isFrac = Boolean(
        pkgInfo.hasPackage &&
        pkgInfo.fractionalUnit &&
        u.toLowerCase() === pkgInfo.fractionalUnit.toLowerCase()
      );
      const uPrice = isFrac ? (pkgInfo.fractionalPrice || 0) : pkgInfo.standardPrice;
      const mult = isFrac ? (1 / pkgInfo.packageMultiplier) : 1;

      options.push({
        value: u,
        label: isFrac
          ? `${u} (fracionado - R$ ${formatMoney(uPrice)}/${u})`
          : u,
        shortLabel: u,
        isFractional: isFrac,
        multiplier: mult,
        unitPrice: uPrice
      });
      addedValues.add(u.toLowerCase());
    }
  }

  return options;
}

/**
 * Converte a quantidade ao alternar de uma unidade para outra com suporte a apelidos flexíveis
 */
export function convertQuantity(
  qty: number,
  fromUnit: string,
  toUnit: string,
  pkgInfo: PackageInfo
): number {
  if (!qty || isNaN(qty) || fromUnit.toLowerCase().trim() === toUnit.toLowerCase().trim()) {
    return qty;
  }

  if (!pkgInfo || !pkgInfo.hasPackage || !pkgInfo.fractionalUnit) {
    return qty;
  }

  const normFrom = fromUnit.toLowerCase().trim();
  const normTo = toUnit.toLowerCase().trim();
  const normFrac = pkgInfo.fractionalUnit.toLowerCase().trim();
  const normStd = (pkgInfo.standardUnit || '').toLowerCase().trim();

  // Verifica se é a unidade fracionada (ex: "m" ou "kg")
  const isFromFrac = normFrom === normFrac ||
                     (normFrac === 'm' && (normFrom === 'm' || normFrom === 'metro' || normFrom === 'metros')) ||
                     (normFrac === 'kg' && (normFrom === 'kg' || normFrom === 'quilo' || normFrom === 'quilos'));

  const isToFrac = normTo === normFrac ||
                   (normFrac === 'm' && (normTo === 'm' || normTo === 'metro' || normTo === 'metros')) ||
                   (normFrac === 'kg' && (normTo === 'kg' || normTo === 'quilo' || normTo === 'quilos'));

  // Verifica se é a unidade inteira de embalagem (ex: "rolo", "rolo c/ 100 metros", "botijão", "cx")
  const isFromStd = normFrom === normStd || normFrom.includes('rolo') || normFrom.includes('botij') || normFrom.includes('cx') || normFrom === 'un' || normFrom === 'und';
  const isToStd = normTo === normStd || normTo.includes('rolo') || normTo.includes('botij') || normTo.includes('cx') || normTo === 'un' || normTo === 'und';

  // De Inteira (rolo) para Fracionada (m) -> 1 rolo = 100m
  if (isFromStd && isToFrac) {
    const converted = qty * pkgInfo.packageMultiplier;
    return Number(converted.toFixed(2));
  }

  // De Fracionada (m) para Inteira (rolo) -> 10m = 0.10 rolo
  if (isFromFrac && isToStd) {
    const converted = qty / pkgInfo.packageMultiplier;
    return Number(converted.toFixed(4));
  }

  return qty;
}

/**
 * Obtém o preço unitário para a unidade escolhida
 */
export function getUnitPriceForUnit(unit: string, pkgInfo: PackageInfo): number {
  if (!pkgInfo) return 0;
  if (!unit) return pkgInfo.standardPrice;

  const normUnit = unit.toLowerCase().trim();
  const normFrac = (pkgInfo.fractionalUnit || '').toLowerCase().trim();

  if (pkgInfo.hasPackage && normFrac) {
    const isFrac = normUnit === normFrac ||
                   (normFrac === 'm' && (normUnit === 'm' || normUnit === 'metro' || normUnit === 'metros')) ||
                   (normFrac === 'kg' && (normUnit === 'kg' || normUnit === 'quilo' || normUnit === 'quilos'));

    if (isFrac) {
      return pkgInfo.fractionalPrice != null ? pkgInfo.fractionalPrice : (pkgInfo.standardPrice / pkgInfo.packageMultiplier);
    }
  }

  return pkgInfo.standardPrice;
}

export function formatMoney(val: number): string {
  return Number(val || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/**
 * Higieniza o texto de unidade para garantir que números ou quantidades digitados por engano
 * no campo de unidade sejam removidos (ex: '34 un' -> 'un', '1 un' -> 'un', '2 m' -> 'm').
 */
export function sanitizeUnit(unit?: string | null): string {
  if (!unit) return 'un';
  const trimmed = String(unit).trim();
  // Se contiver padrão de embalagem (ex: 'rolo c/ 10 metros', 'cx c/ 50'), preserva integralmente
  if (/^(rolo|cx|caixa|pacote|pct|lata|fardo|barra)\s+c\//i.test(trimmed)) {
    return trimmed;
  }
  // Remove número e espaço no início: '34 un' -> 'un', '2 pç' -> 'pç'
  const cleaned = trimmed.replace(/^[\d.,]+\s*/, '').trim();
  return cleaned || 'un';
}
