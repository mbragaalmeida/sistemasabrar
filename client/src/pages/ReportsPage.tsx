import React, { useState, useEffect } from 'react';
import { BarChart3, FolderKanban, Package, ShoppingCart, Layers, Printer, Download } from 'lucide-react';
import { api } from '../services/api';

// Helper para formatar quantidades com no máximo 1 casa decimal
const formatItemQuantity = (val: number | string | null | undefined): string => {
  if (val === null || val === undefined || val === '') return '0';
  const num = typeof val === 'number' ? val : Number(val);
  if (isNaN(num)) return String(val);
  return num.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
};

export const ReportsPage: React.FC = () => {
  const [activeReport, setActiveReport] = useState<'projetos' | 'materiais' | 'compras' | 'estoque'>('projetos');
  const [projectReport, setProjectReport] = useState<any[]>([]);
  const [materialReport, setMaterialReport] = useState<any[]>([]);
  const [purchaseReport, setPurchaseReport] = useState<any>(null);
  const [stockReport, setStockReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReport();
  }, [activeReport]);

  const loadReport = async () => {
    setLoading(true);
    try {
      if (activeReport === 'projetos') {
        const data = await api.getProjectReports();
        setProjectReport(data);
      } else if (activeReport === 'materiais') {
        const data = await api.getMaterialReports();
        setMaterialReport(data);
      } else if (activeReport === 'compras') {
        const data = await api.getPurchaseReports();
        setPurchaseReport(data);
      } else if (activeReport === 'estoque') {
        const data = await api.getStockReports();
        setStockReport(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-dark-900 p-4 sm:p-5 rounded-3xl border border-dark-750 shadow-xl">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-sabrar-950/70 border border-sabrar-500/40 flex items-center justify-center text-sabrar-400">
              <BarChart3 className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Relatórios Operacionais
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Relatórios gerenciais por Projeto, por Material, Compras e Balanço de Estoque
          </p>
        </div>

        <button
          onClick={handlePrint}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-dark-800 hover:bg-dark-750 text-white text-xs font-bold transition-all border border-dark-700 active:scale-95"
        >
          <Printer className="w-4 h-4 text-sabrar-400" />
          <span>Imprimir / Exportar PDF</span>
        </button>
      </div>

      {/* Subtabs (No-Print) */}
      <div className="no-print flex items-center gap-1.5 bg-dark-900 p-1.5 rounded-2xl border border-dark-750 overflow-x-auto text-xs font-bold text-slate-400">
        <button
          onClick={() => setActiveReport('projetos')}
          className={`px-4 py-2 rounded-xl transition-all whitespace-nowrap ${
            activeReport === 'projetos' ? 'bg-sabrar-600 text-white shadow-md shadow-sabrar-600/30 font-bold' : 'hover:text-white'
          }`}
        >
          Relatório por Projeto
        </button>
        <button
          onClick={() => setActiveReport('materiais')}
          className={`px-4 py-2 rounded-xl transition-all whitespace-nowrap ${
            activeReport === 'materiais' ? 'bg-sabrar-600 text-white shadow-md shadow-sabrar-600/30 font-bold' : 'hover:text-white'
          }`}
        >
          Relatório por Material
        </button>
        <button
          onClick={() => setActiveReport('compras')}
          className={`px-4 py-2 rounded-xl transition-all whitespace-nowrap ${
            activeReport === 'compras' ? 'bg-sabrar-600 text-white shadow-md shadow-sabrar-600/30 font-bold' : 'hover:text-white'
          }`}
        >
          Relatório de Compras
        </button>
        <button
          onClick={() => setActiveReport('estoque')}
          className={`px-4 py-2 rounded-xl transition-all whitespace-nowrap ${
            activeReport === 'estoque' ? 'bg-sabrar-600 text-white shadow-md shadow-sabrar-600/30 font-bold' : 'hover:text-white'
          }`}
        >
          Balanço Geral de Estoque
        </button>
      </div>

      {loading && (
        <div className="py-20 text-center text-sm text-slate-500">
          Gerando relatório da SABRAR...
        </div>
      )}

      {/* 1. RELATÓRIO POR PROJETO */}
      {!loading && activeReport === 'projetos' && (
        <div className="bg-dark-900 rounded-3xl border border-dark-750 overflow-hidden shadow-md">
          <div className="p-4 bg-dark-850 border-b border-dark-750 text-xs font-bold text-white flex justify-between">
            <span>Relatório Analítico por Obra (Orçado vs Consumido)</span>
            <span className="text-slate-400 font-normal">{projectReport.length} obras registradas</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-dark-850 text-slate-400 font-semibold border-b border-dark-700">
                <tr>
                  <th className="p-3">Código / Obra</th>
                  <th className="p-3">Cliente</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-right">Orçamento Final</th>
                  <th className="p-3 text-center">Itens Solicitados</th>
                  <th className="p-3 text-center">Itens Retirados</th>
                  <th className="p-3 text-center">Itens Devolvidos</th>
                  <th className="p-3 text-center font-bold text-white">Consumo Efetivo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-750">
                {projectReport.map((p) => (
                  <tr key={p.projectId} className="hover:bg-dark-850/60">
                    <td className="p-3 font-bold text-white">
                      {p.code} — {p.name}
                    </td>
                    <td className="p-3 text-slate-300">{p.client}</td>
                    <td className="p-3 text-center font-semibold text-sabrar-400">{p.status}</td>
                    <td className="p-3 text-right font-black text-white">
                      R$ {p.budgetFinal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 text-center text-slate-400 font-mono">{formatItemQuantity(p.totalItemsRequested)}</td>
                    <td className="p-3 text-center text-amber-400 font-mono">{formatItemQuantity(p.totalItemsWithdrawn)}</td>
                    <td className="p-3 text-center text-teal-400 font-mono">{formatItemQuantity(p.totalItemsReturned)}</td>
                    <td className="p-3 text-center font-black text-white bg-dark-850 font-mono">
                      {formatItemQuantity(p.totalItemsConsumed)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. RELATÓRIO POR MATERIAL */}
      {!loading && activeReport === 'materiais' && (
        <div className="bg-dark-900 rounded-3xl border border-dark-750 overflow-hidden shadow-md">
          <div className="p-4 bg-dark-850 border-b border-dark-750 text-xs font-bold text-white">
            Relatório de Giro, Estoque e Consumo de Materiais
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-dark-850 text-slate-400 font-semibold border-b border-dark-700">
                <tr>
                  <th className="p-3">Código</th>
                  <th className="p-3">Material</th>
                  <th className="p-3">Categoria</th>
                  <th className="p-3 text-center">Físico</th>
                  <th className="p-3 text-center">Reservado</th>
                  <th className="p-3 text-center font-bold text-sabrar-400">Disponível</th>
                  <th className="p-3 text-center">Consumo Total Obras</th>
                  <th className="p-3 text-center">Devoluções</th>
                  <th className="p-3 text-right">Valuation Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-750">
                {materialReport.map((m) => (
                  <tr key={m.id} className="hover:bg-dark-850/60">
                    <td className="p-3 font-mono font-bold text-sabrar-400">{m.code}</td>
                    <td className="p-3 font-bold text-white">{m.name}</td>
                    <td className="p-3 text-slate-400">{m.category}</td>
                    <td className="p-3 text-center font-mono text-white">{formatItemQuantity(m.stockPhysical)} {m.unit}</td>
                    <td className="p-3 text-center text-amber-400 font-mono">{formatItemQuantity(m.stockReserved)}</td>
                    <td className="p-3 text-center font-bold text-sabrar-400 font-mono">{formatItemQuantity(m.stockAvailable)}</td>
                    <td className="p-3 text-center font-mono font-bold text-white">{formatItemQuantity(m.actualConsumed)} {m.unit}</td>
                    <td className="p-3 text-center font-mono text-teal-400">{formatItemQuantity(m.totalReturned)}</td>
                    <td className="p-3 text-right font-black text-white">
                      R$ {m.stockValuation.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. RELATÓRIO DE COMPRAS */}
      {!loading && activeReport === 'compras' && purchaseReport && (
        <div className="space-y-4">
          <div className="bg-dark-900 rounded-3xl border border-dark-750 p-4 shadow-md">
            <h3 className="font-extrabold text-xs text-slate-400 uppercase tracking-wider mb-3">
              Gastos por Fornecedor (Pedidos Emitidos)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(purchaseReport.supplierSummary || []).map((s: any, idx: number) => (
                <div key={idx} className="p-3.5 bg-dark-850 rounded-2xl border border-dark-700">
                  <div className="font-bold text-white text-xs">{s.supplier_name}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{s.total_orders} pedido(s)</div>
                  <div className="text-base font-black text-sabrar-400 mt-2">
                    R$ {(s.total_spent || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 4. BALANÇO GERAL DE ESTOQUE */}
      {!loading && activeReport === 'estoque' && stockReport && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="p-4 bg-dark-900 border border-sabrar-500/40 rounded-3xl text-center">
              <div className="text-[10px] uppercase font-bold text-sabrar-400">Total de Entradas Físicas</div>
              <div className="text-2xl font-black text-white mt-1">
                {formatItemQuantity(stockReport.balanceSummary?.total_entries || 0)} un
              </div>
            </div>
            <div className="p-4 bg-dark-900 border border-rose-700/60 rounded-3xl text-center">
              <div className="text-[10px] uppercase font-bold text-rose-400">Total Saídas para Obras</div>
              <div className="text-2xl font-black text-white mt-1">
                {formatItemQuantity(stockReport.balanceSummary?.total_exits || 0)} un
              </div>
            </div>
            <div className="p-4 bg-dark-900 border border-teal-700/60 rounded-3xl text-center">
              <div className="text-[10px] uppercase font-bold text-teal-400">Total Devoluções Reintegradas</div>
              <div className="text-2xl font-black text-white mt-1">
                {formatItemQuantity(stockReport.balanceSummary?.total_returns || 0)} un
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
