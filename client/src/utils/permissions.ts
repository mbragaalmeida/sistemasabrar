import { UserRole } from '../types';

export const PAGE_PERMISSIONS: Record<string, UserRole[]> = {
  // Item 5: Excluir a aba Dashboard para todos menos para admins, Emily (compras_solicitacoes) e Sabrina (orcamento_engenharia)
  'dashboard': ['admin', 'orcamento_engenharia', 'compras_solicitacoes'],
  // Item 2 e Item 6: Remover projetos para engenheiros; ceder acesso a projetos e obras para Emily (compras_solicitacoes)
  'projects': ['admin', 'orcamento', 'orcamento_engenharia', 'compras_solicitacoes'],
  'project-detail': ['admin', 'orcamento', 'orcamento_engenharia', 'compras_solicitacoes'],
  'budgets': ['admin', 'orcamento', 'orcamento_engenharia', 'compras_solicitacoes'],
  'ducts': ['admin', 'orcamento', 'orcamento_engenharia'],
  'materials': ['admin', 'almoxarifado', 'compras', 'compras_solicitacoes', 'orcamento_engenharia'],
  'stock': ['admin', 'almoxarifado', 'compras_solicitacoes', 'orcamento_engenharia'],
  'requests': ['admin', 'engenharia', 'orcamento_engenharia', 'compras_solicitacoes', 'compras'],
  'purchases': ['admin', 'compras', 'compras_solicitacoes'],
  'ai-hub': ['admin', 'orcamento', 'orcamento_engenharia'],
  'bi-purchases-stock': ['admin', 'orcamento_engenharia', 'compras_solicitacoes', 'compras'],
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
 * Verifica se o usuário tem perfil com autoridade de aprovação (Admin, Sabrina ou Emily)
 */
export function canUserApproveOperations(user?: { role?: string; email?: string; name?: string } | null | undefined): boolean {
  if (!user) return false;
  if (user.role === 'admin' || user.role === 'compras_solicitacoes' || user.role === 'orcamento_engenharia') return true;
  const name = String(user.name || '').toLowerCase();
  const email = String(user.email || '').toLowerCase();
  return /sabrina|emily/i.test(name) || /sabrina|emily/i.test(email);
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
 * Permitido para Admins, Almoxarifado, Emily (compras_solicitacoes) e Sabrina (orcamento_engenharia).
 */
export function canCreateMaterial(user: { role?: string; email?: string; name?: string } | null | undefined): boolean {
  if (!user) return false;
  if (user.role === 'admin' || user.role === 'almoxarifado' || user.role === 'compras_solicitacoes' || user.role === 'orcamento_engenharia') {
    return true;
  }
  const name = String(user.name || '').toLowerCase();
  const email = String(user.email || '').toLowerCase();
  return /sabrina|emily/i.test(name) || /sabrina|emily/i.test(email);
}

/**
 * Permissão para realizar entrada de materiais via NF-e (XML):
 * Permitido para todos os perfis de Compras (compras e compras_solicitacoes/Emily),
 * Almoxarifado, Orçamento/Engenharia (Sabrina) e Administradores.
 */
export function canImportXml(user: { role?: string; email?: string; name?: string } | null | undefined): boolean {
  if (!user) return false;
  if (
    user.role === 'admin' ||
    user.role === 'almoxarifado' ||
    user.role === 'compras' ||
    user.role === 'compras_solicitacoes' ||
    user.role === 'orcamento_engenharia'
  ) {
    return true;
  }
  const name = String(user.name || '').toLowerCase();
  const email = String(user.email || '').toLowerCase();
  return /sabrina|emily/i.test(name) || /sabrina|emily/i.test(email);
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

/**
 * Permissão para registrar devolução de materiais ao almoxarifado:
 * Liberado para Jennifer (compras/compras3@sabrar.com.br), Almoxarifado,
 * todo o setor de Compras (compras e compras_solicitacoes/Emily),
 * Orçamento/Engenharia (Sabrina) e Administradores.
 */
export function canRegisterReturn(user?: { role?: string; email?: string; name?: string } | null | undefined): boolean {
  if (!user) return false;
  if (
    user.role === 'admin' ||
    user.role === 'almoxarifado' ||
    user.role === 'compras' ||
    user.role === 'compras_solicitacoes' ||
    user.role === 'orcamento_engenharia'
  ) {
    return true;
  }
  const name = String(user.name || '').toLowerCase();
  const email = String(user.email || '').toLowerCase();
  return /jennifer|sabrina|emily/i.test(name) || /jennifer|sabrina|emily/i.test(email);
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
        { id: 'materials', label: 'Materiais', iconName: 'materials' },
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
