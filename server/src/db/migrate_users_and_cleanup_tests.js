import { pool } from './connection.js';

async function migrate() {
  console.log('=== INICIANDO MIGRAÇÃO DE USUÁRIOS E PREPARAÇÃO DO SISTEMA LIMPO ===\n');

  // 1. Inserir novas roles se não existirem
  console.log('1. Verificando e criando perfis especializados (Sabrina e Emily)...');
  await pool.query(`
    INSERT INTO roles (id, name, label, description)
    VALUES 
      (6, 'orcamento_engenharia', 'Orçamento e Engenharia', 'Acesso duplo completo aos módulos de Orçamento, IA e Engenharia de Obras'),
      (7, 'compras_solicitacoes', 'Compras e Solicitações', 'Acesso completo ao módulo de Compras e aba lateral de Solicitação de Materiais')
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      label = EXCLUDED.label,
      description = EXCLUDED.description;
  `);

  // Sincronizar sequence de roles
  await pool.query(`SELECT setval('roles_id_seq', (SELECT MAX(id) FROM roles));`);
  console.log('✓ Perfis de acesso configurados!');

  // 2. Garantir que foreign keys de usuários aceitem NULL caso um usuário seja excluído
  console.log('\n2. Ajustando restrições de chave estrangeira para permitir exclusão segura de usuários...');
  await pool.query(`
    ALTER TABLE material_requests ALTER COLUMN requested_by DROP NOT NULL;
    ALTER TABLE returns ALTER COLUMN received_by DROP NOT NULL;
  `).catch(err => console.log('Aviso (já executado):', err.message));

  // 3. Adicionar coluna is_hidden para ocultar testes mantendo a inteligência intacta
  console.log('\n3. Configurando colunas is_hidden para ocultar dados de teste...');
  await pool.query(`
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT FALSE;
    ALTER TABLE budgets ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT FALSE;
    ALTER TABLE material_requests ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT FALSE;
    ALTER TABLE purchases ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT FALSE;
    ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT FALSE;
  `);

  // Ocultar todos os projetos de teste existentes, mantendo suas análises de IA e historical_usage intactos
  await pool.query(`
    UPDATE projects SET is_hidden = TRUE WHERE is_hidden IS FALSE OR is_hidden IS NULL;
    UPDATE budgets SET is_hidden = TRUE WHERE is_hidden IS FALSE OR is_hidden IS NULL;
    UPDATE material_requests SET is_hidden = TRUE WHERE is_hidden IS FALSE OR is_hidden IS NULL;
    UPDATE purchases SET is_hidden = TRUE WHERE is_hidden IS FALSE OR is_hidden IS NULL;
    UPDATE stock_movements SET is_hidden = TRUE WHERE is_hidden IS FALSE OR is_hidden IS NULL;
    DELETE FROM notifications;
  `);

  // Zerar estoque reservado na base de materiais para não ter saldo preso por testes
  await pool.query(`
    UPDATE materials SET stock_reserved = 0.00;
  `);
  console.log('✓ Dados de teste ocultados da visualização e estoque reservado zerado!');

  // 4. Excluir usuários fictícios / de teste
  console.log('\n4. Removendo usuários falsos de teste...');
  const fakeEmails = [
    'admin@sabrar.com.br',
    'orcamento@sabrar.com.br',
    'engenharia@sabrar.com.br',
    'almoxarifado@sabrar.com.br',
    'compras@sabrar.com.br',
    'teste@gmail.com'
  ];

  for (const email of fakeEmails) {
    const userRes = await pool.query('SELECT id, name FROM users WHERE LOWER(email) = LOWER($1)', [email]);
    if (userRes.rows.length > 0) {
      const uId = userRes.rows[0].id;
      // Desvincular de quaisquer tabelas
      await pool.query('DELETE FROM project_engineers WHERE user_id = $1', [uId]);
      await pool.query('DELETE FROM notifications WHERE user_id = $1', [uId]);
      await pool.query('UPDATE material_requests SET requested_by = NULL WHERE requested_by = $1', [uId]);
      await pool.query('UPDATE material_requests SET admin_approved_by = NULL WHERE admin_approved_by = $1', [uId]);
      await pool.query('UPDATE purchases SET buyer_id = NULL WHERE buyer_id = $1', [uId]);
      await pool.query('UPDATE stock_movements SET user_id = NULL WHERE user_id = $1', [uId]);
      await pool.query('UPDATE returns SET received_by = NULL WHERE received_by = $1', [uId]);
      await pool.query('UPDATE budgets SET approved_by = NULL WHERE approved_by = $1', [uId]);
      await pool.query('UPDATE project_files SET uploaded_by = NULL WHERE uploaded_by = $1', [uId]);
      await pool.query('UPDATE audit_logs SET user_id = NULL WHERE user_id = $1', [uId]);
      await pool.query('UPDATE ai_calibration_docs SET uploaded_by = NULL WHERE uploaded_by = $1', [uId]);
      await pool.query('UPDATE duct_analyses SET created_by = NULL WHERE created_by = $1', [uId]);
      await pool.query('DELETE FROM users WHERE id = $1', [uId]);
      console.log(` - Usuário removido: ${userRes.rows[0].name} (${email})`);
    }
  }

  // 5. Cadastrar usuários reais com a senha 12345678
  console.log('\n5. Cadastrando usuários reais da planilha...');
  const realUsers = [
    {
      name: 'Emily Bueno',
      email: 'emily@sabrar.com.br',
      role_id: 7, // compras_solicitacoes
      department: 'Suprimentos & Compras',
      phone: ''
    },
    {
      name: 'Felipe Germano',
      email: 'felipe@sabrar.com.br',
      role_id: 1, // admin
      department: 'Diretoria / Gestão',
      phone: ''
    },
    {
      name: 'Gabrielle Braga',
      email: 'gabrielle@sabrar.com.br',
      role_id: 1, // admin
      department: 'Diretoria / Gestão',
      phone: ''
    },
    {
      name: 'Guilherme Beu',
      email: 'guilherme.beu@sabrar.com.br',
      role_id: 3, // engenharia
      department: 'Engenharia de Obras',
      phone: ''
    },
    {
      name: 'Ítalo Crespo',
      email: 'italo.crespo@sabrar.com.br',
      role_id: 3, // engenharia
      department: 'Engenharia de Obras',
      phone: ''
    },
    {
      name: 'Jefferson Coutinho',
      email: 'jefferson.coutinho@sabrar.com.br',
      role_id: 3, // engenharia
      department: 'Engenharia de Obras',
      phone: ''
    },
    {
      name: 'Jorge Arantes',
      email: 'jorge.arantes@sabrar.com.br',
      role_id: 3, // engenharia
      department: 'Engenharia de Obras',
      phone: ''
    },
    {
      name: 'Lucas Guimarães',
      email: 'engenharia4@sabrar.com.br',
      role_id: 3, // engenharia
      department: 'Engenharia de Obras',
      phone: ''
    },
    {
      name: 'Rodrigo Mendes',
      email: 'rodrigo.mendes@sabrar.com.br',
      role_id: 3, // engenharia
      department: 'Engenharia de Obras',
      phone: ''
    },
    {
      name: 'Sirlene Leal',
      email: 'sirlene@sabrar.com.br',
      role_id: 3, // engenharia
      department: 'Engenharia de Obras',
      phone: ''
    },
    {
      name: 'Villian Braga',
      email: 'villian.braga@sabrar.com.br',
      role_id: 3, // engenharia
      department: 'Engenharia de Obras',
      phone: ''
    },
    {
      name: 'Patricia Braga',
      email: 'patricia@sabrar.com.br',
      role_id: 1, // admin
      department: 'Diretoria / Gestão',
      phone: ''
    },
    {
      name: 'Caroline Braga',
      email: 'caroline@sabrar.com.br',
      role_id: 1, // admin
      department: 'Diretoria / Gestão',
      phone: ''
    },
    {
      name: 'Sabrina Gonçalves',
      email: 'sabrina@sabrar.com.br',
      role_id: 6, // orcamento_engenharia
      department: 'Engenharia & Custos',
      phone: ''
    },
    {
      name: 'Almoxarifado',
      email: 'adm_almox@sabrar.com.br',
      role_id: 4, // almoxarifado
      department: 'Logística & Almoxarifado',
      phone: ''
    }
  ];

  const defaultPassword = '12345678';

  for (const u of realUsers) {
    const avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=0284c7&color=fff&bold=true`;
    
    // Inserir ou atualizar usuário
    const existing = await pool.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [u.email]);
    if (existing.rows.length > 0) {
      await pool.query(`
        UPDATE users 
        SET name = $1, role_id = $2, department = $3, password = $4, avatar = $5
        WHERE id = $6
      `, [u.name, u.role_id, u.department, defaultPassword, avatar, existing.rows[0].id]);
      console.log(` ✓ Atualizado: ${u.name} (${u.email}) - Perfil ID ${u.role_id}`);
    } else {
      await pool.query(`
        INSERT INTO users (name, email, password, role_id, department, phone, avatar)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [u.name, u.email.toLowerCase(), defaultPassword, u.role_id, u.department, u.phone, avatar]);
      console.log(` ✓ Criado: ${u.name} (${u.email}) - Perfil ID ${u.role_id}`);
    }
  }

  // Garantir que a senha do Matheus Braga também seja 12345678
  await pool.query(`
    UPDATE users SET password = $1 WHERE email = 'mbragaalmeida@gmail.com';
  `, [defaultPassword]);
  console.log(' ✓ Senha do administrador principal (Matheus Braga) atualizada para 12345678!');

  // Sincronizar sequences
  await pool.query(`SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));`);

  // Relatório final de usuários ativos
  const finalUsers = await pool.query(`
    SELECT u.id, u.name, u.email, r.label as role_label, u.department
    FROM users u
    JOIN roles r ON u.role_id = r.id
    ORDER BY u.id ASC
  `);

  console.log('\n=== USUÁRIOS ATIVOS NO SISTEMA SABRAR ===');
  finalUsers.rows.forEach(u => {
    console.log(`[ID ${u.id}] ${u.name} <${u.email}> - ${u.role_label} (${u.department})`);
  });

  await pool.end();
  console.log('\n=== MIGRAÇÃO CONCLUÍDA COM SUCESSO! ===');
}

migrate().catch(err => {
  console.error('Erro na migração:', err);
  process.exit(1);
});
