import { pool } from './connection.js';

export async function initializeDatabase() {
  try {
    await pool.query(`
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS responsible_estimator VARCHAR(150);
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS return_deadline DATE;
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS scope_summary TEXT;
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS parent_project_id INTEGER REFERENCES projects(id);
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT FALSE;

      ALTER TABLE project_files ADD COLUMN IF NOT EXISTS file_data BYTEA;

      ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS categories TEXT;
      ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS contacts JSONB DEFAULT '[]'::jsonb;
      ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS vendors JSONB DEFAULT '[]'::jsonb;

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
        origin_project_id INTEGER,
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

      CREATE TABLE IF NOT EXISTS tracked_purchase_deadlines (
        id SERIAL PRIMARY KEY,
        order_number TEXT NOT NULL,
        supplier_name TEXT NOT NULL,
        item_name TEXT NOT NULL,
        project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
        project_name TEXT NOT NULL,
        expected_billing_date DATE NOT NULL,
        notes TEXT,
        status TEXT DEFAULT 'Em Acompanhamento',
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        notified BOOLEAN DEFAULT FALSE
      );
      CREATE TABLE IF NOT EXISTS direct_billing_invoices (
        id SERIAL PRIMARY KEY,
        direct_billing_id INTEGER NOT NULL REFERENCES direct_billings(id) ON DELETE CASCADE,
        invoice_number VARCHAR(100) NOT NULL,
        amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
        issue_date DATE DEFAULT CURRENT_DATE,
        description TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('[Database] Esquema de tabelas e colunas sincronizado com sucesso.');
  } catch (err) {
    console.warn('[Database Schema Warning]', err.message);
  }
}
