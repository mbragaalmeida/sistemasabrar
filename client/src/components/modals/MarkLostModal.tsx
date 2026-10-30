import React, { useState } from 'react';
import { XCircle, AlertTriangle, X } from 'lucide-react';

interface MarkLostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
  projectName: string;
}

export const MarkLostModal: React.FC<MarkLostModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  projectName
}) => {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const quickReasons = [
    'Preço acima do orçamento do cliente',
    'Cliente optou por concorrente',
    'Projeto/obra cancelado pelo cliente',
    'Prazo de entrega incompatível',
    'Sem retorno do cliente após prazo de validade'
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Por favor, informe o motivo da perda do orçamento.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      await onConfirm(reason.trim());
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao registrar perda do orçamento.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
      <div className="bg-dark-900 border border-dark-750 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-dark-800 flex items-center justify-between bg-dark-850">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
              <XCircle className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Marcar Orçamento como Perdido</h2>
              <p className="text-xs text-slate-400 truncate max-w-sm">{projectName}</p>
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
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-xs text-slate-300 leading-relaxed">
            Ao marcar como perdido, a obra sairá do pipeline de levantamento e ficará arquivada com o histórico comercial preservado para auditoria e análises futuras de taxa de conversão.
          </p>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-300">
              Motivo Principal <span className="text-rose-400">*</span>
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {quickReasons.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all text-left ${
                    reason === r
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 font-semibold'
                      : 'bg-dark-800 text-slate-400 border-dark-700 hover:text-white'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Descreva detalhes adicionais ou o motivo específico da não aprovação..."
              rows={3}
              className="w-full px-4 py-2.5 bg-dark-800 border border-dark-700 rounded-2xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all resize-none"
              required
            />
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-end gap-3">
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
              className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-lg shadow-rose-600/30 flex items-center gap-2 disabled:opacity-50"
            >
              <XCircle className="w-4 h-4" />
              <span>{loading ? 'Salvando...' : 'Confirmar Perda'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
