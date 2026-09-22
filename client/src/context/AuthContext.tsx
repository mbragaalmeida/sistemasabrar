import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { api } from '../services/api';

interface AuthContextType {
  currentUser: User | null;
  users: User[];
  activeRole: UserRole;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  switchUser: (userId: number) => void;
  switchRole: (role: UserRole) => void;
  hasPermission: (allowedRoles: UserRole[]) => boolean;
  refreshUsers: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('sabrar_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const loadUsers = async () => {
    try {
      const data = await api.getUsers();
      setUsers(data);
      // Se tiver usuário salvo no localStorage, sincroniza os dados mais recentes
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
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.login({ email, password });
    if (res.user) {
      setCurrentUser(res.user);
      localStorage.setItem('sabrar_user', JSON.stringify(res.user));
      if (res.token) {
        localStorage.setItem('sabrar_token', res.token);
      }
    }
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem('sabrar_user');
    localStorage.removeItem('sabrar_token');
  };

  const switchUser = (userId: number) => {
    const selected = users.find(u => u.id === userId);
    if (selected) {
      setCurrentUser(selected);
      localStorage.setItem('sabrar_user', JSON.stringify(selected));
    }
  };

  const switchRole = (role: UserRole) => {
    const userForRole = users.find(u => u.role === role);
    if (userForRole) {
      setCurrentUser(userForRole);
      localStorage.setItem('sabrar_user', JSON.stringify(userForRole));
    }
  };

  const hasPermission = (allowedRoles: UserRole[]) => {
    if (!currentUser) return false;
    if (currentUser.role === 'admin') return true; // Admin tem acesso irrestrito
    return allowedRoles.includes(currentUser.role);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        users,
        activeRole: currentUser?.role || 'admin',
        login,
        logout,
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
