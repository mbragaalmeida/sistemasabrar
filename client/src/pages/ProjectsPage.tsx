import React, { useState, useEffect } from 'react';
import { FolderKanban, Plus, Search, Filter, Calendar, MapPin, HardHat, FileText, ArrowRight } from 'lucide-react';
import { Project } from '../types';
import { api } from '../services/api';
import { StatusBadge } from '../components/common/StatusBadge';

interface ProjectsPageProps {
  onNavigate: (page: string, id?: number) => void;
  onOpenNewProject: () => void;
}

export const ProjectsPage: React.FC<ProjectsPageProps> = ({ onNavigate, onOpenNewProject }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    fetchProjects();
  }, [selectedStatus, selectedType]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchProjects();
  };

  return (
    <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-dark-900 p-4 sm:p-5 rounded-3xl border border-dark-750 shadow-xl">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-sabrar-950/70 border border-sabrar-500/40 flex items-center justify-center text-sabrar-400">
              <FolderKanban className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Projetos & Obras
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Centralize projetos técnicos, upload de memoriais descritivos, orçamentos e execução
          </p>
        </div>

        <button
          onClick={onOpenNewProject}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-sabrar-600 hover:bg-sabrar-500 text-white text-xs font-bold transition-all shadow-lg shadow-sabrar-600/30 active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Cadastrar Projeto</span>
        </button>
      </div>

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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {projects.map((p) => {
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
                    <StatusBadge status={p.status} size="sm" />
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
                    <div className="flex items-center gap-1.5">
                      <HardHat className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span>{p.responsible_engineer || 'Eng. Rafael Santos'}</span>
                    </div>
                  </div>
                </div>

                {/* Bottom Card Info */}
                <div className="mt-4 pt-3 border-t border-dark-750 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold uppercase">Orçamento Final</span>
                    <span className="font-black text-white text-sm">
                      {hasBudget
                        ? `R$ ${p.budget.total_final.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                        : 'Aguardando'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 text-sabrar-400 font-bold group-hover:translate-x-1 transition-transform">
                    <span>Abrir</span>
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
