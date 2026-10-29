import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  TrendingUp,
  Brain,
  ShieldCheck,
  CheckCircle,
  Clock,
  ArrowRight,
  Lock,
  Layers,
  Cpu,
  RefreshCw,
  Info,
  Database,
  FileText,
  Code2
} from 'lucide-react';
import { api } from '../services/api';
import { BulkImportModal } from '../components/modals/BulkImportModal';
import { AICalibrationModal } from '../components/modals/AICalibrationModal';
import { AIPromptModal } from '../components/modals/AIPromptModal';

export const AILearningHub: React.FC = () => {
  const [metrics, setMetrics] = useState<any>(null);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = () => {
    setLoading(true);
    api.getAIMetrics()
      .then(metricsData => {
        setMetrics(metricsData);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-dark-900 p-5 sm:p-6 rounded-3xl shadow-xl border border-dark-750">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-sabrar-950/80 border border-sabrar-500/40 flex items-center justify-center text-sabrar-400 shadow-inner">
              <Brain className="w-5 h-5 animate-pulse" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              IA com Aprendizado Contínuo SABRAR
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
            Plataforma de inteligência operacional que utiliza dados históricos de consumo real e revisões humanas para refinar automaticamente estimativas futuras.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {metrics && (
            <div className="flex items-center gap-4 bg-dark-850 px-4 py-2.5 rounded-2xl border border-dark-700 self-start sm:self-center">
              <div>
                <div className="text-[10px] uppercase font-bold text-sabrar-400 tracking-wider">Acurácia Média da IA</div>
                <div className="text-2xl font-black text-white">
                  {metrics.totalSamples > 0 ? `${metrics.averageModelAccuracy}%` : '—'}
                </div>
              </div>
              <div className="border-l border-dark-700 pl-4">
                <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Amostras de Calibração</div>
                <div className="text-2xl font-black text-white">
                  {metrics.totalSamples} {metrics.totalSamples === 1 ? 'amostra' : 'amostras'}
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
            <button
              onClick={() => setIsPromptModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-dark-800 hover:bg-dark-750 text-sabrar-300 border border-sabrar-500/40 text-xs font-bold transition-all active:scale-95 whitespace-nowrap shadow-sm"
              title="Visualizar a metodologia completa dos 19 passos e o System Prompt oficial da IA"
            >
              <Code2 className="w-4 h-4 text-sabrar-400" />
              <span>Ver Prompt & Metodologia OP</span>
            </button>

            <button
              onClick={() => setIsDocModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-sabrar-600 hover:bg-sabrar-500 text-white text-xs font-bold transition-all shadow-md shadow-sabrar-600/30 active:scale-95 whitespace-nowrap"
            >
              <Sparkles className="w-4 h-4 text-sabrar-200" />
              <span>Calibrar com Documentos</span>
            </button>

            <button
              onClick={() => setIsBulkModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-dark-800 hover:bg-dark-750 text-slate-200 border border-dark-700 text-xs font-bold transition-all active:scale-95 whitespace-nowrap"
            >
              <Database className="w-4 h-4 text-slate-400" />
              <span>Carga em Planilha</span>
            </button>
          </div>
        </div>
      </div>

      {/* Regra de Imutabilidade */}
      <div className="p-4 bg-dark-850 border border-sabrar-500/40 rounded-3xl flex items-start gap-3 text-xs text-slate-300 shadow-md">
        <ShieldCheck className="w-5 h-5 text-sabrar-400 shrink-0 mt-0.5" />
        <div>
          <div className="font-extrabold text-white text-sm">
            Diretriz Fundamental de Aprendizado & Auditoria
          </div>
          <p className="mt-0.5 leading-relaxed text-slate-400">
            O aprendizado da IA é estritamente <span className="font-bold text-sabrar-300 underline">prospectivo</span>:
            o modelo refina novas recomendações futuras, mas <span className="font-bold text-white">nunca altera retroativamente</span> projetos antigos, orçamentos aprovados, quantidades retiradas ou movimentações anteriores de estoque. Todos os históricos permanecem 100% imutáveis para garantir auditoria contábil e técnica.
          </p>
        </div>
      </div>

      {/* Diagrama Conceitual do Ciclo de Inteligência */}
      <div className="bg-dark-900 p-5 sm:p-6 rounded-3xl border border-dark-750 shadow-md space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-extrabold text-white">Ciclo de Inteligência Operacional</h3>
            <p className="text-xs text-slate-400">Fluxo contínuo de aprendizado e calibração de dados</p>
          </div>
          <span className="text-xs font-bold text-sabrar-400 bg-sabrar-950 px-2.5 py-1 rounded-full border border-sabrar-500/40">
            Feedback Loop Ativo
          </span>
        </div>

        {/* Step-by-step visual diagram */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-center text-xs">
          <div className="p-3 bg-dark-850 rounded-2xl border border-dark-700 flex flex-col justify-between">
            <div className="w-7 h-7 mx-auto rounded-xl bg-dark-800 text-sabrar-400 flex items-center justify-center font-bold text-xs mb-1 border border-dark-700">
              1
            </div>
            <span className="font-bold text-white">Novo Projeto</span>
            <span className="text-[10px] text-slate-400 mt-1">Upload Documentos Técnicos</span>
          </div>

          <div className="p-3 bg-dark-850 rounded-2xl border border-dark-700 flex flex-col justify-between">
            <div className="w-7 h-7 mx-auto rounded-xl bg-purple-950 text-purple-400 flex items-center justify-center font-bold text-xs mb-1 border border-purple-800">
              2
            </div>
            <span className="font-bold text-white">Análise da IA</span>
            <span className="text-[10px] text-slate-400 mt-1">Extração e Cruzamento</span>
          </div>

          <div className="p-3 bg-dark-850 rounded-2xl border border-dark-700 flex flex-col justify-between">
            <div className="w-7 h-7 mx-auto rounded-xl bg-amber-950 text-amber-400 flex items-center justify-center font-bold text-xs mb-1 border border-amber-800">
              3
            </div>
            <span className="font-bold text-white">Revisão Humana</span>
            <span className="text-[10px] text-slate-400 mt-1">Ajuste pelo Orçamentista</span>
          </div>

          <div className="p-3 bg-dark-850 rounded-2xl border border-dark-700 flex flex-col justify-between">
            <div className="w-7 h-7 mx-auto rounded-xl bg-teal-950 text-teal-400 flex items-center justify-center font-bold text-xs mb-1 border border-teal-800">
              4
            </div>
            <span className="font-bold text-white">Aprovação</span>
            <span className="text-[10px] text-slate-400 mt-1">Obra em Execução</span>
          </div>

          <div className="p-3 bg-dark-850 rounded-2xl border border-dark-700 flex flex-col justify-between">
            <div className="w-7 h-7 mx-auto rounded-xl bg-blue-950 text-blue-400 flex items-center justify-center font-bold text-xs mb-1 border border-blue-800">
              5
            </div>
            <span className="font-bold text-white">Consumo Real</span>
            <span className="text-[10px] text-slate-400 mt-1">Retiradas − Devoluções</span>
          </div>

          <div className="p-3 bg-dark-850 rounded-2xl border border-dark-700 flex flex-col justify-between">
            <div className="w-7 h-7 mx-auto rounded-xl bg-indigo-950 text-indigo-400 flex items-center justify-center font-bold text-xs mb-1 border border-indigo-800">
              6
            </div>
            <span className="font-bold text-white">Comparação</span>
            <span className="text-[10px] text-slate-400 mt-1">Previsão vs Decisão vs Real</span>
          </div>

          <div className="p-3 bg-sabrar-950/80 rounded-2xl border border-sabrar-500/40 flex flex-col justify-between shadow-md">
            <div className="w-7 h-7 mx-auto rounded-xl bg-sabrar-600 text-white flex items-center justify-center font-bold text-xs mb-1">
              7
            </div>
            <span className="font-black text-sabrar-300">Novas Obras</span>
            <span className="text-[10px] text-sabrar-400/80 mt-1 font-semibold">Estimativa Calibrada</span>
          </div>
        </div>
      </div>

      {loading && (
        <div className="py-16 text-center text-sm text-slate-500">
          Carregando base de aprendizado...
        </div>
      )}



      {/* Base Histórica de Aprendizado */}
      {!loading && metrics && (
        <div className="bg-dark-900 rounded-3xl border border-dark-750 overflow-hidden shadow-md">
          <div className="p-4 bg-dark-850 border-b border-dark-750 flex items-center justify-between text-xs font-bold text-white">
            <span>Base Histórica de Aprendizado Contínuo da SABRAR</span>
            <span className="text-slate-400 font-normal">Comparativo empírico das obras concluídas</span>
          </div>

          {metrics.historicalCases && metrics.historicalCases.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-dark-850 text-slate-400 font-semibold border-b border-dark-700">
                  <tr>
                    <th className="p-3">Obra / Tipologia</th>
                    <th className="p-3">Material</th>
                    <th className="p-3 text-center">Sugestão IA</th>
                    <th className="p-3 text-center">Aprovado Humano</th>
                    <th className="p-3 text-center">Retirado</th>
                    <th className="p-3 text-center">Devolvido</th>
                    <th className="p-3 text-center font-bold text-white">Consumo Real</th>
                    <th className="p-3 text-center">Variação %</th>
                    <th className="p-3 text-right">Fator de Calibração Aprendido</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-750">
                  {metrics.historicalCases.map((h: any) => {
                    const isOver = h.variance_percent > 0;
                    const isUnder = h.variance_percent < 0;
                    return (
                      <tr key={h.id} className="hover:bg-dark-850/60">
                        <td className="p-3">
                          <div className="font-bold text-white">{h.project_name}</div>
                          <div className="text-[10px] text-slate-400">{h.project_code} • {h.project_type}</div>
                        </td>
                        <td className="p-3 font-semibold text-slate-200">
                          {h.material_name}
                        </td>
                        <td className="p-3 text-center text-slate-400 font-mono">
                          {h.ai_suggested_qty} {h.material_unit}
                        </td>
                        <td className="p-3 text-center font-bold text-slate-200">
                          {h.human_approved_qty} {h.material_unit}
                        </td>
                        <td className="p-3 text-center text-amber-400 font-medium">
                          {h.total_withdrawn_qty}
                        </td>
                        <td className="p-3 text-center text-teal-400 font-medium">
                          {h.total_returned_qty}
                        </td>
                        <td className="p-3 text-center font-black text-white bg-dark-850">
                          {h.actual_consumed_qty} {h.material_unit}
                        </td>
                        <td className="p-3 text-center">
                          <span
                            className={`font-bold text-[10px] px-2 py-0.5 rounded-full ${
                              isOver
                                ? 'bg-rose-950 text-rose-300 border border-rose-700'
                                : isUnder
                                ? 'bg-sabrar-950 text-sabrar-300 border border-sabrar-500/40'
                                : 'bg-dark-800 text-slate-400 border border-dark-700'
                            }`}
                          >
                            {isOver && `+${h.variance_percent}%`}
                            {isUnder && `${h.variance_percent}%`}
                            {!isOver && !isUnder && '0%'}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <span className="font-mono font-bold text-xs bg-sabrar-950 text-sabrar-300 border border-sabrar-500/40 px-2 py-0.5 rounded-md">
                            {h.learned_adjustment_factor}x ({Math.round((h.learned_adjustment_factor - 1) * 100)}%)
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-16 px-6 text-center flex flex-col items-center justify-center">
              <div className="w-14 h-14 rounded-3xl bg-dark-800 border border-dark-700 flex items-center justify-center text-sabrar-400 mb-4 shadow-inner">
                <Database className="w-7 h-7" />
              </div>
              <h4 className="text-base font-bold text-white mb-1">
                Base de Calibração 100% Limpa e Pronta
              </h4>
              <p className="text-xs text-slate-400 max-w-md leading-relaxed mb-6">
                Todos os dados de teste foram removidos. A IA está aguardando os dados das obras reais da SABRAR através da <strong className="text-slate-200">Carga em Massa</strong> para calibrar os fatores empíricos.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={() => setIsDocModalOpen(true)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-sabrar-600 hover:bg-sabrar-500 text-white text-xs font-bold transition-all shadow-md shadow-sabrar-600/30 active:scale-95"
                >
                  <Sparkles className="w-4 h-4 text-sabrar-200" />
                  <span>Calibrar com Documentos de Obras</span>
                </button>

                <button
                  onClick={() => setIsBulkModalOpen(true)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-dark-800 hover:bg-dark-750 text-slate-200 border border-dark-700 text-xs font-bold transition-all active:scale-95"
                >
                  <Database className="w-4 h-4 text-slate-400" />
                  <span>Carga em Planilha</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal de Calibração Contínua por Documentos */}
      <AICalibrationModal
        isOpen={isDocModalOpen}
        onClose={() => setIsDocModalOpen(false)}
        onSuccess={loadData}
      />

      {/* Modal de Carga em Massa de Obras & Histórico */}
      <BulkImportModal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        onSuccess={loadData}
      />

      {/* Modal de Visualização do Prompt e Metodologia OP SABRAR */}
      <AIPromptModal
        isOpen={isPromptModalOpen}
        onClose={() => setIsPromptModalOpen(false)}
      />
    </div>
  );
};
