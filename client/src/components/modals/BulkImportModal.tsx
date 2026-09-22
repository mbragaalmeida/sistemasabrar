import React, { useState, useRef } from 'react';
import {
  FileSpreadsheet,
  UploadCloud,
  X,
  CheckCircle,
  AlertCircle,
  Download,
  Brain,
  TrendingUp,
  Layers,
  ArrowRight,
  Database,
  Building2,
  DollarSign
} from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const BulkImportModal: React.FC<BulkImportModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const { currentUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleDownloadTemplate = () => {
    api.downloadBulkTemplate();
  };

  const handleImport = async () => {
    if (!file) {
      setError('Por favor, selecione uma planilha Excel (.xlsx, .xls) ou CSV preenchida');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await api.uploadBulkData(file, currentUser?.id);
      setResult(res);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err.message || 'Erro ao processar carga em massa');
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-2xl bg-dark-900 border border-dark-750 rounded-3xl shadow-2xl overflow-hidden flex flex-col text-slate-100 max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-dark-850 border-b border-dark-750 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sabrar-950/80 border border-sabrar-500/40 flex items-center justify-center text-sabrar-400 shadow-inner">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-base text-white">Carga em Massa de Obras & Histórico Real</h3>
                <span className="text-[10px] font-bold uppercase bg-sabrar-950 text-sabrar-400 border border-sabrar-500/40 px-2 py-0.5 rounded-full">
                  Treinamento da IA
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Alimente o banco com dados de projetos, orçamentos e consumo real para refinar a IA da SABRAR
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-dark-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto">
          {error && (
            <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-2xl text-xs text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {!result ? (
            <>
              {/* Template Download Card */}
              <div className="p-4 bg-dark-850 border border-dark-750 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-sabrar-400" />
                    <span className="font-bold text-xs text-white">Planilha Modelo Oficial SABRAR (.xlsx)</span>
                  </div>
                  <p className="text-[11px] text-slate-400 max-w-md">
                    Baixe o modelo com 4 abas estruturadas (Obras, Levantamento Orçado, Consumo Real Final e Instruções) com exemplos práticos de HVAC.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-dark-800 hover:bg-dark-750 text-sabrar-300 border border-sabrar-500/30 text-xs font-bold transition-all shrink-0 active:scale-95 shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Baixar Modelo</span>
                </button>
              </div>

              {/* Explicação da Calibração da IA */}
              <div className="p-3.5 bg-sabrar-950/30 border border-sabrar-500/20 rounded-2xl flex items-start gap-2.5 text-xs text-slate-300">
                <Brain className="w-4 h-4 text-sabrar-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-bold text-white">Como a IA aprende com seus dados reais:</span>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    Ao importar o levantamento orçado e o consumo real ao término da obra, o sistema calcula a variação empírica por tipologia de obra e material (fatores de perda de recortes, rota e sobras), calibrando novas estimativas automaticamente.
                  </p>
                </div>
              </div>

              {/* File Upload Area */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-3xl p-6 sm:p-8 text-center cursor-pointer transition-all ${
                  file
                    ? 'border-sabrar-500/60 bg-sabrar-950/20'
                    : 'border-dark-700 hover:border-sabrar-500/40 bg-dark-850/50 hover:bg-dark-850'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="flex flex-col items-center gap-2">
                  <div className="w-12 h-12 rounded-2xl bg-dark-800 border border-dark-700 flex items-center justify-center text-sabrar-400 shadow-inner">
                    <UploadCloud className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="font-bold text-sm text-white">
                      {file ? file.name : 'Clique para selecionar ou arraste o arquivo aqui'}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {file ? formatFileSize(file.size) : 'Formatos aceitos: Microsoft Excel (.xlsx, .xls) ou CSV'}
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* Result Card */
            <div className="space-y-4 animate-in fade-in">
              <div className="p-4 bg-sabrar-950/40 border border-sabrar-500/40 rounded-3xl flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-sabrar-500/20 text-sabrar-400 flex items-center justify-center shrink-0">
                  <CheckCircle className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-black text-sm text-white">Carga Histórica Importada com Sucesso!</h4>
                  <p className="text-xs text-sabrar-300/80">
                    O motor de IA da SABRAR e os gráficos do painel administrativo foram calibrados com os dados reais.
                  </p>
                </div>
              </div>

              {/* Summary Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 bg-dark-850 rounded-2xl border border-dark-750">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Obras Criadas/Atualizadas</div>
                  <div className="text-xl font-black text-white mt-0.5">{result.projectsImported}</div>
                </div>
                <div className="p-3 bg-dark-850 rounded-2xl border border-dark-750">
                  <div className="text-[10px] font-bold text-purple-400 uppercase">Amostras IA Calibradas</div>
                  <div className="text-xl font-black text-purple-300 mt-0.5">{result.historicalRowsCreated}</div>
                </div>
                <div className="p-3 bg-dark-850 rounded-2xl border border-dark-750">
                  <div className="text-[10px] font-bold text-sabrar-400 uppercase">Receita Total Obras</div>
                  <div className="text-sm font-black text-sabrar-300 mt-1">
                    R$ {Number(result.totalRevenue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                  </div>
                </div>
                <div className="p-3 bg-dark-850 rounded-2xl border border-dark-750">
                  <div className="text-[10px] font-bold text-amber-400 uppercase">Custo Real Materiais</div>
                  <div className="text-sm font-black text-amber-300 mt-1">
                    R$ {Number(result.totalActualMaterialsCost || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                  </div>
                </div>
              </div>

              {/* Detalhe das Obras */}
              {result.projectDetails && result.projectDetails.length > 0 && (
                <div className="bg-dark-850 rounded-2xl border border-dark-750 overflow-hidden">
                  <div className="p-3 bg-dark-800/80 border-b border-dark-750 text-xs font-bold text-white flex items-center justify-between">
                    <span>Obras Processadas no Lote</span>
                    <span className="text-slate-400 font-normal text-[11px]">{result.projectDetails.length} obras</span>
                  </div>
                  <div className="divide-y divide-dark-750 max-h-48 overflow-y-auto">
                    {result.projectDetails.map((p: any) => (
                      <div key={p.id} className="p-3 flex items-center justify-between text-xs hover:bg-dark-800/40">
                        <div>
                          <div className="font-bold text-white">{p.code} — {p.name}</div>
                          <div className="text-[10px] text-slate-400">{p.type} • {p.itemsBudgeted} orçados • {p.itemsReal} consumidos</div>
                        </div>
                        <div className="text-right">
                          <div className="font-extrabold text-sabrar-300">
                            R$ {Number(p.revenue || 0).toLocaleString('pt-BR')}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            Margem: <span className="text-emerald-400 font-bold">{p.marginPercent}%</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-dark-850 border-t border-dark-750 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-slate-400 hover:text-white text-xs font-bold transition-colors"
          >
            {result ? 'Fechar' : 'Cancelar'}
          </button>

          {!result ? (
            <button
              type="button"
              onClick={handleImport}
              disabled={!file || loading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-sabrar-600 hover:bg-sabrar-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md shadow-sabrar-600/30 active:scale-95"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Processando Carga & Calibrando IA...</span>
                </>
              ) : (
                <>
                  <Brain className="w-4 h-4" />
                  <span>Processar Carga & Calibrar IA</span>
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-sabrar-600 hover:bg-sabrar-500 text-white text-xs font-bold transition-all shadow-md shadow-sabrar-600/30 active:scale-95"
            >
              <span>Ver Gráficos no Painel</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
