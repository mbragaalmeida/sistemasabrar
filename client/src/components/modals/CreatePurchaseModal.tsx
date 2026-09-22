import React, { useState, useEffect } from 'react';
import { ShoppingCart, X, AlertCircle, Check, DollarSign, Package, Building2, Truck, Calendar, Tag, Search } from 'lucide-react';
import { Project, Material, Supplier } from '../../types';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

interface CreatePurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CreatePurchaseModal: React.FC<CreatePurchaseModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const { currentUser } = useAuth();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const [selectedMaterialId, setSelectedMaterialId] = useState<number | ''>('');
  const [materialSearch, setMaterialSearch] = useState('');
  const [quantity, setQuantity] = useState<string>('');
  const [selectedProjectId, setSelectedProjectId] = useState<number | ''>('');
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | ''>('');
  const [unitPrice, setUnitPrice] = useState<string>('');
  const [status, setStatus] = useState<string>('Em cotação');
  const [priority, setPriority] = useState<string>('Média');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      api.getMaterials().then(setMaterials).catch(console.error);
      api.getProjects().then(setProjects).catch(console.error);
      api.getSuppliers().then(setSuppliers).catch(console.error);

      // Reset form
      setSelectedMaterialId('');
      setMaterialSearch('');
      setQuantity('');
      setSelectedProjectId('');
      setSelectedSupplierId('');
      setUnitPrice('');
      setStatus('Em cotação');
      setPriority('Média');
      setExpectedDeliveryDate('');
      setNotes('');
      setError(null);
    }
  }, [isOpen]);

  const selectedMaterial = materials.find((m) => m.id === Number(selectedMaterialId));

  const handleMaterialChange = (matId: number | '') => {
    setSelectedMaterialId(matId);
    if (matId) {
      const mat = materials.find((m) => m.id === matId);
      if (mat) {
        setUnitPrice(mat.reference_price ? String(mat.reference_price) : '');
        if (mat.supplier_id) {
          setSelectedSupplierId(mat.supplier_id);
        }
      }
    } else {
      setUnitPrice('');
    }
  };

  const calculatedTotal = React.useMemo(() => {
    const qty = Number(quantity);
    const price = Number(unitPrice);
    if (!isNaN(qty) && !isNaN(price) && qty > 0 && price > 0) {
      return qty * price;
    }
    return 0;
  }, [quantity, unitPrice]);

  const filteredMaterials = React.useMemo(() => {
    if (!materialSearch.trim()) return materials;
    const term = materialSearch.toLowerCase();
    return materials.filter(
      (m) =>
        m.name.toLowerCase().includes(term) ||
        m.code.toLowerCase().includes(term) ||
        m.category.toLowerCase().includes(term)
    );
  }, [materials, materialSearch]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedMaterialId) {
      setError('Selecione o material a ser comprado.');
      return;
    }

    const qty = Number(quantity);
    if (!qty || isNaN(qty) || qty <= 0) {
      setError('Informe uma quantidade válida superior a 0.');
      return;
    }

    setLoading(true);
    try {
      await api.createPurchase({
        material_id: Number(selectedMaterialId),
        quantity: qty,
        project_id: selectedProjectId ? Number(selectedProjectId) : null,
        supplier_id: selectedSupplierId ? Number(selectedSupplierId) : null,
        unit_price: unitPrice ? Number(unitPrice) : undefined,
        status,
        priority,
        expected_delivery_date: expectedDeliveryDate || null,
        buyer_id: currentUser?.id || null,
        notes: notes.trim() || 'Solicitação manual de compra cadastrada no sistema.'
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Erro ao cadastrar compra:', err);
      setError(err.message || 'Falha ao cadastrar a solicitação de compra.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-dark-900 border border-dark-750 rounded-3xl w-full max-w-2xl max-h-[92vh] overflow-y-auto shadow-2xl animate-scaleUp">
        {/* Header */}
        <div className="sticky top-0 z-10 p-5 bg-dark-850/95 backdrop-blur-md border-b border-dark-750 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sabrar-950/70 border border-sabrar-500/40 flex items-center justify-center text-sabrar-400">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white">Nova Solicitação de Compra</h2>
              <p className="text-xs text-slate-400">Cadastre um pedido manual de compra ou cotação</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-dark-750 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mensagem de Erro */}
        {error && (
          <div className="mx-5 mt-4 p-3 rounded-2xl bg-rose-950/80 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {/* 1. Seleção do Material */}
          <div className="space-y-1.5">
            <label className="block text-slate-300 font-bold">
              Material / Produto <span className="text-rose-400">*</span>
            </label>

            {/* Busca rápida se houver muitos materiais */}
            <div className="relative mb-2">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={materialSearch}
                onChange={(e) => setMaterialSearch(e.target.value)}
                placeholder="Filtrar por nome, código (ex: MAT-000101) ou categoria..."
                className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-dark-700 bg-dark-850 text-white text-xs placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sabrar-500"
              />
            </div>

            <div className="relative">
              <Package className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                required
                value={selectedMaterialId}
                onChange={(e) => handleMaterialChange(e.target.value ? Number(e.target.value) : '')}
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-dark-700 bg-dark-850 text-white focus:outline-none focus:ring-2 focus:ring-sabrar-500 appearance-none font-medium cursor-pointer"
              >
                <option value="">Selecione o material desejado...</option>
                {filteredMaterials.map((m) => (
                  <option key={m.id} value={m.id} className="bg-dark-900 text-white">
                    {m.name} ({m.code}) — {m.category} | Ref: R$ {m.reference_price.toFixed(2)} / {m.unit}
                  </option>
                ))}
              </select>
            </div>

            {selectedMaterial && (
              <div className="p-2.5 rounded-xl bg-dark-800/80 border border-dark-700 flex items-center justify-between text-[11px] text-slate-300">
                <span>
                  Unidade: <strong className="text-white">{selectedMaterial.unit}</strong> • Categoria:{' '}
                  <strong className="text-white">{selectedMaterial.category}</strong>
                </span>
                <span>
                  Estoque Físico Atual: <strong className="text-sabrar-400">{selectedMaterial.stock_physical}</strong> {selectedMaterial.unit}
                </span>
              </div>
            )}
          </div>

          {/* 2. Quantidade e Preço Unitário */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-bold mb-1">
                Quantidade a Comprar <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="Ex: 50"
                  className="w-full pl-3.5 pr-14 py-2.5 rounded-xl border border-dark-700 bg-dark-850 text-white focus:outline-none focus:ring-2 focus:ring-sabrar-500 font-bold"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-xs">
                  {selectedMaterial?.unit || 'un'}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1">
                Preço Unitário Estimado (R$)
              </label>
              <div className="relative">
                <DollarSign className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                  placeholder="0,00"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-dark-700 bg-dark-850 text-white focus:outline-none focus:ring-2 focus:ring-sabrar-500"
                />
              </div>
            </div>
          </div>

          {/* Valor Total Estimado Card */}
          {calculatedTotal > 0 && (
            <div className="p-3 bg-sabrar-950/40 border border-sabrar-500/40 rounded-2xl flex items-center justify-between">
              <span className="text-xs text-slate-300 font-semibold">Valor Total Estimado do Pedido:</span>
              <span className="text-base font-black text-sabrar-400">
                R$ {calculatedTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          )}

          {/* 3. Obra / Destino e Fornecedor */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-bold mb-1">
                Obra / Destino (Opcional)
              </label>
              <div className="relative">
                <Building2 className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-dark-700 bg-dark-850 text-white focus:outline-none focus:ring-2 focus:ring-sabrar-500 appearance-none font-medium cursor-pointer"
                >
                  <option value="">Almoxarifado Geral (Sem obra vinculada)</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id} className="bg-dark-900 text-white">
                      {p.code} — {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1">
                Fornecedor Indicado (Opcional)
              </label>
              <div className="relative">
                <Truck className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <select
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-dark-700 bg-dark-850 text-white focus:outline-none focus:ring-2 focus:ring-sabrar-500 appearance-none font-medium cursor-pointer"
                >
                  <option value="">A definir (Em cotação aberta)</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id} className="bg-dark-900 text-white">
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 4. Status, Prioridade e Previsão de Entrega */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-300 font-bold mb-1">
                Status Inicial
              </label>
              <div className="relative">
                <Tag className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-dark-700 bg-dark-850 text-white focus:outline-none focus:ring-2 focus:ring-sabrar-500 appearance-none font-medium cursor-pointer"
                >
                  <option value="Em cotação">Em cotação</option>
                  <option value="Comprado">Comprado</option>
                  <option value="Aguardando entrega">Aguardando entrega</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1">
                Prioridade
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-dark-700 bg-dark-850 text-white focus:outline-none focus:ring-2 focus:ring-sabrar-500 appearance-none font-medium cursor-pointer"
              >
                <option value="Baixa">Baixa</option>
                <option value="Média">Média</option>
                <option value="Alta">Alta</option>
                <option value="Urgente">Urgente</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1">
                Previsão de Entrega
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="date"
                  value={expectedDeliveryDate}
                  onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-dark-700 bg-dark-850 text-white focus:outline-none focus:ring-2 focus:ring-sabrar-500"
                />
              </div>
            </div>
          </div>

          {/* 5. Observações */}
          <div>
            <label className="block text-slate-300 font-bold mb-1">
              Observações / Justificativa da Compra
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Reposição de estoque preventivo ou solicitação emergencial para montagem elétrica..."
              className="w-full p-3 rounded-xl border border-dark-700 bg-dark-850 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sabrar-500"
            />
          </div>

          {/* Ações */}
          <div className="pt-3 border-t border-dark-750 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-dark-700 text-slate-300 hover:text-white hover:bg-dark-800 transition-colors font-semibold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sabrar-600 hover:bg-sabrar-500 text-white font-bold transition-all shadow-md shadow-sabrar-600/30 active:scale-95 disabled:opacity-50"
            >
              {loading ? (
                <span>Cadastrando...</span>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Cadastrar Solicitação</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
