import { pool } from './connection.js';

async function migrate() {
  try {
    console.log('[Migration] Iniciando ajuste de material_substitutions e criação de material_quantity_changes...');

    // 1. Permitir original_material_id ser nulo em material_substitutions
    await pool.query(`
      ALTER TABLE material_substitutions 
      ALTER COLUMN original_material_id DROP NOT NULL;
    `);
    console.log('✔ Coluna original_material_id agora permite NULL em material_substitutions.');

    // 2. Adicionar coluna original_custom_name em material_substitutions se não existir
    await pool.query(`
      ALTER TABLE material_substitutions 
      ADD COLUMN IF NOT EXISTS original_custom_name TEXT;
    `);
    console.log('✔ Coluna original_custom_name criada/verificada em material_substitutions.');

    // 3. Criar tabela material_quantity_changes
    await pool.query(`
      CREATE TABLE IF NOT EXISTS material_quantity_changes (
        id SERIAL PRIMARY KEY,
        request_item_id INTEGER NOT NULL REFERENCES material_request_items(id) ON DELETE CASCADE,
        request_id INTEGER NOT NULL REFERENCES material_requests(id) ON DELETE CASCADE,
        original_quantity NUMERIC NOT NULL,
        new_quantity NUMERIC NOT NULL,
        reason TEXT,
        requested_by INTEGER REFERENCES users(id),
        status VARCHAR(50) DEFAULT 'Pendente',
        reviewed_by INTEGER REFERENCES users(id),
        reviewed_at TIMESTAMP WITH TIME ZONE,
        review_notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    console.log('✔ Tabela material_quantity_changes criada/verificada.');

    // 4. Atualizar material SAB-0307 para KG
    await pool.query(`
      UPDATE materials 
      SET unit = 'kg',
          name = 'ELETRODO OK 4600 E6013 2.50mm - KG - ESAB',
          reference_price = 40.03,
          converted_price = 40.03,
          package_content = 1,
          converted_unit = 'kg'
      WHERE code = 'SAB-0307';
    `);
    console.log('✔ Material SAB-0307 atualizado para unidade "kg" com preço R$ 40,03.');

    // Verificar SAB-0307
    const sabCheck = await pool.query(`SELECT id, code, name, unit, reference_price, package_content FROM materials WHERE code = 'SAB-0307'`);
    console.log('Resultado SAB-0307:', sabCheck.rows[0]);

  } catch (err) {
    console.error('Erro na migração:', err);
  } finally {
    await pool.end();
  }
}

migrate();
