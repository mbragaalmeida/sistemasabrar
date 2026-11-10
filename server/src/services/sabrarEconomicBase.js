/**
 * BASE ECONÔMICA E DE MATERIAIS SABRAR — FONTE OFICIAL DE PRECIFICAÇÃO
 * Atualização: 28/09/2026
 * 
 * Contém a Base Oficial de 757 Materiais com custos médios de referência,
 * sinônimos técnicos, conversões de embalagem, pesos lineares e catálogo de serviços preservados.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const materialsPath = path.resolve(__dirname, '../data/sabrarMaterialsBase2026.json');
const servicesPath = path.resolve(__dirname, '../data/sabrarServicesBase.json');

const rawMaterials = fs.existsSync(materialsPath) 
  ? JSON.parse(fs.readFileSync(materialsPath, 'utf8')) 
  : [];

const rawServices = fs.existsSync(servicesPath)
  ? JSON.parse(fs.readFileSync(servicesPath, 'utf8'))
  : [];

// Mapeia materiais oficiais da SABRAR com metadados completos
export const SABRAR_MATERIALS_2026 = rawMaterials.map(m => ({
  code: m.code,
  item: m.name,
  category: m.category,
  unit: m.unit,
  price: m.price,
  synonyms: m.synonyms,
  linear_weight: m.linearWeight,
  linear_weight_unit: m.linearWeightUnit,
  package_content: m.packageContent,
  converted_unit: m.convertedUnit,
  converted_price: m.convertedPrice,
  validation_status: m.validationStatus,
  pending_notes: m.pendingNotes,
  supplier: 'SABRAR',
  context: 'Base Oficial 28/09/2026'
}));

// Base consolidada: 757 materiais oficiais + serviços/mão de obra preservados (Regra 12)
export const SABRAR_ECONOMIC_BASE_ITEMS = [...SABRAR_MATERIALS_2026, ...rawServices];

// Gera texto canônico para injeção no prompt do Agente de IA
export const SABRAR_ECONOMIC_BASE_TEXT = `BASE OFICIAL DE MATERIAIS E PREÇOS SABRAR (Atualização: 28/09/2026)
Total de materiais catalogados: ${SABRAR_MATERIALS_2026.length} materiais com custos médios oficiais em BRL.

REGRAS TÉCNICAS E ECONÔMICAS:
1. Cada custo médio corresponde à unidade de precificação declarada. Não interpretar todos os preços como unitários por peça ou metro.
2. Metro (m): preço por 1 metro. Quilograma (kg): preço por 1 kg. Unidade (un): preço por 1 unidade.
3. Rolo, peça, vara, lata ou botija: preço da embalagem inteira. Para calcular o custo por metro, kg ou litro, utilizar o custo convertido registrado separadamente.
4. Tubos de cobre: são precificados por metro linear. O peso em kg/m é uma especificação técnica separada para peso da instalação. Não multiplicar o preço por metro pelo peso linear.
5. Sinônimos: devem ser utilizados para busca e identificação inteligente de itens pelo agente.
6. Registros com pendência: devem ser sinalizados para validação humana antes da emissão definitiva do orçamento.

CATÁLOGO RESUMIDO DE MATERIAIS E PREÇOS:
${SABRAR_MATERIALS_2026.map(m => `[${m.category}] ${m.code} - ${m.item} | Unidade: ${m.unit} | Custo: R$ ${m.price.toFixed(m.price % 1 !== 0 ? (m.price.toString().split('.')[1]?.length || 2) : 2)}${m.converted_price ? ` (Conv: R$ ${m.converted_price}/${m.converted_unit})` : ''}${m.linear_weight ? ` [Peso: ${m.linear_weight} ${m.linear_weight_unit}]` : ''}${m.synonyms ? ` {Sinônimos: ${m.synonyms}}` : ''}${m.validation_status === 'VALIDAR' ? ' <VALIDAR>' : ''}`).join('\n')}
`;

export function normalizeTechString(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[º°]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractTechnicalAttributes(text) {
  const result = {
    wallThicknesses: [],
    nominalDiameters: [],
    rectDimensions: [],
    thicknessMm: [],
    sheetGauges: [],
    copperTemper: null
  };
  if (!text) return result;

  const norm = normalizeTechString(text).replace(/pol\b|polegadas?\b/g, '"');
  const wallSet = new Set();
  const diamSet = new Set();
  const rectSet = new Set();
  const thickSet = new Set();
  const gaugeSet = new Set();

  // 1. Espessuras de parede explícitas: e=1/16", e= 1/32", esp=1/16, parede 1/16, ou entre parênteses (1/32"), (1/16"), (3/64")
  const explicitWallRegex = /(?:e\s*=|esp(?:essura)?\s*[:=]?|parede\s*(?:de)?\s*)\s*(\d+\/\d+|\d+(?:[.,]\d+)?\s*mm)/gi;
  let m;
  while ((m = explicitWallRegex.exec(norm)) !== null) {
    const rawW = m[1].replace(/\s+/g, '').replace(',', '.');
    if (rawW === '0.79mm' || rawW === '0.8mm') wallSet.add('1/32');
    else if (rawW === '1.58mm' || rawW === '1.59mm' || rawW === '1.6mm') wallSet.add('1/16');
    else if (rawW === '1.19mm' || rawW === '1.2mm') wallSet.add('3/64');
    else wallSet.add(rawW);
  }

  const parenWallRegex = /\(\s*(1\/32|1\/16|3\/64)\s*["'']?\s*\)/g;
  while ((m = parenWallRegex.exec(norm)) !== null) {
    wallSet.add(m[1]);
  }

  // Em tubos de cobre, frações 1/32, 1/16 e 3/64 são sempre espessuras de parede (diâmetros comerciais começam em 1/4")
  const copperWallFractions = new Set(['1/32', '1/16', '3/64']);
  const simpWallRegex = /\b(1\/32|1\/16|3\/64)\b/g;
  while ((m = simpWallRegex.exec(norm)) !== null) {
    wallSet.add(m[1]);
  }

  // 2. Dimensões retangulares 2D (ex: 600x300mm, 600x600, 15"x15", 300x450mm, 38x38)
  // Ignora padrões elétricos como 3x18 awg ou 4x2.5mm² e painéis 2,0x1,2m
  const rectRegex = /\b(\d{2,4})\s*["'”xX*×]\s*(\d{2,4})\s*(mm|cm|["'”])?(?!\s*(?:awg|mm2|mm²))/gi;
  while ((m = rectRegex.exec(norm)) !== null) {
    const d1 = parseInt(m[1], 10);
    const d2 = parseInt(m[2], 10);
    if (d1 >= 10 && d2 >= 10) {
      rectSet.add(`${d1}x${d2}`);
    }
  }

  // 3. Bitolas de chapa (#16, #18, #20, #22, #24, #26)
  const sheetGaugeRegex = /(?:#\s*(16|18|20|22|24|26)\b|\b(?:chapa|bitola)\s*#?\s*(16|18|20|22|24|26)\b)/gi;
  while ((m = sheetGaugeRegex.exec(norm)) !== null) {
    gaugeSet.add(`#${m[1] || m[2]}`);
  }

  // 4. Diâmetros nominais compostos: 1.1/8", 1 1/8", 1-1/8", 2.1/2", etc.
  const compRegex = /\b(\d+)[\s.-]+(\d+\/\d+)["'']?/g;
  while ((m = compRegex.exec(norm)) !== null) {
    diamSet.add(`${m[1]}.${m[2]}`);
  }

  // 5. Diâmetros nominais simples em fração (excluindo espessuras 1/32, 1/16, 3/64): 1/4", 3/8", 1/2", 5/8", 3/4", 7/8"
  const simpRegex = /(?<!\d[\s.-])\b(\d+\/\d+)["'']?/g;
  while ((m = simpRegex.exec(norm)) !== null) {
    if (!copperWallFractions.has(m[1])) {
      diamSet.add(m[1]);
    }
  }

  // Diâmetro inteiro em polegadas para cobre/hidráulica (ex: "- 1" -", "tubo 1\"", "2\"")
  const wholeInchRegex = /(?:-\s*|\btubo[^0-9]{1,20}?)\b([1234])\s*["''](?!\s*[xX×])/g;
  while ((m = wholeInchRegex.exec(norm)) !== null) {
    diamSet.add(`${m[1]}"`);
  }

  // 6. Milímetros (separa diâmetros equivalentes de cobre vs espessuras de painel/isolamento)
  const mmRegex = /\b(\d+(?:[.,]\d+)?)\s*mm\b/g;
  while ((m = mmRegex.exec(norm)) !== null) {
    const val = parseFloat(m[1].replace(',', '.'));
    const beforeMm = norm.slice(Math.max(0, m.index - 15), m.index);
    if (/(?:e\s*=|esp|parede)/i.test(beforeMm)) continue;

    if (Math.abs(val - 6.35) < 0.2) diamSet.add('1/4');
    else if (Math.abs(val - 9.52) < 0.2) diamSet.add('3/8');
    else if (Math.abs(val - 12.7) < 0.2) diamSet.add('1/2');
    else if (Math.abs(val - 15.88) < 0.3) diamSet.add('5/8');
    else if (Math.abs(val - 19.05) < 0.3) diamSet.add('3/4');
    else if (Math.abs(val - 22.2) < 0.3) diamSet.add('7/8');
    else if (Math.abs(val - 25.4) < 0.3) diamSet.add('1"');
    else if (Math.abs(val - 28.57) < 0.8) diamSet.add('1.1/8');
    else if (Math.abs(val - 31.75) < 0.5) diamSet.add('1.1/4');
    else if (Math.abs(val - 34.9) < 0.8) diamSet.add('1.3/8');
    else if (Math.abs(val - 38.1) < 0.5) diamSet.add('1.1/2');
    else if (Math.abs(val - 41.3) < 0.8) diamSet.add('1.5/8');
    else if ([9, 10, 13, 19, 20, 25, 30, 32, 38, 50].includes(val)) {
      thickSet.add(`${val}mm`);
    }
  }

  // 7. Código Armaflex: M028 / R028 / T028 -> 1.1/8 (28mm), H015 / M015 -> 5/8 (15mm)
  const armaflexCodeMatch = norm.match(/\b([mrhpt])0?(\d{2,3})\b/);
  if (armaflexCodeMatch) {
    const mmNum = parseInt(armaflexCodeMatch[2], 10);
    if (mmNum === 28) diamSet.add('1.1/8');
    else if (mmNum === 15) diamSet.add('5/8');
    else if (mmNum === 22) diamSet.add('7/8');
    else if (mmNum === 18 || mmNum === 19) diamSet.add('3/4');
    else if (mmNum === 10 || mmNum === 9) diamSet.add('3/8');
    else if (mmNum === 6) diamSet.add('1/4');
    else if (mmNum === 35) diamSet.add('1.3/8');
    else if (mmNum === 42) diamSet.add('1.5/8');
  }

  // 8. Têmpera do tubo de cobre (rígido vs flexível)
  const hasRigido = /\brigid[oa]\b/i.test(norm);
  const hasFlexivel = /\bflex[ií]vel\b/i.test(norm);
  if (hasRigido && hasFlexivel) result.copperTemper = 'AMBOS';
  else if (hasRigido) result.copperTemper = 'RIGIDO';
  else if (hasFlexivel) result.copperTemper = 'FLEXIVEL';

  result.wallThicknesses = [...wallSet];
  result.nominalDiameters = [...diamSet];
  result.rectDimensions = [...rectSet];
  result.thicknessMm = [...thickSet];
  result.sheetGauges = [...gaugeSet];
  return result;
}

export function extractExactGauges(text) {
  if (!text) return [];
  const attrs = extractTechnicalAttributes(text);
  return [...new Set([...attrs.nominalDiameters, ...attrs.wallThicknesses, ...attrs.thicknessMm, ...attrs.rectDimensions])];
}

export function checkTechnicalCompatibility(searchStr, entryStr, categoryStr = '', synonymsStr = '', queryGauges = null, entryGauges = null) {
  const searchNorm = normalizeTechString(searchStr || '');
  const entryNorm = normalizeTechString(entryStr || '');
  const categoryNorm = normalizeTechString(categoryStr || '');
  const synonymsNorm = normalizeTechString(synonymsStr || '');
  const qGauges = Array.isArray(queryGauges) ? queryGauges : extractExactGauges(searchNorm);
  const entGauges = Array.isArray(entryGauges) ? entryGauges : extractExactGauges(`${entryNorm} ${synonymsNorm}`);
  const fullCandidate = `${entryNorm} ${categoryNorm} ${synonymsNorm}`;

  const qAttrs = extractTechnicalAttributes(searchNorm);
  const entAttrs = extractTechnicalAttributes(`${entryNorm} ${synonymsNorm}`);

  // 1. Difusão de Ar (Difusor, Grelha, Damper, Veneziana, Plenum)
  const isAirDiffQuery = /\b(difusor|grelha|damper|veneziana|plenum)\b/i.test(searchNorm);
  if (isAirDiffQuery) {
    // Válvulas hidráulicas, tubos e fixações nunca podem casar com difusão
    if (/\b(valvula|esfera|hidraulica|hidraulico|tubo|flange|parafuso|bucha|abracadeira|terminal|garfo)\b/i.test(fullCandidate)) {
      return false;
    }
    const isAirDiffCandidate = /\b(difusor|grelha|damper|veneziana|plenum)\b/i.test(fullCandidate) || categoryNorm.includes('difus');
    if (!isAirDiffCandidate) {
      return false;
    }
    // Subtipo de difusão deve coincidir (difusor != grelha != damper)
    if (/\bdifusor\b/i.test(searchNorm) && !/\bdifusor\b/i.test(fullCandidate)) return false;
    if (/\bgrelha\b/i.test(searchNorm) && !/\bgrelha\b/i.test(fullCandidate)) return false;
    if (/\bdamper\b/i.test(searchNorm) && !/\bdamper\b/i.test(fullCandidate)) return false;
  }

  // 2. Válvulas e Registros Hidráulicos
  const isValveQuery = /\b(valvula|registro de esfera|registro de gaveta|registro globo)\b/i.test(searchNorm);
  if (isValveQuery && !isAirDiffQuery) {
    if (/\b(difusor|grelha|damper)\b/i.test(fullCandidate)) return false;
  }

  // 3. Tubulação de Cobre — Exige todos os atributos técnicos obrigatórios (diâmetro nominal, espessura de parede e têmpera)
  const isCopperTubeQuery = !/\b(cambota|abracadeira|suporte|isolamento|armaflex|armafix)\b/i.test(searchNorm) && (
    (/\b(tubo|tubulacao)\b/i.test(searchNorm) && /\b(cobre)\b/i.test(searchNorm)) ||
    (/\bcobre\b/i.test(searchNorm) && (qAttrs.wallThicknesses.length > 0 || /\b(rigid[oa]|flex[ií]vel)\b/i.test(searchNorm)))
  );
  if (isCopperTubeQuery) {
    if (!categoryNorm.includes('cobre') && !entryNorm.includes('cobre')) return false;
    if (categoryNorm && !/(?:cobre|climatiz|frigor|tubulac)/i.test(categoryNorm)) return false;
    if (/\b(cambota|abracadeira|suporte|aco|carbono|preto|sch\s*40|pvc|galvanizado|curva|luva|te|porca flange|uniao|reducao|sifao|fita|vareta|solda)\b/i.test(fullCandidate)) return false;
    if (!/\btubo\b/i.test(entryNorm)) return false;

    // 3a. Espessura de parede obrigatória (ex: 1/16" NUNCA pode vincular a 1/32" nem a item sem espessura)
    if (qAttrs.wallThicknesses.length > 0) {
      if (entAttrs.wallThicknesses.length === 0) return false;
      const wallMatch = qAttrs.wallThicknesses.every(w => entAttrs.wallThicknesses.includes(w));
      if (!wallMatch) return false;
    }

    // 3b. Diâmetro nominal obrigatório (ex: 1.1/8" NUNCA pode vincular a 3/4" apenas por compartilhar parede 1/16")
    if (qAttrs.nominalDiameters.length > 0) {
      if (entAttrs.nominalDiameters.length === 0) return false;
      const diamMatch = qAttrs.nominalDiameters.every(d => entAttrs.nominalDiameters.includes(d));
      if (!diamMatch) return false;
    }

    // 3c. Têmpera (rígido vs flexível) quando especificada exclusivamente
    if (qAttrs.copperTemper && qAttrs.copperTemper !== 'AMBOS' && entAttrs.copperTemper && entAttrs.copperTemper !== 'AMBOS') {
      if (qAttrs.copperTemper !== entAttrs.copperTemper) return false;
    }
  }

  // 4. Conexões de Cobre
  const isCopperFittingQuery = /\b(curva|luva|te|uniao|reducao)\b/i.test(searchNorm) && /\bcobre\b/i.test(searchNorm);
  if (isCopperFittingQuery) {
    if (/\btubo\b/i.test(entryNorm) && !/\b(curva|luva|te|uniao|reducao)\b/i.test(entryNorm)) return false;
  }

  // 5. Barra Roscada / Tirante vs Alongador
  const isRodQuery = /\b(barra roscada|tirante)\b/i.test(searchNorm) && !/\b(alongador|prolongador|luva)\b/i.test(searchNorm);
  if (isRodQuery) {
    if (/\b(alongador|prolongador|juncao sextavada)\b/i.test(fullCandidate)) return false;
    if (!/\bbarra roscada\b/i.test(fullCandidate)) return false;
  }

  // 6. Alongador / Prolongador de Tirante
  const isExtenderQuery = /\b(alongador|prolongador)\b/i.test(searchNorm);
  if (isExtenderQuery) {
    if (!/\b(alongador|prolongador|juncao sextavada)\b/i.test(fullCandidate)) return false;
  }

  // 7. Isolamento Tubo Armaflex vs Fita / Adesivo
  const isArmaflexTubeQuery = /\b(armaflex|espuma elastomerica)\b/i.test(searchNorm) && !/\b(fita|cinta|adesivo|cola|manta)\b/i.test(searchNorm);
  if (isArmaflexTubeQuery) {
    if (/\b(cinta|fita|adesivo|cola|manta)\b/i.test(fullCandidate)) return false;
    if (!/\b(espuma elastomerica|armaflex)\b/i.test(fullCandidate)) return false;
  }

  // 8. Fitas adesivas distintas
  if (/\bfita tdc\b/i.test(searchNorm) && !/\btdc\b/i.test(fullCandidate)) return false;
  if (/\bfita aluminio\b/i.test(searchNorm) && !/\baluminio\b/i.test(fullCandidate)) return false;
  if (/\bfita armaflex\b/i.test(searchNorm) && !/\barmaflex\b/i.test(fullCandidate)) return false;

  // 9. MPU: Painel vs Chapa metálica e Acessórios
  const isMpuQuery = /\bmpu\b/i.test(searchNorm);
  if (isMpuQuery) {
    if (/\b(galvanizad|chapa preta|tdc)\b/i.test(fullCandidate) && !categoryNorm.includes('mpu')) return false;
    // Se a busca for por PAINEL MPU, rejeita cantos, perfis, cola, fitas, parafusos
    const isAccessoryMpuQuery = /\b(canto|cantoneira|perfil|parafuso|fita|selante|disco|cola|barra de reforco)\b/i.test(searchNorm);
    const isAccessoryMpuEntry = /\b(canto|cantoneira|perfil|parafuso|fita|selante|disco|cola|barra de reforco)\b/i.test(entryNorm);
    if (!isAccessoryMpuQuery && /\bpainel\b/i.test(searchNorm) && isAccessoryMpuEntry) {
      return false;
    }
    // Se a busca for por acessório MPU (perfil, canto, cola, fita, selante), rejeita painel
    if (isAccessoryMpuQuery && !isAccessoryMpuEntry && /\bpainel\b/i.test(entryNorm)) {
      return false;
    }
    // Espessura do painel MPU (20mm vs 30mm) deve coincidir
    if (qAttrs.thicknessMm.length > 0 && entAttrs.thicknessMm.length > 0) {
      const thickMatch = qAttrs.thicknessMm.every(t => entAttrs.thicknessMm.includes(t));
      if (!thickMatch) return false;
    }
  }

  // 10. Verificação rigorosa de todos os atributos dimensionais obrigatórios (sem usar variáveis nulas)
  if (qAttrs.wallThicknesses.length > 0 && entAttrs.wallThicknesses.length > 0) {
    if (!qAttrs.wallThicknesses.every(w => entAttrs.wallThicknesses.includes(w))) {
      return false;
    }
  }

  if (qAttrs.nominalDiameters.length > 0 && entAttrs.nominalDiameters.length > 0) {
    if (!qAttrs.nominalDiameters.every(d => entAttrs.nominalDiameters.includes(d))) {
      return false;
    }
  }

  if (qAttrs.rectDimensions.length > 0 && entAttrs.rectDimensions.length > 0) {
    if (!qAttrs.rectDimensions.every(r => entAttrs.rectDimensions.includes(r))) {
      return false;
    }
  }

  if (qAttrs.sheetGauges.length > 0 && entAttrs.sheetGauges.length > 0) {
    if (!qAttrs.sheetGauges.every(g => entAttrs.sheetGauges.includes(g))) {
      return false;
    }
  }

  if (qGauges.length > 0 && entGauges.length > 0) {
    const hasMatch = qGauges.some(qg => entGauges.includes(qg));
    if (!hasMatch) return false;
  }

  return true;
}

export function isNonMaterial(it) {
  if (!it) return true;
  if (it.category === 'Administrativo / logística') return true;
  if (it.category === 'Mão de obra') return true;

  const itemLower = (it.item || '').toLowerCase();
  const unitLower = (it.unit || '').toLowerCase();

  if (/(gasolina|alimentação|hospedagem|passagem|salário|diária|supervisor|engenheiro|art|as built|databook|gem|manual)/i.test(itemLower)) return true;
  if (/(limpeza de duto|pintura dos duto|remanejamento|teste de estanqueidade|interligações elétricas|verba de manutenção)/i.test(itemLower)) return true;
  if (itemLower === 'tab' || itemLower === 'remanejamento') return true;
  if (/(andaime|carro \(strada\)|içamento|plataforma elevatória|picagem\/trepanação)/i.test(itemLower)) return true;
  if (/(horario comercial|horario extra|residencial alto padrão)/i.test(itemLower)) return true;
  if (/(capacidade total das evaporadoras|infra \(distância)/i.test(itemLower)) return true;
  if (unitLower === 'mês' || unitLower === 'diária' || unitLower === 'hora' || unitLower === 'h') return true;

  return false;
}

/**
 * Consulta a Base Econômica Oficial Sabrar para precificação e correspondência técnica.
 * 
 * @param {string} itemName Nome do material ou serviço identificado pelo agente
 * @param {Object} options Critérios técnicos adicionais
 * @param {string} [options.context] Contexto do sistema
 * @param {string} [options.unit] Unidade de medida esperada (ex: 'm', 'un', 'kg')
 * @param {string} [options.spec] Especificação complementar (bitola, espessura, modelo)
 * @returns {Object} Resultado da busca com preço, unidade, contexto e status
 */
