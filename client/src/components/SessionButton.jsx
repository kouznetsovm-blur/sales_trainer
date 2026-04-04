import './SessionButton.css';

export default function SessionButton({ isActive, onClick }) {
  return (
    <button
      className={`session-btn ${isActive ? 'active' : ''}`}
      onClick={onClick}
      aria-label={isActive ? 'Остановить сессию' : 'Начать сессию'}
    >
      {isActive
        ? <span className="icon-stop" />
        : <span className="icon-play" />
      }
    </button>
  );
}
