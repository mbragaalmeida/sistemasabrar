import fs from 'fs';

const baseXmlDir = 'C:/Users/Casa/.gemini/antigravity/brain/3ab2ef9d-0660-49bd-86c6-ba35b9f2d8ca/scratch/xlsx_full/xl';
const sheet1Xml = fs.readFileSync(baseXmlDir + '/worksheets/sheet1.xml', 'utf8');

const cellRegex = new RegExp('<c r="B(\\d+)"[^>]*vm="(\\d+)"', 'g');
let m;
let countRich = 0;
const richRows = new Set();
while ((m = cellRegex.exec(sheet1Xml)) !== null) {
  countRich++;
  richRows.add(parseInt(m[1], 10));
}
console.log('Cells in col B with vm attribute:', countRich, 'Unique rows:', richRows.size);

const drawingXml = fs.readFileSync(baseXmlDir + '/drawings/drawing1.xml', 'utf8');
const anchorRegex = new RegExp('<xdr:(?:twoCellAnchor|oneCellAnchor)[\\s\\S]*?<\\/xdr:(?:twoCellAnchor|oneCellAnchor)>', 'g');
const anchors = drawingXml.match(anchorRegex) || [];
console.log('Total drawing anchors in drawing1.xml:', anchors.length);

const drawRows = new Set();
const rowRegex = new RegExp('<xdr:from>[\\s\\S]*?<xdr:row>(\\d+)<\\/xdr:row>');
for (const anchor of anchors) {
  const rMatch = anchor.match(rowRegex);
  if (rMatch) {
    drawRows.add(parseInt(rMatch[1], 10) + 1);
  }
}
console.log('Unique rows with drawing anchors:', drawRows.size);

const union = new Set([...richRows, ...drawRows]);
console.log('Total distinct rows in Excel with an image:', union.size);
