import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Building2,
  FileCheck,
  CheckCircle2,
  Clock,
  Plus,
  ShoppingCart,
  Globe,
  ExternalLink,
  DollarSign,
  FileText,
  AlertCircle,
  Receipt,
  Trash2,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { api } from '../../services/api';

interface DirectBillingInvoice {
  id: number;
  direct_billing_id: number;
  invoice_number: string;
  amount: number;
  issue_date?: string;
  description?: string;
  created_at?: string;
}

interface DirectBillingItem {
  id: number;
  code: string;
  purchase_id?: number;
  purchase_code?: string;
  project_id?: number;
  project_name?: string;
  supplier_name: string;
  client_billing_cnpj?: string;
  authorized_ceiling: number;
  billed_amount: number;
  remaining_balance?: number;
  invoices?: DirectBillingInvoice[];
  step_compra_enviada: boolean;
  step_nf_recebida: boolean;
  step_xml_recebido: boolean;
  step_boleto_recebido: boolean;
  step_enviado_cliente: boolean;
  status: string;
  notes?: string;
  created_at: string;
}

interface WebPurchaseItem {
  id: number;
  code: string;
  product_description: string;
  project_id?: number;
  project_name?: string;
  platform: string;
  amount: number;
  payment_method?: string;
  delivery_status: string;
  invoice_receipt_number?: string;
  receipt_url?: string;
  purchased_by?: number;
  purchaser_name?: string;
  purchase_date?: string;
}

