import React, { useState, useEffect, useRef } from 'react';
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
  FileSpreadsheet
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

  // Estados locais para edição de orçamento
  const [editableMaterials, setEditableMaterials] = useState<any[]>([]);
  const [editableServices, setEditableServices] = useState<any[]>([]);
  const [validityDays, setValidityDays] = useState(15);
  const [commercialTerms, setCommercialTerms] = useState('');
  const [savingBudget, setSavingBudget] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState(false);

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

      if (res.budget) {
        setEditableMaterials(res.budget.items || []);
        setEditableServices(res.budget.services || []);
        setValidityDays(res.budget.validity_days || 15);
        setCommercialTerms(res.budget.commercial_terms || '');
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

  // Recálculo dinâmico dos totais de orçamento
  const totalMaterials = editableMaterials.reduce((acc, m) => acc + (Number(m.quantity || 0) * Number(m.unit_price || m.unitPrice || 0)), 0);
  const totalServices = editableServices.reduce((acc, s) => acc + (Number(s.quantity || 0) * Number(s.unit_price || 0)), 0);
  const totalEquipment = Number(budget?.total_equipment || 0);
  const totalBudgetCalculated = totalMaterials + totalServices + totalEquipment;

  const handleSaveBudget = async () => {
    setSavingBudget(true);
    try {
      await api.saveBudget({
        projectId: project.id,
        materials: editableMaterials.map(m => ({
          materialId: m.material_id || m.materialId,
          materialName: m.material_name || m.material,
          quantity: Number(m.quantity),
          unit: m.unit,
          unitPrice: Number(m.unit_price || m.unitPrice),
          aiSuggestedQuantity: m.ai_suggested_quantity || m.aiSuggestedQuantity || m.quantity,
          aiReasoning: m.ai_reasoning || m.reason,
          humanNotes: m.human_notes || ''
        })),
        services: editableServices.map(s => ({
          category: s.category,
          description: s.description,
          quantity: Number(s.quantity),
          unit: s.unit,
          unitPrice: Number(s.unit_price),
          notes: s.notes || ''
        })),
        totalEquipment,
        validityDays,
        commercialTerms,
        userId: currentUser?.id,
        userName: currentUser?.name
      });
      setSaveSuccessMsg(true);
      setTimeout(() => setSaveSuccessMsg(false), 3000);
      await fetchProjectData();
    } catch (err) {
      console.error('Erro ao salvar orçamento:', err);
      alert('Erro ao salvar alterações no orçamento');
    } finally {
      setSavingBudget(false);
    }
  };

  const handleApproveBudget = async () => {
    if (!budget) return;
    if (!window.confirm('Confirma a aprovação deste orçamento? A obra mudará para o status "Em execução" e as solicitações de materiais da Engenharia serão liberadas.')) {
      return;
    }
    try {
      await api.approveBudget(budget.id, currentUser?.id, currentUser?.name);
      await fetchProjectData();
    } catch (err) {
      console.error('Erro ao aprovar orçamento:', err);
    }
  };

  const handleAddMaterialRow = () => {
    setEditableMaterials(prev => [
      ...prev,
      {
        material_name: 'Novo Material',
        quantity: 10,
        unit: 'un',
        unit_price: 25.0,
        subtotal: 250.0,
        human_notes: 'Adicionado manualmente pelo orçamentista'
      }
    ]);
  };

  const handleAddServiceRow = () => {
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
  };

  return (
    <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Navigation & Status Banner */}
      <div className="bg-dark-900 p-4 sm:p-5 rounded-3xl border border-dark-750 shadow-xl flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={onBack}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-dark-800 transition-colors"
              title="Voltar"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-sabrar-400 bg-dark-800 border border-dark-700 px-2 py-0.5 rounded">
                  {project.code}
                </span>
                <StatusBadge status={project.status} />
              </div>
              <h1 className="text-lg sm:text-2xl font-black text-white tracking-tight mt-1">
                {project.name}
              </h1>
            </div>
          </div>

          {/* Action CTAs específicos do perfil */}
          <div className="flex items-center gap-2 self-end sm:self-center overflow-x-auto pb-1 sm:pb-0">
            {hasPermission(['orcamento']) && (
              <button
                onClick={() => setIsAIModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-sabrar-600 hover:bg-sabrar-500 text-white text-xs font-bold shadow-lg shadow-sabrar-600/30 active:scale-95 transition-all whitespace-nowrap"
              >
                <Sparkles className="w-4 h-4" />
                <span>Analisar com IA</span>
              </button>
            )}

            {budget && hasPermission(['orcamento']) && (
              <button
                onClick={() => setIsProposalModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-slate-100 dark:bg-dark-800 hover:bg-slate-200 dark:hover:bg-dark-750 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-dark-700 text-xs font-bold active:scale-95 transition-all whitespace-nowrap shadow-xs"
              >
                <Printer className="w-4 h-4 text-emerald-600 dark:text-sabrar-400" />
                <span>Proposta Cliente</span>
              </button>
            )}

            {['Aprovado', 'Em execução'].includes(project.status) && hasPermission(['engenharia']) && (
              <button
                onClick={() => setIsNewRequestModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-sabrar-600 hover:bg-sabrar-500 text-white text-xs font-bold active:scale-95 transition-all whitespace-nowrap shadow-md shadow-sabrar-600/30"
              >
                <Plus className="w-4 h-4" />
                <span>Solicitar Material</span>
              </button>
            )}
          </div>
        </div>

        {/* Tab Navigation (Filtrada por perfil para foco e sem duplicidade) */}
        <div className="flex items-center gap-1.5 border-t border-slate-200 dark:border-dark-750 pt-3 overflow-x-auto text-xs font-bold">
          <button
            onClick={() => setActiveTab('geral')}
            className={`px-3.5 py-2 rounded-xl transition-all whitespace-nowrap ${
              activeTab === 'geral'
                ? 'bg-emerald-50 dark:bg-sabrar-950/90 text-emerald-700 dark:text-sabrar-300 border border-emerald-300 dark:border-sabrar-500/40 shadow-xs'
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
                  ? 'bg-emerald-50 dark:bg-sabrar-950/90 text-emerald-700 dark:text-sabrar-300 border border-emerald-300 dark:border-sabrar-500/40 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-dark-800'
              }`}
            >
              <span>Orçamento & Revisão</span>
              {editableMaterials.length > 0 && (
                <span className={`text-[10px] px-1.5 rounded-full border ${
                  activeTab === 'orcamento'
                    ? 'bg-emerald-100 dark:bg-sabrar-900 text-emerald-800 dark:text-sabrar-200 border-emerald-300 dark:border-sabrar-700'
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
                  ? 'bg-emerald-50 dark:bg-sabrar-950/90 text-emerald-700 dark:text-sabrar-300 border border-emerald-300 dark:border-sabrar-500/40 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-dark-800'
              }`}
            >
              <span>Solicitações da Obra</span>
              <span className={`text-[10px] px-1.5 rounded-full border ${
                activeTab === 'solicitacoes'
                  ? 'bg-emerald-100 dark:bg-sabrar-900 text-emerald-800 dark:text-sabrar-200 border-emerald-300 dark:border-sabrar-700'
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
                  ? 'bg-emerald-50 dark:bg-sabrar-950/90 text-emerald-700 dark:text-sabrar-300 border border-emerald-300 dark:border-sabrar-500/40 shadow-xs'
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
                  ? 'bg-emerald-50 dark:bg-sabrar-950/90 text-emerald-700 dark:text-sabrar-300 border border-emerald-300 dark:border-sabrar-500/40 font-bold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-dark-800'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5 text-emerald-600 dark:text-sabrar-400" />
              <span>Previsto × Realizado</span>
            </button>
          )}
        </div>
      </div>

      {/* TAB 1: VISÃO GERAL & DOCUMENTOS TÉCNICOS */}
      {activeTab === 'geral' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 animate-in fade-in">
          <div className="lg:col-span-2 space-y-4">
            {/* Informações Básicas */}
            <div className="bg-dark-900 p-4 sm:p-5 rounded-3xl border border-dark-750 shadow-md space-y-4">
              <h3 className="font-extrabold text-sm text-white uppercase tracking-wider">
                Dados Técnicos da Obra
              </h3>
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
                  <span className="text-slate-400 block font-medium">Responsável Técnico:</span>
                  <span className="font-semibold text-slate-300">{project.responsible_engineer}</span>
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

              {budget && budget.status !== 'Aprovado' && (
                <button
                  onClick={handleApproveBudget}
                  className="w-full py-2.5 rounded-2xl bg-sabrar-600 hover:bg-sabrar-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-sabrar-600/30 active:scale-95"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>Aprovar Orçamento e Iniciar Obra</span>
                </button>
              )}
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

          {/* Top Budget Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-dark-900 p-4 rounded-3xl border border-dark-750">
            <div>
              <div className="text-sm font-extrabold text-white flex items-center gap-2">
                <span>Revisão Humana de Orçamento</span>
                <span className="text-[11px] font-semibold text-slate-400">(Setor de Orçamento)</span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Altere quantidades, valores ou adicione mão de obra e serviços complementares
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setIsSpreadsheetModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-sabrar-500/40 bg-sabrar-950/80 hover:bg-sabrar-900 text-sabrar-300 text-xs font-bold transition-all shadow-sm active:scale-95"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-sabrar-400" />
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
                onClick={handleSaveBudget}
                disabled={savingBudget}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sabrar-600 hover:bg-sabrar-500 text-white text-xs font-bold shadow-md shadow-sabrar-600/30 transition-all active:scale-95 disabled:opacity-50"
              >
                <CheckCircle className="w-4 h-4" />
                <span>{savingBudget ? 'Salvando...' : 'Salvar Alterações'}</span>
              </button>
            </div>
          </div>

          {/* 1. Tabela de Materiais Editável */}
          <div className="bg-dark-900 rounded-3xl border border-dark-750 overflow-hidden shadow-md">
            <div className="p-4 bg-dark-850 border-b border-dark-750 flex items-center justify-between text-xs font-bold text-slate-200">
              <span>1. Materiais (Sugestão IA & Revisão Técnica)</span>
              <span className="text-sabrar-400">Subtotal Materiais: R$ {totalMaterials.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-dark-850 text-slate-400 font-semibold border-b border-dark-700">
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
                <tbody className="divide-y divide-dark-750">
                  {editableMaterials.map((m, idx) => {
                    const sub = Number(m.quantity || 0) * Number(m.unit_price || m.unitPrice || 0);
                    return (
                      <tr key={idx} className="hover:bg-dark-850/60">
                        <td className="p-3">
                          <input
                            type="text"
                            value={m.material_name || m.material}
                            onChange={(e) => {
                              const val = e.target.value;
                              setEditableMaterials(prev => prev.map((item, i) => i === idx ? { ...item, material_name: val, material: val } : item));
                            }}
                            className="w-full font-bold text-white bg-transparent border-b border-transparent hover:border-dark-700 focus:border-sabrar-500 focus:bg-dark-850 px-1 py-0.5 rounded outline-none"
                          />
                          {(m.ai_reasoning || m.reason) && (
                            <div className="text-[10px] text-sabrar-400 mt-0.5 line-clamp-1 italic">
                              IA: {m.ai_reasoning || m.reason}
                            </div>
                          )}
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
                              setEditableMaterials(prev => prev.map((item, i) => i === idx ? { ...item, quantity: val } : item));
                            }}
                            className="w-20 text-center font-black text-white bg-dark-850 border border-dark-700 focus:border-sabrar-500 p-1 rounded-lg outline-none"
                          />
                        </td>
                        <td className="p-3 text-center text-slate-400 font-medium">
                          {m.unit}
                        </td>
                        <td className="p-3 text-right">
                          <input
                            type="number"
                            step="0.1"
                            value={m.unit_price || m.unitPrice}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setEditableMaterials(prev => prev.map((item, i) => i === idx ? { ...item, unit_price: val, unitPrice: val } : item));
                            }}
                            className="w-20 text-right font-bold text-white bg-dark-850 border border-dark-700 focus:border-sabrar-500 p-1 rounded-lg outline-none"
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
            <div className="p-4 bg-dark-850 border-b border-dark-750 flex items-center justify-between text-xs font-bold text-slate-200">
              <span>2. Serviços, Mão de Obra & Custos Complementares</span>
              <span className="text-sabrar-400">Subtotal Serviços: R$ {totalServices.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-dark-850 text-slate-400 font-semibold border-b border-dark-700">
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
                <tbody className="divide-y divide-dark-750">
                  {editableServices.map((s, idx) => {
                    const sub = Number(s.quantity || 0) * Number(s.unit_price || 0);
                    return (
                      <tr key={idx} className="hover:bg-dark-850/60">
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
                              setEditableServices(prev => prev.map((item, i) => i === idx ? { ...item, quantity: val } : item));
                            }}
                            className="w-16 text-center font-bold text-white bg-dark-850 border border-dark-700 p-1 rounded-lg outline-none"
                          />
                        </td>
                        <td className="p-3 text-center text-slate-400">{s.unit}</td>
                        <td className="p-3 text-right">
                          <input
                            type="number"
                            step="0.1"
                            value={s.unit_price}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setEditableServices(prev => prev.map((item, i) => i === idx ? { ...item, unit_price: val } : item));
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

          {/* Resumo Final do Orçamento */}
          <div className="p-4 bg-dark-850 border border-dark-700 text-white rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-sabrar-400 uppercase">Orçamento Final Calculado</div>
              <div className="text-2xl font-black">
                R$ {totalBudgetCalculated.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              {totalEquipment > 0 && (
                <div className="text-[11px] text-slate-400 mt-1">
                  Materiais: R$ {totalMaterials.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} • Mão de Obra: R$ {totalServices.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} • Faturamento Direto (Máquinas): R$ {totalEquipment.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSaveBudget}
                className="px-5 py-2.5 rounded-2xl bg-sabrar-600 hover:bg-sabrar-500 text-white text-xs font-bold transition-all shadow-md shadow-sabrar-600/30"
              >
                Salvar Orçamento
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
          <div className="flex items-center justify-between bg-dark-900 p-4 rounded-3xl border border-dark-750">
            <div>
              <h3 className="font-extrabold text-sm text-white">Solicitações de Materiais da Obra</h3>
              <p className="text-xs text-slate-400">Módulo operacional da Engenharia com verificação de estoque</p>
            </div>
            <button
              onClick={() => setIsNewRequestModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-sabrar-600 hover:bg-sabrar-500 text-white text-xs font-bold shadow-md shadow-sabrar-600/30"
            >
              <Plus className="w-4 h-4" />
              <span>Nova Solicitação</span>
            </button>
          </div>

          <div className="space-y-3">
            {(data.requests || []).map((req: any) => (
              <div key={req.id} className="bg-dark-900 p-4 rounded-3xl border border-dark-750 shadow-md space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs bg-dark-800 border border-dark-700 px-2 py-0.5 rounded text-sabrar-400">
                      {req.code}
                    </span>
                    <StatusBadge status={req.priority} size="sm" />
                    <StatusBadge status={req.status} size="sm" />
                  </div>
                  <span className="text-[11px] text-slate-400">
                    {new Date(req.created_at).toLocaleDateString('pt-BR')} por {req.requested_by_name}
                  </span>
                </div>

                <div className="divide-y divide-dark-750 border border-dark-700 rounded-2xl p-2 bg-dark-850">
                  {(req.items || []).map((it: any) => (
                    <div key={it.id} className="py-2 px-2 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-white">{it.material_name}</span>
                        <span className="text-[11px] text-slate-400 ml-2 font-mono">({it.material_code})</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-semibold text-slate-300">
                          Solicitado: <span className="font-bold text-white">{it.quantity_requested} {it.material_unit}</span>
                        </span>
                        {it.deficit > 0 && (
                          <span className="font-bold text-rose-300 bg-rose-950/80 px-2 py-0.5 rounded border border-rose-700 text-[11px]">
                            Déficit: {it.deficit} (Compras notificado)
                          </span>
                        )}
                        {it.quantity_delivered > 0 && (
                          <span className="font-bold text-sabrar-300 bg-sabrar-950 px-2 py-0.5 rounded border border-sabrar-500/40 text-[11px]">
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
          <div className="flex items-center justify-between bg-dark-900 p-4 rounded-3xl border border-dark-750">
            <div>
              <h3 className="font-extrabold text-sm text-white">Almoxarifado & Devoluções da Obra</h3>
              <p className="text-xs text-slate-400">Histórico de saídas para o canteiro e retorno de sobras</p>
            </div>
            <button
              onClick={() => setIsNewReturnModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold shadow-md shadow-teal-600/30"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Registrar Devolução</span>
            </button>
          </div>

          <div className="bg-dark-900 rounded-3xl border border-dark-750 p-4 shadow-md">
            <h4 className="font-extrabold text-xs text-slate-400 uppercase tracking-wider mb-3">
              Devoluções Registradas ao Almoxarifado
            </h4>
            {(data.returns || []).length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                Nenhuma devolução registrada nesta obra até o momento.
              </div>
            ) : (
              <div className="divide-y divide-dark-750">
                {data.returns.map((ret: any) => (
                  <div key={ret.id} className="py-3 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-white">{ret.code} — {ret.material_name}</div>
                      <div className="text-[11px] text-slate-400">
                        Motivo: {ret.reason || 'Sobra reutilizável'} • Recebido por: {ret.received_by_name}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-black text-teal-400 text-sm">+{ret.quantity} {ret.material_unit}</span>
                      <div className="text-[10px] text-slate-500">Voltaram ao estoque físico</div>
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
          budget={budget}
          onSentToClient={() => fetchProjectData()}
        />
      )}

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
    </div>
  );
};
