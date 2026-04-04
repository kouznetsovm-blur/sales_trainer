import { Router } from 'express';
import bcryptjs from 'bcryptjs';
import db from '../db/index.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth, requireAdmin);

// Список всех пользователей
router.get('/users', (req, res) => {
  const users = db.prepare(`
    SELECT id, username, role, status, created_at FROM users ORDER BY created_at
  `).all();
  res.json(users);
});

// Создать пользователя
router.post('/users', (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password || !role) {
    return res.status(400).json({ error: 'Укажите логин, пароль и роль' });
  }
  if (!['admin', 'user'].includes(role)) {
    return res.status(400).json({ error: 'Роль должна быть admin или user' });
  }

  const existing = db.prepare(`SELECT id FROM users WHERE username = ?`).get(username);
  if (existing) {
    return res.status(409).json({ error: 'Пользователь с таким логином уже существует' });
  }

  const hash = bcryptjs.hashSync(password, 10);
  const result = db.prepare(`
    INSERT INTO users (username, password_hash, role, status) VALUES (?, ?, ?, 'active')
  `).run(username, hash, role);

  res.json({ id: result.lastInsertRowid, username, role, status: 'active' });
});

// Сбросить пароль
router.post('/users/:id/reset-password', (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Укажите новый пароль' });

  const hash = bcryptjs.hashSync(password, 10);
  const result = db.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`)
    .run(hash, req.params.id);

  if (result.changes === 0) return res.status(404).json({ error: 'Пользователь не найден' });
  res.json({ ok: true });
});

// Заблокировать
router.post('/users/:id/block', (req, res) => {
  const id = req.params.id;
  const result = db.prepare(`UPDATE users SET status = 'blocked' WHERE id = ?`).run(id);
  if (result.changes === 0) return res.status(404).json({ error: 'Пользователь не найден' });
  db.prepare(`DELETE FROM tokens WHERE user_id = ?`).run(id);
  res.json({ ok: true });
});

// Разблокировать
router.post('/users/:id/unblock', (req, res) => {
  const result = db.prepare(`UPDATE users SET status = 'active' WHERE id = ?`).run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Пользователь не найден' });
  res.json({ ok: true });
});

// Удалить
router.delete('/users/:id', (req, res) => {
  const id = parseInt(req.params.id);
  if (id === req.user.id) {
    return res.status(400).json({ error: 'Нельзя удалить собственный аккаунт' });
  }
  db.prepare(`DELETE FROM tokens WHERE user_id = ?`).run(id);
  const result = db.prepare(`DELETE FROM users WHERE id = ?`).run(id);
  if (result.changes === 0) return res.status(404).json({ error: 'Пользователь не найден' });
  res.json({ ok: true });
});

// ── Тесты ──────────────────────────────────────────

// Все тесты (включая отключённые)
router.get('/tests', (req, res) => {
  const tests = db.prepare(`
    SELECT id, title, description, instructions, status, created_at FROM tests ORDER BY title
  `).all();
  res.json(tests);
});

// Создать тест
router.post('/tests', (req, res) => {
  const { title, description, instructions } = req.body;
  if (!title || !instructions) {
    return res.status(400).json({ error: 'Укажите название и инструкцию' });
  }
  const result = db.prepare(`
    INSERT INTO tests (title, description, instructions, status) VALUES (?, ?, ?, 'active')
  `).run(title, description || '', instructions);
  res.json({ id: result.lastInsertRowid, title, description: description || '', status: 'active' });
});

// Редактировать тест
router.put('/tests/:id', (req, res) => {
  const { title, description, instructions } = req.body;
  if (!title || !instructions) {
    return res.status(400).json({ error: 'Укажите название и инструкцию' });
  }
  const result = db.prepare(`
    UPDATE tests SET title = ?, description = ?, instructions = ? WHERE id = ?
  `).run(title, description || '', instructions, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Тест не найден' });
  res.json({ ok: true });
});

// Включить тест
router.post('/tests/:id/enable', (req, res) => {
  const result = db.prepare(`UPDATE tests SET status = 'active' WHERE id = ?`).run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Тест не найден' });
  res.json({ ok: true });
});

// Отключить тест
router.post('/tests/:id/disable', (req, res) => {
  const result = db.prepare(`UPDATE tests SET status = 'disabled' WHERE id = ?`).run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Тест не найден' });
  res.json({ ok: true });
});

// ── Логи ───────────────────────────────────────────

// Логи: список пользователей с количеством сессий
router.get('/logs', (req, res) => {
  const users = db.prepare(`
    SELECT u.id, u.username, u.role,
      COUNT(s.id) as session_count
    FROM users u
    LEFT JOIN sessions s ON s.user_id = u.id
    GROUP BY u.id
    ORDER BY u.username
  `).all();
  res.json(users);
});

// Сессии пользователя
router.get('/logs/:userId/sessions', (req, res) => {
  const sessions = db.prepare(`
    SELECT s.id, s.started_at, s.ended_at,
      t.title as test_title,
      (SELECT COUNT(*) FROM messages WHERE session_id = s.id) as message_count
    FROM sessions s
    LEFT JOIN tests t ON t.id = s.test_id
    WHERE s.user_id = ?
    ORDER BY s.started_at DESC
  `).all(req.params.userId);
  res.json(sessions);
});

// Транскрипт сессии
router.get('/logs/:userId/sessions/:sessionId', (req, res) => {
  const session = db.prepare(`SELECT * FROM sessions WHERE id = ? AND user_id = ?`)
    .get(req.params.sessionId, req.params.userId);
  if (!session) return res.status(404).json({ error: 'Сессия не найдена' });

  const messages = db.prepare(`
    SELECT role, text, created_at FROM messages WHERE session_id = ? ORDER BY id
  `).all(req.params.sessionId);

  res.json({ session, messages });
});

export default router;
