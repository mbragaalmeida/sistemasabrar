import React, { useState, useEffect } from 'react';
import { History, Shield, Search, Filter } from 'lucide-react';
import { api } from '../services/api';

export const AuditPage: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [selectedEntity, setSelectedEntity] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (selectedEntity) params.entity_type = selectedEntity;

      const data = await api.getAuditLogs(params);
      setLogs(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [selectedEntity]);

  return (
    <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-dark-900 p-4 sm:p-5 rounded-3xl border border-dark-750 shadow-xl">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-sabrar-950/70 border border-sabrar-500/40 flex items-center justify-center text-sabrar-400">
              <History className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Auditoria & Histórico Imutável
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Registro detalhado e imutável de todas as ações operacionais e correções no sistema
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-dark-900 p-3.5 sm:p-4 rounded-3xl border border-dark-750 shadow-md flex items-center gap-2 overflow-x-auto text-xs">
        <div className="flex items-center gap-1 text-slate-400 font-semibold shrink-0">
          <Filter className="w-3.5 h-3.5 text-sabrar-400" />
          <span>Filtrar por Entidade:</span>
        </div>

        <button
          onClick={() => setSelectedEntity('')}
          className={`px-3 py-1 rounded-xl font-bold whitespace-nowrap transition-colors ${
            selectedEntity === '' ? 'bg-sabrar-600 text-white shadow-md shadow-sabrar-600/30' : 'bg-dark-850 text-slate-300 hover:bg-dark-800 border border-dark-700'
          }`}
        >
          Todas
        </button>

        {['PROJETO', 'ORCAMENTO', 'ESTOQUE', 'SOLICITACAO', 'COMPRA', 'DEVOLUCAO'].map((ent) => (
          <button
            key={ent}
            onClick={() => setSelectedEntity(ent)}
            className={`px-3 py-1 rounded-xl font-medium whitespace-nowrap transition-colors ${
              selectedEntity === ent ? 'bg-sabrar-600 text-white font-bold shadow-md shadow-sabrar-600/30' : 'bg-dark-850 text-slate-300 hover:bg-dark-800 border border-dark-700'
            }`}
          >
            {ent}
          </button>
        ))}
      </div>

      {/* Logs Table */}
      <div className="bg-dark-900 rounded-3xl border border-dark-750 overflow-hidden shadow-md">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-dark-850 text-slate-400 font-semibold border-b border-dark-700">
              <tr>
                <th className="p-3">Data / Hora</th>
                <th className="p-3">Usuário</th>
                <th className="p-3">Ação</th>
                <th className="p-3">Entidade</th>
                <th className="p-3">Detalhes da Operação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-750">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-dark-850/60">
                  <td className="p-3 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                    {new Date(log.created_at).toLocaleDateString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </td>
                  <td className="p-3 font-bold text-white whitespace-nowrap">
                    {log.user_name || log.current_user_name || 'Sistema'}
                  </td>
                  <td className="p-3">
                    <span className="font-mono text-[10px] font-bold bg-dark-800 text-sabrar-400 border border-dark-700 px-2 py-0.5 rounded">
                      {log.action}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className="text-[10px] font-bold text-sabrar-400 bg-sabrar-950 px-2 py-0.5 rounded-full border border-sabrar-500/40">
                      {log.entity_type}
                    </span>
                  </td>
                  <td className="p-3 text-slate-300 leading-relaxed max-w-xl">
                    {log.details}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
