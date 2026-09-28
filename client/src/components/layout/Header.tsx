import React, { useState } from 'react';
import { Search, Bell, Menu, Shield, UserCheck, ChevronDown, LogOut, Sun, Moon, Users, Eye, RotateCcw, KeyRound } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { UserRole } from '../../types';

interface HeaderProps {
  onOpenSearch: () => void;
  onOpenNotifications: () => void;
  onToggleSidebar: () => void;
  onNavigate?: (page: string) => void;
  unreadNotificationsCount?: number;
  onOpenChangePassword?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenSearch,
  onOpenNotifications,
  onToggleSidebar,
  onNavigate,
  unreadNotificationsCount = 0,
  onOpenChangePassword
}) => {
  const { currentUser, isSimulating, originalAdmin, simulateRole, stopSimulation, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);

  const isAdmin = currentUser?.role === 'admin' && !isSimulating;

  return (
    <header className="sticky top-0 z-40 bg-white dark:bg-[#0A0A0A] text-slate-800 dark:text-white border-b border-slate-200 dark:border-[#222222] px-3 sm:px-6 py-2.5 shadow-xs dark:shadow-xl transition-colors">
      <div className="flex items-center justify-between gap-2 max-w-7xl mx-auto">
        {/* Left: Mobile Menu Toggle & Brand Logo Oficial */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={onToggleSidebar}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1C1C1C] transition-colors md:hidden focus:outline-none focus:ring-2 focus:ring-sabrar-500"
            aria-label="Abrir menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Logomarca Oficial Unificada SABRAR */}
          <div className="flex items-center cursor-pointer select-none py-0.5">
            <img
              src={theme === 'light' ? '/sabrar-logo-black.png' : '/sabrar-logo.png'}
              alt="SABRAR Engenharia — Ar Condicionado e Exaustão"
              className="h-8 sm:h-9 w-auto object-contain max-w-[190px] sm:max-w-[250px] drop-shadow-xs transition-transform hover:scale-[1.02]"
            />
          </div>
        </div>

        {/* Center: Global Search Bar Trigger */}
        <button
          onClick={onOpenSearch}
          className="hidden sm:flex items-center gap-2 bg-slate-100 dark:bg-[#141414] hover:bg-slate-200/80 dark:hover:bg-[#1E1E1E] text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white px-3.5 py-1.5 rounded-2xl border border-slate-200 dark:border-[#262626] text-xs transition-all w-48 md:w-64 lg:w-80 shadow-inner group"
        >
          <Search className="w-4 h-4 text-slate-400 group-hover:text-sabrar-600 dark:group-hover:text-sabrar-400 transition-colors" />
          <span className="truncate">Buscar em todo o sistema...</span>
        </button>

        {/* Right: User Profile Menu + Search icon (Mobile) + Notifications */}
        <div className="flex items-center gap-1.5 sm:gap-3">
          {/* Mobile Search Icon */}
          <button
            onClick={onOpenSearch}
            className="sm:hidden p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1C1C1C] transition-colors"
            title="Buscar"
          >
            <Search className="w-5 h-5" />
          </button>

          {/* User Profile Badge / Menu (Exclusivo no Desktop - no mobile fica no menu lateral) */}
          <div className="relative hidden md:block">
            <button
              onClick={() => setRoleDropdownOpen(!roleDropdownOpen)}
              className={`flex items-center gap-2 bg-slate-100 dark:bg-[#141414] hover:bg-slate-200/80 dark:hover:bg-[#1E1E1E] text-slate-800 dark:text-white pl-2 pr-2.5 py-1.5 rounded-2xl border text-xs transition-all shadow-xs ${
                isSimulating
                  ? 'border-amber-400 dark:border-amber-500/50 bg-amber-50 dark:bg-amber-950/20'
                  : 'border-slate-200 dark:border-[#262626]'
              }`}
              title="Meu perfil e configurações de sessão"
            >
              <div className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                isSimulating
                  ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-500/40'
                  : isAdmin
                    ? 'bg-emerald-100 dark:bg-sabrar-500/20 text-emerald-700 dark:text-sabrar-400 border border-emerald-300 dark:border-sabrar-500/30'
                    : 'bg-teal-100 dark:bg-emerald-500/20 text-teal-700 dark:text-emerald-400 border border-teal-300 dark:border-emerald-500/30'
              }`}>
                {isSimulating ? (
                  <Eye className="w-3.5 h-3.5" />
                ) : (
                  <Shield className="w-3.5 h-3.5" />
                )}
              </div>
              <div className="text-left hidden xs:block">
                <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold leading-tight">
                  {isSimulating ? 'Simulação' : isAdmin ? 'Administrador' : 'Usuário'}
                </div>
                <div className="font-bold text-emerald-700 dark:text-sabrar-300 truncate max-w-[110px] sm:max-w-[140px] leading-tight">
                  {currentUser?.name?.split(' ')[0] || currentUser?.role_label || 'Perfil'}
                </div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            </button>

            {/* Dropdown Menu */}
            {roleDropdownOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-[#121212] rounded-3xl shadow-2xl border border-slate-200 dark:border-[#262626] p-3 z-50 text-slate-800 dark:text-slate-100 animate-in fade-in slide-in-from-top-2 duration-150 space-y-3">
                {/* 1. Header do Cartão: Dados do Usuário Logado */}
                <div className="flex items-center gap-3 p-2 bg-slate-50 dark:bg-[#181818] rounded-2xl border border-slate-200 dark:border-[#242424]">
                  <img
                    src={currentUser?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'}
                    alt={currentUser?.name}
                    className="w-10 h-10 rounded-xl object-cover border border-slate-300 dark:border-[#333333] shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-slate-900 dark:text-white text-xs truncate">{currentUser?.name}</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{currentUser?.email}</div>
                    <div className="text-[10px] font-semibold text-emerald-600 dark:text-sabrar-400 mt-0.5 truncate">{currentUser?.role_label}</div>
                  </div>
                </div>

                {/* Se for Administrador Geral: Controles de Gestão e Simulação */}
                {isAdmin && (
                  <div className="space-y-2 pt-1 border-t border-slate-200 dark:border-[#222222]">
                    {/* Botão Gestão de Usuários */}
                    {onNavigate && (
                      <button
                        onClick={() => {
                          setRoleDropdownOpen(false);
                          onNavigate('users');
                        }}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-[#181818] dark:hover:bg-[#202020] border border-slate-200 dark:border-[#2a2a2a] text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-emerald-600 dark:text-sabrar-400" />
                          <span>Gerenciar Usuários & Perfis</span>
                        </div>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-sabrar-950 text-emerald-800 dark:text-sabrar-300 border border-emerald-300 dark:border-sabrar-500/30 font-bold">
                          Admin
                        </span>
                      </button>
                    )}

                    {/* Ferramenta de Simulação para Testes de Telas */}
                    <div className="bg-slate-50 dark:bg-[#181818] p-2.5 rounded-2xl border border-slate-200 dark:border-[#262626] space-y-1.5 shadow-xs">
                      <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">
                        <Eye className="w-3.5 h-3.5 text-amber-500" />
                        <span>Simular Visão de Setor</span>
                      </div>
                      <div className="grid grid-cols-2 gap-1 text-[11px]">
                        {(['orcamento', 'engenharia', 'almoxarifado', 'compras'] as UserRole[]).map((r) => {
                          const labels: Record<string, string> = {
                            orcamento: 'Orçamento',
                            engenharia: 'Engenharia',
                            almoxarifado: 'Almoxarifado',
                            compras: 'Compras'
                          };
                          return (
                            <button
                              key={r}
                              onClick={() => {
                                setRoleDropdownOpen(false);
                                simulateRole(r);
                              }}
                              className="px-2 py-1.5 bg-white hover:bg-amber-50 dark:bg-[#121212] dark:hover:bg-dark-800 border border-slate-200 dark:border-[#242424] rounded-lg text-left text-slate-700 dark:text-slate-300 hover:text-amber-800 dark:hover:text-amber-300 transition-colors font-medium truncate shadow-xs"
                            >
                              {labels[r]}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. Se estiver em Modo de Simulação: Botão de Retorno ao Admin */}
                {isSimulating && (
                  <div className="space-y-2 pt-1 border-t border-slate-200 dark:border-[#222222]">
                    <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-600/40 rounded-2xl text-[11px] text-amber-900 dark:text-amber-200 space-y-1.5">
                      <div className="font-bold flex items-center gap-1.5">
                        <Eye className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                        <span>Simulação Ativa ({currentUser?.role_label})</span>
                      </div>
                      <p className="text-[10px] text-amber-800/80 dark:text-amber-300/80 leading-tight">
                        Você está vendo o sistema como este setor. Clique abaixo para retornar à visão de Administrador Geral.
                      </p>
                      <button
                        onClick={() => {
                          setRoleDropdownOpen(false);
                          stopSimulation();
                        }}
                        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-400 text-black font-extrabold rounded-xl text-xs transition-colors shadow-sm"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Voltar para Administrador</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Opção de Troca de Senha */}
                <div className="pt-2 border-t border-slate-200 dark:border-[#222222]">
                  <button
                    onClick={() => {
                      setRoleDropdownOpen(false);
                      onOpenChangePassword?.();
                    }}
                    className="w-full flex items-center justify-start gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1E1E1E] transition-colors"
                  >
                    <KeyRound className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                    <span>Alterar Minha Senha</span>
                  </button>
                </div>

                {/* 5. Ação de Logout */}
                <div className="pt-2 border-t border-slate-200 dark:border-[#222222]">
                  <button
                    onClick={() => {
                      setRoleDropdownOpen(false);
                      logout();
                    }}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 hover:text-rose-700 dark:hover:text-rose-300 transition-colors font-bold bg-white dark:bg-[#181818] border border-rose-200 dark:border-rose-900/30 shadow-xs"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sair do Sistema</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Botão Alternar Tema Claro / Escuro */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1C1C1C] transition-colors"
            title={theme === 'dark' ? 'Mudar para Tema Claro' : 'Mudar para Tema Escuro'}
            aria-label="Alternar tema de cores"
          >
            {theme === 'dark' ? (
              <Sun className="w-5 h-5 text-amber-400 hover:rotate-45 transition-transform" />
            ) : (
              <Moon className="w-5 h-5 text-indigo-500 hover:-rotate-12 transition-transform" />
            )}
          </button>

          {/* Notifications Bell with Unread Badge */}
          <button
            onClick={onOpenNotifications}
            className="relative p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1C1C1C] transition-colors"
            title="Notificações"
          >
            <Bell className="w-5 h-5" />
            {unreadNotificationsCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center animate-bounce shadow-md shadow-rose-500/50">
                {unreadNotificationsCount}
              </span>
            )}
          </button>

          {/* Quick Logout Button */}
          <button
            onClick={logout}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors hidden sm:flex"
            title="Sair do Sistema"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
};
