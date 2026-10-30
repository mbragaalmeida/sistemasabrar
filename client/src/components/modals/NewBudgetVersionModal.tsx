import React, { useState } from 'react';
import { History, AlertTriangle, X, CheckCircle, Tag, FileText } from 'lucide-react';

interface NewBudgetVersionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: {
    change_type: string;
    justification: string;
    discount_amount?: number;
  }) => Promise<void>;
  currentVersionNumber: number;
  totalFinal: number;
}

export const NewBudgetVersionModal: React.FC<NewBudgetVersionModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  currentVersionNumber,
  totalFinal
}) => {
  const [changeType, setChangeType] = useState('Desconto Comercial');
  const [justification, setJustification] = useState('');
  const [discountAmount, setDiscountAmount] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const changeTypes = [
    { id: 'Desconto Comercial', label: 'Desconto Comercial / Negociação' },
    { id: 'Mudança de Escopo', label: 'Mudança de Escopo do Cliente' },
    { id: 'Novo Arquivo de Projeto', label: 'Novo Arquivo de Projeto / DWG' },
    { id: 'Ajuste de Quantitativos', label: 'Ajuste de Quantitativos / Preços' },
    { id: 'Outro', label: 'Outro Motivo' }
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!justification.trim()) {
      setError('Por favor, informe a justificativa detalhada desta nova versão.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      await onConfirm({
        change_type: changeType,
        justification: justification.trim(),
        discount_amount: discountAmount ? Number(discountAmount) : 0
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao registrar versão do orçamento.');
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
            <div className="p-2.5 rounded-2xl bg-sabrar-500/20 text-sabrar-400 border border-sabrar-500/30">
              <History className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Criar Nova Versão do Orçamento</h2>
              <p className="text-xs text-slate-400">
                Criando Versão {currentVersionNumber + 1} (preservando o histórico anterior)
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
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="p-4 rounded-2xl bg-dark-850 border border-dark-750 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-400 block font-medium">Valor Total Atual:</span>
              <span className="text-base font-black text-white">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalFinal)}
              </span>
            </div>
            <span className="text-xs font-bold px-3 py-1 bg-sabrar-950 text-sabrar-300 border border-sabrar-500/40 rounded-xl">
              V{currentVersionNumber} &rarr; V{currentVersionNumber + 1}
            </span>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-300">
              Tipo da Alteração <span className="text-rose-400">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {changeTypes.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setChangeType(t.id)}
                  className={`p-2.5 rounded-xl border text-left text-xs transition-all ${
                    changeType === t.id
                      ? 'bg-sabrar-600/20 text-sabrar-300 border-sabrar-500 font-bold shadow-sm'
                      : 'bg-dark-800 text-slate-400 border-dark-700 hover:text-white hover:bg-dark-750'
                  }`}
                >
                  <Tag className="w-3.5 h-3.5 mb-1 inline mr-1.5 opacity-70" />
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {changeType === 'Desconto Comercial' && (
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">
                Valor do Desconto Comercial Concedido (R$)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={discountAmount !== undefined ? discountAmount : ''}
                onChange={(e) => setDiscountAmount(e.target.value ? parseFloat(e.target.value) : undefined)}
                placeholder="Ex: 1500.00"
                className="w-full px-4 py-2.5 bg-dark-800 border border-dark-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sabrar-500"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-300">
              Justificativa Detalhada da Alteração <span className="text-rose-400">*</span>
            </label>
            <textarea
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="Ex: Cliente solicitou 5% de desconto à vista e exclusão do item de luminárias LED devido a fornecimento próprio..."
              rows={4}
              className="w-full px-4 py-3 bg-dark-800 border border-dark-700 rounded-2xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sabrar-500 focus:ring-1 focus:ring-sabrar-500 transition-all resize-none"
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
              className="px-5 py-2.5 rounded-xl bg-sabrar-600 hover:bg-sabrar-500 text-white text-xs font-bold transition-all shadow-lg shadow-sabrar-600/30 flex items-center gap-2 disabled:opacity-50"
            >
              <CheckCircle className="w-4 h-4" />
              <span>{loading ? 'Salvando Versão...' : 'Gravar Nova Versão'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
