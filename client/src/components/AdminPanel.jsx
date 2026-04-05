import { useState, useEffect, useCallback } from 'react';
import { authFetch } from '../utils/api.js';
import './AdminPanel.css';

export default function AdminPanel({ onLogout }) {
  const [activeTab, setActiveTab] = useState('users');
  const [pendingTab, setPendingTab] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);

  // Users tab
  const [users, setUsers] = useState([]);
  const [createUserForm, setCreateUserForm] = useState({ open: false, username: '', password: '', role: 'user' });
  const [resetForm, setResetForm] = useState({ userId: null, password: '' });

  // Tests tab
  const [tests, setTests] = useState([]);
  const [testForm, setTestForm] = useState({ open: false, editId: null, title: '', description: '', instructions: '', duration_minutes: 5 });

  const [error, setError] = useState('');

  // Logs tab
  const [logUsers, setLogUsers] = useState([]);
  const [logsView, setLogsView] = useState('users');
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedSession, setSelectedSession] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [transcript, setTranscript] = useState(null);

  const hasUnsavedChanges = createUserForm.open || resetForm.userId !== null || testForm.open;

  const loadUsers = useCallback(async () => {
    const res = await authFetch('/api/admin/users');
    if (res.ok) setUsers(await res.json());
  }, []);

  const loadTests = useCallback(async () => {
    const res = await authFetch('/api/admin/tests');
    if (res.ok) setTests(await res.json());
  }, []);

  const loadLogUsers = useCallback(async () => {
    const res = await authFetch('/api/admin/logs');
    if (res.ok) setLogUsers(await res.json());
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const resetForms = () => {
    setCreateUserForm({ open: false, username: '', password: '', role: 'user' });
    setResetForm({ userId: null, password: '' });
    setTestForm({ open: false, editId: null, title: '', description: '', instructions: '', duration_minutes: 5 });
    setError('');
  };

  const doSwitchTab = (tab) => {
    setActiveTab(tab);
    resetForms();
    if (tab === 'users') loadUsers();
    if (tab === 'tests') loadTests();
    if (tab === 'logs') loadLogUsers();
  };

  const handleTabClick = (tab) => {
    if (tab === activeTab) return;
    if (hasUnsavedChanges) { setPendingTab(tab); setShowConfirm(true); }
    else doSwitchTab(tab);
  };

  // ── Users ──────────────────────────────────────────

  const submitCreateUser = async () => {
    if (!createUserForm.username || !createUserForm.password) {
      setError('Заполните логин и пароль'); return false;
    }
    const res = await authFetch('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify({ username: createUserForm.username, password: createUserForm.password, role: createUserForm.role })
    });
    if (res.ok) { resetForms(); loadUsers(); return true; }
    const d = await res.json(); setError(d.error || 'Ошибка'); return false;
  };

  const submitResetPassword = async () => {
    if (!resetForm.password) { setError('Введите новый пароль'); return false; }
    const res = await authFetch(`/api/admin/users/${resetForm.userId}/reset-password`, {
      method: 'POST', body: JSON.stringify({ password: resetForm.password })
    });
    if (res.ok) { setResetForm({ userId: null, password: '' }); setError(''); return true; }
    const d = await res.json(); setError(d.error || 'Ошибка'); return false;
  };

  const handleBlock = async (id, currentStatus) => {
    const action = currentStatus === 'active' ? 'block' : 'unblock';
    const res = await authFetch(`/api/admin/users/${id}/${action}`, { method: 'POST', body: '{}' });
    if (res.ok) loadUsers();
  };

  const handleDeleteUser = async (id, username) => {
    if (!confirm(`Удалить пользователя «${username}»? Это действие необратимо.`)) return;
    const res = await authFetch(`/api/admin/users/${id}`, { method: 'DELETE' });
    if (res.ok) loadUsers();
    else { const d = await res.json(); setError(d.error || 'Ошибка'); }
  };

  // ── Tests ──────────────────────────────────────────

  const submitTestForm = async () => {
    if (!testForm.title || !testForm.instructions) {
      setError('Укажите название и инструкцию'); return false;
    }
    const isEdit = testForm.editId !== null;
    const res = await authFetch(
      isEdit ? `/api/admin/tests/${testForm.editId}` : '/api/admin/tests',
      {
        method: isEdit ? 'PUT' : 'POST',
        body: JSON.stringify({ title: testForm.title, description: testForm.description, instructions: testForm.instructions, duration_minutes: testForm.duration_minutes })
      }
    );
    if (res.ok) { resetForms(); loadTests(); return true; }
    const d = await res.json(); setError(d.error || 'Ошибка'); return false;
  };

  const handleEditTest = (t) => {
    setTestForm({ open: true, editId: t.id, title: t.title, description: t.description, instructions: t.instructions, duration_minutes: t.duration_minutes ?? 5 });
    setError('');
  };

  const handleToggleTest = async (id, currentStatus) => {
    const action = currentStatus === 'active' ? 'disable' : 'enable';
    const res = await authFetch(`/api/admin/tests/${id}/${action}`, { method: 'POST', body: '{}' });
    if (res.ok) loadTests();
  };

  // ── Confirm dialog ─────────────────────────────────

  const handleConfirmComplete = async () => {
    setShowConfirm(false);
    let success = false;
    if (createUserForm.open) success = await submitCreateUser();
    else if (resetForm.userId !== null) success = await submitResetPassword();
    else if (testForm.open) success = await submitTestForm();
    if (success) { doSwitchTab(pendingTab); setPendingTab(null); }
  };

  const handleConfirmDiscard = () => {
    setShowConfirm(false); doSwitchTab(pendingTab); setPendingTab(null);
  };

  // ── Logs ───────────────────────────────────────────

  const handleSelectUser = async (user) => {
    setSelectedUser(user);
    const res = await authFetch(`/api/admin/logs/${user.id}/sessions`);
    if (res.ok) { setSessions(await res.json()); setLogsView('sessions'); }
  };

  const handleSelectSession = async (session) => {
    setSelectedSession(session);
    const res = await authFetch(`/api/admin/logs/${selectedUser.id}/sessions/${session.id}`);
    if (res.ok) { setTranscript(await res.json()); setLogsView('transcript'); }
  };

  const formatDate = (dt) => {
    if (!dt) return '—';
    return new Date(dt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="admin">
      <header className="admin-header">
        <span className="admin-logo">Zori Admin</span>
        <button className="admin-logout-btn" onClick={onLogout}>Выйти</button>
      </header>

      <div className="admin-tabs">
        {['users', 'tests', 'logs'].map(tab => (
          <button
            key={tab}
            className={`admin-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => handleTabClick(tab)}
          >
            {{ users: 'Пользователи', tests: 'Тесты', logs: 'Логи' }[tab]}
          </button>
        ))}
      </div>

      <div className="admin-content">

        {/* ── USERS TAB ── */}
        {activeTab === 'users' && (
          <div className="users-tab">
            <div className="users-toolbar">
              {!createUserForm.open && (
                <button className="btn-primary" onClick={() => setCreateUserForm(f => ({ ...f, open: true }))}>
                  + Создать пользователя
                </button>
              )}
            </div>

            {createUserForm.open && (
              <div className="create-form">
                <h3>Новый пользователь</h3>
                <div className="form-row">
                  <input className="form-input" placeholder="Логин" value={createUserForm.username}
                    onChange={e => setCreateUserForm(f => ({ ...f, username: e.target.value }))} autoFocus />
                  <input className="form-input" type="password" placeholder="Пароль" value={createUserForm.password}
                    onChange={e => setCreateUserForm(f => ({ ...f, password: e.target.value }))} />
                  <select className="form-select" value={createUserForm.role}
                    onChange={e => setCreateUserForm(f => ({ ...f, role: e.target.value }))}>
                    <option value="user">user</option>
                    <option value="admin">admin</option>
                  </select>
                </div>
                <div className="form-actions">
                  <button className="btn-primary" onClick={submitCreateUser}>Создать</button>
                  <button className="btn-secondary" onClick={resetForms}>Отмена</button>
                </div>
              </div>
            )}

            {error && <p className="admin-error">{error}</p>}

            <table className="users-table">
              <thead><tr><th>Логин</th><th>Роль</th><th>Статус</th><th>Создан</th><th>Действия</th></tr></thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td className="td-username">{u.username}</td>
                    <td><span className={`badge badge-${u.role}`}>{u.role}</span></td>
                    <td><span className={`badge badge-${u.status}`}>{u.status === 'active' ? 'активен' : 'заблокирован'}</span></td>
                    <td className="td-date">{formatDate(u.created_at)}</td>
                    <td className="td-actions">
                      {resetForm.userId === u.id ? (
                        <span className="reset-inline">
                          <input className="form-input form-input-sm" type="password" placeholder="Новый пароль"
                            value={resetForm.password} autoFocus
                            onChange={e => setResetForm(f => ({ ...f, password: e.target.value }))} />
                          <button className="btn-sm btn-primary" onClick={submitResetPassword}>Сохранить</button>
                          <button className="btn-sm btn-secondary" onClick={() => setResetForm({ userId: null, password: '' })}>✕</button>
                        </span>
                      ) : (
                        <button className="btn-sm btn-secondary" onClick={() => { setResetForm({ userId: u.id, password: '' }); setError(''); }}>Пароль</button>
                      )}
                      <button className={`btn-sm ${u.status === 'active' ? 'btn-warn' : 'btn-secondary'}`}
                        onClick={() => handleBlock(u.id, u.status)}>
                        {u.status === 'active' ? 'Блок' : 'Разблок'}
                      </button>
                      <button className="btn-sm btn-danger" onClick={() => handleDeleteUser(u.id, u.username)}>Удалить</button>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && <tr><td colSpan="5" className="td-empty">Пользователей нет</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {/* ── TESTS TAB ── */}
        {activeTab === 'tests' && (
          <div className="users-tab">
            <div className="users-toolbar">
              {!testForm.open && (
                <button className="btn-primary" onClick={() => { setTestForm({ open: true, editId: null, title: '', description: '', instructions: '', duration_minutes: 5 }); setError(''); }}>
                  + Создать тест
                </button>
              )}
            </div>

            {testForm.open && (
              <div className="create-form">
                <h3>{testForm.editId ? 'Редактировать тест' : 'Новый тест'}</h3>
                <div className="form-col">
                  <input className="form-input" placeholder="Название" value={testForm.title}
                    onChange={e => setTestForm(f => ({ ...f, title: e.target.value }))} autoFocus />
                  <input className="form-input" placeholder="Описание (1–2 строки)" value={testForm.description}
                    onChange={e => setTestForm(f => ({ ...f, description: e.target.value }))} />
                  <div className="form-row" style={{ alignItems: 'center', gap: 8 }}>
                    <label style={{ fontSize: 13, color: '#555', whiteSpace: 'nowrap' }}>Длительность (мин):</label>
                    <input className="form-input" type="number" min="1" max="60" style={{ width: 72 }}
                      value={testForm.duration_minutes}
                      onChange={e => setTestForm(f => ({ ...f, duration_minutes: Number(e.target.value) }))} />
                  </div>
                  <textarea className="form-textarea" placeholder="Инструкция для AI (системный промпт)"
                    value={testForm.instructions}
                    onChange={e => setTestForm(f => ({ ...f, instructions: e.target.value }))} rows={6} />
                </div>
                <div className="form-actions">
                  <button className="btn-primary" onClick={submitTestForm}>{testForm.editId ? 'Сохранить' : 'Создать'}</button>
                  <button className="btn-secondary" onClick={resetForms}>Отмена</button>
                </div>
              </div>
            )}

            {error && <p className="admin-error">{error}</p>}

            <table className="users-table">
              <thead><tr><th>Название</th><th>Описание</th><th>Мин</th><th>Статус</th><th>Действия</th></tr></thead>
              <tbody>
                {tests.map(t => (
                  <tr key={t.id}>
                    <td className="td-username">{t.title}</td>
                    <td className="td-desc">{t.description}</td>
                    <td>{t.duration_minutes ?? 5}</td>
                    <td><span className={`badge badge-${t.status === 'active' ? 'active' : 'blocked'}`}>{t.status === 'active' ? 'активен' : 'отключён'}</span></td>
                    <td className="td-actions">
                      <button className="btn-sm btn-secondary" onClick={() => handleEditTest(t)}>Изменить</button>
                      <button className={`btn-sm ${t.status === 'active' ? 'btn-warn' : 'btn-secondary'}`}
                        onClick={() => handleToggleTest(t.id, t.status)}>
                        {t.status === 'active' ? 'Откл' : 'Вкл'}
                      </button>
                    </td>
                  </tr>
                ))}
                {tests.length === 0 && <tr><td colSpan="4" className="td-empty">Тестов нет</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {/* ── LOGS TAB ── */}
        {activeTab === 'logs' && (
          <div className="logs-tab">
            {logsView !== 'users' && (
              <nav className="logs-breadcrumb">
                <button className="breadcrumb-link" onClick={() => setLogsView('users')}>Пользователи</button>
                <span> / {selectedUser?.username}</span>
                {logsView === 'transcript' && (
                  <>
                    <button className="breadcrumb-link" onClick={() => setLogsView('sessions')}> / сессии</button>
                    <span> / {formatDate(selectedSession?.started_at)}</span>
                  </>
                )}
              </nav>
            )}

            {logsView === 'users' && (
              <table className="users-table">
                <thead><tr><th>Пользователь</th><th>Роль</th><th>Сессий</th></tr></thead>
                <tbody>
                  {logUsers.map(u => (
                    <tr key={u.id} className="tr-clickable" onClick={() => handleSelectUser(u)}>
                      <td className="td-username">{u.username}</td>
                      <td><span className={`badge badge-${u.role}`}>{u.role}</span></td>
                      <td>{u.session_count}</td>
                    </tr>
                  ))}
                  {logUsers.length === 0 && <tr><td colSpan="3" className="td-empty">Нет данных</td></tr>}
                </tbody>
              </table>
            )}

            {logsView === 'sessions' && (
              <table className="users-table">
                <thead><tr><th>Тест</th><th>Начало</th><th>Конец</th><th>Реплик</th></tr></thead>
                <tbody>
                  {sessions.map(s => (
                    <tr key={s.id} className="tr-clickable" onClick={() => handleSelectSession(s)}>
                      <td>{s.test_title || '—'}</td>
                      <td>{formatDate(s.started_at)}</td>
                      <td>{formatDate(s.ended_at)}</td>
                      <td>{s.message_count}</td>
                    </tr>
                  ))}
                  {sessions.length === 0 && <tr><td colSpan="4" className="td-empty">Сессий нет</td></tr>}
                </tbody>
              </table>
            )}

            {logsView === 'transcript' && transcript && (
              <div className="transcript-view">
                {transcript.messages.map((msg, i) => (
                  <div key={i} className={`log-msg log-msg-${msg.role}`}>
                    <div className="log-bubble">{msg.text}</div>
                    <div className="log-time">{formatDate(msg.created_at)}</div>
                  </div>
                ))}
                {transcript.messages.length === 0 && <p className="td-empty">Сообщений нет</p>}
              </div>
            )}
          </div>
        )}
      </div>

      {showConfirm && (
        <div className="confirm-overlay">
          <div className="confirm-box">
            <p>Операция не завершена. Что сделать?</p>
            <div className="confirm-actions">
              <button className="btn-primary" onClick={handleConfirmComplete}>Завершить и перейти</button>
              <button className="btn-secondary" onClick={handleConfirmDiscard}>Перейти без сохранения</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
