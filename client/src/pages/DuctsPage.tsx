import React, { useState, useEffect } from 'react';
import {
  Wind,
  Ruler,
  Scale,
  Layers,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Printer,
  RefreshCw,
  FileText,
  Building,
  Info,
  ChevronRight
} from 'lucide-react';
import { Project } from '../types';
import { api } from '../services/api';

interface DuctBreakdownItem {
  type: string;
  name?: string;
  material?: string;
  geometry?: string;
  specification?: string;
  standard?: string;
  technical_reason?: string;
  meters: number;
  kg: number;
  sheetAreaSqm?: number;
  insulation?: string;
  notes?: string;
}

interface DuctAnalysisResult {
  id?: number;
  projectId: number;
  projectName?: string;
  projectCode?: string;
  client?: string;
  totalMeters: number;
  totalKg: number;
  sheetAreaSqm: number;
  ductBreakdown: DuctBreakdownItem[];
  technicalNotes?: string;
  analyzedDocuments?: string[];
  createdAt?: string;
}

interface DuctsPageProps {
  onNavigate?: (page: string, id?: number) => void;
}

export const DuctsPage: React.FC<DuctsPageProps> = ({ onNavigate }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [currentAnalysis, setCurrentAnalysis] = useState<DuctAnalysisResult | null>(null);
  const [allAnalyses, setAllAnalyses] = useState<DuctAnalysisResult[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [customInstructions, setCustomInstructions] = useState('');

  // Carrega lista de projetos e análises já gravadas
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoadingProjects(true);
    try {
      const [projList, analysesList] = await Promise.all([
        api.getProjects(),
        api.getAllDuctAnalyses().catch(() => [])
      ]);
      setProjects(projList);
      setAllAnalyses(analysesList);

      // Se houver projetos, seleciona o primeiro por padrão
      if (projList.length > 0 && !selectedProjectId) {
        setSelectedProjectId(projList[0].id);
        fetchProjectAnalysis(projList[0].id);
      }
    } catch (err: any) {
      console.error('Erro ao carregar dados de projetos:', err);
    } finally {
      setLoadingProjects(false);
    }
  };

  const fetchProjectAnalysis = async (projectId: number) => {
    try {
      const res = await api.getDuctAnalysis(projectId);
      setCurrentAnalysis(res);
      setErrorMsg(null);
    } catch (err: any) {
      // Projeto ainda sem análise de dutos
      setCurrentAnalysis(null);
    }
  };

  const handleSelectProject = (id: number) => {
    setSelectedProjectId(id);
    setSuccessMsg(null);
    setErrorMsg(null);
    fetchProjectAnalysis(id);
  };

  const handleRunAnalysis = async () => {
    if (!selectedProjectId) return;
    setAnalyzing(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const result = await api.analyzeDucts(selectedProjectId, customInstructions.trim() || undefined);
      setCurrentAnalysis(result);
      setSuccessMsg(`Levantamento de dutos concluído com sucesso: ${result.totalMeters.toLocaleString('pt-BR')} m e ${result.totalKg.toLocaleString('pt-BR')} kg.`);
      
      // Atualiza lista geral
      const updatedList = await api.getAllDuctAnalyses().catch(() => []);
      setAllAnalyses(updatedList);
    } catch (err: any) {
      console.error('Erro no cálculo de dutos:', err);
      setErrorMsg(err.message || 'Erro ao processar análise aeráulica de dutos');
    } finally {
      setAnalyzing(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const selectedProject = projects.find(p => p.id === selectedProjectId);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header SABRAR Dutos */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-dark-900 p-5 sm:p-6 rounded-3xl border border-dark-750 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sabrar-600/30 to-emerald-500/10 border border-sabrar-500/40 flex items-center justify-center text-sabrar-400 shadow-lg shadow-sabrar-950/40">
            <Wind className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Levantamento de Dutos
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sabrar-500/20 text-sabrar-300 border border-sabrar-500/30 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-sabrar-400" /> IA Especializada
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Dimensionamento aeráulico objetivo a partir de plantas baixas e projetos executivos.
            </p>
          </div>
        </div>

        {currentAnalysis && (
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-dark-850 hover:bg-dark-800 text-slate-200 text-xs font-semibold border border-dark-700 transition-colors self-start sm:self-auto"
          >
            <Printer className="w-4 h-4 text-sabrar-400" />
            <span>Imprimir Relatório</span>
          </button>
        )}
      </div>

      {/* Regra de Ouro / Banner Informativo */}
      <div className="bg-slate-900/60 border border-slate-700/60 rounded-2xl p-4 flex items-start gap-3 text-xs text-slate-300">
        <Info className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-emerald-300">
            Foco Exclusivo em Quantitativo Aeráulico: Metros (m) e Quilogramas (kg)
          </p>
          <p className="text-slate-400 leading-relaxed">
            Esta IA analisa os desenhos técnicos, cortes e especificações aeráulicas para calcular a extensão e o peso de chapa das redes de dutos (exaustão pesada, insuflamento, renovação de ar e ramais flexíveis). <span className="text-slate-200 font-medium">Nenhum custo monetário ou material alheio é exibido nesta aba.</span>
          </p>
        </div>
      </div>

      {/* Seletor de Obra e Ação de Análise */}
      <div className="bg-dark-900 p-5 rounded-3xl border border-dark-750 shadow-md">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
          <div className="lg:col-span-4">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Selecione o Projeto / Obra
            </label>
            <select
              value={selectedProjectId || ''}
              onChange={(e) => handleSelectProject(Number(e.target.value))}
              className="w-full bg-dark-850 border border-dark-700 text-white rounded-2xl px-3.5 py-2.5 text-sm font-semibold focus:outline-none focus:border-sabrar-500 transition-colors"
              disabled={loadingProjects || analyzing}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name} ({p.client})
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Diretrizes Técnicas Adicionais (Opcional)
            </label>
            <input
              type="text"
              placeholder="Ex: Considerar chapa #16 para dutos de gordura e Kaowool..."
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              className="w-full bg-dark-850 border border-dark-700 text-white placeholder-slate-500 rounded-2xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-sabrar-500 transition-colors"
              disabled={analyzing}
            />
          </div>

          <div className="lg:col-span-3">
            <button
              onClick={handleRunAnalysis}
              disabled={analyzing || !selectedProjectId}
              className="w-full h-[42px] flex items-center justify-center gap-2 px-5 rounded-2xl bg-sabrar-600 hover:bg-sabrar-500 active:bg-sabrar-700 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-lg shadow-sabrar-600/30"
            >
              {analyzing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  <span>Calculando Aeráulica...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Calcular Dutos por IA</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Mensagens de Sucesso / Erro */}
        {successMsg && (
          <div className="mt-4 p-3 rounded-2xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="mt-4 p-3 rounded-2xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* Exibição dos Resultados da Análise */}
      {currentAnalysis ? (
        <div className="space-y-6">
          {/* CARDS PRINCIPAIS: METROS E QUILOGRAMAS */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Metros (m) */}
            <div className="bg-gradient-to-br from-emerald-950/50 via-dark-900 to-dark-900 p-5 rounded-3xl border border-emerald-500/40 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <Ruler className="w-24 h-24 text-emerald-400" />
              </div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                  Extensão Linear Total
                </span>
                <div className="w-7 h-7 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <Ruler className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                {currentAnalysis.totalMeters.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
                <span className="text-xl sm:text-2xl font-bold text-emerald-400 ml-1.5">m</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                Soma da metragem de todos os trechos de dutos
              </p>
            </div>

            {/* Total Quilogramas (kg) */}
            <div className="bg-gradient-to-br from-cyan-950/50 via-dark-900 to-dark-900 p-5 rounded-3xl border border-cyan-500/40 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <Scale className="w-24 h-24 text-cyan-400" />
              </div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-400">
                  Peso de Chapa Total
                </span>
                <div className="w-7 h-7 rounded-xl bg-cyan-500/20 flex items-center justify-center text-cyan-400">
                  <Scale className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                {currentAnalysis.totalKg.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
                <span className="text-xl sm:text-2xl font-bold text-cyan-400 ml-1.5">kg</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                Massa total de aço / chapa para fabricação
              </p>
            </div>

            {/* Área de Chapa Planificada (m²) */}
            <div className="bg-dark-900 p-5 rounded-3xl border border-dark-750 shadow-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Área Planificada
                </span>
                <div className="w-7 h-7 rounded-xl bg-dark-800 flex items-center justify-center text-slate-300">
                  <Layers className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl font-black text-white tracking-tight">
                {currentAnalysis.sheetAreaSqm.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
                <span className="text-xl font-bold text-slate-400 ml-1.5">m²</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                Área de desenvolvimento e corte de chapa
              </p>
            </div>

            {/* Tipologias Aeráulicas */}
            <div className="bg-dark-900 p-5 rounded-3xl border border-dark-750 shadow-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Tipologias de Duto
                </span>
                <div className="w-7 h-7 rounded-xl bg-dark-800 flex items-center justify-center text-slate-300">
                  <Wind className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl font-black text-white tracking-tight">
                {currentAnalysis.ductBreakdown?.length || 0}
                <span className="text-lg font-bold text-slate-400 ml-1.5">sistemas</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                Categorias identificadas no projeto executivo
              </p>
            </div>
          </div>

          {/* TABELA DE DISCRIMINAÇÃO TÉCNICA (SEM PREÇOS) */}
          <div className="bg-dark-900 rounded-3xl border border-dark-750 shadow-xl overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-dark-750 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="font-extrabold text-white text-base flex items-center gap-2">
                  <FileText className="w-4 h-4 text-sabrar-400" />
                  Discriminação Técnica dos Dutos da Obra
                </h3>
                <p className="text-xs text-slate-400">
                  Dimensões, geometria, especificação de chapa e isolamento aplicável
                </p>
              </div>
              <div className="text-xs text-slate-400 font-mono">
                {selectedProject?.code} • {selectedProject?.name}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-dark-850/80 text-slate-300 font-semibold border-b border-dark-750">
                  <tr>
                    <th className="p-3.5">Aplicação / Sistema</th>
                    <th className="p-3.5">Material & Espessura</th>
                    <th className="p-3.5">Geometria / Seção</th>
                    <th className="p-3.5 text-center">Extensão (m)</th>
                    <th className="p-3.5 text-center">Peso (kg)</th>
                    <th className="p-3.5 text-center">Área (m²)</th>
                    <th className="p-3.5">Isolamento Térmico</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-800">
                  {currentAnalysis.ductBreakdown?.map((item, idx) => (
                    <tr key={idx} className="hover:bg-dark-800/40 transition-colors">
                      <td className="p-3.5 font-bold text-white">
                        {item.type || item.name}
                        {(item.notes || item.technical_reason) && (
                          <div className="text-[10px] text-slate-400 font-normal mt-0.5">
                            {item.notes || item.technical_reason}
                          </div>
                        )}
                      </td>
                      <td className="p-3.5 text-slate-300 font-medium">
                        <span className="px-2 py-0.5 rounded bg-dark-800 border border-dark-700 text-slate-200">
                          {item.material || item.specification || 'Aço / MPU'}
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-300">{item.geometry || item.standard || 'Conforme Prancha'}</td>
                      <td className="p-3.5 text-center font-mono font-bold text-emerald-400 text-sm">
                        {Number(item.meters || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1 })} m
                      </td>
                      <td className="p-3.5 text-center font-mono font-bold text-cyan-400 text-sm">
                        {Number(item.kg || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1 })} kg
                      </td>
                      <td className="p-3.5 text-center font-mono text-slate-300">
                        {Number(item.sheetAreaSqm || (item.meters * 1.5) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1 })} m²
                      </td>
                      <td className="p-3.5 text-slate-400 text-[11px]">
                        {item.insulation || 'Conforme especificação executiva'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-dark-850 font-bold text-white border-t-2 border-dark-700">
                  <tr>
                    <td colSpan={3} className="p-3.5 text-right uppercase text-[11px] text-slate-400">
                      Totais Globais do Projeto:
                    </td>
                    <td className="p-3.5 text-center font-mono text-emerald-400 text-base font-black">
                      {currentAnalysis.totalMeters.toLocaleString('pt-BR', { minimumFractionDigits: 1 })} m
                    </td>
                    <td className="p-3.5 text-center font-mono text-cyan-400 text-base font-black">
                      {currentAnalysis.totalKg.toLocaleString('pt-BR', { minimumFractionDigits: 1 })} kg
                    </td>
                    <td className="p-3.5 text-center font-mono text-white">
                      {currentAnalysis.sheetAreaSqm.toLocaleString('pt-BR', { minimumFractionDigits: 1 })} m²
                    </td>
                    <td className="p-3.5 text-slate-400 text-[11px]">—</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* NOTAS TÉCNICAS E MEMÓRIA DE CÁLCULO */}
          {currentAnalysis.technicalNotes && (
            <div className="bg-dark-900 p-5 rounded-3xl border border-dark-750 shadow-md">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-sabrar-400" />
                Memória de Cálculo & Normas Técnicas
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line bg-dark-850 p-4 rounded-2xl border border-dark-750 font-mono">
                {currentAnalysis.technicalNotes}
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-dark-900 p-12 rounded-3xl border border-dark-750 text-center space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-dark-800 border border-dark-700 flex items-center justify-center text-slate-500 mx-auto">
            <Wind className="w-8 h-8" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-white">
              Nenhum levantamento de dutos realizado para este projeto
            </h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
              Clique no botão <span className="text-sabrar-400 font-semibold">"Calcular Dutos por IA"</span> acima para que a inteligência analise as pranchas e documentos técnicos da obra.
            </p>
          </div>
        </div>
      )}

      {/* Histórico Geral de Obras com Dutos */}
      {allAnalyses.length > 0 && (
        <div className="bg-dark-900 p-5 rounded-3xl border border-dark-750 shadow-xl space-y-3">
          <h3 className="font-extrabold text-white text-sm">
            Histórico de Levantamentos de Dutos Cadastrados
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {allAnalyses.map((an) => (
              <div
                key={an.id}
                onClick={() => handleSelectProject(an.projectId)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                  an.projectId === selectedProjectId
                    ? 'bg-dark-800/80 border-sabrar-500/60 shadow-md shadow-sabrar-950/20'
                    : 'bg-dark-850/60 border-dark-750 hover:border-dark-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono font-bold text-[11px] text-sabrar-400">
                    {an.projectCode}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {an.createdAt ? new Date(an.createdAt).toLocaleDateString('pt-BR') : ''}
                  </span>
                </div>
                <div className="font-bold text-xs text-white truncate">{an.projectName}</div>
                <div className="text-[11px] text-slate-400 mb-2 truncate">{an.client}</div>
                <div className="flex items-center justify-between pt-2 border-t border-dark-750/80 text-xs">
                  <span className="text-emerald-400 font-bold">{an.totalMeters.toLocaleString('pt-BR')} m</span>
                  <span className="text-cyan-400 font-bold">{an.totalKg.toLocaleString('pt-BR')} kg</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
