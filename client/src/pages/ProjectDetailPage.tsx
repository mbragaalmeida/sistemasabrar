import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  Sparkles,
  CheckCircle,
  FileText,
  Building,
  Calendar,
  HardHat,
  Send,
  Plus,
  Trash2,
  Edit3,
  RotateCcw,
  ClipboardList,
  Layers,
  BarChart2,
  TrendingUp,
  AlertTriangle,
  Printer,
  UploadCloud,
  Calculator,
  FileSpreadsheet,
  Package,
  Search
} from 'lucide-react';
import { Project, Budget, BudgetItem, ServiceItem, ComparisonRow } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { StatusBadge } from '../components/common/StatusBadge';
import { AIAnalysisModal } from '../components/ai/AIAnalysisModal';
import { ClientProposalModal } from '../components/budget/ClientProposalModal';
import { NewRequestModal } from '../components/modals/NewRequestModal';
import { NewReturnModal } from '../components/modals/NewReturnModal';
import { ImportSpreadsheetModal } from '../components/modals/ImportSpreadsheetModal';
import { AssignEngineersModal } from '../components/modals/AssignEngineersModal';
import { PrintRequestModal } from '../components/modals/PrintRequestModal';
import { EditProjectModal } from '../components/modals/EditProjectModal';
import { LinkMaterialModal } from '../components/modals/LinkMaterialModal';
import { canDeleteProject, canUserViewPrices } from '../utils/permissions';

interface ProjectDetailPageProps {
  projectId: number;
  onBack: () => void;
  onNavigate: (page: string, id?: number) => void;
}

