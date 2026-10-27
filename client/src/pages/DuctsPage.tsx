import React, { useState, useEffect } from 'react';
import {
  Wind,
  Ruler,
  Scale,
  Layers,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Printer,
  RefreshCw,
  FileText,
  Building,
  Info,
  ChevronRight,
  Plus,
  Check,
  X,
  Upload,
  Eye,
  ArrowRight,
  Clock,
  ShieldCheck,
  Truck
} from 'lucide-react';
import { Project } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { canUserApproveOperations } from '../utils/permissions';

interface DuctBreakdownItem {
  type: string;
  name?: string;
  material?: string;
  geometry?: string;
  specification?: string;
  standard?: string;
  technical_reason?: string;
  meters: number;
  kg: number;
  sheetAreaSqm?: number;
  insulation?: string;
  notes?: string;
}

interface DuctAnalysisResult {
  id?: number;
  projectId: number;
  projectName?: string;
  projectCode?: string;
  client?: string;
  totalMeters: number;
  totalKg: number;
  sheetAreaSqm: number;
  ductBreakdown: DuctBreakdownItem[];
  technicalNotes?: string;
  analyzedDocuments?: string[];
  createdAt?: string;
}

interface DeliveryNote {
  id: number;
  code: string;
  deliveryNoteNumber: string;
  projectId: number;
  projectName: string;
  projectCode: string;
  taggerId?: number;
  taggerName: string;
  fileUrl?: string;
  fileName?: string;
  totalWeightKg: number;
  sheetType: string;
  budgetTotalKg: number;
  accumulatedKg: number;
  exceedsBudget: boolean;
  excessKg: number;
  status: string;
  approvalStatus: string;
  approvedBy?: number;
  approvedByName?: string;
  approvedAt?: string;
  approvalReason?: string;
  notes?: string;
  createdAt: string;
}

interface DuctsPageProps {
  onNavigate?: (page: string, id?: number) => void;
}

