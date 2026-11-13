/**
 * EXTRAÇÃO VETORIAL DE PRANCHAS PDF (CAD)
 *
 * Lê os operadores de desenho de cada página (linhas, retângulos, curvas) com a matriz de
 * transformação aplicada e devolve segmentos em coordenadas de página (pt), junto com os
 * textos posicionados. Nenhuma escala, comprimento ou dimensão é presumida aqui: este módulo
 * apenas expõe a geometria desenhada para o medidor (ductGeometryMeasurement.js).
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

let PDFJS = null;
try {
  PDFJS = require('pdf-parse/lib/pdf.js/v1.10.100/build/pdf.js');
  PDFJS.disableWorker = true;
  PDFJS.disableFontFace = true;
} catch (err) {
  console.warn('[pdfVectorGeometry] pdf.js indisponível:', err.message);
}

export const PT_TO_M = 0.0254 / 72; // 1 pt = 1/72 pol

const mul = (m, n) => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5]
];
const apply = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

function colorKey(args) {
  if (!args) return 'default';
  if (typeof args[0] === 'string') {
    const hex = args[0].replace('#', '');
    if (hex.length === 6) {
      return [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16)).join(',');
    }
    return args[0];
  }
  return [args[0], args[1], args[2]].map(v => Math.round(Number(v) || 0)).join(',');
}

/**
 * Converte a lista de operadores de uma página em segmentos com estilo de traço.
 */
export function operatorListToSegments(opList, OPS) {
  let ctm = [1, 0, 0, 1, 0, 0];
  let stroke = '0,0,0';
  let lineWidth = 1;
  const stack = [];
  let pending = [];
  const segments = [];

  const flush = () => {
    const scale = Math.sqrt(Math.abs(ctm[0] * ctm[3] - ctm[1] * ctm[2])) || 1;
    const w = Math.round(lineWidth * scale * 1000) / 1000;
    for (const s of pending) {
      if (!s.a || !s.b) continue;
      const len = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]);
      if (len < 0.05) continue;
      segments.push({
        x1: Math.round(s.a[0] * 100) / 100,
        y1: Math.round(s.a[1] * 100) / 100,
        x2: Math.round(s.b[0] * 100) / 100,
        y2: Math.round(s.b[1] * 100) / 100,
        style: `${stroke}|${w}`,
        curve: Boolean(s.curve)
      });
    }
    pending = [];
  };

  for (let i = 0; i < opList.fnArray.length; i++) {
    const fn = opList.fnArray[i];
    const a = opList.argsArray[i];
    if (fn === OPS.save) stack.push({ ctm, stroke, lineWidth });
    else if (fn === OPS.restore) {
      const s = stack.pop();
      if (s) ({ ctm, stroke, lineWidth } = s);
    } else if (fn === OPS.transform) ctm = mul(ctm, a);
    else if (fn === OPS.setStrokeRGBColor) stroke = colorKey(a);
    else if (fn === OPS.setStrokeGray) stroke = [a[0], a[0], a[0]].map(v => Math.round(v * 255)).join(',');
    else if (fn === OPS.setLineWidth) lineWidth = a[0];
    else if (fn === OPS.constructPath) {
      const [pops, coords] = a;
      let k = 0;
      let cur = null;
      let start = null;
      for (const op of pops) {
        if (op === OPS.moveTo) {
          cur = apply(ctm, coords[k], coords[k + 1]);
          start = cur;
          k += 2;
        } else if (op === OPS.lineTo) {
          const p = apply(ctm, coords[k], coords[k + 1]);
          k += 2;
          pending.push({ a: cur, b: p });
          cur = p;
        } else if (op === OPS.curveTo) {
          const p = apply(ctm, coords[k + 4], coords[k + 5]);
          k += 6;
          pending.push({ a: cur, b: p, curve: true });
          cur = p;
        } else if (op === OPS.curveTo2 || op === OPS.curveTo3) {
          const p = apply(ctm, coords[k + 2], coords[k + 3]);
          k += 4;
          pending.push({ a: cur, b: p, curve: true });
          cur = p;
        } else if (op === OPS.closePath) {
          if (cur && start) pending.push({ a: cur, b: start });
          cur = start;
        } else if (op === OPS.rectangle) {
          const [x, y, w, h] = [coords[k], coords[k + 1], coords[k + 2], coords[k + 3]];
          k += 4;
          const pts = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]].map(q => apply(ctm, q[0], q[1]));
          for (let j = 0; j < 4; j++) pending.push({ a: pts[j], b: pts[(j + 1) % 4] });
        }
      }
    } else if (fn === OPS.stroke || fn === OPS.closeStroke || fn === OPS.fillStroke ||
      fn === OPS.eoFillStroke || fn === OPS.closeFillStroke || fn === OPS.closeEOFillStroke) {
      flush();
    } else if (fn === OPS.endPath || fn === OPS.fill || fn === OPS.eoFill) {
      pending = [];
    }
  }
  return segments;
}

/**
 * Extrai segmentos vetoriais e textos (coordenadas brutas de página, em pt) de todas as páginas.
 * @returns {Promise<{fileName:string, pages:Array<{pageNumber:number, rotate:number, view:number[], segments:Array, texts:Array}>}>}
 */
export async function extractPdfVectorData(buffer, fileName = 'documento.pdf', options = {}) {
  if (!PDFJS || !buffer) return { fileName, pages: [], error: 'PDFJS_INDISPONIVEL' };
  const maxPages = options.maxPages || 20;
  const data = new Uint8Array(Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer));
  let doc;
  try {
    doc = await PDFJS.getDocument({ data, disableFontFace: true });
  } catch (err) {
    return { fileName, pages: [], error: err.message };
  }
  // O FontLoader do pdf.js 1.x depende de DOM (document.createElement). Para leitura geométrica
  // não precisamos registrar fontes: o bind é substituído por um callback imediato.
  if (doc?.transport?.fontLoader) {
    doc.transport.fontLoader.bind = (fonts, callback) => { if (callback) callback(fonts); };
  }

  const pages = [];
  const total = Math.min(doc.numPages, maxPages);
  for (let p = 1; p <= total; p++) {
    try {
      const page = await doc.getPage(p);
      const opList = await page.getOperatorList();
      const segments = operatorListToSegments(opList, PDFJS.OPS);
      const tc = await page.getTextContent({ normalizeWhitespace: false, disableCombineTextItems: false });
      const texts = (tc.items || [])
        .filter(it => it && typeof it.str === 'string' && it.str.trim())
        .map(it => {
          const tr = it.transform || [1, 0, 0, 1, 0, 0];
          return {
            text: it.str.trim(),
            x: Math.round(tr[4] * 100) / 100,
            y: Math.round(tr[5] * 100) / 100,
            angle: Math.atan2(tr[1], tr[0]),
            width: Number(it.width) || 0,
            // tamanho da fonte pela matriz (it.height não é confiável em pdf.js 1.x)
            height: Math.hypot(tr[0], tr[1]) || Number(it.height) || 0
          };
        });
      pages.push({ pageNumber: p, rotate: page.rotate || 0, view: page.view, segments, texts });
    } catch (err) {
      pages.push({ pageNumber: p, rotate: 0, view: null, segments: [], texts: [], error: err.message });
    }
  }
  try { doc.destroy(); } catch (_) { /* noop */ }
  return { fileName, pages };
}
