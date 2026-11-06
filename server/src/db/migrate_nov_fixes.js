import { pool } from './connection.js';

export async function runNovFixes() {
  console.log('[Migration] Iniciando correções de dados e tabelas...');

  // 1. Atualizar preço de "TE SOLDÁVEL - PVC MARROM - 32MM" (SAB-1084) para R$ 3,62
  const updatePriceRes = await pool.query(
    "UPDATE materials SET reference_price = 3.62, updated_at = NOW() WHERE code = 'SAB-1084' OR name ILIKE '%TE SOLD%32MM%' RETURNING id, code, name, reference_price"
  );
  console.log('✓ Preço atualizado:', updatePriceRes.rows);

  // 2. Reverter deduções indevidas de estoque da solicitação rejeitada SOL-2026-0072
  const solReq = await pool.query("SELECT id, code, status, admin_approval_status FROM material_requests WHERE code = 'SOL-2026-0072'");
  if (solReq.rows.length > 0) {
    const req = solReq.rows[0];
    console.log(`Verificando solicitação ${req.code} (Status: ${req.status}, Admin: ${req.admin_approval_status})...`);

    // Busca movimentos de saída vinculados a SOL-2026-0072
    const moves = await pool.query(
      "SELECT sm.*, m.code as mat_code, m.name as mat_name, m.stock_physical, m.unit as mat_unit FROM stock_movements sm JOIN materials m ON sm.material_id = m.id WHERE sm.notes LIKE '%SOL-2026-0072%' AND sm.type = 'SAIDA_OBRA'"
    );

    // Verifica se já houve estorno anteriormente
    const estornos = await pool.query(
      "SELECT id FROM stock_movements WHERE notes LIKE '%Estorno%SOL-2026-0072%'"
    );

    if (estornos.rows.length === 0 && moves.rows.length > 0) {
      console.log(`Revertendo ${moves.rows.length} saídas indevidas de SOL-2026-0072...`);
      for (const m of moves.rows) {
        const qtyToReturn = Number(m.quantity);
        const currentMat = await pool.query("SELECT stock_physical FROM materials WHERE id = $1", [m.material_id]);
        const prevStock = Number(currentMat.rows[0]?.stock_physical || 0);
        const restoredStock = Number((prevStock + qtyToReturn).toFixed(2));

        await pool.query(
          "UPDATE materials SET stock_physical = $1, updated_at = NOW() WHERE id = $2",
          [restoredStock, m.material_id]
        );

        await pool.query(`
          INSERT INTO stock_movements (material_id, type, quantity, previous_stock, new_stock, project_id, reference_id, user_id, notes)
          VALUES ($1, 'AJUSTE', $2, $3, $4, $5, $6, $7, $8)
        `, [
          m.material_id,
          qtyToReturn,
          prevStock,
          restoredStock,
          m.project_id,
          m.reference_id,
          1,
          `Estorno de baixa indevida da solicitação rejeitada/cancelada SOL-2026-0072 (${m.mat_code} - ${m.mat_name})`
        ]);
        console.log(`  - Revertido ${m.mat_code} (${m.mat_name}): +${qtyToReturn} -> Novo estoque: ${restoredStock}`);
      }
    } else {
      console.log('Movimentações de SOL-2026-0072 já haviam sido estornadas ou não encontradas.');
    }

    // Garante que o status de SOL-2026-0072 e outras rejeitadas seja 'Cancelado'
    await pool.query(
      "UPDATE material_requests SET status = 'Cancelado', updated_at = NOW() WHERE admin_approval_status = 'Rejeitado' AND status != 'Cancelado'"
    );
    console.log('✓ Status de solicitações rejeitadas atualizado para "Cancelado".');
  }

  // 3. Tabela de Notas Fiscais de Faturamento Direto (múltiplas NFs para o mesmo pedido)
  await pool.query(`
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
  console.log('✓ Tabela direct_billing_invoices pronta.');

  // Sincroniza faturamento inicial existente para tabela de invoices se estiver vazia
  const existingInvoicesCount = await pool.query('SELECT COUNT(*) as count FROM direct_billing_invoices');
  if (Number(existingInvoicesCount.rows[0].count) === 0) {
    const activeDbs = await pool.query('SELECT id, billed_amount, notes FROM direct_billings WHERE billed_amount > 0');
    for (const b of activeDbs.rows) {
      await pool.query(`
        INSERT INTO direct_billing_invoices (direct_billing_id, invoice_number, amount, description)
        VALUES ($1, 'NF-01 (Inicial)', $2, 'Faturamento inicial registrado')
      `, [b.id, b.billed_amount]);
    }
    console.log(`✓ Sincronizados ${activeDbs.rows.length} faturamentos prévios em direct_billing_invoices.`);
  }

  console.log('[Migration] Concluído com sucesso!');
}

if (process.argv[1]?.endsWith('migrate_nov_fixes.js')) {
  runNovFixes().then(() => process.exit(0)).catch(err => {
    console.error('Erro na migração:', err);
    process.exit(1);
  });
}