export function findSabrarEconomicPrice(itemName, options = {}) {
  const { context = '', unit = '', spec = '', markupPercent = 0 } = options;
  const searchNorm = normalizeTechString(`${itemName} ${spec}`);
  const unitNorm = normalizeTechString(unit);
  const queryGauges = extractExactGauges(searchNorm);
  const qAttrs = extractTechnicalAttributes(searchNorm);

  const STOP_WORDS = new Set(['para', 'com', 'por', 'linha', 'tipo', 'obra', 'das', 'dos', 'uma', 'seu', 'sua', 'tamanho', 'dimensao', 'medida', 'fabricante', 'ref', 'modelo']);
  const searchWords = searchNorm.split(' ').filter(w => w.length > 2 && !STOP_WORDS.has(w));

  const candidates = [];
  let rejectedByWallThickness = null;
  let rejectedByDiameter = null;

  for (const entry of SABRAR_ECONOMIC_BASE_ITEMS) {
    if (isNonMaterial(entry)) continue;
    if (!entry.price || entry.price <= 0) continue;

    const entryNorm = normalizeTechString(entry.item);
    const synonymsNorm = normalizeTechString(entry.synonyms || '');
    const categoryNorm = normalizeTechString(entry.category);
    const entryGauges = extractExactGauges(`${entryNorm} ${synonymsNorm}`);
    const entAttrs = extractTechnicalAttributes(`${entryNorm} ${synonymsNorm}`);

    // Registra motivo específico de rejeição técnica para diagnóstico
    if (qAttrs.nominalDiameters.length > 0 && entAttrs.nominalDiameters.some(d => qAttrs.nominalDiameters.includes(d))) {
      if (qAttrs.wallThicknesses.length > 0 && entAttrs.wallThicknesses.length > 0 && !qAttrs.wallThicknesses.every(w => entAttrs.wallThicknesses.includes(w))) {
        rejectedByWallThickness = {
          requestedWall: qAttrs.wallThicknesses.join(', '),
          availableWall: entAttrs.wallThicknesses.join(', '),
          diameter: qAttrs.nominalDiameters.join(', '),
          candidateCode: entry.code,
          candidateName: entry.item
        };
      }
    }

    // Validação estrita de compatibilidade técnica e família de materiais
    if (!checkTechnicalCompatibility(searchNorm, entryNorm, categoryNorm, synonymsNorm, queryGauges, entryGauges)) {
      continue;
    }

    // Correspondência por descrição técnica OU sinônimo
    let wordScore = 0;
    for (const w of searchWords) {
      if (entryNorm.includes(w)) wordScore += 25;
      else if (synonymsNorm.includes(w)) wordScore += 30; // Pontuação alta para sinônimo
      else if (categoryNorm.includes(w)) wordScore += 10;
    }

    if (wordScore < 20) continue;

    let score = wordScore;

    // Correspondência de unidade
    if (unitNorm && (
      normalizeTechString(entry.unit) === unitNorm || 
      (entry.converted_unit && normalizeTechString(entry.converted_unit) === unitNorm)
    )) {
      score += 25;
    }

    // Bônus de bitola exata
    if (queryGauges.length > 0 && entryGauges.length > 0 && queryGauges.some(qg => entryGauges.includes(qg))) {
      score += 40;
    }

    // Bônus de comprimento (ex: 3MT / 3m)
    if (searchNorm.includes('3 metro') || searchNorm.includes('3m')) {
      if (entryNorm.includes('3mt') || entryNorm.includes('3m') || entryNorm.includes('3 metros')) {
        score += 30;
      }
    }

    // Prioridade para itens da base oficial atualizada 2026
    if (entry.context === 'Base Oficial 28/09/2026') {
      score += 15;
    }

    candidates.push({ entry, score });
  }

  candidates.sort((a, b) => b.score - a.score);

  if (candidates.length > 0) {
    const best = candidates[0].entry;
    let finalPrice = best.price;
    let finalUnit = best.unit;
    let isConverted = false;

    // Regra 4: Conversão de embalagem para unidade fracionada se solicitado
    if (best.converted_unit && best.converted_price && unitNorm) {
      const bestConvNorm = normalizeTechString(best.converted_unit);
      if (unitNorm === bestConvNorm || (unitNorm === 'm' && bestConvNorm === 'm') || (unitNorm === 'kg' && bestConvNorm === 'kg')) {
        finalPrice = best.converted_price;
        finalUnit = best.converted_unit;
        isConverted = true;
      }
    }

    const mPct = Number(markupPercent) || 0;
    const commercialPrice = Number((finalPrice * (1 + mPct / 100)).toFixed(2));

    return {
      matched: true,
      priceStatus: best.validation_status === 'VALIDAR' ? 'PENDENTE_VALIDACAO' : 'OFICIAL_BASE_SABRAR',
      price: finalPrice,
      commercialPrice,
      markupPercent: mPct,
      unit: finalUnit,
      baseUnit: best.unit,
      basePrice: best.price,
      isConverted,
      code: best.code,
      matchedItem: best.item,
      category: best.category,
      synonyms: best.synonyms,
      linearWeight: best.linear_weight,
      linearWeightUnit: best.linear_weight_unit,
      validationStatus: best.validation_status,
      pendingNotes: best.pending_notes,
      supplier: best.supplier || 'SABRAR / Base Central',
      costSource: best.context || 'Base Oficial 28/09/2026',
      referenceDate: '2026-09-28',
      failureReason: null
    };
  }

  let failureReason = `Material não localizado na Base Central SABRAR com todos os atributos técnicos exigidos (${itemName}).`;
  if (rejectedByWallThickness) {
    failureReason = `Incompatibilidade de atributo técnico obrigatório: bitola ${rejectedByWallThickness.diameter}" localizada (${rejectedByWallThickness.candidateCode}), porém com espessura de parede ${rejectedByWallThickness.availableWall}" divergente da solicitada (${rejectedByWallThickness.requestedWall}").`;
  } else if (/\b(difusor|grelha|damper|veneziana)\b/i.test(searchNorm)) {
    failureReason = `Elemento de difusão de ar sob medida (${itemName}) sem preço tabelado na Base Central SABRAR; requer cotação específica com fabricante (Tropical/Polar/Trox).`;
  }

  return {
    matched: false,
    priceStatus: 'PREÇO_NAO_LOCALIZADO',
    price: null,
    commercialPrice: null,
    markupPercent: Number(markupPercent) || 0,
    unit: unit || 'un',
    matchedItem: null,
    category: null,
    supplier: null,
    costSource: null,
    referenceDate: null,
    failureReason
  };
}
