import React, { useState, useEffect, useRef } from 'react';
import { X, Search, Link2, Package, Check, Sparkles, FileSpreadsheet, Loader2, ArrowRight } from 'lucide-react';
import { api } from '../../services/api';

interface LinkMaterialModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: any;
  onLink: (material: any, spreadsheetName: string) => Promise<void> | void;
}

export const LinkMaterialModal: React.FC<LinkMaterialModalProps> = ({
  isOpen,
  onClose,
  item,
  onLink
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [linkingMaterialId, setLinkingMaterialId] = useState<number | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<any>(null);

  // Extrai termos significativos para sugestão inicial de busca inteligente
  const getInitialSearchTerm = (rawName: string) => {
    if (!rawName) return '';
    const STOPWORDS = new Set([
      'de', 'da', 'do', 'das', 'dos', 'para', 'pra', 'com', 'em', 'na', 'no',
      'nas', 'nos', 'a', 'o', 'as', 'os', 'e', 'ou', 'por', 'sem', 'sob', 'sobre',
      '-', '/', '\\', 'tubulacao', 'tubulação'
    ]);
    const cleanTokens = rawName
      .replace(/[()[\]{},;:]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 0 && !STOPWORDS.has(w.toLowerCase()));

    // Retorna os 2 primeiros termos significativos (ex: "Válvula 2.1/2" ou "Válvula bloqueio")
    return cleanTokens.slice(0, 2).join(' ');
  };

  const spreadsheetName = item?.original_spreadsheet_name || item?.material_name || item?.material || '';

  const executeSearch = async (term: string) => {
    const q = term.trim();
    if (!q) {
      setSuggestions([]);
      setLoadingSuggestions(false);
      return;
    }
    setLoadingSuggestions(true);
    try {
      const results = await api.autocompleteMaterials(q);
      setSuggestions(results || []);
    } catch (err) {
      console.error('Erro ao buscar catálogo oficial:', err);
      setSuggestions([]);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  useEffect(() => {
    if (isOpen && item) {
      setLinkingMaterialId(null);
      const initialTerm = getInitialSearchTerm(spreadsheetName);
      setSearchQuery(initialTerm);
      executeSearch(initialTerm);

      setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
          searchInputRef.current.select();
        }
      }, 150);
    } else {
      setSearchQuery('');
      setSuggestions([]);
    }
  }, [isOpen, item]);

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      executeSearch(val);
    }, 200);
  };

  const handleSelectMaterial = async (material: any) => {
    try {
      setLinkingMaterialId(material.id);
      await onLink(material, spreadsheetName);
      onClose();
    } catch (err) {
      console.error('Erro ao confirmar vínculo de material:', err);
      alert('Erro ao vincular material. Tente novamente.');
    } finally {
      setLinkingMaterialId(null);
    }
  };

  if (!isOpen || !item) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm animate-in fade-in overflow-y-auto">
      <div className="w-full max-w-2xl bg-dark-900 rounded-3xl border border-dark-750 shadow-2xl overflow-hidden flex flex-col my-auto max-h-[90vh]">
        {/* Cabeçalho do Modal */}
        <div className="p-5 bg-gradient-to-r from-dark-850 via-dark-800 to-dark-850 border-b border-dark-750 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <Link2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                Vincular ao Catálogo Oficial SABRAR
              </h2>
              <p className="text-xs text-slate-400">
                Selecione o material oficial correspondente. O vínculo será salvo para planilhas futuras.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-dark-750 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo do Modal */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Card do Item Original da Planilha */}
          <div className="bg-amber-500/10 border-2 border-amber-500/30 rounded-2xl p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-400 text-xs font-black tracking-wider uppercase">
                <FileSpreadsheet className="w-4 h-4 text-amber-400" />
                Item Original Importado da Planilha
              </div>
              <span className="text-xs bg-amber-500/20 text-amber-300 font-bold px-2.5 py-0.5 rounded-full border border-amber-500/30">
                {item.quantity} {item.unit || 'und'}
              </span>
            </div>

            <div className="text-sm font-black text-white break-words leading-snug">
              "{spreadsheetName}"
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-amber-500/20 text-xs text-slate-300">
              <span>
                Custo Unit. Planilha: <strong className="text-white font-mono">R$ {Number(item.unit_price !== undefined ? item.unit_price : (item.unitPrice || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
              </span>
              <span>
                Subtotal Custo Base: <strong className="text-emerald-400 font-mono font-bold">R$ {Number(item.subtotal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-[11px] text-amber-300/80 pt-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>O sistema preservará integralmente os preços e quantidades da planilha e salvará este nome como alias.</span>
            </div>
          </div>

          {/* Campo de Busca no Catálogo */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
              <span>Pesquisar no Catálogo SABRAR:</span>
              <span className="text-[11px] text-slate-500 font-normal">Digite fragmentos como "válvula", bitola ou código</span>
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (suggestions.length > 0) {
                      handleSelectMaterial(suggestions[0]);
                    }
                  }
                }}
                placeholder="Ex: válvula bloqueio, esfera 2.1/2, MAT-000..."
                className="w-full bg-dark-850 border-2 border-dark-700 focus:border-sabrar-500 text-white rounded-2xl pl-10 pr-10 py-2.5 text-sm outline-none transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    executeSearch('');
                    if (searchInputRef.current) searchInputRef.current.focus();
                  }}
                  className="absolute right-3 top-3 text-slate-400 hover:text-white p-0.5 rounded-lg"
                  title="Limpar busca"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Lista de Resultados */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-400 px-1">
              <span>
                {loadingSuggestions
                  ? 'Buscando materiais no catálogo...'
                  : `${suggestions.length} material(is) encontrado(s)`}
              </span>
              {loadingSuggestions && <Loader2 className="w-3.5 h-3.5 animate-spin text-sabrar-400" />}
            </div>

            <div className="divide-y divide-dark-800 border border-dark-750 rounded-2xl bg-dark-850/60 overflow-hidden max-h-72 overflow-y-auto">
              {suggestions.length === 0 && !loadingSuggestions && (
                <div className="p-8 text-center space-y-2">
                  <Package className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="text-xs font-semibold text-slate-400">
                    Nenhum material encontrado com o termo "{searchQuery}".
                  </p>
                  <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                    Tente digitar palavras mais curtas (ex: apenas a bitola "2.1/2" ou tipo "válvula") ou o código [MAT-...].
                  </p>
                </div>
              )}

              {suggestions.map((mat) => {
                const isSelected = linkingMaterialId === mat.id;
                return (
                  <div
                    key={mat.id}
                    className="p-3 hover:bg-dark-800 transition-colors flex items-center justify-between gap-3 group"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-11 h-11 rounded-xl bg-dark-800 border border-dark-700 overflow-hidden flex items-center justify-center shrink-0">
                        {mat.image_url ? (
                          <img
                            src={mat.image_url}
                            alt={mat.name}
                            className="w-full h-full object-contain p-0.5 group-hover:scale-105 transition-transform"
                          />
                        ) : (
                          <Package className="w-5 h-5 text-slate-500" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-[10px] font-bold text-sabrar-400 bg-dark-800 border border-dark-700 px-1.5 py-0.5 rounded">
                            {mat.code}
                          </span>
                          <span className="text-[10px] font-semibold text-slate-400 bg-dark-850 border border-dark-750 px-1.5 py-0.5 rounded">
                            {mat.category}
                          </span>
                          <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-1.5 py-0.5 rounded">
                            {mat.unit}
                          </span>
                        </div>
                        <div className="text-xs font-bold text-white group-hover:text-sabrar-300 transition-colors mt-0.5 line-clamp-1">
                          {mat.name}
                        </div>
                        {mat.synonyms && (
                          <div className="text-[10px] text-slate-400 italic truncate mt-0.5">
                            Sinônimos: {mat.synonyms}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <div className="text-xs font-black text-sabrar-400 font-mono">
                          R$ {Number(mat.reference_price || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          /{mat.unit || 'und'}
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={isSelected || linkingMaterialId !== null}
                        onClick={() => handleSelectMaterial(mat)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md hover:shadow-emerald-600/30 active:scale-95 transition-all disabled:opacity-50"
                      >
                        {isSelected ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Vinculando...</span>
                          </>
                        ) : (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Vincular</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Rodapé do Modal */}
        <div className="p-4 bg-dark-850 border-t border-dark-750 flex items-center justify-between text-xs text-slate-400">
          <span>Pressione <kbd className="px-1.5 py-0.5 rounded bg-dark-800 border border-dark-700 text-slate-300 font-mono text-[10px]">ESC</kbd> para fechar ou <kbd className="px-1.5 py-0.5 rounded bg-dark-800 border border-dark-700 text-slate-300 font-mono text-[10px]">Enter</kbd> no primeiro resultado.</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-dark-750 font-bold transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
};