interface DirectBillingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const DirectBillingModal: React.FC<DirectBillingModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [activeTab, setActiveTab] = useState<'direct_billing' | 'web_purchases'>('direct_billing');
  const [loading, setLoading] = useState(false);
  const [billings, setBillings] = useState<DirectBillingItem[]>([]);
  const [webPurchases, setWebPurchases] = useState<WebPurchaseItem[]>([]);
  const [projects, setProjects] = useState<any[]>([]);

  // Novo Faturamento Direto Form State
  const [showNewBilling, setShowNewBilling] = useState(false);
  const [newProjectId, setNewProjectId] = useState<number | ''>('');
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newClientCnpj, setNewClientCnpj] = useState('');
  const [newCeiling, setNewCeiling] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newNotes, setNewNotes] = useState('');

  // Nova Compra Web Form State
  const [showNewWeb, setShowNewWeb] = useState(false);
  const [webDesc, setWebDesc] = useState('');
  const [webProjectId, setWebProjectId] = useState<number | ''>('');
  const [webPlatform, setWebPlatform] = useState('Mercado Livre');
  const [webAmount, setWebAmount] = useState('');
  const [webPayment, setWebPayment] = useState('Cartão Corporativo');
  const [webDelivery, setWebDelivery] = useState('A caminho');
  const [webReceipt, setWebReceipt] = useState('');

  // Estados para inclusão e visualização de Notas Fiscais parciais em um pedido
  const [addingInvoiceBillingId, setAddingInvoiceBillingId] = useState<number | null>(null);
  const [expandedInvoicesBillingId, setExpandedInvoicesBillingId] = useState<number | null>(null);
  const [newInvoiceNumber, setNewInvoiceNumber] = useState('');
  const [newInvoiceAmount, setNewInvoiceAmount] = useState('');
  const [newInvoiceDate, setNewInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [newInvoiceDesc, setNewInvoiceDesc] = useState('');
  const [submittingInvoice, setSubmittingInvoice] = useState(false);

  // Totais consolidados da esteira de faturamento direto (Print 1)
  const { totalCeilingAll, totalBilledAll, totalRemainingAll } = useMemo(() => {
    const totalCeiling = billings.reduce((sum, b) => sum + Number(b.authorized_ceiling || 0), 0);
    const totalBilled = billings.reduce((sum, b) => sum + Number(b.billed_amount || 0), 0);
    const totalRemaining = Math.max(0, totalCeiling - totalBilled);
    return {
      totalCeilingAll: totalCeiling,
      totalBilledAll: totalBilled,
      totalRemainingAll: totalRemaining
    };
  }, [billings]);

  const handleAddInvoice = async (billingId: number) => {
    const val = Number(newInvoiceAmount);
    if (!newInvoiceNumber.trim() || isNaN(val) || val <= 0) {
      alert('Por favor, informe o número da nota fiscal e um valor válido maior que zero.');
      return;
    }
    setSubmittingInvoice(true);
    try {
      await api.addDirectBillingInvoice(billingId, {
        invoice_number: newInvoiceNumber.trim(),
        amount: val,
        issue_date: newInvoiceDate,
        description: newInvoiceDesc.trim() || undefined
      });
      setAddingInvoiceBillingId(null);
      setNewInvoiceNumber('');
      setNewInvoiceAmount('');
      setNewInvoiceDesc('');
      await loadData();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      alert(err.message || 'Erro ao incluir nota fiscal');
    } finally {
      setSubmittingInvoice(false);
    }
  };

  const handleDeleteInvoice = async (invoiceId: number, invoiceNum: string) => {
    if (!window.confirm(`Tem certeza que deseja excluir a nota fiscal ${invoiceNum}? O valor faturado será estornado.`)) return;
    try {
      await api.deleteDirectBillingInvoice(invoiceId);
      await loadData();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      alert(err.message || 'Erro ao excluir nota fiscal');
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [billingRes, webRes, projRes] = await Promise.all([
        api.getDirectBillings(),
        api.getWebPurchases(),
        api.getProjects()
      ]);
      setBillings(billingRes || []);
      setWebPurchases(webRes || []);
      setProjects(projRes || []);
    } catch (err: any) {
      console.error('Erro ao carregar faturamentos diretos:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStep = async (billingId: number, stepName: string, currentValue: boolean) => {
    try {
      const newValue = !currentValue;
      // Atualização otimista
      setBillings(prev =>
        prev.map(b => (b.id === billingId ? { ...b, [stepName]: newValue } : b))
      );
      await api.toggleDirectBillingStep(billingId, stepName, newValue);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      alert(err.message || 'Erro ao atualizar etapa.');
      await loadData();
    }
  };

  const handleCreateBilling = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupplierName.trim()) {
      alert('Informe o nome do fornecedor.');
      return;
    }

    try {
      await api.createDirectBilling({
        project_id: newProjectId ? Number(newProjectId) : null,
        supplier_name: newSupplierName,
        client_billing_cnpj: newClientCnpj,
        authorized_ceiling: Number(newCeiling) || 0,
        billed_amount: Number(newAmount) || 0,
        notes: newNotes
      });

      setShowNewBilling(false);
      setNewProjectId('');
      setNewSupplierName('');
      setNewClientCnpj('');
      setNewCeiling('');
      setNewAmount('');
      setNewNotes('');
      await loadData();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      alert(err.message || 'Erro ao criar faturamento direto.');
    }
  };

  const handleCreateWebPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!webDesc.trim() || !webAmount) {
      alert('Preencha a descrição e o valor da compra.');
      return;
    }

    try {
      await api.createWebPurchase({
        product_description: webDesc,
        project_id: webProjectId ? Number(webProjectId) : null,
        platform: webPlatform,
        amount: Number(webAmount) || 0,
        payment_method: webPayment,
        delivery_status: webDelivery,
        invoice_receipt_number: webReceipt
      });

      setShowNewWeb(false);
      setWebDesc('');
      setWebProjectId('');
      setWebAmount('');
      setWebReceipt('');
      await loadData();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      alert(err.message || 'Erro ao cadastrar compra web.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl text-slate-800 dark:text-slate-100 my-auto">
        
        {/* Cabeçalho */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 rounded-t-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-xl">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                Faturamento Direto & Compras Web
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Esteira Compras x Financeiro para faturamento em CNPJ de cliente e compras online sem CNPJ.
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

        {/* Seletor de Abas & Métricas Consolidadas (Print 1) */}
        <div className="px-6 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white dark:bg-slate-900 py-1">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('direct_billing')}
              className={`py-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-all ${
                activeTab === 'direct_billing'
                  ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <FileCheck className="w-4 h-4" />
              Esteira de Faturamento Direto ({billings.length})
            </button>

            <button
              onClick={() => setActiveTab('web_purchases')}
              className={`py-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-all ${
                activeTab === 'web_purchases'
                  ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <ShoppingCart className="w-4 h-4" />
              Compras Online / Sem CNPJ ({webPurchases.length})
            </button>
          </div>

          {/* Resumo Financeiro da Esteira (Circulado no Print 1) */}
          {activeTab === 'direct_billing' && billings.length > 0 && (
            <div className="flex items-center gap-2 py-1.5 overflow-x-auto text-xs no-scrollbar">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl shrink-0 shadow-xs">
                <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Total Pedidos:</span>
                <span className="font-extrabold text-blue-600 dark:text-blue-400">
                  R$ {totalCeilingAll.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 rounded-xl shrink-0 shadow-xs">
                <span className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400">Total Faturado:</span>
                <span className="font-extrabold text-emerald-700 dark:text-emerald-300">
                  R$ {totalBilledAll.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 rounded-xl shrink-0 shadow-xs">
                <span className="text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400">Falta Faturar:</span>
                <span className="font-black text-amber-700 dark:text-amber-300">
                  R$ {totalRemainingAll.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Conteúdo Principal */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {loading ? (
            <div className="py-16 text-center text-slate-400">
              <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-3" />
              Carregando dados...
            </div>
          ) : activeTab === 'direct_billing' ? (
            /* ================= ABA 1: FATURAMENTO DIRETO (PRINT 4) ================= */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500">
                  Gerencie o fluxo de entrega de boletos, notas fiscais e XMLs diretamente com o cliente e compras.
                </p>
                {!showNewBilling && (
                  <button
                    onClick={() => setShowNewBilling(true)}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 !text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-sm transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    Novo Faturamento Direto
                  </button>
                )}
              </div>

              {/* Formulário Novo Faturamento Direto */}
              {showNewBilling && (
                <form onSubmit={handleCreateBilling} className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 p-4 rounded-xl space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                    <h4 className="font-semibold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Plus className="w-4 h-4 text-blue-600" />
                      Cadastrar Pedido em Faturamento Direto
                    </h4>
                    <button
                      type="button"
                      onClick={() => setShowNewBilling(false)}
                      className="text-xs text-slate-400 hover:text-slate-600"
                    >
                      Cancelar
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Obra / Cliente *
                      </label>
                      <select
                        value={newProjectId}
                        onChange={e => setNewProjectId(e.target.value ? Number(e.target.value) : '')}
                        className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                      >
                        <option value="">Selecione a obra...</option>
                        {projects.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.code} - {p.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Fornecedor Faturador *
                      </label>
                      <input
                        type="text"
                        required
                        value={newSupplierName}
                        onChange={e => setNewSupplierName(e.target.value)}
                        placeholder="Ex: DUFRIO REFRIGERAÇÃO"
                        className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        CNPJ de Faturamento do Cliente
                      </label>
                      <input
                        type="text"
                        value={newClientCnpj}
                        onChange={e => setNewClientCnpj(e.target.value)}
                        placeholder="00.000.000/0000-00"
                        className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Teto Autorizado pelo Cliente (R$)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={newCeiling}
                        onChange={e => setNewCeiling(e.target.value)}
                        placeholder="0,00"
                        className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Valor Faturado (R$)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={newAmount}
                        onChange={e => setNewAmount(e.target.value)}
                        placeholder="0,00"
                        className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Observações
                      </label>
                      <input
                        type="text"
                        value={newNotes}
                        onChange={e => setNewNotes(e.target.value)}
                        placeholder="Condições, número do contrato..."
                        className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowNewBilling(false)}
                      className="px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 !text-white font-semibold rounded-lg shadow-sm"
                    >
                      Salvar Faturamento Direto
                    </button>
                  </div>
                </form>
              )}

              {/* Cards Esteira de Faturamento Direto (Print 4) */}
              <div className="space-y-4">
                {billings.map(b => {
                  const allDone =
                    b.step_compra_enviada &&
                    b.step_nf_recebida &&
                    b.step_xml_recebido &&
                    b.step_boleto_recebido &&
                    b.step_enviado_cliente;

                  const ceiling = Number(b.authorized_ceiling || 0);
                  const billed = Number(b.billed_amount || 0);
                  const remaining = Math.max(0, ceiling - billed);
                  const percent = ceiling > 0 ? Math.min(100, Math.round((billed / ceiling) * 100)) : (billed > 0 ? 100 : 0);
                  const isFullyBilled = ceiling > 0 && billed >= ceiling;
                  const invoiceList = b.invoices || [];
                  const isAddingInvoice = addingInvoiceBillingId === b.id;
                  const isExpandedInvoices = expandedInvoicesBillingId === b.id;

                  return (
                    <div
                      key={b.id}
                      className="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-4 shadow-sm space-y-3.5 transition-all"
                    >
                      {/* Topo do Card com Identificação */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-700/60 pb-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-bold text-xs rounded-lg border border-blue-200 dark:border-blue-800/40">
                            {b.code}
                          </span>
                          <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                            {b.project_name || 'Obra Direta'}
                          </span>
                          <span className="text-slate-400 text-xs hidden sm:inline">|</span>
                          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                            {b.supplier_name}
                          </span>
                          {b.client_billing_cnpj && (
                            <span className="text-[11px] text-slate-500">
                              (CNPJ Cliente: {b.client_billing_cnpj})
                            </span>
                          )}
                        </div>

                        {/* Status de Faturamento do Pedido */}
                        <div className="flex items-center gap-2">
                          <span className={`px-2.5 py-1 text-[11px] font-bold rounded-full ${
                            isFullyBilled
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/50'
                              : billed > 0
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-300 dark:border-blue-700/50'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-700/50'
                          }`}>
                            {isFullyBilled
                              ? '✓ Faturamento 100% Concluído'
                              : billed > 0
                              ? `Faturamento Parcial (${percent}%)`
                              : 'Aguardando 1ª NF'}
                          </span>

                          <button
                            type="button"
                            onClick={() => {
                              if (isAddingInvoice) {
                                setAddingInvoiceBillingId(null);
                              } else {
                                setAddingInvoiceBillingId(b.id);
                                setNewInvoiceNumber('');
                                setNewInvoiceAmount(remaining > 0 ? String(remaining) : '');
                                setNewInvoiceDesc('');
                              }
                            }}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 !text-white text-xs font-bold rounded-lg flex items-center gap-1 shadow-sm transition-all active:scale-95"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>{isAddingInvoice ? 'Fechar' : 'Incluir NF'}</span>
                          </button>
                        </div>
                      </div>

                      {/* Bloco Financeiro: Total do Pedido, Total Faturado e Saldo Restante a Faturar */}
                      <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700/70 space-y-2">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                          <div className="p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                            <div className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Total do Pedido (Teto)</div>
                            <div className="text-sm font-extrabold text-blue-600 dark:text-blue-400 mt-0.5">
                              R$ {ceiling.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </div>
                          </div>

                          <div className="p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                            <div className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400 flex items-center justify-between">
                              <span>Faturado ({invoiceList.length} {invoiceList.length === 1 ? 'nota' : 'notas'})</span>
                              <span className="font-bold">{percent}%</span>
                            </div>
                            <div className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">
                              R$ {billed.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </div>
                          </div>

                          <div className="p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                            <div className="text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400">Saldo a Faturar</div>
                            <div className="text-sm font-black text-amber-600 dark:text-amber-400 mt-0.5">
                              R$ {remaining.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </div>
                          </div>
                        </div>

                        {/* Barra de Progresso do Faturamento */}
                        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full transition-all duration-500 ${
                              isFullyBilled ? 'bg-emerald-500' : 'bg-blue-600'
                            }`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>

                      {/* Formulário Inline de Inclusão de Nota Fiscal */}
                      {isAddingInvoice && (
                        <div className="p-3 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-700/50 rounded-xl space-y-3 animate-in fade-in">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                              <Receipt className="w-4 h-4" />
                              <span>Inserir Nota Fiscal no Pedido {b.code}</span>
                            </div>
                            <span className="text-[11px] text-slate-500">
                              O valor será somado ao faturado e abatido do saldo
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                            <div>
                              <label className="block text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400 mb-1">
                                Número da NF *
                              </label>
                              <input
                                type="text"
                                value={newInvoiceNumber}
                                onChange={e => setNewInvoiceNumber(e.target.value)}
                                placeholder="Ex: NF 1024 / 4589"
                                className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400 mb-1">
                                Valor da NF (R$) *
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                value={newInvoiceAmount}
                                onChange={e => setNewInvoiceAmount(e.target.value)}
                                placeholder="Ex: 10000.00"
                                className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-emerald-600 dark:text-emerald-400"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400 mb-1">
                                Data de Emissão
                              </label>
                              <input
                                type="date"
                                value={newInvoiceDate}
                                onChange={e => setNewInvoiceDate(e.target.value)}
                                className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-medium"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400 mb-1">
                                Máquinas / Descrição
                              </label>
                              <input
                                type="text"
                                value={newInvoiceDesc}
                                onChange={e => setNewInvoiceDesc(e.target.value)}
                                placeholder="Ex: Condensadora 1 e 2"
                                className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                              />
                            </div>
                          </div>

                          <div className="flex items-center justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setAddingInvoiceBillingId(null)}
                              className="px-3 py-1 text-xs text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              disabled={submittingInvoice}
                              onClick={() => handleAddInvoice(b.id)}
                              className="px-4 py-1 text-xs bg-emerald-600 hover:bg-emerald-500 !text-white font-bold rounded-lg shadow-sm flex items-center gap-1 disabled:opacity-50"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>{submittingInvoice ? 'Salvando...' : 'Salvar NF & Abater Saldo'}</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Lista de Notas Fiscais cadastradas no pedido */}
                      {invoiceList.length > 0 && (
                        <div className="border border-slate-200 dark:border-slate-700/80 rounded-xl overflow-hidden text-xs">
                          <button
                            type="button"
                            onClick={() => setExpandedInvoicesBillingId(isExpandedInvoices ? null : b.id)}
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-900 flex items-center justify-between font-bold text-slate-700 dark:text-slate-300 transition-colors"
                          >
                            <span className="flex items-center gap-1.5">
                              <Receipt className="w-3.5 h-3.5 text-blue-500" />
                              Notas Fiscais Cadastradas ({invoiceList.length})
                            </span>
                            <span className="flex items-center gap-1 text-[11px] text-slate-500 font-normal">
                              {isExpandedInvoices ? 'Recolher' : 'Exibir detalhes'}
                              {isExpandedInvoices ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </span>
                          </button>

                          {(isExpandedInvoices || isAddingInvoice) && (
                            <div className="p-2 space-y-1.5 divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-800/40">
                              {invoiceList.map(inv => (
                                <div key={inv.id} className="pt-1.5 first:pt-0 flex items-center justify-between gap-2 text-xs">
                                  <div className="flex items-center gap-2">
                                    <span className="font-extrabold text-slate-900 dark:text-white">
                                      {inv.invoice_number}
                                    </span>
                                    {inv.issue_date && (
                                      <span className="text-[11px] text-slate-400 font-mono">
                                        ({new Date(inv.issue_date).toLocaleDateString('pt-BR')})
                                      </span>
                                    )}
                                    {inv.description && (
                                      <span className="text-[11px] text-slate-500 truncate max-w-xs">
                                        • {inv.description}
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-3">
                                    <span className="font-black text-emerald-600 dark:text-emerald-400 font-mono">
                                      R$ {Number(inv.amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteInvoice(inv.id, inv.invoice_number)}
                                      className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-colors"
                                      title="Excluir esta nota fiscal"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Esteira Compras x Financeiro com Toggles (Print 4) */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                        
                        {/* Seção Compras */}
                        <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <ShoppingCart className="w-3.5 h-3.5 text-blue-500" />
                            1. Setor de Compras
                          </div>
                          <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-800 dark:text-slate-200 select-none">
                            <input
                              type="checkbox"
                              checked={b.step_compra_enviada}
                              onChange={() => handleToggleStep(b.id, 'step_compra_enviada', b.step_compra_enviada)}
                              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 dark:border-slate-700"
                            />
                            <span className={b.step_compra_enviada ? 'line-through text-slate-400' : ''}>
                              Pedido de compra enviado ao fornecedor
                            </span>
                          </label>
                        </div>

                        {/* Seção Financeiro */}
                        <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
                            2. Setor Financeiro & Documentação
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-800 dark:text-slate-200 select-none">
                              <input
                                type="checkbox"
                                checked={b.step_nf_recebida}
                                onChange={() => handleToggleStep(b.id, 'step_nf_recebida', b.step_nf_recebida)}
                                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                              />
                              <span className={b.step_nf_recebida ? 'line-through text-slate-400' : ''}>
                                NF recebida
                              </span>
                            </label>

                            <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-800 dark:text-slate-200 select-none">
                              <input
                                type="checkbox"
                                checked={b.step_xml_recebido}
                                onChange={() => handleToggleStep(b.id, 'step_xml_recebido', b.step_xml_recebido)}
                                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                              />
                              <span className={b.step_xml_recebido ? 'line-through text-slate-400' : ''}>
                                XML recebido
                              </span>
                            </label>

                            <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-800 dark:text-slate-200 select-none">
                              <input
                                type="checkbox"
                                checked={b.step_boleto_recebido}
                                onChange={() => handleToggleStep(b.id, 'step_boleto_recebido', b.step_boleto_recebido)}
                                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                              />
                              <span className={b.step_boleto_recebido ? 'line-through text-slate-400' : ''}>
                                Boleto recebido
                              </span>
                            </label>

                            <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-800 dark:text-slate-200 select-none">
                              <input
                                type="checkbox"
                                checked={b.step_enviado_cliente}
                                onChange={() => handleToggleStep(b.id, 'step_enviado_cliente', b.step_enviado_cliente)}
                                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                              />
                              <span className={b.step_enviado_cliente ? 'line-through text-slate-400' : ''}>
                                Enviado ao cliente
                              </span>
                            </label>
                          </div>
                        </div>

                      </div>
                    </div>
                  );
                })}

                {billings.length === 0 && (
                  <div className="py-12 text-center text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                    <Building2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    Nenhum pedido em faturamento direto cadastrado.
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* ================= ABA 2: COMPRAS WEB (SEM CNPJ) ================= */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500">
                  Controle de aquisições via e-commerce (Mercado Livre, ferramentas, consumíveis) sem emissão direta para CNPJ.
                </p>
                {!showNewWeb && (
                  <button
                    onClick={() => setShowNewWeb(true)}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 !text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-sm transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    Registrar Compra Web
                  </button>
                )}
              </div>

              {/* Form Compra Web */}
              {showNewWeb && (
                <form onSubmit={handleCreateWebPurchase} className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 p-4 rounded-xl space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                    <h4 className="font-semibold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                      <ShoppingCart className="w-4 h-4 text-blue-600" />
                      Registrar Compra Online
                    </h4>
                    <button
                      type="button"
                      onClick={() => setShowNewWeb(false)}
                      className="text-xs text-slate-400 hover:text-slate-600"
                    >
                      Cancelar
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Descrição do Produto *
                      </label>
                      <input
                        type="text"
                        required
                        value={webDesc}
                        onChange={e => setWebDesc(e.target.value)}
                        placeholder="Ex: Bomba de Vácuo 7CFM Duplo Estágio"
                        className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Obra Destino
                      </label>
                      <select
                        value={webProjectId}
                        onChange={e => setWebProjectId(e.target.value ? Number(e.target.value) : '')}
                        className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                      >
                        <option value="">Almoxarifado / Geral</option>
                        {projects.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.code} - {p.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Plataforma / Site
                      </label>
                      <input
                        type="text"
                        value={webPlatform}
                        onChange={e => setWebPlatform(e.target.value)}
                        placeholder="Mercado Livre, Amazon..."
                        className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Valor Total (R$) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={webAmount}
                        onChange={e => setWebAmount(e.target.value)}
                        placeholder="0,00"
                        className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Forma de Pagamento
                      </label>
                      <select
                        value={webPayment}
                        onChange={e => setWebPayment(e.target.value)}
                        className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                      >
                        <option value="Cartão Corporativo">Cartão Corporativo</option>
                        <option value="Pix">Pix Sabrar</option>
                        <option value="Boleto">Boleto</option>
                        <option value="Reembolso">Reembolso Funcionário</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Status de Entrega
                      </label>
                      <select
                        value={webDelivery}
                        onChange={e => setWebDelivery(e.target.value)}
                        className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                      >
                        <option value="Aguardando envio">Aguardando envio</option>
                        <option value="A caminho">A caminho / Em trânsito</option>
                        <option value="Entregue">Entregue no Almoxarifado</option>
                      </select>
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        N° Pedido / Rastreamento / Comprovante
                      </label>
                      <input
                        type="text"
                        value={webReceipt}
                        onChange={e => setWebReceipt(e.target.value)}
                        placeholder="Código de rastreio ou número do pedido"
                        className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowNewWeb(false)}
                      className="px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 !text-white font-semibold rounded-lg shadow-sm"
                    >
                      Salvar Compra Web
                    </button>
                  </div>
                </form>
              )}

              {/* Tabela de Compras Web */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700">
                      <th className="py-3 px-3 font-bold">Cód</th>
                      <th className="py-3 px-3 font-bold">Produto / Descrição</th>
                      <th className="py-3 px-3 font-bold">Obra</th>
                      <th className="py-3 px-3 font-bold">Plataforma</th>
                      <th className="py-3 px-3 font-bold">Valor</th>
                      <th className="py-3 px-3 font-bold">Pagamento</th>
                      <th className="py-3 px-3 text-center font-bold">Entrega</th>
                      <th className="py-3 px-3 font-bold">Rastreio/Pedido</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {webPurchases.map(wp => (
                      <tr key={wp.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-2.5 px-3 font-bold text-blue-600 dark:text-blue-400">{wp.code}</td>
                        <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-slate-100">{wp.product_description}</td>
                        <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">{wp.project_name || 'Almoxarifado'}</td>
                        <td className="py-2.5 px-3 font-semibold text-slate-700 dark:text-slate-300">{wp.platform}</td>
                        <td className="py-2.5 px-3 font-bold text-emerald-600 dark:text-emerald-400">
                          R$ {Number(wp.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500">{wp.payment_method}</td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                            wp.delivery_status === 'Entregue'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                          }`}>
                            {wp.delivery_status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-400">{wp.invoice_receipt_number || '--'}</td>
                      </tr>
                    ))}
                    {webPurchases.length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-400 italic">
                          Nenhuma compra de internet cadastrada.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 rounded-b-2xl flex items-center justify-between text-xs text-slate-500">
          <div>
            * Esteira sincronizada em tempo real entre Suprimentos e Financeiro Sabrar.
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold rounded-lg transition-colors"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
};
