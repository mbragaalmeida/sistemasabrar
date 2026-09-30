import React, { useState, useEffect } from 'react';
import { HardHat, X, Check, AlertCircle, Users, ShieldCheck, UserCheck } from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { User } from '../../types';

interface AssignEngineersModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: number;
  projectName: string;
  projectCode: string;
  currentEngineerIds?: number[];
  onSuccess?: () => void;
}

export const AssignEngineersModal: React.FC<AssignEngineersModalProps> = ({
  isOpen,
  onClose,
  projectId,
  projectName,
  projectCode,
  currentEngineerIds = [],
  onSuccess
}) => {
  const { currentUser } = useAuth();
  const [availableEngineers, setAvailableEngineers] = useState<User[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSelectedIds(new Set(currentEngineerIds));
      setLoading(true);

      api.getUsers()
        .then((usersList) => {
          // Filtra usuários com papel de engenharia ou administradores
          const engineers = usersList.filter(
            (u: any) => u.role === 'engenharia' || u.role_name === 'engenharia' || u.role === 'admin' || u.role_name === 'admin'
          );
          setAvailableEngineers(engineers.length > 0 ? engineers : usersList);
        })
        .catch((err) => {
          console.error('Erro ao carregar lista de engenheiros:', err);
          setError('Não foi possível carregar a lista de engenheiros.');
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen, currentEngineerIds]);

  if (!isOpen) return null;

  const handleToggleEngineer = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = (select: boolean) => {
    if (select) {
      setSelectedIds(new Set(availableEngineers.map((u) => u.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const idsArray = Array.from(selectedIds);
      await api.assignProjectEngineers(projectId, idsArray, currentUser?.id);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Erro ao atribuir engenheiros:', err);
      setError(err.message || 'Erro ao atribuir engenheiros à obra');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-xl bg-dark-900 border border-dark-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-slate-100">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-dark-850 border-b border-dark-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-950/70 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-inner">
              <HardHat className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white">Atribuir Engenheiros Responsáveis</h3>
              <p className="text-xs text-slate-400">
                {projectCode} — {projectName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-dark-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto">
          {error && (
            <div className="p-3 bg-rose-950/50 border border-rose-800/80 text-rose-300 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="bg-dark-850 p-3.5 rounded-2xl border border-dark-700 text-xs text-slate-300 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-white">
              <ShieldCheck className="w-4 h-4 text-sabrar-400" />
              <span>Controle Administrativo de Responsabilidade Técnica</span>
            </div>
            <p className="text-[11px] text-slate-400">
              O sistema permite designar <strong>mais de um engenheiro responsável</strong> para a mesma obra. Todos os profissionais selecionados terão acesso completo às informações da obra e poderão emitir solicitações de materiais.
            </p>
          </div>

          <div className="flex items-center justify-between text-xs pt-1">
            <span className="font-bold text-slate-300 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-sabrar-400" />
              Engenheiros e Responsáveis Disponíveis ({availableEngineers.length})
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleSelectAll(true)}
                className="text-[11px] text-sabrar-400 hover:text-sabrar-300 font-semibold hover:underline"
              >
                Selecionar Todos
              </button>
              <span className="text-slate-600">•</span>
              <button
                type="button"
                onClick={() => handleSelectAll(false)}
                className="text-[11px] text-slate-400 hover:text-slate-300 hover:underline"
              >
                Limpar
              </button>
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-center text-xs text-slate-500">
              Carregando lista de engenheiros...
            </div>
          ) : availableEngineers.length === 0 ? (
            <div className="py-8 text-center bg-dark-850 rounded-2xl text-xs text-slate-500">
              Nenhum profissional de engenharia encontrado no sistema.
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {availableEngineers.map((eng) => {
                const isChecked = selectedIds.has(eng.id);
                return (
                  <div
                    key={eng.id}
                    onClick={() => handleToggleEngineer(eng.id)}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between select-none ${
                      isChecked
                        ? 'bg-sabrar-950/40 border-sabrar-500/70 shadow-sm shadow-sabrar-950/30'
                        : 'bg-dark-850 border-dark-750 hover:border-dark-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                        isChecked
                          ? 'bg-sabrar-600 text-white'
                          : 'bg-dark-800 text-slate-300 border border-dark-700'
                      }`}>
                        {eng.name ? eng.name.charAt(0).toUpperCase() : 'E'}
                      </div>
                      <div>
                        <div className="font-bold text-xs text-white flex items-center gap-1.5">
                          <span>{eng.name}</span>
                          {eng.role === 'admin' && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-950 border border-purple-800 text-purple-300 font-normal">
                              Admin
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400">{eng.email}</div>
                      </div>
                    </div>

                    <div className={`w-5 h-5 rounded-lg flex items-center justify-center border transition-colors ${
                      isChecked
                        ? 'bg-sabrar-500 border-sabrar-500 text-black'
                        : 'border-dark-700 bg-dark-800'
                    }`}>
                      {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="text-[11px] text-slate-400 flex items-center justify-between pt-2 border-t border-dark-800">
            <span>
              {selectedIds.size === 0
                ? 'Nenhum engenheiro selecionado (ficará como pendente)'
                : `${selectedIds.size} ${selectedIds.size === 1 ? 'engenheiro designado' : 'engenheiros designados'}`}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 bg-dark-850 border-t border-dark-700 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2.5 rounded-2xl bg-dark-800 hover:bg-dark-750 text-slate-300 text-xs font-bold border border-dark-700 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-2xl bg-sabrar-600 hover:bg-sabrar-500 text-white text-xs font-bold shadow-lg shadow-sabrar-600/30 transition-all active:scale-95 disabled:opacity-50"
          >
            <UserCheck className="w-4 h-4" />
            <span>{saving ? 'Salvando...' : 'Salvar Atribuição'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
