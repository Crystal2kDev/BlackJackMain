import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import '../styles/Login.css';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const Login: React.FC = () => {
  const [stage, setStage] = useState<'email' | 'code' | 'done'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const sendCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    setInfo(null);

    if (!emailRegex.test(email.trim())) {
      setError('Пожалуйста, введите корректный email.');
      return;
    }

    setSending(true);
    setInfo(null);

    // Имитация запроса на бэкенд
    setTimeout(() => {
      setSending(false);
      setStage('code');
      setInfo('Код отправлен на указанный адрес. Проверьте почту (в том числе папку «Спам»).');
    }, 1100);
  };

  const verifyCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    setInfo(null);

    if (code.trim().length < 4) {
      setError('Введите корректный код (не менее 4 цифр).');
      return;
    }

    setVerifying(true);

    // Имитация проверки кода
    setTimeout(() => {
      setVerifying(false);
      // В реальной интеграции проверка должна вернуть успех/ошибку
      // Для демонстрации считаем любое значение валидным
      setStage('done');
      setInfo('Вы успешно вошли в аккаунт.');
      console.log('AUTH SUCCESS (mock):', { email });
    }, 900);
  };

  const restart = () => {
    setStage('email');
    setCode('');
    setInfo(null);
    setError(null);
    setSending(false);
    setVerifying(false);
  };

  return (
    <div className="auth-page">
      <div className="auth-card" role="region" aria-labelledby="auth-title">
        <div className="auth-header">
          <div className="logo-row">
            <svg className="logo-mark" width="40" height="40" viewBox="0 0 48 48" aria-hidden>
              <defs>
                <linearGradient id="lg2" x1="0" x2="1" y1="0" y2="1">
                  <stop offset="0" stopColor="#00b7eb" />
                  <stop offset="1" stopColor="#0077b6" />
                </linearGradient>
              </defs>
              <rect x="4" y="4" width="40" height="40" rx="8" fill="url(#lg2)"/>
              <text x="24" y="30" textAnchor="middle" fontSize="18" fontWeight="700" fill="#061428" fontFamily="Montserrat, Arial">OG</text>
            </svg>

            <div className="header-texts">
              <h1 id="auth-title">TableRush</h1>
              <div className="header-sub">Вход по одноразовому коду</div>
            </div>
          </div>
        </div>

        <div className="auth-body">
          <AnimatePresence mode="wait" initial={false}>
            {stage === 'email' && (
              <motion.form
                className="auth-form"
                key="email"
                onSubmit={sendCode}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.22 }}
                aria-label="Форма ввода email"
              >
                <h2 className="auth-title">Введите ваш e-mail</h2>

                <label className="auth-label">
                  <span>Электронная почта</span>
                  <input
                    type="email"
                    inputMode="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    aria-required
                    aria-label="Email"
                    autoComplete="email"
                    disabled={sending}
                  />
                </label>

                {error && <div className="auth-error" role="alert">{error}</div>}
                {info && <div className="auth-info">{info}</div>}

                <div className="actions-row">
                  <button
                    type="submit"
                    className="auth-submit"
                    aria-disabled={sending}
                    disabled={sending}
                  >
                    {sending ? 'Отправка…' : 'Отправить код'}
                  </button>

                  <button
                    type="button"
                    className="auth-ghost"
                    onClick={() => { setEmail(''); setError(null); setInfo(null); }}
                    disabled={sending}
                  >
                    Очистить
                  </button>
                </div>

                <div className="auth-small">Мы отправим одноразовый код на указанный адрес для входа. Без пароля.</div>
              </motion.form>
            )}

            {stage === 'code' && (
              <motion.form
                className="auth-form"
                key="code"
                onSubmit={verifyCode}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.22 }}
                aria-label="Форма ввода кода"
              >
                <h2 className="auth-title">Код отправлен</h2>

                <label className="auth-label">
                  <span>Введите код из письма</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="1234"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/[^\d]/g, ''))}
                    required
                    aria-required
                    aria-label="Код подтверждения"
                    autoComplete="one-time-code"
                    disabled={verifying}
                    maxLength={6}
                  />
                </label>

                {error && <div className="auth-error" role="alert">{error}</div>}
                {info && <div className="auth-info">{info}</div>}

                <div className="actions-row">
                  <button
                    type="submit"
                    className="auth-submit"
                    disabled={verifying}
                    aria-disabled={verifying}
                  >
                    {verifying ? 'Проверка…' : 'Войти'}
                  </button>

                  <button
                    type="button"
                    className="auth-ghost"
                    onClick={sendCode}
                    disabled={sending || verifying}
                    title="Отправить код повторно"
                  >
                    Отправить снова
                  </button>
                </div>

                <div className="code-row">
                  <button type="button" className="auth-ghost" onClick={restart}>Изменить адрес</button>
                  <div className="auth-small">Не пришло письмо? Проверьте папку «Спам» или нажмите «Отправить снова».</div>
                </div>
              </motion.form>
            )}

            {stage === 'done' && (
              <motion.div
                className="auth-verified"
                key="done"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
              >
                <h2 className="auth-title">Добро пожаловать!</h2>
                <div className="verified-sub">Вы успешно вошли как <strong>{email}</strong>.</div>
                <div style={{ marginTop: 14 }}>
                  <button className="auth-submit" onClick={() => window.location.reload()}>Перейти в лобби</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default Login;
