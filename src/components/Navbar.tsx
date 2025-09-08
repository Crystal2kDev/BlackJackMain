// src/components/Navbar.tsx
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

const OracleLogo: React.FC<{ size?: number }> = ({ size = 56 }) => {
  // SVG circle + HTML text overlay (OG)
  const s = Math.max(32, size);
  return (
    <div className="oracle-logo-mark" style={{ width: s, height: s }}>
      <svg viewBox="0 0 120 120" preserveAspectRatio="xMidYMid meet" className="oracle-logo-svg" aria-hidden>
        <defs>
          <linearGradient id="oracleGrad" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#00b7eb" />
            <stop offset="1" stopColor="#0077b6" />
          </linearGradient>
        </defs>
        <circle cx="60" cy="60" r="50" fill="none" stroke="url(#oracleGrad)" strokeWidth="10" strokeLinecap="round" />
        {/* optional inner subtle ring */}
        <circle cx="60" cy="60" r="36" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2" />
      </svg>

      {/* OG text overlay (regular DOM text, not SVG) */}
      <span className="oracle-monogram" aria-hidden>
        OG
      </span>
    </div>
  );
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
    } catch (e) { /* ignore */ }
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
          <NavLink to="/" className="navbar-logo" aria-label="OracleGame — главная" onClick={() => setMobileOpen(false)}>
            <OracleLogo size={58} />
            <div className="logo-text-wrap">
              <span className="logo-text">OracleGame</span>
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
                    src={user.avatarUrl ?? `/assets/default-avatar.png`}
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
              <img className="mobile-user-avatar" src={user.avatarUrl ?? '/assets/default-avatar.png'} alt={user.name} onError={(e) => (e.currentTarget as HTMLImageElement).src = '/assets/default-avatar.png'} />
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
