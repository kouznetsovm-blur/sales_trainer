# ТЗ: Архитектура проекта
## Приложение: Zori — голосовой тренер для продавцов

---

## 1. Структура проекта

```
004_sales_trainer/
├── client/                        ← React + Vite (фронтенд)
│   ├── src/
│   │   ├── components/
│   │   │   ├── Header.jsx         ← название приложения "Zori"
│   │   │   ├── SessionButton.jsx  ← кнопка плей/стоп
│   │   │   ├── Pulsation.jsx      ← анимация пульсации (пользователь + AI)
│   │   │   └── Transcript.jsx     ← диалог в стиле мессенджера
│   │   ├── hooks/
│   │   │   └── useRealtimeSession.js  ← логика WebRTC сессии
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
├── server/                        ← Node.js + Express (бэкенд)
│   ├── src/
│   │   ├── routes/
│   │   │   └── session.js         ← выдача ephemeral token
│   │   ├── db/
│   │   │   └── index.js           ← SQLite (better-sqlite3)
│   │   └── index.js               ← точка входа сервера
│   ├── package.json
│   └── .env                       ← OPENAI_API_KEY (не коммитить)
└── docs/
    ├── architecture-spec.md       ← этот файл
    ├── business-requirements.md
    └── voice-module-spec.md
```

---

## 2. Технический стек

| Слой | Технология |
|---|---|
| Фронтенд | React + Vite |
| Бэкенд | Node.js + Express |
| База данных | SQLite (better-sqlite3) |
| Голос | OpenAI Realtime API (WebRTC) |
| Модель | gpt-realtime-mini |

---

## 3. Схема взаимодействия компонентов

```
[Браузер]
    │
    │  1. GET /api/session/token
    ▼
[Node.js сервер]
    │
    │  2. POST https://api.openai.com/v1/realtime/sessions
    │     (OPENAI_API_KEY хранится только здесь)
    ▼
[OpenAI REST API]
    │
    │  3. ephemeral token (живёт 60 сек)
    ▼
[Node.js сервер]
    │
    │  4. отдаёт token фронтенду
    ▼
[Браузер]
    │
    │  5. WebRTC соединение напрямую с OpenAI
    ▼
[OpenAI Realtime API]
    │  ← аудио пользователя (стримингом)
    │  → аудио AI + транскрипт (стримингом)
```

**Важно:** API ключ хранится только на сервере. Фронтенд работает с временным ephemeral token.

---

## 4. База данных (SQLite)

### Таблица `sessions`
| Поле | Тип | Описание |
|---|---|---|
| id | INTEGER PK | идентификатор сессии |
| started_at | DATETIME | время начала |
| ended_at | DATETIME | время окончания |

### Таблица `messages`
| Поле | Тип | Описание |
|---|---|---|
| id | INTEGER PK | идентификатор сообщения |
| session_id | INTEGER FK | ссылка на сессию |
| role | TEXT | `user` или `assistant` |
| text | TEXT | текст реплики |
| created_at | DATETIME | время реплики |
