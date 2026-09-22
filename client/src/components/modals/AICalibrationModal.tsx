import React, { useState, useRef } from 'react';
import {
  X,
  UploadCloud,
  FileText,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Layers,
  ChevronRight,
  TrendingUp,
  Brain,
  Trash2,
  ArrowRight
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface AICalibrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AICalibrationModal: React.FC<AICalibrationModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const { currentUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setSelectedFiles(prev => [...prev, ...newFiles]);
      setError(null);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUploadAndCalibrate = async () => {
    if (selectedFiles.length === 0) {
      setError('Selecione ao menos um arquivo de projeto ou planilha de consumo.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      selectedFiles.forEach(file => {
        formData.append('files', file);
      });
      formData.append('userId', String(currentUser?.id || 1));

      const apiBase = (import.meta as any).env?.VITE_API_URL || '/api';
      const res = await fetch(`${apiBase}/ai-calibration/upload`, {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao processar calibração por documentos.');
      }

      setResult(data);
      onSuccess();
    } catch (err: any) {
      console.error('[AI Calibration Error]', err);
      setError(err.message || 'Erro inesperado ao calibrar IA.');
    } finally {
      setLoading(false);
    }
  };

  const resetAll = () => {
    setSelectedFiles([]);
    setResult(null);
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-dark-900 border border-dark-750 rounded-3xl shadow-2xl overflow-hidden my-6">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-dark-800 bg-dark-850/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sabrar-950/80 border border-sabrar-500/40 flex items-center justify-center text-sabrar-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-white tracking-tight flex items-center gap-2">
                Calibração da IA por Documentos de Obras
                <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded-full bg-sabrar-500/20 text-sabrar-400 border border-sabrar-500/30">
                  Automático
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Alimente o motor de IA com plantas, memoriais (PDF) e/ou relatórios de consumo real (XLSX)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-dark-800 hover:bg-dark-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-5 max-h-[72vh] overflow-y-auto">
          {error && (
            <div className="p-3.5 bg-rose-950/40 border border-rose-800/60 rounded-2xl flex items-center gap-2.5 text-xs text-rose-300">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {!result ? (
            <>
              {/* Dropzone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="group border-2 border-dashed border-dark-700 hover:border-sabrar-500 rounded-3xl p-6 sm:p-8 text-center cursor-pointer transition-all bg-dark-850/40 hover:bg-dark-850/70"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.xlsx,.xls,.csv"
                  onChange={handleFileChange}
                  className="hidden"
                />

                <div className="w-12 h-12 rounded-2xl bg-dark-800 group-hover:bg-sabrar-950 border border-dark-700 group-hover:border-sabrar-500/40 flex items-center justify-center text-slate-400 group-hover:text-sabrar-400 mx-auto transition-colors">
                  <UploadCloud className="w-6 h-6" />
                </div>

                <div className="mt-3 text-sm font-bold text-white">
                  Clique ou arraste arquivos de obras para cá
                </div>
                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                  Suporta arquivos técnicos em <span className="text-slate-200 font-semibold">PDF</span> (plantas, memoriais) e planilhas em <span className="text-slate-200 font-semibold">XLSX/CSV</span> (levantamentos e consumos reais).
                </p>

                <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
                  <span className="px-2.5 py-1 text-[11px] rounded-xl bg-dark-800 border border-dark-700 text-slate-300 font-mono">
                    .PDF (Plantas & Memoriais)
                  </span>
                  <span className="px-2.5 py-1 text-[11px] rounded-xl bg-dark-800 border border-dark-700 text-slate-300 font-mono">
                    .XLSX (Planilhas de Medição)
                  </span>
                  <span className="px-2.5 py-1 text-[11px] rounded-xl bg-dark-800 border border-dark-700 text-slate-300 font-mono">
                    Múltiplas Obras em Lote
                  </span>
                </div>
              </div>

              {/* Arquivos Selecionados */}
              {selectedFiles.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-400 px-1">
                    <span>Arquivos Selecionados ({selectedFiles.length})</span>
                    <button
                      onClick={resetAll}
                      className="text-rose-400 hover:text-rose-300 text-[11px] font-semibold"
                    >
                      Limpar todos
                    </button>
                  </div>

                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {selectedFiles.map((file, idx) => {
                      const isPdf = file.name.toLowerCase().endsWith('.pdf');
                      return (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2.5 bg-dark-850 rounded-2xl border border-dark-750 text-xs"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                              isPdf ? 'bg-rose-950/60 text-rose-400 border border-rose-800/40' : 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40'
                            }`}>
                              {isPdf ? <FileText className="w-4 h-4" /> : <FileSpreadsheet className="w-4 h-4" />}
                            </div>
                            <div className="truncate">
                              <div className="font-semibold text-white truncate">{file.name}</div>
                              <div className="text-[10px] text-slate-400">
                                {(file.size / 1024).toFixed(1)} KB • {isPdf ? 'Documento Técnico' : 'Planilha de Dados'}
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={() => removeFile(idx)}
                            className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-dark-800 transition-colors shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Informação sobre como a IA processa */}
              <div className="p-3.5 bg-dark-850/60 border border-dark-750 rounded-2xl text-xs text-slate-400 space-y-1">
                <div className="font-bold text-slate-200 flex items-center gap-1.5">
                  <Brain className="w-4 h-4 text-sabrar-400" />
                  Como o Aprendizado Funciona
                </div>
                <p className="leading-relaxed">
                  A IA agrupa os arquivos por obra, detecta automaticamente os materiais cotados e compara as quantidades previstas com o consumo real final registrado. A variação percentual gera novos fatores empíricos que são utilizados nas próximas cotações de forma 100% prospectiva.
                </p>
              </div>
            </>
          ) : (
            /* Resultados da Calibração */
            <div className="space-y-4">
              <div className="p-4 bg-emerald-950/30 border border-emerald-800/50 rounded-3xl flex items-start gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-black text-emerald-200 text-sm">
                    {result.message || 'Calibração Concluída com Sucesso!'}
                  </div>
                  <div className="text-xs text-emerald-300/80 mt-1">
                    {result.projectsCalibratedCount} obra(s) processada(s) e {result.recordsAddedCount} registros alimentados na base de aprendizado.
                  </div>
                </div>
              </div>

              {/* Obras Calibradas */}
              {result.projects && result.projects.length > 0 && (
                <div className="space-y-3">
                  <div className="text-xs font-bold text-slate-300 uppercase tracking-wider px-1">
                    Detalhamento por Obra
                  </div>

                  {result.projects.map((p: any, idx: number) => (
                    <div key={idx} className="p-4 bg-dark-850 rounded-2xl border border-dark-750 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-black text-white text-sm">{p.projectName}</div>
                          <div className="text-xs text-sabrar-400 font-mono mt-0.5">
                            {p.projectCode} • {p.projectType} • {p.filesCount} arquivo(s)
                          </div>
                        </div>
                        <span className="px-2.5 py-1 rounded-xl bg-sabrar-500/20 text-sabrar-300 border border-sabrar-500/30 text-xs font-bold">
                          {p.itemsCalibratedCount} itens calibrados
                        </span>
                      </div>

                      {/* Tabela de Amostras de Materiais */}
                      {p.items && p.items.length > 0 && (
                        <div className="overflow-x-auto rounded-xl border border-dark-750">
                          <table className="w-full text-[11px] text-left">
                            <thead className="bg-dark-800 text-slate-400 font-bold uppercase">
                              <tr>
                                <th className="p-2">Material</th>
                                <th className="p-2 text-center">Previsto</th>
                                <th className="p-2 text-center">Consumo Real</th>
                                <th className="p-2 text-center">Desvio</th>
                                <th className="p-2 text-center">Fator IA</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-dark-750 text-slate-200 font-mono">
                              {p.items.slice(0, 8).map((it: any, iIdx: number) => {
                                const isOver = it.variancePercent > 0;
                                return (
                                  <tr key={iIdx} className="hover:bg-dark-800/50">
                                    <td className="p-2 font-sans font-semibold text-white truncate max-w-[180px]">
                                      {it.materialName}
                                    </td>
                                    <td className="p-2 text-center">
                                      {it.budgetedQty} {it.unit}
                                    </td>
                                    <td className="p-2 text-center font-bold">
                                      {it.realQty} {it.unit}
                                    </td>
                                    <td className={`p-2 text-center font-bold ${isOver ? 'text-amber-400' : 'text-emerald-400'}`}>
                                      {isOver ? `+${it.variancePercent}%` : `${it.variancePercent}%`}
                                    </td>
                                    <td className="p-2 text-center text-sabrar-300 font-bold">
                                      {it.learnedFactor}x
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                          {p.items.length > 8 && (
                            <div className="p-2 text-center text-[10px] text-slate-400 bg-dark-800/40">
                              + {p.items.length - 8} outros materiais calibrados
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between p-5 sm:p-6 border-t border-dark-800 bg-dark-850/50">
          {!result ? (
            <>
              <button
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2.5 rounded-2xl bg-dark-800 hover:bg-dark-750 text-slate-300 text-xs font-bold transition-all disabled:opacity-50"
              >
                Cancelar
              </button>

              <button
                onClick={handleUploadAndCalibrate}
                disabled={loading || selectedFiles.length === 0}
                className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-sabrar-600 hover:bg-sabrar-500 text-white text-xs font-black transition-all shadow-lg shadow-sabrar-600/30 active:scale-95 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Processando Documentos com IA...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Calibrar IA com Documentos</span>
                  </>
                )}
              </button>
            </>
          ) : (
            <div className="flex items-center justify-between w-full">
              <button
                onClick={resetAll}
                className="px-4 py-2 rounded-xl bg-dark-800 hover:bg-dark-700 text-slate-300 text-xs font-bold transition-all"
              >
                Calibrar Mais Documentos
              </button>

              <button
                onClick={onClose}
                className="px-5 py-2.5 rounded-2xl bg-sabrar-600 hover:bg-sabrar-500 text-white text-xs font-black transition-all shadow-md shadow-sabrar-600/30"
              >
                Concluir
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
