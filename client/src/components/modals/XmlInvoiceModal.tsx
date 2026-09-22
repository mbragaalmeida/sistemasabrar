import React, { useState, useRef } from 'react';
import { FileCode, UploadCloud, X, CheckCircle, AlertCircle, ArrowRight, RefreshCw, Layers, DollarSign, Building2, PackagePlus } from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

interface XmlInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const XmlInvoiceModal: React.FC<XmlInvoiceModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const { currentUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingConfirm, setLoadingConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<any | null>(null);
  const [successResult, setSuccessResult] = useState<any | null>(null);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      if (!selected.name.toLowerCase().endsWith('.xml')) {
        setError('Selecione um arquivo no formato XML (.xml) válido de Nota Fiscal Eletrônica.');
        return;
      }
      setFile(selected);
      setError(null);
      setPreviewData(null);
      setSuccessResult(null);

      // Dispara o preview automaticamente
      setLoadingPreview(true);
      try {
        const preview = await api.previewNfeXml(selected);
        setPreviewData(preview);
      } catch (err: any) {
        setError(err.message || 'Erro ao processar o arquivo XML.');
      } finally {
        setLoadingPreview(false);
      }
    }
  };

  const handleConfirm = async () => {
    if (!previewData) return;

    setLoadingConfirm(true);
    setError(null);

    try {
      const payload = {
        supplier: previewData.supplier,
        invoiceNumber: previewData.invoiceNumber,
        items: previewData.items,
        userId: currentUser?.id
      };

      const res = await api.confirmNfeXml(payload);
      setSuccessResult(res);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err.message || 'Erro ao confirmar entrada da NF-e.');
    } finally {
      setLoadingConfirm(false);
    }
  };

  const resetAll = () => {
    setFile(null);
    setPreviewData(null);
    setSuccessResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-4xl bg-dark-900 border border-dark-750 rounded-3xl shadow-2xl overflow-hidden flex flex-col text-slate-100 max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-dark-850 border-b border-dark-750 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-950/80 border border-teal-500/40 flex items-center justify-center text-teal-400 shadow-inner">
              <FileCode className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-base text-white">Entrada de Materiais via NF-e (XML)</h3>
                <span className="text-[10px] font-bold uppercase bg-teal-950 text-teal-300 border border-teal-500/40 px-2 py-0.5 rounded-full">
                  SEFAZ XML
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Lê a nota fiscal, registra a entrada física e atualiza automaticamente os preços da base pelo valor da última compra
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-dark-750 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {error && (
            <div className="p-3.5 bg-rose-950/80 border border-rose-600/50 rounded-2xl text-xs text-rose-200 flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Estado de Sucesso */}
          {successResult ? (
            <div className="py-12 text-center space-y-4">
              <div className="w-16 h-16 bg-teal-950/80 border border-teal-500/50 rounded-3xl flex items-center justify-center text-teal-400 mx-auto shadow-xl shadow-teal-900/30">
                <CheckCircle className="w-8 h-8" />
              </div>
              <div>
                <h4 className="text-lg font-black text-white">NF-e Processada com Sucesso!</h4>
                <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                  {successResult.message}
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-lg mx-auto pt-2">
                <div className="p-3 bg-dark-850 rounded-2xl border border-dark-700 text-center">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Itens Processados</div>
                  <div className="text-xl font-black text-white">{successResult.totalItemsProcessed}</div>
                </div>
                <div className="p-3 bg-dark-850 rounded-2xl border border-dark-700 text-center">
                  <div className="text-[10px] uppercase font-bold text-sabrar-400">Preços Atualizados</div>
                  <div className="text-xl font-black text-sabrar-300">{successResult.updatedCount}</div>
                </div>
                <div className="p-3 bg-dark-850 rounded-2xl border border-dark-700 text-center col-span-2 sm:col-span-1">
                  <div className="text-[10px] uppercase font-bold text-teal-400">Novos Cadastrados</div>
                  <div className="text-xl font-black text-teal-300">{successResult.createdCount}</div>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-center gap-3">
                <button
                  onClick={resetAll}
                  className="px-4 py-2.5 rounded-2xl bg-dark-800 hover:bg-dark-750 text-white text-xs font-bold border border-dark-700 transition-all"
                >
                  Importar Outra NF-e
                </button>
                <button
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-2xl bg-sabrar-600 hover:bg-sabrar-500 text-white text-xs font-bold transition-all shadow-md shadow-sabrar-600/30"
                >
                  Concluir
                </button>
              </div>
            </div>
          ) : !previewData ? (
            /* Upload Zone */
            <div className="space-y-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-dark-700 hover:border-teal-500/60 bg-dark-850/60 hover:bg-dark-850 rounded-3xl p-8 sm:p-12 text-center cursor-pointer transition-all group flex flex-col items-center justify-center"
              >
                <div className="w-16 h-16 rounded-3xl bg-dark-800 group-hover:bg-teal-950/80 border border-dark-700 group-hover:border-teal-500/40 flex items-center justify-center text-slate-400 group-hover:text-teal-400 mb-4 transition-all shadow-inner">
                  {loadingPreview ? (
                    <RefreshCw className="w-7 h-7 animate-spin text-teal-400" />
                  ) : (
                    <UploadCloud className="w-8 h-8" />
                  )}
                </div>
                <div className="font-extrabold text-sm text-white mb-1">
                  {loadingPreview ? 'Lendo e identificando produtos da NF-e...' : 'Clique ou arraste o arquivo XML da Nota Fiscal'}
                </div>
                <p className="text-xs text-slate-400 max-w-sm">
                  Formatos aceitos: Arquivo padrão SEFAZ NF-e modelo 55 (.xml)
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xml"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              {/* Destaque das funcionalidades automáticas */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 bg-dark-850 rounded-2xl border border-dark-750">
                  <div className="font-bold text-white flex items-center gap-1.5 mb-1">
                    <DollarSign className="w-4 h-4 text-sabrar-400" />
                    Preços Reais Atualizados
                  </div>
                  <p className="text-[11px] text-slate-400">
                    O custo unitário de cada produto no orçamento passa a ser o da última compra real.
                  </p>
                </div>
                <div className="p-3 bg-dark-850 rounded-2xl border border-dark-750">
                  <div className="font-bold text-white flex items-center gap-1.5 mb-1">
                    <Layers className="w-4 h-4 text-teal-400" />
                    Conversão Inteligente
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Converte automaticamente tubos de cobre e chapas comprados em KG para metros ou m².
                  </p>
                </div>
                <div className="p-3 bg-dark-850 rounded-2xl border border-dark-750">
                  <div className="font-bold text-white flex items-center gap-1.5 mb-1">
                    <Building2 className="w-4 h-4 text-amber-400" />
                    Entrada e Fornecedor
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Alimenta o estoque físico e cadastra automaticamente os dados do emitente da nota.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* Preview dos Itens Identificados */
            <div className="space-y-4">
              {/* Header da NF identificada */}
              <div className="p-4 bg-dark-850 rounded-2xl border border-dark-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-white text-sm">
                      NF-e nº {previewData.invoiceNumber}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      Série {previewData.serie} • Emissão: {previewData.emissionDate}
                    </span>
                  </div>
                  <div className="text-slate-300 font-semibold mt-0.5">
                    Fornecedor: <span className="text-white">{previewData.supplier?.name}</span> ({previewData.supplier?.cnpj || 'Sem CNPJ'})
                  </div>
                </div>

                <div className="text-right self-end sm:self-center">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Valor Total da Nota</div>
                  <div className="text-base font-black text-sabrar-300">
                    R$ {Number(previewData.totalValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              {/* Tabela de Produtos */}
              <div className="bg-dark-850 rounded-2xl border border-dark-700 overflow-hidden">
                <div className="p-3 bg-dark-800 border-b border-dark-700 flex items-center justify-between text-xs font-bold text-white">
                  <span>Itens Identificados ({previewData.items.length})</span>
                  <span className="text-[11px] text-slate-400 font-normal">
                    Verifique os preços e conversões de unidade calculadas
                  </span>
                </div>

                <div className="overflow-x-auto max-h-72">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-dark-800/80 text-slate-400 font-semibold sticky top-0 border-b border-dark-700">
                      <tr>
                        <th className="p-2.5">Item / Descrição</th>
                        <th className="p-2.5 text-center">Unidade NF vs Base</th>
                        <th className="p-2.5 text-center">Qtd Entrada</th>
                        <th className="p-2.5 text-right">Preço Atual</th>
                        <th className="p-2.5 text-right font-bold text-white">Novo Preço Base</th>
                        <th className="p-2.5 text-center">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-dark-750">
                      {previewData.items.map((item: any) => (
                        <tr key={item.itemNumber} className="hover:bg-dark-800/50">
                          <td className="p-2.5">
                            <div className="font-bold text-white max-w-xs truncate">{item.xmlName}</div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              Cód: {item.xmlCode} • {item.inferredCategory}
                            </div>
                            {item.isConverted && (
                              <div className="text-[10px] text-teal-400 font-medium mt-0.5">
                                💡 {item.conversionExplanation}
                              </div>
                            )}
                          </td>
                          <td className="p-2.5 text-center">
                            <span className="font-mono text-slate-300">
                              {item.xmlUnit} {item.isConverted && `➜ ${item.targetUnit}`}
                            </span>
                          </td>
                          <td className="p-2.5 text-center font-bold text-white font-mono">
                            {item.convertedQuantity} {item.targetUnit}
                          </td>
                          <td className="p-2.5 text-right text-slate-400 font-mono">
                            {item.currentBasePrice > 0 ? `R$ ${item.currentBasePrice.toFixed(2)}` : '—'}
                          </td>
                          <td className="p-2.5 text-right font-mono font-black text-sabrar-300">
                            R$ {item.convertedUnitPrice.toFixed(2)}
                            <span className="text-[10px] text-slate-400 font-normal">/{item.targetUnit}</span>
                          </td>
                          <td className="p-2.5 text-center">
                            {item.action === 'UPDATE_PRICE_AND_STOCK' ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sabrar-950 text-sabrar-300 border border-sabrar-500/40">
                                Atualizar Preço
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-950 text-teal-300 border border-teal-500/40">
                                Novo Cadastro
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {previewData && !successResult && (
          <div className="p-4 bg-dark-850 border-t border-dark-750 flex items-center justify-between gap-3">
            <button
              onClick={resetAll}
              className="px-4 py-2 rounded-2xl bg-dark-800 hover:bg-dark-750 text-slate-300 hover:text-white text-xs font-bold border border-dark-700 transition-all"
            >
              Escolher Outro XML
            </button>
            <button
              onClick={handleConfirm}
              disabled={loadingConfirm}
              className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-sabrar-600 hover:bg-sabrar-500 text-white text-xs font-bold transition-all shadow-md shadow-sabrar-600/30 active:scale-95 disabled:opacity-50"
            >
              {loadingConfirm ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Atualizando Preços e Estoque...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <span>Confirmar Entrada & Atualizar Preços da Base</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
