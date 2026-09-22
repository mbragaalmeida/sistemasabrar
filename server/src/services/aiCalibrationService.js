import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');
const { PDFParse } = require('pdf-parse');

import { db } from '../db/connection.js';

export class AICalibrationService {

  /**
   * Extrai texto limpo de um arquivo PDF
   */
  static async extractTextFromPdf(filePath) {
    try {
      const buffer = fs.readFileSync(filePath);
      const parser = new PDFParse(new Uint8Array(buffer));
      const result = await parser.getText();
      return (result && result.text) ? result.text : '';
    } catch (err) {
      console.warn(`[AICalibrationService] Erro ao ler PDF ${filePath}:`, err.message);
      return '';
    }
  }

  /**
   * Extrai linhas estruturadas de uma planilha XLSX/XLS/CSV
   */
  static extractSheetsFromSpreadsheet(filePath) {
    try {
      const wb = XLSX.readFile(filePath);
      const sheets = {};
      for (const sheetName of wb.SheetNames) {
        const ws = wb.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        sheets[sheetName] = data;
      }
      return sheets;
    } catch (err) {
      console.warn(`[AICalibrationService] Erro ao ler planilha ${filePath}:`, err.message);
      return {};
    }
  }

  /**
   * Identifica nome e código do projeto a partir do nome do arquivo ou conteúdo textual
   */
  static detectProjectMetadata(filename, textContent = '') {
    let cleanName = path.parse(filename).name
      .replace(/^(bulk|relatorio|levantamento|consumo|orcamento|projeto|planta|memorial)[-_]/i, '')
      .replace(/[-_]/g, ' ')
      .trim();

    // Procura código padrão PRJ-YYYY-XXX
    const codeMatch = (filename + ' ' + textContent).match(/PRJ[-_]?(\d{4})[-_]?(\d{3,4})/i);
    const projectCode = codeMatch ? `PRJ-${codeMatch[1]}-${codeMatch[2]}` : null;

    // Procura pistas de projeto no texto
    const nameMatch = textContent.match(/(?:obra|projeto|empreendimento|cliente)[:\s]+([^\n\r,;]{4,60})/i);
    if (nameMatch && nameMatch[1]) {
      cleanName = nameMatch[1].trim();
    }

    // Identifica tipologia
    let projectType = 'Comercial';
    const lower = (filename + ' ' + textContent).toLowerCase();
    if (lower.includes('hospital') || lower.includes('clinica') || lower.includes('saude')) projectType = 'Hospitalar';
    else if (lower.includes('fabrica') || lower.includes('industr') || lower.includes('farmaceut') || lower.includes('galpao')) projectType = 'Industrial';
    else if (lower.includes('residen') || lower.includes('predio') || lower.includes('apartamento')) projectType = 'Residencial';
    else if (lower.includes('shopping') || lower.includes('loja') || lower.includes('varejo')) projectType = 'Comercial';

    // Identifica área em m²
    const areaMatch = textContent.match(/(\d+(?:[.,]\d+)?)\s*(?:m²|m2|metros quadrados)/i);
    const area = areaMatch ? parseFloat(areaMatch[1].replace(',', '.')) : 1000;

    return {
      code: projectCode || `PRJ-CALIB-${Date.now().toString().slice(-4)}`,
      name: cleanName || 'Projeto Calibração SABRAR',
      type: projectType,
      area
    };
  }

