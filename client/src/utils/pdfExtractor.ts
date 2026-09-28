import * as pdfjsLib from 'pdfjs-dist';

// Configura o worker do pdf.js para execução no navegador
if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString();
  } catch (e) {
    console.warn('[PDF Worker Init Warning]', e);
  }
}

/**
 * Extrai texto completo de um arquivo PDF diretamente no navegador do usuário.
 * Isso contorna permanentemente o limite de 4.5 MB do Vercel Serverless Functions,
 * pois apenas o texto puro resultante (poucos KB) precisa ser transmitido.
 */
export async function extractTextFromPDF(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    let fullText = '';

    const maxPages = Math.min(pdf.numPages, 100);
    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageStrings = textContent.items
        .map((item: any) => (item && typeof item.str === 'string' ? item.str : ''))
        .filter(Boolean);

      const pageText = pageStrings.join(' ');
      if (pageText.trim()) {
        fullText += `\n[Página ${pageNum}]\n` + pageText;
      }

      // Limita a 100.000 caracteres (mais do que suficiente para o agente de IA analisar)
      if (fullText.length >= 100000) {
        fullText = fullText.slice(0, 100000);
        break;
      }
    }

    return fullText.trim();
  } catch (err: any) {
    console.warn(`[PDF Extractor] Falha ao extrair texto do PDF (${file.name}):`, err.message || err);
    return '';
  }
}
