import React, { useState, useRef, useEffect } from 'react';
import { FolderPlus, FileUp, FileText, X, AlertCircle, Check, Sparkles, UploadCloud, Trash2, ChevronDown, ChevronUp, HardHat } from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { extractTextFromPDF } from '../../utils/pdfExtractor';
import { User } from '../../types';

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (createdId: number) => void;
}

interface UploadedDoc {
  name: string;
  size: number;
  type: string;
  file?: File;
  content?: string;
}

export const NewProjectModal: React.FC<NewProjectModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const { currentUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [client, setClient] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [address, setAddress] = useState('');
  const [projectType, setProjectType] = useState<'Comercial' | 'Residencial' | 'Industrial' | 'Reforma' | 'Infraestrutura'>('Comercial');
  const [responsibleEngineer, setResponsibleEngineer] = useState('');
  const [availableEngineers, setAvailableEngineers] = useState<User[]>([]);
  const [selectedEngineerIds, setSelectedEngineerIds] = useState<number[]>([]);
  const [isEngineerDropdownOpen, setIsEngineerDropdownOpen] = useState(false);
  const [estimatedArea, setEstimatedArea] = useState('');
  const [notes, setNotes] = useState('');

  // Upload de Documentos para Análise de IA
  const [uploadedFiles, setUploadedFiles] = useState<UploadedDoc[]>([]);
  const [autoAnalyzeWithAI, setAutoAnalyzeWithAI] = useState(true);
  const [showOptionalText, setShowOptionalText] = useState(false);
  const [optionalText, setOptionalText] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      api.getUsers()
        .then((usersList) => {
          const engineers = usersList.filter((u: any) => {
            const email = String(u.email || '').toLowerCase();
            const dept = String(u.department || '').toLowerCase();
            if (email === 'vinicius.gomes@sabrar.com.br' || dept.includes('uso interno')) {
              return false;
            }
            return (
              u.role === 'engenharia' ||
              u.role_name === 'engenharia' ||
              u.role === 'orcamento_engenharia' ||
              u.role_name === 'orcamento_engenharia' ||
              u.role === 'compras_solicitacoes' ||
              u.role_name === 'compras_solicitacoes' ||
              u.role === 'admin' ||
              u.role_name === 'admin'
            );
          });
          setAvailableEngineers(engineers.length > 0 ? engineers : usersList);
        })
        .catch(console.error);
    }
  }, [isOpen]);

  const toggleEngineerSelection = (eng: User) => {
    setSelectedEngineerIds((prev) => {
      const next = prev.includes(eng.id) ? prev.filter(id => id !== eng.id) : [...prev, eng.id];
      const names = availableEngineers.filter(e => next.includes(e.id)).map(e => e.name);
      setResponsibleEngineer(names.join(', '));
      return next;
    });
  };

  if (!isOpen) return null;

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    const filesArray = Array.from(e.target.files);
    const newDocs: UploadedDoc[] = [];

    for (const f of filesArray) {
      newDocs.push({
        name: f.name,
        size: f.size,
        type: f.name.endsWith('.pdf') ? 'PROJETO_PDF' : f.name.endsWith('.dwg') || f.name.endsWith('.dxf') ? 'PROJETO_CAD' : 'MEMORIAL_DESCRITIVO',
        file: f,
        content: `Documento técnico '${f.name}' carregado para análise automática da IA SABRAR.`
      });

      // Se for PDF, extrai texto diretamente no navegador em segundo plano para evitar payload de 4.5 MB
      if (f.name.toLowerCase().endsWith('.pdf') || f.type === 'application/pdf') {
        extractTextFromPDF(f).then((pdfText) => {
          if (pdfText && pdfText.trim()) {
            setUploadedFiles(prev => prev.map(p => p.name === f.name ? { ...p, content: pdfText } : p));
          }
        }).catch((err) => {
          console.warn('[PDF Extract Warning]', err);
        });
      } else if (f.name.endsWith('.txt') || f.name.endsWith('.csv') || f.type.includes('text')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const text = event.target?.result as string;
          setUploadedFiles(prev => prev.map(p => p.name === f.name ? { ...p, content: text } : p));
        };
        reader.readAsText(f);
      }
    }

    setUploadedFiles(prev => [...prev, ...newDocs]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !client.trim()) {
      setError('Nome da obra e cliente são campos obrigatórios');
      return;
    }

    setLoading(true);
    try {
      const realFiles = uploadedFiles.filter(f => f.file).map(f => f.file as File);

      // 1. Cadastra o projeto com os metadados e documentos técnicos
      const res = await api.createProject({
        name: name.trim(),
        client: client.trim(),
        client_email: clientEmail.trim(),
        client_phone: clientPhone.trim(),
        address: address.trim(),
        project_type: projectType,
        responsible_engineer: responsibleEngineer,
        engineerIds: selectedEngineerIds,
        notes: estimatedArea ? `[Área da Obra: ${estimatedArea} m²] ${notes.trim()}` : notes.trim(),
        initial_spec_text: optionalText.trim(),
        uploadedDocuments: uploadedFiles.map(d => ({
          name: d.name,
          size: d.size,
          type: d.type,
          content: d.content
        })),
        autoAnalyze: autoAnalyzeWithAI && realFiles.length === 0,
        userId: currentUser?.id || 1
      });

      // 2. Se houver arquivos físicos em memória, envia via upload seguro (individual + extração para arquivos > 3.5 MB)
      if (realFiles.length > 0 && res.id) {
        try {
          await api.uploadProjectFiles(res.id, realFiles, autoAnalyzeWithAI);
        } catch (upErr: any) {
          console.warn('[Upload Files Warning]', upErr);
        }
      }

      if (onSuccess) onSuccess(res.id);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao criar projeto');
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-2xl bg-dark-900 border border-dark-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-slate-100">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-dark-850 border-b border-dark-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sabrar-950/70 border border-sabrar-500/40 flex items-center justify-center text-sabrar-400 shadow-inner">
              <FolderPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white">Cadastrar Nova Obra / Projeto</h3>
              <p className="text-xs text-slate-400">Upload de documentos técnicos com análise automática da IA</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-dark-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto">
          {error && (
            <div className="p-3 bg-rose-950/50 border border-rose-800/80 text-rose-300 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Nome e Cliente */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                Nome da Obra / Projeto *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Instalação HVAC Shopping Plaza"
                className="w-full text-xs sm:text-sm p-3 rounded-2xl border border-dark-700 bg-dark-850 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sabrar-500 font-semibold"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                Cliente / Contratante *
              </label>
              <input
                type="text"
                value={client}
                onChange={(e) => setClient(e.target.value)}
                placeholder="Ex: Grupo Multiplan ou Condomínio Alfa"
                className="w-full text-xs sm:text-sm p-3 rounded-2xl border border-dark-700 bg-dark-850 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sabrar-500 font-semibold"
                required
              />
            </div>
          </div>

          {/* Tipologia e Responsável */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                Tipologia da Obra
              </label>
              <select
                value={projectType}
                onChange={(e) => setProjectType(e.target.value as any)}
                className="w-full text-xs p-2.5 rounded-2xl border border-dark-700 bg-dark-850 text-white focus:outline-none focus:ring-2 focus:ring-sabrar-500 font-medium"
              >
                <option value="Comercial">Comercial / Varejo</option>
                <option value="Industrial">Industrial / Galpões</option>
                <option value="Residencial">Residencial / Condomínios</option>
                <option value="Reforma">Reforma / Retrofit</option>
                <option value="Infraestrutura">Infraestrutura / Instalações</option>
              </select>
            </div>

            <div className="relative">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                  Engenheiro(s) Responsável(is) <span className="text-[10px] text-amber-400/90 font-normal lowercase">(opcional)</span>
                </label>
              </div>
              <button
                type="button"
                onClick={() => setIsEngineerDropdownOpen(!isEngineerDropdownOpen)}
                className="w-full text-xs p-2.5 rounded-2xl border border-dark-700 bg-dark-850 text-white flex items-center justify-between gap-2 focus:outline-none focus:ring-2 focus:ring-sabrar-500 text-left"
              >
                <span className={responsibleEngineer ? 'text-white font-semibold truncate' : 'text-slate-500 truncate'}>
                  {responsibleEngineer || 'Selecionar engenheiro(s) responsável(is)...'}
                </span>
                <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
              </button>

              {isEngineerDropdownOpen && availableEngineers.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1.5 z-40 bg-dark-900 border border-dark-700 rounded-2xl shadow-2xl p-2 max-h-56 overflow-y-auto space-y-1">
                  <div className="flex items-center justify-between px-2 py-1 text-[10px] text-slate-400 border-b border-dark-800 mb-1">
                    <span>Selecione um ou mais engenheiros ({availableEngineers.length})</span>
                    <button
                      type="button"
                      onClick={() => setIsEngineerDropdownOpen(false)}
                      className="text-sabrar-400 font-bold hover:underline"
                    >
                      Concluir
                    </button>
                  </div>
                  {availableEngineers.map((eng) => {
                    const isSelected = selectedEngineerIds.includes(eng.id);
                    return (
                      <div
                        key={eng.id}
                        onClick={() => toggleEngineerSelection(eng)}
                        className={`p-2 rounded-xl cursor-pointer flex items-center justify-between text-xs transition-colors ${
                          isSelected
                            ? 'bg-sabrar-950/60 border border-sabrar-500/50 text-white font-bold'
                            : 'hover:bg-dark-800 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <HardHat className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-sabrar-400' : 'text-slate-500'}`} />
                          <div className="truncate">
                            <div>{eng.name}</div>
                            <div className="text-[10px] text-slate-400 font-normal">{eng.email}</div>
                          </div>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-sabrar-400 shrink-0" />}
                      </div>
                    );
                  })}
                </div>
              )}
              <p className="text-[10px] text-slate-500 mt-1">
                Você pode designar qualquer engenheiro agora ou atribuir/alterar posteriormente na página da obra.
              </p>
            </div>
          </div>

          {/* Endereço e Área da Obra */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                Endereço / Local da Obra
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Ex: Shopping Tijuca - Av. Maracanã, 987 - Rio de Janeiro / RJ"
                className="w-full text-xs p-2.5 rounded-2xl border border-dark-700 bg-dark-850 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sabrar-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                Área da Obra (m²) <span className="text-slate-500 font-normal lowercase">(opcional)</span>
              </label>
              <input
                type="number"
                value={estimatedArea}
                onChange={(e) => setEstimatedArea(e.target.value)}
                placeholder="Ex: 120"
                className="w-full text-xs p-2.5 rounded-2xl border border-dark-700 bg-dark-850 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sabrar-500 font-semibold"
              />
            </div>
          </div>

          {/* ÁREA DE UPLOAD DE DOCUMENTOS PARA ANÁLISE PELA IA (Substituindo digitação manual conforme solicitação 1) */}
          <div className="p-4 sm:p-5 bg-dark-850 border-2 border-dashed border-sabrar-600/40 hover:border-sabrar-500/70 rounded-3xl transition-all space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-sabrar-500/20 text-sabrar-400 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 animate-pulse" />
                </div>
                <div>
                  <div className="font-extrabold text-xs sm:text-sm text-white flex items-center gap-1.5">
                    <span>Documentos Técnicos para Análise da IA</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sabrar-950 text-sabrar-400 border border-sabrar-500/40">
                      Automático
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Faça o upload do memorial descritivo ou projetos técnicos (PDF, DWG, DOCX, TXT, Planilhas). A IA analisará os arquivos para estimar materiais e orçamentos.
                  </p>
                </div>
              </div>
            </div>

            {/* Hidden native file input */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.dwg,.dxf,.docx,.doc,.txt,.xlsx,.xls,.csv,.ods,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,*"
              onChange={handleFilesSelected}
              className="hidden"
            />

            {/* Upload Button Box */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="group cursor-pointer p-4 rounded-2xl bg-dark-900 border border-dark-700 hover:border-sabrar-500/60 transition-all flex flex-col sm:flex-row items-center justify-center gap-3 text-center sm:text-left"
            >
              <div className="w-12 h-12 rounded-2xl bg-dark-800 border border-dark-700 flex items-center justify-center text-sabrar-400 group-hover:scale-110 transition-transform">
                <UploadCloud className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <div className="text-xs sm:text-sm font-extrabold text-white group-hover:text-sabrar-400 transition-colors">
                  Clique aqui para selecionar os documentos do projeto
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Formatos aceitos: PDF, DWG, DXF, DOCX, TXT, Excel/CSV (Projetos HVAC, Elétrica, Hidráulica, Civil)
                </div>
              </div>
              <button
                type="button"
                className="px-4 py-2 rounded-xl bg-sabrar-600 hover:bg-sabrar-500 text-white text-xs font-bold transition-all shadow-md shadow-sabrar-600/30 shrink-0"
              >
                Upload de Documentos
              </button>
            </div>

            {/* List of Selected Files */}
            {uploadedFiles.length > 0 && (
              <div className="space-y-2 pt-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-sabrar-400 flex items-center justify-between">
                  <span>Arquivos Selecionados ({uploadedFiles.length}):</span>
                  <span className="text-slate-400 lowercase font-normal">prontos para leitura pela IA</span>
                </div>
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {uploadedFiles.map((doc, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl bg-dark-900 border border-dark-750 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <FileText className="w-4 h-4 text-sabrar-400 shrink-0" />
                        <span className="font-semibold text-white truncate max-w-xs">{doc.name}</span>
                        <span className="text-[10px] text-slate-500 font-mono">({formatFileSize(doc.size)})</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveFile(idx)}
                        className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors shrink-0"
                        title="Remover arquivo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Checkbox auto-analyze */}
            <div className="pt-2 border-t border-dark-750 flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs text-slate-300 font-semibold cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoAnalyzeWithAI}
                  onChange={(e) => setAutoAnalyzeWithAI(e.target.checked)}
                  className="rounded bg-dark-800 border-dark-700 text-sabrar-500 focus:ring-sabrar-500 w-4 h-4"
                />
                <span>Executar análise automática da IA imediatamente após o cadastro</span>
              </label>
            </div>

            {/* Toggle para texto adicional opcional */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowOptionalText(!showOptionalText)}
                className="text-[11px] text-slate-400 hover:text-sabrar-400 font-medium flex items-center gap-1 transition-colors"
              >
                {showOptionalText ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                <span>Deseja adicionar notas ou observações complementares em texto? (Opcional)</span>
              </button>

              {showOptionalText && (
                <textarea
                  value={optionalText}
                  onChange={(e) => setOptionalText(e.target.value)}
                  placeholder="Informações pontuais adicionais (ex: 'considerar pé direito duplo na recepção')..."
                  rows={2}
                  className="w-full text-xs p-2.5 mt-2 rounded-xl border border-dark-700 bg-dark-900 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sabrar-500"
                />
              )}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 flex items-center justify-end gap-2 border-t border-dark-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-2xl border border-dark-700 text-slate-300 text-xs font-bold hover:bg-dark-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-sabrar-600 hover:bg-sabrar-500 text-white text-xs font-bold shadow-lg shadow-sabrar-600/30 transition-all disabled:opacity-50 active:scale-95"
            >
              <Check className="w-4 h-4" />
              <span>{loading ? 'Cadastrando e Analisando...' : 'Cadastrar Obra & Analisar com IA'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
