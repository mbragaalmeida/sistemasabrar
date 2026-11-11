// Polyfills necessários para o pdf-parse em ambientes Serverless Linux (AWS Lambda / Vercel)
if (typeof globalThis.DOMMatrix === 'undefined') {
  globalThis.DOMMatrix = class DOMMatrix {};
}
if (typeof globalThis.ImageData === 'undefined') {
  globalThis.ImageData = class ImageData {};
}
if (typeof globalThis.Path2D === 'undefined') {
  globalThis.Path2D = class Path2D {};
}

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

let PDFParse = null;
try {
  const pdfParsePkg = require('pdf-parse');
  PDFParse = pdfParsePkg.PDFParse || pdfParsePkg.default || pdfParsePkg;
} catch (err) {
  console.warn('[PDFHelper] Falha ao carregar pdf-parse:', err.message);
}

/**
 * Extrai e reconstrói tabelas CAD (Lista de Material / Quadro de Equipamentos)
 * diretamente a partir das coordenadas visuais normalizadas (x, y).
 */
function reconstructCadTablesFromVisualItems(visualItems = []) {
  const structuredTables = [];
  const titleItems = visualItems.filter(it =>
    /LISTA\s+DE\s+MATERIA(?:L|IS)|QUADRO\s+DE\s+EQUIPAMENTOS|RELA[ÇC][AÃ]O\s+DE\s+MATERIA(?:L|IS)/i.test(it.text)
  );

  for (const titleIt of titleItems) {
    const headerBand = visualItems.filter(it =>
      it.y <= titleIt.y + 10 &&
      it.y >= titleIt.y - 120 &&
      Math.abs(it.x - titleIt.x) <= 500
    );

    const itemHdr = headerBand.find(it => /^ITEM$/i.test(it.text));
    const qtdHdr = headerBand.find(it => /^(?:QTD\.?|QUANT(?:IDADE)?\.?)$/i.test(it.text));
    const descHdr = headerBand.find(it => /DESCRI[ÇC][AÃ]O|DISCRIMINA[ÇC][AÃ]O|MATERIAL|EQUIPAMENTO/i.test(it.text) && it !== titleIt);
    const refHdr = headerBand.find(it => /^(?:REF\.?|MARCA|FABRICANTE)$/i.test(it.text));

    if (!itemHdr || !qtdHdr) continue;

    // Localiza as âncoras de linha na coluna ITEM (01, 02, 03...)
    const rawAnchors = visualItems
      .filter(it =>
        Math.abs(it.x - itemHdr.x) <= 28 &&
        it.y < itemHdr.y - 5 &&
        it.y > itemHdr.y - 450 &&
        /^0?[1-9]\d?$/.test(it.text)
      )
      .sort((a, b) => b.y - a.y);

    const anchors = [];
    for (const cand of rawAnchors) {
      const num = parseInt(cand.text, 10);
      if (anchors.length === 0) {
        if (num === 1) anchors.push({ ...cand, itemNum: num });
      } else {
        const prev = anchors[anchors.length - 1];
        if (num === prev.itemNum + 1 && Math.abs(prev.y - cand.y) >= 10 && Math.abs(prev.y - cand.y) <= 60) {
          anchors.push({ ...cand, itemNum: num });
        }
      }
    }

    if (anchors.length === 0) continue;

    // Calcula metade da distância vertical média entre linhas da tabela
    let avgSpacing = 26;
    if (anchors.length >= 2) {
      let sumDiff = 0;
      for (let i = 0; i < anchors.length - 1; i++) {
        sumDiff += Math.abs(anchors[i].y - anchors[i + 1].y);
      }
      avgSpacing = sumDiff / (anchors.length - 1);
    }
    const rowHalfBand = Math.max(8, Math.min(18, avgSpacing * 0.48));

    const headerXs = [itemHdr.x, qtdHdr.x, descHdr?.x, refHdr?.x].filter(v => typeof v === 'number');
    const minTableX = Math.min(...headerXs) - 35;
    const maxTableX = Math.max(...headerXs, (descHdr?.x || qtdHdr.x) + 420) + 100;
    const descMinX = Math.max(itemHdr.x, qtdHdr.x) + 12;
    const descMaxX = refHdr && refHdr.x > descMinX ? refHdr.x - 15 : maxTableX;

    const rows = [];
    for (const anchor of anchors) {
      const rowCells = visualItems.filter(it =>
        it !== anchor &&
        it.x >= minTableX &&
        it.x <= maxTableX &&
        Math.abs(it.y - anchor.y) <= rowHalfBand
      );

      const qtdCell = rowCells.find(it =>
        Math.abs(it.x - qtdHdr.x) <= 28 && /^\d{1,4}$/.test(it.text)
      );

      const refCells = refHdr
        ? rowCells
            .filter(it => Math.abs(it.x - refHdr.x) <= 45 && it !== qtdCell)
            .sort((a, b) => b.y - a.y || a.x - b.x)
        : [];

      const descCells = rowCells
        .filter(it =>
          it !== qtdCell &&
          !refCells.includes(it) &&
          it.x >= descMinX &&
          it.x <= descMaxX
        )
        .sort((a, b) => (Math.abs(b.y - a.y) > 2.5 ? b.y - a.y : a.x - b.x));

      const qtyVal = qtdCell ? parseInt(qtdCell.text, 10) : null;
      const descText = descCells.map(c => c.text).join(' ').replace(/\s+/g, ' ').trim();
      const refText = refCells.map(c => c.text).join(' ').replace(/\s+/g, ' ').trim();

      if (qtyVal !== null && descText) {
        rows.push({
          itemNum: String(anchor.itemNum).padStart(2, '0'),
          quantity: qtyVal,
          description: descText,
          brand: refText || null,
          formatted: `ITEM ${String(anchor.itemNum).padStart(2, '0')} | QTD: ${String(qtyVal).padStart(2, '0')} | DESC: ${descText}${refText ? ` | REF: ${refText}` : ''}`
        });
      }
    }

    if (rows.length > 0) {
      structuredTables.push({
        title: titleIt.text,
        rows
      });
    }
  }

  return structuredTables;
}

