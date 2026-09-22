import { db } from './connection.js';
import { SABRAR_ECONOMIC_BASE_ITEMS } from '../services/sabrarEconomicBase.js';

export async function migrateMaterialsToSabrarBase() {
  console.log('[Migration] Iniciando migração para a Base Oficial SABRAR...');
  console.log(`[Migration] Total de itens na base econômica: ${SABRAR_ECONOMIC_BASE_ITEMS.length}`);

  // 1. Exclui qualquer material que não siga a nova diretriz oficial Sabrar (ex: MAT-HVAC-...)
  const deleteResult = await db.query("DELETE FROM materials WHERE code NOT LIKE 'SAB-%'");
  console.log(`[Migration] Materiais legados/antigos removidos.`);

  // 2. Verifica se os materiais SAB já estão inseridos
  const existingCountRes = await db.query("SELECT COUNT(*) as count FROM materials WHERE code LIKE 'SAB-%'");
  const existingCount = parseInt(existingCountRes.rows?.[0]?.count || 0, 10);
  console.log(`[Migration] Materiais SAB já existentes: ${existingCount}`);

  if (existingCount >= SABRAR_ECONOMIC_BASE_ITEMS.length) {
    console.log('[Migration] Base Oficial SABRAR já está completamente populada.');
    return;
  }

  // Se houver registros parciais de SAB, limpa para reinserção consistente
  if (existingCount > 0) {
    await db.query("DELETE FROM materials WHERE code LIKE 'SAB-%'");
    console.log('[Migration] Registros parciais anteriores limpos.');
  }

  // 3. Insere todos os 906 registros oficiais em lotes de 50 para máxima performance
  const batchSize = 50;
  for (let i = 0; i < SABRAR_ECONOMIC_BASE_ITEMS.length; i += batchSize) {
    const batch = SABRAR_ECONOMIC_BASE_ITEMS.slice(i, i + batchSize);
    
    const valuePlaceholders = [];
    const params = [];
    let paramIndex = 1;

    for (let j = 0; j < batch.length; j++) {
      const itemIndex = i + j + 1;
      const it = batch[j];
      const code = `SAB-${String(itemIndex).padStart(4, '0')}`;
      const name = it.item.trim();
      const category = it.category.trim();
      const unit = it.unit.trim();
      const price = Number(Number(it.price).toFixed(2));
      const brand = (it.supplier && it.supplier !== '-' && it.supplier !== '---') ? it.supplier.trim() : 'SABRAR';
      const description = `Contexto: ${it.context}${it.supplier && it.supplier !== '-' && it.supplier !== '---' ? ` | Fornecedor: ${it.supplier}` : ''}`;

      valuePlaceholders.push(
        `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6}, 0.00, 0.00, 10.00, 'Ativo')`
      );
      params.push(code, name, description, category, unit, brand, price);
      paramIndex += 7;
    }

    const insertSql = `
      INSERT INTO materials (
        code, name, description, category, unit, brand, reference_price,
        stock_physical, stock_reserved, stock_minimum, status
      ) VALUES ${valuePlaceholders.join(',\n')}
    `;

    await db.query(insertSql, params);
  }

  const finalCountRes = await db.query('SELECT COUNT(*) as count FROM materials');
  const finalCount = parseInt(finalCountRes.rows?.[0]?.count || 0, 10);
  console.log(`[Migration] Migração concluída com sucesso! Total atual na Base Central: ${finalCount} materiais.`);
}

// Execução direta via node
if (process.argv[1]?.endsWith('migrateMaterialsToSabrarBase.js')) {
  migrateMaterialsToSabrarBase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[Migration Error]', err);
      process.exit(1);
    });
}
