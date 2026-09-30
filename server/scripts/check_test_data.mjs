import { pool } from '../src/db/connection.js';

async function main() {
  const tables = ['stock_movements', 'material_request_items', 'purchases', 'returns', 'budget_items', 'ai_suggestions', 'material_requests', 'budgets', 'projects'];
  for (const t of tables) {
    const res = await pool.query(`SELECT COUNT(*) as count FROM ${t}`);
    console.log(`${t}: ${res.rows[0].count}`);
  }

  const projRes = await pool.query(`SELECT id, code, name, is_hidden FROM projects`);
  console.log('\nProjects:');
  console.table(projRes.rows);

  await pool.end();
}

main().catch(console.error);
