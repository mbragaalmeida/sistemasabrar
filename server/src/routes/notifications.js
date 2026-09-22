import express from 'express';
import { db } from '../db/connection.js';

export const notificationsRouter = express.Router();

// Lista notificações (filtradas por role ou user)
notificationsRouter.get('/', async (req, res) => {
  try {
    const { role, user_id } = req.query;
    let query = 'SELECT * FROM notifications WHERE 1=1';
    const params = [];

    if (role && user_id) {
      query += ' AND (role_target = ? OR role_target IS NULL OR user_id = ?)';
      params.push(role, user_id);
    } else if (role) {
      query += ' AND (role_target = ? OR role_target IS NULL)';
      params.push(role);
    } else if (user_id) {
      query += ' AND (user_id = ? OR user_id IS NULL)';
      params.push(user_id);
    }

    query += ' ORDER BY id DESC LIMIT 50';

    const notifications = await db.prepare(query).all(...params);
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
