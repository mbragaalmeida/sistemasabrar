import React, { useState, useEffect, useRef } from 'react';
import { Search, X, FolderKanban, Package, Truck, ShoppingCart, ArrowRight } from 'lucide-react';
import { api } from '../../services/api';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (page: string, id?: number) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({ isOpen, onClose, onNavigate }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any>({ projects: [], materials: [], suppliers: [], purchases: [], requests: [] });
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setResults({ projects: [], materials: [], suppliers: [], purchases: [], requests: [] });
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSearch = async (val: string) => {
    setQuery(val);
    if (val.trim().length < 2) {
      setResults({ projects: [], materials: [], suppliers: [], purchases: [], requests: [] });
      return;
    }
    setLoading(true);
    try {
      const data = await api.globalSearch(val);
      setResults(data);
    } catch (err) {
      console.error('Erro na busca global:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const totalResults =
    (results.projects?.length || 0) +
    (results.materials?.length || 0) +
    (results.suppliers?.length || 0) +
    (results.purchases?.length || 0) +
    (results.requests?.length || 0);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 sm:pt-20 px-3 bg-black/85 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-dark-900 rounded-3xl shadow-2xl border border-dark-700 overflow-hidden flex flex-col max-h-[80vh] text-slate-100">
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-dark-750 gap-3 bg-dark-850">
          <Search className="w-5 h-5 text-sabrar-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Pesquisar projeto, material, código, fornecedor..."
            className="w-full text-sm sm:text-base outline-none text-white placeholder-slate-500 bg-transparent"
          />
          {query && (
            <button
              onClick={() => handleSearch('')}
              className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-dark-800"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="text-[10px] font-mono px-2 py-1 rounded-lg bg-dark-800 text-slate-400 border border-dark-700 hover:text-white shrink-0"
          >
            ESC
          </button>
        </div>

        {/* Results Container */}
        <div className="overflow-y-auto p-4 space-y-4">
          {loading && (
            <div className="py-8 text-center text-sm text-slate-400">
              <span className="animate-spin inline-block mr-2">⏳</span> Pesquisando na base SABRAR...
            </div>
          )}

          {!loading && query.length >= 2 && totalResults === 0 && (
            <div className="py-8 text-center text-sm text-slate-400">
              Nenhum resultado encontrado para "{query}".
            </div>
          )}

          {!loading && query.length < 2 && (
            <div className="py-6 text-center text-xs text-slate-500">
              Digite pelo menos 2 caracteres para pesquisar em projetos, materiais, estoque e compras.
            </div>
          )}

          {/* Projetos */}
          {results.projects?.length > 0 && (
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-sabrar-400 mb-2 flex items-center gap-1.5">
                <FolderKanban className="w-3.5 h-3.5 text-sabrar-400" />
                Projetos & Obras ({results.projects.length})
              </div>
              <div className="space-y-1">
                {results.projects.map((p: any) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      onNavigate('project-detail', p.id);
                      onClose();
                    }}
                    className="w-full flex items-center justify-between p-2.5 rounded-2xl hover:bg-dark-850 text-left transition-colors group"
                  >
                    <div>
                      <div className="font-semibold text-sm text-white group-hover:text-sabrar-400 transition-colors">
                        {p.code} — {p.name}
                      </div>
                      <div className="text-xs text-slate-400">Cliente: {p.client} • Status: {p.status}</div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-sabrar-400 shrink-0 transition-transform group-hover:translate-x-1" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Materiais */}
          {results.materials?.length > 0 && (
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-sabrar-400 mb-2 flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-sabrar-400" />
                Base de Materiais & Estoque ({results.materials.length})
              </div>
              <div className="space-y-1">
                {results.materials.map((m: any) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      onNavigate('materials');
                      onClose();
                    }}
                    className="w-full flex items-center justify-between p-2.5 rounded-2xl hover:bg-dark-850 text-left transition-colors group"
                  >
                    <div>
                      <div className="font-semibold text-sm text-white group-hover:text-sabrar-400 transition-colors">
                        {m.code} — {m.name}
                      </div>
                      <div className="text-xs text-slate-400">
                        Categoria: {m.category} • Estoque Físico: {m.stock_physical} {m.unit} (Reservado: {m.stock_reserved})
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-sabrar-400 shrink-0 transition-transform group-hover:translate-x-1" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Fornecedores */}
          {results.suppliers?.length > 0 && (
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-sabrar-400 mb-2 flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-sabrar-400" />
                Fornecedores ({results.suppliers.length})
              </div>
              <div className="space-y-1">
                {results.suppliers.map((s: any) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      onNavigate('suppliers');
                      onClose();
                    }}
                    className="w-full flex items-center justify-between p-2.5 rounded-2xl hover:bg-dark-850 text-left transition-colors group"
                  >
                    <div>
                      <div className="font-semibold text-sm text-white group-hover:text-sabrar-400 transition-colors">
                        {s.name}
                      </div>
                      <div className="text-xs text-slate-400">CNPJ: {s.cnpj || 'Não informado'} • Fone: {s.phone || '—'}</div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-sabrar-400 shrink-0 transition-transform group-hover:translate-x-1" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Compras */}
          {results.purchases?.length > 0 && (
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-sabrar-400 mb-2 flex items-center gap-1.5">
                <ShoppingCart className="w-3.5 h-3.5 text-sabrar-400" />
                Fila de Compras ({results.purchases.length})
              </div>
              <div className="space-y-1">
                {results.purchases.map((pur: any) => (
                  <button
                    key={pur.id}
                    onClick={() => {
                      onNavigate('purchases');
                      onClose();
                    }}
                    className="w-full flex items-center justify-between p-2.5 rounded-2xl hover:bg-dark-850 text-left transition-colors group"
                  >
                    <div>
                      <div className="font-semibold text-sm text-white group-hover:text-sabrar-400 transition-colors">
                        {pur.code} — {pur.material_name} ({pur.quantity} un)
                      </div>
                      <div className="text-xs text-slate-400">Status: {pur.status}</div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-sabrar-400 shrink-0 transition-transform group-hover:translate-x-1" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
