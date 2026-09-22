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

  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<any | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleImport = async () => {
    if (!file) {
      setError('Por favor, selecione uma planilha Excel (.xlsx, .xls) ou CSV');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await api.importProjectSpreadsheet(projectId, file, currentUser?.id);
      setSuccessData(res);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err.message || 'Erro ao processar planilha de levantamento');
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
      <div className="w-full max-w-xl bg-dark-900 border border-dark-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col text-slate-100">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-dark-850 border-b border-dark-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sabrar-950/80 border border-sabrar-500/40 flex items-center justify-center text-sabrar-400 shadow-inner">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base text-white">Importar Planilha de Levantamento Real</h3>
                <span className="text-[10px] font-bold uppercase bg-sabrar-950 text-sabrar-400 border border-sabrar-500/40 px-2 py-0.5 rounded-full">
                  Excel / CSV
                </span>
              </div>
              <p className="text-xs text-slate-400">{projectName}</p>
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
        <div className="p-4 sm:p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-2xl text-xs text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {successData ? (
            <div className="space-y-4 py-2 text-center">
              <div className="w-16 h-16 rounded-3xl bg-sabrar-950 border-2 border-sabrar-500/50 flex items-center justify-center mx-auto text-sabrar-400 shadow-lg shadow-sabrar-500/20">
                <CheckCircle className="w-8 h-8" />
              </div>

              <div>
                <h4 className="text-base font-extrabold text-white">Planilha Importada e IA Calibrada com Sucesso!</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                  A relação de materiais foi atualizada no orçamento da obra e os quantitativos reais foram absorvidos pelo Motor de Aprendizado Contínuo para aprimorar as próximas estimativas.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto text-left">
                <div className="p-3 rounded-2xl bg-dark-850 border border-dark-750">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Materiais Processados</div>
                  <div className="text-lg font-black text-white">{successData.itemsCount} itens</div>
                </div>
                <div className="p-3 rounded-2xl bg-dark-850 border border-dark-750">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Total em Materiais</div>
                  <div className="text-lg font-black text-sabrar-400">
                    R$ {Number(successData.totalMaterials || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-sabrar-950/60 border border-sabrar-500/30 text-xs text-sabrar-300 space-y-1.5 font-semibold">
                <div className="flex items-center justify-center gap-2">
                  <Sparkles className="w-4 h-4 text-sabrar-400 shrink-0" />
                  <span>{successData.calibratedCount || successData.itemsCount} fatores de calibração registrados no banco histórico da IA.</span>
                </div>
                {successData.sheetsNames && successData.sheetsNames.length > 0 && (
                  <div className="text-[11px] text-slate-400 font-normal">
                    <span className="text-slate-300 font-semibold">Abas identificadas ({successData.sheetsCount}): </span>
                    {successData.sheetsNames.join(' • ')}
                  </div>
                )}
              </div>

              <button
                onClick={onClose}
                className="w-full py-3 rounded-2xl bg-sabrar-600 hover:bg-sabrar-500 text-white text-xs font-bold transition-all shadow-md shadow-sabrar-600/30 active:scale-95"
              >
                Concluir e Ver Orçamento Atualizado
              </button>
            </div>
          ) : (
            <>
              {/* Informativo de Calibração */}
              <div className="p-3.5 rounded-2xl bg-dark-850 border border-dark-750 space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-bold text-white">
                  <Sparkles className="w-4 h-4 text-sabrar-400" />
                  <span>Como a IA aprende com o seu levantamento real:</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Ao enviar a sua planilha executiva (com materiais, quantidades e preços unitários), o sistema substitui as estimativas teóricas pelos dados reais de campo e calcula a margem de desvio. O motor de aprendizado contínuo utiliza esse histórico para calibrar automaticamente futuras obras com características similares.
                </p>
              </div>

              {/* Upload Dropzone */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,.ods,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,*"
                onChange={handleFileChange}
                className="hidden"
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                className={`group cursor-pointer p-6 rounded-3xl border-2 border-dashed transition-all flex flex-col items-center justify-center gap-3 text-center ${
                  file
                    ? 'border-sabrar-500 bg-sabrar-950/20'
                    : 'border-dark-700 bg-dark-850 hover:border-sabrar-500/60 hover:bg-dark-800'
                }`}
              >
                <div className="w-14 h-14 rounded-3xl bg-dark-800 border border-dark-700 flex items-center justify-center text-sabrar-400 group-hover:scale-110 transition-transform shadow-inner">
                  <FileSpreadsheet className="w-7 h-7" />
                </div>

                {file ? (
                  <div className="space-y-1">
                    <div className="text-sm font-extrabold text-white flex items-center justify-center gap-1.5">
                      <span>{file.name}</span>
                      <CheckCircle className="w-4 h-4 text-sabrar-400" />
                    </div>
                    <div className="text-xs text-slate-400 font-mono">
                      Tamanho: {formatFileSize(file.size)} • Clique para trocar de arquivo
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="text-sm font-extrabold text-white group-hover:text-sabrar-400 transition-colors">
                      Clique aqui para selecionar a Planilha Excel ou CSV
                    </div>
                    <p className="text-xs text-slate-400">
                      Formatos suportados: <strong>.xlsx, .xls, .csv, .ods</strong>
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Aceita colunas como: Material / Descrição, Quantidade, Unidade, Preço Unitário
                    </p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="px-4 py-2.5 rounded-2xl border border-dark-700 bg-dark-850 hover:bg-dark-800 text-slate-300 text-xs font-bold transition-all disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleImport}
                  disabled={!file || loading}
                  className="px-5 py-2.5 rounded-2xl bg-sabrar-600 hover:bg-sabrar-500 text-white text-xs font-bold transition-all shadow-md shadow-sabrar-600/30 flex items-center gap-2 active:scale-95 disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{loading ? 'Processando e Calibrando IA...' : 'Importar e Calibrar IA'}</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
