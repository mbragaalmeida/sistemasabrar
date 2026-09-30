import { pool } from '../src/db/connection.js';

async function main() {
  const res = await pool.query(`
    SELECT column_name, data_type, is_nullable 
    FROM information_schema.columns 
    WHERE table_name = 'historical_usage'
    ORDER BY ordinal_position
  `);
  console.table(res.rows);
  await pool.end();
}

main().catch(console.error);
