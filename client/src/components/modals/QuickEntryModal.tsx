import React, { useState, useEffect } from 'react';
import { PlusCircle, Package, Check, X, AlertCircle, Search, Scale, Sparkles } from 'lucide-react';
import { Material } from '../../types';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { extractGasCylinderKg } from '../../utils/unitConversion';

interface QuickEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  preselectedMaterialId?: number;
}

export const QuickEntryModal: React.FC<QuickEntryModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  preselectedMaterialId
}) => {
  const { currentUser } = useAuth();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedMaterialId, setSelectedMaterialId] = useState<number | ''>('');
  const [quantity, setQuantity] = useState<string>('');
  const [entryUnitMode, setEntryUnitMode] = useState<'standard' | 'kg'>('standard');
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      api.getMaterials().then(setMaterials).catch(console.error);
      if (preselectedMaterialId) {
        setSelectedMaterialId(preselectedMaterialId);
      } else {
        setSelectedMaterialId('');
      }
      setSearchTerm('');
      setQuantity('');
      setEntryUnitMode('standard');
      setNotes('');
      setError(null);
    }
  }, [isOpen, preselectedMaterialId]);

  if (!isOpen) return null;

  const selectedMat = materials.find(m => m.id === Number(selectedMaterialId));
  const isGas = Boolean(
    selectedMat && (
      (selectedMat.category || '').toUpperCase().includes('GAS') ||
      (selectedMat.name || '').toUpperCase().includes('GÁS') ||
      (selectedMat.name || '').toUpperCase().includes('GAS') ||
      (selectedMat.name || '').toUpperCase().includes('REFRIGERANTE') ||
      (selectedMat.unit || '').toLowerCase().includes('botija')
    )
  );

  const gasCapacityKg = isGas && selectedMat ? extractGasCylinderKg(selectedMat.name, selectedMat.unit) : 0;

  const rawQty = Number(quantity);
  const effectiveQty = isGas && entryUnitMode === 'kg' && gasCapacityKg > 0 && !isNaN(rawQty)
    ? Number((rawQty / gasCapacityKg).toFixed(2))
    : rawQty;

  const filteredMaterials = materials.filter(m =>
    !searchTerm.trim() ||
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.id === Number(selectedMaterialId)
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedMaterialId || isNaN(effectiveQty) || effectiveQty <= 0) {
      setError('Selecione um material e informe uma quantidade válida');
      return;
    }

    setLoading(true);
    try {
      let finalNotes = notes.trim();
      if (isGas && entryUnitMode === 'kg') {
        const kgNote = `[Entrada realizada em KG: ${quantity} kg / Cilindro: ${gasCapacityKg} kg = +${effectiveQty} ${selectedMat?.unit}]`;
        finalNotes = finalNotes ? `${kgNote} ${finalNotes}` : kgNote;
      }

      await api.quickStockEntry(Number(selectedMaterialId), effectiveQty, finalNotes, currentUser?.id);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao registrar entrada');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-md bg-dark-900 rounded-3xl shadow-2xl border border-dark-700 overflow-hidden flex flex-col text-slate-100">
        {/* Header */}
        <div className="p-4 bg-dark-850 border-b border-dark-700 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-sabrar-950/80 border border-sabrar-500/40 flex items-center justify-center text-sabrar-400">
              <PlusCircle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-white">Entrada Rápida de Estoque</h3>
              <p className="text-[11px] text-slate-400">Entrada ágil de materiais no almoxarifado</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-dark-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4">
          {error && (
            <div className="p-3 bg-rose-950/60 border border-rose-800 text-rose-300 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
              Selecionar Material Cadastrado
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Filtrar material por nome ou código..."
                className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-dark-700 bg-dark-850 focus:outline-none focus:ring-2 focus:ring-sabrar-500 text-white placeholder-slate-500"
              />
            </div>
            <select
              value={selectedMaterialId}
              onChange={(e) => setSelectedMaterialId(e.target.value ? Number(e.target.value) : '')}
              className="w-full text-xs sm:text-sm p-3 rounded-2xl border border-dark-700 bg-dark-850 focus:outline-none focus:ring-2 focus:ring-sabrar-500 text-white"
              required
            >
              <option value="">
                {filteredMaterials.length === 0
                  ? 'Nenhum material encontrado para a busca...'
                  : `Selecione o material (${filteredMaterials.length} disponíveis)...`}
              </option>
              {filteredMaterials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.code} — {m.name} ({m.stock_physical} {m.unit} em estoque)
                </option>
              ))}
            </select>
          </div>

          {selectedMat && (
            <div className="p-3 bg-dark-850 rounded-2xl border border-dark-700 flex items-center justify-between text-xs">
              <span className="text-slate-400">Estoque Físico Atual:</span>
              <span className="font-black text-white text-sm">
                {selectedMat.stock_physical} {selectedMat.unit}
              </span>
            </div>
          )}

          {/* Seletor de Unidade para Categoria de Gases */}
          {isGas && selectedMat && (
            <div className="p-3 bg-dark-850 rounded-2xl border border-teal-500/30 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-teal-400 flex items-center gap-1.5">
                  <Scale className="w-3.5 h-3.5" />
                  Entrada de Gás — Escolha a Unidade:
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  Capacidade: {gasCapacityKg} kg / botija
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setEntryUnitMode('standard')}
                  className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                    entryUnitMode === 'standard'
                      ? 'bg-teal-600 text-white border-teal-500 shadow-xs'
                      : 'bg-dark-800 text-slate-400 border-dark-700 hover:text-white'
                  }`}
                >
                  {selectedMat.unit} (Botijas)
                </button>
                <button
                  type="button"
                  onClick={() => setEntryUnitMode('kg')}
                  className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all border cursor-pointer flex items-center justify-center gap-1.5 ${
                    entryUnitMode === 'kg'
                      ? 'bg-teal-600 text-white border-teal-500 shadow-xs'
                      : 'bg-dark-800 text-slate-400 border-dark-700 hover:text-white'
                  }`}
                >
                  <Sparkles className="w-3 h-3 text-amber-300" />
                  Em Quilos (kg)
                </button>
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                Quantidade de Entrada (+)
              </label>
              <span className="text-xs font-mono font-bold text-sabrar-400">
                {isGas && entryUnitMode === 'kg' ? 'Informar em QUILOS (kg)' : `em ${selectedMat?.unit || 'unidade'}`}
              </span>
            </div>
            <input
              type="number"
              step="any"
              min="0.01"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder={isGas && entryUnitMode === 'kg' ? `Ex: ${gasCapacityKg * 2} (para 2 botijas)` : "Ex: 10"}
              className="w-full text-base font-bold p-3 rounded-2xl border border-dark-700 bg-dark-850 focus:outline-none focus:ring-2 focus:ring-sabrar-500 text-white placeholder-slate-500"
              required
            />
            {isGas && entryUnitMode === 'kg' && Number(quantity) > 0 && (
              <div className="text-[11px] text-teal-400 font-medium mt-1 flex items-center gap-1">
                <span>💡 {quantity} kg ÷ {gasCapacityKg} kg = <strong>+{effectiveQty} {selectedMat?.unit}</strong></span>
              </div>
            )}
          </div>

          {selectedMat && quantity && Number(quantity) > 0 && (
            <div className="p-3 bg-sabrar-950/80 rounded-2xl border border-sabrar-500/40 flex items-center justify-between text-xs">
              <span className="text-sabrar-300 font-medium">Novo Estoque Físico Previsto:</span>
              <span className="font-black text-sabrar-400 text-base">
                {Number((selectedMat.stock_physical + effectiveQty).toFixed(2))} {selectedMat.unit}
                {isGas && entryUnitMode === 'kg' && (
                  <span className="text-xs text-slate-400 font-normal ml-1.5 font-mono">
                    ({quantity} kg inseridos)
                  </span>
                )}
              </span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
              Observação / Origem (Opcional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Entrega NF 4589 ou remessa de fábrica"
              className="w-full text-xs p-2.5 rounded-xl border border-dark-700 bg-dark-850 focus:outline-none focus:ring-2 focus:ring-sabrar-500 text-white placeholder-slate-500"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-dark-750">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-dark-700 bg-dark-850 text-slate-300 text-xs font-bold hover:bg-dark-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sabrar-600 hover:bg-sabrar-500 text-white text-xs font-bold shadow-md shadow-sabrar-600/30 transition-all disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{loading ? 'Confirmando...' : 'Confirmar Entrada'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
