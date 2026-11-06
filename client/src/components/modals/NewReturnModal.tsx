import React, { useState, useEffect } from 'react';
import { RotateCcw, Check, X, AlertCircle, RefreshCw, Plus, Trash2, Package, Layers } from 'lucide-react';
import { Project, Material } from '../../types';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { SearchableSelect } from '../common/SearchableSelect';
import { sanitizeUnit } from '../../utils/unitConverter';

interface NewReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  preselectedProjectId?: number;
}

interface QueuedReturnItem {
  id: string; // unique key
  materialId: number;
  material: Material;
  quantity: number;
  reason?: string;
}

export const NewReturnModal: React.FC<NewReturnModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  preselectedProjectId
}) => {
  const { currentUser } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | ''>('');
  
  // Fila de múltiplos materiais para devolução
  const [queuedItems, setQueuedItems] = useState<QueuedReturnItem[]>([]);

  // Inputs para adição de um novo item à lista
  const [currentMaterialId, setCurrentMaterialId] = useState<number | ''>('');
  const [currentQuantity, setCurrentQuantity] = useState<string>('');
  const [currentReason, setCurrentReason] = useState<string>('');

  // Motivo geral padrão
  const [generalReason, setGeneralReason] = useState<string>('Sobra de obra em condição reutilizável');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      api.getProjects().then(setProjects);
      api.getMaterials().then(setMaterials);

      if (preselectedProjectId) {
        setSelectedProjectId(preselectedProjectId);
      } else {
        setSelectedProjectId('');
      }
      setQueuedItems([]);
      setCurrentMaterialId('');
      setCurrentQuantity('');
      setCurrentReason('');
      setGeneralReason('Sobra de obra em condição reutilizável');
      setError(null);
    }
  }, [isOpen, preselectedProjectId]);

  if (!isOpen) return null;

  const selectedCurrentMat = materials.find(m => m.id === Number(currentMaterialId));
  const currentQtyNum = Number(currentQuantity) || 0;

  // Adiciona o material atual preenchido à lista
  const handleAddItemToQueue = () => {
    setError(null);
    if (!currentMaterialId) {
      setError('Selecione um material para adicionar à devolução.');
      return;
    }
    if (currentQtyNum <= 0) {
      setError('Informe uma quantidade válida maior que zero.');
      return;
    }

    const mat = materials.find(m => m.id === Number(currentMaterialId));
    if (!mat) return;

    // Se o item já existir na fila, soma a quantidade
    const existingIndex = queuedItems.findIndex(it => it.materialId === mat.id);
    if (existingIndex >= 0) {
      const updated = [...queuedItems];
      updated[existingIndex].quantity = Math.round((updated[existingIndex].quantity + currentQtyNum) * 100) / 100;
      if (currentReason.trim()) {
        updated[existingIndex].reason = currentReason.trim();
      }
      setQueuedItems(updated);
    } else {
      setQueuedItems(prev => [
        ...prev,
        {
          id: `${mat.id}_${Date.now()}`,
          materialId: mat.id,
          material: mat,
          quantity: currentQtyNum,
          reason: currentReason.trim() || undefined
        }
      ]);
    }

    // Limpa campos do item atual para permitir adicionar o próximo
    setCurrentMaterialId('');
    setCurrentQuantity('');
    setCurrentReason('');
  };

  // Remove um item da fila
  const handleRemoveItem = (id: string) => {
    setQueuedItems(prev => prev.filter(it => it.id !== id));
  };

  // Submissão de todo o lote
  const handleSubmitBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedProjectId) {
      setError('Selecione a Obra de Origem da devolução.');
      return;
    }

    // Se houver um item pendente no form sem ter clicado em "Adicionar", adiciona-o automaticamente
    let finalQueue = [...queuedItems];
    if (currentMaterialId && currentQtyNum > 0) {
      const mat = materials.find(m => m.id === Number(currentMaterialId));
      if (mat) {
        finalQueue.push({
          id: `${mat.id}_${Date.now()}`,
          materialId: mat.id,
          material: mat,
          quantity: currentQtyNum,
          reason: currentReason.trim() || undefined
        });
      }
    }

    if (finalQueue.length === 0) {
      setError('Adicione ao menos um material para confirmar a devolução.');
      return;
    }

    setLoading(true);
    try {
      await api.createBatchReturns({
        projectId: Number(selectedProjectId),
        items: finalQueue.map(item => ({
          materialId: item.materialId,
          quantity: item.quantity,
          reason: item.reason || generalReason || 'Sobra de obra em condição reutilizável'
        })),
        userId: currentUser?.id || 22,
        defaultReason: generalReason || 'Sobra de obra em condição reutilizável'
      });

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao registrar lote de devoluções');
    } finally {
      setLoading(false);
    }
  };

  const totalQueuedItemsCount = queuedItems.length + (currentMaterialId && currentQtyNum > 0 ? 1 : 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-2xl bg-dark-900 rounded-3xl shadow-2xl border border-dark-700 overflow-hidden flex flex-col max-h-[92vh] text-slate-100">
        
        {/* Header */}
        <div className="p-4 sm:p-5 bg-dark-850 border-b border-dark-700 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-950/80 border border-teal-500/40 flex items-center justify-center text-teal-400">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base text-white">Devolução Múltipla de Materiais</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                  Lote Almoxarifado
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Selecione a obra de origem e retorne múltiplos materiais de uma única vez ao estoque físico
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-dark-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmitBatch} className="p-4 sm:p-6 space-y-5 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 bg-rose-950/60 border border-rose-800 text-rose-300 text-xs rounded-xl flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* 1. Obra de Origem (Compartilhada por todos os itens devolvidos) */}
          <div className="p-4 bg-dark-850/80 rounded-2xl border border-dark-750 space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-teal-400">
              1. Obra de Origem *
            </label>
            <SearchableSelect
              value={selectedProjectId}
              onChange={(val) => setSelectedProjectId(val ? Number(val) : '')}
              options={projects.map((p) => ({
                value: p.id,
                label: `${p.code} — ${p.name}`,
                sublabel: `Cliente: ${p.client}`
              }))}
              placeholder="Digite o nome ou código da obra..."
              required
            />
            <p className="text-[11px] text-slate-400">
              Todos os materiais devolvidos abaixo abaterão o consumo real desta obra e retornarão ao Almoxarifado.
            </p>
          </div>

          {/* 2. Seção: Adicionar Material à Fila */}
          <div className="p-4 bg-dark-850/50 rounded-2xl border border-dashed border-dark-700 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-teal-400" />
                2. Adicionar Material à Devolução
              </label>
              <span className="text-[11px] text-slate-500">
                Monte sua listinha item por item
              </span>
            </div>

            {/* Seletor de Material */}
            <div>
              <SearchableSelect
                value={currentMaterialId}
                onChange={(val) => setCurrentMaterialId(val ? Number(val) : '')}
                options={materials.map((m) => ({
                  value: m.id,
                  label: `${m.code} — ${m.name}`,
                  sublabel: `Estoque Físico: ${m.stock_physical} ${m.unit} | Categoria: ${m.category || 'Geral'}`,
                  badge: `${m.stock_physical} ${m.unit}`,
                  keywords: m.synonyms || ''
                }))}
                placeholder="Digite o código, nome ou sinônimo do material..."
              />
            </div>

            {/* Quantidade e Motivo Específico em Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
                  Quantidade que Retorna (+){selectedCurrentMat ? ` em ${sanitizeUnit(selectedCurrentMat.unit)}` : ''} *
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.1"
                  value={currentQuantity}
                  onChange={(e) => setCurrentQuantity(e.target.value)}
                  placeholder="Ex: 50"
                  className="w-full text-sm font-bold p-2.5 rounded-xl border border-dark-700 bg-dark-900 focus:outline-none focus:ring-2 focus:ring-teal-500 text-white placeholder-slate-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
                  Motivo Específico do Item (Opcional)
                </label>
                <input
                  type="text"
                  value={currentReason}
                  onChange={(e) => setCurrentReason(e.target.value)}
                  placeholder="Ex: Não utilizado na prumada"
                  className="w-full text-xs p-2.5 rounded-xl border border-dark-700 bg-dark-900 focus:outline-none focus:ring-2 focus:ring-teal-500 text-white placeholder-slate-500"
                />
              </div>
            </div>

            {/* Pré-visualização do Impacto */}
            {selectedCurrentMat && currentQtyNum > 0 && (
              <div className="p-2.5 bg-dark-900 rounded-xl border border-teal-800/40 text-xs text-teal-300 flex items-center justify-between">
                <span>
                  <strong>Estoque Físico:</strong> {selectedCurrentMat.stock_physical} → <strong className="text-white">{selectedCurrentMat.stock_physical + currentQtyNum} {sanitizeUnit(selectedCurrentMat.unit)}</strong>
                </span>
                <span className="text-[11px] text-slate-400">
                  +{currentQtyNum} {sanitizeUnit(selectedCurrentMat.unit)}
                </span>
              </div>
            )}

            {/* Botão para incluir na lista */}
            <button
              type="button"
              onClick={handleAddItemToQueue}
              disabled={!currentMaterialId || currentQtyNum <= 0}
              className="w-full py-2.5 bg-dark-750 hover:bg-teal-600/30 text-teal-300 hover:text-teal-200 border border-teal-500/40 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4" />
              <span>Adicionar Material à Lista de Devolução</span>
            </button>
          </div>

          {/* 3. Lista / Fila de Materiais para Devolver */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <Layers className="w-4 h-4 text-teal-400" />
                Materiais na Lista de Devolução ({queuedItems.length})
              </label>
              {queuedItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => setQueuedItems([])}
                  className="text-[11px] text-rose-400 hover:text-rose-300 underline cursor-pointer"
                >
                  Limpar lista
                </button>
              )}
            </div>

            {queuedItems.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-500 bg-dark-850/40 rounded-2xl border border-dark-800">
                Nenhum material adicionado ainda. Selecione um item acima e clique em "Adicionar Material à Lista".
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {queuedItems.map((item, idx) => (
                  <div
                    key={item.id}
                    className="p-3 bg-dark-850 rounded-xl border border-dark-750 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-5 h-5 rounded-md bg-dark-750 text-slate-300 text-[10px] font-bold flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <div className="truncate">
                        <div className="font-bold text-white truncate">
                          {item.material.code} — {item.material.name}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Estoque físico: {item.material.stock_physical} → <span className="text-teal-300 font-bold">{item.material.stock_physical + item.quantity} {sanitizeUnit(item.material.unit)}</span>
                          {item.reason && ` • Motivo: ${item.reason}`}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="px-2.5 py-1 rounded-lg bg-teal-950 text-teal-300 border border-teal-800 font-bold font-mono">
                        +{item.quantity} {sanitizeUnit(item.material.unit)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-dark-750 rounded-lg transition-colors cursor-pointer"
                        title="Remover este material da devolução"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Motivo Geral Padrão */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
              Observação / Motivo Geral da Devolução
            </label>
            <input
              type="text"
              value={generalReason}
              onChange={(e) => setGeneralReason(e.target.value)}
              placeholder="Ex: Sobra de materiais após conclusão da etapa de tubulação"
              className="w-full text-xs p-2.5 rounded-xl border border-dark-700 bg-dark-850 focus:outline-none focus:ring-2 focus:ring-teal-500 text-white placeholder-slate-500"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-3 flex items-center justify-between border-t border-dark-750">
            <span className="text-xs text-slate-400">
              {totalQueuedItemsCount > 0 ? `${totalQueuedItemsCount} material(is) pronto(s) para devolução` : 'Nenhum material selecionado'}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-dark-700 bg-dark-850 text-slate-300 text-xs font-bold hover:bg-dark-800 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading || (!selectedProjectId) || (queuedItems.length === 0 && (!currentMaterialId || currentQtyNum <= 0))}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold shadow-md shadow-teal-600/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>
                  {loading
                    ? 'Processando devolução...'
                    : totalQueuedItemsCount > 1
                      ? `Confirmar Devolução de ${totalQueuedItemsCount} Materiais`
                      : 'Confirmar Devolução'}
                </span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
