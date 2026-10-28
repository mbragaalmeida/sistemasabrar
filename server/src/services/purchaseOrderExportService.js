import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { db } from '../db/connection.js';
import { OC_MODELO_NOVO_BASE64 } from '../templates/ocTemplateBase64.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Busca template na pasta do servidor, na raiz ou usa o embutido
function getTemplatePath() {
  const localTemplate = path.join(__dirname, '../templates/OC_MODELO_NOVO.xlsx');
  if (fs.existsSync(localTemplate)) return localTemplate;
  const cwdTemplate = path.join(process.cwd(), 'server/src/templates/OC_MODELO_NOVO.xlsx');
  if (fs.existsSync(cwdTemplate)) return cwdTemplate;
  const externalTemplate = 'C:/Users/Casa/OneDrive/Área de Trabalho/Matheus/Market Making/Sabrar Engenharia/Arquivos Sabrar/OC MODELO NOVO.xlsx';
  if (fs.existsSync(externalTemplate)) return externalTemplate;
  return null;
}

/**
 * Gera uma Ordem de Compra (OC) em formato Excel (.xlsx) totalmente editável
 * baseada no modelo oficial da Sabrar Engenharia ("OC MODELO NOVO.xlsx")
 */
export class PurchaseOrderExportService {
  /**
   * Exporta a OC a partir de uma Cotação e do Fornecedor / Proposta selecionada
   */
  static async exportFromQuotation(quotationId, supplierId, buyerUser = null) {
    const quotation = await db.prepare(`
      SELECT pq.*, p.name as project_name, p.code as project_code, p.address as project_address, p.city as project_city
      FROM purchase_quotations pq
      LEFT JOIN projects p ON pq.project_id = p.id
      WHERE pq.id = ?
    `).get(quotationId);

    if (!quotation) throw new Error('Cotação não encontrada');

    // Busca o fornecedor da cotação
    let supplierRow = null;
    if (supplierId) {
      supplierRow = await db.prepare(`
        SELECT pqs.*, s.name as reg_supplier_name, s.cnpj, s.contact_person, s.phone, s.email
        FROM purchase_quotation_suppliers pqs
        LEFT JOIN suppliers s ON pqs.supplier_id = s.id
        WHERE pqs.id = ? AND pqs.quotation_id = ?
      `).get(supplierId, quotationId);
    } else {
      // Pega o vencedor ou o primeiro
      supplierRow = await db.prepare(`
        SELECT pqs.*, s.name as reg_supplier_name, s.cnpj, s.contact_person, s.phone, s.email
        FROM purchase_quotation_suppliers pqs
        LEFT JOIN suppliers s ON pqs.supplier_id = s.id
        WHERE pqs.quotation_id = ?
        ORDER BY pqs.is_winner DESC, pqs.id ASC
        LIMIT 1
      `).get(quotationId);
    }

    if (!supplierRow) throw new Error('Nenhuma proposta de fornecedor encontrada para exportação');

    // Busca itens da cotação com os preços deste fornecedor
    const items = await db.prepare(`
      SELECT DISTINCT ON (COALESCE(pqi.material_id, pqi.id))
        pqi.id,
        pqi.material_id,
        COALESCE(pqi.material_description, m.name, 'Material') as material_name,
        COALESCE(m.code, 'SAB') as material_code,
        pqi.quantity,
        COALESCE(pqi.unit, m.unit, 'und') as unit
      FROM purchase_quotation_items pqi
      LEFT JOIN materials m ON m.id = pqi.material_id
      WHERE pqi.quotation_id = ?
      ORDER BY COALESCE(pqi.material_id, pqi.id), pqi.id ASC
    `).all(quotationId);

    // Mapeamento de preços do fornecedor
    let pricesMap = {};
    if (supplierRow.items_prices) {
      pricesMap = typeof supplierRow.items_prices === 'string'
        ? JSON.parse(supplierRow.items_prices)
        : supplierRow.items_prices;
    }

    const supplierName = supplierRow.custom_supplier_name || supplierRow.reg_supplier_name || 'Fornecedor';
    const supplierCnpj = supplierRow.cnpj || '';
    const supplierPhone = supplierRow.phone || '';
    const supplierEmail = supplierRow.email || '';
    const proposalNumber = supplierRow.proposal_number || quotation.quotation_number || `PROP-${quotation.id}`;

    // Monta itens com preço
    const ocItems = items.map(it => {
      const unitPrice = Number(pricesMap[it.id] || pricesMap[it.material_id] || 0);
      return {
        code: it.material_code,
        name: it.material_name,
        unit: it.unit,
        quantity: Number(it.quantity || 1),
        price: unitPrice
      };
    });

    const buyerName = buyerUser?.name || 'Emily Bueno';
    const buyerEmail = buyerUser?.email || 'emily@sabrar.com.br';
    const buyerPhone = buyerUser?.phone || '(21) 97016-8717';

    return await this.buildWorkbook({
      ocCode: `OC-${quotation.quotation_number ? quotation.quotation_number.replace('COT-', '') : quotation.id}`,
      orderCode: quotation.quotation_number || `COT-${quotation.id}`,
      projectName: quotation.project_name || 'Obra Sabrar',
      projectAddress: quotation.project_address,
      projectCity: quotation.project_city,
      proposalNumber,
      rmNumber: `RM-${quotation.id}`,
      supplierName,
      supplierCnpj,
      supplierPhone,
      supplierEmail,
      creationDate: new Date().toLocaleDateString('pt-BR'),
      deliveryDate: quotation.deadline ? new Date(quotation.deadline).toLocaleDateString('pt-BR') : '',
      paymentTerms: supplierRow.payment_terms || 'FATURADO 28DD',
      freight: Number(supplierRow.transport_cost || 0),
      discount: 0,
      buyerName,
      buyerEmail,
      buyerPhone,
      items: ocItems
    });
  }

