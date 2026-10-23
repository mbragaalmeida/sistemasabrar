import React, { useState } from 'react';
import {
  LayoutDashboard,
  FolderKanban,
  Calculator,
  Package,
  Layers,
  ClipboardList,
  ShoppingCart,
  Truck,
  Sparkles,
  BarChart3,
  History,
  Users,
  X,
  LogOut,
  Wind,
  ChevronDown,
  ChevronUp,
  Eye,
  RotateCcw,
  Shield,
  KeyRound
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { isPageAllowed } from '../../utils/permissions';
import { UserRole } from '../../types';

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  onOpenChangePassword?: () => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

interface NavGroup {
  group: string;
  items: NavItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentPage,
  onNavigate,
  isOpenMobile,
  onCloseMobile,
  onOpenChangePassword
}) => {
  const { currentUser, isSimulating, simulateRole, stopSimulation, logout } = useAuth();
  const { theme } = useTheme();
  const userRole = currentUser?.role || 'admin';
  const isAdmin = currentUser?.role === 'admin' && !isSimulating;
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const rawNavGroups: NavGroup[] = [
    {
      group: 'OPERAÇÕES',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'projects', label: 'Projetos & Obras', icon: FolderKanban },
        { id: 'budgets', label: 'Orçamentos Aprovados', icon: Calculator },
        { id: 'ducts', label: 'Dutos', icon: Wind },
        { id: 'materials', label: 'Base de Materiais', icon: Package },
        { id: 'stock', label: 'Almoxarifado', icon: Layers },
        { id: 'requests', label: 'Solicitar Material', icon: ClipboardList },
        { id: 'purchases', label: 'Compras & Cotações', icon: ShoppingCart }
      ]
    },
    {
      group: 'INTELIGÊNCIA SABRAR',
      items: [
        {
          id: 'ai-hub',
          label: 'IA & Aprendizado',
          icon: Sparkles,
          badge: 'Ativo'
        }
      ]
    },
    {
      group: 'GESTÃO & AUDITORIA',
      items: [
        { id: 'bi-purchases-stock', label: 'BI Compras & Estoque', icon: BarChart3, badge: 'BI' },
        { id: 'suppliers', label: 'Fornecedores', icon: Truck },
        { id: 'reports', label: 'Relatórios', icon: BarChart3 },
        { id: 'audit', label: 'Auditoria & Logs', icon: History },
        { id: 'users', label: 'Usuários & Perfis', icon: Users }
      ]
    }
  ];

  // Filtra itens permitidos para o perfil real do usuário
  const navGroups: NavGroup[] = rawNavGroups
    .map(group => ({
      ...group,
      items: group.items.filter(item => isPageAllowed(item.id, userRole))
    }))
    .filter(group => group.items.length > 0);



  const handleItemClick = (id: string) => {
    onNavigate(id);
    onCloseMobile();
  };

  return (
    <>
      {/* Backdrop para mobile drawer */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/80 backdrop-blur-xs md:hidden animate-in fade-in"
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed md:sticky top-0 md:top-[57px] left-0 z-50 md:z-30 h-screen md:h-[calc(100vh-57px)] w-64 bg-white dark:bg-[#0A0A0A] text-slate-700 dark:text-slate-200 border-r border-slate-200 dark:border-[#222222] flex flex-col transition-transform duration-200 ease-in-out md:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Mobile Header Inside Drawer com Logomarca Oficial */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-[#222222] md:hidden bg-white dark:bg-[#0A0A0A]">
          <div className="flex items-center">
            <img
              src={theme === 'light' ? '/sabrar-logo-black.png' : '/sabrar-logo.png'}
              alt="SABRAR Engenharia"
              className="h-7 w-auto object-contain max-w-[190px]"
            />
          </div>
          <button
            onClick={onCloseMobile}
            className="p-1 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1A1A1A]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Card com Submenu Expansível (Perfil, Simulação, Gestão e Logout) */}
        <div className="border-b border-slate-200 dark:border-[#222222] bg-slate-50 dark:bg-[#121212]">
          <div
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="p-3 flex items-center justify-between gap-2 cursor-pointer hover:bg-slate-100 dark:hover:bg-[#181818] transition-colors select-none"
            title="Clique para abrir opções de perfil e simulação"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <img
                src={currentUser?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'}
                alt={currentUser?.name}
                className="w-9 h-9 rounded-xl object-cover border-2 border-emerald-500/50 shadow-sm shrink-0"
              />
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-900 dark:text-white truncate">{currentUser?.name}</div>
                <div className="text-[11px] text-emerald-600 dark:text-sabrar-400 font-semibold truncate flex items-center gap-1">
                  <span>{currentUser?.role_label}</span>
                  {isSimulating && (
                    <span className="text-[9px] bg-amber-500/20 text-amber-500 border border-amber-500/30 px-1 rounded font-bold">
                      Simulando
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <div
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                aria-label="Abrir menu de perfil"
              >
                {isUserMenuOpen ? (
                  <ChevronUp className="w-4 h-4 text-emerald-600 dark:text-sabrar-400" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </div>
            </div>
          </div>

          {/* Submenu Retrátil do Usuário */}
          {isUserMenuOpen && (
            <div className="p-3 pt-0 space-y-3 animate-in fade-in slide-in-from-top-2 duration-150 border-t border-slate-200/60 dark:border-[#222222]">
              {/* 1. Header do Cartão: Dados do Usuário */}
              <div className="flex items-center gap-2.5 p-2.5 bg-white dark:bg-[#181818] rounded-2xl border border-slate-200 dark:border-[#242424] shadow-xs mt-2">
                <img
                  src={currentUser?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'}
                  alt={currentUser?.name}
                  className="w-10 h-10 rounded-xl object-cover border border-slate-200 dark:border-[#333333] shrink-0"
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
                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      onNavigate('users');
                      onCloseMobile();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-white hover:bg-slate-100 dark:bg-[#181818] dark:hover:bg-[#202020] border border-slate-200 dark:border-[#2a2a2a] text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white transition-colors shadow-xs"
                  >
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-emerald-600 dark:text-sabrar-400" />
                      <span>Gerenciar Usuários & Perfis</span>
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-sabrar-950 text-emerald-800 dark:text-sabrar-300 border border-emerald-300 dark:border-sabrar-500/30 font-bold">
                      Admin
                    </span>
                  </button>
                </div>
              )}

              {/* Opção de Troca de Senha */}
              <div className="pt-2 border-t border-slate-200 dark:border-[#222222]">
                <button
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    onCloseMobile();
                    onOpenChangePassword?.();
                  }}
                  className="w-full flex items-center justify-start gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#222222] transition-colors"
                >
                  <KeyRound className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                  <span>Alterar Minha Senha</span>
                </button>
              </div>

              {/* 5. Ação de Logout */}
              <div className="pt-2 border-t border-slate-200 dark:border-[#222222]">
                <button
                  onClick={() => {
                    setIsUserMenuOpen(false);
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

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto py-3 px-3 space-y-4">
          {navGroups.map((group) => (
            <div key={group.group}>
              <div className="px-3 mb-1 text-[10px] font-extrabold tracking-wider text-slate-400 dark:text-slate-500 uppercase">
                {group.group}
              </div>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentPage === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleItemClick(item.id)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all group ${
                        isActive
                          ? 'bg-emerald-600 dark:bg-sabrar-600 text-white shadow-md shadow-emerald-600/20 dark:shadow-sabrar-600/30 font-bold'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1A1A1A]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Icon
                          className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${
                            isActive
                              ? 'text-white'
                              : 'text-slate-400 dark:text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-sabrar-400'
                          }`}
                        />
                        <span className="truncate">{item.label}</span>
                      </div>
                      {item.badge && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-50 dark:bg-sabrar-950 text-emerald-700 dark:text-sabrar-400 border border-emerald-200 dark:border-sabrar-500/40">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer info */}
        <div className="p-3 border-t border-slate-200 dark:border-[#222222] bg-slate-50 dark:bg-[#121212] text-[11px] text-slate-500 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Sistema SABRAR v1.0</span>
          </div>
          <span className="text-[10px] text-slate-400">Mobile First</span>
        </div>
      </aside>
    </>
  );
};
