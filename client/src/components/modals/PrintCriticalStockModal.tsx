import React from 'react';
import { createPortal } from 'react-dom';
import { Printer, X, AlertTriangle, ShieldAlert, Package, CheckSquare } from 'lucide-react';
import { sanitizeUnit } from '../../utils/unitConverter';

const formatCurrencyBR = (val: number) => {
  return (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

interface CriticalMaterialItem {
  id: number;
  code?: string;
  name: string;
  unit?: string;
  category?: string;
  brand?: string;
  stock_physical?: number;
  stock_minimum?: number;
  reference_price?: number;
}

interface PrintCriticalStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  materials: CriticalMaterialItem[];
  selectedCategory?: string;
  filterZeroOnly?: boolean;
}

export const PrintCriticalStockModal: React.FC<PrintCriticalStockModalProps> = ({
  isOpen,
  onClose,
  materials,
  selectedCategory = 'all',
  filterZeroOnly = false
}) => {
  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const now = new Date();
  const emissionDateStr = now.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
  const emissionTimeStr = now.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit'
  });

  // Cálculos consolidados
  const totalItems = materials.length;
  const zeroStockItems = materials.filter(m => Number(m.stock_physical || 0) <= 0).length;
  const totalDeficitUnits = materials.reduce((acc, m) => {
    const min = Number(m.stock_minimum || 0);
    const curr = Number(m.stock_physical || 0);
    return acc + Math.max(1, min - curr);
  }, 0);

  const totalEstimatedCost = materials.reduce((acc, m) => {
    const min = Number(m.stock_minimum || 0);
    const curr = Number(m.stock_physical || 0);
    const deficit = Math.max(1, min - curr);
    const price = Number(m.reference_price || 0);
    return acc + (deficit * price);
  }, 0);

  const categoryLabel = selectedCategory === 'all' ? 'Todas as Categorias' : selectedCategory;

  const modalContent = (
    <div
      id="critical-stock-print-portal"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/80 backdrop-blur-sm overflow-y-auto print-modal-backdrop animate-in fade-in"
    >
      <div className="w-full max-w-5xl bg-white dark:bg-dark-900 rounded-3xl shadow-2xl border border-slate-300 dark:border-dark-700 overflow-hidden flex flex-col my-auto max-h-[95vh] print-modal-container">
        
        {/* Barra superior de controle (Oculta na impressão) */}
        <div className="no-print p-4 sm:p-5 bg-slate-100 dark:bg-dark-850 border-b border-slate-200 dark:border-dark-700 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-100 dark:bg-rose-950/80 border border-rose-300 dark:border-rose-500/40 flex items-center justify-center text-rose-700 dark:text-rose-400">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                Relatório de Reposição de Estoque Crítico
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {totalItems} materiais listados • Filtro: {categoryLabel} {filterZeroOnly ? '(Apenas Zerados)' : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/30 active:scale-95 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir / Salvar PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-dark-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Documento Imprimível */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 md:p-8 bg-slate-200/80 dark:bg-neutral-900 block print-scroll-container">
          <div
            id="printable-critical-stock-slip"
            style={{ backgroundColor: '#ffffff', color: '#0f172a' }}
            className="w-full max-w-4xl mx-auto h-auto bg-white text-slate-900 p-6 sm:p-8 md:p-10 rounded-2xl shadow-xl border border-slate-300 text-xs print:m-0 print:p-0 print:border-none print:shadow-none print:rounded-none print:max-w-none"
          >
            
            {/* Cabeçalho Oficial Sabrar */}
            <div className="border-b-2 border-slate-900 pb-3.5 mb-4 print:pb-2.5 print:mb-3">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div
                    style={{ backgroundColor: '#047857', color: '#ffffff' }}
                    className="w-11 h-11 bg-emerald-700 text-white rounded-xl flex items-center justify-center font-black text-lg tracking-wider shrink-0 shadow-xs"
                  >
                    S
                  </div>
                  <div>
                    <h1 style={{ color: '#0f172a' }} className="text-base sm:text-lg font-black tracking-tight text-slate-950 uppercase leading-tight">
                      SABRAR SISTEMAS DE CLIMATIZAÇÃO
                    </h1>
                    <p style={{ color: '#475569' }} className="text-[11px] text-slate-600 font-semibold tracking-wide uppercase">
                      Relatório & Romaneio de Reposição de Estoque Crítico • Almoxarifado Central
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div
                    style={{ backgroundColor: '#f1f5f9', color: '#0f172a', borderColor: '#0f172a' }}
                    className="inline-block px-3 py-1 bg-slate-100 text-slate-950 border-2 border-slate-900 text-xs font-black rounded-lg tracking-wider font-mono"
                  >
                    ESTOQUE CRÍTICO
                  </div>
                  <div style={{ color: '#475569' }} className="text-[11px] text-slate-600 mt-1 font-mono">
                    Emissão: {emissionDateStr} às {emissionTimeStr}
                  </div>
                </div>
              </div>
            </div>

            {/* Painel de Metadados e Resumo Executivo */}
            <div
              style={{ backgroundColor: '#f8fafc', borderColor: '#cbd5e1', color: '#0f172a' }}
              className="bg-slate-50 border border-slate-300 rounded-xl p-3.5 mb-4 print:p-2.5 print:mb-3 text-xs"
            >
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-2.5 bg-white border border-slate-300 rounded-lg">
                  <span style={{ color: '#64748b' }} className="text-[10px] font-bold uppercase tracking-wider block">
                    Itens em Alerta
                  </span>
                  <div style={{ color: '#0f172a' }} className="text-lg font-black mt-0.5">
                    {totalItems}
                  </div>
                </div>

                <div className="p-2.5 bg-white border border-slate-300 rounded-lg">
                  <span style={{ color: '#be123c' }} className="text-[10px] font-bold uppercase tracking-wider block">
                    Itens Zerados (Esgotados)
                  </span>
                  <div style={{ color: '#be123c' }} className="text-lg font-black mt-0.5">
                    {zeroStockItems}
                  </div>
                </div>

                <div className="p-2.5 bg-white border border-slate-300 rounded-lg">
                  <span style={{ color: '#b45309' }} className="text-[10px] font-bold uppercase tracking-wider block">
                    Déficit Total de Peças
                  </span>
                  <div style={{ color: '#b45309' }} className="text-lg font-black mt-0.5">
                    {totalDeficitUnits.toLocaleString('pt-BR')} <span className="text-xs font-normal">und</span>
                  </div>
                </div>

                <div className="p-2.5 bg-white border border-slate-300 rounded-lg">
                  <span style={{ color: '#047857' }} className="text-[10px] font-bold uppercase tracking-wider block">
                    Custo Estimado de Reposição
                  </span>
                  <div style={{ color: '#047857' }} className="text-lg font-black mt-0.5">
                    {formatCurrencyBR(totalEstimatedCost)}
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-200 flex flex-wrap items-center justify-between text-[11px] gap-2">
                <div style={{ color: '#334155' }}>
                  <strong>Escopo do Relatório:</strong> {categoryLabel} {filterZeroOnly ? '• Somente itens com saldo zero' : '• Itens com saldo físico abaixo da margem mínima'}
                </div>
                <div style={{ color: '#64748b' }} className="italic font-mono">
                  Finalidade: Cotação de Compras e Reabastecimento Almoxarifado
                </div>
              </div>
            </div>

            {/* Título da Tabela */}
            <div className="flex items-center justify-between mb-2">
              <div style={{ color: '#0f172a' }} className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider">
                <Package className="w-4 h-4 text-emerald-700" />
                Planilha de Itens para Reposição Urgente ({totalItems} itens)
              </div>
              <div style={{ color: '#64748b' }} className="text-[10px] font-medium italic">
                * Valores de referência calculados com base no déficit mínimo de segurança
              </div>
            </div>

            {/* Tabela de Materiais Críticos */}
            <div className="border border-slate-300 rounded-xl overflow-x-auto print:overflow-visible mb-5 print:mb-4 bg-white">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr style={{ backgroundColor: '#f1f5f9', color: '#334155' }} className="bg-slate-100 border-b border-slate-300 text-[10px] font-bold uppercase tracking-wider text-slate-700">
                    <th className="py-2 px-2 w-10 text-center border-r border-slate-300">
                      [ ✓ ]
                    </th>
                    <th className="py-2 px-2.5 w-24 text-center border-r border-slate-300 font-mono">
                      Código
                    </th>
                    <th className="py-2 px-3 border-r border-slate-300">
                      Descrição do Material / Insumo
                    </th>
                    <th className="py-2 px-2.5 w-28 border-r border-slate-300">
                      Categoria
                    </th>
                    <th className="py-2 px-2 w-14 text-center border-r border-slate-300">
                      Unid.
                    </th>
                    <th className="py-2 px-2.5 w-20 text-right border-r border-slate-300">
                      Físico
                    </th>
                    <th className="py-2 px-2.5 w-20 text-right border-r border-slate-300">
                      Mínimo
                    </th>
                    <th style={{ backgroundColor: '#fef2f2', color: '#991b1b' }} className="py-2 px-2.5 w-20 text-right border-r border-slate-300 font-black">
                      Déficit
                    </th>
                    <th className="py-2 px-2.5 w-24 text-right border-r border-slate-300">
                      Preço Ref.
                    </th>
                    <th style={{ backgroundColor: '#ecfdf5', color: '#064e3b' }} className="py-2 px-2.5 w-24 text-right font-black">
                      Total Est.
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {materials.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-6 text-center text-slate-500 italic">
                        Nenhum material abaixo da margem mínima para os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    materials.map((m, idx) => {
                      const physical = Number(m.stock_physical || 0);
                      const minimum = Number(m.stock_minimum || 0);
                      const deficit = Math.max(1, Math.round((minimum - physical) * 100) / 100);
                      const price = Number(m.reference_price || 0);
                      const subtotal = deficit * price;
                      const isZero = physical <= 0;

                      return (
                        <tr
                          key={m.id || idx}
                          style={{ backgroundColor: idx % 2 === 1 ? '#f8fafc' : '#ffffff' }}
                          className={idx % 2 === 1 ? 'bg-slate-50/70' : 'bg-white'}
                        >
                          {/* Caixa de conferência para caneta */}
                          <td className="py-2 px-2 text-center border-r border-slate-300 align-middle">
                            <div className="w-3.5 h-3.5 mx-auto border-2 border-slate-600 rounded flex items-center justify-center bg-white print:border-black" />
                          </td>

                          {/* Código */}
                          <td style={{ color: '#334155' }} className="py-2 px-2.5 font-mono text-[11px] border-r border-slate-300 whitespace-nowrap text-center font-bold">
                            {m.code || 'SAB'}
                          </td>

                          {/* Descrição */}
                          <td className="py-2 px-3 border-r border-slate-300">
                            <div style={{ color: '#0f172a' }} className="font-bold text-xs text-slate-900 leading-tight">
                              {m.name}
                            </div>
                            {m.brand && m.brand !== 'SABRAR' && (
                              <div style={{ color: '#64748b' }} className="text-[10px] mt-0.5">
                                Marca: {m.brand}
                              </div>
                            )}
                          </td>

                          {/* Categoria */}
                          <td style={{ color: '#475569' }} className="py-2 px-2.5 text-[11px] border-r border-slate-300 truncate max-w-[120px]">
                            {m.category || 'Geral'}
                          </td>

                          {/* Unidade */}
                          <td style={{ color: '#334155' }} className="py-2 px-2 text-center border-r border-slate-300 font-semibold uppercase text-[11px]">
                            {sanitizeUnit(m.unit)}
                          </td>

                          {/* Estoque Físico */}
                          <td style={{ color: isZero ? '#be123c' : '#b45309' }} className={`py-2 px-2.5 text-right border-r border-slate-300 font-mono font-bold ${isZero ? 'font-black' : ''}`}>
                            {physical}
                          </td>

                          {/* Mínimo */}
                          <td style={{ color: '#334155' }} className="py-2 px-2.5 text-right border-r border-slate-300 font-mono text-slate-700">
                            {minimum}
                          </td>

                          {/* Déficit */}
                          <td style={{ backgroundColor: '#fef2f2', color: '#991b1b' }} className="py-2 px-2.5 text-right border-r border-slate-300 font-mono font-black text-rose-800">
                            -{deficit}
                          </td>

                          {/* Preço Unitário */}
                          <td style={{ color: '#334155' }} className="py-2 px-2.5 text-right border-r border-slate-300 font-mono text-[11px]">
                            {price > 0 ? formatCurrencyBR(price) : 'A cotar'}
                          </td>

                          {/* Subtotal */}
                          <td style={{ backgroundColor: '#f0fdf4', color: '#064e3b' }} className="py-2 px-2.5 text-right font-mono font-bold text-emerald-950">
                            {subtotal > 0 ? formatCurrencyBR(subtotal) : '-'}
                          </td>
                        </tr>
                      );
                    })
                  )}

                  {/* Total Consolidado de Reposição: exibido estritamente uma única vez após o último item na última folha */}
                  {materials.length > 0 && (
                    <tr
                      style={{ backgroundColor: '#f1f5f9', color: '#0f172a', pageBreakInside: 'avoid', breakInside: 'avoid' }}
                      className="bg-slate-100 border-t-2 border-slate-900 font-black text-xs print-avoid-break total-consolidated-row"
                    >
                      <td colSpan={7} className="py-2.5 px-3 text-right uppercase border-r border-slate-300">
                        Total Consolidado de Reposição:
                      </td>
                      <td style={{ backgroundColor: '#fee2e2', color: '#991b1b' }} className="py-2.5 px-2.5 text-right font-mono font-black text-rose-900 border-r border-slate-300">
                        -{totalDeficitUnits.toLocaleString('pt-BR')}
                      </td>
                      <td className="py-2.5 px-2.5 text-right border-r border-slate-300 text-[11px] text-slate-600">
                        {totalItems} itens
                      </td>
                      <td style={{ backgroundColor: '#dcfce7', color: '#064e3b' }} className="py-2.5 px-2.5 text-right font-mono font-black text-emerald-950">
                        {formatCurrencyBR(totalEstimatedCost)}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Bloco de Assinaturas e Aprovação */}
            <div className="pt-4 border-t border-slate-300 grid grid-cols-2 gap-8 print-avoid-break">
              <div>
                <div style={{ color: '#475569' }} className="text-[10px] uppercase font-bold tracking-wider mb-8 text-center">
                  Almoxarifado Central (Conferência Físico)
                </div>
                <div className="border-t border-slate-900 pt-1 text-center">
                  <div style={{ color: '#0f172a' }} className="font-bold text-xs">Responsável pelo Almoxarifado</div>
                  <div style={{ color: '#64748b' }} className="text-[10px] mt-0.5">Assinatura / Data: ____/____/2026</div>
                </div>
              </div>

              <div>
                <div style={{ color: '#475569' }} className="text-[10px] uppercase font-bold tracking-wider mb-8 text-center">
                  Suprimentos & Compras (Aprovação de Cotação)
                </div>
                <div className="border-t border-slate-900 pt-1 text-center">
                  <div style={{ color: '#0f172a' }} className="font-bold text-xs">Comprador / Gestor de Suprimentos</div>
                  <div style={{ color: '#64748b' }} className="text-[10px] mt-0.5">Assinatura / Data: ____/____/2026</div>
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* Regras CSS exclusivas para Impressão */}
      <style>{`
        @media print {
          @page {
            margin: 8mm;
            size: portrait;
          }
          html, body {
            background: #ffffff !important;
            color: #0f172a !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body > *:not(#critical-stock-print-portal) {
            display: none !important;
          }
          #critical-stock-print-portal {
            position: static !important;
            display: block !important;
            padding: 0 !important;
            margin: 0 !important;
            background: #ffffff !important;
            overflow: visible !important;
            height: auto !important;
            max-height: none !important;
            width: 100% !important;
          }
          .print-modal-container,
          .print-scroll-container {
            position: static !important;
            display: block !important;
            border: none !important;
            box-shadow: none !important;
            background: #ffffff !important;
            max-height: none !important;
            height: auto !important;
            width: 100% !important;
            max-width: none !important;
            padding: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
          }
          #printable-critical-stock-slip {
            position: static !important;
            display: block !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
            background: #ffffff !important;
            color: #0f172a !important;
          }
          .no-print {
            display: none !important;
          }
          thead {
            display: table-header-group !important;
          }
          tfoot {
            display: none !important;
          }
          .total-consolidated-row {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .print-avoid-break {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>
    </div>
  );

  return createPortal(modalContent, document.body);
};
