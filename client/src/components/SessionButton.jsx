import './SessionButton.css';

export default function SessionButton({ isActive, disabled, onClick }) {
  return (
    <button
      className={`session-btn ${isActive ? 'active' : ''} ${disabled ? 'disabled' : ''}`}
      onClick={disabled ? undefined : onClick}
      aria-label={isActive ? 'Остановить сессию' : 'Начать сессию'}
      aria-disabled={disabled}
    >
      {isActive
        ? <span className="icon-stop" />
        : <span className="icon-play" />
      }
    </button>
  );
}
