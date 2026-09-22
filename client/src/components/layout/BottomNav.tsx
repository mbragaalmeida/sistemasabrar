import React from 'react';
import {
  LayoutDashboard,
  FolderKanban,
  Calculator,
  Package,
  Layers,
  ClipboardList,
  ShoppingCart,
  Sparkles,
  Truck,
  Menu
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getBottomNavItemsForRole } from '../../utils/permissions';

interface BottomNavProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  onOpenSidebar: () => void;
}

const ICON_MAP = {
  dashboard: LayoutDashboard,
  projects: FolderKanban,
  budgets: Calculator,
  materials: Package,
  stock: Layers,
  requests: ClipboardList,
  purchases: ShoppingCart,
  'ai-hub': Sparkles,
  suppliers: Truck
};

export const BottomNav: React.FC<BottomNavProps> = ({ currentPage, onNavigate, onOpenSidebar }) => {
  const { currentUser } = useAuth();
  const userRole = currentUser?.role || 'admin';
  const navItems = getBottomNavItemsForRole(userRole);


  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-dark-900/95 backdrop-blur-md border-t border-dark-750 px-2 py-1 shadow-2xl pb-safe">
      <div className="flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = ICON_MAP[item.iconName] || LayoutDashboard;
          const isActive = currentPage === item.id || (item.id === 'projects' && currentPage === 'project-detail');
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-2xl transition-all min-w-[64px] ${
                isActive
                  ? 'text-sabrar-400 font-bold scale-105'
                  : 'text-slate-400 hover:text-slate-200 font-medium'
              }`}
            >
              <div className={`p-1 rounded-xl transition-colors ${isActive ? 'bg-sabrar-950 border border-sabrar-500/40 text-sabrar-400 shadow-sm' : ''}`}>
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
              </div>
              <span className="text-[10px] tracking-tight mt-0.5">{item.label}</span>
            </button>
          );
        })}

        {/* Botão Mais para abrir o menu gaveta completo */}
        <button
          onClick={onOpenSidebar}
          className="flex flex-col items-center justify-center py-1.5 px-3 rounded-2xl text-slate-400 hover:text-slate-200 font-medium transition-all min-w-[64px]"
        >
          <div className="p-1 rounded-xl">
            <Menu className="w-5 h-5 stroke-2" />
          </div>
          <span className="text-[10px] tracking-tight mt-0.5">Mais</span>
        </button>
      </div>
    </nav>
  );
};
