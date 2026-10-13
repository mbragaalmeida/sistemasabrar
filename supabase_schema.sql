-- ==============================================================================
-- SISTEMA SABRAR — ESQUEMA OFICIAL DO BANCO DE DADOS POSTGRESQL (SUPABASE)
-- Execute este script no SQL Editor do Supabase (https://supabase.com/dashboard)
-- ==============================================================================

-- 1. Perfis de Acesso
CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  label VARCHAR(100) NOT NULL,
  description TEXT
);

-- 2. Usuários
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role_id INTEGER NOT NULL REFERENCES roles(id),
  department VARCHAR(100),
  phone VARCHAR(50),
  avatar TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Fornecedores
CREATE TABLE IF NOT EXISTS suppliers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  corporate_name VARCHAR(200),
  cnpj VARCHAR(30),
  contact_person VARCHAR(100),
  phone VARCHAR(50),
  email VARCHAR(150),
  materials_supplied TEXT,
  notes TEXT,
  rating NUMERIC(3, 1) DEFAULT 5.0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Base Central de Materiais
CREATE TABLE IF NOT EXISTS materials (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100) NOT NULL,
  unit VARCHAR(100) NOT NULL,
  brand VARCHAR(100),
  reference_price NUMERIC(14, 4) NOT NULL DEFAULT 0.0000,
  synonyms TEXT,
  image_url TEXT,
  linear_weight NUMERIC(10, 4),
  linear_weight_unit VARCHAR(20),
  package_content NUMERIC(14, 4),
  converted_unit VARCHAR(50),
  converted_price NUMERIC(14, 4),
  validation_status VARCHAR(50) DEFAULT 'OK',
  pending_notes TEXT,
  supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
  stock_physical NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  stock_reserved NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  stock_minimum NUMERIC(14, 2) NOT NULL DEFAULT 10.00,
  status VARCHAR(30) NOT NULL DEFAULT 'Ativo',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- 5. Projetos / Obras
CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(200) NOT NULL,
  client VARCHAR(200) NOT NULL,
  client_email VARCHAR(150),
  client_phone VARCHAR(50),
  address TEXT NOT NULL,
  city VARCHAR(100),
  state VARCHAR(50),
  project_type VARCHAR(100) NOT NULL,
  start_date DATE,
  expected_end_date DATE,
  responsible_engineer VARCHAR(150) NOT NULL,
  notes TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'Novo',
  total_budget_materials NUMERIC(14, 2) DEFAULT 0.00,
  total_budget_services NUMERIC(14, 2) DEFAULT 0.00,
  total_budget_additional NUMERIC(14, 2) DEFAULT 0.00,
  total_budget_final NUMERIC(14, 2) DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Arquivos dos Projetos (Plantas, Memoriais, etc.)
