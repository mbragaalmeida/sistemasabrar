import React, { useState, useEffect } from 'react';
import {
  X,
  Copy,
  Check,
  Code2,
  ListOrdered,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Layers,
  ArrowRight
} from 'lucide-react';
import { api } from '../../services/api';

interface AIPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AIPromptModal: React.FC<AIPromptModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'steps' | 'raw'>('steps');
  const [promptText, setPromptText] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      api.getAIAgentContext()
        .then(data => {
          setPromptText(data.systemPrompt || '');
          setLoading(false);
        })
        .catch(err => {
          console.error('[PromptModal Error]', err);
          setLoading(false);
        });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(promptText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const stepsList = [
    {
      step: '1',
      title: 'Análise Inicial do Projeto e Revisões',
      desc: 'Análise completa de plantas AC, exaustão, cortes, diagramas, memoriais descritivos/cálculo, listas de equipamentos e verificação da revisão mais recente (data, número, plantas na mesma revisão, alterações de traçado).'
    },
    {
      step: '2',
      title: 'Levantamento dos Materiais de Difusão',
      desc: 'Contagem física nas plantas (dampers corta-fogo/regulagem/motorizados, grelhas simples/dupla deflexão c/ e s/ registro, venezianas, difusores) separados rigorosamente por sistema (insuflamento, ar exterior, retorno, exaustão cozinha, sanitários).'
    },
    {
      step: '3',
      title: 'Levantamento dos Dutos (Regras de Materiais da OP)',
      desc: 'Dutos em KG. 1ª medida = largura (A cm), 2ª = altura (B cm). Critérios padrão: Insuflamento (Galv TDC + lã de vidro 38mm), Ar Exterior c/ cond. (lã vidro 38mm) ou c/ cx vent (s/ isolamento), Retorno (s/ isolamento), Cozinha (Chapa preta soldada + lã de rocha), Sanitários (Galv TDC s/ isolamento).'
    },
    {
      step: '4',
      title: 'Medição dos Trechos de Duto',
      desc: 'Lançamento das dimensões na OP: Coluna A = Largura (cm), Coluna B = Altura (cm), Coluna C = Comprimento (m).'
    },
    {
      step: '5',
      title: 'Cálculo do Perímetro da Seção',
      desc: 'Fórmula: Perímetro (m) = 2 × (A/100 + B/100). Exemplo: 60 × 40 cm -> Perímetro = 2,00 m.'
    },
    {
      step: '6',
      title: 'Cálculo da Área Superficial do Duto',
      desc: 'Fórmula: Área (m²) = Perímetro (m) × Comprimento (m). Exemplo: 2,00 m × 5,00 m = 10,00 m².'
    },
    {
      step: '7',
      title: 'Definição da Bitola da Chapa (Maior Dimensão)',
      desc: 'Tabela: até 60cm (#26); 61 a 90cm (#24); 91 a 120cm (#22); 121 a 150cm (#20); 151 a 300cm (#18). Exceções prioritárias: Chapa preta cozinha -> #16; Pressurização de escada -> #18.'
    },
    {
      step: '8',
      title: 'Cálculo do KG com Perda de 20% da OP',
      desc: 'Fórmula: KG Total = Área (m²) × Fator da Bitola (kg/m²) × 1,20. Fatores: #26 = 4,0; #24 = 5,2; #22 = 6,4; #20 = 7,6; #18 = 10,0; #16 = 12,0 kg/m².'
    },
    {
      step: '9',
      title: 'Levantamento do Isolamento Térmico (Fator 1,40)',
      desc: 'Fórmula: Isolamento (m²) = Área do duto (m²) × 1,40. Considera 40% de perdas e sobras no corte e instalação.'
    },
    {
      step: '10',
      title: 'Checklist de Conferência dos Dutos',
      desc: 'Validação de trechos, dimensões, bitolas, fatores, perdas de 20%, isolamentos corretos e eliminação de duplicidades.'
    },
    {
      step: '11',
      title: 'Insumos de Instalação e Juntas TDC (+15%)',
      desc: 'Cantos: (Somatório P / 1,1) * 8 arred. p/ cima + 15%; Parafusos 5/16" a cada 1,5m; Silicone TDC: ((P / 1,1) / 3) + 15%; Fita TDC: (P / 10) + 15% (rolos de 10m).'
    },
    {
      step: '12',
      title: 'Suportação dos Dutos a cada 1,50 m',
      desc: 'Cada 1,50 m de duto = 1 conjunto: 1 perfilado (largura + 10 cm) + 2 tirantes barras 3m (1/4" p/ dutos, 5/16" máquinas) + 2 chumbadores 1/4" + 4 porcas 1/4" + 4 arruelas 1/4".'
    },
    {
      step: '13',
      title: 'Rede de Cobre (VRV/VRF, Split, Splitão) + 25% de Perda',
      desc: 'Linhas de líquido e gás separadas por diâmetro e comprimento em metros + 25% de perda linear (fator 1,25). Isolamento 1:1: Armaflex H (líquido), Armaflex M (gás), Isotubo (Split 1x1). Refnets e caixas de derivação.'
    },
    {
      step: '14',
      title: 'Rede Hidráulica CAG + 25% de Perda',
      desc: 'Tubulações com perda linear de 25% (fator 1,25). Conexões quantificadas individualmente (curvas, tês, reduções, flanges, uniões). Válvulas por diâmetro. Bombas e isolamento por diâmetro.'
    },
    {
      step: '15',
      title: 'Levantamento e Conferência de Equipamentos',
      desc: 'Conferência de evaporadoras, condensadoras, refnets, controles, chillers, fancoils, bombas, torres, ventiladores e exaustores.'
    },
    {
      step: '16',
      title: 'Elétrica, Comando e Automação (Limite de Escopo)',
      desc: 'Quadros, disjuntores, inversores, cabos de força e comando, termostatos e sensores. Verificação estrita do limite de escopo SABRAR.'
    },
    {
      step: '17',
      title: 'Conferência Final Cruzada',
      desc: 'Batimento obrigatório: Projeto × Memorial × Diagramas × Lista de Equipamentos × OP.'
    },
    {
      step: '18',
      title: 'Segregação de Previsões',
      desc: 'Itens com documentação insuficiente são lançados obrigatoriamente como PREVISÃO separada para rastreabilidade e controle de revisões.'
    },
    {
      step: '19',
      title: 'Conferência Final e Consolidação da OP',
      desc: 'Equipamentos + Difusão + Dutos + Isolamento + Insumos + Suportes + Cobre + Hidráulica + Drenagem + Elétrica + Previsões. Liberação para revisão humana.'
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-5xl bg-dark-900 border border-dark-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-slate-100">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-dark-850 border-b border-dark-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sabrar-950/80 border border-sabrar-500/40 flex items-center justify-center text-sabrar-400">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-extrabold text-base sm:text-lg text-white">
                  Instruções & Prompt Oficial da IA SABRAR
                </h2>
                <span className="text-[10px] uppercase font-bold bg-sabrar-950 text-sabrar-400 border border-sabrar-500/40 px-2 py-0.5 rounded-full">
                  19 Passos da OP
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Metodologia padronizada para levantamento de projetos de ar-condicionado e exaustão
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-dark-800 hover:bg-dark-750 text-slate-200 border border-dark-700 text-xs font-semibold transition-all active:scale-95"
              title="Copiar prompt completo para a área de transferência"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-sabrar-400" />
                  <span className="text-sabrar-400">Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                  <span>Copiar Prompt</span>
                </>
              )}
            </button>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-dark-800 hover:bg-dark-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 px-5 py-2.5 bg-dark-850/60 border-b border-dark-800 text-xs font-bold">
          <button
            onClick={() => setActiveTab('steps')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
              activeTab === 'steps'
                ? 'bg-sabrar-600 text-white shadow-md shadow-sabrar-600/30'
                : 'text-slate-400 hover:text-white hover:bg-dark-800'
            }`}
          >
            <ListOrdered className="w-4 h-4" />
            <span>Guia dos 19 Passos da OP</span>
          </button>

          <button
            onClick={() => setActiveTab('raw')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
              activeTab === 'raw'
                ? 'bg-sabrar-600 text-white shadow-md shadow-sabrar-600/30'
                : 'text-slate-400 hover:text-white hover:bg-dark-800'
            }`}
          >
            <Code2 className="w-4 h-4" />
            <span>System Prompt Completo (Raw)</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto max-h-[70vh] space-y-4">
          {activeTab === 'steps' ? (
            <div className="space-y-3">
              <div className="p-3.5 bg-dark-850 border border-sabrar-500/30 rounded-2xl flex items-start gap-3 text-xs text-slate-300">
                <ShieldCheck className="w-5 h-5 text-sabrar-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-extrabold text-white text-sm">
                    Metodologia Técnica Oficial SABRAR Integrada à IA
                  </div>
                  <p className="text-slate-400 mt-0.5 leading-relaxed">
                    A IA agora segue com rigor absoluto a sequência de 19 passos da empresa: desde a contagem física da difusão, cálculo trecho a trecho de dutos em KG com bitolas normalizadas e perda de 20%, isolamento de dutos com fator 1,40, insumos TDC com +15%, suportação completa a cada 1,50 m, tubulação de cobre e hidráulica com 25% de perda e segregação de previsões.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {stepsList.map(item => (
                  <div
                    key={item.step}
                    className="p-4 bg-dark-850 rounded-2xl border border-dark-750 hover:border-sabrar-500/40 transition-all flex items-start gap-3"
                  >
                    <div className="w-7 h-7 rounded-xl bg-sabrar-950 border border-sabrar-500/40 text-sabrar-400 flex items-center justify-center font-black text-xs shrink-0">
                      {item.step}
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-bold text-white text-xs leading-snug">
                        {item.title}
                      </h4>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="relative">
              {loading ? (
                <div className="py-12 text-center text-xs text-slate-500">
                  Carregando prompt oficial...
                </div>
              ) : (
                <pre className="p-4 bg-dark-950 border border-dark-800 rounded-2xl text-[11px] font-mono text-slate-300 leading-relaxed whitespace-pre-wrap select-text max-h-[60vh] overflow-y-auto">
                  {promptText}
                </pre>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-dark-850 border-t border-dark-750 flex items-center justify-between text-xs text-slate-400">
          <span>SABRAR Budget Agent Prompt • Versão com Passo a Passo da OP Ativo</span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-dark-800 hover:bg-dark-750 text-white font-semibold transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
