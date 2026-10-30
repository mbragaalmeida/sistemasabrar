import React, { useState, useEffect } from 'react';
import { Link2, X, Search, AlertCircle, CheckCircle2, FileText, Layers, Calendar, Package, ArrowRight, Loader2 } from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

interface LinkProjectAddendumModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: number;
  projectName: string;
  nextNumber: number;
  onSuccess: () => void;
}

interface CandidateProject {
  id: number;
  code?: string;
  name: string;
  client?: string;
  project_type?: string;
  status?: string;
  created_at?: string;
  materials_count: number | string;
  files_count: number | string;
}

export const LinkProjectAddendumModal: React.FC<LinkProjectAddendumModalProps> = ({
  isOpen,
  onClose,
  projectId,
  projectName,
  nextNumber,
  onSuccess
}) => {
  const { currentUser } = useAuth();
  const [candidates, setCandidates] = useState<CandidateProject[]>([]);
  const [filteredCandidates, setFilteredCandidates] = useState<CandidateProject[]>([]);
  const [search, setSearch] = useState('');
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [selectedProject, setSelectedProject] = useState<CandidateProject | null>(null);

  const [customTitle, setCustomTitle] = useState('');
  const [customDate, setCustomDate] = useState('');
  const [customDescription, setCustomDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Carrega projetos candidatos quando o modal abre
  useEffect(() => {
    if (!isOpen) return;

    setSelectedProject(null);
    setSearch('');
    setError('');
    setCustomTitle(`Aditivo ${nextNumber}`);
    setCustomDate(new Date().toISOString().slice(0, 10));
    setCustomDescription('');

    loadCandidates();
  }, [isOpen, projectId, nextNumber]);

  const loadCandidates = async (query = '') => {
    try {
      setLoadingCandidates(true);
      setError('');
      const data = await api.getLinkableProjects(projectId, query);
      setCandidates(data || []);
      setFilteredCandidates(data || []);
    } catch (err: any) {
      console.error('Erro ao carregar projetos para vinculação:', err);
      setError(err?.message || 'Falha ao buscar projetos disponíveis.');
    } finally {
      setLoadingCandidates(false);
    }
  };

  const handleSearchChange = (val: string) => {
    setSearch(val);
    if (!val.trim()) {
      setFilteredCandidates(candidates);
      return;
    }
    const q = val.toLowerCase();
    const filtered = candidates.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.code && c.code.toLowerCase().includes(q)) ||
        (c.client && c.client.toLowerCase().includes(q))
    );
    setFilteredCandidates(filtered);
  };

  const handleSelectProject = (project: CandidateProject) => {
    setSelectedProject(project);
    setCustomTitle(`Aditivo ${nextNumber} - ${project.name}`);
    if (project.created_at) {
      try {
        setCustomDate(new Date(project.created_at).toISOString().slice(0, 10));
      } catch {
        setCustomDate(new Date().toISOString().slice(0, 10));
      }
    }
    setCustomDescription(
      `Aditivo incorporado a partir da obra avulsa ${project.code ? `[${project.code}] ` : ''}${project.name}.`
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) {
      setError('Selecione uma obra para vincular.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      await api.linkProjectAsAddendum(projectId, {
        sourceProjectId: selectedProject.id,
        customTitle: customTitle.trim() || `Aditivo ${nextNumber} - ${selectedProject.name}`,
        customDescription: customDescription.trim(),
        customDate: customDate,
        userId: currentUser?.id || 1
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Erro ao vincular obra como aditivo:', err);
      setError(err?.message || 'Falha ao vincular projeto.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-dark-900 border border-dark-750 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="p-5 border-b border-dark-750 flex items-center justify-between bg-dark-850/60 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Link2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Vincular Obra como Aditivo</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  Aditivo {nextNumber}
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Vincule um projeto cadastrado como aditivo dentro de <strong>{projectName}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-dark-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-5 flex-1 custom-scrollbar">
          {/* Etapa 1: Selecionar Projeto */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              1. Selecione a Obra/Projeto que virará este Aditivo:
            </label>

            {/* Barra de Pesquisa */}
            <div className="relative mb-3">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por código, nome da obra ou cliente..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-dark-800 border border-dark-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Lista de Projetos Candidatos */}
            <div className="max-h-56 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {loadingCandidates ? (
                <div className="p-8 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
                  <span>Carregando projetos disponíveis...</span>
                </div>
              ) : filteredCandidates.length === 0 ? (
                <div className="p-6 text-center text-slate-500 text-xs border border-dashed border-dark-750 rounded-xl">
                  {search ? 'Nenhum projeto encontrado com este termo.' : 'Não há projetos avulsos elegíveis para vinculação.'}
                </div>
              ) : (
                filteredCandidates.map((p) => {
                  const isSelected = selectedProject?.id === p.id;
                  return (
                    <div
                      key={p.id}
                      onClick={() => handleSelectProject(p)}
                      className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'border-blue-500 bg-blue-950/40 text-white shadow-sm ring-1 ring-blue-500/50'
                          : 'border-dark-750 bg-dark-850/60 hover:bg-dark-800 text-slate-300 hover:border-dark-700'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          {p.code && (
                            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-dark-750 text-slate-300 border border-dark-700">
                              {p.code}
                            </span>
                          )}
                          <span className="text-xs font-bold text-white truncate">{p.name}</span>
                          {p.status && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                              {p.status}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-slate-400 flex-wrap">
                          {p.client && <span>Cliente: <strong className="text-slate-300">{p.client}</strong></span>}
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Package className="w-3 h-3 text-slate-400" />
                            {p.materials_count} materiais
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <FileText className="w-3 h-3 text-slate-400" />
                            {p.files_count} arquivos
                          </span>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center">
                        <div
                          className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                            isSelected
                              ? 'border-blue-500 bg-blue-600 text-white'
                              : 'border-dark-700 bg-dark-800 text-transparent'
                          }`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Etapa 2: Configuração do Aditivo (ativa quando projeto selecionado) */}
          {selectedProject && (
            <div className="pt-2 border-t border-dark-750 space-y-4 animate-in fade-in slide-in-from-top-2 duration-150">
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                2. Configurar Identificação do Aditivo:
              </label>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2 space-y-1">
                  <label className="text-[11px] font-semibold text-slate-400">Título / Nome do Aditivo *</label>
                  <input
                    type="text"
                    required
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder={`Aditivo ${nextNumber} - Descrição`}
                    className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-400">Data do Levantamento *</label>
                  <input
                    type="date"
                    required
                    value={customDate}
                    onChange={(e) => setCustomDate(e.target.value)}
                    className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-400">
                  Descrição / Justificativa do Aditivo (Opcional)
                </label>
                <textarea
                  rows={2}
                  value={customDescription}
                  onChange={(e) => setCustomDescription(e.target.value)}
                  placeholder="Explique o motivo do aditivo, notas de campo ou escopo adicional..."
                  className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              {/* Informação sobre os dados transferidos */}
              <div className="p-3.5 rounded-xl bg-blue-950/30 border border-blue-500/30 text-xs text-blue-200/90 space-y-2">
                <div className="flex items-center gap-2 font-bold text-blue-300">
                  <AlertCircle className="w-4 h-4 shrink-0 text-blue-400" />
                  <span>O que acontece ao confirmar a vinculação:</span>
                </div>
                <ul className="list-disc list-inside space-y-1 text-[11px] text-blue-200/80 pl-1">
                  <li>
                    A obra <strong>{selectedProject.name}</strong> deixará de aparecer avulsa na lista geral de projetos.
                  </li>
                  <li>
                    Todos os <strong>{selectedProject.materials_count} materiais orçados</strong> serão importados para a aba <strong>Aditivo {nextNumber}</strong>.
                  </li>
                  <li>
                    Os <strong>{selectedProject.files_count} arquivos e memoriais</strong> serão transferidos e marcados com a tag <em>[Aditivo {nextNumber}]</em>.
                  </li>
                  <li>
                    Caso necessário, o aditivo poderá ser excluído futuramente, restaurando o projeto à lista geral.
                  </li>
                </ul>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/50 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-dark-750">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-xl border border-dark-700 text-slate-300 hover:text-white text-xs font-semibold hover:bg-dark-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!selectedProject || submitting}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-lg shadow-blue-600/30 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Vinculando Obra...</span>
                </>
              ) : (
                <>
                  <Link2 className="w-4 h-4" />
                  <span>Confirmar Vinculação (Aditivo {nextNumber})</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
