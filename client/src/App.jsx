import { useState, useEffect } from 'react';
import Header from './components/Header.jsx';
import SessionButton from './components/SessionButton.jsx';
import Pulsation from './components/Pulsation.jsx';
import Transcript from './components/Transcript.jsx';
import TestSelect from './components/TestSelect.jsx';
import LoginPage from './components/LoginPage.jsx';
import AdminPanel from './components/AdminPanel.jsx';
import { useRealtimeSession } from './hooks/useRealtimeSession.js';
import { getUser, clearAuth, authFetch } from './utils/api.js';
import './App.css';

export default function App() {
  const [user, setUser] = useState(() => getUser());
  const isAdminPage = window.location.pathname === '/admin';

  const handleLogout = async () => {
    await authFetch('/api/auth/logout', { method: 'POST', body: '{}' });
    clearAuth();
    setUser(null);
  };

  useEffect(() => {
    const handler = () => { clearAuth(); setUser(null); };
    window.addEventListener('auth:unauthorized', handler);
    return () => window.removeEventListener('auth:unauthorized', handler);
  }, []);

  if (!user) return <LoginPage onLogin={setUser} />;

  if (isAdminPage) {
    if (user.role !== 'admin') {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#888' }}>
          Доступ запрещён
        </div>
      );
    }
    return <AdminPanel onLogout={handleLogout} />;
  }

  return <MainApp user={user} onLogout={handleLogout} />;
}

function MainApp({ user, onLogout }) {
  const [selectedTest, setSelectedTest] = useState(null);
  const { isActive, messages, speaking, startSession, stopSession } = useRealtimeSession();

  const handleToggle = () => {
    if (isActive) stopSession();
    else startSession(selectedTest);
  };

  return (
    <div className="app">
      <Header user={user} onLogout={onLogout} />
      <div className="layout">
        <main className="transcript-area">
          <Transcript messages={messages} />
        </main>
        <div className="controls">
          {isActive && <Pulsation speaking={speaking} />}
          {!isActive && (
            <TestSelect value={selectedTest} onChange={setSelectedTest} />
          )}
          <SessionButton
            isActive={isActive}
            disabled={!isActive && !selectedTest}
            onClick={handleToggle}
          />
        </div>
      </div>
    </div>
  );
}
