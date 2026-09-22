import React, { useState, useEffect } from 'react';
import { PackagePlus, X, AlertCircle, Check, DollarSign, Layers, Building2, Tag } from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Supplier } from '../../types';

interface NewMaterialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (newMaterial: any) => void;
}

export const NewMaterialModal: React.FC<NewMaterialModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const { currentUser } = useAuth();
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Climatização');
  const [unit, setUnit] = useState('un');
  const [brand, setBrand] = useState('');
  const [referencePrice, setReferencePrice] = useState('');
  const [stockPhysical, setStockPhysical] = useState('');
  const [stockMinimum, setStockMinimum] = useState('10');
  const [supplierId, setSupplierId] = useState<string>('');
  const [description, setDescription] = useState('');

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      api.getSuppliers().then(setSuppliers).catch(console.error);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('O nome do produto / material é obrigatório');
      return;
    }
    if (!referencePrice || Number(referencePrice) <= 0) {
      setError('Informe um preço de referência válido');
      return;
    }

    setLoading(true);
    try {
      const res = await api.createMaterial({
        name: name.trim(),
        category,
        unit,
        brand: brand.trim() || undefined,
        reference_price: Number(referencePrice),
        stock_physical: Number(stockPhysical) || 0,
        stock_minimum: Number(stockMinimum) || 10,
        supplier_id: supplierId ? Number(supplierId) : undefined,
        description: description.trim() || undefined,
        userId: currentUser?.id || 1
      });

      if (onSuccess) onSuccess(res);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao cadastrar material');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-xl bg-dark-900 border border-dark-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-slate-100">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-dark-850 border-b border-dark-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sabrar-950/70 border border-sabrar-500/40 flex items-center justify-center text-sabrar-400 shadow-inner">
              <PackagePlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white">Cadastrar Novo Produto / Material</h3>
              <p className="text-xs text-slate-400">Adicionar item mestre ao catálogo e almoxarifado da SABRAR</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-dark-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto">
          {error && (
            <div className="p-3 bg-rose-950/50 border border-rose-800/80 text-rose-300 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Nome do Produto */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
              Nome do Produto / Descrição Comercial *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Duto Espiroflex Alumínio 8'' ou Split Cassete 36.000 BTU"
              className="w-full text-xs sm:text-sm p-3 rounded-2xl border border-dark-700 bg-dark-850 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sabrar-500 font-semibold"
              required
            />
          </div>

          {/* Categoria e Unidade */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                Categoria *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full text-xs p-2.5 rounded-2xl border border-dark-700 bg-dark-850 text-white focus:outline-none focus:ring-2 focus:ring-sabrar-500 font-medium"
              >
                <option value="Climatização">Climatização & Exaustão</option>
                <option value="Elétrica">Instalações Elétricas</option>
                <option value="Hidráulica">Hidráulica & Incêndio</option>
                <option value="Drywall">Drywall & Forros</option>
                <option value="Civil">Construção Civil</option>
                <option value="Estrutura">Estruturas Metálicas & Vigas</option>
                <option value="Pintura">Pintura & Tratamentos</option>
                <option value="Acabamento">Pisos & Acabamentos</option>
                <option value="Outros">Outros Insumos</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                Unidade de Medida *
              </label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full text-xs p-2.5 rounded-2xl border border-dark-700 bg-dark-850 text-white focus:outline-none focus:ring-2 focus:ring-sabrar-500 font-medium"
              >
                <option value="un">un (Unidade)</option>
                <option value="m">m (Metros)</option>
                <option value="m²">m² (Metros quadrados)</option>
                <option value="m³">m³ (Metros cúbicos)</option>
                <option value="barra">barra (Barras de 3m/6m)</option>
                <option value="kg">kg (Quilogramas)</option>
                <option value="pç">pç (Peça)</option>
                <option value="cx">cx (Caixa)</option>
                <option value="rolo">rolo (Rolo / Bobina)</option>
                <option value="lata">lata (Lata / Balde)</option>
              </select>
            </div>
          </div>

          {/* Marca e Preço de Referência */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                Marca / Fabricante Recomendado
              </label>
              <input
                type="text"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="Ex: Carrier, Daikin, Tigre, Prysmian"
                className="w-full text-xs p-2.5 rounded-2xl border border-dark-700 bg-dark-850 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sabrar-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                Preço Unitário de Referência (R$) *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">R$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={referencePrice}
                  onChange={(e) => setReferencePrice(e.target.value)}
                  placeholder="0,00"
                  className="w-full text-xs pl-9 pr-3 py-2.5 rounded-2xl border border-dark-700 bg-dark-850 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sabrar-500 font-bold"
                  required
                />
              </div>
            </div>
          </div>

          {/* Estoques: Físico Inicial e Mínimo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                Estoque Físico Inicial (Almoxarifado)
              </label>
              <input
                type="number"
                min="0"
                value={stockPhysical}
                onChange={(e) => setStockPhysical(e.target.value)}
                placeholder="0 (Padrão)"
                className="w-full text-xs p-2.5 rounded-2xl border border-dark-700 bg-dark-850 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sabrar-500 font-medium"
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                Se maior que zero, registrará saldo inicial imediato.
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                Estoque Mínimo de Segurança
              </label>
              <input
                type="number"
                min="0"
                value={stockMinimum}
                onChange={(e) => setStockMinimum(e.target.value)}
                placeholder="10"
                className="w-full text-xs p-2.5 rounded-2xl border border-dark-700 bg-dark-850 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sabrar-500 font-medium"
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                Dispara alerta de compra preventiva ao atingir este saldo.
              </span>
            </div>
          </div>

          {/* Fornecedor Preferencial */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
              Fornecedor Preferencial / Habitual (Opcional)
            </label>
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="w-full text-xs p-2.5 rounded-2xl border border-dark-700 bg-dark-850 text-white focus:outline-none focus:ring-2 focus:ring-sabrar-500"
            >
              <option value="">Selecione ou deixe em aberto para cotação</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.materials_supplied ? `(${s.materials_supplied})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Observações / Especificações */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
              Especificações Técnicas / Aplicação
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Utilizado em ramais secundários de ar condicionado central, diâmetro nominal 200mm..."
              rows={2}
              className="w-full text-xs p-3 rounded-2xl border border-dark-700 bg-dark-850 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sabrar-500"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-3 flex items-center justify-end gap-2 border-t border-dark-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-2xl border border-dark-700 text-slate-300 text-xs font-bold hover:bg-dark-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-sabrar-600 hover:bg-sabrar-500 text-white text-xs font-bold shadow-lg shadow-sabrar-600/30 transition-all disabled:opacity-50 active:scale-95"
            >
              <Check className="w-4 h-4" />
              <span>{loading ? 'Salvando...' : 'Salvar Produto no Catálogo'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