export const DuctsPage: React.FC<DuctsPageProps> = ({ onNavigate }) => {
  const { currentUser } = useAuth();
  const [activeMainTab, setActiveMainTab] = useState<'camduct' | 'ai-estimate'>('camduct');

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [loadingProjects, setLoadingProjects] = useState(true);

  // Estados CAMduct
  const [summaryData, setSummaryData] = useState<any | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [isAttachModalOpen, setIsAttachModalOpen] = useState(false);
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [selectedNoteForApproval, setSelectedNoteForApproval] = useState<DeliveryNote | null>(null);
  const [approvalDecision, setApprovalDecision] = useState<'approve' | 'reject'>('approve');
  const [approvalReason, setApprovalReason] = useState('');
  const [submittingDn, setSubmittingDn] = useState(false);

  // Form de anexo de Delivery Note
  const [newDnNumber, setNewDnNumber] = useState('');
  const [newDnWeight, setNewDnWeight] = useState('');
  const [newDnSheetType, setNewDnSheetType] = useState('Chapa Galvanizada #24 (0,65mm)');
  const [newDnNotes, setNewDnNotes] = useState('');
  const [newDnFileName, setNewDnFileName] = useState('');

  // Estados Análise por IA (Aba 2)
  const [currentAnalysis, setCurrentAnalysis] = useState<DuctAnalysisResult | null>(null);
  const [allAnalyses, setAllAnalyses] = useState<DuctAnalysisResult[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [customInstructions, setCustomInstructions] = useState('');

  const canApprove = canUserApproveOperations(currentUser);

  // Carrega lista inicial
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoadingProjects(true);
    try {
      const [projList, analysesList] = await Promise.all([
        api.getProjects(),
        api.getAllDuctAnalyses().catch(() => [])
      ]);
      const validProjects = projList.filter((p: Project) => p.code !== 'SAB-INTERNO');
      setProjects(validProjects);
      setAllAnalyses(analysesList);

      if (validProjects.length > 0 && !selectedProjectId) {
        setSelectedProjectId(validProjects[0].id);
        fetchProjectSummary(validProjects[0].id);
        fetchProjectAnalysis(validProjects[0].id);
      }
    } catch (err: any) {
      console.error('Erro ao carregar dados de projetos:', err);
    } finally {
      setLoadingProjects(false);
    }
  };

  const fetchProjectSummary = async (projectId: number) => {
    setLoadingSummary(true);
    try {
      const res = await api.getDuctsProjectSummary(projectId);
      setSummaryData(res);
    } catch (err) {
      console.error('Erro ao carregar resumo CAMduct:', err);
    } finally {
      setLoadingSummary(false);
    }
  };

  const fetchProjectAnalysis = async (projectId: number) => {
    try {
      const res = await api.getDuctAnalysis(projectId);
      setCurrentAnalysis(res);
      setErrorMsg(null);
    } catch (err: any) {
      setCurrentAnalysis(null);
    }
  };

  const handleSelectProject = (id: number) => {
    setSelectedProjectId(id);
    setSuccessMsg(null);
    setErrorMsg(null);
    fetchProjectSummary(id);
    fetchProjectAnalysis(id);
  };

  // Anexar Delivery Note
  const handleAttachDeliveryNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId) {
      alert('Selecione uma obra.');
      return;
    }
    if (!newDnNumber.trim()) {
      alert('Informe o número da Delivery Note gerada pelo CAMduct.');
      return;
    }
    const weightNum = Number(newDnWeight.replace(',', '.'));
    if (isNaN(weightNum) || weightNum <= 0) {
      alert('Informe o peso em KG válido.');
      return;
    }

    setSubmittingDn(true);
    try {
      const res = await api.createDuctDeliveryNote({
        projectId: selectedProjectId,
        deliveryNoteNumber: newDnNumber.trim(),
        totalWeightKg: weightNum,
        sheetType: newDnSheetType,
        fileName: newDnFileName || `DeliveryNote_${newDnNumber}.pdf`,
        notes: newDnNotes,
        taggerId: currentUser?.id || 26,
        taggerName: currentUser?.name || 'Vinicius Gomes'
      });

      alert(
        res.exceedsBudget
          ? `Delivery Note anexada! ATENÇÃO: O peso tagueado ultrapassou o orçamento em ${res.excessKg} KG e requer aprovação de Sabrina/Emily/Diretoria.`
          : `Delivery Note ${res.deliveryNoteNumber} cadastrada com sucesso e liberada para fabricação!`
      );

      setIsAttachModalOpen(false);
      setNewDnNumber('');
      setNewDnWeight('');
      setNewDnNotes('');
      setNewDnFileName('');

      if (selectedProjectId) fetchProjectSummary(selectedProjectId);
    } catch (err: any) {
      console.error('Erro ao anexar Delivery Note:', err);
      alert(err.message || 'Erro ao anexar Delivery Note');
    } finally {
      setSubmittingDn(false);
    }
  };

  // Aprovação/Rejeição de Excedente de Peso
  const handleProcessApproval = async () => {
    if (!selectedNoteForApproval) return;
    try {
      await api.approveDuctExcess(selectedNoteForApproval.id, {
        userId: currentUser?.id || 1,
        userName: currentUser?.name || 'Diretoria/Responsável',
        approved: approvalDecision === 'approve',
        approvalReason
      });

      alert(approvalDecision === 'approve' ? 'Excedente de dutos aprovado! Fabricação liberada.' : 'Delivery Note rejeitada.');
      setIsApproveModalOpen(false);
      setSelectedNoteForApproval(null);
      setApprovalReason('');
      if (selectedProjectId) fetchProjectSummary(selectedProjectId);
    } catch (err: any) {
      alert(err.message || 'Erro ao processar aprovação');
    }
  };

  // Avançar Status da Delivery Note
  const handleUpdateStatus = async (noteId: number, nextStatus: string) => {
    try {
      await api.updateDuctStatus(noteId, {
        status: nextStatus,
        userId: currentUser?.id,
        userName: currentUser?.name
      });
      if (selectedProjectId) fetchProjectSummary(selectedProjectId);
    } catch (err: any) {
      alert(err.message || 'Erro ao atualizar status');
    }
  };

  // Disparo Análise de IA (Aba 2)
  const handleRunAnalysis = async () => {
    if (!selectedProjectId) return;
    setAnalyzing(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const result = await api.analyzeDucts(selectedProjectId, customInstructions.trim() || undefined);
      setCurrentAnalysis(result);
      setSuccessMsg(`Levantamento de dutos concluído com sucesso: ${result.totalMeters.toLocaleString('pt-BR')} m e ${result.totalKg.toLocaleString('pt-BR')} kg.`);
      const updatedList = await api.getAllDuctAnalyses().catch(() => []);
      setAllAnalyses(updatedList);
    } catch (err: any) {
      console.error('Erro no cálculo de dutos:', err);
      setErrorMsg(err.message || 'Erro ao processar análise aeráulica de dutos');
    } finally {
      setAnalyzing(false);
    }
  };

  const selectedProject = projects.find(p => p.id === selectedProjectId);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header Principal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-dark-900 p-5 sm:p-6 rounded-3xl border border-dark-750 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-600/30 to-emerald-500/10 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-lg shadow-cyan-950/40">
            <Wind className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Gestão de Dutos & Autodesk CAMduct
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-500/30 flex items-center gap-1">
                Pilar 3 HVAC
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Tagueamento CAMduct (Vinicius Gomes), controle de saldo de chapa (KG) e transição para logística
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {activeMainTab === 'camduct' && selectedProjectId && (
            <button
              onClick={() => setIsAttachModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-lg shadow-emerald-950/30"
            >
              <Plus className="w-4 h-4" />
              <span>Anexar Delivery Note</span>
            </button>
          )}

          {activeMainTab === 'ai-estimate' && currentAnalysis && (
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-dark-850 hover:bg-dark-800 text-slate-200 text-xs font-semibold border border-dark-700 transition-colors"
            >
              <Printer className="w-4 h-4 text-sabrar-400" />
              <span>Imprimir</span>
            </button>
          )}
        </div>
      </div>

      {/* Seletor de Abas Principais */}
      <div className="flex items-center gap-2 border-b border-dark-800 pb-2">
        <button
          onClick={() => setActiveMainTab('camduct')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeMainTab === 'camduct'
              ? 'bg-cyan-500 text-slate-950 shadow-md font-extrabold'
              : 'text-slate-400 hover:text-white hover:bg-dark-850'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Ordens de Fabricação & CAMduct</span>
        </button>

        <button
          onClick={() => setActiveMainTab('ai-estimate')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeMainTab === 'ai-estimate'
              ? 'bg-cyan-500 text-slate-950 shadow-md font-extrabold'
              : 'text-slate-400 hover:text-white hover:bg-dark-850'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Levantamento & Estimativa por IA</span>
        </button>
      </div>

      {/* Seletor Global de Obra */}
      <div className="bg-dark-900 p-4 sm:p-5 rounded-3xl border border-dark-750 shadow-md">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          <div className="md:col-span-8">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Selecione a Obra / Projeto Ativo
            </label>
            <select
              value={selectedProjectId || ''}
              onChange={(e) => handleSelectProject(Number(e.target.value))}
              className="w-full bg-dark-850 border border-dark-700 text-white rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold focus:outline-none focus:border-cyan-500 transition-colors"
              disabled={loadingProjects}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name} ({p.client}) {p.responsible_engineer ? `[Eng: ${p.responsible_engineer}]` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-4 flex items-center justify-end">
            {selectedProject && (
              <div className="text-right text-xs">
                <span className="text-slate-400">Engenheiro da Obra:</span>
                <div className="font-bold text-white mt-0.5">
                  {selectedProject.responsible_engineer || 'Engenharia Geral'}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ABA 1: GESTÃO CAMDUCT (PILAR 3 DO FLUXO HVAC)                              */}
      {/* ========================================================================= */}
      {activeMainTab === 'camduct' && (
        <div className="space-y-6">
          {/* Cartões Métricos de Peso e Consumo de Chapa */}
          {summaryData && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-dark-900 p-4 rounded-2xl border border-dark-750">
                <div className="flex items-center justify-between text-slate-400 text-xs font-bold mb-1">
                  <span>KG Orçado</span>
                  <Scale className="w-4 h-4 text-cyan-400" />
                </div>
                <div className="text-xl font-black text-white">
                  {summaryData.budgetKg.toLocaleString('pt-BR')} <span className="text-xs text-slate-400 font-normal">KG</span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">Estimativa oficial aprovada</p>
              </div>

              <div className="bg-dark-900 p-4 rounded-2xl border border-dark-750">
                <div className="flex items-center justify-between text-slate-400 text-xs font-bold mb-1">
                  <span>KG Tagueado (CAMduct)</span>
                  <Wind className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-xl font-black text-amber-400">
                  {summaryData.taggedKg.toLocaleString('pt-BR')} <span className="text-xs text-slate-400 font-normal">KG</span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">Soma de Delivery Notes ativas</p>
              </div>

              <div className={`p-4 rounded-2xl border ${
                summaryData.isExceeded
                  ? 'bg-rose-950/40 border-rose-500/50 text-rose-300'
                  : 'bg-dark-900 border-dark-750 text-emerald-400'
              }`}>
                <div className="flex items-center justify-between text-xs font-bold mb-1">
                  <span>{summaryData.isExceeded ? 'Excedente de Chapa' : 'Saldo Disponível'}</span>
                  {summaryData.isExceeded ? (
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  )}
                </div>
                <div className="text-xl font-black">
                  {summaryData.isExceeded
                    ? `+${summaryData.excessKg.toLocaleString('pt-BR')} KG`
                    : `${summaryData.balanceKg.toLocaleString('pt-BR')} KG`}
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  {summaryData.isExceeded
                    ? 'Requer aprovação de Sabrina/Emily'
                    : 'Dentro da margem do orçamento'}
                </p>
              </div>

              <div className="bg-dark-900 p-4 rounded-2xl border border-dark-750">
                <div className="flex items-center justify-between text-slate-400 text-xs font-bold mb-1">
                  <span>% Consumido</span>
                  <Layers className="w-4 h-4 text-purple-400" />
                </div>
                <div className={`text-xl font-black ${
                  summaryData.percentUsed > 100 ? 'text-rose-400' : 'text-purple-400'
                }`}>
                  {summaryData.percentUsed}%
                </div>
                {/* Barra de Progresso */}
                <div className="w-full bg-dark-800 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      summaryData.percentUsed > 100
                        ? 'bg-rose-500'
                        : summaryData.percentUsed > 85
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(100, summaryData.percentUsed)}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Tabela de Delivery Notes */}
          <div className="bg-dark-900 p-5 rounded-3xl border border-dark-750 shadow-md space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <FileText className="w-4 h-4 text-cyan-400" />
                  <span>Delivery Notes Vinculadas à Obra</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Rastreabilidade de ordens do CAMduct e liberação para fabricação/logística
                </p>
              </div>

              {selectedProjectId && (
                <button
                  onClick={() => setIsAttachModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-dark-800 text-cyan-400 border border-cyan-500/40 hover:bg-dark-750 text-xs font-bold transition shadow"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Nova Delivery Note</span>
                </button>
              )}
            </div>

            {loadingSummary && (
              <div className="py-16 text-center text-xs text-slate-500">
                Carregando Delivery Notes da obra...
              </div>
            )}

            {!loadingSummary && summaryData && summaryData.deliveryNotes.length === 0 && (
              <div className="py-16 text-center bg-dark-850 rounded-2xl border border-dark-750 text-slate-400 space-y-2 p-6">
                <Wind className="w-8 h-8 text-slate-600 mx-auto" />
                <div className="font-bold text-white text-xs">Nenhuma Delivery Note cadastrada</div>
                <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                  Quando o tagueador (Vinicius Gomes) finalizar o ninho no Autodesk CAMduct, anexe a Delivery Note com o número único e peso total em KG.
                </p>
              </div>
            )}

            {!loadingSummary && summaryData && summaryData.deliveryNotes.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-dark-750 text-slate-400 font-bold uppercase text-[10px]">
                      <th className="py-2.5 px-3">Nº Delivery Note</th>
                      <th className="py-2.5 px-3">Tagueador</th>
                      <th className="py-2.5 px-3">Chapa / Especificação</th>
                      <th className="py-2.5 px-3 text-right">Peso (KG)</th>
                      <th className="py-2.5 px-3 text-right">Acumulado</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                      <th className="py-2.5 px-3 text-right">Ações do Fluxo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dark-800">
                    {summaryData.deliveryNotes.map((note: DeliveryNote) => {
                      const isPending = note.status === 'pendente_aprovacao';

                      return (
                        <tr key={note.id} className="hover:bg-dark-850/60 transition-colors">
                          <td className="py-3 px-3">
                            <div className="font-black text-white font-mono text-xs">
                              {note.deliveryNoteNumber}
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              {note.code} • {new Date(note.createdAt).toLocaleDateString('pt-BR')}
                            </div>
                          </td>

                          <td className="py-3 px-3 text-slate-300 font-medium">
                            {note.taggerName}
                          </td>

                          <td className="py-3 px-3 text-slate-300">
                            {note.sheetType}
                          </td>

                          <td className="py-3 px-3 text-right font-black text-cyan-400">
                            {note.totalWeightKg.toLocaleString('pt-BR')} KG
                          </td>

                          <td className="py-3 px-3 text-right text-slate-400 font-bold">
                            {note.accumulatedKg.toLocaleString('pt-BR')} KG
                          </td>

                          <td className="py-3 px-3 text-center">
                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                              note.status === 'pronto_logistica'
                                ? 'bg-purple-950 text-purple-300 border border-purple-800'
                                : note.status === 'em_fabricacao'
                                ? 'bg-amber-950 text-amber-300 border border-amber-800'
                                : note.status === 'entregue'
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                : note.status === 'rejeitado'
                                ? 'bg-rose-950 text-rose-300 border border-rose-800'
                                : isPending
                                ? 'bg-rose-950 text-rose-300 border border-rose-800'
                                : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            }`}>
                              {isPending
                                ? 'Aguardando Aprovação'
                                : note.status === 'em_fabricacao'
                                ? 'Em Fabricação'
                                : note.status === 'pronto_logistica'
                                ? 'Pronto p/ Logística'
                                : note.status === 'entregue'
                                ? 'Entregue na Obra'
                                : note.status === 'rejeitado'
                                ? 'Rejeitado'
                                : 'Aprovado'}
                            </span>
                          </td>

                          <td className="py-3 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Aprovação de Excedente */}
                              {isPending && canApprove && (
                                <button
                                  onClick={() => {
                                    setSelectedNoteForApproval(note);
                                    setIsApproveModalOpen(true);
                                  }}
                                  className="px-2.5 py-1 rounded-lg text-[10px] font-black bg-rose-600 text-white hover:bg-rose-500 transition shadow"
                                >
                                  Analisar Excedente
                                </button>
                              )}

                              {/* Avançar para Fabricação */}
                              {note.status === 'aprovado' && (
                                <button
                                  onClick={() => handleUpdateStatus(note.id, 'em_fabricacao')}
                                  className="px-2 py-1 rounded-lg text-[10px] font-bold bg-dark-800 text-amber-300 border border-amber-600/40 hover:bg-dark-750 transition"
                                >
                                  Iniciar Fabricação
                                </button>
                              )}

                              {/* Avançar para Pronto Logística */}
                              {note.status === 'em_fabricacao' && (
                                <button
                                  onClick={() => handleUpdateStatus(note.id, 'pronto_logistica')}
                                  className="px-2 py-1 rounded-lg text-[10px] font-bold bg-dark-800 text-purple-300 border border-purple-600/40 hover:bg-dark-750 transition flex items-center gap-1"
                                >
                                  <Truck className="w-3 h-3 text-purple-400" />
                                  <span>Liberar p/ Logística</span>
                                </button>
                              )}

                              {note.status === 'pronto_logistica' && onNavigate && (
                                <button
                                  onClick={() => onNavigate('logistics')}
                                  className="px-2 py-1 rounded-lg text-[10px] font-bold bg-purple-600 text-white hover:bg-purple-500 transition flex items-center gap-1 shadow"
                                >
                                  <span>Ver na Logística</span>
                                  <ArrowRight className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 2: LEVANTAMENTO & ESTIMATIVA POR IA (MANTIDA INTEGRALMENTE)           */}
      {/* ========================================================================= */}
      {activeMainTab === 'ai-estimate' && (
        <div className="space-y-6">
          {/* Banner Informativo */}
          <div className="bg-slate-900/60 border border-slate-700/60 rounded-2xl p-4 flex items-start gap-3 text-xs text-slate-300">
            <Info className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-emerald-300">
                Foco Exclusivo em Quantitativo Aeráulico: Metros (m) e Quilogramas (kg)
              </p>
              <p className="text-slate-400 leading-relaxed">
                Esta IA analisa os desenhos técnicos, cortes e especificações aeráulicas para calcular a extensão e o peso de chapa das redes de dutos.
              </p>
            </div>
          </div>

          {/* Ação de Análise */}
          <div className="bg-dark-900 p-5 rounded-3xl border border-dark-750 shadow-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex-1">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Instruções Adicionais para a IA (Opcional)
                </label>
                <input
                  type="text"
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                  placeholder="Ex: Considerar chapa #22 na prumada e conexões flangeadas TDC"
                  className="w-full bg-dark-850 border border-dark-700 text-white rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-cyan-500"
                />
              </div>

              <button
                onClick={handleRunAnalysis}
                disabled={analyzing || !selectedProjectId}
                className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-black transition shadow-lg shadow-cyan-950/40 shrink-0 self-end"
              >
                <Sparkles className={`w-4 h-4 ${analyzing ? 'animate-spin' : ''}`} />
                <span>{analyzing ? 'Processando...' : 'Calcular com IA'}</span>
              </button>
            </div>

            {errorMsg && (
              <div className="mt-3 p-3 bg-rose-950/40 border border-rose-500/40 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="mt-3 p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}
          </div>

          {/* Resultado da Análise da IA */}
          {currentAnalysis && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-dark-900 p-4 rounded-2xl border border-dark-750">
                  <div className="text-slate-400 text-xs font-bold mb-1">Extensão Total de Dutos</div>
                  <div className="text-2xl font-black text-cyan-400">
                    {currentAnalysis.totalMeters.toLocaleString('pt-BR')} <span className="text-xs text-slate-400">m</span>
                  </div>
                </div>

                <div className="bg-dark-900 p-4 rounded-2xl border border-dark-750">
                  <div className="text-slate-400 text-xs font-bold mb-1">Peso Total de Chapas</div>
                  <div className="text-2xl font-black text-amber-400">
                    {currentAnalysis.totalKg.toLocaleString('pt-BR')} <span className="text-xs text-slate-400">kg</span>
                  </div>
                </div>

                <div className="bg-dark-900 p-4 rounded-2xl border border-dark-750">
                  <div className="text-slate-400 text-xs font-bold mb-1">Área Desenvolvida de Chapa</div>
                  <div className="text-2xl font-black text-purple-400">
                    {currentAnalysis.sheetAreaSqm.toLocaleString('pt-BR')} <span className="text-xs text-slate-400">m²</span>
                  </div>
                </div>
              </div>

              {/* Detalhamento dos Dutos */}
              <div className="bg-dark-900 p-5 rounded-3xl border border-dark-750 shadow-md">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                  Detalhamento das Redes Aeráulicas
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-dark-750 text-slate-400 font-bold uppercase text-[10px]">
                        <th className="py-2 px-3">Tipo / Descrição</th>
                        <th className="py-2 px-3 text-right">Extensão (m)</th>
                        <th className="py-2 px-3 text-right">Peso (kg)</th>
                        <th className="py-2 px-3 text-right">Área (m²)</th>
                        <th className="py-2 px-3">Isolamento</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-dark-800">
                      {currentAnalysis.ductBreakdown.map((item, idx) => (
                        <tr key={idx} className="hover:bg-dark-850/60">
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-white">{item.name || item.type}</div>
                            {item.notes && <div className="text-[10px] text-slate-400">{item.notes}</div>}
                          </td>
                          <td className="py-2.5 px-3 text-right font-black text-cyan-400">{item.meters} m</td>
                          <td className="py-2.5 px-3 text-right font-black text-amber-400">{item.kg} kg</td>
                          <td className="py-2.5 px-3 text-right font-bold text-purple-400">{item.sheetAreaSqm || 0} m²</td>
                          <td className="py-2.5 px-3 text-slate-300">{item.insulation || 'Sem isolamento'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: ANEXAR DELIVERY NOTE (AUTODESK CAMDUCT)                           */}
      {/* ========================================================================= */}
      {isAttachModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-dark-900 text-white rounded-3xl max-w-lg w-full p-6 space-y-4 border border-dark-750 shadow-2xl">
            <div className="flex items-center justify-between border-b border-dark-800 pb-3">
              <div>
                <h3 className="text-base font-black text-white">Anexar Delivery Note CAMduct</h3>
                <p className="text-xs text-slate-400">Entrada oficial de ordem de fabricação de dutos</p>
              </div>
              <button onClick={() => setIsAttachModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAttachDeliveryNote} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-300">Número da Delivery Note (CAMduct) *</label>
                <input
                  type="text"
                  required
                  value={newDnNumber}
                  onChange={(e) => setNewDnNumber(e.target.value)}
                  placeholder="Ex: DN-8841 ou 2026-0042"
                  className="w-full bg-dark-800 border border-dark-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                />
                <span className="text-[10px] text-slate-500">Validação estrita de número único no sistema.</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-300">Peso Total em KG *</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={newDnWeight}
                    onChange={(e) => setNewDnWeight(e.target.value)}
                    placeholder="Ex: 850.5"
                    className="w-full bg-dark-800 border border-dark-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-300">Tipo de Chapa *</label>
                  <select
                    value={newDnSheetType}
                    onChange={(e) => setNewDnSheetType(e.target.value)}
                    className="w-full bg-dark-800 border border-dark-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="Chapa Galvanizada #24 (0,65mm)">Chapa Galvanizada #24</option>
                    <option value="Chapa Galvanizada #22 (0,80mm)">Chapa Galvanizada #22</option>
                    <option value="Chapa Galvanizada #20 (0,95mm)">Chapa Galvanizada #20</option>
                    <option value="Chapa Galvanizada #18 (1,25mm)">Chapa Galvanizada #18</option>
                    <option value="Chapa Preta Soldada #16 (Exaustão)">Chapa Preta Soldada #16</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-300">Nome do Arquivo / PDF da Delivery Note</label>
                <input
                  type="text"
                  value={newDnFileName}
                  onChange={(e) => setNewDnFileName(e.target.value)}
                  placeholder="Ex: DN_8841_ObraTijuca.pdf"
                  className="w-full bg-dark-800 border border-dark-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-300">Observações de Fabricação</label>
                <textarea
                  rows={2}
                  value={newDnNotes}
                  onChange={(e) => setNewDnNotes(e.target.value)}
                  placeholder="Ex: Dutos retos e curvas de 90° com flange TDC; entrega prioritária"
                  className="w-full bg-dark-800 border border-dark-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-dark-800">
                <button
                  type="button"
                  onClick={() => setIsAttachModalOpen(false)}
                  className="px-3 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingDn}
                  className="px-5 py-2.5 rounded-xl text-xs font-black bg-cyan-600 text-white hover:bg-cyan-500 transition shadow"
                >
                  {submittingDn ? 'Salvando...' : 'Anexar e Validar Saldo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: APROVAÇÃO FORMAL DE EXCEDENTE DE PESO (SABRINA/EMILY/ADMIN)      */}
      {/* ========================================================================= */}
      {isApproveModalOpen && selectedNoteForApproval && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-dark-900 text-white rounded-3xl max-w-lg w-full p-6 space-y-4 border border-rose-500/50 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <div>
                <h3 className="text-base font-black text-white">Aprovação de Excedente de Peso</h3>
                <p className="text-xs text-slate-400">Autodesk CAMduct vs. Orçamento Oficial</p>
              </div>
            </div>

            <div className="p-3 bg-dark-800 rounded-xl text-xs space-y-1">
              <div><strong>Delivery Note:</strong> {selectedNoteForApproval.deliveryNoteNumber}</div>
              <div><strong>Peso da Nota:</strong> {selectedNoteForApproval.totalWeightKg} KG</div>
              <div className="text-rose-300 font-bold">
                Excedente apurado: +{selectedNoteForApproval.excessKg} KG além do orçamento da obra.
              </div>
            </div>

            <div className="space-y-1 text-xs">
              <label className="font-bold text-slate-300">Decisão *</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setApprovalDecision('approve')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold ${
                    approvalDecision === 'approve'
                      ? 'bg-emerald-600 text-white border-emerald-500'
                      : 'bg-dark-800 text-slate-300 border-dark-700'
                  }`}
                >
                  Aprovar Excedente
                </button>
                <button
                  type="button"
                  onClick={() => setApprovalDecision('reject')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold ${
                    approvalDecision === 'reject'
                      ? 'bg-rose-600 text-white border-rose-500'
                      : 'bg-dark-800 text-slate-300 border-dark-700'
                  }`}
                >
                  Rejeitar Nota
                </button>
              </div>
            </div>

            <div className="space-y-1 text-xs">
              <label className="font-bold text-slate-300">Justificativa Técnica</label>
              <textarea
                rows={2}
                value={approvalReason}
                onChange={(e) => setApprovalReason(e.target.value)}
                placeholder="Ex: Acréscimo decorrente de desvio em viga estrutural conforme RDO nº 14"
                className="w-full bg-dark-800 border border-dark-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-dark-800">
              <button
                onClick={() => setIsApproveModalOpen(false)}
                className="px-3 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                onClick={handleProcessApproval}
                className="px-5 py-2.5 rounded-xl text-xs font-black bg-emerald-600 text-white hover:bg-emerald-500 transition shadow"
              >
                Confirmar Decisão
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
