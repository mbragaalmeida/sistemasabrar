/**
 * RECONCILIAÇÃO DE EXTRAÇÕES (parser determinístico × LLM × múltiplos PDFs)
 *
 * - Identidade técnica: família + dimensões/diâmetros + nº do item documental.
 * - Ocorrência física: a mesma lista de material repetida em várias pranchas é UMA ocorrência
 *   (não soma); diferenças reais entre pranchas viram conflito documental com opções de resolução.
 * - Linha do LLM que mistura atributos de itens distintos (ex.: dimensão do item 05 com a
 *   quantidade/citação do item 07) é ERRO DE INTERPRETAÇÃO DA IA, não conflito entre documentos.
 */
import { extractTechnicalAttributes } from './sabrarEconomicBase.js';
import { areUnitsCompatible, normalizeUnit } from '../utils/unitConversion.js';

export function technicalFamily(name = '') {
  const n = String(name).toLowerCase();
  if (/\bgrelha\b/.test(n)) return 'grelha';
  if (/\bdifusor\b/.test(n)) return 'difusor';
  if (/\bdamper\b/.test(n)) return 'damper';
  if (/\bveneziana\b/.test(n)) return 'veneziana';
  if (/\btela\b/.test(n)) return 'tela';
  if (/\bplenum\b/.test(n)) return 'plenum';
  if (/\bcobre\b/.test(n)) return 'cobre';
  if (/\bmpu\b/.test(n)) return 'mpu';
  if (/armaflex|espuma elastom/.test(n)) return 'isolamento';
  if (/\bcabo\b/.test(n)) return 'cabo';
  if (/\bperfilado\b/.test(n)) return 'perfilado';
  if (/\b(tirante|barra roscada)\b/.test(n)) return 'tirante';
  if (/\bchumbador\b/.test(n)) return 'chumbador';
  if (/evaporadora|condensadora|split/.test(n)) return 'equipamento';
  return 'outro';
}

function dimsOf(item) {
  const fromField = item.dimensions ? extractTechnicalAttributes(String(item.dimensions)).rectDimensions : [];
  return fromField.length ? fromField : extractTechnicalAttributes(item.name || '').rectDimensions;
}

/**
 * Compara as tabelas de material de cada documento: mesmo item com quantidade/descrição diferente
 * é conflito documental real (com opções rastreáveis de resolução).
 */
export function detectCrossDocumentConflicts(documentTables = []) {
  const conflicts = [];
  const byItem = new Map();
  for (const t of documentTables) {
    for (const r of t.rows) {
      if (!byItem.has(r.itemNum)) byItem.set(r.itemNum, []);
      byItem.get(r.itemNum).push({ ...r, document: t.document });
    }
  }
  for (const [itemNum, rows] of byItem.entries()) {
    if (rows.length < 2) continue;
    const norm = s => String(s || '').toUpperCase().replace(/\s+/g, ' ').trim();
    const qtys = new Set(rows.map(r => r.quantity));
    const descs = new Set(rows.map(r => norm(r.description)));
    if (qtys.size > 1 || descs.size > 1) {
      conflicts.push({
        conflict_type: 'CONFLITO_DOCUMENTAL',
        item_num: itemNum,
        occurrences: rows.map(r => ({ document: r.document, quantity: r.quantity, description: r.description })),
        description: `Item ${itemNum} diverge entre documentos: ${rows.map(r => `${r.document}: ${r.quantity}x ${r.description}`).join(' | ')}`,
        resolution_options: rows.map(r => ({ action: 'ADOTAR_DOCUMENTO', document: r.document, quantity: r.quantity, description: r.description })),
        recommended_action: 'Escolher a revisão vigente do documento; nenhuma quantidade foi somada.'
      });
    }
  }
  return conflicts;
}

/**
 * Integra materiais do LLM aos itens já extraídos (requiredItems é mutado).
 * @returns {{ interpretationIssues: Array, merged: number, added: number }}
 */
