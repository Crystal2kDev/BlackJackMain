import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import '../styles/Navbar.css';

const Navbar: React.FC = () => {
  return (
    <nav className="navbar">
      <div className="navbar-container">
        <NavLink to="/" className="navbar-logo">
          BlackJack
        </NavLink>
        <div className="navbar-links">
          <NavLink
            to="/game"
            className={({ isActive }) => `navbar-link ${isActive ? 'active' : ''}`}
          >
            <motion.span whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
              Играть
            </motion.span>
          </NavLink>
          <NavLink
            to="/faq"
            className={({ isActive }) => `navbar-link ${isActive ? 'active' : ''}`}
          >
            <motion.span whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
              FAQ
            </motion.span>
          </NavLink>
          <NavLink
            to="/login"
            className={({ isActive }) => `navbar-link ${isActive ? 'active' : ''}`}
          >
            <motion.span whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
              Войти
            </motion.span>
          </NavLink>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;