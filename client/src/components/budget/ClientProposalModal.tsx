import React from 'react';
import { Printer, Send, X, CheckCircle, FileText, Calendar, Building, User, Phone, Mail } from 'lucide-react';
import { Project, Budget } from '../../types';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

interface ClientProposalModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  budget: Budget;
  onSentToClient?: () => void;
}

export const ClientProposalModal: React.FC<ClientProposalModalProps> = ({
  isOpen,
  onClose,
  project,
  budget,
  onSentToClient
}) => {
  const { currentUser } = useAuth();

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleSendToClient = async () => {
    try {
      await api.sendBudgetToClient(budget.id, currentUser?.id);
      if (onSentToClient) onSentToClient();
      onClose();
    } catch (err) {
      console.error('Erro ao marcar como enviado:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6 bg-black/85 backdrop-blur-sm animate-in fade-in overflow-y-auto">
      <div className="w-full max-w-4xl bg-dark-900 rounded-3xl shadow-2xl border border-dark-750 overflow-hidden flex flex-col my-auto max-h-[95vh]">
        {/* Modal Toolbar (No-Print) */}
        <div className="no-print p-4 bg-dark-900 text-white flex items-center justify-between gap-2 border-b border-dark-750">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-sabrar-950/80 border border-sabrar-500/40 flex items-center justify-center text-sabrar-400">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-sm sm:text-base text-white">Proposta Comercial Profissional</h2>
              <p className="text-[11px] text-slate-400">Documento pronto para envio e impressão</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-dark-850 hover:bg-dark-800 text-slate-200 text-xs font-semibold border border-dark-700 transition-colors"
            >
              <Printer className="w-4 h-4 text-sabrar-400" />
              <span>Imprimir / Salvar PDF</span>
            </button>

            <button
              onClick={handleSendToClient}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-sabrar-600 hover:bg-sabrar-500 text-white text-xs font-bold transition-all shadow-md shadow-sabrar-600/30"
            >
              <Send className="w-4 h-4" />
              <span>Registrar Envio</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-dark-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Proposal Document Body */}
        <div className="p-6 sm:p-10 overflow-y-auto flex-1 bg-white text-slate-900 print:p-0">
          {/* Header SABRAR */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b-2 border-slate-900 gap-4">
            <div className="flex items-center gap-3">
              <img
                src="/sabrar-logo.png"
                alt="SABRAR Engenharia"
                className="h-14 w-auto object-contain max-w-[240px]"
                onError={(e) => {
                  // Fallback to icon
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <div>
                <h1 className="text-2xl font-black tracking-tight text-slate-950 leading-tight">SABRAR</h1>
                <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider">
                  ENGENHARIA • AR CONDICIONADO E EXAUSTÃO
                </p>
                <p className="text-[11px] text-slate-500">contato@sabrar.com.br • www.sabrar.com.br</p>
              </div>
            </div>

            <div className="sm:text-right">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Proposta de Orçamento</div>
              <div className="text-lg font-extrabold text-slate-900">{budget.code}</div>
              <div className="text-xs text-slate-500 mt-0.5">
                Data de Emissão: {new Date().toLocaleDateString('pt-BR')}
              </div>
            </div>
          </div>

          {/* Dados do Cliente e Projeto */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-6 p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
                <Building className="w-3.5 h-3.5 text-emerald-600" />
                Dados do Cliente
              </div>
              <div className="font-bold text-sm text-slate-900">{project.client}</div>
              {project.client_email && (
                <div className="text-xs text-slate-600 flex items-center gap-1 mt-0.5">
                  <Mail className="w-3 h-3 text-slate-400" /> {project.client_email}
                </div>
              )}
              {project.client_phone && (
                <div className="text-xs text-slate-600 flex items-center gap-1 mt-0.5">
                  <Phone className="w-3 h-3 text-slate-400" /> {project.client_phone}
                </div>
              )}
              <div className="text-xs text-slate-600 mt-0.5">{project.address}</div>
            </div>

            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                Especificações do Projeto
              </div>
              <div className="font-bold text-sm text-slate-900">{project.name} ({project.code})</div>
              <div className="text-xs text-slate-600 mt-0.5">Tipo: {project.project_type}</div>
              <div className="text-xs text-slate-600 mt-0.5">
                Responsável Técnico: <span className="font-medium text-slate-800">{project.responsible_engineer}</span>
              </div>
              <div className="text-xs text-slate-600 mt-0.5">
                Validade da Proposta: <span className="font-bold text-amber-700">{budget.validity_days || 15} dias corridos</span>
              </div>
            </div>
          </div>

          {/* Descrição do Escopo */}
          {project.notes && (
            <div className="mb-6">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Escopo Técnico dos Serviços</h3>
              <p className="text-xs text-slate-700 leading-relaxed bg-white p-3 rounded-xl border border-slate-100">
                {project.notes}
              </p>
            </div>
          )}

          {/* 1. Materiais */}
          <div className="mb-6">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-2 flex items-center justify-between">
              <span>1. Fornecimento de Materiais</span>
              <span className="text-slate-500 font-normal">Subtotal: R$ {budget.total_materials.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </h3>
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-2.5">Item / Material</th>
                    <th className="p-2.5 text-center">Quant.</th>
                    <th className="p-2.5 text-center">Unid.</th>
                    <th className="p-2.5 text-right">Valor Unit.</th>
                    <th className="p-2.5 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(budget.items || []).map((it, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="p-2.5 font-medium text-slate-900">{it.material_name}</td>
                      <td className="p-2.5 text-center font-bold text-slate-800">{it.quantity}</td>
                      <td className="p-2.5 text-center text-slate-500">{it.unit}</td>
                      <td className="p-2.5 text-right text-slate-600">R$ {it.unit_price.toFixed(2)}</td>
                      <td className="p-2.5 text-right font-bold text-slate-900">
                        R$ {it.subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 2. Serviços, Mão de Obra e Custos Complementares */}
          {(budget.services || []).length > 0 && (
            <div className="mb-6">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-2 flex items-center justify-between">
                <span>2. Mão de Obra, Equipamentos e Serviços Especializados</span>
                <span className="text-slate-500 font-normal">Subtotal: R$ {budget.total_services.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </h3>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">Categoria</th>
                      <th className="p-2.5">Descrição</th>
                      <th className="p-2.5 text-center">Quant.</th>
                      <th className="p-2.5 text-right">Valor Unit.</th>
                      <th className="p-2.5 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {budget.services.map((srv, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="p-2.5 font-bold text-emerald-800 text-[11px] uppercase">{srv.category}</td>
                        <td className="p-2.5 text-slate-800">{srv.description}</td>
                        <td className="p-2.5 text-center font-bold text-slate-700">{srv.quantity} {srv.unit}</td>
                        <td className="p-2.5 text-right text-slate-600">R$ {srv.unit_price.toFixed(2)}</td>
                        <td className="p-2.5 text-right font-bold text-slate-900">
                          R$ {srv.subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 3. Faturamento Direto / Equipamentos Principais */}
          {(Number(budget.total_equipment) > 0) && (
            <div className="mb-6">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-2 flex items-center justify-between">
                <span>3. Faturamento Direto de Equipamentos (Fabricante / Distribuidor)</span>
                <span className="text-slate-500 font-normal">Subtotal: R$ {Number(budget.total_equipment).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </h3>
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-900 text-xs sm:text-sm">
                      Máquinas e Equipamentos de Climatização / Exaustão
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Modalidade de Faturamento Direto: faturado pelo distribuidor/fabricante diretamente em nome do cliente com condições comerciais SABRAR.
                    </div>
                  </div>
                  <div className="text-right font-black text-slate-900 text-sm sm:text-base">
                    R$ {Number(budget.total_equipment).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Resumo Financeiro Total */}
          <div className="my-6 p-5 rounded-2xl bg-gradient-to-br from-slate-950 to-emerald-950 text-white flex flex-col sm:flex-row items-center justify-between gap-4 border border-emerald-800/40 shadow-lg">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-emerald-400">Total Geral da Proposta</div>
              <p className="text-xs text-slate-300 mt-0.5">
                Materiais (R$ {budget.total_materials.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}) + Mão de Obra (R$ {budget.total_services.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})
                {Number(budget.total_equipment) > 0 && ` + Faturamento Direto Máquinas (R$ ${Number(budget.total_equipment).toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`}
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl sm:text-3xl font-black text-white">
                R$ {budget.total_final.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-[11px] text-emerald-300 font-semibold">Valor Global SABRAR Engenharia</div>
            </div>
          </div>

          {/* Condições Comerciais e Assinatura */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-slate-200 text-xs">
            <div>
              <h4 className="font-bold text-slate-800 mb-1">Condições Comerciais</h4>
              <p className="text-slate-600 leading-relaxed text-[11px]">
                {budget.commercial_terms ||
                  'Condições padrão SABRAR: 30% de entrada na assinatura do contrato + saldo dividido em medições de execução. Garantia de 5 anos para instalações e equipamentos.'}
              </p>
            </div>

            <div className="flex flex-col items-center justify-center pt-8 sm:pt-4 text-center">
              <div className="w-48 border-b border-slate-400 mb-1"></div>
              <div className="font-bold text-slate-800 text-xs">{project.responsible_engineer}</div>
              <div className="text-[10px] text-slate-500">SABRAR Engenharia • Responsabilidade Técnica</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