export const ProjectDetailPage: React.FC<ProjectDetailPageProps> = ({
  projectId,
  onBack,
  onNavigate
}) => {
  const { currentUser, activeRole, hasPermission } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'geral' | 'orcamento' | 'solicitacoes' | 'movimentacoes' | 'comparativo'>('geral');

  // Modais
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [isProposalModalOpen, setIsProposalModalOpen] = useState(false);
  const [isNewRequestModalOpen, setIsNewRequestModalOpen] = useState(false);
  const [isNewReturnModalOpen, setIsNewReturnModalOpen] = useState(false);
  const [isSpreadsheetModalOpen, setIsSpreadsheetModalOpen] = useState(false);
  const [isAssignEngineersModalOpen, setIsAssignEngineersModalOpen] = useState(false);
  const [isEditProjectModalOpen, setIsEditProjectModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingProject, setDeletingProject] = useState(false);
  const [selectedRequestForPrint, setSelectedRequestForPrint] = useState<any | null>(null);
  const [linkModalItemIdx, setLinkModalItemIdx] = useState<number | null>(null);

  // Estados locais para edição de orçamento
  const [editableMaterials, setEditableMaterials] = useState<any[]>([]);
  const [editableServices, setEditableServices] = useState<any[]>([]);
  const [editableEquipment, setEditableEquipment] = useState<any[]>([]);
  const [validityDays, setValidityDays] = useState(15);
  const [commercialTerms, setCommercialTerms] = useState('');
  const [materialsMarginPercent, setMaterialsMarginPercent] = useState<number>(0);
  const [laborMarginPercent, setLaborMarginPercent] = useState<number>(0);
  const [savingBudget, setSavingBudget] = useState(false);
  const [approvingBudget, setApprovingBudget] = useState(false);
  const [concludingProject, setConcludingProject] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState(false);

  // Controle de Custos por Obra - Orçado x Realizado (Fase 6)
  const [costControl, setCostControl] = useState<any>(null);
  const [showAddCost, setShowAddCost] = useState(false);
  const [costCategory, setCostCategory] = useState('Empreiteiro / Terceirizado');
  const [costAmount, setCostAmount] = useState('');
  const [costDesc, setCostDesc] = useState('');
  const [costSupplier, setCostSupplier] = useState('');
  const [costInvoice, setCostInvoice] = useState('');
  const [savingCost, setSavingCost] = useState(false);

  const fetchCostControl = async () => {
    try {
      const res = await api.getProjectCostControl(projectId);
      setCostControl(res);
    } catch (err) {
      console.error('Erro ao buscar controle de custos:', err);
    }
  };

  const handleAddCost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!costAmount || !costDesc) {
      alert('Informe o valor e a descrição do custo.');
      return;
    }
    try {
      setSavingCost(true);
      await api.addProjectExtraCost(projectId, {
        category: costCategory,
        description: costDesc,
        supplier_contractor_name: costSupplier,
        amount: Number(costAmount) || 0,
        invoice_number: costInvoice,
        userId: currentUser?.id
      });
      setShowAddCost(false);
      setCostAmount('');
      setCostDesc('');
      setCostSupplier('');
      setCostInvoice('');
      await fetchCostControl();
    } catch (err: any) {
      alert(err.message || 'Erro ao registrar custo extra.');
    } finally {
      setSavingCost(false);
    }
  };

  const handleDeleteCost = async (costId: number) => {
    if (!window.confirm('Excluir este lançamento de custo?')) return;
    try {
      await api.deleteProjectExtraCost(costId);
      await fetchCostControl();
    } catch (err: any) {
      alert(err.message || 'Erro ao excluir custo.');
    }
  };

  // Autocomplete flutuante em tempo real para materiais do orçamento
  const [activeMaterialSearchIdx, setActiveMaterialSearchIdx] = useState<number | null>(null);
  const [rowSuggestions, setRowSuggestions] = useState<any[]>([]);
  const [rowSuggestionLoading, setRowSuggestionLoading] = useState(false);
  const [searchAnchorRect, setSearchAnchorRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const budgetTableRef = useRef<HTMLDivElement>(null);
  const dropdownPortalRef = useRef<HTMLDivElement>(null);
  const searchDebounceRef = useRef<any>(null);
  const searchCallCountRef = useRef(0);

  // Calcula posição para renderizar o dropdown flutuante via React Portal
  const updateAnchorPos = (element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    const dropdownWidth = Math.max(rect.width, 480);
    let left = rect.left;
    if (left + dropdownWidth > window.innerWidth - 16) {
      left = Math.max(16, window.innerWidth - dropdownWidth - 16);
    }
    const top = rect.bottom + 4;
    setSearchAnchorRect({ top, left, width: dropdownWidth });
  };

  // Fecha sugestões ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (dropdownPortalRef.current && dropdownPortalRef.current.contains(target)) {
        return;
      }
      if ((target as HTMLElement)?.closest?.('.material-search-input-container')) {
        return;
      }
      setActiveMaterialSearchIdx(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Trata rolagem ou redimensionamento da janela
  useEffect(() => {
    const handleScrollOrResize = (e: Event) => {
      if (dropdownPortalRef.current && dropdownPortalRef.current.contains(e.target as Node)) {
        return;
      }
      if (activeMaterialSearchIdx !== null) {
        setActiveMaterialSearchIdx(null);
      }
    };
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [activeMaterialSearchIdx]);

  const triggerMaterialSearch = (idx: number, query: string, targetEl?: HTMLElement) => {
    setActiveMaterialSearchIdx(idx);
    if (targetEl) {
      updateAnchorPos(targetEl);
    }
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    if (!query || !query.trim()) {
      setRowSuggestions([]);
      setRowSuggestionLoading(false);
      return;
    }

    setRowSuggestionLoading(true);
    const callId = ++searchCallCountRef.current;
    searchDebounceRef.current = setTimeout(async () => {
      try {
        const results = await api.autocompleteMaterials(query.trim());
        if (callId === searchCallCountRef.current) {
          setRowSuggestions(results || []);
        }
      } catch (err) {
        console.error('Erro no autocomplete de materiais para orçamento:', err);
      } finally {
        if (callId === searchCallCountRef.current) {
          setRowSuggestionLoading(false);
        }
      }
    }, 150);
  };

  const handleInputKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>, idx: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (rowSuggestions.length > 0) {
        handleSelectMaterialSuggestion(idx, rowSuggestions[0]);
        return;
      }
      const currentVal = editableMaterials[idx]?.material_name || editableMaterials[idx]?.material || '';
      if (currentVal.trim()) {
        setRowSuggestionLoading(true);
        try {
          const results = await api.autocompleteMaterials(currentVal.trim());
          setRowSuggestions(results || []);
          if (results && results.length > 0) {
            handleSelectMaterialSuggestion(idx, results[0]);
          }
        } catch (err) {
          console.error('Erro na busca de material:', err);
        } finally {
          setRowSuggestionLoading(false);
        }
      }
    } else if (e.key === 'Escape') {
      setActiveMaterialSearchIdx(null);
    }
  };

  const handleConfirmDelete = async () => {
    setDeletingProject(true);
    try {
      await api.deleteProject(projectId);
      alert(`Obra "${project.name}" excluída com sucesso.`);
      onNavigate('projects');
    } catch (err: any) {
      alert(err.message || 'Erro ao excluir obra');
    } finally {
      setDeletingProject(false);
      setIsDeleteModalOpen(false);
    }
  };

  const handleSelectMaterialSuggestion = (idx: number, material: any, explicitSpreadsheetName?: string) => {
    const targetItem = editableMaterials[idx];
    const originalSpreadsheetName = explicitSpreadsheetName || targetItem?.original_spreadsheet_name || 
      (targetItem?.material_name && targetItem?.material_name !== material.name ? targetItem?.material_name : undefined);

    // Item 2: Salva imediatamente o vínculo (alias) na base para futuros projetos
    if (originalSpreadsheetName && material?.id) {
      api.saveMaterialAliases([{ alias: originalSpreadsheetName, materialId: material.id }]).catch(err => {
        console.warn('Falha ao salvar alias do material:', err);
      });
    }

    setEditableMaterials(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      // REGRA CRÍTICA: Manter estritamente o preço unitário e subtotal levantados na planilha real.
      // O vínculo serve exclusivamente para que o almoxarifado saiba qual material cadastrado atende ao item.
      const currentPrice = Number(item.unit_price !== undefined ? item.unit_price : item.unitPrice) || 0;
      const currentSubtotal = Number(item.subtotal) || 0;
      const qty = Number(item.quantity) || 1;
      
      // Preserva o preço já existente. Apenas se for uma linha criada do zero sem preço algum (manualmente) utiliza o de referência.
      const isManualEmptyRow = !item.material_name && currentPrice === 0 && currentSubtotal === 0;
      const price = isManualEmptyRow ? (Number(material.reference_price) || 0) : currentPrice;
      const subtotal = currentSubtotal > 0 ? currentSubtotal : Number((qty * price).toFixed(2));

      return {
        ...item,
        material_id: material.id,
        materialId: material.id,
        material_code: material.code || item.material_code,
        catalog_material_name: material.name,
        // Item 5: O nome indicado deve ser o nome cadastrado na nossa base, não da planilha!
        material_name: material.name,
        material: material.name,
        original_spreadsheet_name: originalSpreadsheetName || item.original_spreadsheet_name,
        unit: item.unit && item.unit !== 'und' ? item.unit : (material.unit || 'und'),
        unit_price: price,
        unitPrice: price,
        subtotal: subtotal
      };
    }));
    setActiveMaterialSearchIdx(null);
    setRowSuggestions([]);
  };

  const handleUnlinkMaterial = (idx: number) => {
    setEditableMaterials(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      return {
        ...item,
        material_id: undefined,
        materialId: undefined,
        material_code: undefined,
        catalog_material_name: undefined
      };
    }));
  };

  const tabFileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  const handleTabUploadFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const filesArray = Array.from(e.target.files);
    setUploadingDoc(true);
    try {
      await api.uploadProjectFiles(projectId, filesArray, true);
      await fetchProjectData();
    } catch (err: any) {
      alert(err.message || 'Erro no upload de documentos');
    } finally {
      setUploadingDoc(false);
      if (tabFileInputRef.current) tabFileInputRef.current.value = '';
    }
  };

  const fetchProjectData = async () => {
    setLoading(true);
    try {
      const res = await api.getProject(projectId);
      setData(res);
      fetchCostControl();

      if (res.budget) {
        setEditableMaterials((res.budget.items || []).map((item: any) => ({
          ...item,
          original_spreadsheet_name: item.original_spreadsheet_name || 
            (item.human_notes?.match(/Planilha:\s*"([^"]+)"/)?.[1]) ||
            (item.human_notes?.match(/Origem na planilha:\s*"([^"]+)"/)?.[1]) ||
            (item.ai_reasoning?.match(/Item na planilha:\s*"([^"]+)"/)?.[1]) ||
            item.originalSpreadsheetName ||
            item.material_name || item.material
        })));
        setEditableServices(res.budget.services || []);
        setEditableEquipment(res.budget.equipment || []);
        setValidityDays(res.budget.validity_days || 15);
        setCommercialTerms(res.budget.commercial_terms || '');
        setMaterialsMarginPercent(Number(res.budget.materials_margin_percent) || 0);
        setLaborMarginPercent(Number(res.budget.labor_margin_percent) || 0);
      }
    } catch (err) {
      console.error('Erro ao buscar detalhes do projeto:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjectData();
  }, [projectId]);

  if (loading || !data) {
    return (
      <div className="py-20 text-center text-sm text-slate-500">
        Carregando dados completos da obra...
      </div>
    );
  }

  const project: Project = data.project;
  const budget: Budget | null = data.budget;
  const comparisonTable: ComparisonRow[] = data.comparisonTable || [];

  // Recálculo dinâmico e preciso dos totais de orçamento (custo base real preservando subtotais da planilha)
  const getItemSubtotal = (m: any) => {
    if (m.subtotal !== undefined && m.subtotal !== null && !isNaN(Number(m.subtotal)) && Number(m.subtotal) > 0) {
      return Number(Number(m.subtotal).toFixed(2));
    }
    const q = Number(m.quantity) || 0;
    const p = Number(m.unit_price !== undefined ? m.unit_price : (m.unitPrice || 0));
    return Number((q * p).toFixed(2));
  };

  const getServiceSubtotal = (s: any) => {
    if (s.subtotal !== undefined && s.subtotal !== null && !isNaN(Number(s.subtotal)) && Number(s.subtotal) > 0) {
      return Number(Number(s.subtotal).toFixed(2));
    }
    const q = Number(s.quantity) || 0;
    const p = Number(s.unit_price !== undefined ? s.unit_price : (s.unitPrice || 0));
    return Number((q * p).toFixed(2));
  };

  const getEquipmentSubtotal = (eq: any) => {
    if (eq.subtotal !== undefined && eq.subtotal !== null && !isNaN(Number(eq.subtotal)) && Number(eq.subtotal) > 0) {
      return Number(Number(eq.subtotal).toFixed(2));
    }
    const q = Number(eq.quantity) || 0;
    const p = Number(eq.unit_price !== undefined ? eq.unit_price : (eq.unitPrice || 0));
    return Number((q * p).toFixed(2));
  };

  const totalMaterials = Number(editableMaterials.reduce((acc, m) => acc + getItemSubtotal(m), 0).toFixed(2));
  const totalServices = Number(editableServices.reduce((acc, s) => acc + getServiceSubtotal(s), 0).toFixed(2));
  const totalEquipment = Number(editableEquipment.reduce((acc, eq) => acc + getEquipmentSubtotal(eq), 0).toFixed(2));
  const totalBudgetCalculated = Number((totalMaterials + totalServices + totalEquipment).toFixed(2));

  // Totais com margem para a proposta comercial do cliente
  const totalMaterialsClient = Number((totalMaterials * (1 + (Number(materialsMarginPercent) || 0) / 100)).toFixed(2));
  const totalServicesClient = Number((totalServices * (1 + (Number(laborMarginPercent) || 0) / 100)).toFixed(2));
  const totalBudgetCalculatedClient = Number((totalMaterialsClient + totalServicesClient + totalEquipment).toFixed(2));

  const handleAddEquipmentRow = () => {
    const newIdx = editableEquipment.length;
    setEditableEquipment(prev => [
      ...prev,
      {
        category: 'Climatização VRF/VRV',
        description: 'Nova Máquina / Equipamento',
        brand: '',
        quantity: 1,
        unit: 'un',
        unit_price: 0,
        subtotal: 0,
        notes: ''
      }
    ]);
    setTimeout(() => {
      const rowEl = document.getElementById(`equipment-row-${newIdx}`);
      if (rowEl) {
        rowEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const inputEl = rowEl.querySelector('input') as HTMLInputElement | null;
        if (inputEl) inputEl.focus();
      }
    }, 120);
  };

  const handleSaveBudget = async () => {
    setSavingBudget(true);
    try {
      // Filtra e limpa linhas em branco que o usuário possa ter adicionado e não preenchido
      const cleanedMaterials = editableMaterials.filter(m => (m.material_name || m.material || '').trim() || m.material_id || m.materialId);
      if (cleanedMaterials.length !== editableMaterials.length) {
        setEditableMaterials(cleanedMaterials);
      }

      // Salva em lote aliases de itens vinculados da planilha para os próximos projetos (Item 2)
      const aliasesToSave = cleanedMaterials
        .filter(m => (m.material_id || m.materialId) && m.original_spreadsheet_name && m.original_spreadsheet_name !== (m.material_name || m.material))
        .map(m => ({
          alias: m.original_spreadsheet_name,
          materialId: Number(m.material_id || m.materialId)
        }));
      if (aliasesToSave.length > 0) {
        api.saveMaterialAliases(aliasesToSave).catch(e => console.warn('Falha ao salvar lote de aliases:', e));
      }

      await api.saveBudget({
        projectId: project.id,
        materials: cleanedMaterials.map(m => ({
          materialId: m.material_id || m.materialId,
          materialName: (m.material_name || m.material || '').trim() || (m.material_id ? `Material #${m.material_id}` : 'Material Avulso'),
          quantity: Math.max(0.0001, Number(m.quantity) || 1),
          unit: (m.unit && String(m.unit).trim()) ? String(m.unit).trim() : 'und',
          unitPrice: Number(m.unit_price !== undefined ? m.unit_price : (m.unitPrice || 0)) || 0,
          subtotal: getItemSubtotal(m),
          aiSuggestedQuantity: m.ai_suggested_quantity || m.aiSuggestedQuantity || m.quantity,
          aiReasoning: m.ai_reasoning || m.reason,
          humanNotes: m.human_notes || (m.original_spreadsheet_name ? `Origem na planilha: "${m.original_spreadsheet_name}"` : ''),
          originalSpreadsheetName: m.original_spreadsheet_name || null
        })),
        services: editableServices
          .filter(s => (s.description || '').trim())
          .map(s => ({
            category: s.category || 'MÃO DE OBRA',
            description: s.description.trim(),
            quantity: Math.max(0.0001, Number(s.quantity) || 1),
            unit: s.unit || 'h',
            unitPrice: Number(s.unit_price) || 0,
            subtotal: getServiceSubtotal(s),
            notes: s.notes || ''
          })),
        equipment: editableEquipment
          .filter(eq => (eq.description || eq.name || '').trim())
          .map(eq => ({
            category: eq.category || 'Climatização',
            description: (eq.description || eq.name || '').trim(),
            brand: eq.brand || '',
            quantity: Math.max(0.0001, Number(eq.quantity) || 1),
            unit: eq.unit || 'un',
            unitPrice: Number(eq.unit_price !== undefined ? eq.unit_price : (eq.unitPrice || 0)) || 0,
            subtotal: getEquipmentSubtotal(eq),
            notes: eq.notes || ''
          })),
        totalEquipment,
        validityDays,
        commercialTerms,
        materialsMarginPercent: Number(materialsMarginPercent) || 0,
        laborMarginPercent: Number(laborMarginPercent) || 0,
        userId: currentUser?.id,
        userName: currentUser?.name
      });
      setSaveSuccessMsg(true);
      setTimeout(() => setSaveSuccessMsg(false), 3000);
      await fetchProjectData();
    } catch (err: any) {
      console.error('Erro ao salvar orçamento:', err);
      alert(err.message || 'Erro ao salvar alterações no orçamento');
    } finally {
      setSavingBudget(false);
    }
  };

  const isObraConcluida = Boolean(
    project?.status === 'Concluído' ||
    project?.status === 'Concluída' ||
    project?.status === 'Finalizado'
  );

  const isObraLiberada = !isObraConcluida && Boolean(
    project?.status === 'Em execução' ||
    project?.status === 'Aprovado' ||
    budget?.status === 'Aprovado'
  );

  const handleConcludeProject = async () => {
    if (!window.confirm('Tem certeza que deseja concluir esta obra? Após a conclusão, não será mais possível solicitar novos materiais para esta obra.')) {
      return;
    }
    setConcludingProject(true);
    try {
      await api.updateProject(project.id, { status: 'Concluído' });
      await fetchProjectData();
      alert('Obra concluída com sucesso! Solicitações de materiais foram encerradas.');
    } catch (err: any) {
      console.error('Erro ao concluir obra:', err);
      alert(err.message || 'Erro ao concluir obra.');
    } finally {
      setConcludingProject(false);
    }
  };

  const handleApproveBudget = async () => {
    if (!budget || approvingBudget) return;

    if (!project.responsible_engineer || (project.assigned_engineers && project.assigned_engineers.length === 0)) {
      alert('Para iniciar a obra e liberar as solicitações de materiais, é necessário designar ao menos um Engenheiro Responsável. O assistente de designação será aberto agora.');
      setIsAssignEngineersModalOpen(true);
      return;
    }

    if (!window.confirm('Confirma a aprovação deste orçamento? A obra mudará para o status "Em execução" e as solicitações de materiais da Engenharia serão liberadas.')) {
      return;
    }

    setApprovingBudget(true);
    try {
      await api.approveBudget(budget.id, currentUser?.id, currentUser?.name);
      await fetchProjectData();
    } catch (err: any) {
      console.error('Erro ao aprovar orçamento:', err);
      alert(err.message || 'Erro ao aprovar orçamento');
    } finally {
      setApprovingBudget(false);
    }
  };

  const handleAddMaterialRow = () => {
    const newIdx = editableMaterials.length;
    setEditableMaterials(prev => [
      ...prev,
      {
        material_name: '',
        quantity: 1,
        unit: 'und',
        unit_price: 0,
        subtotal: 0,
        human_notes: 'Adicionado manualmente pelo orçamentista'
      }
    ]);
    setActiveMaterialSearchIdx(newIdx);
    setRowSuggestions([]);

    setTimeout(() => {
      const rowEl = document.getElementById(`material-row-${newIdx}`);
      if (rowEl) {
        rowEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const inputEl = rowEl.querySelector('input[type="text"]') as HTMLInputElement | null;
        if (inputEl) inputEl.focus();
      }
    }, 120);
  };

  const handleAddServiceRow = () => {
    const newIdx = editableServices.length;
    setEditableServices(prev => [
      ...prev,
      {
        category: 'MÃO DE OBRA',
        description: 'Serviço de instalação / montagem',
        quantity: 40,
        unit: 'h',
        unit_price: 80.0,
        subtotal: 3200.0
      }
    ]);

    setTimeout(() => {
      const rowEl = document.getElementById(`service-row-${newIdx}`);
      if (rowEl) {
        rowEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const inputEl = rowEl.querySelector('input[type="text"]') as HTMLInputElement | null;
        if (inputEl) inputEl.focus();
      }
    }, 120);
  };

  return (
    <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Navigation & Status Banner */}
      <div className="bg-white dark:bg-dark-900 p-4 sm:p-5 rounded-3xl border border-slate-200 dark:border-dark-750 shadow-xl flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={onBack}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-dark-800 transition-colors"
              title="Voltar"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-emerald-700 dark:text-sabrar-400 bg-slate-100 dark:bg-dark-800 border border-slate-300 dark:border-dark-700 px-2 py-0.5 rounded">
                  {project.code}
                </span>
                <StatusBadge status={project.status} />
              </div>
              <h1 className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight mt-1">
                {project.name}
              </h1>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Engenheiro(s) Responsável(is):</span>
                {project.responsible_engineer ? (
                  <span className="text-xs font-bold text-amber-500 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800/60 px-2.5 py-0.5 rounded-full flex items-center gap-1.5 shadow-xs">
                    <HardHat className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                    {project.responsible_engineer}
                  </span>
                ) : (
                  <span className="text-xs font-bold text-rose-500 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800/60 px-2.5 py-0.5 rounded-full flex items-center gap-1.5 shadow-xs">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                    Pendente de designação
                  </span>
                )}
                {hasPermission(['admin', 'orcamento_engenharia']) && (
                  <button
                    onClick={() => setIsAssignEngineersModalOpen(true)}
                    className="text-[11px] font-bold text-amber-600 dark:text-amber-300 hover:text-white bg-slate-100 dark:bg-dark-800 hover:bg-amber-600 dark:hover:bg-amber-600 px-2.5 py-1 rounded-xl border border-slate-300 dark:border-dark-700 transition-all flex items-center gap-1 shadow-xs active:scale-95"
                    title="Atribuir ou alterar os engenheiros responsáveis por esta obra"
                  >
                    <HardHat className="w-3 h-3" />
                    <span>{project.responsible_engineer ? 'Editar Engenheiros' : '+ Atribuir Engenheiro'}</span>
                  </button>
                )}
                {hasPermission(['admin', 'orcamento', 'orcamento_engenharia']) && (
                  <button
                    onClick={() => setIsEditProjectModalOpen(true)}
                    className="text-[11px] font-bold text-emerald-600 dark:text-sabrar-300 hover:text-white bg-slate-100 dark:bg-dark-800 hover:bg-emerald-600 dark:hover:bg-sabrar-600 px-2.5 py-1 rounded-xl border border-slate-300 dark:border-dark-700 transition-all flex items-center gap-1 shadow-xs active:scale-95"
                    title="Editar dados cadastrais da obra (nome, cliente, endereço, etc.)"
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>Editar Informações da Obra</span>
                  </button>
                )}
                {canDeleteProject(currentUser) && (
                  <button
                    onClick={() => setIsDeleteModalOpen(true)}
                    className="text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:text-white bg-slate-100 dark:bg-dark-800 hover:bg-rose-600 dark:hover:bg-rose-600 px-2.5 py-1 rounded-xl border border-slate-300 dark:border-dark-700 transition-all flex items-center gap-1 shadow-xs active:scale-95"
                    title="Excluir esta obra definitivamente (Apenas Administrador e Sabrina)"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Excluir Obra</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Action CTAs específicos do perfil (Encurtados no mobile para evitar overflow horizontal) */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 w-full sm:w-auto justify-start sm:justify-end mt-1 sm:mt-0">
            {hasPermission(['orcamento']) && (
              <button
                onClick={() => setIsAIModalOpen(true)}
                className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl bg-sabrar-600 hover:bg-sabrar-500 text-white text-xs font-bold shadow-md shadow-sabrar-600/30 active:scale-95 transition-all whitespace-nowrap"
                title="Analisar com Inteligência Artificial"
              >
                <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span className="sm:hidden">Analisar</span>
                <span className="hidden sm:inline">Analisar com IA</span>
              </button>
            )}

            {budget && hasPermission(['orcamento']) && (
              <button
                onClick={() => setIsProposalModalOpen(true)}
                className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl bg-slate-100 dark:bg-dark-800 hover:bg-slate-200 dark:hover:bg-dark-750 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-dark-700 text-xs font-bold active:scale-95 transition-all whitespace-nowrap shadow-xs"
                title="Proposta Comercial para o Cliente"
              >
                <Printer className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 text-emerald-600 dark:text-sabrar-400" />
                <span className="sm:hidden">Proposta</span>
                <span className="hidden sm:inline">Proposta Cliente</span>
              </button>
            )}

            {project.status !== 'Cancelado' && hasPermission(['engenharia', 'orcamento_engenharia', 'compras_solicitacoes']) && (
              isObraLiberada ? (
                <button
                  onClick={() => setIsNewRequestModalOpen(true)}
                  className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl bg-sabrar-600 hover:bg-sabrar-500 text-white text-xs font-bold active:scale-95 transition-all whitespace-nowrap shadow-md shadow-sabrar-600/30"
                  title="Solicitar Material da Obra"
                >
                  <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                  <span className="sm:hidden">Solicitar</span>
                  <span className="hidden sm:inline">Solicitar Material</span>
                </button>
              ) : isObraConcluida ? (
                <button
                  disabled
                  className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl bg-dark-800 text-slate-500 border border-dark-700 text-xs font-semibold whitespace-nowrap cursor-not-allowed opacity-60"
                  title="Obra concluída. Novas solicitações de materiais estão encerradas."
                >
                  <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 text-blue-500" />
                  <span className="hidden sm:inline">Obra Concluída (Bloqueada)</span>
                </button>
              ) : (
                <button
                  disabled
                  className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl bg-dark-800 text-slate-500 border border-dark-700 text-xs font-semibold whitespace-nowrap cursor-not-allowed opacity-60"
                  title="A solicitação de materiais só é liberada após a aprovação do orçamento e início da obra"
                >
                  <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 text-slate-600" />
                  <span className="hidden sm:inline">Solicitar Material (Bloqueado)</span>
                </button>
              )
            )}

            {hasPermission(['admin', 'orcamento_engenharia']) && (
              <button
                onClick={() => setIsAssignEngineersModalOpen(true)}
                className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl bg-dark-800 hover:bg-dark-750 text-amber-300 border border-amber-600/40 text-xs font-bold active:scale-95 transition-all whitespace-nowrap shadow-xs"
                title="Atribuir ou Gerenciar Engenheiros Responsáveis pela Obra"
              >
                <HardHat className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 text-amber-400" />
                <span className="sm:hidden">Engenheiros</span>
                <span className="hidden sm:inline">Engenheiros da Obra</span>
              </button>
            )}
          </div>
        </div>

        {/* Tab Navigation (Filtrada por perfil para foco e sem duplicidade) */}
        <div className="flex items-center gap-1.5 border-t border-slate-200 dark:border-dark-750 pt-3 overflow-x-auto no-scrollbar text-xs font-bold w-full min-w-0">
          <button
            onClick={() => setActiveTab('geral')}
            className={`px-3.5 py-2 rounded-xl transition-all whitespace-nowrap ${
              activeTab === 'geral'
                ? 'bg-emerald-600 dark:bg-sabrar-600 text-white font-bold shadow-md shadow-emerald-600/20'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-dark-800'
            }`}
          >
            Visão Geral & Docs
          </button>

          {hasPermission(['orcamento']) && (
            <button
              onClick={() => setActiveTab('orcamento')}
              className={`px-3.5 py-2 rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'orcamento'
                  ? 'bg-emerald-600 dark:bg-sabrar-600 text-white font-bold shadow-md shadow-emerald-600/20'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-dark-800'
              }`}
            >
              <span>Orçamento & Revisão</span>
              {editableMaterials.length > 0 && (
                <span className={`text-[10px] px-1.5 rounded-full border ${
                  activeTab === 'orcamento'
                    ? 'bg-emerald-700/90 text-white border-emerald-400/40'
                    : 'bg-slate-200 dark:bg-dark-800 text-slate-700 dark:text-slate-400 border-slate-300 dark:border-dark-700'
                }`}>
                  {editableMaterials.length}
                </span>
              )}
            </button>
          )}

          {hasPermission(['orcamento', 'engenharia', 'almoxarifado']) && (
            <button
              onClick={() => setActiveTab('solicitacoes')}
              className={`px-3.5 py-2 rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'solicitacoes'
                  ? 'bg-emerald-600 dark:bg-sabrar-600 text-white font-bold shadow-md shadow-emerald-600/20'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-dark-800'
              }`}
            >
              <span>Solicitações da Obra</span>
              <span className={`text-[10px] px-1.5 rounded-full border ${
                activeTab === 'solicitacoes'
                  ? 'bg-emerald-700/90 text-white border-emerald-400/40'
                  : 'bg-slate-200 dark:bg-dark-800 text-slate-700 dark:text-slate-400 border-slate-300 dark:border-dark-700'
              }`}>
                {data.requests?.length || 0}
              </span>
            </button>
          )}

          {hasPermission(['engenharia', 'almoxarifado']) && (
            <button
              onClick={() => setActiveTab('movimentacoes')}
              className={`px-3.5 py-2 rounded-xl transition-all whitespace-nowrap ${
                activeTab === 'movimentacoes'
                  ? 'bg-emerald-600 dark:bg-sabrar-600 text-white font-bold shadow-md shadow-emerald-600/20'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-dark-800'
              }`}
            >
              Almoxarifado & Devoluções
            </button>
          )}

          {hasPermission(['orcamento', 'engenharia']) && (
            <button
              onClick={() => setActiveTab('comparativo')}
              className={`px-3.5 py-2 rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'comparativo'
                  ? 'bg-emerald-600 dark:bg-sabrar-600 text-white font-bold shadow-md shadow-emerald-600/20'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-dark-800'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              <span>Previsto × Realizado</span>
            </button>
          )}
        </div>
      </div>

      {/* TAB 1: VISÃO GERAL & DOCUMENTOS TÉCNICOS */}
      {activeTab === 'geral' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 animate-in fade-in">
          <div className="lg:col-span-2 space-y-4">
            {/* Alerta de Obra Aprovada sem Engenheiro Atribuído (Requisitos 1 e 3) */}
            {['Aprovado', 'Em execução'].includes(project.status) && !project.responsible_engineer && (
              <div className="p-4 bg-amber-950/40 border border-amber-600/50 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-200 shadow-md">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-white text-sm">Obra Aprovada — Engenheiro Responsável Pendente</div>
                    <p className="text-[11px] text-amber-300/80 mt-0.5">
                      O orçamento desta obra já foi aprovado. Um administrador deverá atribuir um ou mais engenheiros responsáveis para liberar as atividades e solicitações de materiais.
                    </p>
                  </div>
                </div>
                {hasPermission(['admin', 'orcamento_engenharia']) && (
                  <button
                    onClick={() => setIsAssignEngineersModalOpen(true)}
                    className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs shrink-0 transition-colors shadow-md flex items-center gap-1.5"
                  >
                    <HardHat className="w-4 h-4" />
                    <span>Atribuir Engenheiro(s)</span>
                  </button>
                )}
              </div>
            )}

            {/* Informações Básicas */}
            <div className="bg-dark-900 p-4 sm:p-5 rounded-3xl border border-dark-750 shadow-md space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-sm text-white uppercase tracking-wider">
                  Dados Técnicos da Obra
                </h3>
                {hasPermission(['admin', 'orcamento_engenharia']) && (
                  <button
                    onClick={() => setIsAssignEngineersModalOpen(true)}
                    className="text-xs text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 bg-dark-800 hover:bg-dark-750 px-2.5 py-1 rounded-xl border border-dark-700 transition-colors"
                  >
                    <HardHat className="w-3.5 h-3.5" />
                    <span>{project.responsible_engineer ? 'Alterar Engenheiros' : 'Atribuir Engenheiros'}</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 block font-medium">Cliente:</span>
                  <span className="font-bold text-white text-sm">{project.client}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Local / Endereço:</span>
                  <span className="font-semibold text-slate-300">{project.address}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Tipologia:</span>
                  <span className="font-bold text-sabrar-400">{project.project_type}</span>
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 block font-medium">Responsável Técnico / Engenheiro(s):</span>
                  </div>
                  <div className="mt-0.5">
                    {project.responsible_engineer ? (
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-slate-200">{project.responsible_engineer}</span>
                          {project.assigned_engineers && project.assigned_engineers.length > 1 && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-950 border border-amber-800 text-amber-300 font-bold">
                              {project.assigned_engineers.length} engenheiros
                            </span>
                          )}
                        </div>
                        {project.assigned_engineers && project.assigned_engineers.length > 0 && (
                          <div className="flex items-center gap-1 flex-wrap pt-0.5">
                            {project.assigned_engineers.map(e => (
                              <span key={e.id} className="text-[10px] bg-dark-800 px-2 py-0.5 rounded-lg border border-dark-700 text-slate-300 flex items-center gap-1">
                                <HardHat className="w-3 h-3 text-amber-400" />
                                {e.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-amber-400 italic text-[11px]">
                        Pendente de atribuição pelo administrador
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {project.notes && (
                <div className="pt-3 border-t border-dark-750">
                  <span className="text-slate-400 text-xs font-medium block mb-1">Observações Gerais / Escopo:</span>
                  <p className="text-xs text-slate-300 leading-relaxed bg-dark-850 p-3 rounded-2xl border border-dark-700">
                    {project.notes}
                  </p>
                </div>
              )}
            </div>

            {/* Documentos Técnicos & Memorial Descritivo com Upload Direto (Solicitação 1) */}
            <div className="bg-dark-900 p-4 sm:p-5 rounded-3xl border border-dark-750 shadow-md space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="font-extrabold text-sm text-white">Arquivos Técnicos & Memoriais do Projeto</h3>
                  <p className="text-[11px] text-slate-400">Documentos utilizados pelo AI Analysis Service para estimar materiais</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Input oculto para upload de arquivos */}
                  <input
                    ref={tabFileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.dwg,.dxf,.docx,.doc,.txt,.xlsx,.xls,.csv,.ods,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,*"
                    onChange={handleTabUploadFiles}
                    className="hidden"
                  />
                  <button
                    onClick={() => tabFileInputRef.current?.click()}
                    disabled={uploadingDoc}
                    className="text-xs font-bold text-slate-300 hover:text-white flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-dark-800 border border-dark-700 transition-colors"
                  >
                    <UploadCloud className="w-3.5 h-3.5 text-slate-400" />
                    <span>{uploadingDoc ? 'Enviando...' : 'Anexar Documento'}</span>
                  </button>

                  <button
                    onClick={() => setIsSpreadsheetModalOpen(true)}
                    className="text-xs font-bold text-sabrar-300 hover:text-white flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sabrar-950/90 border border-sabrar-500/40 transition-colors shadow-sm active:scale-95"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-sabrar-400" />
                    <span>Importar Planilha Real</span>
                  </button>

                  <button
                    onClick={() => setIsAIModalOpen(true)}
                    className="text-xs font-bold text-white hover:bg-sabrar-500 flex items-center gap-1 px-3 py-1.5 rounded-xl bg-sabrar-600 shadow-md shadow-sabrar-600/30 transition-all"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Reprocessar IA</span>
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {(data.files || []).length === 0 ? (
                  <div className="p-6 text-center rounded-2xl border border-dashed border-dark-700 text-xs text-slate-500">
                    Nenhum documento anexado ainda. Clique em "Anexar Documento" acima para fazer upload.
                  </div>
                ) : (
                  (data.files || []).map((f: any) => (
                    <div key={f.id} className="p-3.5 rounded-2xl border border-dark-700 bg-dark-850 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 truncate">
                          <FileText className="w-4 h-4 text-sabrar-400 shrink-0" />
                          <span className="font-bold text-xs text-white truncate">{f.original_name}</span>
                        </div>
                        <span className="text-[10px] font-bold text-sabrar-400 bg-sabrar-950 px-2 py-0.5 rounded-full border border-sabrar-500/40">
                          {f.type}
                        </span>
                      </div>
                      {f.content_summary && (
                        <div className="text-[11px] text-slate-300 bg-dark-900 p-2.5 rounded-xl border border-dark-750 line-clamp-3 leading-relaxed">
                          {f.content_summary}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Resumo Financeiro & Status */}
          <div className="space-y-4">
            <div className="bg-dark-900 border border-dark-750 p-5 rounded-3xl shadow-xl space-y-4">
              {canUserViewPrices(currentUser) ? (
                <>
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold uppercase tracking-wider text-sabrar-400">Total Geral da Obra</div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sabrar-950 text-sabrar-400 border border-sabrar-500/40">
                      {budget?.status || project.status}
                    </span>
                  </div>
                  <div className="text-3xl font-black text-white">
                    R$ {(project.total_budget_final || totalBudgetCalculated).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-xs text-slate-300 pt-3 border-t border-dark-750 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Materiais ({editableMaterials.length} itens):</span>
                      <span className="font-semibold text-white">
                        R$ {(project.total_budget_materials || totalMaterials).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Serviços & Mão de Obra:</span>
                      <span className="font-semibold text-white">
                        R$ {(project.total_budget_services || totalServices).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  {/* Botão rápido para ir à aba de Orçamento */}
                  <button
                    onClick={() => setActiveTab('orcamento')}
                    className="w-full py-2.5 rounded-2xl bg-dark-850 hover:bg-dark-800 text-sabrar-300 border border-sabrar-500/30 text-xs font-bold transition-all flex items-center justify-center gap-2 active:scale-95"
                  >
                    <Calculator className="w-4 h-4 text-sabrar-400" />
                    <span>Ver / Editar Orçamento Completo ({editableMaterials.length})</span>
                  </button>
                </>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold uppercase tracking-wider text-sabrar-400">Status da Obra</div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sabrar-950 text-sabrar-400 border border-sabrar-500/40">
                    {budget?.status || project.status}
                  </span>
                </div>
              )}

              {isObraLiberada ? (
                <div className="p-3.5 rounded-2xl bg-emerald-950/70 border border-emerald-500/50 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-300 font-bold text-xs">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    <span>Orçamento Aprovado & Obra em Execução</span>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    O orçamento foi aprovado e a obra está liberada para solicitações de materiais.
                  </p>
                  <button
                    onClick={() => setIsNewRequestModalOpen(true)}
                    className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Solicitar Materiais desta Obra</span>
                  </button>
                  {hasPermission(['admin', 'orcamento', 'engenharia', 'orcamento_engenharia']) && (
                    <button
                      onClick={handleConcludeProject}
                      disabled={concludingProject}
                      className="w-full py-2 rounded-xl bg-dark-800 hover:bg-dark-750 text-amber-400 hover:text-amber-300 border border-amber-500/40 text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm active:scale-95 disabled:opacity-50"
                      title="Concluir esta obra e encerrar novas solicitações de materiais"
                    >
                      <CheckCircle className="w-3.5 h-3.5 text-amber-400" />
                      <span>{concludingProject ? 'Concluindo Obra...' : 'Concluir Obra'}</span>
                    </button>
                  )}
                </div>
              ) : isObraConcluida ? (
                <div className="p-3.5 rounded-2xl bg-blue-950/70 border border-blue-500/50 space-y-2">
                  <div className="flex items-center gap-2 text-blue-300 font-bold text-xs">
                    <CheckCircle className="w-4 h-4 text-blue-400" />
                    <span>Obra Concluída & Finalizada</span>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    Esta obra foi concluída. Novas solicitações de materiais estão permanentemente encerradas.
                  </p>
                  <button
                    disabled
                    className="w-full py-2 rounded-xl bg-dark-800 text-slate-500 border border-dark-700 text-xs font-semibold flex items-center justify-center gap-2 cursor-not-allowed opacity-60"
                  >
                    <CheckCircle className="w-3.5 h-3.5 text-blue-500" />
                    <span>Solicitar Materiais (Obra Concluída)</span>
                  </button>
                </div>
              ) : budget ? (
                <button
                  onClick={handleApproveBudget}
                  disabled={approvingBudget}
                  className="w-full py-2.5 rounded-2xl bg-sabrar-600 hover:bg-sabrar-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-sabrar-600/30 active:scale-95 disabled:opacity-50"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>{approvingBudget ? 'Aprovando Obra...' : 'Aprovar Orçamento e Iniciar Obra'}</span>
                </button>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ORÇAMENTO & REVISÃO TÉCNICA */}
      {activeTab === 'orcamento' && (
        <div className="space-y-4 animate-in fade-in">
          {saveSuccessMsg && (
            <div className="p-3 bg-sabrar-950/80 border border-sabrar-500/50 text-sabrar-300 text-xs rounded-2xl flex items-center gap-2 font-bold animate-in fade-in">
              <CheckCircle className="w-4 h-4 text-sabrar-400" />
              Orçamento salvo com sucesso! Todas as alterações humanas foram salvas e calibrarão a IA.
            </div>
          )}

          {!project.responsible_engineer && (
            <div className="p-3.5 bg-amber-950/40 border border-amber-600/50 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5 text-amber-300 font-semibold">
                <HardHat className="w-5 h-5 text-amber-400 shrink-0" />
                <span>
                  <strong>Atenção:</strong> Esta obra ainda não possui Engenheiro Responsável atribuído. 
                  O orçamento pode ser elaborado normalmente, mas a designação será obrigatória antes de iniciar a execução da obra.
                </span>
              </div>
              {hasPermission(['admin']) && (
                <button
                  type="button"
                  onClick={() => setIsAssignEngineersModalOpen(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs transition-colors shrink-0 shadow-sm active:scale-95"
                >
                  Atribuir Engenheiro Agora
                </button>
              )}
            </div>
          )}

          {/* Top Budget Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-dark-900 p-4 rounded-3xl border border-slate-200 dark:border-dark-750 shadow-md">
            <div>
              <div className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Revisão Humana de Orçamento</span>
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">(Setor de Orçamento)</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Altere quantidades, valores ou adicione mão de obra e serviços complementares
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setIsSpreadsheetModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-sabrar-500/40 bg-sabrar-50 dark:bg-sabrar-950/80 hover:bg-sabrar-100 dark:hover:bg-sabrar-900 text-sabrar-700 dark:text-sabrar-300 text-xs font-bold transition-all shadow-sm active:scale-95"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-sabrar-600 dark:text-sabrar-400" />
                <span>Importar Planilha Real (Excel)</span>
              </button>
              <button
                onClick={handleAddMaterialRow}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-dark-700 bg-slate-100 dark:bg-dark-850 hover:bg-slate-200 dark:hover:bg-dark-800 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Material</span>
              </button>
              <button
                onClick={handleAddServiceRow}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-dark-700 bg-slate-100 dark:bg-dark-850 hover:bg-slate-200 dark:hover:bg-dark-800 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Serviço</span>
              </button>
              <button
                onClick={handleAddEquipmentRow}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-cyan-500/40 bg-cyan-50 dark:bg-cyan-950/80 hover:bg-cyan-100 dark:hover:bg-cyan-900 text-cyan-700 dark:text-cyan-300 text-xs font-bold transition-all shadow-sm active:scale-95"
              >
                <Plus className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                <span>+ Máquina</span>
              </button>
              <button
                onClick={handleSaveBudget}
                disabled={savingBudget}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sabrar-600 hover:bg-sabrar-500 text-white text-xs font-bold shadow-md shadow-sabrar-600/30 transition-all active:scale-95 disabled:opacity-50"
              >
                <CheckCircle className="w-4 h-4" />
                <span>{savingBudget ? 'Salvando...' : 'Salvar Alterações'}</span>
              </button>
            </div>
          </div>

          {/* PAINEL PROEMINENTE DE MARGEM COMERCIAL (%) */}
          <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 dark:from-dark-900 dark:via-dark-850 dark:to-dark-900 border-2 border-emerald-500/60 dark:border-emerald-500/40 rounded-3xl p-5 shadow-lg space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-1 px-2.5 rounded-lg bg-emerald-600 text-white font-black text-xs tracking-wider shadow-sm">
                    % MARGEM COMERCIAL
                  </span>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Configuração de Margem para Proposta ao Cliente
                  </h3>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                  O sistema preserva integralmente o seu <strong>Custo Real Base</strong> da planilha e calcula automaticamente a proposta comercial com as margens configuradas.
                </p>
              </div>

              {/* Resumo Total com e sem Margem */}
              <div className="flex items-center gap-4 bg-white dark:bg-dark-900 px-4 py-2.5 rounded-2xl border border-emerald-500/40 shadow-sm shrink-0">
                <div className="text-right">
                  <div className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Total Proposta Cliente</div>
                  <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono">
                    R$ {totalBudgetCalculatedClient.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="h-8 w-px bg-slate-200 dark:bg-dark-700" />
                <div className="text-right">
                  <div className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Custo Real Base</div>
                  <div className="text-xs font-bold text-slate-600 dark:text-slate-400 font-mono">
                    R$ {totalBudgetCalculated.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            </div>

            {/* Cards dos controles de margem */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {/* 1. Margem de Materiais */}
              <div className="bg-white dark:bg-dark-850 p-4 rounded-2xl border-2 border-emerald-400/50 dark:border-dark-700 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200">1. Margem sobre Materiais</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-700">
                    Materiais
                  </span>
                </div>
                <div className="my-3 flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="500"
                      value={materialsMarginPercent}
                      onChange={(e) => setMaterialsMarginPercent(Math.max(0, Number(e.target.value) || 0))}
                      className="w-full text-2xl font-black text-slate-900 dark:text-white bg-slate-50 dark:bg-dark-900 border-2 border-emerald-500 rounded-xl px-3 py-1.5 outline-none focus:ring-2 focus:ring-emerald-400 font-mono"
                      placeholder="0"
                    />
                    <span className="absolute right-3 top-2 text-lg font-black text-emerald-600 dark:text-emerald-400">%</span>
                  </div>
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-400 flex justify-between pt-2 border-t border-slate-100 dark:border-dark-750">
                  <span>Custo Base: <strong>R$ {totalMaterials.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">Cliente: R$ {totalMaterialsClient.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              {/* 2. Margem de Mão de Obra e Serviços */}
              <div className="bg-white dark:bg-dark-850 p-4 rounded-2xl border-2 border-amber-400/50 dark:border-dark-700 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200">2. Margem sobre Serviços</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-700">
                    Mão de Obra
                  </span>
                </div>
                <div className="my-3 flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="500"
                      value={laborMarginPercent}
                      onChange={(e) => setLaborMarginPercent(Math.max(0, Number(e.target.value) || 0))}
                      className="w-full text-2xl font-black text-slate-900 dark:text-white bg-slate-50 dark:bg-dark-900 border-2 border-amber-500 rounded-xl px-3 py-1.5 outline-none focus:ring-2 focus:ring-amber-400 font-mono"
                      placeholder="0"
                    />
                    <span className="absolute right-3 top-2 text-lg font-black text-amber-600 dark:text-amber-400">%</span>
                  </div>
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-400 flex justify-between pt-2 border-t border-slate-100 dark:border-dark-750">
                  <span>Custo Base: <strong>R$ {totalServices.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></span>
                  <span className="font-bold text-amber-600 dark:text-amber-400">Cliente: R$ {totalServicesClient.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              {/* 3. Máquinas / Faturamento Direto */}
              <div className="bg-white dark:bg-dark-850 p-4 rounded-2xl border-2 border-cyan-400/50 dark:border-dark-700 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200">3. Máquinas & Equipamentos</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-cyan-100 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-400 border border-cyan-300 dark:border-cyan-700">
                    Faturamento Direto
                  </span>
                </div>
                <div className="my-3 text-center">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block">Faturado direto ao fabricante</span>
                  <div className="text-xl font-black text-cyan-600 dark:text-cyan-400 font-mono mt-0.5">
                    R$ {totalEquipment.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-400 flex justify-between pt-2 border-t border-slate-100 dark:border-dark-750">
                  <span>Itens: {editableEquipment.length}</span>
                  <span className="font-semibold text-slate-600 dark:text-slate-300">Sem acréscimo</span>
                </div>
              </div>
            </div>
          </div>

          {/* 1. Tabela de Materiais Editável */}
          <div ref={budgetTableRef} className="bg-white dark:bg-dark-900 rounded-3xl border border-slate-200 dark:border-dark-750 shadow-md overflow-hidden">
            <div className="p-4 bg-slate-50 dark:bg-dark-850 border-b border-slate-200 dark:border-dark-750 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-bold text-slate-800 dark:text-slate-200">
              <div className="flex items-center gap-2">
                <span>1. Materiais (Sugestão IA & Revisão Técnica)</span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-normal">({editableMaterials.length} itens)</span>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-slate-500 dark:text-slate-400">
                  Custo Real Base: <strong className="text-slate-900 dark:text-white font-mono">R$ {totalMaterials.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                </span>
                <div className="flex items-center gap-1.5 bg-white dark:bg-dark-900 border-2 border-emerald-500 px-2.5 py-1 rounded-xl shadow-xs">
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-black">Margem (%):</span>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="500"
                    value={materialsMarginPercent}
                    onChange={(e) => setMaterialsMarginPercent(Math.max(0, Number(e.target.value) || 0))}
                    className="w-16 text-center font-black text-slate-900 dark:text-white bg-slate-50 dark:bg-dark-800 border border-slate-300 dark:border-dark-600 rounded px-1.5 py-0.5 text-xs outline-none focus:border-emerald-500"
                    title="Defina a margem comercial (%) sobre os materiais"
                  />
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-bold">%</span>
                </div>
                <span className="text-emerald-700 dark:text-sabrar-300 bg-emerald-50 dark:bg-sabrar-950/80 border border-emerald-300 dark:border-sabrar-600/40 px-2.5 py-1 rounded-xl">
                  Preço Cliente: <strong className="text-emerald-900 dark:text-white font-mono font-black">R$ {totalMaterialsClient.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                </span>
              </div>
            </div>

            <div className="overflow-x-auto" style={{ minHeight: activeMaterialSearchIdx !== null ? '320px' : 'auto' }}>
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-dark-850 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-dark-700">
                  <tr>
                    <th className="p-3">Material</th>
                    <th className="p-3 text-center">Quant. IA</th>
                    <th className="p-3 text-center">Quant. Final *</th>
                    <th className="p-3 text-center">Unid.</th>
                    <th className="p-3 text-right">Preço Unit. (R$)</th>
                    <th className="p-3 text-right">Subtotal</th>
                    <th className="p-3 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-dark-750">
                  {editableMaterials.map((m, idx) => {
                    const sub = getItemSubtotal(m);
                    const isSearchingThisRow = activeMaterialSearchIdx === idx;

                    return (
                      <tr key={idx} id={`material-row-${idx}`} className="hover:bg-slate-50 dark:hover:bg-dark-850/60 transition-colors">
                        <td className="p-3">
                          <div className="relative flex items-center material-search-input-container">
                            <input
                              type="text"
                              placeholder="Digite para pesquisar na base SABRAR (ou Enter)..."
                              value={m.material_name || m.material || ''}
                              onFocus={(e) => {
                                const val = m.material_name || m.material || '';
                                triggerMaterialSearch(idx, val, e.currentTarget);
                              }}
                              onChange={(e) => {
                                const val = e.target.value;
                                setEditableMaterials(prev => prev.map((item, i) => i === idx ? {
                                  ...item,
                                  material_name: val,
                                  material: val,
                                  original_spreadsheet_name: item.original_spreadsheet_name || (item.material_name !== val ? item.material_name : val)
                                } : item));
                                triggerMaterialSearch(idx, val, e.currentTarget);
                              }}
                              onKeyDown={(e) => handleInputKeyDown(e, idx)}
                              className="w-full font-bold text-slate-900 dark:text-white bg-transparent border-b border-slate-300 dark:border-dark-700 hover:border-slate-500 focus:border-sabrar-500 focus:bg-slate-50 dark:focus:bg-dark-850 pl-2 pr-7 py-1 rounded outline-none transition-colors"
                            />
                            <button
                              type="button"
                              onClick={() => setLinkModalItemIdx(idx)}
                              className="absolute right-1 text-slate-400 hover:text-sabrar-400 p-1"
                              title="Abrir busca interna no catálogo de materiais"
                            >
                              <Search className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {!m.material_id ? (
                              <button
                                type="button"
                                onClick={() => setLinkModalItemIdx(idx)}
                                className="text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 dark:hover:bg-amber-900/80 border border-amber-500/50 px-2 py-0.5 rounded transition-all flex items-center gap-1 active:scale-95 shadow-xs"
                                title="Clique para abrir a busca interna e vincular a um item oficial do catálogo SABRAR"
                              >
                                <span>🔗 Vincular ao catálogo oficial</span>
                              </button>
                            ) : (
                              <div className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-500/50 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded text-[10px]">
                                <span className="font-semibold">✓ Catálogo: {m.material_code ? `[${m.material_code}] ` : ''}{m.catalog_material_name || m.material_name}</span>
                                <button
                                  type="button"
                                  onClick={() => setLinkModalItemIdx(idx)}
                                  className="ml-1 text-slate-400 hover:text-amber-500 font-bold px-1"
                                  title="Alterar vínculo no catálogo"
                                >
                                  ✎
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleUnlinkMaterial(idx)}
                                  className="text-slate-400 hover:text-rose-500 font-bold px-1"
                                  title="Desvincular do catálogo"
                                >
                                  ×
                                </button>
                              </div>
                            )}
                            {m.original_spreadsheet_name && m.original_spreadsheet_name !== (m.catalog_material_name || m.material_name) && (
                              <span className="text-[10px] text-amber-700 dark:text-amber-400/90 font-medium italic">
                                (Item planilha: "{m.original_spreadsheet_name}")
                              </span>
                            )}
                            {(m.ai_reasoning || m.reason) && (
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1 italic">
                                ({m.ai_reasoning || m.reason})
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-center font-mono text-slate-400">
                          {m.ai_suggested_quantity || m.aiSuggestedQuantity || m.quantity}
                        </td>
                        <td className="p-3 text-center">
                          <input
                            type="number"
                            step="any"
                            value={m.quantity}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setEditableMaterials(prev => prev.map((item, i) => i === idx ? {
                                ...item,
                                quantity: val,
                                subtotal: Number((val * (Number(item.unit_price !== undefined ? item.unit_price : item.unitPrice) || 0)).toFixed(2))
                              } : item));
                            }}
                            className="w-20 text-center font-black text-white bg-dark-850 border border-dark-700 focus:border-sabrar-500 p-1 rounded-lg outline-none"
                          />
                        </td>
                        <td className="p-3 text-center">
                          <input
                            type="text"
                            value={m.unit || 'und'}
                            onChange={(e) => {
                              const val = e.target.value;
                              setEditableMaterials(prev => prev.map((item, i) => i === idx ? { ...item, unit: val } : item));
                            }}
                            className="w-16 text-center text-xs font-medium text-slate-300 bg-dark-850 border border-dark-700 focus:border-sabrar-500 p-1 rounded-lg outline-none"
                          />
                        </td>
                        <td className="p-3 text-right">
                          <input
                            type="number"
                            step="0.01"
                            value={m.unit_price || m.unitPrice}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setEditableMaterials(prev => prev.map((item, i) => i === idx ? {
                                ...item,
                                unit_price: val,
                                unitPrice: val,
                                subtotal: Number(((Number(item.quantity) || 1) * val).toFixed(2))
                              } : item));
                            }}
                            className="w-24 text-right font-bold text-white bg-dark-850 border border-dark-700 focus:border-sabrar-500 p-1 rounded-lg outline-none"
                          />
                        </td>
                        <td className="p-3 text-right font-black text-white">
                          R$ {sub.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => setEditableMaterials(prev => prev.filter((_, i) => i !== idx))}
                            className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-950/40"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 2. Mão de Obra e Serviços Complementares */}
          <div className="bg-dark-900 rounded-3xl border border-dark-750 overflow-hidden shadow-md">
            <div className="p-4 bg-dark-850 border-b border-dark-750 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-bold text-slate-200">
              <div className="flex items-center gap-2">
                <span>2. Serviços, Mão de Obra & Custos Complementares</span>
                <span className="text-[11px] text-slate-400 font-normal">({editableServices.length} itens)</span>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-slate-400">
                  Custo Real Base: <strong className="text-white font-mono">R$ {totalServices.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                </span>
                <div className="flex items-center gap-1.5 bg-white dark:bg-dark-900 border-2 border-amber-500 px-2.5 py-1 rounded-xl shadow-xs">
                  <span className="text-[11px] text-amber-600 dark:text-amber-400 font-black">Margem (%):</span>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="500"
                    value={laborMarginPercent}
                    onChange={(e) => setLaborMarginPercent(Math.max(0, Number(e.target.value) || 0))}
                    className="w-16 text-center font-black text-slate-900 dark:text-white bg-slate-50 dark:bg-dark-800 border border-slate-300 dark:border-dark-600 rounded px-1.5 py-0.5 text-xs outline-none focus:border-amber-500"
                    title="Defina a margem comercial (%) sobre serviços e mão de obra"
                  />
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-bold">%</span>
                </div>
                <span className="text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-600/40 px-2.5 py-1 rounded-xl">
                  Preço Cliente: <strong className="text-amber-900 dark:text-white font-mono font-black">R$ {totalServicesClient.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-dark-850 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-dark-700">
                  <tr>
                    <th className="p-3">Categoria</th>
                    <th className="p-3">Descrição do Serviço</th>
                    <th className="p-3 text-center">Quant.</th>
                    <th className="p-3 text-center">Unid.</th>
                    <th className="p-3 text-right">Valor Unit. (R$)</th>
                    <th className="p-3 text-right">Subtotal</th>
                    <th className="p-3 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-dark-750">
                  {editableServices.map((s, idx) => {
                    const sub = getServiceSubtotal(s);
                    return (
                      <tr key={idx} id={`service-row-${idx}`} className="hover:bg-slate-50 dark:hover:bg-dark-850/60 transition-colors">
                        <td className="p-3">
                          <select
                            value={s.category}
                            onChange={(e) => {
                              const val = e.target.value;
                              setEditableServices(prev => prev.map((item, i) => i === idx ? { ...item, category: val } : item));
                            }}
                            className="text-[11px] font-bold uppercase p-1 rounded border border-dark-700 bg-dark-850 text-white"
                          >
                            <option value="MÃO DE OBRA">MÃO DE OBRA</option>
                            <option value="SERVIÇO ESPECIALIZADO">SERVIÇO ESPECIALIZADO</option>
                            <option value="EQUIPAMENTO">EQUIPAMENTO</option>
                            <option value="LOGÍSTICA">LOGÍSTICA</option>
                            <option value="IMPOSTOS">IMPOSTOS</option>
                            <option value="OUTROS">OUTROS</option>
                          </select>
                        </td>
                        <td className="p-3">
                          <input
                            type="text"
                            value={s.description}
                            onChange={(e) => {
                              const val = e.target.value;
                              setEditableServices(prev => prev.map((item, i) => i === idx ? { ...item, description: val } : item));
                            }}
                            className="w-full font-medium text-white bg-transparent border-b border-transparent hover:border-dark-700 focus:border-sabrar-500 focus:bg-dark-850 px-1 py-0.5 rounded outline-none"
                          />
                        </td>
                        <td className="p-3 text-center">
                          <input
                            type="number"
                            step="any"
                            value={s.quantity}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setEditableServices(prev => prev.map((item, i) => i === idx ? {
                                ...item,
                                quantity: val,
                                subtotal: Number((val * (Number(item.unit_price) || 0)).toFixed(2))
                              } : item));
                            }}
                            className="w-16 text-center font-bold text-white bg-dark-850 border border-dark-700 p-1 rounded-lg outline-none"
                          />
                        </td>
                        <td className="p-3 text-center">
                          <input
                            type="text"
                            value={s.unit || 'vb'}
                            onChange={(e) => {
                              const val = e.target.value;
                              setEditableServices(prev => prev.map((item, i) => i === idx ? { ...item, unit: val } : item));
                            }}
                            className="w-16 text-center text-xs font-medium text-slate-300 bg-dark-850 border border-dark-700 focus:border-amber-500 p-1 rounded-lg outline-none"
                          />
                        </td>
                        <td className="p-3 text-right">
                          <input
                            type="number"
                            step="0.1"
                            value={s.unit_price}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setEditableServices(prev => prev.map((item, i) => i === idx ? {
                                ...item,
                                unit_price: val,
                                subtotal: Number(((Number(item.quantity) || 1) * val).toFixed(2))
                              } : item));
                            }}
                            className="w-20 text-right font-bold text-white bg-dark-850 border border-dark-700 p-1 rounded-lg outline-none"
                          />
                        </td>
                        <td className="p-3 text-right font-black text-white">
                          R$ {sub.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => setEditableServices(prev => prev.filter((_, i) => i !== idx))}
                            className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-950/40"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 3. Máquinas e Equipamentos Principais (Faturamento Direto) */}
          <div className="bg-dark-900 rounded-3xl border border-dark-750 overflow-hidden shadow-md">
            <div className="p-4 bg-dark-850 border-b border-dark-750 flex items-center justify-between text-xs font-bold text-slate-200">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400"></span>
                <span className="text-sm font-extrabold text-white">3. Máquinas & Equipamentos Principais (Faturamento Direto)</span>
              </div>
              <span className="text-cyan-400 font-extrabold">
                Subtotal Máquinas: R$ {totalEquipment.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>

            {editableEquipment.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
                <span>Nenhuma máquina ou equipamento principal cadastrado neste orçamento.</span>
                <button
                  type="button"
                  onClick={handleAddEquipmentRow}
                  className="px-3.5 py-1.5 rounded-xl bg-cyan-950 border border-cyan-500/40 text-cyan-300 font-bold hover:bg-cyan-900 transition-colors shadow-sm"
                >
                  + Adicionar Máquina / Equipamento
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-dark-850 text-slate-400 font-semibold border-b border-dark-700">
                    <tr>
                      <th className="p-3">Categoria</th>
                      <th className="p-3">Descrição da Máquina / Equipamento</th>
                      <th className="p-3">Fabricante</th>
                      <th className="p-3 text-center">Quant.</th>
                      <th className="p-3 text-center">Unid.</th>
                      <th className="p-3 text-right">Valor Unit. (R$)</th>
                      <th className="p-3 text-right">Subtotal</th>
                      <th className="p-3 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dark-750">
                    {editableEquipment.map((eq, idx) => {
                      const uPrice = Number(eq.unit_price !== undefined ? eq.unit_price : (eq.unitPrice || 0));
                      const sub = getEquipmentSubtotal(eq);
                      return (
                        <tr key={idx} id={`equipment-row-${idx}`} className="hover:bg-slate-50 dark:hover:bg-dark-850/60 transition-colors">
                          <td className="p-3">
                            <input
                              type="text"
                              value={eq.category || ''}
                              placeholder="Ex: VRV, Coifa"
                              onChange={(e) => {
                                const val = e.target.value;
                                setEditableEquipment(prev => prev.map((item, i) => i === idx ? { ...item, category: val } : item));
                              }}
                              className="w-28 text-[11px] font-bold text-cyan-300 bg-dark-850 border border-dark-700 p-1 rounded outline-none"
                            />
                          </td>
                          <td className="p-3">
                            <input
                              type="text"
                              value={eq.description || eq.name || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setEditableEquipment(prev => prev.map((item, i) => i === idx ? { ...item, description: val } : item));
                              }}
                              className="w-full font-medium text-white bg-transparent border-b border-transparent hover:border-dark-700 focus:border-cyan-500 focus:bg-dark-850 px-1 py-0.5 rounded outline-none"
                            />
                          </td>
                          <td className="p-3">
                            <input
                              type="text"
                              value={eq.brand || ''}
                              placeholder="Ex: Daikin"
                              onChange={(e) => {
                                const val = e.target.value;
                                setEditableEquipment(prev => prev.map((item, i) => i === idx ? { ...item, brand: val } : item));
                              }}
                              className="w-24 text-xs text-slate-300 bg-transparent border-b border-transparent hover:border-dark-700 focus:border-cyan-500 focus:bg-dark-850 px-1 py-0.5 rounded outline-none"
                            />
                          </td>
                          <td className="p-3 text-center">
                            <input
                              type="number"
                              step="any"
                              value={eq.quantity}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setEditableEquipment(prev => prev.map((item, i) => i === idx ? {
                                  ...item,
                                  quantity: val,
                                  subtotal: Number((val * (Number(item.unit_price !== undefined ? item.unit_price : (item.unitPrice || 0)))).toFixed(2))
                                } : item));
                              }}
                              className="w-16 text-center font-bold text-white bg-dark-850 border border-dark-700 p-1 rounded-lg outline-none"
                            />
                          </td>
                          <td className="p-3 text-center">
                            <input
                              type="text"
                              value={eq.unit || 'un'}
                              onChange={(e) => {
                                const val = e.target.value;
                                setEditableEquipment(prev => prev.map((item, i) => i === idx ? { ...item, unit: val } : item));
                              }}
                              className="w-16 text-center text-xs font-medium text-slate-300 bg-dark-850 border border-dark-700 focus:border-cyan-500 p-1 rounded-lg outline-none"
                            />
                          </td>
                          <td className="p-3 text-right">
                            <input
                              type="number"
                              step="0.1"
                              value={uPrice}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setEditableEquipment(prev => prev.map((item, i) => i === idx ? {
                                  ...item,
                                  unit_price: val,
                                  unitPrice: val,
                                  subtotal: Number(((Number(item.quantity) || 1) * val).toFixed(2))
                                } : item));
                              }}
                              className="w-24 text-right font-bold text-white bg-dark-850 border border-dark-700 p-1 rounded-lg outline-none"
                            />
                          </td>
                          <td className="p-3 text-right font-black text-cyan-400">
                            R$ {sub.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-3 text-center">
                            <button
                              type="button"
                              onClick={() => setEditableEquipment(prev => prev.filter((_, i) => i !== idx))}
                              className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-950/40"
                              title="Remover máquina"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Resumo Final do Orçamento */}
          <div className="p-4 sm:p-5 bg-dark-850 border border-dark-700 text-white rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-sabrar-400 uppercase">Resumo da Proposta ao Cliente</span>
                {(materialsMarginPercent > 0 || laborMarginPercent > 0) && (
                  <span className="text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full">
                    Margens: Materiais (+{materialsMarginPercent}%) • Serviços (+{laborMarginPercent}%)
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-3 mt-1 flex-wrap">
                <div className="text-2xl sm:text-3xl font-black text-white">
                  R$ {totalBudgetCalculatedClient.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-xs text-slate-400">
                  (Custo Base Real Interno: R$ {totalBudgetCalculated.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})
                </div>
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                Materiais Cliente: R$ {totalMaterialsClient.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} • Mão de Obra Cliente: R$ {totalServicesClient.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                {totalEquipment > 0 && ` • Faturamento Direto (Máquinas): R$ ${totalEquipment.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleSaveBudget}
                disabled={savingBudget}
                className="px-5 py-2.5 rounded-2xl bg-sabrar-600 hover:bg-sabrar-500 text-white text-xs font-bold transition-all shadow-md shadow-sabrar-600/30 active:scale-95 disabled:opacity-50"
              >
                {savingBudget ? 'Salvando...' : 'Salvar Orçamento & Margens'}
              </button>
              {budget && (
                <button
                  onClick={() => setIsProposalModalOpen(true)}
                  className="px-5 py-2.5 rounded-2xl bg-dark-800 text-white hover:bg-dark-750 border border-dark-700 text-xs font-bold transition-all"
                >
                  Visualizar Proposta Cliente
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SOLICITAÇÕES DE MATERIAIS */}
      {activeTab === 'solicitacoes' && (
        <div className="space-y-4 animate-in fade-in">
          {!isObraLiberada && (
            <div className="p-4 bg-amber-950/50 border border-amber-600/50 rounded-2xl flex items-center gap-3 text-amber-200 text-xs">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
              <div>
                <div className="font-bold text-amber-300">Solicitação de Materiais Bloqueada</div>
                <p className="text-[11px] text-amber-200/80 mt-0.5">
                  Conforme os procedimentos da SABRAR, solicitações de materiais só são liberadas após a aprovação do orçamento na aba "Orçamento & Revisão" e o início formal da obra.
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-dark-900 p-4 rounded-3xl border border-slate-200 dark:border-dark-750 shadow-md">
            <div>
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">Solicitações de Materiais da Obra</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Módulo operacional da Engenharia com verificação de estoque</p>
            </div>
            {isObraLiberada ? (
              <button
                onClick={() => setIsNewRequestModalOpen(true)}
                className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-2xl bg-sabrar-600 hover:bg-sabrar-500 text-white text-xs font-bold shadow-md shadow-sabrar-600/30 active:scale-95 transition-all shrink-0 w-full sm:w-auto"
              >
                <Plus className="w-4 h-4" />
                <span>Nova Solicitação</span>
              </button>
            ) : (
              <button
                disabled
                className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-2xl bg-dark-800 text-slate-500 border border-dark-700 text-xs font-semibold shrink-0 cursor-not-allowed opacity-60 w-full sm:w-auto"
                title="Liberação após aprovação do orçamento"
              >
                <Plus className="w-4 h-4" />
                <span>Nova Solicitação (Bloqueado)</span>
              </button>
            )}
          </div>

          <div className="space-y-3">
            {(data.requests || []).map((req: any) => (
              <div key={req.id} className="bg-white dark:bg-dark-900 p-4 rounded-3xl border border-slate-200 dark:border-dark-750 shadow-md space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-bold text-xs bg-slate-100 dark:bg-dark-800 border border-slate-300 dark:border-dark-700 px-2 py-0.5 rounded text-emerald-700 dark:text-sabrar-400">
                      {req.code}
                    </span>
                    <StatusBadge status={req.priority} size="sm" />
                    <StatusBadge status={req.status} size="sm" />
                    {req.status === 'Aguardando aprovação' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-950 text-amber-300 border border-amber-600/50">
                        <AlertTriangle className="w-3 h-3 text-amber-400" />
                        Aguardando Aprovação Admin (Extras)
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      {new Date(req.created_at).toLocaleDateString('pt-BR')} por {req.requested_by_name}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedRequestForPrint({
                          ...req,
                          project_name: project.name,
                          project_code: project.code,
                          client_name: project.client,
                          responsible_engineer: project.responsible_engineer
                        });
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/30 transition-all active:scale-95"
                      title="Imprimir Romaneio de Separação de Materiais"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Imprimir Romaneio</span>
                    </button>
                  </div>
                </div>

                {req.status === 'Aguardando aprovação' && hasPermission(['admin']) && (
                  <div className="p-3 bg-amber-950/40 border border-amber-600/50 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <span className="text-amber-300 font-medium">Esta solicitação contém materiais extras além do orçamento previsto e requer autorização da administração.</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={async () => {
                          if (window.confirm(`Aprovar liberação dos materiais extras da solicitação ${req.code}?`)) {
                            await api.approveExtraRequest(req.id, currentUser?.id, 'Aprovado pelo Administrador na Obra');
                            await fetchProjectData();
                          }
                        }}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm transition-colors"
                      >
                        Aprovar Extras
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          const note = prompt('Motivo da recusa do material extra:');
                          if (note) {
                            await api.rejectExtraRequest(req.id, currentUser?.id, note);
                            await fetchProjectData();
                          }
                        }}
                        className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-sm transition-colors"
                      >
                        Recusar
                      </button>
                    </div>
                  </div>
                )}

                <div className="divide-y divide-slate-200 dark:divide-dark-750 border border-slate-200 dark:border-dark-700 rounded-2xl p-2 bg-slate-50 dark:bg-dark-850">
                  {(req.items || []).map((it: any) => (
                    <div key={it.id} className="py-2.5 px-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <div className="min-w-0">
                        <span className="font-bold text-slate-900 dark:text-white block sm:inline">{it.material_name}</span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 sm:ml-2 font-mono">({it.material_code})</span>
                        {it.is_extra && (
                          <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-600/40">
                            Extra Obra (+{it.extra_quantity || it.quantity_requested})
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 sm:gap-4 shrink-0">
                        <span className="font-semibold text-slate-600 dark:text-slate-300">
                          Solicitado: <span className="font-bold text-slate-900 dark:text-white">{it.quantity_requested} {it.material_unit}</span>
                        </span>
                        {it.deficit > 0 && (
                          <span className="font-bold text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-950/80 px-2 py-0.5 rounded border border-rose-300 dark:border-rose-700 text-[11px]">
                            Déficit: {it.deficit} (Compras notificado)
                          </span>
                        )}
                        {it.quantity_delivered > 0 && (
                          <span className="font-bold text-emerald-800 dark:text-sabrar-300 bg-emerald-100 dark:bg-sabrar-950 px-2 py-0.5 rounded border border-emerald-300 dark:border-sabrar-500/40 text-[11px]">
                            Entregue: {it.quantity_delivered}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: ALMOXARIFADO & DEVOLUÇÕES */}
      {activeTab === 'movimentacoes' && (
        <div className="space-y-4 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-dark-900 p-4 rounded-3xl border border-slate-200 dark:border-dark-750 shadow-md">
            <div>
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">Almoxarifado & Devoluções da Obra</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Histórico de saídas para o canteiro e retorno de sobras</p>
            </div>
            <button
              onClick={() => setIsNewReturnModalOpen(true)}
              className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-2xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold shadow-md shadow-teal-600/30 active:scale-95 transition-all shrink-0 w-full sm:w-auto"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Registrar Devolução</span>
            </button>
          </div>

          <div className="bg-white dark:bg-dark-900 rounded-3xl border border-slate-200 dark:border-dark-750 p-4 shadow-md">
            <h4 className="font-extrabold text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
              Devoluções Registradas ao Almoxarifado
            </h4>
            {(data.returns || []).length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                Nenhuma devolução registrada nesta obra até o momento.
              </div>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-dark-750">
                {data.returns.map((ret: any) => (
                  <div key={ret.id} className="py-3 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white">{ret.code} — {ret.material_name}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        Motivo: {ret.reason || 'Sobra reutilizável'} • Recebido por: {ret.received_by_name}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-black text-teal-600 dark:text-teal-400 text-sm">+{ret.quantity} {ret.material_unit}</span>
                      <div className="text-[10px] text-slate-400 dark:text-slate-500">Voltaram ao estoque físico</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: PREVISTO × REALIZADO & VARIAÇÕES */}
      {activeTab === 'comparativo' && (
        <div className="space-y-4 animate-in fade-in">

          {/* CONTROLE FINANCEIRO CONSOLIDADO DA OBRA (FASE 6: ORÇADO X REALIZADO) */}
          <div className="bg-dark-900 border border-dark-750 rounded-3xl p-5 shadow-xl space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-dark-750 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-sabrar-400" />
                  <h3 className="text-base font-extrabold text-white">
                    Controle de Custos Consolidado (Orçado × Realizado)
                  </h3>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Comparativo financeiro da Ordem de Produção (OP) orçada contra os desembolsos reais em materiais, empreiteiros terceirizados, fretes e dutos.
                </p>
              </div>

              {!showAddCost && (
                <button
                  type="button"
                  onClick={() => setShowAddCost(true)}
                  className="px-3.5 py-2 bg-sabrar-600 hover:bg-sabrar-500 text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-1.5 transition-all self-start sm:self-auto active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  Lançar Custo Extra (Empreiteiro / Frete / Dutos)
                </button>
              )}
            </div>

            {/* 3 KPIs Financeiros */}
            {costControl?.summary && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-dark-850 p-4 rounded-2xl border border-dark-700">
                  <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Orçado na OP (Materiais + Serviços)</span>
                  <div className="text-2xl font-black text-white mt-1">
                    R$ {Number(costControl.summary.totalBudgeted || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">
                    Materiais: R$ {Number(costControl.summary.materialsBudgeted || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} • Serviços: R$ {Number(costControl.summary.servicesBudgeted || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                </div>

                <div className="bg-dark-850 p-4 rounded-2xl border border-dark-700">
                  <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Realizado Efetivo (Total Gasto)</span>
                  <div className="text-2xl font-black text-amber-400 mt-1">
                    R$ {Number(costControl.summary.totalActual || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    {costControl.summary.variancePercent}% do orçamento executado
                  </div>
                </div>

                <div className={`p-4 rounded-2xl border ${
                  costControl.summary.isOverBudget
                    ? 'bg-rose-950/40 border-rose-800/60 text-rose-300'
                    : 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                }`}>
                  <span className="text-[11px] font-bold uppercase tracking-wider">
                    {costControl.summary.isOverBudget ? 'Estouro de Orçamento' : 'Saldo / Margem Disponível'}
                  </span>
                  <div className="text-2xl font-black mt-1">
                    R$ {Math.abs(Number(costControl.summary.variance || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-[10px] font-medium mt-1">
                    {costControl.summary.isOverBudget ? '⚠️ A obra ultrapassou a previsão da OP' : '✓ Custo realizado dentro do teto previsto'}
                  </div>
                </div>
              </div>
            )}

            {/* Breakdown de Custos Realizados por Categoria */}
            {costControl?.summary && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-dark-850 p-3.5 rounded-2xl border border-dark-700">
                <div>
                  <span className="text-slate-400 block font-medium">1. Materiais (Compras):</span>
                  <span className="font-bold text-white text-sm">
                    R$ {Number(costControl.summary.materialsActual || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">2. Empreiteiros Terceirizados:</span>
                  <span className="font-bold text-white text-sm">
                    R$ {Number(costControl.summary.contractorsActual || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">3. Fretes & Logística:</span>
                  <span className="font-bold text-white text-sm">
                    R$ {Number(costControl.summary.freightActual || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">4. Fabricação de Dutos:</span>
                  <span className="font-bold text-white text-sm">
                    R$ {Number(costControl.summary.ductsActual || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            )}

            {/* Formulário Colapsável de Novo Custo Extra */}
            {showAddCost && (
              <form onSubmit={handleAddCost} className="bg-dark-850 border border-dark-700 p-4 rounded-2xl space-y-3">
                <div className="flex items-center justify-between border-b border-dark-700 pb-2">
                  <h4 className="font-bold text-xs text-white flex items-center gap-2">
                    <Plus className="w-4 h-4 text-sabrar-400" />
                    Lançar Custo Adicional na Obra
                  </h4>
                  <button
                    type="button"
                    onClick={() => setShowAddCost(false)}
                    className="text-xs text-slate-400 hover:text-white"
                  >
                    Cancelar
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">
                      Categoria do Custo *
                    </label>
                    <select
                      value={costCategory}
                      onChange={e => setCostCategory(e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-xl bg-dark-800 border border-dark-700 text-white font-medium"
                    >
                      <option value="Empreiteiro / Terceirizado">Empreiteiro / Terceirizado</option>
                      <option value="Frete / Transporte">Frete / Transporte</option>
                      <option value="Fabricação de Dutos">Fabricação de Dutos</option>
                      <option value="Outros">Outros Custos Indiretos</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">
                      Valor (R$) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="0,00"
                      value={costAmount}
                      onChange={e => setCostAmount(e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-xl bg-dark-800 border border-dark-700 text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">
                      Fornecedor / Prestador / Motorista
                    </label>
                    <input
                      type="text"
                      placeholder="Nome do terceiro"
                      value={costSupplier}
                      onChange={e => setCostSupplier(e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-xl bg-dark-800 border border-dark-700 text-white"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">
                      Descrição do Serviço / Despesa *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Instalação de linha frigorígena 3º pavimento"
                      value={costDesc}
                      onChange={e => setCostDesc(e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-xl bg-dark-800 border border-dark-700 text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">
                      N° Nota Fiscal / Recibo
                    </label>
                    <input
                      type="text"
                      placeholder="N° NF"
                      value={costInvoice}
                      onChange={e => setCostInvoice(e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-xl bg-dark-800 border border-dark-700 text-white"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAddCost(false)}
                    className="px-3 py-1.5 text-xs text-slate-400 hover:text-white rounded-xl bg-dark-800 hover:bg-dark-750"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={savingCost}
                    className="px-4 py-1.5 text-xs bg-sabrar-600 hover:bg-sabrar-500 text-white font-bold rounded-xl shadow-md transition-colors"
                  >
                    {savingCost ? 'Salvando...' : 'Gravar Custo na Obra'}
                  </button>
                </div>
              </form>
            )}

            {/* Tabela de Custos Extras Cadastrados */}
            {costControl?.extraCosts && costControl.extraCosts.length > 0 && (
              <div className="overflow-x-auto rounded-2xl border border-dark-750">
                <table className="w-full text-left text-xs">
                  <thead className="bg-dark-850 text-slate-400 font-semibold border-b border-dark-700">
                    <tr>
                      <th className="p-3">Data</th>
                      <th className="p-3">Categoria</th>
                      <th className="p-3">Descrição</th>
                      <th className="p-3">Fornecedor / Prestador</th>
                      <th className="p-3">NF</th>
                      <th className="p-3 text-right">Valor</th>
                      <th className="p-3 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dark-750">
                    {costControl.extraCosts.map((c: any) => (
                      <tr key={c.id} className="hover:bg-dark-850/60">
                        <td className="p-3 text-slate-400">{new Date(c.cost_date).toLocaleDateString('pt-BR')}</td>
                        <td className="p-3 font-semibold text-sabrar-400">{c.category}</td>
                        <td className="p-3 font-medium text-white">{c.description}</td>
                        <td className="p-3 text-slate-300">{c.supplier_contractor_name || '--'}</td>
                        <td className="p-3 text-slate-400">{c.invoice_number || '--'}</td>
                        <td className="p-3 text-right font-black text-amber-400">
                          R$ {Number(c.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteCost(c.id)}
                            className="p-1 text-slate-500 hover:text-rose-400 rounded transition-colors"
                            title="Excluir custo"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Header Explicativo da Regra Central */}
          <div className="p-4 sm:p-5 bg-dark-850 border border-dark-700 text-white rounded-3xl shadow-md">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-5 h-5 text-sabrar-400" />
              <h3 className="text-base font-extrabold text-white">Análise de Variação de Consumo (Previsto × Realizado)</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed max-w-3xl">
              Fórmula de Consumo Efetivo: <span className="text-sabrar-400 font-bold">Consumo Real = Retirado − Devolvido</span>.
              As variações apuradas entre o orçado e o consumido real alimentam o motor de IA para calibrar futuras obras semelhantes da SABRAR.
            </p>
          </div>

          {/* Tabela Comparativa Previsto × Realizado */}
          <div className="bg-dark-900 rounded-3xl border border-dark-750 overflow-hidden shadow-md">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-dark-850 text-slate-400 font-semibold border-b border-dark-700">
                  <tr>
                    <th className="p-3">Material</th>
                    <th className="p-3 text-center">Previsto IA</th>
                    <th className="p-3 text-center">Aprovado Orç.</th>
                    <th className="p-3 text-center">Solicitado</th>
                    <th className="p-3 text-center">Retirado</th>
                    <th className="p-3 text-center">Devolvido</th>
                    <th className="p-3 text-center font-bold text-white">Consumido Real</th>
                    <th className="p-3 text-right">Variação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-750">
                  {comparisonTable.map((row, idx) => {
                    const isOver = row.varianceUnits > 0;
                    const isUnder = row.varianceUnits < 0;
                    return (
                      <tr key={idx} className="hover:bg-dark-850/60">
                        <td className="p-3 font-bold text-white">
                          {row.materialName}
                          <div className="text-[10px] text-slate-400 font-mono">{row.materialCode}</div>
                        </td>
                        <td className="p-3 text-center text-slate-400 font-mono">
                          {row.aiPredicted} {row.unit}
                        </td>
                        <td className="p-3 text-center font-bold text-slate-200">
                          {row.budgetApproved} {row.unit}
                        </td>
                        <td className="p-3 text-center text-slate-400">
                          {row.requested} {row.unit}
                        </td>
                        <td className="p-3 text-center text-amber-400 font-medium">
                          {row.withdrawn} {row.unit}
                        </td>
                        <td className="p-3 text-center text-teal-400 font-medium">
                          {row.returned} {row.unit}
                        </td>
                        <td className="p-3 text-center font-black text-white bg-dark-850">
                          {row.actualConsumed} {row.unit}
                        </td>
                        <td className="p-3 text-right">
                          {row.budgetApproved > 0 && row.actualConsumed > 0 ? (
                            <span
                              className={`inline-flex items-center gap-1 font-bold text-xs px-2 py-0.5 rounded-full ${
                                isOver
                                  ? 'bg-rose-950/80 text-rose-300 border border-rose-700'
                                  : isUnder
                                  ? 'bg-sabrar-950/80 text-sabrar-300 border border-sabrar-500/40'
                                  : 'bg-dark-800 text-slate-400 border border-dark-700'
                              }`}
                            >
                              {isOver && `+${row.varianceUnits} un (+${row.variancePercent}%)`}
                              {isUnder && `${row.varianceUnits} un (${row.variancePercent}%)`}
                              {!isOver && !isUnder && 'Exato (0%)'}
                            </span>
                          ) : (
                            <span className="text-slate-500 text-[11px]">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modais Vinculados */}
      <AIAnalysisModal
        isOpen={isAIModalOpen}
        onClose={() => setIsAIModalOpen(false)}
        projectId={project.id}
        projectName={project.name}
        onAnalysisComplete={() => fetchProjectData()}
      />

      {budget && (
        <ClientProposalModal
          isOpen={isProposalModalOpen}
          onClose={() => setIsProposalModalOpen(false)}
          project={project}
          budget={{
            ...budget,
            items: editableMaterials.map(m => ({
              ...m,
              material_name: m.material_name || m.material,
              unit_price: Number(m.unit_price || m.unitPrice || 0),
              subtotal: Number(m.quantity || 0) * Number(m.unit_price || m.unitPrice || 0)
            })),
            services: editableServices.map(s => ({
              ...s,
              unit_price: Number(s.unit_price || 0),
              subtotal: Number(s.quantity || 0) * Number(s.unit_price || 0)
            })),
            equipment: editableEquipment.map(eq => ({
              ...eq,
              unit_price: Number(eq.unit_price !== undefined ? eq.unit_price : (eq.unitPrice || 0)),
              subtotal: Number(eq.quantity || 0) * Number(eq.unit_price !== undefined ? eq.unit_price : (eq.unitPrice || 0))
            })),
            total_materials: totalMaterials,
            total_services: totalServices,
            total_equipment: totalEquipment,
            materials_margin_percent: materialsMarginPercent,
            labor_margin_percent: laborMarginPercent
          }}
          onSentToClient={() => fetchProjectData()}
        />
      )}

      <EditProjectModal
        isOpen={isEditProjectModalOpen}
        onClose={() => setIsEditProjectModalOpen(false)}
        project={project}
        onSuccess={(updated) => {
          setData((prev: any) => ({ ...prev, project: { ...prev.project, ...updated } }));
          setIsEditProjectModalOpen(false);
        }}
      />

      <NewRequestModal
        isOpen={isNewRequestModalOpen}
        onClose={() => setIsNewRequestModalOpen(false)}
        preselectedProjectId={project.id}
        onSuccess={() => fetchProjectData()}
      />

      <NewReturnModal
        isOpen={isNewReturnModalOpen}
        onClose={() => setIsNewReturnModalOpen(false)}
        preselectedProjectId={project.id}
        onSuccess={() => fetchProjectData()}
      />

      <ImportSpreadsheetModal
        isOpen={isSpreadsheetModalOpen}
        onClose={() => setIsSpreadsheetModalOpen(false)}
        projectId={project.id}
        projectName={project.name}
        onSuccess={() => fetchProjectData()}
      />

      <AssignEngineersModal
        isOpen={isAssignEngineersModalOpen}
        onClose={() => setIsAssignEngineersModalOpen(false)}
        projectId={project.id}
        projectName={project.name}
        projectCode={project.code}
        currentEngineerIds={project.assigned_engineer_ids || []}
        onSuccess={() => fetchProjectData()}
      />

      <PrintRequestModal
        isOpen={!!selectedRequestForPrint}
        onClose={() => setSelectedRequestForPrint(null)}
        request={selectedRequestForPrint}
      />

      {/* Dropdown Flutuante de Autocomplete via Portal (100% imune a overflow de tabelas) */}
      {activeMaterialSearchIdx !== null && searchAnchorRect && createPortal(
        <div
          ref={dropdownPortalRef}
          style={{
            position: 'fixed',
            top: `${searchAnchorRect.top}px`,
            left: `${searchAnchorRect.left}px`,
            width: `${searchAnchorRect.width}px`,
            zIndex: 999999
          }}
          className="bg-dark-900 border-2 border-sabrar-500/80 rounded-2xl shadow-2xl overflow-hidden max-h-80 overflow-y-auto animate-in fade-in zoom-in-95 duration-100"
        >
          <div className="p-2.5 bg-dark-850 border-b border-dark-750 flex items-center justify-between text-[11px] font-bold text-slate-300">
            <span className="flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-sabrar-400" />
              {rowSuggestionLoading ? 'Buscando no catálogo SABRAR...' : `${rowSuggestions.length} material(is) encontrado(s)`}
            </span>
            <button
              type="button"
              onClick={() => setActiveMaterialSearchIdx(null)}
              className="text-slate-400 hover:text-white text-[11px] px-1.5 py-0.5 rounded bg-dark-800 hover:bg-dark-700 transition-colors"
            >
              Fechar ✕
            </button>
          </div>

          {rowSuggestions.length === 0 && !rowSuggestionLoading && (
            <div className="p-4 text-center text-xs text-slate-400">
              Nenhum material encontrado no catálogo com esse termo. Você pode continuar usando como material avulso ou pressionar Enter.
            </div>
          )}

          <div className="divide-y divide-dark-800">
            {rowSuggestions.map((sug) => (
              <div
                key={sug.id}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelectMaterialSuggestion(activeMaterialSearchIdx, sug);
                }}
                className="p-2.5 hover:bg-dark-800 transition-colors cursor-pointer flex items-center justify-between gap-3 group"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-xl bg-dark-800 border border-dark-700 overflow-hidden flex items-center justify-center shrink-0">
                    {sug.image_url ? (
                      <img
                        src={sug.image_url}
                        alt={sug.name}
                        className="w-full h-full object-contain p-0.5 group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <Package className="w-5 h-5 text-slate-500" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono text-[10px] font-bold text-sabrar-400 bg-dark-800 border border-dark-700 px-1 py-0.2 rounded">
                        {sug.code}
                      </span>
                      <span className="text-[10px] font-semibold text-slate-400 bg-dark-850 border border-dark-750 px-1 py-0.2 rounded">
                        {sug.category}
                      </span>
                      <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-1 py-0.2 rounded">
                        {sug.unit}
                      </span>
                    </div>
                    <div className="text-xs font-bold text-white group-hover:text-sabrar-300 transition-colors truncate mt-0.5">
                      {sug.name}
                    </div>
                    {sug.synonyms && (
                      <div className="text-[10px] text-slate-400 italic truncate">
                        Sinônimos: {sug.synonyms}
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs font-black text-sabrar-400">
                    R$ {Number(sug.reference_price || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    /{sug.unit}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>,
        document.body
      )}

      {/* Modal de Confirmação de Exclusão de Obra (Item 1) */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-750 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-500">
              <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/60 rounded-2xl">
                <AlertTriangle className="w-6 h-6 text-rose-500" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">Excluir Obra / Projeto</h3>
                <span className="text-xs text-rose-500 font-semibold">Ação irreversível</span>
              </div>
            </div>

            <div className="text-xs text-slate-600 dark:text-slate-300 space-y-2">
              <p>
                Tem certeza de que deseja excluir permanentemente o projeto{' '}
                <strong className="text-slate-900 dark:text-white font-bold">{project.name}</strong> ({project.code})?
              </p>
              <div className="bg-slate-50 dark:bg-dark-850 p-3 rounded-xl border border-slate-200 dark:border-dark-750 text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
                <div>• Os orçamentos e listas de materiais serão excluídos.</div>
                <div>• Os arquivos técnicos e memórias serão desvinculados.</div>
                <div>• Qualquer estoque reservado por esta obra será liberado.</div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200 dark:border-dark-750">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                disabled={deletingProject}
                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-dark-800 hover:bg-slate-200 dark:hover:bg-dark-750 rounded-xl transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
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

      {/* Modal Dedicado de Busca Interna e Vinculação ao Catálogo Oficial SABRAR */}
      <LinkMaterialModal
        isOpen={linkModalItemIdx !== null}
        onClose={() => setLinkModalItemIdx(null)}
        item={linkModalItemIdx !== null ? editableMaterials[linkModalItemIdx] : null}
        onLink={async (material, spreadsheetName) => {
          if (linkModalItemIdx !== null) {
            handleSelectMaterialSuggestion(linkModalItemIdx, material, spreadsheetName);
          }
        }}
      />
    </div>
  );
};
