import { Router } from 'express';
import db from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Список активных тестов для пользователей (без поля instructions)
router.get('/', requireAuth, (req, res) => {
  const tests = db.prepare(`
    SELECT id, title, description FROM tests WHERE status = 'active' ORDER BY title
  `).all();
  res.json(tests);
});

export default router;
