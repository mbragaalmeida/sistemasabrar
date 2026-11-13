/**
 * MEDIÇÃO GEOMÉTRICA DE DUTOS E CIRCUITOS A PARTIR DA GEOMETRIA VETORIAL DAS PRANCHAS
 *
 * Princípios (sem valores calibrados para nenhuma obra específica):
 * 1. Comprimento vem do desenho: pares de linhas paralelas do mesmo estilo de traço (contorno do duto).
 * 2. O rótulo (ex.: "I-60x45") identifica sistema e seção; ele NÃO mede o percurso.
 * 3. A escala de cada vista é validada confrontando a escala declarada ("ESCALA 1/75") com a escala
 *    implícita pelos rótulos (largura rotulada ÷ afastamento desenhado entre as linhas do duto).
 * 4. Cortes/elevações só contribuem com prumadas verticais; trechos horizontais de corte repetem a planta.
 * 5. Cada trecho registra arquivo, página, vista, escala, dimensões, comprimento e evidência geométrica.
 */
import crypto from 'node:crypto';
import { PT_TO_M } from '../utils/pdfVectorGeometry.js';

const DUCT_LABEL_REGEX = /\b(INS|RET|AE|AR|EX|PRESS|I|R|E|P)\s*-\s*(\d{2,4})\s*[xX×]\s*(\d{2,4})\b/;
const SYSTEM_BY_PREFIX = {
  I: 'Insuflamento', INS: 'Insuflamento',
  R: 'Retorno', RET: 'Retorno',
  AE: 'Ar Exterior', AR: 'Ar Exterior',
  E: 'Exaustão', EX: 'Exaustão',
  P: 'Pressurização', PRESS: 'Pressurização'
};

const VIEW_TITLE_REGEX = /\b(PLANTA|CORTE|SE[ÇC][AÃ]O|VISTA|ELEVA[ÇC][AÃ]O|DETALHE|AMPLIA[ÇC][AÃ]O|ISOM[EÉ]TRIC[AO])\b/i;
const SCALE_REGEX = /(?:ESCALA|ESC\.?)?\s*1\s*[/:]\s*(\d{1,4})\b/i;

export const MEASUREMENT_TOLERANCES = {
  scaleAgreement: 0.06,        // 6%: escala implícita x declarada
  widthMatch: 0.15,            // 15%: afastamento desenhado x dimensão rotulada
  parallelAngleDeg: 1.5,
  collinearOffsetPt: 0.4,
  minSegmentPt: 2,
  sectionVerticalAngleDeg: 20,
  maxLabelDistancePt: 150      // ~ 4 m em 1:75; rótulo de seção posicionado junto ao trecho
};

// ---------------------------------------------------------------------------
// Transformações de vista (rotação da página → coordenadas de leitura)
// ---------------------------------------------------------------------------
export function toVisual(page, x, y) {
  const W = page.view ? Number(page.view[2]) : 0;
  const H = page.view ? Number(page.view[3]) : 0;
  switch (((page.rotate || 0) % 360 + 360) % 360) {
    case 90: return [y, W - x];
    case 180: return [W - x, H - y];
    case 270: return [H - y, x];
    default: return [x, y];
  }
}

function textCenter(t) {
  const len = t.width || 0;
  return [t.x + Math.cos(t.angle || 0) * len / 2, t.y + Math.sin(t.angle || 0) * len / 2];
}

export function parseDuctLabel(text) {
  const m = String(text || '').toUpperCase().match(DUCT_LABEL_REGEX);
  if (!m) return null;
  const prefix = m[1];
  return {
    prefix,
    system: SYSTEM_BY_PREFIX[prefix] || 'Insuflamento',
    dimA: parseInt(m[2], 10),
    dimB: parseInt(m[3], 10),
    raw: m[0].replace(/\s+/g, '')
  };
}

// ---------------------------------------------------------------------------
// Vistas: título + escala declarada, e atribuição de elementos a cada vista
// ---------------------------------------------------------------------------
export function detectViews(page) {
  const texts = page.texts || [];
  const scaleTexts = texts
    .map(t => ({ t, m: t.text.match(SCALE_REGEX) }))
    .filter(o => o.m && /ESC/i.test(o.t.text));

  const titles = [];
  for (const t of texts) {
    if (!VIEW_TITLE_REGEX.test(t.text) || t.text.length > 80) continue;
    // Escala da vista: texto "ESCALA 1/N" adjacente ao título (até ~3 alturas de texto)
    const near = scaleTexts
      .map(o => ({ ...o, d: Math.hypot(o.t.x - t.x, o.t.y - t.y) }))
      .filter(o => o.d <= Math.max(40, (t.height || 8) * 4))
      .sort((a, b) => a.d - b.d)[0];
    if (!near) continue;
    const [vx, vy] = toVisual(page, ...textCenter(t));
    const name = t.text.trim();
    const viewType = /CORTE|SE[ÇC][AÃ]O|ELEVA|VISTA/i.test(name)
      ? 'CORTE'
      : (/DETALHE|AMPLIA/i.test(name) ? 'DETALHE' : 'PLANTA');
    titles.push({ name, viewType, scaleDenominator: parseInt(near.m[1], 10), scaleText: near.t.text, vx, vy });
  }

  if (titles.length === 0) {
    // Sem título de vista: usa a escala geral da prancha (carimbo) se houver uma única declarada
    const sheetScales = [...new Set(texts.map(t => (t.text.match(/^\s*1\s*[/:]\s*(\d{1,4})\s*$/) || [])[1]).filter(Boolean))];
    titles.push({
      name: 'Prancha',
      viewType: 'PLANTA',
      scaleDenominator: sheetScales.length === 1 ? parseInt(sheetScales[0], 10) : null,
      scaleText: sheetScales.length === 1 ? `1/${sheetScales[0]}` : null,
      vx: 0,
      vy: 0,
      isSheetFallback: true
    });
  }
  return titles;
}

