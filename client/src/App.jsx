import Header from './components/Header.jsx';
import SessionButton from './components/SessionButton.jsx';
import Pulsation from './components/Pulsation.jsx';
import Transcript from './components/Transcript.jsx';
import { useRealtimeSession } from './hooks/useRealtimeSession.js';
import './App.css';

export default function App() {
  const { isActive, messages, speaking, startSession, stopSession } = useRealtimeSession();

  const handleToggle = () => {
    if (isActive) stopSession();
    else startSession();
  };

  return (
    <div className="app">
      <Header />
      <div className="layout">
        <main className="transcript-area">
          <Transcript messages={messages} />
        </main>
        <div className="controls">
          {isActive && <Pulsation speaking={speaking} />}
          <SessionButton isActive={isActive} onClick={handleToggle} />
        </div>
      </div>
    </div>
  );
}
