import React, { useState, useEffect } from 'react';
import { PlusCircle, Package, Check, X, AlertCircle } from 'lucide-react';
import { Material } from '../../types';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

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
  const [selectedMaterialId, setSelectedMaterialId] = useState<number | ''>('');
  const [quantity, setQuantity] = useState<string>('');
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
      setQuantity('');
      setNotes('');
      setError(null);
    }
  }, [isOpen, preselectedMaterialId]);

  if (!isOpen) return null;

  const selectedMat = materials.find(m => m.id === Number(selectedMaterialId));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const qty = Number(quantity);
    if (!selectedMaterialId || isNaN(qty) || qty <= 0) {
      setError('Selecione um material e informe uma quantidade válida');
      return;
    }

    setLoading(true);
    try {
      await api.quickStockEntry(Number(selectedMaterialId), qty, notes, currentUser?.id);
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

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
              Selecionar Material
            </label>
            <select
              value={selectedMaterialId}
              onChange={(e) => setSelectedMaterialId(e.target.value ? Number(e.target.value) : '')}
              className="w-full text-xs sm:text-sm p-3 rounded-2xl border border-dark-700 bg-dark-850 focus:outline-none focus:ring-2 focus:ring-sabrar-500 text-white"
              required
            >
              <option value="">Selecione o material...</option>
              {materials.map((m) => (
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

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
              Quantidade de Entrada (+){selectedMat ? ` em ${selectedMat.unit}` : ''}
            </label>
            <input
              type="number"
              step="any"
              min="0.1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Ex: 500"
              className="w-full text-base font-bold p-3 rounded-2xl border border-dark-700 bg-dark-850 focus:outline-none focus:ring-2 focus:ring-sabrar-500 text-white placeholder-slate-500"
              required
            />
          </div>

          {selectedMat && quantity && Number(quantity) > 0 && (
            <div className="p-3 bg-sabrar-950/80 rounded-2xl border border-sabrar-500/40 flex items-center justify-between text-xs">
              <span className="text-sabrar-300 font-medium">Novo Estoque Físico Previsto:</span>
              <span className="font-black text-sabrar-400 text-base">
                {selectedMat.stock_physical + Number(quantity)} {selectedMat.unit}
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
