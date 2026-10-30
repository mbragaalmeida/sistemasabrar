import React, { useState, useEffect } from 'react';
import { PlusCircle, Trash2, X, AlertTriangle, Layers, Calendar, Package, Search } from 'lucide-react';
import { api } from '../../services/api';
import { parsePackageInfo, getUnitOptions, convertQuantity, COMMON_UNITS, PackageInfo, UnitOption } from '../../utils/unitConverter';
import { Material } from '../../types';

interface NewAddendumModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: number;
  nextNumber: number;
  onSuccess: () => void;
}

interface AddendumItemRow {
  material_id?: number | null;
  code?: string;
  material_name: string;
  quantity: number;
  unit: string;
  pkg_info?: PackageInfo;
  unit_options?: UnitOption[];
  suggestions?: Material[];
  loading_suggestions?: boolean;
}

interface AddendumServiceRow {
  service_name: string;
  quantity: number;
  unit: string;
}

export const NewAddendumModal: React.FC<NewAddendumModalProps> = ({
  isOpen,
  onClose,
  projectId,
  nextNumber,
  onSuccess
}) => {
  const [title, setTitle] = useState(`Aditivo ${nextNumber}`);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('');
  const [items, setItems] = useState<AddendumItemRow[]>([
    {
      material_id: null,
      code: '',
      material_name: '',
      quantity: 1,
      unit: 'un',
      suggestions: [],
      loading_suggestions: false
    }
  ]);
  const [services, setServices] = useState<AddendumServiceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  // Busca inteligente de materiais da base para uma linha específica
  const handleMaterialSearch = async (idx: number, query: string) => {
    setItems((prev) => {
      const next = [...prev];
      next[idx] = {
        ...next[idx],
        material_name: query,
        loading_suggestions: query.trim().length >= 2
      };
      return next;
    });

    if (query.trim().length < 2) {
      setItems((prev) => {
        const next = [...prev];
        next[idx] = { ...next[idx], suggestions: [], loading_suggestions: false };
        return next;
      });
      return;
    }

    try {
      const results = await api.autocompleteMaterials(query.trim());
      setItems((prev) => {
        const next = [...prev];
        if (next[idx]) {
          next[idx] = {
            ...next[idx],
            suggestions: results || [],
            loading_suggestions: false
          };
        }
        return next;
      });
    } catch (err) {
      console.error('[Addendum Autocomplete Error]', err);
      setItems((prev) => {
        const next = [...prev];
        if (next[idx]) {
          next[idx] = { ...next[idx], loading_suggestions: false };
        }
        return next;
      });
    }
  };

  // Seleção de um material da base pelo usuário
  const handleSelectMaterial = (idx: number, mat: Material) => {
    const pkg = parsePackageInfo(mat);
    const opts = getUnitOptions(mat);
    const initialUnit = mat.unit || opts[0]?.value || 'un';

    setItems((prev) => {
      const next = [...prev];
      next[idx] = {
        ...next[idx],
        material_id: mat.id,
        code: mat.code,
        material_name: mat.name,
        unit: initialUnit,
        pkg_info: pkg,
        unit_options: opts,
        suggestions: [],
        loading_suggestions: false
      };
      return next;
    });
  };

  // Conversão automática de unidades
  const handleUnitChange = (idx: number, newUnit: string) => {
    setItems((prev) => {
      const next = [...prev];
      const item = next[idx];
      const oldUnit = item.unit || 'un';
      const currentQty = Number(item.quantity) || 1;
      const convertedQty = convertQuantity(currentQty, oldUnit, newUnit, item.pkg_info);

      next[idx] = {
        ...item,
        unit: newUnit,
        quantity: convertedQty
      };
      return next;
    });
  };

  const handleQuantityChange = (idx: number, val: any) => {
    setItems((prev) => {
      const next = [...prev];
      next[idx] = {
        ...next[idx],
        quantity: Math.max(0, parseFloat(val) || 0)
      };
      return next;
    });
  };

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        material_id: null,
        code: '',
        material_name: '',
        quantity: 1,
        unit: 'un',
        suggestions: [],
        loading_suggestions: false
      }
    ]);
  };

  const handleRemoveItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  // Serviços adicionais
  const handleServiceChange = (idx: number, field: keyof AddendumServiceRow, val: any) => {
    setServices((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: val };
      return next;
    });
  };

  const handleAddService = () => {
    setServices((prev) => [
      ...prev,
      { service_name: '', quantity: 1, unit: 'vb' }
    ]);
  };

  const handleRemoveService = (idx: number) => {
    setServices((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Por favor, informe o título do aditivo.');
      return;
    }
    if (!description.trim()) {
      setError('Por favor, registre a descrição completa do levantamento deste aditivo.');
      return;
    }

    const validItems = items
      .filter((it) => it.material_name.trim().length > 0)
      .map((it) => ({
        material_id: it.material_id,
        code: it.code || '',
        material_name: it.material_name.trim(),
        quantity: Number(it.quantity) || 1,
        unit: it.unit || 'un'
      }));

    const validServices = services
      .filter((s) => s.service_name.trim().length > 0)
      .map((s) => ({
        service_name: s.service_name.trim(),
        quantity: Number(s.quantity) || 1,
        unit: s.unit || 'vb'
      }));

    try {
      setLoading(true);
      setError('');
      await api.createProjectAddendum(projectId, {
        number: nextNumber,
        title: title.trim(),
        description: description.trim(),
        date,
        total_materials: 0,
        total_services: 0,
        total_final: 0,
        items: validItems,
        services: validServices
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao cadastrar aditivo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-dark-900 border border-dark-750 rounded-3xl w-full max-w-4xl max-h-[90vh] shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-dark-800 flex items-center justify-between bg-dark-850">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-sabrar-500/20 text-sabrar-400 border border-sabrar-500/30">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Cadastrar Aditivo de Obra (Aditivo {nextNumber})</h2>
              <p className="text-xs text-slate-400">
                Registra novo escopo complementar sem alterar ou sobrescrever o levantamento original
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-dark-750 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-1">
              <label className="text-xs font-bold text-slate-300">
                Título do Aditivo <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Aditivo 1 - Modificação de Pontos Elétricos e Drywall"
                className="w-full px-4 py-2.5 bg-dark-800 border border-dark-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sabrar-500"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-300">
                Data do Levantamento do Aditivo <span className="text-rose-400">*</span>
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-4 py-2.5 bg-dark-800 border border-dark-700 rounded-xl text-xs text-white focus:outline-none focus:border-sabrar-500"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300">
              Descrição Completa do Levantamento do Aditivo <span className="text-rose-400">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva detalhadamente o que motivou o aditivo, escopo adicionado em campo ou solicitado pelo cliente, memória de cálculo e observações técnicas..."
              rows={4}
              className="w-full px-4 py-3 bg-dark-800 border border-dark-700 rounded-2xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sabrar-500 resize-none"
              required
            />
          </div>

          {/* Materiais do Aditivo com Busca Inteligente na Base e Conversão de Unidades */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-sabrar-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Materiais Adicionais deste Aditivo ({items.length})
                </h3>
              </div>
              <button
                type="button"
                onClick={handleAddItem}
                className="flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-sabrar-300 bg-sabrar-950/80 border border-sabrar-500/40 rounded-xl hover:bg-sabrar-900 transition-colors"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Adicionar Material</span>
              </button>
            </div>

            <div className="space-y-2.5">
              {items.map((it, idx) => {
                const availableUnits = it.unit_options && it.unit_options.length > 0
                  ? it.unit_options.map(o => o.value)
                  : Array.from(new Set([it.unit || 'un', 'un', 'und', 'm', 'kg', 'cx', 'par', 'pc', 'rl', 'l', 'vb']));

                return (
                  <div key={idx} className="relative bg-dark-850 p-3 rounded-2xl border border-dark-750 space-y-2">
                    <div className="grid grid-cols-12 gap-2.5 items-center">
                      {/* Busca / Nome do Material */}
                      <div className="col-span-12 md:col-span-7 relative">
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="Buscar na base SABRAR ou digitar item fora da base..."
                            value={it.material_name}
                            onChange={(e) => handleMaterialSearch(idx, e.target.value)}
                            className="w-full pl-8 pr-3 py-2 bg-dark-800 border border-dark-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sabrar-500"
                          />
                          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                          {it.loading_suggestions && (
                            <span className="absolute right-2.5 top-2.5 text-[10px] text-slate-400 animate-pulse">
                              Buscando...
                            </span>
                          )}
                        </div>

                        {/* Dropdown de Busca Inteligente de Materiais da Base */}
                        {it.suggestions && it.suggestions.length > 0 && (
                          <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-dark-850 border border-dark-700 rounded-2xl shadow-2xl max-h-56 overflow-y-auto divide-y divide-dark-800">
                            <div className="px-3 py-1.5 bg-dark-800 text-[10px] font-bold text-slate-400 flex items-center justify-between sticky top-0 z-10">
                              <span>{it.suggestions.length} opções encontradas na base oficial SABRAR</span>
                              <button
                                type="button"
                                onClick={() => {
                                  const next = [...items];
                                  next[idx].suggestions = [];
                                  setItems(next);
                                }}
                                className="hover:text-white"
                              >
                                ✕
                              </button>
                            </div>
                            {it.suggestions.map((mat) => (
                              <div
                                key={mat.id}
                                onClick={() => handleSelectMaterial(idx, mat)}
                                className="p-2.5 hover:bg-dark-750 cursor-pointer text-xs transition-colors"
                              >
                                <div className="flex items-center gap-2">
                                  {mat.code && (
                                    <span className="font-mono text-[10px] font-bold text-sabrar-400 bg-sabrar-950/80 px-1.5 py-0.5 rounded border border-sabrar-500/40">
                                      {mat.code}
                                    </span>
                                  )}
                                  <span className="font-bold text-white">{mat.name}</span>
                                  <span className="text-[10px] text-emerald-400 font-semibold">({mat.unit})</span>
                                </div>
                                <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-3">
                                  {mat.category && <span>Categoria: <strong>{mat.category}</strong></span>}
                                  {mat.brand && <span>Marca: {mat.brand}</span>}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Quantidade */}
                      <div className="col-span-6 md:col-span-2">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          placeholder="Qtd"
                          value={it.quantity}
                          onChange={(e) => handleQuantityChange(idx, e.target.value)}
                          className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-xl text-xs text-white text-center font-bold focus:outline-none focus:border-sabrar-500"
                        />
                      </div>

                      {/* Unidade com Conversão Automática */}
                      <div className="col-span-5 md:col-span-2">
                        <select
                          value={it.unit}
                          onChange={(e) => handleUnitChange(idx, e.target.value)}
                          className="w-full px-2.5 py-2 bg-dark-800 border border-dark-700 rounded-xl text-xs text-white uppercase font-bold focus:outline-none focus:border-sabrar-500 cursor-pointer"
                        >
                          {availableUnits.map((u) => (
                            <option key={u} value={u} className="bg-dark-900 text-white">
                              {u.toUpperCase()}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Excluir Linha */}
                      <div className="col-span-1 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          disabled={items.length === 1}
                          className="p-2 text-slate-500 hover:text-rose-400 disabled:opacity-30 rounded-lg hover:bg-dark-800 transition-colors"
                          title="Remover material"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Badge informativo de item vinculado ao catálogo */}
                    {it.code && (
                      <div className="text-[10px] text-slate-400 flex items-center gap-2 pl-1">
                        <span className="font-semibold text-sabrar-400">Item da base:</span>
                        <span>Código SABRAR: <strong>{it.code}</strong></span>
                        {it.pkg_info?.hasPackage && (
                          <span className="text-emerald-400">
                            • Embalagem: {it.pkg_info.packageMultiplier} {it.pkg_info.fractionalUnit} por {it.pkg_info.standardUnit}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Serviços do Aditivo (Opcional - Sem preços) */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Serviços / Mão de Obra do Aditivo (Opcional)
              </h3>
              <button
                type="button"
                onClick={handleAddService}
                className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-slate-300 bg-dark-800 border border-dark-700 rounded-xl hover:text-white hover:bg-dark-750 transition-colors"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Adicionar Serviço</span>
              </button>
            </div>

            {services.map((sv, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 bg-dark-850 p-2.5 rounded-xl border border-dark-750 items-center">
                <div className="col-span-12 md:col-span-7">
                  <input
                    type="text"
                    placeholder="Descrição do serviço / mão de obra..."
                    value={sv.service_name}
                    onChange={(e) => handleServiceChange(idx, 'service_name', e.target.value)}
                    className="w-full px-3 py-1.5 bg-dark-800 border border-dark-700 rounded-lg text-xs text-white focus:outline-none focus:border-sabrar-500"
                  />
                </div>
                <div className="col-span-6 md:col-span-2">
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="Qtd"
                    value={sv.quantity}
                    onChange={(e) => handleServiceChange(idx, 'quantity', e.target.value)}
                    className="w-full px-3 py-1.5 bg-dark-800 border border-dark-700 rounded-lg text-xs text-white text-center focus:outline-none focus:border-sabrar-500"
                  />
                </div>
                <div className="col-span-5 md:col-span-2">
                  <input
                    type="text"
                    placeholder="Un (ex: vb, h)"
                    value={sv.unit}
                    onChange={(e) => handleServiceChange(idx, 'unit', e.target.value)}
                    className="w-full px-2 py-1.5 bg-dark-800 border border-dark-700 rounded-lg text-xs text-white text-center uppercase focus:outline-none focus:border-sabrar-500"
                  />
                </div>
                <div className="col-span-1 text-center">
                  <button
                    type="button"
                    onClick={() => handleRemoveService(idx)}
                    className="p-1 text-slate-500 hover:text-rose-400"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Resumo Quantitativo sem Preços */}
          <div className="p-3.5 rounded-2xl bg-dark-850 border border-dark-750 flex items-center justify-between text-xs text-slate-300">
            <div>
              Total de Materiais do Aditivo: <strong className="text-white">{items.filter(i => i.material_name.trim()).length} item(ns)</strong>
            </div>
            {services.length > 0 && (
              <div>
                Total de Serviços: <strong className="text-white">{services.filter(s => s.service_name.trim()).length} item(ns)</strong>
              </div>
            )}
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl border border-dark-700 text-slate-300 hover:text-white text-xs font-semibold hover:bg-dark-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl bg-sabrar-600 hover:bg-sabrar-500 text-white text-xs font-bold transition-all shadow-lg shadow-sabrar-600/30 flex items-center gap-2 disabled:opacity-50"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{loading ? 'Cadastrando Aditivo...' : `Salvar Aditivo ${nextNumber}`}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
