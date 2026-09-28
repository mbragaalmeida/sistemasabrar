import React, { useState, useEffect } from 'react';
import {
  FolderKanban,
  Calculator,
  HardHat,
  Package,
  ShoppingCart,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  Plus,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
  Clock,
  CheckCircle,
  Truck,
  Building2,
  BarChart3,
  PieChart,
  ArrowRight,
  CheckCircle2
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { StatusBadge } from '../components/common/StatusBadge';
import { BulkImportModal } from '../components/modals/BulkImportModal';

interface DashboardPageProps {
  onNavigate: (page: string, id?: number) => void;
  onOpenNewProject: () => void;
  onOpenQuickEntry: () => void;
  onOpenNewRequest: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onNavigate,
  onOpenNewProject,
  onOpenQuickEntry,
  onOpenNewRequest
}) => {
  const { currentUser, activeRole } = useAuth();
  const [activeTab, setActiveTab] = useState<'geral' | 'orcamento' | 'almoxarifado' | 'compras'>('geral');
  const [overview, setOverview] = useState<any>(null);
  const [orcamentoData, setOrcamentoData] = useState<any>(null);
  const [almoxData, setAlmoxData] = useState<any>(null);
  const [comprasData, setComprasData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);

  // Seleciona aba inicial com base no perfil ativo
  useEffect(() => {
    if (activeRole === 'orcamento') setActiveTab('orcamento');
    else if (activeRole === 'almoxarifado') setActiveTab('almoxarifado');
    else if (activeRole === 'compras') setActiveTab('compras');
    else setActiveTab('geral');
  }, [activeRole]);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'geral') {
        const data = await api.getDashboardOverview();
        setOverview(data);
      } else if (activeTab === 'orcamento') {
        const data = await api.getDashboardOrcamento();
        setOrcamentoData(data);
      } else if (activeTab === 'almoxarifado') {
        const data = await api.getDashboardAlmoxarifado();
        setAlmoxData(data);
      } else if (activeTab === 'compras') {
        const data = await api.getDashboardCompras();
        setComprasData(data);
      }
    } catch (err) {
      console.error('Erro ao carregar dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Welcome & Quick Actions Bar com estética escura e verde Sabrar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-dark-900 p-4 sm:p-5 rounded-3xl border border-dark-750 shadow-xl">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Olá, {currentUser?.name?.split(' ')[0] || 'Usuário'}
            </h1>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-sabrar-950/80 text-sabrar-300 border border-sabrar-500/40">
              {currentUser?.role_label}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Painel operacional e inteligência de obras da SABRAR
          </p>
        </div>

        {/* Quick Action Buttons baseados no perfil */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          {['admin', 'orcamento', 'engenharia'].includes(activeRole) && (
            <button
              onClick={onOpenNewProject}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-sabrar-600 hover:bg-sabrar-500 text-white text-xs font-bold transition-all shadow-md shadow-sabrar-600/30 active:scale-95 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Nova Obra</span>
            </button>
          )}

          {['admin', 'engenharia'].includes(activeRole) && (
            <button
              onClick={onOpenNewRequest}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-dark-800 hover:bg-dark-750 text-slate-200 border border-dark-700 text-xs font-bold transition-all active:scale-95 whitespace-nowrap"
            >
              <HardHat className="w-4 h-4 text-sabrar-400" />
              <span>Solicitar Material</span>
            </button>
          )}

          {['admin', 'almoxarifado', 'compras'].includes(activeRole) && (
            <button
              onClick={onOpenQuickEntry}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-dark-800 hover:bg-dark-750 text-slate-200 border border-dark-700 text-xs font-bold transition-all active:scale-95 whitespace-nowrap"
            >
              <Package className="w-4 h-4 text-sabrar-400" />
              <span>Entrada Estoque</span>
            </button>
          )}
        </div>
      </div>

      {/* Dashboard Sub-Views Tabs (filtrado por perfil para foco e objetividade) */}
      {(() => {
        const availableTabs = [
          { id: 'geral', label: 'Visão Geral Obras', roles: ['admin', 'engenharia'] },
          { id: 'orcamento', label: 'Setor de Orçamento', roles: ['admin', 'orcamento'] },
          { id: 'almoxarifado', label: 'Almoxarifado & Estoque', roles: ['admin', 'almoxarifado'] },
          { id: 'compras', label: 'Compras & Demandas', roles: ['admin', 'compras'] }
        ].filter(tab => tab.roles.includes(activeRole));

        if (availableTabs.length <= 1) {
          return null; // Não polui a tela com abas se só há 1 visão para o perfil
        }

        return (
          <div className="flex items-center gap-1.5 bg-dark-900 p-1.5 rounded-2xl border border-dark-750 overflow-x-auto text-xs font-bold text-slate-400">
            {availableTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2 rounded-xl transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-sabrar-600 text-white shadow-md shadow-sabrar-600/30 font-bold'
                    : 'hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        );
      })()}

      {loading && (
        <div className="py-20 text-center text-sm text-slate-500">
          Carregando indicadores operacionais...
        </div>
      )}

      {/* TAB 1: VISÃO GERAL */}
      {!loading && activeTab === 'geral' && overview && (
        <div className="space-y-5 sm:space-y-7 animate-in fade-in">
          {/* SECTION A: CARDS FINANCEIROS DE ALTO NÍVEL (DADOS REAIS SABRAR) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-sabrar-400" />
                <span className="text-xs font-black uppercase tracking-wider text-slate-300">
                  Consolidado Financeiro de Obras & Materiais (Dados Reais)
                </span>
              </div>
              <span className="text-[11px] font-bold text-sabrar-400 bg-sabrar-950 px-2.5 py-0.5 rounded-full border border-sabrar-500/30">
                Acurácia: {overview.cards.totalGrossMarginPercent > 0 ? `${overview.cards.totalGrossMarginPercent}% margem média` : 'Calculada'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {/* Card 1: Receita Real de Obras (Obras Iniciadas) */}
              <div className="bg-dark-900 p-4 rounded-3xl border border-dark-750 shadow-md hover:border-sabrar-500/40 transition-all">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">Receita Real (Obras Iniciadas)</span>
                  <div className="p-2 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 dark:bg-sabrar-950/80 dark:border-sabrar-500/40 dark:text-sabrar-400 shadow-inner">
                    <DollarSign className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-white">
                  R$ {Number(overview.cards.totalRevenue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                </div>
                <div className="text-xs text-emerald-700 dark:text-sabrar-400 font-semibold mt-1 flex items-center gap-1">
                  <span>{overview.cards.totalStartedProjects || overview.charts.projectsComparison?.length || 0} obras iniciadas / em execução</span>
                </div>
              </div>

              {/* Card 2: Materiais Solicitados */}
              <div className="bg-dark-900 p-4 rounded-3xl border border-dark-750 shadow-md hover:border-cyan-500/40 transition-all">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">Materiais Solicitados</span>
                  <div className="p-2 rounded-2xl bg-cyan-50 border border-cyan-200 text-cyan-700 dark:bg-cyan-950/60 dark:border-cyan-800 dark:text-cyan-400 shadow-inner">
                    <Calculator className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-white">
                  R$ {Number(overview.cards.totalRequestedMaterials || overview.cards.totalBudgetMaterials || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                </div>
                <div className="text-xs text-cyan-700 dark:text-cyan-400 font-semibold mt-1">
                  Materiais já requisitados para as obras
                </div>
              </div>

              {/* Card 3: Custo Real (Obras Concluídas) */}
              <div className="bg-dark-900 p-4 rounded-3xl border border-dark-750 shadow-md hover:border-amber-500/40 transition-all">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">Custo Real (Concluídas)</span>
                  <div className="p-2 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 dark:bg-amber-950/60 dark:border-amber-800 dark:text-amber-400 shadow-inner">
                    <Package className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-white">
                  R$ {Number(overview.cards.totalActualMaterialsCost || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                </div>
                <div className="text-xs text-amber-700 dark:text-amber-400 font-semibold mt-1">
                  Apuração final pós-devoluções ({overview.cards.totalCompletedProjects || 0} concluídas)
                </div>
              </div>

              {/* Card 4: Margem Bruta (Obras Concluídas) */}
              <div className="bg-dark-900 p-4 rounded-3xl border border-dark-750 shadow-md hover:border-emerald-500/40 transition-all">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">Margem Bruta (Concluídas)</span>
                  <div className="p-2 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 dark:bg-emerald-950/60 dark:border-emerald-800 dark:text-emerald-400 shadow-inner">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400">
                  R$ {Number(overview.cards.totalGrossMargin || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                </div>
                <div className="text-xs text-emerald-700 dark:text-emerald-400/90 font-bold mt-1 flex items-center gap-1.5">
                  <span className="bg-emerald-100 border border-emerald-300 text-emerald-800 dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-300 px-1.5 py-0.2 rounded text-[10px]">
                    {overview.cards.totalGrossMarginPercent}% de margem
                  </span>
                  <span>Lucro consolidado apurado</span>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION B: CARDS OPERACIONAIS COMPLEMENTARES */}
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div
              onClick={() => onNavigate('projects')}
              className="bg-dark-900 p-3.5 rounded-2xl border border-dark-750 shadow-sm hover:border-sabrar-500/50 transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider">Obras em Execução</span>
                <HardHat className="w-3.5 h-3.5 text-sabrar-400 group-hover:scale-110 transition-transform" />
              </div>
              <div className="text-xl font-black text-white">{overview.cards.inExecution}</div>
              <div className="text-[10px] text-sabrar-400 font-semibold mt-0.5">{overview.cards.activeProjects} projetos ativos</div>
            </div>

            <div
              onClick={() => onNavigate('budgets')}
              className="bg-dark-900 p-3.5 rounded-2xl border border-dark-750 shadow-sm hover:border-amber-500/50 transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider">Em Orçamento</span>
                <Calculator className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition-transform" />
              </div>
              <div className="text-xl font-black text-white">{overview.cards.inBudgetProjects}</div>
              <div className="text-[10px] text-amber-400 font-semibold mt-0.5">{overview.cards.awaitingApproval} propostas enviadas</div>
            </div>

            <div
              onClick={() => onNavigate('requests')}
              className="bg-dark-900 p-3.5 rounded-2xl border border-dark-750 shadow-sm hover:border-purple-500/50 transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider">Solicitações</span>
                <Layers className="w-3.5 h-3.5 text-purple-400 group-hover:scale-110 transition-transform" />
              </div>
              <div className="text-xl font-black text-white">{overview.cards.pendingRequests}</div>
              <div className="text-[10px] text-purple-400 font-semibold mt-0.5">Separação / entrega</div>
            </div>

            <div
              onClick={() => onNavigate('stock')}
              className="bg-dark-900 p-3.5 rounded-2xl border border-dark-750 shadow-sm hover:border-rose-500/50 transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider">Estoque Mínimo</span>
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400 group-hover:scale-110 transition-transform" />
              </div>
              <div className="text-xl font-black text-white">{overview.cards.belowMinStock}</div>
              <div className="text-[10px] text-rose-400 font-semibold mt-0.5">Valuation: R$ {overview.cards.stockValuation?.toLocaleString('pt-BR')}</div>
            </div>
          </div>

          {/* SECTION C: GRÁFICO PRINCIPAL DE RECEITA COM OBRAS X CUSTO DE MATERIAIS */}
          <div className="bg-dark-900 p-5 sm:p-6 rounded-3xl border border-dark-750 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-dark-750 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-sabrar-400" />
                  <h3 className="text-base font-black text-white">Receita com Obras × Custo de Materiais (Dados Reais)</h3>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Apenas obras iniciadas: Receita Real, Materiais Solicitados e Custo Real Apurado (obras concluídas com devoluções)
                </p>
              </div>

              {/* Legenda do Gráfico */}
              <div className="flex items-center gap-3 text-xs self-start sm:self-center bg-dark-850 px-3 py-1.5 rounded-2xl border border-dark-700">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-sabrar-500" />
                  <span className="text-slate-300 font-semibold">Receita Real</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-cyan-500" />
                  <span className="text-slate-300 font-semibold">Materiais Solicitados</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-amber-500" />
                  <span className="text-slate-300 font-semibold">Custo Real (Concluídas)</span>
                </div>
              </div>
            </div>

            {/* Barras Comparativas por Obra */}
            <div className="space-y-4 pt-1">
              {(overview.charts.projectsComparison || []).map((p: any) => {
                const reqCost = Number(p.requestedMaterialsCost ?? p.budgetMaterials ?? 0);
                const actCost = Number(p.actualMaterialsCost ?? 0);
                const maxVal = Math.max(
                  ...((overview.charts.projectsComparison || []).map((x: any) =>
                    Math.max(Number(x.revenue || 0), Number(x.requestedMaterialsCost ?? x.budgetMaterials ?? 0), Number(x.actualMaterialsCost ?? 0))
                  )),
                  1000
                );
                const wRevenue = Math.max(2, Math.min(100, (p.revenue / maxVal) * 100));
                const wBudget = Math.max(2, Math.min(100, (reqCost / maxVal) * 100));
                const wActual = p.isCompleted ? Math.max(2, Math.min(100, (actCost / maxVal) * 100)) : 0;

                const isHealthyMargin = p.marginPercent >= 35;
                const isModerateMargin = p.marginPercent >= 20 && p.marginPercent < 35;

                return (
                  <div
                    key={p.id}
                    onClick={() => onNavigate('project-detail', p.id)}
                    className="p-3.5 rounded-2xl bg-dark-850/60 hover:bg-dark-850 border border-dark-750 transition-all cursor-pointer space-y-2 group"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-sabrar-400 font-bold bg-sabrar-950 px-2 py-0.5 rounded border border-sabrar-500/30">
                          {p.code}
                        </span>
                        <span className="font-extrabold text-sm text-white group-hover:text-sabrar-300 transition-colors">
                          {p.name}
                        </span>
                        <span className="text-[11px] text-slate-400 hidden md:inline">({p.client})</span>
                        <span className="text-[10px] text-slate-400 bg-dark-800 px-2 py-0.5 rounded-full border border-dark-700">
                          {p.projectType}
                        </span>
                      </div>

                      {/* Badges de Rentabilidade da Obra */}
                      <div className="flex items-center gap-2 self-start sm:self-center">
                        {p.isCompleted ? (
                          <>
                            <span
                              className={`text-[11px] font-black px-2 py-0.5 rounded-md border ${
                                isHealthyMargin
                                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700'
                                  : isModerateMargin
                                  ? 'bg-cyan-950/80 text-cyan-300 border-cyan-700'
                                  : 'bg-amber-950/80 text-amber-300 border-amber-700'
                              }`}
                            >
                              Margem: R$ {Number(p.margin || 0).toLocaleString('pt-BR')} ({p.marginPercent}%)
                            </span>
                            {p.variancePercent !== 0 && (
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                                  p.variancePercent > 0
                                    ? 'bg-rose-950/80 text-rose-300 border-rose-800'
                                    : 'bg-sabrar-950/80 text-sabrar-300 border-sabrar-500/40'
                                }`}
                                title="Variação entre Materiais Solicitados e Custo Real de Materiais"
                              >
                                Desvio: {p.variancePercent > 0 ? `+${p.variancePercent}%` : `${p.variancePercent}%`}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-md border bg-amber-950/60 text-amber-300 border-amber-800/80 flex items-center gap-1.5">
                            <Clock className="w-3 h-3 text-amber-400 animate-pulse" />
                            <span>Em Execução • Custo real apurado na conclusão</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Barras Triplas Proporcionais */}
                    <div className="space-y-1 pt-1">
                      {/* Barra 1: Receita Real */}
                      <div className="flex items-center gap-2 text-[11px]">
                        <span className="w-24 text-slate-400 font-semibold shrink-0">Receita Real</span>
                        <div className="flex-1 h-3 rounded-full bg-dark-900 overflow-hidden">
                          <div
                            style={{ width: `${wRevenue}%` }}
                            className="h-full bg-sabrar-500 rounded-full transition-all"
                          />
                        </div>
                        <span className="w-28 text-right font-black text-white font-mono">
                          R$ {Number(p.revenue || 0).toLocaleString('pt-BR')}
                        </span>
                      </div>

                      {/* Barra 2: Materiais Solicitados */}
                      <div className="flex items-center gap-2 text-[11px]">
                        <span className="w-24 text-slate-400 font-semibold shrink-0">Solicitados</span>
                        <div className="flex-1 h-2.5 rounded-full bg-dark-900 overflow-hidden">
                          <div
                            style={{ width: `${wBudget}%` }}
                            className="h-full bg-cyan-500 rounded-full transition-all"
                          />
                        </div>
                        <span className="w-28 text-right font-bold text-cyan-300 font-mono">
                          R$ {Number(reqCost).toLocaleString('pt-BR')}
                        </span>
                      </div>

                      {/* Barra 3: Custo Real Consumido (Apenas se finalizado) */}
                      <div className="flex items-center gap-2 text-[11px]">
                        <span className="w-24 text-slate-400 font-semibold shrink-0">Custo Real</span>
                        {p.isCompleted ? (
                          <>
                            <div className="flex-1 h-2.5 rounded-full bg-dark-900 overflow-hidden">
                              <div
                                style={{ width: `${wActual}%` }}
                                className="h-full bg-amber-500 rounded-full transition-all"
                              />
                            </div>
                            <span className="w-28 text-right font-bold text-amber-300 font-mono">
                              R$ {Number(p.actualMaterialsCost || 0).toLocaleString('pt-BR')}
                            </span>
                          </>
                        ) : (
                          <>
                            <div className="flex-1 h-2.5 rounded-full bg-dark-900/60 border border-dashed border-dark-700 flex items-center px-2">
                              <span className="text-[10px] text-slate-500 font-medium italic">
                                Aguardando conclusão da obra (devoluções pendentes)
                              </span>
                            </div>
                            <span className="w-28 text-right font-semibold text-amber-400/70 text-[10px]">
                              Em andamento
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SECTION D: TABELA ANALÍTICA EXECUTIVA OBRA POR OBRA */}
          <div className="bg-dark-900 rounded-3xl border border-dark-750 overflow-hidden shadow-xl">
            <div className="p-4 sm:p-5 bg-dark-850 border-b border-dark-750 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-white">Detalhamento Analítico por Obra</h3>
                <p className="text-[11px] text-slate-400">Materiais solicitados vs custos reais apurados pós-conclusão</p>
              </div>
              <button
                onClick={() => onNavigate('projects')}
                className="text-xs font-bold text-sabrar-400 hover:text-sabrar-300 flex items-center gap-1"
              >
                <span>Ver todas as obras</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-dark-850/80 text-slate-400 font-bold border-b border-dark-700">
                  <tr>
                    <th className="p-3">Obra / Código</th>
                    <th className="p-3">Cliente</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-right">Receita Real</th>
                    <th className="p-3 text-right">Materiais Solicitados</th>
                    <th className="p-3 text-right">Custo Real Materiais</th>
                    <th className="p-3 text-right">Margem Bruta</th>
                    <th className="p-3 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-750">
                  {(overview.charts.projectsComparison || []).map((p: any) => {
                    const reqCost = Number(p.requestedMaterialsCost ?? p.budgetMaterials ?? 0);
                    return (
                      <tr key={p.id} className="hover:bg-dark-850/60 transition-colors">
                        <td className="p-3 font-semibold text-white">
                          <div className="font-bold">{p.name}</div>
                          <div className="text-[10px] text-slate-400">{p.code} • {p.projectType}</div>
                        </td>
                        <td className="p-3 text-slate-300 font-medium">{p.client}</td>
                        <td className="p-3 text-center">
                          <StatusBadge status={p.status} size="sm" />
                        </td>
                        <td className="p-3 text-right font-black text-white font-mono">
                          R$ {Number(p.revenue || 0).toLocaleString('pt-BR')}
                        </td>
                        <td className="p-3 text-right font-bold text-cyan-300 font-mono">
                          R$ {Number(reqCost).toLocaleString('pt-BR')}
                        </td>
                        <td className="p-3 text-right font-mono">
                          {p.isCompleted ? (
                            <span className="font-bold text-amber-300">
                              R$ {Number(p.actualMaterialsCost || 0).toLocaleString('pt-BR')}
                            </span>
                          ) : (
                            <span className="text-amber-400/90 text-[11px] font-semibold flex items-center justify-end gap-1">
                              <Clock className="w-3 h-3 text-amber-400" />
                              <span>Em andamento</span>
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-right font-mono">
                          {p.isCompleted ? (
                            <span className={`font-black ${p.marginPercent >= 35 ? 'text-emerald-400' : 'text-cyan-400'}`}>
                              R$ {Number(p.margin || 0).toLocaleString('pt-BR')} ({p.marginPercent}%)
                            </span>
                          ) : (
                            <span className="text-slate-500 text-[11px] italic">
                              Apuração na conclusão
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => onNavigate('project-detail', p.id)}
                            className="px-2.5 py-1 rounded-xl bg-dark-800 hover:bg-dark-750 text-sabrar-300 border border-sabrar-500/30 text-[11px] font-bold transition-all"
                          >
                            Ver Obra
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* SECTION E: CATEGORIAS REAIS DE HVAC & FLUXO DE CONSUMO VS COMPRAS */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {/* Previsto x Realizado por Categoria Real de HVAC */}
            <div className="bg-dark-900 p-4 sm:p-5 rounded-3xl border border-dark-750 shadow-md">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-extrabold text-white">Previsto × Realizado por Categoria HVAC</h3>
                  <p className="text-[11px] text-slate-400">Distribuição real de materiais da engenharia SABRAR</p>
                </div>
                <button
                  onClick={() => onNavigate('ai-hub')}
                  className="flex items-center gap-1 text-xs font-bold text-sabrar-400 hover:text-sabrar-300"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Ver IA Hub
                </button>
              </div>

              <div className="space-y-3">
                {overview.charts.plannedVsActual.map((item: any) => {
                  const diff = item.realizado - item.previsto;
                  const diffPct = item.previsto > 0 ? Math.round((diff / item.previsto) * 100) : 0;
                  const isAbove = diff > 0;
                  return (
                    <div key={item.category} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-200">{item.category}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 font-mono text-[11px]">
                            R$ {item.realizado.toLocaleString('pt-BR')} / R$ {item.previsto.toLocaleString('pt-BR')}
                          </span>
                          <span
                            className={`font-extrabold text-[10px] px-1.5 py-0.5 rounded border ${
                              isAbove
                                ? 'bg-rose-950/60 text-rose-400 border-rose-800'
                                : 'bg-sabrar-950/60 text-sabrar-400 border-sabrar-500/40'
                            }`}
                          >
                            {isAbove ? `+${diffPct}%` : `${diffPct}%`}
                          </span>
                        </div>
                      </div>
                      <div className="w-full h-2.5 rounded-full bg-dark-850 overflow-hidden flex border border-dark-700">
                        <div
                          style={{ width: `${Math.min(100, item.previsto > 0 ? (item.realizado / item.previsto) * 100 : 50)}%` }}
                          className={`h-full rounded-full transition-all ${
                            isAbove ? 'bg-amber-500' : 'bg-sabrar-500'
                          }`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Consumo Mensal e Compras por Período */}
            <div className="bg-dark-900 p-4 sm:p-5 rounded-3xl border border-dark-750 shadow-md flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-extrabold text-white">Consumo em Obras vs Compras (Últimos Meses)</h3>
                    <p className="text-[11px] text-slate-400">Fluxo operacional financeiro consolidado</p>
                  </div>
                  <span className="text-[10px] font-bold text-sabrar-400 bg-sabrar-950 border border-sabrar-500/40 px-2 py-0.5 rounded-full">
                    Estável
                  </span>
                </div>

                <div className="grid grid-cols-6 gap-2 text-center pt-4">
                  {overview.charts.monthlyConsumption.map((c: any, idx: number) => {
                    const p = overview.charts.monthlyPurchases[idx];
                    const max = Math.max(
                      ...overview.charts.monthlyConsumption.map((x: any) => x.value),
                      ...overview.charts.monthlyPurchases.map((x: any) => x.value),
                      1000
                    );
                    const cHeight = Math.round((c.value / max) * 100);
                    const pHeight = Math.round((p.value / max) * 100);
                    return (
                      <div key={c.month} className="flex flex-col items-center gap-1">
                        <div className="h-32 flex items-end gap-1.5 w-full justify-center">
                          <div
                            style={{ height: `${Math.max(8, cHeight)}%` }}
                            className="w-2.5 sm:w-3.5 bg-sabrar-500 rounded-t-sm"
                            title={`Consumo em Obras: R$ ${c.value.toLocaleString('pt-BR')}`}
                          />
                          <div
                            style={{ height: `${Math.max(8, pHeight)}%` }}
                            className="w-2.5 sm:w-3.5 bg-purple-500 rounded-t-sm"
                            title={`Compras: R$ ${p.value.toLocaleString('pt-BR')}`}
                          />
                        </div>
                        <span className="text-[11px] font-bold text-slate-400">{c.month}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-center gap-6 pt-4 border-t border-dark-750 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-sabrar-500" />
                  <span className="text-slate-300">Consumo em Obras</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-purple-500" />
                  <span className="text-slate-300">Compras de Materiais</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DASHBOARD DO ORÇAMENTO */}
      {!loading && activeTab === 'orcamento' && orcamentoData && (
        <div className="space-y-4 animate-in fade-in">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            <div className="p-3 bg-dark-900 rounded-2xl border border-dark-750">
              <div className="text-[10px] font-bold text-slate-400 uppercase">Novos Projetos</div>
              <div className="text-2xl font-black text-white">{orcamentoData.metrics.newProjects}</div>
            </div>
            <div className="p-3 bg-dark-900 rounded-2xl border border-dark-750">
              <div className="text-[10px] font-bold text-purple-400 uppercase">Analisados IA</div>
              <div className="text-2xl font-black text-purple-300">{orcamentoData.metrics.aiAnalyzed}</div>
            </div>
            <div className="p-3 bg-dark-900 rounded-2xl border border-dark-750">
              <div className="text-[10px] font-bold text-amber-400 uppercase">Aguardando Revisão</div>
              <div className="text-2xl font-black text-amber-300">{orcamentoData.metrics.awaitingRevision}</div>
            </div>
            <div className="p-3 bg-dark-900 rounded-2xl border border-dark-750">
              <div className="text-[10px] font-bold text-cyan-400 uppercase">Finalizados</div>
              <div className="text-2xl font-black text-cyan-300">{orcamentoData.metrics.finalized}</div>
            </div>
            <div className="p-3 bg-dark-900 rounded-2xl border border-dark-750">
              <div className="text-[10px] font-bold text-teal-400 uppercase">Enviados Cliente</div>
              <div className="text-2xl font-black text-teal-300">{orcamentoData.metrics.sentToClient}</div>
            </div>
            <div className="p-3 bg-dark-900 rounded-2xl border border-dark-750">
              <div className="text-[10px] font-bold text-sabrar-400 uppercase">Aprovados</div>
              <div className="text-2xl font-black text-sabrar-300">{orcamentoData.metrics.approved}</div>
            </div>
          </div>

          <div className="bg-dark-900 rounded-3xl border border-dark-750 overflow-hidden shadow-md p-4">
            <h3 className="text-sm font-extrabold text-white mb-3">Fila Recente de Orçamentos</h3>
            <div className="divide-y divide-dark-750">
              {orcamentoData.recentProjects.map((p: any) => (
                <div
                  key={p.id}
                  onClick={() => onNavigate('project-detail', p.id)}
                  className="py-3 flex items-center justify-between hover:bg-dark-850 rounded-xl px-2 cursor-pointer transition-colors"
                >
                  <div>
                    <div className="font-bold text-xs sm:text-sm text-white">
                      {p.code} — {p.name}
                    </div>
                    <div className="text-xs text-slate-400">Cliente: {p.client}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={p.status} size="sm" />
                    <span className="font-extrabold text-xs text-white hidden sm:inline">
                      {p.total_budget_final ? `R$ ${p.total_budget_final.toLocaleString('pt-BR')}` : 'Sob análise'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: DASHBOARD DO ALMOXARIFADO */}
      {!loading && activeTab === 'almoxarifado' && almoxData && (
        <div className="space-y-4 animate-in fade-in">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            <div className="p-3 bg-dark-900 rounded-2xl border border-dark-750">
              <div className="text-[10px] font-bold text-blue-400 uppercase">Solicitados</div>
              <div className="text-2xl font-black text-white">{almoxData.metrics.pending}</div>
            </div>
            <div className="p-3 bg-dark-900 rounded-2xl border border-dark-750">
              <div className="text-[10px] font-bold text-amber-400 uppercase">Para Separar</div>
              <div className="text-2xl font-black text-amber-300">{almoxData.metrics.toSeparate}</div>
            </div>
            <div className="p-3 bg-dark-900 rounded-2xl border border-dark-750">
              <div className="text-[10px] font-bold text-teal-400 uppercase">Separados</div>
              <div className="text-2xl font-black text-teal-300">{almoxData.metrics.separated}</div>
            </div>
            <div className="p-3 bg-dark-900 rounded-2xl border border-dark-750">
              <div className="text-[10px] font-bold text-sabrar-400 uppercase">Entregues</div>
              <div className="text-2xl font-black text-sabrar-300">{almoxData.metrics.delivered}</div>
            </div>
            <div className="p-3 bg-dark-900 rounded-2xl border border-dark-750">
              <div className="text-[10px] font-bold text-purple-400 uppercase">Devoluções</div>
              <div className="text-2xl font-black text-purple-300">{almoxData.metrics.recentReturns}</div>
            </div>
            <div className="p-3 bg-dark-900 rounded-2xl border border-dark-750">
              <div className="text-[10px] font-bold text-rose-400 uppercase">Estoque Baixo</div>
              <div className="text-2xl font-black text-rose-300">{almoxData.metrics.lowStock}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Solicitações para Separação */}
            <div className="bg-dark-900 p-4 rounded-3xl border border-dark-750 shadow-md">
              <h3 className="text-sm font-extrabold text-white mb-3 flex items-center justify-between">
                <span>Fila de Separação de Materiais</span>
                <button
                  onClick={() => onNavigate('requests')}
                  className="text-xs text-sabrar-400 font-bold hover:underline"
                >
                  Ver todas
                </button>
              </h3>
              <div className="space-y-2">
                {almoxData.activeRequests.map((r: any) => (
                  <div key={r.id} className="p-3 rounded-2xl border border-dark-700 bg-dark-850 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-xs text-white">{r.code} • {r.project_name}</div>
                      <div className="text-[11px] text-slate-400">Solicitante: {r.requested_by_name}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={r.priority} size="sm" />
                      <StatusBadge status={r.status} size="sm" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Materiais com Estoque Baixo */}
            <div className="bg-dark-900 p-4 rounded-3xl border border-dark-750 shadow-md">
              <h3 className="text-sm font-extrabold text-white mb-3 flex items-center justify-between">
                <span>Materiais em Nível Crítico / Baixo</span>
                <button
                  onClick={onOpenQuickEntry}
                  className="text-xs text-sabrar-400 font-bold hover:underline"
                >
                  + Entrada Rápida
                </button>
              </h3>
              <div className="space-y-2">
                {almoxData.lowStockItems.map((m: any) => (
                  <div key={m.id} className="p-3 rounded-2xl border border-rose-950/60 bg-rose-950/30 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-white">{m.code} — {m.name}</div>
                      <div className="text-[11px] text-rose-400">Mínimo cadastrado: {m.stock_minimum} {m.unit}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-black text-rose-300 text-sm">{m.stock_physical} {m.unit}</div>
                      <div className="text-[10px] text-slate-400">Reservado: {m.stock_reserved}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: DASHBOARD DE COMPRAS */}
      {!loading && activeTab === 'compras' && comprasData && (
        <div className="space-y-4 animate-in fade-in">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            <div className="p-3 bg-dark-900 rounded-2xl border border-dark-750">
              <div className="text-[10px] font-bold text-blue-400 uppercase">Novas Demandas</div>
              <div className="text-2xl font-black text-white">{comprasData.metrics.newDemands}</div>
            </div>
            <div className="p-3 bg-dark-900 rounded-2xl border border-dark-750">
              <div className="text-[10px] font-bold text-rose-400 uppercase">Sem Estoque</div>
              <div className="text-2xl font-black text-rose-300">{comprasData.metrics.zeroStock}</div>
            </div>
            <div className="p-3 bg-dark-900 rounded-2xl border border-dark-750">
              <div className="text-[10px] font-bold text-amber-400 uppercase">Em Cotação</div>
              <div className="text-2xl font-black text-amber-300">{comprasData.metrics.inQuotation}</div>
            </div>
            <div className="p-3 bg-dark-900 rounded-2xl border border-dark-750">
              <div className="text-[10px] font-bold text-sabrar-400 uppercase">Comprados</div>
              <div className="text-2xl font-black text-sabrar-300">{comprasData.metrics.purchased}</div>
            </div>
            <div className="p-3 bg-dark-900 rounded-2xl border border-dark-750">
              <div className="text-[10px] font-bold text-orange-400 uppercase">Aguardando Entrega</div>
              <div className="text-2xl font-black text-orange-300">{comprasData.metrics.awaitingDelivery}</div>
            </div>
            <div className="p-3 bg-dark-900 rounded-2xl border border-dark-750">
              <div className="text-[10px] font-bold text-rose-400 uppercase">Atrasadas</div>
              <div className="text-2xl font-black text-rose-300">{comprasData.metrics.delayedDeliveries}</div>
            </div>
          </div>

          <div className="bg-dark-900 rounded-3xl border border-dark-750 overflow-hidden shadow-md p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-extrabold text-white">Demandas Geradas por Déficit & Compras</h3>
              <button onClick={() => onNavigate('purchases')} className="text-xs text-sabrar-400 font-bold hover:underline">
                Ver fila completa
              </button>
            </div>
            <div className="divide-y divide-dark-750">
              {comprasData.urgentDemands.map((pur: any) => (
                <div key={pur.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="font-bold text-xs sm:text-sm text-white">
                      {pur.code} — {pur.material_name} ({pur.quantity} {pur.material_unit})
                    </div>
                    <div className="text-xs text-slate-400">
                      Obra: {pur.project_name || 'Demanda Geral'} • Fornecedor: {pur.supplier_name || 'A definir'}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 self-end sm:self-center">
                    <StatusBadge status={pur.priority || 'Média'} size="sm" />
                    <StatusBadge status={pur.status} size="sm" />
                    <button
                      onClick={() => onNavigate('purchases')}
                      className="text-xs font-bold text-sabrar-400 hover:text-sabrar-300 underline"
                    >
                      Cotar / Gerenciar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Carga em Massa de Obras & Histórico Real */}
      <BulkImportModal
        isOpen={isBulkImportOpen}
        onClose={() => setIsBulkImportOpen(false)}
        onSuccess={loadData}
      />
    </div>
  );
};
