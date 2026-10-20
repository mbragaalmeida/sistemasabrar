import React, { useState, useEffect, useMemo } from 'react';
import {
  Layers,
  Check,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  AlertTriangle,
  CheckCircle,
  Package,
  Play,
  CheckCircle2,
  Truck,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Filter,
  Printer,
  Building2,
  HardHat,
  List,
  Maximize2,
  Minimize2,
  Search,
  RefreshCw,
  ArrowRight,
  X
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { canUserViewPrices } from '../utils/permissions';
import { StatusBadge } from '../components/common/StatusBadge';
import { PrintRequestModal } from '../components/modals/PrintRequestModal';
import { SubstituteMaterialModal } from '../components/modals/SubstituteMaterialModal';

export const StockPage: React.FC = () => {
  const { currentUser } = useAuth();
  const canViewPrices = canUserViewPrices(currentUser);
  const [activeTab, setActiveTab] = useState<'separacao' | 'devolucoes' | 'extrato'>('separacao');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'aguardando_aprovacao' | 'solicitado' | 'em_separacao' | 'separado_parcial' | 'separado'>('todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [summary, setSummary] = useState<any>(null);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [returns, setReturns] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [substitutions, setSubstitutions] = useState<any[]>([]);
  const [substituteItemData, setSubstituteItemData] = useState<{ request: any; item: any } | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [selectedRequestForPrint, setSelectedRequestForPrint] = useState<any | null>(null);
  const [viewMode, setViewMode] = useState<'by_project' | 'linear'>('by_project');
  const [expandedProjects, setExpandedProjects] = useState<Set<number | string>>(new Set());

  // Gestão de Disponibilidade e Cancelamento de Itens pelo Almoxarifado
  const [togglingItemAvailabilityId, setTogglingItemAvailabilityId] = useState<number | null>(null);
  const [cancellingItemData, setCancellingItemData] = useState<{ item: any; request: any } | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancellingItem, setIsCancellingItem] = useState(false);

  const canApproveSubstitution = Boolean(
    currentUser?.role === 'admin' ||
    /sabrina|emily/i.test(currentUser?.name || '') ||
    /sabrina|emily/i.test(currentUser?.email || '')
  );

  const toggleProjectExpand = (id: number | string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Conjunto de solicitações expandidas na lista (accordion retraível)
  const [expandedRequests, setExpandedRequests] = useState<Set<number>>(new Set());

  const toggleRequestExpanded = (id: number) => {
    setExpandedRequests(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [sumData, reqs, rets, moves, subs] = await Promise.all([
        api.getStockSummary(),
        api.getRequests(),
        api.getReturns(),
        api.getStockMovements(),
        api.getSubstitutions()
      ]);
      setSummary(sumData);
      setPendingRequests(reqs);
      setReturns(rets);
      setMovements(moves);
      setSubstitutions(subs || []);
    } catch (err) {
      console.error('Erro ao carregar dados do estoque:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleItemAvailability = async (item: any) => {
    const current = item.availability_status || 'disponivel';
    const nextStatus = current === 'disponivel' ? 'em_falta' : 'disponivel';
    setTogglingItemAvailabilityId(item.id);
    try {
      await api.updateRequestItemAvailability(item.id, nextStatus, currentUser?.id);
      setPendingRequests(prev => prev.map(req => {
        if (req.items && req.items.some((it: any) => it.id === item.id)) {
          return {
            ...req,
            items: req.items.map((it: any) => it.id === item.id ? { ...it, availability_status: nextStatus } : it)
          };
        }
        return req;
      }));
    } catch (err: any) {
      console.error('Erro ao alternar disponibilidade do item:', err);
      alert(err.message || 'Erro ao alterar disponibilidade');
    } finally {
      setTogglingItemAvailabilityId(null);
    }
  };

  const handleConfirmCancelItem = async () => {
    if (!cancellingItemData || !cancelReason.trim()) {
      alert('Por favor, informe a justificativa do cancelamento.');
      return;
    }
    setIsCancellingItem(true);
    try {
      await api.cancelRequestItem(cancellingItemData.item.id, cancelReason.trim(), currentUser?.id);
      setPendingRequests(prev => prev.map(req => {
        if (req.items && req.items.some((it: any) => it.id === cancellingItemData.item.id)) {
          return {
            ...req,
            items: req.items.map((it: any) => it.id === cancellingItemData.item.id ? {
              ...it,
              item_status: 'Cancelado',
              cancellation_reason: cancelReason.trim(),
              cancelled_by: currentUser?.id,
              cancelled_at: new Date().toISOString()
            } : it)
          };
        }
        return req;
      }));
      setCancellingItemData(null);
      setCancelReason('');
    } catch (err: any) {
      console.error('Erro ao cancelar item:', err);
      alert(err.message || 'Erro ao cancelar item');
    } finally {
      setIsCancellingItem(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleApproveSubstitution = async (subId: number) => {
    if (!window.confirm('Confirma a autorização para a troca deste material?')) return;
    try {
      await api.approveSubstitution(subId, currentUser?.id, 'Autorizado');
      await loadData();
      alert('Troca de material autorizada e aplicada com sucesso!');
    } catch (err: any) {
      console.error('Erro ao aprovar troca:', err);
      alert(err.message || 'Erro ao aprovar troca de material');
    }
  };

  const handleRejectSubstitution = async (subId: number) => {
    const reason = prompt('Informe a justificativa da recusa da troca:');
    if (!reason) return;
    try {
      await api.rejectSubstitution(subId, currentUser?.id, reason);
      await loadData();
      alert('Troca de material recusada.');
    } catch (err: any) {
      console.error('Erro ao recusar troca:', err);
      alert(err.message || 'Erro ao recusar troca de material');
    }
  };

  const handleUpdateStatus = async (requestId: number, newStatus: string) => {
    setUpdatingId(requestId);
    try {
      await api.updateRequestStatus(requestId, newStatus, 'Atualizado pelo Almoxarifado', currentUser?.id);
      await loadData();
    } catch (err) {
      console.error('Erro ao atualizar status da solicitação:', err);
      alert('Erro ao atualizar status');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-dark-900 p-4 sm:p-5 rounded-3xl border border-dark-750 shadow-xl">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-sabrar-950/70 border border-sabrar-500/40 flex items-center justify-center text-sabrar-400">
              <Layers className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Estoque & Almoxarifado Físico
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Controle de estoque físico, reservado e disponível
          </p>
        </div>
      </div>


      {/* Summary Cards */}
      {summary && (
        <div className={`grid grid-cols-2 ${canViewPrices ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-3`}>
          <div className="p-4 bg-white dark:bg-dark-900 rounded-3xl border border-slate-200 dark:border-dark-750 shadow-md">
            <div className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Total Itens Ativos</div>
            <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">{summary.totalItems}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Cadastrados na SABRAR</div>
          </div>

          {canViewPrices && (
            <div className="p-4 bg-white dark:bg-dark-900 rounded-3xl border border-slate-200 dark:border-dark-750 shadow-md">
              <div className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Valuation em Estoque</div>
              <div className="text-2xl font-black text-emerald-700 dark:text-sabrar-400 mt-1">
                R$ {summary.totalPhysicalValuation.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
              </div>
              <div className="text-xs text-emerald-800 dark:text-sabrar-300 font-bold mt-0.5">Preço médio de referência</div>
            </div>
          )}

          <div className="p-4 bg-white dark:bg-dark-900 rounded-3xl border border-slate-200 dark:border-dark-750 shadow-md">
            <div className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Materiais Reservados</div>
            <div className="text-2xl font-black text-amber-700 dark:text-amber-400 mt-1">{summary.totalReservedItems}</div>
            <div className="text-xs text-amber-800 dark:text-amber-300 font-bold mt-0.5">Para obras em andamento</div>
          </div>

          <div className="p-4 bg-white dark:bg-dark-900 rounded-3xl border border-slate-200 dark:border-dark-750 shadow-md">
            <div className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Abaixo do Mínimo</div>
            <div className="text-2xl font-black text-rose-700 dark:text-rose-400 mt-1">{summary.belowMinimumCount}</div>
            <div className="text-xs text-rose-800 dark:text-rose-300 font-bold mt-0.5">Requer compras urgentes</div>
          </div>
        </div>
      )}

      {/* Navigation Subtabs */}
      <div className="flex items-center gap-1.5 bg-dark-900 p-1.5 rounded-2xl border border-dark-750 overflow-x-auto text-xs font-bold text-slate-400">
        <button
          onClick={() => setActiveTab('separacao')}
          className={`px-4 py-2 rounded-xl transition-all whitespace-nowrap ${
            activeTab === 'separacao' ? 'bg-sabrar-600 text-white shadow-md shadow-sabrar-600/30 font-bold' : 'hover:text-white'
          }`}
        >
          Fila de Separação ({pendingRequests.filter(r => r.status !== 'Separado' && r.status !== 'Cancelado').length} pendentes / {pendingRequests.length} total)
        </button>
        <button
          onClick={() => setActiveTab('devolucoes')}
          className={`px-4 py-2 rounded-xl transition-all whitespace-nowrap ${
            activeTab === 'devolucoes' ? 'bg-sabrar-600 text-white shadow-md shadow-sabrar-600/30 font-bold' : 'hover:text-white'
          }`}
        >
          Devoluções Registradas ({returns.length})
        </button>
        <button
          onClick={() => setActiveTab('extrato')}
          className={`px-4 py-2 rounded-xl transition-all whitespace-nowrap ${
            activeTab === 'extrato' ? 'bg-sabrar-600 text-white shadow-md shadow-sabrar-600/30 font-bold' : 'hover:text-white'
          }`}
        >
          Extrato Completo de Movimentações (Auditoria)
        </button>
      </div>

      {loading && (
        <div className="py-16 text-center text-sm text-slate-500">
          Carregando dados do almoxarifado...
        </div>
      )}

      {/* TAB 1: FILA DE SEPARAÇÃO & ENTREGA */}
      {!loading && activeTab === 'separacao' && (() => {
        const awaitingApprovalCount = pendingRequests.filter(r => r.status === 'Aguardando aprovação').length;
        const solicitadoCount = pendingRequests.filter(r => ['Solicitado', 'Reservado'].includes(r.status)).length;
        const emSeparacaoCount = pendingRequests.filter(r => ['Em Separação', 'Em separação'].includes(r.status)).length;
        const separadoParcialCount = pendingRequests.filter(r => ['Separado Parcial', 'Parcialmente Atendido'].includes(r.status)).length;
        const separadoCount = pendingRequests.filter(r => ['Separado', 'Entregue'].includes(r.status)).length;

        const filteredRequests = pendingRequests.filter(req => {
          if (statusFilter === 'aguardando_aprovacao') {
            if (req.status !== 'Aguardando aprovação') return false;
          } else if (statusFilter === 'solicitado') {
            if (!['Solicitado', 'Reservado'].includes(req.status)) return false;
          } else if (statusFilter === 'em_separacao') {
            if (!['Em Separação', 'Em separação'].includes(req.status)) return false;
          } else if (statusFilter === 'separado_parcial') {
            if (!['Separado Parcial', 'Parcialmente Atendido'].includes(req.status)) return false;
          } else if (statusFilter === 'separado') {
            if (!['Separado', 'Entregue'].includes(req.status)) return false;
          }

          if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            const matchesCode = (req.code || '').toLowerCase().includes(q);
            const matchesProject = (req.project_name || '').toLowerCase().includes(q) || (req.project_code || '').toLowerCase().includes(q);
            const matchesClient = (req.client_name || '').toLowerCase().includes(q);
            const matchesRequester = (req.requested_by_name || '').toLowerCase().includes(q);
            const matchesEngineer = (req.responsible_engineer || '').toLowerCase().includes(q);
            const matchesItems = (req.items || []).some((it: any) =>
              (it.material_name || '').toLowerCase().includes(q) ||
              (it.material_code || '').toLowerCase().includes(q)
            );
            if (!matchesCode && !matchesProject && !matchesClient && !matchesRequester && !matchesEngineer && !matchesItems) {
              return false;
            }
          }
          return true;
        });

        // Agrupamento por obra (boxes de cada obra com botão de imprimir romaneio)
        const groupedByProject: any[] = (() => {
          const map = new Map<number | string, any>();

          filteredRequests.forEach(req => {
            const key = req.project_id || 'geral';
            if (!map.has(key)) {
              map.set(key, {
                projectId: key,
                projectCode: req.project_code || 'SABRAR',
                projectName: req.project_name || 'Demanda Geral / Almoxarifado',
                clientName: req.client_name,
                responsibleEngineer: req.responsible_engineer,
                requests: [],
                totalItems: 0,
                totalReserved: 0,
                totalDeficit: 0,
                hasPendingApproval: false,
                requiresAdminCount: 0
              });
            }

            const grp = map.get(key)!;
            grp.requests.push(req);
            if (req.status === 'Aguardando aprovação') {
              grp.hasPendingApproval = true;
              grp.requiresAdminCount++;
            }

            (req.items || []).forEach((it: any) => {
              grp.totalItems++;
              grp.totalReserved += Number(it.quantity_reserved || 0);
              grp.totalDeficit += Number(it.deficit || 0);
            });
          });

          // Ordena as solicitações dentro de cada grupo da mais recente para a mais antiga (Item 4)
          map.forEach(grp => {
            grp.requests.sort((a: any, b: any) => {
              const dateA = new Date(a.created_at).getTime() || Number(a.id) || 0;
              const dateB = new Date(b.created_at).getTime() || Number(b.id) || 0;
              return dateB - dateA;
            });
          });

          // Ordena as obras para que a obra com a solicitação mais recente fique no topo (Item 4)
          return Array.from(map.values()).sort((a, b) => {
            if (a.projectId === 'geral') return 1;
            if (b.projectId === 'geral') return -1;
            const latestA = Math.max(...a.requests.map((r: any) => new Date(r.created_at).getTime() || Number(r.id) || 0));
            const latestB = Math.max(...b.requests.map((r: any) => new Date(r.created_at).getTime() || Number(r.id) || 0));
            return latestB - latestA;
          });
        })();

        const handlePrintProjectRomaneio = (group: any) => {
          const consolidatedItems: any[] = [];
          (group.requests || []).forEach((r: any) => {
            (r.items || []).filter((it: any) => it.item_status !== 'Cancelado').forEach((it: any) => {
              consolidatedItems.push({
                ...it,
                notes: `Solicitação ${r.code} • ${it.notes || ''}`
              });
            });
          });

          setSelectedRequestForPrint({
            id: -1,
            code: `ROM-${group.projectCode || 'OBRA'}`,
            project_id: group.projectId,
            project_code: group.projectCode,
            project_name: group.projectName,
            client_name: group.clientName,
            responsible_engineer: group.responsibleEngineer,
            created_at: new Date().toISOString(),
            status: 'Em separação',
            priority: 'Alta',
            requested_by_name: group.responsibleEngineer || 'Almoxarifado Central',
            items: consolidatedItems,
            notes: `Romaneio consolidado de separação da obra ${group.projectName} (${group.projectCode})`
          });
        };

        const renderRequestCard = (req: any) => {
          const isExpanded = expandedRequests.has(req.id);
          const items = req.items || [];
          const totalItemsCount = items.length;
          const totalDeficit = items.reduce((acc: number, it: any) => acc + (it.deficit || 0), 0);
          const totalReserved = items.reduce((acc: number, it: any) => acc + (it.quantity_reserved || 0), 0);

          return (
            <div
              key={req.id}
              className="bg-dark-900 p-4 sm:p-5 rounded-3xl border border-dark-750 shadow-md space-y-3.5"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono font-bold text-xs bg-dark-800 border border-dark-700 px-2 py-0.5 rounded text-sabrar-400">
                    {req.code}
                  </span>
                  <span className="font-extrabold text-sm text-white">{req.project_name}</span>
                  <StatusBadge status={req.priority} size="sm" />
                  <StatusBadge status={req.status} size="sm" />
                  {req.status === 'Aguardando aprovação' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-950 text-amber-300 border border-amber-600/50">
                      <AlertTriangle className="w-3 h-3 text-amber-400" />
                      Aguardando Aprovação Admin (Extras)
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-[11px] text-slate-400">
                    Solicitado por: <span className="font-semibold text-slate-200">{req.requested_by_name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedRequestForPrint(req)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-dark-800 hover:bg-dark-750 text-white text-xs font-bold border border-dark-700 hover:border-slate-500 transition-colors shadow-sm cursor-pointer"
                    title="Imprimir romaneio de separação de materiais para o almoxarifado"
                  >
                    <Printer className="w-3.5 h-3.5 text-sabrar-400" />
                    <span>Imprimir Romaneio</span>
                  </button>
                </div>
              </div>

              {/* Itens solicitados com Accordion Retraível */}
              <div className="bg-dark-850 rounded-2xl border border-dark-700 overflow-hidden">
                {/* Linha Resumo Retraível */}
                <div
                  onClick={() => toggleRequestExpanded(req.id)}
                  className="flex items-center justify-between p-3 cursor-pointer hover:bg-dark-800 transition-colors select-none"
                >
                  <div className="flex items-center gap-2.5 flex-wrap text-xs">
                    <span className="font-bold text-white flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5 text-sabrar-400" />
                      {totalItemsCount} {totalItemsCount === 1 ? 'item solicitado' : 'itens solicitados'}
                    </span>
                    <span className="text-slate-400">•</span>
                    <span className="text-amber-400 font-semibold text-[11px]">
                      Reservados: {totalReserved}
                    </span>
                    {totalDeficit > 0 ? (
                      <span className="text-rose-400 font-bold bg-rose-950/80 border border-rose-800/60 px-2 py-0.5 rounded text-[11px]">
                        Déficit: {totalDeficit}
                      </span>
                    ) : (
                      <span className="text-teal-400 font-medium text-[11px]">
                        ✓ Sem déficit
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleRequestExpanded(req.id);
                    }}
                    className="flex items-center gap-1 text-xs font-bold text-sabrar-400 hover:text-sabrar-300 px-2.5 py-1 rounded-xl bg-dark-800 hover:bg-dark-750 border border-dark-700 transition-colors shrink-0"
                  >
                    <span>{isExpanded ? 'Ocultar Materiais' : `Ver Materiais (${totalItemsCount})`}</span>
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>

                {/* Conteúdo Retraível Expandido */}
                {isExpanded && (
                  <div className="p-3 border-t border-dark-700 space-y-2 bg-dark-900/40 animate-fadeIn">
                    {items.map((it: any) => {
                      const itemSub = substitutions.find((s: any) => s.request_item_id === it.id && s.status === 'Pendente');
                      const approvedSub = substitutions.find((s: any) => s.request_item_id === it.id && s.status === 'Aprovado');
                      const isCancelled = it.item_status === 'Cancelado';

                      return (
                        <div
                          key={it.id}
                          className={`flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-2 py-2 px-3 rounded-2xl border transition-all ${
                            isCancelled
                              ? 'bg-dark-900/40 border-rose-900/30 opacity-60'
                              : 'bg-dark-850/50 border-dark-800 hover:border-dark-750'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 flex-wrap min-w-0">
                            {it.image_url && (
                              <div className="w-8 h-8 rounded-lg bg-dark-950 border border-dark-700 overflow-hidden shrink-0 flex items-center justify-center p-0.5 shadow-sm" title={it.material_name}>
                                <img src={it.image_url} alt="" className="w-full h-full object-contain" />
                              </div>
                            )}
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`font-bold ${isCancelled ? 'line-through text-slate-500' : 'text-white'}`}>
                                  {it.material_name}
                                </span>
                                <span className="text-[11px] text-slate-400 font-mono">({it.material_code})</span>
                                {it.is_extra && (
                                  <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-600/40">
                                    Extra Obra
                                  </span>
                                )}
                                {isCancelled && (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-700 flex items-center gap-1">
                                    <X className="w-3 h-3 text-rose-400" /> Cancelado pelo Almoxarifado {it.cancellation_reason ? `("${it.cancellation_reason}")` : ''}
                                  </span>
                                )}
                              </div>

                              {itemSub && (
                                <div className="mt-1 flex items-center gap-2 flex-wrap">
                                  <span className="text-[11px] font-bold text-amber-300 bg-amber-950/80 border border-amber-600/50 px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <RefreshCw className="w-3 h-3 text-amber-400 animate-spin" />
                                    Troca Solicitada: {itemSub.substitute_material_name} (Qtd: {itemSub.quantity})
                                  </span>
                                  {canApproveSubstitution && (
                                    <div className="flex items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => handleApproveSubstitution(itemSub.id)}
                                        className="text-[10px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white px-2 py-0.5 rounded shadow-xs"
                                        title="Aprovar substituição deste item"
                                      >
                                        Aprovar
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleRejectSubstitution(itemSub.id)}
                                        className="text-[10px] font-bold bg-rose-600 hover:bg-rose-500 text-white px-2 py-0.5 rounded shadow-xs"
                                        title="Recusar substituição"
                                      >
                                        Recusar
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}

                              {approvedSub && (
                                <div className="mt-0.5 text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                                  <Check className="w-3 h-3 text-emerald-400" />
                                  <span>Substituído com autorização por: {approvedSub.substitute_material_name}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-wrap shrink-0">
                            <span className="text-slate-300">
                              Solicitado: <span className="font-bold text-white">{it.quantity_requested} {it.material_unit}</span>
                            </span>
                            <span className="text-amber-300 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-700 font-semibold text-[11px]">
                              Reservado: {it.quantity_reserved}
                            </span>
                            {it.deficit > 0 && (
                              <span className="text-rose-300 bg-rose-950/80 px-2 py-0.5 rounded border border-rose-700 font-bold text-[11px]">
                                Déficit: {it.deficit}
                              </span>
                            )}
                            {it.quantity_delivered > 0 && (
                              <span className="text-sabrar-300 bg-sabrar-950 px-2 py-0.5 rounded border border-sabrar-500/40 text-[11px] font-bold">
                                Entregue: {it.quantity_delivered}
                              </span>
                            )}

                            {!isCancelled && (
                              <>
                                {/* Toggle 1-clique de Disponibilidade no Almoxarifado (Item 1) */}
                                <button
                                  type="button"
                                  disabled={togglingItemAvailabilityId === it.id || req.status === 'Entregue'}
                                  onClick={() => handleToggleItemAvailability(it)}
                                  className={`flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-xl border transition-all active:scale-95 shadow-xs cursor-pointer ${
                                    it.availability_status === 'em_falta'
                                      ? 'bg-rose-950/90 text-rose-300 border-rose-600 hover:bg-rose-900 shadow-rose-950/50'
                                      : 'bg-emerald-950/70 text-emerald-300 border-emerald-600/50 hover:bg-emerald-900'
                                  }`}
                                  title="Clique para alternar: Disponível ou Não disponível (Em falta). Ao marcar Não disponível, a compra é enviada ao setor de compras."
                                >
                                  {it.availability_status === 'em_falta' ? (
                                    <>
                                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                                      <span>✕ Não disponível</span>
                                    </>
                                  ) : (
                                    <>
                                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                                      <span>✓ Disponível</span>
                                    </>
                                  )}
                                </button>

                                {/* Botão Trocar Material para o Almoxarifado */}
                                {!itemSub && req.status !== 'Entregue' && (
                                  <button
                                    type="button"
                                    onClick={() => setSubstituteItemData({ request: req, item: it })}
                                    className="flex items-center gap-1 text-[11px] font-bold text-amber-400 hover:text-amber-300 bg-amber-950/40 hover:bg-amber-950/80 border border-amber-600/40 px-2 py-1 rounded-xl transition-colors shadow-xs active:scale-95"
                                    title="Solicitar troca deste material por outro disponível no almoxarifado"
                                  >
                                    <RefreshCw className="w-3 h-3" />
                                    <span>Trocar Material</span>
                                  </button>
                                )}

                                {/* Botão Cancelar Item (Item 2) */}
                                {req.status !== 'Entregue' && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setCancellingItemData({ item: it, request: req });
                                      setCancelReason('');
                                    }}
                                    className="flex items-center gap-1 text-[11px] font-bold text-rose-400 hover:text-rose-300 bg-rose-950/30 hover:bg-rose-950/80 border border-rose-700/40 px-2 py-1 rounded-xl transition-colors shadow-xs active:scale-95"
                                    title="Cancelar este item por duplicidade ou erro (registrado em auditoria imutável)"
                                  >
                                    <X className="w-3 h-3 text-rose-400" />
                                    <span>Cancelar Item</span>
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {req.status === 'Aguardando aprovação' ? (
                <div className="pt-2 border-t border-dark-750">
                  <div className="p-3 bg-amber-950/40 border border-amber-500/40 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-300">
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">Aguardando Aprovação (Admins, Sabrina ou Emily):</span> Esta solicitação contém materiais fora da base ou que excedem as cotas orçadas da obra. O fluxo de separação física e reservas de estoque só poderão ser executados após aprovação.
                      </div>
                    </div>
                    {canApproveSubstitution && (
                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        <button
                          type="button"
                          onClick={async () => {
                            if (window.confirm(`Aprovar liberação dos materiais extras/fora da base da solicitação ${req.code}?`)) {
                              await api.approveExtraRequest(req.id, currentUser?.id, 'Aprovado');
                              await loadData();
                            }
                          }}
                          className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm transition-colors"
                        >
                          Aprovar Solicitação
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            const note = prompt('Motivo da recusa do material:');
                            if (note) {
                              await api.rejectExtraRequest(req.id, currentUser?.id, note);
                              await loadData();
                            }
                          }}
                          className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-sm transition-colors"
                        >
                          Recusar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  {/* Interactive Stepper Pipeline */}
                  <div className="pt-2 border-t border-dark-750">
                    <div className="flex items-center justify-between text-[11px] text-slate-400 mb-2 font-medium">
                      <span>Etapa do Fluxo de Separação</span>
                      <span className="text-slate-500">Clique nas etapas para alterar o status</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2">
                      {[
                        { key: 'solicitado', label: '1. Solicitado', statuses: ['Solicitado', 'Reservado'], targetStatus: 'Solicitado', color: 'border-amber-500/50 bg-amber-950/40 text-amber-300' },
                        { key: 'em_separacao', label: '2. Em Separação', statuses: ['Em Separação', 'Em separação'], targetStatus: 'Em Separação', color: 'border-purple-500/50 bg-purple-950/40 text-purple-300' },
                        { key: 'separado_parcial', label: '3. Separado Parcial', statuses: ['Separado Parcial', 'Parcialmente Atendido'], targetStatus: 'Separado Parcial', color: 'border-indigo-500/50 bg-indigo-950/40 text-indigo-300' },
                        { key: 'separado', label: '4. Separado', statuses: ['Separado', 'Entregue'], targetStatus: 'Separado', color: 'border-sabrar-500/50 bg-sabrar-950/40 text-sabrar-300' },
                      ].map((step, idx) => {
                        const isCurrent = step.statuses.includes(req.status);
                        const isCompleted = (
                          (step.key === 'solicitado' && ['Em Separação', 'Em separação', 'Separado Parcial', 'Parcialmente Atendido', 'Separado', 'Entregue'].includes(req.status)) ||
                          (step.key === 'em_separacao' && ['Separado Parcial', 'Parcialmente Atendido', 'Separado', 'Entregue'].includes(req.status)) ||
                          (step.key === 'separado_parcial' && ['Separado', 'Entregue'].includes(req.status))
                        );

                        return (
                          <button
                            key={idx}
                            onClick={() => handleUpdateStatus(req.id, step.targetStatus)}
                            disabled={updatingId === req.id}
                            className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold text-center transition-all flex items-center justify-center gap-1 cursor-pointer ${
                              isCurrent
                                ? `${step.color} ring-2 ring-white/20 shadow-md`
                                : isCompleted
                                ? 'border-dark-700 bg-dark-850 text-slate-300 hover:border-slate-500'
                                : 'border-dark-800 bg-dark-900/40 text-slate-500 hover:border-dark-700'
                            }`}
                            title={`Mover para: ${step.label}`}
                          >
                            {isCompleted && <Check className="w-3 h-3 text-sabrar-400 shrink-0" />}
                            <span className="truncate">{step.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Almoxarifado Step-Actions & Status Selector */}
                  <div className="pt-2 border-t border-dark-750 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-400 font-semibold">Alterar status:</span>
                      <select
                        value={req.status}
                        disabled={updatingId === req.id}
                        onChange={(e) => handleUpdateStatus(req.id, e.target.value)}
                        className="bg-dark-800 text-white text-xs border border-dark-700 rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-sabrar-500 font-semibold cursor-pointer disabled:opacity-50"
                      >
                        <option value="Solicitado">Solicitado</option>
                        <option value="Em Separação">Em Separação</option>
                        <option value="Separado Parcial">Separado Parcial</option>
                        <option value="Separado">Separado</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-2">
                      {['Solicitado', 'Reservado'].includes(req.status) && (
                        <button
                          onClick={() => handleUpdateStatus(req.id, 'Em Separação')}
                          disabled={updatingId === req.id}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-md shadow-purple-600/30 transition-all active:scale-95 disabled:opacity-50"
                        >
                          <Play className="w-3.5 h-3.5 fill-white" />
                          <span>{updatingId === req.id ? 'Atualizando...' : 'Iniciar Separação'}</span>
                        </button>
                      )}

                      {['Em Separação', 'Em separação'].includes(req.status) && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleUpdateStatus(req.id, 'Separado Parcial')}
                            disabled={updatingId === req.id}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/30 transition-all active:scale-95 disabled:opacity-50"
                          >
                            <span>{updatingId === req.id ? 'Atualizando...' : 'Separado Parcial'}</span>
                          </button>
                          <button
                            onClick={() => handleUpdateStatus(req.id, 'Separado')}
                            disabled={updatingId === req.id}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-sabrar-600 hover:bg-sabrar-500 text-white text-xs font-bold shadow-md shadow-sabrar-600/30 transition-all active:scale-95 disabled:opacity-50"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>{updatingId === req.id ? 'Atualizando...' : 'Marcar como Separado'}</span>
                          </button>
                        </div>
                      )}

                      {['Separado Parcial', 'Parcialmente Atendido'].includes(req.status) && (
                        <button
                          onClick={() => handleUpdateStatus(req.id, 'Separado')}
                          disabled={updatingId === req.id}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-sabrar-600 hover:bg-sabrar-500 text-white text-xs font-bold shadow-md shadow-sabrar-600/30 transition-all active:scale-95 disabled:opacity-50"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>{updatingId === req.id ? 'Atualizando...' : 'Concluir Separação Total'}</span>
                        </button>
                      )}

                      {['Separado', 'Entregue'].includes(req.status) && (
                        <span className="flex items-center gap-1 text-xs text-sabrar-300 font-bold bg-sabrar-950 px-3 py-1 rounded-xl border border-sabrar-500/40">
                          <CheckCircle className="w-4 h-4 text-sabrar-400" />
                          <span>Separado</span>
                        </span>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          );
        };

        return (
          <div className="space-y-4">
            {/* Search and View Mode Header Bar */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-dark-900 p-3 sm:p-4 rounded-3xl border border-dark-750 shadow-md">
              {/* Search Bar */}
              <div className="relative flex-1 min-w-[260px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar solicitações por obra, código, material ou solicitante..."
                  className="w-full bg-dark-850 text-white placeholder-slate-400 text-xs rounded-2xl pl-10 pr-9 py-2.5 border border-dark-700 focus:outline-none focus:border-sabrar-500 transition-colors"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs font-bold"
                    title="Limpar busca"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* View Mode Toggle: Por Obra (Boxes) vs Lista Geral */}
              <div className="flex items-center bg-dark-850 p-1 rounded-2xl border border-dark-700 text-xs shrink-0 self-start md:self-auto">
                <button
                  type="button"
                  onClick={() => setViewMode('by_project')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all ${
                    viewMode === 'by_project'
                      ? 'bg-sabrar-600 text-white shadow-md shadow-sabrar-600/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Listas de materiais separadas por caixas de cada obra"
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>Por Obra (Boxes)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('linear')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all ${
                    viewMode === 'linear'
                      ? 'bg-sabrar-600 text-white shadow-md shadow-sabrar-600/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Visualização linear de todas as solicitações"
                >
                  <List className="w-3.5 h-3.5" />
                  <span>Lista Geral</span>
                </button>
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
              <div className="flex items-center gap-1 text-slate-400 font-semibold shrink-0 mr-1">
                <Filter className="w-3.5 h-3.5 text-sabrar-400" />
                <span>Filtrar fila:</span>
              </div>

              {[
                { id: 'todos', label: 'Todos', count: pendingRequests.length },
                { id: 'aguardando_aprovacao', label: 'Aguardando Aprovação', count: awaitingApprovalCount },
                { id: 'solicitado', label: 'Solicitado', count: solicitadoCount },
                { id: 'em_separacao', label: 'Em Separação', count: emSeparacaoCount },
                { id: 'separado_parcial', label: 'Separado Parcial', count: separadoParcialCount },
                { id: 'separado', label: 'Separado', count: separadoCount },
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

            {/* Banner de Solicitações de Troca de Material Pendentes */}
            {substitutions.filter(s => s.status === 'Pendente').length > 0 && (
              <div className="p-4 bg-amber-950/40 border border-amber-500/50 rounded-3xl space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 text-amber-300 font-bold text-xs sm:text-sm">
                    <RefreshCw className="w-4 h-4 text-amber-400 animate-spin" />
                    <span>
                      {substitutions.filter(s => s.status === 'Pendente').length} Solicitação(ões) de Troca de Material Aguardando Autorização
                    </span>
                  </div>
                  <span className="text-[11px] text-amber-400 font-semibold bg-amber-900/40 px-2 py-0.5 rounded-full border border-amber-600/40">
                    Aprovação: Admins, Sabrina ou Emily
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {substitutions.filter(s => s.status === 'Pendente').map((sub) => (
                    <div key={sub.id} className="p-3.5 bg-dark-900/90 border border-amber-600/40 rounded-2xl flex flex-col justify-between gap-2.5 shadow-md">
                      <div>
                        <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                          <span className="font-mono text-amber-300 font-bold">{sub.request_code}</span>
                          <span className="truncate max-w-[200px]">{sub.project_name}</span>
                        </div>
                        <div className="text-xs space-y-1">
                          <div className="text-slate-300">
                            De: <strong className="text-slate-200 line-through opacity-75">{sub.original_material_name}</strong>
                          </div>
                          <div className="text-emerald-400 font-bold flex items-center gap-1">
                            <ArrowRight className="w-3 h-3 text-amber-400 shrink-0" />
                            <span>Para: {sub.substitute_material_name} ({sub.quantity} {sub.substitute_material_unit || 'un'})</span>
                          </div>
                        </div>
                        <div className="mt-1.5 text-[11px] text-slate-300 italic bg-dark-850 p-2 rounded-xl border border-dark-750">
                          Motivo: "{sub.reason}"
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1">
                          Solicitado por: <strong>{sub.requested_by_name || 'Almoxarifado'}</strong>
                        </div>
                      </div>

                      {canApproveSubstitution ? (
                        <div className="flex items-center gap-2 pt-2 border-t border-dark-800">
                          <button
                            type="button"
                            onClick={() => handleApproveSubstitution(sub.id)}
                            className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs transition-colors shadow-sm text-center"
                          >
                            Autorizar Troca
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRejectSubstitution(sub.id)}
                            className="px-3 py-1.5 bg-rose-900/60 hover:bg-rose-800 text-rose-300 border border-rose-700 rounded-xl font-bold text-xs transition-colors"
                          >
                            Recusar
                          </button>
                        </div>
                      ) : (
                        <div className="text-[10px] text-amber-400/90 bg-amber-950/40 p-1.5 rounded-xl text-center border border-amber-800/40 font-medium">
                          Aguardando análise da Direção / Compras
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* VISUALIZAÇÃO 1: POR OBRA (BOXES SEPARADAS COM BOTÃO DE IMPRESSÃO) */}
            {viewMode === 'by_project' ? (
              <div className="space-y-4">
                {groupedByProject.length === 0 ? (
                  <div className="py-12 text-center bg-dark-900 rounded-3xl border border-dark-750 text-xs text-slate-500">
                    Nenhuma obra com solicitações encontrada para o filtro selecionado.
                  </div>
                ) : (
                  groupedByProject.map((group) => {
                    const isExpanded = !expandedProjects.has(group.projectId); // Aberto por padrão
                    return (
                      <div
                        key={group.projectId}
                        className="bg-dark-900 rounded-3xl border border-dark-750 overflow-hidden shadow-lg transition-all"
                      >
                        {/* Obra Box Header */}
                        <div
                          onClick={() => toggleProjectExpand(group.projectId)}
                          className="p-4 sm:p-5 bg-dark-850 hover:bg-dark-800/80 cursor-pointer border-b border-dark-750 flex flex-col sm:flex-row sm:items-center justify-between gap-3 select-none"
                        >
                          <div className="flex items-start gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-2xl bg-sabrar-950/80 border border-sabrar-500/40 flex items-center justify-center text-sabrar-400 shrink-0">
                              <Building2 className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h2 className="font-extrabold text-sm sm:text-base text-white truncate">
                                  {group.projectName}
                                </h2>
                                {group.clientName && (
                                  <span className="text-xs text-slate-400">({group.clientName})</span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 flex-wrap">
                                <div className="flex items-center gap-1.5 text-amber-400">
                                  <HardHat className="w-3.5 h-3.5" />
                                  <span>
                                    Engenheiro: <strong>{group.responsibleEngineer || 'Pendente de atribuição'}</strong>
                                  </span>
                                </div>
                                <span>•</span>
                                <span>{group.requests.length} {group.requests.length === 1 ? 'solicitação' : 'solicitações'}</span>
                                <span>•</span>
                                <span className="text-slate-300 font-semibold">{group.totalItems} materiais</span>
                                {group.totalReserved > 0 && (
                                  <>
                                    <span>•</span>
                                    <span className="text-emerald-400 font-bold">Reservados: {group.totalReserved}</span>
                                  </>
                                )}
                                {group.totalDeficit > 0 && (
                                  <>
                                    <span>•</span>
                                    <span className="text-rose-400 font-bold bg-rose-950/60 px-2 py-0.5 rounded border border-rose-800/50">
                                      Déficit: {group.totalDeficit}
                                    </span>
                                  </>
                                )}
                                {group.hasPendingApproval && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-500/50 flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3 text-amber-400" />
                                    {group.requiresAdminCount} com extra pendente
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2.5 self-end sm:self-center shrink-0">
                            {/* BOTÃO PRINCIPAL DE IMPRESSÃO DO ROMANEIO DA OBRA */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePrintProjectRomaneio(group);
                              }}
                              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-extrabold transition-all shadow-md shadow-emerald-600/30 active:scale-95 cursor-pointer"
                              title="Imprimir romaneio completo de conferência e separação de materiais desta obra"
                            >
                              <Printer className="w-4 h-4" />
                              <span>Imprimir Romaneio da Obra</span>
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleProjectExpand(group.projectId);
                              }}
                              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-dark-800 transition-colors"
                            >
                              {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                            </button>
                          </div>
                        </div>

                        {/* Obra Box Content: Solicitações desta Obra */}
                        {isExpanded && (
                          <div className="p-4 sm:p-5 space-y-4 bg-dark-900/50">
                            {group.requests.map((req: any) => renderRequestCard(req))}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            ) : (
              /* VISUALIZAÇÃO 2: LISTA GERAL */
              <div className="space-y-4">
                {filteredRequests.length === 0 ? (
                  <div className="py-12 text-center bg-dark-900 rounded-3xl border border-dark-750 text-xs text-slate-500">
                    Nenhuma solicitação encontrada para o filtro selecionado.
                  </div>
                ) : (
                  filteredRequests.map((req) => renderRequestCard(req))
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* TAB 2: DEVOLUÇÕES */}
      {!loading && activeTab === 'devolucoes' && (
        <div className="bg-dark-900 rounded-3xl border border-dark-750 p-4 shadow-md">
          <div className="mb-4">
            <h3 className="font-extrabold text-sm text-white">Devoluções ao Almoxarifado</h3>
            <p className="text-xs text-slate-400">Materiais reaproveitáveis que retornaram ao estoque da empresa</p>
          </div>

          <div className="divide-y divide-dark-750">
            {returns.map((ret) => (
              <div key={ret.id} className="py-3 flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold text-white">{ret.code} — {ret.material_name}</div>
                  <div className="text-slate-400 text-[11px]">
                    Obra: <span className="font-semibold text-slate-200">{ret.project_name}</span> • Motivo: {ret.reason || 'Sobra de canteiro'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-black text-teal-400 text-sm">+{ret.quantity} {ret.material_unit}</div>
                  <div className="text-[10px] text-slate-500">
                    {new Date(ret.created_at).toLocaleDateString('pt-BR')} por {ret.received_by_name}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: EXTRATO COMPLETO DE MOVIMENTAÇÕES */}
      {!loading && activeTab === 'extrato' && (
        <div className="bg-dark-900 rounded-3xl border border-dark-750 overflow-hidden shadow-md">
          <div className="p-4 bg-dark-850 border-b border-dark-750 text-xs font-bold text-slate-200">
            Histórico Completo de Movimentações de Estoque (Auditoria Imutável)
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-dark-850 text-slate-400 font-semibold border-b border-dark-700">
                <tr>
                  <th className="p-3">Data / Hora</th>
                  <th className="p-3">Tipo</th>
                  <th className="p-3">Material</th>
                  <th className="p-3 text-center">Quant.</th>
                  <th className="p-3 text-center">Estoque Anterior</th>
                  <th className="p-3 text-center font-bold">Novo Estoque</th>
                  <th className="p-3">Obra Vinculada</th>
                  <th className="p-3">Operador</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-750">
                {movements.map((m) => {
                  const isEntrada = m.type === 'ENTRADA' || m.type === 'DEVOLUCAO';
                  return (
                    <tr key={m.id} className="hover:bg-dark-850/60">
                      <td className="p-3 text-slate-400 font-mono text-[11px]">
                        {new Date(m.created_at).toLocaleDateString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="p-3">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            m.type === 'ENTRADA'
                              ? 'bg-sabrar-950 text-sabrar-300 border border-sabrar-500/40'
                              : m.type === 'DEVOLUCAO'
                              ? 'bg-teal-950 text-teal-300 border border-teal-700'
                              : m.type === 'SAIDA_OBRA'
                              ? 'bg-rose-950 text-rose-300 border border-rose-700'
                              : 'bg-amber-950 text-amber-300 border border-amber-700'
                          }`}
                        >
                          {m.type}
                        </span>
                      </td>
                      <td className="p-3 font-bold text-white">
                        {m.material_name}
                      </td>
                      <td className="p-3 text-center font-black text-white">
                        {isEntrada ? `+${m.quantity}` : `-${m.quantity}`} {m.material_unit}
                      </td>
                      <td className="p-3 text-center text-slate-400 font-mono">
                        {m.previous_stock}
                      </td>
                      <td className="p-3 text-center font-bold text-white font-mono">
                        {m.new_stock}
                      </td>
                      <td className="p-3 text-slate-300">
                        {m.project_name ? `${m.project_code} - ${m.project_name}` : 'Almoxarifado Central'}
                      </td>
                      <td className="p-3 text-slate-400 text-[11px]">
                        {m.user_name || 'Sistema'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal de Impressão do Romaneio */}
      <PrintRequestModal
        isOpen={!!selectedRequestForPrint}
        onClose={() => setSelectedRequestForPrint(null)}
        request={selectedRequestForPrint}
      />

      {/* Modal de Solicitação de Troca de Material */}
      {substituteItemData && (
        <SubstituteMaterialModal
          isOpen={!!substituteItemData}
          onClose={() => setSubstituteItemData(null)}
          request={substituteItemData.request}
          item={substituteItemData.item}
          onSuccess={() => {
            loadData();
            setSubstituteItemData(null);
          }}
        />
      )}

      {/* Modal de Cancelamento de Item pelo Almoxarifado (Item 2) */}
      {cancellingItemData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-dark-900 border border-dark-750 rounded-3xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-rose-400 font-extrabold text-base">
                <AlertTriangle className="w-5 h-5 text-rose-500" />
                <span>Cancelar Item da Solicitação</span>
              </div>
              <button
                type="button"
                onClick={() => setCancellingItemData(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-dark-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-dark-850 p-3.5 rounded-2xl border border-dark-750 text-xs space-y-1.5">
              <div className="text-slate-400">
                Solicitação: <strong className="text-white font-mono">{cancellingItemData.request.code}</strong> • Obra: <strong className="text-white">{cancellingItemData.request.project_name}</strong>
              </div>
              <div className="text-white font-bold text-sm">
                {cancellingItemData.item.material_name}
              </div>
              <div className="text-slate-400">
                Quantidade solicitada: <strong className="text-amber-400">{cancellingItemData.item.quantity_requested} {cancellingItemData.item.material_unit}</strong>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300">
                Justificativa do cancelamento (Obrigatório - Auditoria Imutável):
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Ex: Item duplicado pelo solicitante, erro de especificação, etc."
                rows={3}
                className="w-full p-3 text-xs rounded-xl bg-dark-800 border border-dark-700 text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-dark-800">
              <button
                type="button"
                onClick={() => setCancellingItemData(null)}
                className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white rounded-xl bg-dark-800 hover:bg-dark-750"
              >
                Voltar
              </button>
              <button
                type="button"
                disabled={isCancellingItem || !cancelReason.trim()}
                onClick={handleConfirmCancelItem}
                className="px-4 py-2 text-xs font-bold text-white rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-md shadow-rose-900/30"
              >
                {isCancellingItem ? 'Cancelando...' : 'Confirmar Cancelamento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

