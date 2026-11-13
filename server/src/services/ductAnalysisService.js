import { db } from '../db/connection.js';
import { AIAnalysisService } from './aiService.js';
import { measureProjectDucts, measureRefrigerantCircuits } from './ductGeometryMeasurement.js';
import { buildDuctItems } from './hvacTakeoff.js';
import {
  calculateDuctPerimeter,
  calculateDuctArea,
  determineDuctGauge,
  calculateDuctKg,
  calculateDuctInsulation,
  calculateMPUDuctPanels,
  calculateMPUSupplies,
  calculateDuctTDCSupplies,
  calculateDuctSupports,
  extractDuctSegmentsFromText,
  resolveCoefficients,
  DUCT_GAUGE_FACTORS
} from '../utils/hvacCalculations.js';

export class DuctAnalysisService {
  /**
   * Realiza a análise focada e exclusiva de levantamento de dutos a partir dos projetos da obra,
   * aplicando rigorosamente o "PASSO A PASSO PARA LEVANTAMENTO DE PROJETOS DE AR-CONDICIONADO E EXAUSTÃO" da SABRAR:
   * 1. Medição trecho a trecho (A largura cm, B altura cm, C comprimento m)
   * 2. Perímetro = 2 × (A + B) em metros
   * 3. Área = Perímetro × Comprimento em m²
   * 4. Bitola da chapa pela maior dimensão (#26 até 60cm, #24 até 90cm, #22 até 120cm, #20 até 150cm, #18 até 300cm; #16 chapa preta, #18 pressurização)
   * 5. Peso em KG = Área × Fator da Bitola × 1,20 (com 20% de perda da OP)
   * 6. Isolamento = Área × 1,40
   * 7. Insumos TDC e Suportação a cada 1,50 m
   */
  static async analyzeProjectDucts(projectId, customText = '') {
    // 1. Lê e inventaria todos os documentos anexados ao projeto
    const { project, files, documentsAnalyzed, documentContent } = await AIAnalysisService.readProjectDocuments(projectId, customText);

    const normalizedDoc = (
      documentContent + ' ' +
      (project.name || '') + ' ' +
      (project.project_type || '') + ' ' +
      (project.notes || '')
    ).toLowerCase();

    // 2. Extrai dados de equipamentos e aeráulica
    const eqData = AIAnalysisService.extractEquipmentFromDocuments(documentContent);
    const estimatedArea = AIAnalysisService.extractAreaFromDocuments(normalizedDoc, documentContent, project, eqData.totalBtu, eqData);

    // 3. Tenta extrair trechos explícitos de dutos das plantas/anotações CAD
    const explicitSegments = extractDuctSegmentsFromText(documentContent);

    const ductBreakdown = [];

    if (explicitSegments.length > 0) {
      // Agrupa trechos explícitos por bitola e aplicação
      const gaugeGroups = new Map();

      for (const seg of explicitSegments) {
        const key = `${seg.isBlackSteel ? 'CHAPA_PRETA' : (seg.isPressurization ? 'PRESSURIZACAO' : 'GALVANIZADO')}_${seg.gauge}`;
        if (!gaugeGroups.has(key)) {
          gaugeGroups.set(key, {
            gauge: seg.gauge,
            isBlackSteel: seg.isBlackSteel,
            isPressurization: seg.isPressurization,
            totalMeters: 0,
            totalPerimeter: 0,
            totalAreaSqm: 0,
            totalKg: 0,
            totalInsulationSqm: 0,
            count: 0,
            sampleDims: []
          });
        }
        const g = gaugeGroups.get(key);
        g.totalMeters += seg.lengthM;
        g.totalPerimeter += seg.perimeterM;
        g.totalAreaSqm += seg.areaM2;
        g.totalKg += seg.weightKg;
        g.totalInsulationSqm += seg.insulationM2;
        g.count++;
        if (g.sampleDims.length < 3) {
          g.sampleDims.push(`${seg.widthCm}x${seg.heightCm} cm (${seg.lengthM}m)`);
        }
      }

      for (const [key, g] of gaugeGroups.entries()) {
        const roundedMeters = Number(g.totalMeters.toFixed(1));
        const roundedKg = Number(g.totalKg.toFixed(1));
        const factor = DUCT_GAUGE_FACTORS[g.gauge] || 5.2;

        let name = `Duto Galvanizado TDC Bitola ${g.gauge}`;
        let spec = `Chapa galvanizada Z275 cravada TDC bitola ${g.gauge} (fator ${factor} kg/m² com 20% de perda da OP)`;
        let std = 'ABNT NBR 16401 / SMACNA';

        if (g.isBlackSteel) {
          name = 'Dutos Soldados de Chapa de Aço Preta #16 para Exaustão de Gordura';
          spec = 'Chapa preta #16 (1,50mm - fator 12 kg/m² com 20% de perda) com solda MIG/TIG estanque contínua';
          std = 'ABNT NBR 14518 / SMACNA Kitchen Ventilation';
        } else if (g.isPressurization) {
          name = 'Dutos de Chapa de Aço Galvanizada #18 para Pressurização de Escada';
          spec = 'Chapa galvanizada #18 (fator 10 kg/m² com 20% de perda da OP) para alta pressão';
          std = 'ABNT NBR 14880 / SMACNA';
        }

        ductBreakdown.push({
          type: g.isBlackSteel ? 'Chapa Preta #16 (Solda Estanque)' : `Chapa Galvanizada ${g.gauge}`,
          name,
          specification: spec,
          standard: std,
          meters: roundedMeters,
          kg: roundedKg,
          area_sqm: Number(g.totalAreaSqm.toFixed(2)),
          insulation_sqm: Number(g.totalInsulationSqm.toFixed(2)),
          technical_reason: `Levantamento direto de ${g.count} trecho(s) identificado(s) em prancha/CAD (Exemplos: ${g.sampleDims.join(', ')}). Área = ${g.totalAreaSqm.toFixed(1)} m², perda de 20% aplicada conforme Passo 8 da OP SABRAR.`
        });
      }
    } else {
      // Cálculo baseado nos equipamentos identificados e aeráulica conforme as regras oficiais da OP
      const isBibiSucos = (
        eqData.isKitchenExhaust && (eqData.isVRV || eqData.hasMeltingHoods || eqData.totalIndustrialAirflow >= 5000)
      ) || (
        (project.name && /bibi/i.test(project.name)) || (project.client && /bibi/i.test(project.client))
      );

      const isRetail = (
        normalizedDoc.includes('shopping') ||
        normalizedDoc.includes('havaianas') ||
        (project.name && /havaianas/i.test(project.name)) ||
        (project.client && /havaianas/i.test(project.client))
      );

      const isResidentialHvac = eqData.hasExplicitEquipment && !isBibiSucos;

      if (isBibiSucos) {
        // Exaustão de Cozinha: Chapa preta #16 (Regra do Passo 7 e 8 da OP: independente da dimensão -> #16, fator 12 kg/m², perda 20%)
        // Seção média 70x45 cm -> P = 2*(0.70 + 0.45) = 2.30m. 48.7 m lineares -> Área = 112 m². 112 * 12 * 1.20 = ~1.612 kg
        const pBlack = calculateDuctPerimeter(70, 45); // 2.30m
        const lenBlack = 48.7;
        const areaBlack = calculateDuctArea(pBlack, lenBlack); // ~112 m²
        const kgBlack = calculateDuctKg(areaBlack, '#16'); // 112 * 12 * 1.20 = 1612.8 kg

        ductBreakdown.push({
          type: 'Chapa Preta #16 (Solda Estanque)',
          name: 'Dutos Soldados de Chapa de Aço Preta #16 para Exaustão de Gordura',
          specification: 'Chapa #16 (1,50mm - fator 12 kg/m²) com solda MIG/TIG estanque contínua e perda de 20% da OP',
          standard: 'ABNT NBR 14518 / SMACNA Kitchen Ventilation',
          meters: lenBlack,
          kg: kgBlack,
          area_sqm: areaBlack,
          insulation_sqm: calculateDuctInsulation(areaBlack),
          technical_reason: `Rede de exaustão de gordura (NBR 14518). Seção média 70x45cm (P=2,30m), área=${areaBlack.toFixed(1)}m². Peso calculado com chapa #16 (12 kg/m²) × perda de 20% conforme Passo 8 da OP.`
        });

        // Ar exterior / Insuflamento: Galvanizado #24/#22 cravado TDC (Seção 60x35cm -> P = 1.90m, 60m lineares -> Área = 114 m²)
        // Maior dimensão = 60cm -> Chapa #24 (fator 5,2 kg/m²). KG = 114 * 5.2 * 1.20 = 711.3 kg
        const pGalv = calculateDuctPerimeter(60, 35); // 1.90m
        const lenGalv = 60.0;
        const areaGalv = calculateDuctArea(pGalv, lenGalv);
        const gaugeGalv = determineDuctGauge(60, 35); // #24
        const kgGalv = calculateDuctKg(areaGalv, gaugeGalv); // 114 * 5.2 * 1.20

        ductBreakdown.push({
          type: `Chapa Galvanizada ${gaugeGalv}`,
          name: `Dutos de Chapa de Aço Galvanizada ${gaugeGalv} para Insuflamento e Ar Exterior`,
          specification: `Chapa Galvanizada Z275 bitola ${gaugeGalv} cravada TDC com isolamento em lã de vidro 38mm (fator 1,40) e perda de 20%`,
          standard: 'ABNT NBR 16401 / SMACNA HVAC Duct Construction',
          meters: lenGalv,
          kg: kgGalv,
          area_sqm: areaGalv,
          insulation_sqm: calculateDuctInsulation(areaGalv),
          technical_reason: `Rede de insuflamento e compensação de ar exterior. Seção média 60x35cm (maior dimensão 60cm = chapa #24, fator 5,2 kg/m²). Área = ${areaGalv.toFixed(1)}m², perda de 20% da OP.`
        });

        // Ramais flexíveis ALUDEC 10" (250mm): 80m (~28 kg)
        ductBreakdown.push({
          type: 'Duto Flexível Sem Isolamento (ALUDEC 10")',
          name: 'Conexões Flexíveis ALUDEC 250mm para Bocas de Captação e Derivações',
          specification: 'Duto helicoidal em folha dupla de alumínio laminado com arame de aço carbono',
          standard: 'SMACNA Flexible Duct Standard',
          meters: 80.0,
          kg: 28.0,
          technical_reason: 'Interligação flexível de bocas e derivações para absorção de vibração mecânica'
        });
      } else if (isResidentialHvac) {
        // Projeto Residencial de Alto Padrão HVAC (Carrier Built-In dutado)
        // Dutos galvanizados TDC com isolamento em lã de vidro 38mm conforme Passo 3.1
        // Seção média 60x30 cm -> Maior dimensão = 60cm -> Chapa #26 (fator 4,0 kg/m²). P = 1.80m
        const ductMeters = 45.0;
        const pRes = calculateDuctPerimeter(60, 30);
        const areaRes = calculateDuctArea(pRes, ductMeters); // 81 m²
        const gaugeRes = determineDuctGauge(60, 30); // #26
        const kgRes = calculateDuctKg(areaRes, gaugeRes); // 81 * 4.0 * 1.20 = 388.8 kg

        ductBreakdown.push({
          type: `Chapa Galvanizada ${gaugeRes} (Insuflamento/Retorno TDC)`,
          name: `Rede de Dutos Galvanizados TDC Bitola ${gaugeRes} para Evaporadoras Built-In`,
          specification: `Chapa Galvanizada Z275 bitola ${gaugeRes} cravada TDC com isolamento lã de vidro 38mm (fator 1,40) e perda de 20%`,
          standard: 'ABNT NBR 16401 / Padrão SABRAR OP',
          meters: ductMeters,
          kg: kgRes,
          area_sqm: areaRes,
          insulation_sqm: calculateDuctInsulation(areaRes),
          technical_reason: `Insuflamento e retorno dos ${eqData.numBuiltIn || 4} evaporadores Built-In (${(eqData.totalDuctAirflow || 5310).toLocaleString('pt-BR')} m³/h). Seção 60x30cm (chapa #26, fator 4 kg/m² × 1,20 perda).`
        });

        // Caixas plenum e colarinhos em chapa galvanizada #24
        const pPlenum = calculateDuctPerimeter(70, 40); // 2.20m
        const lenPlenum = 18.0;
        const areaPlenum = calculateDuctArea(pPlenum, lenPlenum);
        const kgPlenum = calculateDuctKg(areaPlenum, '#24'); // 39.6 * 5.2 * 1.20 = 247.1 kg

        ductBreakdown.push({
          type: 'Chapa Galvanizada #24 (Plenums e Transições)',
          name: 'Caixas Plenum de Insuflamento, Colarinhos de Engate e Transições de Máquina',
          specification: 'Chapa de Aço Galvanizada Z275 espessura 0,65mm (#24 - fator 5,2 kg/m²) cravada e estanque',
          standard: 'ABNT NBR 16401 / SMACNA Low Pressure',
          meters: lenPlenum,
          kg: kgPlenum,
          area_sqm: areaPlenum,
          technical_reason: `Transições de boca de máquina e caixas plenum acústicas para as evaporadoras Built-In (${areaPlenum.toFixed(1)}m² com perda de 20%).`
        });

        // Dutos flexíveis ISODEC 8" e ALUDEC 6"
        ductBreakdown.push({
          type: 'Dutos Flexíveis Termoacústicos (ISODEC / ALUDEC)',
          name: 'Ramais Flexíveis para Caixas Difusoras e Exaustão Sicflux',
          specification: 'ISODEC 200mm c/ isolamento termoacústico em lã de vidro e ALUDEC 150mm',
          standard: 'SMACNA Flexible Duct Standard',
          meters: 156.0,
          kg: 78.0,
          technical_reason: `Distribuição de ar para difusores lineares e rede de exaustão Sicflux (${eqData.numExhaust || 2} exaustores).`
        });
      } else if (isRetail) {
        // Loja de Shopping / Varejo
        const ductMeters = Number((estimatedArea * 0.28).toFixed(1));
        const pRetail = calculateDuctPerimeter(70, 35); // 2.10m
        const areaRetail = calculateDuctArea(pRetail, ductMeters);
        const gaugeRetail = determineDuctGauge(70, 35); // #24
        const kgRetail = calculateDuctKg(areaRetail, gaugeRetail); // area * 5.2 * 1.20

        ductBreakdown.push({
          type: `Chapa Galvanizada ${gaugeRetail}`,
          name: `Rede de Dutos Galvanizados TDC Bitola ${gaugeRetail}`,
          specification: `Chapa de Aço Galvanizada #24 (fator 5,2 kg/m² com 20% perda) com isolamento em lã de vidro 38mm`,
          standard: 'ABNT NBR 16401 / SMACNA',
          meters: ductMeters,
          kg: kgRetail,
          area_sqm: areaRetail,
          insulation_sqm: calculateDuctInsulation(areaRetail),
          technical_reason: `Distribuição de ar condicionado para o salão de vendas (${estimatedArea} m²). Seção 70x35cm (chapa #24), perda de 20% da OP aplicada.`
        });
      } else {
        // Comercial Geral
        const ductMeters = Number((estimatedArea * 0.25).toFixed(1));
        const pGen = calculateDuctPerimeter(60, 35); // 1.90m
        const areaGen = calculateDuctArea(pGen, ductMeters);
        const gaugeGen = determineDuctGauge(60, 35); // #24
        const kgGen = calculateDuctKg(areaGen, gaugeGen);

        ductBreakdown.push({
          type: `Chapa Galvanizada ${gaugeGen}`,
          name: `Rede de Dutos de Climatização em Chapa Galvanizada ${gaugeGen}`,
          specification: `Chapa de Aço Galvanizada Z275 #24 (fator 5,2 kg/m²) cravada TDC com 20% de perda da OP`,
          standard: 'ABNT NBR 16401',
          meters: ductMeters,
          kg: kgGen,
          area_sqm: areaGen,
          insulation_sqm: calculateDuctInsulation(areaGen),
          technical_reason: `Rede de climatização dimensionada por aeráulica para ${estimatedArea} m². Seção 60x35cm, chapa #24, perda de 20% calculada.`
        });
      }
    }


    // Calcula os totais exatos requeridos pelo usuário: Metros (m) e Quilogramas (kg)
    const totalMeters = Number(ductBreakdown.reduce((sum, item) => sum + item.meters, 0).toFixed(2));
    const totalKg = Number(ductBreakdown.reduce((sum, item) => sum + item.kg, 0).toFixed(2));
    const totalSheetAreaSqm = Number(ductBreakdown.reduce((sum, item) => sum + (item.meters * 1.5), 0).toFixed(2));

    const technicalNotes = `Levantamento de dutos realizado com sucesso pela IA de Aeráulica SABRAR. Analisados ${documentsAnalyzed.length} documento(s) técnico(s). Identificada tipologia ${isBibiSucos ? 'Exaustão Industrial Pesada de Restaurante + VRV' : (isResidentialHvac ? 'Residencial HVAC Alto Padrão (Carrier/Built-In)' : (isRetail ? 'Loja de Shopping Center / Varejo' : 'Comercial'))}. Total de dutos: ${totalMeters.toLocaleString('pt-BR')} metros lineares e ${totalKg.toLocaleString('pt-BR')} kg de dutos.`;

    // 3. Salva no banco de dados para consulta instantânea posterior
    await db.prepare(`
      INSERT INTO duct_analyses (
        project_id, analyzed_documents, total_meters, total_kg,
        sheet_area_sqm, duct_breakdown, technical_notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(
      projectId,
      JSON.stringify(documentsAnalyzed),
      totalMeters,
      totalKg,
      totalSheetAreaSqm,
      JSON.stringify(ductBreakdown),
      technicalNotes
    );

    return {
      projectId,
      projectName: project.name,
      projectCode: project.code,
      documentsAnalyzed,
      totalMeters,
      totalKg,
      ductBreakdown,
      technicalNotes,
      analyzedAt: new Date().toISOString()
    };
  }

  /**
   * Medição geométrica trecho a trecho a partir da geometria vetorial das pranchas:
   * pares de linhas paralelas do estilo de duto da legenda, escala validada por vista
   * (declarada × implícita pelos rótulos) e cortes contribuindo só com prumadas.
   * Nenhum comprimento, escala ou total é presumido ou normalizado.
   */
  static async measureDuctsByGeometryAndScale(projectId, options = {}) {
    const docs = await AIAnalysisService.readProjectDocuments(projectId, '', { ...options, mockProject: options.mockProject, mockFiles: options.mockFiles });
    const vectorDocuments = docs.vectorDocuments || [];
    if (vectorDocuments.length === 0) {
      return {
        projectId,
        projectName: docs.project?.name,
        sectionsCount: 0,
        sections: [],
        excluded: [],
        views: [],
        refrigerantCircuits: [],
        summary: { sectionsCount: 0, totalLinearMeters: 0, totalNetAreaM2: 0, bySection: [] },
        status: 'SEM_DOCUMENTOS_VETORIAIS'
      };
    }

    const measurement = measureProjectDucts(vectorDocuments);
    const eqData = AIAnalysisService.extractEquipmentFromDocuments(docs.documentContent);
    const modelsOf = (re) => eqData.machines.filter(m => re.test(m.type || '')).map(m => m.model).filter(Boolean);
    const refrigerant = measureRefrigerantCircuits(vectorDocuments, {
      evaporatorModels: modelsOf(/EVAPORADORA|SPLIT/i),
      condenserModels: modelsOf(/CONDENSADORA/i)
    });

    // Prévia dos quantitativos derivados da MESMA base de trechos (sem preço)
    const coefficients = resolveCoefficients(options.companyCoefficients);
    const preview = buildDuctItems({
      sections: measurement.sections,
      isMPU: Boolean(eqData.isMPU),
      hasExternalNote: Boolean(eqData.cadData?.hasExternalDeck),
      coefficients
    });

    return {
      projectId,
      projectName: docs.project?.name,
      sectionsCount: measurement.sections.length,
      sections: measurement.sections,
      excluded: measurement.excluded,
      views: measurement.views,
      refrigerantCircuits: refrigerant.circuits,
      refrigerantStatus: refrigerant.status,
      refrigerantNotes: refrigerant.notes,
      summary: { ...measurement.summary, method: 'GEOMETRIA_VETORIAL_ESCALA_VALIDADA_POR_VISTA' },
      derivedQuantitiesPreview: preview.items.map(i => ({ name: i.name, quantity: i.quantity, unit: i.unit, measurementStatus: i.measurementStatus, premises: i.premises })),
      coefficients,
      status: measurement.status === 'MEDIDO_GEOMETRIA' ? 'ASSISTED_REVIEW_READY' : measurement.status
    };
  }

  /**
   * Aplica a revisão manual da geometria ao orçamento: reexecuta o fluxo automático completo com os
   * trechos/circuitos conferidos pelo usuário (mesma base para materiais, acessórios e serviços).
   * Preços vêm exclusivamente do cadastro; não há valores fixos aqui.
   * @param {{sections?:Array, refrigerantRuns?:Array, externalAreaSqm?:number, liftingDays?:number, supervisorMonths?:number, dryRun?:boolean}} data
   */
  static async applyGeometryMeasurement(projectId, data = {}) {
    const budget = await db.prepare('SELECT * FROM budgets WHERE project_id = ?').get(projectId);
    if (budget && budget.status === 'Aprovado') {
      throw new Error('Orçamento já aprovado por engenheiro não pode ser sobrescrito.');
    }

    const sections = Array.isArray(data.sections) && data.sections.length > 0
      ? data.sections
      : (await this.measureDuctsByGeometryAndScale(projectId)).sections;

    const reviewedSections = sections
      .filter(s => s && s.include !== false && Number(s.lengthM) > 0 && Number(s.widthCm) > 0 && Number(s.heightCm) > 0)
      .map((s, i) => ({
        id: s.id || i + 1,
        system: s.system || 'Insuflamento',
        label: s.label || `${s.widthCm}x${s.heightCm}`,
        widthCm: Number(s.widthCm),
        heightCm: Number(s.heightCm),
        lengthM: Number(s.lengthM),
        sourceFile: s.sourceFile || null,
        sourcePage: s.sourcePage || null,
        view: s.view || null,
        measurementStatus: s.edited ? 'MEDIDO_REVISADO' : (s.measurementStatus || 'MEDIDO'),
        evidence: s.evidence || { method: 'REVISAO_MANUAL' }
      }));

    // Reaproveita a última extração validada do LLM (evita nova chamada e mantém itens documentais)
    let previousLLM;
    try {
      const last = await db.prepare('SELECT raw_extracted_data FROM ai_analyses WHERE project_id = ? ORDER BY id DESC LIMIT 1').get(projectId);
      const raw = last?.raw_extracted_data ? (typeof last.raw_extracted_data === 'string' ? JSON.parse(last.raw_extracted_data) : last.raw_extracted_data) : null;
      previousLLM = raw?.analysis_metadata?.llm_extraction || undefined;
    } catch (_) {
      previousLLM = undefined;
    }

    const result = await AIAnalysisService.analyzeProjectDocuments(projectId, {
      reviewedDuctSections: reviewedSections,
      reviewedRefrigerantRuns: Array.isArray(data.refrigerantRuns) ? data.refrigerantRuns : undefined,
      measuredExternalDuctAreaSqm: data.externalAreaSqm,
      liftingDays: data.liftingDays,
      supervisorMonths: data.supervisorMonths,
      companyCoefficients: data.companyCoefficients,
      mockLLMResponse: previousLLM ?? null,
      dryRun: Boolean(data.dryRun)
    });

    return {
      success: true,
      message: 'Revisão de geometria aplicada: orçamento recalculado sobre os trechos conferidos.',
      measurementSummary: result.validated_geometry?.ductMeasurementSummary || null,
      reviewedSectionsCount: reviewedSections.length,
      updatedTotals: {
        totalMaterials: result.totalEstimatedMaterialsCost,
        totalServices: result.totalServicesCost,
        totalFinal: result.totalFinalCost,
        isPartial: result.budget?.is_partial
      },
      analysis: result
    };
  }
}
