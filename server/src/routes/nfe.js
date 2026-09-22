import express from 'express';
import multer from 'multer';
import { db } from '../db/connection.js';
import { parseNfeXml } from '../utils/nfeParser.js';
import { convertMaterialUnits, normalizeUnit } from '../utils/unitConversion.js';

export const nfeRouter = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

/**
 * Auxiliar para categorizar materiais com base na descrição técnica
 */
function inferCategory(name = '') {
  const n = name.toUpperCase();
  if (n.includes('COBRE') || n.includes('VRF') || n.includes('SPLIT') || n.includes('CHILLER') || n.includes('DUTO') || n.includes('AR CONDICIONADO') || n.includes('REFRIGER') || n.includes('ARMAFLEX') || n.includes('DIFUSOR') || n.includes('GRELHA')) {
    return 'Climatização / HVAC';
  }
  if (n.includes('CABO') || n.includes('FIO') || n.includes('DISJUNTOR') || n.includes('QUADRO') || n.includes('ELETRODUTO') || n.includes('LAMPADA') || n.includes('LED') || n.includes('TOMADA')) {
    return 'Elétrica';
  }
  if (n.includes('TUBO') || n.includes('PVC') || n.includes('REGISTRO') || n.includes('VALVULA') || n.includes('SIFAO') || n.includes('ESGOTO') || n.includes('AGUA')) {
    return 'Hidráulica';
  }
  if (n.includes('CIMENTO') || n.includes('ARGAMASSA') || n.includes('AREIA') || n.includes('TIJOLO') || n.includes('BLOCO')) {
    return 'Civil';
  }
  if (n.includes('CHAPA') || n.includes('PERFIL') || n.includes('DRYWALL') || n.includes('GESSO')) {
    return 'Drywall & Chapas';
  }
  if (n.includes('TINTA') || n.includes('MASSA') || n.includes('SELADOR') || n.includes('VERNIZ')) {
    return 'Pintura';
  }
  return 'Geral';
}

/**
 * POST /api/nfe/preview
 * Recebe o XML da NF-e e gera a prévia de correspondência com o banco e conversão de unidades
 */