export function reconcileLLMMaterials(requiredItems, llmMaterials = [], options = {}) {
  const interpretationIssues = [];
  let merged = 0;
  let added = 0;
  const documentalItems = requiredItems.filter(r => r.itemNum);

  for (const llm of llmMaterials) {
    const fam = technicalFamily(llm.name);
    const llmDims = extractTechnicalAttributes(llm.name).rectDimensions;
    const evidence = String(llm.evidence || '');
    const citedNumMatch = evidence.match(/ITEM\s*0?(\d+)/i);
    const citedItemNum = citedNumMatch ? String(parseInt(citedNumMatch[1], 10)).padStart(2, '0') : null;
    const evDims = extractTechnicalAttributes(evidence).rectDimensions;
    const cited = citedItemNum ? documentalItems.find(r => r.itemNum === citedItemNum) : null;

    // 1) Evidência citada aponta para item documental com outra dimensão → checar se a dimensão do LLM
    //    pertence a OUTRO item documental (mistura de linhas) — erro de interpretação da IA.
    const citedDims = cited ? dimsOf(cited) : evDims;
    if (llmDims.length && citedDims.length && !llmDims.some(d => citedDims.includes(d))) {
      const owner = documentalItems.find(r => technicalFamily(r.name) === fam && dimsOf(r).some(d => llmDims.includes(d)));
      interpretationIssues.push({
        type: 'ERRO_INTERPRETACAO_IA',
        llm_item: llm.name,
        llm_quantity: llm.quantity,
        cited_evidence: evidence,
        cited_item: cited ? { itemNum: cited.itemNum, name: cited.name, quantity: cited.quantity, dimensions: citedDims } : null,
        dimension_owner: owner ? { itemNum: owner.itemNum, name: owner.name, quantity: owner.quantity } : null,
        description: owner
          ? `A IA combinou a dimensão ${llmDims.join('/')} do item ${owner.itemNum} (${owner.quantity} un) com a citação/quantidade do item ${cited?.itemNum || '?'} (${citedDims.join('/')}). Os documentos são consistentes; itens documentais preservados.`
          : `A IA atribuiu dimensão ${llmDims.join('/')} sem correspondência na lista documental (evidência cita ${citedDims.join('/')}). Linha da IA descartada; item documental preservado.`,
        resolution: 'Linha da IA descartada; quantidades documentais mantidas.'
      });
      continue;
    }

    // 2) Mesma identidade técnica → consolida (sem somar)
    const existing = requiredItems.find(r => {
      if (!areUnitsCompatible(r.unit, llm.unit) && !(normalizeUnit(r.unit) === 'UN' || normalizeUnit(llm.unit) === 'UN')) return false;
      const rf = technicalFamily(r.name);
      if (rf !== fam) return false;
      if (citedItemNum && r.itemNum === citedItemNum) return true;
      const rd = dimsOf(r);
      if (rd.length && llmDims.length) return rd.some(d => llmDims.includes(d));
      const rDiam = extractTechnicalAttributes(r.name).nominalDiameters;
      const lDiam = extractTechnicalAttributes(llm.name).nominalDiameters;
      if (rDiam.length && lDiam.length) return rDiam.some(d => lDiam.includes(d));
      return String(r.name).toLowerCase() === String(llm.name).toLowerCase();
    });
    if (existing) {
      merged++;
      if (Number(llm.quantity) > 0 && Number(existing.quantity) > 0 && Number(llm.quantity) !== Number(existing.quantity) && existing.measurementStatus === 'DOCUMENTADO') {
        interpretationIssues.push({
          type: 'DIVERGENCIA_QUANTIDADE_IA',
          llm_item: llm.name,
          llm_quantity: llm.quantity,
          documental_quantity: existing.quantity,
          description: `IA leu ${llm.quantity}, documento registra ${existing.quantity}; mantida a quantidade documental.`
        });
      } else if ((!existing.quantity || existing.quantity === 0) && Number(llm.quantity) > 0 && !options.geometryOwnedFamilies?.includes(fam)) {
        existing.quantity = Number(llm.quantity);
        existing.measurementStatus = 'PREVISAO';
        existing.premises = [...(existing.premises || []), 'Quantidade informada pela IA sem corroboração geométrica.'];
      }
      if (evidence && !String(existing.evidence || '').includes(evidence)) {
        existing.evidence = `${existing.evidence || existing.reason || ''} | IA: ${evidence}`;
      }
      continue;
    }

    // 3) Item novo informado pela IA: entra como PREVISAO (não confirmado), com origem visível
    if (options.geometryOwnedFamilies?.includes(fam)) {
      interpretationIssues.push({ type: 'IGNORADO_GEOMETRIA_PROPRIA', llm_item: llm.name, description: 'Quantidade desta família é derivada da geometria medida; valor da IA não substitui a medição.' });
      continue;
    }
    added++;
    requiredItems.push({
      name: llm.name,
      category: llm.category || 'Materiais Extraídos (IA)',
      unit: normalizeUnit(llm.unit),
      quantity: Number(llm.quantity) || 0,
      defaultPrice: null,
      measurementStatus: Number(llm.quantity) > 0 ? 'PREVISAO' : 'PENDENTE_MEDICAO',
      premises: ['Item e quantidade informados pela IA; conferir no documento citado.'],
      origin: `IA (${llm.sourceFile} p.${llm.sourcePage})`,
      reason: `Extraído pela IA (${llm.sourceFile} pág. ${llm.sourcePage}): ${evidence}`,
      evidence
    });
  }
  return { interpretationIssues, merged, added };
}

export function reconcileExtractions({ requiredItems, llmMaterials, documentTables, geometryOwnedFamilies }) {
  const documentConflicts = detectCrossDocumentConflicts(documentTables);
  const r = reconcileLLMMaterials(requiredItems, llmMaterials, { geometryOwnedFamilies });
  return { documentConflicts, ...r };
}
