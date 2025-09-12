import React, { useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import '../styles/Navbar.css';

const links = [
  { name: 'Главная', path: '/' },
  { name: 'Игра', path: '/lobby' },
  { name: 'Магазин', path: '/store' },
  { name: 'FAQ', path: '/faq' },
];

type CurrentUser = {
  name: string;
  avatarUrl?: string;
};

const Navbar: React.FC = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    try {
      const raw = localStorage.getItem('currentUser');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.name) setUser(parsed as CurrentUser);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  const logout = () => {
    localStorage.removeItem('currentUser');
    setUser(null);
    setUserMenuOpen(false);
    navigate('/');
  };

  return (
    <header className="navbar" role="banner">
      <div className="navbar-bg" />

      <div className="navbar-container">
        <div className="navbar-left">
          <NavLink
            to="/"
            className="navbar-logo"
            aria-label="TableRush — главная"
            onClick={() => setMobileOpen(false)}
          >
            
            <div className="tablerush-logo-mark">
              <img
                src="/assets/TableRush_icon.png"
                alt="TableRush logo"
                className="logo-icon-img"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = '/assets/default-avatar.png';
                }}
              />
            </div>

            <div className="logo-text-wrap">
              <span className="logo-text">TableRush</span>
              <small className="logo-sub">Play &amp; Win</small>
            </div>
          </NavLink>
        </div>

        <nav className="navbar-right" aria-label="Основная навигация">
          <div className="navbar-links" role="menubar">
            {links.map((link) => (
              <NavLink
                key={link.name}
                to={link.path}
                className={({ isActive }) => `navbar-link ${isActive ? 'active' : ''}`}
                role="menuitem"
                onClick={() => setMobileOpen(false)}
              >
                {link.name}
              </NavLink>
            ))}
          </div>

          <div className="navbar-actions">
            {!user ? (
              <NavLink to="/login" className="navbar-login-button" onClick={() => setMobileOpen(false)}>
                Войти
              </NavLink>
            ) : (
              <div className="user-wrapper" ref={userMenuRef}>
                <button
                  className="user-btn"
                  aria-haspopup="true"
                  aria-expanded={userMenuOpen}
                  onClick={() => setUserMenuOpen(v => !v)}
                >
                  <img
                    src={user.avatarUrl ?? '/assets/default-avatar.png'}
                    alt={user.name}
                    className="user-avatar"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/assets/default-avatar.png'; }}
                  />
                  <span className="user-name">{user.name}</span>
                </button>

                <div className={`user-menu ${userMenuOpen ? 'open' : ''}`} role="menu" aria-label="User menu">
                  <button className="user-menu-item" onClick={() => { setUserMenuOpen(false); navigate('/profile'); }}>Профиль</button>
                  <button className="user-menu-item" onClick={() => { setUserMenuOpen(false); navigate('/settings'); }}>Настройки</button>
                  <button className="user-menu-item destructive" onClick={logout}>Выйти</button>
                </div>
              </div>
            )}
          </div>
        </nav>

        <button
          className={`hamburger-btn ${mobileOpen ? 'open' : ''}`}
          aria-label={mobileOpen ? 'Закрыть меню' : 'Открыть меню'}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen(v => !v)}
        >
          <span className="hamburger-lines" />
        </button>
      </div>

      <div className={`mobile-panel ${mobileOpen ? 'open' : ''}`} aria-hidden={!mobileOpen}>
        <div className="mobile-inner" role="menu">
          {links.map((l) => (
            <NavLink key={l.name} to={l.path} className="mobile-item" onClick={() => setMobileOpen(false)}>
              {l.name}
            </NavLink>
          ))}

          <div className="mobile-divider" />

          {!user ? (
            <NavLink to="/login" className="mobile-cta" onClick={() => setMobileOpen(false)}>Войти</NavLink>
          ) : (
            <div className="mobile-user-block">
              <img
                className="mobile-user-avatar"
                src={user.avatarUrl ?? '/assets/default-avatar.png'}
                alt={user.name}
                onError={(e) => ((e.currentTarget as HTMLImageElement).src = '/assets/default-avatar.png')}
              />
              <div className="mobile-user-name">{user.name}</div>
              <div className="mobile-user-actions">
                <button onClick={() => { setMobileOpen(false); navigate('/profile'); }}>Профиль</button>
                <button onClick={() => { setMobileOpen(false); logout(); }} className="destructive">Выйти</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