  /**
   * Normaliza nome de material para agrupamento e correspondência
   */
  static normalizeMaterialName(name) {
    return (name || '')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9/.\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Processa conjunto de arquivos de projeto e calibração
   * @param {Array<{ path: string, originalname: string, mimetype: string }>} files
   * @param {number} userId
   */
  static async processCalibrationFiles(files, userId = 1) {
    if (!files || files.length === 0) {
      throw new Error('Nenhum arquivo enviado para calibração.');
    }

    const projectsMap = new Map(); // key: projectCode or normalizedName -> { meta, textDocs: [], materials: Map }

    for (const f of files) {
      const ext = path.extname(f.originalname).toLowerCase();
      let fileText = '';

      if (ext === '.pdf') {
        fileText = await this.extractTextFromPdf(f.path);
      } else if (['.xlsx', '.xls', '.csv'].includes(ext)) {
        const sheets = this.extractSheetsFromSpreadsheet(f.path);
        fileText = Object.entries(sheets)
          .map(([name, rows]) => `[Aba: ${name}]\n` + rows.map(r => r.join(' | ')).join('\n'))
          .join('\n\n');
      } else {
        try {
          fileText = fs.readFileSync(f.path, 'utf8');
        } catch {}
      }

      const meta = this.detectProjectMetadata(f.originalname, fileText);
      const projectKey = meta.code.startsWith('PRJ-CALIB-') ? this.normalizeMaterialName(meta.name) : meta.code;

      if (!projectsMap.has(projectKey)) {
        projectsMap.set(projectKey, {
          meta,
          files: [],
          textDocs: [],
          materialsMap: new Map() // normName -> { name, code, category, unit, qty_budgeted, qty_real, price }
        });
      }

      const group = projectsMap.get(projectKey);
      group.files.push(f);
      if (fileText) {
        group.textDocs.push({ name: f.originalname, text: fileText.slice(0, 50000) });
      }

      // Se for planilha, extrai tabelas de orçado vs realizado
      if (['.xlsx', '.xls', '.csv'].includes(ext)) {
        const sheets = this.extractSheetsFromSpreadsheet(f.path);
        this.parseSpreadsheetDataIntoGroup(sheets, group);
      } else if (ext === '.pdf') {
        // Tenta extrair tabelas ou linhas de materiais do PDF
        this.parsePdfMaterialsIntoGroup(fileText, group);
      }
    }

    // Agora processa e salva no banco de dados SQLite da SABRAR
    const results = [];
    let totalProjectsCalibrated = 0;
    let totalHistoricalRecordsAdded = 0;

    for (const [key, group] of projectsMap.entries()) {
      const meta = group.meta;

      // 1. Verifica ou cria projeto no banco
      let project = db.prepare('SELECT * FROM projects WHERE code = ? OR name = ?').get(meta.code, meta.name);
      if (!project) {
        const insertPrj = db.prepare(`
          INSERT INTO projects (
            code, name, client, address, project_type, status, notes,
            responsible_engineer, total_budget_materials, total_budget_final
          ) VALUES (?, ?, ?, ?, ?, 'Finalizado', ?, 'IA Calibração SABRAR', 0, 0)
        `);
        const info = insertPrj.run(
          meta.code,
          meta.name,
          'Cliente SABRAR (Histórico)',
          'Sede do Empreendimento',
          meta.type,
          `Projeto e medições importadas para calibração contínua da IA a partir de ${group.files.length} documento(s).`
        );
        project = db.prepare('SELECT * FROM projects WHERE id = ?').get(info.lastInsertRowid);
      }

      // 2. Registra os arquivos vinculados ao projeto
      for (const f of group.files) {
        db.prepare(`
          INSERT INTO project_files (project_id, type, original_name, file_path, file_size, mime_type, content_summary, uploaded_by)
          VALUES (?, 'PROJETO_TECNICO', ?, ?, ?, ?, ?, ?)
        `).run(
          project.id,
          f.originalname,
          `/uploads/${path.basename(f.path)}`,
          f.size || 1024,
          f.mimetype || 'application/octet-stream',
          `Documento técnico para calibração: ${f.originalname}`,
          userId
        );
      }

      // 3. Processa e calibra materiais
      const calibratedItems = [];
      const matEntries = Array.from(group.materialsMap.values());

      for (const item of matEntries) {
        // Se temos apenas um dos valores, calibra com desvio padrão de segurança de obra (+3% a +8%)
        let budgeted = Number(item.qty_budgeted) || 0;
        let real = Number(item.qty_real) || 0;

        if (budgeted > 0 && real === 0) {
          // Documento de projeto/orçamento sem real explícito: infere real com base nas perdas típicas de HVAC (+4%)
          real = Math.round(budgeted * 1.04);
        } else if (real > 0 && budgeted === 0) {
          budgeted = Math.round(real / 1.04);
        }

        if (budgeted <= 0 && real <= 0) continue;

        // Procura ou insere material na Base Central SABRAR (materials)
        const normName = this.normalizeMaterialName(item.name);
        let material = db.prepare('SELECT * FROM materials WHERE LOWER(name) = ?').get(item.name.toLowerCase());
        if (!material) {
          const autoCode = item.code || `MAT-CALIB-${Date.now().toString().slice(-5)}-${Math.floor(Math.random()*100)}`;
          const insertMat = db.prepare(`
            INSERT INTO materials (
              code, name, category, unit, reference_price, status
            ) VALUES (?, ?, ?, ?, ?, 'Ativo')
          `);
          const matRes = insertMat.run(
            autoCode,
            item.name,
            item.category || 'Climatização',
            item.unit || 'un',
            item.price || 100.00
          );
          material = db.prepare('SELECT * FROM materials WHERE id = ?').get(matRes.lastInsertRowid);
        }

        // Calcula métricas de variação
        const varianceUnits = real - budgeted;
        const variancePercent = budgeted > 0 ? Number(((varianceUnits / budgeted) * 100).toFixed(1)) : 0;
        const learnedFactor = budgeted > 0 ? Number((real / budgeted).toFixed(3)) : 1.0;

        // Registra ou atualiza em historical_usage
        const existingHist = db.prepare(`
          SELECT id FROM historical_usage WHERE project_id = ? AND material_id = ?
        `).get(project.id, material.id);

        if (existingHist) {
          db.prepare(`
            UPDATE historical_usage SET
              ai_suggested_qty = ?,
              human_approved_qty = ?,
              actual_consumed_qty = ?,
              variance_units = ?,
              variance_percent = ?,
              learned_adjustment_factor = ?,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(
            budgeted, budgeted, real, varianceUnits, variancePercent, learnedFactor, existingHist.id
          );
        } else {
          db.prepare(`
            INSERT INTO historical_usage (
              project_id, material_id, project_type, project_size_sqm,
              ai_suggested_qty, human_approved_qty, total_requested_qty,
              total_withdrawn_qty, total_returned_qty, actual_consumed_qty,
              variance_units, variance_percent, learned_adjustment_factor, is_immutable
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
          `).run(
            project.id, material.id, project.project_type, meta.area,
            budgeted, budgeted, real, real, 0, real,
            varianceUnits, variancePercent, learnedFactor
          );
          totalHistoricalRecordsAdded++;
        }

        calibratedItems.push({
          materialId: material.id,
          materialCode: material.code,
          materialName: material.name,
          category: material.category,
          unit: material.unit,
          budgetedQty: budgeted,
          realQty: real,
          variancePercent,
          learnedFactor
        });
      }

      totalProjectsCalibrated++;
      results.push({
        projectId: project.id,
        projectCode: project.code,
        projectName: project.name,
        projectType: project.project_type,
        filesCount: group.files.length,
        itemsCalibratedCount: calibratedItems.length,
        items: calibratedItems
      });

      // Auditoria
      db.prepare(`
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, project_id, details)
        VALUES (?, 'CALIBRAR_IA_DOCUMENTOS', 'HISTORICO_IA', ?, ?, ?)
      `).run(
        userId,
        project.id,
        project.id,
        `IA calibrada com sucesso para a obra ${project.name} (${project.code}) com ${calibratedItems.length} materiais analisados a partir de ${group.files.length} documento(s).`
      );
    }

    return {
      success: true,
      message: `Calibração concluída! ${totalProjectsCalibrated} obra(s) processada(s) e ${totalHistoricalRecordsAdded} novos registros históricos alimentaram a IA.`,
      projectsCalibratedCount: totalProjectsCalibrated,
      recordsAddedCount: totalHistoricalRecordsAdded,
      projects: results
    };
  }

  /**
   * Parser inteligente de dados de planilhas para o grupo do projeto
   */
  static parseSpreadsheetDataIntoGroup(sheets, group) {
    for (const [sheetName, rows] of Object.entries(sheets)) {
      if (!Array.isArray(rows) || rows.length < 2) continue;

      // Detecta índices de colunas procurando palavras-chave
      let colName = -1;
      let colCode = -1;
      let colUnit = -1;
      let colPrevisto = -1;
      let colReal = -1;
      let colCategory = -1;
      let colPrice = -1;
      let headerRowIndex = -1;

      for (let r = 0; r < Math.min(15, rows.length); r++) {
        const row = rows[r];
        if (!Array.isArray(row)) continue;

        row.forEach((cell, idx) => {
          const str = String(cell).toLowerCase().trim();
          if (str.includes('descri') || str.includes('material') || str.includes('item') || str.includes('produto')) {
            if (colName === -1) colName = idx;
          }
          if (str.includes('cod') || str.includes('código')) {
            if (colCode === -1) colCode = idx;
          }
          if (str === 'un' || str === 'und' || str.includes('unidade')) {
            if (colUnit === -1) colUnit = idx;
          }
          if (str.includes('previsto') || str.includes('orçado') || str.includes('orcado') || str.includes('qtde_prevista') || str.includes('qtd_prevista')) {
            if (colPrevisto === -1) colPrevisto = idx;
          }
          if (str.includes('real') || str.includes('consum') || str.includes('utilizad') || str.includes('saida') || str.includes('efetiv')) {
            if (colReal === -1) colReal = idx;
          }
          if (str.includes('categoria') || str.includes('disciplina') || str.includes('sistema')) {
            if (colCategory === -1) colCategory = idx;
          }
          if (str.includes('preco') || str.includes('preço') || str.includes('custo') || str.includes('unit')) {
            if (colPrice === -1) colPrice = idx;
          }
        });

        if (colName !== -1 && (colPrevisto !== -1 || colReal !== -1)) {
          headerRowIndex = r;
          break;
        }
      }

      // Se encontrou cabeçalho, processa linhas de dados
      if (headerRowIndex !== -1 && colName !== -1) {
        for (let r = headerRowIndex + 1; r < rows.length; r++) {
          const row = rows[r];
          if (!row || !row[colName]) continue;

          const rawName = String(row[colName]).trim();
          if (rawName.length < 3) continue;

          const norm = this.normalizeMaterialName(rawName);
          const qtyPrev = colPrevisto !== -1 ? parseFloat(String(row[colPrevisto]).replace(',', '.')) : 0;
          const qtyReal = colReal !== -1 ? parseFloat(String(row[colReal]).replace(',', '.')) : 0;
          const unit = colUnit !== -1 && row[colUnit] ? String(row[colUnit]).trim() : 'un';
          const code = colCode !== -1 && row[colCode] ? String(row[colCode]).trim() : null;
          const cat = colCategory !== -1 && row[colCategory] ? String(row[colCategory]).trim() : 'Climatização';
          const price = colPrice !== -1 && row[colPrice] ? parseFloat(String(row[colPrice]).replace(/[^\d.,]/g, '').replace(',', '.')) : 0;

          if (!group.materialsMap.has(norm)) {
            group.materialsMap.set(norm, {
              name: rawName,
              code,
              unit,
              category: cat,
              qty_budgeted: !isNaN(qtyPrev) ? qtyPrev : 0,
              qty_real: !isNaN(qtyReal) ? qtyReal : 0,
              price: !isNaN(price) ? price : 0
            });
          } else {
            const existing = group.materialsMap.get(norm);
            if (!isNaN(qtyPrev) && qtyPrev > 0) existing.qty_budgeted = qtyPrev;
            if (!isNaN(qtyReal) && qtyReal > 0) existing.qty_real = qtyReal;
            if (!isNaN(price) && price > 0) existing.price = price;
          }
        }
      }
    }
  }

  /**
   * Extrai dados de materiais a partir do texto de documentos técnicos / memoriais em PDF
   */
  static parsePdfMaterialsIntoGroup(text, group) {
    if (!text) return;

    // Procura padrões de lista de materiais em memorial ou quadro técnico:
    // Exemplo: "Duto MPU ... 450 m2" ou "Tubo de cobre 1.1/8 ... 120 m" ou "Difusores 600x600 ... 24 un"
    const lines = text.split(/\r?\n/);
    const materialPattern = /([A-Za-zÀ-ÿ0-9\s/.\-"]{5,60})\s+(\d+(?:[.,]\d+)?)\s*(m²|m2|m|un|pç|kg|barras?|rolos?)/i;

    for (const line of lines) {
      const match = line.match(materialPattern);
      if (match) {
        const rawName = match[1].trim();
        const qty = parseFloat(match[2].replace(',', '.'));
        const unit = match[3].toLowerCase();

        if (rawName.length >= 4 && !isNaN(qty) && qty > 0) {
          const norm = this.normalizeMaterialName(rawName);
          if (!group.materialsMap.has(norm)) {
            group.materialsMap.set(norm, {
              name: rawName,
              code: null,
              unit: unit === 'm2' ? 'm²' : unit,
              category: 'Climatização - AVAC',
              qty_budgeted: qty,
              qty_real: 0,
              price: 0
            });
          }
        }
      }
    }
  }
}
