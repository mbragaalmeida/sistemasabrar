import express from 'express';
import multer from 'multer';
import { db } from '../db/connection.js';
import { StockService, generateNextPurchaseCode } from '../services/stockService.js';
import { PurchaseOrderExportService } from '../services/purchaseOrderExportService.js';
import { SupplierPdfParser } from '../services/supplierPdfParser.js';
import { extractTextFromPdfBuffer } from '../utils/pdfHelper.js';

const uploadMem = multer({ storage: multer.memoryStorage() });

export const purchasesRouter = express.Router();

/**
 * GET /api/purchases/export-oc
 * Exporta uma Ordem de Compra em formato Excel editável (.xlsx)
 * preenchida com as compras/itens informados
 */
purchasesRouter.get('/export-oc', async (req, res) => {
  try {
    const { purchaseIds, projectId, requestCode, userId } = req.query;

    let ids = [];
    if (purchaseIds) {
      ids = String(purchaseIds)
        .split(',')
        .map(s => Number(s.trim()))
        .filter(n => !isNaN(n) && n > 0);
    }

    // Se não passou purchaseIds ou a lista estiver vazia, mas passou projectId ou requestCode, busca do banco
    if (ids.length === 0 && (projectId || requestCode)) {
      let query = `
        SELECT p.id
        FROM purchases p
        LEFT JOIN material_request_items mri ON p.request_item_id = mri.id
        LEFT JOIN material_requests mr ON mri.request_id = mr.id
        WHERE (p.is_hidden IS FALSE OR p.is_hidden IS NULL)
      `;
      const params = [];
      if (projectId && projectId !== 'geral') {
        query += ' AND p.project_id = ?';
        params.push(Number(projectId));
      }
      if (requestCode) {
        if (requestCode === 'AVULSO') {
          query += ' AND (mr.code IS NULL OR p.request_item_id IS NULL)';
        } else {
          query += ' AND mr.code = ?';
          params.push(requestCode);
        }
      }
      query += ' ORDER BY p.id ASC';

      const rows = await db.prepare(query).all(...params);
      ids = rows.map(r => r.id);
    }

    if (ids.length === 0) {
      return res.status(404).json({ error: 'Nenhum item de compra encontrado para os parâmetros informados' });
    }

    let buyerUser = null;
    if (userId) {
      buyerUser = await db.prepare('SELECT id, name, email, phone FROM users WHERE id = ?').get(Number(userId));
    }

    const buffer = await PurchaseOrderExportService.exportFromPurchases(ids, buyerUser);

    const filename = `Ordem_de_Compra_${Date.now()}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    console.error('[Export OC Purchases Error]', err);
    res.status(500).json({ error: err.message });
  }
});

// Lista fila de demandas e pedidos de compra
purchasesRouter.get('/', async (req, res) => {
  try {
    const { status, priority, project_id } = req.query;
    let query = `
      SELECT p.*,
             COALESCE(m.name, p.custom_name, 'Material Fora da Base') as material_name,
             COALESCE(m.code, 'FORA-BASE') as material_code,
             COALESCE(p.custom_unit, m.unit, 'un') as material_unit,
             s.name as supplier_name, pr.name as project_name, pr.code as project_code,
             u.name as buyer_name,
             mr.id as request_id,
             mr.code as request_code,
             mr.created_at as request_created_at,
             requester.name as requester_name
      FROM purchases p
      LEFT JOIN materials m ON p.material_id = m.id
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      LEFT JOIN projects pr ON p.project_id = pr.id
      LEFT JOIN users u ON p.buyer_id = u.id
      LEFT JOIN material_request_items mri ON p.request_item_id = mri.id
      LEFT JOIN material_requests mr ON mri.request_id = mr.id
      LEFT JOIN users requester ON mr.requested_by = requester.id
      WHERE (p.is_hidden IS FALSE OR p.is_hidden IS NULL)
    `;
    const params = [];

    if (status) {
      query += ' AND p.status = ?';
      params.push(status);
    }
    if (priority) {
      query += ' AND p.priority = ?';
      params.push(priority);
    }
    if (project_id) {
      query += ' AND p.project_id = ?';
      params.push(project_id);
    }

    query += ' ORDER BY p.id DESC';

    const purchases = await db.prepare(query).all(...params);
    res.json(purchases);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Cadastra uma nova solicitação manual de compra
purchasesRouter.post('/', async (req, res) => {
  try {
    const {
      material_id,
      quantity,
      project_id,
      supplier_id,
      unit_price,
      priority,
      notes,
      buyer_id,
      expected_delivery_date,
      status
    } = req.body;

    if (!material_id || !quantity || Number(quantity) <= 0) {
      return res.status(400).json({ error: 'Material e quantidade válida (> 0) são obrigatórios.' });
    }

    const mat = await db.prepare('SELECT * FROM materials WHERE id = ?').get(material_id);
    if (!mat) return res.status(404).json({ error: 'Material não encontrado.' });

    const purchaseCode = await generateNextPurchaseCode();

    const price = (unit_price !== undefined && unit_price !== null && unit_price !== '') ? Number(unit_price) : mat.reference_price;
    const totalPrice = Number((Number(quantity) * price).toFixed(2));
    const finalSupplierId = supplier_id ? Number(supplier_id) : (mat.supplier_id || null);

    const result = await db.prepare(`
      INSERT INTO purchases (
        code, project_id, material_id, quantity, supplier_id,
        unit_price, total_price, status, priority, purchase_date,
        expected_delivery_date, buyer_id, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      purchaseCode,
      project_id ? Number(project_id) : null,
      Number(material_id),
      Number(quantity),
      finalSupplierId,
      price,
      totalPrice,
      status || 'Em cotação',
      priority || 'Média',
      new Date().toISOString().split('T')[0],
      expected_delivery_date || null,
      buyer_id || null,
      notes?.trim() || 'Solicitação manual de compra.'
    );

    const created = await db.prepare(`
      SELECT p.*, m.name as material_name, m.code as material_code, m.unit as material_unit,
             s.name as supplier_name, pr.name as project_name, pr.code as project_code,
             u.name as buyer_name
      FROM purchases p
      JOIN materials m ON p.material_id = m.id
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      LEFT JOIN projects pr ON p.project_id = pr.id
      LEFT JOIN users u ON p.buyer_id = u.id
      WHERE p.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Atualiza informações de cotação ou compra (Seção 17)
purchasesRouter.put('/:id', async (req, res) => {
  try {
    const purchaseId = req.params.id;
    const { supplier_id, unit_price, total_price, status, priority, purchase_date, expected_delivery_date, notes, buyer_id } = req.body;

    const pur = await db.prepare('SELECT * FROM purchases WHERE id = ?').get(purchaseId);
    if (!pur) return res.status(404).json({ error: 'Pedido de compra não encontrado' });

    const calcTotal = total_price || (unit_price && pur.quantity ? unit_price * pur.quantity : pur.total_price);

    await db.prepare(`
      UPDATE purchases SET
        supplier_id = ?, unit_price = ?, total_price = ?, status = ?,
        priority = ?, purchase_date = ?, expected_delivery_date = ?,
        notes = ?, buyer_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      supplier_id || pur.supplier_id,
      unit_price !== undefined ? unit_price : pur.unit_price,
      calcTotal,
      status || pur.status,
      priority || pur.priority,
      purchase_date || pur.purchase_date,
      expected_delivery_date || pur.expected_delivery_date,
      notes || pur.notes,
      buyer_id || pur.buyer_id,
      purchaseId
    );

    res.json({ success: true, purchaseId, status: status || pur.status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Confirma recebimento de material no estoque (Seção 18)
purchasesRouter.post('/:id/receive', async (req, res) => {
  try {
    const purchaseId = req.params.id;
    const { userId } = req.body;

    const result = await StockService.confirmPurchaseReceipt(purchaseId, userId || 5);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Autorização de Compra (Emily / Admins - Documento Seção "Autorização de compras: Todas as compras passar para Emily autorizar")
purchasesRouter.patch('/:id/approval', async (req, res) => {
  try {
    const purchaseId = req.params.id;
    const { approval_status, userId, rejection_notes } = req.body;

    const pur = await db.prepare('SELECT id, code, material_name FROM purchases WHERE id = ?').get(purchaseId);
    if (!pur) return res.status(404).json({ error: 'Pedido de compra não encontrado.' });

    await db.prepare(`
      UPDATE purchases 
      SET approval_status = ?,
          approved_by = ?,
          approved_at = CURRENT_TIMESTAMP,
          rejection_notes = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      approval_status,
      userId || null,
      rejection_notes || null,
      purchaseId
    );

    // Auditoria
    await db.prepare(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
      VALUES (?, 'AUTORIZAR_COMPRA', 'COMPRAS', ?, ?)
    `).run(
      userId || 1,
      purchaseId,
      `Compra ${pur.code} (${pur.material_name}) marcada como ${approval_status}`
    );

    res.json({
      success: true,
      purchaseId,
      approval_status,
      message: `Compra ${pur.code} ${approval_status === 'Aprovado' ? 'autorizada com sucesso' : 'rejeitada'}.`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Item 11 & Item 15: Upload e Extração Inteligente de PDF de Orçamento do Fornecedor
purchasesRouter.post('/parse-supplier-pdf', uploadMem.single('file'), async (req, res) => {
  try {
    let pdfText = '';
    if (req.file && req.file.buffer) {
      pdfText = await extractTextFromPdfBuffer(req.file.buffer);
    } else if (req.body?.text) {
      pdfText = req.body.text;
    } else {
      return res.status(400).json({ error: 'Nenhum arquivo PDF ou texto foi enviado.' });
    }

    if (!pdfText || !pdfText.trim()) {
      return res.status(400).json({ error: 'Não foi possível extrair texto legível do PDF enviado.' });
    }

    const parsed = SupplierPdfParser.parse(pdfText);
    res.json({
      success: true,
      extractedTextLength: pdfText.length,
      ...parsed
    });
  } catch (err) {
    console.error('[Parse Supplier PDF Error]', err);
    res.status(500).json({ error: err.message || 'Erro ao processar PDF do fornecedor' });
  }
});

// Item 11: Exportação da Ordem de Compra oficial no modelo Sabrar (.xlsx) a partir dos dados do PDF
purchasesRouter.post('/export-custom-oc', async (req, res) => {
  try {
    const {
      ocCode,
      orderCode,
      proposalNumber,
      rmNumber,
      supplierName,
      supplierCnpj,
      supplierPhone,
      supplierEmail,
      creationDate,
      deliveryDate,
      paymentTerms,
      freight,
      discount,
      projectName,
      projectAddress,
      projectCity,
      buyerName,
      buyerEmail,
      buyerPhone,
      items = []
    } = req.body;

    const workbookBuffer = await PurchaseOrderExportService.buildWorkbook({
      ocCode: ocCode || `OC-${Date.now().toString().slice(-6)}`,
      orderCode: orderCode || proposalNumber || `PED-${Date.now().toString().slice(-6)}`,
      proposalNumber: proposalNumber || `PROP-${Date.now().toString().slice(-6)}`,
      rmNumber: rmNumber || `RM-${Date.now().toString().slice(-6)}`,
      supplierName: supplierName || 'Fornecedor',
      supplierCnpj: supplierCnpj || '',
      supplierPhone: supplierPhone || '',
      supplierEmail: supplierEmail || '',
      creationDate: creationDate || new Date().toLocaleDateString('pt-BR'),
      deliveryDate: deliveryDate || '',
      paymentTerms: paymentTerms || 'FATURADO 28DD',
      freight: Number(freight) || 0,
      discount: Number(discount) || 0,
      projectName: projectName || 'Obra Sabrar',
      projectAddress: projectAddress || '',
      projectCity: projectCity || '',
      buyerName: buyerName || 'Emily Bueno',
      buyerEmail: buyerEmail || 'emily@sabrar.com.br',
      buyerPhone: buyerPhone || '(21) 97016-8717',
      items: items.map(it => ({
        code: it.code || it.material_code || 'SAB',
        name: it.name || it.material_name || it.description || 'Material',
        unit: it.unit || 'und',
        quantity: Number(it.quantity || it.qty || 1),
        price: Number(it.unitPrice || it.price || it.unit_price || 0)
      }))
    });

    const safeName = (supplierName || 'Fornecedor').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `Ordem_de_Compra_${safeName}_${Date.now()}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(workbookBuffer);
  } catch (err) {
    console.error('[Export Custom OC Error]', err);
    res.status(500).json({ error: err.message || 'Erro ao gerar Ordem de Compra em Excel' });
  }
});
