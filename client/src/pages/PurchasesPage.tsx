import React, { useState, useEffect } from 'react';
import { ShoppingCart, Check, Filter, Search, Truck, Clock, DollarSign, PackageCheck, AlertTriangle, PlusCircle } from 'lucide-react';
import { Purchase } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { StatusBadge } from '../components/common/StatusBadge';
import { NewPurchaseModal } from '../components/modals/NewPurchaseModal';
import { CreatePurchaseModal } from '../components/modals/CreatePurchaseModal';

export const PurchasesPage: React.FC = () => {
  const { currentUser } = useAuth();
  const [allPurchases, setAllPurchases] = useState<Purchase[]>([]);
  const [statusFilter, setStatusFilter] = useState<'todos' | 'cotacao' | 'comprado' | 'entrega' | 'recebido'>('todos');
  const [loading, setLoading] = useState(true);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);

  const fetchPurchases = async () => {
    setLoading(true);
    try {
      const data = await api.getPurchases();
      setAllPurchases(data);
    } catch (err) {
      console.error('Erro ao carregar compras:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPurchases();
  }, []);

  const totalCount = allPurchases.length;
  const cotacaoCount = allPurchases.filter(p => ['Em cotação', 'Solicitado'].includes(p.status)).length;
  const compradoCount = allPurchases.filter(p => p.status === 'Comprado').length;
  const aguardandoCount = allPurchases.filter(p => p.status === 'Aguardando entrega').length;
  const recebidoCount = allPurchases.filter(p => p.status === 'Recebido').length;

  const filteredPurchases = allPurchases.filter(p => {
    if (statusFilter === 'cotacao') return ['Em cotação', 'Solicitado'].includes(p.status);
    if (statusFilter === 'comprado') return p.status === 'Comprado';
    if (statusFilter === 'entrega') return p.status === 'Aguardando entrega';
    if (statusFilter === 'recebido') return p.status === 'Recebido';
    return true;
  });

  const handleConfirmReceipt = async (purchaseId: number) => {
    if (!window.confirm('Confirmar o recebimento físico deste material? A quantidade será creditada diretamente no estoque físico.')) {
      return;
    }
    try {
      await api.receivePurchase(purchaseId, currentUser?.id);
      await fetchPurchases();
    } catch (err: any) {
      alert(err.message || 'Erro ao confirmar recebimento');
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-dark-900 p-4 sm:p-5 rounded-3xl border border-dark-750 shadow-xl">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-sabrar-950/70 border border-sabrar-500/40 flex items-center justify-center text-sabrar-400">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Compras & Cotações
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Fila de demandas automáticas por déficit de estoque e recebimento de pedidos
          </p>
        </div>

        {/* Botão Cadastrar Compra Manual */}
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-sabrar-600 hover:bg-sabrar-500 text-white text-xs font-bold transition-all shadow-lg shadow-sabrar-600/30 active:scale-95 whitespace-nowrap self-start sm:self-auto"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Nova Solicitação de Compra</span>
        </button>
      </div>


      {/* Filter Pills no formato do Almoxarifado */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        <div className="flex items-center gap-1 text-slate-400 font-semibold shrink-0 mr-1">
          <Filter className="w-3.5 h-3.5 text-sabrar-400" />
          <span>Filtrar fila:</span>
        </div>

        {[
          { id: 'todos', label: 'Todos', count: totalCount },
          { id: 'cotacao', label: 'Em Cotação', count: cotacaoCount },
          { id: 'comprado', label: 'Comprado', count: compradoCount },
          { id: 'entrega', label: 'Aguardando Entrega', count: aguardandoCount },
          { id: 'recebido', label: 'Recebidos no Estoque', count: recebidoCount },
        ].map(f => (
          <button
            key={f.id}
            onClick={() => setStatusFilter(f.id as any)}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              statusFilter === f.id
                ? 'bg-sabrar-600 text-white shadow-md shadow-sabrar-600/30'
                : 'bg-dark-850 text-slate-400 hover:text-white hover:bg-dark-800 border border-dark-700'
            }`}
          >
            <span>{f.label}</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
              statusFilter === f.id ? 'bg-sabrar-800 text-white' : 'bg-dark-750 text-slate-300'
            }`}>
              {f.count}
            </span>
          </button>
        ))}
      </div>

      {loading && (
        <div className="py-20 text-center text-sm text-slate-500">
          Carregando demandas de compras e cotações...
        </div>
      )}

      {/* Purchases List */}
      {!loading && (
        <div className="space-y-3.5">
          {filteredPurchases.length === 0 ? (
            <div className="py-16 text-center bg-dark-900 rounded-3xl border border-dark-750 text-xs text-slate-500">
              Nenhuma demanda de compra encontrada para o filtro selecionado.
            </div>
          ) : (
            filteredPurchases.map((p) => {
              const isReceived = p.status === 'Recebido';
              return (
                <div
                  key={p.id}
                  className="bg-dark-900 p-4 sm:p-5 rounded-3xl border border-dark-750 shadow-md space-y-3 hover:border-sabrar-500/40 transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-xs bg-dark-800 border border-dark-700 px-2 py-0.5 rounded text-sabrar-400">
                        {p.code}
                      </span>
                      <span className="font-extrabold text-sm sm:text-base text-white">
                        {p.material_name}
                      </span>
                      <StatusBadge status={p.priority || 'Normal'} size="sm" />
                      <StatusBadge status={p.status} size="sm" />
                    </div>

                    <div className="text-right">
                      <span className="font-black text-sm text-white">
                        {p.quantity} {p.material_unit}
                      </span>
                      {p.unit_price ? (
                        <span className="text-xs text-slate-400 ml-2">
                          (R$ {p.unit_price.toFixed(2)}/{p.material_unit})
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {/* Informações detalhadas */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-3 bg-dark-850 rounded-2xl border border-dark-700 text-xs">
                    <div>
                      <span className="text-slate-400 block">Obra de Origem:</span>
                      <span className="font-semibold text-white">
                        {p.project_name ? `${p.project_code} — ${p.project_name}` : 'Reposição Estoque'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Fornecedor Selecionado:</span>
                      <span className="font-semibold text-white">
                        {p.supplier_name || 'A definir / Em cotação'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Previsão de Entrega:</span>
                      <span className="font-semibold text-white">
                        {p.expected_delivery_date
                          ? new Date(p.expected_delivery_date).toLocaleDateString('pt-BR')
                          : 'Aguardando confirmação'}
                      </span>
                    </div>
                  </div>

                  {/* Ações de Compras & Almoxarifado */}
                  <div className="pt-2 border-t border-dark-750 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="text-slate-400 text-[11px]">
                      Criado em {new Date(p.created_at).toLocaleDateString('pt-BR')} por {p.buyer_name || 'Automação'}
                    </div>

                    <div className="flex items-center gap-2">
                      {!isReceived && (
                        <>
                          <button
                            onClick={() => {
                              setSelectedPurchase(p);
                              setIsEditModalOpen(true);
                            }}
                            className="px-3 py-1.5 rounded-xl border border-dark-700 bg-dark-850 hover:bg-dark-800 text-slate-200 font-bold transition-colors"
                          >
                            Atualizar Cotação / Fornecedor
                          </button>

                          <button
                            onClick={() => handleConfirmReceipt(p.id)}
                            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-sabrar-600 hover:bg-sabrar-500 text-white font-bold transition-all shadow-md shadow-sabrar-600/30 active:scale-95"
                          >
                            <PackageCheck className="w-4 h-4" />
                            <span>Confirmar Recebimento</span>
                          </button>
                        </>
                      )}

                      {isReceived && (
                        <span className="flex items-center gap-1 text-sabrar-300 font-bold bg-sabrar-950 px-3 py-1 rounded-xl border border-sabrar-500/40">
                          <Check className="w-4 h-4 text-sabrar-400" />
                          <span>Mercadoria Recebida no Estoque</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Modal para atualizar cotação */}
      {selectedPurchase && (
        <NewPurchaseModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setSelectedPurchase(null);
          }}
          purchase={selectedPurchase}
          onSuccess={() => fetchPurchases()}
        />
      )}

      {/* Modal para criar solicitação manual de compra */}
      <CreatePurchaseModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => fetchPurchases()}
      />
    </div>
  );
};

