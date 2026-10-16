import { UserRole } from '../types';

export const PAGE_PERMISSIONS: Record<string, UserRole[]> = {
  // Item 5: Excluir a aba Dashboard para todos menos para admins, Emily (compras_solicitacoes) e Sabrina (orcamento_engenharia)
  'dashboard': ['admin', 'orcamento_engenharia', 'compras_solicitacoes'],
  // Item 2 e Item 6: Remover projetos para engenheiros; ceder acesso a projetos e obras para Emily (compras_solicitacoes)
  'projects': ['admin', 'orcamento', 'orcamento_engenharia', 'compras_solicitacoes'],
  'project-detail': ['admin', 'orcamento', 'orcamento_engenharia', 'compras_solicitacoes'],
  'budgets': ['admin', 'orcamento', 'orcamento_engenharia', 'compras_solicitacoes'],
  'ducts': ['admin', 'orcamento', 'orcamento_engenharia'],
  'materials': ['admin', 'almoxarifado', 'compras', 'compras_solicitacoes'],
  'stock': ['admin', 'almoxarifado'],
  'requests': ['admin', 'engenharia', 'orcamento_engenharia', 'compras_solicitacoes', 'compras'],
  'purchases': ['admin', 'compras', 'compras_solicitacoes'],
  'ai-hub': ['admin', 'orcamento', 'orcamento_engenharia'],
  'suppliers': ['admin', 'compras_solicitacoes'],
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

export function getDefaultPageForRole(role?: UserRole): string {
  switch (role) {
    case 'admin':
    case 'orcamento_engenharia':
    case 'compras_solicitacoes':
      return 'dashboard';
    case 'engenharia':
      return 'requests';
    case 'almoxarifado':
      return 'stock';
    case 'compras':
      return 'purchases';
    case 'orcamento':
      return 'projects';
    default:
      return 'requests';
  }
}

/**
 * Item 1: Remover preço dos materiais e obras para todos os engenheiros e almoxarifado
 */
export function canUserViewPrices(user: { role?: string; email?: string; name?: string } | null | undefined): boolean {
  if (!user) return false;
  if (user.role === 'engenharia' || user.role === 'almoxarifado') return false;
  return true;
}

/**
 * Permissão para cadastrar novo produto na Base de Materiais:
 * Usuários de 'compras' podem apenas dar entrada em materiais já cadastrados, sem cadastrar novo produto.
 */
export function canCreateMaterial(user: { role?: string; email?: string; name?: string } | null | undefined): boolean {
  if (!user) return false;
  if (user.role === 'compras') return false;
  return user.role === 'admin' || user.role === 'almoxarifado';
}

/**
 * Permissão para exclusão de projetos: Apenas administradores e a Sabrina (Item 1 antigo)
 */
export function canDeleteProject(user: { role?: string; email?: string; name?: string } | null | undefined): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;
  const email = (user.email || '').toLowerCase();
  const name = (user.name || '').toLowerCase();
  return email.includes('sabrina') || name.includes('sabrina');
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
        { id: 'projects', label: 'Obras', iconName: 'projects' },
        { id: 'budgets', label: 'Orçamentos', iconName: 'budgets' },
        { id: 'ai-hub', label: 'IA Hub', iconName: 'ai-hub' }
      ];
    case 'engenharia':
      return [
        { id: 'requests', label: 'Solicitar Material', iconName: 'requests' }
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
        { id: 'stock', label: 'Almoxarifado', iconName: 'stock' },
        { id: 'materials', label: 'Materiais', iconName: 'materials' }
      ];
    case 'compras':
      return [
        { id: 'purchases', label: 'Compras', iconName: 'purchases' },
        { id: 'materials', label: 'Base Materiais', iconName: 'materials' },
        { id: 'requests', label: 'Solicitar', iconName: 'requests' }
      ];
    case 'compras_solicitacoes':
      return [
        { id: 'dashboard', label: 'Início', iconName: 'dashboard' },
        { id: 'projects', label: 'Obras', iconName: 'projects' },
        { id: 'requests', label: 'Solicitações', iconName: 'requests' },
        { id: 'purchases', label: 'Compras', iconName: 'purchases' },
        { id: 'materials', label: 'Base Materiais', iconName: 'materials' }
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
