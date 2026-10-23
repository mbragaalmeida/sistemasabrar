import React, { useState, useEffect, useMemo } from 'react';
import {
  FileSpreadsheet,
  ClipboardCheck,
  ShoppingCart,
  Check,
  Filter,
  Search,
  Truck,
  Clock,
  DollarSign,
  PackageCheck,
  AlertTriangle,
  PlusCircle,
  Building2,
  ChevronDown,
  ChevronUp,
  List,
  Layers,
  ArrowRight,
  Maximize2,
  Minimize2,
  ClipboardList,
  FileCode
} from 'lucide-react';
import { Purchase } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { StatusBadge } from '../components/common/StatusBadge';
import { NewPurchaseModal } from '../components/modals/NewPurchaseModal';
import { CreatePurchaseModal } from '../components/modals/CreatePurchaseModal';
import { XmlInvoiceModal } from '../components/modals/XmlInvoiceModal';
import { QuotationComparisonModal } from '../components/modals/QuotationComparisonModal';
import { ReceivingChecklistModal } from '../components/modals/ReceivingChecklistModal';
import { DirectBillingModal } from '../components/modals/DirectBillingModal';
import { canImportXml } from '../utils/permissions';

interface ProjectGroup {
  projectId: number | 'geral';
  projectCode: string;
  projectName: string;
  items: Purchase[];
  totalEstimated: number;
  totalQuantity: number;
  statusBreakdown: {
    cotacao: number;
    comprado: number;
    entrega: number;
    recebido: number;
  };
}

