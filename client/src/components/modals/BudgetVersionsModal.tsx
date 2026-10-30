import React from 'react';
import { History, X, Tag, Calendar, User, FileText, CheckCircle2 } from 'lucide-react';
import { BudgetVersion } from '../../types';

interface BudgetVersionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  versions: BudgetVersion[];
  currentVersionNumber: number;
}

export const BudgetVersionsModal: React.FC<BudgetVersionsModalProps> = ({
  isOpen,
  onClose,
  versions,
  currentVersionNumber
}) => {
  if (!isOpen) return null;

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

  const formatDate = (isoString: string) => {
    try {
      return new Date(isoString).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
      <div className="bg-dark-900 border border-dark-750 rounded-3xl w-full max-w-2xl max-h-[85vh] shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-dark-800 flex items-center justify-between bg-dark-850">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-sabrar-500/20 text-sabrar-400 border border-sabrar-500/30">
              <History className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Histórico de Versões do Orçamento</h2>
              <p className="text-xs text-slate-400">
                Auditoria de alterações, escopo e justificativas comerciais
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

        {/* Content list */}
        <div className="p-6 overflow-y-auto space-y-4">
          {versions.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs border border-dashed border-dark-700 rounded-2xl">
              Nenhuma versão intermediária gravada ainda. O orçamento está em sua versão base original.
            </div>
          ) : (
            versions.map((ver) => {
              const isLatest = ver.version_number === currentVersionNumber;
              return (
                <div
                  key={ver.id}
                  className={`p-4 rounded-2xl border transition-all ${
                    isLatest
                      ? 'bg-dark-850 border-sabrar-500/50 shadow-md'
                      : 'bg-dark-800/60 border-dark-750'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-sabrar-500/20 text-sabrar-300 border border-sabrar-500/40">
                        Versão {ver.version_number}
                      </span>
                      {isLatest && (
                        <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Atual
                        </span>
                      )}
                      <span className="text-[11px] px-2 py-0.5 rounded-md bg-dark-750 text-slate-300 flex items-center gap-1">
                        <Tag className="w-3 h-3 text-slate-400" />
                        {ver.change_type}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-bold text-slate-400 block">Total Final:</span>
                      <span className="text-sm font-black text-emerald-400">
                        {formatCurrency(ver.total_final)}
                      </span>
                    </div>
                  </div>

                  <div className="p-3 bg-dark-900 rounded-xl border border-dark-750 my-2">
                    <p className="text-[11px] text-slate-400 font-semibold mb-1">Justificativa da Alteração:</p>
                    <p className="text-xs text-white leading-relaxed">{ver.justification}</p>
                  </div>

                  <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-dark-750 gap-2">
                    <div className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-500" />
                      <span>{ver.created_by_name || 'Orçamentista'}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      <span>{formatDate(ver.created_at)}</span>
                    </div>
                    {Number(ver.discount_amount) > 0 && (
                      <span className="text-amber-400 font-semibold">
                        Desconto aplicado: {formatCurrency(ver.discount_amount)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-dark-800 bg-dark-850 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-dark-750 hover:bg-dark-700 text-white text-xs font-semibold transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
