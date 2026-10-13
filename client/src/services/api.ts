import { extractTextFromPDF } from '../utils/pdfExtractor';
import { extractTextFromCad } from '../utils/cadExtractor';

const API_BASE = (import.meta as any).env?.VITE_API_URL || '/api';

export async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('sabrar_token') : null;
  const userStr = typeof window !== 'undefined' ? localStorage.getItem('sabrar_user') : null;
  let currentUserId: string | null = null;
  let currentUserRole: string | null = null;
  if (userStr) {
    try {
      const u = JSON.parse(userStr);
      currentUserId = u.id ? String(u.id) : null;
      currentUserRole = u.role || null;
    } catch {}
  }

  const authHeaders: Record<string, string> = {};
  if (token) authHeaders['Authorization'] = `Bearer ${token}`;
  if (currentUserId) authHeaders['x-user-id'] = currentUserId;
  if (currentUserRole) authHeaders['x-user-role'] = currentUserRole;

  const res = await fetch(`${API_BASE}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...options?.headers
    },
    ...options
  });

  if (!res.ok) {
    let errorMsg = 'Erro na requisição';
    try {
      const text = await res.text();
      try {
        const data = JSON.parse(text);
        errorMsg = data.error || data.message || errorMsg;
      } catch {
        errorMsg = text || `Erro ${res.status}: ${res.statusText}`;
      }
    } catch {
      errorMsg = `Erro ${res.status}: ${res.statusText}`;
    }
    throw new Error(errorMsg);
  }

  return res.json();
}

export const api = {
  // Auth & Usuários
  login: (credentials: { email: string; password: string }) =>
    fetchJson<any>('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
  getUsers: () => fetchJson<any[]>('/auth/users'),
  getRoles: () => fetchJson<any[]>('/auth/roles'),
  getUser: (id: number) => fetchJson<any>(`/auth/user/${id}`),
  createUser: (data: any) => fetchJson<any>('/auth/users', { method: 'POST', body: JSON.stringify(data) }),
  deleteUser: (id: number | string) =>
    fetchJson<any>(`/auth/users/${id}`, { method: 'DELETE' }),
  changePassword: (data: { currentPassword?: string; newPassword: string; userId?: number }) =>
    fetchJson<{ success: boolean; message: string }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  // Projetos
  getProjects: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return fetchJson<any[]>(`/projects${qs}`);
  },
  getProject: (id: number | string) => fetchJson<any>(`/projects/${id}`),
  createProject: (data: any) => fetchJson<any>('/projects', { method: 'POST', body: JSON.stringify(data) }),
  updateProject: (id: number | string, data: any) =>
    fetchJson<any>(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteProject: (id: number | string) =>
    fetchJson<any>(`/projects/${id}`, { method: 'DELETE' }),
  assignProjectEngineers: (projectId: number | string, engineerIds: number[], userId?: number) =>
    fetchJson<any>(`/projects/${projectId}/engineers`, {
      method: 'PATCH',
      body: JSON.stringify({ engineerIds, userId })
    }),
  getProjectMaterialQuotas: (projectId: number | string) =>
    fetchJson<{ projectId: number; hasBudget: boolean; budgetStatus?: string; quotas: any[] }>(`/projects/${projectId}/material-quotas`),
  updateProjectStatus: (id: number | string, status: string, userId?: number) =>
    fetchJson<any>(`/projects/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status, userId }) }),
  addProjectFile: (id: number | string, data: any) =>
    fetchJson<any>(`/projects/${id}/files`, { method: 'POST', body: JSON.stringify(data) }),
  uploadProjectFiles: async (projectId: number | string, files: File[], autoAnalyze?: boolean) => {
    const results = [];
    const VERCEL_MAX_SAFE_FILE_SIZE = 3.5 * 1024 * 1024; // 3.5 MB para respeitar a margem de segurança do limite de 4.5 MB da Vercel

    for (const f of files) {
      const isPdf = f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf');
      const isCad = f.name.toLowerCase().endsWith('.dwg') || f.name.toLowerCase().endsWith('.dxf');
      const isText = f.type.includes('text') || f.name.endsWith('.txt') || f.name.endsWith('.csv');

      // Se for arquivo grande (> 3.5 MB) ou PDF/CAD/Texto, extrai texto diretamente no navegador
      // Isso contorna o limite de 4.5 MB da Vercel (HTTP 413) e alimenta a IA com o conteúdo do projeto
      if (f.size > VERCEL_MAX_SAFE_FILE_SIZE || isText || isCad) {
        let extractedText = '';
        if (isPdf) {
          try {
            extractedText = await extractTextFromPDF(f);
          } catch (e) {
            console.warn('[Upload] Erro ao extrair PDF localmente:', e);
          }
        } else if (isCad) {
          try {
            extractedText = await extractTextFromCad(f);
          } catch (e) {
            console.warn('[Upload] Erro ao extrair CAD localmente:', e);
          }
        } else if (isText) {
          try {
            extractedText = await f.text();
          } catch (e) {
            console.warn('[Upload] Erro ao ler texto localmente:', e);
          }
        }

        if (extractedText && extractedText.trim()) {
          const resFile = await fetchJson<any>(`/projects/${projectId}/files`, {
            method: 'POST',
            body: JSON.stringify({
              type: isPdf ? 'PROJETO_PDF' : (isCad ? 'PROJETO_CAD' : 'MEMORIAL_DESCRITIVO'),
              original_name: f.name,
              file_size: f.size,
              mime_type: f.type || (isPdf ? 'application/pdf' : (isCad ? 'application/octet-stream' : 'text/plain')),
              content_summary: extractedText
            })
          });
          results.push(resFile);
          continue;
        }
      }

      // Para arquivos menores ou sem texto extraído, envia via upload multipart individual
      try {
        const formData = new FormData();
        formData.append('files', f);
        const res = await fetch(`${API_BASE}/projects/${projectId}/upload`, {
          method: 'POST',
          body: formData
        });

        if (!res.ok) {
          // Se Vercel rejeitar por tamanho (HTTP 413), executa extração do PDF ou CAD como fallback imediato
          if (res.status === 413) {
            let extractedText = '';
            if (isPdf) {
              extractedText = await extractTextFromPDF(f).catch(() => '');
            } else if (isCad) {
              extractedText = await extractTextFromCad(f).catch(() => '');
            }
            if (extractedText && extractedText.trim()) {
              const resFile = await fetchJson<any>(`/projects/${projectId}/files`, {
                method: 'POST',
                body: JSON.stringify({
                  type: isPdf ? 'PROJETO_PDF' : (isCad ? 'PROJETO_CAD' : 'PROJETO_TECNICO'),
                  original_name: f.name,
                  file_size: f.size,
                  mime_type: f.type || 'application/octet-stream',
                  content_summary: extractedText
                })
              });
              results.push(resFile);
              continue;
            }
          }
          const err = await res.json().catch(() => ({ error: `Falha no upload do arquivo ${f.name} (Status ${res.status})` }));
          throw new Error(err.error || `Falha no upload de ${f.name}`);
        }

        const data = await res.json();
        results.push(data);
      } catch (err: any) {
        if (isPdf || isCad) {
          const extractedText = isPdf ? await extractTextFromPDF(f).catch(() => '') : await extractTextFromCad(f).catch(() => '');
          if (extractedText && extractedText.trim()) {
            const resFile = await fetchJson<any>(`/projects/${projectId}/files`, {
              method: 'POST',
              body: JSON.stringify({
                type: isPdf ? 'PROJETO_PDF' : 'PROJETO_CAD',
                original_name: f.name,
                file_size: f.size,
                mime_type: f.type || 'application/octet-stream',
                content_summary: extractedText
              })
            });
            results.push(resFile);
            continue;
          }
        }
        throw err;
      }
    }

    // Se autoAnalyze solicitado, dispara análise com IA após todos os arquivos estarem devidamente registrados
    let aiResult = null;
    if (autoAnalyze) {
      aiResult = await fetchJson<any>(`/projects/${projectId}/analyze`, {
        method: 'POST',
        body: JSON.stringify({})
      });
    }

    return { files: results, aiResult };
  },
  importProjectSpreadsheet: async (
    projectId: number | string,
    file: File | File[],
    userId?: number,
    mode: 'append' | 'replace' = 'append',
    onProgress?: (current: number, total: number, fileName: string) => void
  ) => {
    const fileList = Array.isArray(file) ? file : [file];
    if (fileList.length === 0) {
      throw new Error('Nenhum arquivo de planilha foi fornecido');
    }

    let lastResult: any = null;
    let totalItemsAdded = 0;
    const allSheets: string[] = [];
    const processedFilesInfo: any[] = [];

    // Envia cada planilha em requisição HTTP isolada e sequencial.
    // Isso evita estourar o limite de payload de 4.5MB da Vercel (HTTP 413 FUNCTION_PAYLOAD_TOO_LARGE).
    for (let i = 0; i < fileList.length; i++) {
      const currentFile = fileList[i];
      // O primeiro arquivo obedece ao modo escolhido ('replace' ou 'append').
      // Os arquivos seguintes usam sempre 'append' para acumular com o primeiro.
      const currentMode = (i === 0) ? mode : 'append';

      if (onProgress) {
        onProgress(i + 1, fileList.length, currentFile.name);
      }

      if (currentFile.size > 4.5 * 1024 * 1024) {
        throw new Error(
          `O arquivo "${currentFile.name}" possui ${(currentFile.size / (1024 * 1024)).toFixed(1)}MB, excedendo o limite de 4.5MB da Vercel. Por favor, remova abas desnecessárias ou divida a planilha.`
        );
      }

      const formData = new FormData();
      formData.append('files', currentFile);
      if (userId) formData.append('userId', String(userId));
      formData.append('mode', currentMode);

      const res = await fetch(`${API_BASE}/projects/${projectId}/import-spreadsheet`, {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        let errorMsg = `Erro ao importar planilha "${currentFile.name}"`;
        try {
          const err = await res.json();
          if (err.error) errorMsg = err.error;
        } catch (_) {
          if (res.status === 413) {
            errorMsg = `O arquivo "${currentFile.name}" (${(currentFile.size / (1024 * 1024)).toFixed(1)}MB) excedeu o limite máximo de requisição do servidor (HTTP 413).`;
          }
        }
        throw new Error(errorMsg);
      }

      const data = await res.json();
      lastResult = data;
      totalItemsAdded += data.itemsCount || 0;
      if (data.sheetsNames) {
        allSheets.push(...data.sheetsNames);
      }
      processedFilesInfo.push({
        filename: currentFile.name,
        itemsCount: data.itemsCount
      });
    }

    return {
      ...lastResult,
      totalFilesProcessed: fileList.length,
      processedFiles: processedFilesInfo,
      sheetsNames: Array.from(new Set(allSheets)),
      itemsCountTotalAdded: totalItemsAdded
    };
  },

  // IA
  analyzeProject: (projectId: number | string, customText?: string, userId?: number) =>
    fetchJson<any>(`/ai/analyze/${projectId}`, { method: 'POST', body: JSON.stringify({ customText, userId }) }),
  getAIMetrics: () => fetchJson<any>('/ai/metrics'),
  getProjectAnalyses: (projectId: number | string) => fetchJson<any[]>(`/ai/analyses/${projectId}`),

  // Orçamentos
  getBudget: (projectId: number | string) => fetchJson<any>(`/budgets/project/${projectId}`),
  saveBudget: (data: any) => fetchJson<any>('/budgets/save', { method: 'POST', body: JSON.stringify(data) }),
  approveBudget: (budgetId: number | string, userId?: number, userName?: string) =>
    fetchJson<any>(`/budgets/${budgetId}/approve`, { method: 'POST', body: JSON.stringify({ userId, userName }) }),
  sendBudgetToClient: (budgetId: number | string, userId?: number) =>
    fetchJson<any>(`/budgets/${budgetId}/send-to-client`, { method: 'POST', body: JSON.stringify({ userId }) }),

  // Materiais & Estoque
  getMaterials: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return fetchJson<any[]>(`/materials${qs}`);
  },
  autocompleteMaterials: (q: string) =>
    fetchJson<any[]>(`/materials/autocomplete?q=${encodeURIComponent(q)}`),
  getMaterialCategories: () => fetchJson<{ category: string; count: number }[]>('/materials/categories'),
  getMaterial: (id: number | string) => fetchJson<any>(`/materials/${id}`),
  createMaterial: (data: any) => fetchJson<any>('/materials', { method: 'POST', body: JSON.stringify(data) }),
  updateMaterial: (id: number | string, data: any) =>
    fetchJson<any>(`/materials/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  updateMaterialImage: (id: number | string, image_url: string) =>
    fetchJson<any>(`/materials/${id}/image`, { method: 'PATCH', body: JSON.stringify({ image_url }) }),
  quickStockEntry: (materialId: number, quantity: number, notes?: string, userId?: number) =>
    fetchJson<any>('/materials/quick-entry', { method: 'POST', body: JSON.stringify({ materialId, quantity, notes, userId }) }),
  getMaterialAliases: () => fetchJson<any[]>('/materials/aliases'),
  saveMaterialAliases: (mappings: Array<{ alias: string; materialId: number }>) =>
    fetchJson<any>('/materials/aliases', { method: 'POST', body: JSON.stringify({ mappings }) }),

  // Solicitações
  getRequests: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return fetchJson<any[]>(`/requests${qs}`);
  },
  createRequest: (data: any) => fetchJson<any>('/requests', { method: 'POST', body: JSON.stringify(data) }),
  updateRequestStatus: (id: number | string, status: string, notes?: string, userId?: number) =>
    fetchJson<any>(`/requests/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status, notes, userId }) }),
  approveExtraRequest: (requestId: number | string, userId?: number, notes?: string) =>
    fetchJson<any>(`/requests/${requestId}/approve-extra`, {
      method: 'POST',
      body: JSON.stringify({ userId, notes })
    }),
  rejectExtraRequest: (requestId: number | string, userId?: number, reason?: string) =>
    fetchJson<any>(`/requests/${requestId}/reject-extra`, {
      method: 'POST',
      body: JSON.stringify({ userId, reason })
    }),
  createMaterialSubstitution: (data: { requestItemId: number; requestId?: number; substituteMaterialId: number; quantity: number; reason: string; userId?: number }) =>
    fetchJson<any>('/requests/substitutions', { method: 'POST', body: JSON.stringify(data) }),
  getSubstitutions: () => fetchJson<any[]>('/requests/substitutions'),
  approveSubstitution: (id: number | string, userId?: number, notes?: string) =>
    fetchJson<any>(`/requests/substitutions/${id}/approve`, { method: 'POST', body: JSON.stringify({ userId, notes }) }),
  rejectSubstitution: (id: number | string, userId?: number, notes?: string) =>
    fetchJson<any>(`/requests/substitutions/${id}/reject`, { method: 'POST', body: JSON.stringify({ userId, notes }) }),
  deleteRequest: (id: number | string, userId?: number) =>
    fetchJson<any>(`/requests/${id}`, { method: 'DELETE', body: JSON.stringify({ userId }) }),

  // Compras
  getPurchases: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return fetchJson<any[]>(`/purchases${qs}`);
  },
  createPurchase: (data: any) => fetchJson<any>('/purchases', { method: 'POST', body: JSON.stringify(data) }),
  updatePurchase: (id: number | string, data: any) =>
    fetchJson<any>(`/purchases/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  receivePurchase: (id: number | string, userId?: number) =>
    fetchJson<any>(`/purchases/${id}/receive`, { method: 'POST', body: JSON.stringify({ userId }) }),

  // Devoluções
  getReturns: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return fetchJson<any[]>(`/returns${qs}`);
  },
  createReturn: (data: any) => fetchJson<any>('/returns', { method: 'POST', body: JSON.stringify(data) }),

  // Movimentações & Sumário
  getStockMovements: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return fetchJson<any[]>(`/stock/movements${qs}`);
  },
  getStockSummary: () => fetchJson<any>('/stock/summary'),

  // Fornecedores
  getSuppliers: (search?: string) => {
    const qs = search ? `?search=${encodeURIComponent(search)}` : '';
    return fetchJson<any[]>(`/suppliers${qs}`);
  },
  createSupplier: (data: any) => fetchJson<any>('/suppliers', { method: 'POST', body: JSON.stringify(data) }),
  updateSupplier: (id: number | string, data: any) =>
    fetchJson<any>(`/suppliers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  // Dashboards & Relatórios
  getDashboardOverview: () => fetchJson<any>('/dashboard/overview'),
  getDashboardOrcamento: () => fetchJson<any>('/dashboard/orcamento'),
  getDashboardAlmoxarifado: () => fetchJson<any>('/dashboard/almoxarifado'),
  getDashboardCompras: () => fetchJson<any>('/dashboard/compras'),
  getProjectReports: () => fetchJson<any[]>('/reports/projects'),
  getMaterialReports: () => fetchJson<any[]>('/reports/materials'),
  getPurchaseReports: () => fetchJson<any>('/reports/purchases'),
  getStockReports: () => fetchJson<any>('/reports/stock'),

  // Notificações & Auditoria
  getNotifications: (role?: string, userId?: number) => {
    const params = new URLSearchParams();
    if (role) params.set('role', role);
    if (userId) params.set('user_id', String(userId));
    return fetchJson<{ notifications: any[]; unreadCount: number }>(`/notifications?${params.toString()}`);
  },
  markNotificationRead: (id: number | string) =>
    fetchJson<any>(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllNotificationsRead: () =>
    fetchJson<any>('/notifications/read-all', { method: 'POST' }),
  getAuditLogs: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return fetchJson<any[]>(`/audit${qs}`);
  },

  // Busca Global
  globalSearch: (query: string) => fetchJson<any>(`/search?q=${encodeURIComponent(query)}`),

  // Carga em Massa & Base de IA
  downloadBulkTemplate: () => {
    window.location.href = `${API_BASE}/bulk-import/template`;
  },
  uploadBulkData: async (file: File, userId?: number) => {
    const formData = new FormData();
    formData.append('file', file);
    if (userId) formData.append('userId', String(userId));
    const res = await fetch(`${API_BASE}/bulk-import/upload`, {
      method: 'POST',
      body: formData
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Erro ao processar carga em massa' }));
      throw new Error(err.error || 'Erro ao processar carga em massa');
    }
    return res.json();
  },
  uploadBulkJson: (data: any) =>
    fetchJson<any>('/bulk-import/json', { method: 'POST', body: JSON.stringify(data) }),
  getBulkSummary: () => fetchJson<any>('/bulk-import/summary'),
  getAIAgentContext: () => fetchJson<any>('/ai/agent-context'),

  // Leitor de XML de NF-e
  previewNfeXml: async (file: File) => {
    const formData = new FormData();
    formData.append('xmlFile', file);
    const res = await fetch(`${API_BASE}/nfe/preview`, {
      method: 'POST',
      body: formData
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Erro ao processar XML da NF-e' }));
      throw new Error(err.error || 'Erro ao processar XML da NF-e');
    }
    return res.json();
  },
  confirmNfeXml: (data: any) =>
    fetchJson<any>('/nfe/confirm', { method: 'POST', body: JSON.stringify(data) }),

  // Calibração de IA por Documentos Reais (Projetos + Levantamento / Consumo Real)
  calibrateAIDocuments: async (files: File[], userId?: number) => {
    const formData = new FormData();
    for (const f of files) {
      formData.append('files', f);
    }
    if (userId) formData.append('userId', String(userId));
    const res = await fetch(`${API_BASE}/ai-calibration/upload`, {
      method: 'POST',
      body: formData
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Erro ao processar calibração da IA' }));
      throw new Error(err.error || 'Erro ao processar calibração da IA');
    }
    return res.json();
  },

  // Levantamento Especializado de Dutos (Metros e Quilogramas)
  analyzeDucts: (projectId: number, customText?: string) =>
    fetchJson<any>('/ducts/analyze', { method: 'POST', body: JSON.stringify({ projectId, customText }) }),
  getDuctAnalysis: (projectId: number) =>
    fetchJson<any>(`/ducts/project/${projectId}`),
  getAllDuctAnalyses: () =>
    fetchJson<any[]>('/ducts')
};