/**
 * Reconstrói linhas e tabelas a partir de itens posicionados com coordenadas (x, y) do PDF.js,
 * normalizando automaticamente pranchas CAD rotacionadas em 270° ou 90°.
 */
function reconstructPageLayoutFromItems(items = [], pageRotate = 0, pageView = null) {
  const rawFiltered = items.filter(item => item && typeof item.str === 'string' && item.str.trim().length > 0);
  if (rawFiltered.length === 0) {
    return {
      coordItemsCount: 0,
      coordItemsSample: [],
      reconstructedLines: [],
      structuredCadTables: []
    };
  }

  // Detecta se os itens estão rotacionados em 270° ou 90° pela matriz de transformação ou metadado da página
  let countRot270 = 0;
  let countRot90 = 0;
  let maxRawX = Array.isArray(pageView) && pageView.length >= 4 ? Number(pageView[2]) || 2400 : 2400;
  let maxRawY = Array.isArray(pageView) && pageView.length >= 4 ? Number(pageView[3]) || 2400 : 2400;

  for (const item of rawFiltered) {
    const tr = Array.isArray(item.transform) ? item.transform : [1, 0, 0, 1, 0, 0];
    const a = Number(tr[0]) || 0;
    const b = Number(tr[1]) || 0;
    const tx = Number(tr[4]) || 0;
    const ty = Number(tr[5]) || 0;
    if (tx > maxRawX) maxRawX = tx;
    if (ty > maxRawY) maxRawY = ty;
    if (Math.abs(b) > Math.abs(a) * 2) {
      if (b < 0) countRot270++;
      else if (b > 0) countRot90++;
    }
  }

  const isRotated270 = pageRotate === 270 || countRot270 > rawFiltered.length * 0.4;
  const isRotated90 = !isRotated270 && (pageRotate === 90 || countRot90 > rawFiltered.length * 0.4);

  const validItems = rawFiltered.map(item => {
    const transform = Array.isArray(item.transform) ? item.transform : [1, 0, 0, 1, 0, 0];
    const rawX = Number(transform[4]) || 0;
    const rawY = Number(transform[5]) || 0;

    let x = rawX;
    let y = rawY;
    if (isRotated270) {
      // Na rotação 270°, a leitura esquerda->direita percorre rawY decrescente e topo->base percorre rawX decrescente
      x = maxRawY - rawY;
      y = rawX;
    } else if (isRotated90) {
      x = rawY;
      y = maxRawX - rawX;
    }

    return {
      text: item.str.trim(),
      x: Math.round(x * 10) / 10,
      y: Math.round(y * 10) / 10,
      rawX: Math.round(rawX * 10) / 10,
      rawY: Math.round(rawY * 10) / 10,
      width: Math.round((Number(item.width) || 0) * 10) / 10,
      height: Math.round((Number(item.height) || 0) * 10) / 10
    };
  });

  // Reconstrói tabelas CAD estruturadas por coordenadas (ITEM | QTD | DESCRIÇÃO | REF)
  const structuredCadTables = reconstructCadTablesFromVisualItems(validItems);

  // Agrupa itens por linha horizontal visual (tolerância vertical de 3.5 pontos no eixo Y visual)
  const rows = [];
  const yTolerance = 3.5;

  const sortedByYDesc = [...validItems].sort((a, b) => b.y - a.y || a.x - b.x);
  for (const item of sortedByYDesc) {
    let matchedRow = rows.find(r => Math.abs(r.y - item.y) <= yTolerance);
    if (!matchedRow) {
      matchedRow = { y: item.y, cells: [] };
      rows.push(matchedRow);
    }
    matchedRow.cells.push(item);
  }

  // Ordena células da esquerda para a direita dentro de cada linha
  const reconstructedLines = rows.map(row => {
    row.cells.sort((a, b) => a.x - b.x);
    const lineText = row.cells.map(c => c.text).join(' | ');
    return {
      y: row.y,
      cells: row.cells,
      lineText
    };
  });

  return {
    coordItemsCount: validItems.length,
    coordItemsSample: validItems,
    reconstructedLines,
    structuredCadTables
  };
}

