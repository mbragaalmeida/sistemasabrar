import express from 'express';
import { db } from '../db/connection.js';
import { StockService } from '../services/stockService.js';

export const materialsRouter = express.Router();

// Lista todos os materiais da Base Central com cálculo de estoque físico, reservado e disponível
materialsRouter.get('/', async (req, res) => {
  try {
    const { category, search, below_minimum } = req.query;
    let query = `
      SELECT m.*, s.name as supplier_name
      FROM materials m
      LEFT JOIN suppliers s ON m.supplier_id = s.id
      WHERE 1=1
    `;
    const params = [];

    if (category) {
      query += ' AND m.category = ?';
      params.push(category);
    }
    if (search && search.trim()) {
      const words = search.trim().split(/\s+/).filter(w => w.length > 0);
      for (const w of words) {
        query += ` AND (unaccent(m.name) ILIKE unaccent(?) OR unaccent(coalesce(m.code, '')) ILIKE unaccent(?) OR unaccent(coalesce(m.brand, '')) ILIKE unaccent(?) OR unaccent(coalesce(m.description, '')) ILIKE unaccent(?) OR unaccent(coalesce(m.synonyms, '')) ILIKE unaccent(?))`;
        params.push(`%${w}%`, `%${w}%`, `%${w}%`, `%${w}%`, `%${w}%`);
      }
    }
    if (below_minimum === 'true') {
      query += ' AND m.stock_physical <= m.stock_minimum';
    }

    query += ' ORDER BY m.id ASC';

    const materials = await db.prepare(query).all(...params);

    const enriched = materials.map(m => {
      const stock_physical = Number(m.stock_physical || 0);
      const stock_reserved = Number(m.stock_reserved || 0);
      const stock_minimum = Number(m.stock_minimum || 0);
      const stock_available = Math.max(0, stock_physical - stock_reserved);
      const isBelowMinimum = stock_physical <= stock_minimum;
      const isCritical = stock_physical === 0;

      return {
        ...m,
        reference_price: Number(m.reference_price) || 0,
        converted_price: m.converted_price != null ? Number(m.converted_price) : null,
        package_content: m.package_content != null ? Number(m.package_content) : null,
        linear_weight: m.linear_weight != null ? Number(m.linear_weight) : null,
        stock_physical,
        stock_reserved,
        stock_available,
        stock_minimum,
        isBelowMinimum,
        isCritical
      };
    });

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Lista todas as categorias existentes na Base Central
materialsRouter.get('/categories', async (req, res) => {
  try {
    const categories = await db.prepare(`
      SELECT category, COUNT(*) as count 
      FROM materials 
      WHERE status = 'Ativo'
      GROUP BY category 
      ORDER BY category ASC
    `).all();

    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Autocomplete de materiais em tempo real (para orçamentos e busca central)
materialsRouter.get('/autocomplete', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json([]);

    const STOPWORDS = new Set([
      'de', 'da', 'do', 'das', 'dos', 'para', 'pra', 'com', 'em', 'na', 'no',
      'nas', 'nos', 'a', 'o', 'as', 'os', 'e', 'ou', 'por', 'sem', 'sob', 'sobre',
      '-', '/', '\\', 'tubulacao', 'tubulação'
    ]);

    // Limpa pontuações mantendo medidas como 2.1/2 ou 4"
    const rawTokens = q
      .replace(/[()[\]{},;:]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 0);

    let words = rawTokens.filter(w => !STOPWORDS.has(w.toLowerCase()));
    if (words.length === 0) words = rawTokens;

    const runSearch = async (tokens, matchAll = true) => {
      const whereClauses = [];
      const params = [];

      for (const w of tokens) {
        whereClauses.push(`(
          unaccent(m.name) ILIKE unaccent(?) OR 
          unaccent(coalesce(m.code, '')) ILIKE unaccent(?) OR 
          unaccent(coalesce(m.synonyms, '')) ILIKE unaccent(?) OR 
          unaccent(coalesce(m.brand, '')) ILIKE unaccent(?) OR
          EXISTS (SELECT 1 FROM material_aliases ma WHERE ma.material_id = m.id AND unaccent(ma.alias_name) ILIKE unaccent(?))
        )`);
        params.push(`%${w}%`, `%${w}%`, `%${w}%`, `%${w}%`, `%${w}%`);
      }

      const connector = matchAll ? ' AND ' : ' OR ';
      const query = `
        SELECT m.id, m.code, m.name, m.category, m.unit, m.reference_price, m.synonyms, m.image_url, m.stock_physical, m.stock_reserved, m.stock_minimum
        FROM materials m
        WHERE ${whereClauses.join(connector)}
        ORDER BY 
          CASE 
            WHEN unaccent(m.name) ILIKE unaccent(?) THEN 1 
            WHEN unaccent(coalesce(m.synonyms, '')) ILIKE unaccent(?) THEN 2 
            WHEN unaccent(coalesce(m.code, '')) ILIKE unaccent(?) THEN 3 
            ELSE 4 
          END,
          m.name ASC
        LIMIT 35
      `;
      return await db.prepare(query).all(...params, `${q}%`, `${q}%`, `${q}%`);
    };

    // 1. Tenta busca estrita com termos significativos (AND)
    let materials = await runSearch(words, true);

    // 2. Se não encontrou e temos múltiplos termos, tenta busca flexível (OR)
    if (materials.length === 0 && words.length > 1) {
      materials = await runSearch(words, false);
    }

    const enriched = materials.map(m => ({
      ...m,
      reference_price: Number(m.reference_price) || 0,
      stock_physical: Number(m.stock_physical || 0),
      stock_reserved: Number(m.stock_reserved || 0),
      stock_minimum: Number(m.stock_minimum || 0),
      stock_available: Math.max(0, Number(m.stock_physical || 0) - Number(m.stock_reserved || 0))
    }));

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Detalhe de um material específico
materialsRouter.get('/:id', async (req, res) => {
  try {
    const mat = await StockService.getMaterialStock(req.params.id);
    const movements = await db.prepare(`
      SELECT sm.*, u.name as user_name, p.name as project_name, p.code as project_code
      FROM stock_movements sm
      LEFT JOIN users u ON sm.user_id = u.id
      LEFT JOIN projects p ON sm.project_id = p.id
      WHERE sm.material_id = ?
      ORDER BY sm.id DESC
      LIMIT 20
    `).all(req.params.id);

    res.json({ ...mat, movements });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Cadastra novo material na Base Central (Seção 11)
materialsRouter.post('/', async (req, res) => {
  try {
    const userRole = req.headers['x-user-role'];
    if (userRole === 'compras') {
      return res.status(403).json({
        error: 'Seu perfil permite apenas dar entrada em materiais já cadastrados, não sendo permitido cadastrar um novo produto.'
      });
    }

    const { 
      name, description, category, unit, brand, reference_price, supplier_id, 
      stock_physical, stock_minimum, status, userId,
      synonyms, image_url, linear_weight, linear_weight_unit, package_content, converted_unit, converted_price, validation_status, pending_notes
    } = req.body;

    if (!name || !category || !unit) {
      return res.status(400).json({ error: 'Nome, categoria e unidade de medida são obrigatórios' });
    }

    // Código automático: MAT-000XXX (Seção 11 e 12)
    const count = ((await db.prepare('SELECT COUNT(*) as count FROM materials').get())?.count || 0) + 1;
    const code = `MAT-${String(100 + count).padStart(6, '0')}`;

    const insert = db.prepare(`
      INSERT INTO materials (
        code, name, description, category, unit, brand,
        reference_price, supplier_id, stock_physical, stock_reserved,
        stock_minimum, status, synonyms, image_url, linear_weight, linear_weight_unit,
        package_content, converted_unit, converted_price, validation_status, pending_notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = await insert.run(
      code, name, description || null, category, unit, brand || null,
      Number(reference_price) || 0, supplier_id || null,
      Number(stock_physical) || 0, Number(stock_minimum) || 10,
      status || 'Ativo',
      synonyms || null, image_url || null, linear_weight || null, linear_weight_unit || null,
      package_content || null, converted_unit || null, converted_price || null,
      validation_status || 'OK', pending_notes || null
    );

    const materialId = result.lastInsertRowid;

    // Se começou com estoque físico > 0, registra movimentação inicial
    if (Number(stock_physical) > 0) {
      await db.prepare(`
        INSERT INTO stock_movements (material_id, type, quantity, previous_stock, new_stock, user_id, notes)
        VALUES (?, 'ENTRADA', ?, 0, ?, ?, 'Saldo inicial no cadastro do material')
      `).run(materialId, Number(stock_physical), Number(stock_physical), userId || 1);
    }

    // Auditoria
    await db.prepare(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
      VALUES (?, 'CRIAR_MATERIAL', 'ESTOQUE', ?, ?)
    `).run(userId || 1, materialId, `Material cadastrado: ${name} (${code}) na categoria ${category}`);

    res.status(201).json({ id: materialId, code, name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Atualiza material
materialsRouter.put('/:id', async (req, res) => {
  try {
    const { 
      name, description, category, unit, brand, reference_price, supplier_id, 
      stock_minimum, status, userId,
      synonyms, image_url, linear_weight, linear_weight_unit, package_content, converted_unit, converted_price, validation_status, pending_notes
    } = req.body;
    const materialId = req.params.id;

    await db.prepare(`
      UPDATE materials SET
        name = ?, description = ?, category = ?, unit = ?, brand = ?,
        reference_price = ?, supplier_id = ?, stock_minimum = ?,
        status = ?, synonyms = ?, image_url = COALESCE(?, image_url), linear_weight = ?, linear_weight_unit = ?,
        package_content = ?, converted_unit = ?, converted_price = ?,
        validation_status = ?, pending_notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      name, description, category, unit, brand,
      Number(reference_price), supplier_id, Number(stock_minimum),
      status, synonyms || null, image_url || null, linear_weight || null, linear_weight_unit || null,
      package_content || null, converted_unit || null, converted_price || null,
      validation_status || 'OK', pending_notes || null, materialId
    );

    res.json({ success: true, materialId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Atualiza foto do material diretamente
materialsRouter.patch('/:id/image', async (req, res) => {
  try {
    const { image_url } = req.body;
    const materialId = req.params.id;

    await db.prepare(`
      UPDATE materials SET image_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(image_url, materialId);

    res.json({ success: true, materialId, image_url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Entrada simplificada de estoque (Seção 12: Selecionar material -> Informar quantidade -> Confirmar)
materialsRouter.post('/quick-entry', async (req, res) => {
  try {
    const { materialId, quantity, notes, userId } = req.body;
    const result = await StockService.recordSimplifiedEntry(materialId, quantity, userId || 1, notes);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Lista todos os aliases mapeados entre planilhas e base de materiais
materialsRouter.get('/aliases', async (req, res) => {
  try {
    const aliases = await db.prepare(`
      SELECT ma.*, m.name as material_name, m.code as material_code
      FROM material_aliases ma
      JOIN materials m ON ma.material_id = m.id
      ORDER BY ma.alias_name ASC
    `).all();
    res.json(aliases);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Salva vínculos (aliases) de materiais identificados em planilhas para reaproveitamento permanente
materialsRouter.post('/aliases', async (req, res) => {
  try {
    const { mappings } = req.body;
    // mappings pode ser um array [{ alias, materialId }] ou um único objeto { alias, materialId }
    const list = Array.isArray(mappings) ? mappings : (req.body.alias && req.body.materialId ? [req.body] : []);

    if (list.length === 0) {
      return res.status(400).json({ error: 'Nenhum mapeamento de vínculo fornecido' });
    }

    const saved = [];
    for (const item of list) {
      const aliasName = String(item.alias || item.alias_name || '').trim();
      const materialId = Number(item.materialId || item.material_id);
      if (!aliasName || !materialId || isNaN(materialId)) continue;

      // 1. Grava na tabela material_aliases
      await db.prepare(`
        INSERT INTO material_aliases (alias_name, material_id)
        VALUES (?, ?)
        ON CONFLICT (alias_name) DO UPDATE SET material_id = EXCLUDED.material_id
      `).run(aliasName.toLowerCase(), materialId);

      // 2. Atualiza a coluna synonyms do material correspondente para retroalimentar o autocomplete
      const mat = await db.prepare('SELECT id, synonyms FROM materials WHERE id = ?').get(materialId);
      if (mat) {
        const curSyns = mat.synonyms || '';
        const normAlias = aliasName.toLowerCase();
        const existingTokens = curSyns.split(/[,;\n/]+/).map(s => s.trim().toLowerCase());
        if (!existingTokens.includes(normAlias)) {
          const updatedSyns = curSyns ? `${curSyns}, ${aliasName}` : aliasName;
          await db.prepare('UPDATE materials SET synonyms = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(updatedSyns, materialId);
        }
      }

      saved.push({ alias: aliasName, materialId });
    }

    res.json({ success: true, savedCount: saved.length, saved });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Atualiza o status manual de disponibilidade (Disponível ou Em Falta - Item 10)
materialsRouter.patch('/:id/availability', async (req, res) => {
  try {
    const { id } = req.params;
    const { availability_status } = req.body;

    if (!['disponivel', 'em_falta'].includes(availability_status)) {
      return res.status(400).json({ error: "Status inválido. Use 'disponivel' ou 'em_falta'." });
    }

    const mat = await db.prepare('SELECT id, name FROM materials WHERE id = ?').get(id);
    if (!mat) return res.status(404).json({ error: 'Material não encontrado.' });

    await db.prepare('UPDATE materials SET availability_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(availability_status, id);

    res.json({
      success: true,
      material_id: Number(id),
      availability_status,
      message: `Status de disponibilidade de "${mat.name}" atualizado para ${availability_status === 'disponivel' ? 'Disponível' : 'Em Falta'}.`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Configura estoque mínimo do material (Item 5 - Admins, Sabrina e Emily)
materialsRouter.patch('/:id/minimum-stock', async (req, res) => {
  try {
    const { id } = req.params;
    const { stock_minimum, userId } = req.body;

    const minVal = Math.max(0, Number(stock_minimum) || 0);

    const mat = await db.prepare('SELECT id, name, code, stock_physical, stock_minimum FROM materials WHERE id = ?').get(id);
    if (!mat) return res.status(404).json({ error: 'Material não encontrado.' });

    await db.prepare('UPDATE materials SET stock_minimum = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(minVal, id);

    // Auditoria
    await db.prepare(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_value, new_value, details)
      VALUES (?, 'CONFIGURAR_ESTOQUE_MINIMO', 'MATERIAL', ?, ?, ?, ?)
    `).run(
      userId || 1, id,
      `Mínimo anterior: ${mat.stock_minimum || 0}`,
      `Novo mínimo: ${minVal}`,
      `Estoque mínimo atualizado para ${minVal} no material ${mat.name} (${mat.code})`
    );

    // Se estoque físico atual estiver igual ou abaixo do estoque mínimo definido, notifica setor de compras!
    if (minVal > 0 && Number(mat.stock_physical || 0) <= minVal) {
      await db.prepare(`
        INSERT INTO notifications (role_target, title, message, type, link)
        VALUES ('compras', 'Alerta: Estoque Mínimo Atingido', ?, 'urgent', '/materiais')
      `).run(`O material "${mat.name}" atingiu o estoque mínimo: saldo atual de ${mat.stock_physical || 0} (Mínimo: ${minVal}). Providenciar reposição/compras.`);
    }

    res.json({
      success: true,
      material_id: Number(id),
      stock_minimum: minVal,
      message: `Estoque mínimo de "${mat.name}" configurado para ${minVal}.`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


