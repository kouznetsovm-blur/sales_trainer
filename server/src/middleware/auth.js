import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import db from '../db/index.js';

function extractToken(req) {
  const authHeader = req.headers['authorization'];
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7);
  return null;
}

export function requireAuth(req, res, next) {
  const token = extractToken(req);

  if (!token) {
    return res.status(401).json({ error: 'Требуется авторизация' });
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ error: 'Недействительный токен' });
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const stored = db.prepare(`
    SELECT t.id, u.id as userId, u.username, u.role, u.status
    FROM tokens t
    JOIN users u ON u.id = t.user_id
    WHERE t.token_hash = ? AND t.expires_at > CURRENT_TIMESTAMP
  `).get(tokenHash);

  if (!stored) {
    return res.status(401).json({ error: 'Токен отозван или истёк' });
  }

  if (stored.status === 'blocked') {
    db.prepare(`DELETE FROM tokens WHERE user_id = ?`).run(stored.userId);
    return res.status(403).json({ error: 'Пользователь заблокирован' });
  }

  req.user = { id: stored.userId, username: stored.username, role: stored.role };
  next();
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Недостаточно прав' });
  }
  next();
}
