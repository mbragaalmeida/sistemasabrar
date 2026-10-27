import { pool } from '../src/db/connection.js';

async function updateOculos() {
  await pool.query("UPDATE materials SET image_url = '/materials/inc21_image35.png', updated_at = CURRENT_TIMESTAMP WHERE code = 'SAB-1264'");
  const res = await pool.query("SELECT COUNT(id) as count FROM materials WHERE image_url IS NULL OR trim(image_url) = ''");
  console.log('Total materials without photo now:', res.rows[0].count);
  const total = await pool.query("SELECT COUNT(id) as count FROM materials");
  console.log('Total materials in db:', total.rows[0].count);
  process.exit(0);
}

updateOculos().catch(err => {
  console.error(err);
  process.exit(1);
});
