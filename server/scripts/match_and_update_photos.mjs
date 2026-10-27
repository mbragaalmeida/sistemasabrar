import fs from 'fs';
import path from 'path';
import xlsx from 'xlsx';
import { pool } from '../src/db/connection.js';

const BASE_DIR = 'C:/Users/Casa/OneDrive/Área de Trabalho/Matheus/Market Making/Sabrar Engenharia/Arquivos Sabrar';
const mappings = JSON.parse(fs.readFileSync('server/scripts/extracted_mappings.json', 'utf8'));

const normalize = (str) => {
  return String(str || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
};

async function run() {
  console.log('=== VINCULANDO FOTOS AOS MATERIAIS NO BANCO DE DADOS ===\n');

  // 1. Buscar todos os materiais sem foto
  const dbRes = await pool.query(`
    SELECT id, code, name, category, image_url 
    FROM materials 
    ORDER BY id
  `);
  const allDbMaterials = dbRes.rows;
  const dbMaterialsWithoutPhoto = allDbMaterials.filter(m => !m.image_url || !m.image_url.trim());
  console.log(`Total de materiais no BD: ${allDbMaterials.length}`);
  console.log(`Total de materiais sem foto no BD: ${dbMaterialsWithoutPhoto.length}\n`);

  const dbMapByName = new Map();
  allDbMaterials.forEach(m => {
    dbMapByName.set(normalize(m.name), m);
  });

  const updates = [];

  // Helper to process a spreadsheet
  const processSpreadsheet = (filename) => {
    const rowMap = mappings[filename];
    if (!rowMap) return;

    const fpath = path.join(BASE_DIR, filename);
    const wb = xlsx.readFile(fpath);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(ws, { header: 1 });

    console.log(`\n--- Processando ${filename} (${data.length} linhas, ${Object.keys(rowMap).length} fotos mapeadas) ---`);

    for (let r = 1; r < data.length; r++) {
      const row = data[r];
      if (!row || !row[2]) continue; // Coluna C é Item

      const itemName = String(row[2]).trim();
      const excelRowNum = r + 1; // 1-based row in Excel
      const imgPath = rowMap[excelRowNum] || rowMap[String(excelRowNum)];

      if (!imgPath) {
        console.log(`  Linha ${excelRowNum}: Sem foto mapeada para [${itemName}]`);
        continue;
      }

      // Procura no BD
      const normName = normalize(itemName);
      let match = dbMapByName.get(normName);

      if (!match) {
        // Tenta achar por inclusão ou similaridade
        match = allDbMaterials.find(m => {
          const mNorm = normalize(m.name);
          return mNorm === normName || mNorm.includes(normName) || normName.includes(mNorm);
        });
      }

      if (match) {
        updates.push({
          material_id: match.id,
          code: match.code,
          name: match.name,
          excelItem: itemName,
          current_image: match.image_url,
          new_image: imgPath,
          excelRow: excelRowNum,
          file: filename
        });
        console.log(`  ✓ Match: [${match.code}] ${match.name} -> ${imgPath}`);
      } else {
        console.log(`  ⚠ Não encontrado no BD: [${itemName}] (Linha ${excelRowNum})`);
      }
    }
  };

  // Process 15.10
  processSpreadsheet('Itens incompletos - 15.10.xlsx');
  // Process 21.10
  processSpreadsheet('Itens incompletos - 21.10.xlsx');
  // Process lista if needed
  processSpreadsheet('Itens incompletos - lista de materiais - fotos -1.xlsx');

  console.log(`\nTotal de atualizações preparadas: ${updates.length}`);

  // Apply updates to DB
  let appliedCount = 0;
  for (const u of updates) {
    if (!u.current_image || !u.current_image.trim()) {
      await pool.query('UPDATE materials SET image_url = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [u.new_image, u.material_id]);
      appliedCount++;
    } else {
      console.log(`Item ${u.code} já tem imagem: ${u.current_image} (pulando ou substituindo)`);
    }
  }

  console.log(`\n✔ ${appliedCount} materiais atualizados com fotos com sucesso!`);

  // Check remaining without photo
  const remainingRes = await pool.query("SELECT id, code, name FROM materials WHERE image_url IS NULL OR trim(image_url) = ''");
  console.log(`\nMateriais ainda sem foto no BD: ${remainingRes.rows.length}`);
  if (remainingRes.rows.length > 0) {
    console.log('Restantes:', remainingRes.rows.map(r => `${r.code} - ${r.name}`));
  }

  process.exit(0);
}

run().catch(err => {
  console.error('Erro na atualização:', err);
  process.exit(1);
});
