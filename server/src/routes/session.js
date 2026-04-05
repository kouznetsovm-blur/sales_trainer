import { Router } from 'express';
import crypto from 'crypto';
import db from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Выдача ephemeral token для WebRTC соединения с OpenAI
router.post('/token', requireAuth, async (req, res) => {
  try {
    const { testId } = req.body;
    if (!testId) return res.status(400).json({ error: 'testId required' });

    const test = db.prepare(`SELECT * FROM tests WHERE id = ? AND status = 'active'`).get(testId);
    if (!test) return res.status(404).json({ error: 'Тест не найден или отключён' });

    const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-realtime',
        voice: 'cedar',
        temperature: 0.7,
        max_response_output_tokens: 250,
        tool_choice: 'none',
        instructions: test.instructions + `\n\nВременной лимит: разговор рассчитан на ${test.duration_minutes} минут. Когда время подходит к концу, вежливо заверши разговор — скажи, что хочешь успеть на следующий интересный доклад, и попрощайся.`,
        input_audio_transcription: {
          model: 'gpt-4o-transcribe',
          language: 'ru'
        },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.9,
          silence_duration_ms: 1000,
          prefix_padding_ms: 300
        }
      })
    });

    const data = await response.json();

    if (data.error) {
      console.error('OpenAI error:', data.error);
      return res.status(500).json({ error: data.error.message });
    }

    const session = db.prepare(
      'INSERT INTO sessions (user_id, test_id, started_at) VALUES (?, ?, CURRENT_TIMESTAMP)'
    ).run(req.user.id, testId);

    res.json({
      token: data.client_secret.value,
      sessionId: session.lastInsertRowid
    });

  } catch (err) {
    console.error('Token error:', err);
    res.status(500).json({ error: 'Не удалось получить токен' });
  }
});

// Завершение сессии (поддерживает токен в теле для sendBeacon)
router.post('/end', (req, res) => {
  const { sessionId, token: bodyToken } = req.body;
  if (!sessionId) return res.status(400).json({ error: 'sessionId required' });

  // Проверяем авторизацию: заголовок или тело
  const headerToken = req.headers['authorization']?.startsWith('Bearer ')
    ? req.headers['authorization'].slice(7) : null;
  const rawToken = headerToken || bodyToken;

  if (rawToken) {
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const stored = db.prepare(
      `SELECT user_id FROM tokens WHERE token_hash = ? AND expires_at > CURRENT_TIMESTAMP`
    ).get(tokenHash);
    if (!stored) return res.status(401).json({ error: 'Недействительный токен' });
  }

  db.prepare(
    'UPDATE sessions SET ended_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).run(sessionId);

  res.json({ ok: true });
});

// Сохранение сообщения транскрипта
router.post('/message', requireAuth, (req, res) => {
  const { sessionId, role, text } = req.body;
  if (!sessionId || !role || !text) {
    return res.status(400).json({ error: 'sessionId, role, text required' });
  }

  db.prepare(
    'INSERT INTO messages (session_id, role, text) VALUES (?, ?, ?)'
  ).run(sessionId, role, text);

  res.json({ ok: true });
});

export default router;
