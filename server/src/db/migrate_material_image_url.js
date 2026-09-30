import { pool } from './connection.js';

try {
  console.log('Adicionando coluna image_url à tabela materials se não existir...');
  await pool.query('ALTER TABLE materials ADD COLUMN IF NOT EXISTS image_url TEXT;');
  console.log('Coluna image_url verificada/adicionada com sucesso!');

  // Check columns
  const res = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'materials' AND column_name = 'image_url'");
  console.log('Resultado:', res.rows);
} catch (err) {
  console.error('Erro ao migrar coluna:', err);
} finally {
  await pool.end();
}
