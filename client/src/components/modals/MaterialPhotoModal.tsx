import React, { useState, useEffect } from 'react';
import { X, Image as ImageIcon, Upload, Save, Tag, DollarSign, Package, Check, AlertCircle } from 'lucide-react';
import { Material } from '../../types';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { canUserViewPrices } from '../../utils/permissions';

interface MaterialPhotoModalProps {
  isOpen: boolean;
  onClose: () => void;
  material: Material | null;
  onSuccess?: () => void;
}

export const MaterialPhotoModal: React.FC<MaterialPhotoModalProps> = ({
  isOpen,
  onClose,
  material,
  onSuccess
}) => {
  const { currentUser } = useAuth();
  const canViewPrices = canUserViewPrices(currentUser);
  const [imageUrl, setImageUrl] = useState('');
  const [synonyms, setSynonyms] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (material) {
      setImageUrl(material.image_url || '');
      setSynonyms(material.synonyms || '');
      setIsEditing(false);
      setError(null);
      setSuccessMsg(null);
    }
  }, [material]);

  if (!isOpen || !material) return null;

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      // Atualiza imagem e sinônimos
      await api.updateMaterial(material.id, {
        name: material.name,
        description: material.description,
        category: material.category,
        unit: material.unit,
        brand: material.brand,
        reference_price: material.reference_price,
        supplier_id: material.supplier_id,
        stock_minimum: material.stock_minimum,
        status: material.status,
        synonyms: synonyms.trim() || null,
        image_url: imageUrl.trim() || null
      });

      setSuccessMsg('Material atualizado com sucesso!');
      setIsEditing(false);
      if (onSuccess) onSuccess();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar alterações');
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Converter para base64 para preview imediato e salvamento
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        setImageUrl(reader.result);
        setIsEditing(true);
      }
    };
    reader.readAsDataURL(file);
  };

  const synonymList = synonyms
    ? synonyms.split(',').map(s => s.trim()).filter(Boolean)
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm animate-in fade-in">
      <div 
        className="w-full max-w-2xl bg-dark-900 rounded-3xl shadow-2xl border border-dark-700 overflow-hidden flex flex-col text-slate-100 max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-dark-750 flex items-start justify-between gap-3 bg-dark-850/60">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-mono text-xs font-bold text-sabrar-400 bg-dark-800 border border-dark-700 px-2 py-0.5 rounded">
                {material.code}
              </span>
              <span className="text-[11px] font-semibold text-slate-300 bg-dark-750 px-2 py-0.5 rounded-full border border-dark-700">
                {material.category}
              </span>
              {material.brand && (
                <span className="text-[11px] font-medium text-slate-400">
                  Marca: <strong className="text-slate-200">{material.brand}</strong>
                </span>
              )}
            </div>
            <h2 className="text-base sm:text-lg font-black text-white leading-tight">
              {material.name}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-dark-750 transition-colors shrink-0"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
          {error && (
            <div className="p-3 rounded-2xl bg-rose-950/70 border border-rose-800/80 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-2xl bg-emerald-950/70 border border-emerald-800/80 text-emerald-300 text-xs flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Visualizador da Imagem */}
          <div className="relative group bg-dark-950 rounded-2xl border border-dark-750 overflow-hidden flex items-center justify-center min-h-[220px] max-h-[380px] p-2">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={material.name}
                className="max-h-[340px] w-auto max-w-full object-contain rounded-xl transition-transform duration-200 hover:scale-105"
                onError={() => {
                  setError('Não foi possível carregar a imagem. Verifique o link ou envie outro arquivo.');
                }}
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-slate-500 py-12 gap-2 text-center px-4">
                <ImageIcon className="w-12 h-12 text-slate-600 stroke-[1.5]" />
                <p className="text-xs font-semibold">Nenhuma foto cadastrada para este material</p>
                <p className="text-[11px] text-slate-600">Você pode adicionar uma foto abaixo para evitar duplicidades</p>
              </div>
            )}

            {/* Overlay com botão de trocar foto */}
            <label className="absolute bottom-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-dark-900/90 hover:bg-sabrar-600 text-slate-200 hover:text-white text-xs font-bold border border-dark-700 transition-all cursor-pointer shadow-lg backdrop-blur-sm">
              <Upload className="w-3.5 h-3.5" />
              <span>{imageUrl ? 'Trocar Foto' : 'Adicionar Foto'}</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>

          {/* Dados e Sinônimos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Bloco 1: Estoque & Preço */}
            <div className="bg-dark-850 p-3.5 rounded-2xl border border-dark-750 space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-sabrar-400" />
                <span>Dados de Catálogo</span>
              </div>
              {canViewPrices && (
                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-slate-400">Preço de Referência:</span>
                  <span className="font-extrabold text-white">
                    R$ {Number(material.reference_price || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} /{material.unit}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Estoque Físico:</span>
                <span className="font-bold text-white">{material.stock_physical} {material.unit}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Disponível:</span>
                <span className="font-bold text-sabrar-400">{material.stock_available} {material.unit}</span>
              </div>
            </div>

            {/* Bloco 2: Sinônimos e Nomenclaturas Alternativas */}
            <div className="bg-dark-850 p-3.5 rounded-2xl border border-dark-750 space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-teal-400" />
                  <span>Sinônimos / Apelidos</span>
                </div>
                {!isEditing && (
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="text-[11px] font-bold text-sabrar-400 hover:text-sabrar-300 transition-colors"
                  >
                    Editar
                  </button>
                )}
              </div>

              {!isEditing ? (
                <div>
                  {synonymList.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {synonymList.map((syn, idx) => (
                        <span
                          key={idx}
                          className="bg-dark-800 text-teal-300 px-2 py-0.5 rounded-lg border border-teal-500/30 font-mono text-[11px] font-medium"
                        >
                          {syn}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-500 italic pt-1">
                      Nenhum sinônimo registrado. Clique em Editar para cadastrar outros nomes usados pela equipe.
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-2 pt-1">
                  <textarea
                    value={synonyms}
                    onChange={(e) => setSynonyms(e.target.value)}
                    placeholder="Separe os sinônimos por vírgula (ex: ABAFADOR, PROTETOR AURICULAR)"
                    rows={2}
                    className="w-full text-xs p-2 rounded-xl bg-dark-900 border border-dark-700 text-white placeholder-slate-500 focus:border-sabrar-500 focus:outline-none"
                  />
                  <div className="text-[10px] text-slate-400">
                    Dica: insira termos que os engenheiros costumam usar para encontrar o mesmo item.
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Campo de URL da imagem se estiver editando */}
          {isEditing && (
            <div className="bg-dark-850 p-3.5 rounded-2xl border border-dark-700 space-y-2">
              <label className="text-[11px] font-bold text-slate-300 block">
                Link da Imagem (URL ou caminho interno):
              </label>
              <input
                type="text"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="/materials/image1.png ou https://..."
                className="w-full text-xs p-2 rounded-xl bg-dark-900 border border-dark-700 text-white placeholder-slate-500 focus:border-sabrar-500 focus:outline-none font-mono"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-dark-750 flex items-center justify-between gap-3 bg-dark-850/60">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-dark-800 hover:bg-dark-750 text-slate-300 font-bold text-xs border border-dark-700 transition-colors"
          >
            Fechar
          </button>

          {isEditing && (
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-sabrar-600 hover:bg-sabrar-500 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-sabrar-600/30 transition-all active:scale-95"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Salvando...' : 'Salvar Alterações'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
