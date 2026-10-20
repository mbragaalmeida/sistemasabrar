import React from 'react';
import { createPortal } from 'react-dom';
import { MaterialRequest } from '../../types';
import { Printer, X, ClipboardCheck, Building2, User, Calendar, AlertTriangle, ShieldCheck } from 'lucide-react';
import { formatDateBR, formatDateTimeBR } from '../../utils/dateUtils';

interface PrintRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: MaterialRequest | null;
}

export const PrintRequestModal: React.FC<PrintRequestModalProps> = ({
  isOpen,
  onClose,
  request,
}) => {
  if (!isOpen || !request) return null;

  const handlePrint = () => {
    window.print();
  };

  const items = (request.items || []).filter((it: any) => it.item_status !== 'Cancelado');
  const totalItems = items.length;
  const itemsInStock = items.filter(it => (it.quantity_reserved || 0) > 0).length;
  const itemsWithDeficit = items.filter(it => (it.deficit || 0) > 0).length;

  const modalContent = (
    <div
      id="romaneio-print-portal"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/80 backdrop-blur-sm overflow-y-auto print-modal-backdrop animate-in fade-in"
    >
      <div className="w-full max-w-5xl bg-white dark:bg-dark-900 rounded-3xl shadow-2xl border border-slate-300 dark:border-dark-700 overflow-hidden flex flex-col my-auto max-h-[95vh] print-modal-container">
        {/* Modal Top Bar (Hidden on print) */}
        <div className="no-print p-4 sm:p-5 bg-slate-100 dark:bg-dark-850 border-b border-slate-200 dark:border-dark-700 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-sabrar-950/80 border border-emerald-400 dark:border-sabrar-500/40 flex items-center justify-center text-emerald-700 dark:text-sabrar-400">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white">Romaneio de Separação de Materiais</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Solicitação #{request.code} • Obra: {request.project_name || 'N/D'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-sabrar-600 hover:bg-sabrar-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-sabrar-600/30 active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir / Gerar PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-dark-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Printable Document Area (Block layout so white paper card always wraps 100% of content) */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 md:p-8 bg-slate-200/80 dark:bg-neutral-900 block print-scroll-container">
          <div
            id="printable-request-slip"
            style={{ backgroundColor: '#ffffff', color: '#0f172a' }}
            className="w-full max-w-4xl mx-auto h-auto bg-white text-slate-900 p-6 sm:p-8 md:p-10 rounded-2xl shadow-xl border border-slate-300 text-xs print:m-0 print:p-0 print:border-none print:shadow-none print:rounded-none print:max-w-none"
          >
            {/* Cabeçalho do Romaneio */}
            <div className="border-b-2 border-slate-900 pb-3.5 mb-3.5 print:pb-2.5 print:mb-2.5">
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
                      Romaneio de Separação e Conferência de Materiais • Almoxarifado Central
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div
                    style={{ backgroundColor: '#f1f5f9', color: '#0f172a', borderColor: '#0f172a' }}
                    className="inline-block px-3 py-1 bg-slate-100 text-slate-950 border-2 border-slate-900 text-xs font-black rounded-lg tracking-wider font-mono"
                  >
                    Nº {request.code}
                  </div>
                  <div style={{ color: '#475569' }} className="text-[11px] text-slate-600 mt-1 font-mono">
                    Emissão: {formatDateTimeBR(request.created_at)}
                  </div>
                </div>
              </div>
            </div>

            {/* Bloco de Identificação da Obra e Engenharia */}
            <div
              style={{ backgroundColor: '#f8fafc', borderColor: '#cbd5e1', color: '#0f172a' }}
              className="bg-slate-50 border border-slate-300 rounded-xl p-3.5 mb-4 print:p-2.5 print:mb-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs"
            >
              <div>
                <div style={{ color: '#64748b' }} className="text-[10px] uppercase font-bold text-slate-500 tracking-wider flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-slate-600" /> Obra / Destino
                </div>
                <div style={{ color: '#0f172a' }} className="font-extrabold text-slate-900 text-sm mt-0.5">
                  {request.project_name || 'Obra não identificada'}
                </div>
                {request.project_code && (
                  <div style={{ color: '#475569' }} className="text-[11px] text-slate-600 font-mono mt-0.5">
                    Código: <strong style={{ color: '#0f172a' }} className="text-slate-900">{request.project_code}</strong>
                  </div>
                )}
              </div>

              <div>
                <div style={{ color: '#64748b' }} className="text-[10px] uppercase font-bold text-slate-500 tracking-wider flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-slate-600" /> Engenharia & Solicitante
                </div>
                <div style={{ color: '#0f172a' }} className="font-bold text-slate-900 mt-0.5 text-xs">
                  Eng: {request.responsible_engineer || 'Não atribuído'}
                </div>
                <div style={{ color: '#475569' }} className="text-[11px] text-slate-600 mt-0.5">
                  Solicitante: <span style={{ color: '#0f172a' }} className="font-semibold text-slate-900">{request.requested_by_name || 'Engenharia'}</span>
                </div>
              </div>

              <div>
                <div style={{ color: '#64748b' }} className="text-[10px] uppercase font-bold text-slate-500 tracking-wider flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-emerald-700" /> Data para Retirada
                </div>
                <div style={{ color: '#065f46' }} className="font-extrabold text-emerald-800 text-sm mt-0.5 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-emerald-600" />
                  <span>{formatDateBR(request.pickup_date)}</span>
                </div>
                <div style={{ color: '#475569' }} className="text-[11px] text-slate-600 mt-0.5">
                  Prioridade: <strong style={{ color: request.priority === 'Urgente' ? '#be123c' : '#0f172a' }} className={request.priority === 'Urgente' ? 'text-rose-700 font-bold' : 'text-slate-900'}>{request.priority}</strong>
                </div>
              </div>

              <div className="sm:col-span-3 pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-[11px]">
                  <span style={{ color: '#475569' }} className="font-bold text-slate-600">Aprovação Orçamentária:</span>
                  {request.requires_admin_approval ? (
                    request.admin_approval_status === 'Aprovado' ? (
                      <span style={{ color: '#047857' }} className="text-emerald-700 font-bold flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5" /> Materiais Extras Aprovados por {request.admin_approved_by_name || 'Administrador'}
                      </span>
                    ) : (
                      <span style={{ color: '#b45309' }} className="text-amber-700 font-bold flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" /> Aguardando Aprovação de Administrador
                      </span>
                    )
                  ) : (
                    <span style={{ color: '#334155' }} className="text-slate-700 font-medium">
                      ✓ Solicitação 100% dentro da cota orçada aprovada
                    </span>
                  )}
                </div>

                {request.notes && (
                  <div
                    style={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1', color: '#334155' }}
                    className="w-full text-[11px] text-slate-700 bg-white p-2 rounded border border-slate-300"
                  >
                    <strong style={{ color: '#0f172a' }} className="text-slate-900">Observações:</strong> {request.notes}
                  </div>
                )}
              </div>
            </div>

            {/* Título da Lista com Instrução para o Almoxarife */}
            <div className="flex items-center justify-between mb-2">
              <div style={{ color: '#0f172a' }} className="flex items-center gap-1.5 text-xs font-black text-slate-900 uppercase tracking-wider">
                <ClipboardCheck className="w-4 h-4 text-emerald-700" />
                Lista de Separação de Materiais ({totalItems} itens)
              </div>
              <div style={{ color: '#64748b' }} className="text-[10px] text-slate-500 font-medium italic">
                * Assinale no quadrante [ ✓ ] ao conferir e separar cada item
              </div>
            </div>

            {/* Tabela de Materiais para Impressão */}
            <div className="border border-slate-300 rounded-xl overflow-x-auto print:overflow-visible mb-4 print:mb-3 bg-white">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr style={{ backgroundColor: '#f1f5f9', color: '#334155' }} className="bg-slate-100 border-b border-slate-300 text-[10px] font-bold uppercase tracking-wider text-slate-700">
                    <th className="py-2 px-2.5 w-12 text-center border-r border-slate-300">
                      [ ✓ ]
                    </th>
                    <th className="py-2 px-2.5 w-24 text-center border-r border-slate-300">Código</th>
                    <th className="py-2 px-3 border-r border-slate-300">Descrição do Material</th>
                    <th className="py-2 px-2 w-14 text-center border-r border-slate-300">Unid.</th>
                    <th className="py-2 px-2.5 w-20 text-right border-r border-slate-300">Solicitado</th>
                    <th style={{ backgroundColor: '#ecfdf5', color: '#064e3b' }} className="py-2 px-2.5 w-20 text-right border-r border-slate-300 bg-emerald-50 text-emerald-950 font-black">
                      Separar
                    </th>
                    <th style={{ color: '#881337' }} className="py-2 px-2.5 w-20 text-right border-r border-slate-300 text-rose-900 font-bold">
                      Déficit
                    </th>
                    <th className="py-2 px-2.5 w-20 text-center">Visto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-6 text-center text-slate-500 italic">
                        Nenhum material associado a esta solicitação.
                      </td>
                    </tr>
                  ) : (
                    items.map((it, idx) => (
                      <tr
                        key={it.id || idx}
                        style={{ backgroundColor: idx % 2 === 1 ? '#f8fafc' : '#ffffff' }}
                        className={idx % 2 === 1 ? 'bg-slate-50/70' : 'bg-white'}
                      >
                        {/* Caixa de Marcação para o Almoxarife com Caneta */}
                        <td className="py-2 px-2 text-center border-r border-slate-300 align-middle">
                          <div className="w-4 h-4 mx-auto border-2 border-slate-700 rounded flex items-center justify-center bg-white print:border-black">
                            {/* Caixa vazia para conferência com caneta */}
                          </div>
                        </td>

                        {/* Código do Material */}
                        <td style={{ color: '#334155' }} className="py-2 px-2.5 font-mono text-[11px] text-slate-700 border-r border-slate-300 whitespace-nowrap text-center">
                          {it.material_code || '-'}
                        </td>

                        {/* Descrição do Material */}
                        <td className="py-2 px-3 border-r border-slate-300">
                          <div className="flex items-center gap-2">
                            {it.image_url && (
                              <img
                                src={it.image_url}
                                alt=""
                                className="w-6 h-6 object-contain rounded border border-slate-300 shrink-0 bg-white print:hidden"
                              />
                            )}
                            <div className="leading-tight">
                              <div style={{ color: '#0f172a' }} className="font-bold text-slate-900 text-xs">{it.material_name}</div>
                              {it.is_extra && (
                                <span
                                  style={{ backgroundColor: '#fef3c7', color: '#78350f', borderColor: '#f59e0b' }}
                                  className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-amber-100 text-amber-900 border border-amber-400"
                                >
                                  Extra Obra
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Unidade */}
                        <td style={{ color: '#334155' }} className="py-2 px-2 text-center border-r border-slate-300 font-semibold text-slate-700 uppercase">
                          {it.material_unit || 'un'}
                        </td>

                        {/* Qtd Solicitada */}
                        <td style={{ color: '#1e293b' }} className="py-2 px-2.5 text-right border-r border-slate-300 font-mono font-bold text-slate-800">
                          {it.quantity_requested}
                        </td>

                        {/* Qtd em Estoque / Para Separar */}
                        <td style={{ backgroundColor: '#f0fdf4', color: '#064e3b' }} className="py-2 px-2.5 text-right border-r border-slate-300 font-mono font-black text-emerald-900 bg-emerald-50/50">
                          {it.quantity_reserved || it.quantity_requested}
                        </td>

                        {/* Qtd Déficit (Compras) */}
                        <td style={{ color: '#be123c' }} className="py-2 px-2.5 text-right border-r border-slate-300 font-mono font-bold text-rose-700">
                          {it.deficit && it.deficit > 0 ? it.deficit : '-'}
                        </td>

                        {/* Visto / Rubrica */}
                        <td className="py-2 px-2.5 text-center align-middle">
                          <div className="border-b border-dotted border-slate-400 h-4 w-12 mx-auto"></div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Resumo de Quantidades */}
            <div
              style={{ backgroundColor: '#f1f5f9', borderColor: '#cbd5e1', color: '#1e293b' }}
              className="grid grid-cols-3 gap-3 p-3 print:p-2.5 bg-slate-100 rounded-xl mb-5 print:mb-4 text-xs text-slate-800 border border-slate-300"
            >
              <div>
                <span style={{ color: '#64748b' }} className="text-[10px] uppercase font-bold text-slate-500 block">Total de Itens</span>
                <span style={{ color: '#0f172a' }} className="font-black text-sm text-slate-900">{totalItems} materiais</span>
              </div>
              <div>
                <span style={{ color: '#64748b' }} className="text-[10px] uppercase font-bold text-slate-500 block">Com Estoque Imediato</span>
                <span style={{ color: '#065f46' }} className="font-black text-sm text-emerald-800">{itemsInStock} itens</span>
              </div>
              <div>
                <span style={{ color: '#64748b' }} className="text-[10px] uppercase font-bold text-slate-500 block">Necessidade de Compras</span>
                <span style={{ color: '#9f1239' }} className="font-black text-sm text-rose-800">{itemsWithDeficit} itens</span>
              </div>
            </div>

            {/* Bloco de Assinaturas e Conferência */}
            <div className="pt-3 border-t-2 border-slate-300 print-avoid-break">
              <div style={{ color: '#334155' }} className="text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-4 print:mb-3 text-center">
                Termo de Conferência Física e Entrega de Materiais
              </div>

              <div className="grid grid-cols-2 gap-8 text-center text-xs">
                <div>
                  <div className="border-b border-slate-800 pb-1 mb-1 h-10 print:h-8 flex items-end justify-center">
                    <span style={{ color: '#94a3b8' }} className="text-slate-400 text-[10px] italic print:hidden">Assinatura / Carimbo</span>
                  </div>
                  <div style={{ color: '#0f172a' }} className="font-bold text-slate-900">Encarregado do Almoxarifado</div>
                  <div style={{ color: '#64748b' }} className="text-[10px] text-slate-500">Conferido e Separado no Estoque • Data: ____/____/________</div>
                </div>

                <div>
                  <div className="border-b border-slate-800 pb-1 mb-1 h-10 print:h-8 flex items-end justify-center">
                    <span style={{ color: '#94a3b8' }} className="text-slate-400 text-[10px] italic print:hidden">Assinatura / Carimbo</span>
                  </div>
                  <div style={{ color: '#0f172a' }} className="font-bold text-slate-900">Responsável pela Retirada / Transporte</div>
                  <div style={{ color: '#64748b' }} className="text-[10px] text-slate-500">Recebido e Conferido para a Obra • Data: ____/____/________</div>
                </div>
              </div>

              <div style={{ color: '#64748b' }} className="mt-4 print:mt-3 text-center text-[9px] text-slate-500">
                SABRAR SISTEMAS DE CLIMATIZAÇÃO • Documento gerado em {new Date().toLocaleString('pt-BR')} • Via do Almoxarifado Central
              </div>
            </div>
          </div>
        </div>

        {/* Modal Bottom Bar (Hidden on print) */}
        <div className="no-print p-4 bg-slate-100 dark:bg-dark-850 border-t border-slate-200 dark:border-dark-700 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-600 dark:text-slate-400">
            Dica: Utilize a caixa de seleção ao lado de cada item para conferir manualmente com prancheta no almoxarifado.
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 dark:border-dark-700 bg-white dark:bg-dark-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-50 dark:hover:bg-dark-750"
            >
              Fechar
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-5 py-2.5 bg-sabrar-600 hover:bg-sabrar-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-sabrar-600/30 active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir Romaneio</span>
            </button>
          </div>
        </div>
      </div>

      {/* Global Print Style Injection: Hides #root with display:none so ZERO blank pages are generated */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm 10mm;
          }
          html, body {
            height: auto !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            background: #ffffff !important;
            color: #0f172a !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body > *:not(#romaneio-print-portal) {
            display: none !important;
          }
          #romaneio-print-portal {
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
          #printable-request-slip {
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
            display: table-footer-group !important;
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
