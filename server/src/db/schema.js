import { db } from './connection.js';

export function initializeDatabase() {
  db.exec(`
    -- Perfis de Acesso
    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      label TEXT NOT NULL,
      description TEXT
    );

    -- Usuários
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role_id INTEGER NOT NULL REFERENCES roles(id),
      department TEXT,
      phone TEXT,
      avatar TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Fornecedores
    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      corporate_name TEXT,
      cnpj TEXT,
      contact_person TEXT,
      phone TEXT,
      email TEXT,
      materials_supplied TEXT,
      notes TEXT,
      rating REAL DEFAULT 5.0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Base Central de Materiais
    CREATE TABLE IF NOT EXISTS materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL, -- Ex: MAT-000184
      name TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL, -- Elétrica, Hidráulica, Civil, Pintura, Estrutura, etc.
      unit TEXT NOT NULL, -- m, un, m², kg, saco, barra, etc.
      brand TEXT,
      reference_price REAL NOT NULL DEFAULT 0.0,
      supplier_id INTEGER REFERENCES suppliers(id),
      stock_physical REAL NOT NULL DEFAULT 0.0,
      stock_reserved REAL NOT NULL DEFAULT 0.0,
      stock_minimum REAL NOT NULL DEFAULT 10.0,
      status TEXT NOT NULL DEFAULT 'Ativo', -- Ativo / Inativo
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Movimentações de Estoque
    CREATE TABLE IF NOT EXISTS stock_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      material_id INTEGER NOT NULL REFERENCES materials(id),
      type TEXT NOT NULL, -- 'ENTRADA', 'SAIDA_OBRA', 'RESERVA', 'CANCELAMENTO_RESERVA', 'DEVOLUCAO'
      quantity REAL NOT NULL,
      previous_stock REAL NOT NULL,
      new_stock REAL NOT NULL,
      project_id INTEGER,
      reference_id INTEGER, -- request_id, purchase_id ou return_id
      user_id INTEGER REFERENCES users(id),
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Projetos / Obras
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL, -- Ex: PRJ-2026-001
      name TEXT NOT NULL,
      client TEXT NOT NULL,
      client_email TEXT,
      client_phone TEXT,
      address TEXT NOT NULL,
      city TEXT,
      state TEXT,
      project_type TEXT NOT NULL, -- Comercial, Residencial, Industrial, Reforma, Infraestrutura
      start_date TEXT,
      expected_end_date TEXT,
      responsible_engineer TEXT NOT NULL,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'Novo',
      total_budget_materials REAL DEFAULT 0.0,
      total_budget_services REAL DEFAULT 0.0,
      total_budget_additional REAL DEFAULT 0.0,
      total_budget_final REAL DEFAULT 0.0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Arquivos dos Projetos (Projeto Técnico, Memorial Descritivo, etc.)
    CREATE TABLE IF NOT EXISTS project_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      type TEXT NOT NULL, -- 'PROJETO_TECNICO', 'MEMORIAL_DESCRITIVO', 'PLANILHA', 'OUTRO'
      original_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER,
      mime_type TEXT,
      content_summary TEXT, -- Texto extraído para IA
      uploaded_by INTEGER REFERENCES users(id),
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Análises da IA
    CREATE TABLE IF NOT EXISTS ai_analyses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      analyzed_documents TEXT, -- JSON com nomes de docs
      confidence_score REAL DEFAULT 90.0,
      historical_factors_applied TEXT,
      summary TEXT,
      raw_extracted_data TEXT, -- JSON completo
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Sugestões de Materiais geradas pela IA
    CREATE TABLE IF NOT EXISTS ai_suggestions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      analysis_id INTEGER NOT NULL REFERENCES ai_analyses(id) ON DELETE CASCADE,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      material_id INTEGER REFERENCES materials(id),
      material_name TEXT NOT NULL,
      suggested_quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      unit_price REAL NOT NULL,
      subtotal REAL NOT NULL,
      reasoning TEXT, -- Explicabilidade da IA
      confidence REAL DEFAULT 95.0,
      status TEXT DEFAULT 'Pendente', -- Pendente, Aprovada, Modificada, Rejeitada
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Orçamentos
    CREATE TABLE IF NOT EXISTS budgets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER UNIQUE NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      code TEXT UNIQUE NOT NULL, -- ORC-2026-001
      status TEXT NOT NULL DEFAULT 'Em elaboração', -- Em elaboração, Em revisão, Aprovado, Rejeitado
      total_materials REAL DEFAULT 0.0,
      total_services REAL DEFAULT 0.0,
      total_labor REAL DEFAULT 0.0,
      total_equipment REAL DEFAULT 0.0,
      total_logistics REAL DEFAULT 0.0,
      total_taxes REAL DEFAULT 0.0,
      total_additional REAL DEFAULT 0.0,
      total_final REAL DEFAULT 0.0,
      validity_days INTEGER DEFAULT 15,
      commercial_terms TEXT,
      approved_by INTEGER REFERENCES users(id),
      approved_at TEXT,
      sent_to_client_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Itens de Materiais do Orçamento
    CREATE TABLE IF NOT EXISTS budget_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      budget_id INTEGER NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
      material_id INTEGER REFERENCES materials(id),
      material_name TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      unit_price REAL NOT NULL,
      subtotal REAL NOT NULL,
      ai_suggested_quantity REAL, -- Registro histórico do que a IA propôs originalmente
      ai_reasoning TEXT,
      human_notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Serviços e Custos Complementares do Orçamento
    CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      budget_id INTEGER NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
      category TEXT NOT NULL, -- 'MÃO DE OBRA', 'SERVIÇO ESPECIALIZADO', 'EQUIPAMENTO', 'LOGÍSTICA', 'IMPOSTOS', 'OUTROS'
      description TEXT NOT NULL,
      quantity REAL DEFAULT 1.0,
      unit TEXT DEFAULT 'vb',
      unit_price REAL NOT NULL,
      subtotal REAL NOT NULL,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Solicitações de Materiais pela Engenharia
    CREATE TABLE IF NOT EXISTS material_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL, -- SOL-2026-0001
      project_id INTEGER NOT NULL REFERENCES projects(id),
      requested_by INTEGER NOT NULL REFERENCES users(id),
      priority TEXT NOT NULL DEFAULT 'Média', -- Baixa, Média, Alta, Urgente
      status TEXT NOT NULL DEFAULT 'Solicitado', -- Solicitado, Reservado, Em separação, Separado, Entregue, Cancelado
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Itens da Solicitação de Material
    CREATE TABLE IF NOT EXISTS material_request_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_id INTEGER NOT NULL REFERENCES material_requests(id) ON DELETE CASCADE,
      material_id INTEGER NOT NULL REFERENCES materials(id),
      quantity_requested REAL NOT NULL,
      quantity_reserved REAL DEFAULT 0.0,
      quantity_delivered REAL DEFAULT 0.0,
      deficit REAL DEFAULT 0.0, -- Calculado: max(0, solicitada - disponível)
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Fila de Compras / Cotações
    CREATE TABLE IF NOT EXISTS purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL, -- COM-2026-0001
      project_id INTEGER REFERENCES projects(id),
      request_item_id INTEGER REFERENCES material_request_items(id),
      material_id INTEGER NOT NULL REFERENCES materials(id),
      quantity REAL NOT NULL,
      supplier_id INTEGER REFERENCES suppliers(id),
      unit_price REAL DEFAULT 0.0,
      total_price REAL DEFAULT 0.0,
      status TEXT NOT NULL DEFAULT 'Solicitado', -- Solicitado, Em cotação, Aguardando aprovação, Comprado, Aguardando entrega, Recebido, Cancelado
      priority TEXT DEFAULT 'Média',
      purchase_date TEXT,
      expected_delivery_date TEXT,
      received_date TEXT,
      buyer_id INTEGER REFERENCES users(id),
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Devoluções de Materiais ao Almoxarifado
    CREATE TABLE IF NOT EXISTS returns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL, -- DEV-2026-0001
      project_id INTEGER NOT NULL REFERENCES projects(id),
      material_id INTEGER NOT NULL REFERENCES materials(id),
      quantity REAL NOT NULL, -- Quantidade reutilizável que volta ao estoque
      received_by INTEGER NOT NULL REFERENCES users(id),
      reason TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Histórico de Consumo e Base de Aprendizado da IA
    CREATE TABLE IF NOT EXISTS historical_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id),
      material_id INTEGER NOT NULL REFERENCES materials(id),
      project_type TEXT NOT NULL,
      project_size_sqm REAL,
      ai_suggested_qty REAL NOT NULL,
      human_approved_qty REAL NOT NULL,
      total_requested_qty REAL DEFAULT 0.0,
      total_withdrawn_qty REAL DEFAULT 0.0,
      total_returned_qty REAL DEFAULT 0.0,
      actual_consumed_qty REAL DEFAULT 0.0, -- Retirado - Devolvido
      variance_units REAL DEFAULT 0.0, -- Consumido - Aprovado
      variance_percent REAL DEFAULT 0.0, -- ((Consumido - Aprovado) / Aprovado) * 100
      learned_adjustment_factor REAL DEFAULT 1.0, -- Fator que a IA calibra
      is_immutable INTEGER DEFAULT 1, -- Registro congelado para auditoria
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Central de Notificações Internas
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      role_target TEXT, -- 'Administrador', 'Setor de orçamento', 'Engenharia', 'Almoxarifado', 'Compras' ou null para todos
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL, -- 'info', 'warning', 'success', 'urgent'
      link TEXT,
      is_read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Auditoria e Logs de Ações (Imutável)
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      user_name TEXT,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL, -- 'PROJETO', 'ORCAMENTO', 'ESTOQUE', 'SOLICITACAO', 'COMPRA', 'DEVOLUCAO'
      entity_id INTEGER,
      project_id INTEGER,
      old_value TEXT,
      new_value TEXT,
      details TEXT NOT NULL,
      ip_address TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Índices para alta performance de busca
    CREATE INDEX IF NOT EXISTS idx_materials_code ON materials(code);
    CREATE INDEX IF NOT EXISTS idx_materials_name ON materials(name);
    CREATE INDEX IF NOT EXISTS idx_projects_code ON projects(code);
    CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
    CREATE INDEX IF NOT EXISTS idx_requests_status ON material_requests(status);
    CREATE INDEX IF NOT EXISTS idx_purchases_status ON purchases(status);
    CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, is_read);
  `);

  console.log('[Database] Todas as tabelas e índices verificados e criados com sucesso!');
}
