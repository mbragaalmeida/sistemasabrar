import { pool } from '../src/db/connection.js';

async function main() {
  const huRes = await pool.query(`
    SELECT hu.id, hu.material_id, m.name as old_name, m.code as old_code, m.category as old_category
    FROM historical_usage hu
    JOIN materials m ON hu.material_id = m.id
    WHERE m.code LIKE 'SAB-LEG-%' OR m.code NOT LIKE 'SAB-%'
  `);
  console.log('Total de registros historical_usage com legados:', huRes.rows.length);

  const officialRes = await pool.query(`
    SELECT id, code, name, category, synonyms 
    FROM materials 
    WHERE code LIKE 'SAB-%' AND code NOT LIKE 'SAB-LEG-%'
  `);
  console.log('Total de materiais oficiais:', officialRes.rows.length);

  // Normalização
  const clean = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

  let directMatch = 0;
  let partialMatch = 0;
  let unmapped = 0;

  for (const h of huRes.rows) {
    const hName = clean(h.old_name);
    // 1. Procura exato
    let match = officialRes.rows.find(o => clean(o.name) === hName);
    if (match) {
      directMatch++;
      continue;
    }

    // 2. Procura por palavras-chave principais
    const words = hName.split(/[\s\-\/\,]+/).filter(w => w.length > 2);
    match = officialRes.rows.find(o => {
      const oName = clean(o.name);
      return words.filter(w => oName.includes(w)).length >= Math.min(2, words.length);
    });

    if (match) {
      partialMatch++;
    } else {
      unmapped++;
      // console.log('Não mapeado:', h.old_name);
    }
  }

  console.log(`Correspondências diretas: ${directMatch}`);
  console.log(`Correspondências aproximadas: ${partialMatch}`);
  console.log(`Não mapeados: ${unmapped}`);

  await pool.end();
}

main().catch(console.error);
