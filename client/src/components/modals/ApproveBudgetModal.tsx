import React, { useState } from 'react';
import { CheckCircle, AlertTriangle, X, ShieldAlert } from 'lucide-react';

interface ApproveBudgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (scopeSummary: string) => Promise<void>;
  projectName: string;
  totalFinal: number;
  existingScopeSummary?: string;
}

export const ApproveBudgetModal: React.FC<ApproveBudgetModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  projectName,
  totalFinal,
  existingScopeSummary = ''
}) => {
  const [scopeSummary, setScopeSummary] = useState(existingScopeSummary);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scopeSummary.trim()) {
      setError('Por favor, informe o Resumo Descritivo do Escopo para orientar a equipe de engenharia e evitar erros em campo.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      await onConfirm(scopeSummary.trim());
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao aprovar orçamento.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
      <div className="bg-dark-900 border border-dark-750 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-dark-800 flex items-center justify-between bg-dark-850">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Aprovar Orçamento & Iniciar Obra</h2>
              <p className="text-xs text-slate-400 truncate max-w-md">{projectName}</p>
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
          <div className="p-4 rounded-2xl bg-dark-800/80 border border-dark-700 flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Valor Total Aprovado:</span>
            <span className="text-lg font-black text-emerald-400">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalFinal)}
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-amber-950/30 border border-amber-600/40 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-200/90 leading-relaxed">
              <strong>Prevenção de Erros de Execução:</strong> O resumo do escopo inserido abaixo será exibido em destaque para todos os engenheiros e gestores da obra, garantindo alinhamento técnico entre o que foi orçado e o que deve ser executado.
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-300">
              Resumo Descritivo do Escopo <span className="text-rose-400">*</span>
            </label>
            <textarea
              value={scopeSummary}
              onChange={(e) => setScopeSummary(e.target.value)}
              placeholder="Descreva detalhadamente o escopo aprovado: limites de atendimento, especificações dos materiais chave, premissas de execução, restrições e pontos de atenção para os engenheiros de campo..."
              rows={5}
              className="w-full px-4 py-3 bg-dark-800 border border-dark-700 rounded-2xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all resize-none"
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
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-lg shadow-emerald-600/30 flex items-center gap-2 disabled:opacity-50"
            >
              <CheckCircle className="w-4 h-4" />
              <span>{loading ? 'Aprovando...' : 'Confirmar Aprovação'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
