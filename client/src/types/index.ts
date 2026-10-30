export type UserRole = 'admin' | 'orcamento' | 'engenharia' | 'almoxarifado' | 'compras' | 'orcamento_engenharia' | 'compras_solicitacoes';

export interface Role {
  id: number;
  name: string;
  label: string;
  description?: string;
}

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  role_label: string;
  department?: string;
  phone?: string;
  avatar?: string;
}

export type ProjectStatus = 
  | 'Novo'
  | 'Em análise pela IA'
  | 'Orçamento gerado'
  | 'Em revisão'
  | 'Orçamento finalizado'
  | 'Enviado ao cliente'
  | 'Aguardando aprovação'
  | 'Aprovado'
  | 'Em execução'
  | 'Finalizado'
  | 'Concluído'
  | 'Concluída'
  | 'Não aprovado'
  | 'Perdido'
  | 'Orçamento Perdido'
  | 'Cancelado';

export interface Project {
  id: number;
  code: string;
  name: string;
  client: string;
  client_email?: string;
  client_phone?: string;
  address: string;
  city?: string;
  state?: string;
  project_type: 'Comercial' | 'Residencial' | 'Industrial' | 'Reforma' | 'Infraestrutura';
  start_date?: string;
  expected_end_date?: string;
  return_deadline?: string | null;
  responsible_engineer?: string | null;
  responsible_estimator?: string | null;
  scope_summary?: string | null;
  assigned_engineers?: Array<{ id: number; name: string; email: string; phone?: string; avatar?: string }>;
  assigned_engineer_ids?: number[];
  notes?: string;
  status: ProjectStatus;
  total_budget_materials: number;
  total_budget_services: number;
  total_budget_additional: number;
  total_budget_final: number;
  fileCount?: number;
  requestCount?: number;
  budget?: {
    id: number;
    code: string;
    status: string;
    total_final: number;
  };
  created_at: string;
  updated_at: string;
}

export interface ProjectFile {
  id: number;
  project_id: number;
  type: 'PROJETO_TECNICO' | 'MEMORIAL_DESCRITIVO' | 'PLANILHA' | 'OUTRO';
  original_name: string;
  file_path: string;
  file_size: number;
  mime_type?: string;
  content_summary?: string;
  created_at: string;
}

export interface Material {
  id: number;
  code: string;
  name: string;
  description?: string;
  category: string;
  unit: string;
  brand?: string;
  reference_price: number;
  synonyms?: string;
  image_url?: string;
  linear_weight?: number;
  linear_weight_unit?: string;
  package_content?: number;
  converted_unit?: string;
  converted_price?: number;
  validation_status?: 'OK' | 'VALIDAR';
  pending_notes?: string;
  supplier_id?: number;
  supplier_name?: string;
  stock_physical: number;
  stock_reserved: number;
  stock_available: number;
  stock_minimum: number;
  status: 'Ativo' | 'Inativo';
  availability_status?: 'disponivel' | 'em_falta';
  isBelowMinimum?: boolean;
  isCritical?: boolean;
}

export interface StockMovement {
  id: number;
  material_id: number;
  material_name?: string;
  material_code?: string;
  material_unit?: string;
  type: 'ENTRADA' | 'SAIDA_OBRA' | 'RESERVA' | 'CANCELAMENTO_RESERVA' | 'DEVOLUCAO';
  quantity: number;
  previous_stock: number;
  new_stock: number;
  project_id?: number;
  project_name?: string;
  project_code?: string;
  reference_id?: number;
  user_name?: string;
  notes?: string;
  created_at: string;
}

export interface MaterialRequest {
  id: number;
  code: string;
  project_id: number;
  project_name?: string;
  project_code?: string;
  responsible_engineer?: string | null;
  requested_by: number;
  requested_by_name?: string;
  priority: 'Baixa' | 'Média' | 'Alta' | 'Urgente';
  status: 'Solicitado' | 'Reservado' | 'Em separação' | 'Separado' | 'Entregue' | 'Cancelado' | 'Parcialmente Atendido' | 'Aguardando aprovação';
  requires_admin_approval?: boolean;
  admin_approval_status?: 'Pendente' | 'Aprovado' | 'Rejeitado';
  admin_approved_by?: number;
  admin_approved_by_name?: string;
  admin_approved_at?: string;
  admin_approval_notes?: string;
  has_extra_items?: boolean;
  pickup_date?: string;
  notes?: string;
  items?: MaterialRequestItem[];
  created_at: string;
  updated_at: string;
}

export interface MaterialRequestItem {
  id: number;
  request_id: number;
  material_id: number;
  material_name?: string;
  material_code?: string;
  material_unit?: string;
  quantity_requested: number;
  quantity_reserved: number;
  quantity_delivered: number;
  deficit: number;
  is_extra?: boolean;
  image_url?: string;
  budget_quantity?: number;
  previously_requested?: number;
  extra_quantity?: number;
  availability_status?: 'disponivel' | 'em_falta';
  item_status?: 'Ativo' | 'Cancelado';
  cancellation_reason?: string;
  cancelled_by?: number;
  cancelled_at?: string;
}

export interface MaterialQuota {
  budgetItemId?: number;
  materialId: number;
  materialName: string;
  materialCode: string;
  unit: string;
  unitPrice: number;
  budgetQuantity: number;
  previouslyRequested: number;
  remainingQuota: number;
  physicalStock: number;
  reservedStock: number;
  availableStock: number;
}

