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
  Hash,
  X,
  RotateCcw,
  Calendar
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { canUserViewPrices, canUserApproveOperations, canRegisterReturn } from '../utils/permissions';
import { StatusBadge } from '../components/common/StatusBadge';
import { PrintRequestModal } from '../components/modals/PrintRequestModal';
import { SubstituteMaterialModal } from '../components/modals/SubstituteMaterialModal';
import { QuantityChangeModal } from '../components/modals/QuantityChangeModal';
import { MaterialTransferModal } from '../components/modals/MaterialTransferModal';
import { NewReturnModal } from '../components/modals/NewReturnModal';
import { sanitizeUnit } from '../utils/unitConverter';

export const StockPage: React.FC = () => {
  const { currentUser } = useAuth();
  const canViewPrices = canUserViewPrices(currentUser);
  const [activeTab, setActiveTab] = useState<'separacao' | 'devolucoes' | 'extrato' | 'transferencias'>('separacao');
  const [transfers, setTransfers] = useState<any[]>([]);
  const [reservedByProject, setReservedByProject] = useState<any[]>([]);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isNewReturnModalOpen, setIsNewReturnModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'todos' | 'aguardando_aprovacao' | 'solicitado' | 'em_separacao' | 'separado_parcial' | 'separado'>('todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [summary, setSummary] = useState<any>(null);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [returns, setReturns] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [substitutions, setSubstitutions] = useState<any[]>([]);
  const [substituteItemData, setSubstituteItemData] = useState<{ request: any; item: any } | null>(null);
  const [quantityChanges, setQuantityChanges] = useState<any[]>([]);
  const [quantityChangeItemData, setQuantityChangeItemData] = useState<{ request: any; item: any } | null>(null);
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

  const canApproveOperations = canUserApproveOperations(currentUser);
  const canApproveSubstitution = canApproveOperations;

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

  // Filtros avançados do Extrato de Movimentações (Item 8)
  const [extratoSearch, setExtratoSearch] = useState('');
  const [extratoPeriod, setExtratoPeriod] = useState<string>('all');
  const [extratoTypeFilter, setExtratoTypeFilter] = useState<string>('todos');
  const [loadingExtrato, setLoadingExtrato] = useState(false);

  const loadExtrato = async (search = extratoSearch, period = extratoPeriod, type = extratoTypeFilter) => {
    setLoadingExtrato(true);
    try {
      const moves = await api.getStockMovements({
        search: search.trim(),
        period: period,
        type: type !== 'todos' ? type : '',
        limit: 'all'
      });
      setMovements(moves || []);
    } catch (err) {
      console.error('Erro ao buscar extrato de movimentações:', err);
    } finally {
      setLoadingExtrato(false);
    }
  };

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
      const [sumData, reqs, rets, moves, subs, qtyChanges, transferData, reservedData] = await Promise.all([
        api.getStockSummary(),
        api.getRequests(),
        api.getReturns(),
        api.getStockMovements({ limit: 'all' }),
        api.getSubstitutions(),
        api.getQuantityChanges(),
        api.getTransfers().catch(() => []),
        api.getReservedByProject().catch(() => [])
      ]);
      setSummary(sumData);
      setPendingRequests(reqs);
      setReturns(rets);
      setMovements(moves);
      setSubstitutions(subs || []);
      setQuantityChanges(qtyChanges || []);
      setTransfers(transferData || []);
      setReservedByProject(reservedData || []);
    } catch (err) {
      console.error('Erro ao carregar dados do estoque:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRepayTransfer = async (transferId: number) => {
    const notes = window.prompt('Informe o número da NF, Pedido de Compra ou observações da reposição de estoque:');
    if (notes === null) return;
    try {
      await api.repayTransfer(transferId, {
        repayment_notes: notes,
        userId: currentUser?.id
      });
      alert('Quitação e reposição de estoque registradas com sucesso!');
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Erro ao registrar reposição.');
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

  const handleApproveQuantityChange = async (changeId: number) => {
    if (!window.confirm('Confirma a autorização para a alteração da quantidade deste material?')) return;
    try {
      await api.approveQuantityChange(changeId, currentUser?.id, 'Autorizado');
      await loadData();
      alert('Alteração de quantidade autorizada e aplicada com sucesso!');
    } catch (err: any) {
      console.error('Erro ao aprovar alteração de quantidade:', err);
      alert(err.message || 'Erro ao aprovar alteração de quantidade');
    }
  };

  const handleRejectQuantityChange = async (changeId: number) => {
    const reason = prompt('Informe a justificativa da recusa da alteração de quantidade:');
    if (!reason) return;
    try {
      await api.rejectQuantityChange(changeId, currentUser?.id, reason);
      await loadData();
      alert('Alteração de quantidade recusada.');
    } catch (err: any) {
      console.error('Erro ao recusar alteração de quantidade:', err);
      alert(err.message || 'Erro ao recusar alteração de quantidade');
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
        <button
          onClick={() => setActiveTab('transferencias')}
          className={`px-4 py-2 rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'transferencias' ? 'bg-sabrar-600 text-white shadow-md shadow-sabrar-600/30 font-bold' : 'hover:text-white'
          }`}
        >
          <span>Transferências & Reposições</span>
          {transfers.filter(t => t.repayment_status === 'Pendente').length > 0 && (
            <span className="px-1.5 py-0.2 bg-amber-500 text-black text-[10px] font-black rounded-full">
              {transfers.filter(t => t.repayment_status === 'Pendente').length}
            </span>
          )}
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

        const extractRequestSequenceNumber = (r: any): number => {
          if (r?.code) {
            const m = r.code.match(/(\d+)$/);
            if (m) return parseInt(m[1], 10);
          }
          return Number(r?.id) || 0;
        };

        // Ordenação decrescente rigorosa por número da solicitação (ex: SOL-2026-0047 antes de SOL-2026-0045)
        const sortedFilteredRequests = [...filteredRequests].sort((a, b) => {
          return extractRequestSequenceNumber(b) - extractRequestSequenceNumber(a);
        });

        // Agrupamento por obra (boxes de cada obra com botão de imprimir romaneio)
        const groupedByProject: any[] = (() => {
          const map = new Map<number | string, any>();

          sortedFilteredRequests.forEach(req => {
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

          // Ordena as solicitações dentro de cada grupo da maior numeração para a menor
          map.forEach(grp => {
            grp.requests.sort((a: any, b: any) => {
              return extractRequestSequenceNumber(b) - extractRequestSequenceNumber(a);
            });
          });

          // Ordena as obras para que a obra com a solicitação de maior numeração fique no topo
          return Array.from(map.values()).sort((a, b) => {
            if (a.projectId === 'geral') return 1;
            if (b.projectId === 'geral') return -1;
            const maxA = Math.max(...a.requests.map((r: any) => extractRequestSequenceNumber(r)));
            const maxB = Math.max(...b.requests.map((r: any) => extractRequestSequenceNumber(r)));
            return maxB - maxA;
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
                      const itemQtyChange = quantityChanges.find((q: any) => q.request_item_id === it.id && q.status === 'Pendente');
                      const approvedQtyChange = quantityChanges.find((q: any) => q.request_item_id === it.id && q.status === 'Aprovado');
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
                                  {canApproveOperations && (
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

                              {itemQtyChange && (
                                <div className="mt-1 flex items-center gap-2 flex-wrap">
                                  <span className="text-[11px] font-bold text-sky-300 bg-sky-950/80 border border-sky-600/50 px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <Hash className="w-3 h-3 text-sky-400" />
                                    Alteração Solicitada: {itemQtyChange.original_quantity} → {itemQtyChange.new_quantity} {sanitizeUnit(it.material_unit)}
                                  </span>
                                  {canApproveOperations && (
                                    <div className="flex items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => handleApproveQuantityChange(itemQtyChange.id)}
                                        className="text-[10px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white px-2 py-0.5 rounded shadow-xs"
                                        title="Aprovar alteração de quantidade deste item"
                                      >
                                        Aprovar
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleRejectQuantityChange(itemQtyChange.id)}
                                        className="text-[10px] font-bold bg-rose-600 hover:bg-rose-500 text-white px-2 py-0.5 rounded shadow-xs"
                                        title="Recusar alteração de quantidade"
                                      >
                                        Recusar
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}

                              {approvedQtyChange && (
                                <div className="mt-0.5 text-[10px] font-bold text-sky-400 flex items-center gap-1">
                                  <Check className="w-3 h-3 text-sky-400" />
                                  <span>Quantidade alterada com autorização: {approvedQtyChange.new_quantity} {sanitizeUnit(it.material_unit)}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-wrap shrink-0">
                            <span className="text-slate-300">
                              Solicitado: <span className="font-bold text-white">{it.quantity_requested} {sanitizeUnit(it.material_unit)}</span>
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
                                  className={`flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-xl transition-all active:scale-95 shadow-xs cursor-pointer ${
                                    it.availability_status === 'em_falta'
                                      ? 'bg-rose-600 hover:bg-rose-700 text-white border border-rose-600 shadow-rose-900/20'
                                      : 'bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-600 shadow-emerald-900/20'
                                  }`}
                                  title="Clique para alternar: Disponível ou Não disponível (Em falta). Ao marcar Não disponível, a compra é enviada ao setor de compras."
                                >
                                  {it.availability_status === 'em_falta' ? (
                                    <>
                                      <AlertTriangle className="w-3.5 h-3.5 text-white stroke-[2.5]" />
                                      <span className="text-white">✕ Não disponível</span>
                                    </>
                                  ) : (
                                    <>
                                      <Check className="w-3.5 h-3.5 text-white stroke-[2.5]" />
                                      <span className="text-white">✓ Disponível</span>
                                    </>
                                  )}
                                </button>

                                {/* Botão Trocar Material para o Almoxarifado */}
                                {!itemSub && req.status !== 'Entregue' && (
                                  <button
                                    type="button"
                                    onClick={() => setSubstituteItemData({ request: req, item: it })}
                                    className="flex items-center gap-1 text-[11px] font-bold text-white bg-amber-600 hover:bg-amber-700 border border-amber-600 px-2.5 py-1 rounded-xl transition-colors shadow-xs active:scale-95"
                                    title="Solicitar troca deste material por outro disponível no almoxarifado"
                                  >
                                    <RefreshCw className="w-3 h-3 text-white stroke-[2.5]" />
                                    <span className="text-white">Trocar Material</span>
                                  </button>
                                )}

                                {/* Botão Alterar Quantidade para o Almoxarifado (Item 3) */}
                                {!itemQtyChange && req.status !== 'Entregue' && (
                                  <button
                                    type="button"
                                    onClick={() => setQuantityChangeItemData({ request: req, item: it })}
                                    className="flex items-center gap-1 text-[11px] font-bold text-white bg-blue-600 hover:bg-blue-700 border border-blue-600 px-2.5 py-1 rounded-xl transition-colors shadow-xs active:scale-95"
                                    title="Solicitar alteração da quantidade deste material"
                                  >
                                    <Hash className="w-3 h-3 text-white stroke-[2.5]" />
                                    <span className="text-white">Alterar Qtd</span>
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
                                    className="flex items-center gap-1 text-[11px] font-bold text-white bg-rose-600 hover:bg-rose-700 border border-rose-600 px-2.5 py-1 rounded-xl transition-colors shadow-xs active:scale-95"
                                    title="Cancelar este item por duplicidade ou erro (registrado em auditoria imutável)"
                                  >
                                    <X className="w-3 h-3 text-white stroke-[2.5]" />
                                    <span className="text-white">Cancelar Item</span>
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
                  {/* Interactive Stepper Pipeline ou Alerta de Cancelamento */}
                  {req.admin_approval_status === 'Rejeitado' || req.status === 'Cancelado' ? (
                    <div className="pt-2 border-t border-dark-750">
                      <div className="flex items-center gap-2 p-3 bg-rose-950/40 border border-rose-800/40 rounded-2xl text-rose-300 text-xs font-bold">
                        <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                        <span>Solicitação Rejeitada / Cancelada pelo Administrador ({req.admin_approval_notes || 'Cancelada'}). Nenhuma baixa ou separação é permitida.</span>
                      </div>
                    </div>
                  ) : (
                    <>
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

            {/* Central Unificada de Aprovações Pendentes no Topo do Almoxarifado (Item 6 & Item 4 - Admins, Sabrina e Emily) */}
            {(() => {
              const pendingExtraReqs = pendingRequests.filter(r => r.status === 'Aguardando aprovação' || (r.requires_admin_approval && r.admin_approval_status === 'Pendente'));
              const pendingSubs = substitutions.filter(s => s.status === 'Pendente');
              const pendingQty = quantityChanges.filter(q => q.status === 'Pendente');
              const grandTotalPending = pendingExtraReqs.length + pendingSubs.length + pendingQty.length;

              if (grandTotalPending === 0) return null;

              return (
                <div className="p-4 sm:p-5 bg-white dark:bg-dark-900 border-2 border-amber-400 dark:border-amber-500/60 rounded-3xl space-y-4 shadow-xl shadow-amber-500/5 animate-fadeIn">
                  <div className="flex items-center justify-between gap-2 flex-wrap border-b border-amber-200 dark:border-amber-500/20 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-2xl bg-amber-100 dark:bg-amber-500/20 border border-amber-300 dark:border-amber-500/40 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                        <AlertTriangle className="w-5 h-5 animate-pulse" />
                      </div>
                      <div>
                        <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                          <span>Central de Aprovações Pendentes (Almoxarifado)</span>
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-500 text-white dark:text-black shadow-xs">
                            {grandTotalPending}
                          </span>
                        </h2>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                          Todas as autorizações que dependem dos Administradores, Sabrina ou Emily concentradas no topo para liberação rápida.
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-3 py-1 rounded-full border border-amber-300 dark:border-amber-600/40 shadow-xs">
                      Aprovação: Admins, Sabrina e Emily
                    </span>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
                    {/* 1. Solicitações de Material com Extras / Fora da Base */}
                    {pendingExtraReqs.map((req) => (
                      <div key={`req-pend-${req.id}`} className="p-4 bg-slate-50/80 dark:bg-dark-850 border border-slate-200 dark:border-dark-750 rounded-2xl flex flex-col justify-between gap-3 shadow-xs hover:border-amber-400/60 transition-all">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs gap-2">
                            <span className="font-mono text-amber-800 dark:text-amber-300 font-extrabold bg-amber-100 dark:bg-amber-950/80 px-2 py-0.5 rounded-lg border border-amber-300 dark:border-amber-700">
                              {req.code}
                            </span>
                            <span className="font-extrabold text-slate-900 dark:text-white truncate max-w-[220px]">
                              {req.project_name || 'Demanda Geral'}
                            </span>
                            <StatusBadge status={req.priority} size="sm" />
                          </div>

                          <div className="text-xs text-slate-700 dark:text-slate-300">
                            <div>Solicitante: <strong className="text-slate-900 dark:text-white font-extrabold">{req.requested_by_name}</strong></div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                              {new Date(req.created_at).toLocaleDateString('pt-BR')} • {req.items?.length || 0} material(is)
                            </div>
                          </div>

                          <div className="bg-white dark:bg-dark-900 p-3 rounded-xl border border-slate-200 dark:border-dark-750 space-y-1.5 max-h-36 overflow-y-auto shadow-xs">
                            <div className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                              Itens que aguardam aprovação:
                            </div>
                            {(req.items || []).filter((it: any) => it.is_extra || !it.material_id || it.is_custom).map((it: any) => (
                              <div key={it.id} className="text-[11px] text-slate-800 dark:text-slate-200 flex items-center justify-between gap-2 border-b border-slate-100 dark:border-dark-800 pb-1 last:border-0 last:pb-0">
                                <span className="truncate">{it.material_name}</span>
                                <span className="font-bold text-amber-700 dark:text-amber-300 shrink-0">
                                  {it.quantity_requested} {sanitizeUnit(it.material_unit)}
                                </span>
                              </div>
                            ))}
                          </div>

                          {req.notes && (
                            <div className="text-[11px] text-slate-600 dark:text-slate-400 italic bg-amber-50/60 dark:bg-dark-800/60 border border-amber-200/60 dark:border-dark-750 p-2.5 rounded-xl">
                              "{req.notes}"
                            </div>
                          )}
                        </div>

                        {canApproveOperations ? (
                          <div className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-dark-800">
                            <button
                              type="button"
                              onClick={async () => {
                                if (window.confirm(`Aprovar liberação dos materiais extras da solicitação ${req.code}?`)) {
                                  await api.approveExtraRequest(req.id, currentUser?.id, 'Aprovado');
                                  await loadData();
                                }
                              }}
                              className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs transition-all shadow-md shadow-emerald-600/20 text-center cursor-pointer active:scale-95"
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
                              className="px-4 py-2 bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-300 dark:bg-rose-950/70 dark:hover:bg-rose-900 dark:text-rose-300 dark:border-rose-700 rounded-xl font-bold text-xs transition-all cursor-pointer active:scale-95"
                            >
                              Recusar
                            </button>
                          </div>
                        ) : (
                          <div className="text-[11px] text-amber-800 dark:text-amber-400 bg-amber-100/70 dark:bg-amber-950/40 p-2 rounded-xl text-center border border-amber-300 dark:border-amber-800/40 font-medium">
                            Aguardando autorização dos Administradores, Sabrina ou Emily
                          </div>
                        )}
                      </div>
                    ))}

                    {/* 2. Trocas de Material do Almoxarifado */}
                    {pendingSubs.map((sub) => (
                      <div key={`sub-${sub.id}`} className="p-4 bg-slate-50/80 dark:bg-dark-850 border border-amber-300/80 dark:border-amber-600/50 rounded-2xl flex flex-col justify-between gap-3 shadow-xs hover:border-amber-500 transition-all">
                        <div>
                          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1.5">
                            <span className="font-mono text-amber-800 dark:text-amber-300 font-extrabold bg-amber-100 dark:bg-amber-950/80 px-2 py-0.5 rounded-lg border border-amber-300 dark:border-amber-700">
                              {sub.request_code}
                            </span>
                            <span className="truncate max-w-[200px] text-slate-900 dark:text-white font-extrabold">{sub.project_name}</span>
                            <span className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 border border-amber-300 dark:border-amber-700 px-2 py-0.5 rounded-lg font-bold">
                              Troca de Material
                            </span>
                          </div>
                          <div className="text-xs space-y-1.5 bg-white dark:bg-dark-900 p-2.5 rounded-xl border border-slate-200 dark:border-dark-750 shadow-xs">
                            <div className="text-slate-600 dark:text-slate-300">
                              De: <strong className="text-slate-800 dark:text-slate-200 line-through opacity-75">{sub.original_material_name}</strong>
                            </div>
                            <div className="text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1.5">
                              <ArrowRight className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                              <span>Para: {sub.substitute_material_name} ({sub.quantity} {sub.substitute_material_unit || 'un'})</span>
                            </div>
                          </div>
                          <div className="mt-2 text-[11px] text-slate-700 dark:text-slate-300 italic bg-amber-50/60 dark:bg-dark-800/60 p-2 rounded-xl border border-amber-200/60 dark:border-dark-750">
                            Motivo: "{sub.reason}"
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1.5">
                            Solicitado por: <strong className="text-slate-800 dark:text-slate-200">{sub.requested_by_name || 'Almoxarifado'}</strong>
                          </div>
                        </div>

                        {canApproveOperations ? (
                          <div className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-dark-800">
                            <button
                              type="button"
                              onClick={() => handleApproveSubstitution(sub.id)}
                              className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs transition-all shadow-md shadow-emerald-600/20 text-center cursor-pointer active:scale-95"
                            >
                              Autorizar Troca
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRejectSubstitution(sub.id)}
                              className="px-4 py-2 bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-300 dark:bg-rose-950/70 dark:hover:bg-rose-900 dark:text-rose-300 dark:border-rose-700 rounded-xl font-bold text-xs transition-all cursor-pointer active:scale-95"
                            >
                              Recusar
                            </button>
                          </div>
                        ) : (
                          <div className="text-[11px] text-amber-800 dark:text-amber-400 bg-amber-100/70 dark:bg-amber-950/40 p-2 rounded-xl text-center border border-amber-300 dark:border-amber-800/40 font-medium">
                            Aguardando autorização dos Administradores, Sabrina ou Emily
                          </div>
                        )}
                      </div>
                    ))}

                    {/* 3. Alterações de Quantidade do Almoxarifado */}
                    {pendingQty.map((qc) => (
                      <div key={`qc-${qc.id}`} className="p-4 bg-slate-50/80 dark:bg-dark-850 border border-sky-300/80 dark:border-sky-600/50 rounded-2xl flex flex-col justify-between gap-3 shadow-xs hover:border-sky-500 transition-all">
                        <div>
                          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1.5">
                            <span className="font-mono text-sky-800 dark:text-sky-300 font-extrabold bg-sky-100 dark:bg-sky-950/80 px-2 py-0.5 rounded-lg border border-sky-300 dark:border-sky-700">
                              {qc.request_code}
                            </span>
                            <span className="truncate max-w-[200px] text-slate-900 dark:text-white font-extrabold">{qc.project_name}</span>
                            <span className="text-[10px] bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-300 border border-sky-300 dark:border-sky-700 px-2 py-0.5 rounded-lg font-bold">
                              Alteração de Quantidade
                            </span>
                          </div>
                          <div className="text-xs space-y-1.5 bg-white dark:bg-dark-900 p-2.5 rounded-xl border border-slate-200 dark:border-dark-750 shadow-xs">
                            <div className="text-slate-800 dark:text-slate-200 font-bold">
                              {qc.material_name}
                            </div>
                            <div className="text-sky-700 dark:text-sky-400 font-bold flex items-center gap-1.5">
                              <ArrowRight className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                              <span>Qtd: De <span className="line-through opacity-75">{qc.original_quantity}</span> para {qc.new_quantity} {qc.material_unit || 'un'}</span>
                            </div>
                          </div>
                          <div className="mt-2 text-[11px] text-slate-700 dark:text-slate-300 italic bg-sky-50/60 dark:bg-dark-800/60 p-2 rounded-xl border border-sky-200/60 dark:border-dark-750">
                            Motivo: "{qc.reason}"
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1.5">
                            Solicitado por: <strong className="text-slate-800 dark:text-slate-200">{qc.requested_by_name || 'Almoxarifado'}</strong>
                          </div>
                        </div>

                        {canApproveOperations ? (
                          <div className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-dark-800">
                            <button
                              type="button"
                              onClick={() => handleApproveQuantityChange(qc.id)}
                              className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs transition-all shadow-md shadow-emerald-600/20 text-center cursor-pointer active:scale-95"
                            >
                              Autorizar Alteração
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRejectQuantityChange(qc.id)}
                              className="px-4 py-2 bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-300 dark:bg-rose-950/70 dark:hover:bg-rose-900 dark:text-rose-300 dark:border-rose-700 rounded-xl font-bold text-xs transition-all cursor-pointer active:scale-95"
                            >
                              Recusar
                            </button>
                          </div>
                        ) : (
                          <div className="text-[11px] text-sky-800 dark:text-sky-400 bg-sky-100/70 dark:bg-sky-950/40 p-2 rounded-xl text-center border border-sky-300 dark:border-sky-800/40 font-medium">
                            Aguardando autorização dos Administradores, Sabrina ou Emily
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

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
                {sortedFilteredRequests.length === 0 ? (
                  <div className="py-12 text-center bg-dark-900 rounded-3xl border border-dark-750 text-xs text-slate-500">
                    Nenhuma solicitação encontrada para o filtro selecionado.
                  </div>
                ) : (
                  sortedFilteredRequests.map((req) => renderRequestCard(req))
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* TAB 2: DEVOLUÇÕES */}
      {!loading && activeTab === 'devolucoes' && (
        <div className="bg-dark-900 rounded-3xl border border-dark-750 p-4 sm:p-5 shadow-md space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-dark-750 pb-3">
            <div>
              <h3 className="font-extrabold text-sm text-white">Devoluções ao Almoxarifado</h3>
              <p className="text-xs text-slate-400">Materiais reaproveitáveis que retornaram ao estoque da empresa</p>
            </div>
            {canRegisterReturn(currentUser) && (
              <button
                type="button"
                onClick={() => setIsNewReturnModalOpen(true)}
                className="flex items-center justify-center gap-2 px-4 py-2 rounded-2xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition-all shadow-md shadow-teal-600/20 active:scale-95 cursor-pointer self-start sm:self-auto"
                title="Registrar devolução de materiais ao almoxarifado"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Registrar Devolução</span>
              </button>
            )}
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

      {/* TAB 3: EXTRATO COMPLETO DE MOVIMENTAÇÕES (Item 8) */}
      {!loading && activeTab === 'extrato' && (() => {
        // Filtro local adicional para responsividade instantânea
        const filteredMovements = movements.filter((m) => {
          if (extratoTypeFilter !== 'todos') {
            const mType = (m.type || '').toUpperCase();
            if (extratoTypeFilter === 'SAIDA_OBRA' && !mType.includes('SAIDA')) return false;
            if (extratoTypeFilter === 'ENTRADA' && !mType.includes('ENTRADA')) return false;
            if (extratoTypeFilter === 'RESERVA' && !mType.includes('RESERVA')) return false;
            if (extratoTypeFilter === 'DEVOLUCAO' && !mType.includes('DEVOLU')) return false;
          }

          if (extratoSearch.trim()) {
            const query = extratoSearch.trim().toLowerCase();
            const matName = (m.material_name || '').toLowerCase();
            const matCode = (m.material_code || '').toLowerCase();
            const reqCode = (m.request_code || '').toLowerCase();
            const notes = (m.notes || '').toLowerCase();
            const projName = (m.project_name || '').toLowerCase();
            const projCode = (m.project_code || '').toLowerCase();
            const user = (m.user_name || '').toLowerCase();

            const match = matName.includes(query) ||
              matCode.includes(query) ||
              reqCode.includes(query) ||
              notes.includes(query) ||
              projName.includes(query) ||
              projCode.includes(query) ||
              user.includes(query);

            if (!match) return false;
          }

          if (extratoPeriod !== 'all') {
            const days = parseInt(extratoPeriod, 10);
            if (!isNaN(days) && m.created_at) {
              const cutoff = new Date();
              cutoff.setDate(cutoff.getDate() - days);
              cutoff.setHours(0, 0, 0, 0);
              if (new Date(m.created_at) < cutoff) return false;
            }
          }

          return true;
        });

        return (
          <div className="bg-dark-900 rounded-3xl border border-dark-750 overflow-hidden shadow-md space-y-4 p-5">
            {/* Header com Título e Totalizadores */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-dark-750">
              <div>
                <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                  <Package className="w-4 h-4 text-sabrar-400" />
                  Extrato Completo de Movimentações de Estoque (Auditoria Imutável)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Exibição de todo o histórico de movimentações, sem restrição de período. Pesquise por item, solicitação ou filtre por datas.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-xl bg-dark-800 border border-dark-700 text-xs font-bold text-slate-300">
                  Total Exibido: <strong className="text-white">{filteredMovements.length}</strong> {filteredMovements.length === 1 ? 'movimentação' : 'movimentações'}
                </span>
                <button
                  type="button"
                  onClick={() => loadExtrato(extratoSearch, extratoPeriod, extratoTypeFilter)}
                  className="px-3 py-1 rounded-xl bg-dark-800 hover:bg-dark-700 border border-dark-700 text-xs font-bold text-sabrar-400 hover:text-sabrar-300 transition-colors"
                  title="Recarregar histórico completo do banco"
                >
                  {loadingExtrato ? 'Atualizando...' : 'Atualizar'}
                </button>
              </div>
            </div>

            {/* Barra de Filtros: Pesquisa por Item / Solicitação e Período */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
              {/* Campo de Busca por Item ou Número da Solicitação */}
              <div className="md:col-span-6 relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={extratoSearch}
                  onChange={(e) => {
                    setExtratoSearch(e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      loadExtrato(extratoSearch, extratoPeriod, extratoTypeFilter);
                    }
                  }}
                  placeholder="Pesquisar por item, código, número da solicitação (ex: SOL-2026-0211)..."
                  className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-dark-700 bg-dark-850 text-white placeholder-slate-500 focus:outline-none focus:border-sabrar-500 transition-colors"
                />
                {extratoSearch && (
                  <button
                    type="button"
                    onClick={() => {
                      setExtratoSearch('');
                      loadExtrato('', extratoPeriod, extratoTypeFilter);
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs font-bold"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Filtro de Período Escolhido */}
              <div className="md:col-span-6 flex items-center justify-end gap-1.5 flex-wrap">
                <span className="text-[11px] font-bold text-slate-400 mr-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-sabrar-400" />
                  Período:
                </span>
                {[
                  { label: 'Todo o Histórico', value: 'all' },
                  { label: 'Hoje', value: '1' },
                  { label: '7d', value: '7' },
                  { label: '15d', value: '15' },
                  { label: '30d', value: '30' },
                  { label: '60d', value: '60' },
                  { label: '90d', value: '90' }
                ].map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => {
                      setExtratoPeriod(p.value);
                      loadExtrato(extratoSearch, p.value, extratoTypeFilter);
                    }}
                    className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all ${
                      extratoPeriod === p.value
                        ? 'bg-sabrar-600 text-white shadow-xs'
                        : 'bg-dark-800 text-slate-400 hover:text-white hover:bg-dark-750 border border-dark-700'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tabela de Movimentações */}
            <div className="overflow-x-auto rounded-2xl border border-dark-750">
              <table className="w-full text-left text-xs">
                <thead className="bg-dark-850 text-slate-400 font-semibold border-b border-dark-700">
                  <tr>
                    <th className="p-3">Data / Hora</th>
                    <th className="p-3">Solicitação</th>
                    <th className="p-3">Tipo</th>
                    <th className="p-3">Material</th>
                    <th className="p-3 text-center">Quant.</th>
                    <th className="p-3 text-center">Estoque Ant.</th>
                    <th className="p-3 text-center font-bold">Novo Est.</th>
                    <th className="p-3">Obra Vinculada</th>
                    <th className="p-3">Operador</th>
                    <th className="p-3">Observações / Motivo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-750">
                  {filteredMovements.map((m) => {
                    const isEntrada = m.type === 'ENTRADA' || m.type === 'DEVOLUCAO';
                    return (
                      <tr key={m.id} className="hover:bg-dark-850/60 transition-colors">
                        <td className="p-3 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                          {new Date(m.created_at).toLocaleDateString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          {m.request_code ? (
                            <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-950 text-blue-300 border border-blue-600/40">
                              {m.request_code}
                            </span>
                          ) : (
                            <span className="text-slate-500 font-mono text-[10px]">--</span>
                          )}
                        </td>
                        <td className="p-3 whitespace-nowrap">
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
                        <td className="p-3">
                          <strong className="text-white block">{m.material_name}</strong>
                          {m.material_code && m.material_code !== 'FORA-BASE' && (
                            <span className="text-[10px] font-mono text-slate-400">
                              Cód: {m.material_code}
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-center font-black text-white whitespace-nowrap">
                          <span className={isEntrada ? 'text-emerald-400' : 'text-rose-400'}>
                            {isEntrada ? `+${m.quantity}` : `-${m.quantity}`} {m.material_unit}
                          </span>
                        </td>
                        <td className="p-3 text-center text-slate-400 font-mono">
                          {m.previous_stock ?? '--'}
                        </td>
                        <td className="p-3 text-center font-bold text-white font-mono">
                          {m.new_stock ?? '--'}
                        </td>
                        <td className="p-3 text-slate-300 max-w-[200px] truncate" title={m.project_name ? `${m.project_code || ''} - ${m.project_name}` : 'Almoxarifado Central'}>
                          {m.project_name ? `${m.project_code ? m.project_code + ' - ' : ''}${m.project_name}` : 'Almoxarifado Central'}
                        </td>
                        <td className="p-3 text-slate-400 text-[11px] whitespace-nowrap">
                          {m.user_name || 'Sistema'}
                        </td>
                        <td className="p-3 text-slate-400 text-[11px] max-w-[220px] truncate" title={m.notes || ''}>
                          {m.notes || '--'}
                        </td>
                      </tr>
                    );
                  })}

                  {filteredMovements.length === 0 && (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-slate-500">
                        {loadingExtrato
                          ? 'Carregando movimentações...'
                          : extratoSearch || extratoPeriod !== 'all'
                          ? 'Nenhuma movimentação encontrada com os filtros informados.'
                          : 'Nenhuma movimentação registrada no histórico.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* TAB 4: TRANSFERÊNCIAS ENTRE OBRAS & PENDÊNCIAS DE REPOSIÇÃO (FASE 1) */}
      {!loading && activeTab === 'transferencias' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-dark-900 p-5 rounded-3xl border border-slate-200 dark:border-dark-750 shadow-md">
            <div>
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-sabrar-600 dark:text-sabrar-400" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Transferências entre Obras com Reposição Automática
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
                Controle de retiradas emergenciais de materiais reservados entre canteiros de obras. O sistema gera automaticamente uma pendência de reposição até que a nova compra seja quitada.
              </p>
            </div>

            <button
              onClick={() => setIsTransferModalOpen(true)}
              className="px-4 py-2 bg-sabrar-600 hover:bg-sabrar-500 text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-1.5 shrink-0 transition-all active:scale-95"
            >
              <Truck className="w-4 h-4" />
              Nova Transferência Emergencial
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-dark-900 p-4 rounded-2xl border border-slate-200 dark:border-dark-750 shadow-sm">
              <span className="text-xs text-slate-500 uppercase font-semibold">Total de Transferências</span>
              <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                {transfers.length}
              </div>
            </div>

            <div className="bg-white dark:bg-dark-900 p-4 rounded-2xl border border-slate-200 dark:border-dark-750 shadow-sm">
              <span className="text-xs text-amber-500 uppercase font-semibold">Reposições Pendentes</span>
              <div className="text-2xl font-black text-amber-500 mt-1">
                {transfers.filter(t => t.repayment_status === 'Pendente').length}
              </div>
            </div>

            <div className="bg-white dark:bg-dark-900 p-4 rounded-2xl border border-slate-200 dark:border-dark-750 shadow-sm">
              <span className="text-xs text-emerald-500 uppercase font-semibold">Reposições Quitadas</span>
              <div className="text-2xl font-black text-emerald-500 mt-1">
                {transfers.filter(t => t.repayment_status === 'Quitado').length}
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-dark-900 rounded-3xl border border-slate-200 dark:border-dark-750 overflow-hidden shadow-md">
            <div className="p-4 bg-slate-50 dark:bg-dark-850 border-b border-slate-200 dark:border-dark-750 flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
              <span>Registro de Transferências & Quitações</span>
              <span className="text-slate-400 font-normal">{transfers.length} registro(s)</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-dark-850 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-dark-700">
                  <tr>
                    <th className="p-3">Código</th>
                    <th className="p-3">Data</th>
                    <th className="p-3">Material</th>
                    <th className="p-3 text-center">Quantidade</th>
                    <th className="p-3">Obra Doadora (Origem)</th>
                    <th className="p-3">Obra Beneficiada (Destino)</th>
                    <th className="p-3 text-center">Status Reposição</th>
                    <th className="p-3 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-dark-750">
                  {transfers.map(t => (
                    <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-dark-850/60 transition-colors">
                      <td className="p-3 font-mono font-bold text-blue-600 dark:text-blue-400">{t.code}</td>
                      <td className="p-3 text-slate-500">{new Date(t.transfer_date).toLocaleDateString('pt-BR')}</td>
                      <td className="p-3">
                        <div className="font-bold text-slate-900 dark:text-white">{t.material_name}</div>
                        {t.material_code && <div className="text-[10px] text-slate-400 font-mono">{t.material_code}</div>}
                      </td>
                      <td className="p-3 text-center font-black text-slate-800 dark:text-slate-200">
                        {t.quantity} {t.material_unit}
                      </td>
                      <td className="p-3 font-medium text-slate-700 dark:text-slate-300">
                        {t.from_project_code ? `${t.from_project_code} - ` : ''}{t.from_project_name}
                      </td>
                      <td className="p-3 font-medium text-emerald-600 dark:text-emerald-400">
                        {t.to_project_code ? `${t.to_project_code} - ` : ''}{t.to_project_name}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          t.repayment_status === 'Quitado'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        }`}>
                          {t.repayment_status}
                        </span>
                        {t.repaid_at && (
                          <div className="text-[9px] text-slate-400 mt-0.5">
                            Quitado em {new Date(t.repaid_at).toLocaleDateString('pt-BR')}
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        {t.repayment_status === 'Pendente' ? (
                          <button
                            onClick={() => handleRepayTransfer(t.id)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px] shadow-sm transition-all"
                            title="Registrar que o material foi comprado e devolvido à obra doadora"
                          >
                            Quitar Reposição
                          </button>
                        ) : (
                          <span className="text-slate-400 text-xs">✓ Concluído</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {transfers.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400 italic">
                        Nenhuma transferência emergencial entre obras registrada até o momento.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white dark:bg-dark-900 rounded-3xl border border-slate-200 dark:border-dark-750 overflow-hidden shadow-md">
            <div className="p-4 bg-slate-50 dark:bg-dark-850 border-b border-slate-200 dark:border-dark-750 text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
              <span>Consulta de Saldo de Materiais Reservados por Obra (Disponibilidade para Transferência)</span>
              <span className="text-slate-400 font-normal">{reservedByProject.length} item(ns) reservados</span>
            </div>
            <div className="overflow-x-auto max-h-72">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-dark-850 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-dark-700">
                  <tr>
                    <th className="p-3">Obra</th>
                    <th className="p-3">Material Reservado</th>
                    <th className="p-3 text-center">Qtd Reservada</th>
                    <th className="p-3 text-center">Estoque Físico Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-dark-750">
                  {reservedByProject.map((r, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-dark-850/60">
                      <td className="p-3 font-semibold text-slate-900 dark:text-slate-100">
                        {r.project_code} - {r.project_name}
                      </td>
                      <td className="p-3 text-slate-800 dark:text-slate-200">
                        {r.material_name}
                      </td>
                      <td className="p-3 text-center font-bold text-amber-600 dark:text-amber-400">
                        {r.quantity_reserved} {r.material_unit}
                      </td>
                      <td className="p-3 text-center text-slate-500 font-medium">
                        {r.stock_physical} {r.material_unit}
                      </td>
                    </tr>
                  ))}
                  {reservedByProject.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-slate-400 italic">
                        Nenhum material reservado por obras no momento.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Transferência Emergencial */}
      <MaterialTransferModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        onSuccess={() => loadData()}
      />

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

      {/* Modal de Solicitação de Alteração de Quantidade */}
      {quantityChangeItemData && (
        <QuantityChangeModal
          isOpen={!!quantityChangeItemData}
          onClose={() => setQuantityChangeItemData(null)}
          request={quantityChangeItemData.request}
          item={quantityChangeItemData.item}
          onSuccess={() => {
            loadData();
            setQuantityChangeItemData(null);
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
                Quantidade solicitada: <strong className="text-amber-400">{cancellingItemData.item.quantity_requested} {sanitizeUnit(cancellingItemData.item.material_unit)}</strong>
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

      {/* Modal de Registro de Devolução */}
      <NewReturnModal
        isOpen={isNewReturnModalOpen}
        onClose={() => setIsNewReturnModalOpen(false)}
        onSuccess={() => {
          loadData();
          setIsNewReturnModalOpen(false);
        }}
      />
    </div>
  );
};

