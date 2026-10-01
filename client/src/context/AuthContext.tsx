import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { api } from '../services/api';

interface AuthContextType {
  currentUser: User | null;
  users: User[];
  activeRole: UserRole;
  isSimulating: boolean;
  originalAdmin: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  simulateRole: (role: UserRole) => void;
  stopSimulation: () => void;
  switchUser: (userId: number) => void;
  switchRole: (role: UserRole) => void;
  hasPermission: (allowedRoles: UserRole[]) => boolean;
  refreshUsers: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ROLE_LABELS: Record<UserRole, { label: string; department: string }> = {
  admin: { label: 'Administrador Geral', department: 'Diretoria Executiva' },
  orcamento: { label: 'Setor de Orçamento', department: 'Engenharia de Custos' },
  engenharia: { label: 'Engenharia de Obras', department: 'Obras & Operações' },
  orcamento_engenharia: { label: 'Orçamento e Engenharia', department: 'Engenharia & Custos' },
  almoxarifado: { label: 'Almoxarifado & Estoque', department: 'Logística & Almoxarifado' },
  compras: { label: 'Compras & Suprimentos', department: 'Suprimentos & Compras' },
  compras_solicitacoes: { label: 'Compras & Solicitações', department: 'Suprimentos & Compras' }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [originalAdmin, setOriginalAdmin] = useState<User | null>(() => {
    try {
      const saved = sessionStorage.getItem('sabrar_original_admin');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('sabrar_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const isSimulating = Boolean(originalAdmin);

  const loadUsers = async () => {
    try {
      const user = currentUser;
      // Se não há usuário logado ou se o usuário NÃO é admin/orçamento_engenharia (e não está simulando), não carrega lista geral
      if (!user) return;
      if (user.role !== 'admin' && user.role !== 'orcamento_engenharia' && !originalAdmin) {
        setUsers([user]);
        return;
      }

      const data = await api.getUsers();
      setUsers(data);

      // Sincroniza dados mais recentes do usuário atual
      const saved = localStorage.getItem('sabrar_user');
      if (saved) {
        const parsed = JSON.parse(saved);
        const match = data.find((u: User) => u.id === parsed.id || u.email.toLowerCase() === parsed.email.toLowerCase());
        if (match) {
          setCurrentUser(match);
          localStorage.setItem('sabrar_user', JSON.stringify(match));
        }
      }
    } catch (err) {
      console.error('Erro ao carregar usuários:', err);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [currentUser?.id, currentUser?.role]);

  const login = async (email: string, password: string) => {
    // Limpa qualquer simulação ativa prévia
    sessionStorage.removeItem('sabrar_original_admin');
    setOriginalAdmin(null);

    const res = await api.login({ email, password });
    if (res.user) {
      setCurrentUser(res.user);
      localStorage.setItem('sabrar_user', JSON.stringify(res.user));
      if (res.token) {
        localStorage.setItem('sabrar_token', res.token);
      }
      if (res.user.role === 'admin') {
        try {
          const allUsers = await api.getUsers();
          setUsers(allUsers);
        } catch {
          setUsers([res.user]);
        }
      } else {
        setUsers([res.user]);
      }
    }
  };

  const logout = () => {
    setCurrentUser(null);
    setOriginalAdmin(null);
    setUsers([]);
    localStorage.removeItem('sabrar_user');
    localStorage.removeItem('sabrar_token');
    sessionStorage.removeItem('sabrar_original_admin');
  };

  // Simular visão de setor específico (exclusivo para Administrador Geral)
  const simulateRole = (role: UserRole) => {
    if (currentUser?.role !== 'admin' && !originalAdmin) {
      console.warn('Simulação permitida apenas para o Administrador Geral.');
      return;
    }

    // Salva o admin original se ainda não estiver simulando
    const adminToSave = originalAdmin || currentUser;
    if (!originalAdmin && adminToSave) {
      setOriginalAdmin(adminToSave);
      sessionStorage.setItem('sabrar_original_admin', JSON.stringify(adminToSave));
    }

    if (role === 'admin') {
      stopSimulation();
      return;
    }

    // Encontra um usuário real daquele setor ou gera uma representação simulada segura
    const targetUser = users.find(u => u.role === role);
    const meta = ROLE_LABELS[role] || { label: role, department: 'Operações' };

    const simulatedUser: User = targetUser ? {
      ...targetUser,
      role,
      role_label: meta.label,
      department: meta.department
    } : {
      id: 900 + Math.floor(Math.random() * 99),
      name: `Simulação (${meta.label})`,
      email: `${role}@sabrar.com.br`,
      role,
      role_label: meta.label,
      department: meta.department,
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(meta.label)}&background=10b981&color=fff&bold=true`
    };

    setCurrentUser(simulatedUser);
    localStorage.setItem('sabrar_user', JSON.stringify(simulatedUser));
  };

  // Encerrar simulação e voltar imediatamente para o Administrador Geral
  const stopSimulation = () => {
    if (originalAdmin) {
      setCurrentUser(originalAdmin);
      localStorage.setItem('sabrar_user', JSON.stringify(originalAdmin));
      setOriginalAdmin(null);
      sessionStorage.removeItem('sabrar_original_admin');
    }
  };

  // Chavear para um usuário específico (Apenas para Admin em modo de teste)
  const switchUser = (userId: number) => {
    if (currentUser?.role !== 'admin' && !originalAdmin) {
      console.warn('Acesso negado: apenas o Administrador Geral pode alternar perfis.');
      return;
    }

    const selected = users.find(u => u.id === userId);
    if (!selected) return;

    if (selected.role !== 'admin') {
      const adminToSave = originalAdmin || currentUser;
      if (!originalAdmin && adminToSave) {
        setOriginalAdmin(adminToSave);
        sessionStorage.setItem('sabrar_original_admin', JSON.stringify(adminToSave));
      }
    } else {
      // Se selecionou o próprio admin, encerra qualquer simulação
      setOriginalAdmin(null);
      sessionStorage.removeItem('sabrar_original_admin');
    }

    setCurrentUser(selected);
    localStorage.setItem('sabrar_user', JSON.stringify(selected));
  };

  const switchRole = (role: UserRole) => {
    simulateRole(role);
  };

  const hasPermission = (allowedRoles: UserRole[]) => {
    if (!currentUser) return false;
    if (currentUser.role === 'admin') return true;
    return allowedRoles.includes(currentUser.role);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        users,
        activeRole: currentUser?.role || 'admin',
        isSimulating,
        originalAdmin,
        login,
        logout,
        simulateRole,
        stopSimulation,
        switchUser,
        switchRole,
        hasPermission,
        refreshUsers: loadUsers
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth deve ser utilizado dentro de AuthProvider');
  return context;
};