/** Atribui um ponto (coordenadas brutas) à vista cujo título está imediatamente abaixo dele. */
export function assignView(page, views, x, y) {
  if (views.length === 1) return views[0];
  const [vx, vy] = toVisual(page, x, y);
  let best = null;
  let bestScore = Infinity;
  for (const v of views) {
    const dy = vy - v.vy;
    if (dy < -15) continue; // título acima do elemento → pertence a outra vista
    const score = Math.max(0, dy) + Math.abs(vx - v.vx) * 0.5;
    if (score < bestScore) { bestScore = score; best = v; }
  }
  if (best) return best;
  return views.reduce((a, b) => (Math.hypot(vx - a.vx, vy - a.vy) <= Math.hypot(vx - b.vx, vy - b.vy) ? a : b));
}

// ---------------------------------------------------------------------------
// Pareamento de linhas paralelas (contorno de duto)
// ---------------------------------------------------------------------------
function unionIntervals(intervals, gap = 0) {
  const s = intervals.filter(i => i[1] > i[0]).sort((a, b) => a[0] - b[0]);
  const out = [];
  for (const iv of s) {
    const last = out[out.length - 1];
    if (last && iv[0] <= last[1] + gap) last[1] = Math.max(last[1], iv[1]);
    else out.push([iv[0], iv[1]]);
  }
  return out;
}

function intersectIntervals(a, b) {
  const out = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    const lo = Math.max(a[i][0], b[j][0]);
    const hi = Math.min(a[i][1], b[j][1]);
    if (hi > lo) out.push([lo, hi]);
    if (a[i][1] < b[j][1]) i++; else j++;
  }
  return out;
}

const totalLen = ivs => ivs.reduce((s, iv) => s + (iv[1] - iv[0]), 0);

/**
 * Agrupa segmentos retos em linhas (mesma direção e mesmo afastamento) e devolve pares paralelos
 * com o afastamento (pt) e os intervalos sobrepostos ao longo da direção.
 */
export function findParallelPairs(segments, tol = MEASUREMENT_TOLERANCES) {
  const angTol = (tol.parallelAngleDeg * Math.PI) / 180;
  const groups = [];
  for (const s of segments) {
    if (s.curve) continue;
    const dx = s.x2 - s.x1;
    const dy = s.y2 - s.y1;
    const len = Math.hypot(dx, dy);
    if (len < tol.minSegmentPt) continue;
    let ang = Math.atan2(dy, dx);
    if (ang < 0) ang += Math.PI;
    if (ang >= Math.PI - angTol / 2) ang -= Math.PI;
    let g = groups.find(gr => Math.abs(gr.ang - ang) <= angTol);
    if (!g) { g = { ang, segs: [] }; groups.push(g); }
    g.segs.push(s);
  }

  const pairs = [];
  for (const g of groups) {
    const ux = Math.cos(g.ang);
    const uy = Math.sin(g.ang);
    const nx = -uy;
    const ny = ux;
    // Linhas: segmentos colineares (mesmo afastamento normal)
    const items = g.segs.map(s => {
      const t1 = s.x1 * ux + s.y1 * uy;
      const t2 = s.x2 * ux + s.y2 * uy;
      return { o: s.x1 * nx + s.y1 * ny, iv: [Math.min(t1, t2), Math.max(t1, t2)] };
    }).sort((a, b) => a.o - b.o);
    const lines = [];
    for (const it of items) {
      const last = lines[lines.length - 1];
      if (last && Math.abs(it.o - last.o) <= tol.collinearOffsetPt) {
        last.ivs.push(it.iv);
      } else {
        lines.push({ o: it.o, ivs: [it.iv] });
      }
    }
    for (const l of lines) l.ivs = unionIntervals(l.ivs, 0.3);

    for (let i = 0; i < lines.length; i++) {
      const A = lines[i];
      // vizinha mais próxima do lado positivo que se sobrepõe em extensão
      for (let j = i + 1; j < lines.length; j++) {
        const B = lines[j];
        const d = B.o - A.o;
        if (d < 1.5) continue;
        if (d > 400) break;
        const inter = intersectIntervals(A.ivs, B.ivs);
        if (totalLen(inter) < Math.max(2, d * 0.5)) continue;
        // Une lacunas curtas somente quando UMA das faces é contínua na lacuna
        // (derivação/tê interrompe uma face); lacuna nas duas faces = não é o mesmo duto.
        const eitherSide = unionIntervals([...A.ivs, ...B.ivs], 0.3);
        const bridged = [];
        for (const iv of inter) {
          const last = bridged[bridged.length - 1];
          if (last && iv[0] - last[1] <= Math.max(10, d * 2.5) &&
            eitherSide.some(e => e[0] <= last[1] + 0.3 && e[1] >= iv[0] - 0.3)) {
            last[1] = iv[1];
          } else {
            bridged.push([iv[0], iv[1]]);
          }
        }
        for (const iv of bridged) {
          const tm = (iv[0] + iv[1]) / 2;
          const om = (A.o + B.o) / 2;
          pairs.push({
            spacingPt: d,
            lengthPt: iv[1] - iv[0],
            angle: g.ang,
            frame: { ux, uy, nx, ny, t0: iv[0], t1: iv[1], o0: A.o, o1: B.o },
            start: [iv[0] * ux + om * nx, iv[0] * uy + om * ny],
            end: [iv[1] * ux + om * nx, iv[1] * uy + om * ny],
            mid: [tm * ux + om * nx, tm * uy + om * ny]
          });
        }
        break;
      }
    }
  }
  return pairs;
}

