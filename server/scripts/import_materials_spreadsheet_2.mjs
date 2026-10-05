import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { pool } from '../src/db/connection.js';
import { syncAllDatabaseSequences } from '../src/db/syncSequences.js';

const require = createRequire(import.meta.url);
const xlsx = require('xlsx');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

const excelPath = 'C:/Users/Casa/OneDrive/Área de Trabalho/Matheus/Market Making/Sabrar Engenharia/Arquivos Sabrar/Lista de materiais - fotos 2 (1).xlsx';
const extractedXmlDir = path.join(rootDir, 'scratch/xlsx2_full/xl');
const publicMaterialsDir = path.join(rootDir, 'client/public/materials');
const distMaterialsDir = path.join(rootDir, 'client/dist/materials');
const canonicalJsonPath = path.join(rootDir, 'server/src/data/sabrarMaterialsBase2026.json');

const normalize = (str) => {
  return String(str || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
};

async function run() {
  console.log('========================================================================');
  console.log('IMPORTAÇÃO DA NOVA PLANILHA DE MATERIAIS SABRAR (LOTE 2 - 05/10/2026)');
  console.log('Arquivo:', excelPath);
  console.log('========================================================================\n');

  // 1. Garantir pastas de destino das fotos
  if (!fs.existsSync(publicMaterialsDir)) fs.mkdirSync(publicMaterialsDir, { recursive: true });
  if (!fs.existsSync(distMaterialsDir)) fs.mkdirSync(distMaterialsDir, { recursive: true });

  // 2. Copiar as 112 fotos de media com prefixo foto2_
  const mediaSrcDir = path.join(extractedXmlDir, 'media');
  if (!fs.existsSync(mediaSrcDir)) {
    throw new Error(`Pasta de mídia não encontrada em: ${mediaSrcDir}`);
  }

  const mediaFiles = fs.readdirSync(mediaSrcDir);
  console.log(`[1/6] Copiando e prefixando ${mediaFiles.length} arquivos de mídia...`);

  let copiedCount = 0;
  for (const file of mediaFiles) {
    const src = path.join(mediaSrcDir, file);
    const newFilename = `foto2_${file}`;
    fs.copyFileSync(src, path.join(publicMaterialsDir, newFilename));
    fs.copyFileSync(src, path.join(distMaterialsDir, newFilename));
    copiedCount++;
  }
  console.log(`✓ ${copiedCount} fotos copiadas com prefixo 'foto2_' para client/public/materials e client/dist/materials!\n`);

  // 3. Mapear richData (imagens de células)
  console.log('[2/6] Mapeando relações de imagens richData da Planilha1...');
  const richValueRelXml = fs.readFileSync(path.join(extractedXmlDir, 'richData/richValueRel.xml'), 'utf8');
  const richValueRels = fs.readFileSync(path.join(extractedXmlDir, 'richData/_rels/richValueRel.xml.rels'), 'utf8');
  const rdRichValueXml = fs.readFileSync(path.join(extractedXmlDir, 'richData/rdrichvalue.xml'), 'utf8');

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

  const sheet1Xml = fs.readFileSync(path.join(extractedXmlDir, 'worksheets/sheet1.xml'), 'utf8');
  const cellRegex = /<c r="B(\d+)"[^>]*vm="(\d+)"/g;
  const rowToImage = {};
  while ((m = cellRegex.exec(sheet1Xml)) !== null) {
    const rowNum = parseInt(m[1], 10);
    const vm = parseInt(m[2], 10);
    const img = rvIndexToImage[vm];
    if (img) rowToImage[rowNum] = `foto2_${img}`;
  }
  console.log(`✓ Mapeamento de imagens concluído: ${Object.keys(rowToImage).length} linhas associadas a fotos.\n`);

  // 4. Ler e tratar os 400 itens da Planilha1
  console.log('[3/6] Lendo dados da planilha Excel e tratando registros...');
  const workbook = xlsx.readFile(excelPath);
  const sheet = workbook.Sheets['Planilha1'];
  const excelRows = xlsx.utils.sheet_to_json(sheet, { header: 1 });

  // Agrupar itens para consolidar duplicatas internas calculando média de preço
  const rawGrouped = new Map();

  for (let r = 2; r <= 401; r++) {
    const row = excelRows[r - 1];
    if (!row || !row[2] || !String(row[2]).trim()) continue;

    let category = String(row[0] || '').trim().replace(/[\r\n]+/g, ' ');
    if (category === 'CONEXÕES HIDRÁULICAS 300 LB') category = 'CONEXÕES HIDRÁULICAS 300LB';
    if (category === 'CONEXÕES HIDRÁULICAS') category = 'CONEXÕES HIDRÁULICAS';

    const name = String(row[2]).trim().replace(/\s+/g, ' ');
    const synonyms = row[3] ? String(row[3]).trim().replace(/\s+/g, ' ') : null;

    let price = 0;
    const rawPrice = row[4];
    if (rawPrice !== undefined && rawPrice !== null && rawPrice !== '') {
      if (typeof rawPrice === 'number') price = rawPrice;
      else {
        const clean = String(rawPrice).replace(/^R\$\s*/, '').replace(/\./g, '').replace(',', '.').trim();
        price = parseFloat(clean) || 0;
      }
    }

    let unit = row[5] ? String(row[5]).trim().toLowerCase() : '';
    if (!unit && name.includes('AGUARRAS')) unit = 'und';
    if (!unit) unit = 'und';

    // Normalizar padrão de unidade
    if (unit === 'botija com 13,6kg') unit = 'botija c/ 13,6kg';
    if (unit === 'barra c/ 3 metros') unit = 'barra c/ 3 metros';
    if (unit === 'metro') unit = 'metro';

    // Metadados de conversão de embalagem
    let packageContent = null;
    let convertedUnit = null;
    let convertedPrice = null;

    if (unit.includes('rolo com 20 metros')) {
      packageContent = 20;
      convertedUnit = 'metro';
      convertedPrice = Number((price / 20).toFixed(4));
    } else if (unit.includes('rolo com 15 metros')) {
      packageContent = 15;
      convertedUnit = 'metro';
      convertedPrice = Number((price / 15).toFixed(4));
    } else if (unit.includes('rolo com 9 metros')) {
      packageContent = 9;
      convertedUnit = 'metro';
      convertedPrice = Number((price / 9).toFixed(4));
    } else if (unit.includes('rolo com 7 metros')) {
      packageContent = 7;
      convertedUnit = 'metro';
      convertedPrice = Number((price / 7).toFixed(4));
    } else if (unit.includes('botija c/ 13,6kg')) {
      packageContent = 13.6;
      convertedUnit = 'kg';
      convertedPrice = Number((price / 13.6).toFixed(4));
    } else if (unit.includes('barra c/ 3 metros')) {
      packageContent = 3;
      convertedUnit = 'metro';
      convertedPrice = Number((price / 3).toFixed(4));
    }

    const imageFilename = rowToImage[r];
    const imageUrl = imageFilename ? `/materials/${imageFilename}` : null;

    const normKey = normalize(name);

    if (!rawGrouped.has(normKey)) {
      rawGrouped.set(normKey, {
        name,
        category,
        synonyms,
        unit,
        prices: [price],
        packageContent,
        convertedUnit,
        convertedPrice,
        imageUrl,
        rows: [r]
      });
    } else {
      const existing = rawGrouped.get(normKey);
      existing.prices.push(price);
      existing.rows.push(r);
      if (!existing.synonyms && synonyms) existing.synonyms = synonyms;
      if (!existing.imageUrl && imageUrl) existing.imageUrl = imageUrl;
    }
  }

  const consolidatedItems = [];
  for (const item of rawGrouped.values()) {
    const avgPrice = item.prices.reduce((a, b) => a + b, 0) / item.prices.length;
    let finalConvertedPrice = item.convertedPrice;
    if (item.packageContent && item.packageContent > 0) {
      finalConvertedPrice = Number((avgPrice / item.packageContent).toFixed(4));
    }

    consolidatedItems.push({
      name: item.name,
      category: item.category,
      synonyms: item.synonyms,
      unit: item.unit,
      price: Number(avgPrice.toFixed(4)),
      packageContent: item.packageContent,
      convertedUnit: item.convertedUnit,
      convertedPrice: finalConvertedPrice,
      imageUrl: item.imageUrl
    });
  }

  console.log(`Total de itens únicos consolidados: ${consolidatedItems.length} (de 400 linhas lidas).\n`);

  // 5. Comparar com o banco de dados
  console.log('[4/6] Cruzando com materiais existentes no Supabase PostgreSQL...');
  const dbRes = await pool.query('SELECT id, code, name, category, unit, reference_price, synonyms, image_url FROM materials ORDER BY id ASC');
  const dbMaterials = dbRes.rows;

  const dbMapByName = new Map();
  for (const m of dbMaterials) {
    dbMapByName.set(normalize(m.name), m);
  }

  // Determinar próximo código numérico SAB-XXXX
  let maxSabNum = 0;
  for (const m of dbMaterials) {
    const codeMatch = m.code ? m.code.match(/^SAB-(\d+)$/) : null;
    if (codeMatch) {
      const n = parseInt(codeMatch[1], 10);
      if (n > maxSabNum) maxSabNum = n;
    }
  }
  console.log(`Maior código SAB- atual no banco: SAB-${String(maxSabNum).padStart(4, '0')}`);

  const toUpdate = [];
  const toInsert = [];
  let nextSabNum = maxSabNum + 1;

  for (const item of consolidatedItems) {
    const norm = normalize(item.name);
    if (dbMapByName.has(norm)) {
      const dbItem = dbMapByName.get(norm);
      toUpdate.push({
        ...item,
        existingId: dbItem.id,
        existingCode: dbItem.code,
        // manter imagem anterior se já tiver ou atualizar se nova
        finalImageUrl: item.imageUrl || dbItem.image_url
      });
    } else {
      const code = `SAB-${String(nextSabNum).padStart(4, '0')}`;
      nextSabNum++;
      toInsert.push({
        ...item,
        code
      });
    }
  }

  console.log(`- Materiais existentes a atualizar (preço/sinônimos/foto): ${toUpdate.length}`);
  console.log(`- Novos materiais a inserir com novos códigos oficiais: ${toInsert.length}\n`);

  // 6. Atualizar materiais existentes no PostgreSQL
  if (toUpdate.length > 0) {
    console.log('[5/6] Atualizando materiais existentes no banco...');
    for (const u of toUpdate) {
      await pool.query(
        `UPDATE materials 
         SET reference_price = $1::numeric,
             synonyms = COALESCE(NULLIF($2::text, ''), synonyms),
             image_url = COALESCE($3::text, image_url),
             category = COALESCE(NULLIF($4::text, ''), category),
             unit = COALESCE(NULLIF($5::text, ''), unit),
             package_content = COALESCE($6::numeric, package_content),
             converted_unit = COALESCE(NULLIF($7::text, ''), converted_unit),
             converted_price = COALESCE($8::numeric, converted_price),
             updated_at = NOW()
         WHERE id = $9::int`,
        [
          u.price,
          u.synonyms || null,
          u.finalImageUrl || null,
          u.category,
          u.unit,
          u.packageContent,
          u.convertedUnit,
          u.convertedPrice,
          u.existingId
        ]
      );
      console.log(`  ✓ Atualizado [${u.existingCode}] ${u.name} -> R$ ${u.price} (${u.unit})`);
    }
  }

  // 7. Inserir novos materiais no PostgreSQL em lote
  if (toInsert.length > 0) {
    console.log('[5/6] Inserindo novos materiais no banco em lotes...');
    const batchSize = 50;
    for (let i = 0; i < toInsert.length; i += batchSize) {
      const batch = toInsert.slice(i, i + batchSize);
      const valueClauses = [];
      const params = [];
      let pIdx = 1;

      for (const m of batch) {
        valueClauses.push(`(
          $${pIdx}, $${pIdx + 1}, $${pIdx + 2}, $${pIdx + 3}, $${pIdx + 4}, $${pIdx + 5},
          $${pIdx + 6}, $${pIdx + 7}, $${pIdx + 8}, $${pIdx + 9}, $${pIdx + 10},
          'OK', NULL, 'SABRAR', 'Material oficial SABRAR (Atualização 05/10/2026 - Lote 2)',
          0.00, 0.00, 10.00, 'Ativo', NOW(), NOW()
        )`);

        params.push(
          m.code,
          m.name,
          m.category,
          m.unit,
          m.price,
          m.synonyms || null,
          m.imageUrl || null,
          m.packageContent || null,
          m.convertedUnit || null,
          m.convertedPrice || null,
          null // linear_weight
        );

        pIdx += 11;
      }

      const insertSql = `
        INSERT INTO materials (
          code, name, category, unit, reference_price, synonyms, image_url,
          package_content, converted_unit, converted_price, linear_weight,
          validation_status, pending_notes, brand, description,
          stock_physical, stock_reserved, stock_minimum, status, created_at, updated_at
        ) VALUES ${valueClauses.join(',\n')}
      `;

      await pool.query(insertSql, params);
      console.log(`  ✓ Inserido lote de ${batch.length} materiais (${batch[0].code} .. ${batch[batch.length - 1].code})`);
    }
  }

  // Sincronizar sequências
  await syncAllDatabaseSequences();

  // 8. Atualizar JSON Canônico sabrarMaterialsBase2026.json
  console.log('\n[6/6] Sincronizando catálogo canônico em server/src/data/sabrarMaterialsBase2026.json...');
  const finalDbRes = await pool.query("SELECT * FROM materials WHERE code LIKE 'SAB-%' ORDER BY code ASC");
  const allOfficialMaterials = finalDbRes.rows.map((row, idx) => ({
    num: idx + 1,
    code: row.code,
    name: row.name,
    category: row.category,
    synonyms: row.synonyms || null,
    unit: row.unit,
    price: Number(row.reference_price),
    avgCostStr: `R$ ${Number(row.reference_price).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`,
    priceBase: `R$ ${Number(row.reference_price).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} por ${row.unit}`,
    linearWeight: row.linear_weight ? Number(row.linear_weight) : null,
    linearWeightUnit: row.linear_weight_unit || null,
    packageContent: row.package_content ? Number(row.package_content) : null,
    convertedUnit: row.converted_unit || null,
    convertedPrice: row.converted_price ? Number(row.converted_price) : null,
    validationStatus: row.validation_status || 'OK',
    pendingNotes: row.pending_notes || null,
    imageUrl: row.image_url || null
  }));

  fs.writeFileSync(canonicalJsonPath, JSON.stringify(allOfficialMaterials, null, 2), 'utf8');
  console.log(`✓ Arquivo canônico atualizado com sucesso contendo ${allOfficialMaterials.length} materiais oficiais!`);

  // 9. Resumo final
  const totalCountRes = await pool.query('SELECT count(*) as count FROM materials');
  const withPhotoRes = await pool.query('SELECT count(*) as count FROM materials WHERE image_url IS NOT NULL');
  const distinctCategoriesRes = await pool.query('SELECT category, count(*) FROM materials GROUP BY category ORDER BY count(*) DESC');

  console.log('\n========================================================================');
  console.log('IMPORTAÇÃO CONCLUÍDA COM SUCESSO ABSOLUTO!');
  console.log(`- Total de materiais agora na Base Central: ${totalCountRes.rows[0].count}`);
  console.log(`- Materiais com foto no banco: ${withPhotoRes.rows[0].count}`);
  console.log(`- Materiais atualizados: ${toUpdate.length}`);
  console.log(`- Novos materiais inseridos: ${toInsert.length}`);
  console.log(`- Códigos gerados: ${toInsert[0]?.code} até ${toInsert[toInsert.length - 1]?.code}`);
  console.log('========================================================================\n');
  console.log('Distribuição por Categoria:');
  console.table(distinctCategoriesRes.rows);

  await pool.end();
}

run().catch((err) => {
  console.error('\n❌ Erro durante a importação:', err);
  process.exit(1);
});
