import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  AlertTriangle,
  Clock,
  Package,
  DollarSign,
  ShoppingCart,
  CheckCircle2,
  Calendar,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Eye,
  Camera,
  Layers,
  Building,
  RefreshCw
} from 'lucide-react';
import { api } from '../services/api';

interface PurchasesStockDashboardPageProps {
  onNavigate: (page: string, id?: number) => void;
  onOpenNewPurchase?: () => void;
}

export const PurchasesStockDashboardPage: React.FC<PurchasesStockDashboardPageProps> = ({
  onNavigate,
  onOpenNewPurchase
}) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);

  // Filtros de topo
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [period, setPeriod] = useState('30');

  useEffect(() => {
    loadProjects();
    loadDashboard();
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [selectedProject, selectedCategory, period]);

  const loadProjects = async () => {
    try {
      const projs = await api.getProjects();
      setProjects(projs || []);
    } catch (err) {
      console.error(err);
    }
  };

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const res = await api.getPurchasesStockBIDashboard({
        projectId: selectedProject,
        category: selectedCategory
      });
      setData(res);
    } catch (err: any) {
      console.error('Erro ao carregar BI:', err);
    } finally {
      setLoading(false);
    }
  };

  const kpis = data?.kpis || {};
  const charts = data?.charts || {};
  const tables = data?.tables || {};

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 text-slate-800 dark:text-slate-100">
      
      {/* Cabeçalho do BI Executivo */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-600 text-white rounded-xl shadow-md">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                Dashboard Executivo de Compras & Estoque (BI)
              </h1>
              <span className="px-2.5 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 text-xs font-bold rounded-full">
                Métricas em Tempo Real
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Inteligência de suprimentos, prazos de entrega, faturamento e auditoria de estoque.
            </p>
          </div>
        </div>

        {/* Barra de Filtros */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Obra */}
          <select
            value={selectedProject}
            onChange={e => setSelectedProject(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-medium"
          >
            <option value="">Todas as Obras</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>
                {p.code} - {p.name}
              </option>
            ))}
          </select>

          {/* Categoria */}
          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-medium"
          >
            <option value="">Todas Categorias</option>
            <option value="Dutos">Dutos & Chapas</option>
            <option value="Tubulação de Cobre">Tubulação de Cobre</option>
            <option value="Cabos">Cabos & Elétrica</option>
            <option value="Isolamento">Isolamento</option>
            <option value="Gases">Fluidos & Gases</option>
          </select>

          {/* Período */}
          <select
            value={period}
            onChange={e => setPeriod(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-medium"
          >
            <option value="30">Últimos 30 dias</option>
            <option value="60">Últimos 60 dias</option>
            <option value="90">Últimos 90 dias</option>
            <option value="365">Este ano (2026)</option>
          </select>

          <button
            onClick={loadDashboard}
            className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-600 dark:text-slate-300 transition-colors"
            title="Atualizar dados"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 5 Top KPI Cards (Print 5) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        
        {/* KPI 1: Pedidos de Compra */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Pedidos de Compra</span>
            <ShoppingCart className="w-4 h-4 text-blue-500" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 dark:text-white">
              {kpis.totalOrders || 0}
            </div>
            <div className="flex items-center gap-2 mt-2 text-[10px]">
              <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 rounded font-semibold">
                {kpis.pendingOrders || 0} pend.
              </span>
              <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 rounded font-semibold">
                {kpis.inProgressOrders || 0} em and.
              </span>
              <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 rounded font-semibold">
                {kpis.completedOrders || 0} concl.
              </span>
            </div>
          </div>
        </div>

        {/* KPI 2: Compras no Período */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Compras no Período</span>
            <DollarSign className="w-4 h-4 text-emerald-500" />
          </div>
          <div>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              R$ {Number(kpis.totalPurchasesAmount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-2">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>+{kpis.growthVsPreviousPercent || 12}% vs período ant.</span>
            </div>
          </div>
        </div>

        {/* KPI 3: Estoque Baixo */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Estoque Baixo</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div>
            <div className="text-2xl font-black text-rose-600 dark:text-rose-400">
              {kpis.lowStockCount || 0} <span className="text-xs font-normal text-slate-500">itens</span>
            </div>
            <div className="text-[11px] text-rose-600 dark:text-rose-400 font-medium mt-2">
              Abaixo do estoque mínimo
            </div>
          </div>
        </div>

        {/* KPI 4: Prazos em Risco */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Prazos em Risco</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div>
            <div className="text-2xl font-black text-amber-600 dark:text-amber-400">
              {kpis.atRiskCount || 0} <span className="text-xs font-normal text-slate-500">pedidos</span>
            </div>
            <div className="text-[11px] text-amber-600 dark:text-amber-400 font-medium mt-2">
              Atrasados ou entrega iminente
            </div>
          </div>
        </div>

        {/* KPI 5: Situação do Faturamento */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Taxa de Conclusão</span>
            <CheckCircle2 className="w-4 h-4 text-blue-500" />
          </div>
          <div>
            <div className="text-2xl font-black text-blue-600 dark:text-blue-400">
              {kpis.billingRate || 100}%
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden mt-2">
              <div
                className="bg-blue-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${kpis.billingRate || 100}%` }}
              />
            </div>
          </div>
        </div>

      </div>

      {/* Gráficos Principais (Print 5) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Gráfico 1: Compras por Período */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Volume de Compras por Período (R$)
              </h3>
              <p className="text-xs text-slate-500">Evolução mensal de suprimentos</p>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">
              2026
            </span>
          </div>

          <div className="flex-1 flex items-end justify-between gap-4 pt-8 pb-2 px-2 h-56 border-b border-slate-100 dark:border-slate-800">
            {(charts.purchasesByPeriod || []).map((p: any, idx: number) => {
              const maxVal = Math.max(...(charts.purchasesByPeriod || []).map((x: any) => x.amount), 350000);
              const heightPct = Math.max(15, Math.round((p.amount / maxVal) * 100));

              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-2 group">
                  <span className="text-[10px] font-bold text-slate-500 group-hover:text-blue-600 transition-colors">
                    R$ {(p.amount / 1000).toFixed(0)}k
                  </span>
                  <div className="w-full max-w-[48px] bg-slate-100 dark:bg-slate-800 rounded-t-lg h-40 flex items-end overflow-hidden">
                    <div
                      className="w-full bg-blue-600 hover:bg-blue-500 rounded-t-lg transition-all duration-500"
                      style={{ height: `${heightPct}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {p.period}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Gráfico 2: Compras por Obra (Donut / Barra de Proporção) */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Distribuição de Compras por Obra
              </h3>
              <p className="text-xs text-slate-500">Participação percentual por centro de custo</p>
            </div>
            <Building className="w-4 h-4 text-slate-400" />
          </div>

          <div className="flex-1 space-y-3.5 pt-2">
            {(charts.purchasesByProject || []).map((pr: any, idx: number) => {
              const colors = ['bg-blue-600', 'bg-emerald-500', 'bg-amber-500', 'bg-purple-500', 'bg-pink-500', 'bg-slate-400'];
              const color = colors[idx % colors.length];

              return (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-xs">
                      {pr.name}
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      R$ {Number(pr.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ({pr.percent}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className={`${color} h-full rounded-full transition-all duration-500`}
                      style={{ width: `${pr.percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {(!charts.purchasesByProject || charts.purchasesByProject.length === 0) && (
              <div className="py-12 text-center text-slate-400 text-xs">
                Nenhum dado de compra por obra disponível para o período selecionado.
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Tabelas de Gestão de Risco e Auditoria (Print 5) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Tabela 1: Itens em Estoque Baixo (com foto e reposição rápida) */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
                <AlertTriangle className="w-4 h-4" />
                Estoque Crítico
              </h3>
              <p className="text-[11px] text-slate-500">Materiais abaixo do mínimo</p>
            </div>
            <button
              onClick={() => onNavigate('stock')}
              className="text-xs font-semibold text-blue-600 hover:underline"
            >
              Ver Estoque
            </button>
          </div>

          <div className="space-y-2.5 max-h-80 overflow-y-auto">
            {(tables.lowStockMaterials || []).map((m: any) => (
              <div
                key={m.id}
                className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 text-xs hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  {m.image_url ? (
                    <img
                      src={m.image_url}
                      alt={m.name}
                      className="w-9 h-9 object-cover rounded-lg border border-slate-200 dark:border-slate-700"
                    />
                  ) : (
                    <div className="w-9 h-9 bg-slate-200 dark:bg-slate-700 rounded-lg flex items-center justify-center text-slate-400">
                      <Camera className="w-4 h-4" />
                    </div>
                  )}
                  <div>
                    <div className="font-bold text-slate-900 dark:text-slate-100 line-clamp-1 max-w-[140px]">
                      {m.name}
                    </div>
                    <div className="text-[10px] text-slate-400">Cód: {m.code}</div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-black text-rose-600 dark:text-rose-400">
                    {m.stock_physical} {m.unit}
                  </div>
                  <div className="text-[10px] text-slate-400">Mín: {m.stock_minimum}</div>
                </div>
              </div>
            ))}

            {(!tables.lowStockMaterials || tables.lowStockMaterials.length === 0) && (
              <div className="py-8 text-center text-slate-400 text-xs">
                Nenhum item com estoque baixo no momento.
              </div>
            )}
          </div>
        </div>

        {/* Tabela 2: Pedidos com Prazos em Risco */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                <Clock className="w-4 h-4" />
                Prazos em Risco
              </h3>
              <p className="text-[11px] text-slate-500">Entregas atrasadas ou próximas</p>
            </div>
            <button
              onClick={() => onNavigate('purchases')}
              className="text-xs font-semibold text-blue-600 hover:underline"
            >
              Ver Compras
            </button>
          </div>

          <div className="space-y-2.5 max-h-80 overflow-y-auto">
            {(tables.atRiskOrders || []).map((o: any) => (
              <div
                key={o.id}
                className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 text-xs hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
              >
                <div>
                  <div className="font-bold text-slate-900 dark:text-slate-100">
                    {o.code || `PC-${o.id}`}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate max-w-[150px]">
                    {o.supplier}
                  </div>
                </div>

                <div className="text-right">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    o.riskStatus === 'Vencido'
                      ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                  }`}>
                    {o.riskStatus}
                  </span>
                  <div className="text-[10px] text-slate-400 mt-1">
                    {o.expected_delivery_date ? new Date(o.expected_delivery_date).toLocaleDateString('pt-BR') : '--'}
                  </div>
                </div>
              </div>
            ))}

            {(!tables.atRiskOrders || tables.atRiskOrders.length === 0) && (
              <div className="py-8 text-center text-slate-400 text-xs">
                Todas as entregas estão rigorosamente em dia.
              </div>
            )}
          </div>
        </div>

        {/* Tabela 3: Saídas de Materiais Recentes (Auditoria) */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                <Package className="w-4 h-4" />
                Saídas Recentes
              </h3>
              <p className="text-[11px] text-slate-500">Auditoria de movimentações</p>
            </div>
            <button
              onClick={() => onNavigate('stock')}
              className="text-xs font-semibold text-blue-600 hover:underline"
            >
              Auditar
            </button>
          </div>

          <div className="space-y-2.5 max-h-80 overflow-y-auto">
            {(tables.recentStockExits || []).map((e: any) => (
              <div
                key={e.id}
                className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 text-xs space-y-1 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 dark:text-slate-100 line-clamp-1 max-w-[150px]">
                    {e.material_name}
                  </span>
                  <span className="font-extrabold text-blue-600 dark:text-blue-400">
                    -{e.quantity} {e.material_unit}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span>Destino: {e.project_name || 'Almoxarifado'}</span>
                  <span>{new Date(e.created_at).toLocaleDateString('pt-BR')}</span>
                </div>
              </div>
            ))}

            {(!tables.recentStockExits || tables.recentStockExits.length === 0) && (
              <div className="py-8 text-center text-slate-400 text-xs">
                Nenhuma saída registrada recentemente.
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
};
