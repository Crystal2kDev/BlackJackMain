import { Link } from 'react-router-dom';
import '../styles/Navbar.css';

interface NavbarProps {
  onLoginClick?: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ onLoginClick }) => {
  const links = [
    { name: 'Главная', path: '/' },
    { name: 'Игра', path: '/game' },
    { name: 'FAQ', path: '/faq' },
  ];

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <div className="navbar-logo">
          <Link to="/">BlackJack</Link>
        </div>
        <div className="navbar-links">
          {links.map((link) => (
            <Link key={link.name} to={link.path}>
              {link.name}
            </Link>
          ))}
          <button className="navbar-login-button" onClick={onLoginClick}>
            Войти
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