/**
 * Extrai dados estruturados por página de um buffer PDF, preservando coordenadas (x, y),
 * linhas reconstruídas por alinhamento vertical e metadados de escala/dimensões.
 */
export async function extractStructuredPdfData(buffer, fileName = 'documento.pdf') {
  if (!PDFParse || !buffer) {
    return {
      fileName,
      numPages: 0,
      pages: [],
      fullStructuredText: ''
    };
  }

  const pagesData = [];

  try {
    const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);

    if (typeof PDFParse === 'function' && !PDFParse.prototype?.getText) {
      let pageCounter = 0;
      const options = {
        pagerender: async function (pageData) {
          pageCounter += 1;
          const pageIndex = pageData.pageIndex != null ? pageData.pageIndex + 1 : pageCounter;
          const textContent = await pageData.getTextContent({
            normalizeWhitespace: false,
            disableCombineTextItems: false
          });

          const layout = reconstructPageLayoutFromItems(
            textContent?.items || [],
            pageData.rotate || 0,
            pageData.view || null
          );
          const plainLines = layout.reconstructedLines.map(r => r.cells.map(c => c.text).join(' '));
          const tableFormattedLines = layout.reconstructedLines
            .filter(r => r.cells.length >= 2)
            .map(r => `[Y=${r.y}] ${r.lineText}`);

          let cadTableSection = '';
          if (Array.isArray(layout.structuredCadTables) && layout.structuredCadTables.length > 0) {
            const blocks = layout.structuredCadTables.map(tb =>
              `[TABELA_CAD_ESTRUTURADA: ${tb.title}]\n` +
              tb.rows.map(r => r.formatted).join('\n') +
              `\n[/TABELA_CAD_ESTRUTURADA]`
            );
            cadTableSection = blocks.join('\n\n') + '\n\n';
          }

          const pageRawText = cadTableSection + plainLines.join('\n');
          pagesData.push({
            pageNumber: pageIndex,
            coordItemsCount: layout.coordItemsCount,
            coordinates: layout.coordItemsSample,
            tableRows: tableFormattedLines,
            structuredCadTables: layout.structuredCadTables,
            text: pageRawText
          });

          return `\n=== [ARQUIVO: ${fileName} | PÁGINA ${pageIndex}] ===\n${pageRawText}\n`;
        }
      };

      const data = await PDFParse(buf, options);
      const fullText = (data && data.text) ? data.text : pagesData.map(p => p.text).join('\n');

      return {
        fileName,
        numPages: data?.numpages || pagesData.length || 1,
        pages: pagesData,
        fullStructuredText: fullText
      };
    } else {
      const parser = new PDFParse(new Uint8Array(buf));
      const result = await parser.getText();
      const rawText = (result && result.text) ? result.text : '';
      return parseStructuredDocumentText(rawText, fileName);
    }
  } catch (err) {
    console.warn('[PDFHelper] Erro ao extrair dados estruturados do PDF:', err.message);
    return {
      fileName,
      numPages: 0,
      pages: [],
      fullStructuredText: ''
    };
  }
}

