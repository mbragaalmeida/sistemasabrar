import React, { useState, useEffect } from 'react';
import { ShoppingCart, Check, X, AlertCircle } from 'lucide-react';
import { Project, Material, Supplier } from '../../types';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

interface NewPurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  purchaseToEdit?: any;
  purchase?: any;
}

export const NewPurchaseModal: React.FC<NewPurchaseModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  purchaseToEdit,
  purchase
}) => {
  const activePurchase = purchase || purchaseToEdit;
  const { currentUser } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierId, setSupplierId] = useState<number | ''>('');
  const [unitPrice, setUnitPrice] = useState<string>('');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState<string>('');
  const [status, setStatus] = useState<string>('Em cotação');
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      api.getSuppliers().then(setSuppliers);
      if (activePurchase) {
        setSupplierId(activePurchase.supplier_id || '');
        setUnitPrice(activePurchase.unit_price ? String(activePurchase.unit_price) : '');
        setExpectedDeliveryDate(activePurchase.expected_delivery_date || '');
        setStatus(activePurchase.status || 'Em cotação');
        setNotes(activePurchase.notes || '');
      }
      setError(null);
    }
  }, [isOpen, activePurchase]);

  if (!isOpen || !activePurchase) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    setLoading(true);
    try {
      await api.updatePurchase(activePurchase.id, {
        supplier_id: supplierId ? Number(supplierId) : undefined,
        unit_price: unitPrice ? Number(unitPrice) : undefined,
        status,
        expected_delivery_date: expectedDeliveryDate || undefined,
        notes,
        buyer_id: currentUser?.id || 5
      });
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao atualizar compra');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-lg bg-dark-900 rounded-3xl shadow-2xl border border-dark-700 overflow-hidden flex flex-col text-slate-100">
        {/* Header */}
        <div className="p-4 bg-dark-850 border-b border-dark-700 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-sabrar-950/80 border border-sabrar-500/40 flex items-center justify-center text-sabrar-400">
              <ShoppingCart className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-white">
                Gestão de Demanda de Compra: {activePurchase.code}
              </h3>
              <p className="text-[11px] text-slate-400">
                Material: {activePurchase.material_name} ({activePurchase.quantity} {activePurchase.material_unit})
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-dark-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-950/60 border border-rose-800 text-rose-300 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Status da Compra */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
              Status do Pedido / Cotação *
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full text-xs sm:text-sm p-3 rounded-2xl border border-dark-700 bg-dark-850 focus:outline-none focus:ring-2 focus:ring-sabrar-500 text-white font-medium"
            >
              <option value="Solicitado">Solicitado (Aguardando ação)</option>
              <option value="Em cotação">Em cotação com fornecedores</option>
              <option value="Aguardando aprovação">Aguardando aprovação</option>
              <option value="Comprado">Comprado (Pedido emitido)</option>
              <option value="Aguardando entrega">Aguardando entrega na obra/almoxarifado</option>
            </select>
          </div>

          {/* Fornecedor */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
              Fornecedor Escolhido
            </label>
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value ? Number(e.target.value) : '')}
              className="w-full text-xs sm:text-sm p-3 rounded-2xl border border-dark-700 bg-dark-850 focus:outline-none focus:ring-2 focus:ring-sabrar-500 text-white"
            >
              <option value="">Selecione o fornecedor...</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.phone || s.email || 'Cadastrado'})
                </option>
              ))}
            </select>
          </div>

          {/* Valor Unitário e Previsão */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                Valor Unitário Cotado (R$)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                placeholder="0.00"
                className="w-full text-sm font-bold p-2.5 rounded-2xl border border-dark-700 bg-dark-850 focus:outline-none focus:ring-2 focus:ring-sabrar-500 text-white placeholder-slate-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                Previsão de Entrega
              </label>
              <input
                type="date"
                value={expectedDeliveryDate}
                onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                className="w-full text-xs sm:text-sm p-2.5 rounded-2xl border border-dark-700 bg-dark-850 focus:outline-none focus:ring-2 focus:ring-sabrar-500 text-white"
              />
            </div>
          </div>

          {/* Cálculo do Total Previsto */}
          {unitPrice && Number(unitPrice) > 0 && (
            <div className="p-3 bg-sabrar-950/80 border border-sabrar-500/40 rounded-2xl flex items-center justify-between text-xs">
              <span className="text-sabrar-300 font-medium">Valor Total da Compra:</span>
              <span className="text-base font-black text-sabrar-400">
                R$ {(Number(unitPrice) * activePurchase.quantity).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}

          {/* Observações */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
              Observações / Condições Comerciais
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Faturado em 28 DDL, frete CIF incluso pelo fornecedor"
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
              <span>{loading ? 'Salvando...' : 'Salvar Cotação / Pedido'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
