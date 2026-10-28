import React, { useState, useEffect } from 'react';
import { X, Truck, Package, Wind, AlertCircle, Building2, Calendar, Clock, MapPin, Phone, Check, RefreshCw } from 'lucide-react';
import { Project } from '../../types';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

interface NewLogisticsRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  projects?: Project[];
  defaultProjectId?: number | null;
  initialProjectId?: number | null;
}

export const NewLogisticsRequestModal: React.FC<NewLogisticsRequestModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  projects: propProjects,
  defaultProjectId,
  initialProjectId
}) => {
  const { currentUser } = useAuth();
  const effectiveDefaultId = initialProjectId || defaultProjectId;
  const [internalProjects, setInternalProjects] = useState<Project[]>(propProjects || []);
  const [projectId, setProjectId] = useState<number | string>(effectiveDefaultId || (propProjects?.[0]?.id || ''));
  const [loadingItems, setLoadingItems] = useState(false);
  const [availableMaterials, setAvailableMaterials] = useState<any[]>([]);
  const [availableDucts, setAvailableDucts] = useState<any[]>([]);
  const [selectedItemsMap, setSelectedItemsMap] = useState<Record<string, { selected: boolean; qty: number }>>({});

  const [desiredDate, setDesiredDate] = useState<string>('');
  const [timeOption, setTimeOption] = useState<'qualquer' | 'especifico'>('qualquer');
  const [customTime, setCustomTime] = useState<string>('08:00');
  const [priority, setPriority] = useState<string>('Normal');
  const [deliveryLocation, setDeliveryLocation] = useState<string>('');
  const [contactOnSite, setContactOnSite] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Carrega projetos se não foram passados por prop
  useEffect(() => {
    if (propProjects && propProjects.length > 0) {
      setInternalProjects(propProjects);
    } else if (isOpen) {
      api.getProjects().then(data => {
        setInternalProjects(data || []);
        if (!projectId && data && data.length > 0) {
          setProjectId(data[0].id);
        }
      }).catch(console.error);
    }
  }, [isOpen, propProjects]);

  useEffect(() => {
    if (effectiveDefaultId) setProjectId(effectiveDefaultId);
  }, [effectiveDefaultId]);

  useEffect(() => {
    if (isOpen && projectId) {
      loadReadyItems(Number(projectId));
    }
  }, [isOpen, projectId]);

  const loadReadyItems = async (pId: number) => {
    setLoadingItems(true);
    setErrorMsg(null);
    try {
      const res = await api.getLogisticsReadyItems(pId);
      const mats = res.materials || [];
      const ducts = res.ducts || [];
      setAvailableMaterials(mats);
      setAvailableDucts(ducts);

      // Pre-seleciona todos os itens liberados por padrão com a quantidade disponível
      const newMap: Record<string, { selected: boolean; qty: number }> = {};
      mats.forEach((m: any, idx: number) => {
        newMap[`mat_${m.requestItemId || idx}`] = { selected: true, qty: Number(m.availableQuantity) || 1 };
      });
      ducts.forEach((d: any, idx: number) => {
        newMap[`duct_${d.ductItemId || d.ductNoteId || idx}`] = { selected: true, qty: Number(d.availableQuantity) || 1 };
      });
      setSelectedItemsMap(newMap);

      if (res.project) {
        if (res.project.address) setDeliveryLocation(res.project.address);
        if (res.project.responsible_engineer) setContactOnSite(res.project.responsible_engineer);
      }
    } catch (err: any) {
      console.error('Erro ao buscar itens liberados:', err);
      setErrorMsg(err.message || 'Erro ao carregar materiais e dutos liberados da obra.');
    } finally {
      setLoadingItems(false);
    }
  };

  if (!isOpen) return null;

  const toggleItemSelect = (key: string) => {
    setSelectedItemsMap(prev => {
      const current = prev[key] || { selected: false, qty: 1 };
      return {
        ...prev,
        [key]: { ...current, selected: !current.selected }
      };
    });
  };

  const handleQtyChange = (key: string, qty: number) => {
    setSelectedItemsMap(prev => {
      const current = prev[key] || { selected: true, qty: 1 };
      return {
        ...prev,
        [key]: { ...current, qty }
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!projectId) {
      setErrorMsg('Selecione a obra de destino.');
      return;
    }

    const itemsToSubmit: any[] = [];

    // Materiais selecionados
    availableMaterials.forEach((m, idx) => {
      const key = `mat_${m.requestItemId || idx}`;
      const state = selectedItemsMap[key];
      if (state && state.selected && state.qty > 0) {
        itemsToSubmit.push({
          sourceType: 'material',
          materialId: m.materialId,
          materialRequestId: m.requestId,
          requestItemId: m.requestItemId,
          description: m.description,
          unit: m.unit,
          quantityRequested: state.qty
        });
      }
    });

    // Dutos selecionados
    availableDucts.forEach((d, idx) => {
      const key = `duct_${d.ductItemId || d.ductNoteId || idx}`;
      const state = selectedItemsMap[key];
      if (state && state.selected && state.qty > 0) {
        itemsToSubmit.push({
          sourceType: 'duto',
          ductRequestId: d.ductRequestId,
          ductNoteId: d.ductNoteId,
          description: d.description,
          unit: d.unit,
          quantityRequested: state.qty
        });
      }
    });

    if (itemsToSubmit.length === 0) {
      setErrorMsg('Selecione ao menos um material ou lote de dutos liberado para transporte.');
      return;
    }

    setSubmitting(true);
    try {
      const effectiveShift = timeOption === 'qualquer' ? 'Qualquer horário' : (customTime || '08:00');
      await api.createLogisticsRequest({
        projectId: Number(projectId),
        items: itemsToSubmit,
        priority,
        desiredDate,
        preferredShift: effectiveShift,
        deliveryLocation,
        contactOnSite,
        notes,
        requestedBy: currentUser?.id
      });
      alert('Solicitação de logística enviada com sucesso para a equipe de logística (Sirlene Leal)!');
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Erro ao enviar solicitação de logística:', err);
      setErrorMsg(err.message || 'Erro ao registrar solicitação de logística.');
    } finally {
      setSubmitting(false);
    }
  };

  const totalItemsCount = availableMaterials.length + availableDucts.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl my-auto animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/60 rounded-t-3xl">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-2xl border border-blue-500/20">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                Solicitar Logística & Transporte de Itens Liberados
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Selecione os materiais liberados pelo almoxarifado e dutos prontos para envio ao canteiro
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1">
          {errorMsg && (
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-2xl flex items-center gap-2.5 text-xs text-rose-700 dark:text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Obra e Parâmetros de Entrega */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-emerald-600 dark:text-sabrar-400" />
                Obra Atribuída *
              </label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                required
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="">Selecione a Obra...</option>
                {internalProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-blue-500" />
                Data Desejada de Entrega
              </label>
              <input
                type="date"
                value={desiredDate}
                onChange={(e) => setDesiredDate(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Urgência */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Urgência
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="Normal">Normal</option>
                <option value="Urgente">Urgente</option>
                <option value="Crítica">Crítica</option>
              </select>
            </div>
          </div>

          {/* Horário Desejado de Entrega */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-purple-500 dark:text-purple-400" />
                <span>Horário Desejado para Entrega</span>
              </label>
              <div className="flex items-center gap-1.5 bg-slate-200/80 dark:bg-slate-900/80 p-1 rounded-xl border border-slate-300 dark:border-slate-700 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setTimeOption('qualquer')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    timeOption === 'qualquer'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Qualquer horário
                </button>
                <button
                  type="button"
                  onClick={() => setTimeOption('especifico')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    timeOption === 'especifico'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Horário específico
                </button>
              </div>
            </div>

            {timeOption === 'qualquer' ? (
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Sem preferência de horário — entrega poderá ser realizada em qualquer horário comercial/disponível da rota da frota.
              </p>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-1">
                <div className="w-full sm:w-44">
                  <input
                    type="time"
                    value={customTime}
                    onChange={(e) => setCustomTime(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Atalhos:</span>
                  {[
                    { label: '08:00 (Manhã)', val: '08:00' },
                    { label: '10:00', val: '10:00' },
                    { label: '14:00 (Tarde)', val: '14:00' },
                    { label: '17:00 (Fim de Tarde)', val: '17:00' },
                    { label: '22:00 (Noturno)', val: '22:00' }
                  ].map(item => (
                    <button
                      key={item.val}
                      type="button"
                      onClick={() => setCustomTime(item.val)}
                      className={`text-[11px] px-2.5 py-1 rounded-lg border font-mono transition-colors cursor-pointer ${
                        customTime === item.val
                          ? 'bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border-purple-500 font-bold'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-purple-400'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Endereço e Contato no Local */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                Local / Endereço de Descarregamento
              </label>
              <input
                type="text"
                value={deliveryLocation}
                onChange={(e) => setDeliveryLocation(e.target.value)}
                placeholder="Ex: Canteiro de Obras - Doca 3 Shopping Rio Sul"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                Responsável no Canteiro / Telefone de Contato
              </label>
              <input
                type="text"
                value={contactOnSite}
                onChange={(e) => setContactOnSite(e.target.value)}
                placeholder="Ex: Eng. Vinicius / Mestre Carlos (21 99999-8888)"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Lista de Itens Prontos / Liberados */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-4 bg-slate-50/50 dark:bg-slate-900/40 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <span>Itens Liberados no Galpão</span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-400 border border-blue-500/20">
                    {totalItemsCount} disponíveis
                  </span>
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Marque os itens e ajuste as quantidades que deseja despachar nesta viagem
                </p>
              </div>

              <button
                type="button"
                onClick={() => projectId && loadReadyItems(Number(projectId))}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                title="Recarregar itens liberados"
              >
                <RefreshCw className={`w-4 h-4 ${loadingItems ? 'animate-spin text-blue-500' : ''}`} />
              </button>
            </div>

            {loadingItems ? (
              <div className="py-8 text-center text-xs text-slate-400 animate-pulse">
                Consultando materiais liberados pelo almoxarifado e dutos prontos...
              </div>
            ) : totalItemsCount === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                Nenhum material ou duto liberado no momento para esta obra.
                <div className="text-[11px] text-slate-500 mt-1">
                  Assim que o almoxarifado der OK nos materiais ou os dutos forem marcados como prontos por Vinicius Gomes, eles aparecerão aqui.
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* 1. Seção de Materiais do Almoxarifado */}
                {availableMaterials.length > 0 && (
                  <div>
                    <div className="text-[11px] font-bold text-emerald-600 dark:text-sabrar-400 mb-2 flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5" />
                      Materiais Liberados pelo Almoxarifado ({availableMaterials.length})
                    </div>
                    <div className="space-y-2">
                      {availableMaterials.map((m, idx) => {
                        const key = `mat_${m.requestItemId || idx}`;
                        const isSelected = selectedItemsMap[key]?.selected ?? true;
                        const qty = selectedItemsMap[key]?.qty ?? m.availableQuantity;

                        return (
                          <div
                            key={key}
                            className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                              isSelected
                                ? 'bg-white dark:bg-slate-800 border-emerald-500/40 shadow-xs'
                                : 'bg-slate-100/60 dark:bg-slate-900 border-slate-200 dark:border-slate-800 opacity-60'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleItemSelect(key)}
                                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                              />
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                  {m.description}
                                </div>
                                <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
                                  <span className="font-mono">{m.code}</span>
                                  <span>•</span>
                                  <span>Pedido: #{m.requestCode}</span>
                                  <span>•</span>
                                  <span className="text-emerald-600 dark:text-sabrar-400 font-semibold">
                                    Liberado: {m.availableQuantity} {m.unit}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                                Enviar:
                              </span>
                              <input
                                type="number"
                                min="0.1"
                                max={m.availableQuantity}
                                step="any"
                                value={qty}
                                disabled={!isSelected}
                                onChange={(e) => handleQtyChange(key, parseFloat(e.target.value) || 0)}
                                className="w-20 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1 text-xs text-slate-900 dark:text-white font-bold text-center focus:outline-none focus:border-emerald-500 disabled:opacity-50"
                              />
                              <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold w-8">
                                {m.unit}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 2. Seção de Dutos do CAMduct */}
                {availableDucts.length > 0 && (
                  <div>
                    <div className="text-[11px] font-bold text-cyan-600 dark:text-cyan-400 mb-2 flex items-center gap-1.5">
                      <Wind className="w-3.5 h-3.5" />
                      Dutos Prontos pelo CAMduct ({availableDucts.length})
                    </div>
                    <div className="space-y-2">
                      {availableDucts.map((d, idx) => {
                        const key = `duct_${d.ductItemId || d.ductNoteId || idx}`;
                        const isSelected = selectedItemsMap[key]?.selected ?? true;
                        const qty = selectedItemsMap[key]?.qty ?? d.availableQuantity;

                        return (
                          <div
                            key={key}
                            className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                              isSelected
                                ? 'bg-white dark:bg-slate-800 border-cyan-500/40 shadow-xs'
                                : 'bg-slate-100/60 dark:bg-slate-900 border-slate-200 dark:border-slate-800 opacity-60'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleItemSelect(key)}
                                className="w-4 h-4 rounded text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                              />
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                  {d.description}
                                </div>
                                <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
                                  <span className="font-mono text-cyan-600 dark:text-cyan-400">{d.code}</span>
                                  {d.deliveryNoteNumber && (
                                    <>
                                      <span>•</span>
                                      <span>DN-{d.deliveryNoteNumber}</span>
                                    </>
                                  )}
                                  <span>•</span>
                                  <span className="text-cyan-600 dark:text-cyan-400 font-semibold">
                                    Pronto: {d.availableQuantity} {d.unit}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                                Enviar:
                              </span>
                              <input
                                type="number"
                                min="0.1"
                                max={d.availableQuantity}
                                step="any"
                                value={qty}
                                disabled={!isSelected}
                                onChange={(e) => handleQtyChange(key, parseFloat(e.target.value) || 0)}
                                className="w-20 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1 text-xs text-slate-900 dark:text-white font-bold text-center focus:outline-none focus:border-cyan-500 disabled:opacity-50"
                              />
                              <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold w-8">
                                {d.unit}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Observações da Viagem */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Observações & Instruções para a Logística
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Instruções para o motorista (Ex: Entregar pela portaria lateral, ligar 30min antes de chegar...)"
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting || totalItemsCount === 0}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-600/30 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{submitting ? 'Enviando...' : 'Enviar Solicitação de Logística'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