CREATE TABLE IF NOT EXISTS project_files (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  mime_type VARCHAR(100),
  content_summary TEXT,
  uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Análises da IA
CREATE TABLE IF NOT EXISTS ai_analyses (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  analyzed_documents TEXT,
  confidence_score NUMERIC(5, 2) DEFAULT 90.00,
  historical_factors_applied TEXT,
  summary TEXT,
  raw_extracted_data TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Sugestões de Materiais geradas pela IA
CREATE TABLE IF NOT EXISTS ai_suggestions (
  id SERIAL PRIMARY KEY,
  analysis_id INTEGER NOT NULL REFERENCES ai_analyses(id) ON DELETE CASCADE,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  material_id INTEGER REFERENCES materials(id) ON DELETE SET NULL,
  material_name VARCHAR(255) NOT NULL,
  suggested_quantity NUMERIC(14, 2) NOT NULL,
  unit VARCHAR(20) NOT NULL,
  unit_price NUMERIC(14, 2) NOT NULL,
  subtotal NUMERIC(14, 2) NOT NULL,
  reasoning TEXT,
  confidence NUMERIC(5, 2) DEFAULT 95.00,
  status VARCHAR(50) DEFAULT 'Pendente',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Orçamentos
CREATE TABLE IF NOT EXISTS budgets (
  id SERIAL PRIMARY KEY,
  project_id INTEGER UNIQUE NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  code VARCHAR(50) UNIQUE NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'Em elaboração',
  total_materials NUMERIC(14, 2) DEFAULT 0.00,
  total_services NUMERIC(14, 2) DEFAULT 0.00,
  total_labor NUMERIC(14, 2) DEFAULT 0.00,
  total_equipment NUMERIC(14, 2) DEFAULT 0.00,
  total_logistics NUMERIC(14, 2) DEFAULT 0.00,
  total_taxes NUMERIC(14, 2) DEFAULT 0.00,
  total_additional NUMERIC(14, 2) DEFAULT 0.00,
  total_final NUMERIC(14, 2) DEFAULT 0.00,
  validity_days INTEGER DEFAULT 15,
  commercial_terms TEXT,
  approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  sent_to_client_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Itens de Materiais do Orçamento
CREATE TABLE IF NOT EXISTS budget_items (
  id SERIAL PRIMARY KEY,
  budget_id INTEGER NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  material_id INTEGER REFERENCES materials(id) ON DELETE SET NULL,
  material_name VARCHAR(255) NOT NULL,
  quantity NUMERIC(14, 2) NOT NULL,
  unit VARCHAR(20) NOT NULL,
  unit_price NUMERIC(14, 2) NOT NULL,
  subtotal NUMERIC(14, 2) NOT NULL,
  ai_suggested_quantity NUMERIC(14, 2),
  ai_reasoning TEXT,
  human_notes TEXT,
  original_spreadsheet_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Serviços e Custos Complementares
CREATE TABLE IF NOT EXISTS services (
  id SERIAL PRIMARY KEY,
  budget_id INTEGER NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  category VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  quantity NUMERIC(14, 2) DEFAULT 1.00,
  unit VARCHAR(20) DEFAULT 'vb',
  unit_price NUMERIC(14, 2) NOT NULL,
  subtotal NUMERIC(14, 2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Movimentações de Estoque
CREATE TABLE IF NOT EXISTS stock_movements (
  id SERIAL PRIMARY KEY,
  material_id INTEGER NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  quantity NUMERIC(14, 2) NOT NULL,
  previous_stock NUMERIC(14, 2) NOT NULL,
  new_stock NUMERIC(14, 2) NOT NULL,
  project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
  reference_id INTEGER,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. Solicitações de Materiais
CREATE TABLE IF NOT EXISTS material_requests (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  requested_by INTEGER NOT NULL REFERENCES users(id),
  priority VARCHAR(30) NOT NULL DEFAULT 'Média',
  status VARCHAR(50) NOT NULL DEFAULT 'Solicitado',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. Itens da Solicitação de Material
CREATE TABLE IF NOT EXISTS material_request_items (
  id SERIAL PRIMARY KEY,
  request_id INTEGER NOT NULL REFERENCES material_requests(id) ON DELETE CASCADE,
  material_id INTEGER NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  quantity_requested NUMERIC(14, 2) NOT NULL,
  quantity_reserved NUMERIC(14, 2) DEFAULT 0.00,
  quantity_delivered NUMERIC(14, 2) DEFAULT 0.00,
  deficit NUMERIC(14, 2) DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15. Compras / Cotações
CREATE TABLE IF NOT EXISTS purchases (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
  request_item_id INTEGER REFERENCES material_request_items(id) ON DELETE SET NULL,
  material_id INTEGER NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  quantity NUMERIC(14, 2) NOT NULL,
  supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
  unit_price NUMERIC(14, 2) DEFAULT 0.00,
  total_price NUMERIC(14, 2) DEFAULT 0.00,
  status VARCHAR(50) NOT NULL DEFAULT 'Solicitado',
  priority VARCHAR(30) DEFAULT 'Média',
  purchase_date DATE,
  expected_delivery_date DATE,
  received_date DATE,
  buyer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 16. Devoluções de Materiais
CREATE TABLE IF NOT EXISTS returns (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  material_id INTEGER NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  quantity NUMERIC(14, 2) NOT NULL,
  received_by INTEGER NOT NULL REFERENCES users(id),
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 17. Histórico de Consumo e Base de Aprendizado da IA
CREATE TABLE IF NOT EXISTS historical_usage (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  material_id INTEGER NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  project_type VARCHAR(100) NOT NULL,
  project_size_sqm NUMERIC(14, 2),
  ai_suggested_qty NUMERIC(14, 2) NOT NULL,
  human_approved_qty NUMERIC(14, 2) NOT NULL,
  total_requested_qty NUMERIC(14, 2) DEFAULT 0.00,
  total_withdrawn_qty NUMERIC(14, 2) DEFAULT 0.00,
  total_returned_qty NUMERIC(14, 2) DEFAULT 0.00,
  actual_consumed_qty NUMERIC(14, 2) DEFAULT 0.00,
  variance_units NUMERIC(14, 2) DEFAULT 0.00,
  variance_percent NUMERIC(14, 2) DEFAULT 0.00,
  learned_adjustment_factor NUMERIC(14, 4) DEFAULT 1.0000,
  is_immutable SMALLINT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 18. Documentos de Calibração Contínua da IA
CREATE TABLE IF NOT EXISTS ai_calibration_docs (
  id SERIAL PRIMARY KEY,
  project_name VARCHAR(255) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(50) NOT NULL,
  file_path TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'Processado',
  extracted_items INTEGER DEFAULT 0,
  uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 19. Notificações Internas
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  role_target VARCHAR(100),
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'info',
  link VARCHAR(255),
  is_read SMALLINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 20. Auditoria e Logs de Ações
CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  user_name VARCHAR(150),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id INTEGER,
  project_id INTEGER,
  old_value TEXT,
  new_value TEXT,
  details TEXT NOT NULL,
  ip_address VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices de Alta Performance
CREATE INDEX IF NOT EXISTS idx_materials_code ON materials(code);
CREATE INDEX IF NOT EXISTS idx_materials_name ON materials(name);
CREATE INDEX IF NOT EXISTS idx_projects_code ON projects(code);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_requests_status ON material_requests(status);
CREATE INDEX IF NOT EXISTS idx_purchases_status ON purchases(status);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, is_read);

-- ==============================================================================
-- CARGA INICIAL (SEEDS) — PERFIS E USUÁRIO MESTRE MATHEUS BRAGA
-- ==============================================================================

-- Inserção dos Perfis de Acesso
INSERT INTO roles (id, name, label, description) VALUES
  (1, 'admin', 'Administrador Geral', 'Acesso irrestrito a todos os módulos, aprovações e auditoria'),
  (2, 'orcamento', 'Setor de Orçamento', 'Criação e revisão de orçamentos, análise de plantas por IA e propostas comerciais'),
  (3, 'engenharia', 'Engenharia de Obras', 'Acompanhamento de obras em execução e solicitação de materiais'),
  (4, 'almoxarifado', 'Logística & Almoxarifado', 'Controle de estoque físico, separação, entrega e devoluções'),
  (5, 'compras', 'Suprimentos & Compras', 'Gestão de fornecedores, cotações e ordens de compra')
ON CONFLICT (id) DO NOTHING;

-- Inserção do Usuário Mestre Matheus Braga e Perfis Demonstrativos
INSERT INTO users (id, name, email, password, role_id, department, phone, avatar) VALUES
  (1, 'Matheus Braga', 'mbragaalmeida@gmail.com', 'Ma191095.', 1, 'Diretoria Geral', '(21) 98888-0001', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'),
  (2, 'Carlos Silva', 'admin@sabrar.com.br', 'Ma191095.', 1, 'Diretoria Executiva', '(21) 98888-0002', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80'),
  (3, 'Mariana Costa', 'orcamento@sabrar.com.br', 'Ma191095.', 2, 'Engenharia de Custos', '(21) 98888-0003', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80'),
  (4, 'Eng. Rafael Santos', 'engenharia@sabrar.com.br', 'Ma191095.', 3, 'Obras & Operações', '(21) 98888-0004', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80'),
  (5, 'Tiago Lima', 'almoxarifado@sabrar.com.br', 'Ma191095.', 4, 'Logística & Almoxarifado', '(21) 98888-0005', 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80'),
  (6, 'Fernanda Souza', 'compras@sabrar.com.br', 'Ma191095.', 5, 'Suprimentos & Compras', '(21) 98888-0006', 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80')
ON CONFLICT (id) DO NOTHING;

-- Notificação Inicial de Boas-Vindas
INSERT INTO notifications (user_id, role_target, title, message, type, link, is_read) VALUES
  (1, 'Administrador Geral', 'Sistema SABRAR em Produção', 'Banco de dados Supabase configurado com sucesso e pronto para uso real.', 'success', '/dashboard', 0);
