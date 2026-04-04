import { Router } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import bcryptjs from 'bcryptjs';
import db from '../db/index.js';

const router = Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Укажите логин и пароль' });
  }

  const user = db.prepare(`SELECT * FROM users WHERE username = ?`).get(username);
  if (!user) {
    return res.status(401).json({ error: 'Неверный логин или пароль' });
  }

  if (user.status === 'blocked') {
    return res.status(403).json({ error: 'Пользователь заблокирован' });
  }

  const valid = bcryptjs.compareSync(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Неверный логин или пароль' });
  }

  const token = jwt.sign(
    { userId: user.id, username: user.username, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    .toISOString().replace('T', ' ').slice(0, 19);

  db.prepare(`INSERT INTO tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)`)
    .run(user.id, tokenHash, expiresAt);

  res.json({
    token,
    user: { id: user.id, username: user.username, role: user.role }
  });
});

router.post('/logout', (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (token) {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    db.prepare(`DELETE FROM tokens WHERE token_hash = ?`).run(tokenHash);
  }
  res.json({ ok: true });
});

export default router;
