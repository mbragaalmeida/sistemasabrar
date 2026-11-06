import React, { useState, useEffect, useMemo } from 'react';
import { FolderKanban, Plus, Search, Filter, Calendar, MapPin, HardHat, FileText, ArrowRight, CheckCircle2, Clock, Edit3, Trash2, AlertTriangle, Wrench } from 'lucide-react';
import { Project } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { StatusBadge } from '../components/common/StatusBadge';
import { AssignEngineersModal } from '../components/modals/AssignEngineersModal';
import { EditProjectModal } from '../components/modals/EditProjectModal';
import { ExecutionCalendar } from '../components/projects/ExecutionCalendar';
import { canDeleteProject, canUserViewPrices } from '../utils/permissions';

interface ProjectsPageProps {
  onNavigate: (page: string, id?: number) => void;
  onOpenNewProject: () => void;
  initialCategory?: 'Obra' | 'Manutenção';
}

export const ProjectsPage: React.FC<ProjectsPageProps> = ({ onNavigate, onOpenNewProject, initialCategory }) => {
  const { currentUser } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeCategory, setActiveCategory] = useState<'Obra' | 'Manutenção'>(initialCategory || 'Obra');
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [loading, setLoading] = useState(true);
  const [assigningProject, setAssigningProject] = useState<Project | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [deletingProject, setDeletingProject] = useState(false);

  // Sincroniza categoria inicial quando muda rota
  useEffect(() => {
    if (initialCategory) {
      setActiveCategory(initialCategory);
    }
  }, [initialCategory]);

  // Contagens totais por categoria principal
  const obrasTotalCount = useMemo(() => {
    return projects.filter(p => p.code !== 'SAB-INTERNO' && p.category !== 'Manutenção' && !p.name.toLowerCase().includes('manuten')).length;
  }, [projects]);

  const manutencaoTotalCount = useMemo(() => {
    return projects.filter(p => p.code !== 'SAB-INTERNO' && (p.category === 'Manutenção' || p.name.toLowerCase().includes('manuten'))).length;
  }, [projects]);

  // Lista de projetos da categoria ativa (Obras vs Manutenção)
  const categoryProjects = useMemo(() => {
    return projects.filter(p => {
      if (p.code === 'SAB-INTERNO') return false;
      const isMaint = p.category === 'Manutenção' || p.name.toLowerCase().includes('manuten');
      return activeCategory === 'Manutenção' ? isMaint : !isMaint;
    });
  }, [projects, activeCategory]);

  // Aba de estágio operacional: Todas vs Em Execução vs Em Orçamento vs Finalizadas vs Calendário de Execução
  const [workflowTab, setWorkflowTab] = useState<'todas' | 'execucao' | 'orcamento' | 'finalizadas' | 'calendario'>('todas');

  const execucaoCount = useMemo(() => {
    return categoryProjects.filter(p => p.status === 'Em execução' || p.status === 'Aprovado' || p.budget?.status === 'Aprovado').length;
  }, [categoryProjects]);

  const orcamentoCount = useMemo(() => {
    return categoryProjects.filter(p => !['Em execução', 'Aprovado', 'Finalizado', 'Concluído', 'Concluída', 'Cancelado', 'Perdido'].includes(p.status) && p.budget?.status !== 'Aprovado').length;
  }, [categoryProjects]);

  const finalizadasCount = useMemo(() => {
    return categoryProjects.filter(p => ['Finalizado', 'Concluído', 'Concluída'].includes(p.status)).length;
  }, [categoryProjects]);

  const calendarCount = useMemo(() => {
    return categoryProjects.filter(p => (p.expected_end_date || p.return_deadline)).length;
  }, [categoryProjects]);

  const displayedProjects = useMemo(() => {
    const isEngineer = currentUser?.role === 'engenharia' || currentUser?.role === 'orcamento_engenharia' || (currentUser?.role as string) === 'engineer';
    const normUser = (currentUser?.name || '').toLowerCase().replace(/^eng\.?\s*/i, '').trim();

    return categoryProjects.filter(p => {
      // Se o usuário for engenheiro, mostra apenas as obras atribuídas a ele
      if (isEngineer && currentUser) {
        const isAssigned = (p.assigned_engineer_ids && p.assigned_engineer_ids.includes(currentUser.id)) ||
                           (p.assigned_engineers && p.assigned_engineers.some((e: any) => e.id === currentUser.id));
        const isResp = normUser && p.responsible_engineer && p.responsible_engineer.toLowerCase().replace(/^eng\.?\s*/i, '').trim().includes(normUser);
        if (!isAssigned && !isResp) return false;
      }

      if (workflowTab === 'execucao') {
        return p.status === 'Em execução' || p.status === 'Aprovado' || p.budget?.status === 'Aprovado';
      }
      if (workflowTab === 'orcamento') {
        return !['Em execução', 'Aprovado', 'Finalizado', 'Cancelado'].includes(p.status) && p.budget?.status !== 'Aprovado';
      }
      if (workflowTab === 'finalizadas') {
        return ['Finalizado', 'Concluído', 'Concluída'].includes(p.status);
      }
      return true;
    });
  }, [categoryProjects, workflowTab, currentUser]);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (selectedStatus) params.status = selectedStatus;
      if (selectedType) params.project_type = selectedType;

      const data = await api.getProjects(params);
      setProjects(data);
    } catch (err) {
      console.error('Erro ao buscar projetos:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDeleteProject = async () => {
    if (!projectToDelete) return;
    setDeletingProject(true);
    try {
      await api.deleteProject(projectToDelete.id);
      setProjectToDelete(null);
      await fetchProjects();
    } catch (err: any) {
      alert(err.message || 'Erro ao excluir projeto');
    } finally {
      setDeletingProject(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, [selectedStatus, selectedType]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchProjects();
  };

  return (
    <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto pb-12">
      {/* SELETOR DE CATEGORIA: OBRAS vs MANUTENÇÃO (Item 4) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-dark-900 p-2 sm:p-2.5 rounded-3xl border border-dark-750 shadow-md">
        <div className="flex items-center gap-1.5 p-1 bg-dark-950/90 rounded-2xl border border-dark-750 flex-1 sm:max-w-md">
          <button
            type="button"
            onClick={() => {
              setActiveCategory('Obra');
              setWorkflowTab('todas');
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeCategory === 'Obra'
                ? 'bg-sabrar-600 text-white shadow-md shadow-sabrar-600/30'
                : 'text-slate-400 hover:text-white hover:bg-dark-850'
            }`}
          >
            <FolderKanban className="w-4 h-4" />
            <span>Obras & Projetos</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-dark-900/80 text-slate-300 font-mono">
              {obrasTotalCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveCategory('Manutenção');
              setWorkflowTab('todas');
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeCategory === 'Manutenção'
                ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                : 'text-slate-400 hover:text-white hover:bg-dark-850'
            }`}
          >
            <Wrench className="w-4 h-4" />
            <span>Manutenção</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-dark-900/80 text-slate-300 font-mono">
              {manutencaoTotalCount}
            </span>
          </button>
        </div>

        <button
          onClick={onOpenNewProject}
          className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-white text-xs font-bold transition-all shadow-lg active:scale-95 cursor-pointer ${
            activeCategory === 'Manutenção'
              ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/30'
              : 'bg-sabrar-600 hover:bg-sabrar-500 shadow-sabrar-600/30'
          }`}
        >
          <Plus className="w-4 h-4" />
          <span>{activeCategory === 'Manutenção' ? 'Cadastrar Manutenção' : 'Cadastrar Projeto / Obra'}</span>
        </button>
      </div>

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-dark-900 p-4 sm:p-5 rounded-3xl border border-dark-750 shadow-xl">
        <div>
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-2xl border flex items-center justify-center ${
              activeCategory === 'Manutenção'
                ? 'bg-amber-950/70 border-amber-500/40 text-amber-400'
                : 'bg-sabrar-950/70 border-sabrar-500/40 text-sabrar-400'
            }`}>
              {activeCategory === 'Manutenção' ? <Wrench className="w-5 h-5" /> : <FolderKanban className="w-5 h-5" />}
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              {activeCategory === 'Manutenção' ? 'Contratos de Manutenção Recorrente' : 'Projetos & Obras de Engenharia'}
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {activeCategory === 'Manutenção'
              ? 'Gestão de contratos mensais fixos, preventivas, corretivas e materiais solicitados para manutenção'
              : 'Centralize projetos técnicos, upload de memoriais descritivos, orçamentos e execução'}
          </p>
        </div>
      </div>

      {/* Segmented Tabs: Visão Operacional por Estágio de Obra */}
      <div className="flex items-center gap-2 overflow-x-auto p-1.5 bg-dark-900 rounded-2xl border border-dark-750 text-xs no-scrollbar">
        <button
          type="button"
          onClick={() => setWorkflowTab('todas')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold transition-all whitespace-nowrap ${
            workflowTab === 'todas'
              ? 'bg-sabrar-600 text-white shadow-md shadow-sabrar-600/30'
              : 'text-slate-400 hover:text-white hover:bg-dark-800'
          }`}
        >
          <span>{activeCategory === 'Manutenção' ? 'Todos os Contratos' : 'Todas as Obras'}</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-dark-800 text-slate-300 font-mono">
            {categoryProjects.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setWorkflowTab('execucao')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold transition-all whitespace-nowrap ${
            workflowTab === 'execucao'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
              : 'text-slate-400 hover:text-white hover:bg-dark-800'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
          <span>{activeCategory === 'Manutenção' ? 'Manutenções Ativas' : 'Obras Aprovadas & Em Execução'}</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/40 font-mono">
            {execucaoCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setWorkflowTab('orcamento')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold transition-all whitespace-nowrap ${
            workflowTab === 'orcamento'
              ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
              : 'text-slate-400 hover:text-white hover:bg-dark-800'
          }`}
        >
          <Clock className="w-3.5 h-3.5 text-amber-300" />
          <span>{activeCategory === 'Manutenção' ? 'Em Levantamento / Revisão' : 'Em Levantamento & Orçamento'}</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-950 text-amber-300 border border-amber-500/40 font-mono">
            {orcamentoCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setWorkflowTab('finalizadas')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold transition-all whitespace-nowrap ${
            workflowTab === 'finalizadas'
              ? 'bg-slate-700 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-dark-800'
          }`}
        >
          <span>{activeCategory === 'Manutenção' ? 'Encerradas / Canceladas' : 'Obras Finalizadas'}</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-dark-800 text-slate-300 font-mono">
            {finalizadasCount}
          </span>
        </button>

        {/* Item 4: Calendário de Execução (Círculo Vermelho do Print 1) */}
        <button
          type="button"
          onClick={() => setWorkflowTab('calendario')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-bold transition-all whitespace-nowrap ${
            workflowTab === 'calendario'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
              : 'text-slate-400 hover:text-white hover:bg-dark-800'
          }`}
        >
          <Calendar className="w-3.5 h-3.5 text-blue-400" />
          <span>Calendário de Execução</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-950 text-blue-300 border border-blue-500/40 font-mono">
            {calendarCount}
          </span>
        </button>
      </div>

      {/* Visualização de Calendário de Execução (Item 4) */}
      {workflowTab === 'calendario' ? (
        <ExecutionCalendar projects={projects} onNavigate={onNavigate} />
      ) : (
        <>
          {/* Filters & Search Bar (Mobile First) */}
          <div className="bg-dark-900 p-3.5 sm:p-4 rounded-3xl border border-dark-750 shadow-md space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por código, nome da obra, cliente ou endereço..."
              className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl border border-dark-700 focus:outline-none focus:ring-2 focus:ring-sabrar-500 text-white bg-dark-850 placeholder-slate-500"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-sabrar-600 hover:bg-sabrar-500 text-white text-xs font-bold transition-colors shrink-0 shadow-sm"
          >
            Buscar
          </button>
        </form>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <div className="flex items-center gap-1 text-slate-400 font-semibold shrink-0">
            <Filter className="w-3.5 h-3.5 text-sabrar-400" />
            <span>Filtros:</span>
          </div>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="p-2 rounded-xl border border-dark-700 text-slate-200 text-xs bg-dark-850 font-medium focus:outline-none focus:ring-2 focus:ring-sabrar-500"
          >
            <option value="">Todos os Status</option>
            <option value="Novo">Novo</option>
            <option value="Em análise pela IA">Em análise pela IA</option>
            <option value="Orçamento gerado">Orçamento gerado</option>
            <option value="Em revisão">Em revisão</option>
            <option value="Orçamento finalizado">Orçamento finalizado</option>
            <option value="Enviado ao cliente">Enviado ao cliente</option>
            <option value="Aprovado">Aprovado</option>
            <option value="Em execução">Em execução</option>
            <option value="Finalizado">Finalizado</option>
          </select>

          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="p-2 rounded-xl border border-dark-700 text-slate-200 text-xs bg-dark-850 font-medium focus:outline-none focus:ring-2 focus:ring-sabrar-500"
          >
            <option value="">Todas as Tipologias</option>
            <option value="Comercial">Comercial</option>
            <option value="Industrial">Industrial</option>
            <option value="Residencial">Residencial</option>
            <option value="Reforma">Reforma</option>
            <option value="Infraestrutura">Infraestrutura</option>
          </select>

          {(selectedStatus || selectedType) && (
            <button
              onClick={() => {
                setSelectedStatus('');
                setSelectedType('');
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
          Carregando lista de projetos...
        </div>
      )}

      {/* Projects Cards View (Mobile First) */}
      {!loading && (
        displayedProjects.length === 0 ? (
          <div className="py-16 text-center bg-dark-900 rounded-3xl border border-dark-750 text-xs text-slate-500 space-y-1">
            <FolderKanban className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <div className="font-bold text-slate-300">Nenhuma obra encontrada para esta visualização.</div>
            <p className="text-[11px] text-slate-500">Tente alternar para outra aba ou limpar os filtros de busca.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {displayedProjects.map((p) => {
              const hasBudget = p.budget && p.budget.total_final > 0;
              return (
                <div
                  key={p.id}
                  onClick={() => onNavigate('project-detail', p.id)}
                  className="bg-dark-900 rounded-3xl border border-dark-750 p-4 sm:p-5 hover:border-sabrar-500/60 hover:shadow-xl hover:shadow-sabrar-950/20 transition-all cursor-pointer flex flex-col justify-between group"
                >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-mono text-xs font-bold text-sabrar-400 bg-dark-800 border border-dark-700 px-2 py-0.5 rounded">
                      {p.code}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <StatusBadge status={p.status} size="sm" />
                      {(currentUser?.role === 'admin' || currentUser?.role === 'orcamento' || currentUser?.role === 'orcamento_engenharia' || currentUser?.role === 'compras_solicitacoes') && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingProject(p);
                          }}
                          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-dark-800 border border-transparent hover:border-dark-700 transition-colors"
                          title="Editar informações cadastradas da obra"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {canDeleteProject(currentUser) && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setProjectToDelete(p);
                          }}
                          className="p-1 rounded-lg text-rose-400 hover:text-rose-200 hover:bg-rose-950/60 border border-transparent hover:border-rose-800/60 transition-colors"
                          title="Excluir projeto (Apenas Administrador e Sabrina)"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <h3 className="font-extrabold text-sm sm:text-base text-white group-hover:text-sabrar-400 transition-colors line-clamp-1">
                    {p.name}
                  </h3>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Cliente: <span className="font-semibold text-slate-300">{p.client}</span>
                  </div>

                  {/* Informações Resumidas */}
                  <div className="mt-3 space-y-1.5 text-xs text-slate-400">
                    <div className="flex items-center gap-1.5 truncate">
                      <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="truncate">{p.address || `${p.city} - ${p.state}`}</span>
                    </div>

                    {/* Orçamentista Responsável & Data para Retorno (Requisito 2 e 3) */}
                    {(p.responsible_estimator || p.return_deadline) && (
                      <div className="flex items-center justify-between text-[11px] bg-dark-850 px-2 py-1 rounded-xl border border-dark-750">
                        {p.responsible_estimator && (
                          <span className="truncate text-slate-300">
                            Orçamentista: <strong>{p.responsible_estimator}</strong>
                          </span>
                        )}
                        {p.return_deadline && (
                          <span className="text-amber-400 font-bold shrink-0">
                            Retorno: {p.return_deadline.split('T')[0].split('-').reverse().join('/')}
                          </span>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-1.5 pt-1">
                      <div className="flex items-center gap-1.5 truncate">
                        <HardHat className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        {p.responsible_engineer ? (
                          <span className="truncate text-slate-300 font-semibold">{p.responsible_engineer}</span>
                        ) : (
                          <span className="text-amber-400 font-bold text-[11px] bg-amber-950/60 px-2 py-0.5 rounded border border-amber-500/40">
                            ⚠ Sem engenheiro atribuído
                          </span>
                        )}
                      </div>
                      {(currentUser?.role === 'admin' || currentUser?.role === 'orcamento_engenharia' || currentUser?.role === 'compras_solicitacoes' || currentUser?.role === 'orcamento') && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setAssigningProject(p);
                          }}
                          className="text-[11px] font-bold text-amber-400 hover:text-amber-300 bg-amber-950/40 hover:bg-amber-950/80 px-2.5 py-1 rounded-xl border border-amber-600/40 shrink-0 transition-colors shadow-xs"
                          title="Atribuir ou alterar engenheiros responsáveis desta obra"
                        >
                          {p.responsible_engineer ? 'Editar Eng.' : '+ Atribuir Eng.'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Bottom Card Info */}
                <div className="mt-4 pt-3 border-t border-dark-750 flex items-center justify-between text-xs">
                  {canUserViewPrices(currentUser) ? (
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold uppercase">Orçamento Final</span>
                      <span className="font-black text-white text-sm">
                        {hasBudget
                          ? `R$ ${p.budget.total_final.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                          : 'Aguardando'}
                      </span>
                    </div>
                  ) : (
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold uppercase">Status Orçamento</span>
                      <span className="font-bold text-slate-300 text-xs">
                        {hasBudget ? 'Orçamento Cadastrado' : 'Aguardando'}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-1 text-sabrar-400 font-bold group-hover:translate-x-1 transition-transform">
                    <span>Abrir</span>
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        )
      )}
        </>
      )}

      {/* Modal para Atribuição de Engenheiros da Obra */}
      {assigningProject && (
        <AssignEngineersModal
          isOpen={!!assigningProject}
          onClose={() => setAssigningProject(null)}
          projectId={assigningProject.id}
          projectName={assigningProject.name}
          projectCode={assigningProject.code}
          currentEngineerIds={assigningProject.assigned_engineer_ids || []}
          onSuccess={() => {
            fetchProjects();
            setAssigningProject(null);
          }}
        />
      )}

      {/* Modal para Edição de Informações da Obra */}
      {editingProject && (
        <EditProjectModal
          isOpen={!!editingProject}
          onClose={() => setEditingProject(null)}
          project={editingProject}
          onSuccess={() => {
            fetchProjects();
            setEditingProject(null);
          }}
        />
      )}

      {/* Modal de Confirmação de Exclusão de Projeto (Item 1) */}
      {projectToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-dark-900 border border-dark-750 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-3 bg-rose-950/60 border border-rose-800/60 rounded-2xl">
                <AlertTriangle className="w-6 h-6 text-rose-400" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-white">Excluir Obra / Projeto</h3>
                <span className="text-xs text-rose-400 font-semibold">Ação irreversível</span>
              </div>
            </div>

            <div className="text-xs text-slate-300 space-y-2">
              <p>
                Tem certeza de que deseja excluir permanentemente o projeto{' '}
                <strong className="text-white font-bold">{projectToDelete.name}</strong> ({projectToDelete.code})?
              </p>
              <div className="bg-dark-850 p-3 rounded-xl border border-dark-750 text-[11px] text-slate-400 space-y-1">
                <div>• Os orçamentos e listas de materiais serão excluídos.</div>
                <div>• Os arquivos técnicos e memórias serão desvinculados.</div>
                <div>• Qualquer estoque reservado por esta obra será liberado.</div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-dark-750">
              <button
                type="button"
                onClick={() => setProjectToDelete(null)}
                disabled={deletingProject}
                className="px-4 py-2 text-xs font-bold text-slate-300 hover:text-white bg-dark-800 hover:bg-dark-750 rounded-xl transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteProject}
                disabled={deletingProject}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:scale-95 rounded-xl transition-all shadow-md shadow-rose-950/40 flex items-center gap-1.5 disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{deletingProject ? 'Excluindo...' : 'Excluir Definitivamente'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
