import React from 'react';
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
  LogOut
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { isPageAllowed } from '../../utils/permissions';

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
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
  onCloseMobile
}) => {
  const { currentUser, logout } = useAuth();
  const userRole = currentUser?.role || 'admin';

  const rawNavGroups: NavGroup[] = [
    {
      group: 'OPERAÇÕES',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'projects', label: 'Projetos & Obras', icon: FolderKanban },
        { id: 'budgets', label: 'Orçamentos', icon: Calculator },
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
              src="/sabrar-logo.png"
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

        {/* User Card with Logout */}
        <div className="p-3.5 border-b border-slate-200 dark:border-[#222222] bg-slate-50 dark:bg-[#121212]">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <img
                src={currentUser?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'}
                alt={currentUser?.name}
                className="w-9 h-9 rounded-xl object-cover border-2 border-emerald-500/50 shadow-sm shrink-0"
              />
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-900 dark:text-white truncate">{currentUser?.name}</div>
                <div className="text-[11px] text-emerald-600 dark:text-sabrar-400 font-semibold truncate">{currentUser?.role_label}</div>
              </div>
            </div>
            <button
              onClick={logout}
              title="Sair do Sistema"
              className="p-1.5 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-transparent hover:border-rose-200 dark:hover:border-rose-900/50 transition-all shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
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
