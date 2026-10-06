import React, { useState, useEffect } from 'react';
import { Bell, CheckCircle, Flame, AlertTriangle, Info, Check } from 'lucide-react';
import { api } from '../services/api';
import { Notification } from '../types';
import { useAuth } from '../context/AuthContext';

export const NotificationsPage: React.FC = () => {
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
                  className={`p-4 rounded-3xl border transition-all flex items-start justify-between gap-3 ${
                    isUnread
                      ? 'bg-dark-900 border-sabrar-500/40 shadow-md'
                      : 'bg-dark-900/60 border-dark-750 text-slate-400'
                  }`}
                >
                  <div className="flex items-start gap-3">
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

                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className={`font-bold text-sm ${isUnread ? 'text-white' : 'text-slate-300'}`}>
                          {n.title}
                        </h3>
                        {isUnread && (
                          <span className="w-2 h-2 rounded-full bg-sabrar-500 animate-pulse"></span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{n.message}</p>
                      <span className="text-[10px] text-slate-500 mt-1 block">
                        {new Date(n.created_at).toLocaleDateString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>

                  {isUnread && (
                    <button
                      onClick={() => handleMarkAsRead(n.id)}
                      className="p-1.5 rounded-xl text-slate-400 hover:text-sabrar-400 hover:bg-dark-800 transition-colors shrink-0"
                      title="Marcar como lida"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
