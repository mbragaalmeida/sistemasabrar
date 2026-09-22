import { db } from './connection.js';

export function initializeDatabase() {
  // No Supabase PostgreSQL, as tabelas já foram criadas permanentemente via supabase_schema.sql
  // e persistem sem necessidade de recriação DDL em tempo de execução.
  return;
}
