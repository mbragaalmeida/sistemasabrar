import React, { useState, useEffect, useMemo } from 'react';
import { AlertTriangle, X, Search, Filter, Package, ArrowUpRight, TrendingDown, Layers, ShieldAlert, Check } from 'lucide-react';
import { api } from '../../services/api';
import { sanitizeUnit } from '../../utils/unitConverter';

interface CriticalStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToStock?: () => void;
}

export const CriticalStockModal: React.FC<CriticalStockModalProps> = ({
  isOpen,
  onClose,
  onNavigateToStock
}) => {
  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [filterZeroOnly, setFilterZeroOnly] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const loadCriticalMaterials = async () => {
      setLoading(true);
      try {
        const res = await api.getMaterials({ below_minimum: 'true' });
        setMaterials(res || []);
      } catch (err) {
        console.error('Erro ao carregar materiais com estoque crítico:', err);
      } finally {
        setLoading(false);
      }
    };

    loadCriticalMaterials();
  }, [isOpen]);

  // Categorias únicas dos itens críticos
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const m of materials) {
      if (m.category) set.add(m.category.trim());
    }
    return Array.from(set).sort();
  }, [materials]);

  // Itens filtrados
  const filteredMaterials = useMemo(() => {
    return materials.filter((m) => {
      if (selectedCategory !== 'all' && m.category !== selectedCategory) {
        return false;
      }
      if (filterZeroOnly && Number(m.stock_physical || 0) > 0) {
        return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        const text = `${m.name || ''} ${m.code || ''} ${m.category || ''} ${m.brand || ''}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [materials, selectedCategory, filterZeroOnly, search]);

  // Métricas de resumo para o card do topo
  const totalItems = materials.length;
  const zeroStockItems = useMemo(() => materials.filter(m => Number(m.stock_physical || 0) <= 0).length, [materials]);
  const totalDeficit = useMemo(() => {
    return materials.reduce((acc, m) => {
      const min = Number(m.stock_minimum || 0);
      const curr = Number(m.stock_physical || 0);
      return acc + Math.max(0, min - curr);
    }, 0);
  }, [materials]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-750 rounded-3xl w-full max-w-4xl max-h-[90vh] shadow-2xl overflow-hidden flex flex-col text-slate-800 dark:text-slate-100">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-dark-800 flex items-center justify-between bg-slate-50/70 dark:bg-dark-850">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                  Auditoria de Estoque Crítico
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-500 text-white shadow-xs">
                  {totalItems} materiais
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Materiais da base central com saldo físico abaixo da margem mínima de segurança
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-dark-750 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Top Summary Card (Similar ao Saídas Recentes) */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-rose-50 via-amber-50 to-orange-50 dark:from-dark-850 dark:via-dark-900 dark:to-dark-850 border-b border-rose-200 dark:border-dark-750">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-white/90 dark:bg-dark-800 rounded-2xl border border-rose-200/80 dark:border-rose-900/40 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                Total de Itens Críticos
              </span>
              <div className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400 mt-0.5">
                {totalItems}
              </div>
            </div>

            <div className="p-3 bg-white/90 dark:bg-dark-800 rounded-2xl border border-rose-200/80 dark:border-rose-900/40 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 block">
                Itens Zerados (Esgotados)
              </span>
              <div className="text-xl sm:text-2xl font-black text-rose-700 dark:text-rose-300 mt-0.5">
                {zeroStockItems}
              </div>
            </div>

            <div className="p-3 bg-white/90 dark:bg-dark-800 rounded-2xl border border-amber-200/80 dark:border-amber-900/40 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 block">
                Déficit Total de Reposição
              </span>
              <div className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400 mt-0.5">
                {totalDeficit.toLocaleString('pt-BR')} <span className="text-xs font-normal">und</span>
              </div>
            </div>

            <div className="p-3 bg-white/90 dark:bg-dark-800 rounded-2xl border border-slate-200 dark:border-dark-700 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                Categorias Afetadas
              </span>
              <div className="text-xl sm:text-2xl font-black text-slate-800 dark:text-slate-200 mt-0.5">
                {categories.length}
              </div>
            </div>
          </div>
        </div>

        {/* Filtros: Busca e Categoria */}
        <div className="p-4 border-b border-slate-200 dark:border-dark-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/40 dark:bg-dark-850/60">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por código, material ou marca..."
              className="w-full pl-9 pr-4 py-2 bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-750 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-rose-500"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-750 rounded-xl px-2.5 py-1.5">
              <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-transparent text-xs text-slate-800 dark:text-slate-200 font-semibold focus:outline-none cursor-pointer"
              >
                <option value="all">Todas as Categorias ({totalItems})</option>
                {categories.map((cat) => {
                  const countInCat = materials.filter(m => m.category === cat).length;
                  return (
                    <option key={cat} value={cat}>
                      {cat} ({countInCat})
                    </option>
                  );
                })}
              </select>
            </div>

            <button
              type="button"
              onClick={() => setFilterZeroOnly(!filterZeroOnly)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                filterZeroOnly
                  ? 'bg-rose-500 text-white border-rose-500 shadow-xs'
                  : 'bg-white dark:bg-dark-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-dark-750 hover:border-rose-400'
              }`}
            >
              Apenas Zerados ({zeroStockItems})
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-3">
          {loading && (
            <div className="py-20 text-center text-sm text-slate-400">
              Carregando dados de estoque crítico...
            </div>
          )}

          {!loading && filteredMaterials.length === 0 && (
            <div className="py-16 text-center text-slate-400 text-xs space-y-2">
              <Package className="w-10 h-10 text-slate-500 mx-auto" />
              <p className="font-bold text-sm text-slate-600 dark:text-slate-300">
                Nenhum material encontrado com os filtros aplicados
              </p>
              <p className="text-[11px] text-slate-400">
                Tente ajustar a categoria selecionada ou o termo de pesquisa.
              </p>
            </div>
          )}

          {!loading && filteredMaterials.length > 0 && (
            <div className="space-y-2.5">
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium flex items-center justify-between">
                <span>Exibindo <strong>{filteredMaterials.length}</strong> de {totalItems} materiais no estoque crítico</span>
                {selectedCategory !== 'all' && (
                  <span className="text-rose-600 dark:text-rose-400 font-bold">
                    Filtrado por: {selectedCategory}
                  </span>
                )}
              </div>

              <div className="divide-y divide-slate-100 dark:divide-dark-800 border border-slate-200 dark:border-dark-750 rounded-2xl overflow-hidden bg-white dark:bg-dark-850">
                {filteredMaterials.map((m) => {
                  const physical = Number(m.stock_physical || 0);
                  const minimum = Number(m.stock_minimum || 0);
                  const deficit = Math.max(0, minimum - physical);
                  const isZero = physical <= 0;

                  return (
                    <div
                      key={m.id}
                      className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 dark:hover:bg-dark-800/80 transition-colors"
                    >
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        {m.image_url ? (
                          <img
                            src={m.image_url}
                            alt={m.name}
                            className="w-12 h-12 rounded-xl object-cover border border-slate-200 dark:border-dark-700 shrink-0 bg-white"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-dark-750 border border-slate-200 dark:border-dark-700 flex items-center justify-center text-slate-400 shrink-0">
                            <Package className="w-6 h-6" />
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-mono text-[10px] font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-dark-750 px-2 py-0.5 rounded border border-slate-200 dark:border-dark-700">
                              {m.code}
                            </span>
                            {m.category && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-dark-750 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-dark-700">
                                {m.category}
                              </span>
                            )}
                            {isZero ? (
                              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-500 text-white animate-pulse">
                                ESGOTADO
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                                ABAIXO DO MÍNIMO
                              </span>
                            )}
                          </div>

                          <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate" title={m.name}>
                            {m.name}
                          </h4>
                          {m.brand && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              Marca: <span className="font-semibold text-slate-700 dark:text-slate-300">{m.brand}</span>
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Stock Numbers */}
                      <div className="flex items-center gap-4 self-end sm:self-center shrink-0">
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 block uppercase font-medium">Estoque Físico</span>
                          <span className={`text-sm font-black ${isZero ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'}`}>
                            {physical} <span className="text-[10px] font-semibold">{sanitizeUnit(m.unit)}</span>
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 block uppercase font-medium">Mínimo</span>
                          <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                            {minimum} <span className="text-[10px] font-semibold">{sanitizeUnit(m.unit)}</span>
                          </span>
                        </div>

                        <div className="text-right p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40">
                          <span className="text-[9px] font-black uppercase tracking-wider text-rose-700 dark:text-rose-400 block">
                            Déficit
                          </span>
                          <span className="text-xs font-black text-rose-700 dark:text-rose-300">
                            -{deficit} {sanitizeUnit(m.unit)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-dark-800 flex items-center justify-between bg-slate-50/70 dark:bg-dark-850">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {totalItems} materiais com alerta de estoque
          </span>
          <div className="flex items-center gap-2">
            {onNavigateToStock && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onNavigateToStock();
                }}
                className="px-4 py-2 bg-slate-200 dark:bg-dark-750 hover:bg-slate-300 dark:hover:bg-dark-700 text-slate-800 dark:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <span>Ir para Almoxarifado</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
            >
              Fechar Visualização
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
