import React, { useState, useEffect } from 'react';
import { Package, Plus, Search, AlertTriangle, CheckCircle, ArrowDown, ArrowUp, PlusCircle, Filter, PackagePlus, RotateCcw, FileCode } from 'lucide-react';
import { Material } from '../types';
import { api } from '../services/api';
import { QuickEntryModal } from '../components/modals/QuickEntryModal';
import { NewMaterialModal } from '../components/modals/NewMaterialModal';
import { NewReturnModal } from '../components/modals/NewReturnModal';
import { XmlInvoiceModal } from '../components/modals/XmlInvoiceModal';

export const MaterialsPage: React.FC = () => {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [categories, setCategories] = useState<{ category: string; count: number }[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [onlyBelowMin, setOnlyBelowMin] = useState(false);
  const [loading, setLoading] = useState(true);

  const [isXmlModalOpen, setIsXmlModalOpen] = useState(false);
  const [isQuickEntryOpen, setIsQuickEntryOpen] = useState(false);
  const [isNewMaterialModalOpen, setIsNewMaterialModalOpen] = useState(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [selectedMaterialId, setSelectedMaterialId] = useState<number | undefined>(undefined);

  const fetchCategories = async () => {
    try {
      const data = await api.getMaterialCategories();
      setCategories(data);
    } catch (err) {
      console.error('Erro ao buscar categorias:', err);
    }
  };

  const fetchMaterials = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
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

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchMaterials();
  }, [selectedCategory, onlyBelowMin]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchMaterials();
  };

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
            Cadastro mestre de materiais e controle de estoque simplificado
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
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

      {/* Filters & Search */}
      <div className="bg-dark-900 p-3.5 sm:p-4 rounded-3xl border border-dark-750 shadow-md space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pesquisar por código (ex: SAB-0001), nome, marca ou categoria..."
              className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl border border-dark-700 focus:outline-none focus:ring-2 focus:ring-sabrar-500 text-white bg-dark-850 placeholder-slate-500"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-sabrar-600 hover:bg-sabrar-500 text-white text-xs font-bold transition-colors shrink-0 shadow-sm"
          >
            Buscar
          </button>
        </form>

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

          <label className="flex items-center gap-1.5 ml-auto text-rose-400 font-bold shrink-0 cursor-pointer pl-3">
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

      {loading && (
        <div className="py-16 text-center text-sm text-slate-500">
          Carregando catálogo de materiais SABRAR...
        </div>
      )}

      {/* Materials List / Cards (Mobile-First com estética escura negativa e verde Sabrar) */}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {materials.map((m) => {
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
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-mono font-bold text-sabrar-400 bg-dark-800 border border-dark-700 px-2 py-0.5 rounded">
                      {m.code}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                        isZero
                          ? 'bg-rose-950/60 text-rose-400 border-rose-800/60'
                          : isBelow
                          ? 'bg-amber-950/60 text-amber-400 border-amber-800/60'
                          : 'bg-sabrar-950/70 text-sabrar-400 border-sabrar-500/40'
                      }`}
                    >
                      {isZero ? 'Sem Estoque' : isBelow ? 'Estoque Baixo' : 'Estoque Normal'}
                    </span>
                  </div>

                  <h3 className="font-extrabold text-sm text-white line-clamp-2">
                    {m.name}
                  </h3>
                  <div className="text-[11px] text-slate-400 mt-1">
                    {m.category} • Marca: <span className="font-medium text-slate-300">{m.brand || 'Padrão SABRAR'}</span>
                  </div>
                  {m.description && (
                    <div className="text-[11px] text-teal-400/90 font-medium mt-1.5 line-clamp-2 bg-dark-850/80 rounded-xl px-2.5 py-1 border border-dark-700/60">
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
                        <span key={idx} className="bg-dark-800 text-slate-300 px-1.5 py-0.5 rounded border border-dark-700/60 font-mono text-[9px]">
                          {syn.trim()}
                        </span>
                      ))}
                      {m.synonyms.split(',').length > 3 && (
                        <span className="text-[9px] text-slate-500">+{m.synonyms.split(',').length - 3}</span>
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
                </div>

                {/* Bottom Card: Reference Price & Quick Entry Action */}
                <div className="mt-4 pt-3 border-t border-dark-750 flex items-center justify-between">
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
            );
          })}
        </div>
      )}

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
    </div>
  );
};