/**
 * Analisa e estrutura um texto de documento (por página, tabelas, escalas e cotas)
 * quando o documento já foi salvo em content_summary ou extraído previamente.
 */
export function parseStructuredDocumentText(rawText, fileName = 'documento.pdf') {
  const cleanText = String(rawText || '');
  if (!cleanText.trim()) {
    return {
      fileName,
      numPages: 0,
      pages: [],
      tablesDetected: [],
      scalesDetected: [],
      fullStructuredText: ''
    };
  }

  // Divide por marcadores explícitos de página ou form-feed (\f) ou blocos de carimbo PRANCHA XX/YY
  let rawPages = [];
  if (/===\s*\[ARQUIVO:.*?PÁGINA\s+\d+\]\s*===/i.test(cleanText)) {
    rawPages = cleanText.split(/===\s*\[ARQUIVO:.*?PÁGINA\s+\d+\]\s*===/i).map(s => s.trim()).filter(Boolean);
  } else if (cleanText.includes('\f')) {
    rawPages = cleanText.split('\f').map(s => s.trim()).filter(Boolean);
  } else {
    rawPages = [cleanText];
  }

  const tablesDetected = [];
  const scalesDetected = [];

  const pages = rawPages.map((pageText, idx) => {
    const pageNumber = idx + 1;
    const lines = pageText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

    // Detecta escalas (ex: ESCALA 1:50, ESC 1/75, S/ESCALA)
    for (const line of lines) {
      const scaleMatches = line.match(/\b(?:ESCALA|ESC\.?)\s*[:\-]?\s*(?:1\s*[:\/]\s*\d+|S\s*\/\s*ESC(?:ALA)?|INDICADA)/gi);
      if (scaleMatches) {
        scalesDetected.push(...scaleMatches.map(s => ({ pageNumber, scale: s.trim() })));
      }
    }

    // Detecta blocos de tabela (LISTA DE MATERIAL, RELAÇÃO DE EQUIPAMENTOS, LEGENDA)
    const pageTables = [];
    for (let i = 0; i < lines.length; i++) {
      if (/\b(?:LISTA\s+DE\s+MATERIA(?:L|IS)|QUADRO\s+DE\s+EQUIPAMENTOS|RELA[CÇ][AÃ]O\s+DE\s+MATERIAIS|LEGENDA\s+DE\s+PROJETO)\b/i.test(lines[i])) {
        const snippet = lines.slice(i, Math.min(lines.length, i + 45)).join('\n');
        pageTables.push({
          header: lines[i],
          lineStart: i + 1,
          snippet
        });
        tablesDetected.push({ fileName, pageNumber, header: lines[i] });
      }
    }

    return {
      pageNumber,
      lineCount: lines.length,
      charCount: pageText.length,
      tables: pageTables,
      text: pageText
    };
  });

  return {
    fileName,
    numPages: pages.length,
    pages,
    tablesDetected,
    scalesDetected,
    fullStructuredText: pages
      .map(p => `=== [ARQUIVO: ${fileName} | PÁGINA ${p.pageNumber}] ===\n${p.text}`)
      .join('\n\n')
  };
}

export async function extractTextFromPdfBuffer(buffer, fileName = 'documento.pdf') {
  if (!PDFParse) return '';
  try {
    const structured = await extractStructuredPdfData(buffer, fileName);
    if (structured && structured.fullStructuredText) {
      return structured.fullStructuredText;
    }
    if (typeof PDFParse === 'function' && !PDFParse.prototype?.getText) {
      const data = await PDFParse(Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer));
      return (data && data.text) ? data.text : '';
    } else {
      const parser = new PDFParse(new Uint8Array(buffer));
      const result = await parser.getText();
      return (result && result.text) ? result.text : '';
    }
  } catch (err) {
    console.warn('[PDFHelper] Erro ao processar buffer do PDF:', err.message);
    return '';
  }
}

export { PDFParse };
