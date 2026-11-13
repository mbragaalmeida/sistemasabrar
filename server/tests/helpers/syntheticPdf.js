/**
 * Gera pranchas PDF vetoriais sintéticas (segunda obra de teste) com geometria conhecida.
 * Coordenadas em metros reais são convertidas para pontos pela escala informada.
 */
import PDFDocument from 'pdfkit';

const PT_PER_M = 72 / 0.0254;

/**
 * @param {object} spec
 * @param {number} spec.scale denominador da escala do desenho (ex.: 50 → 1/50)
 * @param {number} [spec.declaredScale] escala escrita no título (padrão = spec.scale)
 * @param {Array<{label:string, x:number, y:number, lengthM:number, widthCm:number, dir:'h'|'v', view?:'plan'|'section'}>} spec.ducts
 * @param {Array<{fromLabel:string}>} [spec.transitions]
 * @param {boolean} [spec.withSection]
 * @param {Array<{text:string,x:number,y:number}>} [spec.extraTexts] textos livres (metros, origem da vista)
 * @returns {Promise<Buffer>}
 */
export function buildSyntheticDuctPdf(spec) {
  const k = PT_PER_M / spec.scale; // pt por metro real
  const doc = new PDFDocument({ size: [1684, 1190], margin: 0 });
  const chunks = [];
  doc.on('data', c => chunks.push(c));
  const done = new Promise(resolve => doc.on('end', () => resolve(Buffer.concat(chunks))));

  const DUCT = [0, 200, 0];
  // Origem das vistas (pt, sistema do pdfkit: y para baixo). Título abaixo de cada vista.
  const origins = { plan: { x: 100, y: 120 }, section: { x: 100, y: 700 } };

  const drawDuct = (d) => {
    const o = origins[d.view || 'plan'];
    const x0 = o.x + d.x * k;
    const y0 = o.y + d.y * k;
    const L = d.lengthM * k;
    const W = (d.widthCm / 100) * k;
    doc.lineWidth(0.8).strokeColor(DUCT);
    if (d.dir === 'h') {
      doc.moveTo(x0, y0).lineTo(x0 + L, y0).stroke();
      doc.moveTo(x0, y0 + W).lineTo(x0 + L, y0 + W).stroke();
      doc.moveTo(x0, y0).lineTo(x0, y0 + W).stroke();
      doc.moveTo(x0 + L, y0).lineTo(x0 + L, y0 + W).stroke();
      doc.fillColor('black').fontSize(7).text(d.label, x0 + L / 2 - 15, y0 - 12, { lineBreak: false });
    } else {
      doc.moveTo(x0, y0).lineTo(x0, y0 + L).stroke();
      doc.moveTo(x0 + W, y0).lineTo(x0 + W, y0 + L).stroke();
      doc.moveTo(x0, y0).lineTo(x0 + W, y0).stroke();
      doc.moveTo(x0, y0 + L).lineTo(x0 + W, y0 + L).stroke();
      doc.fillColor('black').fontSize(7).text(d.label, x0 + W + 4, y0 + L / 2, { lineBreak: false });
    }
  };

  for (const d of spec.ducts) drawDuct(d);

  // Transições trapezoidais (redução) entre dois dutos horizontais consecutivos
  for (const t of spec.transitions || []) {
    const o = origins.plan;
    const ax = o.x + t.x * k;
    const ay = o.y + t.y * k;
    const len = t.lengthM * k;
    const w1 = (t.fromWidthCm / 100) * k;
    const w2 = (t.toWidthCm / 100) * k;
    const off = (w1 - w2) / 2;
    doc.lineWidth(0.8).strokeColor(DUCT);
    doc.moveTo(ax, ay).lineTo(ax + len, ay + off).stroke();
    doc.moveTo(ax, ay + w1).lineTo(ax + len, ay + off + w2).stroke();
  }

  // Distrator de arquitetura: linhas cinza paralelas com o mesmo afastamento de um duto, junto a um rótulo
  if (spec.distractor) {
    const o = origins.plan;
    const W = (spec.distractor.widthCm / 100) * k;
    const x0 = o.x + spec.distractor.x * k;
    const y0 = o.y + spec.distractor.y * k;
    doc.lineWidth(0.12).strokeColor([83, 83, 83]);
    doc.moveTo(x0, y0).lineTo(x0 + spec.distractor.lengthM * k, y0).stroke();
    doc.moveTo(x0, y0 + W).lineTo(x0 + spec.distractor.lengthM * k, y0 + W).stroke();
  }

  // Títulos de vista + escala (abaixo das vistas)
  doc.fillColor('black').fontSize(9);
  doc.text('PLANTA BAIXA - PAVIMENTO TIPO', 100, 640, { lineBreak: false });
  doc.text(`ESCALA 1/${spec.declaredScale ?? spec.scale}`, 100, 652, { lineBreak: false });
  if (spec.withSection) {
    doc.text('CORTE AA', 100, 1120, { lineBreak: false });
    doc.text(`ESCALA 1/${spec.scale}`, 100, 1132, { lineBreak: false });
  }

  // Legenda com símbolo do duto antes do texto
  doc.fontSize(7).fillColor('black');
  const lx = 1300;
  const ly = 1000;
  doc.lineWidth(0.8).strokeColor(DUCT).rect(lx - 40, ly + 1, 28, 5).stroke();
  doc.text('DUTO DE INSUFLAMENTO NOVO A SER INSTALADO', lx, ly, { lineBreak: false });
  doc.lineWidth(0.12).strokeColor([0, 127, 255]).moveTo(lx - 40, ly + 23).lineTo(lx - 12, ly + 23).stroke();
  doc.text('TUBULAÇÃO DE GÁS REFRIGERANTE', lx, ly + 20, { lineBreak: false });

  for (const t of spec.extraTexts || []) {
    const o = origins[t.view || 'plan'];
    doc.fontSize(7).text(t.text, o.x + t.x * k, o.y + t.y * k, { lineBreak: false });
  }

  doc.end();
  return done;
}
