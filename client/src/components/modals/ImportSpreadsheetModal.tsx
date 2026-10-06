import React, { useState, useRef } from 'react';
import { FileSpreadsheet, UploadCloud, X, CheckCircle, AlertCircle, Sparkles, ArrowRight } from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

interface ImportSpreadsheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: number;
  projectName: string;
  onSuccess?: () => void;
}

export const ImportSpreadsheetModal: React.FC<ImportSpreadsheetModalProps> = ({
  isOpen,
  onClose,
  projectId,
  projectName,
  onSuccess
}) => {
  const { currentUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [files, setFiles] = useState<File[]>([]);
  const [mode, setMode] = useState<'append' | 'replace'>('replace');
  const [loading, setLoading] = useState(false);
  const [progressText, setProgressText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<any | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setFiles(prev => {
        // Evita adicionar o mesmo arquivo repetido por nome
        const existingNames = new Set(prev.map(f => f.name));
        const filteredNew = newFiles.filter(f => !existingNames.has(f.name));
        return [...prev, ...filteredNew];
      });
      setError(null);
    }
  };

  const handleRemoveFile = (idx: number) => {
    setFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const handleImport = async () => {
    if (files.length === 0) {
      setError('Por favor, selecione ao menos uma planilha Excel (.xlsx, .xls) ou CSV');
      return;
    }

    setLoading(true);
    setError(null);
    setProgressText(`Preparando ${files.length} planilha(s)...`);

    try {
      const res = await api.importProjectSpreadsheet(
        projectId,
        files,
        currentUser?.id,
        mode,
        (current, total, fileName) => {
          setProgressText(`Processando planilha ${current} de ${total}: "${fileName}"...`);
        }
      );
      setSuccessData(res);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err.message || 'Erro ao processar planilha de levantamento');
    } finally {
      setLoading(false);
      setProgressText(null);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-2xl bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col text-slate-900 dark:text-slate-100 max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-slate-50 dark:bg-dark-850 border-b border-slate-200 dark:border-dark-700 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-sabrar-950/80 border border-emerald-300 dark:border-sabrar-500/40 flex items-center justify-center text-emerald-700 dark:text-sabrar-400 shadow-inner">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                  Importar Planilha(s) de Levantamento Real
                </h3>
                <span className="text-[10px] font-bold uppercase bg-emerald-100 dark:bg-sabrar-950 text-emerald-800 dark:text-sabrar-400 border border-emerald-300 dark:border-sabrar-500/40 px-2 py-0.5 rounded-full">
                  Suporta Múltiplas Planilhas
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">{projectName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-dark-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto">
          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800/60 rounded-2xl text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {loading && progressText && (
            <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-700/60 rounded-2xl flex items-center gap-3 text-xs text-emerald-900 dark:text-emerald-200 shadow-sm animate-pulse">
              <div className="w-4 h-4 border-2 border-emerald-600 dark:border-emerald-400 border-t-transparent rounded-full animate-spin shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="font-bold">{progressText}</span>
                <p className="text-[10px] text-emerald-700 dark:text-emerald-300/80 mt-0.5">
                  Processando planilhas de forma segura e calibrando a base de dados SABRAR.
                </p>
              </div>
            </div>
          )}

          {successData ? (
            <div className="space-y-4 py-2 text-center">
              <div className="w-16 h-16 rounded-3xl bg-emerald-50 dark:bg-sabrar-950 border-2 border-emerald-500 dark:border-sabrar-500/50 flex items-center justify-center mx-auto text-emerald-600 dark:text-sabrar-400 shadow-lg shadow-emerald-500/20">
                <CheckCircle className="w-8 h-8" />
              </div>

              <div>
                <h4 className="text-base font-extrabold text-slate-900 dark:text-white">
                  {files.length > 1
                    ? `${files.length} Planilhas Importadas e Mescladas com Sucesso!`
                    : 'Planilha Importada e IA Calibrada com Sucesso!'}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                  A relação de materiais foi atualizada no orçamento da obra mantendo os custos reais e alimentando o Motor de Aprendizado Contínuo.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-lg mx-auto text-left">
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-dark-850 border border-slate-200 dark:border-dark-750">
                  <div className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Total de Materiais</div>
                  <div className="text-base font-black text-slate-900 dark:text-white">
                    {successData.totalItemsInBudget || successData.itemsCount} itens
                  </div>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-dark-850 border border-slate-200 dark:border-dark-750">
                  <div className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Custo Total Materiais</div>
                  <div className="text-base font-black text-emerald-600 dark:text-sabrar-400">
                    R$ {Number(successData.totalMaterials || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-dark-850 border border-slate-200 dark:border-dark-750 col-span-2 sm:col-span-1">
                  <div className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Orçamento Final</div>
                  <div className="text-base font-black text-slate-900 dark:text-white font-mono">
                    R$ {Number(successData.totalFinal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-sabrar-950/60 border border-emerald-300 dark:border-sabrar-500/30 text-xs text-emerald-900 dark:text-sabrar-300 space-y-1.5 font-semibold">
                <div className="flex items-center justify-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-600 dark:text-sabrar-400 shrink-0" />
                  <span>{successData.calibratedCount || successData.itemsCount} fatores de calibração registrados no histórico da IA.</span>
                </div>
                {successData.sheetsNames && successData.sheetsNames.length > 0 && (
                  <div className="text-[11px] text-slate-600 dark:text-slate-400 font-normal">
                    <span className="font-semibold text-slate-800 dark:text-slate-300">Abas processadas: </span>
                    {successData.sheetsNames.join(' • ')}
                  </div>
                )}
              </div>

              <button
                onClick={onClose}
                className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/30 active:scale-95"
              >
                Concluir e Ver Orçamento Atualizado
              </button>
            </div>
          ) : (
            <>
              {/* Informativo de Múltiplas Planilhas e Calibração */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-dark-850 border border-slate-200 dark:border-dark-750 space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                  <Sparkles className="w-4 h-4 text-emerald-600 dark:text-sabrar-400" />
                  <span>Projetos com múltiplas planilhas executivas (ex: Dutos, VRF, Água Gelada):</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                  Você pode selecionar uma ou várias planilhas simultaneamente. O sistema lê as abas executivas, preserva rigorosamente os preços unitários e subtotais levantados manualmente e mescla todos os materiais no orçamento da obra.
                </p>
              </div>

              {/* Opção de Modo de Importação */}
              <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-dark-850 border border-slate-200 dark:border-dark-750 space-y-2">
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Como deseja tratar os dados já existentes no orçamento?
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <label
                    onClick={() => setMode('replace')}
                    className={`cursor-pointer p-2.5 rounded-xl border flex items-start gap-2.5 transition-all ${
                      mode === 'replace'
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-950 dark:text-white ring-1 ring-emerald-500'
                        : 'border-slate-300 dark:border-dark-700 bg-white dark:bg-dark-900 text-slate-700 dark:text-slate-400 hover:border-slate-400'
                    }`}
                  >
                    <input
                      type="radio"
                      name="importMode"
                      checked={mode === 'replace'}
                      onChange={() => setMode('replace')}
                      className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <strong className="block text-xs font-bold">Substituir Orçamento Atual</strong>
                        <span className="text-[9px] uppercase font-bold px-1.5 py-0.2 bg-emerald-200 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 rounded">Padrão</span>
                      </div>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        Substitui a lista pelo levantamento desta planilha, evitando duplicidades.
                      </span>
                    </div>
                  </label>

                  <label
                    onClick={() => setMode('append')}
                    className={`cursor-pointer p-2.5 rounded-xl border flex items-start gap-2.5 transition-all ${
                      mode === 'append'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-950 dark:text-white ring-1 ring-blue-500'
                        : 'border-slate-300 dark:border-dark-700 bg-white dark:bg-dark-900 text-slate-700 dark:text-slate-400 hover:border-slate-400'
                    }`}
                  >
                    <input
                      type="radio"
                      name="importMode"
                      checked={mode === 'append'}
                      onChange={() => setMode('append')}
                      className="mt-0.5 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <strong className="block text-xs font-bold">Acrescentar ao Orçamento</strong>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        Soma aos itens existentes (use apenas se for uma planilha adicional/complementar).
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Upload Dropzone com suporte a 'multiple' */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".xlsx,.xls,.csv,.ods,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,*"
                onChange={handleFileChange}
                className="hidden"
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                className={`group cursor-pointer p-5 sm:p-6 rounded-3xl border-2 border-dashed transition-all flex flex-col items-center justify-center gap-2.5 text-center ${
                  files.length > 0
                    ? 'border-emerald-500 bg-emerald-50/50 dark:bg-sabrar-950/20'
                    : 'border-slate-300 dark:border-dark-700 bg-slate-50 dark:bg-dark-850 hover:border-emerald-500/60 hover:bg-slate-100 dark:hover:bg-dark-800'
                }`}
              >
                <div className="w-12 h-12 rounded-2xl bg-white dark:bg-dark-800 border border-slate-200 dark:border-dark-700 flex items-center justify-center text-emerald-600 dark:text-sabrar-400 group-hover:scale-110 transition-transform shadow-xs">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>

                <div className="space-y-1">
                  <div className="text-sm font-extrabold text-slate-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-sabrar-400 transition-colors">
                    Clique para selecionar uma ou mais Planilhas (Excel / CSV)
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Você pode selecionar vários arquivos de uma vez segurando <strong>Ctrl</strong> ou <strong>Shift</strong>
                  </p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                    Formatos suportados: .xlsx, .xls, .csv • Abas de Tubulação, Dutos, Exaustão, VRF, etc.
                  </p>
                </div>
              </div>

              {/* Lista de Arquivos Selecionados */}
              {files.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                    <span>{files.length} planilha(s) selecionada(s) para importação:</span>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-emerald-600 dark:text-sabrar-400 hover:underline text-[11px] font-bold"
                    >
                      + Adicionar outra planilha
                    </button>
                  </div>

                  <div className="divide-y divide-slate-200 dark:divide-dark-750 border border-slate-200 dark:border-dark-750 rounded-2xl overflow-hidden bg-white dark:bg-dark-850 max-h-48 overflow-y-auto">
                    {files.map((f, idx) => (
                      <div key={idx} className="p-2.5 flex items-center justify-between text-xs hover:bg-slate-50 dark:hover:bg-dark-800 transition-colors">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-sabrar-400 shrink-0" />
                          <span className="font-bold text-slate-900 dark:text-white truncate">{f.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono shrink-0">({formatFileSize(f.size)})</span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveFile(idx);
                          }}
                          className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors ml-2"
                          title="Remover este arquivo da lista"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-dark-700">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="px-4 py-2.5 rounded-2xl border border-slate-300 dark:border-dark-700 bg-white dark:bg-dark-850 hover:bg-slate-100 dark:hover:bg-dark-800 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleImport}
                  disabled={files.length === 0 || loading}
                  className="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/30 flex items-center gap-2 active:scale-95 disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>
                    {loading
                      ? `Processando ${files.length} planilha(s)...`
                      : files.length > 1
                      ? `Importar ${files.length} Planilhas e Calibrar IA`
                      : 'Importar Planilha e Calibrar IA'}
                  </span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

