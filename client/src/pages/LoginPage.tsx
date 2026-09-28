import React, { useState } from 'react';
import { ShieldCheck, Lock, Mail, Eye, EyeOff, ArrowRight, Sun, Moon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Por favor, informe e-mail e senha.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await login(email.trim(), password);
    } catch (err: any) {
      setError(err.message || 'Falha ao autenticar. Verifique seus dados.');
    } finally {
      setLoading(false);
    }
  };

  const fillDemoUser = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('sabrar123');
    setError(null);
  };

  return (
    <div className="min-h-screen w-full bg-slate-100 dark:bg-dark-950 flex items-center justify-center p-4 relative overflow-hidden transition-colors">
      {/* Floating Theme Toggle */}
      <button
        type="button"
        onClick={toggleTheme}
        className="absolute top-4 right-4 p-2.5 rounded-2xl bg-white/90 dark:bg-dark-900/80 border border-slate-200 dark:border-dark-750 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all shadow-md backdrop-blur-md z-20"
        title={theme === 'dark' ? 'Mudar para Tema Claro' : 'Mudar para Tema Escuro'}
      >
        {theme === 'dark' ? (
          <Sun className="w-5 h-5 text-amber-400 hover:rotate-45 transition-transform" />
        ) : (
          <Moon className="w-5 h-5 text-indigo-500 hover:-rotate-12 transition-transform" />
        )}
      </button>

      {/* Background ambient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-sabrar-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[400px] h-[400px] bg-sky-500/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10 space-y-6">
        {/* Brand Header com Logomarca Oficial SABRAR */}
        <div className="text-center space-y-3 flex flex-col items-center">
          <img
            src={theme === 'light' ? '/sabrar-logo-black.png' : '/sabrar-logo.png'}
            alt="SABRAR Engenharia"
            className="h-14 sm:h-16 w-auto object-contain drop-shadow-md transition-transform hover:scale-105"
          />
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Acesso ao Sistema
            </h1>
            <p className="text-xs text-slate-600 dark:text-slate-400 max-w-xs mx-auto mt-1">
              Plataforma de Orçamento Inteligente, Levantamento de Materiais e Gestão Operacional de Obras
            </p>
          </div>
        </div>

        {/* Login Card */}
        <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-750 rounded-3xl p-6 sm:p-8 shadow-xl dark:shadow-2xl space-y-6 backdrop-blur-xl">
          {error && (
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-600/50 rounded-2xl text-xs text-rose-700 dark:text-rose-200 flex items-start gap-2.5 animate-in fade-in">
              <span className="font-bold shrink-0">Atenção:</span>
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                E-mail Corporativo
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="seu.email@sabrar.com.br"
                  required
                  autoFocus
                  className="w-full bg-slate-50 dark:bg-dark-850 border border-slate-300 dark:border-dark-700 rounded-2xl pl-10 pr-4 py-3 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-sabrar-500 focus:ring-1 focus:ring-sabrar-500 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Senha de Acesso
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-slate-50 dark:bg-dark-850 border border-slate-300 dark:border-dark-700 rounded-2xl pl-10 pr-10 py-3 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-sabrar-500 focus:ring-1 focus:ring-sabrar-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-sabrar-600 hover:bg-sabrar-500 text-white rounded-2xl text-xs font-bold transition-all shadow-lg shadow-sabrar-600/30 flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50 disabled:pointer-events-none mt-2"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Entrar no Sistema</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Perfis de Demonstração */}
          <div className="pt-4 border-t border-slate-200 dark:border-dark-750">
            <div className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-500 tracking-wider mb-2 text-center">
              Acesso Rápido para Demonstração
            </div>
              <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => fillDemoUser('orcamento@sabrar.com.br')}
                  className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-dark-850 dark:hover:bg-dark-800 border border-slate-200 dark:border-dark-700 rounded-xl text-left truncate text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white transition-colors shadow-xs"
                >
                  <span className="font-bold text-sabrar-600 dark:text-sabrar-400">Orçamento</span> (Mariana)
                </button>
                <button
                  type="button"
                  onClick={() => fillDemoUser('engenharia@sabrar.com.br')}
                  className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-dark-850 dark:hover:bg-dark-800 border border-slate-200 dark:border-dark-700 rounded-xl text-left truncate text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white transition-colors shadow-xs"
                >
                  <span className="font-bold text-amber-600 dark:text-amber-400">Engenharia</span> (Rafael)
                </button>
                <button
                  type="button"
                  onClick={() => fillDemoUser('almoxarifado@sabrar.com.br')}
                  className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-dark-850 dark:hover:bg-dark-800 border border-slate-200 dark:border-dark-700 rounded-xl text-left truncate text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white transition-colors shadow-xs"
                >
                  <span className="font-bold text-teal-600 dark:text-teal-400">Almoxarifado</span> (Tiago)
                </button>
                <button
                  type="button"
                  onClick={() => fillDemoUser('compras@sabrar.com.br')}
                  className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-dark-850 dark:hover:bg-dark-800 border border-slate-200 dark:border-dark-700 rounded-xl text-left truncate text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white transition-colors shadow-xs"
                >
                  <span className="font-bold text-indigo-600 dark:text-indigo-400">Compras</span> (Fernanda)
                </button>
              </div>
            </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-center gap-2 text-slate-500 dark:text-slate-500 text-[11px]">
          <ShieldCheck className="w-3.5 h-3.5 text-sabrar-500 dark:text-sabrar-400" />
          <span>SABRAR Engenharia • Ambiente Seguro & Conexão Criptografada</span>
        </div>
      </div>
    </div>
  );
};
