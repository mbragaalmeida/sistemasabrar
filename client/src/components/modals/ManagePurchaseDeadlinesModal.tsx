import React, { useState, useEffect } from 'react';
import { Clock, Plus, X, AlertTriangle, CheckCircle, Trash2, Building, Truck, Calendar, Tag, Check, Edit2 } from 'lucide-react';
import { api } from '../../services/api';
import { Project } from '../../types';

interface ManagePurchaseDeadlinesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ManagePurchaseDeadlinesModal: React.FC<ManagePurchaseDeadlinesModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [activeTab, setActiveTab] = useState<'list' | 'new'>('new');
  const [deadlines, setDeadlines] = useState<any[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Campos do formulário (Item 4)
  const [orderNumber, setOrderNumber] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [itemName, setItemName] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [customProjectName, setCustomProjectName] = useState('');
  const [expectedBillingDate, setExpectedBillingDate] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    loadData();
  }, [isOpen]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [deadlinesRes, projectsRes] = await Promise.all([
        api.getTrackedDeadlines().catch(() => []),
        api.getProjects().catch(() => [])
      ]);
      setDeadlines(deadlinesRes || []);
      setProjects(projectsRes || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleCreateDeadline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderNumber.trim() || !supplierName.trim() || !itemName.trim() || !expectedBillingDate) {
      setError('Por favor, preencha todos os campos obrigatórios (*).');
      return;
    }

    let finalProjectName = customProjectName.trim();
    if (selectedProjectId && selectedProjectId !== 'custom') {
      const found = projects.find(p => p.id === Number(selectedProjectId));
      if (found) finalProjectName = `${found.code} - ${found.name}`;
    }

    if (!finalProjectName) {
      setError('Por favor, selecione ou informe a obra de destino.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      await api.createTrackedDeadline({
        order_number: orderNumber.trim(),
        supplier_name: supplierName.trim(),
        item_name: itemName.trim(),
        project_id: selectedProjectId && selectedProjectId !== 'custom' ? Number(selectedProjectId) : null,
        project_name: finalProjectName,
        expected_billing_date: expectedBillingDate,
        notes: notes.trim()
      });

      // Limpa formulário
      setOrderNumber('');
      setSupplierName('');
      setItemName('');
      setSelectedProjectId('');
      setCustomProjectName('');
      setExpectedBillingDate('');
      setNotes('');

      await loadData();
      setActiveTab('list');
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err.message || 'Erro ao registrar acompanhamento de prazo.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (item: any) => {
    const nextStatus = item.status === 'Entregue' ? 'Em Acompanhamento' : 'Entregue';
    try {
      await api.updateTrackedDeadline(item.id, { status: nextStatus });
      await loadData();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      alert(err.message || 'Erro ao atualizar status');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Deseja realmente remover o acompanhamento deste pedido?')) return;
    try {
      await api.deleteTrackedDeadline(id);
      await loadData();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      alert(err.message || 'Erro ao excluir');
    }
  };

  const getStatusBadge = (item: any) => {
    if (item.status === 'Entregue') {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-dark-750 dark:text-slate-300 border border-slate-200 dark:border-dark-700">
          Entregue / Concluído
        </span>
      );
    }
    if (item.riskStatus === 'Atrasado') {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white animate-pulse">
          ATRASADO
        </span>
      );
    }
    if (item.riskStatus === 'Previsão Hoje') {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-slate-900 animate-pulse">
          PREVISÃO HOJE
        </span>
      );
    }
    if (item.riskStatus?.startsWith('Próximo')) {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
          {item.riskStatus}
        </span>
      );
    }
    return (
      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
        No Prazo
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-750 rounded-3xl w-full max-w-3xl max-h-[90vh] shadow-2xl overflow-hidden flex flex-col text-slate-800 dark:text-slate-100">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-dark-800 flex items-center justify-between bg-slate-50/70 dark:bg-dark-850">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center">
              <Clock className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                Controle de Prazos em Risco (Compras Específicas)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Acompanhamento de fabricação, faturamento e envio de itens específicos por obra
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-dark-750 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 dark:border-dark-800 bg-slate-50/40 dark:bg-dark-850/60 px-4 pt-3 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('new')}
            className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'new'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Cadastrar Pedido para Acompanhar</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('list')}
            className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'list'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Pedidos em Acompanhamento ({deadlines.length})</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto flex-1">
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/40 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {activeTab === 'new' ? (
            <form onSubmit={handleCreateDeadline} className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 text-xs text-amber-900 dark:text-amber-300">
                Cadastre as compras críticas feitas especificamente para suprir itens faltantes em projetos. O sistema notificará automaticamente os compradores e administradores na data prevista de faturamento.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 1. Número do Pedido */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Número do Pedido <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={orderNumber}
                    onChange={(e) => setOrderNumber(e.target.value)}
                    placeholder="Ex: PED-4091 ou 1049-Daikin"
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-dark-800 border border-slate-300 dark:border-dark-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-amber-500 font-semibold"
                  />
                </div>

                {/* 2. Fornecedor */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Fornecedor <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    placeholder="Ex: Walsywa, Daikin, Dufrio, Schneider..."
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-dark-800 border border-slate-300 dark:border-dark-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-amber-500 font-semibold"
                  />
                </div>
              </div>

              {/* 3. Item Faltante / Comprado */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Item / Material Especificado <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder="Ex: Curva 90º PVC 100mm, Válvula de Expansão, Chapa Galvanizada #22..."
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-dark-800 border border-slate-300 dark:border-dark-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-amber-500 font-semibold"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 4. Obra */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Obra de Destino <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-dark-800 border border-slate-300 dark:border-dark-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 font-semibold"
                  >
                    <option value="">Selecione a obra...</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.code} - {p.name}
                      </option>
                    ))}
                    <option value="custom">Outra Obra / Digitar Nome...</option>
                  </select>

                  {selectedProjectId === 'custom' && (
                    <input
                      type="text"
                      value={customProjectName}
                      onChange={(e) => setCustomProjectName(e.target.value)}
                      placeholder="Digite o nome da obra..."
                      className="mt-2 w-full px-3.5 py-2 bg-slate-50 dark:bg-dark-800 border border-slate-300 dark:border-dark-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-amber-500"
                    />
                  )}
                </div>

                {/* 5. Data de Previsão de Faturamento */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Previsão de Faturamento (Ficar pronto / Enviar) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={expectedBillingDate}
                    onChange={(e) => setExpectedBillingDate(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-dark-800 border border-slate-300 dark:border-dark-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 font-semibold"
                  />
                  <span className="text-[10px] text-slate-400 block">
                    Gera notificação na central quando a data for atingida.
                  </span>
                </div>
              </div>

              {/* Observações */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Observações de Acompanhamento (Opcional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Fornecedor confirmou que o material entra em corte na quinta-feira..."
                  rows={2}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-dark-800 border border-slate-300 dark:border-dark-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-amber-500 resize-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-dark-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-dark-800 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs transition-all shadow-md cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Salvando...' : 'Salvar Acompanhamento'}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-3">
              {loading && (
                <div className="py-16 text-center text-xs text-slate-400">
                  Carregando pedidos em acompanhamento...
                </div>
              )}

              {!loading && deadlines.length === 0 && (
                <div className="py-16 text-center text-xs text-slate-400 space-y-2">
                  <Clock className="w-8 h-8 text-slate-500 mx-auto" />
                  <p className="font-bold text-sm text-slate-700 dark:text-slate-300">
                    Nenhum pedido cadastrado para acompanhamento manual
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Clique na aba "Cadastrar Pedido" acima para incluir um item com prazo crítico.
                  </p>
                </div>
              )}

              {!loading && deadlines.length > 0 && (
                <div className="space-y-2.5">
                  {deadlines.map((item) => (
                    <div
                      key={item.id}
                      className={`p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        item.status === 'Entregue'
                          ? 'bg-slate-50/50 dark:bg-dark-850/40 border-slate-200 dark:border-dark-800 opacity-70'
                          : item.riskStatus === 'Atrasado'
                          ? 'bg-rose-50/60 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40'
                          : 'bg-white dark:bg-dark-850 border-slate-200 dark:border-dark-750'
                      }`}
                    >
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-black text-slate-900 dark:text-white bg-slate-100 dark:bg-dark-750 px-2 py-0.5 rounded border border-slate-200 dark:border-dark-700">
                            #{item.order_number}
                          </span>
                          <span className="text-xs font-extrabold text-amber-600 dark:text-amber-400">
                            {item.supplier_name}
                          </span>
                          {getStatusBadge(item)}
                        </div>

                        <div className="text-xs text-slate-900 dark:text-white font-bold">
                          Item: <span className="font-semibold text-slate-700 dark:text-slate-200">{item.item_name}</span>
                        </div>

                        <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-3 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Building className="w-3.5 h-3.5 text-slate-400" />
                            <strong>{item.project_name}</strong>
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-amber-500" />
                            <span>Previsão Faturamento: <strong>{new Date(item.expected_billing_date).toLocaleDateString('pt-BR')}</strong></span>
                          </span>
                        </div>

                        {item.notes && (
                          <div className="text-[11px] text-slate-600 dark:text-slate-400 italic bg-slate-50 dark:bg-dark-800 p-2 rounded-xl border border-slate-200 dark:border-dark-750">
                            "{item.notes}"
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(item)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                            item.status === 'Entregue'
                              ? 'bg-slate-100 dark:bg-dark-750 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-dark-700 hover:bg-slate-200'
                              : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-600 shadow-xs'
                          }`}
                        >
                          {item.status === 'Entregue' ? 'Reabrir' : 'Marcar Faturado / Entregue'}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDelete(item.id)}
                          className="p-1.5 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                          title="Remover acompanhamento"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
