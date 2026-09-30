import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { pool } from '../src/db/connection.js';

const require = createRequire(import.meta.url);
const xlsx = require('xlsx');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

const filePath = 'C:/Users/Casa/OneDrive/Área de Trabalho/Matheus/Market Making/Sabrar Engenharia/Arquivos Sabrar/Lista de materiais - fotos (1).xlsx';
const baseXmlDir = 'C:/Users/Casa/.gemini/antigravity/brain/3ab2ef9d-0660-49bd-86c6-ba35b9f2d8ca/scratch/xlsx_full/xl';
const publicMaterialsDir = path.join(rootDir, 'client/public/materials');

async function run() {
  console.log('=== IMPORTAÇÃO AUTOMÁTICA DE FOTOS E SINÔNIMOS DOS MATERIAIS SABRAR ===\n');

  // 1. Garantir que client/public/materials existe
  if (!fs.existsSync(publicMaterialsDir)) {
    fs.mkdirSync(publicMaterialsDir, { recursive: true });
  }

  // 2. Copiar arquivos de mídia para client/public/materials
  const mediaSrcDir = path.join(baseXmlDir, 'media');
  const mediaFiles = fs.readdirSync(mediaSrcDir);
  console.log(`Copiando ${mediaFiles.length} arquivos de fotos para: ${publicMaterialsDir}`);

  let copiedCount = 0;
  for (const file of mediaFiles) {
    const src = path.join(mediaSrcDir, file);
    const dst = path.join(publicMaterialsDir, file);
    fs.copyFileSync(src, dst);
    copiedCount++;
  }
  console.log(`✓ ${copiedCount} fotos copiadas com sucesso para client/public/materials!\n`);

  // 3. Mapear richData (imagens em células)
  const richValueRelXml = fs.readFileSync(`${baseXmlDir}/richData/richValueRel.xml`, 'utf8');
  const richValueRels = fs.readFileSync(`${baseXmlDir}/richData/_rels/richValueRel.xml.rels`, 'utf8');
  const rdRichValueXml = fs.readFileSync(`${baseXmlDir}/richData/rdrichvalue.xml`, 'utf8');

  const richRelMap = {};
  const relRegex = /<Relationship Id="([^"]+)"[^>]*Target="([^"]+)"/g;
  let m;
  while ((m = relRegex.exec(richValueRels)) !== null) {
    richRelMap[m[1]] = m[2].replace('../media/', '');
  }

  const relList = [];
  const relListRegex = /<rel[^>]*r:id="([^"]+)"/g;
  while ((m = relListRegex.exec(richValueRelXml)) !== null) {
    relList.push(m[1]);
  }

  const rvMatches = rdRichValueXml.match(/<rv[^>]*>[\s\S]*?<\/rv>/g) || [];
  const rvIndexToImage = {};
  rvMatches.forEach((rv, idx) => {
    const vMatch = rv.match(/<v>(\d+)<\/v>/);
    if (vMatch) {
      const relIdx = parseInt(vMatch[1], 10);
      const rId = relList[relIdx];
      if (rId && richRelMap[rId]) {
        rvIndexToImage[idx + 1] = richRelMap[rId];
      }
    }
  });

  const sheet1Xml = fs.readFileSync(`${baseXmlDir}/worksheets/sheet1.xml`, 'utf8');
  const cellRegex = /<c r="B(\d+)"[^>]*vm="(\d+)"/g;
  const rowToRichImage = {};
  while ((m = cellRegex.exec(sheet1Xml)) !== null) {
    const rowNum = parseInt(m[1], 10);
    const vm = parseInt(m[2], 10);
    const img = rvIndexToImage[vm];
    if (img) rowToRichImage[rowNum] = img;
  }

  // 4. Mapear drawings (imagens flutuantes ancoradas)
  const drawingXml = fs.readFileSync(`${baseXmlDir}/drawings/drawing1.xml`, 'utf8');
  const drawingRels = fs.readFileSync(`${baseXmlDir}/drawings/_rels/drawing1.xml.rels`, 'utf8');

  const drawRelMap = {};
  while ((m = relRegex.exec(drawingRels)) !== null) {
    drawRelMap[m[1]] = m[2].replace('../media/', '');
  }

  const anchorRegex = /<xdr:(?:twoCellAnchor|oneCellAnchor)[\s\S]*?<\/xdr:(?:twoCellAnchor|oneCellAnchor)>/g;
  const anchors = drawingXml.match(anchorRegex) || [];
  const rowToDrawImage = {};
  for (const anchor of anchors) {
    const blipMatch = anchor.match(/<a:blip[^>]*r:embed="([^"]+)"/);
    const rowMatch = anchor.match(/<xdr:from>[\s\S]*?<xdr:row>(\d+)<\/xdr:row>/);
    if (blipMatch && rowMatch) {
      const rId = blipMatch[1];
      const drawRow0 = parseInt(rowMatch[1], 10);
      const rowNum = drawRow0 + 1; // 1-based Excel row
      const img = drawRelMap[rId];
      if (img) rowToDrawImage[rowNum] = img;
    }
  }

  // Combinar os dois mapeamentos
  const rowToImage = { ...rowToRichImage };
  for (const [r, img] of Object.entries(rowToDrawImage)) {
    if (!rowToImage[r]) {
      rowToImage[r] = img;
    }
  }
  console.log(`Mapeamento concluído: ${Object.keys(rowToImage).length} linhas com imagem identificadas.`);

  // 5. Ler planilha Excel
  const workbook = xlsx.readFile(filePath);
  const sheet = workbook.Sheets['Sheet0'];
  const excelData = xlsx.utils.sheet_to_json(sheet, { header: 1 });

  // 6. Buscar materiais do banco de dados
  const dbRes = await pool.query('SELECT id, code, name, category, synonyms, image_url FROM materials');
  const dbMaterials = dbRes.rows;
  console.log(`Total de materiais no Banco de Dados: ${dbMaterials.length}`);

  const normalize = (str) => {
    return String(str || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');
  };

  const dbMapByName = new Map();
  dbMaterials.forEach(m => {
    dbMapByName.set(normalize(m.name), m);
  });

  // 7. Atualizar cada material no banco de dados
  let updatedCount = 0;
  let synonymUpdatedCount = 0;
  let notFoundCount = 0;

  for (let r = 3; r <= excelData.length; r++) {
    const row = excelData[r - 1];
    if (!row || !row[2]) continue;

    const name = String(row[2]).trim();
    const synonyms = row[3] ? String(row[3]).trim() : '';
    const imgFilename = rowToImage[r];

    const norm = normalize(name);
    const dbMat = dbMapByName.get(norm);

    if (!dbMat) {
      notFoundCount++;
      console.warn(`[Não Encontrado] Linha ${r}: "${name}"`);
      continue;
    }

    const imageUrl = imgFilename ? `/materials/${imgFilename}` : null;

    // Atualizar no PostgreSQL
    await pool.query(
      `UPDATE materials 
       SET image_url = COALESCE($1::text, image_url),
           synonyms = COALESCE(NULLIF($2::text, ''), synonyms),
           updated_at = NOW()
       WHERE id = $3::int`,
      [imageUrl, synonyms || null, dbMat.id]
    );

    updatedCount++;
    if (synonyms) synonymUpdatedCount++;
  }

  console.log(`\n=== RESUMO DA IMPORTAÇÃO ===`);
  console.log(`Total de materiais na planilha: ${excelData.length - 2}`);
  console.log(`Materiais atualizados no banco com foto: ${updatedCount}`);
  console.log(`Materiais com sinônimos preenchidos/atualizados: ${synonymUpdatedCount}`);
  console.log(`Materiais não encontrados no banco: ${notFoundCount}`);

  // Validação final de quantos materiais agora têm imagem
  const verifyRes = await pool.query("SELECT COUNT(*) as count FROM materials WHERE image_url IS NOT NULL");
  console.log(`\nTotal atual de materiais com foto no banco: ${verifyRes.rows[0].count}`);

  await pool.end();
  console.log('=== PROCESSO CONCLUÍDO COM SUCESSO! ===\n');
}

run().catch(err => {
  console.error('Erro na execução:', err);
  process.exit(1);
});