  /**
   * Exporta a OC a partir de uma lista de compras/pedidos de uma obra
   */
  static async exportFromPurchases(purchaseIds, buyerUser = null) {
    if (!purchaseIds || purchaseIds.length === 0) throw new Error('Nenhuma compra informada');

    const purchases = await db.prepare(`
      SELECT p.*,
             COALESCE(m.name, p.custom_name, 'Material') as material_name,
             COALESCE(m.code, 'SAB') as material_code,
             COALESCE(p.custom_unit, m.unit, 'und') as material_unit,
             s.name as supplier_name, s.cnpj, s.phone, s.email,
             pr.name as project_name, pr.code as project_code, pr.address as project_address, pr.city as project_city,
             mr.code as request_code
      FROM purchases p
      LEFT JOIN materials m ON p.material_id = m.id
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      LEFT JOIN projects pr ON p.project_id = pr.id
      LEFT JOIN material_request_items mri ON p.request_item_id = mri.id
      LEFT JOIN material_requests mr ON mri.request_id = mr.id
      WHERE p.id IN (${purchaseIds.map(() => '?').join(',')})
    `).all(...purchaseIds);

    if (purchases.length === 0) throw new Error('Nenhuma compra encontrada');

    const first = purchases[0];
    const ocItems = purchases.map(p => ({
      code: p.material_code,
      name: p.material_name,
      unit: p.material_unit,
      quantity: Number(p.quantity || 1),
      price: Number(p.unit_price || 0)
    }));

    const buyerName = buyerUser?.name || 'Emily Bueno';
    const buyerEmail = buyerUser?.email || 'emily@sabrar.com.br';
    const buyerPhone = buyerUser?.phone || '(21) 97016-8717';

    return await this.buildWorkbook({
      ocCode: first.code || `OC-${first.id}`,
      orderCode: first.request_code || first.code || `PED-${first.id}`,
      projectName: first.project_name || 'Obra Sabrar',
      projectAddress: first.project_address,
      projectCity: first.project_city,
      proposalNumber: `PROP-${first.id}`,
      rmNumber: first.request_code || `RM-${first.id}`,
      supplierName: first.supplier_name || 'Fornecedor',
      supplierCnpj: first.cnpj || '',
      supplierPhone: first.phone || '',
      supplierEmail: first.email || '',
      creationDate: new Date().toLocaleDateString('pt-BR'),
      deliveryDate: first.expected_delivery_date ? new Date(first.expected_delivery_date).toLocaleDateString('pt-BR') : '',
      paymentTerms: first.payment_terms || 'FATURADO 28DD',
      freight: 0,
      discount: 0,
      buyerName,
      buyerEmail,
      buyerPhone,
      items: ocItems
    });
  }

