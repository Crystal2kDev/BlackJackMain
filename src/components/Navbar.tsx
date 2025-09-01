import React from 'react';
import { NavLink } from 'react-router-dom';
import '../styles/Navbar.css';

const links = [
  { name: 'Главная', path: '/' },
  { name: 'Игра', path: '/game' },
  { name: 'FAQ', path: '/faq' },
];

const Navbar: React.FC = () => {
  return (
    <nav className="navbar" role="navigation" aria-label="Main navigation">
      <div className="navbar-bg" />

      <div className="navbar-container">
        <div className="navbar-left">
          {/* Логотип + небольшой svg-эмблем */}
          <NavLink to="/" className="navbar-logo" aria-label="BlackJack - главная">
            <svg className="logo-mark" viewBox="0 0 48 48" width="28" height="28" xmlns="http://www.w3.org/2000/svg" aria-hidden>
              <defs>
                <linearGradient id="lg" x1="0" x2="1" y1="0" y2="1">
                  <stop offset="0" stopColor="#00b7eb"/>
                  <stop offset="1" stopColor="#0077b6"/>
                </linearGradient>
              </defs>
              <rect x="4" y="4" width="40" height="40" rx="8" fill="url(#lg)"/>
              <text x="24" y="30" textAnchor="middle" fontSize="20" fontWeight="700" fill="#0f1724" fontFamily="Montserrat, Arial">BJ</text>
            </svg>
            <span className="logo-text">BlackJack</span>
          </NavLink>
        </div>

        <div className="navbar-right">
          <div className="navbar-links" role="menubar">
            {links.map((link) => (
              <NavLink
                key={link.name}
                to={link.path}
                className={({ isActive }) => `navbar-link ${isActive ? 'active' : ''}`}
                role="menuitem"
              >
                {link.name}
              </NavLink>
            ))}
          </div>

          <NavLink to="/login" className="navbar-login-button">
            Войти
          </NavLink>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
