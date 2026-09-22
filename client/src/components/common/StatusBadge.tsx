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
        return 'bg-blue-950/80 text-blue-300 border-blue-700/60';
      case 'Em análise pela IA':
        return 'bg-purple-950/80 text-purple-300 border-purple-500/60 animate-pulse';
      case 'Orçamento gerado':
        return 'bg-indigo-950/80 text-indigo-300 border-indigo-700/60';
      case 'Em revisão':
        return 'bg-amber-950/80 text-amber-300 border-amber-600/60';
      case 'Orçamento finalizado':
        return 'bg-cyan-950/80 text-cyan-300 border-cyan-600/60';
      case 'Enviado ao cliente':
        return 'bg-teal-950/80 text-teal-300 border-teal-600/60';
      case 'Aguardando aprovação':
        return 'bg-yellow-950/80 text-yellow-300 border-yellow-600/60';
      case 'Aprovado':
        return 'bg-sabrar-950/80 text-sabrar-300 border-sabrar-500/60 font-semibold';
      case 'Em execução':
        return 'bg-emerald-950/80 text-emerald-300 border-emerald-500/60 font-semibold';
      case 'Finalizado':
        return 'bg-dark-800 text-slate-300 border-dark-700';
      case 'Não aprovado':
      case 'Cancelado':
        return 'bg-rose-950/80 text-rose-300 border-rose-700/60';

      // Solicitações de Material
      case 'Solicitado':
        return 'bg-blue-950/80 text-blue-300 border-blue-700/60';
      case 'Reservado':
        return 'bg-amber-950/80 text-amber-300 border-amber-600/60 font-medium';
      case 'Em separação':
        return 'bg-purple-950/80 text-purple-300 border-purple-600/60';
      case 'Separado':
        return 'bg-teal-950/80 text-teal-300 border-teal-600/60';
      case 'Entregue':
        return 'bg-sabrar-950/80 text-sabrar-300 border-sabrar-500/60';

      // Compras
      case 'Em cotação':
        return 'bg-amber-950/80 text-amber-300 border-amber-600/60';
      case 'Comprado':
        return 'bg-blue-950/80 text-blue-300 border-blue-600/60';
      case 'Aguardando entrega':
        return 'bg-orange-950/80 text-orange-300 border-orange-600/60';
      case 'Recebido':
        return 'bg-sabrar-950/80 text-sabrar-300 border-sabrar-500/60 font-medium';

      // Prioridades
      case 'Urgente':
        return 'bg-rose-950/90 text-rose-300 border-rose-600 font-bold';
      case 'Alta':
        return 'bg-orange-950/80 text-orange-300 border-orange-600/60 font-semibold';
      case 'Média':
        return 'bg-amber-950/80 text-amber-300 border-amber-600/60';
      case 'Baixa':
        return 'bg-slate-900 text-slate-400 border-slate-700';

      default:
        return 'bg-dark-800 text-slate-300 border-dark-700';
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
