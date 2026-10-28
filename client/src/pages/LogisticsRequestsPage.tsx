import React, { useState, useEffect, useMemo } from 'react';
import {
  Truck,
  Plus,
  Search,
  Building2,
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Package,
  Wind,
  MapPin,
  Phone,
  Clock
} from 'lucide-react';
import { Project } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { NewLogisticsRequestModal } from '../components/modals/NewLogisticsRequestModal';

interface LogisticsRequestsPageProps {
  onNavigate?: (page: string, id?: number) => void;
}

export const LogisticsRequestsPage: React.FC<LogisticsRequestsPageProps> = ({ onNavigate }) => {
  const { currentUser } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [logisticsRequests, setLogisticsRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [expandedRequests, setExpandedRequests] = useState<Set<number>>(new Set());

  // Painel de itens prontos para transporte na obra selecionada
  const [readyItemsSummary, setReadyItemsSummary] = useState<{ materials: any[]; ducts: any[] } | null>(null);
  const [loadingReadyItems, setLoadingReadyItems] = useState(false);

  const toggleExpanded = (id: number) => {
    setExpandedRequests(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [projData, reqData] = await Promise.all([
        api.getProjects().catch(() => []),
        api.getLogisticsRequests().catch(() => [])
      ]);
      setProjects((projData || []).filter((p: Project) => p.code !== 'SAB-INTERNO'));
      setLogisticsRequests(reqData || []);
    } catch (err) {
      console.error('Erro ao carregar solicitações de logística:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchReadyItems = async (pId: number) => {
    setLoadingReadyItems(true);
    try {
      const data = await api.getLogisticsReadyItems(pId);
      setReadyItemsSummary(data);
    } catch (err) {
      console.error('Erro ao carregar itens liberados da obra:', err);
      setReadyItemsSummary(null);
    } finally {
      setLoadingReadyItems(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedProjectId !== 'all') {
      fetchReadyItems(Number(selectedProjectId));
    } else {
      setReadyItemsSummary(null);
    }
  }, [selectedProjectId]);

  // Lista de obras atribuídas ao engenheiro (Admins, Emily e Sabrina veem todas)
  const userAssignedProjects = useMemo(() => {
    if (currentUser?.role === 'admin' || currentUser?.role === 'orcamento_engenharia' || currentUser?.role === 'compras_solicitacoes') {
      return projects;
    }
    const normUser = (currentUser?.name || '').toLowerCase().replace(/^eng\.?\s*/i, '').trim();
    const assigned = projects.filter((p: Project) => {
      if (p.assigned_engineer_ids && p.assigned_engineer_ids.includes(currentUser?.id as number)) return true;
      if (p.assigned_engineers && p.assigned_engineers.some(e => e.id === currentUser?.id)) return true;
      if (p.responsible_engineer && normUser) {
        const normProj = p.responsible_engineer.toLowerCase().replace(/^eng\.?\s*/i, '').trim();
        if (normProj.includes(normUser) || normUser.includes(normProj)) return true;
      }
      return false;
    });
    // Fallback: se nenhuma estiver formalmente atribuída, exibe todas para não travar a visualização
    return assigned.length > 0 ? assigned : projects;
  }, [projects, currentUser]);

  const visibleRequests = useMemo(() => {
    let list = logisticsRequests;

    // Filtro por obra selecionada
    if (selectedProjectId !== 'all') {
      list = list.filter((r: any) => String(r.projectId) === String(selectedProjectId));
    } else if (currentUser?.role === 'engenharia' && userAssignedProjects.length > 0 && userAssignedProjects.length !== projects.length) {
      const allowedIds = new Set(userAssignedProjects.map(p => String(p.id)));
      list = list.filter((r: any) => allowedIds.has(String(r.projectId)));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((r: any) =>
        (r.code || '').toLowerCase().includes(q) ||
        (r.projectName || '').toLowerCase().includes(q) ||
        (r.requestedByName || '').toLowerCase().includes(q) ||
        (r.deliveryAddress || '').toLowerCase().includes(q) ||
        (r.contactName || '').toLowerCase().includes(q) ||
        (r.items || []).some((it: any) => (it.itemDescription || '').toLowerCase().includes(q))
      );
    }

    return list;
  }, [logisticsRequests, selectedProjectId, userAssignedProjects, projects, currentUser, searchQuery]);

  const getLogisticsBadge = (status: string) => {
    switch (status) {
      case 'Pendente':
        return <span className="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-700">Pendente de Agendamento</span>;
      case 'Agendado':
        return <span className="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-blue-950 text-blue-300 border border-blue-700">Viagem Agendada</span>;
      case 'Em Trânsito':
        return <span className="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-purple-950 text-purple-300 border border-purple-700">Em Trânsito p/ Canteiro</span>;
      case 'Entregue':
        return <span className="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-600 flex items-center gap-1"><Check className="w-3 h-3 text-emerald-400" /> Entregue no Canteiro</span>;
      default:
        return <span className="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-dark-800 text-slate-300 border border-dark-700">{status}</span>;
    }
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-16">
      {/* Top Header */}
      <div className="bg-dark-900 p-5 rounded-3xl border border-dark-750 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-purple-950/70 border border-purple-500/40 flex items-center justify-center text-purple-400 shadow-md">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Solicitação de Logística & Transporte
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Módulo de Engenharia • Solicitação de envio de materiais liberados pelo Almoxarifado e dutos prontos da fábrica
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => {
              loadData();
              if (selectedProjectId !== 'all') fetchReadyItems(Number(selectedProjectId));
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-dark-800 hover:bg-dark-750 border border-dark-700 text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
            title="Atualizar dados"
          >
            <RefreshCw className="w-3.5 h-3.5 text-purple-400" />
            <span>Atualizar</span>
          </button>

          <button
            onClick={() => setIsNewModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all shadow-lg shadow-purple-600/30 active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nova Solicitação de Logística</span>
          </button>
        </div>
      </div>

      {/* Banner Informativo do Fluxo */}
      <div className="p-4 bg-purple-950/30 border border-purple-800/50 rounded-3xl flex items-start gap-3">
        <div className="w-8 h-8 rounded-xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-400 shrink-0 mt-0.5">
          <Truck className="w-4 h-4" />
        </div>
        <div className="text-xs space-y-1">
          <h4 className="font-extrabold text-purple-200">Como funciona a logística de canteiro?</h4>
          <p className="text-slate-300 leading-relaxed">
            Após o almoxarifado dar o OK nos materiais (separados) e o Vinicius marcar os dutos como prontos, os itens ficam disponíveis nesta tela. Ao registrar a solicitação, a demanda é enviada para a <strong className="text-white">Equipe de Logística (Sirlene Leal)</strong>, que programa o veículo, motorista e data de entrega no canteiro.
          </p>
        </div>
      </div>

      {/* Painel de Itens Liberados da Obra Selecionada */}
      {selectedProjectId !== 'all' && (
        <div className="p-4 bg-dark-900 border border-dark-750 rounded-3xl space-y-3 shadow-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-emerald-400" />
              <h4 className="text-xs font-bold text-white">
                Itens Disponíveis para Envio nesta Obra
              </h4>
            </div>
            <button
              onClick={() => setIsNewModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-purple-600/30 cursor-pointer self-start sm:self-auto"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Solicitar Transporte com estes Itens</span>
            </button>
          </div>

          {loadingReadyItems ? (
            <div className="text-xs text-slate-500 py-2">Consultando itens liberados no Almoxarifado e Fábrica...</div>
          ) : readyItemsSummary ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="p-3 bg-dark-850 rounded-2xl border border-dark-700">
                <div className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-1 flex items-center justify-between">
                  <span>Materiais Separados (Almoxarifado OK)</span>
                  <span className="font-mono text-emerald-400 font-bold">{readyItemsSummary.materials?.length || 0} disponíveis</span>
                </div>
                {readyItemsSummary.materials?.length === 0 ? (
                  <p className="text-[11px] text-slate-500">Nenhum material pendente de transporte.</p>
                ) : (
                  <div className="max-h-28 overflow-y-auto space-y-1 text-xs">
                    {readyItemsSummary.materials.slice(0, 4).map((m: any, i: number) => (
                      <div key={i} className="text-slate-300 truncate">
                        • <strong className="text-white">{m.quantity_available} {m.unit}</strong> - {m.material_name}
                      </div>
                    ))}
                    {readyItemsSummary.materials.length > 4 && (
                      <span className="text-[10px] text-slate-500">+ {readyItemsSummary.materials.length - 4} outros materiais</span>
                    )}
                  </div>
                )}
              </div>

              <div className="p-3 bg-dark-850 rounded-2xl border border-dark-700">
                <div className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-1 flex items-center justify-between">
                  <span>Dutos Fabricados (CAMduct Pronto)</span>
                  <span className="font-mono text-blue-400 font-bold">{readyItemsSummary.ducts?.length || 0} disponíveis</span>
                </div>
                {readyItemsSummary.ducts?.length === 0 ? (
                  <p className="text-[11px] text-slate-500">Nenhum lote de dutos pronto para transporte.</p>
                ) : (
                  <div className="max-h-28 overflow-y-auto space-y-1 text-xs">
                    {readyItemsSummary.ducts.slice(0, 4).map((d: any, i: number) => (
                      <div key={i} className="text-slate-300 truncate">
                        • <strong className="text-white">{d.quantity_available} un</strong> - {d.item_description} ({d.duct_code})
                      </div>
                    ))}
                    {readyItemsSummary.ducts.length > 4 && (
                      <span className="text-[10px] text-slate-500">+ {readyItemsSummary.ducts.length - 4} outros dutos</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* Filtros e Busca */}
      <div className="bg-dark-900 p-4 rounded-3xl border border-dark-750 shadow-md flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Seletor de Obra */}
        <div className="flex items-center gap-2 bg-dark-850 px-3 py-2 rounded-2xl border border-dark-700 min-w-[260px]">
          <Building2 className="w-4 h-4 text-purple-400 shrink-0" />
          <div className="flex flex-col flex-1">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider leading-none">
              Filtrar por Obra
            </span>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer pt-0.5 w-full truncate"
            >
              <option value="all" className="bg-dark-900 text-white">
                Todas as Obras ({userAssignedProjects.length})
              </option>
              {userAssignedProjects.map((p) => (
                <option key={p.id} value={p.id} className="bg-dark-900 text-white">
                  {p.code ? `${p.code} - ` : ''}{p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Barra de Busca */}
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por código, obra, endereço ou recebedor..."
            className="w-full bg-dark-850 text-white placeholder-slate-400 text-xs rounded-2xl pl-10 pr-9 py-2.5 border border-dark-700 focus:outline-none focus:border-purple-500 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs font-bold"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Lista de Solicitações de Logística */}
      {loading ? (
        <div className="py-20 text-center text-xs text-slate-500">
          Carregando solicitações de logística...
        </div>
      ) : visibleRequests.length === 0 ? (
        <div className="py-16 text-center bg-dark-900 rounded-3xl border border-dark-750 p-6 space-y-3">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-dark-800 border border-dark-700 flex items-center justify-center text-slate-500">
            <Truck className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-white">Nenhuma solicitação de logística encontrada</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            {selectedProjectId !== 'all'
              ? 'Nenhuma solicitação de transporte registrada para a obra selecionada.'
              : 'Registre uma demanda de transporte para que a equipe de logística (Sirlene) realize a entrega no canteiro.'}
          </p>
          <button
            onClick={() => setIsNewModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-purple-600/30 active:scale-95 cursor-pointer mt-2"
          >
            <Plus className="w-4 h-4" />
            <span>Solicitar Transporte</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3.5">
          {visibleRequests.map((r: any) => {
            const isExpanded = expandedRequests.has(r.id);

            return (
              <div key={r.id} className="bg-dark-900 border border-dark-750 rounded-3xl p-4 sm:p-5 shadow-lg space-y-3 transition-all hover:border-dark-700">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-black text-purple-400 bg-purple-950/80 px-2.5 py-0.5 rounded-lg border border-purple-800">
                        {r.code}
                      </span>
                      <h3 className="text-sm font-black text-white">{r.projectName}</h3>
                      {r.projectCode && (
                        <span className="text-[10px] text-slate-400 font-mono">({r.projectCode})</span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center gap-2 flex-wrap">
                      <span>Solicitante: <strong className="text-slate-200">{r.requestedByName || 'Engenharia'}</strong></span>
                      <span>•</span>
                      <span>Data: {new Date(r.createdAt).toLocaleDateString('pt-BR')}</span>
                      {(r.desiredDate || r.targetDate) && (
                        <>
                          <span>•</span>
                          <span className="text-amber-300 font-semibold">Entrega Desejada: {new Date(r.desiredDate || r.targetDate).toLocaleDateString('pt-BR')}</span>
                        </>
                      )}
                      {r.preferredShift && (
                        <>
                          <span>•</span>
                          <span className="text-purple-300 font-semibold bg-purple-950/70 border border-purple-800/80 px-2 py-0.5 rounded-md">
                            ⏰ {r.preferredShift}
                          </span>
                        </>
                      )}
                      <span>•</span>
                      <span>{r.items?.length || 0} itens</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 self-start sm:self-center">
                    {getLogisticsBadge(r.status)}
                    <button
                      type="button"
                      onClick={() => toggleExpanded(r.id)}
                      className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-dark-850 transition-colors cursor-pointer"
                    >
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* Detalhes de Destino e Contato */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-dark-850 p-3 rounded-2xl border border-dark-700">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Endereço de Entrega:</span>
                    <span className="text-slate-200 font-medium">{r.deliveryAddress || 'Endereço padrão da obra'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Contato no Canteiro:</span>
                    <span className="text-slate-200 font-medium">
                      {r.contactName || 'Não especificado'} {r.contactPhone ? `(${r.contactPhone})` : ''}
                    </span>
                  </div>
                </div>

                {/* Informações da Viagem Programada pela Logística (se houver) */}
                {r.trip && (
                  <div className="p-3 bg-purple-950/30 border border-purple-800/50 rounded-2xl text-xs flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-purple-300">
                      <Truck className="w-4 h-4 text-purple-400 shrink-0" />
                      <span>Viagem: <strong className="text-white">{r.trip.trip_code}</strong></span>
                      <span>•</span>
                      <span>Motorista: <strong className="text-white">{r.trip.driver_name || 'A definir'}</strong></span>
                      {r.trip.vehicle_plate && (
                        <>
                          <span>•</span>
                          <span>Veículo: {r.trip.vehicle_plate}</span>
                        </>
                      )}
                    </div>
                    <span className="text-[10px] font-bold text-purple-300 bg-purple-900/60 px-2 py-0.5 rounded border border-purple-700">
                      Status da Frota: {r.trip.status}
                    </span>
                  </div>
                )}

                {/* Lista Expandida de Itens */}
                {isExpanded && (
                  <div className="pt-2 border-t border-dark-800 space-y-2">
                    <h4 className="text-xs font-bold text-slate-300">Itens Desta Solicitação:</h4>
                    <div className="divide-y divide-dark-800 bg-dark-850 rounded-2xl border border-dark-750 overflow-hidden">
                      {r.items?.map((it: any, idx: number) => (
                        <div key={idx} className="p-3 text-xs flex items-center justify-between gap-3">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                                it.originType === 'duto'
                                  ? 'bg-blue-950 text-blue-300 border-blue-800'
                                  : 'bg-emerald-950 text-emerald-300 border-emerald-800'
                              }`}>
                                {it.originType === 'duto' ? 'Duto CAMduct (Vinicius)' : 'Almoxarifado (OK)'}
                              </span>
                              <span className="font-bold text-white">{it.itemDescription}</span>
                            </div>
                            {it.notes && (
                              <p className="text-[11px] text-slate-400">{it.notes}</p>
                            )}
                          </div>
                          <span className="font-mono font-bold text-purple-300 bg-purple-950/80 px-2 py-0.5 rounded border border-purple-900 shrink-0">
                            {it.quantity} {it.unit || 'un'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Nova Solicitação de Logística */}
      <NewLogisticsRequestModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onSuccess={() => {
          loadData();
          if (selectedProjectId !== 'all') fetchReadyItems(Number(selectedProjectId));
        }}
        initialProjectId={selectedProjectId !== 'all' ? Number(selectedProjectId) : undefined}
      />
    </div>
  );
};
