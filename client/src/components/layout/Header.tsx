import React, { useState } from 'react';
import { Search, Bell, Menu, Shield, UserCheck, ChevronDown, LogOut, Sun, Moon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

interface HeaderProps {
  onOpenSearch: () => void;
  onOpenNotifications: () => void;
  onToggleSidebar: () => void;
  unreadNotificationsCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenSearch,
  onOpenNotifications,
  onToggleSidebar,
  unreadNotificationsCount = 0
}) => {
  const { currentUser, users, switchUser, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-[#0A0A0A] text-white border-b border-[#222222] px-3 sm:px-6 py-2.5 shadow-xl">
      <div className="flex items-center justify-between gap-2 max-w-7xl mx-auto">
        {/* Left: Mobile Menu Toggle & Brand Logo Oficial */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={onToggleSidebar}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-[#1C1C1C] transition-colors md:hidden focus:outline-none focus:ring-2 focus:ring-sabrar-500"
            aria-label="Abrir menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Logomarca Oficial Unificada SABRAR */}
          <div className="flex items-center cursor-pointer select-none py-0.5">
            <img
              src="/sabrar-logo.png"
              alt="SABRAR Engenharia — Ar Condicionado e Exaustão"
              className="h-8 sm:h-9 w-auto object-contain max-w-[190px] sm:max-w-[250px] drop-shadow transition-transform hover:scale-[1.02]"
            />
          </div>
        </div>

        {/* Center: Global Search Bar Trigger */}
        <button
          onClick={onOpenSearch}
          className="hidden sm:flex items-center gap-2 bg-[#141414] hover:bg-[#1E1E1E] text-slate-300 hover:text-white px-3.5 py-1.5 rounded-2xl border border-[#262626] text-xs transition-all w-48 md:w-64 lg:w-80 shadow-inner group"
        >
          <Search className="w-4 h-4 text-slate-400 group-hover:text-sabrar-400 transition-colors" />
          <span className="truncate">Buscar em todo o sistema...</span>
        </button>

        {/* Right: Quick Role Switcher + Search icon (Mobile) + Notifications */}
        <div className="flex items-center gap-1.5 sm:gap-3">
          {/* Mobile Search Icon */}
          <button
            onClick={onOpenSearch}
            className="sm:hidden p-2 rounded-xl text-slate-400 hover:text-white hover:bg-[#1C1C1C] transition-colors"
            title="Buscar"
          >
            <Search className="w-5 h-5" />
          </button>

          {/* Quick Role Switcher (Perfis de Usuário) */}
          <div className="relative">
            <button
              onClick={() => setRoleDropdownOpen(!roleDropdownOpen)}
              className="flex items-center gap-2 bg-[#141414] hover:bg-[#1E1E1E] text-white pl-2 pr-2.5 py-1.5 rounded-2xl border border-[#262626] text-xs transition-all shadow-sm"
              title="Trocar perfil de acesso rápido"
            >
              <div className="w-6 h-6 rounded-lg bg-sabrar-500/20 text-sabrar-400 border border-sabrar-500/30 flex items-center justify-center font-bold text-xs shrink-0">
                <Shield className="w-3.5 h-3.5" />
              </div>
              <div className="text-left hidden xs:block">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold leading-tight">
                  Perfil
                </div>
                <div className="font-bold text-sabrar-300 truncate max-w-[100px] sm:max-w-[130px] leading-tight">
                  {currentUser?.role_label || 'Admin'}
                </div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            </button>

            {/* Dropdown Menu */}
            {roleDropdownOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-[#121212] rounded-2xl shadow-2xl border border-[#262626] py-2 z-50 text-slate-100 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="px-3 py-2 border-b border-[#222222]">
                  <div className="text-xs font-bold uppercase tracking-wider text-sabrar-400">
                    Alternar Perfil (Simulação)
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Teste fluxos e permissões de cada setor da SABRAR
                  </div>
                </div>

                <div className="p-1 space-y-1">
                  {users.map((u) => {
                    const isSelected = currentUser?.id === u.id;
                    return (
                      <button
                        key={u.id}
                        onClick={() => {
                          switchUser(u.id);
                          setRoleDropdownOpen(false);
                        }}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left text-xs transition-colors ${
                          isSelected
                            ? 'bg-sabrar-950/90 text-sabrar-300 font-semibold border border-sabrar-500/40'
                            : 'hover:bg-[#1C1C1C] text-slate-300'
                        }`}
                      >
                        <img
                          src={u.avatar}
                          alt={u.name}
                          className="w-7 h-7 rounded-full object-cover border border-[#262626] shrink-0"
                        />
                        <div className="flex-1 truncate">
                          <div className="font-bold text-white truncate">{u.name}</div>
                          <div className="text-[11px] text-slate-400 truncate">{u.role_label}</div>
                        </div>
                        {isSelected && <UserCheck className="w-4 h-4 text-sabrar-400 shrink-0" />}
                      </button>
                    );
                  })}
                </div>

                <div className="p-1 border-t border-[#222222] mt-1">
                  <button
                    onClick={() => {
                      setRoleDropdownOpen(false);
                      logout();
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-left text-xs text-rose-400 hover:bg-rose-950/40 hover:text-rose-300 transition-colors font-medium"
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
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-[#1C1C1C] transition-colors"
            title={theme === 'dark' ? 'Mudar para Tema Claro' : 'Mudar para Tema Escuro'}
            aria-label="Alternar tema de cores"
          >
            {theme === 'dark' ? (
              <Sun className="w-5 h-5 text-amber-400 hover:rotate-45 transition-transform" />
            ) : (
              <Moon className="w-5 h-5 text-indigo-400 hover:-rotate-12 transition-transform" />
            )}
          </button>

          {/* Notifications Bell with Unread Badge */}
          <button
            onClick={onOpenNotifications}
            className="relative p-2 rounded-xl text-slate-400 hover:text-white hover:bg-[#1C1C1C] transition-colors"
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
            className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors hidden sm:flex"
            title="Sair do Sistema"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
};
