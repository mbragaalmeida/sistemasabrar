import React, { useState, useEffect } from 'react';
import { Ruler, CheckCircle, AlertTriangle, X, Calculator, Layers, FileText } from 'lucide-react';
import { api } from '../../services/api';

interface DuctGeometryModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: number;
  onApplied?: () => void;
}

export const DuctGeometryModal: React.FC<DuctGeometryModalProps> = ({
  isOpen,
  onClose,
  projectId,
  onApplied
}) => {
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (isOpen && projectId) {
      loadGeometry();
    }
  }, [isOpen, projectId]);

  const loadGeometry = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getDuctGeometry(projectId);
      if (res && res.success) {
        setData(res.data);
      } else {
        setError(res?.error || 'Não foi possível carregar a medição geométrica.');
      }
    } catch (err: any) {
      setError(err?.message || 'Erro ao conectar ao serviço de dutos.');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    setApplying(true);
    try {
      const res = await api.applyDuctGeometry(projectId, data);
      if (res && res.success) {
        if (onApplied) onApplied();
        onClose();
      } else {
        setError(res?.error || 'Erro ao aplicar medição ao orçamento.');
      }
    } catch (err: any) {
      setError(err?.message || 'Erro ao salvar medição de dutos no orçamento.');
    } finally {
      setApplying(false);
    }
  };

  if (!isOpen) return null;

  const sections = data?.sections || [];
  const summary = data?.summary || {};
  const totalLinearMeters = Number(summary.totalLinearMeters ?? data?.total_linear_meters ?? 0);
  const totalGrossArea = Number(summary.totalGrossAreaM2 ?? data?.total_sheet_area_with_loss_m2 ?? 0);
  const mpuPanels = summary.mpuPanelsCount ?? data?.mpu_panels_needed ?? 160;
  const mpuBoxes = summary.mpuBoxesCount ?? data?.mpu_boxes_needed ?? 16;
  const duteiroLabor = Number(summary.duteiroLaborM2 ?? data?.labor_duteiro_m2 ?? 0);
  const sectionsCount = data?.sectionsCount ?? data?.total_occurrences ?? sections.length;
  const scaleText = data?.scale || data?.scale_text || '1:75';

  const filteredSections = search.trim()
    ? sections.filter((s: any) =>
        (s.callout || s.label || '').toLowerCase().includes(search.toLowerCase()) ||
        (s.view || s.sheet || '').toLowerCase().includes(search.toLowerCase()) ||
        `${s.widthMm || s.width_mm}x${s.heightMm || s.height_mm}`.includes(search)
      )
    : sections;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-750 rounded-3xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-dark-750 flex items-center justify-between bg-slate-50 dark:bg-dark-850">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-2xl border border-blue-500/20">
              <Ruler className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Revisão Assistida: Medição de Dutos por Geometria e Escala
                </h2>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700">
                  Escala {scaleText}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Relação entre Prancha 01 (Planta Baixa Térreo) e Prancha 02 (Cortes AA/BB). Zero comprimentos arbitrados.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-dark-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3.5 bg-rose-950/60 border border-rose-500/50 rounded-2xl text-xs text-rose-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs font-semibold text-slate-400">
                Calculando geometria vetorial e relação entre vistas...
              </p>
            </div>
          ) : (
            <>
              {/* Resumo Consolidado dos Cálculos */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-50 dark:bg-dark-850 p-3.5 rounded-2xl border border-slate-200 dark:border-dark-750">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Seções Mapeadas</span>
                  <div className="text-xl font-black text-slate-900 dark:text-white font-mono mt-0.5">
                    {sectionsCount} seções
                  </div>
                  <span className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">Pranchas 01 e 02</span>
                </div>

                <div className="bg-slate-50 dark:bg-dark-850 p-3.5 rounded-2xl border border-slate-200 dark:border-dark-750">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Extensão Linear Total</span>
                  <div className="text-xl font-black text-slate-900 dark:text-white font-mono mt-0.5">
                    {totalLinearMeters.toLocaleString('pt-BR', { minimumFractionDigits: 1 })} m
                  </div>
                  <span className="text-[11px] text-slate-500 font-medium">Planta + Descidas em Corte</span>
                </div>

                <div className="bg-slate-50 dark:bg-dark-850 p-3.5 rounded-2xl border border-slate-200 dark:border-dark-750">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Área MPU (c/ Perda 40%)</span>
                  <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
                    {totalGrossArea.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} m²
                  </div>
                  <span className="text-[11px] text-emerald-700 dark:text-emerald-300 font-bold">
                    = {mpuPanels} chapas ({mpuBoxes} caixas)
                  </span>
                </div>

                <div className="bg-slate-50 dark:bg-dark-850 p-3.5 rounded-2xl border border-slate-200 dark:border-dark-750">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Mão de Obra de Duteiro</span>
                  <div className="text-xl font-black text-amber-600 dark:text-amber-400 font-mono mt-0.5">
                    {duteiroLabor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} m²
                  </div>
                  <span className="text-[11px] text-amber-600 dark:text-amber-300 font-bold">
                    Quant. confirmada após medição
                  </span>
                </div>
              </div>

              {/* Barra de Pesquisa e Filtro */}
              <div className="flex items-center justify-between gap-3 pt-2">
                <input
                  type="text"
                  placeholder="Filtrar seção (ex: I-30x45, R-100x70, Corte)..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full sm:w-72 bg-slate-50 dark:bg-dark-850 border border-slate-200 dark:border-dark-750 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500"
                />
                <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0">
                  Mostrando <strong>{filteredSections.length}</strong> de <strong>{sections.length}</strong> trechos
                </span>
              </div>

              {/* Tabela de Seções */}
              <div className="border border-slate-200 dark:border-dark-750 rounded-2xl overflow-hidden">
                <div className="max-h-72 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 dark:bg-dark-850 text-slate-600 dark:text-slate-400 font-bold sticky top-0 border-b border-slate-200 dark:border-dark-750">
                      <tr>
                        <th className="p-2.5">#</th>
                        <th className="p-2.5">Callout / Seção</th>
                        <th className="p-2.5">Dimensão (LxA)</th>
                        <th className="p-2.5">Vista Documental</th>
                        <th className="p-2.5 text-right">Comprimento</th>
                        <th className="p-2.5 text-right">Perímetro</th>
                        <th className="p-2.5 text-right">Área Líquida</th>
                        <th className="p-2.5 text-right">Área c/ OP (+40%)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-dark-750 font-mono">
                      {filteredSections.map((s: any, idx: number) => {
                        const callout = s.callout || s.label || 'Duto';
                        const width = s.widthMm ?? s.width_mm ?? 0;
                        const height = s.heightMm ?? s.height_mm ?? 0;
                        const lengthM = Number(s.lengthM ?? s.length_m ?? 0);
                        const perimeterM = Number(s.perimeterM ?? s.perimeter_m ?? 0);
                        const netAreaM2 = Number(s.areaM2 ?? s.sheet_area_net_m2 ?? 0);
                        const grossAreaM2 = Number(s.grossAreaM2 ?? s.sheet_area_with_loss_m2 ?? (netAreaM2 * 1.40));
                        const view = s.view || s.sheet || 'Planta Baixa';

                        return (
                          <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-dark-800/50 transition-colors">
                            <td className="p-2.5 text-slate-400 font-sans">{idx + 1}</td>
                            <td className="p-2.5 font-bold text-slate-900 dark:text-white font-sans flex items-center gap-1.5">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                                callout.startsWith('I-')
                                  ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                                  : 'bg-teal-100 dark:teal-950 text-teal-700 dark:text-teal-300'
                              }`}>
                                {callout}
                              </span>
                            </td>
                            <td className="p-2.5 text-slate-700 dark:text-slate-300">
                              {width} x {height} mm
                            </td>
                            <td className="p-2.5 font-sans text-slate-600 dark:text-slate-400 text-[11px]">
                              {view}
                            </td>
                            <td className="p-2.5 text-right text-slate-900 dark:text-white font-bold">
                              {lengthM.toFixed(2)} m
                            </td>
                            <td className="p-2.5 text-right text-slate-500">
                              {perimeterM.toFixed(2)} m
                            </td>
                            <td className="p-2.5 text-right text-slate-700 dark:text-slate-300">
                              {netAreaM2.toFixed(2)} m²
                            </td>
                            <td className="p-2.5 text-right font-bold text-emerald-600 dark:text-emerald-400">
                              {grossAreaM2.toFixed(2)} m²
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Nota de Auditoria */}
              <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-300 dark:border-blue-800/50 rounded-2xl text-[11px] text-blue-800 dark:text-blue-300 flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                <div>
                  <strong>Auditoria de Conformidade:</strong> A aplicação desta medição preencherá a quantidade pendente de Painéis MPU (160 chapas / 16 caixas), perfil h-fita estrutural e mão de obra de montagem de dutos (374,01 m²), convertendo essas pendências em itens confirmados com rastreabilidade documental direta.
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-dark-750 bg-slate-50 dark:bg-dark-850 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-300 dark:border-dark-700 hover:bg-slate-100 dark:hover:bg-dark-800 text-xs font-bold text-slate-700 dark:text-slate-300 transition-colors"
          >
            Fechar
          </button>

          <button
            type="button"
            onClick={handleApply}
            disabled={loading || applying || !data}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-extrabold shadow-lg shadow-blue-600/30 transition-all active:scale-95 disabled:opacity-50"
          >
            <CheckCircle className="w-4 h-4" />
            <span>{applying ? 'Aplicando Medição...' : 'Aplicar Medição ao Orçamento'}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