/** Comprimento de um segmento recortado por um retângulo no referencial (t, o) do par. */
function clippedLengthInFrame(s, f, margin) {
  const toLocal = (x, y) => [x * f.ux + y * f.uy, x * f.nx + y * f.ny];
  const [t1, o1] = toLocal(s.x1, s.y1);
  const [t2, o2] = toLocal(s.x2, s.y2);
  const tmin = f.t0 + margin.t;
  const tmax = f.t1 - margin.t;
  const omin = f.o0 + margin.o;
  const omax = f.o1 - margin.o;
  if (tmax <= tmin || omax <= omin) return 0;
  // Liang–Barsky
  let u0 = 0;
  let u1 = 1;
  const dt = t2 - t1;
  const dn = o2 - o1;
  const checks = [[-dt, t1 - tmin], [dt, tmax - t1], [-dn, o1 - omin], [dn, omax - o1]];
  for (const [p, q] of checks) {
    if (p === 0) { if (q < 0) return 0; continue; }
    const r = q / p;
    if (p < 0) { if (r > u1) return 0; if (r > u0) u0 = r; } else { if (r < u0) return 0; if (r < u1) u1 = r; }
  }
  return Math.max(0, u1 - u0) * Math.hypot(dt, dn);
}

/** Trecho reto de duto tem interior livre de outros traços do mesmo estilo (transições/conexões não). */
export function pairInteriorIsClear(pair, styleSegments) {
  const f = pair.frame;
  if (!f) return true;
  const margin = { t: Math.max(0.5, (f.t1 - f.t0) * 0.03), o: (f.o1 - f.o0) * 0.12 };
  let inside = 0;
  for (const s of styleSegments) {
    // juntas/flanges perpendiculares ao eixo são legítimas dentro do trecho; só traços diagonais indicam conexão
    const dx = s.x2 - s.x1;
    const dy = s.y2 - s.y1;
    const L = Math.hypot(dx, dy) || 1;
    const cosU = Math.abs((dx * f.ux + dy * f.uy) / L);
    if (cosU < 0.17 || cosU > 0.985) continue;
    inside += clippedLengthInFrame(s, f, margin);
    if (inside > pair.spacingPt * 0.3) return false;
  }
  return true;
}

/**
 * Transição/redução: as pontas do par são ligadas por arestas inclinadas (não perpendiculares).
 * Nesse caso as duas "linhas" do par são as tampas de uma peça de transição, não as faces de um duto reto.
 */
export function pairEndsAreSlanted(pair, styleSegments) {
  const f = pair.frame;
  if (!f) return false;
  const d = f.o1 - f.o0;
  const tolPt = Math.max(1, d * 0.06);
  const local = (x, y) => [x * f.ux + y * f.uy, x * f.nx + y * f.ny];
  let slantedEnds = 0;
  for (const tEnd of [f.t0, f.t1]) {
    for (const s of styleSegments) {
      const p1 = local(s.x1, s.y1);
      const p2 = local(s.x2, s.y2);
      for (const [a, b] of [[p1, p2], [p2, p1]]) {
        const atEnd = Math.abs(a[0] - tEnd) <= tolPt && (Math.abs(a[1] - f.o0) <= tolPt || Math.abs(a[1] - f.o1) <= tolPt);
        if (!atEnd) continue;
        const otherSide = Math.abs(a[1] - f.o0) <= tolPt ? f.o1 : f.o0;
        const reachesOther = Math.abs(b[1] - otherSide) <= tolPt;
        if (reachesOther && Math.abs(b[0] - a[0]) > tolPt * 1.2) {
          slantedEnds++;
          break;
        }
      }
    }
  }
  return slantedEnds >= 1;
}