export const PurchasesPage: React.FC = () => {
  const { currentUser } = useAuth();
  const [allPurchases, setAllPurchases] = useState<Purchase[]>([]);
  const [statusFilter, setStatusFilter] = useState<'todos' | 'cotacao' | 'comprado' | 'entrega' | 'recebido'>('todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'by_project' | 'linear'>('by_project');
  const [expandedProjects, setExpandedProjects] = useState<Set<number | string>>(new Set());
  const [loading, setLoading] = useState(true);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isXmlModalOpen, setIsXmlModalOpen] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);
  const [isQuotationModalOpen, setIsQuotationModalOpen] = useState(false);
  const [selectedQuotationId, setSelectedQuotationId] = useState<number | null>(null);
  const [isChecklistModalOpen, setIsChecklistModalOpen] = useState(false);
  const [selectedChecklistId, setSelectedChecklistId] = useState<number | null>(null);
  const [isDirectBillingModalOpen, setIsDirectBillingModalOpen] = useState(false);
  const [quotationsList, setQuotationsList] = useState<any[]>([]);
  const [checklistsList, setChecklistsList] = useState<any[]>([]);

  const canApprovePurchases = Boolean(
    currentUser?.role === 'admin' ||
    currentUser?.role === 'compras_solicitacoes' ||
    currentUser?.role === 'orcamento_engenharia' ||
    /sabrina|emily/i.test(currentUser?.name || '') ||
    /sabrina|emily/i.test(currentUser?.email || '')
  );

  const handleApprovePurchase = async (purchaseId: number, status: 'Aprovado' | 'Rejeitado') => {
    let rejection_notes = undefined;
    if (status === 'Rejeitado') {
      const reason = window.prompt('Informe o motivo da rejeição da compra:');
      if (reason === null) return;
      rejection_notes = reason;
    }
    try {
      await api.approvePurchase(purchaseId, {
        approval_status: status,
        userId: currentUser?.id,
        rejection_notes
      });
      alert(`Compra ${status === 'Aprovado' ? 'aprovada' : 'rejeitada'} com sucesso!`);
      await fetchPurchases();
    } catch (err: any) {
      alert(err.message || 'Erro ao processar aprovação.');
    }
  };

  const fetchPurchases = async () => {
    setLoading(true);
    try {
      const [data, qList, cList] = await Promise.all([
        api.getPurchases(),
        api.getQuotations().catch(() => []),
        api.getReceivingChecklists().catch(() => [])
      ]);
      setAllPurchases(data);
      setQuotationsList(qList || []);
      setChecklistsList(cList || []);
    } catch (err) {
      console.error('Erro ao carregar compras:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPurchases();
  }, []);

  const totalCount = allPurchases.length;
  const cotacaoCount = allPurchases.filter(p => ['Em cotação', 'Solicitado'].includes(p.status)).length;
  const compradoCount = allPurchases.filter(p => p.status === 'Comprado').length;
  const aguardandoCount = allPurchases.filter(p => p.status === 'Aguardando entrega').length;
  const recebidoCount = allPurchases.filter(p => p.status === 'Recebido').length;

  // Filtragem combinada por status e pesquisa de texto
  const filteredPurchases = useMemo(() => {
    return allPurchases.filter(p => {
      // Filtro de status
      if (statusFilter === 'cotacao' && !['Em cotação', 'Solicitado'].includes(p.status)) return false;
      if (statusFilter === 'comprado' && p.status !== 'Comprado') return false;
      if (statusFilter === 'entrega' && p.status !== 'Aguardando entrega') return false;
      if (statusFilter === 'recebido' && p.status !== 'Recebido') return false;

      // Filtro de busca textual
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchCode = (p.code || '').toLowerCase().includes(q);
        const matchMat = (p.material_name || '').toLowerCase().includes(q);
        const matchProj = (p.project_name || '').toLowerCase().includes(q);
        const matchProjCode = (p.project_code || '').toLowerCase().includes(q);
        const matchSupp = (p.supplier_name || '').toLowerCase().includes(q);
        if (!matchCode && !matchMat && !matchProj && !matchProjCode && !matchSupp) return false;
      }

      return true;
    });
  }, [allPurchases, statusFilter, searchQuery]);

  // Agrupamento estruturado por obra (projeto)
  const groupedByProject = useMemo(() => {
    const map = new Map<number | string, ProjectGroup>();

    filteredPurchases.forEach(p => {
      const key = p.project_id || 'geral';
      if (!map.has(key)) {
        map.set(key, {
          projectId: p.project_id || 'geral',
          projectCode: p.project_code || 'SABRAR',
          projectName: p.project_name || 'Estoque Geral / Reposição Interna',
          items: [],
          totalEstimated: 0,
          totalQuantity: 0,
          statusBreakdown: {
            cotacao: 0,
            comprado: 0,
            entrega: 0,
            recebido: 0
          }
        });
      }

      const group = map.get(key)!;
      group.items.push(p);
      group.totalQuantity += Number(p.quantity || 0);

      const price = Number(p.unit_price || 0);
      group.totalEstimated += Number(p.quantity || 0) * price;

      if (['Em cotação', 'Solicitado'].includes(p.status)) group.statusBreakdown.cotacao++;
      else if (p.status === 'Comprado') group.statusBreakdown.comprado++;
      else if (p.status === 'Aguardando entrega') group.statusBreakdown.entrega++;
      else if (p.status === 'Recebido') group.statusBreakdown.recebido++;
    });

    return Array.from(map.values()).sort((a, b) => {
      if (a.projectId === 'geral') return 1;
      if (b.projectId === 'geral') return -1;
      return b.items.length - a.items.length;
    });
  }, [filteredPurchases]);

  // Por padrão, expande a primeira obra quando os dados carregarem
  useEffect(() => {
    if (groupedByProject.length > 0 && expandedProjects.size === 0) {
      setExpandedProjects(new Set([groupedByProject[0].projectId]));
    }
  }, [groupedByProject.length]);

  const toggleProjectExpand = (key: number | string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const expandAll = () => {
    setExpandedProjects(new Set(groupedByProject.map(g => g.projectId)));
  };

  const collapseAll = () => {
    setExpandedProjects(new Set());
  };

  const handleConfirmReceipt = async (purchaseId: number) => {
    if (!window.confirm('Confirmar o recebimento físico deste material? A quantidade será creditada diretamente no estoque físico.')) {
      return;
    }
    try {
      await api.receivePurchase(purchaseId, currentUser?.id);
      await fetchPurchases();
    } catch (err: any) {
      alert(err.message || 'Erro ao confirmar recebimento');
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header com Logomarca e Ação Rápida */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-dark-900 p-4 sm:p-5 rounded-3xl border border-dark-750 shadow-xl">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-sabrar-950/70 border border-sabrar-500/40 flex items-center justify-center text-sabrar-400">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Compras & Cotações
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Gestão inteligente de compras agrupada por obra com cotações e recebimento de pedidos
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
          {/* Botão Entrada via NF-e (XML) */}
          {canImportXml(currentUser) && (
            <button
              onClick={() => setIsXmlModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition-all shadow-md shadow-teal-600/30 active:scale-95 whitespace-nowrap"
            >
              <FileCode className="w-4 h-4" />
              <span>Entrada via NF-e (XML)</span>
            </button>
          )}

          
          {/* Botão Mapa Comparativo de Cotações (Print 2) */}
          <button
            onClick={() => {
              setSelectedQuotationId(quotationsList[0]?.id || 1);
              setIsQuotationModalOpen(true);
            }}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md shadow-blue-600/30 active:scale-95 whitespace-nowrap"
            title="Abrir mapa comparativo de preços entre até 3 fornecedores"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Mapa de Cotações</span>
          </button>

          {/* Botão Checklist de Recebimento (Print 3) */}
          <button
            onClick={() => {
              setSelectedChecklistId(checklistsList[0]?.id || 1);
              setIsChecklistModalOpen(true);
            }}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/30 active:scale-95 whitespace-nowrap"
            title="Conferência física na entrega de materiais"
          >
            <ClipboardCheck className="w-4 h-4" />
            <span>Checklist Recebimento</span>
          </button>

          {/* Botão Faturamento Direto & Compras Web (Print 4) */}
          <button
            onClick={() => setIsDirectBillingModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all shadow-md shadow-purple-600/30 active:scale-95 whitespace-nowrap"
            title="Esteira Compras x Financeiro e compras sem CNPJ"
          >
            <Building2 className="w-4 h-4" />
            <span>Faturamento Direto & Web</span>
          </button>

          {/* Botão Cadastrar Compra Manual */}
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-sabrar-600 hover:bg-sabrar-500 text-white text-xs font-bold transition-all shadow-lg shadow-sabrar-600/30 active:scale-95 whitespace-nowrap"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Nova Solicitação de Compra</span>
          </button>
        </div>
      </div>

      {/* Barra de Controles: Filtros de Status, Alternador de Visão e Busca */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Filter Pills por Status */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <div className="flex items-center gap-1 text-slate-400 font-semibold shrink-0 mr-1">
            <Filter className="w-3.5 h-3.5 text-sabrar-400" />
            <span>Fila:</span>
          </div>

          {[
            { id: 'todos', label: 'Todos', count: totalCount },
            { id: 'cotacao', label: 'Em Cotação', count: cotacaoCount },
            { id: 'comprado', label: 'Comprado', count: compradoCount },
            { id: 'entrega', label: 'Aguardando Entrega', count: aguardandoCount },
            { id: 'recebido', label: 'Recebidos', count: recebidoCount },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setStatusFilter(f.id as any)}
              className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                statusFilter === f.id
                  ? 'bg-sabrar-600 text-white shadow-md shadow-sabrar-600/30'
                  : 'bg-dark-850 text-slate-400 hover:text-white hover:bg-dark-800 border border-dark-700'
              }`}
            >
              <span>{f.label}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                statusFilter === f.id ? 'bg-sabrar-800 text-white' : 'bg-dark-750 text-slate-300'
              }`}>
                {f.count}
              </span>
            </button>
          ))}
        </div>

        {/* Lado Direito: Busca e Alternador de Modo (Por Obra vs Lista Completa) */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Busca Textual */}
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar material, código ou obra..."
              className="w-full text-xs pl-8 pr-3 py-1.5 rounded-xl bg-dark-850 border border-dark-700 focus:outline-none focus:border-sabrar-500 text-white placeholder-slate-500"
            />
          </div>

          {/* Toggle de Visualização */}
          <div className="flex items-center bg-dark-850 p-1 rounded-2xl border border-dark-700 text-xs">
            <button
              type="button"
              onClick={() => setViewMode('by_project')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all ${
                viewMode === 'by_project'
                  ? 'bg-sabrar-600 text-white shadow-md shadow-sabrar-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Organizar demandas agrupadas por obra com lista expansível"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Por Obra</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('linear')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all ${
                viewMode === 'linear'
                  ? 'bg-sabrar-600 text-white shadow-md shadow-sabrar-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Visualizar lista linear completa de itens"
            >
              <List className="w-3.5 h-3.5" />
              <span>Lista Linear</span>
            </button>
          </div>
        </div>
      </div>

      {loading && (
        <div className="py-20 text-center text-sm text-slate-500">
          Carregando demandas de compras e cotações...
        </div>
      )}

      {/* ========================================================= */}
      {/* 1. VISUALIZAÇÃO AGRUPADA POR OBRA (ACCORDION EXPANSÍVEL) */}
      {/* ========================================================= */}
      {!loading && viewMode === 'by_project' && (
        <div className="space-y-4">
          {/* Botões Auxiliares: Expandir Todas / Recolher Todas */}
          {groupedByProject.length > 1 && (
            <div className="flex items-center justify-between text-xs px-1 text-slate-400">
              <span className="font-semibold">
                Mostrando <strong>{groupedByProject.length} obras</strong> com demandas de compras ativas ({filteredPurchases.length} materiais)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={expandAll}
                  className="hover:text-white flex items-center gap-1 transition-colors"
                >
                  <Maximize2 className="w-3 h-3" />
                  <span>Expandir Todas</span>
                </button>
                <span>•</span>
                <button
                  type="button"
                  onClick={collapseAll}
                  className="hover:text-white flex items-center gap-1 transition-colors"
                >
                  <Minimize2 className="w-3 h-3" />
                  <span>Recolher Todas</span>
                </button>
              </div>
            </div>
          )}

          {groupedByProject.length === 0 ? (
            <div className="py-16 text-center bg-dark-900 rounded-3xl border border-dark-750 text-xs text-slate-500">
              Nenhuma demanda de compra encontrada para o filtro selecionado.
            </div>
          ) : (
            groupedByProject.map((group) => {
              const isExpanded = expandedProjects.has(group.projectId);

              return (
                <div
                  key={group.projectId}
                  className={`bg-dark-900 rounded-3xl border transition-all shadow-md overflow-hidden ${
                    isExpanded ? 'border-sabrar-500/50 ring-1 ring-sabrar-500/20' : 'border-dark-750 hover:border-dark-700'
                  }`}
                >
                  {/* Cabeçalho do Card da Obra (Clicável para Expandir/Recolher) */}
                  <div
                    onClick={() => toggleProjectExpand(group.projectId)}
                    className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer select-none bg-dark-850/60 hover:bg-dark-850 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-sabrar-950/80 border border-sabrar-500/40 flex items-center justify-center text-sabrar-400 shrink-0">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-bold text-sabrar-400 px-2 py-0.5 rounded bg-dark-800 border border-dark-700">
                            {group.projectCode}
                          </span>
                          <h3 className="font-extrabold text-sm sm:text-base text-white">
                            {group.projectName}
                          </h3>
                        </div>

                        {/* Badges de Status das Compras da Obra */}
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap text-[11px]">
                          <span className="font-bold text-slate-300 bg-dark-800 px-2 py-0.5 rounded-lg border border-dark-700">
                            {group.items.length} {group.items.length === 1 ? 'material' : 'materiais'}
                          </span>
                          {group.statusBreakdown.cotacao > 0 && (
                            <span className="text-amber-300 bg-amber-950/70 border border-amber-600/40 px-2 py-0.5 rounded-lg font-semibold">
                              {group.statusBreakdown.cotacao} em cotação
                            </span>
                          )}
                          {group.statusBreakdown.comprado > 0 && (
                            <span className="text-sky-300 bg-sky-950/70 border border-sky-600/40 px-2 py-0.5 rounded-lg font-semibold">
                              {group.statusBreakdown.comprado} comprado
                            </span>
                          )}
                          {group.statusBreakdown.entrega > 0 && (
                            <span className="text-indigo-300 bg-indigo-950/70 border border-indigo-600/40 px-2 py-0.5 rounded-lg font-semibold">
                              {group.statusBreakdown.entrega} aguardando entrega
                            </span>
                          )}
                          {group.statusBreakdown.recebido > 0 && (
                            <span className="text-emerald-300 bg-emerald-950/70 border border-emerald-600/40 px-2 py-0.5 rounded-lg font-semibold">
                              {group.statusBreakdown.recebido} recebido no estoque
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Lado Direito: Total Estimado e Botão Expansor */}
                    <div className="flex items-center justify-between md:justify-end gap-4 border-t md:border-t-0 pt-2 md:pt-0 border-dark-750">
                      {group.totalEstimated > 0 && (
                        <div className="text-left md:text-right">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                            Valor Estimado / Cotado
                          </span>
                          <span className="text-base font-black text-white">
                            R$ {group.totalEstimated.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-dark-800 border border-dark-700 text-xs font-bold text-slate-300 group-hover:text-white">
                        <span>{isExpanded ? 'Recolher' : 'Ver Materiais'}</span>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-sabrar-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Lista Expansiva com Todos os Itens desta Obra Agrupados por Pedido/Solicitação */}
                  {isExpanded && (
                    <div className="p-3 sm:p-5 border-t border-dark-750 bg-dark-900 space-y-4 animate-in fade-in duration-150">
                      {(() => {
                        // Agrupamento dos itens da obra por Solicitação de Material (SOL-...)
                        const requestMap = new Map<string, {
                          requestCode: string;
                          requestId: number | null;
                          requesterName: string | null;
                          requestDate: string | null;
                          items: Purchase[];
                        }>();

                        group.items.forEach(p => {
                          const codeKey = p.request_code || 'AVULSO';
                          if (!requestMap.has(codeKey)) {
                            requestMap.set(codeKey, {
                              requestCode: codeKey,
                              requestId: p.request_id || null,
                              requesterName: p.requester_name || null,
                              requestDate: p.request_created_at || null,
                              items: []
                            });
                          }
                          requestMap.get(codeKey)!.items.push(p);
                        });

                        const subGroups = Array.from(requestMap.values()).sort((a, b) => {
                          if (a.requestCode === 'AVULSO') return 1;
                          if (b.requestCode === 'AVULSO') return -1;
                          return b.requestCode.localeCompare(a.requestCode);
                        });

                        return subGroups.map((subGroup) => {
                          const subTotalEstimated = subGroup.items.reduce(
                            (acc, it) => acc + (Number(it.quantity || 0) * Number(it.unit_price || 0)), 0
                          );

                          return (
                            <div key={subGroup.requestCode} className="space-y-2.5 bg-dark-850/50 p-3 sm:p-4 rounded-2xl border border-dark-750/90 shadow-sm">
                              {/* Cabeçalho do Pedido / Solicitação de Material */}
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-dark-700/60">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="w-7 h-7 rounded-lg bg-sabrar-950/90 border border-sabrar-500/40 flex items-center justify-center text-sabrar-400 shrink-0">
                                    <ClipboardList className="w-3.5 h-3.5" />
                                  </div>
                                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                                    <span className={`px-2 py-0.5 rounded font-mono font-bold text-xs ${
                                      subGroup.requestCode === 'AVULSO'
                                        ? 'bg-dark-750 text-slate-300 border border-dark-650'
                                        : 'bg-sabrar-950 text-sabrar-400 border border-sabrar-500/40'
                                    }`}>
                                      {subGroup.requestCode === 'AVULSO' ? 'Demandas Diretas / Sem Pedido Vinculado' : `Pedido: ${subGroup.requestCode}`}
                                    </span>
                                    {subGroup.requesterName && (
                                      <span className="text-xs text-slate-300">
                                        Solicitado por: <strong className="text-white">{subGroup.requesterName}</strong>
                                      </span>
                                    )}
                                    {subGroup.requestDate && (
                                      <span className="text-[11px] text-slate-400">
                                        • {new Date(subGroup.requestDate).toLocaleDateString('pt-BR')}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 text-xs self-end sm:self-center">
                                  <span className="font-bold text-slate-400 bg-dark-800 px-2 py-0.5 rounded-lg border border-dark-700">
                                    {subGroup.items.length} {subGroup.items.length === 1 ? 'material' : 'materiais'}
                                  </span>
                                  {subTotalEstimated > 0 && (
                                    <span className="text-emerald-400 font-bold bg-emerald-950/40 px-2 py-0.5 rounded-lg border border-emerald-600/30">
                                      Subtotal: R$ {subTotalEstimated.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Tabela Responsiva de Materiais deste Pedido */}
                              <div className="overflow-x-auto rounded-xl border border-dark-750 bg-dark-900/70">
                                <table className="w-full text-left text-xs">
                                  <thead className="bg-dark-800/90 text-slate-400 font-bold border-b border-dark-700">
                                    <tr>
                                      <th className="p-3">Código Compra</th>
                                      <th className="p-3">Material Solicitado</th>
                                      <th className="p-3 text-right">Qtd. Solicitada</th>
                                      <th className="p-3 text-right">Preço Estimado</th>
                                      <th className="p-3">Fornecedor</th>
                                      <th className="p-3">Previsão</th>
                                      <th className="p-3 text-center">Status</th>
                                      <th className="p-3 text-right">Ações</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-dark-750/70">
                                    {subGroup.items.map((p) => {
                                      const isReceived = p.status === 'Recebido';
                                      const subtotal = Number(p.quantity || 0) * Number(p.unit_price || 0);

                                      return (
                                        <tr key={p.id} className="hover:bg-dark-800/50 transition-colors">
                                          {/* Código da Demanda */}
                                          <td className="p-3 whitespace-nowrap font-mono font-bold text-sabrar-400">
                                            {p.code}
                                          </td>

                                          {/* Nome do Material */}
                                          <td className="p-3 min-w-[200px]">
                                            <div className="font-extrabold text-white">{p.material_name}</div>
                                            <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                                              {p.material_code ? `Código: ${p.material_code}` : 'Item Solicitado'}
                                            </div>
                                          </td>

                                          {/* Quantidade */}
                                          <td className="p-3 text-right whitespace-nowrap font-bold text-white">
                                            {p.quantity} {p.material_unit}
                                          </td>

                                          {/* Preço Unitário & Subtotal */}
                                          <td className="p-3 text-right whitespace-nowrap">
                                            {p.unit_price ? (
                                              <div>
                                                <div className="font-extrabold text-white">
                                                  R$ {subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </div>
                                                <div className="text-[10px] text-slate-400">
                                                  R$ {p.unit_price.toFixed(2)}/{p.material_unit}
                                                </div>
                                              </div>
                                            ) : (
                                              <span className="text-slate-500 italic text-[11px]">A cotar</span>
                                            )}
                                          </td>

                                          {/* Fornecedor */}
                                          <td className="p-3 whitespace-nowrap text-slate-300">
                                            {p.supplier_name || <span className="text-slate-500 italic">Em cotação</span>}
                                          </td>

                                          {/* Previsão de Entrega */}
                                          <td className="p-3 whitespace-nowrap text-slate-400 text-[11px]">
                                            {p.expected_delivery_date
                                              ? new Date(p.expected_delivery_date).toLocaleDateString('pt-BR')
                                              : <span className="italic text-slate-500">Aguardando</span>}
                                          </td>

                                          {/* Status & Prioridade */}
                                          <td className="p-3 text-center whitespace-nowrap">
                                            <div className="flex items-center justify-center gap-1">
                                              <StatusBadge status={p.priority || 'Normal'} size="sm" />
                                              <StatusBadge status={p.status} size="sm" />
                                            </div>
                                          </td>

                                          {/* Botões de Ação */}
                                          <td className="p-3 text-right whitespace-nowrap">
                                            <div className="flex items-center justify-end gap-1.5">
                                              {!isReceived ? (
                                                <>
                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      setSelectedPurchase(p);
                                                      setIsEditModalOpen(true);
                                                    }}
                                                    className="px-2.5 py-1 rounded-lg border border-dark-700 bg-dark-800 hover:bg-dark-750 text-slate-200 text-xs font-bold transition-colors"
                                                    title="Atualizar cotação, fornecedor ou data de entrega"
                                                  >
                                                    Cotar
                                                  </button>

                                                  <button
                                                    type="button"
                                                    onClick={() => handleConfirmReceipt(p.id)}
                                                    className="flex items-center gap-1 px-3 py-1 rounded-lg bg-sabrar-600 hover:bg-sabrar-500 text-white text-xs font-bold transition-all shadow-sm active:scale-95"
                                                    title="Confirmar chegada do material e entrada no almoxarifado"
                                                  >
                                                    <PackageCheck className="w-3.5 h-3.5" />
                                                    <span>Receber</span>
                                                  </button>
                                                </>
                                              ) : (
                                                <span className="flex items-center gap-1 text-emerald-400 font-bold text-[11px] bg-emerald-950/80 px-2.5 py-1 rounded-lg border border-emerald-500/40">
                                                  <Check className="w-3.5 h-3.5" />
                                                  <span>Recebido</span>
                                                </span>
                                              )}
                                            </div>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          );
                        });
                      })()}

                      {/* Rodapé da Obra com Totais */}
                      <div className="p-3 bg-dark-850 rounded-2xl border border-dark-750 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                        <div className="flex items-center gap-3">
                          <span>Total de materiais da obra: <strong className="text-white">{group.items.length}</strong></span>
                          <span>•</span>
                          <span>Recebidos: <strong className="text-emerald-400">{group.statusBreakdown.recebido} de {group.items.length}</strong></span>
                        </div>
                        {group.totalEstimated > 0 && (
                          <div className="text-white font-bold">
                            Total cotado para a obra: <span className="text-sabrar-400 font-black">R$ {group.totalEstimated.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. VISUALIZAÇÃO LINEAR COMPLETA (MODO ALTERNATIVO)        */}
      {/* ========================================================= */}
      {!loading && viewMode === 'linear' && (
        <div className="space-y-3.5">
          {filteredPurchases.length === 0 ? (
            <div className="py-16 text-center bg-dark-900 rounded-3xl border border-dark-750 text-xs text-slate-500">
              Nenhuma demanda de compra encontrada para o filtro selecionado.
            </div>
          ) : (
            filteredPurchases.map((p) => {
              const isReceived = p.status === 'Recebido';
              return (
                <div
                  key={p.id}
                  className="bg-dark-900 p-4 sm:p-5 rounded-3xl border border-dark-750 shadow-md space-y-3 hover:border-sabrar-500/40 transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-xs bg-dark-800 border border-dark-700 px-2 py-0.5 rounded text-sabrar-400">
                        {p.code}
                      </span>
                      <span className="font-extrabold text-sm sm:text-base text-white">
                        {p.material_name}
                      </span>
                      <StatusBadge status={p.priority || 'Normal'} size="sm" />
                      <StatusBadge status={p.status} size="sm" />
                    </div>

                    <div className="text-right">
                      <span className="font-black text-sm text-white">
                        {p.quantity} {p.material_unit}
                      </span>
                      {p.unit_price ? (
                        <span className="text-xs text-slate-400 ml-2">
                          (R$ {p.unit_price.toFixed(2)}/{p.material_unit})
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-3 bg-dark-850 rounded-2xl border border-dark-700 text-xs">
                    <div>
                      <span className="text-slate-400 block">Obra de Origem:</span>
                      <span className="font-semibold text-white">
                        {p.project_name ? `${p.project_code} — ${p.project_name}` : 'Reposição Estoque'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Fornecedor Selecionado:</span>
                      <span className="font-semibold text-white">
                        {p.supplier_name || 'A definir / Em cotação'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Previsão de Entrega:</span>
                      <span className="font-semibold text-white">
                        {p.expected_delivery_date
                          ? new Date(p.expected_delivery_date).toLocaleDateString('pt-BR')
                          : 'Aguardando confirmação'}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-dark-750 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="text-slate-400 text-[11px]">
                      Criado em {new Date(p.created_at).toLocaleDateString('pt-BR')} por {p.buyer_name || 'Automação'}
                    </div>

                    <div className="flex items-center gap-2">
                      {!isReceived && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPurchase(p);
                              setIsEditModalOpen(true);
                            }}
                            className="px-3 py-1.5 rounded-xl border border-dark-700 bg-dark-850 hover:bg-dark-800 text-slate-200 font-bold transition-colors"
                          >
                            Atualizar Cotação / Fornecedor
                          </button>

                          <button
                            type="button"
                            onClick={() => handleConfirmReceipt(p.id)}
                            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-sabrar-600 hover:bg-sabrar-500 text-white font-bold transition-all shadow-md shadow-sabrar-600/30 active:scale-95"
                          >
                            <PackageCheck className="w-4 h-4" />
                            <span>Confirmar Recebimento</span>
                          </button>
                        </>
                      )}

                      {isReceived && (
                        <span className="flex items-center gap-1 text-sabrar-300 font-bold bg-sabrar-950 px-3 py-1 rounded-xl border border-sabrar-500/40">
                          <Check className="w-4 h-4 text-sabrar-400" />
                          <span>Mercadoria Recebida no Estoque</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Modal para atualizar cotação */}
      {selectedPurchase && (
        <NewPurchaseModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setSelectedPurchase(null);
          }}
          purchase={selectedPurchase}
          onSuccess={() => fetchPurchases()}
        />
      )}

      {/* Modal para criar solicitação manual de compra */}
      <CreatePurchaseModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => fetchPurchases()}
      />

      {/* Modal para entrada de NF-e via XML */}
      <XmlInvoiceModal
        isOpen={isXmlModalOpen}
        onClose={() => setIsXmlModalOpen(false)}
        onSuccess={() => {
          setIsXmlModalOpen(false);
          fetchPurchases();
        }}
      />

      {/* Modal de Mapa Comparativo de Cotações (Print 2) */}
      <QuotationComparisonModal
        isOpen={isQuotationModalOpen}
        onClose={() => {
          setIsQuotationModalOpen(false);
          setSelectedQuotationId(null);
        }}
        quotationId={selectedQuotationId}
        onSuccess={() => fetchPurchases()}
      />

      {/* Modal de Checklist de Recebimento de Materiais (Print 3) */}
      <ReceivingChecklistModal
        isOpen={isChecklistModalOpen}
        onClose={() => {
          setIsChecklistModalOpen(false);
          setSelectedChecklistId(null);
        }}
        checklistId={selectedChecklistId}
        onSuccess={() => fetchPurchases()}
      />

      {/* Modal de Faturamento Direto & Compras Web (Print 4) */}
      <DirectBillingModal
        isOpen={isDirectBillingModalOpen}
        onClose={() => setIsDirectBillingModalOpen(false)}
        onSuccess={() => fetchPurchases()}
      />
    </div>
  );
};
