import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import '../styles/Login.css';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isRegister) {
      console.log('Register:', { email, password });
    } else {
      console.log('Login:', { email, password });
    }
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          className="modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="modal-content"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
          >
            <button className="modal-close" onClick={onClose}>
              &times;
            </button>
            <h2>{isRegister ? 'Регистрация' : 'Вход'}</h2>
            <form onSubmit={handleSubmit} className="login-form">
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <input
                type="password"
                placeholder="Пароль"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button type="submit">{isRegister ? 'Зарегистрироваться' : 'Войти'}</button>
            </form>
            <div className="toggle-login">
              {isRegister ? 'Уже есть аккаунт?' : 'Нет аккаунта?'}{' '}
              <span onClick={() => setIsRegister(!isRegister)}>
                {isRegister ? 'Войти' : 'Регистрация'}
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LoginModal;