import { pool } from './connection.js';

export async function runMigration() {
  console.log('[Migration] Iniciando criação das tabelas de Solicitações de Dutos e Logística...');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Tabela de Solicitações de Dutos (feitas pelos engenheiros)
    await client.query(`
      CREATE TABLE IF NOT EXISTS duct_requests (
        id SERIAL PRIMARY KEY,
        code VARCHAR(50) UNIQUE,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        requested_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        priority VARCHAR(50) DEFAULT 'Normal',
        status VARCHAR(50) DEFAULT 'Pendente',
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. Tabela de Itens da Solicitação de Dutos
    await client.query(`
      CREATE TABLE IF NOT EXISTS duct_request_items (
        id SERIAL PRIMARY KEY,
        request_id INTEGER NOT NULL REFERENCES duct_requests(id) ON DELETE CASCADE,
        item_description VARCHAR(255) NOT NULL,
        dimension VARCHAR(100),
        unit VARCHAR(20) DEFAULT 'un',
        quantity_requested NUMERIC NOT NULL DEFAULT 1,
        quantity_tagged NUMERIC DEFAULT 0,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 3. Vincular duct_delivery_notes à duct_requests
    await client.query(`
      ALTER TABLE duct_delivery_notes 
      ADD COLUMN IF NOT EXISTS duct_request_id INTEGER REFERENCES duct_requests(id) ON DELETE SET NULL
    `);

    // 4. Tabela de Solicitações de Logística (feitas pelos engenheiros)
    await client.query(`
      CREATE TABLE IF NOT EXISTS logistics_requests (
        id SERIAL PRIMARY KEY,
        code VARCHAR(50) UNIQUE,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        requested_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        priority VARCHAR(50) DEFAULT 'Normal',
        desired_date DATE,
        preferred_shift VARCHAR(50) DEFAULT 'integral',
        delivery_location TEXT,
        contact_on_site VARCHAR(255),
        notes TEXT,
        status VARCHAR(50) DEFAULT 'Pendente',
        trip_id INTEGER REFERENCES logistics_trips(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 5. Tabela de Itens da Solicitação de Logística
    await client.query(`
      CREATE TABLE IF NOT EXISTS logistics_request_items (
        id SERIAL PRIMARY KEY,
        logistics_request_id INTEGER NOT NULL REFERENCES logistics_requests(id) ON DELETE CASCADE,
        source_type VARCHAR(50) NOT NULL, -- 'material' ou 'duto'
        material_id INTEGER REFERENCES materials(id) ON DELETE SET NULL,
        material_request_id INTEGER REFERENCES material_requests(id) ON DELETE SET NULL,
        material_request_item_id INTEGER REFERENCES material_request_items(id) ON DELETE SET NULL,
        duct_request_id INTEGER REFERENCES duct_requests(id) ON DELETE SET NULL,
        duct_note_id INTEGER REFERENCES duct_delivery_notes(id) ON DELETE SET NULL,
        item_description VARCHAR(255) NOT NULL,
        unit VARCHAR(20) DEFAULT 'un',
        quantity_requested NUMERIC NOT NULL DEFAULT 1,
        quantity_shipped NUMERIC DEFAULT 0,
        status VARCHAR(50) DEFAULT 'Pendente',
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 6. Coluna de vínculo em logistics_trips
    await client.query(`
      ALTER TABLE logistics_trips
      ADD COLUMN IF NOT EXISTS logistics_request_id INTEGER REFERENCES logistics_requests(id) ON DELETE SET NULL
    `);

    // 7. Coluna de vínculo em logistics_trip_items
    await client.query(`
      ALTER TABLE logistics_trip_items
      ADD COLUMN IF NOT EXISTS logistics_request_item_id INTEGER REFERENCES logistics_request_items(id) ON DELETE SET NULL
    `);

    await client.query('COMMIT');
    console.log('[Migration] Tabelas e colunas criadas com sucesso!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Migration Error]', err);
    throw err;
  } finally {
    client.release();
  }
}

if (process.argv[1] && process.argv[1].endsWith('migrate_engineer_ducts_logistics.js')) {
  runMigration().then(() => process.exit(0)).catch(() => process.exit(1));
}
