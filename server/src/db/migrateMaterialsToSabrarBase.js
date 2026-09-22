import { db } from './connection.js';
import { SABRAR_ECONOMIC_BASE_ITEMS } from '../services/sabrarEconomicBase.js';

export function isNonMaterial(it) {
  // 1. Exclui categorias inteiras que não são materiais (Mão de Obra e Logística/ADM)
  if (it.category === 'Administrativo / logística') return true;
  if (it.category === 'Mão de obra') return true;

  const itemLower = it.item.toLowerCase();
  const unitLower = (it.unit || '').toLowerCase();

  // 2. Exclui custos administrativos, combustíveis, diárias, salários, taxas
  if (/(gasolina|alimentação|hospedagem|passagem|salário|diária|supervisor|engenheiro|art|as built|databook|gem|manual)/i.test(itemLower)) return true;

  // 3. Exclui serviços técnicos, manutenção e limpeza
  if (/(limpeza de duto|pintura dos duto|remanejamento|teste de estanqueidade|interligações elétricas|verba de manutenção)/i.test(itemLower)) return true;
  if (itemLower === 'tab' || itemLower === 'remanejamento') return true;

  // 4. Exclui locações de equipamentos e veículos
  if (/(andaime|carro \(strada\)|içamento|plataforma elevatória|picagem\/trepanação)/i.test(itemLower)) return true;

  // 5. Exclui taxas horárias e serviços embutidos
  if (/(horario comercial|horario extra|residencial alto padrão)/i.test(itemLower)) return true;
  if (/(capacidade total das evaporadoras|infra \(distância)/i.test(itemLower)) return true;

  // 6. Unidades de tempo não pertencem a materiais físicos
  if (unitLower === 'mês' || unitLower === 'diária' || unitLower === 'hora' || unitLower === 'h') return true;

  return false;
}

export async function migrateMaterialsToSabrarBase() {
  console.log('[Migration] Iniciando filtro rigoroso da Base Oficial SABRAR (Apenas Materiais Físicos)...');
  
  const genuineMaterials = SABRAR_ECONOMIC_BASE_ITEMS.filter(it => !isNonMaterial(it));
  console.log(`[Migration] Total original: ${SABRAR_ECONOMIC_BASE_ITEMS.length} | Materiais físicos identificados: ${genuineMaterials.length} | Itens não-materiais excluídos: ${SABRAR_ECONOMIC_BASE_ITEMS.length - genuineMaterials.length}`);

  // 1. Limpa completamente a tabela de materiais para garantir que nenhum item legado ou não-material permaneça
  await db.query("DELETE FROM materials");
  console.log(`[Migration] Tabela de materiais resetada.`);

  // 2. Insere todos os materiais físicos em lotes de 50
  const batchSize = 50;
  for (let i = 0; i < genuineMaterials.length; i += batchSize) {
    const batch = genuineMaterials.slice(i, i + batchSize);
    
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
  console.log(`[Migration] Migração concluída com sucesso! Total atual na Base Central: ${finalCount} materiais físicos reais.`);
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
