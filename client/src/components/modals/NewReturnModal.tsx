import React, { useState, useEffect } from 'react';
import { RotateCcw, Check, X, AlertCircle, RefreshCw } from 'lucide-react';
import { Project, Material } from '../../types';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

interface NewReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  preselectedProjectId?: number;
}

export const NewReturnModal: React.FC<NewReturnModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  preselectedProjectId
}) => {
  const { currentUser } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | ''>('');
  const [selectedMaterialId, setSelectedMaterialId] = useState<number | ''>('');
  const [quantity, setQuantity] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      api.getProjects().then(setProjects);
      api.getMaterials().then(setMaterials);

      if (preselectedProjectId) {
        setSelectedProjectId(preselectedProjectId);
      } else {
        setSelectedProjectId('');
      }
      setSelectedMaterialId('');
      setQuantity('');
      setReason('');
      setError(null);
    }
  }, [isOpen, preselectedProjectId]);

  if (!isOpen) return null;

  const selectedMat = materials.find(m => m.id === Number(selectedMaterialId));
  const returnedNum = Number(quantity) || 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedProjectId || !selectedMaterialId || returnedNum <= 0) {
      setError('Selecione a obra, o material e informe a quantidade devolvida');
      return;
    }

    setLoading(true);
    try {
      await api.createReturn({
        projectId: Number(selectedProjectId),
        materialId: Number(selectedMaterialId),
        quantity: returnedNum,
        reason: reason || 'Sobra de obra em condição reutilizável',
        userId: currentUser?.id || 4
      });
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao registrar devolução');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-lg bg-dark-900 rounded-3xl shadow-2xl border border-dark-700 overflow-hidden flex flex-col max-h-[92vh] text-slate-100">
        {/* Header */}
        <div className="p-4 bg-dark-850 border-b border-dark-700 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-teal-950/80 border border-teal-500/40 flex items-center justify-center text-teal-400">
              <RotateCcw className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-white">Devolução de Material ao Almoxarifado</h3>
              <p className="text-[11px] text-slate-400">Reintegração ao estoque e recálculo de consumo real</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-dark-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto">
          {error && (
            <div className="p-3 bg-rose-950/60 border border-rose-800 text-rose-300 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Obra Origem */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
              Obra de Origem *
            </label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value ? Number(e.target.value) : '')}
              className="w-full text-xs sm:text-sm p-3 rounded-2xl border border-dark-700 bg-dark-850 focus:outline-none focus:ring-2 focus:ring-teal-500 text-white"
              required
            >
              <option value="">Selecione a obra que está devolvendo...</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name} ({p.client})
                </option>
              ))}
            </select>
          </div>

          {/* Material */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
              Material a Retornar ao Estoque *
            </label>
            <select
              value={selectedMaterialId}
              onChange={(e) => setSelectedMaterialId(e.target.value ? Number(e.target.value) : '')}
              className="w-full text-xs sm:text-sm p-3 rounded-2xl border border-dark-700 bg-dark-850 focus:outline-none focus:ring-2 focus:ring-teal-500 text-white"
              required
            >
              <option value="">Selecione o material...</option>
              {materials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.code} — {m.name} (Físico atual: {m.stock_physical} {m.unit})
                </option>
              ))}
            </select>
          </div>

          {/* Quantidade */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
              Quantidade Reutilizável que Retorna (+){selectedMat ? ` em ${selectedMat.unit}` : ''} *
            </label>
            <input
              type="number"
              step="any"
              min="0.1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Ex: 100"
              className="w-full text-base font-bold p-3 rounded-2xl border border-dark-700 bg-dark-850 focus:outline-none focus:ring-2 focus:ring-teal-500 text-white placeholder-slate-500"
              required
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Regra SABRAR: Registre apenas a quantidade que efetivamente poderá voltar ao estoque e ser reutilizada em outras obras.
            </p>
          </div>

          {/* Efeito no Estoque e Consumo Real */}
          {selectedMat && returnedNum > 0 && (
            <div className="p-3.5 bg-dark-850 border border-teal-700/60 rounded-2xl text-xs space-y-1 text-slate-300">
              <div className="font-bold flex items-center gap-1.5 text-teal-400">
                <RefreshCw className="w-4 h-4" />
                Impacto Automático no Sistema:
              </div>
              <div>• Estoque Físico de {selectedMat.name}: {selectedMat.stock_physical} → <span className="font-bold text-white">{selectedMat.stock_physical + returnedNum} {selectedMat.unit}</span></div>
              <div>• Consumo Real da Obra = Quantidade Retirada − Devolvida ({returnedNum} {selectedMat.unit})</div>
            </div>
          )}

          {/* Motivo */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
              Motivo / Observação
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: Sobra de fiação não utilizada após término da fase elétrica"
              className="w-full text-xs p-2.5 rounded-xl border border-dark-700 bg-dark-850 focus:outline-none focus:ring-2 focus:ring-teal-500 text-white placeholder-slate-500"
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
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold shadow-md shadow-teal-600/30 transition-all disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{loading ? 'Registrando...' : 'Confirmar Devolução'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
