import React, { useState, useEffect } from 'react';
import { Users, Shield, Check, UserCheck, UserPlus, Trash2, AlertTriangle, X } from 'lucide-react';
import { User, UserRole } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { CreateUserModal } from '../components/modals/CreateUserModal';

export const UsersPage: React.FC = () => {
  const { users, currentUser, isSimulating, switchUser, refreshUsers } = useAuth();
  const [roles, setRoles] = useState<any[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  useEffect(() => {
    api.getRoles().then(setRoles).catch(console.error);
    refreshUsers();
  }, []);

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    setDeleting(true);
    setActionError(null);
    try {
      await api.deleteUser(userToDelete.id);
      setActionSuccess(`Colaborador ${userToDelete.name} excluído com sucesso.`);
      setUserToDelete(null);
      await refreshUsers();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      console.error('Erro ao excluir usuário:', err);
      setActionError(err.message || 'Falha ao excluir o colaborador.');
    } finally {
      setDeleting(false);
    }
  };

  // Bloqueio rigoroso: apenas Administrador Geral acessa a listagem e criação de perfis
  if (currentUser?.role !== 'admin' && !isSimulating) {
    return (
      <div className="p-8 text-center bg-dark-900 rounded-3xl border border-dark-750 max-w-xl mx-auto mt-12 space-y-3">
        <Shield className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-lg font-bold text-white">Acesso Restrito ao Administrador Geral</h2>
        <p className="text-xs text-slate-400">
          Seu perfil não possui autorização para gerenciar ou visualizar os perfis dos demais colaboradores da SABRAR.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-dark-900 p-4 sm:p-5 rounded-3xl border border-dark-750 shadow-xl">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-sabrar-950/70 border border-sabrar-500/40 flex items-center justify-center text-sabrar-400">
              <Users className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Usuários & Perfis de Acesso
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Gestão restrita de colaboradores e credenciais por setor da SABRAR
          </p>
        </div>

        {/* Botão Criar Usuário */}
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-sabrar-600 hover:bg-sabrar-500 text-white text-xs font-bold transition-all shadow-lg shadow-sabrar-600/30 active:scale-95 whitespace-nowrap self-start sm:self-auto"
        >
          <UserPlus className="w-4 h-4" />
          <span>Criar Usuário</span>
        </button>
      </div>

      {/* Alertas de Ação */}
      {actionSuccess && (
        <div className="p-3.5 bg-emerald-950/80 border border-emerald-700 text-emerald-300 rounded-2xl text-xs flex items-center gap-2 animate-in fade-in">
          <Check className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{actionSuccess}</span>
        </div>
      )}
      {actionError && (
        <div className="p-3.5 bg-rose-950/80 border border-rose-700 text-rose-300 rounded-2xl text-xs flex items-center gap-2 animate-in fade-in">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Grid of Roles and Users */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {users.map((u) => {
          const isCurrent = currentUser?.id === u.id;
          return (
            <div
              key={u.id}
              className={`bg-dark-900 rounded-3xl p-5 border transition-all shadow-md flex flex-col justify-between ${
                isCurrent ? 'border-sabrar-500 ring-2 ring-sabrar-500/20' : 'border-dark-750'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-dark-800 text-sabrar-400 border border-dark-700">
                    {u.role_label}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {isCurrent && (
                      <span className="text-[10px] font-bold text-sabrar-400 bg-sabrar-950 border border-sabrar-500/40 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <UserCheck className="w-3 h-3" /> Sessão Ativa
                      </span>
                    )}
                    {/* Botão de Excluir Usuário */}
                    <button
                      onClick={() => setUserToDelete(u)}
                      disabled={isCurrent}
                      className={`p-1.5 rounded-xl transition-all ${
                        isCurrent
                          ? 'text-slate-600 cursor-not-allowed opacity-40'
                          : 'text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 border border-transparent hover:border-rose-900'
                      }`}
                      title={isCurrent ? 'Não é permitido excluir o usuário da sessão ativa' : `Excluir colaborador ${u.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <img
                    src={u.avatar}
                    alt={u.name}
                    className="w-12 h-12 rounded-2xl object-cover border-2 border-dark-700 shadow-sm"
                  />
                  <div>
                    <h3 className="font-extrabold text-sm sm:text-base text-white">{u.name}</h3>
                    <p className="text-xs text-slate-400">{u.email}</p>
                    <p className="text-[11px] text-sabrar-400/80 mt-0.5">{u.department}</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-dark-750 flex items-center justify-between text-xs">
                <span className="text-slate-500 text-[11px]">Teste administrativo:</span>
                <button
                  onClick={() => switchUser(u.id)}
                  disabled={isCurrent}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                    isCurrent
                      ? 'bg-dark-800 text-slate-500 cursor-default border border-dark-700'
                      : 'bg-dark-800 hover:bg-dark-750 text-amber-300 border border-amber-500/30'
                  }`}
                  title="Simular visualização deste usuário"
                >
                  {isCurrent ? 'Perfil Atual' : 'Simular Visão'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal de Confirmação de Exclusão de Usuário */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-dark-900 border border-dark-750 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-2xl bg-rose-950/80 border border-rose-700 flex items-center justify-center text-rose-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <button
                onClick={() => setUserToDelete(null)}
                className="text-slate-400 hover:text-white p-1 rounded-xl hover:bg-dark-750"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <h3 className="text-base font-extrabold text-white">Excluir Colaborador</h3>
              <p className="text-xs text-slate-400 mt-1">
                Deseja realmente remover o colaborador <strong className="text-white">{userToDelete.name}</strong> ({userToDelete.email}) do sistema?
              </p>
            </div>

            <div className="p-3 bg-dark-850 rounded-2xl border border-dark-700 text-xs text-slate-300 space-y-1">
              <div><strong>Função / Perfil:</strong> {userToDelete.role_label}</div>
              <div><strong>Departamento:</strong> {userToDelete.department || 'Não especificado'}</div>
              <div className="text-[11px] text-amber-400/90 pt-1">
                Nota: O acesso deste colaborador será revogado imediatamente e seus registros históricos serão preservados sem quebras de integridade.
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                disabled={deleting}
                className="px-4 py-2 rounded-xl border border-dark-700 text-slate-300 hover:text-white hover:bg-dark-800 text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteUser}
                disabled={deleting}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-md shadow-rose-600/30 active:scale-95 disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>{deleting ? 'Excluindo...' : 'Excluir Colaborador'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Criação de Usuário */}
      <CreateUserModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => refreshUsers()}
      />
    </div>
  );
};
