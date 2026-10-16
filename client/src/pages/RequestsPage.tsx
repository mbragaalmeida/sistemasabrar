import React, { useState, useEffect, useMemo } from 'react';
import { ClipboardList, Plus, Search, Filter, HardHat, Clock, AlertTriangle, CheckCircle, ChevronDown, ChevronUp, Package, Printer, ShieldCheck, Check, X, Trash2, Building2, List } from 'lucide-react';
import { MaterialRequest, Project } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { StatusBadge } from '../components/common/StatusBadge';
import { NewRequestModal } from '../components/modals/NewRequestModal';
import { PrintRequestModal } from '../components/modals/PrintRequestModal';

export const RequestsPage: React.FC = () => {
  const { currentUser } = useAuth();
  const [requests, setRequests] = useState<MaterialRequest[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedPriority, setSelectedPriority] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'by_project' | 'linear'>('by_project');
  const [expandedProjects, setExpandedProjects] = useState<Set<number | string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [isNewRequestModalOpen, setIsNewRequestModalOpen] = useState(false);
  const [selectedRequestForPrint, setSelectedRequestForPrint] = useState<any | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  // Conjunto de solicitações expandidas na lista (accordion retraível)
  const [expandedRequests, setExpandedRequests] = useState<Set<number>>(new Set());

  const canApproveExtra = Boolean(
    currentUser?.role === 'admin' ||
    currentUser?.email === 'sabrina@sabrar.com.br' ||
    currentUser?.email === 'emily@sabrar.com.br' ||
    (currentUser?.name && /sabrina|emily/i.test(currentUser.name))
  );

  const canDeleteRequest = Boolean(
    currentUser?.role === 'admin' ||
    currentUser?.email === 'sabrina@sabrar.com.br' ||
    currentUser?.email === 'emily@sabrar.com.br' ||
    (currentUser?.name && /sabrina|emily/i.test(currentUser.name))
  );

  const toggleProjectExpand = (id: number | string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (selectedStatus) params.status = selectedStatus;
      if (selectedPriority) params.priority = selectedPriority;

      const [reqData, projData] = await Promise.all([
        api.getRequests(params),
        api.getProjects().catch(() => [])
      ]);
      setRequests(reqData);
      setProjects(projData);
    } catch (err) {
      console.error('Erro ao carregar solicitações:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveExtra = async (request: MaterialRequest) => {
    const approverLabel = currentUser?.name || 'Administrador / Gestor';
    const notes = window.prompt(`Aprovar materiais extras/fora da base da solicitação #${request.code}?\n\n(Opcional) Digite alguma observação ou despacho:`, `Aprovado por ${approverLabel}`);
    if (notes === null) return;
    setActionLoadingId(request.id);
    try {
      await api.approveExtraRequest(request.id, currentUser?.id, notes);
      await fetchRequests();
    } catch (err: any) {
      alert(err.message || 'Erro ao aprovar solicitação extra');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRejectExtra = async (request: MaterialRequest) => {
    const reason = window.prompt(`Recusar solicitação extra #${request.code}?\n\nInforme o motivo da recusa para a engenharia:`);
    if (reason === null) return;
    if (!reason.trim()) {
      alert('É obrigatório informar o motivo da recusa.');
      return;
    }
    setActionLoadingId(request.id);
    try {
      await api.rejectExtraRequest(request.id, currentUser?.id, reason);
      await fetchRequests();
    } catch (err: any) {
      alert(err.message || 'Erro ao rejeitar solicitação extra');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeleteRequest = async (request: MaterialRequest) => {
    const confirmMsg = `Tem certeza que deseja EXCLUIR permanentemente a solicitação #${request.code || request.id}?\n\nObra: ${request.project_name || 'Solicitação Interna'}\nSolicitante: ${request.requested_by_name || 'Não informado'}\n\n⚠️ Esta ação removerá a solicitação e estornará quaisquer materiais que estejam reservados no estoque.`;
    if (!window.confirm(confirmMsg)) return;

    setActionLoadingId(request.id);
    try {
      await api.deleteRequest(request.id, currentUser?.id);
      await fetchRequests();
    } catch (err: any) {
      alert(err.message || 'Erro ao excluir solicitação');
    } finally {
      setActionLoadingId(null);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [selectedStatus, selectedPriority, currentUser?.id]);

  // Filtro de solicitações: para engenheiros, exibe apenas solicitações das obras atribuídas a ele
  // Admins, Emily (compras_solicitacoes) e Sabrina (orcamento_engenharia) veem todas
  const visibleRequests = useMemo(() => {
    let list = requests;

    if (currentUser?.role === 'engenharia') {
      const normUser = (currentUser.name || '').toLowerCase().replace(/^eng\.?\s*/i, '').trim();
      const allowedProjectIds = new Set<number>();

      projects.forEach((p: Project) => {
        if (p.assigned_engineer_ids && p.assigned_engineer_ids.includes(currentUser.id)) {
          allowedProjectIds.add(p.id);
          return;
        }
        if (p.assigned_engineers && p.assigned_engineers.some(e => e.id === currentUser.id)) {
          allowedProjectIds.add(p.id);
          return;
        }
        if (p.responsible_engineer && normUser) {
          const normProj = p.responsible_engineer.toLowerCase().replace(/^eng\.?\s*/i, '').trim();
          if (normProj.includes(normUser) || normUser.includes(normProj)) {
            allowedProjectIds.add(p.id);
          }
        }
      });

      list = list.filter((r: any) => {
        if (r.project_code === 'SAB-INTERNO') {
          return Number(r.requested_by) === Number(currentUser.id);
        }
        if (r.project_id && allowedProjectIds.has(Number(r.project_id))) return true;
        if (r.responsible_engineer && normUser) {
          const normReqEng = String(r.responsible_engineer).toLowerCase().replace(/^eng\.?\s*/i, '').trim();
          if (normReqEng.includes(normUser) || normUser.includes(normReqEng)) return true;
        }
        return false;
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((req: any) => {
        const matchesCode = (req.code || '').toLowerCase().includes(q);
        const matchesProject = (req.project_name || '').toLowerCase().includes(q) || (req.project_code || '').toLowerCase().includes(q);
        const matchesClient = (req.client_name || '').toLowerCase().includes(q);
        const matchesRequester = (req.requested_by_name || '').toLowerCase().includes(q);
        const matchesEngineer = (req.responsible_engineer || '').toLowerCase().includes(q);
        const matchesItems = (req.items || []).some((it: any) =>
          (it.material_name || '').toLowerCase().includes(q) ||
          (it.material_code || '').toLowerCase().includes(q)
        );
        return matchesCode || matchesProject || matchesClient || matchesRequester || matchesEngineer || matchesItems;
      });
    }

    return list;
  }, [requests, projects, currentUser, searchQuery]);

  // Agrupamento de solicitações por Obra (igual ao Almoxarifado)
  const groupedByProject = useMemo(() => {
    const groupsMap = new Map<number | string, {
      projectId: number | string;
      projectName: string;
      projectCode: string;
      clientName: string;
      responsibleEngineer: string;
      requests: MaterialRequest[];
      totalItems: number;
      totalReserved: number;
      totalDeficit: number;
      hasPendingApproval: boolean;
      requiresAdminCount: number;
    }>();

    visibleRequests.forEach((req: any) => {
      const pId = req.project_id || 'sem-obra';
      if (!groupsMap.has(pId)) {
        groupsMap.set(pId, {
          projectId: pId,
          projectName: req.project_name || 'Obra Geral / Sem Vínculo',
          projectCode: req.project_code || 'GERAL',
          clientName: req.client_name || '',
          responsibleEngineer: req.responsible_engineer || 'Engenharia SABRAR',
          requests: [],
          totalItems: 0,
          totalReserved: 0,
          totalDeficit: 0,
          hasPendingApproval: false,
          requiresAdminCount: 0
        });
      }
      const group = groupsMap.get(pId)!;
      group.requests.push(req);
      const items = req.items || [];
      group.totalItems += items.length;
      group.totalReserved += items.reduce((acc: number, it: any) => acc + Number(it.quantity_reserved || 0), 0);
      group.totalDeficit += items.reduce((acc: number, it: any) => acc + Number(it.deficit || 0), 0);
      if (req.status === 'Aguardando aprovação' || (req.requires_admin_approval && req.admin_approval_status === 'Pendente')) {
        group.hasPendingApproval = true;
        group.requiresAdminCount += 1;
      }
    });

    return Array.from(groupsMap.values());
  }, [visibleRequests]);

  const handlePrintProjectRomaneio = (group: any) => {
    const itemsMap = new Map<string, any>();
    group.requests.forEach((r: any) => {
      (r.items || []).forEach((it: any) => {
        const key = it.material_id ? `mat-${it.material_id}` : `custom-${it.material_name}-${it.material_unit}`;
        if (!itemsMap.has(key)) {
          itemsMap.set(key, {
            ...it,
            quantity_requested: Number(it.quantity_requested || 0),
            quantity_reserved: Number(it.quantity_reserved || 0),
            deficit: Number(it.deficit || 0),
            quantity_delivered: Number(it.quantity_delivered || 0),
            request_codes: [r.code]
          });
        } else {
          const existing = itemsMap.get(key);
          existing.quantity_requested += Number(it.quantity_requested || 0);
          existing.quantity_reserved += Number(it.quantity_reserved || 0);
          existing.deficit += Number(it.deficit || 0);
          existing.quantity_delivered += Number(it.quantity_delivered || 0);
          if (!existing.request_codes.includes(r.code)) {
            existing.request_codes.push(r.code);
          }
        }
      });
    });

    const consolidatedRequest = {
      id: group.projectId,
      code: `OBRA-${group.projectCode} (${group.requests.length} solic.)`,
      project_id: group.projectId,
      project_name: group.projectName,
      project_code: group.projectCode,
      client_name: group.clientName,
      responsible_engineer: group.responsibleEngineer,
      requested_by_name: group.responsibleEngineer || group.requests[0]?.requested_by_name || 'Engenharia',
      priority: 'Normal',
      status: 'Romaneio Consolidado da Obra',
      created_at: group.requests[0]?.created_at || new Date().toISOString(),
      notes: `Romaneio consolidado contendo todas as ${group.requests.length} solicitações da obra (${group.requests.map((r: any) => r.code).join(', ')}).`,
      items: Array.from(itemsMap.values())
    };

    setSelectedRequestForPrint(consolidatedRequest);
  };

  const renderRequestCard = (r: MaterialRequest) => {
    const isExpanded = expandedRequests.has(r.id);
    const items = r.items || [];
    const totalItemsCount = items.length;
    const totalDeficit = items.reduce((acc: number, it: any) => acc + (it.deficit || 0), 0);
    const totalReserved = items.reduce((acc: number, it: any) => acc + (it.quantity_reserved || 0), 0);

    return (
      <div
        key={r.id}
        className="bg-dark-900 p-4 sm:p-5 rounded-3xl border border-dark-750 shadow-md space-y-3 hover:border-sabrar-500/40 transition-all"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono font-bold text-xs bg-dark-800 border border-dark-700 px-2 py-0.5 rounded text-sabrar-400">
              {r.code}
            </span>
            {(r.project_code === 'SAB-INTERNO' || !r.project_id) ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-black bg-purple-950/80 text-purple-300 border border-purple-600/50">
                🏢 Solicitação Interna (SABRAR)
              </span>
            ) : (
              <span className="font-extrabold text-sm sm:text-base text-white">
                {r.project_name || 'Obra não especificada'}
              </span>
            )}
            <StatusBadge status={r.priority} size="sm" />
            <StatusBadge status={r.status} size="sm" />
            {r.requires_admin_approval && (
              r.admin_approval_status === 'Aprovado' ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/40">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  Aprovado por {r.admin_approved_by_name || 'Diretoria'}
                </span>
              ) : r.admin_approval_status === 'Rejeitado' ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-950 text-rose-300 border border-rose-700">
                  <X className="w-3.5 h-3.5 text-rose-400" />
                  Rejeitado
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-950 text-amber-300 border border-amber-600/50">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  Aguardando Aprovação (Admins, Sabrina ou Emily)
                </span>
              )
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap sm:justify-end">
            <div className="text-xs text-slate-400 mr-1">
              Por: <span className="font-semibold text-slate-200">{r.requested_by_name}</span> •{' '}
              {new Date(r.created_at).toLocaleDateString('pt-BR')}
            </div>

            {/* Botão Imprimir Romaneio de Materiais */}
            <button
              type="button"
              onClick={() => setSelectedRequestForPrint(r)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-dark-800 hover:bg-dark-750 text-white text-xs font-bold border border-dark-700 hover:border-slate-500 transition-colors shadow-sm"
              title="Imprimir romaneio de separação desta solicitação"
            >
              <Printer className="w-3.5 h-3.5 text-sabrar-400" />
              <span>Imprimir Romaneio</span>
            </button>

            {/* Botão Excluir Solicitação (Admin, Sabrina ou Emily) */}
            {canDeleteRequest && (
              <button
                type="button"
                disabled={actionLoadingId === r.id}
                onClick={() => handleDeleteRequest(r)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 hover:text-white text-xs font-bold border border-rose-800/60 hover:border-rose-600 transition-all shadow-sm active:scale-95 disabled:opacity-50"
                title="Excluir esta solicitação de material (Apenas Administradores, Sabrina e Emily)"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span>{actionLoadingId === r.id ? 'Excluindo...' : 'Excluir'}</span>
              </button>
            )}

            {/* Ações de Aprovação da Gestão (Admin, Sabrina ou Emily) */}
            {canApproveExtra && (r.status === 'Aguardando aprovação' || (r.requires_admin_approval && r.admin_approval_status === 'Pendente')) && (
              <div className="flex items-center gap-1.5 ml-1">
                <button
                  type="button"
                  disabled={actionLoadingId === r.id}
                  onClick={() => handleApproveExtra(r)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/20 disabled:opacity-50 active:scale-95"
                  title="Aprovar materiais extras ou fora da base desta solicitação"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{actionLoadingId === r.id ? 'Aprovando...' : 'Aprovar'}</span>
                </button>
                <button
                  type="button"
                  disabled={actionLoadingId === r.id}
                  onClick={() => handleRejectExtra(r)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-md shadow-rose-600/20 disabled:opacity-50 active:scale-95"
                  title="Rejeitar solicitação"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Rejeitar</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Banner de Aviso quando aguarda aprovação */}
        {(r.status === 'Aguardando aprovação' || (r.requires_admin_approval && r.admin_approval_status === 'Pendente')) && (
          <div className="p-3 bg-amber-950/40 border border-amber-500/40 rounded-2xl flex items-start gap-2.5 text-xs text-amber-300">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Solicitação pendente de aprovação:</span> Esta solicitação contém materiais fora da base ou quantidades extras além do orçamento aprovado da obra.
              {canApproveExtra ? (
                <span className="ml-1 text-amber-200">Como gestor autorizado (Admin, Sabrina ou Emily), você pode aprovar ou rejeitar pelos botões acima.</span>
              ) : (
                <span className="ml-1 text-amber-200">Aguardando análise e autorização de Admin, Sabrina ou Emily antes da separação no almoxarifado.</span>
              )}
            </div>
          </div>
        )}

        {/* Itens Solicitados com Accordion Retraível */}
        <div className="bg-dark-850 rounded-2xl border border-dark-700 overflow-hidden">
          <div
            onClick={() => toggleRequestExpanded(r.id)}
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
                toggleRequestExpanded(r.id);
              }}
              className="flex items-center gap-1 text-xs font-bold text-sabrar-400 hover:text-sabrar-300 px-2.5 py-1 rounded-xl bg-dark-800 hover:bg-dark-750 border border-dark-700 transition-colors shrink-0"
            >
              <span>{isExpanded ? 'Ocultar Materiais' : `Ver Materiais (${totalItemsCount})`}</span>
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>

          {isExpanded && (
            <div className="p-3 border-t border-dark-700 space-y-2 bg-dark-900/40 animate-fadeIn">
              {items.map((it: any) => (
                <div key={it.id} className="flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-1 py-1 border-b border-dark-800 last:border-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-white">{it.material_name}</span>
                    <span className="text-[11px] text-slate-400 font-mono">({it.material_code || 'FORA-BASE'})</span>
                    {!it.material_id && (
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-purple-950 text-purple-300 border border-purple-500/40">
                        Fora da Base
                      </span>
                    )}
                    {it.is_extra && (
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-600/40">
                        Extra Obra
                      </span>
                    )}
                    {it.extra_quantity != null && it.extra_quantity > 0 && (
                      <span className="text-[10px] text-amber-400 font-semibold">
                        (+{it.extra_quantity} acima da cota orçada de {it.budget_quantity})
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
                        Separado: {it.quantity_delivered}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {r.notes && (
          <div className="text-[11px] text-slate-400 bg-dark-850 p-2.5 rounded-xl border border-dark-700">
            <span className="font-bold text-slate-300">Observações: </span>
            {r.notes}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-dark-900 p-4 sm:p-5 rounded-3xl border border-dark-750 shadow-xl">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-sabrar-950/70 border border-sabrar-500/40 flex items-center justify-center text-sabrar-400">
              <ClipboardList className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Solicitações de Materiais
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {currentUser?.role === 'engenharia'
              ? `Solicitações de material das obras sob sua responsabilidade (${currentUser?.name})`
              : 'Módulo da Engenharia & Compras: solicitações agrupadas por obra, reservas automáticas e cálculo de déficit'}
          </p>
        </div>

        <button
          onClick={() => setIsNewRequestModalOpen(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-sabrar-600 hover:bg-sabrar-500 text-white text-xs font-bold transition-all shadow-lg shadow-sabrar-600/30 active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Nova Solicitação</span>
        </button>
      </div>

      {/* Filters & View Mode Bar */}
      <div className="bg-dark-900 p-3.5 sm:p-4 rounded-3xl border border-dark-750 shadow-md space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Bar */}
          <div className="relative flex-1 min-w-[240px]">
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
              title="Agrupar solicitações de uma mesma obra juntas"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Por Obra (Agrupado)</span>
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

        <div className="flex items-center gap-2 overflow-x-auto text-xs pt-1">
          <div className="flex items-center gap-1 text-slate-400 font-semibold shrink-0">
            <Filter className="w-3.5 h-3.5 text-sabrar-400" />
            <span>Filtros:</span>
          </div>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="p-2 rounded-xl border border-dark-700 bg-dark-850 text-slate-200 font-medium focus:outline-none focus:ring-2 focus:ring-sabrar-500"
          >
            <option value="">Todos os Status</option>
            <option value="Aguardando aprovação">Aguardando aprovação</option>
            <option value="Solicitado">Solicitado</option>
            <option value="Em Separação">Em Separação</option>
            <option value="Separado Parcial">Separado Parcial</option>
            <option value="Separado">Separado</option>
            <option value="Cancelado">Cancelado</option>
          </select>

          <select
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value)}
            className="p-2 rounded-xl border border-dark-700 bg-dark-850 text-slate-200 font-medium focus:outline-none focus:ring-2 focus:ring-sabrar-500"
          >
            <option value="">Todas as Prioridades</option>
            <option value="Normal">Normal</option>
            <option value="Urgente">Urgente</option>
          </select>

          {(selectedStatus || selectedPriority || searchQuery) && (
            <button
              onClick={() => {
                setSelectedStatus('');
                setSelectedPriority('');
                setSearchQuery('');
              }}
              className="text-xs text-rose-400 font-semibold hover:underline shrink-0 ml-auto"
            >
              Limpar Filtros
            </button>
          )}
        </div>
      </div>

      {loading && (
        <div className="py-20 text-center text-sm text-slate-500">
          Carregando solicitações da engenharia...
        </div>
      )}

      {/* Requests Content */}
      {!loading && (
        viewMode === 'by_project' ? (
          <div className="space-y-4">
            {groupedByProject.length === 0 ? (
              <div className="py-16 text-center bg-dark-900 rounded-3xl border border-dark-750 text-xs text-slate-500">
                Nenhuma solicitação encontrada para os filtros selecionados.
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
                                {group.requiresAdminCount} pendente(s) de aprovação
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 self-end sm:self-center shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePrintProjectRomaneio(group);
                          }}
                          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-extrabold transition-all shadow-md shadow-emerald-600/30 active:scale-95 cursor-pointer"
                          title="Imprimir romaneio consolidado de todas as solicitações desta obra"
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

                    {/* Solicitações desta Obra */}
                    {isExpanded && (
                      <div className="p-4 sm:p-5 space-y-4 bg-dark-900/50">
                        {group.requests.map((req) => renderRequestCard(req))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        ) : (
          <div className="space-y-3.5">
            {visibleRequests.length === 0 ? (
              <div className="py-16 text-center bg-dark-900 rounded-3xl border border-dark-750 text-xs text-slate-500">
                Nenhuma solicitação encontrada para os filtros selecionados.
              </div>
            ) : (
              visibleRequests.map((r) => renderRequestCard(r))
            )}
          </div>
        )
      )}

      {/* Modals */}
      <NewRequestModal
        isOpen={isNewRequestModalOpen}
        onClose={() => setIsNewRequestModalOpen(false)}
        onSuccess={() => fetchRequests()}
      />

      <PrintRequestModal
        isOpen={!!selectedRequestForPrint}
        onClose={() => setSelectedRequestForPrint(null)}
        request={selectedRequestForPrint}
      />
    </div>
  );
};

