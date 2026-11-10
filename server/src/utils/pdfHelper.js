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
 * Reconstrói linhas e tabelas a partir de itens posicionados com coordenadas (x, y) do PDF.js
 */
function reconstructPageLayoutFromItems(items = []) {
  const validItems = items
    .filter(item => item && typeof item.str === 'string' && item.str.trim().length > 0)
    .map(item => {
      const transform = Array.isArray(item.transform) ? item.transform : [1, 0, 0, 1, 0, 0];
      const x = Math.round((Number(transform[4]) || 0) * 10) / 10;
      const y = Math.round((Number(transform[5]) || 0) * 10) / 10;
      return {
        text: item.str.trim(),
        x,
        y,
        width: Math.round((Number(item.width) || 0) * 10) / 10,
        height: Math.round((Number(item.height) || 0) * 10) / 10
      };
    });

  // Agrupa itens por linha horizontal (tolerância vertical de 3.5 pontos no eixo Y)
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
    coordItemsSample: validItems.slice(0, 250),
    reconstructedLines
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

          const layout = reconstructPageLayoutFromItems(textContent?.items || []);
          const plainLines = layout.reconstructedLines.map(r => r.cells.map(c => c.text).join(' '));
          const tableFormattedLines = layout.reconstructedLines
            .filter(r => r.cells.length >= 2)
            .map(r => `[Y=${r.y}] ${r.lineText}`);

          const pageRawText = plainLines.join('\n');
          pagesData.push({
            pageNumber: pageIndex,
            coordItemsCount: layout.coordItemsCount,
            coordinates: layout.coordItemsSample,
            tableRows: tableFormattedLines,
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
