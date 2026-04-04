import './Pulsation.css';

export default function Pulsation({ speaking }) {
  return (
    <div className="pulsation-row">
      <div className={`pulse pulse-user ${speaking === 'user' ? 'active' : ''}`}>
        <div className="pulse-ring" />
        <div className="pulse-ring pulse-ring-2" />
        <div className="pulse-dot" />
        <span className="pulse-label">Вы</span>
      </div>

      <div className={`pulse pulse-ai ${speaking === 'ai' ? 'active' : ''}`}>
        <div className="pulse-ring" />
        <div className="pulse-ring pulse-ring-2" />
        <div className="pulse-dot" />
        <span className="pulse-label">Zori</span>
      </div>
    </div>
  );
}
