import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function init() {
  const sqlPath = path.resolve(__dirname, '../../supabase_schema.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  const client = new Client({
    host: 'aws-0-us-west-2.pooler.supabase.com',
    port: 6543,
    user: 'postgres.uubxdjhvzrzlgxgcqfoh',
    password: 'Sistem@s@br@r2026',
    database: 'postgres',
    ssl: { rejectUnauthorized: false }
  });

  console.log('Conectando ao Supabase (us-west-2)...');
  await client.connect();
  console.log('Conexao estabelecida com sucesso!');

  console.log('Executando supabase_schema.sql...');
  await client.query(sql);
  console.log('>>> Esquema e Carga Inicial executados com SUCESSO no Supabase!');

  const tablesRes = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;");
  console.log('Tabelas criadas no Supabase:', tablesRes.rows.map(r => r.table_name));

  const usersRes = await client.query('SELECT id, name, email, department FROM users ORDER BY id;');
  console.log('Usuarios cadastrados no Supabase:');
  console.table(usersRes.rows);

  await client.end();
}

init().catch(err => {
  console.error('Erro na inicializacao do Supabase:', err);
  process.exit(1);
});
