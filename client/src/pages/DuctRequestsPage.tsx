import React, { useState, useEffect, useMemo } from 'react';
import {
  Wind,
  Plus,
  Search,
  Building2,
  Calendar,
  FileText,
  Check,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Truck,
  AlertTriangle
} from 'lucide-react';
import { Project } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { NewDuctRequestModal } from '../components/modals/NewDuctRequestModal';

interface DuctRequestsPageProps {
  onNavigate?: (page: string, id?: number) => void;
}

export const DuctRequestsPage: React.FC<DuctRequestsPageProps> = ({ onNavigate }) => {
  const { currentUser } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [ductRequests, setDuctRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [expandedRequests, setExpandedRequests] = useState<Set<number>>(new Set());

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
        api.getDuctRequests().catch(() => [])
      ]);
      setProjects((projData || []).filter((p: Project) => p.code !== 'SAB-INTERNO'));
      setDuctRequests(reqData || []);
    } catch (err) {
      console.error('Erro ao carregar solicitações de dutos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

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
    let list = ductRequests;

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
        (r.items || []).some((it: any) => (it.itemDescription || '').toLowerCase().includes(q))
      );
    }

    return list;
  }, [ductRequests, selectedProjectId, userAssignedProjects, projects, currentUser, searchQuery]);

  const getDuctStatusBadge = (status: string) => {
    switch (status) {
      case 'solicitado':
        return <span className="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-700">Aguardando Tagueamento (CAMduct)</span>;
      case 'tagueado':
        return <span className="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-blue-950 text-blue-300 border border-blue-700">Tagueado no CAMduct</span>;
      case 'aprovacao_excesso':
        return <span className="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-700 flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-rose-400" /> Aguardando Aprovação de Excesso</span>;
      case 'em_producao':
        return <span className="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-indigo-950 text-indigo-300 border border-indigo-700">Em Fabricação</span>;
      case 'pronto_logistica':
        return <span className="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-600 flex items-center gap-1"><Check className="w-3 h-3 text-emerald-400" /> Pronto na Fábrica (Liberado p/ Logística)</span>;
      case 'em_transito':
        return <span className="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-purple-950 text-purple-300 border border-purple-700">Em Transporte p/ Canteiro</span>;
      case 'entregue':
        return <span className="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-600">Entregue na Obra</span>;
      default:
        return <span className="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-dark-800 text-slate-300 border border-dark-700">{status}</span>;
    }
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-16">
      {/* Top Header */}
      <div className="bg-dark-900 p-5 rounded-3xl border border-dark-750 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-blue-950/70 border border-blue-500/40 flex items-center justify-center text-blue-400 shadow-md">
            <Wind className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Solicitação de Dutos
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Módulo de Engenharia • Registro de demandas de dutos e tramos para fabricação no Autodesk CAMduct
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => loadData()}
            className="flex items-center gap-1.5 px-3 py-2 bg-dark-800 hover:bg-dark-750 border border-dark-700 text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
            title="Atualizar dados"
          >
            <RefreshCw className="w-3.5 h-3.5 text-blue-400" />
            <span>Atualizar</span>
          </button>

          <button
            onClick={() => setIsNewModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-lg shadow-blue-600/30 active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nova Solicitação de Dutos</span>
          </button>
        </div>
      </div>

      {/* Banner Informativo do Fluxo */}
      <div className="p-4 bg-blue-950/30 border border-blue-800/50 rounded-3xl flex items-start gap-3">
        <div className="w-8 h-8 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 shrink-0 mt-0.5">
          <Wind className="w-4 h-4" />
        </div>
        <div className="text-xs space-y-1">
          <h4 className="font-extrabold text-blue-200">Como funciona o fluxo de dutos?</h4>
          <p className="text-slate-300 leading-relaxed">
            Você registra a solicitação de dutos da sua obra informando os tramos e quantidades. A solicitação é enviada automaticamente para a área <strong className="text-white">Gestão de Dutos & Autodesk CAMduct (Vinicius Gomes)</strong> para tagueamento externo e emissão do Delivery Note. Quando os dutos forem fabricados e marcados como <strong className="text-emerald-400">Prontos</strong>, você poderá solicitar o transporte diretamente na aba <strong className="text-purple-300">Solicitar Logística</strong>.
          </p>
        </div>
      </div>

      {/* Filtros e Busca */}
      <div className="bg-dark-900 p-4 rounded-3xl border border-dark-750 shadow-md flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Seletor de Obra */}
        <div className="flex items-center gap-2 bg-dark-850 px-3 py-2 rounded-2xl border border-dark-700 min-w-[260px]">
          <Building2 className="w-4 h-4 text-blue-400 shrink-0" />
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
            placeholder="Buscar por código, obra, item ou solicitante..."
            className="w-full bg-dark-850 text-white placeholder-slate-400 text-xs rounded-2xl pl-10 pr-9 py-2.5 border border-dark-700 focus:outline-none focus:border-blue-500 transition-colors"
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

      {/* Lista de Solicitações */}
      {loading ? (
        <div className="py-20 text-center text-xs text-slate-500">
          Carregando solicitações de dutos...
        </div>
      ) : visibleRequests.length === 0 ? (
        <div className="py-16 text-center bg-dark-900 rounded-3xl border border-dark-750 p-6 space-y-3">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-dark-800 border border-dark-700 flex items-center justify-center text-slate-500">
            <Wind className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-white">Nenhuma solicitação de dutos encontrada</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            {selectedProjectId !== 'all'
              ? 'Nenhuma solicitação de dutos registrada para a obra selecionada.'
              : 'Você ainda não registrou nenhuma solicitação de dutos.'}
          </p>
          <button
            onClick={() => setIsNewModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-600/30 active:scale-95 cursor-pointer mt-2"
          >
            <Plus className="w-4 h-4" />
            <span>Criar Solicitação de Dutos</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3.5">
          {visibleRequests.map((r: any) => {
            const isExpanded = expandedRequests.has(r.id);
            const dn = r.deliveryNotes && r.deliveryNotes.length > 0 ? r.deliveryNotes[0] : null;

            return (
              <div key={r.id} className="bg-dark-900 border border-dark-750 rounded-3xl p-4 sm:p-5 shadow-lg space-y-3 transition-all hover:border-dark-700">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-black text-blue-400 bg-blue-950/80 px-2.5 py-0.5 rounded-lg border border-blue-800">
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
                      <span>•</span>
                      <span>{r.items?.length || 0} itens solicitados</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 self-start sm:self-center">
                    {getDuctStatusBadge(r.status)}
                    <button
                      type="button"
                      onClick={() => toggleExpanded(r.id)}
                      className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-dark-850 transition-colors cursor-pointer"
                    >
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* Delivery Note Info se já tagueado */}
                {dn && (
                  <div className="p-3 bg-dark-850 rounded-2xl border border-dark-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-400 shrink-0" />
                      <span className="text-slate-300">Delivery Note CAMduct: <strong className="text-white">{dn.deliveryNoteNumber || `DN-${dn.id}`}</strong></span>
                      <span className="text-slate-500">•</span>
                      <span className="text-slate-300">Peso Total: <strong className="text-blue-400">{dn.totalWeightKg} kg</strong></span>
                    </div>
                    {dn.exceedsBudget && (
                      <span className="text-[10px] font-bold text-amber-400 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-800">
                        ⚠️ Excesso de cota: +{dn.excessWeightKg} kg (Status: {dn.adminApprovalStatus})
                      </span>
                    )}
                  </div>
                )}

                {/* Banner de Duto Pronto na Fábrica com atalho para solicitar logística */}
                {r.status === 'pronto_logistica' && (
                  <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 text-emerald-300 font-bold">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Dutos concluídos na fábrica! Eles já estão prontos para envio ao canteiro.</span>
                    </div>
                    {onNavigate && (
                      <button
                        type="button"
                        onClick={() => onNavigate('solicitar-logistica')}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs transition-all shadow-md shadow-emerald-600/30 cursor-pointer active:scale-95 shrink-0"
                      >
                        <Truck className="w-3.5 h-3.5" />
                        <span>Ir para Solicitar Logística</span>
                      </button>
                    )}
                  </div>
                )}

                {/* Lista Expandida de Itens */}
                {isExpanded && (
                  <div className="pt-2 border-t border-dark-800 space-y-2">
                    <h4 className="text-xs font-bold text-slate-300">Itens e Tramos Solicitados:</h4>
                    <div className="divide-y divide-dark-800 bg-dark-850 rounded-2xl border border-dark-750 overflow-hidden">
                      {r.items?.map((it: any, idx: number) => (
                        <div key={idx} className="p-3 text-xs flex items-center justify-between gap-3">
                          <div>
                            <span className="font-bold text-white">{it.itemDescription}</span>
                            {it.notes && (
                              <p className="text-[11px] text-slate-400 mt-0.5">{it.notes}</p>
                            )}
                          </div>
                          <span className="font-mono font-bold text-blue-300 bg-blue-950/80 px-2 py-0.5 rounded border border-blue-900 shrink-0">
                            Qtd: {it.quantity}
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

      {/* Modal de Criação de Solicitação de Dutos */}
      <NewDuctRequestModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onSuccess={() => loadData()}
        initialProjectId={selectedProjectId !== 'all' ? Number(selectedProjectId) : undefined}
      />
    </div>
  );
};
