import React, { useState, useEffect } from 'react';
import { Bell, CheckCircle, Flame, AlertTriangle, Info, Check, ExternalLink } from 'lucide-react';
import { api } from '../services/api';
import { Notification } from '../types';
import { useAuth } from '../context/AuthContext';

interface NotificationsPageProps {
  onNavigate?: (page: string, id?: number) => void;
}

export const NotificationsPage: React.FC<NotificationsPageProps> = ({ onNavigate }) => {
  const { currentUser } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifs = async () => {
    setLoading(true);
    try {
      const data = await api.getNotifications(currentUser?.role, currentUser?.id);
      setNotifications(data.notifications || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifs();
  }, []);

  const handleNavigateToLink = (n: Notification) => {
    if (!n.link || !onNavigate) return;
    const link = n.link.trim().toLowerCase();

    if (link.startsWith('/projetos/') || link.startsWith('/obras/')) {
      const parts = n.link.split('/');
      const id = Number(parts[2]);
      if (!isNaN(id)) {
        onNavigate('project-detail', id);
      } else {
        onNavigate('projects');
      }
    } else if (link === '/materiais' || link.startsWith('/materiais') || link.startsWith('/materials')) {
      onNavigate('materials');
    } else if (link === '/solicitacoes' || link.startsWith('/solicitacoes') || link.startsWith('/requests')) {
      onNavigate('requests');
    } else if (link === '/compras' || link.startsWith('/compras') || link.startsWith('/purchases')) {
      onNavigate('purchases');
    } else if (link === '/estoque' || link.startsWith('/estoque') || link.startsWith('/stock')) {
      onNavigate('stock');
    } else if (link === '/projetos' || link.startsWith('/projetos') || link.startsWith('/obras')) {
      onNavigate('projects');
    } else if (link === '/dashboard' || link.startsWith('/dashboard')) {
      onNavigate('dashboard');
    } else if (link === '/ai-hub' || link.startsWith('/ai')) {
      onNavigate('ai-hub');
    } else {
      const page = link.replace(/^\//, '');
      onNavigate(page);
    }

    if (!n.is_read) {
      handleMarkAsRead(n.id);
    }
  };

  const handleMarkAsRead = async (id: number) => {
    try {
      await api.markNotificationRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 max-w-4xl mx-auto pb-16">
      <div className="flex items-center justify-between bg-dark-900 p-4 sm:p-5 rounded-3xl border border-dark-750 shadow-xl">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-sabrar-950/70 border border-sabrar-500/40 flex items-center justify-center text-sabrar-400">
            <Bell className="w-5 h-5" />
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Central de Notificações
          </h1>
        </div>
        <button
          onClick={handleMarkAllRead}
          className="text-xs font-bold text-sabrar-400 hover:text-sabrar-300 px-3 py-1.5 rounded-xl bg-dark-850 border border-dark-700 transition-colors"
        >
          Marcar todas como lidas
        </button>
      </div>

      {loading && (
        <div className="py-20 text-center text-sm text-slate-500">
          Carregando notificações...
        </div>
      )}

      {!loading && (
        <div className="space-y-2.5">
          {notifications.length === 0 ? (
            <div className="py-16 text-center bg-dark-900 rounded-3xl border border-dark-750 text-xs text-slate-500">
              Nenhuma notificação encontrada.
            </div>
          ) : (
            notifications.map((n) => {
              const isUnread = n.is_read === 0;
              return (
                <div
                  key={n.id}
                  onClick={() => {
                    if (n.link && onNavigate) handleNavigateToLink(n);
                  }}
                  className={`p-4 rounded-3xl border transition-all flex items-start justify-between gap-3 ${
                    n.link && onNavigate ? 'cursor-pointer hover:border-sabrar-500/80 active:scale-[0.99]' : ''
                  } ${
                    isUnread
                      ? 'bg-dark-900 border-sabrar-500/40 shadow-md'
                      : 'bg-dark-900/60 border-dark-750 text-slate-400'
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className={`p-2 rounded-2xl shrink-0 ${
                        n.type === 'urgent'
                          ? 'bg-rose-950 text-rose-400 border border-rose-800'
                          : n.type === 'warning'
                          ? 'bg-amber-950 text-amber-400 border border-amber-800'
                          : 'bg-dark-850 text-sabrar-400 border border-dark-700'
                      }`}
                    >
                      <Bell className="w-4 h-4" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className={`font-bold text-sm ${isUnread ? 'text-white' : 'text-slate-300'}`}>
                          {n.title}
                        </h3>
                        {isUnread && (
                          <span className="w-2 h-2 rounded-full bg-sabrar-500 animate-pulse"></span>
                        )}
                      </div>
                      <p className="text-xs text-slate-300 mt-1 leading-relaxed break-words">{n.message}</p>
                      <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-500 flex-wrap">
                        {n.role_target && (
                          <span className="font-semibold text-sabrar-400 bg-sabrar-950 px-2 py-0.5 rounded-md border border-sabrar-500/30 uppercase">
                            {n.role_target}
                          </span>
                        )}
                        <span>{new Date(n.created_at).toLocaleDateString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    {isUnread && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkAsRead(n.id);
                        }}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-sabrar-400 hover:bg-dark-800 transition-colors shrink-0"
                        title="Marcar como lida"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    )}
                    {n.link && onNavigate && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleNavigateToLink(n);
                        }}
                        className="p-1.5 rounded-xl text-sabrar-400 hover:text-white bg-dark-850 hover:bg-sabrar-600 border border-dark-700 hover:border-sabrar-500 transition-all flex items-center gap-1 shadow-sm active:scale-95"
                        title="Acessar módulo de destino"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
