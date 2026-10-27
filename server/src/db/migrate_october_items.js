import { pool } from './connection.js';
import xlsx from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  console.log('=== INICIANDO MIGRAÇÃO: ITENS OUTUBRO + AJUSTES DE ESQUEMA ===');

  // 1. Ajustes de Esquema no PostgreSQL Supabase
  console.log('[1/4] Ajustando esquema de material_substitutions e purchase_quotation_items...');
  await pool.query(`
    ALTER TABLE material_substitutions ALTER COLUMN substitute_material_id DROP NOT NULL;
    ALTER TABLE material_substitutions ADD COLUMN IF NOT EXISTS substitute_custom_name TEXT;
    
    ALTER TABLE purchase_quotation_items ALTER COLUMN unit_price DROP NOT NULL;
    ALTER TABLE purchase_quotation_items ALTER COLUMN unit_price SET DEFAULT 0.00;
    ALTER TABLE purchase_quotation_items ALTER COLUMN subtotal DROP NOT NULL;
    ALTER TABLE purchase_quotation_items ALTER COLUMN subtotal SET DEFAULT 0.00;
  `);
  console.log('✔ Esquemas ajustados com sucesso.');

  // 2. Ajuste do item SAB-0729 (FITA DE ARQUEAR)
  console.log('[2/4] Atualizando item SAB-0729 com conversão em metro...');
  await pool.query(`
    UPDATE materials
    SET package_content = 750,
        converted_unit = 'm',
        converted_price = ROUND((reference_price / 750)::numeric, 4),
        synonyms = CASE 
          WHEN synonyms ILIKE '%metro%' THEN synonyms
          ELSE COALESCE(synonyms, '') || ', metro, metros, m, fita arquear metro'
        END,
        updated_at = CURRENT_TIMESTAMP
    WHERE code = 'SAB-0729';
  `);
  const sab729 = await pool.query("SELECT code, name, unit, reference_price, package_content, converted_unit, converted_price, synonyms FROM materials WHERE code = 'SAB-0729'");
  console.log('✔ SAB-0729 atualizado:', sab729.rows[0]);

  // 3. Leitura e Inserção dos 44 itens da planilha
  console.log('[3/4] Lendo itens da planilha "Itens incompletos - 21.10.xlsx"...');
  const excelPath = 'C:\\Users\\Casa\\OneDrive\\Área de Trabalho\\Matheus\\Market Making\\Sabrar Engenharia\\Arquivos Sabrar\\Itens incompletos - 21.10.xlsx';
  if (!fs.existsSync(excelPath)) {
    throw new Error(`Arquivo não encontrado: ${excelPath}`);
  }

  const wb = xlsx.readFile(excelPath);
  const ws = wb.Sheets['Planilha1'];
  const rows = xlsx.utils.sheet_to_json(ws);
  console.log(`Linhas encontradas na planilha: ${rows.length}`);

  // Busca maior código SAB-XXXX
  const maxCodeRes = await pool.query(`
    SELECT code FROM materials WHERE code ~ '^SAB-[0-9]+$' ORDER BY code DESC LIMIT 1
  `);
  let maxCodeNum = 1221;
  if (maxCodeRes.rows.length > 0) {
    const match = maxCodeRes.rows[0].code.match(/^SAB-(\d+)$/);
    if (match) maxCodeNum = parseInt(match[1], 10);
  }
  console.log(`Maior código atual: SAB-${String(maxCodeNum).padStart(4, '0')}`);

  // Normalizador de categoria
  const normalizeCategory = (cat) => {
    const c = (cat || '').trim().toUpperCase();
    if (c.includes('UNIFORME')) return 'EPI';
    if (c.includes('CABOS') || c.includes('ELÉTRIC')) return 'ELÉTRICA';
    if (c.includes('HIDRÁULIC')) return 'HIDRÁULICA';
    if (c.includes('CORREIA')) return 'MECÂNICA';
    if (c.includes('EPI')) return 'EPI';
    if (c.includes('FERRAMENTA')) return 'FERRAMENTAS';
    return c || 'DIVERSOS';
  };

  // Normalizador de unidade
  const normalizeUnit = (u, name) => {
    const raw = (u || '').trim().toLowerCase();
    if (raw === 'pç' || raw === 'pc') return 'und';
    if (raw === 'rl' || raw === 'rolo c') return 'rolo';
    if (raw === 'und' || raw === 'un') return 'und';
    if (raw === 'metro' || raw === 'm') return 'm';
    if (name.toLowerCase().includes('rolo')) return 'rolo';
    return raw || 'und';
  };

  let insertedCount = 0;

  for (const r of rows) {
    const rawItem = String(r['Item'] || '').trim();
    if (!rawItem) continue;

    // Verifica se já existe por nome exato
    const existingCheck = await pool.query('SELECT id, code FROM materials WHERE LOWER(name) = LOWER($1)', [rawItem]);
    if (existingCheck.rows.length > 0) {
      console.log(`Item já cadastrado (${existingCheck.rows[0].code}): ${rawItem} - pulando...`);
      continue;
    }

    maxCodeNum++;
    const nextCode = `SAB-${String(maxCodeNum).padStart(4, '0')}`;
    const category = normalizeCategory(r['Categoria']);
    let unit = normalizeUnit(r['Unidade'], rawItem);
    const rawPrice = r[' Preço '] ?? r['Preço'] ?? 0;
    const price = parseFloat(String(rawPrice).replace(',', '.')) || 0;
    let synonym = (r['Sinônimo'] || '').trim();

    let cleanName = rawItem;
    // Ajuste de typo
    if (cleanName.includes('PREOTEÇÃO')) {
      synonym = (synonym ? synonym + ', ' : '') + cleanName;
      cleanName = cleanName.replace('PREOTEÇÃO', 'PROTEÇÃO');
    }

    // Configurações de conversão para itens especiais
    let packageContent = null;
    let convertedUnit = null;
    let convertedPrice = null;

    if (cleanName.includes('PLÁSTICO BOLHA 1,30 X 100MTS')) {
      unit = 'rolo c/ 100m';
      packageContent = 100;
      convertedUnit = 'm';
      convertedPrice = Number((price / 100).toFixed(4));
    } else if (cleanName.includes('CABO FLEXÍVEL 750V - 10MM - VERDE - (ROLO 100 METROS)')) {
      // Preço na planilha é R$ 11.05/metro
      unit = 'rolo c/ 100m';
      packageContent = 100;
      convertedUnit = 'm';
      convertedPrice = price; // R$ 11.05 por metro
      // Preço de referência do rolo = 100 * 11.05 = R$ 1.105,00
      var roloPrice = Number((price * 100).toFixed(2));
    }

    const finalRefPrice = roloPrice !== undefined ? roloPrice : price;

    await pool.query(`
      INSERT INTO materials (
        code, name, category, unit, reference_price, brand, description,
        synonyms, package_content, converted_unit, converted_price,
        stock_physical, stock_reserved, stock_minimum, status, validation_status, availability_status
      ) VALUES (
        $1, $2, $3, $4, $5, 'SABRAR', 'Material cadastrado - Planilha 21.10',
        $6, $7, $8, $9,
        0, 0, 5, 'Ativo', 'OK', 'disponivel'
      )
    `, [
      nextCode, cleanName, category, unit, finalRefPrice,
      synonym || null, packageContent, convertedUnit, convertedPrice
    ]);

    console.log(`[+] Inserido ${nextCode}: "${cleanName}" (${category} | ${unit} | R$ ${finalRefPrice})`);
    insertedCount++;
  }

  console.log(`✔ Sucesso! Total de ${insertedCount} novos materiais inseridos na base de dados.`);
}

runMigration()
  .catch(err => {
    console.error('Erro na migração:', err);
  })
  .finally(() => pool.end());
