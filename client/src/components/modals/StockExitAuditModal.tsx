import React, { useState, useEffect, useMemo } from 'react';
import { Package, X, Calendar, User, Building, Search, Plus, Check, Clock, ShieldCheck, ArrowUpRight, Filter, Layers, CheckSquare, Square } from 'lucide-react';
import { api } from '../../services/api';

interface StockExitAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  movement: any; // Initial movement clicked
  availableMovements?: any[]; // All recent exit movements passed from parent
  periodFilter?: string;
  onNavigateToStock?: (materialName: string) => void;
}

export const StockExitAuditModal: React.FC<StockExitAuditModalProps> = ({
  isOpen,
  onClose,
  movement,
  availableMovements = [],
  periodFilter = 'all',
  onNavigateToStock
}) => {
  const [allMovements, setAllMovements] = useState<any[]>([]);
  const [catalogMaterials, setCatalogMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedMaterialNames, setSelectedMaterialNames] = useState<string[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string>(periodFilter || 'all');
  const [materialSearchQuery, setMaterialSearchQuery] = useState('');
  const [showMaterialSelector, setShowMaterialSelector] = useState(true);

  // Initialize selected material when movement changes or modal opens
  useEffect(() => {
    if (isOpen && movement?.material_name) {
      setSelectedMaterialNames([movement.material_name]);
      setSelectedPeriod(periodFilter || 'all');
      setMaterialSearchQuery('');
    }
  }, [isOpen, movement, periodFilter]);

  // Fetch full stock movements AND catalog materials
  useEffect(() => {
    if (!isOpen) return;

    const loadData = async () => {
      setLoading(true);
      try {
        const [movesRes, matsRes] = await Promise.all([
          api.getStockMovements({ limit: 'all' }).catch(() => []),
          api.getMaterials().catch(() => [])
        ]);

        const list: any[] = Array.isArray(movesRes) ? movesRes : ((movesRes as any)?.movements || []);
        
        // Filter exits properly: matches 'SAIDA_OBRA', 'SAIDA', 'SAÍDA', 'EXIT', 'OUT'
        const exits = list.filter((m: any) => {
          const type = (m.type || '').toUpperCase();
          return type.includes('SAIDA') || type.includes('SAÍDA') || type === 'EXIT' || type === 'OUT';
        });

        setAllMovements(exits.length > 0 ? exits : availableMovements);
        setCatalogMaterials(Array.isArray(matsRes) ? matsRes : []);
      } catch (err) {
        console.error('Erro ao carregar dados de auditoria:', err);
        if (availableMovements.length > 0) {
          setAllMovements(availableMovements);
        }
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [isOpen]);

  // Movements filtered by selected period
  const periodFilteredMovements = useMemo(() => {
    if (selectedPeriod === 'all') return allMovements;

    const now = new Date();
    const days = parseInt(selectedPeriod, 10);
    if (isNaN(days)) return allMovements;

    const cutoff = new Date();
    cutoff.setDate(now.getDate() - days);
    cutoff.setHours(0, 0, 0, 0);

    return allMovements.filter((m) => {
      if (!m.created_at) return true;
      return new Date(m.created_at) >= cutoff;
    });
  }, [allMovements, selectedPeriod]);

  // Build unified materials dictionary (Catalog + Movements)
  const availableMaterialsList = useMemo(() => {
    const map = new Map<string, {
      name: string;
      code: string;
      unit: string;
      totalExits: number;
      periodExits: number;
      periodQty: number;
    }>();

    // 1. Add all catalog materials
    catalogMaterials.forEach((cat) => {
      const name = (cat.name || '').trim();
      if (!name) return;
      map.set(name.toLowerCase(), {
        name,
        code: cat.code || '',
        unit: cat.unit || 'und',
        totalExits: 0,
        periodExits: 0,
        periodQty: 0
      });
    });

    // 2. Add or update stats from movements in history
    allMovements.forEach((m) => {
      const name = (m.material_name || m.custom_name || '').trim();
      if (!name) return;
      const key = name.toLowerCase();

      if (!map.has(key)) {
        map.set(key, {
          name,
          code: m.material_code || '',
          unit: m.material_unit || 'und',
          totalExits: 1,
          periodExits: 0,
          periodQty: 0
        });
      } else {
        const item = map.get(key)!;
        item.totalExits += 1;
        if (!item.code && m.material_code) item.code = m.material_code;
      }
    });

    // 3. Compute stats for the currently selected period
    periodFilteredMovements.forEach((m) => {
      const name = (m.material_name || m.custom_name || '').trim();
      if (!name) return;
      const key = name.toLowerCase();
      if (map.has(key)) {
        const item = map.get(key)!;
        item.periodExits += 1;
        item.periodQty += Number(m.quantity) || 0;
      }
    });

    return Array.from(map.values()).sort((a, b) => {
      // Prioritize items with exits in period, then exits in total, then alphabetically
      if (b.periodQty !== a.periodQty) return b.periodQty - a.periodQty;
      if (b.totalExits !== a.totalExits) return b.totalExits - a.totalExits;
      return a.name.localeCompare(b.name);
    });
  }, [catalogMaterials, allMovements, periodFilteredMovements]);

  // Movements matching ONLY the selected materials
  const matchedMovements = useMemo(() => {
    if (selectedMaterialNames.length === 0) return [];
    const selectedSet = new Set(selectedMaterialNames.map((n) => n.toLowerCase().trim()));
    return periodFilteredMovements.filter((m) =>
      selectedSet.has((m.material_name || m.custom_name || '').toLowerCase().trim())
    );
  }, [periodFilteredMovements, selectedMaterialNames]);

  // Grouped summation per material
  const materialSummaries = useMemo(() => {
    const map = new Map<string, {
      name: string;
      code?: string;
      unit: string;
      totalQty: number;
      count: number;
      destinations: Set<string>;
    }>();

    // First populate all selected materials (even if 0 exits in period)
    selectedMaterialNames.forEach((name) => {
      const meta = availableMaterialsList.find(m => m.name.toLowerCase() === name.toLowerCase());
      map.set(name.toLowerCase(), {
        name,
        code: meta?.code,
        unit: meta?.unit || 'und',
        totalQty: 0,
        count: 0,
        destinations: new Set()
      });
    });

    // Add matching movements
    matchedMovements.forEach((m) => {
      const name = (m.material_name || m.custom_name || 'Material').trim();
      const key = name.toLowerCase();
      const qty = Number(m.quantity) || 0;
      const unit = m.material_unit || 'und';
      const dest = m.project_name || m.project_code || 'Almoxarifado';

      if (!map.has(key)) {
        map.set(key, {
          name,
          code: m.material_code,
          unit,
          totalQty: qty,
          count: 1,
          destinations: new Set([dest])
        });
      } else {
        const item = map.get(key)!;
        item.totalQty += qty;
        item.count += 1;
        item.destinations.add(dest);
        if (!item.code && m.material_code) item.code = m.material_code;
      }
    });

    return Array.from(map.values()).sort((a, b) => b.totalQty - a.totalQty);
  }, [selectedMaterialNames, matchedMovements, availableMaterialsList]);

  // Total quantity grouped by unit (e.g., "120 und", "15 m")
  const totalsByUnit = useMemo(() => {
    const map = new Map<string, number>();
    matchedMovements.forEach((m) => {
      const unit = m.material_unit || 'und';
      const qty = Number(m.quantity) || 0;
      map.set(unit, (map.get(unit) || 0) + qty);
    });
    return Array.from(map.entries()).map(([unit, qty]) => `${qty} ${unit}`);
  }, [matchedMovements]);

  // Overall total item exits (raw quantity sum)
  const grandTotalQuantity = useMemo(() => {
    return matchedMovements.reduce((acc, m) => acc + (Number(m.quantity) || 0), 0);
  }, [matchedMovements]);

  const toggleMaterial = (name: string) => {
    setSelectedMaterialNames((prev) => {
      const exists = prev.some(n => n.toLowerCase() === name.toLowerCase());
      if (exists) {
        return prev.filter((n) => n.toLowerCase() !== name.toLowerCase());
      } else {
        return [...prev, name];
      }
    });
  };

  const selectAllMatching = (itemsToSelect: any[]) => {
    const newNames = itemsToSelect.map(i => i.name);
    setSelectedMaterialNames((prev) => {
      const set = new Set([...prev, ...newNames]);
      return Array.from(set);
    });
  };

  const unselectAllMatching = (itemsToUnselect: any[]) => {
    const toRemove = new Set(itemsToUnselect.map(i => i.name.toLowerCase()));
    setSelectedMaterialNames((prev) => prev.filter(n => !toRemove.has(n.toLowerCase())));
  };

  const clearMaterialSelection = () => {
    setSelectedMaterialNames([]);
  };

  if (!isOpen) return null;

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return iso;
    }
  };

  // Filter materials in the search selector
  const filteredMaterialsForSelector = availableMaterialsList.filter((m) => {
    if (!materialSearchQuery.trim()) return m.totalExits > 0; // if search is empty, show all items with exit history
    const q = materialSearchQuery.toLowerCase();
    return m.name.toLowerCase().includes(q) || (m.code && m.code.toLowerCase().includes(q));
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-dark-900 border border-dark-750 rounded-3xl w-full max-w-4xl max-h-[92vh] shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-dark-800 flex items-center justify-between bg-dark-850">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-white">Auditoria de Saídas com Seleção Múltipla</h2>
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-950 text-blue-400 border border-blue-500/40">
                  {selectedMaterialNames.length} {selectedMaterialNames.length === 1 ? 'item selecionado' : 'itens selecionados'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Pesquise e selecione materiais para somar e auditar as saídas combinadas de estoque
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-dark-750 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-5 text-xs flex-1">
          {/* Controls Bar: Multi-select Trigger & Period Filter */}
          <div className="bg-dark-850 p-4 rounded-2xl border border-dark-750 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-1 min-w-[280px]">
                <button
                  type="button"
                  onClick={() => setShowMaterialSelector(!showMaterialSelector)}
                  className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center gap-2 transition-all shadow-md text-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>{showMaterialSelector ? 'Recolher Seletor de Itens' : '+ Pesquisar / Adicionar Mais Itens'}</span>
                </button>

                {selectedMaterialNames.length > 0 && (
                  <button
                    type="button"
                    onClick={clearMaterialSelection}
                    className="px-3 py-2 rounded-xl bg-dark-750 hover:bg-dark-700 text-slate-300 font-semibold text-[11px] transition-colors"
                  >
                    Desmarcar Todos ({selectedMaterialNames.length})
                  </button>
                )}
              </div>

              {/* Período */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-bold text-slate-400 mr-1 flex items-center gap-1">
                  <Filter className="w-3.5 h-3.5 text-blue-400" />
                  Período:
                </span>
                {[
                  { label: 'Todos', value: 'all' },
                  { label: 'Hoje', value: '1' },
                  { label: '7d', value: '7' },
                  { label: '15d', value: '15' },
                  { label: '30d', value: '30' },
                  { label: '90d', value: '90' }
                ].map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setSelectedPeriod(p.value)}
                    className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all ${
                      selectedPeriod === p.value
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-dark-750 text-slate-400 hover:text-white hover:bg-dark-700'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Painel de Seleção e Busca de Múltiplos Itens */}
            {showMaterialSelector && (
              <div className="pt-3 border-t border-dark-750 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={materialSearchQuery}
                      onChange={(e) => setMaterialSearchQuery(e.target.value)}
                      placeholder="Pesquisar material por nome ou código (ex: porca, parafuso, tubo, fita)..."
                      className="w-full pl-9 pr-8 py-2 rounded-xl border border-dark-700 bg-dark-900 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                      autoFocus
                    />
                    {materialSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setMaterialSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white font-bold text-xs"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {materialSearchQuery.trim() && filteredMaterialsForSelector.length > 0 && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => selectAllMatching(filteredMaterialsForSelector)}
                        className="px-2.5 py-1.5 rounded-lg bg-blue-950 hover:bg-blue-900 border border-blue-600/50 text-blue-300 font-bold text-[10px] transition-colors"
                      >
                        Marcar todos ({filteredMaterialsForSelector.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => unselectAllMatching(filteredMaterialsForSelector)}
                        className="px-2 py-1.5 rounded-lg bg-dark-800 hover:bg-dark-750 text-slate-400 font-medium text-[10px] transition-colors"
                      >
                        Desmarcar
                      </button>
                    </div>
                  )}
                </div>

                {/* Lista de itens encontrados com checkboxes claros */}
                <div className="max-h-56 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 p-1.5 rounded-xl bg-dark-900 border border-dark-750">
                  {filteredMaterialsForSelector.map((m) => {
                    const isSelected = selectedMaterialNames.some(n => n.toLowerCase() === m.name.toLowerCase());
                    return (
                      <div
                        key={m.name}
                        onClick={() => toggleMaterial(m.name)}
                        className={`p-2.5 rounded-xl text-left flex items-start gap-2.5 transition-all cursor-pointer border ${
                          isSelected
                            ? 'bg-blue-950/60 border-blue-500/70 text-white shadow-xs'
                            : 'bg-dark-850 hover:bg-dark-800 border-dark-750 text-slate-300'
                        }`}
                      >
                        <div className="mt-0.5 shrink-0">
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-blue-400 fill-blue-500/20" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-500" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-[11px] truncate leading-tight" title={m.name}>
                            {m.name}
                          </p>
                          <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1 gap-1">
                            <span className="font-mono truncate">{m.code ? `Cód: ${m.code}` : m.unit}</span>
                            {m.periodQty > 0 ? (
                              <span className="font-extrabold text-blue-400 font-mono shrink-0">
                                -{m.periodQty} {m.unit}
                              </span>
                            ) : m.totalExits > 0 ? (
                              <span className="text-slate-500 shrink-0">
                                {m.totalExits} {m.totalExits === 1 ? 'saída' : 'saídas'} hist.
                              </span>
                            ) : (
                              <span className="text-slate-600 shrink-0">0 saídas</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {filteredMaterialsForSelector.length === 0 && (
                    <div className="col-span-full py-8 text-center text-slate-500 text-xs">
                      {materialSearchQuery
                        ? `Nenhum material encontrado com "${materialSearchQuery}". Verifique a digitação ou tente outro termo.`
                        : 'Nenhum material com saídas registrado recentemente.'}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Pílulas de materiais atualmente selecionados */}
            {selectedMaterialNames.length > 0 && (
              <div className="space-y-1.5 pt-2 border-t border-dark-750">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  Itens Selecionados ({selectedMaterialNames.length}):
                </span>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                  {selectedMaterialNames.map((name) => (
                    <span
                      key={name}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-950/80 border border-blue-500/50 text-blue-200 text-[11px] font-semibold"
                    >
                      <span className="truncate max-w-[240px]" title={name}>{name}</span>
                      <button
                        type="button"
                        onClick={() => toggleMaterial(name)}
                        className="hover:text-white hover:bg-blue-800 rounded p-0.5 text-blue-300 transition-colors"
                        title="Remover da seleção"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Cards de Métricas Consolidadas / Soma de Saídas */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-2xl bg-dark-850 border border-dark-750">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                Itens Selecionados
              </span>
              <div className="text-2xl font-black text-white mt-1">
                {selectedMaterialNames.length}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {materialSummaries.filter(s => s.totalQty > 0).length} com saídas registradas no período
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-dark-850 border border-dark-750">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                Total de Registros de Saída
              </span>
              <div className="text-2xl font-black text-amber-400 mt-1">
                {matchedMovements.length}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {selectedPeriod === 'all' ? 'Todo o histórico do sistema' : `Nos últimos ${selectedPeriod} dias`}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-blue-950/40 border border-blue-500/40">
              <span className="text-[10px] uppercase font-bold text-blue-300 block tracking-wider">
                Soma Total de Saídas
              </span>
              <div className="text-2xl font-black text-blue-400 font-mono mt-1">
                -{grandTotalQuantity}
              </div>
              <p className="text-[11px] text-blue-200/80 mt-0.5 truncate" title={totalsByUnit.join(' + ')}>
                {totalsByUnit.length > 0 ? totalsByUnit.join(' + ') : 'Nenhuma saída no período'}
              </p>
            </div>
          </div>

          {/* Tabela de Consolidado por Material Selecionado */}
          <div className="space-y-2">
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>Consolidação por Material Selecionado ({materialSummaries.length})</span>
              <span className="text-blue-400 font-bold font-mono">
                Soma: -{grandTotalQuantity} {totalsByUnit.join(' + ') || 'unidades'}
              </span>
            </h4>

            {materialSummaries.length === 0 ? (
              <div className="p-6 rounded-2xl border border-dashed border-dark-700 bg-dark-850/50 text-center text-slate-400">
                {selectedMaterialNames.length === 0
                  ? 'Selecione um ou mais materiais acima para somar suas saídas.'
                  : 'Nenhuma saída registrada para os materiais selecionados neste período.'}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-dark-750">
                <table className="w-full text-left text-xs">
                  <thead className="bg-dark-850 text-slate-400 border-b border-dark-750 font-bold">
                    <tr>
                      <th className="p-3">Material</th>
                      <th className="p-3 text-center">Registros</th>
                      <th className="p-3">Obras / Destinos</th>
                      <th className="p-3 text-right">Total Retirado (Soma)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dark-800 bg-dark-900/60">
                    {materialSummaries.map((item) => (
                      <tr key={item.name} className="hover:bg-dark-850/50 transition-colors">
                        <td className="p-3">
                          <strong className="text-white block">{item.name}</strong>
                          {item.code && (
                            <span className="text-[10px] font-mono text-slate-400">
                              Cód: {item.code}
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-center font-bold text-slate-300">
                          {item.count}
                        </td>
                        <td className="p-3 text-slate-400 text-[11px] max-w-[260px] truncate" title={Array.from(item.destinations).join(', ') || 'Nenhum'}>
                          {item.destinations.size > 0
                            ? Array.from(item.destinations).slice(0, 2).join(', ') + (item.destinations.size > 2 ? ` (+${item.destinations.size - 2})` : '')
                            : '--'}
                        </td>
                        <td className="p-3 text-right font-black text-blue-400 font-mono text-sm whitespace-nowrap">
                          {item.totalQty > 0 ? `-${item.totalQty} ${item.unit}` : '0 ' + item.unit}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Tabela de Todas as Saídas Detalhadas no Período */}
          <div className="space-y-2">
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-400" />
                Histórico Detalhado de Saídas dos Itens ({matchedMovements.length})
              </span>
            </h4>

            {loading ? (
              <div className="p-6 text-center text-slate-500 text-xs">Carregando histórico...</div>
            ) : matchedMovements.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-dark-700 text-center text-slate-500 text-xs">
                Nenhuma movimentação de saída detalhada encontrada para os itens e período escolhidos.
              </div>
            ) : (
              <div className="max-h-56 overflow-y-auto rounded-2xl border border-dark-750">
                <table className="w-full text-left text-xs">
                  <thead className="bg-dark-850 text-slate-400 border-b border-dark-750 font-bold sticky top-0">
                    <tr>
                      <th className="p-2.5">Data/Hora</th>
                      <th className="p-2.5">Material</th>
                      <th className="p-2.5">Obra / Destino</th>
                      <th className="p-2.5 text-right">Qtd</th>
                      <th className="p-2.5">Responsável</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dark-800">
                    {matchedMovements.map((h: any) => (
                      <tr key={h.id} className="hover:bg-dark-850/50">
                        <td className="p-2.5 text-slate-300 whitespace-nowrap">{formatDate(h.created_at)}</td>
                        <td className="p-2.5 text-white font-medium truncate max-w-[220px]" title={h.material_name}>
                          {h.material_name}
                        </td>
                        <td className="p-2.5 text-slate-300 truncate max-w-[200px]" title={h.project_name || 'Almoxarifado'}>
                          {h.project_code ? `${h.project_code} - ` : ''}
                          {h.project_name || 'Almoxarifado'}
                        </td>
                        <td className="p-2.5 text-right font-bold text-blue-400 font-mono whitespace-nowrap">
                          -{h.quantity} {h.material_unit || 'un'}
                        </td>
                        <td className="p-2.5 text-slate-400 whitespace-nowrap">{h.user_name || 'Sistema'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-dark-800 bg-dark-850 flex items-center justify-between">
          {onNavigateToStock && selectedMaterialNames.length === 1 && (
            <button
              onClick={() => {
                onClose();
                onNavigateToStock(selectedMaterialNames[0]);
              }}
              className="text-xs font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1.5 transition-colors"
            >
              <span>Ver Estoque Completo deste Item</span>
              <ArrowUpRight className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={onClose}
            className="ml-auto px-5 py-2.5 rounded-xl bg-dark-750 hover:bg-dark-700 text-white text-xs font-semibold transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
