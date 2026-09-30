import { pool } from '../src/db/connection.js';

async function main() {
  const huRes = await pool.query(`
    SELECT hu.id, hu.material_id, m.name as old_name, m.code as old_code, m.unit as old_unit, m.category as old_category
    FROM historical_usage hu
    JOIN materials m ON hu.material_id = m.id
    ORDER BY hu.id ASC
  `);

  const officialRes = await pool.query(`
    SELECT id, code, name, category, unit, synonyms
    FROM materials
    WHERE code LIKE 'SAB-%' AND code NOT LIKE 'SAB-LEG-%'
    ORDER BY id ASC
  `);

  console.log(`Total historical rows: ${huRes.rows.length}`);
  console.log(`Total official materials: ${officialRes.rows.length}`);

  const clean = (s) => (s || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  let matched = [];
  let unmatched = [];

  for (const h of huRes.rows) {
    if (h.old_code.startsWith('SAB-') && !h.old_code.startsWith('SAB-LEG-')) {
      matched.push({ id: h.id, old: h.old_name, target: h.old_name, targetId: h.material_id, type: 'already_official' });
      continue;
    }

    const hClean = clean(h.old_name);
    const hWords = hClean.split(' ').filter(w => w.length > 2);

    // Score all official materials
    let best = null;
    let bestScore = 0;

    for (const off of officialRes.rows) {
      const oClean = clean(off.name);
      const oSynClean = clean(off.synonyms);
      
      if (oClean === hClean) {
        best = off;
        bestScore = 100;
        break;
      }

      // Word overlap
      let matchCount = 0;
      for (const w of hWords) {
        if (oClean.includes(w) || oSynClean.includes(w)) {
          matchCount++;
        }
      }

      const score = matchCount / Math.max(hWords.length, 1);
      if (score > bestScore && score >= 0.4) {
        bestScore = score;
        best = off;
      }
    }

    if (best) {
      matched.push({ id: h.id, old: h.old_name, target: best.name, targetId: best.id, score: bestScore });
    } else {
      unmatched.push({ id: h.id, old: h.old_name, category: h.old_category });
    }
  }

  console.log(`Matched: ${matched.length}`);
  console.log(`Unmatched: ${unmatched.length}`);

  console.log('\nSample Matched (first 10):');
  console.log(matched.slice(0, 10));

  console.log('\nSample Unmatched (first 10):');
  console.log(unmatched.slice(0, 10));

  await pool.end();
}

main().catch(console.error);
