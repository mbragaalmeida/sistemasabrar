import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw, X, Search, AlertCircle, CheckCircle, Package, ArrowRight } from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

interface SubstituteMaterialModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: any;
  item: any;
  onSuccess: () => void;
}

export const SubstituteMaterialModal: React.FC<SubstituteMaterialModalProps> = ({
  isOpen,
  onClose,
  request,
  item,
  onSuccess
}) => {
  const { currentUser } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [selectedMaterial, setSelectedMaterial] = useState<any | null>(null);
  const [quantity, setQuantity] = useState<number>(item?.quantity_requested || 1);
  const [reason, setReason] = useState('');
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<any>(null);

  useEffect(() => {
    if (item) {
      setQuantity(item.quantity_requested || 1);
      setSearchQuery('');
      setSelectedMaterial(null);
      setReason('');
      setError(null);
    }
  }, [item, isOpen]);

  if (!isOpen || !item) return null;

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setSelectedMaterial(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!val.trim()) {
      setSuggestions([]);
      return;
    }
    setLoadingSuggestions(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await api.autocompleteMaterials(val.trim());
        setSuggestions(results || []);
      } catch (err) {
        console.error('Erro na busca de materiais:', err);
      } finally {
        setLoadingSuggestions(false);
      }
    }, 200);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMaterial) {
      setError('Por favor, selecione o material substituto no catálogo.');
      return;
    }
    if (!reason.trim()) {
      setError('Por favor, informe a justificativa técnica para a troca deste material.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await api.createMaterialSubstitution({
        requestItemId: item.id,
        requestId: request.id,
        substituteMaterialId: selectedMaterial.id,
        quantity: Number(quantity) || item.quantity_requested,
        reason: reason.trim(),
        userId: currentUser?.id
      });
      alert('Solicitação de troca enviada com sucesso! Uma notificação foi enviada para aprovação dos Administradores, Sabrina ou Emily.');
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Erro ao solicitar troca de material:', err);
      setError(err.message || 'Erro ao registrar solicitação de troca');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-sm animate-in fade-in overflow-y-auto">
      <div className="w-full max-w-xl bg-dark-900 rounded-3xl border border-dark-750 shadow-2xl overflow-hidden flex flex-col my-auto">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-dark-850 border-b border-dark-750 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-950/80 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-extrabold text-base text-white">Solicitar Troca de Material</h2>
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
          <div className="p-3 bg-dark-850 rounded-2xl border border-dark-700 text-slate-300 flex justify-between items-center flex-wrap gap-2">
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Solicitação / Obra</span>
              <span className="font-bold text-white text-xs">{request.code} — {request.project_name}</span>
            </div>
            <div className="text-right">
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Solicitante</span>
              <span className="text-slate-300">{request.requested_by_name}</span>
            </div>
          </div>

          {/* Material Original Solicitado */}
          <div className="p-3.5 bg-dark-950 rounded-2xl border border-dark-700">
            <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">
              Material Solicitado Originalmente (A Substituir)
            </div>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2.5">
                <Package className="w-4 h-4 text-slate-500 shrink-0" />
                <div>
                  <span className="font-bold text-white text-xs block">{item.material_name}</span>
                  <span className="text-[11px] text-slate-400 font-mono">Código: {item.material_code || '—'}</span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[11px] font-bold text-amber-400 bg-amber-950/60 border border-amber-600/40 px-2 py-0.5 rounded">
                  Qtd: {item.quantity_requested} {item.material_unit || 'un'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center my-1 text-slate-500">
            <ArrowRight className="w-5 h-5 rotate-90 sm:rotate-0 text-amber-400" />
          </div>

          {/* Seleção do Material Substituto */}
          <div className="space-y-1.5">
            <label className="block text-slate-300 font-bold text-xs">
              Selecionar Novo Material Substituto *
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={selectedMaterial ? selectedMaterial.name : searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Pesquisar por nome ou código na base SABRAR..."
                className="w-full bg-dark-850 text-white placeholder-slate-500 text-xs rounded-xl pl-9 pr-4 py-2.5 border border-dark-700 focus:outline-none focus:border-amber-500"
              />
              {selectedMaterial && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedMaterial(null);
                    setSearchQuery('');
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Sugestões do Autocomplete */}
            {suggestions.length > 0 && !selectedMaterial && (
              <div className="max-h-48 overflow-y-auto bg-dark-850 border border-dark-700 rounded-2xl shadow-xl divide-y divide-dark-750">
                {suggestions.map((sug) => (
                  <button
                    key={sug.id}
                    type="button"
                    onClick={() => {
                      setSelectedMaterial(sug);
                      setSuggestions([]);
                    }}
                    className="w-full text-left p-2.5 hover:bg-dark-800 transition-colors flex items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <div className="font-bold text-white">{sug.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {sug.code} • Unid: {sug.unit}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[10px] text-emerald-400 bg-emerald-950/60 border border-emerald-600/30 px-1.5 py-0.5 rounded">
                        Estoque: {sug.stock_available ?? sug.stock_physical ?? 0}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {loadingSuggestions && (
              <div className="text-[11px] text-slate-400 py-1 italic">Buscando materiais...</div>
            )}
          </div>

          {/* Quantidade Substituta */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-bold text-xs mb-1">
                Quantidade a Entregar *
              </label>
              <input
                type="number"
                step="any"
                min="0.01"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="w-full bg-dark-850 text-white font-bold text-xs rounded-xl px-3 py-2 border border-dark-700 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-bold text-xs mb-1">
                Unidade
              </label>
              <input
                type="text"
                disabled
                value={selectedMaterial?.unit || item.material_unit || 'un'}
                className="w-full bg-dark-900 text-slate-400 text-xs rounded-xl px-3 py-2 border border-dark-750 cursor-not-allowed"
              />
            </div>
          </div>

          {/* Justificativa / Motivo */}
          <div className="space-y-1">
            <label className="block text-slate-300 font-bold text-xs">
              Justificativa Técnica para a Troca *
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: Falta de estoque temporária da bitola original. Substituindo por marca homologada compatível disponível no almoxarifado..."
              className="w-full bg-dark-850 text-white placeholder-slate-500 text-xs rounded-xl p-3 border border-dark-700 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Alerta de Autorização */}
          <div className="p-3 bg-amber-950/40 border border-amber-600/40 rounded-2xl flex items-start gap-2 text-amber-300 text-[11px] leading-relaxed">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <strong>Processo de Governança:</strong> A troca de itens do romaneio necessita de autorização prévia da Direção ou Compras (Sabrina, Emily ou Administradores). O material original só será trocado após a aprovação formal no sistema.
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
              disabled={submitting || !selectedMaterial || !reason.trim()}
              className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold transition-all shadow-md shadow-amber-600/30 disabled:opacity-50 flex items-center gap-1.5 active:scale-95"
            >
              <CheckCircle className="w-4 h-4" />
              <span>{submitting ? 'Enviando...' : 'Solicitar Autorização de Troca'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
