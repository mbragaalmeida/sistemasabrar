import { pool } from './connection.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function updateSabrarMaterialsBase2026() {
  console.log('========================================================================');
  console.log('ATUALIZAÇÃO DA BASE OFICIAL DE MATERIAIS SABRAR (28/09/2026)');
  console.log('========================================================================');

  const jsonPath = path.resolve(__dirname, '../data/sabrarMaterialsBase2026.json');
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`Arquivo não encontrado: ${jsonPath}`);
  }

  const materials757 = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  console.log(`[Carga] Total de materiais no catálogo oficial: ${materials757.length}`);

  // 1. Garantir que as colunas necessárias existam e que reference_price tenha precisão de 4 decimais
  console.log('[1/4] Assegurando colunas e precisão na tabela materials...');
  await pool.query(`
    ALTER TABLE materials ALTER COLUMN reference_price TYPE NUMERIC(14, 4);
    ALTER TABLE materials ADD COLUMN IF NOT EXISTS synonyms TEXT;
    ALTER TABLE materials ADD COLUMN IF NOT EXISTS linear_weight NUMERIC(10, 4);
    ALTER TABLE materials ADD COLUMN IF NOT EXISTS linear_weight_unit VARCHAR(20);
    ALTER TABLE materials ADD COLUMN IF NOT EXISTS package_content NUMERIC(14, 4);
    ALTER TABLE materials ADD COLUMN IF NOT EXISTS converted_unit VARCHAR(50);
    ALTER TABLE materials ADD COLUMN IF NOT EXISTS converted_price NUMERIC(14, 4);
    ALTER TABLE materials ADD COLUMN IF NOT EXISTS validation_status VARCHAR(50) DEFAULT 'OK';
    ALTER TABLE materials ADD COLUMN IF NOT EXISTS pending_notes TEXT;
  `);

  // 2. Carregar materiais existentes
  console.log('[2/4] Analisando registros existentes no banco de dados...');
  const existingRes = await pool.query('SELECT id, code, name FROM materials');
  const existingRows = existingRes.rows;
  console.log(`Total de materiais atualmente cadastrados: ${existingRows.length}`);

  const normalizeTech = (s) => (s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const existingMap = new Map();
  for (const r of existingRows) {
    existingMap.set(normalizeTech(r.name), r);
  }

  const toUpdate = [];
  const toInsert = [];
  const matchedExistingIds = new Set();

  for (const mat of materials757) {
    const normName = normalizeTech(mat.name);
    if (existingMap.has(normName)) {
      const existing = existingMap.get(normName);
      toUpdate.push({ ...mat, existingId: existing.id });
      matchedExistingIds.add(existing.id);
    } else {
      toInsert.push(mat);
    }
  }

  console.log(`- Materiais correspondentes para atualização: ${toUpdate.length}`);
  console.log(`- Novos materiais para inserção: ${toInsert.length}`);

  // 3. Regra 12: Materiais e serviços anteriores não devem ser excluídos.
  // Adequar prefixos para evitar conflito com os códigos oficiais SAB-0001 a SAB-0757
  console.log('[3/4] Adequando prefixos de códigos legados...');
  if (matchedExistingIds.size > 0) {
    await pool.query(`
      UPDATE materials
      SET code = 'SAB-LEG-' || LPAD(id::text, 4, '0')
      WHERE code LIKE 'SAB-%'
        AND code NOT LIKE 'SAB-LEG-%'
        AND id NOT IN (${Array.from(matchedExistingIds).join(',')})
    `);
  }

  // 4. Atualizar os correspondentes em lote
  console.log('[4/4] Sincronizando dados dos 757 materiais oficiais...');
  if (toUpdate.length > 0) {
    const batchSize = 100;
    for (let i = 0; i < toUpdate.length; i += batchSize) {
      const batch = toUpdate.slice(i, i + batchSize);
      const valueClauses = [];
      const params = [];
      let pIdx = 1;

      for (const m of batch) {
        valueClauses.push(`($${pIdx}::text, $${pIdx+1}::text, $${pIdx+2}::text, $${pIdx+3}::text, $${pIdx+4}::numeric, $${pIdx+5}::text, $${pIdx+6}::numeric, $${pIdx+7}::text, $${pIdx+8}::numeric, $${pIdx+9}::text, $${pIdx+10}::numeric, $${pIdx+11}::text, $${pIdx+12}::text, $${pIdx+13}::integer)`);
        params.push(
          m.code,
          m.name,
          m.category,
          m.unit,
          m.price,
          m.synonyms,
          m.linearWeight,
          m.linearWeightUnit,
          m.packageContent,
          m.convertedUnit,
          m.convertedPrice,
          m.validationStatus,
          m.pendingNotes,
          m.existingId
        );
        pIdx += 14;
      }

      const updateQuery = `
        UPDATE materials AS m
        SET 
          code = v.code,
          name = v.name,
          category = v.category,
          unit = v.unit,
          reference_price = v.price,
          synonyms = v.synonyms,
          linear_weight = v.linear_weight,
          linear_weight_unit = v.linear_weight_unit,
          package_content = v.package_content,
          converted_unit = v.converted_unit,
          converted_price = v.converted_price,
          validation_status = v.validation_status,
          pending_notes = v.pending_notes,
          description = 'Material oficial SABRAR (Atualização 28/09/2026)',
          updated_at = NOW()
        FROM (VALUES ${valueClauses.join(', ')}) 
        AS v(code, name, category, unit, price, synonyms, linear_weight, linear_weight_unit, package_content, converted_unit, converted_price, validation_status, pending_notes, id)
        WHERE m.id = v.id
      `;

      await pool.query(updateQuery, params);
    }
  }

  // Inserir os novos materiais em lote
  if (toInsert.length > 0) {
    const batchSize = 100;
    for (let i = 0; i < toInsert.length; i += batchSize) {
      const batch = toInsert.slice(i, i + batchSize);
      const valueClauses = [];
      const params = [];
      let pIdx = 1;

      for (const m of batch) {
        valueClauses.push(`(
          $${pIdx}, $${pIdx + 1}, $${pIdx + 2}, $${pIdx + 3}, $${pIdx + 4}, $${pIdx + 5},
          $${pIdx + 6}, $${pIdx + 7}, $${pIdx + 8}, $${pIdx + 9}, $${pIdx + 10}, $${pIdx + 11},
          $${pIdx + 12}, 'SABRAR', 'Material oficial SABRAR (Atualização 28/09/2026)',
          0.00, 0.00, 10.00, 'Ativo', NOW(), NOW()
        )`);

        params.push(
          m.code,
          m.name,
          m.category,
          m.unit,
          m.price,
          m.synonyms,
          m.linearWeight,
          m.linearWeightUnit,
          m.packageContent,
          m.convertedUnit,
          m.convertedPrice,
          m.validationStatus,
          m.pendingNotes
        );

        pIdx += 13;
      }

      const insertSql = `
        INSERT INTO materials (
          code, name, category, unit, reference_price, synonyms,
          linear_weight, linear_weight_unit, package_content, converted_unit, converted_price,
          validation_status, pending_notes, brand, description,
          stock_physical, stock_reserved, stock_minimum, status, created_at, updated_at
        ) VALUES ${valueClauses.join(',\n')}
      `;

      await pool.query(insertSql, params);
    }
  }

  const totalCountRes = await pool.query('SELECT COUNT(*) as count FROM materials');
  const officialCountRes = await pool.query("SELECT COUNT(*) as count FROM materials WHERE code LIKE 'SAB-0%'");
  const pendingCountRes = await pool.query("SELECT COUNT(*) as count FROM materials WHERE validation_status = 'VALIDAR'");

  console.log('\n========================================================================');
  console.log('ATUALIZAÇÃO CONCLUÍDA COM SUCESSO!');
  console.log(`- Total de materiais agora no banco: ${totalCountRes.rows[0].count}`);
  console.log(`- Materiais oficiais da nova base: ${officialCountRes.rows[0].count}`);
  console.log(`- Materiais com pendência de validação: ${pendingCountRes.rows[0].count}`);
  console.log('========================================================================');
}

// Execução direta via terminal
if (process.argv[1]?.endsWith('updateSabrarMaterialsBase2026.js')) {
  updateSabrarMaterialsBase2026()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
