import React, { useState, useEffect, useMemo } from 'react';
import { Ruler, CheckCircle, AlertTriangle, X, Plus, Trash2 } from 'lucide-react';
import { api } from '../../services/api';

interface DuctGeometryModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: number;
  onApplied?: () => void;
}

interface ReviewSection {
  id: number | string;
  system: string;
  label: string;
  widthCm: number;
  heightCm: number;
  lengthM: number;
  sourceFile?: string;
  sourcePage?: number;
  view?: string;
  scale?: string;
  orientation?: string;
  measurementStatus?: string;
  evidence?: any;
  include: boolean;
  edited: boolean;
}

interface ReviewCircuit {
  circuit: number;
  evaporatorTag?: string;
  condenserTag?: string;
  runM: number;
  status: string;
  premise?: string;
  edited: boolean;
}

const fmt = (n: number, d = 2) => (Number.isFinite(n) ? n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—');

export const DuctGeometryModal: React.FC<DuctGeometryModalProps> = ({ isOpen, onClose, projectId, onApplied }) => {
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [data, setData] = useState<any>(null);
  const [rows, setRows] = useState<ReviewSection[]>([]);
  const [circuits, setCircuits] = useState<ReviewCircuit[]>([]);
  const [externalArea, setExternalArea] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (isOpen && projectId) loadGeometry();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, projectId]);

  const loadGeometry = async () => {
    setLoading(true);
    setError(null);
    try {
      const res: any = await api.getDuctGeometry(projectId);
      const payload = res?.data ?? res;
      if (!payload || res?.error) throw new Error(res?.error || 'Não foi possível carregar a medição geométrica.');
      setData(payload);
      setRows((payload.sections || []).map((s: any) => ({ ...s, include: true, edited: false })));
      setCircuits((payload.refrigerantCircuits || []).map((c: any) => ({
        circuit: c.circuit,
        evaporatorTag: c.evaporatorTag,
        condenserTag: c.condenserTag,
        runM: Number(c.measuredRunM ?? c.forecastRunM ?? 0),
        status: c.measurementStatus,
        premise: c.premise,
        edited: false
      })));
    } catch (err: any) {
      setError(err?.message || 'Erro ao conectar ao serviço de dutos.');
    } finally {
      setLoading(false);
    }
  };

  const updateRow = (idx: number, patch: Partial<ReviewSection>) =>
    setRows(prev => prev.map((r, i) => (i === idx ? { ...r, ...patch, edited: true } : r)));

  const addRow = () =>
    setRows(prev => [...prev, { id: `manual-${prev.length + 1}`, system: 'Insuflamento', label: 'Manual', widthCm: 0, heightCm: 0, lengthM: 0, view: 'Inclusão manual', include: true, edited: true, measurementStatus: 'MEDIDO_REVISADO' }]);

  const totals = useMemo(() => {
    const valid = rows.filter(r => r.include && r.lengthM > 0 && r.widthCm > 0 && r.heightCm > 0);
    const linear = valid.reduce((a, r) => a + Number(r.lengthM), 0);
    const area = valid.reduce((a, r) => a + (2 * (Number(r.widthCm) + Number(r.heightCm)) / 100) * Number(r.lengthM), 0);
    return { count: valid.length, linear, area };
  }, [rows]);

  const handleApply = async () => {
    setApplying(true);
    setError(null);
    try {
      const body = {
        sections: rows.filter(r => r.include).map(r => ({ ...r, lengthM: Number(r.lengthM), widthCm: Number(r.widthCm), heightCm: Number(r.heightCm) })),
        refrigerantRuns: circuits.some(c => c.edited) ? circuits.map(c => ({ circuit: c.circuit, runM: Number(c.runM), evidence: 'Revisão manual' })) : undefined,
        externalAreaSqm: externalArea ? Number(externalArea.replace(',', '.')) : undefined
      };
      const res: any = await api.applyDuctGeometry(projectId, body);
      if (res?.error) throw new Error(res.error);
      if (onApplied) onApplied();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Erro ao aplicar a revisão ao orçamento.');
    } finally {
      setApplying(false);
    }
  };

  if (!isOpen) return null;

  const views: any[] = data?.views || [];
  const excluded: any[] = (data?.excluded || []).filter((e: any) => e.reason === 'PAR_SEM_ROTULO_COMPATIVEL');
  const preview: any[] = data?.derivedQuantitiesPreview || [];
  const q = search.trim().toLowerCase();
  const visible = rows.map((r, idx) => ({ r, idx })).filter(({ r }) =>
    !q || `${r.label} ${r.view} ${r.widthCm}x${r.heightCm} ${r.system}`.toLowerCase().includes(q));

  const scaleBadge = (status: string) =>
    status === 'VALIDADA'
      ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
      : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-dark-750 rounded-3xl max-w-6xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="p-5 border-b border-slate-200 dark:border-dark-750 flex items-center justify-between bg-slate-50 dark:bg-dark-850">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-2xl border border-blue-500/20">
              <Ruler className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">Revisão de Geometria: Dutos e Circuitos</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Trechos medidos na geometria vetorial das pranchas, com escala validada por vista. Confira, corrija ou exclua antes de aplicar.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-dark-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3.5 bg-rose-950/60 border border-rose-500/50 rounded-2xl text-xs text-rose-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs font-semibold text-slate-400">Lendo geometria vetorial e validando escalas...</p>
            </div>
          ) : (
            <>
              {/* Vistas e escalas */}
              <div className="flex flex-wrap gap-2">
                {views.map((v, i) => (
                  <span key={i} className={`text-[11px] font-bold px-2 py-1 rounded-lg ${scaleBadge(v.scaleStatus)}`} title={`${v.sourceFile} p.${v.sourcePage}`}>
                    {v.name} · {v.declaredScale || 's/ escala'} · implícita {v.impliedScaleMedian ?? '—'} · {v.scaleStatus}
                  </span>
                ))}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-slate-50 dark:bg-dark-850 p-3.5 rounded-2xl border border-slate-200 dark:border-dark-750">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Trechos incluídos</span>
                  <div className="text-xl font-black text-slate-900 dark:text-white font-mono mt-0.5">{totals.count}</div>
                </div>
                <div className="bg-slate-50 dark:bg-dark-850 p-3.5 rounded-2xl border border-slate-200 dark:border-dark-750">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Extensão linear</span>
                  <div className="text-xl font-black text-slate-900 dark:text-white font-mono mt-0.5">{fmt(totals.linear)} m</div>
                </div>
                <div className="bg-slate-50 dark:bg-dark-850 p-3.5 rounded-2xl border border-slate-200 dark:border-dark-750">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Área líquida (sem perdas)</span>
                  <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">{fmt(totals.area)} m²</div>
                  <span className="text-[11px] text-slate-500">Perdas, peças e embalagens são aplicadas no orçamento</span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <input
                  type="text"
                  placeholder="Filtrar (ex.: I-60x45, Retorno, Corte)..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full sm:w-72 bg-slate-50 dark:bg-dark-850 border border-slate-200 dark:border-dark-750 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-500"
                />
                <button type="button" onClick={addRow} className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-dark-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-dark-800">
                  <Plus className="w-3.5 h-3.5" /> Incluir trecho
                </button>
              </div>

              <div className="border border-slate-200 dark:border-dark-750 rounded-2xl overflow-hidden">
                <div className="max-h-80 overflow-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 dark:bg-dark-850 text-slate-600 dark:text-slate-400 font-bold sticky top-0">
                      <tr>
                        <th className="p-2">Usar</th>
                        <th className="p-2">Rótulo / Sistema</th>
                        <th className="p-2">L × A (cm)</th>
                        <th className="p-2 text-right">Compr. (m)</th>
                        <th className="p-2 text-right">Área líq. (m²)</th>
                        <th className="p-2">Arquivo / Vista / Evidência</th>
                        <th className="p-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-dark-750">
                      {visible.map(({ r, idx }) => {
                        const area = (2 * (Number(r.widthCm) + Number(r.heightCm)) / 100) * Number(r.lengthM);
                        return (
                          <tr key={`${r.id}-${idx}`} className={r.include ? '' : 'opacity-40'}>
                            <td className="p-2"><input type="checkbox" checked={r.include} onChange={e => updateRow(idx, { include: e.target.checked })} /></td>
                            <td className="p-2 font-bold text-slate-900 dark:text-white">
                              {r.label}<div className="text-[10px] font-normal text-slate-500">{r.system}</div>
                            </td>
                            <td className="p-2 font-mono">
                              <input className="w-12 bg-transparent border-b border-slate-300 dark:border-dark-700" value={r.widthCm} onChange={e => updateRow(idx, { widthCm: Number(e.target.value) || 0 })} />
                              ×
                              <input className="w-12 bg-transparent border-b border-slate-300 dark:border-dark-700" value={r.heightCm} onChange={e => updateRow(idx, { heightCm: Number(e.target.value) || 0 })} />
                            </td>
                            <td className="p-2 text-right font-mono">
                              <input className="w-16 text-right bg-transparent border-b border-slate-300 dark:border-dark-700" value={r.lengthM} onChange={e => updateRow(idx, { lengthM: Number(String(e.target.value).replace(',', '.')) || 0 })} />
                            </td>
                            <td className="p-2 text-right font-mono">{fmt(area)}</td>
                            <td className="p-2 text-[10px] text-slate-500">
                              {r.sourceFile ? `${r.sourceFile} p.${r.sourcePage}` : '—'} · {r.view} {r.scale ? `(${r.scale})` : ''}
                              {r.evidence?.drawnSpacingPt != null && (
                                <div>afastamento {r.evidence.drawnSpacingPt} pt = {r.evidence.drawnWidthCm} cm · rótulo "{r.evidence.labelText}"</div>
                              )}
                            </td>
                            <td className="p-2 text-[10px] font-bold">{r.edited ? 'MEDIDO_REVISADO' : (r.measurementStatus || 'MEDIDO')}{r.orientation === 'PRUMADA_VERTICAL' ? ' · prumada' : ''}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {excluded.length > 0 && (
                <details className="text-xs">
                  <summary className="cursor-pointer font-bold text-amber-600 dark:text-amber-400">
                    {excluded.length} contorno(s) no estilo de duto sem rótulo compatível: conferir e incluir manualmente se forem dutos
                  </summary>
                  <ul className="mt-2 space-y-1 text-slate-600 dark:text-slate-400">
                    {excluded.map((e, i) => (
                      <li key={i}>{e.sourceFile} p.{e.sourcePage} · {e.view} · largura desenhada {e.drawnWidthCm} cm · {e.lengthM} m</li>
                    ))}
                  </ul>
                </details>
              )}

              {circuits.length > 0 && (
                <div className="border border-slate-200 dark:border-dark-750 rounded-2xl p-3 space-y-2">
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-300">Circuitos frigorígenos (percurso por circuito)</div>
                  {circuits.map((c, i) => (
                    <div key={c.circuit} className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-bold">C{c.circuit}</span>
                      <span className="text-slate-500">{c.evaporatorTag} ↔ {c.condenserTag}</span>
                      <input className="w-16 text-right bg-transparent border-b border-slate-300 dark:border-dark-700 font-mono" value={c.runM}
                        onChange={e => setCircuits(prev => prev.map((x, j) => (j === i ? { ...x, runM: Number(String(e.target.value).replace(',', '.')) || 0, edited: true, status: 'MEDIDO' } : x)))} />
                      <span>m</span>
                      <span className={`font-bold ${c.status === 'MEDIDO' ? 'text-emerald-600' : 'text-amber-600'}`}>{c.edited ? 'MEDIDO_REVISADO' : c.status}</span>
                      {!c.edited && c.premise && <span className="text-[10px] text-slate-500 w-full">{c.premise}</span>}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2 text-xs">
                <label className="font-bold text-slate-700 dark:text-slate-300">Área líquida de duto externo (MPU 30 mm), se houver:</label>
                <input className="w-20 text-right bg-transparent border-b border-slate-300 dark:border-dark-700 font-mono" value={externalArea} onChange={e => setExternalArea(e.target.value)} placeholder="m²" />
              </div>

              {preview.length > 0 && (
                <details className="text-xs">
                  <summary className="cursor-pointer font-bold text-slate-700 dark:text-slate-300">Prévia dos quantitativos derivados (sem preço)</summary>
                  <ul className="mt-2 space-y-1">
                    {preview.map((p, i) => (
                      <li key={i}>
                        <strong>{p.name}</strong>: {p.quantity} {p.unit} · {p.measurementStatus}
                        {p.measurementStatus === 'PREVISAO' && <span className="text-amber-600"> (premissas não validadas)</span>}
                      </li>
                    ))}
                  </ul>
                </details>
              )}

              <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-300 dark:border-blue-800/50 rounded-2xl text-[11px] text-blue-800 dark:text-blue-300 flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                <div>
                  Ao aplicar, o orçamento é recalculado sobre estes trechos: painéis, acessórios, suportação e mão de obra usam a mesma base.
                  Itens que dependem de coeficientes não validados continuam como <strong>PREVISÃO</strong>; preços vêm somente do cadastro.
                </div>
              </div>
            </>
          )}
        </div>

        <div className="p-4 border-t border-slate-200 dark:border-dark-750 bg-slate-50 dark:bg-dark-850 flex items-center justify-between">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-300 dark:border-dark-700 hover:bg-slate-100 dark:hover:bg-dark-800 text-xs font-bold text-slate-700 dark:text-slate-300">
            Fechar
          </button>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setRows(prev => prev.map(r => ({ ...r, include: false, edited: true })))} disabled={loading || applying} className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-rose-500">
              <Trash2 className="w-3.5 h-3.5" /> Desmarcar todos
            </button>
            <button type="button" onClick={handleApply} disabled={loading || applying || !data} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-extrabold shadow-lg shadow-blue-600/30 disabled:opacity-50">
              <CheckCircle className="w-4 h-4" />
              <span>{applying ? 'Recalculando orçamento...' : 'Aplicar revisão ao orçamento'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
