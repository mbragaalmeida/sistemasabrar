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
  Minimize2
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { StatusBadge } from '../components/common/StatusBadge';
import { PrintRequestModal } from '../components/modals/PrintRequestModal';

export const StockPage: React.FC = () => {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'separacao' | 'devolucoes' | 'extrato'>('separacao');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'aguardando_aprovacao' | 'aguardando' | 'separacao' | 'separado' | 'entregue'>('todos');
  const [summary, setSummary] = useState<any>(null);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [returns, setReturns] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [selectedRequestForPrint, setSelectedRequestForPrint] = useState<any | null>(null);
  const [viewMode, setViewMode] = useState<'by_project' | 'linear'>('by_project');
  const [expandedProjects, setExpandedProjects] = useState<Set<number | string>>(new Set());

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
      const [sumData, reqs, rets, moves] = await Promise.all([
        api.getStockSummary(),
        api.getRequests(),
        api.getReturns(),
        api.getStockMovements()
      ]);
      setSummary(sumData);
      setPendingRequests(reqs);
      setReturns(rets);
      setMovements(moves);
    } catch (err) {
      console.error('Erro ao carregar dados do estoque:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-4 bg-white dark:bg-dark-900 rounded-3xl border border-slate-200 dark:border-dark-750 shadow-md">
            <div className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Total Itens Ativos</div>
            <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">{summary.totalItems}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Cadastrados na SABRAR</div>
          </div>

          <div className="p-4 bg-white dark:bg-dark-900 rounded-3xl border border-slate-200 dark:border-dark-750 shadow-md">
            <div className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Valuation em Estoque</div>
            <div className="text-2xl font-black text-emerald-700 dark:text-sabrar-400 mt-1">
              R$ {summary.totalPhysicalValuation.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
            </div>
            <div className="text-xs text-emerald-800 dark:text-sabrar-300 font-bold mt-0.5">Preço médio de referência</div>
          </div>

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
          Fila de Separação & Entregas ({pendingRequests.filter(r => r.status !== 'Entregue').length})
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
        const waitingCount = pendingRequests.filter(r => ['Solicitado', 'Reservado', 'Parcialmente Atendido'].includes(r.status)).length;
        const inProgressCount = pendingRequests.filter(r => r.status === 'Em separação').length;
        const separatedCount = pendingRequests.filter(r => r.status === 'Separado').length;
        const deliveredCount = pendingRequests.filter(r => r.status === 'Entregue').length;

        const filteredRequests = pendingRequests.filter(req => {
          if (statusFilter === 'aguardando_aprovacao') return req.status === 'Aguardando aprovação';
          if (statusFilter === 'aguardando') return ['Solicitado', 'Reservado', 'Parcialmente Atendido'].includes(req.status);
          if (statusFilter === 'separacao') return req.status === 'Em separação';
          if (statusFilter === 'separado') return req.status === 'Separado';
          if (statusFilter === 'entregue') return req.status === 'Entregue';
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

          return Array.from(map.values()).sort((a, b) => {
            if (a.projectId === 'geral') return 1;
            if (b.projectId === 'geral') return -1;
            return b.requests.length - a.requests.length;
          });
        })();

        const handlePrintProjectRomaneio = (group: any) => {
          const consolidatedItems: any[] = [];
          (group.requests || []).forEach((r: any) => {
            (r.items || []).forEach((it: any) => {
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
                    {items.map((it: any) => (
                      <div key={it.id} className="flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-1 py-1 border-b border-dark-800 last:border-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-white">{it.material_name}</span>
                          <span className="text-[11px] text-slate-400 font-mono">({it.material_code})</span>
                          {it.is_extra && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-600/40">
                              Extra Obra
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2.5 flex-wrap">
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
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {req.status === 'Aguardando aprovação' ? (
                <div className="pt-2 border-t border-dark-750">
                  <div className="p-3 bg-amber-950/40 border border-amber-500/40 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-300">
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">Aguardando Aprovação de Administrador:</span> Esta solicitação contém materiais que excedem as cotas orçadas da obra. O fluxo de separação física e reservas de estoque só poderão ser executados após aprovação por um Administrador.
                      </div>
                    </div>
                    {currentUser?.role === 'admin' && (
                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        <button
                          type="button"
                          onClick={async () => {
                            if (window.confirm(`Aprovar liberação dos materiais extras da solicitação ${req.code}?`)) {
                              await api.approveExtraRequest(req.id, currentUser?.id, 'Aprovado pelo Almoxarifado');
                              await loadData();
                            }
                          }}
                          className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm transition-colors"
                        >
                          Aprovar Extras
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            const note = prompt('Motivo da recusa do material extra:');
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
                        { key: 'solicitado', label: '1. Solicitado / Reservado', statuses: ['Solicitado', 'Reservado', 'Parcialmente Atendido'], targetStatus: 'Reservado', color: 'border-amber-500/50 bg-amber-950/40 text-amber-300' },
                        { key: 'separacao', label: '2. Em Separação', statuses: ['Em separação'], targetStatus: 'Em separação', color: 'border-purple-500/50 bg-purple-950/40 text-purple-300' },
                        { key: 'separado', label: '3. Separado', statuses: ['Separado'], targetStatus: 'Separado', color: 'border-teal-500/50 bg-teal-950/40 text-teal-300' },
                        { key: 'entregue', label: '4. Entregue no Canteiro', statuses: ['Entregue'], targetStatus: 'Entregue', color: 'border-sabrar-500/50 bg-sabrar-950/40 text-sabrar-300' },
                      ].map((step, idx) => {
                        const isCurrent = step.statuses.includes(req.status);
                        const isCompleted = (
                          (step.key === 'solicitado' && ['Em separação', 'Separado', 'Entregue'].includes(req.status)) ||
                          (step.key === 'separacao' && ['Separado', 'Entregue'].includes(req.status)) ||
                          (step.key === 'separado' && req.status === 'Entregue')
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
                        <option value="Reservado">Reservado</option>
                        <option value="Solicitado">Solicitado</option>
                        <option value="Em separação">Em separação</option>
                        <option value="Separado">Separado</option>
                        <option value="Entregue">Entregue</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-2">
                      {['Solicitado', 'Reservado', 'Parcialmente Atendido'].includes(req.status) && (
                        <button
                          onClick={() => handleUpdateStatus(req.id, 'Em separação')}
                          disabled={updatingId === req.id}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-md shadow-purple-600/30 transition-all active:scale-95 disabled:opacity-50"
                        >
                          <Play className="w-3.5 h-3.5 fill-white" />
                          <span>{updatingId === req.id ? 'Atualizando...' : 'Iniciar Separação'}</span>
                        </button>
                      )}

                      {req.status === 'Em separação' && (
                        <button
                          onClick={() => handleUpdateStatus(req.id, 'Separado')}
                          disabled={updatingId === req.id}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold shadow-md shadow-teal-600/30 transition-all active:scale-95 disabled:opacity-50"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>{updatingId === req.id ? 'Atualizando...' : 'Marcar como Separado'}</span>
                        </button>
                      )}

                      {req.status === 'Separado' && (
                        <button
                          onClick={() => handleUpdateStatus(req.id, 'Entregue')}
                          disabled={updatingId === req.id}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-sabrar-600 hover:bg-sabrar-500 text-white text-xs font-bold shadow-md shadow-sabrar-600/30 transition-all active:scale-95 disabled:opacity-50"
                        >
                          <Truck className="w-4 h-4" />
                          <span>{updatingId === req.id ? 'Atualizando...' : 'Confirmar Entrega na Obra'}</span>
                        </button>
                      )}

                      {req.status === 'Entregue' && (
                        <span className="flex items-center gap-1 text-xs text-sabrar-300 font-bold bg-sabrar-950 px-3 py-1 rounded-xl border border-sabrar-500/40">
                          <CheckCircle className="w-4 h-4 text-sabrar-400" />
                          <span>Entregue no Canteiro</span>
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
            {/* View Mode & Filter Bar */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              {/* Filter Pills */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
                <div className="flex items-center gap-1 text-slate-400 font-semibold shrink-0 mr-1">
                  <Filter className="w-3.5 h-3.5 text-sabrar-400" />
                  <span>Filtrar fila:</span>
                </div>

                {[
                  { id: 'todos', label: 'Todos', count: pendingRequests.length },
                  { id: 'aguardando_aprovacao', label: 'Aguardando Aprovação Admin', count: awaitingApprovalCount },
                  { id: 'aguardando', label: 'Aguardando Separação', count: waitingCount },
                  { id: 'separacao', label: 'Em Separação', count: inProgressCount },
                  { id: 'separado', label: 'Separados / Prontos', count: separatedCount },
                  { id: 'entregue', label: 'Entregues no Canteiro', count: deliveredCount },
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

              {/* View Mode Toggle: Por Obra (Boxes) vs Lista Geral */}
              <div className="flex items-center bg-dark-850 p-1 rounded-2xl border border-dark-700 text-xs shrink-0 self-start lg:self-auto">
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
                                <span className="font-mono font-bold text-xs bg-dark-800 border border-dark-700 px-2 py-0.5 rounded text-sabrar-400">
                                  {group.projectCode}
                                </span>
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
    </div>
  );
};

