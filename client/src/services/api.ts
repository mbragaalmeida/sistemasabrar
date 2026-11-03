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
  updateProjectScopeSummary: (id: number | string, scope_summary: string, userId?: number) =>
    fetchJson<any>(`/projects/${id}/scope-summary`, { method: 'PATCH', body: JSON.stringify({ scope_summary, userId }) }),
  markProjectLost: (id: number | string, reason: string, userId?: number, userName?: string) =>
    fetchJson<any>(`/projects/${id}/mark-lost`, { method: 'POST', body: JSON.stringify({ reason, userId, userName }) }),
  getProjectAddenda: (projectId: number | string) =>
    fetchJson<any[]>(`/projects/${projectId}/addenda`),
  createProjectAddendum: (projectId: number | string, data: any) =>
    fetchJson<any>(`/projects/${projectId}/addenda`, { method: 'POST', body: JSON.stringify(data) }),
  parseAddendumDocument: async (projectId: number | string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const token = typeof window !== 'undefined' ? localStorage.getItem('sabrar_token') : null;
    const res = await fetch(`${API_BASE}/projects/${projectId}/addenda/parse-document`, {
      method: 'POST',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      body: formData
    });
    if (!res.ok) {
      let errText = 'Erro ao processar documento';
      try {
        const j = await res.json();
        errText = j.error || errText;
      } catch {
        errText = await res.text();
      }
      throw new Error(errText);
    }
    return res.json();
  },
  deleteProjectAddendum: (projectId: number | string, addendumId: number | string) =>
    fetchJson<any>(`/projects/${projectId}/addenda/${addendumId}`, { method: 'DELETE' }),
  getLinkableProjects: (projectId: number | string, search?: string) =>
    fetchJson<any[]>(`/projects/${projectId}/linkable-projects${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  linkProjectAsAddendum: (projectId: number | string, data: { sourceProjectId: number; customTitle?: string; customDescription?: string; customDate?: string; userId?: number }) =>
    fetchJson<any>(`/projects/${projectId}/link-project-as-addendum`, { method: 'POST', body: JSON.stringify(data) }),
  getProjectFileDownloadUrl: (projectId: number | string, fileId: number | string) =>
    `/api/projects/${projectId}/files/${fileId}/download`,
  addProjectFile: (id: number | string, data: any) =>
    fetchJson<any>(`/projects/${id}/files`, { method: 'POST', body: JSON.stringify(data) }),
  uploadProjectFiles: async (projectId: number | string, files: File[], autoAnalyze?: boolean) => {
    const results = [];

    for (const f of files) {
      const isPdf = f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf');
      const isCad = f.name.toLowerCase().endsWith('.dwg') || f.name.toLowerCase().endsWith('.dxf');

      // Tenta upload físico do arquivo para o servidor via FormData (armazena em server/uploads)
      try {
        const formData = new FormData();
        formData.append('files', f);
        if (autoAnalyze) formData.append('autoAnalyze', 'true');
        const res = await fetch(`${API_BASE}/projects/${projectId}/upload`, {
          method: 'POST',
          body: formData
        });

        if (res.ok) {
          const data = await res.json();
          results.push(data);
          continue;
        }

        // Se Vercel rejeitar por tamanho (HTTP 413), executa contingência via resumo textual
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
  approveBudget: (budgetId: number | string, userId?: number, userName?: string, extra?: { scope_summary?: string }) =>
    fetchJson<any>(`/budgets/${budgetId}/approve`, { method: 'POST', body: JSON.stringify({ userId, userName, ...extra }) }),
  markBudgetLost: (budgetId: number | string, reason: string, userId?: number, userName?: string) =>
    fetchJson<any>(`/budgets/${budgetId}/mark-lost`, { method: 'POST', body: JSON.stringify({ reason, userId, userName }) }),
  getBudgetVersions: (projectId: number | string) =>
    fetchJson<any[]>(`/budgets/project/${projectId}/versions`),
  createBudgetVersion: (projectId: number | string, data: any) =>
    fetchJson<any>(`/budgets/project/${projectId}/versions`, { method: 'POST', body: JSON.stringify(data) }),
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
  updateMaterialAvailability: (id: number | string, availability_status: 'disponivel' | 'em_falta') =>
    fetchJson<any>(`/materials/${id}/availability`, { method: 'PATCH', body: JSON.stringify({ availability_status }) }),
  updateMaterialMinimumStock: (id: number | string, stock_minimum: number, userId?: number) =>
    fetchJson<any>(`/materials/${id}/minimum-stock`, { method: 'PATCH', body: JSON.stringify({ stock_minimum, userId }) }),
  quickStockEntry: (materialId: number, quantity: number, notes?: string, userId?: number) =>
    fetchJson<any>('/materials/quick-entry', { method: 'POST', body: JSON.stringify({ materialId, quantity, notes, userId }) }),
  getMaterialAliases: () => fetchJson<any[]>('/materials/aliases'),
  saveMaterialAliases: (mappings: Array<{ alias: string; materialId: number }>) =>
    fetchJson<any>('/materials/aliases', { method: 'POST', body: JSON.stringify({ mappings }) }),
  getStockAdjustments: (status?: string) => {
    const qs = status ? `?status=${encodeURIComponent(status)}` : '';
    return fetchJson<any[]>(`/stock/adjustments${qs}`);
  },
  requestStockAdjustment: (data: { material_id: number; requested_stock: number; reason: string; user_id?: number }) =>
    fetchJson<any>('/stock/adjustments', { method: 'POST', body: JSON.stringify(data) }),
  approveStockAdjustment: (id: number | string, user_id?: number, notes?: string) =>
    fetchJson<any>(`/stock/adjustments/${id}/approve`, { method: 'POST', body: JSON.stringify({ user_id, notes }) }),
  rejectStockAdjustment: (id: number | string, user_id?: number, notes?: string) =>
    fetchJson<any>(`/stock/adjustments/${id}/reject`, { method: 'POST', body: JSON.stringify({ user_id, notes }) }),

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
  createMaterialSubstitution: (data: {
    requestItemId: number;
    requestId?: number;
    substituteMaterialId?: number | null;
    substituteCustomName?: string | null;
    quantity: number;
    substituteUnit?: string;
    reason: string;
    userId?: number;
  }) => fetchJson<any>('/requests/substitutions', { method: 'POST', body: JSON.stringify(data) }),
  getSubstitutions: () => fetchJson<any[]>('/requests/substitutions'),
  approveSubstitution: (id: number | string, userId?: number, notes?: string) =>
    fetchJson<any>(`/requests/substitutions/${id}/approve`, { method: 'POST', body: JSON.stringify({ userId, notes }) }),
  rejectSubstitution: (id: number | string, userId?: number, notes?: string) =>
    fetchJson<any>(`/requests/substitutions/${id}/reject`, { method: 'POST', body: JSON.stringify({ userId, notes }) }),
  createQuantityChange: (data: { requestItemId: number; requestId?: number; newQuantity: number; reason: string; userId?: number }) =>
    fetchJson<any>('/requests/quantity-changes', { method: 'POST', body: JSON.stringify(data) }),
  getQuantityChanges: () => fetchJson<any[]>('/requests/quantity-changes'),
  approveQuantityChange: (id: number | string, userId?: number, notes?: string) =>
    fetchJson<any>(`/requests/quantity-changes/${id}/approve`, { method: 'POST', body: JSON.stringify({ userId, notes }) }),
  rejectQuantityChange: (id: number | string, userId?: number, notes?: string) =>
    fetchJson<any>(`/requests/quantity-changes/${id}/reject`, { method: 'POST', body: JSON.stringify({ userId, notes }) }),
  updateRequestItemAvailability: (itemId: number | string, status: 'disponivel' | 'em_falta', userId?: number) =>
    fetchJson<any>(`/requests/items/${itemId}/availability`, { method: 'PATCH', body: JSON.stringify({ status, userId }) }),
  cancelRequestItem: (itemId: number | string, reason: string, userId?: number) =>
    fetchJson<any>(`/requests/items/${itemId}/cancel`, { method: 'PATCH', body: JSON.stringify({ reason, userId }) }),
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
  deleteSupplier: (id: number | string, userId?: number | string) =>
    fetchJson<any>(`/suppliers/${id}${userId ? `?userId=${userId}` : ''}`, { method: 'DELETE' }),

  // Item 6: Clientes (no mesmo molde dos Fornecedores)
  getClients: (search?: string, recurrent?: boolean) => {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (recurrent !== undefined) params.append('recurrent', String(recurrent));
    const qs = params.toString() ? `?${params.toString()}` : '';
    return fetchJson<any[]>(`/clients${qs}`);
  },
  getClient: (id: number | string) => fetchJson<any>(`/clients/${id}`),
  createClient: (data: any) => fetchJson<any>('/clients', { method: 'POST', body: JSON.stringify(data) }),
  updateClient: (id: number | string, data: any) =>
    fetchJson<any>(`/clients/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteClient: (id: number | string, userId?: number | string) =>
    fetchJson<any>(`/clients/${id}${userId ? `?userId=${userId}` : ''}`, { method: 'DELETE' }),

  // Item 11 & Item 15: Upload e Extração de PDF do Fornecedor / Exportação de OC
  parseSupplierPdf: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const token = typeof window !== 'undefined' ? localStorage.getItem('sabrar_token') : null;
    const authHeaders: Record<string, string> = {};
    if (token) authHeaders['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}/purchases/parse-supplier-pdf`, {
      method: 'POST',
      headers: authHeaders,
      body: formData
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Erro ao processar PDF' }));
      throw new Error(err.error || 'Falha ao processar PDF do fornecedor');
    }
    return res.json();
  },
  exportCustomOC: async (data: any) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('sabrar_token') : null;
    const authHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) authHeaders['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}/purchases/export-custom-oc`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      throw new Error('Falha ao exportar Ordem de Compra');
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Ordem_de_Compra_${(data.supplierName || 'Fornecedor').replace(/\s+/g, '_')}_${Date.now()}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    return true;
  },

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
    fetchJson<any[]>('/ducts'),

  // 1. Transferência de Materiais entre Obras (Fase 1)
  getTransfers: () => fetchJson<any[]>('/transfers'),
  getReservedByProject: () => fetchJson<any[]>('/transfers/reserved-by-project'),
  createTransfer: (data: any) =>
    fetchJson<any>('/transfers', { method: 'POST', body: JSON.stringify(data) }),
  repayTransfer: (id: number, data: any) =>
    fetchJson<any>(`/transfers/${id}/repay`, { method: 'POST', body: JSON.stringify(data) }),

  // 2. Cotações e Mapa de Comparação de Preços (Fase 2 - Prints 1 e 2)
  getQuotations: () => fetchJson<any[]>('/quotations'),
  getQuotationById: (id: number) => fetchJson<any>(`/quotations/${id}`),
  createQuotation: (data: any) =>
    fetchJson<any>('/quotations', { method: 'POST', body: JSON.stringify(data) }),
  addQuotationItem: (quotationId: number, data: any) =>
    fetchJson<any>(`/quotations/${quotationId}/items`, { method: 'POST', body: JSON.stringify(data) }),
  updateQuotationItem: (quotationId: number, itemId: number, data: any) =>
    fetchJson<any>(`/quotations/${quotationId}/items/${itemId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteQuotationItem: (quotationId: number, itemId: number) =>
    fetchJson<any>(`/quotations/${quotationId}/items/${itemId}`, { method: 'DELETE' }),
  addQuotationSupplier: (quotationId: number, data: any) =>
    fetchJson<any>(`/quotations/${quotationId}/suppliers`, { method: 'POST', body: JSON.stringify(data) }),
  updateQuotationSupplier: (quotationId: number, supplierId: number, data: any) =>
    fetchJson<any>(`/quotations/${quotationId}/suppliers/${supplierId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteQuotationSupplier: (quotationId: number, supplierId: number) =>
    fetchJson<any>(`/quotations/${quotationId}/suppliers/${supplierId}`, { method: 'DELETE' }),
  setQuotationWinner: (quotationId: number, quotationSupplierId: number) =>
    fetchJson<any>(`/quotations/${quotationId}/winner`, { method: 'PATCH', body: JSON.stringify({ quotationSupplierId }) }),
  getPriceIntelligence: (materialId: number) =>
    fetchJson<any>(`/materials/${materialId}/price-intelligence`),
  approvePurchase: (purchaseId: number, data: { approval_status: string; userId?: number; rejection_notes?: string }) =>
    fetchJson<any>(`/purchases/${purchaseId}/approval`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Item 4: Acompanhamento de Prazos em Risco (Compras de Itens Específicos por Obra)
  getTrackedDeadlines: () => fetchJson<any[]>('/purchases/tracked-deadlines'),
  createTrackedDeadline: (data: any) =>
    fetchJson<any>('/purchases/tracked-deadlines', { method: 'POST', body: JSON.stringify(data) }),
  updateTrackedDeadline: (id: number, data: any) =>
    fetchJson<any>(`/purchases/tracked-deadlines/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTrackedDeadline: (id: number) =>
    fetchJson<any>(`/purchases/tracked-deadlines/${id}`, { method: 'DELETE' }),

  // 3. Checklist de Recebimento de Materiais (Fase 3 - Print 3)
  getReceivingChecklists: () => fetchJson<any[]>('/receiving-checklists'),
  getReceivingChecklistById: (id: number) => fetchJson<any>(`/receiving-checklists/${id}`),
  createReceivingChecklist: (data: any) =>
    fetchJson<any>('/receiving-checklists', { method: 'POST', body: JSON.stringify(data) }),
  updateReceivingChecklistItems: (id: number, items: any[]) =>
    fetchJson<any>(`/receiving-checklists/${id}/items`, { method: 'PUT', body: JSON.stringify({ items }) }),
  finalizeReceivingChecklist: (id: number, userId?: number) =>
    fetchJson<any>(`/receiving-checklists/${id}/finalize`, { method: 'POST', body: JSON.stringify({ userId }) }),

  // 4. Faturamento Direto e Compras Online (Fase 4 - Print 4)
  getDirectBillings: () => fetchJson<any[]>('/direct-billings'),
  createDirectBilling: (data: any) =>
    fetchJson<any>('/direct-billings', { method: 'POST', body: JSON.stringify(data) }),
  toggleDirectBillingStep: (id: number, stepName: string, value: boolean) =>
    fetchJson<any>(`/direct-billings/${id}/step`, { method: 'PATCH', body: JSON.stringify({ stepName, value }) }),
  getWebPurchases: () => fetchJson<any[]>('/direct-billings/web-purchases'),
  createWebPurchase: (data: any) =>
    fetchJson<any>('/direct-billings/web-purchases', { method: 'POST', body: JSON.stringify(data) }),

  // 5. Dashboard Executivo de Compras & Estoque - BI (Fase 5 - Print 5)
  getPurchasesStockBIDashboard: (params?: { projectId?: string; category?: string; startDate?: string; endDate?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return fetchJson<any>(`/reports/purchases-stock-bi${query ? `?${query}` : ''}`);
  },

  // 6. Controle de Custos por Obra - Orçado x Realizado (Fase 6)
  getProjectCostControl: (projectId: number) =>
    fetchJson<any>(`/cost-control/projects/${projectId}`),
  addProjectExtraCost: (projectId: number, data: any) =>
    fetchJson<any>(`/cost-control/projects/${projectId}/costs`, { method: 'POST', body: JSON.stringify(data) }),
  deleteProjectExtraCost: (costId: number) =>
    fetchJson<any>(`/cost-control/costs/${costId}`, { method: 'DELETE' }),

  // 7. Autodesk CAMduct & Gestão de Dutos (Pilar 3 do Fluxo HVAC)
  getDuctsProjectSummary: (projectId: number) =>
    fetchJson<any>(`/ducts/summary/${projectId}`),
  getDuctDeliveryNotes: (params?: { projectId?: number; status?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return fetchJson<any[]>(`/ducts/delivery-notes${query ? `?${query}` : ''}`);
  },
  createDuctDeliveryNote: (data: any) =>
    fetchJson<any>('/ducts/delivery-note', { method: 'POST', body: JSON.stringify(data) }),
  approveDuctExcess: (noteId: number, data: { userId: number; userName: string; approved: boolean; approvalReason?: string }) =>
    fetchJson<any>(`/ducts/delivery-note/${noteId}/approve-excess`, { method: 'PATCH', body: JSON.stringify(data) }),
  updateDuctStatus: (noteId: number, data: { status: string; userId?: number; userName?: string }) =>
    fetchJson<any>(`/ducts/delivery-note/${noteId}/status`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Solicitações de Dutos pelos Engenheiros
  getDuctRequests: (params?: { projectId?: number; status?: string; requested_by?: number }) => {
    const query = new URLSearchParams(params as any).toString();
    return fetchJson<any[]>(`/ducts/requests${query ? `?${query}` : ''}`);
  },
  createDuctRequest: (data: { projectId: number; items: any[]; priority?: string; notes?: string; requestedBy?: number }) =>
    fetchJson<any>('/ducts/requests', { method: 'POST', body: JSON.stringify(data) }),
  updateDuctRequestStatus: (requestId: number, data: { status: string; userId?: number; userName?: string } | string, notes?: string) => {
    const payload = typeof data === 'string' ? { status: data, notes } : data;
    return fetchJson<any>(`/ducts/requests/${requestId}/status`, { method: 'PATCH', body: JSON.stringify(payload) });
  },

  // 8. Logística, Frotas, Agenda e Romaneios Parciais (Pilar 4 do Fluxo HVAC)
  getLogisticsAvailableItems: (projectId: number) =>
    fetchJson<any>(`/logistics/available-items/${projectId}`),
  getLogisticsReadyItems: (projectId: number) =>
    fetchJson<any>(`/logistics/ready-items/${projectId}`),
  createLogisticsRequest: (data: any) =>
    fetchJson<any>('/logistics/requests', { method: 'POST', body: JSON.stringify(data) }),
  getLogisticsRequests: (params?: { projectId?: number; status?: string; requestedBy?: number }) => {
    const query = new URLSearchParams(params as any).toString();
    return fetchJson<any[]>(`/logistics/requests${query ? `?${query}` : ''}`);
  },
  updateLogisticsRequestStatus: (requestId: number, data: { status: string; tripId?: number; userId?: number; userName?: string } | string) => {
    const payload = typeof data === 'string' ? { status: data } : data;
    return fetchJson<any>(`/logistics/requests/${requestId}/status`, { method: 'PATCH', body: JSON.stringify(payload) });
  },

  getLogisticsTrips: (params?: { startDate?: string; endDate?: string; projectId?: number; status?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return fetchJson<any[]>(`/logistics/trips${query ? `?${query}` : ''}`);
  },
  getLogisticsTripDetails: (tripId: number) =>
    fetchJson<any>(`/logistics/trips/${tripId}`),
  createLogisticsTrip: (data: any) =>
    fetchJson<any>('/logistics/trips', { method: 'POST', body: JSON.stringify(data) }),
  approveLogisticsTripException: (tripId: number, data: { userId: number; userName: string; approved: boolean; reason?: string }) =>
    fetchJson<any>(`/logistics/trips/${tripId}/approve-exception`, { method: 'PATCH', body: JSON.stringify(data) }),
  signLogisticsLoadingChecklist: (tripId: number, data: { driverName: string; notes?: string; vehiclePlate?: string }) =>
    fetchJson<any>(`/logistics/trips/${tripId}/checklist-loading`, { method: 'PATCH', body: JSON.stringify(data) }),
  confirmLogisticsDeliveryChecklist: (tripId: number, data: { engineerId: number; engineerName: string; itemsDelivered: any[]; notes?: string; photoUrl?: string }) =>
    fetchJson<any>(`/logistics/trips/${tripId}/checklist-delivery`, { method: 'PATCH', body: JSON.stringify(data) }),
  getLogisticsAiRoutePlan: (data: { date: string; tripIds?: number[] }) =>
    fetchJson<any>('/logistics/ai-route-plan', { method: 'POST', body: JSON.stringify(data) }),

  // 9. Exportação de Ordem de Compra (OC) em Excel editável
  exportQuotationOCUrl: (quotationId: number, supplierId?: number, userId?: number) => {
    const params = new URLSearchParams();
    if (supplierId) params.append('supplierId', String(supplierId));
    if (userId) params.append('userId', String(userId));
    return `/api/quotations/${quotationId}/export-oc?${params.toString()}`;
  },
  exportPurchasesOCUrl: (options: number[] | { purchaseIds?: number[]; projectId?: number; requestCode?: string }, userId?: number) => {
    const params = new URLSearchParams();
    if (Array.isArray(options)) {
      params.append('purchaseIds', options.join(','));
    } else if (options) {
      if (options.purchaseIds && options.purchaseIds.length > 0) {
        params.append('purchaseIds', options.purchaseIds.join(','));
      }
      if (options.projectId) {
        params.append('projectId', String(options.projectId));
      }
      if (options.requestCode) {
        params.append('requestCode', options.requestCode);
      }
    }
    if (userId) params.append('userId', String(userId));
    return `/api/purchases/export-oc?${params.toString()}`;
  }
};
