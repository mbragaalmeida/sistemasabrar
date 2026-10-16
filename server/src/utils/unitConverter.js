/**
 * Utilitário de Conversão e Detecção de Unidades e Pacotes / Fracionamento no Backend
 */

export function parsePackageInfo(material) {
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

  // 2. Detecção por Regex para Rolos
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

export function convertItemQuantityAndPrice(material, requestedQty, requestedUnit) {
  const pkgInfo = parsePackageInfo(material);
  const qty = Number(requestedQty) || 0;
  const unit = (requestedUnit || pkgInfo.standardUnit || 'un').trim();

  const normUnit = unit.toLowerCase().trim();
  const normFrac = (pkgInfo.fractionalUnit || '').toLowerCase().trim();
  const isFractional = Boolean(
    pkgInfo.hasPackage && normFrac && (
      normUnit === normFrac ||
      (normFrac === 'm' && (normUnit === 'm' || normUnit === 'metro' || normUnit === 'metros')) ||
      (normFrac === 'kg' && (normUnit === 'kg' || normUnit === 'quilo' || normUnit === 'quilos'))
    )
  );

  if (isFractional) {
    const standardQty = pkgInfo.packageMultiplier > 0 ? (qty / pkgInfo.packageMultiplier) : qty;
    const unitPrice = pkgInfo.fractionalPrice != null ? pkgInfo.fractionalPrice : (pkgInfo.standardPrice / pkgInfo.packageMultiplier);
    return {
      isFractional: true,
      standardQty,
      requestedQty: qty,
      unit,
      standardUnit: pkgInfo.standardUnit,
      packageMultiplier: pkgInfo.packageMultiplier,
      unitPrice,
      totalPrice: Number((qty * unitPrice).toFixed(2))
    };
  }

  return {
    isFractional: false,
    standardQty: qty,
    requestedQty: qty,
    unit,
    standardUnit: pkgInfo.standardUnit,
    packageMultiplier: 1,
    unitPrice: pkgInfo.standardPrice,
    totalPrice: Number((qty * pkgInfo.standardPrice).toFixed(2))
  };
}
