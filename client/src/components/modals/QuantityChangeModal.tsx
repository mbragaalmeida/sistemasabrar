import React, { useState, useEffect } from 'react';
import { Hash, X, AlertCircle, CheckCircle, Package } from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

interface QuantityChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: any;
  item: any;
  onSuccess: () => void;
}

export const QuantityChangeModal: React.FC<QuantityChangeModalProps> = ({
  isOpen,
  onClose,
  request,
  item,
  onSuccess
}) => {
  const { currentUser } = useAuth();
  const [newQuantity, setNewQuantity] = useState<number | string>(item?.quantity_requested || 1);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (item) {
      setNewQuantity(item.quantity_requested || 1);
      setReason('');
      setError(null);
    }
  }, [item, isOpen]);

  if (!isOpen || !item) return null;

  const currentQty = Number(item.quantity_requested || 0);
  const unit = item.material_unit || 'un';
  const materialName = item.material_name || item.custom_name || 'Material Solicitado';
  const materialCode = item.material_code || (item.is_custom ? 'FORA-BASE' : '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedQty = Number(newQuantity);

    if (isNaN(parsedQty) || parsedQty <= 0) {
      setError('Por favor, informe uma quantidade válida maior que zero.');
      return;
    }

    if (parsedQty === currentQty) {
      setError('A nova quantidade deve ser diferente da quantidade solicitada atual.');
      return;
    }

    if (!reason.trim()) {
      setError('Por favor, informe a justificativa para a alteração da quantidade.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await api.createQuantityChange({
        requestItemId: item.id,
        requestId: request.id,
        newQuantity: parsedQty,
        reason: reason.trim(),
        userId: currentUser?.id
      });
      alert('Solicitação de alteração de quantidade enviada com sucesso! Uma notificação foi enviada para aprovação dos Administradores, Sabrina ou Emily.');
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Erro ao solicitar alteração de quantidade:', err);
      setError(err.message || 'Erro ao registrar solicitação de alteração');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-sm animate-in fade-in overflow-y-auto">
      <div className="w-full max-w-lg bg-dark-900 rounded-3xl border border-dark-750 shadow-2xl overflow-hidden flex flex-col my-auto">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-dark-850 border-b border-dark-750 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-950/80 border border-sky-500/40 flex items-center justify-center text-sky-400">
              <Hash className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-extrabold text-base text-white">Solicitar Alteração de Quantidade</h2>
              <p className="text-xs text-slate-400">
                Almoxarifado • Requer autorização de Admin, Sabrina ou Emily
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-dark-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-rose-950/80 border border-rose-500/50 rounded-2xl flex items-center gap-2 text-rose-300 font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Contexto da Solicitação */}
          <div className="p-3.5 bg-dark-850 rounded-2xl border border-dark-750 space-y-2">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>SOLICITAÇÃO / OBRA</span>
              <span>SOLICITANTE</span>
            </div>
            <div className="flex items-center justify-between font-bold text-white text-xs">
              <div className="flex items-center gap-1.5 truncate max-w-[280px]">
                <span className="text-sabrar-400 font-mono">{request.code}</span>
                <span className="text-slate-500">—</span>
                <span className="truncate">{request.project_name || 'Obra Interna'}</span>
              </div>
              <span className="text-slate-300 font-medium">
                {request.requested_by_name || 'Engenharia'}
              </span>
            </div>

            <div className="pt-2 border-t border-dark-800 mt-2">
              <div className="text-[10px] text-slate-400 mb-1 font-semibold uppercase tracking-wider">
                Material do Romaneio
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-slate-400 shrink-0" />
                  <div>
                    <div className="font-bold text-slate-200">{materialName}</div>
                    {materialCode && (
                      <span className="text-[10px] text-slate-400 font-mono">{materialCode}</span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs font-bold text-slate-300 bg-dark-800 px-2.5 py-1 rounded-xl border border-dark-700">
                    Qtd Atual: <strong className="text-white">{currentQty}</strong> {unit}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Nova Quantidade */}
          <div className="space-y-1">
            <label className="block text-slate-300 font-bold text-xs">
              Nova Quantidade Correta *
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="any"
                min="0.01"
                value={newQuantity}
                onChange={(e) => setNewQuantity(e.target.value)}
                placeholder="Ex: 3"
                className="flex-1 bg-dark-850 text-white font-bold text-sm rounded-xl px-3.5 py-2.5 border border-dark-700 focus:outline-none focus:border-sky-500"
              />
              <span className="px-3 py-2.5 bg-dark-800 text-slate-300 font-bold text-xs rounded-xl border border-dark-700 min-w-[50px] text-center">
                {unit}
              </span>
            </div>
            {Number(newQuantity) > 0 && Number(newQuantity) !== currentQty && (
              <div className="text-[11px] text-sky-400 font-semibold pt-1">
                Alteração proposta: de <strong>{currentQty} {unit}</strong> para <strong>{newQuantity} {unit}</strong>{' '}
                ({Number(newQuantity) > currentQty ? `+${(Number(newQuantity) - currentQty).toFixed(2)}` : `${(Number(newQuantity) - currentQty).toFixed(2)}`})
              </div>
            )}
          </div>

          {/* Justificativa / Motivo */}
          <div className="space-y-1">
            <label className="block text-slate-300 font-bold text-xs">
              Justificativa para Alteração da Quantidade *
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: Engenheiro solicitou 4 unidades mas confirmou em obra que o correto é 3 unidades..."
              className="w-full bg-dark-850 text-white placeholder-slate-500 text-xs rounded-xl p-3 border border-dark-700 focus:outline-none focus:border-sky-500"
            />
          </div>

          {/* Alerta de Autorização */}
          <div className="p-3 bg-amber-950/40 border border-amber-600/40 rounded-2xl flex items-start gap-2 text-amber-300 text-[11px] leading-relaxed">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <strong>Processo de Governança:</strong> A alteração de quantidade no romaneio necessita de autorização prévia da Direção ou Compras (Sabrina, Emily ou Administradores). A quantidade da solicitação e as reservas só serão atualizadas após a aprovação formal no sistema.
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-dark-750">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-300 hover:text-white bg-dark-800 hover:bg-dark-750 border border-dark-700 transition-colors font-semibold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting || !reason.trim() || Number(newQuantity) <= 0 || Number(newQuantity) === currentQty}
              className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold transition-all shadow-md shadow-sky-600/30 disabled:opacity-50 flex items-center gap-1.5 active:scale-95"
            >
              <CheckCircle className="w-4 h-4" />
              <span>{submitting ? 'Enviando...' : 'Solicitar Autorização de Alteração'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