  /**
   * Preenche a planilha modelo com os dados preservando a formatação exata
   */
  static async buildWorkbook(data) {
    const workbook = new ExcelJS.Workbook();
    let loaded = false;
    try {
      const templatePath = getTemplatePath();
      if (templatePath && fs.existsSync(templatePath)) {
        await workbook.xlsx.readFile(templatePath);
        loaded = true;
      }
    } catch (e) {
      // Ignora erro de leitura em disco e usa template embutido
    }

    if (!loaded) {
      const buffer = Buffer.from(OC_MODELO_NOVO_BASE64, 'base64');
      await workbook.xlsx.load(buffer);
    }

    const ws = workbook.getWorksheet(1);

    // 1. Cabeçalho da Ordem de Compra
    ws.getCell('B9').value = `ORDEM DE COMPRA: ${data.ocCode || ''}`;

    // 2. Pedido e Fornecedor
    ws.getCell('B11').value = `Pedido: ${data.orderCode || ''}`;
    ws.getCell('G11').value = `CNPJ: ${data.supplierCnpj || ''}`;
    ws.getCell('B12').value = `Fornecedor: ${data.supplierName || ''}`;
    ws.getCell('B13').value = `Telefone: ${data.supplierPhone || ''}`;
    ws.getCell('G13').value = `Email: ${data.supplierEmail || ''}`;
    ws.getCell('B14').value = `Data de Criação: ${data.creationDate || ''}`;
    ws.getCell('G14').value = `Data de Entrega: ${data.deliveryDate || ''}`;

    // 3. Endereço de Entrega (se a obra tiver endereço preenchido, usa; senão mantém o padrão do galpão)
    if (data.projectAddress && data.projectAddress.trim()) {
      ws.getCell('D18').value = data.projectAddress;
      if (data.projectCity) ws.getCell('J19').value = data.projectCity;
    }

    // 4. Obra, Proposta, RM
    ws.getCell('B22').value = `OBRA: ${data.projectName || ''}                       PROPOSTA: ${data.proposalNumber || ''}                                      RM: ${data.rmNumber || ''}`;

    // 5. Itens do Pedido (Linhas 26 a 45)
    const items = data.items || [];
    for (let i = 0; i < 20; i++) {
      const rowNum = 26 + i;
      const it = items[i];
      if (it) {
        ws.getCell(`B${rowNum}`).value = i + 1;
        ws.getCell(`C${rowNum}`).value = it.code || 'SAB';
        ws.getCell(`D${rowNum}`).value = it.name || '';
        ws.getCell(`H${rowNum}`).value = it.unit || 'und';
        ws.getCell(`I${rowNum}`).value = Number(it.quantity || 0);
        ws.getCell(`J${rowNum}`).value = Number(it.price || 0);
        ws.getCell(`K${rowNum}`).value = { formula: `I${rowNum}*J${rowNum}` };
      } else {
        ws.getCell(`B${rowNum}`).value = null;
        ws.getCell(`C${rowNum}`).value = null;
        ws.getCell(`D${rowNum}`).value = null;
        ws.getCell(`H${rowNum}`).value = null;
        ws.getCell(`I${rowNum}`).value = null;
        ws.getCell(`J${rowNum}`).value = null;
        ws.getCell(`K${rowNum}`).value = null;
      }
    }

    // Subtotal, Desconto, Acréscimos (Frete)
    ws.getCell('K47').value = Number(data.discount || 0);
    ws.getCell('K48').value = Number(data.freight || 0);

    // Condições de pagamento
    if (data.paymentTerms) {
      ws.getCell('B52').value = data.paymentTerms;
    }

    // Dados do Comprador
    ws.getCell('B55').value = `NOME: ${data.buyerName || 'Emily Bueno'}`;
    ws.getCell('B56').value = `E-MAIL: ${data.buyerEmail || 'emily@sabrar.com.br'}`;
    ws.getCell('B57').value = `TELEFONE: ${data.buyerPhone || '(21) 97016-8717'}`;

    return await workbook.xlsx.writeBuffer();
  }
}
