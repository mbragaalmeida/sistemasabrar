import React, { useState, useEffect } from 'react';
import { ClipboardList, Plus, Search, Filter, HardHat, Clock, AlertTriangle, CheckCircle, ChevronDown, ChevronUp, Package, Printer, ShieldCheck, Check, X, Trash2 } from 'lucide-react';
import { MaterialRequest } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { StatusBadge } from '../components/common/StatusBadge';
import { NewRequestModal } from '../components/modals/NewRequestModal';
import { PrintRequestModal } from '../components/modals/PrintRequestModal';

export const RequestsPage: React.FC = () => {
  const { currentUser } = useAuth();
  const [requests, setRequests] = useState<MaterialRequest[]>([]);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedPriority, setSelectedPriority] = useState('');
  const [loading, setLoading] = useState(true);
  const [isNewRequestModalOpen, setIsNewRequestModalOpen] = useState(false);
  const [selectedRequestForPrint, setSelectedRequestForPrint] = useState<MaterialRequest | null>(null);
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

      const data = await api.getRequests(params);
      setRequests(data);
    } catch (err) {
      console.error('Erro ao carregar solicitações:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveExtra = async (request: MaterialRequest) => {
    const approverLabel = currentUser?.name || 'Administrador / Gestor';
    const notes = window.prompt(`Aprovar materiais extras da solicitação #${request.code}?\n\n(Opcional) Digite alguma observação ou despacho da diretoria:`, `Aprovado por ${approverLabel}`);
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
  }, [selectedStatus, selectedPriority]);

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
            Módulo da Engenharia & Compras: solicitações de obra, uso interno, reservas automáticas e cálculo de déficit
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

      {/* Filters Bar */}
      <div className="bg-dark-900 p-3.5 sm:p-4 rounded-3xl border border-dark-750 shadow-md flex items-center gap-2 overflow-x-auto text-xs">
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
          <option value="Reservado">Reservado</option>
          <option value="Em separação">Em separação</option>
          <option value="Separado">Separado</option>
          <option value="Entregue">Entregue</option>
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

        {(selectedStatus || selectedPriority) && (
          <button
            onClick={() => {
              setSelectedStatus('');
              setSelectedPriority('');
            }}
            className="text-xs text-rose-400 font-semibold hover:underline shrink-0 ml-auto"
          >
            Limpar
          </button>
        )}
      </div>

      {loading && (
        <div className="py-20 text-center text-sm text-slate-500">
          Carregando solicitações da engenharia...
        </div>
      )}

      {/* Requests List */}
      {!loading && (
        <div className="space-y-3.5">
          {requests.length === 0 ? (
            <div className="py-16 text-center bg-dark-900 rounded-3xl border border-dark-750 text-xs text-slate-500">
              Nenhuma solicitação encontrada para os filtros selecionados.
            </div>
          ) : (
            requests.map((r) => (
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
                          Extras Aprovados por {r.admin_approved_by_name || 'Diretoria'}
                        </span>
                      ) : r.admin_approval_status === 'Rejeitado' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-950 text-rose-300 border border-rose-700">
                          <X className="w-3.5 h-3.5 text-rose-400" />
                          Extras Rejeitados
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-950 text-amber-300 border border-amber-600/50">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                          Aguardando Aprovação de Gestor (Extras)
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
                      title="Imprimir romaneio de separação da obra"
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
                    {canApproveExtra && r.requires_admin_approval && r.admin_approval_status === 'Pendente' && (
                      <div className="flex items-center gap-1.5 ml-1">
                        <button
                          type="button"
                          disabled={actionLoadingId === r.id}
                          onClick={() => handleApproveExtra(r)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/20 disabled:opacity-50 active:scale-95"
                          title="Aprovar materiais extras desta obra"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>{actionLoadingId === r.id ? 'Aprovando...' : 'Aprovar Extras'}</span>
                        </button>
                        <button
                          type="button"
                          disabled={actionLoadingId === r.id}
                          onClick={() => handleRejectExtra(r)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-md shadow-rose-600/20 disabled:opacity-50 active:scale-95"
                          title="Rejeitar solicitação de materiais extras"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Rejeitar</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Banner de Aviso quando aguarda aprovação */}
                {r.requires_admin_approval && r.admin_approval_status === 'Pendente' && (
                  <div className="p-3 bg-amber-950/40 border border-amber-500/40 rounded-2xl flex items-start gap-2.5 text-xs text-amber-300">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Solicitação pendente de aprovação:</span> Esta solicitação contém itens ou quantidades extras além do orçamento aprovado da obra.
                      {canApproveExtra ? (
                        <span className="ml-1 text-amber-200">Como gestor autorizado (Admin/Sabrina/Emily), você pode aprovar ou rejeitar os materiais extras pelos botões acima.</span>
                      ) : (
                        <span className="ml-1 text-amber-200">Aguardando análise e autorização da diretoria (Admin, Sabrina ou Emily) antes da separação no almoxarifado.</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Itens Solicitados com Accordion Retraível */}
                {(() => {
                  const isExpanded = expandedRequests.has(r.id);
                  const items = r.items || [];
                  const totalItemsCount = items.length;
                  const totalDeficit = items.reduce((acc: number, it: any) => acc + (it.deficit || 0), 0);
                  const totalReserved = items.reduce((acc: number, it: any) => acc + (it.quantity_reserved || 0), 0);

                  return (
                    <div className="bg-dark-850 rounded-2xl border border-dark-700 overflow-hidden">
                      {/* Linha Resumo Retraível */}
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
                                    Entregue: {it.quantity_delivered}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {r.notes && (
                  <div className="text-[11px] text-slate-400 bg-dark-850 p-2.5 rounded-xl border border-dark-700">
                    <span className="font-bold text-slate-300">Observações: </span>
                    {r.notes}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
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
