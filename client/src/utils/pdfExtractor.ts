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
      const viewport = page.getViewport({ scale: 1.0 });
      const textContent = await page.getTextContent();
      const rawItems = (textContent.items || []).filter(
        (item: any) => item && typeof item.str === 'string' && item.str.trim().length > 0
      );

      let countRot270 = 0;
      let countRot90 = 0;
      let maxRawX = viewport?.width || 2400;
      let maxRawY = viewport?.height || 2400;

      for (const item of rawItems as any[]) {
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

      const isRotated270 = viewport?.rotation === 270 || countRot270 > rawItems.length * 0.4;
      const isRotated90 = !isRotated270 && (viewport?.rotation === 90 || countRot90 > rawItems.length * 0.4);

      const visualItems = (rawItems as any[]).map(item => {
        const tr = Array.isArray(item.transform) ? item.transform : [1, 0, 0, 1, 0, 0];
        const rawX = Number(tr[4]) || 0;
        const rawY = Number(tr[5]) || 0;
        let x = rawX;
        let y = rawY;
        if (isRotated270) {
          x = maxRawY - rawY;
          y = rawX;
        } else if (isRotated90) {
          x = rawY;
          y = maxRawX - rawX;
        }
        return {
          text: item.str.trim(),
          x: Math.round(x * 10) / 10,
          y: Math.round(y * 10) / 10
        };
      });

      const rows: { y: number; cells: { text: string; x: number; y: number }[] }[] = [];
      const sorted = [...visualItems].sort((a, b) => b.y - a.y || a.x - b.x);
      for (const it of sorted) {
        let row = rows.find(r => Math.abs(r.y - it.y) <= 3.5);
        if (!row) {
          row = { y: it.y, cells: [] };
          rows.push(row);
        }
        row.cells.push(it);
      }

      const pageText = rows
        .map(r => {
          r.cells.sort((a, b) => a.x - b.x);
          return r.cells.map(c => c.text).join(' ');
        })
        .join('\n');

      if (pageText.trim()) {
        fullText += `\n=== [ARQUIVO: ${file.name} | PÁGINA ${pageNum}] ===\n` + pageText;
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
