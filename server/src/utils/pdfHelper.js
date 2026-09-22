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

export async function extractTextFromPdfBuffer(buffer) {
  if (!PDFParse) return '';
  try {
    if (typeof PDFParse === 'function' && !PDFParse.prototype?.getText) {
      // pdf-parse 1.1.1: função direta, 100% estável em Serverless Linux / Vercel
      const data = await PDFParse(Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer));
      return (data && data.text) ? data.text : '';
    } else {
      // Fallback para versões orientadas a classe
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
