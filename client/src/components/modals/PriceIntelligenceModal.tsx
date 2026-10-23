import React, { useState, useEffect } from 'react';
import { DollarSign, X, TrendingUp, TrendingDown, Clock, ShieldCheck, Award, Calendar, Building2, Package, Tag } from 'lucide-react';
import { api } from '../../services/api';

interface PriceIntelligenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  materialId?: number | null;
  materialName?: string;
  materialCode?: string;
  materialUnit?: string;
}

export const PriceIntelligenceModal: React.FC<PriceIntelligenceModalProps> = ({
  isOpen,
  onClose,
  materialId,
  materialName,
  materialCode,
  materialUnit
}) => {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && materialId) {
      loadIntelligence();
    }
  }, [isOpen, materialId]);

  const loadIntelligence = async () => {
    if (!materialId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.getPriceIntelligence(materialId);
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar inteligência de preços.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const mat = data?.material;
  const intel = data?.intelligence;
  const purchases = data?.purchases || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-xs animate-fadeIn">
      <div className="w-full max-w-3xl bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-750 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-slate-50 dark:bg-dark-850 border-b border-slate-200 dark:border-dark-750 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-teal-100 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400 flex items-center justify-center border border-teal-300 dark:border-teal-500/30">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>Histórico & Inteligência de Preços</span>
                {mat?.code && (
                  <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 font-bold">
                    {mat.code}
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-md">
                {mat ? mat.name : 'Carregando insumo...'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400">
              Consultando compras anteriores e balizadores de mercado...
            </div>
          ) : error ? (
            <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 text-rose-800 text-xs rounded-2xl">
              {error}
            </div>
          ) : (
            <>
              {/* Balizadores de Preço (Idêntico ao Print 1 do documento) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {/* 1. Último preço autorizado */}
                <div className="p-3 bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700/60 rounded-2xl space-y-1">
                  <div className="text-[10px] uppercase font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Último preço autorizado</span>
                  </div>
                  <div className="text-base font-black text-emerald-900 dark:text-emerald-200">
                    R$ {Number(intel?.ultimo_preco_autorizado || 0).toFixed(2).replace('.', ',')}
                  </div>
                  <div className="text-[10px] text-emerald-700 dark:text-emerald-400 truncate">
                    {intel?.ultimo_preco_autorizado_fornecedor || 'Base / Autorizado'}
                  </div>
                </div>

                {/* 2. Último preço negociado */}
                <div className="p-3 bg-sky-50/70 dark:bg-sky-950/40 border border-sky-300 dark:border-sky-700/60 rounded-2xl space-y-1">
                  <div className="text-[10px] uppercase font-bold text-sky-800 dark:text-sky-300 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                    <span>Último preço</span>
                  </div>
                  <div className="text-base font-black text-sky-900 dark:text-sky-200">
                    R$ {Number(intel?.ultimo_preco || 0).toFixed(2).replace('.', ',')}
                  </div>
                  <div className="text-[10px] text-sky-700 dark:text-sky-400 truncate">
                    {intel?.ultimo_preco_fornecedor || 'Último pedido'}
                  </div>
                </div>

                {/* 3. Melhor preço (menor das 10 últimas) */}
                <div className="p-3 bg-amber-50/70 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 rounded-2xl space-y-1">
                  <div className="text-[10px] uppercase font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1">
                    <Award className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>Melhor preço</span>
                  </div>
                  <div className="text-base font-black text-amber-900 dark:text-amber-200">
                    R$ {Number(intel?.melhor_preco || 0).toFixed(2).replace('.', ',')}
                  </div>
                  <div className="text-[10px] text-amber-700 dark:text-amber-400 truncate">
                    {intel?.melhor_preco_fornecedor || 'Melhor das 10 compras'}
                  </div>
                </div>

                {/* 4. Preço orçado de referência */}
                <div className="p-3 bg-slate-50 dark:bg-dark-800 border border-slate-200 dark:border-dark-700 rounded-2xl space-y-1">
                  <div className="text-[10px] uppercase font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                    <Tag className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span>Preço orçado</span>
                  </div>
                  <div className="text-base font-black text-slate-800 dark:text-white">
                    R$ {Number(intel?.preco_orcado || 0).toFixed(2).replace('.', ',')}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">
                    Base Central SABRAR
                  </div>
                </div>
              </div>

              {/* Explicações Oficiais dos Balizadores (Idêntico ao texto do Print 1) */}
              <div className="p-3 bg-slate-50 dark:bg-dark-850 border border-slate-200 dark:border-dark-750 rounded-2xl text-[11px] text-slate-600 dark:text-slate-300 space-y-1">
                <p>
                  • <strong>Último preço autorizado:</strong> Preço negociado no pedido de compra mais recente para esse insumo que já foi <u>autorizado pela gestão</u>.
                </p>
                <p>
                  • <strong>Último preço:</strong> Preço negociado no pedido mais recente, independentemente da situação de autorização.
                </p>
                <p>
                  • <strong>Melhor preço:</strong> O menor valor unitário registrado entre os 10 pedidos mais recentes deste material.
                </p>
              </div>

              {/* Tabela de Compras Anteriores */}
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span>Histórico de Compras Deste Material ({purchases.length})</span>
                  <span className="text-[11px] text-slate-500">Unidade: {mat?.unit || 'un'}</span>
                </h3>

                {purchases.length === 0 ? (
                  <div className="p-6 bg-slate-50 dark:bg-dark-850 rounded-2xl text-center text-xs text-slate-400 border border-slate-200 dark:border-dark-750">
                    Nenhuma compra anterior registrada no sistema para este material. O preço balizador utilizado é o Preço Orçado da Base Central.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-dark-750">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 dark:bg-dark-800 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-dark-750">
                        <tr>
                          <th className="p-2.5">Data</th>
                          <th className="p-2.5">Código</th>
                          <th className="p-2.5">Fornecedor</th>
                          <th className="p-2.5">Obra</th>
                          <th className="p-2.5 text-right">Qtd</th>
                          <th className="p-2.5 text-right">Preço Un.</th>
                          <th className="p-2.5 text-right">Total</th>
                          <th className="p-2.5 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-dark-800 text-slate-700 dark:text-slate-200">
                        {purchases.map((p: any) => (
                          <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-dark-800/50">
                            <td className="p-2.5 whitespace-nowrap">
                              {new Date(p.purchase_date).toLocaleDateString('pt-BR')}
                            </td>
                            <td className="p-2.5 font-mono font-bold text-teal-700 dark:text-teal-400">
                              {p.code}
                            </td>
                            <td className="p-2.5 font-bold truncate max-w-[140px]">
                              {p.supplier_name || 'Diversos'}
                            </td>
                            <td className="p-2.5 truncate max-w-[130px] text-slate-500">
                              {p.project_name || 'Geral'}
                            </td>
                            <td className="p-2.5 text-right font-medium">
                              {p.quantity} {p.unit || mat?.unit}
                            </td>
                            <td className="p-2.5 text-right font-bold text-slate-900 dark:text-white">
                              R$ {Number(p.unit_price).toFixed(2).replace('.', ',')}
                            </td>
                            <td className="p-2.5 text-right font-bold">
                              R$ {Number(p.total_price).toFixed(2).replace('.', ',')}
                            </td>
                            <td className="p-2.5 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                p.status === 'Recebido'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                              }`}>
                                {p.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-dark-850 border-t border-slate-200 dark:border-dark-750 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold bg-slate-200 dark:bg-dark-750 text-slate-800 dark:text-white hover:bg-slate-300 rounded-xl transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
