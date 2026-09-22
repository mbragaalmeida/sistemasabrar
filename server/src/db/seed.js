import { db } from './connection.js';
import { initializeDatabase } from './schema.js';

export function seedDatabase() {
  initializeDatabase();

  // Verifica se já existem usuários cadastrados
  const existingUsers = db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (existingUsers && existingUsers.count > 0) {
    console.log('[Seed] Banco já possui dados. Pulando seeding inicial.');
    return;
  }

  console.log('[Seed] Inserindo dados iniciais realistas para a SABRAR...');

  // 1. Perfis de Usuário
  const insertRole = db.prepare('INSERT INTO roles (name, label, description) VALUES (?, ?, ?)');
  insertRole.run('admin', 'Administrador', 'Acesso total a todos os módulos, configurações e relatórios');
  insertRole.run('orcamento', 'Setor de orçamento', 'Análise de IA, revisão de materiais, composição de serviços e emissão de proposta');
  insertRole.run('engenharia', 'Engenharia', 'Acompanhamento de obras aprovadas e emissão de solicitações de materiais');
  insertRole.run('almoxarifado', 'Almoxarifado', 'Separação física, confirmação de entregas, controle de estoque e recebimento de devoluções');
  insertRole.run('compras', 'Compras', 'Gestão de demandas automáticas por déficit, cotações, pedidos e acompanhamento de entregas');

  // 2. Usuários (Usuário Real Mestre + Usuários de Demonstração)
  const insertUser = db.prepare(`
    INSERT INTO users (id, name, email, password, role_id, department, phone, avatar)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Usuário Mestre Solicitado (mbragaalmeida@gmail.com / Ma191095.)
  insertUser.run(
    1,
    'Matheus Braga',
    'mbragaalmeida@gmail.com',
    'Ma191095.',
    1,
    'Diretoria Geral',
    '(11) 99999-9999',
    'https://ui-avatars.com/api/?name=Matheus+Braga&background=0284c7&color=fff&bold=true'
  );

  // Usuários de Demonstração
  insertUser.run(2, 'Carlos Silva', 'admin@sabrar.com.br', 'sabrar123', 1, 'Diretoria Executiva', '(11) 98765-4321', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80');
  insertUser.run(3, 'Mariana Costa', 'orcamento@sabrar.com.br', 'sabrar123', 2, 'Engenharia de Custos', '(11) 97654-3210', 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80');
  insertUser.run(4, 'Eng. Rafael Santos', 'engenharia@sabrar.com.br', 'sabrar123', 3, 'Obras & Operações', '(11) 96543-2109', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80');
  insertUser.run(5, 'Tiago Lima', 'almoxarifado@sabrar.com.br', 'sabrar123', 4, 'Logística & Almoxarifado', '(11) 95432-1098', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80');
  insertUser.run(6, 'Fernanda Souza', 'compras@sabrar.com.br', 'sabrar123', 5, 'Suprimentos & Compras', '(11) 94321-0987', 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80');

  // 3. Notificação inicial de boas-vindas
  const insertNotif = db.prepare(`
    INSERT INTO notifications (user_id, role_target, title, message, type, link)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  insertNotif.run(1, 'Administrador', 'Sistema SABRAR Inicializado', 'Base pronta em Estado Zero. Pronto para cadastro de obras e importação de materiais via NF-e.', 'info', '/dashboard');

  console.log('[Seed] Carga inicial concluída: Estado Zero pronto para produção!');
}

// Executa se chamado diretamente
if (process.argv[1]?.endsWith('seed.js')) {
  seedDatabase();
}

