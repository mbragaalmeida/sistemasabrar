import React, { useState, useEffect } from 'react';
import { Package, X, Calendar, User, Building, AlertCircle, ArrowUpRight, Clock, ShieldCheck } from 'lucide-react';
import { api } from '../../services/api';

interface StockExitAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  movement: any;
  periodFilter: string;
  onNavigateToStock?: (materialName: string) => void;
}

export const StockExitAuditModal: React.FC<StockExitAuditModalProps> = ({
  isOpen,
  onClose,
  movement,
  periodFilter,
  onNavigateToStock
}) => {
  const [historyMovements, setHistoryMovements] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (!isOpen || !movement) return;

    const loadAuditHistory = async () => {
      setLoadingHistory(true);
      try {
        const res = await api.getStockMovements();
        const allMovements: any[] = Array.isArray(res) ? res : ((res as any)?.movements || []);
        
        // Filter exits of this material
        const filtered = allMovements.filter((m: any) => {
          const isExit = m.type === 'Saída' || m.type === 'saida' || m.type === 'exit' || m.type === 'out';
          const matchMaterial = (m.material_id && movement.material_id && m.material_id === movement.material_id) ||
            ((m.material_name || '').toLowerCase() === (movement.material_name || '').toLowerCase());
          return isExit && matchMaterial;
        });

        setHistoryMovements(filtered);
      } catch (err) {
        console.error('Erro ao buscar histórico de auditoria:', err);
      } finally {
        setLoadingHistory(false);
      }
    };

    loadAuditHistory();
  }, [isOpen, movement]);

  if (!isOpen || !movement) return null;

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return iso;
    }
  };

  const totalPeriodQuantity = historyMovements.reduce((sum, m) => sum + (Number(m.quantity) || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-dark-900 border border-dark-750 rounded-3xl w-full max-w-2xl max-h-[88vh] shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-dark-800 flex items-center justify-between bg-dark-850">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-white">Auditoria de Saída de Estoque</h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-950 text-blue-400 border border-blue-500/40">
                  Auditado
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Detalhamento da movimentação e histórico de saídas do material
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-dark-750 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs">
          {/* Card da Saída Selecionada */}
          <div className="p-4 rounded-2xl bg-dark-850 border border-dark-750 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  Material Movimentado
                </span>
                <h3 className="text-sm font-extrabold text-white mt-0.5">
                  {movement.material_name}
                </h3>
                {movement.material_code && (
                  <span className="inline-block mt-1 font-mono text-[10px] text-sabrar-400 bg-dark-800 px-2 py-0.5 rounded border border-dark-700">
                    Cód: {movement.material_code}
                  </span>
                )}
              </div>

              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Qtd Retirada</span>
                <span className="text-lg font-black text-blue-400 font-mono">
                  -{movement.quantity} {movement.material_unit || 'un'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-dark-750">
              <div className="flex items-center gap-2 text-slate-300">
                <Building className="w-4 h-4 text-slate-400 shrink-0" />
                <div className="truncate">
                  <span className="text-slate-400 block text-[10px]">Obra de Destino:</span>
                  <strong className="text-white">
                    {movement.project_code ? `${movement.project_code} - ` : ''}
                    {movement.project_name || 'Almoxarifado Geral'}
                  </strong>
                </div>
              </div>

              <div className="flex items-center gap-2 text-slate-300">
                <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                <div>
                  <span className="text-slate-400 block text-[10px]">Data e Hora da Saída:</span>
                  <strong className="text-white">{formatDate(movement.created_at)}</strong>
                </div>
              </div>

              {movement.user_name && (
                <div className="flex items-center gap-2 text-slate-300">
                  <User className="w-4 h-4 text-slate-400 shrink-0" />
                  <div>
                    <span className="text-slate-400 block text-[10px]">Responsável pelo Registro:</span>
                    <strong className="text-white">{movement.user_name}</strong>
                  </div>
                </div>
              )}

              {movement.notes && (
                <div className="sm:col-span-2 p-2.5 rounded-xl bg-dark-900 border border-dark-750 text-slate-300 text-[11px]">
                  <span className="text-slate-400 font-bold block mb-0.5">Observações / Motivo:</span>
                  {movement.notes}
                </div>
              )}
            </div>
          </div>

          {/* Histórico Consolidado de Saídas do Material */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-400" />
                Todas as Saídas Registradas deste Material ({historyMovements.length})
              </h4>
              <span className="text-[11px] font-bold text-blue-300">
                Total acumulado: {totalPeriodQuantity} {movement.material_unit || 'un'}
              </span>
            </div>

            {loadingHistory ? (
              <div className="p-6 text-center text-slate-500 text-xs">Carregando histórico...</div>
            ) : historyMovements.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-dark-700 text-center text-slate-500 text-xs">
                Nenhuma outra saída registrada para este material.
              </div>
            ) : (
              <div className="max-h-52 overflow-y-auto rounded-2xl border border-dark-750">
                <table className="w-full text-left text-xs">
                  <thead className="bg-dark-850 text-slate-400 border-b border-dark-750 font-bold">
                    <tr>
                      <th className="p-2.5">Data/Hora</th>
                      <th className="p-2.5">Obra / Destino</th>
                      <th className="p-2.5 text-right">Quantidade</th>
                      <th className="p-2.5">Responsável</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dark-800">
                    {historyMovements.map((h: any) => (
                      <tr
                        key={h.id}
                        className={`hover:bg-dark-850/50 ${h.id === movement.id ? 'bg-blue-950/20' : ''}`}
                      >
                        <td className="p-2.5 text-slate-300">{formatDate(h.created_at)}</td>
                        <td className="p-2.5 text-white font-medium truncate max-w-[200px]">
                          {h.project_code ? `${h.project_code} - ` : ''}
                          {h.project_name || 'Almoxarifado'}
                        </td>
                        <td className="p-2.5 text-right font-bold text-blue-400 font-mono">
                          -{h.quantity} {h.material_unit || 'un'}
                        </td>
                        <td className="p-2.5 text-slate-400">{h.user_name || 'Sistema'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-dark-800 bg-dark-850 flex items-center justify-between">
          {onNavigateToStock && (
            <button
              onClick={() => {
                onClose();
                onNavigateToStock(movement.material_name);
              }}
              className="text-xs font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1.5 transition-colors"
            >
              <span>Ver Estoque Completo deste Item</span>
              <ArrowUpRight className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={onClose}
            className="ml-auto px-4 py-2 rounded-xl bg-dark-750 hover:bg-dark-700 text-white text-xs font-semibold transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
