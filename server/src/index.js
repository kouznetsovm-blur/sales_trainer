import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import sessionRouter from './routes/session.js';
import authRouter from './routes/auth.js';
import adminRouter from './routes/admin.js';
import testsRouter from './routes/tests.js';
import db from './db/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// API роуты
app.use('/api/auth', authRouter);
app.use('/api/tests', testsRouter);
app.use('/api/session', sessionRouter);
app.use('/api/admin', adminRouter);

// В продакшене отдаём собранный фронтенд
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// Ежедневная очистка истёкших токенов
setInterval(() => {
  db.exec(`DELETE FROM tokens WHERE expires_at < CURRENT_TIMESTAMP`);
}, 24 * 60 * 60 * 1000);

app.listen(PORT, () => {
  console.log(`✅ Zori server запущен на порту ${PORT}`);
});
