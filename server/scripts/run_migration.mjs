import db from '../src/db/connection.js';

async function migrate() {
  console.log('Executando migração de colunas...');
  await db.query(`
    ALTER TABLE budgets ADD COLUMN IF NOT EXISTS completeness_status VARCHAR(50);
    ALTER TABLE budgets ADD COLUMN IF NOT EXISTS is_partial BOOLEAN DEFAULT FALSE;
    ALTER TABLE budgets ADD COLUMN IF NOT EXISTS partial_subtotal NUMERIC(14, 2);
    ALTER TABLE budgets ADD COLUMN IF NOT EXISTS pendencies_summary JSONB;
    ALTER TABLE budgets ADD COLUMN IF NOT EXISTS document_conflicts JSONB;

    ALTER TABLE budget_items ADD COLUMN IF NOT EXISTS classification VARCHAR(50);
    ALTER TABLE budget_items ADD COLUMN IF NOT EXISTS price_status VARCHAR(50);
    ALTER TABLE budget_items ADD COLUMN IF NOT EXISTS evidence TEXT;
    ALTER TABLE budget_items ADD COLUMN IF NOT EXISTS conflict_description TEXT;

    ALTER TABLE services ADD COLUMN IF NOT EXISTS classification VARCHAR(50);
    ALTER TABLE services ADD COLUMN IF NOT EXISTS measurement_status VARCHAR(50);
  `);
  console.log('Migração concluída com sucesso!');
  process.exit(0);
}

migrate().catch(e => {
  console.error('Erro na migração:', e);
  process.exit(1);
});
