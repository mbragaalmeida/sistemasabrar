import React from 'react';

interface StatusBadgeProps {
  status: string;
  className?: string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = '', size = 'md' }) => {
  const getBadgeStyle = (s: string) => {
    switch (s) {
      // Projetos & Orçamento
      case 'Novo':
        return 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/80 dark:text-blue-300 dark:border-blue-700/60';
      case 'Em análise pela IA':
        return 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/80 dark:text-purple-300 dark:border-purple-500/60 animate-pulse font-semibold';
      case 'Orçamento gerado':
        return 'bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-950/80 dark:text-indigo-300 dark:border-indigo-700/60';
      case 'Em revisão':
        return 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/80 dark:text-amber-300 dark:border-amber-600/60 font-medium';
      case 'Orçamento finalizado':
        return 'bg-cyan-100 text-cyan-800 border-cyan-300 dark:bg-cyan-950/80 dark:text-cyan-300 dark:border-cyan-600/60';
      case 'Enviado ao cliente':
        return 'bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-950/80 dark:text-teal-300 dark:border-teal-600/60 font-medium';
      case 'Aguardando aprovação':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-950/80 dark:text-yellow-300 dark:border-yellow-600/60 font-medium';
      case 'Aprovado':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-sabrar-950/80 dark:text-sabrar-300 dark:border-sabrar-500/60 font-bold';
      case 'Em execução':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-500/60 font-bold';
      case 'Finalizado':
        return 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-dark-800 dark:text-slate-300 dark:border-dark-700 font-medium';
      case 'Não aprovado':
      case 'Cancelado':
        return 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/80 dark:text-rose-300 dark:border-rose-700/60 font-semibold';

      // Solicitações de Material
      case 'Solicitado':
      case 'Reservado':
        return 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/80 dark:text-blue-300 dark:border-blue-700/60 font-semibold';
      case 'Em separação':
      case 'Em Separação':
        return 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/80 dark:text-purple-300 dark:border-purple-600/60 font-bold';
      case 'Separado Parcial':
      case 'Parcialmente Atendido':
        return 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/80 dark:text-amber-300 dark:border-amber-600/60 font-bold';
      case 'Separado':
      case 'Entregue':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-sabrar-950/80 dark:text-sabrar-300 dark:border-sabrar-500/60 font-bold';

      // Compras
      case 'Em cotação':
        return 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/80 dark:text-amber-300 dark:border-amber-600/60 font-semibold';
      case 'Comprado':
        return 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/80 dark:text-blue-300 dark:border-blue-600/60 font-medium';
      case 'Aguardando entrega':
        return 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950/80 dark:text-orange-300 dark:border-orange-600/60 font-semibold';
      case 'Recebido':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-sabrar-950/80 dark:text-sabrar-300 dark:border-sabrar-500/60 font-bold';

      // Prioridades
      case 'Urgente':
        return 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/90 dark:text-rose-300 dark:border-rose-600 font-black';
      case 'Alta':
        return 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950/80 dark:text-orange-300 dark:border-orange-600/60 font-bold';
      case 'Média':
        return 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/80 dark:text-amber-300 dark:border-amber-600/60 font-semibold';
      case 'Baixa':
        return 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-700 font-medium';

      default:
        return 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-dark-800 dark:text-slate-300 dark:border-dark-700';
    }
  };

  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border shadow-xs tracking-tight ${sizeClasses} ${getBadgeStyle(
        status
      )} ${className}`}
    >
      {status}
    </span>
  );
};
