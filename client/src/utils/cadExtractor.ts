/**
 * Utilitário de extração de dados e anotações técnicas de arquivos CAD (.dwg e .dxf)
 * diretamente no navegador do usuário.
 * 
 * Isso contorna permanentemente o limite de 4.5 MB da Vercel Serverless (HTTP 413 FUNCTION_PAYLOAD_TOO_LARGE),
 * extraindo as especificações técnicas, cotas, tags de equipamentos e memórias de projeto
 * para alimentar a IA da SABRAR com dados completos.
 */

export async function extractTextFromCad(file: File): Promise<string> {
  const isDxf = file.name.toLowerCase().endsWith('.dxf');

  try {
    if (isDxf) {
      // 1. Extração estruturada de DXF (formato de texto aberto)
      const text = await file.text();
      return parseDxfText(text, file.name);
    } else {
      // 2. Extração de anotações e strings de projeto em DWG binário
      const arrayBuffer = await file.arrayBuffer();
      return parseDwgBuffer(arrayBuffer, file.name);
    }
  } catch (err: any) {
    console.warn(`[CAD Extractor] Falha ao extrair texto do arquivo CAD (${file.name}):`, err.message || err);
    return `[PROJETO CAD: ${file.name}] Arquivo técnico submetido para estimativa orçamentária SABRAR.`;
  }
}

function parseDxfText(dxfContent: string, fileName: string): string {
  const lines = dxfContent.split(/\r?\n/);
  const textItems: string[] = [];
  const layers: Set<string> = new Set();

  for (let i = 0; i < lines.length - 1; i++) {
    const code = lines[i].trim();
    const val = lines[i + 1] ? lines[i + 1].trim() : '';

    // Grupo 8: Layer / Camada
    if (code === '8' && val) {
      layers.add(val);
    }

    // Grupo 1 ou 3: Texto de entidade (TEXT, MTEXT, ATTRIB, DIMENSION)
    if ((code === '1' || code === '3') && val && val.length > 1) {
      // Remove formatações internas do AutoCAD tipo {\fArial|...} ou \P (quebra de linha)
      const cleaned = val
        .replace(/\\P/g, ' ')
        .replace(/\\X/g, ' ')
        .replace(/\{[^\}]*\}/g, '')
        .replace(/\\[A-Za-z0-9]+;?/g, '')
        .replace(/%%[A-Za-z0-9]/g, '')
        .trim();

      if (cleaned.length > 1 && !textItems.includes(cleaned)) {
        textItems.push(cleaned);
      }
    }
  }

  const layersList = Array.from(layers).slice(0, 30).join(', ');
  const textsFormatted = textItems.slice(0, 1500).join('\n');

  return `[PROJETO CAD DXF - ${fileName}]\n` +
    `Camadas/Layers detectadas: ${layersList}\n\n` +
    `[ANOTAÇÕES E ESPECIFICAÇÕES DO PROJETO]\n` +
    `${textsFormatted}`.slice(0, 95000);
}

function parseDwgBuffer(buffer: ArrayBuffer, fileName: string): string {
  const bytes = new Uint8Array(buffer);
  const sizeMb = (bytes.length / (1024 * 1024)).toFixed(1);

  // Lê versão do cabeçalho (primeiros 6 bytes)
  let version = '';
  for (let i = 0; i < Math.min(6, bytes.length); i++) {
    version += String.fromCharCode(bytes[i]);
  }

  const rawStrings: string[] = [];
  let curAscii = '';

  // 1. Extração ASCII legível
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (b >= 32 && b <= 126) {
      curAscii += String.fromCharCode(b);
    } else {
      if (curAscii.length >= 3) {
        rawStrings.push(curAscii);
      }
      curAscii = '';
    }
  }

  // 2. Extração UTF-16LE legível
  let curU16 = '';
  for (let i = 0; i < bytes.length - 1; i += 2) {
    const b1 = bytes[i];
    const b2 = bytes[i + 1];
    if (b2 === 0 && b1 >= 32 && b1 <= 126) {
      curU16 += String.fromCharCode(b1);
    } else {
      if (curU16.length >= 3) {
        rawStrings.push(curU16);
      }
      curU16 = '';
    }
  }

  // Filtra strings técnicas úteis e descarta ruído binário
  const isMeaningful = (s: string) => {
    if (s.length < 3 || s.length > 200) return false;
    if (!/[a-zA-Z0-9]/.test(s)) return false;
    // Descarta padrões de código/metadados internos do AutoCAD
    if (/^(AcDb|AcId|STANDARD|Continuous|ByLayer|ByBlock|Arial|DIM|LAYER)/i.test(s) && s.length < 12) return false;
    const nonPrintable = s.replace(/[a-zA-Z0-9\s.,_\-/:()º°"'+*=xX]/g, '').length;
    return (nonPrintable / s.length) <= 0.25;
  };

  const filtered = rawStrings.filter(isMeaningful);
  const unique = Array.from(new Set(filtered));

  // Prioriza termos cruciais de engenharia térmica e ar condicionado
  const hvacKeywords = [
    'ar condicionado', 'climatiza', 'exaust', 'ventil', 'coifa', 'duto', 'chapa',
    'fxfq', 'rxym', 'khrp', 'daikin', 'carrier', 'trane', 'midea', 'york', 'hitachi',
    'split', 'vrv', 'vrf', 'fancoil', 'chiller', 'cobre', 'isolam', 'armaflex',
    'grelha', 'difus', 'damper', 'filtro', 'pressuri', 'vazao', 'vazão', 'm3/h', 'm³/h',
    'tr', 'btu', 'cv', 'hp', 'terreo', 'jirau', 'cobertura', 'r-410a', 'refnet', 'tubo',
    'loja', 'sala', 'varanda', 'refeitorio', 'atendimento', 'cozinha'
  ];

  const highPriority = unique.filter(s => {
    const lower = s.toLowerCase();
    return hvacKeywords.some(kw => lower.includes(kw));
  });

  const generalStrings = unique
    .filter(s => !highPriority.includes(s))
    .slice(0, 1000);

  const combined = [
    ...highPriority,
    ...generalStrings
  ].slice(0, 1500).join('\n');

  return `[PROJETO CAD DWG - ${fileName} (${sizeMb} MB - AutoCAD ${version})]\n` +
    `Total de termos e anotações técnicas identificadas: ${unique.length}\n` +
    `Anotações prioritárias de HVAC/Climatização: ${highPriority.length}\n\n` +
    `[ESPECIFICAÇÕES TÉCNICAS E TEXTOS EXTRAÍDOS DO PROJETO]\n` +
    `${combined}`.slice(0, 95000);
}
