/**
 * Helper para extração de textos e especificações de engenharia de arquivos CAD (.dwg, .dxf)
 */

export function extractCadTextFromBuffer(buf, fileName = 'projeto.dwg') {
  const isDxf = fileName.toLowerCase().endsWith('.dxf');

  if (isDxf) {
    try {
      const text = buf.toString('utf8');
      const lines = text.split(/\r?\n/);
      const textItems = [];
      const layers = new Set();

      for (let i = 0; i < lines.length - 1; i++) {
        const code = lines[i].trim();
        const val = lines[i + 1] ? lines[i + 1].trim() : '';

        if (code === '8' && val) layers.add(val);
        if ((code === '1' || code === '3') && val && val.length > 1) {
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

      return `[PROJETO CAD DXF - ${fileName}]\n` +
        `Camadas detectadas: ${Array.from(layers).slice(0, 30).join(', ')}\n\n` +
        `[ANOTAÇÕES E ESPECIFICAÇÕES DO PROJETO]\n` +
        textItems.slice(0, 1500).join('\n').slice(0, 95000);
    } catch (e) {
      return `[PROJETO CAD DXF: ${fileName}]`;
    }
  }

  // DWG binário
  try {
    const rawStrings = [];
    let curAscii = '';

    for (let i = 0; i < buf.length; i++) {
      const b = buf[i];
      if (b >= 32 && b <= 126) {
        curAscii += String.fromCharCode(b);
      } else {
        if (curAscii.length >= 3) rawStrings.push(curAscii);
        curAscii = '';
      }
    }

    let curU16 = '';
    for (let i = 0; i < buf.length - 1; i += 2) {
      const b1 = buf[i];
      const b2 = buf[i + 1];
      if (b2 === 0 && b1 >= 32 && b1 <= 126) {
        curU16 += String.fromCharCode(b1);
      } else {
        if (curU16.length >= 3) rawStrings.push(curU16);
        curU16 = '';
      }
    }

    const isMeaningful = (s) => {
      if (s.length < 3 || s.length > 200) return false;
      if (!/[a-zA-Z0-9]/.test(s)) return false;
      if (/^(AcDb|AcId|STANDARD|Continuous|ByLayer|ByBlock|Arial|DIM|LAYER)/i.test(s) && s.length < 12) return false;
      const nonPrintable = s.replace(/[a-zA-Z0-9\s.,_\-/:()º°"'+*=xX]/g, '').length;
      return (nonPrintable / s.length) <= 0.25;
    };

    const unique = Array.from(new Set(rawStrings.filter(isMeaningful)));

    const hvacKeywords = [
      'ar condicionado', 'climatiza', 'exaust', 'ventil', 'coifa', 'duto', 'chapa',
      'fxfq', 'rxym', 'khrp', 'daikin', 'carrier', 'trane', 'midea', 'york', 'hitachi',
      'split', 'vrv', 'vrf', 'fancoil', 'chiller', 'cobre', 'isolam', 'armaflex',
      'grelha', 'difus', 'damper', 'filtro', 'pressuri', 'vazao', 'vazão', 'm3/h', 'm³/h',
      'tr', 'btu', 'cv', 'hp', 'terreo', 'jirau', 'cobertura', 'r-410a', 'refnet', 'tubo'
    ];

    const highPriority = unique.filter(s => {
      const lower = s.toLowerCase();
      return hvacKeywords.some(kw => lower.includes(kw));
    });

    const generalStrings = unique.filter(s => !highPriority.includes(s)).slice(0, 1000);
    const combined = [...highPriority, ...generalStrings].slice(0, 1500).join('\n');

    return `[PROJETO CAD DWG - ${fileName}]\n` +
      `Termos técnicos de climatização identificados: ${highPriority.length}\n\n` +
      `[ESPECIFICAÇÕES TÉCNICAS E TEXTOS EXTRAÍDOS DO CAD]\n` +
      combined.slice(0, 95000);
  } catch (err) {
    return `[PROJETO CAD DWG: ${fileName}]`;
  }
}
