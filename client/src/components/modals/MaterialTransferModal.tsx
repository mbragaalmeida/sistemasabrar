import React, { useState, useEffect } from 'react';
import { ArrowRight, RefreshCw, X, AlertTriangle, Building2, Package, CheckCircle } from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

interface MaterialTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  projects?: Array<{ id: number; name: string; code?: string }>;
  materials?: Array<{ id: number; name: string; code?: string; unit?: string }>;
  preSelectedOriginProjectId?: number;
  preSelectedMaterialId?: number;
}

export const MaterialTransferModal: React.FC<MaterialTransferModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  projects = [],
  materials = [],
  preSelectedOriginProjectId,
  preSelectedMaterialId
}) => {
  const { currentUser } = useAuth();
  const [loadedProjects, setLoadedProjects] = useState<any[]>([]);
  const [loadedMaterials, setLoadedMaterials] = useState<any[]>([]);
  const [originProjectId, setOriginProjectId] = useState<number | ''>(preSelectedOriginProjectId || '');
  const [destinationProjectId, setDestinationProjectId] = useState<number | ''>('');
  const [materialId, setMaterialId] = useState<number | ''>(preSelectedMaterialId || '');
  const [quantity, setQuantity] = useState<number | ''>('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (!projects || projects.length === 0) {
        api.getProjects().then(res => setLoadedProjects(res || [])).catch(() => {});
      }
      if (!materials || materials.length === 0) {
        api.getMaterials().then(res => setLoadedMaterials(res || [])).catch(() => {});
      }
    }
  }, [isOpen]);

  useEffect(() => {
    if (preSelectedOriginProjectId) setOriginProjectId(preSelectedOriginProjectId);
    if (preSelectedMaterialId) setMaterialId(preSelectedMaterialId);
  }, [preSelectedOriginProjectId, preSelectedMaterialId, isOpen]);

  const activeProjects = projects && projects.length > 0 ? projects : loadedProjects;
  const activeMaterials = materials && materials.length > 0 ? materials : loadedMaterials;

  if (!isOpen) return null;

  const selectedMaterial = activeMaterials.find(m => m.id === Number(materialId));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!originProjectId || !destinationProjectId || !materialId || !quantity || Number(quantity) <= 0) {
      setError('Por favor, preencha todos os campos obrigatórios com valores válidos.');
      return;
    }

    if (originProjectId === destinationProjectId) {
      setError('A obra de origem deve ser diferente da obra de destino.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await api.createTransfer({
        origin_project_id: originProjectId,
        destination_project_id: destinationProjectId,
        material_id: materialId,
        quantity: Number(quantity),
        unit: selectedMaterial?.unit || 'un',
        reason: reason || 'Transferência emergencial entre obras',
        userId: currentUser?.id
      });

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao registrar transferência entre obras.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-xs animate-fadeIn">
      <div className="w-full max-w-xl bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-750 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-slate-50 dark:bg-dark-850 border-b border-slate-200 dark:border-dark-750 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-300 dark:border-amber-500/30">
              <RefreshCw className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white">
                Transferência de Material entre Obras
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Aproveitamento de materiais reservados com criação de pendência de reposição
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto max-h-[80vh]">
          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs rounded-2xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Obra de Origem */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Obra de Origem (Quem cede) *
              </label>
              <select
                value={originProjectId}
                onChange={(e) => setOriginProjectId(Number(e.target.value) || '')}
                required
                className="w-full bg-slate-50 dark:bg-dark-800 border border-slate-300 dark:border-dark-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
              >
                <option value="">Selecione a obra de origem...</option>
                {activeProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Obra de Destino */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Obra de Destino (Quem recebe) *
              </label>
              <select
                value={destinationProjectId}
                onChange={(e) => setDestinationProjectId(Number(e.target.value) || '')}
                required
                className="w-full bg-slate-50 dark:bg-dark-800 border border-slate-300 dark:border-dark-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
              >
                <option value="">Selecione a obra de destino...</option>
                {activeProjects.filter(p => p.id !== originProjectId).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Material */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Material a ser Transferido *
            </label>
            <select
              value={materialId}
              onChange={(e) => setMaterialId(Number(e.target.value) || '')}
              required
              className="w-full bg-slate-50 dark:bg-dark-800 border border-slate-300 dark:border-dark-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
            >
              <option value="">Selecione o material...</option>
              {activeMaterials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.code ? `[${m.code}] ` : ''}{m.name} ({m.unit || 'un'})
                </option>
              ))}
            </select>
          </div>

          {/* Quantidade */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Quantidade a Retirar / Transferir ({selectedMaterial?.unit || 'un'}) *
            </label>
            <input
              type="number"
              step="any"
              min="0.0001"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value ? parseFloat(e.target.value) : '')}
              required
              placeholder="Ex: 50"
              className="w-full bg-slate-50 dark:bg-dark-800 border border-slate-300 dark:border-dark-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Motivo */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Motivo do Empréstimo / Transferência Emergencial
            </label>
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: Necessidade urgente para fechamento da linha frigorífica hoje..."
              className="w-full bg-slate-50 dark:bg-dark-800 border border-slate-300 dark:border-dark-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 resize-none"
            />
          </div>

          {/* Aviso de Reposição Automática */}
          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-2xl text-[11px] text-amber-800 dark:text-amber-300 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
            <div>
              <strong>Controle de Reposição Automático:</strong> Esta transferência abaterá a quantidade do saldo reservado da obra de origem e gerará uma <u>pendência de reposição</u> até que o material seja integralmente reposto.
            </div>
          </div>

          {/* Botões */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-dark-750">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-dark-800 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Transferindo...</span>
                </>
              ) : (
                <>
                  <ArrowRight className="w-3.5 h-3.5" />
                  <span>Confirmar Transferência</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
