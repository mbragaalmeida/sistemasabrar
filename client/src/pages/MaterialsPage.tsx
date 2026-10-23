import React, { useState, useEffect, useRef } from 'react';
import { Package, Plus, Search, AlertTriangle, CheckCircle, ArrowDown, ArrowUp, PlusCircle, Filter, PackagePlus, RotateCcw, FileCode, Maximize2, Image as ImageIcon, Camera, Layers, Check, X } from 'lucide-react';
import { Material } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { QuickEntryModal } from '../components/modals/QuickEntryModal';
import { NewMaterialModal } from '../components/modals/NewMaterialModal';
import { NewReturnModal } from '../components/modals/NewReturnModal';
import { XmlInvoiceModal } from '../components/modals/XmlInvoiceModal';
import { MaterialPhotoModal } from '../components/modals/MaterialPhotoModal';
import { AdjustStockModal } from '../components/modals/AdjustStockModal';
import { canUserViewPrices, canCreateMaterial } from '../utils/permissions';

export const MaterialsPage: React.FC = () => {
  const { currentUser } = useAuth();
  const canViewPrices = canUserViewPrices(currentUser);
  const allowCreateMaterial = canCreateMaterial(currentUser);

  const canApproveAdjustment = Boolean(
    currentUser?.role === 'admin' ||
    currentUser?.role === 'orcamento_engenharia' ||
    currentUser?.role === 'compras_solicitacoes' ||
    /sabrina|emily/i.test(currentUser?.name || '') ||
    /sabrina|emily/i.test(currentUser?.email || '')
  );

  const canConfigureMinimumStock = canApproveAdjustment;

  const [materials, setMaterials] = useState<Material[]>([]);
  const [categories, setCategories] = useState<{ category: string; count: number }[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [onlyBelowMin, setOnlyBelowMin] = useState(false);
  const [loading, setLoading] = useState(true);

  // Autocomplete em tempo real
  const [suggestions, setSuggestions] = useState<Material[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionLoading, setSuggestionLoading] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const [isXmlModalOpen, setIsXmlModalOpen] = useState(false);
  const [isQuickEntryOpen, setIsQuickEntryOpen] = useState(false);
  const [isNewMaterialModalOpen, setIsNewMaterialModalOpen] = useState(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [selectedMaterialForAdjust, setSelectedMaterialForAdjust] = useState<Material | null>(null);
  const [pendingAdjustments, setPendingAdjustments] = useState<any[]>([]);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [togglingAvailabilityId, setTogglingAvailabilityId] = useState<number | null>(null);
  const [selectedMaterialId, setSelectedMaterialId] = useState<number | undefined>(undefined);
  const [selectedMaterialForPhoto, setSelectedMaterialForPhoto] = useState<Material | null>(null);
  const [photoFilter, setPhotoFilter] = useState<'todos' | 'com_foto' | 'sem_foto'>('todos');

  const fetchCategories = async () => {
    try {
      const data = await api.getMaterialCategories();
      setCategories(data);
    } catch (err) {
      console.error('Erro ao buscar categorias:', err);
    }
  };

  const fetchMaterials = async (searchOverride?: string) => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      const currentSearch = searchOverride !== undefined ? searchOverride : search;
      if (currentSearch) params.search = currentSearch;
      if (selectedCategory) params.category = selectedCategory;
      if (onlyBelowMin) params.below_minimum = 'true';

      const data = await api.getMaterials(params);
      setMaterials(data);
    } catch (err) {
      console.error('Erro ao buscar materiais:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingAdjustments = async () => {
    try {
      const data = await api.getStockAdjustments('pendente');
      setPendingAdjustments(data || []);
    } catch (err) {
      console.error('Erro ao buscar ajustes pendentes:', err);
    }
  };

  const handleToggleAvailability = async (m: Material) => {
    const nextStatus = m.availability_status === 'em_falta' ? 'disponivel' : 'em_falta';
    setTogglingAvailabilityId(m.id);
    try {
      await api.updateMaterialAvailability(m.id, nextStatus);
      setMaterials(prev => prev.map(item => item.id === m.id ? { ...item, availability_status: nextStatus } : item));
    } catch (err: any) {
      alert(err.message || 'Erro ao alterar disponibilidade');
    } finally {
      setTogglingAvailabilityId(null);
    }
  };

  const handleApproveAdjustment = async (id: number) => {
    if (!window.confirm('Confirma a aprovação deste ajuste de quantidade de estoque?')) return;
    setActionLoadingId(id);
    try {
      await api.approveStockAdjustment(id, currentUser?.id);
      await fetchMaterials();
      await fetchPendingAdjustments();
      alert('Ajuste de estoque aprovado com sucesso!');
    } catch (err: any) {
      alert(err.message || 'Erro ao aprovar ajuste');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRejectAdjustment = async (id: number) => {
    const reason = window.prompt('Informe o motivo da recusa do ajuste:');
    if (!reason || !reason.trim()) return;
    setActionLoadingId(id);
    try {
      await api.rejectStockAdjustment(id, currentUser?.id, reason.trim());
      await fetchPendingAdjustments();
      alert('Ajuste de estoque recusado com sucesso.');
    } catch (err: any) {
      alert(err.message || 'Erro ao recusar ajuste');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Configuração rápida de Estoque Mínimo (Item 5 - Admins, Sabrina e Emily)
  const handleConfigureMinimumStock = async (m: Material) => {
    const current = m.stock_minimum || 0;
    const input = window.prompt(
      `Configurar Estoque Mínimo para reposição:\n\nMaterial: ${m.name}\nUnidade: ${m.unit}\n\nQuando o estoque físico atingir ou ficar abaixo deste valor, o setor de compras será notificado para providenciar compras.\n\nInforme a quantidade mínima de estoque:`,
      String(current)
    );
    if (input === null) return;
    const val = parseFloat(input.replace(',', '.'));
    if (isNaN(val) || val < 0) {
      alert('Por favor, informe uma quantidade válida (maior ou igual a zero).');
      return;
    }
    try {
      await api.updateMaterialMinimumStock(m.id, val, currentUser?.id);
      setMaterials(prev => prev.map(item => item.id === m.id ? { ...item, stock_minimum: val } : item));
      alert(`Estoque mínimo do material "${m.name}" configurado para ${val} ${m.unit} com sucesso!`);
    } catch (err: any) {
      alert(err.message || 'Erro ao configurar estoque mínimo');
    }
  };

  useEffect(() => {
    fetchCategories();
    fetchPendingAdjustments();
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchPendingAdjustments();
    }
  }, [currentUser]);

  useEffect(() => {
    fetchMaterials();
  }, [selectedCategory, onlyBelowMin]);

  // Busca sugestões em tempo real com debounce
  useEffect(() => {
    if (!search || !search.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const timer = setTimeout(async () => {
      setSuggestionLoading(true);
      try {
        const results = await api.autocompleteMaterials(search.trim());
        setSuggestions(results);
        setShowSuggestions(true);
      } catch (err) {
        console.error('Erro no autocomplete:', err);
      } finally {
        setSuggestionLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [search]);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowSuggestions(false);
    fetchMaterials();
  };

  const handleSelectSuggestion = (item: Material) => {
    setSearch(item.name);
    setShowSuggestions(false);
    fetchMaterials(item.name);
  };

  const countWithPhoto = materials.filter(m => Boolean(m.image_url)).length;
  const countWithoutPhoto = materials.length - countWithPhoto;

  const displayedMaterials = materials.filter(m => {
    if (photoFilter === 'com_foto') return Boolean(m.image_url);
    if (photoFilter === 'sem_foto') return !m.image_url;
    return true;
  });

  return (
    <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header com os dois botões: Cadastrar Novo Produto (Solicitação 2) + Entrada Rápida */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-dark-900 p-4 sm:p-5 rounded-3xl border border-dark-750 shadow-xl">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-sabrar-950/70 border border-sabrar-500/40 flex items-center justify-center text-sabrar-400">
              <Package className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Base Central de Materiais
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Catálogo mestre de materiais SABRAR com fotos, sinônimos e controle de estoque
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {allowCreateMaterial && (
            <>
              {/* BOTÃO ENTRADA VIA NF-E (XML) */}
              <button
                onClick={() => setIsXmlModalOpen(true)}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition-all shadow-md shadow-teal-600/30 active:scale-95"
              >
                <FileCode className="w-4 h-4" />
                <span>Entrada via NF-e (XML)</span>
              </button>

              {/* BOTÃO CADASTRAR NOVO PRODUTO (Solicitação 2 do usuário) */}
              <button
                onClick={() => setIsNewMaterialModalOpen(true)}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-sabrar-600 hover:bg-sabrar-500 text-white text-xs font-bold transition-all shadow-lg shadow-sabrar-600/30 active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Cadastrar Novo Produto</span>
              </button>

              {/* BOTÃO REGISTRAR DEVOLUÇÃO */}
              <button
                onClick={() => setIsReturnModalOpen(true)}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-dark-800 hover:bg-dark-750 text-slate-200 border border-dark-700 text-xs font-bold transition-all active:scale-95"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Registrar Devolução</span>
              </button>
            </>
          )}

          {/* BOTÃO ENTRADA RÁPIDA DE ESTOQUE */}
          <button
            onClick={() => {
              setSelectedMaterialId(undefined);
              setIsQuickEntryOpen(true);
            }}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-dark-800 hover:bg-dark-750 text-slate-200 border border-dark-700 text-xs font-bold transition-all active:scale-95"
          >
            <PlusCircle className="w-4 h-4 text-sabrar-400" />
            <span>Entrada Rápida</span>
          </button>
        </div>
      </div>

      {/* Banner / Card de Ajustes de Saldo de Estoque Aguardando Aprovação (Item 9) */}
      {pendingAdjustments.length > 0 && (
        <div className="bg-white dark:bg-dark-900 border-2 border-amber-400 dark:border-amber-500/50 rounded-3xl p-4 sm:p-5 shadow-lg shadow-amber-500/5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-100 dark:border-amber-500/20 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-500/20 border border-amber-300 dark:border-amber-500/40 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                <AlertTriangle className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span>{pendingAdjustments.length} solicitação(ões) de correção de estoque aguardando aprovação</span>
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  Alterações manuais de quantidade propostas pela equipe que requerem autorização dos Administradores, Sabrina ou Emily.
                </p>
              </div>
            </div>

            <div className="self-start sm:self-center shrink-0">
              {canApproveAdjustment ? (
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-black bg-amber-50 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40 shadow-xs">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
                  Aprovação Autorizada (Admin / Sabrina / Emily)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-slate-100 dark:bg-dark-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-dark-700">
                  Aguardando Análise da Gestão
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {pendingAdjustments.map((adj) => {
              const diff = Number(adj.difference || 0);
              const isDiffPositive = diff > 0;
              const isLoading = actionLoadingId === adj.id;

              return (
                <div
                  key={adj.id}
                  className="bg-slate-50 hover:bg-slate-100/80 dark:bg-dark-850 dark:hover:bg-dark-800 p-3.5 sm:p-4 rounded-2xl border border-slate-200 dark:border-dark-750 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 transition-all"
                >
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white truncate">
                        {adj.material_name}
                      </span>
                      <span className="font-mono text-xs font-bold text-slate-700 dark:text-amber-400 bg-white dark:bg-dark-900 px-2 py-0.5 rounded-lg border border-slate-200 dark:border-dark-700">
                        {adj.material_code}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                        ({adj.material_unit || 'und'})
                      </span>
                    </div>

                    <div className="flex items-center gap-2.5 flex-wrap text-xs">
                      <span className="bg-white dark:bg-dark-900 text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-dark-700">
                        Estoque Atual: <strong className="text-slate-900 dark:text-white font-black">{adj.previous_stock}</strong>
                      </span>
                      <span className="text-amber-500 font-bold">➔</span>
                      <span className="bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 px-2.5 py-1 rounded-xl border border-amber-200 dark:border-amber-700/60 font-semibold">
                        Novo Saldo Proposto: <strong className="text-amber-950 dark:text-amber-100 font-black">{adj.requested_stock}</strong>
                      </span>
                      <span className={`px-2.5 py-1 rounded-xl font-black text-xs ${
                        isDiffPositive
                          ? 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/60'
                          : 'bg-rose-50 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-700/60'
                      }`}>
                        {isDiffPositive ? `+${diff}` : diff} {adj.material_unit || 'und'}
                      </span>
                    </div>

                    <div className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-2 flex-wrap pt-0.5">
                      <span>
                        Solicitado por: <strong className="text-slate-900 dark:text-slate-200 font-bold">{adj.requested_by_name || adj.requester_name || 'Almoxarifado'}</strong>
                      </span>
                      <span>•</span>
                      <span>
                        Motivo: <span className="text-slate-800 dark:text-slate-200 font-medium italic bg-white dark:bg-dark-900 px-2 py-0.5 rounded-lg border border-slate-200 dark:border-dark-750">"{adj.reason}"</span>
                      </span>
                      {adj.created_at && (
                        <>
                          <span>•</span>
                          <span className="text-slate-500 dark:text-slate-400 font-medium">
                            {new Date(adj.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {canApproveAdjustment ? (
                    <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={() => handleApproveAdjustment(adj.id)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all shadow-md shadow-emerald-600/30 disabled:opacity-50 active:scale-95 cursor-pointer"
                      >
                        <Check className="w-4 h-4" />
                        <span>{isLoading ? 'Aprovando...' : 'Aprovar Ajuste'}</span>
                      </button>
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={() => handleRejectAdjustment(adj.id)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-all shadow-md shadow-rose-600/30 disabled:opacity-50 active:scale-95 cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                        <span>{isLoading ? 'Recusando...' : 'Recusar'}</span>
                      </button>
                    </div>
                  ) : (
                    <div className="text-xs text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-600/30 px-3 py-1.5 rounded-xl shrink-0 self-start md:self-center font-medium">
                      Aguardando aprovação de Admin, Sabrina ou Emily
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters & Search */}
      <div className="bg-dark-900 p-3.5 sm:p-4 rounded-3xl border border-dark-750 shadow-md space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
          <div className="relative flex-1" ref={searchContainerRef}>
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 z-10" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => {
                if (suggestions.length > 0) setShowSuggestions(true);
              }}
              placeholder="Pesquisar por nome, sinônimo/apelido, código (ex: SAB-0001)..."
              className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl border border-dark-700 focus:outline-none focus:ring-2 focus:ring-sabrar-500 text-white bg-dark-850 placeholder-slate-500"
            />

            {/* Dropdown de Autocomplete em Tempo Real */}
            {showSuggestions && search.trim().length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-2 z-50 bg-dark-900 border border-dark-700 rounded-2xl shadow-2xl overflow-hidden max-h-96 overflow-y-auto">
                <div className="p-2.5 bg-dark-850 border-b border-dark-750 flex items-center justify-between text-[11px] font-bold text-slate-400">
                  <span>
                    {suggestionLoading ? 'Buscando opções...' : `${suggestions.length} material(is) encontrado(s)`}
                  </span>
                  <span className="text-slate-500 text-[10px]">Clique para selecionar ou aperte Enter</span>
                </div>

                {suggestions.length === 0 && !suggestionLoading && (
                  <div className="p-4 text-center text-xs text-slate-400">
                    Nenhum material encontrado com "{search}".
                  </div>
                )}

                <div className="divide-y divide-dark-800">
                  {suggestions.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleSelectSuggestion(item)}
                      className="p-3 hover:bg-dark-800 transition-colors cursor-pointer flex items-center justify-between gap-3 group"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {/* Foto Thumbnail */}
                        <div className="w-10 h-10 rounded-xl bg-dark-800 border border-dark-700 overflow-hidden flex items-center justify-center shrink-0">
                          {item.image_url ? (
                            <img
                              src={item.image_url}
                              alt={item.name}
                              className="w-full h-full object-contain p-0.5 group-hover:scale-105 transition-transform"
                            />
                          ) : (
                            <Package className="w-5 h-5 text-slate-500" />
                          )}
                        </div>

                        {/* Detalhes */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono text-[11px] font-bold text-sabrar-400 bg-dark-800 border border-dark-700 px-1.5 py-0.2 rounded">
                              {item.code}
                            </span>
                            <span className="text-[10px] font-semibold text-slate-400 bg-dark-850 border border-dark-750 px-1.5 py-0.2 rounded">
                              {item.category}
                            </span>
                            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-1.5 py-0.2 rounded">
                              {item.unit}
                            </span>
                          </div>
                          <div className="text-xs font-bold text-white group-hover:text-sabrar-300 transition-colors truncate mt-0.5">
                            {item.name}
                          </div>
                          {item.synonyms && (
                            <div className="text-[10px] text-slate-400 italic truncate">
                              Sinônimos: {item.synonyms}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Preço e Estoque */}
                      <div className="text-right shrink-0">
                        {canViewPrices && (
                          <div className="text-xs font-black text-sabrar-400">
                            R$ {Number(item.reference_price || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        )}
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Estoque: {item.stock_available ?? item.stock_physical ?? 0} {item.unit}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-sabrar-600 hover:bg-sabrar-500 text-white text-xs font-bold transition-colors shrink-0 shadow-sm active:scale-95"
          >
            Buscar
          </button>
        </form>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          {/* Categorias */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            <div className="flex items-center gap-1 text-slate-400 font-semibold shrink-0">
              <Filter className="w-3.5 h-3.5 text-sabrar-400" />
              <span>Categorias:</span>
            </div>

            <button
              onClick={() => setSelectedCategory('')}
              className={`px-3 py-1 rounded-xl font-medium whitespace-nowrap transition-colors ${
                selectedCategory === ''
                  ? 'bg-sabrar-600 text-white font-bold shadow-md shadow-sabrar-600/30'
                  : 'bg-dark-800 text-slate-300 hover:bg-dark-750 border border-dark-700'
              }`}
            >
              Todas
            </button>

            {categories.map((c) => (
              <button
                key={c.category}
                onClick={() => setSelectedCategory(c.category)}
                className={`px-3 py-1 rounded-xl font-medium whitespace-nowrap transition-colors ${
                  selectedCategory === c.category
                    ? 'bg-sabrar-600 text-white font-bold shadow-md shadow-sabrar-600/30'
                    : 'bg-dark-800 text-slate-300 hover:bg-dark-750 border border-dark-700'
                }`}
              >
                {c.category} <span className="text-[10px] opacity-70">({c.count})</span>
              </button>
            ))}
          </div>

          {/* Filtros Auxiliares: Fotos e Estoque Baixo */}
          <div className="flex items-center gap-3 shrink-0 flex-wrap sm:flex-nowrap sm:ml-auto">
            {/* Filtro de Fotos */}
            <div className="flex items-center bg-dark-850 p-1 rounded-2xl border border-dark-700 text-xs shrink-0">
              <button
                type="button"
                onClick={() => setPhotoFilter('todos')}
                className={`px-2.5 py-1 rounded-xl font-bold transition-all ${
                  photoFilter === 'todos'
                    ? 'bg-sabrar-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Todos ({materials.length})
              </button>
              <button
                type="button"
                onClick={() => setPhotoFilter('com_foto')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-xl font-bold transition-all ${
                  photoFilter === 'com_foto'
                    ? 'bg-sabrar-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Filtrar materiais que possuem foto cadastrada"
              >
                <ImageIcon className="w-3.5 h-3.5 text-teal-400" />
                <span>Com Foto ({countWithPhoto})</span>
              </button>
              <button
                type="button"
                onClick={() => setPhotoFilter('sem_foto')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-xl font-bold transition-all ${
                  photoFilter === 'sem_foto'
                    ? 'bg-sabrar-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Filtrar materiais sem foto cadastrada"
              >
                <span>Sem Foto ({countWithoutPhoto})</span>
              </button>
            </div>

            <label className="flex items-center gap-1.5 text-rose-400 font-bold shrink-0 cursor-pointer">
              <input
                type="checkbox"
                checked={onlyBelowMin}
                onChange={(e) => setOnlyBelowMin(e.target.checked)}
                className="rounded bg-dark-800 border-dark-700 text-rose-500 focus:ring-rose-500"
              />
              <span>Apenas Estoque Baixo</span>
            </label>
          </div>
        </div>
      </div>

      {loading && (
        <div className="py-16 text-center text-sm text-slate-500">
          Carregando catálogo de materiais SABRAR...
        </div>
      )}

      {/* Materials List / Cards (Mobile-First com estética escura negativa e verde Sabrar) */}
      {!loading && displayedMaterials.length === 0 && (
        <div className="py-16 text-center text-sm text-slate-500 bg-dark-900 rounded-3xl border border-dark-750 p-8">
          <Package className="w-10 h-10 mx-auto text-slate-600 mb-2 stroke-[1.5]" />
          <p className="font-bold text-slate-300">Nenhum material encontrado</p>
          <p className="text-xs text-slate-500 mt-1">Tente ajustar os termos de busca ou filtros de categoria e fotos.</p>
        </div>
      )}

      {!loading && displayedMaterials.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {displayedMaterials.map((m) => {
            const isBelow = m.stock_physical <= m.stock_minimum;
            const isZero = m.stock_physical === 0;

            const formatPrice = (value: number | undefined | null) => {
              if (value === undefined || value === null || isNaN(value)) return '0,00';
              const val = Number(value);
              const hasMoreDecimals = Math.abs(Math.round(val * 100) - val * 100) > 0.0001;
              return val.toLocaleString('pt-BR', {
                minimumFractionDigits: hasMoreDecimals ? 3 : 2,
                maximumFractionDigits: 4,
              });
            };

            return (
              <div
                key={m.id}
                className="bg-dark-900 rounded-3xl border border-dark-750 p-4 hover:border-sabrar-500/50 hover:shadow-xl hover:shadow-sabrar-950/20 transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Topo do Card com Foto Thumbnail e Metadados */}
                  <div className="flex gap-3 items-start mb-2.5">
                    {/* Thumbnail da Foto */}
                    <div 
                      onClick={() => setSelectedMaterialForPhoto(m)}
                      className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-dark-950 border border-dark-700 hover:border-sabrar-500/60 overflow-hidden shrink-0 flex items-center justify-center cursor-pointer group relative shadow-md"
                      title="Clique para visualizar em alta resolução ou editar sinônimos"
                    >
                      {m.image_url ? (
                        <img
                          src={m.image_url}
                          alt={m.name}
                          className="w-full h-full object-contain p-1 group-hover:scale-110 transition-transform duration-200"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-slate-600 group-hover:text-sabrar-400 transition-colors p-1">
                          <Camera className="w-5 h-5 stroke-[1.5]" />
                          <span className="text-[8px] font-bold mt-0.5 opacity-80 uppercase">+ foto</span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-[10px] font-bold">
                        <Maximize2 className="w-4 h-4 text-white drop-shadow" />
                      </div>
                    </div>

                    {/* Código, Status e Nome */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-xs font-mono font-bold text-sabrar-400 bg-dark-800 border border-dark-700 px-2 py-0.5 rounded">
                          {m.code}
                        </span>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {/* Toggle de Disponibilidade Almoxarifado (Item 10) */}
                          <button
                            type="button"
                            onClick={() => handleToggleAvailability(m)}
                            disabled={togglingAvailabilityId === m.id}
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all active:scale-95 flex items-center gap-1 cursor-pointer ${
                              m.availability_status === 'em_falta'
                                ? 'bg-rose-950/80 text-rose-300 border-rose-700/60 hover:bg-rose-900'
                                : 'bg-emerald-950/70 text-emerald-300 border-emerald-600/40 hover:bg-emerald-900'
                            }`}
                            title="Clique para alternar disponibilidade (Disponível / Em Falta)"
                          >
                            {m.availability_status === 'em_falta' ? (
                              <>
                                <AlertTriangle className="w-3 h-3 text-rose-400" />
                                <span>Em Falta</span>
                              </>
                            ) : (
                              <>
                                <CheckCircle className="w-3 h-3 text-emerald-400" />
                                <span>Disponível</span>
                              </>
                            )}
                          </button>

                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              isZero
                                ? 'bg-rose-950/60 text-rose-400 border-rose-800/60'
                                : isBelow
                                ? 'bg-amber-950/60 text-amber-400 border-amber-800/60'
                                : 'bg-sabrar-950/70 text-sabrar-400 border-sabrar-500/40'
                            }`}
                          >
                            {isZero ? 'Sem Estoque' : isBelow ? 'Estoque Baixo' : 'Normal'}
                          </span>
                        </div>
                      </div>

                      <h3 
                        onClick={() => setSelectedMaterialForPhoto(m)}
                        className="font-extrabold text-sm text-white line-clamp-2 hover:text-sabrar-300 cursor-pointer transition-colors"
                        title={m.name}
                      >
                        {m.name}
                      </h3>
                      <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                        {m.category} {m.brand ? `• ${m.brand}` : ''}
                      </div>
                    </div>
                  </div>

                  {m.description && (
                    <div className="text-[11px] text-teal-400/90 font-medium mt-1 line-clamp-2 bg-dark-850/80 rounded-xl px-2.5 py-1 border border-dark-700/60">
                      {m.description}
                    </div>
                  )}

                  {/* Alerta de Validação Pendente (Status VALIDAR) */}
                  {m.validation_status === 'VALIDAR' && (
                    <div className="mt-2 p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] flex items-start gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">Atenção:</span> {m.pending_notes || 'Item pendente de validação com a engenharia.'}
                      </div>
                    </div>
                  )}

                  {/* Peso Linear (ex: Tubos de Cobre) */}
                  {m.linear_weight != null && (
                    <div className="mt-1.5 text-[11px] text-cyan-400 font-mono flex items-center gap-1">
                      <span>⚖️ Peso linear: {m.linear_weight} {m.linear_weight_unit || 'kg/m'}</span>
                    </div>
                  )}

                  {/* Sinônimos */}
                  {m.synonyms && (
                    <div className="mt-2 flex flex-wrap items-center gap-1 text-[10px]">
                      <span className="text-slate-500 font-semibold">Sinônimos:</span>
                      {m.synonyms.split(',').slice(0, 3).map((syn, idx) => (
                        <span key={idx} className="bg-dark-800 text-teal-300/90 px-1.5 py-0.5 rounded border border-dark-700 font-mono text-[9px]">
                          {syn.trim()}
                        </span>
                      ))}
                      {m.synonyms.split(',').length > 3 && (
                        <button
                          type="button"
                          onClick={() => setSelectedMaterialForPhoto(m)}
                          className="text-[9px] text-sabrar-400 hover:underline font-bold"
                        >
                          +{m.synonyms.split(',').length - 3} mais
                        </button>
                      )}
                    </div>
                  )}

                  {/* Diagnóstico de Estoque: Físico, Reservado, Disponível */}
                  <div className="mt-3 grid grid-cols-3 gap-1.5 p-2.5 rounded-2xl bg-dark-850 border border-dark-700 text-center">
                    <div>
                      <div className="text-[9px] uppercase font-bold text-slate-500">Físico</div>
                      <div className="font-black text-xs text-white">{m.stock_physical} {m.unit}</div>
                    </div>
                    <div>
                      <div className="text-[9px] uppercase font-bold text-slate-500">Reservado</div>
                      <div className="font-bold text-xs text-amber-400">{m.stock_reserved} {m.unit}</div>
                    </div>
                    <div>
                      <div className="text-[9px] uppercase font-bold text-slate-500">Disponível</div>
                      <div className="font-black text-xs text-sabrar-400">{m.stock_available} {m.unit}</div>
                    </div>
                  </div>

                  {/* Configuração & Alerta de Estoque Mínimo (Item 5) */}
                  <div className="mt-2 flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-dark-850/80 border border-dark-700/80 text-xs">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] text-slate-400 font-semibold uppercase">Estoque Mínimo:</span>
                      <span className="font-bold text-white font-mono">{m.stock_minimum || 0} {m.unit}</span>
                      {Number(m.stock_minimum) > 0 && Number(m.stock_physical) <= Number(m.stock_minimum) && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-rose-950 text-rose-300 border border-rose-700 animate-pulse">
                          Atingido!
                        </span>
                      )}
                    </div>
                    {canConfigureMinimumStock && (
                      <button
                        type="button"
                        onClick={() => handleConfigureMinimumStock(m)}
                        className="text-[10px] font-bold text-sabrar-400 hover:text-sabrar-300 bg-sabrar-950/60 hover:bg-sabrar-900 border border-sabrar-500/40 px-2 py-0.5 rounded-lg transition-colors cursor-pointer active:scale-95"
                        title="Configurar estoque mínimo deste material (Apenas Admins, Sabrina e Emily)"
                      >
                        ⚙️ Alterar Mínimo
                      </button>
                    )}
                  </div>
                </div>

                {/* Bottom Card: Reference Price & Quick Entry Action */}
                <div className="mt-4 pt-3 border-t border-dark-750 flex items-center justify-between">
                  {canViewPrices ? (
                    <div>
                      <div className="text-[10px] text-slate-400 font-semibold uppercase">Preço Referência</div>
                      <div className="font-extrabold text-xs sm:text-sm text-white">
                        R$ {formatPrice(Number(m.reference_price))} <span className="text-[10px] text-slate-500 font-normal">/{m.unit}</span>
                      </div>
                      {m.converted_price != null && m.converted_unit && (
                        <div className="text-[10px] text-teal-400 font-semibold mt-0.5">
                          ≈ R$ {formatPrice(Number(m.converted_price))}/{m.converted_unit}
                          {m.package_content ? ` (emb. ${m.package_content} ${m.converted_unit})` : ''}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <div className="text-[10px] text-slate-400 font-semibold uppercase">Unidade Padrão</div>
                      <div className="font-bold text-xs text-slate-300 mt-0.5">
                        {m.unit} {m.stock_minimum > 0 ? `• Mín: ${m.stock_minimum}` : ''}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedMaterialForAdjust(m);
                        setIsAdjustModalOpen(true);
                      }}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-950/60 hover:bg-amber-900 border border-amber-700/50 text-amber-300 text-xs font-bold transition-colors active:scale-95"
                      title="Corrigir quantidade deste material no estoque"
                    >
                      <Layers className="w-3.5 h-3.5 text-amber-400" />
                      <span>Ajustar</span>
                    </button>

                    <button
                      onClick={() => {
                        setSelectedMaterialId(m.id);
                        setIsQuickEntryOpen(true);
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-sabrar-950/80 hover:bg-sabrar-900 border border-sabrar-500/40 text-sabrar-300 text-xs font-bold transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5 text-sabrar-400" />
                      <span>+ Entrada</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Foto e Sinônimos em Alta Resolução */}
      <MaterialPhotoModal
        isOpen={Boolean(selectedMaterialForPhoto)}
        material={selectedMaterialForPhoto}
        onClose={() => setSelectedMaterialForPhoto(null)}
        onSuccess={() => fetchMaterials()}
      />

      {/* Modal de Cadastro de Novo Produto (Solicitação 2) */}
      <NewMaterialModal
        isOpen={isNewMaterialModalOpen}
        onClose={() => setIsNewMaterialModalOpen(false)}
        onSuccess={() => fetchMaterials()}
      />

      {/* Modal de Entrada Simplificada */}
      <QuickEntryModal
        isOpen={isQuickEntryOpen}
        onClose={() => setIsQuickEntryOpen(false)}
        preselectedMaterialId={selectedMaterialId}
        onSuccess={() => fetchMaterials()}
      />

      {/* Modal de Devolução */}
      <NewReturnModal
        isOpen={isReturnModalOpen}
        onClose={() => setIsReturnModalOpen(false)}
        onSuccess={() => fetchMaterials()}
      />

      {/* Modal de Entrada via NF-e XML */}
      <XmlInvoiceModal
        isOpen={isXmlModalOpen}
        onClose={() => setIsXmlModalOpen(false)}
        onSuccess={() => fetchMaterials()}
      />

      {/* Modal de Ajuste de Saldo de Estoque */}
      <AdjustStockModal
        isOpen={isAdjustModalOpen}
        onClose={() => {
          setIsAdjustModalOpen(false);
          setSelectedMaterialForAdjust(null);
        }}
        material={selectedMaterialForAdjust}
        onSuccess={() => {
          fetchMaterials();
          fetchPendingAdjustments();
        }}
      />
    </div>
  );
};

