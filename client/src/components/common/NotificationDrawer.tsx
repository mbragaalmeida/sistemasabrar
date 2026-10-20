import React, { useState, useEffect } from 'react';
import { Bell, Check, X, ExternalLink, Info, AlertTriangle, CheckCircle, Flame } from 'lucide-react';
import { api } from '../../services/api';
import { Notification } from '../../types';
import { useAuth } from '../../context/AuthContext';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (page: string, id?: number) => void;
  onUpdateCount?: (count: number) => void;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onUpdateCount
}) => {
  const { currentUser, activeRole } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filterRole, setFilterRole] = useState<string>('all');
  const [loading, setLoading] = useState(false);

  const fetchNotifs = async () => {
    setLoading(true);
    try {
      const data = await api.getNotifications(activeRole !== 'admin' ? currentUser?.role_label : undefined, currentUser?.id);
      setNotifications(data.notifications || []);
      if (onUpdateCount) onUpdateCount(data.unreadCount || 0);
    } catch (err) {
      console.error('Erro ao carregar notificações:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchNotifs();
    }
  }, [isOpen, activeRole]);

  const handleMarkAsRead = async (id: number) => {
    try {
      await api.markNotificationRead(id);
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, is_read: 1 } : n))
      );
      const remainingUnread = notifications.filter(n => n.id !== id && !n.is_read).length;
      if (onUpdateCount) onUpdateCount(remainingUnread);
    } catch (err) {
      console.error('Erro ao marcar como lida:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
      if (onUpdateCount) onUpdateCount(0);
    } catch (err) {
      console.error('Erro ao marcar todas:', err);
    }
  };

  const handleNavigateToLink = (n: Notification) => {
    if (!n.link) return;
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
    onClose();
  };

  if (!isOpen) return null;

  const filtered = filterRole === 'all'
    ? notifications
    : notifications.filter(n => n.role_target?.toLowerCase().includes(filterRole.toLowerCase()));

  const getIcon = (type: string) => {
    switch (type) {
      case 'urgent':
        return <Flame className="w-4 h-4 text-rose-400" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-400" />;
      case 'success':
        return <CheckCircle className="w-4 h-4 text-sabrar-400" />;
      default:
        return <Info className="w-4 h-4 text-sabrar-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-md bg-dark-950 border-l border-dark-750 h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200 text-slate-100">
        {/* Header */}
        <div className="p-4 border-b border-dark-750 flex items-center justify-between bg-dark-900">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-sabrar-950/80 border border-sabrar-500/40 flex items-center justify-center text-sabrar-400">
              <Bell className="w-4 h-4" />
            </div>
            <h2 className="font-bold text-white text-base">Notificações Operacionais</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleMarkAllRead}
              title="Marcar todas como lidas"
              className="text-xs text-sabrar-400 hover:text-sabrar-300 font-semibold px-2.5 py-1 rounded-lg bg-dark-850 border border-dark-700 hover:bg-dark-800 transition-colors"
            >
              Ler todas
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-xl text-slate-400 hover:text-white hover:bg-dark-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Pills (Exibido para Admin para filtrar setores) */}
        {activeRole === 'admin' && (
          <div className="px-4 py-2.5 border-b border-dark-750 flex items-center gap-1.5 overflow-x-auto text-xs bg-dark-900/60">
            <button
              onClick={() => setFilterRole('all')}
              className={`px-3 py-1 rounded-full whitespace-nowrap font-medium transition-colors ${
                filterRole === 'all' ? 'bg-sabrar-600 text-white font-bold' : 'bg-dark-850 text-slate-400 hover:text-white border border-dark-700'
              }`}
            >
              Todas
            </button>
            <button
              onClick={() => setFilterRole('orçamento')}
              className={`px-3 py-1 rounded-full whitespace-nowrap font-medium transition-colors ${
                filterRole === 'orçamento' ? 'bg-sabrar-600 text-white font-bold' : 'bg-dark-850 text-slate-400 hover:text-white border border-dark-700'
              }`}
            >
              Orçamento
            </button>
            <button
              onClick={() => setFilterRole('almoxarifado')}
              className={`px-3 py-1 rounded-full whitespace-nowrap font-medium transition-colors ${
                filterRole === 'almoxarifado' ? 'bg-sabrar-600 text-white font-bold' : 'bg-dark-850 text-slate-400 hover:text-white border border-dark-700'
              }`}
            >
              Almoxarifado
            </button>
            <button
              onClick={() => setFilterRole('compras')}
              className={`px-3 py-1 rounded-full whitespace-nowrap font-medium transition-colors ${
                filterRole === 'compras' ? 'bg-sabrar-600 text-white font-bold' : 'bg-dark-850 text-slate-400 hover:text-white border border-dark-700'
              }`}
            >
              Compras
            </button>
            <button
              onClick={() => setFilterRole('engenharia')}
              className={`px-3 py-1 rounded-full whitespace-nowrap font-medium transition-colors ${
                filterRole === 'engenharia' ? 'bg-sabrar-600 text-white font-bold' : 'bg-dark-850 text-slate-400 hover:text-white border border-dark-700'
              }`}
            >
              Engenharia
            </button>
          </div>
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {loading && (
            <div className="py-12 text-center text-sm text-slate-500">
              Carregando notificações...
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div className="py-16 text-center text-slate-500 text-sm">
              <CheckCircle className="w-10 h-10 text-sabrar-400 mx-auto mb-2 opacity-60" />
              Nenhuma notificação encontrada no momento.
            </div>
          )}

          {filtered.map((n) => (
            <div
              key={n.id}
              onClick={() => {
                if (n.link) handleNavigateToLink(n);
              }}
              className={`p-3.5 rounded-2xl border transition-all ${
                n.link ? 'cursor-pointer hover:border-sabrar-500/80 active:scale-[0.99]' : ''
              } ${
                n.is_read
                  ? 'bg-dark-900/60 border-dark-750/70 text-slate-400'
                  : 'bg-dark-900 border-sabrar-500/40 shadow-md'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="mt-0.5 shrink-0 p-1.5 rounded-xl bg-dark-850 border border-dark-700">
                    {getIcon(n.type)}
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-sm text-white flex items-center gap-1.5 flex-wrap">
                      <span>{n.title}</span>
                      {!n.is_read && (
                        <span className="w-2 h-2 rounded-full bg-sabrar-500 animate-pulse"></span>
                      )}
                    </div>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed break-words">{n.message}</p>
                    <div className="flex items-center gap-2 mt-2 text-[11px] text-slate-500 flex-wrap">
                      {n.role_target && (
                        <span className="font-semibold text-sabrar-400 bg-sabrar-950 px-2 py-0.5 rounded-md border border-sabrar-500/30 uppercase text-[10px]">
                          {n.role_target}
                        </span>
                      )}
                      <span>{new Date(n.created_at).toLocaleDateString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5 items-end shrink-0 ml-2">
                  {!n.is_read && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMarkAsRead(n.id);
                      }}
                      title="Marcar como lida"
                      className="p-1.5 rounded-xl text-slate-400 hover:text-sabrar-400 hover:bg-dark-800 transition-colors"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  )}
                  {n.link && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleNavigateToLink(n);
                      }}
                      className="p-1.5 rounded-xl text-sabrar-400 hover:text-white bg-dark-850 hover:bg-sabrar-600 border border-dark-700 hover:border-sabrar-500 transition-all flex items-center gap-1 shadow-sm active:scale-95"
                      title="Acessar página de destino desta notificação"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
