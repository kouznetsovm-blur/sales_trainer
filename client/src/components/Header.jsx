import './Header.css';

export default function Header({ user, onLogout }) {
  const openAdmin = () => window.open('/admin', '_blank');

  return (
    <header className="header">
      <span className="header-logo">Zori</span>
      <div className="header-actions">
        {user?.role === 'admin' && (
          <button className="header-btn" onClick={openAdmin}>Админ</button>
        )}
        <button className="header-btn header-btn-logout" onClick={onLogout}>Выйти</button>
      </div>
    </header>
  );
}
