import React, { useState, useEffect } from 'react';
import { Calculator, ArrowRight, CheckCircle, Clock, Send, Sparkles } from 'lucide-react';
import { Project } from '../types';
import { api } from '../services/api';
import { StatusBadge } from '../components/common/StatusBadge';

interface BudgetsPageProps {
  onNavigate: (page: string, id?: number) => void;
}

export const BudgetsPage: React.FC<BudgetsPageProps> = ({ onNavigate }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getProjects().then(data => {
      // Exibe exclusivamente orçamentos de obras aprovadas ou em execução
      const approvedOnly = data.filter((p: Project) => 
        p.code !== 'SAB-INTERNO' &&
        (p.status === 'Em execução' || p.status === 'Aprovado' || p.budget?.status === 'Aprovado')
      );
      setProjects(approvedOnly);
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
    });
  }, []);

  return (
    <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-dark-900 p-4 sm:p-5 rounded-3xl border border-dark-750 shadow-xl">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-sabrar-950/70 border border-sabrar-500/40 flex items-center justify-center text-sabrar-400">
              <Calculator className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Orçamentos Aprovados
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Concentração dos orçamentos aprovados de obras em execução e finalizadas na SABRAR
          </p>
        </div>
      </div>

      {loading && (
        <div className="py-20 text-center text-sm text-slate-500">
          Carregando orçamentos aprovados...
        </div>
      )}

      {!loading && projects.length === 0 && (
        <div className="py-20 text-center bg-dark-900 rounded-3xl border border-dark-750 text-slate-400 p-6 space-y-2">
          <Calculator className="w-10 h-10 text-slate-600 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-white">Nenhum orçamento aprovado no momento</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Assim que uma proposta for aprovada e a obra iniciada em "Projetos & Obras", o orçamento correspondente será exibido nesta central.
          </p>
        </div>
      )}

      {!loading && projects.length > 0 && (
        <div className="space-y-3.5">
          {projects.map((p) => {
            const hasBudget = p.total_budget_final && p.total_budget_final > 0;
            return (
              <div
                key={p.id}
                onClick={() => onNavigate('project-detail', p.id)}
                className="bg-dark-900 p-4 sm:p-5 rounded-3xl border border-dark-750 shadow-md hover:border-sabrar-500/60 hover:shadow-xl hover:shadow-sabrar-950/20 transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="font-mono font-bold text-xs bg-dark-800 text-sabrar-400 border border-dark-700 px-2 py-0.5 rounded">
                      {p.code}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/40">
                      <CheckCircle className="w-3 h-3 text-emerald-400" />
                      Orçamento Aprovado
                    </span>
                    <StatusBadge status={p.status} size="sm" />
                  </div>
                  <h3 className="font-extrabold text-white text-base group-hover:text-sabrar-400 transition-colors">
                    {p.name}
                  </h3>
                  <div className="text-xs text-slate-400 mt-1">
                    Cliente: <span className="font-semibold text-slate-200">{p.client}</span> • Tipologia: {p.project_type} {p.responsible_engineer ? `• Eng: ${p.responsible_engineer}` : ''}
                  </div>
                </div>

                <div className="flex items-center gap-6 self-end sm:self-center">
                  <div className="text-right">
                    <div className="text-[10px] uppercase font-bold text-slate-400">Valor Total Aprovado</div>
                    <div className="font-black text-base sm:text-lg text-emerald-400">
                      {hasBudget
                        ? `R$ ${p.total_budget_final.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                        : (p.budget?.total_final ? `R$ ${p.budget.total_final.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'R$ 0,00')}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 text-xs font-bold text-sabrar-400 group-hover:translate-x-1 transition-transform">
                    <span>Ver Detalhes</span>
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
