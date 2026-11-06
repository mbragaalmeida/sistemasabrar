import React, { useState, useEffect } from 'react';
import { Edit3, X, AlertCircle, Check, Building2, User, Phone, Mail, MapPin, FileText, Trash2 } from 'lucide-react';
import { Project } from '../../types';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { canDeleteProject } from '../../utils/permissions';
import { ESTIMATORS_LIST } from './NewProjectModal';

interface EditProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project | null;
  onSuccess: (updated: Project) => void;
  onDeleted?: () => void;
}

export const EditProjectModal: React.FC<EditProjectModalProps> = ({
  isOpen,
  onClose,
  project,
  onSuccess,
  onDeleted
}) => {
  const { currentUser } = useAuth();

  const [name, setName] = useState('');
  const [client, setClient] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [projectType, setProjectType] = useState<'Comercial' | 'Residencial' | 'Industrial' | 'Reforma' | 'Infraestrutura'>('Comercial');
  const [category, setCategory] = useState<'Obra' | 'Manutenção' | 'Stanque Dutos'>('Obra');
  const [responsibleEngineer, setResponsibleEngineer] = useState('');
  const [responsibleEstimator, setResponsibleEstimator] = useState('');
  const [returnDeadline, setReturnDeadline] = useState('');
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (project) {
      setName(project.name || '');
      setClient(project.client || '');
      setClientEmail(project.client_email || '');
      setClientPhone(project.client_phone || '');
      setAddress(project.address || '');
      setCity((project as any).city || '');
      setState((project as any).state || '');
      setProjectType((project.project_type as any) || 'Comercial');
      setCategory((project.category as any) || (project.name.toLowerCase().includes('manuten') ? 'Manutenção' : 'Obra'));
      setResponsibleEngineer(project.responsible_engineer || '');
      setResponsibleEstimator((project as any).responsible_estimator || '');
      setReturnDeadline((project as any).return_deadline ? (project as any).return_deadline.split('T')[0] : '');
      setNotes(project.notes || '');
      setError(null);
    }
  }, [project, isOpen]);

  if (!isOpen || !project) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !client.trim()) {
      setError('Nome da obra e Cliente são campos obrigatórios.');
      return;
    }

    setLoading(true);
    try {
      const updated = await api.updateProject(project.id, {
        name: name.trim(),
        client: client.trim(),
        client_email: clientEmail.trim(),
        client_phone: clientPhone.trim(),
        address: address.trim(),
        city: city.trim(),
        state: state.trim(),
        project_type: projectType,
        category,
        responsible_engineer: responsibleEngineer.trim(),
        responsible_estimator: responsibleEstimator.trim(),
        return_deadline: returnDeadline || null,
        notes: notes.trim(),
        userId: currentUser?.id
      });

      onSuccess(updated);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar alterações da obra');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!project) return;
    const confirmed = window.confirm(
      `Tem certeza de que deseja excluir permanentemente o projeto "${project.name}" (${project.code})?\nEsta ação removerá os orçamentos, arquivos e dados associados.`
    );
    if (!confirmed) return;

    setLoading(true);
    try {
      await api.deleteProject(project.id);
      alert(`Obra "${project.name}" excluída com sucesso.`);
      onClose();
      if (onDeleted) {
        onDeleted();
      } else {
        onSuccess(project);
      }
    } catch (err: any) {
      alert(err.message || 'Erro ao excluir obra');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm overflow-y-auto animate-in fade-in">
      <div className="w-full max-w-2xl bg-white dark:bg-dark-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-dark-750 overflow-hidden flex flex-col my-auto max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-slate-50 dark:bg-dark-850 border-b border-slate-200 dark:border-dark-750 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sabrar-950/80 border border-sabrar-500/40 flex items-center justify-center text-sabrar-400">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white">Editar Dados da Obra</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Código: <span className="font-mono font-bold text-sabrar-500">{project.code}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-100 dark:hover:bg-dark-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 overflow-y-auto space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-rose-950/60 border border-rose-500/50 rounded-2xl flex items-center gap-2 text-rose-300 font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Categoria: Obra vs Manutenção (Item 4) */}
          <div>
            <label className="block text-slate-400 font-bold uppercase tracking-wider text-[11px] mb-1.5">
              Categoria do Registro *
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setCategory('Obra')}
                className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  category === 'Obra'
                    ? 'bg-sabrar-600 text-white shadow-md'
                    : 'bg-slate-100 dark:bg-dark-850 text-slate-500 dark:text-slate-400 border border-slate-300 dark:border-dark-700 hover:text-white'
                }`}
              >
                Obra Nova
              </button>
              <button
                type="button"
                onClick={() => setCategory('Manutenção')}
                className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  category === 'Manutenção'
                    ? 'bg-amber-600 text-white shadow-md'
                    : 'bg-slate-100 dark:bg-dark-850 text-slate-500 dark:text-slate-400 border border-slate-300 dark:border-dark-700 hover:text-white'
                }`}
              >
                Manutenção
              </button>
              <button
                type="button"
                onClick={() => setCategory('Stanque Dutos')}
                className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  category === 'Stanque Dutos'
                    ? 'bg-sky-600 text-white shadow-md'
                    : 'bg-slate-100 dark:bg-dark-850 text-slate-500 dark:text-slate-400 border border-slate-300 dark:border-dark-700 hover:text-white'
                }`}
              >
                Stanque Dutos
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="sm:col-span-2">
              <label className="block text-slate-400 font-bold uppercase tracking-wider text-[11px] mb-1">
                Nome da Obra / Projeto *
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: 0411-26-Apartamento Luciana Giritana"
                  required
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-dark-850 border border-slate-300 dark:border-dark-700 text-slate-900 dark:text-white font-semibold focus:outline-none focus:ring-2 focus:ring-sabrar-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-400 font-bold uppercase tracking-wider text-[11px] mb-1">
                Cliente / Contratante *
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={client}
                  onChange={(e) => setClient(e.target.value)}
                  placeholder="Nome do cliente ou empresa"
                  required
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-dark-850 border border-slate-300 dark:border-dark-700 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-sabrar-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-400 font-bold uppercase tracking-wider text-[11px] mb-1">
                Tipo de Obra
              </label>
              <select
                value={projectType}
                onChange={(e) => setProjectType(e.target.value as any)}
                className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-dark-850 border border-slate-300 dark:border-dark-700 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-sabrar-500"
              >
                <option value="Comercial">Comercial</option>
                <option value="Residencial">Residencial</option>
                <option value="Industrial">Industrial</option>
                <option value="Reforma">Reforma</option>
                <option value="Infraestrutura">Infraestrutura</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-400 font-bold uppercase tracking-wider text-[11px] mb-1">
                E-mail do Cliente
              </label>
              <input
                type="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                placeholder="cliente@email.com"
                className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-dark-850 border border-slate-300 dark:border-dark-700 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-sabrar-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-bold uppercase tracking-wider text-[11px] mb-1">
                Telefone / WhatsApp
              </label>
              <input
                type="text"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                placeholder="(21) 99999-9999"
                className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-dark-850 border border-slate-300 dark:border-dark-700 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-sabrar-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-slate-400 font-bold uppercase tracking-wider text-[11px] mb-1">
                Endereço da Obra
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Rua, número, bairro, cidade"
                className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-dark-850 border border-slate-300 dark:border-dark-700 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-sabrar-500"
              />
            </div>

            <div>
              <label className="block text-sabrar-600 dark:text-sabrar-400 font-bold uppercase tracking-wider text-[11px] mb-1">
                Orçamentista Responsável *
              </label>
              <select
                value={responsibleEstimator}
                onChange={(e) => setResponsibleEstimator(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-dark-850 border border-slate-300 dark:border-dark-700 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-sabrar-500 text-xs"
              >
                <option value="">Selecione o orçamentista...</option>
                {ESTIMATORS_LIST.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
                {responsibleEstimator && !ESTIMATORS_LIST.includes(responsibleEstimator) && (
                  <option value={responsibleEstimator}>{responsibleEstimator}</option>
                )}
              </select>
            </div>

            <div>
              <label className="block text-sabrar-600 dark:text-sabrar-400 font-bold uppercase tracking-wider text-[11px] mb-1">
                Data para Retorno da Proposta
              </label>
              <input
                type="date"
                value={returnDeadline}
                onChange={(e) => setReturnDeadline(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-dark-850 border border-slate-300 dark:border-dark-700 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-sabrar-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-slate-400 font-bold uppercase tracking-wider text-[11px] mb-1">
                Engenheiro Responsável Principal
              </label>
              <input
                type="text"
                value={responsibleEngineer}
                onChange={(e) => setResponsibleEngineer(e.target.value)}
                placeholder="Ex: Felipe Germano"
                className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-dark-850 border border-slate-300 dark:border-dark-700 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-sabrar-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-slate-400 font-bold uppercase tracking-wider text-[11px] mb-1">
                Observações Gerais / Escopo
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Detalhes técnicos, informações do canteiro ou escopo contratual..."
                className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-dark-850 border border-slate-300 dark:border-dark-700 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-sabrar-500 resize-none"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-200 dark:border-dark-750 flex items-center justify-between gap-2.5">
            <div>
              {canDeleteProject(currentUser) && project && (
                <button
                  type="button"
                  onClick={handleDeleteProject}
                  disabled={loading}
                  className="px-3 py-1.5 rounded-xl border border-rose-500/40 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 font-bold transition-all text-xs flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
                  title="Excluir obra permanentemente (Apenas Administrador e Sabrina)"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Excluir Obra</span>
                </button>
              )}
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-dark-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-dark-800 font-bold transition-all text-xs"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 rounded-xl bg-sabrar-600 hover:bg-sabrar-500 text-white font-bold transition-all shadow-md shadow-sabrar-600/30 flex items-center gap-1.5 active:scale-95 text-xs disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>{loading ? 'Salvando...' : 'Salvar Alterações'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
