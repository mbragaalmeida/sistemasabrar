import xlsx from 'xlsx';
import path from 'path';
import { pool } from '../src/db/connection.js';

const arquivosDir = 'C:/Users/Casa/OneDrive/Área de Trabalho/Matheus/Market Making/Sabrar Engenharia/Arquivos Sabrar';
const listaPath = path.join(arquivosDir, 'Lista de materiais - fotos (1).xlsx');

const normalize = (str) => {
  return String(str || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
};

async function run() {
  console.log('=== INICIANDO RESTAURAÇÃO DA BASE CENTRAL DE MATERIAIS SABRAR ===\n');

  // 1. Carregar dados da planilha oficial de materiais
  const wb = xlsx.readFile(listaPath);
  const data = xlsx.utils.sheet_to_json(wb.Sheets['Sheet0'], { header: 1 });

  const officialExcelMap = new Map();
  for (let i = 2; i < data.length; i++) {
    const row = data[i];
    if (!row || !row[2]) continue;

    const category = row[0] ? String(row[0]).trim() : '';
    const name = String(row[2]).trim();
    const synonyms = row[3] ? String(row[3]).trim() : '';
    
    let price = 0;
    if (typeof row[4] === 'number') {
      price = row[4];
    } else if (row[4]) {
      price = parseFloat(String(row[4]).replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, '')) || 0;
    }

    let unit = row[5] !== undefined ? String(row[5]).trim() : 'und';
    if (!unit || unit === '(vazio)' || unit === 'undefined') {
      unit = 'und';
    }

    officialExcelMap.set(normalize(name), {
      category,
      name,
      synonyms,
      price,
      unit
    });
  }

  console.log(`✓ ${officialExcelMap.size} materiais oficiais carregados da planilha "Lista de materiais - fotos (1).xlsx".`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 2. Identificar os 59 materiais invasores (sem foto e criados recentemente pelo upload)
    const invaderRes = await client.query(`
      SELECT id, code, name, category, unit, reference_price 
      FROM materials 
      WHERE image_url IS NULL OR code LIKE 'MAT-EXP-%'
    `);
    const invaders = invaderRes.rows;
    console.log(`\nIdentificados ${invaders.length} materiais invasores a serem removidos.`);

    const invaderIds = invaders.map(m => m.id);

    // 3. Buscar materiais oficiais no DB (aqueles com imagem)
    const officialRes = await client.query(`
      SELECT id, code, name, category, unit, synonyms
      FROM materials
      WHERE image_url IS NOT NULL
    `);
    const officialMats = officialRes.rows;
    console.log(`Materiais oficiais existentes com foto no DB: ${officialMats.length}`);

    // Criar mapa de oficiais por nome normalizado
    const officialDbMap = new Map();
    officialMats.forEach(m => officialDbMap.set(normalize(m.name), m));

    // 4. Remapear budget_items e historical_usage que apontavam para invasores
    if (invaderIds.length > 0) {
      // Remapear budget_items
      const biRes = await client.query(`
        SELECT id, material_id, material_name 
        FROM budget_items 
        WHERE material_id = ANY($1::int[])
      `, [invaderIds]);

      console.log(`budget_items apontando para invasores: ${biRes.rows.length}`);
      for (const bi of biRes.rows) {
        const norm = normalize(bi.material_name);
        let target = officialDbMap.get(norm);
        if (!target) {
          // Busca por palavras-chave
          const words = norm.split(' ').filter(w => w.length > 3);
          for (const off of officialMats) {
            const offNorm = normalize(off.name);
            if (words.some(w => offNorm.includes(w))) {
              target = off;
              break;
            }
          }
        }
        const newMatId = target ? target.id : null;
        await client.query(`UPDATE budget_items SET material_id = $1 WHERE id = $2`, [newMatId, bi.id]);
      }

      // Remapear historical_usage
      const huRes = await client.query(`
        SELECT id, material_id, material_name 
        FROM historical_usage 
        WHERE material_id = ANY($1::int[])
      `, [invaderIds]);

      console.log(`historical_usage apontando para invasores: ${huRes.rows.length}`);
      for (const hu of huRes.rows) {
        const norm = normalize(hu.material_name);
        const target = officialDbMap.get(norm);
        const newMatId = target ? target.id : null;
        await client.query(`UPDATE historical_usage SET material_id = $1 WHERE id = $2`, [newMatId, hu.id]);
      }

      // 5. Excluir os materiais invasores
      const delRes = await client.query(`
        DELETE FROM materials 
        WHERE id = ANY($1::int[])
      `, [invaderIds]);
      console.log(`✓ ${delRes.rowCount} materiais invasores excluídos com sucesso da tabela materials!`);
    }

    // 6. Atualizar os 757 materiais oficiais no DB com unidade, preço e sinônimos da planilha
    let updatedUnitsCount = 0;
    let updatedPricesCount = 0;
    let updatedTotalCount = 0;

    for (const [normName, offData] of officialExcelMap.entries()) {
      const dbMat = officialDbMap.get(normName);
      if (!dbMat) {
        console.warn(`[Aviso] Material oficial não localizado no DB: "${offData.name}"`);
        continue;
      }

      await client.query(`
        UPDATE materials 
        SET unit = $1,
            reference_price = $2,
            category = COALESCE(NULLIF($3, ''), category),
            synonyms = COALESCE(NULLIF($4, ''), synonyms),
            updated_at = NOW()
        WHERE id = $5
      `, [offData.unit, offData.price, offData.category, offData.synonyms, dbMat.id]);

      updatedTotalCount++;
    }

    console.log(`✓ ${updatedTotalCount} materiais oficiais atualizados com os preços e unidades reais da planilha!`);

    await client.query('COMMIT');
    console.log('✓ Transação confirmada (COMMIT).');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('ERRO durante a restauração, ROLLBACK executado:', err);
    throw err;
  } finally {
    client.release();
  }

  // 7. Verificação final
  const countAll = await pool.query('SELECT count(*) FROM materials');
  const countWithPhoto = await pool.query('SELECT count(*) FROM materials WHERE image_url IS NOT NULL');
  const countWithoutPhoto = await pool.query('SELECT count(*) FROM materials WHERE image_url IS NULL');
  const unitsDist = await pool.query('SELECT unit, count(*) FROM materials GROUP BY unit ORDER BY count(*) DESC');

  console.log('\n=== STATUS FINAL DA TABELA MATERIALS ===');
  console.log(`Total de materiais: ${countAll.rows[0].count} (Esperado: 757)`);
  console.log(`Com foto: ${countWithPhoto.rows[0].count} (Esperado: 757)`);
  console.log(`Sem foto: ${countWithoutPhoto.rows[0].count} (Esperado: 0)`);
  console.log('Distribuição de unidades de medida atualizadas:');
  console.table(unitsDist.rows);

  await pool.end();
}

run().catch(console.error);
