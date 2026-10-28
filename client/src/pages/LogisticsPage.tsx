import React, { useState, useEffect, useMemo } from 'react';
import {
  Truck,
  Calendar,
  ClipboardList,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Printer,
  ChevronLeft,
  ChevronRight,
  Filter,
  Plus,
  ArrowRight,
  User,
  MapPin,
  Package,
  Layers,
  AlertCircle,
  FileText,
  Search,
  Check,
  X,
  Navigation,
  ShieldCheck,
  ExternalLink,
  RefreshCw
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Project } from '../types';

interface LogisticsTrip {
  id: number;
  code: string;
  projectId: number;
  projectName: string;
  projectCode: string;
  client?: string;
  projectAddress?: string;
  projectCity?: string;
  responsibleEngineer?: string;
  scheduledDate: string;
  shift: string;
  vehiclePlate: string;
  vehicleModel: string;
  driverName: string;
  driverPhone?: string;
  status: string;
  tripNumberWeek: number;
  isExceptional: boolean;
  exceptionStatus: string;
  exceptionApprovedBy?: number;
  exceptionApprovedByName?: string;
  exceptionApprovedAt?: string;
  exceptionReason?: string;
  loadingChecked: boolean;
  loadingCheckedBy?: string;
  loadingCheckedAt?: string;
  loadingNotes?: string;
  deliveryConfirmed: boolean;
  deliveryConfirmedBy?: number;
  deliveryConfirmedByName?: string;
  deliveryConfirmedAt?: string;
  hasDivergence: boolean;
  divergenceNotes?: string;
  notes?: string;
  totalItems?: number;
  totalQuantity?: number;
  createdAt?: string;
}

interface AvailableItem {
  sourceType: 'material' | 'duto';
  requestItemId?: number;
  requestId?: number;
  requestCode?: string;
  ductNoteId?: number;
  materialId?: number;
  code: string;
  description: string;
  unit: string;
  quantityRequested: number;
  quantitySeparated: number;
  alreadyShipped: number;
  releasedInWarehouse: number; // Coluna 1: Liberado no Galpão
  quantityToSend: number;      // Coluna 2: Enviar Agora
  pendingQuantity: number;     // Coluna 3: Pendente
}

