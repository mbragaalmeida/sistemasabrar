import React, { useState, useRef } from 'react';
import { Sparkles, Check, ArrowRight, FileText, Cpu, AlertCircle, RefreshCw, X, ShieldCheck, UploadCloud, Trash2 } from 'lucide-react';
import { api } from '../../services/api';
import { AIAnalysisResult } from '../../types';
import { useAuth } from '../../context/AuthContext';

interface AIAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: number;
  projectName: string;
  onAnalysisComplete?: (result: AIAnalysisResult) => void;
}

export const AIAnalysisModal: React.FC<AIAnalysisModalProps> = ({
  isOpen,
  onClose,
  projectId,
  projectName,
  onAnalysisComplete
}) => {
  const { currentUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [customText, setCustomText] = useState('');
  const [step, setStep] = useState<'input' | 'processing' | 'result'>('input');
  const [progressStage, setProgressStage] = useState(1);
  const [result, setResult] = useState<AIAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const newFiles = Array.from(e.target.files);
    setUploadedFiles(prev => [...prev, ...newFiles]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleRunAnalysis = async () => {
    setError(null);
    setLoading(true);
    setStep('processing');
    setProgressStage(1);

    const timer1 = setTimeout(() => setProgressStage(2), 700);
    const timer2 = setTimeout(() => setProgressStage(3), 1500);

    try {
      // 1. Se o usuário anexou arquivos na hora, envia ao servidor
      if (uploadedFiles.length > 0) {
        await api.uploadProjectFiles(projectId, uploadedFiles, false);
      }

      // 2. Dispara a análise profunda
      const data = await api.analyzeProject(projectId, customText, currentUser?.id);
      setTimeout(() => {
        setProgressStage(4);
        setResult(data);
        setStep('result');
        setLoading(false);
        if (onAnalysisComplete) onAnalysisComplete(data);
      }, 2200);
    } catch (err: any) {
      clearTimeout(timer1);
      clearTimeout(timer2);
      setError(err.message || 'Erro ao processar análise de IA');
      setStep('input');
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-3xl bg-dark-900 border border-dark-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-slate-100">
        {/* Header com estilo escuro e verde Sabrar */}
        <div className="p-4 sm:p-5 bg-dark-850 border-b border-dark-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sabrar-950/80 border border-sabrar-500/40 flex items-center justify-center text-sabrar-400 shadow-inner">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-extrabold text-base sm:text-lg">Análise Técnica com IA</h2>
                <span className="text-[10px] uppercase font-bold bg-sabrar-950 text-sabrar-400 border border-sabrar-500/40 px-2 py-0.5 rounded-full">
                  AI Analysis Service
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate max-w-xs sm:max-w-md">
                Projeto: <span className="text-white font-semibold">{projectName}</span>
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

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          {/* STEP 1: Input / Document Upload */}
          {step === 'input' && (
            <div className="space-y-4">
              <div className="bg-dark-850 border border-dark-700 p-4 rounded-2xl">
                <div className="font-bold text-white text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4 text-sabrar-400 shrink-0" />
                  Upload de Documentos & Memorial Descritivo para Análise
                </div>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  A IA lerá os documentos técnicos anexados, identificará as especificações de climatização, elétrica e civil,
                  extrairá as quantidades necessárias e justificará tecnicamente cada item com base na engenharia e no histórico de consumo real da SABRAR.
                </p>
              </div>

              {/* Botão de Upload de Documentos */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.dwg,.dxf,.docx,.doc,.txt,.xlsx,.xls,.csv,.ods,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,*"
                onChange={handleFilesSelected}
                className="hidden"
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                className="group cursor-pointer p-4 rounded-2xl bg-dark-850 border-2 border-dashed border-dark-700 hover:border-sabrar-500/60 transition-all flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-dark-800 border border-dark-700 flex items-center justify-center text-sabrar-400 group-hover:scale-110 transition-transform shrink-0">
                    <UploadCloud className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs sm:text-sm font-bold text-white group-hover:text-sabrar-400 transition-colors">
                      Upload de Documentos, Memoriais ou Planilhas (PDF, Excel .xlsx, DWG, DOCX)
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Suporta documentos e planilhas de levantamento para leitura e calibração imediata da IA
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="px-4 py-2 rounded-xl bg-sabrar-600 hover:bg-sabrar-500 text-white text-xs font-bold transition-all shadow-md shadow-sabrar-600/30 shrink-0"
                >
                  Selecionar Arquivos
                </button>
              </div>

              {/* Arquivos selecionados */}
              {uploadedFiles.length > 0 && (
                <div className="space-y-1.5 p-3 rounded-2xl bg-dark-850 border border-dark-700">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-sabrar-400">
                    Arquivos Anexados para esta Análise ({uploadedFiles.length}):
                  </div>
                  {uploadedFiles.map((file, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs p-2 rounded-xl bg-dark-900 border border-dark-750">
                      <div className="flex items-center gap-2 truncate">
                        <FileText className="w-4 h-4 text-sabrar-400 shrink-0" />
                        <span className="font-semibold text-white truncate">{file.name}</span>
                        <span className="text-[10px] text-slate-500 font-mono">({formatFileSize(file.size)})</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveFile(idx)}
                        className="p-1 text-slate-400 hover:text-rose-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Observações textuais complementares opcionais */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Notas / Especificações Complementares (Opcional)
                </label>
                <textarea
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  placeholder="Informações pontuais adicionais (ex: 'considerar pé direito duplo na recepção e dutos circulares expostos')..."
                  rows={3}
                  className="w-full text-xs p-3 rounded-2xl border border-dark-700 bg-dark-850 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sabrar-500 leading-relaxed"
                />
              </div>

              {error && (
                <div className="p-3 bg-rose-950/50 border border-rose-800 text-rose-300 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Processing Animation */}
          {step === 'processing' && (
            <div className="py-12 px-4 flex flex-col items-center justify-center space-y-6">
              <div className="relative">
                <div className="w-20 h-20 rounded-full border-4 border-dark-700 border-t-sabrar-500 animate-spin flex items-center justify-center"></div>
                <Cpu className="w-8 h-8 text-sabrar-400 absolute inset-0 m-auto animate-pulse" />
              </div>

              <div className="text-center space-y-2 max-w-sm">
                <h3 className="font-bold text-white text-base">Processando Inteligência Operacional</h3>
                <p className="text-xs text-slate-400">
                  Lendo documentos, cruzando especificações com a Base Central e calibrando quantidades...
                </p>
              </div>

              {/* Progress Stepper */}
              <div className="w-full max-w-md space-y-2.5 bg-dark-850 p-4 rounded-2xl border border-dark-700 text-xs">
                <div className={`flex items-center gap-2.5 ${progressStage >= 1 ? 'text-sabrar-400 font-bold' : 'text-slate-500'}`}>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${progressStage >= 1 ? 'bg-sabrar-600 text-white font-bold' : 'bg-dark-800 text-slate-500'}`}>
                    1
                  </div>
                  <span>Leitura dos Documentos Técnicos & Memorial Descritivo</span>
                </div>
                <div className={`flex items-center gap-2.5 ${progressStage >= 2 ? 'text-sabrar-400 font-bold' : 'text-slate-500'}`}>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${progressStage >= 2 ? 'bg-sabrar-600 text-white font-bold' : 'bg-dark-800 text-slate-500'}`}>
                    2
                  </div>
                  <span>Cruzamento semântico com a Base Central de Materiais SABRAR</span>
                </div>
                <div className={`flex items-center gap-2.5 ${progressStage >= 3 ? 'text-sabrar-400 font-bold' : 'text-slate-500'}`}>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${progressStage >= 3 ? 'bg-sabrar-600 text-white font-bold' : 'bg-dark-800 text-slate-500'}`}>
                    3
                  </div>
                  <span>Consulta ao Motor de Aprendizado Contínuo (calibração histórica)</span>
                </div>
                <div className={`flex items-center gap-2.5 ${progressStage >= 4 ? 'text-emerald-400 font-bold' : 'text-slate-500'}`}>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${progressStage >= 4 ? 'bg-emerald-600 text-white font-bold' : 'bg-dark-800 text-slate-500'}`}>
                    4
                  </div>
                  <span>Geração da tabela de sugestão com Explicabilidade Técnica</span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Results Table with Explainability */}
          {step === 'result' && result && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Summary Banner */}
              <div className="p-4 bg-dark-850 border border-sabrar-500/40 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-sabrar-400 bg-sabrar-950 px-2 py-0.5 rounded-full border border-sabrar-500/30">
                      Análise Concluída com Sucesso
                    </span>
                  </div>
                  <h3 className="font-extrabold text-base text-white mt-1">
                    {result.materials.length} Materiais Técnicos Identificados
                  </h3>
                  <p className="text-xs text-slate-400">
                    Previsões calibradas com base nos dados reais de obras anteriores (Regras 24-28).
                  </p>
                </div>

                <div className="text-right self-end sm:self-center bg-dark-900 px-4 py-2 rounded-xl border border-dark-700">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Total Estimado Materiais</div>
                  <div className="text-xl font-black text-sabrar-400">
                    R$ {result.totalEstimatedMaterialsCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              {/* Materials Table */}
              <div className="border border-dark-700 rounded-2xl overflow-hidden bg-dark-850">
                <div className="p-3 bg-dark-800 border-b border-dark-700 text-xs font-bold text-slate-300">
                  Lista de Materiais Sugeridos & Justificativa Técnica
                </div>

                <div className="divide-y divide-dark-700 max-h-[360px] overflow-y-auto">
                  {result.materials.map((m, idx) => (
                    <div key={idx} className="p-3 hover:bg-dark-800/60 transition-colors text-xs space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="font-bold text-white text-sm">{m.material}</span>
                          <span className="ml-2 font-mono text-[11px] text-slate-400 bg-dark-800 px-1.5 py-0.5 rounded border border-dark-700">
                            {m.materialCode}
                          </span>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-black text-white">
                            {m.quantity} {m.unit}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            R$ {m.subtotal.toFixed(2)} (R$ {m.unitPrice.toFixed(2)}/{m.unit})
                          </div>
                        </div>
                      </div>

                      {/* Explicabilidade da IA */}
                      <div className="p-2 rounded-xl bg-dark-900 border border-dark-750 text-[11px] text-slate-300 leading-relaxed">
                        <span className="font-bold text-sabrar-400">Justificativa da IA: </span>
                        {m.reason}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-dark-850 border-t border-dark-700 flex items-center justify-between">
          {step === 'input' && (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2.5 rounded-2xl border border-dark-700 text-slate-300 text-xs font-bold hover:bg-dark-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleRunAnalysis}
                disabled={loading}
                className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-sabrar-600 hover:bg-sabrar-500 text-white text-xs font-bold shadow-lg shadow-sabrar-600/30 transition-all disabled:opacity-50 active:scale-95"
              >
                <Sparkles className="w-4 h-4" />
                <span>Iniciar Análise dos Documentos</span>
              </button>
            </>
          )}

          {step === 'result' && (
            <>
              <button
                onClick={() => setStep('input')}
                className="flex items-center gap-1.5 px-4 py-2 rounded-2xl border border-dark-700 text-slate-300 text-xs font-bold hover:bg-dark-800"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Nova Análise</span>
              </button>
              <button
                onClick={onClose}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-2xl bg-sabrar-600 hover:bg-sabrar-500 text-white text-xs font-bold shadow-lg shadow-sabrar-600/30 active:scale-95"
              >
                <Check className="w-4 h-4" />
                <span>Incorporar ao Orçamento do Projeto</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
