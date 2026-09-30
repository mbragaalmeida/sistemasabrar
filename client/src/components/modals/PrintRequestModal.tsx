import React from 'react';
import { MaterialRequest } from '../../types';
import { Printer, X, CheckSquare, ClipboardCheck, Building2, User, Calendar, AlertTriangle, ShieldCheck, Box } from 'lucide-react';

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

  const items = request.items || [];
  const totalItems = items.length;
  const itemsInStock = items.filter(it => (it.quantity_reserved || 0) > 0).length;
  const itemsWithDeficit = items.filter(it => (it.deficit || 0) > 0).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-sm overflow-y-auto animate-in fade-in">
      <div className="w-full max-w-4xl bg-dark-900 rounded-3xl shadow-2xl border border-dark-700 overflow-hidden flex flex-col my-auto max-h-[95vh]">
        {/* Modal Top Bar (Hidden on print) */}
        <div className="no-print p-4 sm:p-5 bg-dark-850 border-b border-dark-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sabrar-950/80 border border-sabrar-500/40 flex items-center justify-center text-sabrar-400">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white">Romaneio de Separação de Materiais</h3>
              <p className="text-xs text-slate-400">
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
              <span>Imprimir Romaneio</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-dark-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Printable Document Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-neutral-900/60 flex justify-center">
          <div
            id="printable-request-slip"
            className="w-full max-w-3xl bg-white text-slate-900 p-6 sm:p-8 rounded-2xl shadow-lg border border-slate-200 text-sm print:m-0 print:p-0 print:border-none print:shadow-none print:rounded-none print:max-w-none"
          >
            {/* Cabeçalho do Romaneio */}
            <div className="border-b-2 border-slate-900 pb-4 mb-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-emerald-700 text-white rounded-xl flex items-center justify-center font-black text-xl tracking-wider">
                    S
                  </div>
                  <div>
                    <h1 className="text-lg font-black tracking-tight text-slate-950 uppercase">
                      SABRAR AR CONDICIONADO & REFRIGERAÇÃO
                    </h1>
                    <p className="text-xs text-slate-600 font-semibold tracking-wide uppercase">
                      Romaneio de Separação e Conferência de Materiais • Almoxarifado Central
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="inline-block px-3 py-1 bg-slate-900 text-white text-xs font-black rounded-lg tracking-wider">
                    {request.code}
                  </div>
                  <div className="text-[11px] text-slate-600 mt-1 font-mono">
                    Emissão: {new Date(request.created_at).toLocaleDateString('pt-BR')} às {new Date(request.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            </div>

            {/* Bloco de Identificação da Obra e Engenharia */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider flex items-center gap-1">
                  <Building2 className="w-3 h-3 text-slate-600" /> Obra / Destino
                </div>
                <div className="font-bold text-slate-900 text-sm mt-0.5">
                  {request.project_name || 'Obra não identificada'}
                </div>
                {request.project_code && (
                  <div className="text-[11px] text-slate-600 font-mono">
                    Código da Obra: {request.project_code}
                  </div>
                )}
              </div>

              <div>
                <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider flex items-center gap-1">
                  <User className="w-3 h-3 text-slate-600" /> Engenheiro(s) Responsável(is)
                </div>
                <div className="font-bold text-slate-900 mt-0.5">
                  {request.responsible_engineer || 'Não atribuído'}
                </div>
                <div className="text-[11px] text-slate-600">
                  Solicitante: <span className="font-medium text-slate-800">{request.requested_by_name || 'Engenharia'}</span>
                </div>
              </div>

              <div>
                <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-slate-600" /> Prioridade & Status
                </div>
                <div className="mt-0.5 flex items-center gap-2">
                  <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                    request.priority === 'Urgente'
                      ? 'bg-rose-100 text-rose-800 border border-rose-300'
                      : request.priority === 'Alta'
                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                      : 'bg-slate-200 text-slate-800'
                  }`}>
                    Prioridade: {request.priority}
                  </span>
                  <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-slate-200 text-slate-800">
                    Status: {request.status}
                  </span>
                </div>
              </div>

              <div>
                <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-slate-600" /> Aprovação do Orçamento / Diretoria
                </div>
                <div className="mt-0.5 text-[11px]">
                  {request.requires_admin_approval ? (
                    request.admin_approval_status === 'Aprovado' ? (
                      <span className="text-emerald-700 font-bold">
                        ✓ Materiais Extras Aprovados por {request.admin_approved_by_name || 'Administrador'}
                      </span>
                    ) : (
                      <span className="text-amber-700 font-bold">
                        ⚠ Aguardando Aprovação de Administrador
                      </span>
                    )
                  ) : (
                    <span className="text-slate-700 font-medium">
                      ✓ Solicitação 100% dentro da cota orçada aprovada
                    </span>
                  )}
                </div>
              </div>

              {request.notes && (
                <div className="sm:col-span-2 pt-1 border-t border-slate-200/80 text-[11px] text-slate-700">
                  <strong>Observações da Engenharia:</strong> {request.notes}
                </div>
              )}
            </div>

            {/* Título da Lista com Instrução para o Almoxarife */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs font-black text-slate-900 uppercase tracking-wider">
                <ClipboardCheck className="w-4 h-4 text-emerald-700" />
                Lista de Separação de Materiais ({totalItems} itens)
              </div>
              <div className="text-[10px] text-slate-500 italic">
                * Marque no quadrante [ ✓ ] ao conferir e separar fisicamente
              </div>
            </div>

            {/* Tabela de Materiais para Impressão */}
            <div className="border border-slate-300 rounded-lg overflow-hidden mb-5">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-300 text-[10px] font-bold uppercase tracking-wider text-slate-700">
                    <th className="py-2.5 px-3 w-16 text-center border-r border-slate-300">
                      [ ✓ ]
                    </th>
                    <th className="py-2.5 px-3 w-24 border-r border-slate-300">Código</th>
                    <th className="py-2.5 px-3 border-r border-slate-300">Descrição do Material</th>
                    <th className="py-2.5 px-2 w-14 text-center border-r border-slate-300">Unid.</th>
                    <th className="py-2.5 px-3 w-20 text-right border-r border-slate-300">Solicitado</th>
                    <th className="py-2.5 px-3 w-20 text-right border-r border-slate-300 bg-emerald-50 text-emerald-950 font-black">
                      Separar
                    </th>
                    <th className="py-2.5 px-3 w-20 text-right border-r border-slate-300 text-rose-900 font-bold">
                      Déficit
                    </th>
                    <th className="py-2.5 px-3 w-28 text-center">Conferido Por</th>
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
                        className={`hover:bg-slate-50/80 transition-colors ${
                          idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'
                        }`}
                      >
                        {/* Caixa de Marcação para o Almoxarife com Caneta */}
                        <td className="py-3 px-3 text-center border-r border-slate-300">
                          <div className="w-6 h-6 mx-auto border-2 border-slate-800 rounded flex items-center justify-center bg-white print:border-slate-900">
                            {/* Espaço em branco para conferência física */}
                          </div>
                        </td>

                        {/* Código do Material */}
                        <td className="py-3 px-3 font-mono text-[11px] text-slate-600 border-r border-slate-300 whitespace-nowrap">
                          {it.material_code || '-'}
                        </td>

                        {/* Descrição do Material */}
                        <td className="py-2.5 px-3 border-r border-slate-300">
                          <div className="flex items-center gap-2">
                            {it.image_url && (
                              <img
                                src={it.image_url}
                                alt=""
                                className="w-8 h-8 object-contain rounded border border-slate-300 shrink-0 bg-white print:w-7 print:h-7"
                              />
                            )}
                            <div>
                              <div className="font-bold text-slate-900">{it.material_name}</div>
                              {it.is_extra && (
                                <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-amber-100 text-amber-900 border border-amber-300">
                                  Extra Obra
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Unidade */}
                        <td className="py-3 px-2 text-center border-r border-slate-300 font-semibold text-slate-700">
                          {it.material_unit || 'un'}
                        </td>

                        {/* Qtd Solicitada */}
                        <td className="py-3 px-3 text-right border-r border-slate-300 font-mono font-bold text-slate-800">
                          {it.quantity_requested}
                        </td>

                        {/* Qtd em Estoque / Para Separar */}
                        <td className="py-3 px-3 text-right border-r border-slate-300 font-mono font-black text-emerald-800 bg-emerald-50/40">
                          {it.quantity_reserved || it.quantity_requested}
                        </td>

                        {/* Qtd Déficit (Compras) */}
                        <td className="py-3 px-3 text-right border-r border-slate-300 font-mono font-bold text-rose-700">
                          {it.deficit && it.deficit > 0 ? it.deficit : '-'}
                        </td>

                        {/* Visto / Rubrica */}
                        <td className="py-3 px-3 text-center">
                          <div className="border-b border-dotted border-slate-400 h-5"></div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Resumo de Quantidades */}
            <div className="grid grid-cols-3 gap-3 p-3 bg-slate-100 rounded-xl mb-6 text-xs text-slate-800 border border-slate-200">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Total de Itens</span>
                <span className="font-black text-sm text-slate-900">{totalItems} materiais</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Com Estoque Imediato</span>
                <span className="font-black text-sm text-emerald-800">{itemsInStock} itens</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Necessidade de Compras</span>
                <span className="font-black text-sm text-rose-800">{itemsWithDeficit} itens</span>
              </div>
            </div>

            {/* Bloco de Assinaturas e Conferência */}
            <div className="pt-4 border-t-2 border-slate-300 print:break-inside-avoid">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-6 text-center">
                Termo de Conferência Física e Entrega de Materiais
              </div>

              <div className="grid grid-cols-2 gap-8 text-center text-xs">
                <div>
                  <div className="border-b border-slate-800 pb-1 mb-1 h-12 flex items-end justify-center">
                    <span className="text-slate-400 text-[10px] italic print:hidden">Assinatura / Carimbo</span>
                  </div>
                  <div className="font-bold text-slate-900">Encarregado do Almoxarifado</div>
                  <div className="text-[10px] text-slate-500">Conferido e Separado no Estoque • Data: ____/____/________</div>
                </div>

                <div>
                  <div className="border-b border-slate-800 pb-1 mb-1 h-12 flex items-end justify-center">
                    <span className="text-slate-400 text-[10px] italic print:hidden">Assinatura / Carimbo</span>
                  </div>
                  <div className="font-bold text-slate-900">Responsável pela Retirada / Transporte</div>
                  <div className="text-[10px] text-slate-500">Recebido e Conferido para a Obra • Data: ____/____/________</div>
                </div>
              </div>

              <div className="mt-6 text-center text-[9px] text-slate-500">
                SABRAR SISTEMAS DE CLIMATIZAÇÃO • Documento gerado em {new Date().toLocaleString('pt-BR')} • Via do Almoxarifado Central
              </div>
            </div>
          </div>
        </div>

        {/* Modal Bottom Bar (Hidden on print) */}
        <div className="no-print p-4 bg-dark-850 border-t border-dark-700 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            Dica: Utilize a caixa de seleção ao lado de cada item para conferir manualmente com prancheta no almoxarifado.
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-dark-700 bg-dark-800 text-slate-300 text-xs font-bold hover:bg-dark-750"
            >
              Fechar
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-5 py-2.5 bg-sabrar-600 hover:bg-sabrar-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-sabrar-600/30 active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir</span>
            </button>
          </div>
        </div>
      </div>

      {/* Global Print Style Injection to guarantee clean slip print */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-request-slip,
          #printable-request-slip * {
            visibility: visible !important;
          }
          #printable-request-slip {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 16px !important;
            box-shadow: none !important;
            border: none !important;
            background: white !important;
            color: black !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};
