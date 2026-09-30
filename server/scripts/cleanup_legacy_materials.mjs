import { pool } from '../src/db/connection.js';

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('1. Adicionando colunas de salvaguarda em historical_usage...');
    await client.query(`
      ALTER TABLE historical_usage 
      ADD COLUMN IF NOT EXISTS material_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS material_code VARCHAR(50),
      ADD COLUMN IF NOT EXISTS material_category VARCHAR(100),
      ADD COLUMN IF NOT EXISTS material_unit VARCHAR(50);
    `);

    console.log('2. Populando colunas com dados atuais dos materiais...');
    await client.query(`
      UPDATE historical_usage hu
      SET 
        material_name = m.name,
        material_code = m.code,
        material_category = m.category,
        material_unit = m.unit
      FROM materials m
      WHERE hu.material_id = m.id;
    `);

    console.log('3. Alterando restrição de chave estrangeira em historical_usage...');
    await client.query(`
      ALTER TABLE historical_usage ALTER COLUMN material_id DROP NOT NULL;
    `);
    
    // Drop constraint and re-add with SET NULL
    await client.query(`
      ALTER TABLE historical_usage DROP CONSTRAINT IF EXISTS historical_usage_material_id_fkey;
      ALTER TABLE historical_usage 
      ADD CONSTRAINT historical_usage_material_id_fkey 
      FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE SET NULL;
    `);

    console.log('4. Remapeando itens do historical_usage para materiais oficiais onde houver match exato ou forte...');
    const officialRes = await client.query(`
      SELECT id, code, name, category, unit, synonyms
      FROM materials
      WHERE code LIKE 'SAB-%' AND code NOT LIKE 'SAB-LEG-%'
    `);
    const officialMats = officialRes.rows;

    const clean = (s) => (s || '').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const huRows = await client.query(`
      SELECT hu.id, hu.material_name, hu.material_code, hu.material_id
      FROM historical_usage hu
    `);

    let remappedCount = 0;
    for (const h of huRows.rows) {
      if (h.material_code && h.material_code.startsWith('SAB-') && !h.material_code.startsWith('SAB-LEG-')) {
        continue; // Já é oficial
      }
      const hClean = clean(h.material_name);
      const hWords = hClean.split(' ').filter(w => w.length > 2);

      let best = null;
      let bestScore = 0;

      for (const off of officialMats) {
        const oClean = clean(off.name);
        const oSynClean = clean(off.synonyms);
        if (oClean === hClean) {
          best = off;
          bestScore = 100;
          break;
        }
        let matchCount = 0;
        for (const w of hWords) {
          if (oClean.includes(w) || oSynClean.includes(w)) {
            matchCount++;
          }
        }
        const score = matchCount / Math.max(hWords.length, 1);
        if (score > bestScore && score >= 0.5) {
          bestScore = score;
          best = off;
        }
      }

      if (best) {
        await client.query(`
          UPDATE historical_usage 
          SET material_id = $1, material_name = $2, material_code = $3, material_category = $4, material_unit = $5
          WHERE id = $6
        `, [best.id, best.name, best.code, best.category, best.unit, h.id]);
        remappedCount++;
      } else {
        // Unmatched (serviços, mão de obra, etc.) -> desconecta de material legado para permitir delete
        await client.query(`UPDATE historical_usage SET material_id = NULL WHERE id = $1`, [h.id]);
      }
    }
    console.log(`Itens históricos remapeados para catálogo oficial: ${remappedCount}`);

    console.log('5. Excluindo materiais legados/duplicados...');
    const deleteRes = await client.query(`
      DELETE FROM materials 
      WHERE code LIKE 'SAB-LEG-%' OR code NOT LIKE 'SAB-%';
    `);
    console.log(`Materiais legados excluídos: ${deleteRes.rowCount}`);

    const countRes = await client.query('SELECT COUNT(*) as count FROM materials');
    console.log(`Total de materiais restantes no banco: ${countRes.rows[0].count}`);

    const huCount = await client.query('SELECT COUNT(*) as count FROM historical_usage');
    console.log(`Total de registros de calibragem (historical_usage) preservados: ${huCount.rows[0].count}`);

    await client.query('COMMIT');
    console.log('--- OPERAÇÃO CONCLUÍDA COM SUCESSO ---');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erro na operação, rollback executado:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