export interface Purchase {
  id: number;
  code: string;
  project_id?: number;
  project_name?: string;
  project_code?: string;
  material_id: number;
  material_name: string;
  material_code: string;
  material_unit: string;
  quantity: number;
  supplier_id?: number;
  supplier_name?: string;
  unit_price: number;
  total_price: number;
  status: 'Solicitado' | 'Em cotação' | 'Aguardando aprovação' | 'Comprado' | 'Aguardando entrega' | 'Recebido' | 'Cancelado';
  priority: 'Baixa' | 'Média' | 'Alta' | 'Urgente';
  purchase_date?: string;
  expected_delivery_date?: string;
  received_date?: string;
  buyer_name?: string;
  notes?: string;
  request_id?: number;
  request_code?: string;
  request_created_at?: string;
  requester_name?: string;
  created_at: string;
}

export interface StockAdjustment {
  id: number;
  material_id: number;
  material_name?: string;
  material_code?: string;
  material_unit?: string;
  previous_stock: number;
  requested_stock: number;
  difference: number;
  reason: string;
  requested_by?: number;
  requested_by_name?: string;
  status: 'Pendente' | 'Aprovado' | 'Rejeitado';
  reviewed_by?: number;
  reviewed_by_name?: string;
  reviewed_at?: string;
  review_notes?: string;
  created_at: string;
}

export interface ReturnItem {
  id: number;
  code: string;
  project_id: number;
  project_name?: string;
  material_id: number;
  material_name: string;
  material_code: string;
  material_unit: string;
  quantity: number;
  received_by_name?: string;
  reason?: string;
  created_at: string;
}

export interface Budget {
  id: number;
  project_id: number;
  code: string;
  status: string;
  total_materials: number;
  total_services: number;
  total_labor: number;
  total_equipment: number;
  total_logistics: number;
  total_taxes: number;
  total_additional: number;
  total_final: number;
  validity_days: number;
  commercial_terms?: string;
  materials_margin_percent?: number;
  labor_margin_percent?: number;
  approved_by?: number;
  approved_at?: string;
  items?: BudgetItem[];
  services?: ServiceItem[];
  equipment?: BudgetEquipmentItem[];
}

export interface BudgetEquipmentItem {
  id?: number;
  budget_id?: number;
  category?: string;
  description: string;
  brand?: string;
  model?: string;
  quantity: number;
  unit: string;
  unit_price: number;
  subtotal: number;
  notes?: string;
}

export interface BudgetItem {
  id?: number;
  budget_id?: number;
  material_id?: number;
  material_name: string;
  material_code?: string;
  quantity: number;
  unit: string;
  unit_price: number;
  subtotal: number;
  ai_suggested_quantity?: number;
  ai_reasoning?: string;
  human_notes?: string;
}

export interface ServiceItem {
  id?: number;
  budget_id?: number;
  category: 'MÃO DE OBRA' | 'SERVIÇO ESPECIALIZADO' | 'EQUIPAMENTO' | 'LOGÍSTICA' | 'IMPOSTOS' | 'OUTROS';
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  subtotal: number;
  notes?: string;
}

export interface ComparisonRow {
  materialId: number;
  materialName: string;
  materialCode?: string;
  unit: string;
  aiPredicted: number;
  budgetApproved: number;
  requested: number;
  withdrawn: number;
  returned: number;
  actualConsumed: number;
  varianceUnits: number;
  variancePercent: number;
}

export interface Supplier {
  id: number;
  name: string;
  corporate_name?: string;
  cnpj?: string;
  category?: string;
  categories?: string[] | string;
  contact_person?: string;
  phone?: string;
  email?: string;
  materials_supplied?: string;
  notes?: string;
  contacts?: Array<{ name: string; email?: string; phone?: string; role?: string }>;
}

export interface Client {
  id: number;
  name: string;
  corporate_name?: string;
  cnpj_cpf?: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  segment?: string;
  is_recurrent: boolean;
  notes?: string;
  rating?: number;
  created_at?: string;
  updated_at?: string;
}

export interface ProjectAddendum {
  id: number;
  project_id: number;
  number: number;
  title: string;
  description: string;
  date: string;
  total_materials: number;
  total_services: number;
  total_final: number;
  items?: any[];
  services?: any[];
  files?: any[];
  created_by?: number;
  created_at: string;
}

export interface BudgetVersion {
  id: number;
  budget_id?: number;
  project_id: number;
  version_number: number;
  justification: string;
  change_type: string;
  total_materials: number;
  total_services: number;
  total_equipment: number;
  total_final: number;
  discount_amount: number;
  items_snapshot?: any[];
  services_snapshot?: any[];
  equipment_snapshot?: any[];
  notes?: string;
  created_by?: number;
  created_by_name?: string;
  created_at: string;
}

export interface Notification {
  id: number;
  role_target?: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'urgent';
  link?: string;
  is_read: number;
  created_at: string;
}

export interface AuditLog {
  id: number;
  user_name?: string;
  action: string;
  entity_type: string;
  entity_id?: number;
  project_id?: number;
  project_name?: string;
  old_value?: string;
  new_value?: string;
  details: string;
  created_at: string;
}

export interface AISuggestion {
  materialId?: number;
  material: string;
  materialCode?: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  subtotal: number;
  reason: string;
  confidence?: number;
}

export interface AIAnalysisResult {
  analysisId: number;
  projectId: number;
  projectName: string;
  totalEstimatedMaterialsCost: number;
  materials: AISuggestion[];
}
