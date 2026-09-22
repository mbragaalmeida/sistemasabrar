import React, { useState, useEffect } from 'react';
import { Users, Shield, Check, UserCheck, UserPlus } from 'lucide-react';
import { User, UserRole } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { CreateUserModal } from '../components/modals/CreateUserModal';

export const UsersPage: React.FC = () => {
  const { users, currentUser, switchUser, refreshUsers } = useAuth();
  const [roles, setRoles] = useState<any[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  useEffect(() => {
    api.getRoles().then(setRoles).catch(console.error);
  }, []);

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
            5 perfis especializados: Administrador, Setor de Orçamento, Engenharia, Almoxarifado e Compras
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
                  <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-dark-800 text-sabrar-400 border border-dark-700">
                    {u.role_label}
                  </span>
                  {isCurrent && (
                    <span className="text-[10px] font-bold text-sabrar-400 bg-sabrar-950 border border-sabrar-500/40 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <UserCheck className="w-3 h-3" /> Ativo Agora
                    </span>
                  )}
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

              <div className="mt-4 pt-3 border-t border-dark-750 flex items-center justify-between">
                <span className="text-xs text-slate-400 font-medium">Trocar para este perfil:</span>
                <button
                  onClick={() => switchUser(u.id)}
                  disabled={isCurrent}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                    isCurrent
                      ? 'bg-dark-800 text-slate-500 cursor-default border border-dark-700'
                      : 'bg-sabrar-600 hover:bg-sabrar-500 text-white shadow-md shadow-sabrar-600/30'
                  }`}
                >
                  {isCurrent ? 'Selecionado' : 'Alternar Perfil'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal de Criação de Usuário */}
      <CreateUserModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => refreshUsers()}
      />
    </div>
  );
};

