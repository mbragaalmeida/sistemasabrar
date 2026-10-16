import React, { useState, useEffect } from 'react';
import { X, Layers, AlertTriangle, CheckCircle, Info, RefreshCw } from 'lucide-react';
import { Material } from '../../types';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

interface AdjustStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  material: Material | null;
  onSuccess: () => void;
}

export const AdjustStockModal: React.FC<AdjustStockModalProps> = ({
  isOpen,
  onClose,
  material,
  onSuccess
}) => {
  const { currentUser } = useAuth();
  const [newStock, setNewStock] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const isDirectApprover = Boolean(
    currentUser?.role === 'admin' ||
    currentUser?.role === 'orcamento_engenharia' ||
    currentUser?.role === 'compras_solicitacoes' ||
    /sabrina|emily/i.test(currentUser?.name || '') ||
    /sabrina|emily/i.test(currentUser?.email || '')
  );

  useEffect(() => {
    if (material) {
      setNewStock(String(material.stock_physical ?? 0));
      setReason('');
      setError(null);
    }
  }, [material, isOpen]);

  if (!isOpen || !material) return null;

  const currentStock = Number(material.stock_physical || 0);
  const targetStock = Number(newStock);
  const difference = isNaN(targetStock) ? 0 : Number((targetStock - currentStock).toFixed(2));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isNaN(targetStock) || targetStock < 0) {
      setError('Por favor, informe uma quantidade válida maior ou igual a zero.');
      return;
    }
    if (!reason.trim()) {
      setError('Informe a justificativa detalhada para o ajuste (ex: contagem física, erro em nota).');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await api.requestStockAdjustment({
        material_id: material.id,
        requested_stock: targetStock,
        reason: reason.trim(),
        user_id: currentUser?.id
      });

      alert(res.message || 'Ajuste processado com sucesso!');
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao processar ajuste de estoque');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-lg bg-dark-900 rounded-3xl border border-dark-700 shadow-2xl overflow-hidden flex flex-col text-slate-100">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-dark-850 border-b border-dark-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-amber-950/80 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white">Ajustar Quantidade em Estoque</h3>
              <p className="text-xs text-slate-400">Correção de saldo físico e acerto de inventário</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-dark-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-950/60 border border-rose-600/40 rounded-2xl flex items-start gap-2.5 text-xs text-rose-300">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Dados do Material */}
          <div className="p-3.5 bg-dark-850 rounded-2xl border border-dark-750 flex items-center gap-3">
            {material.image_url ? (
              <img
                src={material.image_url}
                alt=""
                className="w-12 h-12 rounded-xl bg-dark-950 object-contain p-1 border border-dark-700 shrink-0"
              />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-dark-950 border border-dark-700 flex items-center justify-center text-slate-500 shrink-0">
                <Layers className="w-6 h-6" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <span className="font-mono text-[11px] font-bold text-sabrar-400 bg-dark-800 px-2 py-0.5 rounded border border-dark-700">
                {material.code}
              </span>
              <h4 className="font-bold text-sm text-white truncate mt-1">{material.name}</h4>
              <p className="text-xs text-slate-400">{material.category} • Unidade: <strong>{material.unit}</strong></p>
            </div>
          </div>

          {/* Comparativo de Estoque */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-3 bg-dark-850 rounded-2xl border border-dark-750">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Estoque Atual</span>
              <span className="text-base font-extrabold text-slate-300">{currentStock} {material.unit}</span>
            </div>
            <div className="p-3 bg-dark-850 rounded-2xl border border-dark-750">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Novo Saldo</span>
              <span className="text-base font-extrabold text-white">{isNaN(targetStock) ? '-' : targetStock} {material.unit}</span>
            </div>
            <div className={`p-3 rounded-2xl border ${difference === 0 ? 'bg-dark-850 border-dark-750 text-slate-400' : difference > 0 ? 'bg-emerald-950/40 border-emerald-600/40 text-emerald-300' : 'bg-rose-950/40 border-rose-600/40 text-rose-300'}`}>
              <span className="text-[10px] uppercase font-bold block">Diferença</span>
              <span className="text-base font-black">
                {difference > 0 ? `+${difference}` : difference} {material.unit}
              </span>
            </div>
          </div>

          {/* Campo Novo Estoque */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              Nova Quantidade Física Real em Estoque ({material.unit}) *
            </label>
            <input
              type="number"
              step="any"
              min="0"
              required
              value={newStock}
              onChange={(e) => setNewStock(e.target.value)}
              className="w-full text-base font-bold p-3 rounded-2xl border border-dark-700 bg-dark-850 focus:outline-none focus:ring-2 focus:ring-sabrar-500 text-white"
              placeholder="Ex: 15"
            />
          </div>

          {/* Campo Justificativa */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              Motivo / Justificativa da Correção *
            </label>
            <textarea
              rows={3}
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full text-xs p-3 rounded-2xl border border-dark-700 bg-dark-850 focus:outline-none focus:ring-2 focus:ring-sabrar-500 text-white placeholder-slate-500"
              placeholder="Explique o motivo deste acerto (ex: contagem de inventário constatou sobra/falta, erro de digitação na nota de entrada anterior, etc.)."
            />
          </div>

          {/* Aviso sobre aprovação */}
          <div className={`p-3 rounded-2xl border flex items-start gap-2.5 text-xs ${isDirectApprover ? 'bg-emerald-950/30 border-emerald-600/30 text-emerald-300' : 'bg-amber-950/30 border-amber-600/30 text-amber-300'}`}>
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              {isDirectApprover ? (
                <span>
                  <strong>Aprovação Imediata:</strong> Como Administrador, Sabrina ou Emily, a alteração será gravada diretamente no saldo do material e registrada no extrato.
                </span>
              ) : (
                <span>
                  <strong>Confirmação de Gestores:</strong> Este acerto será enviado com status <strong>Pendente</strong> e entrará em vigor assim que for confirmado por Administradores, Sabrina ou Emily.
                </span>
              )}
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl border border-dark-700 hover:bg-dark-800 text-slate-300 text-xs font-semibold transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs transition-all shadow-md shadow-amber-500/20 active:scale-95 disabled:opacity-50"
            >
              {loading ? 'Processando...' : isDirectApprover ? 'Aplicar Correção' : 'Solicitar Correção'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
