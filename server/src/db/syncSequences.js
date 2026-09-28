import { pool } from './connection.js';

/**
 * Utilitário para verificar e sincronizar todas as sequências primárias (id_seq)
 * no Supabase PostgreSQL com o valor máximo atual de cada tabela.
 * 
 * Evita o erro 'duplicate key value violates unique constraint <table>_pkey'
 * após inserções manuais ou scripts de seed com IDs explícitos.
 */
export async function syncAllDatabaseSequences() {
  console.log('--- Sincronizando sequências no Supabase PostgreSQL ---');

  const sequences = [
    { table: 'users', seq: 'users_id_seq' },
    { table: 'roles', seq: 'roles_id_seq' },
    { table: 'materials', seq: 'materials_id_seq' },
    { table: 'suppliers', seq: 'suppliers_id_seq' },
    { table: 'projects', seq: 'projects_id_seq' },
    { table: 'project_files', seq: 'project_files_id_seq' },
    { table: 'ai_analyses', seq: 'ai_analyses_id_seq' },
    { table: 'ai_suggestions', seq: 'ai_suggestions_id_seq' },
    { table: 'budgets', seq: 'budgets_id_seq' },
    { table: 'budget_items', seq: 'budget_items_id_seq' },
    { table: 'services', seq: 'services_id_seq' },
    { table: 'stock_movements', seq: 'stock_movements_id_seq' },
    { table: 'material_requests', seq: 'material_requests_id_seq' },
    { table: 'material_request_items', seq: 'material_request_items_id_seq' },
    { table: 'purchases', seq: 'purchases_id_seq' },
    { table: 'returns', seq: 'returns_id_seq' },
    { table: 'historical_usage', seq: 'historical_usage_id_seq' },
    { table: 'ai_calibration_docs', seq: 'ai_calibration_docs_id_seq' },
    { table: 'notifications', seq: 'notifications_id_seq' },
    { table: 'audit_logs', seq: 'audit_logs_id_seq' },
    { table: 'duct_analyses', seq: 'duct_analyses_id_seq' },
    { table: 'budget_equipment', seq: 'budget_equipment_id_seq' }
  ];

  for (const item of sequences) {
    try {
      const maxRes = await pool.query(`SELECT MAX(id) as max_id FROM ${item.table}`);
      const maxId = Number(maxRes.rows[0]?.max_id) || 0;
      
      const currSeqRes = await pool.query(`SELECT last_value FROM ${item.seq}`);
      const currSeq = Number(currSeqRes.rows[0]?.last_value) || 0;

      if (maxId >= currSeq) {
        await pool.query(`SELECT setval('${item.seq}', ${maxId}, true)`);
        console.log(`[SINCRONIZADO] ${item.table.padEnd(25)}: MAX(id)=${maxId} | Seq era ${currSeq} -> agora ${maxId}`);
      }
    } catch (err) {
      console.warn(`[AVISO] Não foi possível sincronizar ${item.table}:`, err.message);
    }
  }

  console.log('--- Sincronização concluída com sucesso ---');
}
