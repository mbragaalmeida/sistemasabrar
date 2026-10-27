import { pool } from './connection.js';

export async function migrateLogisticsAndCamduct() {
  console.log('[Migration] Iniciando criação das tabelas de Dutos CAMduct e Logística...');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Tabela de Delivery Notes de Dutos (CAMduct)
    await client.query(`
      CREATE TABLE IF NOT EXISTS duct_delivery_notes (
        id SERIAL PRIMARY KEY,
        code VARCHAR(50) UNIQUE NOT NULL,
        delivery_note_number VARCHAR(100) UNIQUE NOT NULL,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        tagger_id INTEGER REFERENCES users(id),
        tagger_name VARCHAR(255),
        engineer_id INTEGER REFERENCES users(id),
        file_url TEXT,
        file_name VARCHAR(255),
        total_weight_kg NUMERIC NOT NULL DEFAULT 0,
        sheet_type VARCHAR(100) DEFAULT 'Galvanizada',
        budget_total_kg NUMERIC DEFAULT 0,
        accumulated_kg NUMERIC DEFAULT 0,
        exceeds_budget BOOLEAN DEFAULT FALSE,
        excess_kg NUMERIC DEFAULT 0,
        status VARCHAR(50) DEFAULT 'pendente_aprovacao',
        approval_status VARCHAR(50) DEFAULT 'pendente',
        approved_by INTEGER REFERENCES users(id),
        approved_by_name VARCHAR(255),
        approved_at TIMESTAMP WITH TIME ZONE,
        approval_reason TEXT,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. Tabela de Viagens e Romaneios de Logística
    await client.query(`
      CREATE TABLE IF NOT EXISTS logistics_trips (
        id SERIAL PRIMARY KEY,
        code VARCHAR(50) UNIQUE NOT NULL,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        scheduled_date DATE NOT NULL,
        shift VARCHAR(20) DEFAULT 'integral',
        vehicle_plate VARCHAR(20),
        vehicle_model VARCHAR(100) DEFAULT 'Caminhão Sabrar',
        driver_name VARCHAR(255),
        driver_phone VARCHAR(50),
        status VARCHAR(50) DEFAULT 'agendado',
        trip_number_week INTEGER DEFAULT 1,
        is_exceptional BOOLEAN DEFAULT FALSE,
        exception_status VARCHAR(50) DEFAULT 'aprovado_automatico',
        exception_approved_by INTEGER REFERENCES users(id),
        exception_approved_by_name VARCHAR(255),
        exception_approved_at TIMESTAMP WITH TIME ZONE,
        exception_reason TEXT,
        loading_checked BOOLEAN DEFAULT FALSE,
        loading_checked_by VARCHAR(255),
        loading_checked_at TIMESTAMP WITH TIME ZONE,
        loading_notes TEXT,
        delivery_confirmed BOOLEAN DEFAULT FALSE,
        delivery_confirmed_by INTEGER REFERENCES users(id),
        delivery_confirmed_by_name VARCHAR(255),
        delivery_confirmed_at TIMESTAMP WITH TIME ZONE,
        has_divergence BOOLEAN DEFAULT FALSE,
        divergence_notes TEXT,
        delivery_photo_url TEXT,
        notes TEXT,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 3. Tabela de Itens do Romaneio de Viagem
    await client.query(`
      CREATE TABLE IF NOT EXISTS logistics_trip_items (
        id SERIAL PRIMARY KEY,
        trip_id INTEGER NOT NULL REFERENCES logistics_trips(id) ON DELETE CASCADE,
        source_type VARCHAR(50) NOT NULL,
        request_id INTEGER REFERENCES material_requests(id) ON DELETE SET NULL,
        request_item_id INTEGER REFERENCES material_request_items(id) ON DELETE SET NULL,
        duct_note_id INTEGER REFERENCES duct_delivery_notes(id) ON DELETE SET NULL,
        material_id INTEGER REFERENCES materials(id) ON DELETE SET NULL,
        description VARCHAR(255) NOT NULL,
        unit VARCHAR(50) NOT NULL DEFAULT 'und',
        quantity_planned NUMERIC NOT NULL DEFAULT 0,
        quantity_delivered NUMERIC DEFAULT 0,
        divergence_type VARCHAR(50) DEFAULT 'sem_divergencia',
        divergence_notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Índices
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_duct_notes_project ON duct_delivery_notes(project_id);
      CREATE INDEX IF NOT EXISTS idx_duct_notes_number ON duct_delivery_notes(delivery_note_number);
      CREATE INDEX IF NOT EXISTS idx_logistics_trips_project ON logistics_trips(project_id);
      CREATE INDEX IF NOT EXISTS idx_logistics_trips_date ON logistics_trips(scheduled_date);
      CREATE INDEX IF NOT EXISTS idx_logistics_items_trip ON logistics_trip_items(trip_id);
    `);

    await client.query('COMMIT');
    console.log('[Migration] Tabelas de Dutos CAMduct e Logística criadas com sucesso!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Migration Error]', err);
    throw err;
  } finally {
    client.release();
  }
}

if (process.argv[1] && process.argv[1].endsWith('migrate_logistics_and_camduct.js')) {
  migrateLogisticsAndCamduct()
    .then(() => {
      console.log('Migração finalizada.');
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
