import { createRequire } from 'module';
import { pool } from '../src/db/connection.js';

const require = createRequire(import.meta.url);
const xlsx = require('xlsx');

const filePath = 'C:/Users/Casa/OneDrive/Área de Trabalho/Matheus/Market Making/Sabrar Engenharia/Arquivos Sabrar/Lista de materiais - fotos (1).xlsx';

async function main() {
  const wb = xlsx.readFile(filePath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });

  let validCount = 0;
  const items = [];
  for (let r = 2; r < rows.length; r++) {
    const row = rows[r];
    if (row && row.some(cell => cell !== undefined && cell !== null && String(cell).trim() !== '')) {
      validCount++;
      items.push({
        rowIdx: r + 1,
        categoria: row[0],
        foto: row[1],
        nome: row[2],
        sinonimos: row[3],
        preco: row[4],
        unidade: row[5]
      });
    }
  }

  console.log('Linhas na planilha com algum dado a partir da linha 3:', validCount);
  console.log('Primeiro item:', items[0]);
  console.log('Último item:', items[items.length - 1]);

  // Checar quantos itens começam com SAB- vs SAB-LEG- no banco
  const sabCount = await pool.query("SELECT COUNT(*) FROM materials WHERE code LIKE 'SAB-%' AND code NOT LIKE 'SAB-LEG-%'");
  const sabLegCount = await pool.query("SELECT COUNT(*) FROM materials WHERE code LIKE 'SAB-LEG-%'");
  const otherCount = await pool.query("SELECT COUNT(*) FROM materials WHERE code NOT LIKE 'SAB-%'");

  console.log('\n--- MATERIAIS NO BANCO ---');
  console.log('Código SAB- (da planilha oficial):', sabCount.rows[0].count);
  console.log('Código SAB-LEG- (legados antigos):', sabLegCount.rows[0].count);
  console.log('Outros códigos:', otherCount.rows[0].count);

  // Verificar se há chaves estrangeiras apontando para os materiais SAB-LEG-
  const legIdsRes = await pool.query("SELECT id FROM materials WHERE code LIKE 'SAB-LEG-%'");
  const legIds = legIdsRes.rows.map(r => r.id);
  console.log('\nTotal de IDs legados:', legIds.length);

  const huLeg = await pool.query("SELECT COUNT(*) FROM historical_usage WHERE material_id = ANY($1)", [legIds]);
  console.log('historical_usage referenciando legados:', huLeg.rows[0].count);

  const biLeg = await pool.query("SELECT COUNT(*) FROM budget_items WHERE material_id = ANY($1)", [legIds]);
  console.log('budget_items referenciando legados:', biLeg.rows[0].count);

  const mriLeg = await pool.query("SELECT COUNT(*) FROM material_request_items WHERE material_id = ANY($1)", [legIds]);
  console.log('material_request_items referenciando legados:', mriLeg.rows[0].count);

  const purLeg = await pool.query("SELECT COUNT(*) FROM purchases WHERE material_id = ANY($1)", [legIds]);
  console.log('purchases referenciando legados:', purLeg.rows[0].count);

  const smLeg = await pool.query("SELECT COUNT(*) FROM stock_movements WHERE material_id = ANY($1)", [legIds]);
  console.log('stock_movements referenciando legados:', smLeg.rows[0].count);

  await pool.end();
}

main().catch(console.error);
