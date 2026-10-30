import { pool } from './connection.js';

async function migrate() {
  console.log('[Migration] Iniciando atualização de esquema...');

  await pool.query(`
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS responsible_estimator VARCHAR(150);
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS return_deadline DATE;
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS scope_summary TEXT;

    ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS categories TEXT;
    ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS contacts JSONB DEFAULT '[]'::jsonb;

    CREATE TABLE IF NOT EXISTS clients (
      id SERIAL PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      corporate_name VARCHAR(200),
      cnpj_cpf VARCHAR(30),
      contact_person VARCHAR(100),
      phone VARCHAR(50),
      email VARCHAR(150),
      address TEXT,
      city VARCHAR(100),
      state VARCHAR(50),
      segment VARCHAR(100),
      is_recurrent BOOLEAN DEFAULT TRUE,
      notes TEXT,
      rating NUMERIC(3, 1) DEFAULT 5.0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS project_addenda (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      number INTEGER NOT NULL,
      title VARCHAR(200) NOT NULL,
      description TEXT,
      date DATE DEFAULT CURRENT_DATE,
      total_materials NUMERIC(14, 2) DEFAULT 0.00,
      total_services NUMERIC(14, 2) DEFAULT 0.00,
      total_final NUMERIC(14, 2) DEFAULT 0.00,
      items JSONB DEFAULT '[]'::jsonb,
      services JSONB DEFAULT '[]'::jsonb,
      files JSONB DEFAULT '[]'::jsonb,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS budget_versions (
      id SERIAL PRIMARY KEY,
      budget_id INTEGER REFERENCES budgets(id) ON DELETE CASCADE,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      version_number INTEGER NOT NULL,
      justification TEXT NOT NULL,
      change_type VARCHAR(100) DEFAULT 'geral',
      total_materials NUMERIC(14, 2) DEFAULT 0.00,
      total_services NUMERIC(14, 2) DEFAULT 0.00,
      total_equipment NUMERIC(14, 2) DEFAULT 0.00,
      total_final NUMERIC(14, 2) DEFAULT 0.00,
      discount_amount NUMERIC(14, 2) DEFAULT 0.00,
      items_snapshot JSONB DEFAULT '[]'::jsonb,
      services_snapshot JSONB DEFAULT '[]'::jsonb,
      equipment_snapshot JSONB DEFAULT '[]'::jsonb,
      notes TEXT,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_by_name VARCHAR(150),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  console.log('[Migration] Tabelas e colunas atualizadas com sucesso!');

  // Inicializar clientes caso a tabela esteja vazia
  const countRes = await pool.query('SELECT COUNT(*) as cnt FROM clients');
  if (parseInt(countRes.rows[0].cnt, 10) === 0) {
    const clientsRes = await pool.query(`
      SELECT DISTINCT client, client_email, client_phone, address, city, state
      FROM projects 
      WHERE client IS NOT NULL AND TRIM(client) != ''
    `);
    for (const row of clientsRes.rows) {
      await pool.query(`
        INSERT INTO clients (name, email, phone, address, city, state, is_recurrent)
        VALUES ($1, $2, $3, $4, $5, $6, TRUE)
      `, [row.client, row.client_email, row.client_phone, row.address, row.city, row.state]);
    }
    console.log(`[Migration] ${clientsRes.rows.length} clientes iniciais migrados a partir dos projetos!`);
  }

  process.exit(0);
}

migrate().catch(err => {
  console.error('[Migration Error]', err);
  process.exit(1);
});
