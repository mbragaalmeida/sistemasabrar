import express from 'express';
import { db } from '../db/connection.js';

export const notificationsRouter = express.Router();

// Lista notificações (filtradas estritamente por setor e obras envolvidas)
notificationsRouter.get('/', async (req, res) => {
  try {
    const { role, user_id } = req.query;
    let notifications = [];

    if (user_id) {
      const user = await db.prepare(`
        SELECT u.*, r.name as role_name 
        FROM users u 
        LEFT JOIN roles r ON u.role_id = r.id 
        WHERE u.id = ?
      `).get(user_id);

      const effectiveRole = (role || user?.role_name || '').toLowerCase();
      const userName = (user?.name || '').toLowerCase().replace(/^eng\.?\s*/i, '').trim();

      // Busca IDs e nomes de obras sob responsabilidade do usuário (se engenheiro)
      let assignedProjects = [];
      if (user) {
        assignedProjects = await db.prepare(`
          SELECT p.id, p.name, p.code 
          FROM projects p 
          LEFT JOIN project_engineers pe ON p.id = pe.project_id 
          WHERE pe.user_id = ? OR LOWER(p.responsible_engineer) LIKE ?
        `).all(user.id, `%${userName}%`);
      }

      const allNotifs = await db.prepare('SELECT * FROM notifications ORDER BY id DESC LIMIT 150').all();

      notifications = allNotifs.filter(n => {
        // Se a notificação foi enviada especificamente para este usuário
        if (n.user_id && Number(n.user_id) === Number(user_id)) return true;

        const target = (n.role_target || '').toLowerCase();

        const userEmail = (user?.email || '').toLowerCase();
        const isAdminOrApprover = effectiveRole === 'admin' || /sabrina|emily/i.test(userName) || /sabrina|emily/i.test(userEmail);

        // Admin, Sabrina ou Emily veem notificações administrativas/gerais (ajustes de estoque, aprovações de extras, etc.)
        if (isAdminOrApprover && (target === 'admin' || target === 'diretoria' || target === 'all')) {
          return true;
        }

        // Engenharia: apenas notificações do setor de engenharia E das suas obras
        if (effectiveRole === 'engenharia') {
          if (target === 'engenharia') {
            if (assignedProjects.length === 0) return true;
            return assignedProjects.some(p => 
              (n.message && (n.message.includes(p.name) || n.message.includes(p.code))) ||
              (n.link && n.link.includes(String(p.id)))
            );
          }
          return false;
        }

        // Almoxarifado: apenas notificações do estoque e separação
        if (effectiveRole === 'almoxarifado') {
          return target === 'almoxarifado' || target === 'estoque';
        }

        // Compras: apenas notificações de compras e cotações
        if (effectiveRole === 'compras' || effectiveRole === 'compras_solicitacoes') {
          return target === 'compras';
        }

        // Orçamento: apenas notificações de orçamentos e IA
        if (effectiveRole === 'orcamento' || effectiveRole === 'orcamento_engenharia') {
          return target === 'orcamento' || target === 'ia';
        }

        return false;
      });
    } else if (role) {
      const targetRole = role.toLowerCase();
      notifications = await db.prepare(`
        SELECT * FROM notifications 
        WHERE LOWER(role_target) = ? 
        ORDER BY id DESC LIMIT 50
      `).all(targetRole);
    } else {
      notifications = await db.prepare('SELECT * FROM notifications ORDER BY id DESC LIMIT 50').all();
    }

    const unreadCount = notifications.filter(n => !n.is_read).length;
    res.json({ notifications, unreadCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Marca notificação individual como lida
notificationsRouter.patch('/:id/read', async (req, res) => {
  try {
    await db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(req.params.id);
    res.json({ success: true, id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Marca todas como lidas
notificationsRouter.post('/read-all', async (req, res) => {
  try {
    await db.prepare('UPDATE notifications SET is_read = 1').run();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
