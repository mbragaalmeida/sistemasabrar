import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  HardHat,
  Calendar,
  Building2,
  ChevronDown
} from 'lucide-react';
import { Project, Material } from '../../types';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { AssignEngineersModal } from './AssignEngineersModal';
import { formatDateBR, getTodayBR, addDaysBR, parseDateBRToISO, maskDateInput } from '../../utils/dateUtils';
import { parsePackageInfo, getUnitOptions, convertQuantity, getUnitPriceForUnit, formatMoney, COMMON_UNITS } from '../../utils/unitConverter';

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
  const [selectedProjectId, setSelectedProjectId] = useState<number | string>('');
  const [priority, setPriority] = useState<'Baixa' | 'Média' | 'Alta' | 'Urgente'>('Média');
  const [pickupDate, setPickupDate] = useState<string>(() => getTodayBR());
  const [pickupDateText, setPickupDateText] = useState<string>(() => formatDateBR(getTodayBR()));
  const nativeDateInputRef = useRef<HTMLInputElement>(null);
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [loadingBudget, setLoadingBudget] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);

  // Verificação de permissão exclusiva para Emily Bueno (e Admin) solicitar materiais fora da base
  const isEmilyOrAdmin = Boolean(
    currentUser?.role === 'admin' ||
    currentUser?.email === 'emily@sabrar.com.br' ||
    (currentUser?.name && /emily/i.test(currentUser.name))
  );

  // Usuários com permissão estrita exclusivamente para solicitações de uso interno
  const isInternalOnlyUser = Boolean(
    currentUser?.role === 'compras' ||
    currentUser?.email?.toLowerCase() === 'vinicius.gomes@sabrar.com.br' ||
    (currentUser?.department || '').toLowerCase().includes('uso interno')
  );

  const selectedProject = useMemo(() => {
    if (selectedProjectId === 'internal') {
      return {
        id: 'internal',
        name: 'Solicitações Internas - SABRAR',
        code: 'SAB-INTERNO',
        client: 'SABRAR Engenharia (Uso Interno)',
        status: 'Em execução',
        responsible_engineer: 'Uso Interno Administrativo / Almoxarifado'
      } as any;
    }
    return projects.find(p => p.id === Number(selectedProjectId));
  }, [projects, selectedProjectId]);

  // Seletor inteligente com busca para obras
  const [projectSearchTerm, setProjectSearchTerm] = useState('');
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
  const projectDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (projectDropdownRef.current && !projectDropdownRef.current.contains(e.target as Node)) {
        setIsProjectDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const normalizeStr = (s: string) => (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const filteredProjects = useMemo(() => {
    const term = normalizeStr(projectSearchTerm.trim());
    if (!term) return projects;
    const tokens = term.split(/\s+/).filter(Boolean);
    return projects.filter(p => {
      const text = normalizeStr(`${p.code} ${p.name} ${p.client || ''} ${p.responsible_engineer || ''}`);
      return tokens.every(token => text.includes(token));
    });
  }, [projects, projectSearchTerm]);

  const showInternalOption = useMemo(() => {
    if (!projectSearchTerm.trim()) return true;
    const term = normalizeStr(projectSearchTerm.trim());
    const text = normalizeStr('solicitacoes internas sabrar uso interno almoxarifado administrativo');
    const tokens = term.split(/\s+/).filter(Boolean);
    return tokens.every(token => text.includes(token));
  }, [projectSearchTerm]);

  // Modo de Solicitação: 'batch' (orçamento da obra) ou 'custom' (lista avulsa montada pelo engenheiro)
  const [requestMode, setRequestMode] = useState<'batch' | 'custom'>('batch');

  // ==========================================
  // ABA 1: MATERIAIS DO ORÇAMENTO DA OBRA
  // ==========================================
  const [budgetItems, setBudgetItems] = useState<any[]>([]);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<number>>(new Set());
  const [itemQuantities, setItemQuantities] = useState<Record<number, number>>({});
  const [budgetUnits, setBudgetUnits] = useState<Record<number, string>>({});
  const [searchFilter, setSearchFilter] = useState('');
  const [stockTabFilter, setStockTabFilter] = useState<'todos' | 'com_estoque' | 'deficit'>('todos');

  // Adição de Item Extra no Orçamento
  const [isAddingExtra, setIsAddingExtra] = useState(false);
  const [extraSearch, setExtraSearch] = useState('');
  const [extraMaterialId, setExtraMaterialId] = useState<number | ''>('');
  const [extraQuantity, setExtraQuantity] = useState<string>('1');
  const [extraCustomUnit, setExtraCustomUnit] = useState<string>('un');

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
  const [customItemUnits, setCustomItemUnits] = useState<Record<number, string>>({});
  const [customMaterialSearch, setCustomMaterialSearch] = useState('');
  const [customMaterialId, setCustomMaterialId] = useState<number | ''>('');
  const [customQuantity, setCustomQuantity] = useState<string>('1');
  const [customSelectedUnit, setCustomSelectedUnit] = useState<string>('');
  const [customUncatalogedUnit, setCustomUncatalogedUnit] = useState<string>('un');
  const [customListFilter, setCustomListFilter] = useState('');
  const [customStockFilter, setCustomStockFilter] = useState<'todos' | 'com_estoque' | 'deficit'>('todos');

  useEffect(() => {
    if (isOpen) {
      // Carrega projetos: apenas obras com orçamento Aprovado ou Em Execução
      api.getProjects().then(data => {
        let valid = data.filter((p: Project) => {
          if (p.code === 'SAB-INTERNO') return false; // Exibe como opção própria no dropdown
          if (p.status === 'Cancelado' || p.status === 'Concluído' || p.status === 'Concluída' || p.status === 'Finalizado') return false;
          // Requisito 4: Só liberar solicitação após aprovação do orçamento e início da obra
          const isApprovedOrExecuting = 
            p.status === 'Em execução' || 
            p.status === 'Aprovado' || 
            p.budget?.status === 'Aprovado' ||
            (p as any).budget_status === 'Aprovado';
          return isApprovedOrExecuting;
        });

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
      } else if (isInternalOnlyUser) {
        setSelectedProjectId('internal');
      } else {
        setSelectedProjectId('');
      }
      setPriority('Média');
      const today = getTodayBR();
      setPickupDate(today);
      setPickupDateText(formatDateBR(today));
      setNotes('');
      setError(null);
      setBudgetItems([]);
      setSelectedItemIds(new Set());
      setItemQuantities({});
      setBudgetUnits({});
      setCustomItemUnits({});
      setSearchFilter('');
      setStockTabFilter('todos');

      setIsAddingExtra(false);
      setExtraSearch('');
      setExtraMaterialId('');
      setExtraQuantity('1');
      setExtraCustomUnit('un');

      setReplacingItemId(null);
      setReplaceSearch('');
      setReplaceWithMaterialId('');

      setCustomItems([]);
      setSelectedCustomIds(new Set());
      setCustomQuantities({});
      setCustomMaterialSearch('');
      setCustomMaterialId('');
      setCustomQuantity('1');
      setCustomUncatalogedUnit('un');
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
      if (selectedProjectId === 'internal') {
        // Solicitação interna não tem orçamento de cliente
        setBudgetItems([]);
        setSelectedItemIds(new Set());
        setItemQuantities({});
        setQuotasMap({});
        setRequestMode('custom');
        setLoadingBudget(false);
        return;
      }

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
          budgetData.items.forEach((it: any) => {
            const q = qMap[it.material_id];
            // Se houver cota calculada, usa o saldo remanescente; caso contrário, usa o previsto
            const remaining = q !== undefined && q !== null ? Number(q.remainingQuota) : Number(it.quantity || 0);
            const qty = Math.max(0, remaining);
            initialQtys[it.id] = qty;
          });
          // Item 7: Deixar por padrão todos os itens não selecionados
          setSelectedItemIds(new Set());
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
      const mat = it.material_id ? (materials.find(m => m.id === it.material_id) || {
        stock_physical: it.stock_physical || 0,
        stock_reserved: it.stock_reserved || 0
      }) : {
        stock_physical: 0,
        stock_reserved: 0
      };
      const physical = Number(mat.stock_physical ?? it.stock_physical ?? 0);
      const reserved = Number(mat.stock_reserved ?? it.stock_reserved ?? 0);
      const availableStandard = Math.max(0, physical - reserved);

      const pkgInfo = parsePackageInfo(it.material_id ? materials.find(m => m.id === it.material_id) : it);
      const chosenUnit = budgetUnits[it.id] || it.unit || 'un';
      const isFractional = Boolean(pkgInfo.hasPackage && pkgInfo.fractionalUnit && chosenUnit.toLowerCase() === pkgInfo.fractionalUnit.toLowerCase());
      const multiplier = isFractional ? pkgInfo.packageMultiplier : 1;

      const requestedQty = Number(itemQuantities[it.id] !== undefined ? itemQuantities[it.id] : (it.remainingQuota > 0 ? it.remainingQuota : (it.quantity ?? 1)));
      const standardRequestedQty = isFractional && pkgInfo.packageMultiplier > 0 ? (requestedQty / pkgInfo.packageMultiplier) : requestedQty;

      const reservableStandard = Math.min(standardRequestedQty, availableStandard);
      const deficitStandard = Math.max(0, standardRequestedQty - availableStandard);

      const availableInChosenUnit = Number((availableStandard * multiplier).toFixed(2));
      const reservableInChosenUnit = Number((reservableStandard * multiplier).toFixed(2));
      const deficitInChosenUnit = Number((deficitStandard * multiplier).toFixed(2));

      const isSelected = selectedItemIds.has(it.id);

      const quota = it.material_id ? quotasMap[it.material_id] : null;
      const budgetQuantity = quota ? Number(quota.budgetQuantity || 0) : (it.isCustom ? 0 : Number(it.quantity || 0));
      const previouslyRequested = quota ? Number(quota.previouslyRequested || 0) : 0;
      const remainingQuota = quota ? Number(quota.remainingQuota || 0) : Math.max(0, budgetQuantity - previouslyRequested);

      const isOverBudget = it.isExtra || it.isCustom || standardRequestedQty > remainingQuota;
      const extraQuantity = (it.isExtra || it.isCustom) ? requestedQty : Math.max(0, Number((standardRequestedQty - remainingQuota).toFixed(2)));

      const unitPrice = getUnitPriceForUnit(chosenUnit, pkgInfo);
      const totalPrice = Number((requestedQty * unitPrice).toFixed(2));

      return {
        ...it,
        chosenUnit,
        pkgInfo,
        isFractional,
        standardRequestedQty,
        availableStock: availableInChosenUnit,
        availableStockStandard: availableStandard,
        currentRequestedQty: requestedQty,
        reservable: reservableInChosenUnit,
        deficit: deficitInChosenUnit,
        unitPrice,
        totalPrice,
        isSelected,
        budgetQuantity,
        previouslyRequested,
        remainingQuota,
        isOverBudget,
        extraQuantity
      };
    });
  }, [budgetItems, materials, itemQuantities, selectedItemIds, quotasMap, budgetUnits]);

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

  const handleBudgetUnitChange = (id: number, newUnit: string) => {
    const it = budgetItems.find(b => b.id === id);
    const matObj = it?.material_id ? materials.find(m => m.id === it.material_id) : null;
    const pkgInfo = parsePackageInfo(matObj || it);
    const oldUnit = budgetUnits[id] || it?.unit || 'un';
    const currentQty = itemQuantities[id] !== undefined ? itemQuantities[id] : (it?.remainingQuota > 0 ? it.remainingQuota : (it?.quantity || 1));

    const convertedQty = convertQuantity(currentQty, oldUnit, newUnit, pkgInfo);
    setItemQuantities(prev => ({ ...prev, [id]: convertedQty }));
    setBudgetUnits(prev => ({ ...prev, [id]: newUnit }));
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

  // Adição de Item Fora da Base (Exclusivo Emily / Compras)
  const handleAddCustomUncatalogedExtra = (name: string, qty: number, unit = 'un') => {
    if (!name.trim() || qty <= 0) return;
    const newId = Date.now() + Math.floor(Math.random() * 1000);
    const newItem = {
      id: newId,
      material_id: null,
      material_name: name.trim().toUpperCase(),
      material_code: 'FORA-BASE',
      unit: unit || 'un',
      quantity: qty,
      isExtra: true,
      isCustom: true,
      customName: name.trim().toUpperCase()
    };
    setBudgetItems(prev => [newItem, ...prev]);
    setSelectedItemIds(prev => new Set(prev).add(newId));
    setItemQuantities(prev => ({ ...prev, [newId]: qty }));
    setExtraSearch('');
    setExtraMaterialId('');
    setExtraQuantity('1');
    setExtraCustomUnit('un');
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
      const mat = it.material_id ? (materials.find(m => m.id === it.material_id) || {
        stock_physical: 0,
        stock_reserved: 0
      }) : {
        stock_physical: 0,
        stock_reserved: 0
      };
      const physical = Number(mat.stock_physical ?? 0);
      const reserved = Number(mat.stock_reserved ?? 0);
      const availableStandard = Math.max(0, physical - reserved);

      const pkgInfo = parsePackageInfo(it.material_id ? materials.find(m => m.id === it.material_id) : it);
      const chosenUnit = customItemUnits[it.id] || it.unit || 'un';
      const isFractional = Boolean(pkgInfo.hasPackage && pkgInfo.fractionalUnit && chosenUnit.toLowerCase() === pkgInfo.fractionalUnit.toLowerCase());
      const multiplier = isFractional ? pkgInfo.packageMultiplier : 1;

      const requestedQty = Number(customQuantities[it.id] ?? it.quantity ?? 1);
      const standardRequestedQty = isFractional && pkgInfo.packageMultiplier > 0 ? (requestedQty / pkgInfo.packageMultiplier) : requestedQty;

      const reservableStandard = Math.min(standardRequestedQty, availableStandard);
      const deficitStandard = Math.max(0, standardRequestedQty - availableStandard);

      const availableInChosenUnit = Number((availableStandard * multiplier).toFixed(2));
      const reservableInChosenUnit = Number((reservableStandard * multiplier).toFixed(2));
      const deficitInChosenUnit = Number((deficitStandard * multiplier).toFixed(2));

      const isSelected = selectedCustomIds.has(it.id);

      const quota = it.material_id ? quotasMap[it.material_id] : null;
      const isInBudget = Boolean(quota && quota.budgetQuantity > 0);
      const budgetQuantity = quota ? Number(quota.budgetQuantity || 0) : 0;
      const previouslyRequested = quota ? Number(quota.previouslyRequested || 0) : 0;
      const remainingQuota = quota ? Number(quota.remainingQuota || 0) : 0;

      const isOverBudget = !isInBudget || standardRequestedQty > remainingQuota || it.isCustom;
      const extraQuantity = (!isInBudget || it.isCustom) ? requestedQty : Math.max(0, Number((standardRequestedQty - remainingQuota).toFixed(2)));

      const unitPrice = getUnitPriceForUnit(chosenUnit, pkgInfo);
      const totalPrice = Number((requestedQty * unitPrice).toFixed(2));

      return {
        ...it,
        chosenUnit,
        pkgInfo,
        isFractional,
        standardRequestedQty,
        availableStock: availableInChosenUnit,
        availableStockStandard: availableStandard,
        currentRequestedQty: requestedQty,
        reservable: reservableInChosenUnit,
        deficit: deficitInChosenUnit,
        unitPrice,
        totalPrice,
        isSelected,
        isInBudget,
        budgetQuantity,
        previouslyRequested,
        remainingQuota,
        isOverBudget,
        extraQuantity
      };
    });
  }, [customItems, materials, customQuantities, selectedCustomIds, quotasMap, customItemUnits]);

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
    const chosenUnit = customSelectedUnit || mat.unit;

    const existing = customItems.find(it => it.material_id === mat.id);
    if (existing) {
      const existingUnit = customItemUnits[existing.id] || existing.unit;
      if (existingUnit === chosenUnit) {
        const nextQty = (customQuantities[existing.id] || existing.quantity) + qty;
        setCustomQuantities(prev => ({ ...prev, [existing.id]: nextQty }));
      } else {
        const nextQty = (customQuantities[existing.id] || existing.quantity) + qty;
        setCustomQuantities(prev => ({ ...prev, [existing.id]: nextQty }));
        setCustomItemUnits(prev => ({ ...prev, [existing.id]: chosenUnit }));
      }
      setSelectedCustomIds(prev => new Set(prev).add(existing.id));
    } else {
      const newId = Date.now() + Math.floor(Math.random() * 1000);
      const newItem = {
        id: newId,
        material_id: mat.id,
        material_name: mat.name,
        material_code: mat.code,
        unit: chosenUnit,
        quantity: qty
      };
      setCustomItems(prev => [newItem, ...prev]);
      setSelectedCustomIds(prev => new Set(prev).add(newId));
      setCustomQuantities(prev => ({ ...prev, [newId]: qty }));
      setCustomItemUnits(prev => ({ ...prev, [newId]: chosenUnit }));
    }
    setCustomMaterialId('');
    setCustomQuantity('1');
    setCustomMaterialSearch('');
    setCustomSelectedUnit('');
  };

  // Inclusão de material avulso fora da base (Exclusivo Emily / Compras)
  const handleAddUncatalogedCustomItem = (name: string, qty: number, unit = 'un') => {
    if (!name.trim() || qty <= 0) return;
    const newId = Date.now() + Math.floor(Math.random() * 1000);
    const newItem = {
      id: newId,
      material_id: null,
      material_name: name.trim().toUpperCase(),
      material_code: 'FORA-BASE',
      unit: unit || 'un',
      quantity: qty,
      isExtra: true,
      isCustom: true,
      customName: name.trim().toUpperCase()
    };
    setCustomItems(prev => [newItem, ...prev]);
    setSelectedCustomIds(prev => new Set(prev).add(newId));
    setCustomQuantities(prev => ({ ...prev, [newId]: qty }));
    setCustomItemUnits(prev => ({ ...prev, [newId]: unit || 'un' }));
    setCustomMaterialSearch('');
    setCustomMaterialId('');
    setCustomQuantity('1');
    setCustomUncatalogedUnit('un');
    setCustomSelectedUnit('');
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

  const handleCustomUnitChange = (id: number, newUnit: string) => {
    const it = customItems.find(c => c.id === id);
    const matObj = it?.material_id ? materials.find(m => m.id === it.material_id) : null;
    const pkgInfo = parsePackageInfo(matObj || it);
    const oldUnit = customItemUnits[id] || it?.unit || 'un';
    const currentQty = customQuantities[id] ?? it?.quantity ?? 1;

    const convertedQty = convertQuantity(currentQty, oldUnit, newUnit, pkgInfo);
    setCustomQuantities(prev => ({ ...prev, [id]: convertedQty }));
    setCustomItemUnits(prev => ({ ...prev, [id]: newUnit }));
  };

  // ==========================================
  // FILTRAGEM FLEXÍVEL DO CATÁLOGO DE MATERIAIS
  // ==========================================
  const filterMaterialsCatalog = (list: Material[], rawQuery: string) => {
    const trimmed = rawQuery.trim();
    if (!trimmed) return list.slice(0, 150);

    const normQ = normalizeStr(trimmed);
    const stopWords = new Set(['de', 'da', 'do', 'das', 'dos', 'para', 'com', 'em', 'por', 'no', 'na']);
    const allTokens = normQ.split(/[\s,;/+-]+/).filter(Boolean);
    const tokens = allTokens.filter(t => !stopWords.has(t));
    const searchTokens = tokens.length > 0 ? tokens : allTokens;

    const scored: { mat: Material; score: number }[] = [];

    for (const m of list) {
      const normName = normalizeStr(m.name || '');
      const normCode = normalizeStr(m.code || '');
      const normSyn = normalizeStr(m.synonyms || '');
      const normCat = normalizeStr(m.category || '');
      const normDesc = normalizeStr(m.description || '');
      const normBrand = normalizeStr(m.brand || '');
      const fullText = `${normCode} ${normName} ${normSyn} ${normCat} ${normDesc} ${normBrand}`;

      // Todos os tokens digitados devem constar em algum campo do material (em qualquer ordem)
      const matchesAll = searchTokens.every(tok => fullText.includes(tok));
      if (!matchesAll) continue;

      let score = 10;
      if (normCode === normQ || normName === normQ) score += 100;
      else if (normName.startsWith(normQ) || normCode.startsWith(normQ)) score += 60;
      else if (normName.includes(normQ)) score += 40;
      else if (normSyn.includes(normQ)) score += 30;
      if (searchTokens.every(tok => normName.includes(tok))) score += 20;

      scored.push({ mat: m, score });
    }

    scored.sort((a, b) => b.score - a.score || a.mat.name.localeCompare(b.mat.name));
    return scored.slice(0, 150).map(s => s.mat);
  };

  const filteredCatalogForExtra = useMemo(() => {
    return filterMaterialsCatalog(materials, extraSearch);
  }, [materials, extraSearch]);

  const filteredCatalogForReplace = useMemo(() => {
    return filterMaterialsCatalog(materials, replaceSearch);
  }, [materials, replaceSearch]);

  const filteredCatalogForCustom = useMemo(() => {
    return filterMaterialsCatalog(materials, customMaterialSearch);
  }, [materials, customMaterialSearch]);

  const selectedCustomMat = materials.find(m => m.id === Number(customMaterialId));
  const availableStockCustom = selectedCustomMat ? Math.max(0, selectedCustomMat.stock_physical - selectedCustomMat.stock_reserved) : 0;

  const topBarUnitOptions = useMemo(() => {
    if (!selectedCustomMat) return [];
    return getUnitOptions(selectedCustomMat);
  }, [selectedCustomMat]);

  const topBarPkgInfo = useMemo(() => {
    return parsePackageInfo(selectedCustomMat);
  }, [selectedCustomMat]);

  const topBarUnitPrice = useMemo(() => {
    if (!selectedCustomMat) return 0;
    return getUnitPriceForUnit(customSelectedUnit || selectedCustomMat.unit, topBarPkgInfo);
  }, [selectedCustomMat, customSelectedUnit, topBarPkgInfo]);

  const handleTopBarUnitChange = (newUnit: string) => {
    const currentQty = parseFloat(customQuantity) || 1;
    const oldUnit = customSelectedUnit || selectedCustomMat?.unit || 'un';
    const convertedQty = convertQuantity(currentQty, oldUnit, newUnit, topBarPkgInfo);
    setCustomQuantity(String(convertedQty));
    setCustomSelectedUnit(newUnit);
  };

  useEffect(() => {
    if (selectedCustomMat) {
      const opts = getUnitOptions(selectedCustomMat);
      if (!opts.some(o => o.value === customSelectedUnit)) {
        setCustomSelectedUnit(opts[0]?.value || selectedCustomMat.unit);
      }
    } else {
      setCustomSelectedUnit('');
    }
  }, [customMaterialId, selectedCustomMat]);

  const selectedExtraMat = materials.find(m => m.id === Number(extraMaterialId));
  const availableStockExtra = selectedExtraMat ? Math.max(0, selectedExtraMat.stock_physical - selectedExtraMat.stock_reserved) : 0;

  // Handlers para Seleção e Digitação de Data no Mobile e Desktop
  const handleSetPickupDate = (isoDate: string) => {
    setPickupDate(isoDate);
    setPickupDateText(formatDateBR(isoDate));
  };

  const handleDateTextChange = (val: string) => {
    const masked = maskDateInput(val);
    setPickupDateText(masked);
    if (masked.length === 10) {
      const iso = parseDateBRToISO(masked);
      if (iso) {
        setPickupDate(iso);
      }
    }
  };

  // ==========================================
  // SUBMISSÃO DA SOLICITAÇÃO
  // ==========================================
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedProjectId) {
      setError('Por favor selecione a obra destino ou Solicitações Internas.');
      return;
    }

    setLoading(true);
    try {
      if (requestMode === 'batch') {
        const itemsToSubmit = batchItemsWithMetrics
          .filter(it => it.isSelected && it.currentRequestedQty > 0)
          .map(it => {
            const chosenUnit = budgetUnits[it.id] || it.unit || 'un';
            return {
              materialId: it.material_id || null,
              quantity: it.currentRequestedQty,
              isCustom: Boolean(it.isCustom || !it.material_id),
              customName: it.customName || it.material_name,
              unit: chosenUnit,
              customUnit: chosenUnit
            };
          });

        if (itemsToSubmit.length === 0) {
          setError('Nenhum material selecionado com quantidade válida.');
          setLoading(false);
          return;
        }

        await api.createRequest({
          projectId: selectedProjectId === 'internal' ? 'internal' : Number(selectedProjectId),
          items: itemsToSubmit,
          priority,
          notes,
          userId: currentUser?.id || 3,
          pickupDate
        });
      } else {
        const itemsToSubmit = customItemsWithMetrics
          .filter(it => it.isSelected && it.currentRequestedQty > 0 && (it.material_id || it.isCustom))
          .map(it => {
            const chosenUnit = customItemUnits[it.id] || it.unit || 'un';
            return {
              materialId: it.material_id || null,
              quantity: it.currentRequestedQty,
              isCustom: Boolean(it.isCustom),
              customName: it.customName || it.material_name,
              unit: chosenUnit,
              customUnit: chosenUnit
            };
          });

        if (itemsToSubmit.length === 0) {
          setError('Nenhum material adicionado ou selecionado na lista avulsa.');
          setLoading(false);
          return;
        }

        await api.createRequest({
          projectId: selectedProjectId === 'internal' ? 'internal' : Number(selectedProjectId),
          items: itemsToSubmit,
          priority,
          notes,
          userId: currentUser?.id || 3,
          pickupDate
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
            {/* Seletor Inteligente com Busca */}
            <div ref={projectDropdownRef} className="relative">
              {isInternalOnlyUser ? (
                <div className="w-full p-3.5 rounded-2xl border border-purple-500/50 bg-purple-950/40 flex items-center justify-between gap-3 shadow-md">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-purple-900/80 border border-purple-500/50 text-purple-300">
                      <ClipboardList className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 text-left">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-black bg-purple-900/80 text-purple-200 border border-purple-700">
                          SAB-INTERNO
                        </span>
                        <strong className="text-white text-xs sm:text-sm font-bold truncate">
                          Solicitações Internas - SABRAR (Uso Interno)
                        </strong>
                      </div>
                      <p className="text-[11px] text-purple-300/80 mt-0.5">
                        🔒 Usuários de compras e uso interno realizam solicitações exclusivamente para fins internos da SABRAR.
                      </p>
                    </div>
                  </div>
                </div>
              ) : selectedProject && !isProjectDropdownOpen ? (
                <div 
                  onClick={() => setIsProjectDropdownOpen(true)}
                  className="w-full p-3 rounded-2xl border border-emerald-600/60 bg-dark-850 hover:bg-dark-800 transition-all cursor-pointer flex items-center justify-between gap-3 group shadow-md"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                      selectedProjectId === 'internal' 
                        ? 'bg-purple-950/80 border border-purple-600/40 text-purple-400' 
                        : 'bg-emerald-950/80 border border-emerald-600/40 text-emerald-400'
                    }`}>
                      {selectedProjectId === 'internal' ? <ClipboardList className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0 text-left">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-black bg-dark-750 text-slate-200 border border-dark-650">
                          {selectedProject.code}
                        </span>
                        <strong className="text-white text-xs sm:text-sm font-bold truncate">
                          {selectedProject.name}
                        </strong>
                        {selectedProject.client && selectedProjectId !== 'internal' && (
                          <span className="text-xs text-slate-400">
                            ({selectedProject.client})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[11px] font-bold text-sabrar-400 group-hover:text-sabrar-300 transition-colors">
                      Trocar Obra
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedProjectId('');
                        setIsProjectDropdownOpen(true);
                      }}
                      className="p-1 rounded-lg hover:bg-dark-700 text-slate-400 hover:text-white transition-colors"
                      title="Desmarcar obra selecionada"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                /* Campo de busca inteligente */
                <div className="space-y-1.5">
                  <div className="relative">
                    <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      autoFocus={isProjectDropdownOpen}
                      value={projectSearchTerm}
                      onChange={(e) => {
                        setProjectSearchTerm(e.target.value);
                        setIsProjectDropdownOpen(true);
                      }}
                      onFocus={() => setIsProjectDropdownOpen(true)}
                      placeholder="🔍 Digite para buscar obra por nome, código, cliente ou engenheiro..."
                      className="w-full pl-10 pr-10 text-xs sm:text-sm p-3 rounded-2xl border border-dark-700 bg-dark-850 focus:outline-none focus:ring-2 focus:ring-sabrar-500 text-white font-medium placeholder-slate-500 transition-all shadow-inner"
                    />
                    {projectSearchTerm ? (
                      <button
                        type="button"
                        onClick={() => setProjectSearchTerm('')}
                        className="absolute right-3.5 top-3.5 text-slate-400 hover:text-white transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    ) : (
                      <ChevronDown className="absolute right-3.5 top-3.5 w-4 h-4 text-slate-500 pointer-events-none" />
                    )}
                  </div>

                  {/* Dropdown de opções filtradas */}
                  {isProjectDropdownOpen && (
                    <div className="max-h-64 overflow-y-auto rounded-2xl border border-dark-700 bg-dark-900 shadow-2xl p-1.5 space-y-1 z-30">
                      {/* Opção Solicitações Internas */}
                      {showInternalOption && (
                        <div
                          onClick={() => {
                            setSelectedProjectId('internal');
                            setIsProjectDropdownOpen(false);
                            setProjectSearchTerm('');
                          }}
                          className={`p-2.5 rounded-xl cursor-pointer transition-all flex items-center justify-between gap-2.5 ${
                            selectedProjectId === 'internal'
                              ? 'bg-purple-950/70 border border-purple-500/50 text-purple-200'
                              : 'hover:bg-dark-800 text-slate-200'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-7 h-7 rounded-lg bg-purple-950 border border-purple-600/40 text-purple-400 flex items-center justify-center shrink-0 text-xs">
                              🏢
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-purple-900/60 text-purple-300 border border-purple-700/50">
                                  SAB-INTERNO
                                </span>
                                <strong className="text-xs font-bold text-white">
                                  Solicitações Internas (Uso Interno SABRAR)
                                </strong>
                              </div>
                              <p className="text-[11px] text-slate-400 truncate">
                                Administrativo / Almoxarifado / Manutenção Interna
                              </p>
                            </div>
                          </div>
                          {selectedProjectId === 'internal' && (
                            <CheckCircle className="w-4 h-4 text-purple-400 shrink-0" />
                          )}
                        </div>
                      )}

                      {/* Lista de Obras Filtradas */}
                      {filteredProjects.map((p) => {
                        const isSelected = selectedProjectId === p.id;
                        return (
                          <div
                            key={p.id}
                            onClick={() => {
                              setSelectedProjectId(p.id);
                              setIsProjectDropdownOpen(false);
                              setProjectSearchTerm('');
                            }}
                            className={`p-2.5 rounded-xl cursor-pointer transition-all flex items-center justify-between gap-2.5 ${
                              isSelected
                                ? 'bg-emerald-950/70 border border-emerald-500/50 text-emerald-200'
                                : 'hover:bg-dark-800 text-slate-200'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-7 h-7 rounded-lg bg-dark-800 border border-dark-650 text-slate-400 flex items-center justify-center shrink-0">
                                <Building2 className="w-3.5 h-3.5 text-sabrar-400" />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-dark-750 text-slate-300 border border-dark-650">
                                    {p.code}
                                  </span>
                                  <strong className="text-xs font-bold text-white">
                                    {p.name}
                                  </strong>
                                  {p.client && (
                                    <span className="text-[11px] text-slate-400">
                                      ({p.client})
                                    </span>
                                  )}
                                </div>
                                {p.responsible_engineer && (
                                  <div className="flex items-center gap-1 text-[11px] text-amber-400/90 mt-0.5 font-medium">
                                    <HardHat className="w-3 h-3" />
                                    <span>{p.responsible_engineer}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                            {isSelected && (
                              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                            )}
                          </div>
                        );
                      })}

                      {filteredProjects.length === 0 && !showInternalOption && (
                        <div className="p-4 text-center text-xs text-slate-400">
                          Nenhuma obra encontrada para "<strong>{projectSearchTerm}</strong>".
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
            {currentUser?.role === 'engenharia' && projects.length === 0 && (
              <p className="text-[11px] text-amber-400/90 mt-1">
                Nenhuma obra externa com orçamento aprovado e status "Em execução" está atribuída ao seu perfil no momento. Para demandas internas, selecione <strong>"Solicitações Internas (Uso Interno SABRAR)"</strong> acima.
              </p>
            )}

            {selectedProject && (
              <div className="mt-2.5 p-3 rounded-2xl bg-dark-800/80 border border-dark-700/80 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2.5">
                  <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                    selectedProjectId === 'internal' 
                      ? 'bg-purple-950/80 border border-purple-600/40 text-purple-400' 
                      : 'bg-amber-950/80 border border-amber-600/40 text-amber-400'
                  }`}>
                    {selectedProjectId === 'internal' ? <ClipboardList className="w-4 h-4" /> : <HardHat className="w-4 h-4" />}
                  </div>
                  <div className="text-xs">
                    <span className="text-slate-400 font-medium">
                      {selectedProjectId === 'internal' ? 'Finalidade: ' : 'Engenheiro(s) da Obra: '}
                    </span>
                    <strong className={
                      selectedProjectId === 'internal'
                        ? "text-purple-300 font-bold"
                        : selectedProject.responsible_engineer ? "text-amber-300 font-bold" : "text-rose-400 font-bold"
                    }>
                      {selectedProjectId === 'internal' ? 'Uso Interno Administrativo / Almoxarifado SABRAR' : (selectedProject.responsible_engineer || 'Pendente de atribuição')}
                    </strong>
                  </div>
                </div>
                {selectedProjectId !== 'internal' && currentUser?.role === 'admin' && (
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
                          <span>Adicionar Material Extra (Da Base ou Fora da Base)</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-normal">Base Oficial: {materials.length} Materiais com Foto</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                        <div className="sm:col-span-5 relative">
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            value={extraSearch}
                            onChange={(e) => setExtraSearch(e.target.value)}
                            placeholder="Pesquisar na base ou digite o nome do material..."
                            className="w-full text-xs pl-8 pr-7 py-2 rounded-xl bg-dark-900 border border-dark-700 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                          />
                          {extraSearch && (
                            <button
                              type="button"
                              onClick={() => setExtraSearch('')}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                        <div className="sm:col-span-4">
                          <select
                            value={extraMaterialId}
                            onChange={(e) => setExtraMaterialId(e.target.value ? Number(e.target.value) : '')}
                            className="w-full text-xs p-2 rounded-xl bg-dark-900 border border-dark-700 text-white focus:outline-none focus:border-emerald-500"
                          >
                            <option value="">Selecione da base ({filteredCatalogForExtra.length})...</option>
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
                            {selectedExtraMat?.unit || extraCustomUnit || 'un'}
                          </span>
                        </div>
                        <div className="sm:col-span-1">
                          <button
                            type="button"
                            onClick={handleAddExtraBudgetItem}
                            disabled={!extraMaterialId || Number(extraQuantity) <= 0}
                            className="w-full p-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center shadow-sm"
                            title="Incluir material da base na lista"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Resultados interativos da busca flexível */}
                      {extraSearch.trim().length > 0 && filteredCatalogForExtra.length > 0 && (
                        <div className="bg-dark-900 border border-dark-700 rounded-xl max-h-48 overflow-y-auto divide-y divide-dark-800">
                          <div className="px-3 py-1.5 bg-dark-850 text-[10px] font-bold text-slate-400 flex justify-between">
                            <span>{filteredCatalogForExtra.length} opções encontradas na base (clique para selecionar)</span>
                            <span>Estoque Disponível</span>
                          </div>
                          {filteredCatalogForExtra.slice(0, 25).map((m) => {
                            const disp = Math.max(0, m.stock_physical - m.stock_reserved);
                            const isSelected = Number(extraMaterialId) === m.id;
                            return (
                              <div
                                key={m.id}
                                onClick={() => setExtraMaterialId(m.id)}
                                className={`px-3 py-2 flex items-center justify-between gap-2 cursor-pointer text-xs transition-colors ${
                                  isSelected ? 'bg-emerald-950/70 text-emerald-200' : 'hover:bg-dark-800 text-slate-200'
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  {m.image_url && (
                                    <img src={m.image_url} alt="" className="w-7 h-7 rounded bg-dark-950 object-contain p-0.5 border border-dark-700 shrink-0" />
                                  )}
                                  <div className="truncate">
                                    <span className="font-mono text-[10px] text-emerald-400 mr-1.5">{m.code}</span>
                                    <span className="font-bold">{m.name}</span>
                                    <span className="text-[10px] text-slate-400 ml-1">({m.unit})</span>
                                  </div>
                                </div>
                                <span className={`text-[10px] font-bold shrink-0 ${disp > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
                                  Disp: {disp} {m.unit}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Opção para TODOS os usuários solicitarem material fora da base escrevendo o nome à sua maneira */}
                      {extraSearch.trim().length > 0 && (
                        <div className="p-3 bg-purple-950/60 border border-purple-500/50 rounded-xl space-y-2 text-xs">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-1.5 text-purple-300 font-bold">
                              <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
                              <span>
                                {filteredCatalogForExtra.length === 0
                                  ? `Nenhum item na base com "${extraSearch}". Solicitar fora da base:`
                                  : `Não é nenhum dos itens acima? Solicitar "${extraSearch}" fora da base:`}
                              </span>
                            </div>
                            <span className="text-[10px] text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-600/40 font-semibold">
                              Sujeito à aprovação (Admins, Sabrina ou Emily)
                            </span>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="flex items-center gap-1">
                              <span className="text-[11px] text-slate-300">Unidade:</span>
                              <input
                                type="text"
                                value={extraCustomUnit}
                                onChange={(e) => setExtraCustomUnit(e.target.value)}
                                placeholder="un, m, kg..."
                                className="w-20 p-1.5 rounded-lg bg-dark-900 border border-dark-700 text-xs text-white font-bold text-center"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => handleAddCustomUncatalogedExtra(extraSearch, Number(extraQuantity) || 1, extraCustomUnit || 'un')}
                              disabled={Number(extraQuantity) <= 0}
                              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 !text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md shadow-purple-600/30 active:scale-95"
                            >
                              <Plus className="w-3.5 h-3.5 !text-white" />
                              <span className="!text-white">Solicitar "{extraSearch.toUpperCase()}" (Fora da Base)</span>
                            </button>
                          </div>
                        </div>
                      )}

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
                                  {it.isCustom && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-950 text-purple-300 border border-purple-500/40 flex items-center gap-1">
                                      <Sparkles className="w-3 h-3 text-purple-400" /> Fora da Base
                                    </span>
                                  )}
                                  {it.isExtra && !it.isCustom && (
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
                                  <span className="font-mono text-slate-300">{it.material_code || 'FORA-BASE'}</span>
                                  <span>• Orçado: <strong className="text-slate-200">{it.budgetQuantity} {it.unit}</strong></span>
                                  <span>• Já Solicitado: <strong className="text-slate-300">{it.previouslyRequested} {it.unit}</strong></span>
                                  <span>• Saldo Disponível: <strong className={it.remainingQuota > 0 ? 'text-emerald-400 font-bold' : 'text-slate-400 font-bold'}>{it.remainingQuota} {it.unit}</strong></span>
                                  {it.unitPrice > 0 && (
                                    <span className="text-emerald-400 font-mono font-bold">
                                      • R$ {formatMoney(it.unitPrice)}/{it.chosenUnit || it.unit} (Subtotal: R$ {formatMoney(it.totalPrice)})
                                    </span>
                                  )}
                                  {it.isFractional && (
                                    <span className="text-slate-400 text-[10px] italic">
                                      (≈ {it.standardRequestedQty?.toFixed(2)} {it.pkgInfo?.standardUnit})
                                    </span>
                                  )}
                                  {it.remainingQuota <= 0 && !it.isCustom && (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-dark-750 text-slate-300">
                                      Cota 100% consumida
                                    </span>
                                  )}
                                  {it.isOverBudget ? (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-500/50 flex items-center gap-1">
                                      <AlertTriangle className="w-3 h-3 text-amber-400" />
                                      {it.isCustom ? 'Fora da Base (Aprovação Admin/Sabrina/Emily)' : `Excede cota em +${it.extraQuantity} ${it.chosenUnit || it.unit} (Aprovação)`}
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950/60 text-emerald-300 border border-emerald-500/30">
                                      ✓ Cota respeitada
                                    </span>
                                  )}
                                  {matObj?.availability_status === 'em_falta' ? (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-700/60 flex items-center gap-1">
                                      <AlertTriangle className="w-3 h-3 text-rose-400" /> Em Falta
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950/60 text-emerald-300 border border-emerald-500/30">
                                      ✓ Disponível
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
                                {(() => {
                                  const opts = getUnitOptions(matObj || it);
                                  if (opts.length > 1) {
                                    return (
                                      <select
                                        disabled={!it.isSelected}
                                        value={budgetUnits[it.id] || it.unit}
                                        onChange={(e) => handleBudgetUnitChange(it.id, e.target.value)}
                                        className="text-[11px] font-bold p-1 rounded-lg border border-dark-700 bg-dark-900 text-amber-300 focus:outline-none focus:border-sabrar-500 disabled:opacity-40 cursor-pointer"
                                        title="Selecione a unidade de medida (padrão ou fracionada)"
                                      >
                                        {opts.map((opt) => (
                                          <option key={opt.value} value={opt.value}>
                                            {opt.shortLabel}
                                          </option>
                                        ))}
                                      </select>
                                    );
                                  }
                                  return (
                                    <span className="text-[11px] text-slate-400 font-semibold px-1 w-8 truncate">
                                      {it.chosenUnit || it.unit}
                                    </span>
                                  );
                                })()}
                              </div>

                              {/* Status de Estoque */}
                              <div className="min-w-[130px] text-right">
                                {it.deficit === 0 ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sabrar-950 text-sabrar-300 border border-sabrar-500/40 text-[10px] font-bold">
                                    <CheckCircle className="w-3 h-3 text-sabrar-400" />
                                    Disp: {it.availableStock} {it.chosenUnit || it.unit}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-700/60 text-[10px] font-bold">
                                    <ShoppingCart className="w-3 h-3 text-rose-400" />
                                    Déficit: {it.deficit} {it.chosenUnit || it.unit}
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
                    Buscar Material na Base ou Solicitar Fora da Base
                  </span>
                  <span className="text-[10px] text-slate-400">{materials.length} materiais oficiais na base</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                  <div className="sm:col-span-4 relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={customMaterialSearch}
                      onChange={(e) => setCustomMaterialSearch(e.target.value)}
                      placeholder="Digite qualquer palavra, sinônimo ou código (ex: tubo cobre 3/8)..."
                      className="w-full text-xs pl-8 pr-7 py-2.5 rounded-xl bg-dark-900 border border-dark-700 text-white placeholder-slate-500 focus:outline-none focus:border-sabrar-500"
                    />
                    {customMaterialSearch && (
                      <button
                        type="button"
                        onClick={() => setCustomMaterialSearch('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
                        title="Limpar busca"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <div className="sm:col-span-4">
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
                  <div className="sm:col-span-3 flex items-center gap-1.5">
                    <input
                      type="number"
                      step="any"
                      min="0.01"
                      value={customQuantity}
                      onChange={(e) => setCustomQuantity(e.target.value)}
                      placeholder="Qtd"
                      className="w-20 shrink-0 text-xs font-bold p-2.5 rounded-xl bg-dark-900 border border-dark-700 text-white text-right focus:outline-none focus:border-sabrar-500"
                    />
                    {topBarUnitOptions.length > 1 ? (
                      <select
                        value={customSelectedUnit || selectedCustomMat?.unit}
                        onChange={(e) => handleTopBarUnitChange(e.target.value)}
                        className="flex-1 min-w-[70px] text-xs font-bold p-2.5 rounded-xl bg-dark-900 border border-dark-700 text-amber-300 focus:outline-none focus:border-sabrar-500 cursor-pointer"
                        title="Selecione a unidade de medida (padrão ou fracionada)"
                      >
                        {topBarUnitOptions.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-[11px] text-slate-300 font-bold px-2.5 py-2.5 rounded-xl bg-dark-900 border border-dark-700 whitespace-nowrap">
                        {selectedCustomMat?.unit || customUncatalogedUnit || 'un'}
                      </span>
                    )}
                  </div>
                  <div className="sm:col-span-1">
                    <button
                      type="button"
                      onClick={handleAddCustomItem}
                      disabled={!customMaterialId || Number(customQuantity) <= 0}
                      className="w-full p-2.5 bg-sabrar-600 hover:bg-sabrar-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center shadow-md shadow-sabrar-600/20 active:scale-95"
                      title="Adicionar material selecionado à lista"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Prévia de Conversão de Preço e Equivalência ao vivo */}
                {selectedCustomMat && (
                  <div className="flex items-center justify-between gap-2 px-3 py-2 text-[11px] flex-wrap bg-dark-900/90 rounded-xl border border-dark-750">
                    <div className="flex items-center gap-2 text-slate-400 flex-wrap">
                      <span>Estoque Físico: <strong className="text-white">{selectedCustomMat.stock_physical} {selectedCustomMat.unit}</strong></span>
                      <span>• Disponível: <strong className="text-emerald-400">{availableStockCustom} {selectedCustomMat.unit}</strong></span>
                      {topBarPkgInfo.hasPackage && (
                        <span className="text-amber-300 font-semibold bg-dark-950 px-2 py-0.5 rounded border border-dark-700">
                          Equivalência: 1 {topBarPkgInfo.standardUnit} = {topBarPkgInfo.packageMultiplier} {topBarPkgInfo.fractionalUnit}
                        </span>
                      )}
                    </div>
                    {topBarUnitPrice > 0 && (
                      <div className="text-emerald-300 font-mono font-bold bg-dark-950 px-2 py-0.5 rounded border border-dark-700">
                        Preço Unit: R$ {formatMoney(topBarUnitPrice)}/{customSelectedUnit || selectedCustomMat.unit}
                        {' • '}
                        Subtotal: R$ {formatMoney(topBarUnitPrice * (parseFloat(customQuantity) || 0))}
                      </div>
                    )}
                  </div>
                )}

                {/* Lista interativa de resultados da busca flexível (clicar seleciona na hora) */}
                {customMaterialSearch.trim().length > 0 && filteredCatalogForCustom.length > 0 && (
                  <div className="bg-dark-900 border border-dark-700 rounded-2xl max-h-56 overflow-y-auto divide-y divide-dark-800 shadow-inner">
                    <div className="px-3 py-1.5 bg-dark-850 text-[10px] font-bold text-slate-400 flex items-center justify-between">
                      <span>{filteredCatalogForCustom.length} material(is) encontrado(s) na base oficial — clique para selecionar</span>
                      <span>Estoque Disponível</span>
                    </div>
                    {filteredCatalogForCustom.slice(0, 30).map((m) => {
                      const disp = Math.max(0, m.stock_physical - m.stock_reserved);
                      const isSelected = Number(customMaterialId) === m.id;
                      return (
                        <div
                          key={m.id}
                          onClick={() => setCustomMaterialId(m.id)}
                          className={`p-2.5 flex items-center justify-between gap-3 cursor-pointer text-xs transition-colors ${
                            isSelected ? 'bg-sabrar-950/80 border-l-4 border-sabrar-500 text-white' : 'hover:bg-dark-800 text-slate-200'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            {m.image_url ? (
                              <img src={m.image_url} alt="" className="w-8 h-8 rounded-lg bg-dark-950 object-contain p-0.5 border border-dark-700 shrink-0" />
                            ) : (
                              <div className="w-8 h-8 rounded-lg bg-dark-800 border border-dark-700 flex items-center justify-center shrink-0">
                                <Package className="w-4 h-4 text-slate-500" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-mono text-[10px] font-bold text-sabrar-400 bg-dark-800 px-1.5 py-0.2 rounded border border-dark-700">
                                  {m.code}
                                </span>
                                <span className="font-bold text-white truncate">{m.name}</span>
                                <span className="text-[10px] text-emerald-400 font-semibold">({m.unit})</span>
                              </div>
                              {m.synonyms && (
                                <div className="text-[10px] text-slate-400 italic truncate">
                                  Sinônimos: {m.synonyms}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`text-[10px] font-bold ${disp > 0 ? 'text-sabrar-400' : 'text-slate-500'}`}>
                              Disp: {disp} {m.unit}
                            </span>
                            {isSelected && (
                              <span className="text-[10px] bg-sabrar-600 text-white px-2 py-0.5 rounded-lg font-bold">
                                Selecionado
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Opção liberada para TODOS solicitarem material fora da base escrevendo o nome à sua maneira */}
                {customMaterialSearch.trim().length > 0 && (
                  <div className="p-3 bg-purple-950/60 border border-purple-500/50 rounded-xl space-y-2 text-xs">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 text-purple-300 font-bold">
                        <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
                        <span>
                          {filteredCatalogForCustom.length === 0
                            ? `Material não consta na base oficial. Solicitar "${customMaterialSearch}" fora da base:`
                            : `Não encontrou o material exato na lista acima? Solicite "${customMaterialSearch}" fora da base:`}
                        </span>
                      </div>
                      <span className="text-[10px] text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-600/40 font-semibold">
                        Aprovação: Admins, Sabrina ou Emily
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      Você pode solicitar este material escrevendo o nome à sua maneira. Ele não alterará a base oficial e será enviado para aprovação dos administradores, Sabrina ou Emily:
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1">
                        <span className="text-[11px] text-slate-300">Unidade:</span>
                        <input
                          type="text"
                          value={customUncatalogedUnit}
                          onChange={(e) => setCustomUncatalogedUnit(e.target.value)}
                          placeholder="un, m, kg..."
                          className="w-20 p-1.5 rounded-lg bg-dark-900 border border-dark-700 text-xs text-white font-bold text-center"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAddUncatalogedCustomItem(customMaterialSearch, Number(customQuantity) || 1, customUncatalogedUnit || 'un')}
                        disabled={Number(customQuantity) <= 0}
                        className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 !text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md shadow-purple-600/30 active:scale-95"
                      >
                        <Plus className="w-3.5 h-3.5 !text-white" />
                        <span className="!text-white">Adicionar "{customMaterialSearch.toUpperCase()}" Fora da Base</span>
                      </button>
                    </div>
                  </div>
                )}

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
                              <span>• Unidade: <strong className="text-slate-200">{it.chosenUnit || it.unit}</strong></span>
                              {it.isInBudget ? (
                                <>
                                  <span>• Orçado: <strong className="text-slate-200">{it.budgetQuantity} {it.unit}</strong></span>
                                  <span>• Já Solicitado: <strong className="text-slate-300">{it.previouslyRequested} {it.unit}</strong></span>
                                  <span>• Saldo: <strong className={it.remainingQuota > 0 ? 'text-emerald-400 font-bold' : 'text-slate-400 font-bold'}>{it.remainingQuota} {it.unit}</strong></span>
                                  {it.isOverBudget ? (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-500/50 flex items-center gap-1">
                                      <AlertTriangle className="w-3 h-3 text-amber-400" />
                                      Excede cota em +{it.extraQuantity} {it.chosenUnit || it.unit} (Aprovação Admin)
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950/60 text-emerald-300 border border-emerald-500/30">
                                      ✓ Cota respeitada
                                    </span>
                                  )}
                                </>
                              ) : null}
                              {it.unitPrice > 0 && (
                                <span className="text-emerald-400 font-mono font-bold">
                                  • R$ {formatMoney(it.unitPrice)}/{it.chosenUnit || it.unit} (Subtotal: R$ {formatMoney(it.totalPrice)})
                                </span>
                              )}
                              {it.isFractional && (
                                <span className="text-slate-400 text-[10px] italic">
                                  (≈ {it.standardRequestedQty?.toFixed(2)} {it.pkgInfo?.standardUnit})
                                </span>
                              )}
                              {customMatObj?.availability_status === 'em_falta' ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-700/60 flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3 text-rose-400" /> Em Falta
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950/60 text-emerald-300 border border-emerald-500/30">
                                  ✓ Disponível
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
                              min="0.01"
                              disabled={!it.isSelected}
                              value={customQuantities[it.id] ?? it.quantity}
                              onChange={(e) => handleCustomQuantityChange(it.id, e.target.value)}
                              className="w-20 text-xs font-bold p-1.5 rounded-xl border border-dark-700 bg-dark-900 focus:outline-none focus:border-sabrar-500 text-white text-right disabled:opacity-40"
                            />
                            {(() => {
                              const opts = getUnitOptions(customMatObj || it);
                              if (opts.length > 1) {
                                return (
                                  <select
                                    disabled={!it.isSelected}
                                    value={customItemUnits[it.id] || it.unit}
                                    onChange={(e) => handleCustomUnitChange(it.id, e.target.value)}
                                    className="text-[11px] font-bold p-1 rounded-lg border border-dark-700 bg-dark-900 text-amber-300 focus:outline-none focus:border-sabrar-500 disabled:opacity-40 cursor-pointer"
                                    title="Selecione a unidade de medida (padrão ou fracionada)"
                                  >
                                    {opts.map((opt) => (
                                      <option key={opt.value} value={opt.value}>
                                        {opt.shortLabel}
                                      </option>
                                    ))}
                                  </select>
                                );
                              }
                              return (
                                <span className="text-[11px] text-slate-400 font-semibold px-1 w-8 truncate">
                                  {it.chosenUnit || it.unit}
                                </span>
                              );
                            })()}
                          </div>

                          {/* Status de Estoque */}
                          <div className="min-w-[130px] text-right">
                            {it.deficit === 0 ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sabrar-950 text-sabrar-300 border border-sabrar-500/40 text-[10px] font-bold">
                                <CheckCircle className="w-3 h-3 text-sabrar-400" />
                                Disp: {it.availableStock} {it.chosenUnit || it.unit}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-700/60 text-[10px] font-bold">
                                <ShoppingCart className="w-3 h-3 text-rose-400" />
                                Déficit: {it.deficit} {it.chosenUnit || it.unit}
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

          {/* Banner de Aviso de Aprovação */}
          {((requestMode === 'batch' && selectedBatchStats.requiresAdminApproval) ||
            (requestMode === 'custom' && selectedCustomStats.requiresAdminApproval)) && (
            <div className="p-3.5 bg-amber-950/40 border border-amber-500/50 rounded-2xl flex items-start gap-3 text-amber-200 text-xs">
              <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-amber-300">Solicitação Contém Materiais Fora da Base / Acima da Cota Orçada</div>
                <p className="text-amber-200/80 text-[11px] mt-0.5">
                  Esta solicitação inclui materiais fora da base oficial ou ultrapassa as quantidades do orçamento da obra.
                  Ela será encaminhada para <strong>aprovação dos Administradores, Sabrina ou Emily</strong> antes de liberar a separação e compras.
                </p>
              </div>
            </div>
          )}

          {/* Prioridade e Observações */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-sabrar-400" />
                  Data para Retirada *
                </label>
                {/* Botões de atalho rápido (1 toque no celular ou desktop) */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleSetPickupDate(getTodayBR())}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-colors ${
                      pickupDate === getTodayBR()
                        ? 'bg-sabrar-600 border-sabrar-500 text-white shadow-sm'
                        : 'bg-dark-800 border-dark-700 text-slate-300 hover:bg-dark-750 hover:text-white'
                    }`}
                    title="Definir para Hoje"
                  >
                    Hoje
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetPickupDate(addDaysBR(1))}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-colors ${
                      pickupDate === addDaysBR(1)
                        ? 'bg-sabrar-600 border-sabrar-500 text-white shadow-sm'
                        : 'bg-dark-800 border-dark-700 text-slate-300 hover:bg-dark-750 hover:text-white'
                    }`}
                    title="Definir para Amanhã"
                  >
                    Amanhã
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetPickupDate(addDaysBR(2))}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-colors ${
                      pickupDate === addDaysBR(2)
                        ? 'bg-sabrar-600 border-sabrar-500 text-white shadow-sm'
                        : 'bg-dark-800 border-dark-700 text-slate-300 hover:bg-dark-750 hover:text-white'
                    }`}
                    title="Definir para daqui a 2 dias"
                  >
                    +2d
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetPickupDate(addDaysBR(7))}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-colors ${
                      pickupDate === addDaysBR(7)
                        ? 'bg-sabrar-600 border-sabrar-500 text-white shadow-sm'
                        : 'bg-dark-800 border-dark-700 text-slate-300 hover:bg-dark-750 hover:text-white'
                    }`}
                    title="Definir para daqui a 1 semana"
                  >
                    +7d
                  </button>
                </div>
              </div>

              {/* Input Híbrido: Campo formatado DD/MM/AAAA + Botão de Calendário nativo */}
              <div className="relative flex items-center">
                <input
                  type="text"
                  inputMode="numeric"
                  value={pickupDateText}
                  onChange={(e) => handleDateTextChange(e.target.value)}
                  placeholder="DD/MM/AAAA"
                  maxLength={10}
                  className="w-full text-xs sm:text-sm p-2.5 pr-10 rounded-2xl border border-dark-700 bg-dark-850 focus:outline-none focus:ring-2 focus:ring-sabrar-500 text-white font-mono font-bold tracking-wider"
                  required
                />
                <button
                  type="button"
                  onClick={() => {
                    const el = nativeDateInputRef.current;
                    if (!el) return;
                    try {
                      if (typeof (el as any).showPicker === 'function') {
                        (el as any).showPicker();
                      } else {
                        el.focus();
                      }
                    } catch {
                      el.focus();
                    }
                  }}
                  className="absolute right-2 p-1.5 rounded-xl text-slate-400 hover:text-sabrar-400 hover:bg-dark-800 transition-colors"
                  title="Abrir calendário do sistema"
                >
                  <Calendar className="w-4 h-4 text-sabrar-400" />
                </button>
                {/* Input nativo invisível ancorado para acionar o calendário do sistema */}
                <input
                  ref={nativeDateInputRef}
                  type="date"
                  value={pickupDate}
                  min={getTodayBR()}
                  onChange={(e) => {
                    if (e.target.value) {
                      handleSetPickupDate(e.target.value);
                    }
                  }}
                  className="absolute inset-0 opacity-0 pointer-events-none -z-10"
                  tabIndex={-1}
                  aria-hidden="true"
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1 px-1">
                <span>Digite <strong>DD/MM/AAAA</strong> ou toque nos botões</span>
                <span className="text-emerald-400 font-mono font-semibold">Data: {formatDateBR(pickupDate)}</span>
              </div>
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
                      ? `Enviar para Aprovação (${count} materiais)`
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
