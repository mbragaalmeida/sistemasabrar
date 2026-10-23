import React, { useState, useEffect } from 'react';
import {
  X,
  ClipboardCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Camera,
  FileText,
  Building,
  Save,
  CheckCircle
} from 'lucide-react';
import { api } from '../../services/api';

interface ReceivingChecklistItem {
  id: number;
  material_id?: number;
  item_description: string;
  brand_model?: string;
  quantity_requested: number;
  quantity_received: number;
  unit: string;
  status: 'Pendente' | 'Recebimento parcial' | 'Recebido';
  invoice_number?: string;
  notes?: string;
  material_image_url?: string;
}

interface ReceivingChecklistModalProps {
  isOpen: boolean;
  onClose: () => void;
  checklistId: number | null;
  onSuccess?: () => void;
}

export const ReceivingChecklistModal: React.FC<ReceivingChecklistModalProps> = ({
  isOpen,
  onClose,
  checklistId,
  onSuccess
}) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeChecklistId, setActiveChecklistId] = useState<number | null>(checklistId);
  const [checklist, setChecklist] = useState<any>(null);
  const [items, setItems] = useState<ReceivingChecklistItem[]>([]);

  useEffect(() => {
    if (isOpen) {
      if (checklistId) {
        setActiveChecklistId(checklistId);
        loadChecklist(checklistId);
      } else {
        api.getReceivingChecklists().then(list => {
          if (list && list.length > 0) {
            setActiveChecklistId(list[0].id);
            loadChecklist(list[0].id);
          }
        }).catch(console.error);
      }
    }
  }, [isOpen, checklistId]);

  const loadChecklist = async (idToLoad?: number) => {
    const targetId = idToLoad || activeChecklistId || checklistId;
    if (!targetId) return;
    try {
      setLoading(true);
      const res = await api.getReceivingChecklistById(targetId);
      setChecklist(res.checklist);
      setItems(res.items || []);
    } catch (err: any) {
      console.error('Erro ao carregar checklist:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleItemChange = (id: number, field: keyof ReceivingChecklistItem, value: any) => {
    setItems(prev =>
      prev.map(it => {
        if (it.id !== id) return it;
        const updated = { ...it, [field]: value };
        // Atualizar status automaticamente se a quantidade recebida mudar
        if (field === 'quantity_received') {
          const qty = Number(value) || 0;
          if (qty >= it.quantity_requested) {
            updated.status = 'Recebido';
          } else if (qty > 0) {
            updated.status = 'Recebimento parcial';
          } else {
            updated.status = 'Pendente';
          }
        }
        return updated;
      })
    );
  };

  const handleSaveProgress = async () => {
    if (!checklistId) return;
    try {
      setSaving(true);
      await api.updateReceivingChecklistItems(checklistId, items);
      alert('Conferência física salva com sucesso!');
      if (onSuccess) onSuccess();
    } catch (err: any) {
      alert(err.message || 'Erro ao salvar itens do checklist.');
    } finally {
      setSaving(false);
    }
  };

  const handleFinalize = async () => {
    if (!checklistId) return;
    const pendingItems = items.filter(it => it.status !== 'Recebido');
    if (pendingItems.length > 0) {
      const confirm = window.confirm(
        `Existem ${pendingItems.length} item(ns) com pendência ou recebimento parcial. Deseja finalizar o checklist e dar entrada apenas nas quantidades efetivamente recebidas?`
      );
      if (!confirm) return;
    } else {
      if (!window.confirm('Confirma a conclusão do checklist e a entrada dos materiais no estoque?')) {
        return;
      }
    }

    try {
      setSaving(true);
      // Salva itens primeiro
      await api.updateReceivingChecklistItems(checklistId, items);
      // Finaliza
      await api.finalizeReceivingChecklist(checklistId);
      alert('Checklist finalizado com sucesso! Materiais integrados ao estoque.');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      alert(err.message || 'Erro ao finalizar checklist.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const totalRequested = items.reduce((acc, it) => acc + (Number(it.quantity_requested) || 0), 0);
  const totalReceived = items.reduce((acc, it) => acc + (Number(it.quantity_received) || 0), 0);
  const isFinalized = checklist?.status === 'Concluído';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl text-slate-800 dark:text-slate-100 my-auto">
        
        {/* Cabeçalho de Conferência Física (Print 3) */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 rounded-t-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <ClipboardCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Checklist de Recebimento de Materiais
                </h2>
                <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
                  {checklist?.code || 'CR-2026'}
                </span>
                <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${
                  isFinalized
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300'
                }`}>
                  {checklist?.status || 'Em conferência'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Conferência física no descarregamento, validação de marcas, modelos e romaneio.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Metadados do Pedido (Print 3) */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {loading ? (
            <div className="py-16 text-center text-slate-400">
              <div className="animate-spin w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full mx-auto mb-3" />
              Carregando dados da conferência...
            </div>
          ) : (
            <>
              {/* Cards de Identificação (SM, Obra, PC, Fornecedor, Data) */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                <div>
                  <span className="text-slate-400 block font-medium">SM N°</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {checklist?.request_code || 'SM-0042'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Obra</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 truncate block">
                    {checklist?.project_name || 'Almoxarifado Geral'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">N° PC (Compra)</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {checklist?.purchase_id ? `PC-${checklist.purchase_id}` : 'PC-0089'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Fornecedor</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 truncate block">
                    {checklist?.supplier_name || 'Dufrio Refrigeração'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Data Conferência</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {checklist?.conference_date ? new Date(checklist.conference_date).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR')}
                  </span>
                </div>
              </div>

              {/* Tabela de Conferência Física (Print 3) */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700">
                      <th className="py-3 px-3 w-10 text-center font-bold">#</th>
                      <th className="py-3 px-3 w-16 text-center font-bold">Foto</th>
                      <th className="py-3 px-3 min-w-[200px] font-bold">Descrição do Material</th>
                      <th className="py-3 px-2 w-20 text-center font-bold">Qtd Solicitada</th>
                      <th className="py-3 px-2 w-24 text-center font-bold">Qtd Recebida</th>
                      <th className="py-3 px-3 w-36 text-center font-bold">Status</th>
                      <th className="py-3 px-3 w-32 font-bold">Nota Fiscal</th>
                      <th className="py-3 px-3 min-w-[140px] font-bold">Observações / Avaria</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {items.map((it, idx) => (
                      <tr key={it.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-2.5 px-3 text-center text-slate-400 font-medium">{idx + 1}</td>
                        
                        {/* Foto */}
                        <td className="py-2.5 px-3 text-center">
                          {it.material_image_url ? (
                            <img
                              src={it.material_image_url}
                              alt={it.item_description}
                              className="w-10 h-10 object-cover rounded-lg border border-slate-200 dark:border-slate-700 mx-auto"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center text-slate-400 mx-auto">
                              <Camera className="w-4 h-4" />
                            </div>
                          )}
                        </td>

                        {/* Descrição & Marca */}
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-slate-900 dark:text-slate-100">
                            {it.item_description}
                          </div>
                          {it.brand_model && (
                            <div className="text-[10px] text-slate-500 dark:text-slate-400">
                              Marca/Modelo: {it.brand_model}
                            </div>
                          )}
                        </td>

                        {/* Qtd Solicitada */}
                        <td className="py-2.5 px-2 text-center font-bold text-slate-700 dark:text-slate-300">
                          {it.quantity_requested} {it.unit}
                        </td>

                        {/* Qtd Recebida (Input) */}
                        <td className="py-2.5 px-2 text-center">
                          <input
                            type="number"
                            min="0"
                            disabled={isFinalized}
                            value={it.quantity_received}
                            onChange={e => handleItemChange(it.id, 'quantity_received', parseFloat(e.target.value) || 0)}
                            className="w-20 text-center px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 font-bold bg-white dark:bg-slate-900 text-xs focus:ring-2 focus:ring-emerald-500"
                          />
                        </td>

                        {/* Status (Badge / Selector) */}
                        <td className="py-2.5 px-3 text-center">
                          <select
                            disabled={isFinalized}
                            value={it.status}
                            onChange={e => handleItemChange(it.id, 'status', e.target.value)}
                            className={`w-full text-xs font-semibold px-2 py-1.5 rounded-lg border appearance-none text-center cursor-pointer ${
                              it.status === 'Recebido'
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300'
                                : it.status === 'Recebimento parcial'
                                ? 'bg-amber-50 border-amber-300 text-amber-800 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300'
                                : 'bg-rose-50 border-rose-300 text-rose-800 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300'
                            }`}
                          >
                            <option value="Recebido">Recebido</option>
                            <option value="Recebimento parcial">Recebimento parcial</option>
                            <option value="Pendente">Pendente</option>
                          </select>
                        </td>

                        {/* Nota Fiscal */}
                        <td className="py-2.5 px-3">
                          <input
                            type="text"
                            disabled={isFinalized}
                            placeholder="N° NF"
                            value={it.invoice_number || ''}
                            onChange={e => handleItemChange(it.id, 'invoice_number', e.target.value)}
                            className="w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                          />
                        </td>

                        {/* Observações / Avarias */}
                        <td className="py-2.5 px-3">
                          <input
                            type="text"
                            disabled={isFinalized}
                            placeholder="Sem avarias"
                            value={it.notes || ''}
                            onChange={e => handleItemChange(it.id, 'notes', e.target.value)}
                            className="w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Resumo de Conferência */}
              <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                <div className="flex items-center gap-4">
                  <div>
                    <span className="text-slate-400">Total Solicitado:</span>{' '}
                    <span className="font-bold text-slate-700 dark:text-slate-300">{totalRequested} itens</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Total Conferido / Recebido:</span>{' '}
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">{totalReceived} itens</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                    <CheckCircle2 className="w-4 h-4" />
                    {items.filter(i => i.status === 'Recebido').length} 100% OK
                  </span>
                  {items.filter(i => i.status === 'Recebimento parcial').length > 0 && (
                    <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium ml-2">
                      <AlertTriangle className="w-4 h-4" />
                      {items.filter(i => i.status === 'Recebimento parcial').length} Parcial
                    </span>
                  )}
                  {items.filter(i => i.status === 'Pendente').length > 0 && (
                    <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400 font-medium ml-2">
                      <Clock className="w-4 h-4" />
                      {items.filter(i => i.status === 'Pendente').length} Pendente
                    </span>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Rodapé e Ações */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 rounded-b-2xl flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-lg transition-colors"
          >
            Fechar
          </button>

          {!isFinalized && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={saving}
                onClick={handleSaveProgress}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 flex items-center gap-1.5 transition-colors"
              >
                <Save className="w-4 h-4" />
                Salvar Conferência
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={handleFinalize}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-1.5 transition-all"
              >
                <CheckCircle className="w-4 h-4" />
                Finalizar Checklist e Dar Entrada
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
