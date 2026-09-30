import fs from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const xlsx = require('xlsx');

const filePath = 'C:/Users/Casa/OneDrive/Área de Trabalho/Matheus/Market Making/Sabrar Engenharia/Arquivos Sabrar/Lista de materiais - fotos (1).xlsx';
const baseXmlDir = 'C:/Users/Casa/.gemini/antigravity/brain/3ab2ef9d-0660-49bd-86c6-ba35b9f2d8ca/scratch/xlsx_full/xl';

async function main() {
  const wb = xlsx.readFile(filePath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });

  // Vamos ler o XML do sheet1 para ver exatamente em quais células há <c r="B...">
  const sheet1Xml = fs.readFileSync(`${baseXmlDir}/worksheets/sheet1.xml`, 'utf8');
  
  // Vamos buscar todas as tags <c r="B[row]"
  const colBMatches = [...sheet1Xml.matchAll(/<c r="B(\d+)"([^>]*)>/g)];
  console.log('Total de tags <c r="B..."> no XML:', colBMatches.length);

  // Ver quais têm valor, vm ou v
  let hasVm = 0;
  let hasV = 0;
  let emptyColB = 0;
  const rowsWithVm = new Set();
  const rowsWithV = new Set();

  for (const m of colBMatches) {
    const rowNum = parseInt(m[1], 10);
    const attrs = m[2];
    if (attrs.includes('vm=')) {
      hasVm++;
      rowsWithVm.add(rowNum);
    } else {
      emptyColB++;
    }
  }
  console.log(`Linhas com vm (imagem em célula): ${hasVm}`);
  console.log(`Linhas B vazias ou sem vm: ${emptyColB}`);

  // Agora vamos verificar no drawing1.xml
  const drawingXml = fs.readFileSync(`${baseXmlDir}/drawings/drawing1.xml`, 'utf8');
  const anchorRegex = /<xdr:(?:twoCellAnchor|oneCellAnchor)[\s\S]*?<\/xdr:(?:twoCellAnchor|oneCellAnchor)>/g;
  const anchors = drawingXml.match(anchorRegex) || [];
  console.log(`Total de anchors flutuantes no drawing1: ${anchors.length}`);

  const drawRowMap = new Map();
  for (const a of anchors) {
    const rMatch = a.match(/<xdr:from>[\s\S]*?<xdr:row>(\d+)<\/xdr:row>/);
    const blip = a.match(/<a:blip[^>]*r:embed="([^"]+)"/);
    if (rMatch && blip) {
      const row = parseInt(rMatch[1], 10) + 1;
      drawRowMap.set(row, blip[1]);
    }
  }
  console.log(`Linhas com imagem flutuante única: ${drawRowMap.size}`);

  // Verificar quais linhas NÃO têm vm nem drawing
  const noImageRows = [];
  for (let r = 3; r <= 759; r++) {
    const hasRich = rowsWithVm.has(r);
    const hasDraw = drawRowMap.has(r);
    if (!hasRich && !hasDraw) {
      const rowData = rows[r - 1];
      noImageRows.push({ row: r, nome: rowData ? rowData[2] : 'Vazio' });
    }
  }
  console.log(`Total de linhas SEM imagem de r=3 até r=759: ${noImageRows.length}`);
  if (noImageRows.length > 0) {
    console.log('Exemplos sem imagem:', noImageRows.slice(0, 10));
  }
}

main().catch(console.error);