export const LogisticsPage: React.FC = () => {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'requests' | 'calendar' | 'new-romaneio' | 'trips'>('requests');
  const [loading, setLoading] = useState(false);
  const [trips, setTrips] = useState<LogisticsTrip[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  // Solicitações de Logística dos Engenheiros (Requisito 6 - Sirlene Leal)
  const [logisticsRequests, setLogisticsRequests] = useState<any[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);

  // Filtros de busca
  const [selectedProjectFilter, setSelectedProjectFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Estado do Calendário Semanal
  const [currentWeekDate, setCurrentWeekDate] = useState<Date>(new Date());

  // Estado da Criação de Novo Romaneio
  const [newRomaneioProject, setNewRomaneioProject] = useState<number | null>(null);
  const [scheduledDate, setScheduledDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [timeOption, setTimeOption] = useState<'qualquer' | 'especifico'>('qualquer');
  const [customTime, setCustomTime] = useState<string>('08:00');
  const [vehicleModel, setVehicleModel] = useState('Caminhão Sabrar HR');
  const [vehiclePlate, setVehiclePlate] = useState('SAB-2026');
  const [driverName, setDriverName] = useState('Motorista Logística');
  const [driverPhone, setDriverPhone] = useState('(21) 98888-0000');
  const [tripNotes, setTripNotes] = useState('');
  const [availableItems, setAvailableItems] = useState<AvailableItem[]>([]);
  const [loadingAvailable, setLoadingAvailable] = useState(false);
  const [submittingRomaneio, setSubmittingRomaneio] = useState(false);

  // Modais
  const [selectedTripDetails, setSelectedTripDetails] = useState<any | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isLoadingChecklistOpen, setIsLoadingChecklistOpen] = useState(false);
  const [isDeliveryChecklistOpen, setIsDeliveryChecklistOpen] = useState(false);
  const [isAiRouteModalOpen, setIsAiRouteModalOpen] = useState(false);
  const [aiRouteData, setAiRouteData] = useState<any | null>(null);
  const [loadingAiRoute, setLoadingAiRoute] = useState(false);
  const [isExceptionModalOpen, setIsExceptionModalOpen] = useState(false);
  const [exceptionReasonInput, setExceptionReasonInput] = useState('');

  // Inputs dos Checklists
  const [driverChecklistName, setDriverChecklistName] = useState('');
  const [driverChecklistNotes, setDriverChecklistNotes] = useState('');
  const [deliveryItemsStatus, setDeliveryItemsStatus] = useState<{ [itemId: number]: { deliveredQty: number; divergenceType: string; notes: string } }>({});
  const [deliveryEngineerNotes, setDeliveryEngineerNotes] = useState('');

  useEffect(() => {
    loadProjects();
    loadTrips();
    fetchLogisticsRequests();
  }, []);

  const fetchLogisticsRequests = async () => {
    setLoadingRequests(true);
    try {
      const data = await api.getLogisticsRequests();
      setLogisticsRequests(data || []);
    } catch (err) {
      console.error('Erro ao carregar solicitações de logística:', err);
    } finally {
      setLoadingRequests(false);
    }
  };

  const handleUpdateLogisticsRequestStatus = async (id: number, nextStatus: string) => {
    try {
      await api.updateLogisticsRequestStatus(id, nextStatus);
      await fetchLogisticsRequests();
      alert(`Status da solicitação de transporte atualizado para: ${nextStatus}`);
    } catch (err: any) {
      alert(err.message || 'Erro ao atualizar status da solicitação');
    }
  };

  const handleAttendRequest = (req: any) => {
    setNewRomaneioProject(Number(req.projectId));
    setTripNotes(`Atendimento à solicitação de logística ${req.code} (Solicitante: ${req.requestedByName})`);
    setActiveTab('new-romaneio');
  };

  const loadProjects = async () => {
    try {
      const data = await api.getProjects();
      setProjects(data.filter((p: Project) => p.code !== 'SAB-INTERNO'));
    } catch (err) {
      console.error('Erro ao carregar projetos:', err);
    }
  };

  const loadTrips = async () => {
    setLoading(true);
    try {
      const data = await api.getLogisticsTrips();
      setTrips(data);
    } catch (err) {
      console.error('Erro ao carregar viagens:', err);
    } finally {
      setLoading(false);
    }
  };

  // Carrega itens liberados no galpão quando escolhe a obra no Novo Romaneio
  useEffect(() => {
    if (!newRomaneioProject) {
      setAvailableItems([]);
      return;
    }

    const fetchAvailable = async () => {
      setLoadingAvailable(true);
      try {
        const res = await api.getLogisticsAvailableItems(newRomaneioProject);
        const combined: AvailableItem[] = [
          ...res.materials.map((m: any) => ({
            ...m,
            sourceType: 'material' as const,
            quantityToSend: m.suggestedToSend
          })),
          ...res.ducts.map((d: any) => ({
            ...d,
            sourceType: 'duto' as const,
            quantityToSend: d.suggestedToSend
          }))
        ];
        setAvailableItems(combined);
      } catch (err) {
        console.error('Erro ao carregar itens disponíveis:', err);
      } finally {
        setLoadingAvailable(false);
      }
    };

    fetchAvailable();
  }, [newRomaneioProject]);

  // Checagem da Cota Semanal para a obra selecionada e data selecionada
  const currentWeekTripCount = useMemo(() => {
    if (!newRomaneioProject || !scheduledDate) return 0;
    const target = new Date(scheduledDate + 'T12:00:00Z');
    const day = target.getUTCDay();
    const diff = day === 0 ? -6 : 1 - day;
    const mon = new Date(target);
    mon.setUTCDate(target.getUTCDate() + diff);
    const sun = new Date(mon);
    sun.setUTCDate(mon.getUTCDate() + 6);

    const monStr = mon.toISOString().split('T')[0];
    const sunStr = sun.toISOString().split('T')[0];

    const match = trips.filter(t => 
      t.projectId === newRomaneioProject && 
      t.scheduledDate >= monStr && 
      t.scheduledDate <= sunStr && 
      t.status !== 'cancelado'
    );
    return match.length;
  }, [newRomaneioProject, scheduledDate, trips]);

  // Checagem de Conflito de Frota
  const fleetConflict = useMemo(() => {
    if (!vehiclePlate || !scheduledDate) return null;
    const effectiveShift = timeOption === 'qualquer' ? 'Qualquer horário' : (customTime || '08:00');
    return trips.find(t => 
      t.vehiclePlate.trim().toLowerCase() === vehiclePlate.trim().toLowerCase() &&
      t.scheduledDate === scheduledDate &&
      t.status !== 'cancelado' &&
      (t.shift === effectiveShift || t.shift === 'Qualquer horário' || effectiveShift === 'Qualquer horário' || t.shift === 'integral')
    );
  }, [vehiclePlate, scheduledDate, timeOption, customTime, trips]);

  // Dias da Semana atual para a visão do Calendário
  const weekDays = useMemo(() => {
    const d = new Date(currentWeekDate);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day; // Segunda-feira
    d.setDate(d.getDate() + diff);

    const days = [];
    for (let i = 0; i < 6; i++) { // Seg a Sáb
      const cur = new Date(d);
      cur.setDate(d.getDate() + i);
      days.push({
        date: cur,
        dateStr: cur.toISOString().split('T')[0],
        dayName: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][i],
        formatted: `${cur.getDate().toString().padStart(2, '0')}/${(cur.getMonth() + 1).toString().padStart(2, '0')}`
      });
    }
    return days;
  }, [currentWeekDate]);

  const handleWeekPrev = () => {
    const d = new Date(currentWeekDate);
    d.setDate(d.getDate() - 7);
    setCurrentWeekDate(d);
  };

  const handleWeekNext = () => {
    const d = new Date(currentWeekDate);
    d.setDate(d.getDate() + 7);
    setCurrentWeekDate(d);
  };

  const handleWeekToday = () => {
    setCurrentWeekDate(new Date());
  };

  // Atualiza quantidade a enviar de um item
  const handleItemQuantityChange = (index: number, val: number) => {
    setAvailableItems(prev => {
      const copy = [...prev];
      const item = copy[index];
      const safeVal = Math.max(0, Math.min(item.releasedInWarehouse, Number(val) || 0));
      copy[index] = {
        ...item,
        quantityToSend: safeVal,
        pendingQuantity: Math.max(0, Number((item.quantityRequested - (item.alreadyShipped + safeVal)).toFixed(2)))
      };
      return copy;
    });
  };

  const handleSendAll = () => {
    setAvailableItems(prev => prev.map(item => ({
      ...item,
      quantityToSend: item.releasedInWarehouse,
      pendingQuantity: Math.max(0, Number((item.quantityRequested - (item.alreadyShipped + item.releasedInWarehouse)).toFixed(2)))
    })));
  };

  const handleClearAll = () => {
    setAvailableItems(prev => prev.map(item => ({
      ...item,
      quantityToSend: 0,
      pendingQuantity: Math.max(0, Number((item.quantityRequested - item.alreadyShipped).toFixed(2)))
    })));
  };

  // Disparo da emissão de novo Romaneio
  const handleCreateRomaneio = async () => {
    if (!newRomaneioProject) {
      alert('Selecione a obra de destino.');
      return;
    }
    if (!scheduledDate) {
      alert('Selecione a data de entrega.');
      return;
    }

    const itemsToSend = availableItems.filter(i => i.quantityToSend > 0);
    if (itemsToSend.length === 0) {
      alert('Selecione ao menos um item com quantidade a enviar maior que zero.');
      return;
    }

    if (fleetConflict) {
      if (!window.confirm(`Atenção: O veículo ${vehiclePlate} já está alocado para este dia/turno (${fleetConflict.code}). Deseja prosseguir mesmo assim?`)) {
        return;
      }
    }

    if (currentWeekTripCount >= 2) {
      if (!window.confirm(`ALERTA DE COTA: Esta será a ${currentWeekTripCount + 1}ª viagem da semana para esta obra. A cota semanal padrão de 2 fretes será excedida e a viagem ficará bloqueada até aprovação formal de Felipe Germano / Diretoria. Deseja emitir o romaneio para aprovação?`)) {
        return;
      }
    }

    setSubmittingRomaneio(true);
    try {
      const effectiveShift = timeOption === 'qualquer' ? 'Qualquer horário' : (customTime || '08:00');
      const res = await api.createLogisticsTrip({
        projectId: newRomaneioProject,
        scheduledDate,
        shift: effectiveShift,
        vehiclePlate,
        vehicleModel,
        driverName,
        driverPhone,
        notes: tripNotes,
        items: itemsToSend,
        userId: currentUser?.id,
        userName: currentUser?.name
      });

      alert(`Romaneio ${res.code} gerado com sucesso! ${res.isExceptional ? 'Status: Aguardando aprovação de cota com Felipe Germano.' : 'Status: Agendado na frota.'}`);
      await loadTrips();
      setActiveTab('trips');
      // Limpa formulário
      setNewRomaneioProject(null);
      setAvailableItems([]);
      setTripNotes('');
    } catch (err: any) {
      console.error('Erro ao emitir romaneio:', err);
      alert(err.message || 'Erro ao emitir romaneio');
    } finally {
      setSubmittingRomaneio(false);
    }
  };

  // Abre Detalhes da Viagem
  const openTripDetails = async (tripId: number, openModalType?: 'print' | 'loading' | 'delivery' | 'exception') => {
    setIsLoadingDetails(true);
    try {
      const res = await api.getLogisticsTripDetails(tripId);
      setSelectedTripDetails(res);

      if (openModalType === 'print') setIsPrintModalOpen(true);
      else if (openModalType === 'loading') {
        setDriverChecklistName(res.trip.driverName || '');
        setDriverChecklistNotes(res.trip.loadingNotes || '');
        setIsLoadingChecklistOpen(true);
      } else if (openModalType === 'delivery') {
        // Inicializa estado de conferência de entrega
        const initStatus: any = {};
        for (const item of res.items) {
          initStatus[item.id] = {
            deliveredQty: item.quantityDelivered > 0 ? item.quantityDelivered : item.quantityPlanned,
            divergenceType: item.divergenceType || 'sem_divergencia',
            notes: item.divergenceNotes || ''
          };
        }
        setDeliveryItemsStatus(initStatus);
        setDeliveryEngineerNotes(res.trip.divergenceNotes || '');
        setIsDeliveryChecklistOpen(true);
      } else if (openModalType === 'exception') {
        setExceptionReasonInput('');
        setIsExceptionModalOpen(true);
      }
    } catch (err) {
      console.error('Erro ao buscar detalhes da viagem:', err);
      alert('Erro ao carregar detalhes da viagem');
    } finally {
      setIsLoadingDetails(false);
    }
  };

  // Assinatura de Carregamento pelo Motorista
  const handleSaveLoadingChecklist = async () => {
    if (!selectedTripDetails) return;
    try {
      await api.signLogisticsLoadingChecklist(selectedTripDetails.trip.id, {
        driverName: driverChecklistName,
        notes: driverChecklistNotes
      });
      alert('Conferência de carregamento registrada! Veículo em trânsito para a obra.');
      setIsLoadingChecklistOpen(false);
      await loadTrips();
    } catch (err: any) {
      alert(err.message || 'Erro ao registrar conferência de carregamento');
    }
  };

  // Assinatura de Recebimento pelo Engenheiro na Obra (com Divergências)
  const handleSaveDeliveryChecklist = async () => {
    if (!selectedTripDetails) return;
    try {
      const itemsPayload = selectedTripDetails.items.map((i: any) => ({
        id: i.id,
        quantityPlanned: i.quantityPlanned,
        quantityDelivered: deliveryItemsStatus[i.id]?.deliveredQty ?? i.quantityPlanned,
        divergenceType: deliveryItemsStatus[i.id]?.divergenceType ?? 'sem_divergencia',
        divergenceNotes: deliveryItemsStatus[i.id]?.notes ?? ''
      }));

      await api.confirmLogisticsDeliveryChecklist(selectedTripDetails.trip.id, {
        engineerId: currentUser?.id,
        engineerName: currentUser?.name || 'Engenheiro da Obra',
        itemsDelivered: itemsPayload,
        notes: deliveryEngineerNotes
      });

      alert('Recebimento confirmado com sucesso! Histórico e eventuais divergências registrados.');
      setIsDeliveryChecklistOpen(false);
      await loadTrips();
    } catch (err: any) {
      alert(err.message || 'Erro ao registrar recebimento');
    }
  };

  // Aprovação de Cota de Frete (Felipe Germano / Admin)
  const handleApproveException = async (approved: boolean) => {
    if (!selectedTripDetails) return;
    try {
      await api.approveLogisticsTripException(selectedTripDetails.trip.id, {
        userId: currentUser?.id || 1,
        userName: currentUser?.name || 'Felipe Germano',
        approved,
        reason: exceptionReasonInput
      });
      alert(approved ? '3ª viagem autorizada com sucesso!' : 'Viagem rejeitada e cancelada.');
      setIsExceptionModalOpen(false);
      await loadTrips();
    } catch (err: any) {
      alert(err.message || 'Erro ao processar aprovação');
    }
  };

  // Executa Roteirização por IA
  const handleRunAiRoute = async (targetDate: string) => {
    setLoadingAiRoute(true);
    try {
      const res = await api.getLogisticsAiRoutePlan({ date: targetDate });
      setAiRouteData(res);
      setIsAiRouteModalOpen(true);
    } catch (err) {
      console.error('Erro ao planejar rotas com IA:', err);
      alert('Erro ao calcular roteirização inteligente.');
    } finally {
      setLoadingAiRoute(false);
    }
  };

  // Filtros de Viagens
  const filteredTrips = useMemo(() => {
    return trips.filter(t => {
      if (selectedProjectFilter !== 'all' && t.projectId !== Number(selectedProjectFilter)) return false;
      if (selectedStatusFilter !== 'all' && t.status !== selectedStatusFilter) return false;
      if (searchTerm) {
        const norm = searchTerm.toLowerCase();
        const matchCode = t.code.toLowerCase().includes(norm);
        const matchProj = t.projectName.toLowerCase().includes(norm);
        const matchDriver = (t.driverName || '').toLowerCase().includes(norm);
        const matchPlate = (t.vehiclePlate || '').toLowerCase().includes(norm);
        if (!matchCode && !matchProj && !matchDriver && !matchPlate) return false;
      }
      return true;
    });
  }, [trips, selectedProjectFilter, selectedStatusFilter, searchTerm]);

  const canApproveQuota = useMemo(() => {
    const name = String(currentUser?.name || '').toLowerCase();
    const email = String(currentUser?.email || '').toLowerCase();
    return currentUser?.role === 'admin' || /felipe/i.test(name) || /felipe/i.test(email);
  }, [currentUser]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20">
      {/* Cabeçalho Principal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-dark-900 p-5 rounded-3xl border border-dark-750 shadow-xl">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-950/70 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Logística & Gestão de Frotas
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-950 text-amber-300 border border-amber-500/40">
                  Pilar 4 HVAC
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Controle semanal de cota de fretes (2/obra), conferência dupla (motorista e obra) e romaneios parciais
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => handleRunAiRoute(new Date().toISOString().split('T')[0])}
            disabled={loadingAiRoute}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-dark-800 text-sabrar-400 border border-sabrar-500/40 hover:bg-dark-750 transition-all shadow"
          >
            <Sparkles className="w-3.5 h-3.5 text-sabrar-400 animate-pulse" />
            <span>{loadingAiRoute ? 'Roteirizando...' : 'Roteirizar com IA'}</span>
          </button>

          <button
            onClick={() => setActiveTab('new-romaneio')}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-950/30"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Romaneio</span>
          </button>
        </div>
      </div>

      {/* Navegação entre Abas (Requisito 6 - Área Própria da Logística / Sirlene Leal) */}
      <div className="flex items-center gap-2 border-b border-dark-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('requests')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            activeTab === 'requests'
              ? 'bg-purple-600 text-white shadow-md font-extrabold'
              : 'text-slate-400 hover:text-white hover:bg-dark-850'
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          <span>Solicitações Recebidas da Engenharia</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] ${
            activeTab === 'requests' ? 'bg-white/20 text-white font-extrabold' : 'bg-dark-800 text-slate-400'
          }`}>
            {logisticsRequests.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('calendar')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            activeTab === 'calendar'
              ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold'
              : 'text-slate-400 hover:text-white hover:bg-dark-850'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Agenda Semanal da Frota</span>
        </button>

        <button
          onClick={() => setActiveTab('new-romaneio')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            activeTab === 'new-romaneio'
              ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold'
              : 'text-slate-400 hover:text-white hover:bg-dark-850'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>Novo Romaneio Parcial</span>
        </button>

        <button
          onClick={() => setActiveTab('trips')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            activeTab === 'trips'
              ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold'
              : 'text-slate-400 hover:text-white hover:bg-dark-850'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Romaneios Emitidos ({trips.length})</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* ABA 0: SOLICITAÇÕES RECEBIDAS DA ENGENHARIA (REQUISITO 6 - SIRLENE LEAL)  */}
      {/* ========================================================================= */}
      {activeTab === 'requests' && (
        <div className="space-y-4">
          <div className="p-4 bg-dark-900 border border-dark-750 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-purple-950/70 border border-purple-500/40 flex items-center justify-center text-purple-400">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white">Demandas de Transporte Recebidas dos Engenheiros</h3>
                <p className="text-xs text-slate-400">
                  Responsável: <strong>Sirlene Leal</strong> • Recebe materiais com OK do Almoxarifado e dutos prontos da fábrica (Vinicius) para agendamento e entrega no canteiro
                </p>
              </div>
            </div>

            <button
              onClick={() => fetchLogisticsRequests()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-dark-800 hover:bg-dark-750 border border-dark-700 text-slate-300 rounded-xl text-xs font-bold transition self-start sm:self-auto cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-purple-400" />
              <span>Atualizar</span>
            </button>
          </div>

          {loadingRequests ? (
            <div className="py-20 text-center text-xs text-slate-500">
              Carregando solicitações de logística...
            </div>
          ) : logisticsRequests.length === 0 ? (
            <div className="py-16 text-center bg-dark-900 rounded-3xl border border-dark-750 p-6 space-y-2">
              <Truck className="w-8 h-8 text-slate-600 mx-auto" />
              <h4 className="text-xs font-bold text-white">Nenhuma solicitação de logística pendente</h4>
              <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                Quando os engenheiros solicitarem transporte de materiais liberados ou dutos prontos, os pedidos aparecerão aqui para atendimento.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {logisticsRequests.map((req: any) => {
                const getStatusBadge = (st: string) => {
                  switch (st) {
                    case 'Pendente':
                      return <span className="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-700">Pendente de Agendamento</span>;
                    case 'Agendado':
                      return <span className="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-blue-950 text-blue-300 border border-blue-700">Viagem Agendada</span>;
                    case 'Em Trânsito':
                      return <span className="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-purple-950 text-purple-300 border border-purple-700">Em Rota de Entrega</span>;
                    case 'Entregue':
                      return <span className="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-600 flex items-center gap-1"><Check className="w-3 h-3 text-emerald-400" /> Entregue no Canteiro</span>;
                    default:
                      return <span className="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-dark-800 text-slate-300 border border-dark-700">{st}</span>;
                  }
                };

                return (
                  <div key={req.id} className="bg-dark-900 border border-dark-750 rounded-3xl p-5 shadow-lg space-y-4">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-dark-800">
                      <div>
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="font-mono text-xs font-black text-purple-400 bg-purple-950/80 px-2.5 py-0.5 rounded-lg border border-purple-800">
                            {req.code}
                          </span>
                          <h4 className="text-sm font-black text-white">{req.projectName}</h4>
                          {req.projectCode && (
                            <span className="text-[10px] text-slate-400 font-mono">({req.projectCode})</span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400 flex items-center gap-2 flex-wrap mt-1">
                          <span>Solicitante: <strong className="text-white">{req.requestedByName || 'Engenharia'}</strong></span>
                          <span>•</span>
                          <span>Data: {new Date(req.createdAt).toLocaleDateString('pt-BR')}</span>
                          {req.targetDate && (
                            <>
                              <span>•</span>
                              <span className="text-amber-300 font-bold">Entrega Desejada: {new Date(req.targetDate).toLocaleDateString('pt-BR')}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        {getStatusBadge(req.status)}
                      </div>
                    </div>

                    {/* Detalhes de Destino */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-dark-850 p-3.5 rounded-2xl border border-dark-700">
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Endereço de Entrega:</span>
                        <span className="text-slate-200 font-medium">{req.deliveryAddress || 'Endereço da obra'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Contato no Canteiro:</span>
                        <span className="text-slate-200 font-medium">
                          {req.contactName || 'Não informado'} {req.contactPhone ? `(${req.contactPhone})` : ''}
                        </span>
                      </div>
                    </div>

                    {/* Itens a Transportar: Materiais do Almoxarifado e Dutos da Fábrica */}
                    <div className="space-y-2">
                      <span className="text-xs font-bold text-slate-300 block">Itens Liberados para Transporte:</span>
                      <div className="divide-y divide-dark-800 bg-dark-850 rounded-2xl border border-dark-750 overflow-hidden">
                        {req.items?.map((it: any, idx: number) => (
                          <div key={idx} className="p-3 text-xs flex items-center justify-between gap-3">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                                  it.originType === 'duto'
                                    ? 'bg-blue-950 text-blue-300 border-blue-800'
                                    : 'bg-emerald-950 text-emerald-300 border-emerald-800'
                                }`}>
                                  {it.originType === 'duto' ? 'Duto CAMduct (Vinicius)' : 'Material Almoxarifado (OK)'}
                                </span>
                                <span className="font-bold text-white">{it.itemDescription}</span>
                              </div>
                              {it.notes && (
                                <p className="text-[11px] text-slate-400">{it.notes}</p>
                              )}
                            </div>
                            <span className="font-mono font-bold text-purple-300 bg-purple-950/80 px-2.5 py-1 rounded-lg border border-purple-900 shrink-0">
                              {it.quantity} {it.unit || 'un'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Ações da Equipe de Logística */}
                    <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-dark-800">
                      <div className="text-[11px] text-slate-400">
                        {req.status === 'Pendente' && 'Demanda pendente. Clique em "Atender / Emitir Romaneio" para programar o veículo.'}
                        {req.status === 'Agendado' && 'Viagem agendada. Quando o veículo sair para entrega, marque "Em Trânsito".'}
                        {req.status === 'Em Trânsito' && 'Veículo em rota de entrega no canteiro. Ao descarregar, confirme a entrega.'}
                        {req.status === 'Entregue' && '✅ Carga entregue no canteiro de obras.'}
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        {req.status === 'Pendente' && (
                          <button
                            type="button"
                            onClick={() => handleAttendRequest(req)}
                            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs transition shadow-md shadow-emerald-600/30 cursor-pointer active:scale-95"
                          >
                            <Package className="w-4 h-4" />
                            <span>Atender / Emitir Romaneio</span>
                          </button>
                        )}

                        {req.status === 'Agendado' && (
                          <button
                            type="button"
                            onClick={() => handleUpdateLogisticsRequestStatus(req.id, 'Em Trânsito')}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold text-xs transition shadow-md cursor-pointer active:scale-95"
                          >
                            <Navigation className="w-3.5 h-3.5" />
                            <span>Marcar em Trânsito</span>
                          </button>
                        )}

                        {req.status === 'Em Trânsito' && (
                          <button
                            type="button"
                            onClick={() => handleUpdateLogisticsRequestStatus(req.id, 'Entregue')}
                            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-xs transition shadow-lg shadow-emerald-600/30 cursor-pointer active:scale-95"
                          >
                            <Check className="w-4 h-4" />
                            <span>Confirmar Entrega na Obra</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 1: AGENDA SEMANAL DA FROTA (CALENDÁRIO)                               */}
      {/* ========================================================================= */}
      {activeTab === 'calendar' && (
        <div className="space-y-4">
          {/* Navegador da Semana */}
          <div className="flex items-center justify-between bg-dark-900 p-3.5 rounded-2xl border border-dark-750">
            <div className="flex items-center gap-2">
              <button
                onClick={handleWeekPrev}
                className="p-1.5 rounded-lg bg-dark-800 text-slate-300 hover:text-white hover:bg-dark-700 transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={handleWeekToday}
                className="px-3 py-1 rounded-lg text-xs font-bold bg-dark-800 text-slate-300 hover:text-white hover:bg-dark-700 transition"
              >
                Hoje
              </button>
              <button
                onClick={handleWeekNext}
                className="p-1.5 rounded-lg bg-dark-800 text-slate-300 hover:text-white hover:bg-dark-700 transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <span className="text-xs font-bold text-white ml-2">
                Semana de {weekDays[0].formatted} a {weekDays[weekDays.length - 1].formatted}
              </span>
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-400">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
                <span>Agendado</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                <span>Em Trânsito</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                <span>Entregue</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
                <span>Cota Pendente</span>
              </div>
            </div>
          </div>

          {/* Grid dos Dias da Semana */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
            {weekDays.map(day => {
              const dayTrips = trips.filter(t => t.scheduledDate === day.dateStr && t.status !== 'cancelado');
              const isToday = day.dateStr === new Date().toISOString().split('T')[0];

              return (
                <div
                  key={day.dateStr}
                  className={`bg-dark-900 rounded-2xl border p-3 min-h-[380px] flex flex-col ${
                    isToday ? 'border-amber-500/50 bg-dark-900/90 shadow-md shadow-amber-950/20' : 'border-dark-750'
                  }`}
                >
                  {/* Cabeçalho do Dia */}
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-dark-800">
                    <div>
                      <span className="text-xs font-bold text-slate-400 uppercase">{day.dayName}</span>
                      <div className={`text-sm font-black ${isToday ? 'text-amber-400' : 'text-white'}`}>
                        {day.formatted}
                      </div>
                    </div>
                    {dayTrips.length > 0 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-dark-800 text-slate-300 border border-dark-700">
                        {dayTrips.length} {dayTrips.length === 1 ? 'viagem' : 'viagens'}
                      </span>
                    )}
                  </div>

                  {/* Lista de Viagens do Dia */}
                  <div className="space-y-2 flex-1 overflow-y-auto">
                    {dayTrips.length === 0 && (
                      <div className="h-full flex items-center justify-center text-center p-4 text-[11px] text-slate-600">
                        Sem entregas
                      </div>
                    )}

                    {dayTrips.map(trip => {
                      const isPendingException = trip.isExceptional && trip.exceptionStatus === 'pendente_aprovacao';

                      return (
                        <div
                          key={trip.id}
                          onClick={() => openTripDetails(trip.id)}
                          className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all hover:scale-[1.02] ${
                            isPendingException
                              ? 'bg-rose-950/40 border-rose-500/50 hover:border-rose-400'
                              : trip.status === 'entregue'
                              ? 'bg-emerald-950/30 border-emerald-500/40 hover:border-emerald-400'
                              : trip.status === 'em_transito'
                              ? 'bg-amber-950/30 border-amber-500/40 hover:border-amber-400'
                              : 'bg-dark-800 border-dark-700 hover:border-sabrar-500'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-mono font-black text-[10px] text-sabrar-400">
                              {trip.code}
                            </span>
                            <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-purple-950/80 text-purple-300 border border-purple-800">
                              ⏰ {trip.shift || 'Qualquer horário'}
                            </span>
                          </div>

                          <h4 className="font-bold text-white text-[11px] truncate mb-0.5" title={trip.projectName}>
                            {trip.projectName}
                          </h4>

                          <div className="text-[10px] text-slate-400 truncate mb-1">
                            {trip.vehicleModel} ({trip.vehiclePlate})
                          </div>

                          <div className="flex items-center justify-between text-[10px] text-slate-400 border-t border-dark-750/70 pt-1 mt-1">
                            <span>{trip.totalItems || 0} itens</span>
                            <span className="font-bold">
                              {isPendingException ? (
                                <span className="text-rose-400">3ª Viagem</span>
                              ) : (
                                <span className="text-slate-300">{trip.tripNumberWeek}ª da semana</span>
                              )}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 2: NOVO ROMANEIO PARCIAL (SELEÇÃO, COTA E TABELA EM 3 COLUNAS)         */}
      {/* ========================================================================= */}
      {activeTab === 'new-romaneio' && (
        <div className="space-y-6">
          {/* Seção 1: Seleção de Obra e Indicador de Cota Semanal */}
          <div className="bg-dark-900 p-5 rounded-3xl border border-dark-750 shadow-md space-y-4">
            <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center text-xs font-bold">1</span>
              <span>Identificação da Obra & Cota de Fretes</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Selecione a Obra de Destino *</label>
                <select
                  value={newRomaneioProject || ''}
                  onChange={(e) => setNewRomaneioProject(Number(e.target.value) || null)}
                  className="w-full bg-dark-800 border border-dark-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500 font-medium"
                >
                  <option value="">-- Selecione a Obra --</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.code} - {p.name} ({p.client}) {p.responsible_engineer ? `[Eng: ${p.responsible_engineer}]` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Box de Cota Semanal */}
              <div className={`p-3.5 rounded-2xl border flex flex-col justify-center ${
                !newRomaneioProject
                  ? 'bg-dark-800/50 border-dark-750 text-slate-500'
                  : currentWeekTripCount >= 2
                  ? 'bg-rose-950/40 border-rose-500/50 text-rose-300'
                  : 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300'
              }`}>
                <div className="text-[10px] font-black uppercase">Cota Semanal de Fretes</div>
                <div className="text-sm font-black mt-0.5">
                  {!newRomaneioProject ? (
                    'Selecione uma obra'
                  ) : currentWeekTripCount >= 2 ? (
                    `3ª Viagem (${currentWeekTripCount}/2 usadas)`
                  ) : (
                    `${currentWeekTripCount + 1}ª Viagem (${currentWeekTripCount}/2 usadas)`
                  )}
                </div>
                <div className="text-[10px] mt-1 text-slate-400">
                  {currentWeekTripCount >= 2
                    ? 'Requer aprovação excepcional de Felipe Germano'
                    : 'Dentro da cota semanal permitida (até 2 viagens)'}
                </div>
              </div>
            </div>
          </div>

          {/* Seção 2: Agendamento da Viagem & Frota */}
          <div className="bg-dark-900 p-5 rounded-3xl border border-dark-750 shadow-md space-y-4">
            <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center text-xs font-bold">2</span>
              <span>Dados do Transporte & Agendamento</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Data Prevista *</label>
                <input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="w-full bg-dark-800 border border-dark-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1.5 p-3 bg-dark-850 rounded-2xl border border-dark-700">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>Horário Programado *</span>
                  </label>
                  <div className="flex items-center gap-1 bg-dark-900 p-1 rounded-xl border border-dark-750">
                    <button
                      type="button"
                      onClick={() => setTimeOption('qualquer')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        timeOption === 'qualquer'
                          ? 'bg-amber-500 text-dark-950 font-black shadow-xs'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Qualquer horário
                    </button>
                    <button
                      type="button"
                      onClick={() => setTimeOption('especifico')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        timeOption === 'especifico'
                          ? 'bg-amber-500 text-dark-950 font-black shadow-xs'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Horário específico
                    </button>
                  </div>
                </div>

                {timeOption === 'qualquer' ? (
                  <p className="text-[11px] text-slate-400">
                    Sem restrição — entrega em qualquer horário disponível do dia.
                  </p>
                ) : (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-1">
                    <input
                      type="time"
                      value={customTime}
                      onChange={(e) => setCustomTime(e.target.value)}
                      className="w-full sm:w-36 bg-dark-800 border border-dark-700 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-white focus:outline-none focus:border-amber-500"
                    />
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="text-[10px] text-slate-500 font-bold uppercase">Atalhos:</span>
                      {['08:00', '10:00', '14:00', '17:00', '22:00'].map(t => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setCustomTime(t)}
                          className={`text-[10px] px-2 py-0.5 rounded-lg border font-mono transition-colors cursor-pointer ${
                            customTime === t
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 font-bold'
                              : 'bg-dark-800 text-slate-400 border-dark-700 hover:text-white'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Veículo / Frota *</label>
                <select
                  value={vehicleModel}
                  onChange={(e) => {
                    setVehicleModel(e.target.value);
                    if (e.target.value.includes('HR')) setVehiclePlate('SAB-2026');
                    else if (e.target.value.includes('Iveco')) setVehiclePlate('SAB-4455');
                    else setVehiclePlate('TER-9900');
                  }}
                  className="w-full bg-dark-800 border border-dark-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="Caminhão Sabrar HR">Caminhão Sabrar HR (Placa: SAB-2026)</option>
                  <option value="Furgão Iveco Sabrar">Furgão Iveco Sabrar (Placa: SAB-4455)</option>
                  <option value="Carreto Terceirizado">Carreto Terceirizado (Agregado)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Placa do Veículo *</label>
                <input
                  type="text"
                  value={vehiclePlate}
                  onChange={(e) => setVehiclePlate(e.target.value)}
                  placeholder="Ex: ABC-1234"
                  className="w-full bg-dark-800 border border-dark-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Motorista Responsável</label>
                <input
                  type="text"
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  placeholder="Nome do motorista"
                  className="w-full bg-dark-800 border border-dark-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Telefone / Contato</label>
                <input
                  type="text"
                  value={driverPhone}
                  onChange={(e) => setDriverPhone(e.target.value)}
                  placeholder="(21) 98888-0000"
                  className="w-full bg-dark-800 border border-dark-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="sm:col-span-2 space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Observações de Acesso / Doca</label>
                <input
                  type="text"
                  value={tripNotes}
                  onChange={(e) => setTripNotes(e.target.value)}
                  placeholder="Ex: Entrar pela doca dos fundos do shopping; apresentar crachá Sabrar"
                  className="w-full bg-dark-800 border border-dark-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* Alerta de Conflito de Frota */}
            {fleetConflict && (
              <div className="p-3 bg-amber-950/50 border border-amber-500/50 rounded-2xl flex items-center gap-3 text-amber-200 text-xs">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                <div>
                  <span className="font-bold">Atenção ao agendamento da frota:</span> O veículo {vehiclePlate} já está alocado para o Romaneio{' '}
                  <span className="font-mono font-bold text-white">{fleetConflict.code}</span> na data {scheduledDate} ({fleetConflict.shift}).
                </div>
              </div>
            )}
          </div>

          {/* Seção 3: Tabela em 3 Colunas ("Liberado no Galpão", "Enviar Agora", "Pendente") */}
          <div className="bg-dark-900 p-5 rounded-3xl border border-dark-750 shadow-md space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center text-xs font-bold">3</span>
                  <span>Composição do Romaneio Parcial</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Itens separados pelo Almoxarifado e dutos liberados no CAMduct para esta obra
                </p>
              </div>

              {availableItems.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSendAll}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-dark-800 text-emerald-400 border border-emerald-500/30 hover:bg-dark-750 transition"
                  >
                    Enviar Tudo Liberado
                  </button>
                  <button
                    onClick={handleClearAll}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-dark-800 text-slate-400 border border-dark-700 hover:bg-dark-750 transition"
                  >
                    Zerar Seleção
                  </button>
                </div>
              )}
            </div>

            {loadingAvailable && (
              <div className="py-16 text-center text-xs text-slate-400">
                Carregando materiais liberados no galpão para esta obra...
              </div>
            )}

            {!loadingAvailable && !newRomaneioProject && (
              <div className="py-16 text-center text-xs text-slate-500">
                Selecione uma obra acima para listar os materiais e dutos prontos no galpão.
              </div>
            )}

            {!loadingAvailable && newRomaneioProject && availableItems.length === 0 && (
              <div className="py-16 text-center text-xs text-slate-400 space-y-2">
                <Package className="w-8 h-8 text-slate-600 mx-auto" />
                <div className="font-bold text-white">Nenhum item liberado no galpão no momento</div>
                <div className="text-slate-500 max-w-md mx-auto">
                  Aguarde o almoxarifado finalizar a separação das solicitações da obra ou a fabricação dos lotes de dutos CAMduct.
                </div>
              </div>
            )}

            {!loadingAvailable && availableItems.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-dark-750 text-slate-400 font-bold uppercase text-[10px]">
                      <th className="py-2.5 px-3">Item / Descrição</th>
                      <th className="py-2.5 px-3">Origem</th>
                      <th className="py-2.5 px-3 text-center">Unid.</th>
                      <th className="py-2.5 px-3 text-right bg-dark-800/60 rounded-l-lg text-sky-400">
                        1. Liberado no Galpão
                      </th>
                      <th className="py-2.5 px-3 text-center bg-amber-950/30 text-amber-300 font-black">
                        2. Enviar Agora
                      </th>
                      <th className="py-2.5 px-3 text-right bg-dark-800/60 rounded-r-lg text-slate-400">
                        3. Pendente
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dark-800">
                    {availableItems.map((item, idx) => (
                      <tr key={idx} className="hover:bg-dark-850/60 transition-colors">
                        <td className="py-3 px-3">
                          <div className="font-bold text-white">{item.description}</div>
                          <div className="font-mono text-[10px] text-slate-400">{item.code}</div>
                        </td>
                        <td className="py-3 px-3">
                          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                            item.sourceType === 'duto'
                              ? 'bg-purple-950 text-purple-300 border border-purple-800'
                              : 'bg-blue-950 text-blue-300 border border-blue-800'
                          }`}>
                            {item.sourceType === 'duto' ? 'CAMduct' : 'Almoxarifado'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center font-bold text-slate-300">
                          {item.unit}
                        </td>
                        <td className="py-3 px-3 text-right font-black text-sky-400 bg-dark-800/30">
                          {item.releasedInWarehouse}
                        </td>
                        <td className="py-3 px-3 text-center bg-amber-950/20">
                          <div className="inline-flex items-center gap-1.5">
                            <input
                              type="number"
                              min="0"
                              max={item.releasedInWarehouse}
                              step="any"
                              value={item.quantityToSend}
                              onChange={(e) => handleItemQuantityChange(idx, Number(e.target.value))}
                              className="w-20 bg-dark-800 border border-amber-500/50 rounded-lg px-2 py-1 text-xs text-white text-right font-black focus:outline-none focus:border-amber-400"
                            />
                            <button
                              onClick={() => handleItemQuantityChange(idx, item.releasedInWarehouse)}
                              className="px-1.5 py-1 text-[10px] font-bold rounded bg-dark-700 text-amber-300 hover:bg-dark-600"
                              title="Enviar total liberado"
                            >
                              Max
                            </button>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-slate-400 bg-dark-800/30">
                          {item.pendingQuantity}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Barra Inferior de Confirmação */}
            {availableItems.length > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-dark-800">
                <div className="text-xs text-slate-400">
                  Total de itens selecionados para envio:{' '}
                  <span className="font-black text-white">
                    {availableItems.filter(i => i.quantityToSend > 0).length} de {availableItems.length}
                  </span>
                </div>

                <button
                  onClick={handleCreateRomaneio}
                  disabled={submittingRomaneio}
                  className="flex items-center justify-center gap-2 px-6 py-3 rounded-2xl text-xs font-black bg-emerald-600 text-white hover:bg-emerald-500 transition-all shadow-xl shadow-emerald-950/40"
                >
                  <Check className="w-4 h-4" />
                  <span>{submittingRomaneio ? 'Emitindo Romaneio...' : 'Emitir Romaneio e Agendar Viagem'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 3: LISTAGEM DE ROMANEIOS EMITIDOS & HISTÓRICO                          */}
      {/* ========================================================================= */}
      {activeTab === 'trips' && (
        <div className="space-y-4">
          {/* Barra de Filtros */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-dark-900 p-4 rounded-2xl border border-dark-750">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 ml-2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por código R-XXXX, obra, motorista ou placa..."
                className="w-full bg-dark-800 border border-dark-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={selectedStatusFilter}
                onChange={(e) => setSelectedStatusFilter(e.target.value)}
                className="bg-dark-800 border border-dark-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
              >
                <option value="all">Todos os Status</option>
                <option value="agendado">Agendado</option>
                <option value="agendado_pendente_aprovacao">Pendente Aprovação Cota</option>
                <option value="em_transito">Em Trânsito</option>
                <option value="entregue">Entregue</option>
              </select>

              <select
                value={selectedProjectFilter}
                onChange={(e) => setSelectedProjectFilter(e.target.value)}
                className="bg-dark-800 border border-dark-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
              >
                <option value="all">Todas as Obras</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Lista de Romaneios */}
          {loading && (
            <div className="py-20 text-center text-xs text-slate-500">
              Carregando romaneios...
            </div>
          )}

          {!loading && filteredTrips.length === 0 && (
            <div className="py-20 text-center bg-dark-900 rounded-3xl border border-dark-750 text-slate-400 space-y-2 p-6">
              <Truck className="w-10 h-10 text-slate-600 mx-auto mb-2" />
              <div className="text-sm font-bold text-white">Nenhum romaneio encontrado</div>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Crie um novo romaneio parcial na aba "Novo Romaneio Parcial" para começar.
              </p>
            </div>
          )}

          {!loading && filteredTrips.length > 0 && (
            <div className="space-y-3">
              {filteredTrips.map(trip => {
                const isPendingQuota = trip.isExceptional && trip.exceptionStatus === 'pendente_aprovacao';

                return (
                  <div
                    key={trip.id}
                    className="bg-dark-900 p-4 sm:p-5 rounded-3xl border border-dark-750 shadow-md hover:border-amber-500/50 transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <span className="font-mono font-black text-xs bg-dark-800 text-amber-400 border border-dark-700 px-2 py-0.5 rounded">
                          {trip.code}
                        </span>

                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                          trip.status === 'entregue'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : trip.status === 'em_transito'
                            ? 'bg-amber-950 text-amber-300 border border-amber-800'
                            : isPendingQuota
                            ? 'bg-rose-950 text-rose-300 border border-rose-800'
                            : 'bg-blue-950 text-blue-300 border border-blue-800'
                        }`}>
                          {isPendingQuota
                            ? '3ª Viagem - Aguardando Felipe'
                            : trip.status === 'em_transito'
                            ? 'Em Trânsito'
                            : trip.status === 'entregue'
                            ? 'Entregue na Obra'
                            : 'Agendado'}
                        </span>

                        {trip.hasDivergence && (
                          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3 text-rose-400" />
                            Com Divergência
                          </span>
                        )}

                        <span className="text-xs font-bold text-slate-400">
                          Data: {trip.scheduledDate} ({trip.shift})
                        </span>
                      </div>

                      <h3 className="font-extrabold text-white text-base">
                        {trip.projectName}
                      </h3>

                      <div className="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span>Veículo: <strong className="text-slate-200">{trip.vehicleModel} ({trip.vehiclePlate})</strong></span>
                        <span>Motorista: <strong className="text-slate-200">{trip.driverName}</strong></span>
                        {trip.responsibleEngineer && (
                          <span>Engenheiro: <strong className="text-slate-200">{trip.responsibleEngineer}</strong></span>
                        )}
                        <span>Total: <strong className="text-amber-400">{trip.totalItems || 0} itens</strong></span>
                      </div>

                      {trip.hasDivergence && trip.divergenceNotes && (
                        <div className="text-xs text-rose-300 bg-rose-950/30 border border-rose-800/40 p-2 rounded-xl mt-2">
                          <strong>Divergência apontada:</strong> {trip.divergenceNotes}
                        </div>
                      )}
                    </div>

                    {/* Botões de Ação */}
                    <div className="flex flex-wrap items-center gap-2 self-end lg:self-center">
                      {/* Botão de Aprovação de Exceção (Apenas Felipe Germano ou Admin) */}
                      {isPendingQuota && canApproveQuota && (
                        <button
                          onClick={() => openTripDetails(trip.id, 'exception')}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-600 text-white hover:bg-rose-500 transition shadow"
                        >
                          Analisar Cota (3ª Viagem)
                        </button>
                      )}

                      {/* Conferência Ponto 1: Motorista */}
                      {!trip.loadingChecked && trip.status !== 'entregue' && (
                        <button
                          onClick={() => openTripDetails(trip.id, 'loading')}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-600 text-slate-950 hover:bg-amber-500 transition shadow font-extrabold"
                        >
                          Conferir Carga (Motorista)
                        </button>
                      )}

                      {/* Conferência Ponto 2: Engenheiro na Obra */}
                      {trip.status !== 'entregue' && (
                        <button
                          onClick={() => openTripDetails(trip.id, 'delivery')}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-500 transition shadow"
                        >
                          Receber na Obra (Engenheiro)
                        </button>
                      )}

                      {/* Imprimir Romaneio */}
                      <button
                        onClick={() => openTripDetails(trip.id, 'print')}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold bg-dark-800 text-slate-300 border border-dark-700 hover:text-white hover:bg-dark-750 transition flex items-center gap-1.5"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Imprimir</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: IMPRESSÃO DO ROMANEIO OFICIAL SABRAR (A4)                         */}
      {/* ========================================================================= */}
      {isPrintModalOpen && selectedTripDetails && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white text-slate-900 rounded-2xl max-w-3xl w-full p-6 sm:p-8 space-y-6 max-h-[90vh] overflow-y-auto print:p-0 print:m-0 print:max-w-none">
            {/* Header do Romaneio */}
            <div className="flex items-center justify-between border-b-2 border-slate-900 pb-4">
              <div>
                <h2 className="text-xl font-black text-slate-950 uppercase tracking-tight">SABRAR ENGENHARIA</h2>
                <p className="text-xs text-slate-600">Sistemas de Ar Condicionado e Ventilação Mecânica</p>
                <p className="text-xs text-slate-500">Romaneio Oficial de Entrega de Materiais e Dutos</p>
              </div>
              <div className="text-right">
                <span className="font-mono font-black text-lg bg-slate-100 px-3 py-1 rounded border border-slate-300">
                  {selectedTripDetails.trip.code}
                </span>
                <p className="text-xs text-slate-500 mt-1">Data: {selectedTripDetails.trip.scheduledDate}</p>
              </div>
            </div>

            {/* Dados da Obra e Transporte */}
            <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div>
                <p><strong>Obra:</strong> {selectedTripDetails.trip.projectName} ({selectedTripDetails.trip.projectCode})</p>
                <p><strong>Cliente:</strong> {selectedTripDetails.trip.client || 'Não informado'}</p>
                <p><strong>Endereço:</strong> {selectedTripDetails.trip.projectAddress || 'Canteiro de obras'}</p>
                <p><strong>Engenheiro Responsável:</strong> {selectedTripDetails.trip.responsibleEngineer || 'Engenharia Sabrar'}</p>
              </div>
              <div>
                <p><strong>Veículo / Placa:</strong> {selectedTripDetails.trip.vehicleModel} ({selectedTripDetails.trip.vehiclePlate})</p>
                <p><strong>Motorista:</strong> {selectedTripDetails.trip.driverName}</p>
                <p><strong>Horário de Entrega:</strong> {selectedTripDetails.trip.shift || 'Qualquer horário'}</p>
                <p><strong>Viagem da Semana:</strong> {selectedTripDetails.trip.tripNumberWeek}ª viagem</p>
              </div>
            </div>

            {/* Tabela de Itens Carregados */}
            <div>
              <h4 className="font-bold text-xs uppercase text-slate-700 mb-2">Itens Embarcados neste Romaneio</h4>
              <table className="w-full text-left text-xs border border-slate-300">
                <thead>
                  <tr className="bg-slate-200 text-slate-700 font-bold border-b border-slate-300">
                    <th className="py-2 px-3">Código</th>
                    <th className="py-2 px-3">Descrição do Material / Duto</th>
                    <th className="py-2 px-3 text-center">Unid.</th>
                    <th className="py-2 px-3 text-right">Qtd. Enviada</th>
                    <th className="py-2 px-3 text-right">Qtd. Recebida</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {selectedTripDetails.items.map((i: any) => (
                    <tr key={i.id}>
                      <td className="py-2 px-3 font-mono text-[11px]">{i.materialCode || 'SAB'}</td>
                      <td className="py-2 px-3 font-medium">{i.description}</td>
                      <td className="py-2 px-3 text-center">{i.unit}</td>
                      <td className="py-2 px-3 text-right font-bold">{i.quantityPlanned}</td>
                      <td className="py-2 px-3 text-right border-l border-slate-200">
                        {i.quantityDelivered > 0 ? i.quantityDelivered : '____'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Campos de Assinaturas */}
            <div className="grid grid-cols-2 gap-8 pt-8 border-t border-slate-300 text-center text-xs">
              <div>
                <div className="border-t border-slate-400 pt-1 font-bold">
                  {selectedTripDetails.trip.loadingCheckedBy || selectedTripDetails.trip.driverName}
                </div>
                <div className="text-[10px] text-slate-500">Conferência de Carregamento (Motorista)</div>
              </div>
              <div>
                <div className="border-t border-slate-400 pt-1 font-bold">
                  {selectedTripDetails.trip.deliveryConfirmedByName || selectedTripDetails.trip.responsibleEngineer || 'Engenheiro da Obra'}
                </div>
                <div className="text-[10px] text-slate-500">Recebimento no Canteiro de Obras (Engenheiro)</div>
              </div>
            </div>

            {/* Botões do Modal */}
            <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200 print:hidden">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 transition flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir Documento</span>
              </button>
              <button
                onClick={() => setIsPrintModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-200 text-slate-800 hover:bg-slate-300 transition"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: CONFERÊNCIA DE CARREGAMENTO (MOTORISTA)                          */}
      {/* ========================================================================= */}
      {isLoadingChecklistOpen && selectedTripDetails && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-dark-900 text-white rounded-3xl max-w-lg w-full p-6 space-y-4 border border-dark-750 shadow-2xl">
            <div className="flex items-center justify-between border-b border-dark-800 pb-3">
              <div>
                <h3 className="text-base font-black text-white">Conferência de Carregamento (Motorista)</h3>
                <p className="text-xs text-slate-400">Ponto 1 de verificação antes da saída do galpão</p>
              </div>
              <button onClick={() => setIsLoadingChecklistOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-dark-800 rounded-xl space-y-1">
                <div><strong>Romaneio:</strong> {selectedTripDetails.trip.code}</div>
                <div><strong>Obra:</strong> {selectedTripDetails.trip.projectName}</div>
                <div><strong>Total de Itens:</strong> {selectedTripDetails.items.length} itens a embarcar</div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-300">Nome do Motorista que está Carregando *</label>
                <input
                  type="text"
                  value={driverChecklistName}
                  onChange={(e) => setDriverChecklistName(e.target.value)}
                  className="w-full bg-dark-800 border border-dark-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-300">Observações de Embarque / Amortecimento</label>
                <textarea
                  rows={2}
                  value={driverChecklistNotes}
                  onChange={(e) => setDriverChecklistNotes(e.target.value)}
                  placeholder="Ex: Carga amarrada com cintas; dutos protegidos com plástico bolha"
                  className="w-full bg-dark-800 border border-dark-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-dark-800">
              <button
                onClick={() => setIsLoadingChecklistOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveLoadingChecklist}
                className="px-5 py-2.5 rounded-xl text-xs font-black bg-amber-500 text-slate-950 hover:bg-amber-400 transition shadow"
              >
                Assinar e Iniciar Viagem
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: CONFERÊNCIA DE RECEBIMENTO NA OBRA (ENGENHEIRO)                   */}
      {/* ========================================================================= */}
      {isDeliveryChecklistOpen && selectedTripDetails && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-dark-900 text-white rounded-3xl max-w-3xl w-full p-6 space-y-5 border border-dark-750 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-dark-800 pb-3">
              <div>
                <h3 className="text-base font-black text-white">Recebimento na Obra & Apontamento de Divergências</h3>
                <p className="text-xs text-slate-400">Ponto 2 de verificação física no canteiro de obras</p>
              </div>
              <button onClick={() => setIsDeliveryChecklistOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-dark-800 rounded-2xl text-xs flex justify-between items-center">
              <div>
                <span className="font-bold text-white">{selectedTripDetails.trip.projectName}</span>
                <div className="text-slate-400 font-mono mt-0.5">{selectedTripDetails.trip.code}</div>
              </div>
              <div className="text-right text-slate-300">
                <div>Motorista: <strong>{selectedTripDetails.trip.driverName}</strong></div>
              </div>
            </div>

            {/* Tabela de Conferência Item a Item */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase text-slate-400">Conferência dos Itens</h4>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {selectedTripDetails.items.map((i: any) => {
                  const currentItemState = deliveryItemsStatus[i.id] || {
                    deliveredQty: i.quantityPlanned,
                    divergenceType: 'sem_divergencia',
                    notes: ''
                  };

                  return (
                    <div key={i.id} className="p-3 bg-dark-850 rounded-xl border border-dark-750 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <div>
                          <strong className="text-white">{i.description}</strong>
                          <div className="text-[10px] text-slate-400 font-mono">{i.materialCode}</div>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400">Enviado: </span>
                          <span className="font-bold text-amber-400">{i.quantityPlanned} {i.unit}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 border-t border-dark-800">
                        <div>
                          <label className="text-[10px] font-bold text-slate-400">Qtd. Entregue Real</label>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={currentItemState.deliveredQty}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setDeliveryItemsStatus(prev => ({
                                ...prev,
                                [i.id]: {
                                  ...currentItemState,
                                  deliveredQty: val,
                                  divergenceType: val < i.quantityPlanned ? 'falta' : currentItemState.divergenceType
                                }
                              }));
                            }}
                            className="w-full bg-dark-800 border border-dark-700 rounded-lg px-2.5 py-1 text-xs text-white"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-400">Conformidade</label>
                          <select
                            value={currentItemState.divergenceType}
                            onChange={(e) => {
                              const dt = e.target.value;
                              setDeliveryItemsStatus(prev => ({
                                ...prev,
                                [i.id]: { ...currentItemState, divergenceType: dt }
                              }));
                            }}
                            className="w-full bg-dark-800 border border-dark-700 rounded-lg px-2.5 py-1 text-xs text-white"
                          >
                            <option value="sem_divergencia">100% Conforme</option>
                            <option value="falta">Falta de Quantidade</option>
                            <option value="avaria">Material Avariado / Danificado</option>
                            <option value="recusa">Recusa no Canteiro</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-400">Obs. Divergência</label>
                          <input
                            type="text"
                            value={currentItemState.notes}
                            onChange={(e) => {
                              const nt = e.target.value;
                              setDeliveryItemsStatus(prev => ({
                                ...prev,
                                [i.id]: { ...currentItemState, notes: nt }
                              }));
                            }}
                            placeholder="Motivo da divergência"
                            className="w-full bg-dark-800 border border-dark-700 rounded-lg px-2.5 py-1 text-xs text-white"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1 text-xs">
              <label className="font-bold text-slate-300">Observações Gerais do Recebimento pelo Engenheiro</label>
              <textarea
                rows={2}
                value={deliveryEngineerNotes}
                onChange={(e) => setDeliveryEngineerNotes(e.target.value)}
                placeholder="Ex: Recebido no 3º pavimento; conferido sem avarias aparentes"
                className="w-full bg-dark-800 border border-dark-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-dark-800">
              <button
                onClick={() => setIsDeliveryChecklistOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveDeliveryChecklist}
                className="px-5 py-2.5 rounded-xl text-xs font-black bg-emerald-600 text-white hover:bg-emerald-500 transition shadow"
              >
                Confirmar Recebimento da Carga
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: APROVAÇÃO EXCEPCIONAL DE COTA (3ª VIAGEM) - FELIPE GERMANO       */}
      {/* ========================================================================= */}
      {isExceptionModalOpen && selectedTripDetails && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-dark-900 text-white rounded-3xl max-w-lg w-full p-6 space-y-4 border border-rose-500/50 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <div>
                <h3 className="text-base font-black text-white">Aprovação de Cota Semanal de Frete</h3>
                <p className="text-xs text-slate-400">Regra de Gestão Sabrar: Limite de 2 viagens por obra/semana</p>
              </div>
            </div>

            <div className="p-3 bg-dark-800 rounded-xl text-xs space-y-1">
              <div><strong>Obra:</strong> {selectedTripDetails.trip.projectName}</div>
              <div><strong>Romaneio:</strong> {selectedTripDetails.trip.code}</div>
              <div><strong>Data Agendada:</strong> {selectedTripDetails.trip.scheduledDate}</div>
              <div className="text-rose-300 font-bold">
                Esta é a {selectedTripDetails.trip.tripNumberWeek}ª viagem solicitada para a mesma semana.
              </div>
            </div>

            <div className="space-y-1 text-xs">
              <label className="font-bold text-slate-300">Justificativa da Decisão (Obrigatório)</label>
              <textarea
                rows={3}
                value={exceptionReasonInput}
                onChange={(e) => setExceptionReasonInput(e.target.value)}
                placeholder="Ex: Autorizado em caráter emergencial para atender cronograma crítico de montagem de dutos"
                className="w-full bg-dark-800 border border-dark-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-dark-800">
              <button
                onClick={() => setIsExceptionModalOpen(false)}
                className="px-3 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white"
              >
                Voltar
              </button>
              <button
                onClick={() => handleApproveException(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-dark-800 text-rose-400 border border-rose-800 hover:bg-rose-950/40"
              >
                Rejeitar Frete
              </button>
              <button
                onClick={() => handleApproveException(true)}
                className="px-5 py-2.5 rounded-xl text-xs font-black bg-emerald-600 text-white hover:bg-emerald-500 transition shadow"
              >
                Autorizar 3ª Viagem
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: ROTEIRIZAÇÃO INTELIGENTE POR IA                                  */}
      {/* ========================================================================= */}
      {isAiRouteModalOpen && aiRouteData && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-dark-900 text-white rounded-3xl max-w-3xl w-full p-6 space-y-5 border border-sabrar-500/50 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-dark-800 pb-3">
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-5 h-5 text-sabrar-400" />
                <div>
                  <h3 className="text-base font-black text-white">Plano de Roteirização Otimizado por IA</h3>
                  <p className="text-xs text-slate-400">Data: {aiRouteData.date} • Ponto de Partida: {aiRouteData.startLocation}</p>
                </div>
              </div>
              <button onClick={() => setIsAiRouteModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Dicas e Recomendações da IA */}
            <div className="bg-sabrar-950/40 border border-sabrar-500/30 p-3.5 rounded-2xl space-y-1.5 text-xs">
              <div className="font-black text-sabrar-400 uppercase text-[10px] tracking-wider">Diretrizes Logísticas da IA</div>
              <ul className="space-y-1 text-slate-300 list-disc list-inside">
                {aiRouteData.aiRecommendations?.map((rec: string, idx: number) => (
                  <li key={idx}>{rec}</li>
                ))}
              </ul>
            </div>

            {/* Sequência das Paradas */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase text-slate-400">Sequência Ideal de Paradas</h4>
              <div className="space-y-2">
                {aiRouteData.optimizedRoute?.map((stop: any) => (
                  <div key={stop.stopOrder} className="p-3.5 bg-dark-800 rounded-2xl border border-dark-750 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-amber-500 text-slate-950 font-black flex items-center justify-center shrink-0">
                        {stop.stopOrder}ª
                      </div>
                      <div>
                        <div className="font-extrabold text-white text-sm">{stop.projectName}</div>
                        <div className="text-slate-400 text-xs flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                          <span>{stop.address} - {stop.city}</span>
                        </div>
                        <div className="text-[11px] text-amber-300 font-bold mt-1">
                          {stop.loadingOrder}
                        </div>
                      </div>
                    </div>

                    <div className="text-right text-xs shrink-0 bg-dark-850 p-2 rounded-xl border border-dark-700">
                      <div>Janela: <strong>{stop.estimatedArrival} às {stop.estimatedDeparture}</strong></div>
                      <div className="text-[11px] text-slate-400">{stop.vehicle}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{stop.trafficAlert}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end pt-3 border-t border-dark-800">
              <button
                onClick={() => setIsAiRouteModalOpen(false)}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-dark-800 text-white hover:bg-dark-750"
              >
                Concluir Visualização
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
