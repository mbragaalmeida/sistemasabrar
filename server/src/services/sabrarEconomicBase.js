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

export function extractExactGauges(text) {
  if (!text) return [];
  const normalized = normalizeTechString(text);
  const compositeFractionMatches = normalized.match(/\b\d+\s+\d+\/\d+["'']?/g) || [];
  const simpleFractionMatches = normalized.match(/(?<!\d\s+)\b\d+\/\d+["'']?/g) || [];
  const cvMatches = normalized.match(/\b\d+(?:[.,]\d+)?\s*cv\b/g) || [];

  // Normalização numérica de milímetros (ex: 2,50mm -> 2.5mm)
  const mmMatches = [];
  const rawMm = normalized.matchAll(/\b(\d+(?:[.,]\d+)?)\s*mm\b/g);
  for (const match of rawMm) {
    const num = parseFloat(match[1].replace(',', '.'));
    if (!isNaN(num)) {
      mmMatches.push(`${num}mm`);
    }
  }

  return [
    ...compositeFractionMatches.map(m => m.trim().replace(/["'']/g, '')),
    ...simpleFractionMatches.map(m => m.trim().replace(/["'']/g, '')),
    ...mmMatches,
    ...cvMatches.map(m => m.replace(/\s+/g, ''))
  ];
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
  const { context = '', unit = '', spec = '' } = options;
  const searchNorm = normalizeTechString(`${itemName} ${spec}`);
  const unitNorm = normalizeTechString(unit);
  const queryGauges = extractExactGauges(searchNorm);

  const STOP_WORDS = new Set(['para', 'com', 'por', 'linha', 'tipo', 'obra', 'das', 'dos', 'uma', 'seu', 'sua', 'tamanho', 'dimensao', 'medida', 'fabricante', 'ref', 'modelo']);
  const searchWords = searchNorm.split(' ').filter(w => w.length > 2 && !STOP_WORDS.has(w));

  const isEquipmentOrDuctOrAirDiffusion = /(?:damper|difusor|grelha|veneziana|duto|coifa|exaustor|ventilador|evaporadora|condensadora|splitao|fancoil|chiller)/i.test(searchNorm);

  const candidates = [];

  for (const entry of SABRAR_ECONOMIC_BASE_ITEMS) {
    if (isNonMaterial(entry)) continue;
    if (!entry.price || entry.price <= 0) continue;

    const entryNorm = normalizeTechString(entry.item);
    const synonymsNorm = normalizeTechString(entry.synonyms || '');
    const categoryNorm = normalizeTechString(entry.category);

    // Evita falsos positivos grosseiros (ex: Difusores/Dampers/Dutos casando com Parafusos, Terminais ou Abraçadeiras)
    const isFastenerEntry = /(?:parafuso|arruela|porca|bucha|rebite|abracadeira|terminal|garfo)/i.test(entryNorm) || categoryNorm.includes('fixacao');
    if (isEquipmentOrDuctOrAirDiffusion && isFastenerEntry) continue;

    // Verificação rigorosa de bitola
    const entryGauges = extractExactGauges(`${entryNorm} ${synonymsNorm}`);
    let gaugeMismatch = false;

    if (queryGauges.length > 0) {
      for (const qg of queryGauges) {
        if (!qg.includes(' ') && qg.includes('/')) {
          const hasComposite = entryGauges.some(eg => eg.endsWith(qg) && eg !== qg);
          const hasExact = entryGauges.includes(qg);
          if (hasComposite && !hasExact) {
            gaugeMismatch = true;
            break;
          }
        }
        if (entryGauges.length > 0 && !entryGauges.includes(qg)) {
          gaugeMismatch = true;
          break;
        }
      }
    }
    if (gaugeMismatch) continue;

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

    return {
      matched: true,
      priceStatus: best.validation_status === 'VALIDAR' ? 'PENDENTE_VALIDACAO' : 'OFICIAL_BASE_SABRAR',
      price: finalPrice,
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
      supplier: best.supplier
    };
  }

  return {
    matched: false,
    priceStatus: 'PREÇO_NAO_LOCALIZADO',
    price: null,
    unit: unit || 'un',
    matchedItem: null,
    category: null,
    supplier: null
  };
}
