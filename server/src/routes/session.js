import { Router } from 'express';
import db from '../db/index.js';

const router = Router();

// Выдача ephemeral token для WebRTC соединения с OpenAI
router.post('/token', async (req, res) => {
  try {
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
        instructions: `Ты — дружелюбный собеседник. Говори естественно, как живой человек.
Общайся только на русском языке. Отвечай кратко и по делу.`,
        input_audio_transcription: {
          model: 'gpt-4o-transcribe',
          language: 'ru'
        },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.9,
          silence_duration_ms: 800,
          prefix_padding_ms: 300
        }
      })
    });

    const data = await response.json();

    if (data.error) {
      console.error('OpenAI error:', data.error);
      return res.status(500).json({ error: data.error.message });
    }

    // Создаём новую сессию в БД
    const session = db.prepare(
      'INSERT INTO sessions (started_at) VALUES (CURRENT_TIMESTAMP)'
    ).run();

    res.json({
      token: data.client_secret.value,
      sessionId: session.lastInsertRowid
    });

  } catch (err) {
    console.error('Token error:', err);
    res.status(500).json({ error: 'Не удалось получить токен' });
  }
});

// Завершение сессии
router.post('/end', (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) return res.status(400).json({ error: 'sessionId required' });

  db.prepare(
    'UPDATE sessions SET ended_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).run(sessionId);

  res.json({ ok: true });
});

// Сохранение сообщения транскрипта
router.post('/message', (req, res) => {
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
