import React, { useState, useEffect, useMemo } from 'react';
import {
  ClipboardList,
  AlertTriangle,
  CheckCircle,
  X,
  ShoppingCart,
  Send,
  Search,
  CheckSquare,
  Square,
  Package,
  Layers,
  Plus,
  Trash2,
  RefreshCw,
  Sparkles,
  Info,
  HardHat
} from 'lucide-react';
import { Project, Material } from '../../types';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { AssignEngineersModal } from './AssignEngineersModal';

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
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);

  const selectedProject = useMemo(() => {
    return projects.find(p => p.id === Number(selectedProjectId));
  }, [projects, selectedProjectId]);

  // Modo de Solicitação: 'batch' (orçamento da obra) ou 'custom' (lista avulsa montada pelo engenheiro)
  const [requestMode, setRequestMode] = useState<'batch' | 'custom'>('batch');

  // ==========================================
  // ABA 1: MATERIAIS DO ORÇAMENTO DA OBRA
  // ==========================================
  const [budgetItems, setBudgetItems] = useState<any[]>([]);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<number>>(new Set());
  const [itemQuantities, setItemQuantities] = useState<Record<number, number>>({});
  const [searchFilter, setSearchFilter] = useState('');
  const [stockTabFilter, setStockTabFilter] = useState<'todos' | 'com_estoque' | 'deficit'>('todos');

  // Adição de Item Extra no Orçamento
  const [isAddingExtra, setIsAddingExtra] = useState(false);
  const [extraSearch, setExtraSearch] = useState('');
  const [extraMaterialId, setExtraMaterialId] = useState<number | ''>('');
  const [extraQuantity, setExtraQuantity] = useState<string>('1');

  // Substituição de Item no Orçamento
  const [replacingItemId, setReplacingItemId] = useState<number | null>(null);
  const [replaceSearch, setReplaceSearch] = useState('');
  const [replaceWithMaterialId, setReplaceWithMaterialId] = useState<number | ''>('');

  // ==========================================
  // ABA 2: SOLICITAÇÃO AVULSA (MONTAR LISTA)
  // ==========================================
  const [customItems, setCustomItems] = useState<any[]>([]);
  const [selectedCustomIds, setSelectedCustomIds] = useState<Set<number>>(new Set());
  const [customQuantities, setCustomQuantities] = useState<Record<number, number>>({});
  const [customMaterialSearch, setCustomMaterialSearch] = useState('');
  const [customMaterialId, setCustomMaterialId] = useState<number | ''>('');
  const [customQuantity, setCustomQuantity] = useState<string>('1');
  const [customListFilter, setCustomListFilter] = useState('');
  const [customStockFilter, setCustomStockFilter] = useState<'todos' | 'com_estoque' | 'deficit'>('todos');

  useEffect(() => {
    if (isOpen) {
      // Carrega projetos (todas as obras cadastradas, exceto canceladas)
      api.getProjects().then(data => {
        let valid = data.filter((p: Project) => p.status !== 'Cancelado');
        if (valid.length === 0) valid = data;

        // Se o usuário for Engenheiro de campo, filtra estritamente para as obras sob sua responsabilidade técnica
        if (currentUser?.role === 'engenharia' && currentUser?.name) {
          const normUser = currentUser.name.toLowerCase().replace(/^eng\.?\s*/i, '').trim();
          valid = valid.filter((p: Project) => {
            if (p.assigned_engineer_ids && p.assigned_engineer_ids.includes(currentUser.id)) return true;
            if (p.assigned_engineers && p.assigned_engineers.some(e => e.id === currentUser.id)) return true;
            if (!p.responsible_engineer) return false;
            const normProj = p.responsible_engineer.toLowerCase().replace(/^eng\.?\s*/i, '').trim();
            return normProj.includes(normUser) || normUser.includes(normProj);
          });
        }
        setProjects(valid);
      });
      api.getMaterials().then(setMaterials);

      if (preselectedProjectId) {
        setSelectedProjectId(preselectedProjectId);
      } else {
        setSelectedProjectId('');
      }
      setPriority('Média');
      setNotes('');
      setError(null);
      setBudgetItems([]);
      setSelectedItemIds(new Set());
      setItemQuantities({});
      setSearchFilter('');
      setStockTabFilter('todos');

      setIsAddingExtra(false);
      setExtraSearch('');
      setExtraMaterialId('');
      setExtraQuantity('1');

      setReplacingItemId(null);
      setReplaceSearch('');
      setReplaceWithMaterialId('');

      setCustomItems([]);
      setSelectedCustomIds(new Set());
      setCustomQuantities({});
      setCustomMaterialSearch('');
      setCustomMaterialId('');
      setCustomQuantity('1');
      setCustomListFilter('');
      setCustomStockFilter('todos');
      setQuotasMap({});
    }
  }, [isOpen, preselectedProjectId]);

  // Mapa de cotas e saldos disponíveis do orçamento (Requisito 4)
  const [quotasMap, setQuotasMap] = useState<Record<number, any>>({});

  // Quando o projeto selecionado muda, busca materiais orçados da obra e cotas disponíveis
  useEffect(() => {
    if (selectedProjectId) {
      setLoadingBudget(true);
      Promise.all([
        api.getBudget(selectedProjectId).catch(() => null),
        api.getProjectMaterialQuotas(selectedProjectId).catch(() => null)
      ]).then(([budgetData, quotasData]) => {
        const qMap: Record<number, any> = {};
        if (quotasData && quotasData.quotas) {
          quotasData.quotas.forEach((q: any) => {
            qMap[q.materialId] = q;
          });
          setQuotasMap(qMap);
        } else {
          setQuotasMap({});
        }

        if (budgetData && budgetData.items && budgetData.items.length > 0) {
          setBudgetItems(budgetData.items);
          setRequestMode('batch');

          const initialQtys: Record<number, number> = {};
          const selected = new Set<number>();
          budgetData.items.forEach((it: any) => {
            const q = qMap[it.material_id];
            // Se houver cota calculada, usa o saldo remanescente; caso contrário, usa o previsto
            const remaining = q !== undefined && q !== null ? Number(q.remainingQuota) : Number(it.quantity || 0);
            const qty = Math.max(0, remaining);
            initialQtys[it.id] = qty;
            // Só seleciona por padrão os itens que ainda têm cota disponível (> 0)
            if (qty > 0) {
              selected.add(it.id);
            }
          });
          setSelectedItemIds(selected);
          setItemQuantities(initialQtys);
        } else {
          setBudgetItems([]);
          setRequestMode('custom');
        }
      }).catch(() => {
        setBudgetItems([]);
        setRequestMode('custom');
      }).finally(() => {
        setLoadingBudget(false);
      });
    } else {
      setBudgetItems([]);
      setSelectedItemIds(new Set());
      setItemQuantities({});
      setQuotasMap({});
    }
  }, [selectedProjectId]);

  // ==========================================
  // CÁLCULOS: ABA 1 (LOTE DO ORÇAMENTO)
  // ==========================================
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

      const quota = quotasMap[it.material_id];
      const budgetQuantity = quota ? Number(quota.budgetQuantity || 0) : Number(it.quantity || 0);
      const previouslyRequested = quota ? Number(quota.previouslyRequested || 0) : 0;
      const remainingQuota = quota ? Number(quota.remainingQuota || 0) : Math.max(0, budgetQuantity - previouslyRequested);

      const isOverBudget = it.isExtra || requestedQty > remainingQuota;
      const extraQuantity = it.isExtra ? requestedQty : Math.max(0, Number((requestedQty - remainingQuota).toFixed(2)));

      return {
        ...it,
        availableStock: available,
        currentRequestedQty: requestedQty,
        reservable,
        deficit,
        isSelected,
        budgetQuantity,
        previouslyRequested,
        remainingQuota,
        isOverBudget,
        extraQuantity
      };
    });
  }, [budgetItems, materials, itemQuantities, selectedItemIds, quotasMap]);

  const filteredBatchItems = useMemo(() => {
    return batchItemsWithMetrics.filter(it => {
      if (searchFilter.trim()) {
        const query = searchFilter.toLowerCase();
        const matchesName = (it.material_name || '').toLowerCase().includes(query);
        const matchesCode = (it.material_code || '').toLowerCase().includes(query);
        if (!matchesName && !matchesCode) return false;
      }
      if (stockTabFilter === 'com_estoque') return it.availableStock > 0;
      if (stockTabFilter === 'deficit') return it.deficit > 0;
      return true;
    });
  }, [batchItemsWithMetrics, searchFilter, stockTabFilter]);

  const selectedBatchStats = useMemo(() => {
    const selected = batchItemsWithMetrics.filter(it => it.isSelected);
    const fullyAvailable = selected.filter(it => it.deficit === 0).length;
    const withDeficit = selected.filter(it => it.deficit > 0).length;
    const overBudgetCount = selected.filter(it => it.isOverBudget).length;
    return {
      totalSelected: selected.length,
      fullyAvailable,
      withDeficit,
      overBudgetCount,
      requiresAdminApproval: overBudgetCount > 0
    };
  }, [batchItemsWithMetrics]);

  // Handlers da Aba 1 (Orçamento)
  const handleToggleBudgetItem = (id: number) => {
    const next = new Set(selectedItemIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedItemIds(next);
  };

  const handleSelectAllBudget = (select: boolean) => {
    if (select) {
      const allIds = new Set<number>(budgetItems.map(it => it.id));
      setSelectedItemIds(allIds);
    } else {
      setSelectedItemIds(new Set());
    }
  };

  const handleBudgetQuantityChange = (id: number, val: string) => {
    const num = parseFloat(val);
    const newQty = isNaN(num) || num < 0 ? 0 : num;
    setItemQuantities(prev => ({
      ...prev,
      [id]: newQty
    }));
    if (newQty > 0) {
      setSelectedItemIds(prev => new Set(prev).add(id));
    }
  };

  const handleRemoveBudgetItem = (id: number) => {
    setBudgetItems(prev => prev.filter(it => it.id !== id));
    setSelectedItemIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const handleAddExtraBudgetItem = () => {
    if (!extraMaterialId || Number(extraQuantity) <= 0) return;
    const mat = materials.find(m => m.id === Number(extraMaterialId));
    if (!mat) return;
    const newId = Date.now() + Math.floor(Math.random() * 1000);
    const qty = Number(extraQuantity);

    const newItem = {
      id: newId,
      material_id: mat.id,
      material_name: mat.name,
      material_code: mat.code,
      unit: mat.unit,
      quantity: qty,
      isExtra: true
    };

    setBudgetItems(prev => [newItem, ...prev]);
    setSelectedItemIds(prev => new Set(prev).add(newId));
    setItemQuantities(prev => ({ ...prev, [newId]: qty }));
    setExtraMaterialId('');
    setExtraQuantity('1');
    setExtraSearch('');
    setIsAddingExtra(false);
  };

  const handleConfirmReplace = (itemId: number) => {
    if (!replaceWithMaterialId) return;
    const newMat = materials.find(m => m.id === Number(replaceWithMaterialId));
    if (!newMat) return;

    setBudgetItems(prev => prev.map(it => {
      if (it.id === itemId) {
        return {
          ...it,
          material_id: newMat.id,
          material_name: newMat.name,
          material_code: newMat.code,
          unit: newMat.unit,
          isReplaced: true
        };
      }
      return it;
    }));
    setReplacingItemId(null);
    setReplaceWithMaterialId('');
    setReplaceSearch('');
  };

  // ==========================================
  // CÁLCULOS: ABA 2 (SOLICITAÇÃO AVULSA)
  // ==========================================
  const customItemsWithMetrics = useMemo(() => {
    return customItems.map((it) => {
      const mat = materials.find(m => m.id === it.material_id) || {
        stock_physical: 0,
        stock_reserved: 0
      };
      const physical = Number(mat.stock_physical ?? 0);
      const reserved = Number(mat.stock_reserved ?? 0);
      const available = Math.max(0, physical - reserved);
      const requestedQty = Number(customQuantities[it.id] ?? it.quantity ?? 1);
      const reservable = Math.min(requestedQty, available);
      const deficit = Math.max(0, requestedQty - available);
      const isSelected = selectedCustomIds.has(it.id);

      const quota = quotasMap[it.material_id];
      const isInBudget = Boolean(quota && quota.budgetQuantity > 0);
      const budgetQuantity = quota ? Number(quota.budgetQuantity || 0) : 0;
      const previouslyRequested = quota ? Number(quota.previouslyRequested || 0) : 0;
      const remainingQuota = quota ? Number(quota.remainingQuota || 0) : 0;

      const isOverBudget = !isInBudget || requestedQty > remainingQuota;
      const extraQuantity = !isInBudget ? requestedQty : Math.max(0, Number((requestedQty - remainingQuota).toFixed(2)));

      return {
        ...it,
        availableStock: available,
        currentRequestedQty: requestedQty,
        reservable,
        deficit,
        isSelected,
        isInBudget,
        budgetQuantity,
        previouslyRequested,
        remainingQuota,
        isOverBudget,
        extraQuantity
      };
    });
  }, [customItems, materials, customQuantities, selectedCustomIds, quotasMap]);

  const filteredCustomItems = useMemo(() => {
    return customItemsWithMetrics.filter(it => {
      if (customListFilter.trim()) {
        const query = customListFilter.toLowerCase();
        const matchesName = (it.material_name || '').toLowerCase().includes(query);
        const matchesCode = (it.material_code || '').toLowerCase().includes(query);
        if (!matchesName && !matchesCode) return false;
      }
      if (customStockFilter === 'com_estoque') return it.availableStock > 0;
      if (customStockFilter === 'deficit') return it.deficit > 0;
      return true;
    });
  }, [customItemsWithMetrics, customListFilter, customStockFilter]);

  const selectedCustomStats = useMemo(() => {
    const selected = customItemsWithMetrics.filter(it => it.isSelected);
    const fullyAvailable = selected.filter(it => it.deficit === 0).length;
    const withDeficit = selected.filter(it => it.deficit > 0).length;
    const overBudgetCount = selected.filter(it => it.isOverBudget).length;
    return {
      totalSelected: selected.length,
      fullyAvailable,
      withDeficit,
      overBudgetCount,
      requiresAdminApproval: overBudgetCount > 0
    };
  }, [customItemsWithMetrics]);

  // Handlers da Aba 2 (Avulsos)
  const handleAddCustomItem = () => {
    if (!customMaterialId || Number(customQuantity) <= 0) return;
    const mat = materials.find(m => m.id === Number(customMaterialId));
    if (!mat) return;
    const qty = Number(customQuantity);

    const existing = customItems.find(it => it.material_id === mat.id);
    if (existing) {
      const nextQty = (customQuantities[existing.id] || existing.quantity) + qty;
      setCustomQuantities(prev => ({ ...prev, [existing.id]: nextQty }));
      setSelectedCustomIds(prev => new Set(prev).add(existing.id));
    } else {
      const newId = Date.now() + Math.floor(Math.random() * 1000);
      const newItem = {
        id: newId,
        material_id: mat.id,
        material_name: mat.name,
        material_code: mat.code,
        unit: mat.unit,
        quantity: qty
      };
      setCustomItems(prev => [newItem, ...prev]);
      setSelectedCustomIds(prev => new Set(prev).add(newId));
      setCustomQuantities(prev => ({ ...prev, [newId]: qty }));
    }
    setCustomMaterialId('');
    setCustomQuantity('1');
    setCustomMaterialSearch('');
  };

  const handleRemoveCustomItem = (id: number) => {
    setCustomItems(prev => prev.filter(it => it.id !== id));
    setSelectedCustomIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const handleToggleCustomItem = (id: number) => {
    const next = new Set(selectedCustomIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedCustomIds(next);
  };

  const handleSelectAllCustom = (select: boolean) => {
    if (select) {
      const allIds = new Set<number>(customItems.map(it => it.id));
      setSelectedCustomIds(allIds);
    } else {
      setSelectedCustomIds(new Set());
    }
  };

  const handleCustomQuantityChange = (id: number, val: string) => {
    const num = parseFloat(val);
    setCustomQuantities(prev => ({
      ...prev,
      [id]: isNaN(num) || num < 0 ? 0 : num
    }));
  };

  // ==========================================
  // FILTRAGEM DO CATÁLOGO DE MATERIAIS (757 ITENS)
  // ==========================================
  const filteredCatalogForExtra = useMemo(() => {
    if (!extraSearch.trim()) return materials.slice(0, 100);
    const q = extraSearch.toLowerCase();
    return materials.filter(m => m.name.toLowerCase().includes(q) || (m.code && m.code.toLowerCase().includes(q))).slice(0, 100);
  }, [materials, extraSearch]);

  const filteredCatalogForReplace = useMemo(() => {
    if (!replaceSearch.trim()) return materials.slice(0, 100);
    const q = replaceSearch.toLowerCase();
    return materials.filter(m => m.name.toLowerCase().includes(q) || (m.code && m.code.toLowerCase().includes(q))).slice(0, 100);
  }, [materials, replaceSearch]);

  const filteredCatalogForCustom = useMemo(() => {
    if (!customMaterialSearch.trim()) return materials.slice(0, 100);
    const q = customMaterialSearch.toLowerCase();
    return materials.filter(m => m.name.toLowerCase().includes(q) || (m.code && m.code.toLowerCase().includes(q))).slice(0, 100);
  }, [materials, customMaterialSearch]);

  const selectedCustomMat = materials.find(m => m.id === Number(customMaterialId));
  const availableStockCustom = selectedCustomMat ? Math.max(0, selectedCustomMat.stock_physical - selectedCustomMat.stock_reserved) : 0;

  const selectedExtraMat = materials.find(m => m.id === Number(extraMaterialId));
  const availableStockExtra = selectedExtraMat ? Math.max(0, selectedExtraMat.stock_physical - selectedExtraMat.stock_reserved) : 0;

  // ==========================================
  // SUBMISSÃO DA SOLICITAÇÃO
  // ==========================================
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
        const itemsToSubmit = customItemsWithMetrics
          .filter(it => it.isSelected && it.currentRequestedQty > 0 && it.material_id)
          .map(it => ({
            materialId: it.material_id,
            quantity: it.currentRequestedQty
          }));

        if (itemsToSubmit.length === 0) {
          setError('Nenhum material adicionado ou selecionado na lista avulsa.');
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
      <div className="w-full max-w-4xl bg-dark-900 rounded-3xl shadow-2xl border border-dark-700 overflow-hidden flex flex-col max-h-[92vh] text-slate-100">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-dark-850 border-b border-dark-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-sabrar-950/80 border border-sabrar-500/40 flex items-center justify-center text-sabrar-400">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white">Nova Solicitação de Materiais</h3>
              <p className="text-xs text-slate-400">Módulo da Engenharia de Obras • Verificação automática de estoque e compras</p>
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
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                Projeto / Obra Destino *
              </label>
              {currentUser?.role === 'engenharia' && (
                <span className="text-[10px] font-bold text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-800/60">
                  Obras sob sua responsabilidade ({currentUser?.name})
                </span>
              )}
            </div>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value ? Number(e.target.value) : '')}
              className="w-full text-xs sm:text-sm p-3 rounded-2xl border border-dark-700 bg-dark-850 focus:outline-none focus:ring-2 focus:ring-sabrar-500 text-white font-semibold"
              required
            >
              <option value="">Selecione a obra...</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name} ({p.client}) {p.responsible_engineer ? `[${p.responsible_engineer}]` : ''}
                </option>
              ))}
            </select>
            {currentUser?.role === 'engenharia' && projects.length === 0 && (
              <p className="text-[11px] text-amber-400/90 mt-1">
                Nenhuma obra com status ativo está atribuída ao seu perfil de engenheiro ({currentUser?.name}).
              </p>
            )}

            {selectedProject && (
              <div className="mt-2.5 p-3 rounded-2xl bg-dark-800/80 border border-dark-700/80 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-xl bg-amber-950/80 border border-amber-600/40 flex items-center justify-center text-amber-400 shrink-0">
                    <HardHat className="w-4 h-4" />
                  </div>
                  <div className="text-xs">
                    <span className="text-slate-400 font-medium">Engenheiro(s) da Obra: </span>
                    <strong className={selectedProject.responsible_engineer ? "text-amber-300 font-bold" : "text-rose-400 font-bold"}>
                      {selectedProject.responsible_engineer || 'Pendente de atribuição'}
                    </strong>
                  </div>
                </div>
                {currentUser?.role === 'admin' && (
                  <button
                    type="button"
                    onClick={() => setIsAssignModalOpen(true)}
                    className="px-2.5 py-1 text-[11px] font-bold text-amber-400 hover:text-white bg-amber-950/60 hover:bg-amber-900 border border-amber-700/50 rounded-xl transition-colors active:scale-95"
                  >
                    {selectedProject.responsible_engineer ? 'Alterar Engenheiro(s)' : '+ Atribuir Engenheiro(s)'}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Seletor de Modo: Orçamento da Obra vs Solicitação Avulsa (Montar Lista) */}
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
                onClick={() => setRequestMode('custom')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                  requestMode === 'custom'
                    ? 'bg-sabrar-600 text-white shadow-md shadow-sabrar-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-dark-800'
                }`}
              >
                <Package className="w-4 h-4" />
                <span>
                  Solicitação Avulsa (Montar Lista) {customItems.length > 0 ? `(${customItems.length})` : ''}
                </span>
              </button>
            </div>
          )}

          {/* ========================================================= */}
          {/* MODO A: MATERIAIS DO ORÇAMENTO DA OBRA (COM EDIÇÃO LIVRE) */}
          {/* ========================================================= */}
          {requestMode === 'batch' && selectedProjectId && (
            <div className="space-y-3">
              {loadingBudget ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  Carregando lista de materiais orçados para esta obra...
                </div>
              ) : budgetItems.length === 0 ? (
                <div className="p-4 bg-dark-850 border border-dark-700 rounded-2xl text-center text-xs text-slate-400">
                  Esta obra ainda não possui orçamento de materiais salvo. Você pode adicionar materiais usando o modo "Solicitação Avulsa".
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Resumo Dinâmico em Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
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
                    <div className={`p-3 rounded-2xl border ${selectedBatchStats.requiresAdminApproval ? 'bg-amber-950/40 border-amber-600/50' : 'bg-emerald-950/30 border-emerald-600/30'}`}>
                      <div className={`text-[10px] uppercase font-bold flex items-center justify-center gap-1 ${selectedBatchStats.requiresAdminApproval ? 'text-amber-400' : 'text-emerald-400'}`}>
                        <AlertTriangle className="w-3 h-3" /> Status Orçamento
                      </div>
                      <div className={`text-lg font-black ${selectedBatchStats.requiresAdminApproval ? 'text-amber-300' : 'text-emerald-300'}`}>
                        {selectedBatchStats.requiresAdminApproval ? `${selectedBatchStats.overBudgetCount} item(s) extra` : '100% na Cota'}
                      </div>
                    </div>
                  </div>

                  {/* Barra de Ações: Seleção, Filtros, Busca e Adicionar Material Extra */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => handleSelectAllBudget(selectedItemIds.size !== budgetItems.length)}
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

                    <div className="flex items-center gap-2">
                      <div className="relative flex-1 sm:w-48">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={searchFilter}
                          onChange={(e) => setSearchFilter(e.target.value)}
                          placeholder="Filtrar por nome ou código..."
                          className="w-full text-xs pl-8 pr-3 py-1.5 rounded-xl bg-dark-850 border border-dark-700 focus:outline-none focus:border-sabrar-500 text-white placeholder-slate-500"
                        />
                      </div>

                      {/* Botão para Adicionar Material Extra (Não Previsto) */}
                      <button
                        type="button"
                        onClick={() => setIsAddingExtra(!isAddingExtra)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm ${
                          isAddingExtra
                            ? 'bg-amber-600 hover:bg-amber-500 text-white'
                            : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
                        }`}
                        title="Adicionar material que não estava no orçamento original"
                      >
                        <Plus className="w-4 h-4" />
                        <span>{isAddingExtra ? 'Fechar' : 'Adicionar Material Extra'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Painel Expansível: Adicionar Material Extra à Lista */}
                  {isAddingExtra && (
                    <div className="p-3.5 bg-emerald-950/30 border border-emerald-500/50 rounded-2xl space-y-3 animate-in fade-in slide-in-from-top-2">
                      <div className="flex items-center justify-between text-xs text-emerald-300 font-bold">
                        <div className="flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4 text-emerald-400" />
                          <span>Adicionar Material Extra (Não Previsto no Orçamento Inicial)</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-normal">Base de 757 Materiais SABRAR</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                        <div className="sm:col-span-4">
                          <input
                            type="text"
                            value={extraSearch}
                            onChange={(e) => setExtraSearch(e.target.value)}
                            placeholder="Pesquisar material por nome..."
                            className="w-full text-xs p-2 rounded-xl bg-dark-900 border border-dark-700 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                        <div className="sm:col-span-5">
                          <select
                            value={extraMaterialId}
                            onChange={(e) => setExtraMaterialId(e.target.value ? Number(e.target.value) : '')}
                            className="w-full text-xs p-2 rounded-xl bg-dark-900 border border-dark-700 text-white focus:outline-none focus:border-emerald-500"
                          >
                            <option value="">Selecione o material da base ({filteredCatalogForExtra.length})...</option>
                            {filteredCatalogForExtra.map((m) => {
                              const disp = Math.max(0, m.stock_physical - m.stock_reserved);
                              return (
                                <option key={m.id} value={m.id}>
                                  {m.code ? `[${m.code}] ` : ''}{m.name} ({m.unit}) — Disp: {disp}
                                </option>
                              );
                            })}
                          </select>
                        </div>
                        <div className="sm:col-span-2 flex items-center gap-1">
                          <input
                            type="number"
                            step="any"
                            min="0.1"
                            value={extraQuantity}
                            onChange={(e) => setExtraQuantity(e.target.value)}
                            placeholder="Qtd"
                            className="w-full text-xs font-bold p-2 rounded-xl bg-dark-900 border border-dark-700 text-white text-right focus:outline-none focus:border-emerald-500"
                          />
                          <span className="text-[11px] text-slate-400 w-8 truncate">
                            {selectedExtraMat?.unit || 'un'}
                          </span>
                        </div>
                        <div className="sm:col-span-1">
                          <button
                            type="button"
                            onClick={handleAddExtraBudgetItem}
                            disabled={!extraMaterialId || Number(extraQuantity) <= 0}
                            className="w-full p-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center shadow-sm"
                            title="Incluir na lista de materiais"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {selectedExtraMat && (
                        <div className="text-[11px] text-slate-300 flex items-center gap-3 px-1">
                          <span>Estoque Físico: <strong>{selectedExtraMat.stock_physical} {selectedExtraMat.unit}</strong></span>
                          <span>Reservado: <strong className="text-amber-400">{selectedExtraMat.stock_reserved} {selectedExtraMat.unit}</strong></span>
                          <span>Disponível Imediato: <strong className="text-emerald-400">{availableStockExtra} {selectedExtraMat.unit}</strong></span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Lista de Itens com Checkbox, Edição de Quantidade, Troca e Exclusão */}
                  <div className="border border-dark-750 rounded-2xl overflow-hidden bg-dark-850 max-h-80 overflow-y-auto divide-y divide-dark-750">
                    {filteredBatchItems.length === 0 ? (
                      <div className="py-8 text-center text-xs text-slate-500">
                        Nenhum material encontrado para o filtro.
                      </div>
                    ) : (
                      filteredBatchItems.map((it) => {
                        const isReplacing = replacingItemId === it.id;

                        if (isReplacing) {
                          return (
                            <div key={it.id} className="p-3 bg-amber-950/30 border-l-4 border-amber-500 space-y-2">
                              <div className="flex items-center justify-between text-xs text-amber-300 font-bold">
                                <span>Substituir material: "{it.material_name}"</span>
                                <button
                                  type="button"
                                  onClick={() => setReplacingItemId(null)}
                                  className="text-slate-400 hover:text-white"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                                <div className="sm:col-span-5">
                                  <input
                                    type="text"
                                    value={replaceSearch}
                                    onChange={(e) => setReplaceSearch(e.target.value)}
                                    placeholder="Pesquisar novo material..."
                                    className="w-full text-xs p-2 rounded-xl bg-dark-900 border border-dark-700 text-white placeholder-slate-500"
                                  />
                                </div>
                                <div className="sm:col-span-5">
                                  <select
                                    value={replaceWithMaterialId}
                                    onChange={(e) => setReplaceWithMaterialId(e.target.value ? Number(e.target.value) : '')}
                                    className="w-full text-xs p-2 rounded-xl bg-dark-900 border border-dark-700 text-white"
                                  >
                                    <option value="">Selecione o substituto ({filteredCatalogForReplace.length})...</option>
                                    {filteredCatalogForReplace.map((m) => (
                                      <option key={m.id} value={m.id}>
                                        {m.code ? `[${m.code}] ` : ''}{m.name} ({m.unit})
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div className="sm:col-span-2 flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleConfirmReplace(it.id)}
                                    disabled={!replaceWithMaterialId}
                                    className="w-full py-2 px-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-extrabold rounded-xl text-xs transition-colors"
                                  >
                                    Trocar
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        }

                        const matObj = materials.find(m => m.id === it.material_id);

                        return (
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
                                onChange={() => handleToggleBudgetItem(it.id)}
                                className="w-4 h-4 rounded mt-2 accent-sabrar-600 cursor-pointer"
                              />

                              {matObj?.image_url && (
                                <div className="w-10 h-10 rounded-xl bg-dark-950 border border-dark-700 overflow-hidden shrink-0 flex items-center justify-center p-0.5 shadow-sm">
                                  <img src={matObj.image_url} alt="" className="w-full h-full object-contain" />
                                </div>
                              )}

                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-xs text-white truncate">{it.material_name}</span>
                                  {it.isExtra && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                                      <Sparkles className="w-3 h-3 text-emerald-400" /> Extra Engenharia
                                    </span>
                                  )}
                                  {it.isReplaced && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                                      <RefreshCw className="w-3 h-3 text-amber-400" /> Substituído
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-1 flex-wrap">
                                  <span className="font-mono text-slate-300">{it.material_code || 'S/ Código'}</span>
                                  <span>• Orçado: <strong className="text-slate-200">{it.budgetQuantity} {it.unit}</strong></span>
                                  <span>• Já Solicitado: <strong className="text-slate-300">{it.previouslyRequested} {it.unit}</strong></span>
                                  <span>• Saldo Disponível: <strong className={it.remainingQuota > 0 ? 'text-emerald-400 font-bold' : 'text-slate-400 font-bold'}>{it.remainingQuota} {it.unit}</strong></span>
                                  {it.remainingQuota <= 0 && (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-dark-750 text-slate-300">
                                      Cota 100% consumida
                                    </span>
                                  )}
                                  {it.isOverBudget ? (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-500/50 flex items-center gap-1">
                                      <AlertTriangle className="w-3 h-3 text-amber-400" />
                                      Excede cota em +{it.extraQuantity} {it.unit} (Aprovação Admin)
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950/60 text-emerald-300 border border-emerald-500/30">
                                      ✓ Cota respeitada
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 self-end sm:self-center">
                              {/* Input de Quantidade */}
                              <div className="flex items-center gap-1.5">
                                <span className="text-[11px] text-slate-400">Qtd:</span>
                                <input
                                  type="number"
                                  step="any"
                                  min="0"
                                  disabled={!it.isSelected}
                                  value={itemQuantities[it.id] !== undefined ? itemQuantities[it.id] : (it.remainingQuota > 0 ? it.remainingQuota : 0)}
                                  onChange={(e) => handleBudgetQuantityChange(it.id, e.target.value)}
                                  className="w-20 text-xs font-bold p-1.5 rounded-xl border border-dark-700 bg-dark-900 focus:outline-none focus:border-sabrar-500 text-white text-right disabled:opacity-40"
                                />
                                <span className="text-[11px] text-slate-400 w-8 truncate">{it.unit}</span>
                              </div>

                              {/* Status de Estoque */}
                              <div className="min-w-[130px] text-right">
                                {it.deficit === 0 ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sabrar-950 text-sabrar-300 border border-sabrar-500/40 text-[10px] font-bold">
                                    <CheckCircle className="w-3 h-3 text-sabrar-400" />
                                    Disp: {it.availableStock}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-700/60 text-[10px] font-bold">
                                    <ShoppingCart className="w-3 h-3 text-rose-400" />
                                    Déficit: {it.deficit}
                                  </span>
                                )}
                              </div>

                              {/* Botão Trocar Material */}
                              <button
                                type="button"
                                onClick={() => {
                                  setReplacingItemId(it.id);
                                  setReplaceSearch('');
                                  setReplaceWithMaterialId('');
                                }}
                                className="p-1.5 rounded-xl text-slate-400 hover:text-amber-300 hover:bg-dark-800 transition-colors"
                                title="Trocar por outro material da base"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                              </button>

                              {/* Botão Remover Item da Solicitação */}
                              <button
                                type="button"
                                onClick={() => handleRemoveBudgetItem(it.id)}
                                className="p-1.5 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-dark-800 transition-colors"
                                title="Tirar da solicitação"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* MODO B: SOLICITAÇÃO AVULSA (MONTAR LISTA DE ITENS AVULSOS)*/}
          {/* ========================================================= */}
          {requestMode === 'custom' && selectedProjectId && (
            <div className="space-y-4">
              {/* Painel de Seleção e Inclusão de Material Avulso */}
              <div className="p-4 bg-dark-850 rounded-2xl border border-dark-700 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-white flex items-center gap-1.5">
                    <Plus className="w-4 h-4 text-sabrar-400" />
                    Selecionar Material da Base para a Lista Avulsa
                  </span>
                  <span className="text-[10px] text-slate-400">757 materiais cadastrados</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                  <div className="sm:col-span-4">
                    <input
                      type="text"
                      value={customMaterialSearch}
                      onChange={(e) => setCustomMaterialSearch(e.target.value)}
                      placeholder="Pesquisar material por nome ou código..."
                      className="w-full text-xs p-2.5 rounded-xl bg-dark-900 border border-dark-700 text-white placeholder-slate-500 focus:outline-none focus:border-sabrar-500"
                    />
                  </div>
                  <div className="sm:col-span-5">
                    <select
                      value={customMaterialId}
                      onChange={(e) => setCustomMaterialId(e.target.value ? Number(e.target.value) : '')}
                      className="w-full text-xs p-2.5 rounded-xl bg-dark-900 border border-dark-700 text-white focus:outline-none focus:border-sabrar-500"
                    >
                      <option value="">Selecione o material ({filteredCatalogForCustom.length} opções)...</option>
                      {filteredCatalogForCustom.map((m) => {
                        const disp = Math.max(0, m.stock_physical - m.stock_reserved);
                        return (
                          <option key={m.id} value={m.id}>
                            {m.code ? `[${m.code}] ` : ''}{m.name} ({m.unit}) — Disp: {disp}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  <div className="sm:col-span-2 flex items-center gap-1">
                    <input
                      type="number"
                      step="any"
                      min="0.1"
                      value={customQuantity}
                      onChange={(e) => setCustomQuantity(e.target.value)}
                      placeholder="Qtd"
                      className="w-full text-xs font-bold p-2.5 rounded-xl bg-dark-900 border border-dark-700 text-white text-right focus:outline-none focus:border-sabrar-500"
                    />
                    <span className="text-[11px] text-slate-400 w-8 truncate">
                      {selectedCustomMat?.unit || 'un'}
                    </span>
                  </div>
                  <div className="sm:col-span-1">
                    <button
                      type="button"
                      onClick={handleAddCustomItem}
                      disabled={!customMaterialId || Number(customQuantity) <= 0}
                      className="w-full p-2.5 bg-sabrar-600 hover:bg-sabrar-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center shadow-md shadow-sabrar-600/20 active:scale-95"
                      title="Adicionar material à lista"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {selectedCustomMat && (
                  <div className="grid grid-cols-3 gap-2 p-2.5 bg-dark-900 rounded-xl border border-dark-750 text-center text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-bold">FÍSICO</span>
                      <span className="font-extrabold text-white">{selectedCustomMat.stock_physical} {selectedCustomMat.unit}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-bold">RESERVADO</span>
                      <span className="font-extrabold text-amber-400">{selectedCustomMat.stock_reserved} {selectedCustomMat.unit}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-bold">DISPONÍVEL</span>
                      <span className="font-extrabold text-sabrar-400">{availableStockCustom} {selectedCustomMat.unit}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Lista dos Itens Avulsos Montada */}
              {customItems.length === 0 ? (
                <div className="py-12 px-4 bg-dark-850 border border-dark-700 rounded-2xl text-center space-y-2">
                  <Package className="w-8 h-8 text-slate-500 mx-auto" />
                  <div className="text-xs font-bold text-slate-300">Nenhum material adicionado à lista avulsa ainda.</div>
                  <p className="text-[11px] text-slate-500 max-w-md mx-auto">
                    Selecione um material no campo acima, informe a quantidade e clique no botão <strong>+</strong> para ir adicionando de um em um e montar sua lista completa.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Resumo Dinâmico em Cards da Lista Avulsa */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                    <div className="p-3 bg-dark-850 rounded-2xl border border-dark-700">
                      <div className="text-[10px] uppercase font-bold text-slate-400">Selecionados</div>
                      <div className="text-lg font-black text-white">{selectedCustomStats.totalSelected} de {customItems.length}</div>
                    </div>
                    <div className="p-3 bg-sabrar-950/50 rounded-2xl border border-sabrar-500/40">
                      <div className="text-[10px] uppercase font-bold text-sabrar-400 flex items-center justify-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Almoxarifado
                      </div>
                      <div className="text-lg font-black text-sabrar-300">{selectedCustomStats.fullyAvailable} com estoque</div>
                    </div>
                    <div className="p-3 bg-rose-950/40 rounded-2xl border border-rose-700/60">
                      <div className="text-[10px] uppercase font-bold text-rose-400 flex items-center justify-center gap-1">
                        <ShoppingCart className="w-3 h-3" /> Compras
                      </div>
                      <div className="text-lg font-black text-rose-300">{selectedCustomStats.withDeficit} com déficit</div>
                    </div>
                    <div className={`p-3 rounded-2xl border ${selectedCustomStats.requiresAdminApproval ? 'bg-amber-950/40 border-amber-600/50' : 'bg-emerald-950/30 border-emerald-600/30'}`}>
                      <div className={`text-[10px] uppercase font-bold flex items-center justify-center gap-1 ${selectedCustomStats.requiresAdminApproval ? 'text-amber-400' : 'text-emerald-400'}`}>
                        <AlertTriangle className="w-3 h-3" /> Status Orçamento
                      </div>
                      <div className={`text-lg font-black ${selectedCustomStats.requiresAdminApproval ? 'text-amber-300' : 'text-emerald-300'}`}>
                        {selectedCustomStats.requiresAdminApproval ? `${selectedCustomStats.overBudgetCount} item(s) extra` : '100% na Cota'}
                      </div>
                    </div>
                  </div>

                  {/* Barra de Ações da Lista Avulsa */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => handleSelectAllCustom(selectedCustomIds.size !== customItems.length)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-dark-800 hover:bg-dark-750 text-white text-xs font-bold border border-dark-700"
                      >
                        {selectedCustomIds.size === customItems.length ? (
                          <>
                            <CheckSquare className="w-4 h-4 text-sabrar-400" />
                            <span>Desmarcar Todos</span>
                          </>
                        ) : (
                          <>
                            <Square className="w-4 h-4 text-slate-400" />
                            <span>Selecionar Todos ({customItems.length})</span>
                          </>
                        )}
                      </button>

                      <div className="flex items-center gap-1 text-[11px]">
                        <button
                          type="button"
                          onClick={() => setCustomStockFilter('todos')}
                          className={`px-2 py-1 rounded-lg font-semibold ${customStockFilter === 'todos' ? 'bg-dark-700 text-white' : 'text-slate-400'}`}
                        >
                          Todos ({customItems.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setCustomStockFilter('com_estoque')}
                          className={`px-2 py-1 rounded-lg font-semibold ${customStockFilter === 'com_estoque' ? 'bg-sabrar-950 text-sabrar-300 border border-sabrar-500/40' : 'text-slate-400'}`}
                        >
                          Com Estoque
                        </button>
                        <button
                          type="button"
                          onClick={() => setCustomStockFilter('deficit')}
                          className={`px-2 py-1 rounded-lg font-semibold ${customStockFilter === 'deficit' ? 'bg-rose-950 text-rose-300 border border-rose-700/60' : 'text-slate-400'}`}
                        >
                          Com Déficit
                        </button>
                      </div>
                    </div>

                    <div className="relative flex-1 sm:max-w-xs">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={customListFilter}
                        onChange={(e) => setCustomListFilter(e.target.value)}
                        placeholder="Filtrar materiais na lista..."
                        className="w-full text-xs pl-8 pr-3 py-1.5 rounded-xl bg-dark-850 border border-dark-700 focus:outline-none focus:border-sabrar-500 text-white placeholder-slate-500"
                      />
                    </div>
                  </div>

                  {/* Tabela de Itens Avulsos */}
                  <div className="border border-dark-750 rounded-2xl overflow-hidden bg-dark-850 max-h-72 overflow-y-auto divide-y divide-dark-750">
                    {filteredCustomItems.map((it) => {
                      const customMatObj = materials.find(m => m.id === it.material_id);

                      return (
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
                              onChange={() => handleToggleCustomItem(it.id)}
                              className="w-4 h-4 rounded mt-2 accent-sabrar-600 cursor-pointer"
                            />

                            {customMatObj?.image_url && (
                              <div className="w-10 h-10 rounded-xl bg-dark-950 border border-dark-700 overflow-hidden shrink-0 flex items-center justify-center p-0.5 shadow-sm">
                                <img src={customMatObj.image_url} alt="" className="w-full h-full object-contain" />
                              </div>
                            )}

                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-xs text-white truncate">{it.material_name}</span>
                              {!it.isInBudget ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                                  <Sparkles className="w-3 h-3 text-amber-400" /> Fora do Orçamento (Aprovação Admin)
                                </span>
                              ) : null}
                            </div>
                            <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-1 flex-wrap font-mono">
                              <span>{it.material_code || 'S/ Código'}</span>
                              <span>• Unidade: <strong className="text-slate-200">{it.unit}</strong></span>
                              {it.isInBudget ? (
                                <>
                                  <span>• Orçado: <strong className="text-slate-200">{it.budgetQuantity} {it.unit}</strong></span>
                                  <span>• Já Solicitado: <strong className="text-slate-300">{it.previouslyRequested} {it.unit}</strong></span>
                                  <span>• Saldo: <strong className={it.remainingQuota > 0 ? 'text-emerald-400 font-bold' : 'text-slate-400 font-bold'}>{it.remainingQuota} {it.unit}</strong></span>
                                  {it.isOverBudget ? (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-500/50 flex items-center gap-1">
                                      <AlertTriangle className="w-3 h-3 text-amber-400" />
                                      Excede cota em +{it.extraQuantity} {it.unit} (Aprovação Admin)
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950/60 text-emerald-300 border border-emerald-500/30">
                                      ✓ Cota respeitada
                                    </span>
                                  )}
                                </>
                              ) : null}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center">
                          {/* Input de Quantidade */}
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] text-slate-400">Qtd:</span>
                            <input
                              type="number"
                              step="any"
                              min="0.1"
                              disabled={!it.isSelected}
                              value={customQuantities[it.id] ?? it.quantity}
                              onChange={(e) => handleCustomQuantityChange(it.id, e.target.value)}
                              className="w-20 text-xs font-bold p-1.5 rounded-xl border border-dark-700 bg-dark-900 focus:outline-none focus:border-sabrar-500 text-white text-right disabled:opacity-40"
                            />
                            <span className="text-[11px] text-slate-400 w-8 truncate">{it.unit}</span>
                          </div>

                          {/* Status de Estoque */}
                          <div className="min-w-[130px] text-right">
                            {it.deficit === 0 ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sabrar-950 text-sabrar-300 border border-sabrar-500/40 text-[10px] font-bold">
                                <CheckCircle className="w-3 h-3 text-sabrar-400" />
                                Disp: {it.availableStock}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-700/60 text-[10px] font-bold">
                                <ShoppingCart className="w-3 h-3 text-rose-400" />
                                Déficit: {it.deficit}
                              </span>
                            )}
                          </div>

                          {/* Botão Remover Item */}
                          <button
                            type="button"
                            onClick={() => handleRemoveCustomItem(it.id)}
                            className="p-1.5 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-dark-800 transition-colors"
                            title="Remover material da lista"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Banner de Aviso de Aprovação de Administrador */}
          {((requestMode === 'batch' && selectedBatchStats.requiresAdminApproval) ||
            (requestMode === 'custom' && selectedCustomStats.requiresAdminApproval)) && (
            <div className="p-3.5 bg-amber-950/40 border border-amber-500/50 rounded-2xl flex items-start gap-3 text-amber-200 text-xs">
              <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-amber-300">Solicitação Contém Materiais Extras / Acima da Cota Orçada</div>
                <p className="text-amber-200/80 text-[11px] mt-0.5">
                  Esta solicitação ultrapassa as quantidades ou inclui itens fora do orçamento aprovado da obra.
                  Conforme as diretrizes da Sabrar Engenharia, ela será encaminhada para <strong>análise e aprovação de um Administrador</strong> antes de liberar a separação e compras.
                </p>
              </div>
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
            {(() => {
              const isApprovalRequired =
                (requestMode === 'batch' && selectedBatchStats.requiresAdminApproval) ||
                (requestMode === 'custom' && selectedCustomStats.requiresAdminApproval);
              const count = requestMode === 'batch' ? selectedBatchStats.totalSelected : selectedCustomStats.totalSelected;

              return (
                <button
                  type="submit"
                  disabled={
                    loading ||
                    (requestMode === 'batch' && selectedBatchStats.totalSelected === 0) ||
                    (requestMode === 'custom' && selectedCustomStats.totalSelected === 0)
                  }
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-xs font-bold shadow-md transition-all disabled:opacity-50 active:scale-95 ${
                    isApprovalRequired
                      ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/30'
                      : 'bg-sabrar-600 hover:bg-sabrar-500 shadow-sabrar-600/30'
                  }`}
                >
                  {isApprovalRequired ? <AlertTriangle className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                  <span>
                    {loading
                      ? 'Processando...'
                      : isApprovalRequired
                      ? `Enviar para Aprovação do Administrador (${count} materiais)`
                      : `Emitir Solicitação (${count} materiais)`}
                  </span>
                </button>
              );
            })()}
          </div>
        </form>
      </div>

      {selectedProject && (
        <AssignEngineersModal
          isOpen={isAssignModalOpen}
          onClose={() => setIsAssignModalOpen(false)}
          projectId={selectedProject.id}
          projectName={selectedProject.name}
          projectCode={selectedProject.code}
          currentEngineerIds={selectedProject.assigned_engineer_ids || []}
          onSuccess={async () => {
            setIsAssignModalOpen(false);
            const projs = await api.getProjects().catch(() => []);
            setProjects(projs);
          }}
        />
      )}
    </div>
  );
};
