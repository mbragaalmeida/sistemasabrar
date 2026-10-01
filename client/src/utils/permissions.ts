import { UserRole } from '../types';

export const PAGE_PERMISSIONS: Record<string, UserRole[]> = {
  'dashboard': ['admin', 'orcamento', 'engenharia', 'almoxarifado', 'compras', 'orcamento_engenharia', 'compras_solicitacoes'],
  'projects': ['admin', 'orcamento', 'engenharia', 'orcamento_engenharia'],
  'project-detail': ['admin', 'orcamento', 'engenharia', 'orcamento_engenharia'],
  'budgets': ['admin', 'orcamento', 'orcamento_engenharia'],
  'ducts': ['admin', 'orcamento', 'engenharia', 'orcamento_engenharia'],
  'materials': ['admin', 'almoxarifado'],
  'stock': ['admin', 'almoxarifado'],
  'requests': ['admin', 'engenharia', 'orcamento_engenharia', 'compras_solicitacoes'],
  'purchases': ['admin', 'compras', 'compras_solicitacoes'],
  'ai-hub': ['admin', 'orcamento', 'orcamento_engenharia'],
  'suppliers': ['admin', 'compras', 'compras_solicitacoes'],
  'reports': ['admin'],
  'audit': ['admin'],
  'users': ['admin'],
  'notifications': ['admin', 'orcamento', 'engenharia', 'almoxarifado', 'compras', 'orcamento_engenharia', 'compras_solicitacoes']
};

export function isPageAllowed(page: string, role: UserRole): boolean {
  if (role === 'admin') return true;
  const allowed = PAGE_PERMISSIONS[page];
  if (!allowed) return true;
  return allowed.includes(role);
}

export interface BottomNavItem {
  id: string;
  label: string;
  iconName: 'dashboard' | 'projects' | 'budgets' | 'materials' | 'stock' | 'requests' | 'purchases' | 'ai-hub' | 'suppliers';
}

export function getBottomNavItemsForRole(role: UserRole): BottomNavItem[] {
  switch (role) {
    case 'orcamento':
      return [
        { id: 'dashboard', label: 'Início', iconName: 'dashboard' },
        { id: 'projects', label: 'Obras', iconName: 'projects' },
        { id: 'budgets', label: 'Orçamentos', iconName: 'budgets' },
        { id: 'ai-hub', label: 'IA Hub', iconName: 'ai-hub' }
      ];
    case 'engenharia':
      return [
        { id: 'dashboard', label: 'Início', iconName: 'dashboard' },
        { id: 'projects', label: 'Obras', iconName: 'projects' },
        { id: 'requests', label: 'Solicitar', iconName: 'requests' }
      ];
    case 'orcamento_engenharia':
      return [
        { id: 'dashboard', label: 'Início', iconName: 'dashboard' },
        { id: 'projects', label: 'Obras', iconName: 'projects' },
        { id: 'budgets', label: 'Orçamentos', iconName: 'budgets' },
        { id: 'requests', label: 'Solicitar', iconName: 'requests' }
      ];
    case 'almoxarifado':
      return [
        { id: 'dashboard', label: 'Início', iconName: 'dashboard' },
        { id: 'stock', label: 'Almoxarifado', iconName: 'stock' },
        { id: 'materials', label: 'Materiais', iconName: 'materials' }
      ];
    case 'compras':
      return [
        { id: 'dashboard', label: 'Início', iconName: 'dashboard' },
        { id: 'purchases', label: 'Compras', iconName: 'purchases' },
        { id: 'suppliers', label: 'Fornecedores', iconName: 'suppliers' }
      ];
    case 'compras_solicitacoes':
      return [
        { id: 'dashboard', label: 'Início', iconName: 'dashboard' },
        { id: 'requests', label: 'Solicitações', iconName: 'requests' },
        { id: 'purchases', label: 'Compras', iconName: 'purchases' },
        { id: 'suppliers', label: 'Fornecedores', iconName: 'suppliers' }
      ];
    case 'admin':
    default:
      return [
        { id: 'dashboard', label: 'Início', iconName: 'dashboard' },
        { id: 'projects', label: 'Obras', iconName: 'projects' },
        { id: 'stock', label: 'Almoxarifado', iconName: 'stock' },
        { id: 'requests', label: 'Solicitar', iconName: 'requests' }
      ];
  }
}
