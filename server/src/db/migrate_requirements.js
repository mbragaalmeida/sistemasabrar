import { pool } from './connection.js';

async function runMigration() {
  console.log('[Migration] Iniciando atualização de esquema para os novos requisitos...');

  try {
    // 1. Projects: torna responsible_engineer opcional
    await pool.query('ALTER TABLE projects ALTER COLUMN responsible_engineer DROP NOT NULL');
    console.log('✓ ALTER TABLE projects ALTER COLUMN responsible_engineer DROP NOT NULL executado.');
  } catch (e) {
    console.log('Notice projects responsible_engineer:', e.message);
  }

  try {
    // 2. project_engineers: relação muitos-para-muitos entre projetos e engenheiros
    await pool.query(`
      CREATE TABLE IF NOT EXISTS project_engineers (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(project_id, user_id)
      )
    `);
    console.log('✓ Tabela project_engineers criada com sucesso.');
  } catch (e) {
    console.log('Notice project_engineers:', e.message);
  }

  try {
    // 3. material_requests: campos para aprovação de extras por administrador
    await pool.query(`
      ALTER TABLE material_requests 
        ADD COLUMN IF NOT EXISTS requires_admin_approval BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS admin_approval_status VARCHAR(50) DEFAULT 'Aprovado',
        ADD COLUMN IF NOT EXISTS admin_approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS admin_approved_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS admin_approval_notes TEXT,
        ADD COLUMN IF NOT EXISTS has_extra_items BOOLEAN DEFAULT false
    `);
    console.log('✓ Colunas de aprovação adicionadas em material_requests.');
  } catch (e) {
    console.log('Notice material_requests:', e.message);
  }

  try {
    // 4. material_request_items: campos de rastreamento de limite orçado e itens extras
    await pool.query(`
      ALTER TABLE material_request_items 
        ADD COLUMN IF NOT EXISTS is_extra BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS budget_quantity NUMERIC(14, 2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS previously_requested NUMERIC(14, 2) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS extra_quantity NUMERIC(14, 2) DEFAULT 0
    `);
    console.log('✓ Colunas de cotas orçadas adicionadas em material_request_items.');
  } catch (e) {
    console.log('Notice material_request_items:', e.message);
  }

  // Preenche project_engineers com engenheiros existentes se houver correspondência pelo nome
  try {
    const projs = await pool.query('SELECT id, responsible_engineer FROM projects WHERE responsible_engineer IS NOT NULL');
    const users = await pool.query("SELECT u.id, u.name FROM users u JOIN roles r ON u.role_id = r.id WHERE r.name = 'engenharia'");
    
    for (const p of projs.rows) {
      if (!p.responsible_engineer) continue;
      const engStr = p.responsible_engineer.toLowerCase();
      for (const u of users.rows) {
        const normU = u.name.toLowerCase().replace(/^eng\.?\s*/i, '').trim();
        if (engStr.includes(normU)) {
          await pool.query(
            'INSERT INTO project_engineers (project_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [p.id, u.id]
          );
        }
      }
    }
    console.log('✓ Sincronização inicial de engenheiros existentes concluída.');
  } catch (e) {
    console.log('Notice sync existing engineers:', e.message);
  }

  console.log('[Migration] Migração concluída com sucesso!');
  process.exit(0);
}

runMigration().catch(err => {
  console.error('[Migration Error]', err);
  process.exit(1);
});
