import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import '../styles/Login.css';

const Login: React.FC = () => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const title = isRegister ? 'Регистрация' : 'Вход';

  const validatePassword = (value: string) => {
    // Разрешаем только латинские буквы (A-Z, a-z)
    const regex = /^[A-Za-z]*$/;
    if (!regex.test(value)) {
      setPasswordError('Пароль может содержать только английские буквы (A-Z, a-z)');
    } else {
      setPasswordError('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (passwordError) {
      alert('Исправьте ошибки в форме');
      return;
    }

    if (isRegister) {
      console.log('Register:', { email, password });
    } else {
      console.log('Login:', { email, password });
    }
    // TODO: интеграция с бэком
  };

  // Варианты анимации для плавного переключения форм
  const formVariants = {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10 },
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <h1>BlackJack</h1>
          <p>Онлайн-настольная игра | Без вывода денег</p>
        </div>

        <div className="auth-tabs">
          <button
            className={`auth-tab ${!isRegister ? 'active' : ''}`}
            onClick={() => setIsRegister(false)}
            type="button"
            aria-pressed={!isRegister}
          >
            Войти
          </button>
          <button
            className={`auth-tab ${isRegister ? 'active' : ''}`}
            onClick={() => setIsRegister(true)}
            type="button"
            aria-pressed={isRegister}
          >
            Регистрация
          </button>
        </div>

        <AnimatePresence mode="wait">
          <motion.form
            key={isRegister ? 'register' : 'login'}
            className="auth-form"
            onSubmit={handleSubmit}
            variants={formVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            <h2 className="auth-title">{title}</h2>

            <label className="auth-label">
              <span>Email</span>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </label>

            <label className="auth-label">
              <span>Пароль</span>
              <input
                type="password"
                placeholder="******"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  validatePassword(e.target.value);
                }}
                required
                autoComplete={isRegister ? 'new-password' : 'current-password'}
              />
              {passwordError && <p className="auth-error">{passwordError}</p>}
            </label>

            <button type="submit" className="auth-submit" disabled={!!passwordError}>
              {isRegister ? 'Зарегистрироваться' : 'Войти'}
            </button>

            {!isRegister && (
              <button
                type="button"
                className="auth-link-button"
                onClick={() => alert('Функционал восстановления в разработке')}
              >
                Забыли пароль?
              </button>
            )}
          </motion.form>
        </AnimatePresence>

        <div className="auth-toggle">
          {isRegister ? 'Уже есть аккаунт?' : 'Нет аккаунта?'}{' '}
          <button
            className="auth-inline-link"
            onClick={() => setIsRegister((v) => !v)}
            type="button"
          >
            {isRegister ? 'Войти' : 'Регистрация'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
