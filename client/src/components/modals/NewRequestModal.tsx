import React, { useState, useEffect, useMemo } from 'react';
import { ClipboardList, AlertTriangle, CheckCircle, X, ShoppingCart, Send, Search, CheckSquare, Square, Package, ArrowRight, Layers } from 'lucide-react';
import { Project, Material } from '../../types';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

interface NewRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  preselectedProjectId?: number;
}

export const NewRequestModal: React.FC<NewRequestModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  preselectedProjectId
}) => {
  const { currentUser } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | ''>('');
  const [priority, setPriority] = useState<'Baixa' | 'Média' | 'Alta' | 'Urgente'>('Média');
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [loadingBudget, setLoadingBudget] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modo: 'batch' (todos os materiais do orçamento da obra) ou 'single' (item avulso)
  const [requestMode, setRequestMode] = useState<'batch' | 'single'>('batch');

  // Dados do modo em lote (orçamento da obra selecionada)
  const [budgetItems, setBudgetItems] = useState<any[]>([]);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<number>>(new Set());
  const [itemQuantities, setItemQuantities] = useState<Record<number, number>>({});
  const [searchFilter, setSearchFilter] = useState('');
  const [stockTabFilter, setStockTabFilter] = useState<'todos' | 'com_estoque' | 'deficit'>('todos');

  // Dados do modo individual
  const [selectedMaterialId, setSelectedMaterialId] = useState<number | ''>('');
  const [singleQuantity, setSingleQuantity] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      // Carrega projetos
      api.getProjects().then(data => {
        const valid = data.filter((p: Project) => ['Aprovado', 'Em execução', 'Orçamento finalizado'].includes(p.status));
        setProjects(valid.length > 0 ? valid : data);
      });
      api.getMaterials().then(setMaterials);

      if (preselectedProjectId) {
        setSelectedProjectId(preselectedProjectId);
      } else {
        setSelectedProjectId('');
      }
      setSelectedMaterialId('');
      setSingleQuantity('');
      setPriority('Média');
      setNotes('');
      setError(null);
      setBudgetItems([]);
      setSelectedItemIds(new Set());
      setItemQuantities({});
      setSearchFilter('');
      setStockTabFilter('todos');
    }
  }, [isOpen, preselectedProjectId]);

  // Quando o projeto selecionado muda, busca materiais orçados da obra
  useEffect(() => {
    if (selectedProjectId) {
      setLoadingBudget(true);
      api.getBudget(selectedProjectId)
        .then((budgetData: any) => {
          if (budgetData && budgetData.items && budgetData.items.length > 0) {
            setBudgetItems(budgetData.items);
            setRequestMode('batch');
            // Marca todos por padrão
            const allIds = new Set<number>(budgetData.items.map((it: any) => it.id));
            setSelectedItemIds(allIds);

            // Inicializa mapa de quantidades com a quantidade prevista
            const initialQtys: Record<number, number> = {};
            budgetData.items.forEach((it: any) => {
              initialQtys[it.id] = Number(it.quantity || it.ai_suggested_quantity || 1);
            });
            setItemQuantities(initialQtys);
          } else {
            setBudgetItems([]);
            setRequestMode('single');
          }
        })
        .catch(() => {
          setBudgetItems([]);
          setRequestMode('single');
        })
        .finally(() => {
          setLoadingBudget(false);
        });
    } else {
      setBudgetItems([]);
      setSelectedItemIds(new Set());
      setItemQuantities({});
    }
  }, [selectedProjectId]);

  // Cálculos para o modo individual
  const selectedMat = materials.find(m => m.id === Number(selectedMaterialId));
  const availableStockSingle = selectedMat ? Math.max(0, selectedMat.stock_physical - selectedMat.stock_reserved) : 0;
  const requestedNumSingle = Number(singleQuantity) || 0;
  const deficitSingle = Math.max(0, requestedNumSingle - availableStockSingle);

  // Cálculos para o modo em lote
  const batchItemsWithMetrics = useMemo(() => {
    return budgetItems.map((it) => {
      const mat = materials.find(m => m.id === it.material_id) || {
        stock_physical: it.stock_physical || 0,
        stock_reserved: it.stock_reserved || 0
      };
      const physical = Number(mat.stock_physical ?? it.stock_physical ?? 0);
      const reserved = Number(mat.stock_reserved ?? it.stock_reserved ?? 0);
      const available = Math.max(0, physical - reserved);
      const requestedQty = Number(itemQuantities[it.id] ?? it.quantity ?? 1);
      const reservable = Math.min(requestedQty, available);
      const deficit = Math.max(0, requestedQty - available);
      const isSelected = selectedItemIds.has(it.id);

      return {
        ...it,
        availableStock: available,
        currentRequestedQty: requestedQty,
        reservable,
        deficit,
        isSelected
      };
    });
  }, [budgetItems, materials, itemQuantities, selectedItemIds]);

  const filteredBatchItems = useMemo(() => {
    return batchItemsWithMetrics.filter(it => {
      // Filtro de busca por nome ou código
      if (searchFilter.trim()) {
        const query = searchFilter.toLowerCase();
        const matchesName = (it.material_name || '').toLowerCase().includes(query);
        const matchesCode = (it.material_code || '').toLowerCase().includes(query);
        if (!matchesName && !matchesCode) return false;
      }

      // Filtro por disponibilidade de estoque
      if (stockTabFilter === 'com_estoque') return it.availableStock > 0;
      if (stockTabFilter === 'deficit') return it.deficit > 0;
      return true;
    });
  }, [batchItemsWithMetrics, searchFilter, stockTabFilter]);

  // Estatísticas dos itens selecionados
  const selectedBatchStats = useMemo(() => {
    const selected = batchItemsWithMetrics.filter(it => it.isSelected);
    const fullyAvailable = selected.filter(it => it.deficit === 0).length;
    const withDeficit = selected.filter(it => it.deficit > 0).length;
    return {
      totalSelected: selected.length,
      fullyAvailable,
      withDeficit
    };
  }, [batchItemsWithMetrics]);

  const handleToggleItem = (id: number) => {
    const next = new Set(selectedItemIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedItemIds(next);
  };

  const handleSelectAll = (select: boolean) => {
    if (select) {
      const allIds = new Set<number>(budgetItems.map(it => it.id));
      setSelectedItemIds(allIds);
    } else {
      setSelectedItemIds(new Set());
    }
  };

  const handleQuantityChange = (id: number, val: string) => {
    const num = parseFloat(val);
    setItemQuantities(prev => ({
      ...prev,
      [id]: isNaN(num) || num < 0 ? 0 : num
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedProjectId) {
      setError('Por favor selecione a obra destino.');
      return;
    }

    setLoading(true);
    try {
      if (requestMode === 'batch') {
        const itemsToSubmit = batchItemsWithMetrics
          .filter(it => it.isSelected && it.currentRequestedQty > 0 && it.material_id)
          .map(it => ({
            materialId: it.material_id,
            quantity: it.currentRequestedQty
          }));

        if (itemsToSubmit.length === 0) {
          setError('Nenhum material selecionado com quantidade válida.');
          setLoading(false);
          return;
        }

        await api.createRequest({
          projectId: Number(selectedProjectId),
          items: itemsToSubmit,
          priority,
          notes,
          userId: currentUser?.id || 3
        });
      } else {
        // Individual
        if (!selectedMaterialId || requestedNumSingle <= 0) {
          setError('Por favor selecione o material e informe uma quantidade válida.');
          setLoading(false);
          return;
        }

        await api.createRequest({
          projectId: Number(selectedProjectId),
          materialId: Number(selectedMaterialId),
          quantity: requestedNumSingle,
          priority,
          notes,
          userId: currentUser?.id || 3
        });
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao emitir solicitação de materiais');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-3xl bg-dark-900 rounded-3xl shadow-2xl border border-dark-700 overflow-hidden flex flex-col max-h-[92vh] text-slate-100">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-dark-850 border-b border-dark-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-sabrar-950/80 border border-sabrar-500/40 flex items-center justify-center text-sabrar-400">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white">Nova Solicitação de Materiais</h3>
              <p className="text-xs text-slate-400">Módulo da Engenharia de Obras • Verificação automática de estoque</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-dark-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Container */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 bg-rose-950/60 border border-rose-800 text-rose-300 text-xs rounded-xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Obra de Destino */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
              Projeto / Obra Destino *
            </label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value ? Number(e.target.value) : '')}
              className="w-full text-xs sm:text-sm p-3 rounded-2xl border border-dark-700 bg-dark-850 focus:outline-none focus:ring-2 focus:ring-sabrar-500 text-white font-semibold"
              required
            >
              <option value="">Selecione a obra...</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name} ({p.client})
                </option>
              ))}
            </select>
          </div>

          {/* Seletor de Modo: Lote do Orçamento vs Item Avulso */}
          {selectedProjectId && (
            <div className="flex items-center gap-2 bg-dark-850 p-1.5 rounded-2xl border border-dark-700">
              <button
                type="button"
                onClick={() => setRequestMode('batch')}
                disabled={budgetItems.length === 0}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                  requestMode === 'batch'
                    ? 'bg-sabrar-600 text-white shadow-md shadow-sabrar-600/30'
                    : budgetItems.length === 0
                    ? 'text-slate-600 cursor-not-allowed'
                    : 'text-slate-400 hover:text-white hover:bg-dark-800'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>
                  {loadingBudget
                    ? 'Carregando orçamento...'
                    : `Materiais do Orçamento da Obra (${budgetItems.length})`}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setRequestMode('single')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                  requestMode === 'single'
                    ? 'bg-sabrar-600 text-white shadow-md shadow-sabrar-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-dark-800'
                }`}
              >
                <Package className="w-4 h-4" />
                <span>Solicitação Individual (1 Item Avulso)</span>
              </button>
            </div>
          )}

          {/* MODO A: SOLICITAÇÃO EM LOTE DO ORÇAMENTO DA OBRA */}
          {requestMode === 'batch' && selectedProjectId && (
            <div className="space-y-3">
              {loadingBudget ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  Carregando lista de materiais orçados para esta obra...
                </div>
              ) : budgetItems.length === 0 ? (
                <div className="p-4 bg-dark-850 border border-dark-700 rounded-2xl text-center text-xs text-slate-400">
                  Esta obra ainda não possui orçamento de materiais salvo. Você pode adicionar materiais usando o modo "Solicitação Individual".
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Resumo Dinâmico em Cards */}
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="p-3 bg-dark-850 rounded-2xl border border-dark-700">
                      <div className="text-[10px] uppercase font-bold text-slate-400">Selecionados</div>
                      <div className="text-lg font-black text-white">{selectedBatchStats.totalSelected} de {budgetItems.length}</div>
                    </div>
                    <div className="p-3 bg-sabrar-950/50 rounded-2xl border border-sabrar-500/40">
                      <div className="text-[10px] uppercase font-bold text-sabrar-400 flex items-center justify-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Almoxarifado
                      </div>
                      <div className="text-lg font-black text-sabrar-300">{selectedBatchStats.fullyAvailable} com estoque</div>
                    </div>
                    <div className="p-3 bg-rose-950/40 rounded-2xl border border-rose-700/60">
                      <div className="text-[10px] uppercase font-bold text-rose-400 flex items-center justify-center gap-1">
                        <ShoppingCart className="w-3 h-3" /> Compras
                      </div>
                      <div className="text-lg font-black text-rose-300">{selectedBatchStats.withDeficit} com déficit</div>
                    </div>
                  </div>

                  {/* Barra de Filtros e Busca de Materiais */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleSelectAll(selectedItemIds.size !== budgetItems.length)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-dark-800 hover:bg-dark-750 text-white text-xs font-bold border border-dark-700"
                      >
                        {selectedItemIds.size === budgetItems.length ? (
                          <>
                            <CheckSquare className="w-4 h-4 text-sabrar-400" />
                            <span>Desmarcar Todos</span>
                          </>
                        ) : (
                          <>
                            <Square className="w-4 h-4 text-slate-400" />
                            <span>Selecionar Todos ({budgetItems.length})</span>
                          </>
                        )}
                      </button>

                      <div className="flex items-center gap-1 text-[11px]">
                        <button
                          type="button"
                          onClick={() => setStockTabFilter('todos')}
                          className={`px-2 py-1 rounded-lg font-semibold ${stockTabFilter === 'todos' ? 'bg-dark-700 text-white' : 'text-slate-400'}`}
                        >
                          Todos ({budgetItems.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setStockTabFilter('com_estoque')}
                          className={`px-2 py-1 rounded-lg font-semibold ${stockTabFilter === 'com_estoque' ? 'bg-sabrar-950 text-sabrar-300 border border-sabrar-500/40' : 'text-slate-400'}`}
                        >
                          Com Estoque
                        </button>
                        <button
                          type="button"
                          onClick={() => setStockTabFilter('deficit')}
                          className={`px-2 py-1 rounded-lg font-semibold ${stockTabFilter === 'deficit' ? 'bg-rose-950 text-rose-300 border border-rose-700/60' : 'text-slate-400'}`}
                        >
                          Com Déficit
                        </button>
                      </div>
                    </div>

                    <div className="relative flex-1 sm:max-w-xs">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={searchFilter}
                        onChange={(e) => setSearchFilter(e.target.value)}
                        placeholder="Filtrar por nome ou código..."
                        className="w-full text-xs pl-8 pr-3 py-1.5 rounded-xl bg-dark-850 border border-dark-700 focus:outline-none focus:border-sabrar-500 text-white placeholder-slate-500"
                      />
                    </div>
                  </div>

                  {/* Lista de Itens com Checkbox e Quantidades */}
                  <div className="border border-dark-750 rounded-2xl overflow-hidden bg-dark-850 max-h-72 overflow-y-auto divide-y divide-dark-750">
                    {filteredBatchItems.length === 0 ? (
                      <div className="py-8 text-center text-xs text-slate-500">
                        Nenhum material encontrado para o filtro.
                      </div>
                    ) : (
                      filteredBatchItems.map((it) => (
                        <div
                          key={it.id}
                          className={`p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-colors ${
                            it.isSelected ? 'bg-dark-900/40 hover:bg-dark-800/60' : 'opacity-60 bg-dark-900/10'
                          }`}
                        >
                          <div className="flex items-start gap-2.5 flex-1 min-w-0">
                            <input
                              type="checkbox"
                              checked={it.isSelected}
                              onChange={() => handleToggleItem(it.id)}
                              className="w-4 h-4 rounded mt-0.5 accent-sabrar-600 cursor-pointer"
                            />
                            <div className="min-w-0">
                              <div className="font-bold text-xs text-white truncate">{it.material_name}</div>
                              <div className="text-[11px] text-slate-400 font-mono flex items-center gap-2">
                                <span>{it.material_code || 'S/ Código'}</span>
                                <span>• Previsto no Orçamento: <strong className="text-slate-200">{it.quantity} {it.unit}</strong></span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 self-end sm:self-center">
                            {/* Input de Quantidade */}
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] text-slate-400">Qtd:</span>
                              <input
                                type="number"
                                step="any"
                                min="0.1"
                                disabled={!it.isSelected}
                                value={itemQuantities[it.id] ?? it.quantity}
                                onChange={(e) => handleQuantityChange(it.id, e.target.value)}
                                className="w-20 text-xs font-bold p-1.5 rounded-xl border border-dark-700 bg-dark-900 focus:outline-none focus:border-sabrar-500 text-white text-right disabled:opacity-40"
                              />
                              <span className="text-[11px] text-slate-400 w-8">{it.unit}</span>
                            </div>

                            {/* Status de Estoque */}
                            <div className="min-w-[140px] text-right">
                              {it.deficit === 0 ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sabrar-950 text-sabrar-300 border border-sabrar-500/40 text-[10px] font-bold">
                                  <CheckCircle className="w-3 h-3 text-sabrar-400" />
                                  Disp: {it.availableStock} {it.unit}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-700/60 text-[10px] font-bold">
                                  <ShoppingCart className="w-3 h-3 text-rose-400" />
                                  Déficit: {it.deficit} (Comprar)
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* MODO B: SOLICITAÇÃO INDIVIDUAL (1 ITEM AVULSO) */}
          {requestMode === 'single' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Material Solicitado *
                </label>
                <select
                  value={selectedMaterialId}
                  onChange={(e) => setSelectedMaterialId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full text-xs sm:text-sm p-3 rounded-2xl border border-dark-700 bg-dark-850 focus:outline-none focus:ring-2 focus:ring-sabrar-500 text-white"
                  required
                >
                  <option value="">Selecione o material da base...</option>
                  {materials.map((m) => {
                    const disp = Math.max(0, m.stock_physical - m.stock_reserved);
                    return (
                      <option key={m.id} value={m.id}>
                        {m.code} — {m.name} (Disponível: {disp} {m.unit})
                      </option>
                    );
                  })}
                </select>
              </div>

              {selectedMat && (
                <div className="grid grid-cols-3 gap-2 p-3 bg-dark-850 rounded-2xl border border-dark-700 text-center">
                  <div>
                    <div className="text-[10px] uppercase font-bold text-slate-400">Físico</div>
                    <div className="font-extrabold text-white text-xs sm:text-sm">
                      {selectedMat.stock_physical} {selectedMat.unit}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase font-bold text-slate-400">Reservado</div>
                    <div className="font-extrabold text-amber-400 text-xs sm:text-sm">
                      {selectedMat.stock_reserved} {selectedMat.unit}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase font-bold text-slate-400">Disponível</div>
                    <div className="font-extrabold text-sabrar-400 text-xs sm:text-sm">
                      {availableStockSingle} {selectedMat.unit}
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Quantidade Solicitada *{selectedMat ? ` (${selectedMat.unit})` : ''}
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.1"
                  value={singleQuantity}
                  onChange={(e) => setSingleQuantity(e.target.value)}
                  placeholder="Ex: 50"
                  className="w-full text-base font-bold p-2.5 rounded-2xl border border-dark-700 bg-dark-850 focus:outline-none focus:ring-2 focus:ring-sabrar-500 text-white placeholder-slate-500"
                  required
                />
              </div>

              {selectedMat && requestedNumSingle > 0 && (
                <div>
                  {deficitSingle === 0 ? (
                    <div className="p-3.5 bg-sabrar-950/80 border border-sabrar-500/40 rounded-2xl text-xs text-sabrar-300 flex items-start gap-2.5">
                      <CheckCircle className="w-5 h-5 text-sabrar-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-white">Estoque Suficiente Disponível!</span>
                        <p className="mt-0.5 text-slate-300">
                          Os {requestedNumSingle} {selectedMat.unit} serão reservados imediatamente e o Almoxarifado receberá a notificação para separação.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3.5 bg-amber-950/50 border border-amber-600/60 rounded-2xl text-xs text-amber-300 flex items-start gap-2.5 shadow-md">
                      <ShoppingCart className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-extrabold text-amber-200">
                          Déficit Detectado: Comprar {deficitSingle} {selectedMat.unit}
                        </span>
                        <p className="mt-0.5 leading-relaxed text-slate-300">
                          Disponível para reserva imediata: <span className="font-bold text-white">{availableStockSingle} {selectedMat.unit}</span>.
                          O sistema gerará automaticamente uma <span className="font-bold text-amber-300 underline">Demanda de Compra</span> no valor de déficit e notificará o setor de Compras!
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Prioridade e Observações */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                Prioridade da Solicitação
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full text-xs sm:text-sm p-2.5 rounded-2xl border border-dark-700 bg-dark-850 focus:outline-none focus:ring-2 focus:ring-sabrar-500 text-white font-medium"
              >
                <option value="Baixa">Baixa</option>
                <option value="Média">Média</option>
                <option value="Alta">Alta</option>
                <option value="Urgente">Urgente (Crítico)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                Observações / Frente de Trabalho
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Instalação do setor norte"
                className="w-full text-xs p-2.5 rounded-2xl border border-dark-700 bg-dark-850 focus:outline-none focus:ring-2 focus:ring-sabrar-500 text-white placeholder-slate-500"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-dark-750">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-dark-700 bg-dark-850 text-slate-300 text-xs font-bold hover:bg-dark-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || (requestMode === 'batch' && selectedBatchStats.totalSelected === 0)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sabrar-600 hover:bg-sabrar-500 text-white text-xs font-bold shadow-md shadow-sabrar-600/30 transition-all disabled:opacity-50 active:scale-95"
            >
              <Send className="w-4 h-4" />
              <span>
                {loading
                  ? 'Processando...'
                  : requestMode === 'batch'
                  ? `Emitir Solicitação (${selectedBatchStats.totalSelected} materiais)`
                  : 'Emitir Solicitação Individual'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
