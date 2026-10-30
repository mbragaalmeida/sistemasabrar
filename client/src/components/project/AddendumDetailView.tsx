import React from 'react';
import { Calendar, Layers, Package, Trash2, User, Wrench } from 'lucide-react';
import { ProjectAddendum } from '../../types';

interface AddendumDetailViewProps {
  addendum: ProjectAddendum;
  onDelete?: (id: number) => void;
  canEdit?: boolean;
}

export const AddendumDetailView: React.FC<AddendumDetailViewProps> = ({
  addendum,
  onDelete,
  canEdit = true
}) => {
  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

  const formatDate = (dateStr: string) => {
    try {
      if (!dateStr) return '';
      const [y, m, d] = dateStr.slice(0, 10).split('-');
      return `${d}/${m}/${y}`;
    } catch {
      return dateStr;
    }
  };

  const items = Array.isArray(addendum.items) ? addendum.items : [];
  const services = Array.isArray(addendum.services) ? addendum.services : [];
  const hasPrices = items.some((it: any) => Number(it.unit_price) > 0) || Number(addendum.total_final) > 0;

  return (
    <div className="space-y-4 animate-in fade-in">
      {/* Header Card */}
      <div className="bg-dark-900 border border-dark-750 p-5 rounded-3xl shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-3 py-1 rounded-full text-xs font-black bg-sabrar-500/20 text-sabrar-300 border border-sabrar-500/40">
              Aditivo {addendum.number}
            </span>
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span>Data do Levantamento: <strong>{formatDate(addendum.date)}</strong></span>
            </div>
          </div>
          <h2 className="text-base font-extrabold text-white">{addendum.title}</h2>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            {hasPrices ? (
              <>
                <span className="text-[11px] text-slate-400 block font-medium">Valor Total do Aditivo:</span>
                <span className="text-xl font-black text-sabrar-400">
                  {formatCurrency(addendum.total_final)}
                </span>
              </>
            ) : (
              <>
                <span className="text-[11px] text-slate-400 block font-medium">Levantamento de Escopo:</span>
                <span className="text-sm font-bold text-slate-200">
                  {items.length} material(is) adicionado(s)
                </span>
              </>
            )}
          </div>

          {canEdit && onDelete && (
            <button
              onClick={() => {
                if (window.confirm(`Tem certeza que deseja excluir o Aditivo ${addendum.number}?`)) {
                  onDelete(addendum.id);
                }
              }}
              title="Excluir aditivo"
              className="p-2.5 rounded-xl border border-dark-700 bg-dark-800 text-slate-400 hover:text-rose-400 hover:border-rose-500/40 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Descrição Completa do Levantamento */}
      <div className="bg-dark-900 border border-dark-750 p-5 rounded-3xl shadow-md space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <Layers className="w-4 h-4 text-sabrar-400" />
          Descrição Completa do Levantamento do Aditivo
        </h3>
        <div className="p-4 rounded-2xl bg-dark-850 border border-dark-750 text-xs text-slate-200 leading-relaxed whitespace-pre-line">
          {addendum.description}
        </div>
      </div>

      {/* Lista de Materiais Adicionados */}
      <div className="bg-dark-900 border border-dark-750 p-5 rounded-3xl shadow-md space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Package className="w-4 h-4 text-sabrar-400" />
            Materiais Levantados neste Aditivo ({items.length})
          </h3>
          {hasPrices && (
            <span className="text-xs font-bold text-slate-300">
              Subtotal: {formatCurrency(addendum.total_materials)}
            </span>
          )}
        </div>

        <div className="overflow-x-auto rounded-2xl border border-dark-750">
          <table className="w-full text-left text-xs">
            <thead className="bg-dark-850 text-slate-400 font-bold border-b border-dark-750">
              <tr>
                <th className="p-3">Material</th>
                <th className="p-3 text-center">Qtd</th>
                <th className="p-3 text-center">Unidade</th>
                {hasPrices && (
                  <>
                    <th className="p-3 text-right">Preço Unitário</th>
                    <th className="p-3 text-right">Subtotal</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-800">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={hasPrices ? 5 : 3} className="p-4 text-center text-slate-500">
                    Nenhum material cadastrado neste aditivo.
                  </td>
                </tr>
              ) : (
                items.map((it: any, i: number) => (
                  <tr key={i} className="hover:bg-dark-850/50">
                    <td className="p-3 text-white font-medium">
                      {it.code && (
                        <span className="font-mono text-[10px] text-sabrar-400 mr-2 bg-dark-800 px-1.5 py-0.5 rounded border border-dark-700">
                          {it.code}
                        </span>
                      )}
                      {it.material_name}
                    </td>
                    <td className="p-3 text-center font-bold text-slate-300">{it.quantity}</td>
                    <td className="p-3 text-center uppercase text-slate-400 font-bold">{it.unit}</td>
                    {hasPrices && (
                      <>
                        <td className="p-3 text-right text-slate-300">{formatCurrency(it.unit_price)}</td>
                        <td className="p-3 text-right font-bold text-white">{formatCurrency(it.subtotal || it.quantity * it.unit_price)}</td>
                      </>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Lista de Serviços (se houver) */}
      {services.length > 0 && (
        <div className="bg-dark-900 border border-dark-750 p-5 rounded-3xl shadow-md space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Wrench className="w-4 h-4 text-sabrar-400" />
              Serviços e Mão de Obra do Aditivo ({services.length})
            </h3>
            {hasPrices && (
              <span className="text-xs font-bold text-slate-300">
                Subtotal: {formatCurrency(addendum.total_services)}
              </span>
            )}
          </div>

          <div className="overflow-x-auto rounded-2xl border border-dark-750">
            <table className="w-full text-left text-xs">
              <thead className="bg-dark-850 text-slate-400 font-bold border-b border-dark-750">
                <tr>
                  <th className="p-3">Serviço</th>
                  <th className="p-3 text-center">Qtd</th>
                  <th className="p-3 text-center">Unidade</th>
                  {hasPrices && (
                    <>
                      <th className="p-3 text-right">Preço Unitário</th>
                      <th className="p-3 text-right">Subtotal</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-800">
                {services.map((sv: any, i: number) => (
                  <tr key={i} className="hover:bg-dark-850/50">
                    <td className="p-3 text-white font-medium">{sv.service_name}</td>
                    <td className="p-3 text-center font-bold text-slate-300">{sv.quantity}</td>
                    <td className="p-3 text-center uppercase text-slate-400">{sv.unit}</td>
                    {hasPrices && (
                      <>
                        <td className="p-3 text-right text-slate-300">{formatCurrency(sv.unit_price)}</td>
                        <td className="p-3 text-right font-bold text-white">{formatCurrency(sv.subtotal || sv.quantity * sv.unit_price)}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
