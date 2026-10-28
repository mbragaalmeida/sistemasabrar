import React, { useState, useEffect } from 'react';
import { X, Wind, Plus, Trash2, AlertCircle, Building2, Calendar, FileText, Check } from 'lucide-react';
import { Project } from '../../types';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

interface NewDuctRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  projects?: Project[];
  defaultProjectId?: number | null;
  initialProjectId?: number | null;
}

interface DuctItemInput {
  itemDescription: string;
  dimension: string;
  unit: string;
  quantityRequested: number;
  notes: string;
}

export const NewDuctRequestModal: React.FC<NewDuctRequestModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  projects: propProjects,
  defaultProjectId,
  initialProjectId
}) => {
  const { currentUser } = useAuth();
  const effectiveDefaultId = initialProjectId || defaultProjectId;
  const [internalProjects, setInternalProjects] = useState<Project[]>(propProjects || []);
  const [projectId, setProjectId] = useState<number | string>(effectiveDefaultId || (propProjects?.[0]?.id || ''));
  const [priority, setPriority] = useState<string>('Normal');
  const [generalNotes, setGeneralNotes] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Carrega projetos se não foram passados por prop
  useEffect(() => {
    if (propProjects && propProjects.length > 0) {
      setInternalProjects(propProjects);
    } else if (isOpen) {
      api.getProjects().then(data => {
        setInternalProjects(data || []);
        if (!projectId && data && data.length > 0) {
          setProjectId(data[0].id);
        }
      }).catch(console.error);
    }
  }, [isOpen, propProjects]);

  const [items, setItems] = useState<DuctItemInput[]>([
    { itemDescription: '', dimension: '', unit: 'm', quantityRequested: 1, notes: '' }
  ]);

  // Atualiza projectId se defaultProjectId/initialProjectId mudar
  React.useEffect(() => {
    if (effectiveDefaultId) setProjectId(effectiveDefaultId);
  }, [effectiveDefaultId]);

  if (!isOpen) return null;

  const handleAddItem = () => {
    setItems(prev => [
      ...prev,
      { itemDescription: '', dimension: '', unit: 'm', quantityRequested: 1, notes: '' }
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      alert('A solicitação precisa ter ao menos um item de duto.');
      return;
    }
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof DuctItemInput, val: any) => {
    setItems(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };
      return copy;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!projectId) {
      setErrorMsg('Selecione a obra de destino.');
      return;
    }

    const validItems = items.filter(it => it.itemDescription.trim() && it.quantityRequested > 0);
    if (validItems.length === 0) {
      setErrorMsg('Informe ao menos um item de duto com descrição e quantidade válida (> 0).');
      return;
    }

    setLoading(true);
    try {
      await api.createDuctRequest({
        projectId: Number(projectId),
        items: validItems,
        priority,
        notes: generalNotes,
        requestedBy: currentUser?.id
      });
      alert('Solicitação de dutos registrada com sucesso! Ela foi enviada para a área de Gestão de Dutos & Autodesk CAMduct (Vinicius Gomes).');
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Erro ao registrar solicitação de dutos:', err);
      setErrorMsg(err.message || 'Erro ao registrar solicitação de dutos.');
    } finally {
      setLoading(false);
    }
  };

  const commonDuctTypes = [
    'Duto Retangular Galvanizado',
    'Curva 90° Retangular',
    'Curva 45° Retangular',
    'Transição Retangular / Circular',
    'Boca de Ar / Colarinho',
    'Duto Circular Spiro',
    'Curva Circular 90°',
    'Redução Concêntrica',
    'Caixa Plenum de Distribuição',
    'Dâmper Gravitacional / Regulagem'
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl my-auto animate-in fade-in zoom-in-95 duration-150">
        
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/60 rounded-t-3xl">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-cyan-100 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400 rounded-2xl border border-cyan-500/20">
              <Wind className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                Nova Solicitação de Dutos
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Demanda enviada diretamente para a área de tagueamento no Autodesk CAMduct
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1">
          {errorMsg && (
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-2xl flex items-center gap-2.5 text-xs text-rose-700 dark:text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Obra e Prioridade */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-emerald-600 dark:text-sabrar-400" />
                Obra Atribuída *
              </label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                required
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
              >
                <option value="">Selecione a Obra...</option>
                {internalProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.code}) {p.client ? ` - ${p.client}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Prioridade
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
              >
                <option value="Normal">Normal</option>
                <option value="Alta">Alta</option>
                <option value="Urgente">Urgente</option>
              </select>
            </div>
          </div>

          {/* Datalist de tipos comuns de dutos */}
          <datalist id="common-duct-types">
            {commonDuctTypes.map((type, idx) => (
              <option key={idx} value={type} />
            ))}
          </datalist>

          {/* Itens de Dutos */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Wind className="w-3.5 h-3.5 text-cyan-500" />
                Itens e Dutos Solicitados ({items.length})
              </label>
              <button
                type="button"
                onClick={handleAddItem}
                className="flex items-center gap-1 text-xs font-bold text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 px-2 py-1 rounded-lg hover:bg-cyan-50 dark:hover:bg-cyan-950/40 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Adicionar Duto
              </button>
            </div>

            <div className="space-y-3">
              {items.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl space-y-2 relative"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      Item #{idx + 1}
                    </span>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="text-slate-400 hover:text-rose-500 p-1 transition-colors"
                        title="Remover este item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                    <div className="sm:col-span-6">
                      <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-0.5">
                        Descrição do Duto / Acessório *
                      </label>
                      <input
                        type="text"
                        list="common-duct-types"
                        value={item.itemDescription}
                        onChange={(e) => handleItemChange(idx, 'itemDescription', e.target.value)}
                        placeholder="Ex: Duto Retangular Galvanizado"
                        required
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-0.5">
                        Dimensões / Seção
                      </label>
                      <input
                        type="text"
                        value={item.dimension}
                        onChange={(e) => handleItemChange(idx, 'dimension', e.target.value)}
                        placeholder="Ex: 400x250mm"
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
                      />
                    </div>

                    <div className="sm:col-span-3 grid grid-cols-2 gap-1.5">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-0.5">
                          Unidade
                        </label>
                        <select
                          value={item.unit}
                          onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
                        >
                          <option value="m">Metros (m)</option>
                          <option value="peça">Peças (un)</option>
                          <option value="kg">Quilos (kg)</option>
                          <option value="barra">Barras</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-0.5">
                          Qtde *
                        </label>
                        <input
                          type="number"
                          min="0.1"
                          step="any"
                          value={item.quantityRequested || ''}
                          onChange={(e) => handleItemChange(idx, 'quantityRequested', parseFloat(e.target.value) || 0)}
                          required
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-1.5 text-xs text-slate-900 dark:text-white font-bold focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <input
                      type="text"
                      value={item.notes}
                      onChange={(e) => handleItemChange(idx, 'notes', e.target.value)}
                      placeholder="Observações do trecho (Ex: Shaft principal, 2º pavimento, etc.)"
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1 text-[11px] text-slate-600 dark:text-slate-300 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Observações Gerais */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              Observações Gerais para o CAMduct
            </label>
            <textarea
              rows={2}
              value={generalNotes}
              onChange={(e) => setGeneralNotes(e.target.value)}
              placeholder="Instruções para o tagueamento (Ex: Prioridade para fechamento de drywall na próxima segunda-feira...)"
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500 resize-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-md shadow-cyan-600/30 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{loading ? 'Registrando...' : 'Registrar Solicitação de Dutos'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