nfeRouter.post('/preview', upload.single('xmlFile'), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: 'Nenhum arquivo XML enviado.' });
    }

    const xmlText = req.file.buffer.toString('utf-8');
    const parsedNfe = parseNfeXml(xmlText);

    if (!parsedNfe.items || parsedNfe.items.length === 0) {
      return res.status(400).json({ error: 'Nenhum produto ou material identificado no XML da NF-e.' });
    }

    // Busca todos os materiais existentes para tentar matching
    const existingMaterials = await db.prepare('SELECT * FROM materials').all();

    const previewItems = parsedNfe.items.map(item => {
      const cleanItemName = item.name.trim();

      // Tenta localizar material existente por código idêntico ou busca por palavras-chave
      let matchedMaterial = existingMaterials.find(m =>
        m.code.toUpperCase() === item.code.toUpperCase() ||
        m.name.toLowerCase() === cleanItemName.toLowerCase()
      );

      if (!matchedMaterial) {
        // Tenta encontrar por similaridade parcial
        const words = cleanItemName.toLowerCase().split(/\s+/).filter(w => w.length > 3);
        if (words.length > 0) {
          matchedMaterial = existingMaterials.find(m => {
            const mName = m.name.toLowerCase();
            const matches = words.filter(w => mName.includes(w));
            return matches.length >= 2;
          });
        }
      }

      const targetUnit = matchedMaterial ? matchedMaterial.unit : item.unit;
      const conversion = convertMaterialUnits(cleanItemName, item.unit, targetUnit, item.quantity, item.unitPrice);

      return {
        itemNumber: item.itemNumber,
        xmlCode: item.code,
        xmlName: cleanItemName,
        xmlUnit: item.unit,
        xmlQuantity: item.quantity,
        xmlUnitPrice: item.unitPrice,
        xmlTotalPrice: item.totalPrice,
        matchedMaterialId: matchedMaterial ? matchedMaterial.id : null,
        matchedMaterialCode: matchedMaterial ? matchedMaterial.code : null,
        matchedMaterialName: matchedMaterial ? matchedMaterial.name : cleanItemName,
        currentBasePrice: matchedMaterial ? matchedMaterial.reference_price : 0,
        currentPhysicalStock: matchedMaterial ? matchedMaterial.stock_physical : 0,
        targetUnit,
        convertedQuantity: conversion.convertedQuantity,
        convertedUnitPrice: conversion.convertedUnitPrice,
        isConverted: conversion.isConverted,
        conversionExplanation: conversion.explanation,
        inferredCategory: inferCategory(cleanItemName),
        action: matchedMaterial ? 'UPDATE_PRICE_AND_STOCK' : 'CREATE_NEW_MATERIAL'
      };
    });

    res.json({
      invoiceNumber: parsedNfe.invoiceNumber,
      serie: parsedNfe.serie,
      key: parsedNfe.key,
      emissionDate: parsedNfe.emissionDate,
      totalValue: parsedNfe.totalValue,
      supplier: parsedNfe.supplier,
      items: previewItems
    });
  } catch (err) {
    console.error('[NF-e Preview Error]', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/nfe/confirm
 * Confirma a importação da NF-e, atualizando automaticamente os preços de referência da base
 * para os orçamentos e incrementando o estoque físico.
 */
nfeRouter.post('/confirm', async (req, res) => {
  try {
    const { supplier, invoiceNumber, items, userId } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Nenhum item informado para confirmação.' });
    }

    // 1. Cria ou Atualiza Fornecedor
    let supplierId = null;
    if (supplier && (supplier.cnpj || supplier.name)) {
      const cleanCnpj = supplier.cnpj ? supplier.cnpj.trim() : null;
      let existingSupplier = null;

      if (cleanCnpj) {
        existingSupplier = await db.prepare('SELECT id FROM suppliers WHERE cnpj = ?').get(cleanCnpj);
      }
      if (!existingSupplier && supplier.name) {
        existingSupplier = await db.prepare('SELECT id FROM suppliers WHERE name = ?').get(supplier.name.trim());
      }

      if (existingSupplier) {
        supplierId = existingSupplier.id;
        await db.prepare(`
          UPDATE suppliers SET
            corporate_name = COALESCE(?, corporate_name),
            phone = COALESCE(?, phone),
            email = COALESCE(?, email)
          WHERE id = ?
        `).run(supplier.corporate_name || null, supplier.phone || null, supplier.email || null, supplierId);
      } else {
        const insertSup = db.prepare(`
          INSERT INTO suppliers (name, corporate_name, cnpj, contact_person, phone, email, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        const supRes = await insertSup.run(
          supplier.name.trim(),
          supplier.corporate_name || supplier.name.trim(),
          cleanCnpj || '',
          supplier.contact_person || '',
          supplier.phone || '',
          supplier.email || '',
          `Cadastrado automaticamente via NF-e ${invoiceNumber}`
        );
        supplierId = supRes.lastInsertRowid;
      }
    }

    let updatedCount = 0;
    let createdCount = 0;
    const movementsRecorded = [];

    // 2. Itera sobre cada item confirmado
    for (const item of items) {
      let materialId = item.matchedMaterialId;
      let previousStock = 0;
      let currentPrice = 0;

      if (materialId) {
        const currentMat = await db.prepare('SELECT * FROM materials WHERE id = ?').get(materialId);
        if (currentMat) {
          previousStock = currentMat.stock_physical;
          currentPrice = currentMat.reference_price;

          const newStock = previousStock + Number(item.convertedQuantity);
          // Atualiza o PREÇO DE REFERÊNCIA da base pelo valor da última compra na NF-e!
          const newPrice = Number(item.convertedUnitPrice) > 0 ? Number(item.convertedUnitPrice) : currentPrice;

          await db.prepare(`
            UPDATE materials SET
              reference_price = ?,
              stock_physical = ?,
              supplier_id = COALESCE(?, supplier_id),
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(newPrice, newStock, supplierId, materialId);

          // Registra movimentação de estoque
          const moveRes = await db.prepare(`
            INSERT INTO stock_movements (material_id, type, quantity, previous_stock, new_stock, user_id, notes)
            VALUES (?, 'ENTRADA', ?, ?, ?, ?, ?)
          `).run(
            materialId,
            Number(item.convertedQuantity),
            previousStock,
            newStock,
            userId || 1,
            `Entrada via NF-e nº ${invoiceNumber} (${supplier?.name || 'Fornecedor'}) - Preço atualizado: R$ ${newPrice.toFixed(2)}/${item.targetUnit}`
          );

          movementsRecorded.push(moveRes.lastInsertRowid);
          updatedCount++;
        }
      } else {
        // Cria novo material na base
        const maxId = (await db.prepare('SELECT MAX(id) as maxId FROM materials').get())?.maxId || 0;
        const newCode = `MAT-${String(maxId + 1).padStart(6, '0')}`;
        const newPrice = Number(item.convertedUnitPrice) || Number(item.xmlUnitPrice) || 0;
        const newStock = Number(item.convertedQuantity) || Number(item.xmlQuantity) || 0;

        const insertMat = db.prepare(`
          INSERT INTO materials (code, name, description, category, unit, reference_price, supplier_id, stock_physical, stock_reserved, stock_minimum, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 5, 'Ativo')
        `);

        const matRes = await insertMat.run(
          newCode,
          item.xmlName.trim(),
          `Importado via NF-e nº ${invoiceNumber}. NCM: ${item.ncm || 'S/N'}`,
          item.inferredCategory || 'Geral',
          item.targetUnit || item.xmlUnit || 'UN',
          newPrice,
          supplierId,
          newStock
        );

        materialId = matRes.lastInsertRowid;

        // Registra movimentação de entrada
        await db.prepare(`
          INSERT INTO stock_movements (material_id, type, quantity, previous_stock, new_stock, user_id, notes)
          VALUES (?, 'ENTRADA', ?, 0, ?, ?, ?)
        `).run(
          materialId,
          newStock,
          newStock,
          userId || 1,
          `Entrada inicial de novo cadastro via NF-e nº ${invoiceNumber} (${supplier?.name || 'Fornecedor'})`
        );

        createdCount++;
      }
    }

    // Notificação Interna de Sucesso
    await db.prepare(`
      INSERT INTO notifications (user_id, role_target, title, message, type, link)
      VALUES (?, 'Almoxarifado', 'NF-e Importada com Sucesso', ?, 'success', '/materiais')
    `).run(
      userId || 1,
      `NF-e ${invoiceNumber} processada: ${updatedCount} materiais atualizados com os novos preços e ${createdCount} novos cadastrados.`
    );

    // Auditoria
    await db.prepare(`
      INSERT INTO audit_logs (user_id, user_name, action, entity_type, details)
      VALUES (?, 'Sistema / NF-e', 'IMPORTACAO_NFE_PRECOS', 'ESTOQUE', ?)
    `).run(
      userId || 1,
      `NF-e ${invoiceNumber} confirmada: ${updatedCount} materiais atualizados com preços reais da última compra, ${createdCount} novos criados.`
    );

    res.json({
      success: true,
      message: `NF-e ${invoiceNumber} importada com sucesso!`,
      updatedCount,
      createdCount,
      supplierId,
      totalItemsProcessed: items.length
    });
  } catch (err) {
    console.error('[NF-e Confirm Error]', err);
    res.status(500).json({ error: err.message });
  }
});