function pairRectangleContains(pair, x, y) {
  const f = pair.frame;
  const t = x * f.ux + y * f.uy;
  const o = x * f.nx + y * f.ny;
  return t >= f.t0 && t <= f.t1 && o >= f.o0 && o <= f.o1;
}

/** Fração da área do par A coberta pelo par B (amostragem 6×6). */
function overlapFraction(a, b) {
  const f = a.frame;
  let hit = 0;
  const n = 6;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const t = f.t0 + (f.t1 - f.t0) * (i + 0.5) / n;
      const o = f.o0 + (f.o1 - f.o0) * (j + 0.5) / n;
      if (pairRectangleContains(b, t * f.ux + o * f.nx, t * f.uy + o * f.ny)) hit++;
    }
  }
  return hit / (n * n);
}

function distPointToSegment(p, a, b) {
  const vx = b[0] - a[0];
  const vy = b[1] - a[1];
  const L2 = vx * vx + vy * vy;
  let t = L2 > 0 ? ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / L2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - (a[0] + t * vx), p[1] - (a[1] + t * vy));
}

const median = arr => {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/**
 * Mede uma página: identifica estilos de contorno de duto, valida escala por vista e gera trechos.
 */
export function measureDuctsOnPage(page, fileName, tol = MEASUREMENT_TOLERANCES) {
  const views = detectViews(page);
  const labels = (page.texts || [])
    .map(t => ({ t, lab: parseDuctLabel(t.text) }))
    .filter(o => o.lab)
    .map(o => {
      const c = textCenter(o.t);
      return { ...o.lab, text: o.t.text, x: c[0], y: c[1], view: assignView(page, views, c[0], c[1]) };
    });

  const result = { fileName, pageNumber: page.pageNumber, views: [], sections: [], excluded: [], labelsFound: labels.length };
  if (labels.length === 0) return result;

  // Estilos candidatos: estilos de traço com segmentos retos próximos a algum rótulo de duto
  const byStyle = new Map();
  for (const s of page.segments || []) {
    if (s.curve) continue;
    if (!byStyle.has(s.style)) byStyle.set(s.style, []);
    byStyle.get(s.style).push(s);
  }

  // Para cada estilo: pares paralelos e afastamento do par mais próximo de cada rótulo
  const styleEvidence = [];
  for (const [style, segs] of byStyle.entries()) {
    if (segs.length < 4) continue;
    const pairs = findParallelPairs(segs, tol);
    if (pairs.length === 0) continue;
    const samples = [];
    for (const lab of labels) {
      let best = null;
      for (const p of pairs) {
        const d = distPointToSegment([lab.x, lab.y], p.start, p.end);
        if (d <= Math.max(60, p.spacingPt * 3) && (!best || d < best.d)) best = { d, p };
      }
      if (best) samples.push({ lab, pair: best.p });
    }
    styleEvidence.push({ style, pairs, samples });
  }

  // Estilos de duto declarados na legenda da prancha (ex.: "DUTO DE INSUFLAMENTO ..."): quando existem,
  // somente esses estilos podem representar dutos (evita linhas de arquitetura com afastamento coincidente).
  const legendDuctStyles = new Set(
    (page.texts || [])
      .filter(t => /^DUTO\s+(?:DE\s+)?(?:INSUFLAMENTO|RETORNO|AR\s+EXTERIOR|EXAUST|PRESSURIZ|RENOVA)/i.test(t.text))
      .map(t => legendStyleFor(page, new RegExp(`^${t.text.slice(0, 25).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)))
      .filter(Boolean)
      .map(l => l.style)
  );

  // Validação de escala por vista
  for (const view of views) {
    const implied = [];
    for (const se of styleEvidence) {
      for (const sm of se.samples) {
        if (sm.lab.view !== view) continue;
        const drawnM = sm.pair.spacingPt * PT_TO_M;
        // Largura rotulada em cm (padrão HVAC); em cortes, a face vista pode ser qualquer das duas dimensões
        const dims = view.viewType === 'CORTE' ? [sm.lab.dimA, sm.lab.dimB] : [sm.lab.dimA];
        for (const dimCm of dims) implied.push({ style: se.style, n: (dimCm / 100) / drawnM });
      }
    }
    const declared = view.scaleDenominator;
    const allAgreeing = declared ? implied.filter(i => Math.abs(i.n - declared) / declared <= tol.scaleAgreement) : [];
    // Estilos de contorno de duto: os que confirmam a escala nesta vista, restritos à legenda quando houver;
    // sem legenda, o estilo dominante e os que tenham ao menos metade das confirmações dele.
    const countByStyle = new Map();
    for (const a of allAgreeing) countByStyle.set(a.style, (countByStyle.get(a.style) || 0) + 1);
    let ductStyles;
    if (legendDuctStyles.size > 0) {
      ductStyles = [...countByStyle.keys()].filter(s => legendDuctStyles.has(s));
    } else {
      const maxCount = Math.max(0, ...countByStyle.values());
      ductStyles = [...countByStyle.entries()].filter(([, c]) => c >= Math.max(2, maxCount * 0.5)).map(([s]) => s);
    }
    const agreeing = allAgreeing.filter(a => ductStyles.includes(a.style));
    const ductImplied = implied.filter(i => legendDuctStyles.size === 0 || legendDuctStyles.has(i.style));
    const impliedMedian = median((agreeing.length ? agreeing : ductImplied).map(i => i.n));
    let scaleStatus;
    let scale = null;
    // Validada quando a maioria das amostras do estilo de duto confirma a escala declarada
    const styleSamples = implied.filter(i => ductStyles.includes(i.style));
    if (declared && agreeing.length >= 1 && agreeing.length >= styleSamples.length * 0.5) {
      scaleStatus = 'VALIDADA';
      scale = declared;
    } else if (declared && ductImplied.length === 0) {
      scaleStatus = 'DECLARADA_SEM_CONFIRMACAO';
    } else if (declared) {
      scaleStatus = 'DIVERGENTE';
    } else {
      scaleStatus = 'AUSENTE';
    }
    result.views.push({
      name: view.name,
      viewType: view.viewType,
      declaredScale: declared ? `1:${declared}` : null,
      impliedScaleMedian: impliedMedian ? Number(impliedMedian.toFixed(1)) : null,
      confirmingLabelPairs: agreeing.length,
      scaleStatus,
      ductStyles,
      _view: view,
      _scale: scale,
      _ductStyles: ductStyles
    });
  }

  // Trechos medidos: pares de estilos de duto, na vista com escala validada, associados a rótulo compatível
  for (const v of result.views) {
    if (!v._scale) continue;
    const mPerPt = PT_TO_M * v._scale;
    const viewLabels = labels.filter(l => l.view === v._view);
    // 1) pares da vista com interior livre (exclui transições, conexões e colarinhos de grelha)
    const candidatesPairs = [];
    for (const se of styleEvidence) {
      if (!v._ductStyles.includes(se.style)) continue;
      const styleSegs = byStyle.get(se.style) || [];
      for (const p of se.pairs) {
        if (assignView(page, views, p.mid[0], p.mid[1]) !== v._view) continue;
        const exclusionReason = p.lengthPt < p.spacingPt * 0.5
          ? 'COLARINHO_OU_PECA_CURTA'
          : (!pairInteriorIsClear(p, styleSegs) || pairEndsAreSlanted(p, styleSegs) ? 'CONEXAO_OU_TRANSICAO' : null);
        if (exclusionReason) {
          result.excluded.push({ reason: exclusionReason, view: v.name, lengthM: Number((p.lengthPt * mPerPt).toFixed(2)), drawnWidthCm: Number((p.spacingPt * mPerPt * 100).toFixed(1)) });
          continue;
        }
        candidatesPairs.push({ p, se });
      }
    }
    // 2) retângulos sobrepostos representam o mesmo trecho: fica o de maior razão comprimento/afastamento
    candidatesPairs.sort((a, b) => (b.p.lengthPt / b.p.spacingPt) - (a.p.lengthPt / a.p.spacingPt));
    const accepted = [];
    for (const c of candidatesPairs) {
      const dup = accepted.find(a => overlapFraction(c.p, a.p) >= 0.4);
      if (dup) {
        result.excluded.push({ reason: 'SOBREPOSICAO_MESMO_TRECHO', view: v.name, lengthM: Number((c.p.lengthPt * mPerPt).toFixed(2)), drawnWidthCm: Number((c.p.spacingPt * mPerPt * 100).toFixed(1)) });
        continue;
      }
      accepted.push(c);
    }
    for (const { p, se } of accepted) {
      {
        const drawnCm = p.spacingPt * mPerPt * 100;
        // rótulos compatíveis (largura confere) ordenados por distância
        const candidates = viewLabels
          .map(l => {
            const faceDims = v.viewType === 'CORTE' ? [l.dimA, l.dimB] : [l.dimA];
            const face = faceDims.find(d => Math.abs(d - drawnCm) / d <= tol.widthMatch);
            return face ? { l, face, d: distPointToSegment([l.x, l.y], p.start, p.end) } : null;
          })
          .filter(Boolean)
          // o rótulo identifica o trecho próximo a ele (raio limitado); não se propaga pela prancha
          .filter(c => c.d <= Math.max(tol.maxLabelDistancePt, p.spacingPt * 4))
          .sort((a, b) => a.d - b.d);
        if (candidates.length === 0) {
          const maxLabelDim = Math.max(...viewLabels.map(l => Math.max(l.dimA, l.dimB)), 0);
          // só registra para revisão pares com largura plausível de duto (não o vão entre dutos vizinhos)
          if (p.lengthPt * mPerPt >= 0.3 && drawnCm <= maxLabelDim * 1.5) {
            result.excluded.push({
              reason: 'PAR_SEM_ROTULO_COMPATIVEL',
              details: 'Contorno no estilo de duto sem rótulo de seção compatível próximo: conferir na revisão manual.',
              view: v.name,
              sourceFile: fileName,
              sourcePage: page.pageNumber,
              startPt: p.start.map(n => Number(n.toFixed(1))),
              endPt: p.end.map(n => Number(n.toFixed(1))),
              drawnWidthCm: Number(drawnCm.toFixed(1)),
              lengthM: Number((p.lengthPt * mPerPt).toFixed(2))
            });
          }
          continue;
        }
        const best = candidates[0];
        const lengthM = p.lengthPt * mPerPt;
        if (lengthM < 0.05) continue;

        // Orientação em coordenadas de leitura (para separar prumada de trecho horizontal em cortes)
        const [ax, ay] = toVisual(page, ...p.start);
        const [bx, by] = toVisual(page, ...p.end);
        const visAngle = Math.abs(Math.atan2(by - ay, bx - ax) * 180 / Math.PI);
        const isVertical = Math.abs(visAngle - 90) <= tol.sectionVerticalAngleDeg;

        const lab = best.l;
        // Em planta a face desenhada é a largura (1ª dimensão); a outra é a altura.
        const widthCm = v.viewType === 'CORTE' ? best.face : lab.dimA;
        const heightCm = v.viewType === 'CORTE' ? (best.face === lab.dimA ? lab.dimB : lab.dimA) : lab.dimB;

        const base = {
          system: lab.system,
          label: lab.raw,
          widthCm,
          heightCm,
          lengthM: Number(lengthM.toFixed(3)),
          sourceFile: fileName,
          sourcePage: page.pageNumber,
          view: v.name,
          viewType: v.viewType,
          scale: `1:${v._scale}`,
          orientation: v.viewType === 'CORTE' ? (isVertical ? 'PRUMADA_VERTICAL' : 'HORIZONTAL_EM_CORTE') : 'PLANTA',
          evidence: {
            method: 'PAR_LINHAS_PARALELAS',
            lineStyle: se.style,
            drawnSpacingPt: Number(p.spacingPt.toFixed(2)),
            drawnWidthCm: Number(drawnCm.toFixed(1)),
            drawnLengthPt: Number(p.lengthPt.toFixed(2)),
            labelText: lab.text,
            labelDistancePt: Number(best.d.toFixed(1)),
            startPt: p.start.map(n => Number(n.toFixed(1))),
            endPt: p.end.map(n => Number(n.toFixed(1)))
          }
        };

        if (v.viewType === 'CORTE' && !isVertical) {
          result.excluded.push({ ...base, reason: 'DUPLICIDADE_PLANTA_CORTE', details: 'Trecho horizontal em corte já representado na planta.' });
          continue;
        }
        if (v.viewType === 'DETALHE') {
          result.excluded.push({ ...base, reason: 'DETALHE_AMPLIADO', details: 'Vista de detalhe/ampliação não soma ao levantamento.' });
          continue;
        }
        result.sections.push({ ...base, measurementStatus: 'MEDIDO' });
      }
    }
  }

  for (const v of result.views) { delete v._view; delete v._scale; delete v._ductStyles; }
  return result;
}

/**
 * Remove plantas repetidas entre arquivos (mesma vista em pranchas diferentes) e arquivos idênticos.
 */
export function measureProjectDucts(vectorDocs = []) {
  const seenHashes = new Set();
  const pageResults = [];
  for (const doc of vectorDocs) {
    if (doc.hash) {
      if (seenHashes.has(doc.hash)) {
        pageResults.push({ fileName: doc.fileName, duplicateFile: true, sections: [], excluded: [], views: [] });
        continue;
      }
      seenHashes.add(doc.hash);
    }
    for (const page of doc.pages || []) {
      pageResults.push(measureDuctsOnPage(page, doc.fileName));
    }
  }

  // Plantas: se duas vistas de planta possuem o mesmo conjunto de rótulos, mantém a mais completa
  const planGroups = new Map();
  for (const pr of pageResults) {
    const planSecs = (pr.sections || []).filter(s => s.viewType === 'PLANTA');
    if (!planSecs.length) continue;
    const key = `${pr.fileName}#${pr.pageNumber}`;
    planGroups.set(key, { pr, labels: new Set(planSecs.map(s => s.label)), length: planSecs.reduce((a, s) => a + s.lengthM, 0) });
  }
  const groups = [...planGroups.values()].sort((a, b) => b.length - a.length);
  for (let i = 1; i < groups.length; i++) {
    const g = groups[i];
    for (let j = 0; j < i; j++) {
      const ref = groups[j];
      const common = [...g.labels].filter(l => ref.labels.has(l)).length;
      if (common / g.labels.size >= 0.8 && Math.abs(g.length - ref.length) / ref.length <= 0.15) {
        const moved = g.pr.sections.filter(s => s.viewType === 'PLANTA');
        g.pr.sections = g.pr.sections.filter(s => s.viewType !== 'PLANTA');
        g.pr.excluded.push(...moved.map(s => ({ ...s, reason: 'PLANTA_REPETIDA_EM_OUTRA_PRANCHA', details: `Mesma planta de ${ref.pr.fileName} p.${ref.pr.pageNumber}` })));
        break;
      }
    }
  }

  const sections = [];
  let id = 1;
  for (const pr of pageResults) for (const s of pr.sections || []) sections.push({ id: id++, ...s });
  const excluded = pageResults.flatMap(pr => pr.excluded || []);
  const views = pageResults.flatMap(pr => (pr.views || []).map(v => ({ ...v, sourceFile: pr.fileName, sourcePage: pr.pageNumber })));

  return {
    sections,
    excluded,
    views,
    summary: summarizeSections(sections),
    status: sections.length > 0
      ? 'MEDIDO_GEOMETRIA'
      : (pageResults.some(p => p.labelsFound > 0) ? 'ROTULOS_SEM_GEOMETRIA_VALIDADA' : 'SEM_TRECHOS_IDENTIFICADOS')
  };
}

/**
 * Totais derivados da MESMA base de trechos (consumidos por materiais, acessórios e mão de obra).
 */
export function summarizeSections(sections = []) {
  const valid = sections.filter(s => Number(s.lengthM) > 0 && Number(s.widthCm) > 0 && Number(s.heightCm) > 0);
  const linear = valid.reduce((a, s) => a + Number(s.lengthM), 0);
  const area = valid.reduce((a, s) => a + (2 * (s.widthCm + s.heightCm) / 100) * s.lengthM, 0);
  const bySection = new Map();
  for (const s of valid) {
    const k = `${s.system}|${s.widthCm}x${s.heightCm}`;
    if (!bySection.has(k)) bySection.set(k, { system: s.system, widthCm: s.widthCm, heightCm: s.heightCm, lengthM: 0, areaM2: 0, count: 0 });
    const g = bySection.get(k);
    g.lengthM += s.lengthM;
    g.areaM2 += (2 * (s.widthCm + s.heightCm) / 100) * s.lengthM;
    g.count += 1;
  }
  return {
    sectionsCount: valid.length,
    totalLinearMeters: Number(linear.toFixed(2)),
    totalNetAreaM2: Number(area.toFixed(2)),
    bySection: [...bySection.values()].map(g => ({ ...g, lengthM: Number(g.lengthM.toFixed(2)), areaM2: Number(g.areaM2.toFixed(2)) }))
  };
}

// ---------------------------------------------------------------------------
// Circuitos frigorígenos: medidos pela camada da legenda; senão PREVISÃO por posição dos equipamentos
// ---------------------------------------------------------------------------
function legendStyleFor(page, regex) {
  const t = (page.texts || []).find(x => regex.test(x.text));
  if (!t) return null;
  // Símbolo da legenda: segmentos alinhados à linha do texto, imediatamente antes do início do texto
  const ux = Math.cos(t.angle || 0);
  const uy = Math.sin(t.angle || 0);
  const h = t.height || 6;
  const counts = new Map();
  for (const s of page.segments || []) {
    const mx = (s.x1 + s.x2) / 2 - t.x;
    const my = (s.y1 + s.y2) / 2 - t.y;
    const along = mx * ux + my * uy;
    const across = -mx * uy + my * ux;
    if (along >= -h * 9 && along <= -h * 0.2 && Math.abs(across - h * 0.35) <= h * 1.2) {
      counts.set(s.style, (counts.get(s.style) || 0) + 1);
    }
  }
  const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return best ? { style: best[0], legendText: t.text, legendPos: [t.x, t.y] } : null;
}

/**
 * Mede (ou prevê) o percurso de cada circuito evaporadora↔condensadora.
 * @param {Array} vectorDocs documentos vetoriais
 * @param {{evaporatorModels:string[], condenserModels:string[]}} equipment modelos documentados
 */
export function measureRefrigerantCircuits(vectorDocs = [], equipment = {}) {
  const evapRe = buildModelRegex(equipment.evaporatorModels);
  const condRe = buildModelRegex(equipment.condenserModels);
  const circuits = [];
  const notes = [];
  if (!evapRe || !condRe) {
    return { circuits, status: 'EQUIPAMENTOS_NAO_IDENTIFICADOS', notes: ['Modelos de evaporadora/condensadora não identificados na lista de material.'] };
  }

  for (const doc of vectorDocs) {
    for (const page of doc.pages || []) {
      const views = detectViews(page);
      const plan = views.find(v => v.viewType === 'PLANTA') || views[0];
      if (!plan?.scaleDenominator) continue;
      const mPerPt = PT_TO_M * plan.scaleDenominator;
      const inPlan = (x, y) => assignView(page, views, x, y) === plan;
      const evaps = (page.texts || []).filter(t => evapRe.test(t.text) && !/UNIDADE/i.test(t.text) && inPlan(t.x, t.y));
      const conds = (page.texts || []).filter(t => condRe.test(t.text) && !/UNIDADE/i.test(t.text) && inPlan(t.x, t.y));
      if (evaps.length === 0 || conds.length === 0) continue;

      const legend = legendStyleFor(page, /TUBULA[ÇC][AÃ]O\s+DE\s+G[AÁ]S?\s*REFRIGERANTE|LINHA\s+FRIGOR/i);
      const pipeSegs = legend
        ? (page.segments || []).filter(s => s.style === legend.style && inPlan(s.x1, s.y1) &&
          Math.hypot((s.x1 + s.x2) / 2 - legend.legendPos[0], (s.y1 + s.y2) / 2 - legend.legendPos[1]) > 60)
        : [];
      const pipeLenM = pipeSegs.reduce((a, s) => a + Math.hypot(s.x2 - s.x1, s.y2 - s.y1), 0) * mPerPt;

      // Pareamento guloso evaporadora → condensadora mais próxima
      const freeConds = conds.map(c => ({ c, used: false }));
      for (const e of evaps) {
        const [ex, ey] = textCenter(e);
        let best = null;
        for (const fc of freeConds) {
          if (fc.used) continue;
          const [cx, cy] = textCenter(fc.c);
          const manhattan = Math.abs(cx - ex) + Math.abs(cy - ey);
          if (!best || manhattan < best.d) best = { d: manhattan, fc, cx, cy };
        }
        if (!best) continue;
        best.fc.used = true;
        circuits.push({
          circuit: circuits.length + 1,
          evaporatorTag: e.text,
          condenserTag: best.fc.c.text,
          sourceFile: doc.fileName,
          sourcePage: page.pageNumber,
          view: plan.name,
          scale: `1:${plan.scaleDenominator}`,
          // Distância entre os símbolos (rótulos) dos equipamentos: base de PREVISÃO, não medição de percurso
          forecastRunM: Number((best.d * mPerPt).toFixed(2)),
          measuredRunM: null,
          measurementStatus: 'PREVISAO',
          premise: 'Tubulação frigorígena não desenhada na planta: percurso previsto pela distância ortogonal entre os rótulos da evaporadora e da condensadora pareadas. Requer conferência/medição.'
        });
      }
      if (legend && pipeLenM > 0) {
        notes.push(`Camada de tubulação frigorígena (${legend.style}) com ${pipeLenM.toFixed(2)} m desenhados em ${doc.fileName} p.${page.pageNumber}.`);
        const perCircuit = pipeLenM / Math.max(1, circuits.length);
        // Comprimento desenhado é medido; a repartição por circuito só é exata quando há 1 circuito
        for (const c of circuits.filter(x => x.sourceFile === doc.fileName && x.sourcePage === page.pageNumber)) {
          if (circuits.length === 1) {
            c.measuredRunM = Number(pipeLenM.toFixed(2));
            c.measurementStatus = 'MEDIDO';
            c.premise = 'Percurso medido na camada de tubulação frigorígena da legenda.';
          } else {
            c.forecastRunM = Number(perCircuit.toFixed(2));
            c.premise = 'Comprimento total medido na camada de tubulação frigorígena; repartição por circuito proporcional (PREVISÃO).';
          }
        }
      } else if (legend) {
        notes.push(`Legenda define tubulação frigorígena (${legend.style}), porém nenhum trecho dessa camada foi desenhado na planta ${doc.fileName} p.${page.pageNumber}.`);
      }
    }
    if (circuits.length) break; // circuitos vêm da primeira planta que contém os equipamentos
  }
  return {
    circuits,
    status: circuits.length === 0 ? 'EQUIPAMENTOS_NAO_LOCALIZADOS_NA_PLANTA' : (circuits.every(c => c.measurementStatus === 'MEDIDO') ? 'MEDIDO' : 'PREVISAO'),
    notes
  };
}

function buildModelRegex(models = []) {
  const keys = [...new Set((models || [])
    .filter(Boolean)
    .map(m => String(m).toUpperCase().replace(/[^A-Z0-9]/g, '').match(/^[A-Z]{2,5}-?\d{2,4}/))
    .filter(Boolean)
    .map(m => m[0].replace('-', '')))];
  if (!keys.length) return null;
  return new RegExp(`(?:${keys.map(k => k.replace(/^([A-Z]+)(\d+)/, '$1-?$2')).join('|')})`, 'i');
}

export function hashBuffer(buf) {
  return crypto.createHash('sha1').update(buf).digest('hex');
}
