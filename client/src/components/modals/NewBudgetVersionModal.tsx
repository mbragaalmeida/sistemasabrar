import React, { useState, useEffect, useMemo } from 'react';
import { History, AlertTriangle, X, CheckCircle, Tag, Upload, FileText, Search, Edit3, Trash2, Check, RefreshCw } from 'lucide-react';

interface NewBudgetVersionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: {
    change_type: string;
    justification: string;
    discount_amount?: number;
    uploaded_file?: File;
    updated_materials?: any[];
    recalculated_total?: number;
  }) => Promise<void>;
  currentVersionNumber: number;
  totalFinal: number;
  materials?: any[];
}

export const NewBudgetVersionModal: React.FC<NewBudgetVersionModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  currentVersionNumber,
  totalFinal,
  materials = []
}) => {
  const [changeType, setChangeType] = useState('Mudança de Escopo / Novo Projeto');
  const [justification, setJustification] = useState('');
  const [discountAmount, setDiscountAmount] = useState<number | undefined>(undefined);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Editable materials list for "Ajuste de Quantitativos"
  const [itemsToAdjust, setItemsToAdjust] = useState<any[]>([]);
  const [itemSearchQuery, setItemSearchQuery] = useState('');

  useEffect(() => {
    if (isOpen) {
      setChangeType('Mudança de Escopo / Novo Projeto');
      setJustification('');
      setDiscountAmount(undefined);
      setUploadedFile(null);
      setError('');
      setItemSearchQuery('');

      // Deep copy materials for item-by-item editing
      const initialItems = (materials || []).map((m, idx) => ({
        ...m,
        _originalIndex: idx,
        _originalQty: Number(m.quantity) || 0,
        _originalPrice: Number(m.unit_price !== undefined ? m.unit_price : (m.unitPrice || 0)) || 0,
        quantity: Number(m.quantity) || 0,
        unit_price: Number(m.unit_price !== undefined ? m.unit_price : (m.unitPrice || 0)) || 0,
        subtotal: (Number(m.quantity) || 0) * (Number(m.unit_price !== undefined ? m.unit_price : (m.unitPrice || 0)) || 0)
      }));
      setItemsToAdjust(initialItems);
    }
  }, [isOpen, materials]);

  const changeTypes = [
    { id: 'Mudança de Escopo / Novo Projeto', label: 'Mudança de Escopo / Novo Projeto' },
    { id: 'Ajuste de Quantitativos', label: 'Ajuste de Quantitativos / Preços' },
    { id: 'Desconto Comercial', label: 'Desconto Comercial / Negociação' },
    { id: 'Outro', label: 'Outro Motivo' }
  ];

  const handleItemQuantityChange = (index: number, newQty: number) => {
    setItemsToAdjust(prev => prev.map((item, i) => {
      if (i === index) {
        const qty = Math.max(0, newQty);
        const price = Number(item.unit_price) || 0;
        return {
          ...item,
          quantity: qty,
          subtotal: Number((qty * price).toFixed(2))
        };
      }
      return item;
    }));
  };

  const handleItemPriceChange = (index: number, newPrice: number) => {
    setItemsToAdjust(prev => prev.map((item, i) => {
      if (i === index) {
        const price = Math.max(0, newPrice);
        const qty = Number(item.quantity) || 0;
        return {
          ...item,
          unit_price: price,
          subtotal: Number((qty * price).toFixed(2))
        };
      }
      return item;
    }));
  };

  // Recalculated total for materials when adjusting item-by-item
  const adjustedMaterialsTotal = useMemo(() => {
    return itemsToAdjust.reduce((sum, item) => sum + (Number(item.subtotal) || 0), 0);
  }, [itemsToAdjust]);

  // Recalculated total final
  const recalculatedTotalFinal = useMemo(() => {
    if (changeType === 'Ajuste de Quantitativos') {
      const originalMaterialsTotal = (materials || []).reduce(
        (sum, item) => sum + (Number(item.subtotal) || ((Number(item.quantity) || 0) * (Number(item.unit_price || item.unitPrice || 0)))),
        0
      );
      const diff = adjustedMaterialsTotal - originalMaterialsTotal;
      return Math.max(0, totalFinal + diff);
    }
    if (changeType === 'Desconto Comercial' && discountAmount) {
      return Math.max(0, totalFinal - Number(discountAmount));
    }
    return totalFinal;
  }, [changeType, adjustedMaterialsTotal, materials, totalFinal, discountAmount]);

  const modifiedItemsCount = useMemo(() => {
    return itemsToAdjust.filter(item =>
      item.quantity !== item._originalQty || item.unit_price !== item._originalPrice
    ).length;
  }, [itemsToAdjust]);

  const filteredItemsToAdjust = useMemo(() => {
    if (!itemSearchQuery.trim()) return itemsToAdjust;
    const q = itemSearchQuery.toLowerCase();
    return itemsToAdjust.filter(item => {
      const name = (item.material_name || item.material || '').toLowerCase();
      const code = (item.material_code || '').toLowerCase();
      return name.includes(q) || code.includes(q);
    });
  }, [itemsToAdjust, itemSearchQuery]);

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setUploadedFile(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!justification.trim()) {
      setError('Por favor, informe a justificativa detalhada desta nova versão.');
      return;
    }

    try {
      setLoading(true);
      setError('');

      await onConfirm({
        change_type: changeType,
        justification: justification.trim(),
        discount_amount: discountAmount ? Number(discountAmount) : 0,
        uploaded_file: uploadedFile || undefined,
        updated_materials: changeType === 'Ajuste de Quantitativos' ? itemsToAdjust : undefined,
        recalculated_total: recalculatedTotalFinal
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao registrar versão do orçamento.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
      <div className="bg-dark-900 border border-dark-750 rounded-3xl w-full max-w-2xl max-h-[90vh] shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-dark-800 flex items-center justify-between bg-dark-850">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-sabrar-500/20 text-sabrar-400 border border-sabrar-500/30">
              <History className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Criar Nova Versão do Orçamento</h2>
              <p className="text-xs text-slate-400">
                Criando Versão {currentVersionNumber + 1} (preservando o histórico anterior)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-dark-750 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* Card Resumo de Valores */}
          <div className="p-4 rounded-2xl bg-dark-850 border border-dark-750 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-400 block font-medium">
                {changeType === 'Ajuste de Quantitativos' || changeType === 'Desconto Comercial'
                  ? 'Novo Valor Total Calculado:'
                  : 'Valor Total do Orçamento:'}
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-base font-black text-white">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(recalculatedTotalFinal)}
                </span>
                {recalculatedTotalFinal !== totalFinal && (
                  <span className="text-[11px] text-slate-400 line-through">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalFinal)}
                  </span>
                )}
              </div>
            </div>
            <span className="text-xs font-bold px-3 py-1 bg-sabrar-950 text-sabrar-300 border border-sabrar-500/40 rounded-xl">
              V{currentVersionNumber} &rarr; V{currentVersionNumber + 1}
            </span>
          </div>

          {/* Seleção do Tipo de Alteração */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-300">
              Tipo da Alteração <span className="text-rose-400">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {changeTypes.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setChangeType(t.id)}
                  className={`p-2.5 rounded-xl border text-left text-xs transition-all ${
                    changeType === t.id
                      ? 'bg-sabrar-600/20 text-sabrar-300 border-sabrar-500 font-bold shadow-sm'
                      : 'bg-dark-800 text-slate-400 border-dark-700 hover:text-white hover:bg-dark-750'
                  }`}
                >
                  <Tag className="w-3.5 h-3.5 mb-1 inline mr-1.5 opacity-70" />
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* UPLOAD DE ARQUIVO: Quando for 'Mudança de Escopo / Novo Projeto' */}
          {changeType === 'Mudança de Escopo / Novo Projeto' && (
            <div className="space-y-2 p-3.5 rounded-2xl bg-dark-850 border border-dark-750">
              <label className="block text-xs font-bold text-slate-200">
                Upload do Arquivo de Projeto / DWG / AP / PDF (Opcional)
              </label>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleFileDrop}
                className={`border-2 border-dashed rounded-xl p-4 text-center transition-all cursor-pointer ${
                  dragOver
                    ? 'border-sabrar-500 bg-sabrar-950/20'
                    : uploadedFile
                    ? 'border-emerald-500/50 bg-emerald-950/20'
                    : 'border-dark-700 hover:border-dark-600 bg-dark-900'
                }`}
                onClick={() => {
                  const input = document.getElementById('new-version-file-input');
                  if (input) input.click();
                }}
              >
                <input
                  id="new-version-file-input"
                  type="file"
                  accept=".dwg,.dxf,.pdf,.xlsx,.xls,.csv,.png,.jpg,.jpeg"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      setUploadedFile(e.target.files[0]);
                    }
                  }}
                />
                {uploadedFile ? (
                  <div className="flex items-center justify-between gap-3 text-left">
                    <div className="flex items-center gap-2.5 truncate">
                      <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="truncate">
                        <p className="font-bold text-white text-xs truncate">{uploadedFile.name}</p>
                        <span className="text-[10px] text-slate-400">
                          {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB • Clique para trocar
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setUploadedFile(null);
                      }}
                      className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-dark-800"
                      title="Remover arquivo"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Upload className="w-5 h-5 mx-auto text-slate-400" />
                    <p className="text-xs font-semibold text-slate-300">
                      Clique para selecionar ou arraste o novo arquivo de projeto aqui
                    </p>
                    <p className="text-[10px] text-slate-500">
                      Formatos aceitos: DWG, DXF, PDF, Excel (AP), CSV, Imagens
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* AJUSTE ITEM A ITEM: Quando for 'Ajuste de Quantitativos' */}
          {changeType === 'Ajuste de Quantitativos' && (
            <div className="space-y-3 p-4 rounded-2xl bg-dark-850 border border-dark-750">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h4 className="font-bold text-xs text-white flex items-center gap-1.5">
                    <Edit3 className="w-4 h-4 text-sabrar-400" />
                    Ajuste de Quantitativos e Preços Item a Item ({itemsToAdjust.length})
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Altere as quantidades ou valores unitários antes de gravar a nova versão.
                  </p>
                </div>
                {modifiedItemsCount > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-600/40 text-[10px] font-bold">
                    {modifiedItemsCount} {modifiedItemsCount === 1 ? 'item alterado' : 'itens alterados'}
                  </span>
                )}
              </div>

              {/* Busca rápida de itens */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={itemSearchQuery}
                  onChange={(e) => setItemSearchQuery(e.target.value)}
                  placeholder="Filtrar item por nome ou código..."
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-dark-700 bg-dark-900 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-sabrar-500"
                />
              </div>

              {/* Tabela de itens editáveis */}
              <div className="max-h-60 overflow-y-auto rounded-xl border border-dark-700 bg-dark-900">
                <table className="w-full text-left text-xs">
                  <thead className="bg-dark-800 text-slate-400 font-bold sticky top-0 border-b border-dark-700">
                    <tr>
                      <th className="p-2.5">Material</th>
                      <th className="p-2.5 text-center w-28">Quantidade</th>
                      <th className="p-2.5 text-center w-28">Preço Unit. (R$)</th>
                      <th className="p-2.5 text-right w-24">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dark-800">
                    {filteredItemsToAdjust.map((item) => {
                      const realIndex = itemsToAdjust.findIndex(it => it === item);
                      const isModified = item.quantity !== item._originalQty || item.unit_price !== item._originalPrice;

                      return (
                        <tr
                          key={item.id || item.material_id || item._originalIndex}
                          className={`hover:bg-dark-850/50 transition-colors ${isModified ? 'bg-amber-950/15' : ''}`}
                        >
                          <td className="p-2.5">
                            <strong className="text-white block truncate max-w-[200px]" title={item.material_name || item.material}>
                              {item.material_name || item.material}
                            </strong>
                            <span className="text-[10px] text-slate-400">
                              Unidade: {item.unit || 'und'}
                            </span>
                          </td>
                          <td className="p-2 text-center">
                            <input
                              type="number"
                              step="any"
                              min="0"
                              value={item.quantity}
                              onChange={(e) => handleItemQuantityChange(realIndex, parseFloat(e.target.value) || 0)}
                              className={`w-20 px-2 py-1 rounded-lg text-center font-bold text-xs bg-dark-800 border focus:outline-none focus:ring-1 focus:ring-sabrar-500 ${
                                item.quantity !== item._originalQty
                                  ? 'text-amber-400 border-amber-500'
                                  : 'text-white border-dark-700'
                              }`}
                            />
                          </td>
                          <td className="p-2 text-center">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={item.unit_price}
                              onChange={(e) => handleItemPriceChange(realIndex, parseFloat(e.target.value) || 0)}
                              className={`w-20 px-2 py-1 rounded-lg text-center font-bold text-xs bg-dark-800 border focus:outline-none focus:ring-1 focus:ring-sabrar-500 ${
                                item.unit_price !== item._originalPrice
                                  ? 'text-amber-400 border-amber-500'
                                  : 'text-white border-dark-700'
                              }`}
                            />
                          </td>
                          <td className="p-2.5 text-right font-bold text-white font-mono whitespace-nowrap">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.subtotal || 0)}
                          </td>
                        </tr>
                      );
                    })}
                    {filteredItemsToAdjust.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-4 text-center text-slate-500">
                          Nenhum material encontrado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Desconto Comercial */}
          {changeType === 'Desconto Comercial' && (
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">
                Valor do Desconto Comercial Concedido (R$)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={discountAmount !== undefined ? discountAmount : ''}
                onChange={(e) => setDiscountAmount(e.target.value ? parseFloat(e.target.value) : undefined)}
                placeholder="Ex: 1500.00"
                className="w-full px-4 py-2.5 bg-dark-800 border border-dark-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sabrar-500"
              />
            </div>
          )}

          {/* Justificativa Detalhada */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-300">
              Justificativa Detalhada da Alteração <span className="text-rose-400">*</span>
            </label>
            <textarea
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="Ex: Cliente solicitou nova versão com escopo revisado conforme novo projeto anexo e adequação de quantitativos..."
              rows={3}
              className="w-full px-4 py-2.5 bg-dark-800 border border-dark-700 rounded-2xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sabrar-500 focus:ring-1 focus:ring-sabrar-500 transition-all resize-none"
              required
            />
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-dark-800">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl border border-dark-700 text-slate-300 hover:text-white text-xs font-semibold hover:bg-dark-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl bg-sabrar-600 hover:bg-sabrar-500 text-white text-xs font-bold transition-all shadow-lg shadow-sabrar-600/30 flex items-center gap-2 disabled:opacity-50"
            >
              <CheckCircle className="w-4 h-4" />
              <span>{loading ? 'Salvando Versão...' : 'Gravar Nova Versão'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
