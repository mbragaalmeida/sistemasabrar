import React, { useState, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Building,
  User,
  ArrowRight,
  CalendarCheck
} from 'lucide-react';
import { Project } from '../../types';
import { StatusBadge } from '../common/StatusBadge';

interface ExecutionCalendarProps {
  projects: Project[];
  onNavigate: (page: string, id?: number) => void;
}

export const ExecutionCalendar: React.FC<ExecutionCalendarProps> = ({
  projects,
  onNavigate
}) => {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [selectedDateStr, setSelectedDateStr] = useState<string>(todayStr);

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
  };

  const handleToday = () => {
    const now = new Date();
    setCurrentDate(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDateStr(todayStr);
  };

  // Alertas de Vencimento Hoje (Item 4)
  const expiringToday = useMemo(() => {
    return projects.filter(p => {
      if (p.code === 'SAB-INTERNO') return false;
      if (['Finalizado', 'Concluído', 'Concluída', 'Cancelado', 'Perdido'].includes(p.status)) return false;
      const endMatch = p.expected_end_date && p.expected_end_date.startsWith(todayStr);
      const retMatch = p.return_deadline && p.return_deadline.startsWith(todayStr);
      return endMatch || retMatch;
    });
  }, [projects, todayStr]);

  // Estrutura do Mês Inteiro (Domingo a Sábado)
  const monthDays = useMemo(() => {
    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

    const days = [];

    // Dias do mês anterior para preencher início da semana
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth - 1, daysInPrevMonth - i);
      const dateStr = d.toISOString().split('T')[0];
      days.push({
        date: d,
        dateStr,
        dayNum: daysInPrevMonth - i,
        isCurrentMonth: false
      });
    }

    // Dias do mês atual
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(currentYear, currentMonth, i);
      const dateStr = d.toISOString().split('T')[0];
      days.push({
        date: d,
        dateStr,
        dayNum: i,
        isCurrentMonth: true
      });
    }

    // Dias do próximo mês para completar grade de 35 ou 42 células
    const totalCells = days.length <= 35 ? 35 : 42;
    const remaining = totalCells - days.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(currentYear, currentMonth + 1, i);
      const dateStr = d.toISOString().split('T')[0];
      days.push({
        date: d,
        dateStr,
        dayNum: i,
        isCurrentMonth: false
      });
    }

    return days;
  }, [currentYear, currentMonth]);

  // Mapa de projetos por data de vencimento / entrega
  const projectsByDateMap = useMemo(() => {
    const map = new Map<string, Project[]>();
    for (const p of projects) {
      if (p.code === 'SAB-INTERNO') continue;
      const dateKey = p.expected_end_date ? p.expected_end_date.split('T')[0] : (p.return_deadline ? p.return_deadline.split('T')[0] : null);
      if (dateKey) {
        if (!map.has(dateKey)) map.set(dateKey, []);
        map.get(dateKey)!.push(p);
      }
    }
    return map;
  }, [projects]);

  // Lista dos projetos que precisam ser entregues até a data selecionada (incluindo os que vencem no dia)
  const projectsDueUntilSelected = useMemo(() => {
    if (!selectedDateStr) return [];
    return projects.filter(p => {
      if (p.code === 'SAB-INTERNO') return false;
      const deadline = p.expected_end_date ? p.expected_end_date.split('T')[0] : (p.return_deadline ? p.return_deadline.split('T')[0] : null);
      if (!deadline) return false;
      return deadline <= selectedDateStr;
    }).sort((a, b) => {
      const da = (a.expected_end_date || a.return_deadline || '').split('T')[0];
      const db = (b.expected_end_date || b.return_deadline || '').split('T')[0];
      return db.localeCompare(da); // Mais recentes primeiro
    });
  }, [projects, selectedDateStr]);

  const formatDisplayDate = (dStr: string) => {
    if (!dStr) return '';
    const parts = dStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dStr;
  };

  return (
    <div className="space-y-4 animate-in fade-in">
      {/* Alertas de Vencimento Hoje */}
      {expiringToday.length > 0 && (
        <div className="p-4 bg-amber-950/60 border border-amber-500/50 rounded-3xl shadow-lg space-y-2">
          <div className="flex items-center gap-2 text-amber-400 font-extrabold text-sm">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 animate-bounce" />
            <span>ALERTA DE VENCIMENTO HOJE ({expiringToday.length} obra(s)/orçamento(s) com prazo final hoje):</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
            {expiringToday.map(p => (
              <div
                key={p.id}
                onClick={() => onNavigate('project-detail', p.id)}
                className="p-3 bg-dark-900/90 rounded-2xl border border-amber-500/40 hover:border-amber-400 cursor-pointer transition-all flex items-center justify-between gap-2"
              >
                <div className="truncate">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-white truncate">
                    <span className="font-mono text-amber-300 bg-amber-950/80 px-1.5 py-0.2 rounded border border-amber-500/30">
                      {p.code}
                    </span>
                    <span className="truncate">{p.name}</span>
                  </div>
                  <div className="text-[11px] text-slate-400 truncate mt-0.5">
                    Cliente: {p.client} • Resp: {p.responsible_estimator || p.responsible_engineer || 'Não informado'}
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-amber-400 shrink-0" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Header do Calendário de Execução */}
      <div className="bg-dark-900 p-4 sm:p-5 rounded-3xl border border-dark-750 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-950/70 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white">
                Calendário de Execução & Prazos
              </h2>
              <p className="text-xs text-slate-400">
                Visualização do mês inteiro com controle de entregas de obras e propostas orçamentárias
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-2 rounded-xl bg-dark-850 hover:bg-dark-800 text-slate-300 hover:text-white border border-dark-700 transition-colors"
              title="Mês Anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="font-black text-white text-sm px-3 min-w-[150px] text-center">
              {monthNames[currentMonth]} {currentYear}
            </span>

            <button
              type="button"
              onClick={handleNextMonth}
              className="p-2 rounded-xl bg-dark-850 hover:bg-dark-800 text-slate-300 hover:text-white border border-dark-700 transition-colors"
              title="Próximo Mês"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleToday}
              className="ml-2 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md active:scale-95"
            >
              Hoje
            </button>
          </div>
        </div>

        {/* Grade do Mês Inteiro */}
        <div className="overflow-x-auto">
          <div className="min-w-[650px]">
            {/* Dias da Semana */}
            <div className="grid grid-cols-7 gap-1.5 mb-2 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">
              <div>Dom</div>
              <div>Seg</div>
              <div>Ter</div>
              <div>Qua</div>
              <div>Qui</div>
              <div>Sex</div>
              <div>Sáb</div>
            </div>

            {/* Células dos Dias */}
            <div className="grid grid-cols-7 gap-1.5">
              {monthDays.map((day, idx) => {
                const dayProjects = projectsByDateMap.get(day.dateStr) || [];
                const isSelected = day.dateStr === selectedDateStr;
                const isToday = day.dateStr === todayStr;

                return (
                  <div
                    key={idx}
                    onClick={() => setSelectedDateStr(day.dateStr)}
                    className={`min-h-[78px] sm:min-h-[90px] p-2 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'border-blue-500 bg-blue-950/40 shadow-lg shadow-blue-950/30 ring-2 ring-blue-500/50'
                        : isToday
                        ? 'border-amber-500/60 bg-dark-850 shadow-md'
                        : day.isCurrentMonth
                        ? 'border-dark-750 bg-dark-850 hover:border-dark-700'
                        : 'border-dark-800/50 bg-dark-900/40 opacity-40 hover:opacity-70'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-black ${
                          isToday
                            ? 'w-6 h-6 rounded-full bg-amber-500 text-dark-950 flex items-center justify-center shadow-xs'
                            : isSelected
                            ? 'text-blue-400'
                            : day.isCurrentMonth
                            ? 'text-white'
                            : 'text-slate-500'
                        }`}
                      >
                        {day.dayNum}
                      </span>

                      {dayProjects.length > 0 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-blue-950 text-blue-300 border border-blue-500/40 font-mono">
                          {dayProjects.length}
                        </span>
                      )}
                    </div>

                    <div className="space-y-1 mt-1">
                      {dayProjects.slice(0, 2).map(p => (
                        <div
                          key={p.id}
                          className="text-[10px] font-bold truncate px-1.5 py-0.5 rounded bg-dark-800 text-slate-200 border border-dark-700"
                          title={`${p.code} - ${p.name}`}
                        >
                          {p.name}
                        </div>
                      ))}
                      {dayProjects.length > 2 && (
                        <div className="text-[9px] text-blue-400 font-bold text-center">
                          +{dayProjects.length - 2} mais
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Painel de Consulta de Prazos: Projetos a Entregar até a Data Selecionada */}
      <div className="bg-dark-900 p-4 sm:p-5 rounded-3xl border border-dark-750 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-dark-750 pb-3">
          <div>
            <h3 className="text-sm sm:text-base font-extrabold text-white flex items-center gap-2">
              <CalendarCheck className="w-4 h-4 text-blue-400" />
              <span>Projetos a Entregar até {formatDisplayDate(selectedDateStr)}</span>
            </h3>
            <p className="text-xs text-slate-400">
              Obras e orçamentos com prazo de entrega ou retorno até a data selecionada no calendário ({projectsDueUntilSelected.length} encontrados)
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400">Data consultada:</span>
            <input
              type="date"
              value={selectedDateStr}
              onChange={(e) => setSelectedDateStr(e.target.value)}
              className="bg-dark-850 text-white font-bold px-3 py-1 rounded-xl border border-dark-700 text-xs focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {projectsDueUntilSelected.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs space-y-1">
            <Clock className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <div className="font-bold text-slate-400">Nenhum projeto com prazo cadastrado até esta data</div>
            <p className="text-[11px] text-slate-500">Selecione outra data ou navegue entre os meses acima.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {projectsDueUntilSelected.map(p => {
              const deadline = (p.expected_end_date || p.return_deadline || '').split('T')[0];
              const isTodayDeadline = deadline === todayStr;
              const isOverdue = deadline < todayStr && !['Finalizado', 'Concluído', 'Concluída'].includes(p.status);

              return (
                <div
                  key={p.id}
                  onClick={() => onNavigate('project-detail', p.id)}
                  className={`p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 group ${
                    isTodayDeadline
                      ? 'bg-amber-950/20 border-amber-500/50 hover:border-amber-400'
                      : isOverdue
                      ? 'bg-rose-950/20 border-rose-500/40 hover:border-rose-400'
                      : 'bg-dark-850 border-dark-700 hover:border-dark-600'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-xs bg-dark-800 text-slate-200 px-2 py-0.5 rounded border border-dark-700">
                        {p.code}
                      </span>
                      <StatusBadge status={p.status} size="sm" />
                      {isTodayDeadline && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500 text-dark-950 animate-pulse">
                          VENCE HOJE
                        </span>
                      )}
                      {isOverdue && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-500/40">
                          PRAZO VENCIDO
                        </span>
                      )}
                    </div>

                    <h4 className="font-extrabold text-sm text-white group-hover:text-blue-400 transition-colors">
                      {p.name}
                    </h4>

                    <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                      <span>Cliente: <strong className="text-slate-200">{p.client}</strong></span>
                      {p.responsible_estimator && (
                        <span>• Orçamentista: <strong className="text-slate-300">{p.responsible_estimator}</strong></span>
                      )}
                      {p.responsible_engineer && (
                        <span>• Eng: <strong className="text-slate-300">{p.responsible_engineer}</strong></span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 self-end sm:self-center">
                    <div className="text-right">
                      <div className="text-[10px] uppercase font-bold text-slate-400">Data Limite</div>
                      <div className={`font-mono font-bold text-sm ${isTodayDeadline ? 'text-amber-400' : isOverdue ? 'text-rose-400' : 'text-slate-200'}`}>
                        {formatDisplayDate(deadline)}
                      </div>
                    </div>

                    <button
                      type="button"
                      className="px-3 py-1.5 rounded-xl bg-dark-800 group-hover:bg-blue-600 text-slate-300 group-hover:text-white text-xs font-bold transition-all flex items-center gap-1 shadow-xs"
                    >
                      <span>Abrir</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
