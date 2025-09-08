import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import WhyUs from '../components/WhyUs';
import '../styles/Landing.css';

const Landing: React.FC = () => {
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  const cardImages = [
    '/assets/cards/ace_of_spades.png',
    '/assets/cards/3_of_spades.png',
    '/assets/cards/jack_of_clubs2.png',
  ];

  const steps = [
    {
      icon: '🃏',
      heading: 'Создайте аккаунт',
      text: 'Регистрация занимает пару минут — сохраняйте прогресс и создавайте приватные лобби.'
    },
    {
      icon: '💡',
      heading: 'Изучите правила',
      text: 'Встроенные подсказки и быстрый гайд по блэкджеку и покеру помогут быстро освоиться.'
    },
    {
      icon: '🎮',
      heading: 'Начните играть',
      text: 'Выбирайте режим: против бота, приватные комнаты с друзьями или публичные лобби.'
    }
  ];

  return (
    <>
      <div className="landing">
        <div className="landing-hero">
          <div className="landing-text">
            <h1 className="landing-text-title">
              Что такое <span>OracleGame?</span>
            </h1>

            <section className="landing-about" aria-labelledby="about-title">
              <p id="about-title" className="about-desc">
                OracleGame — современная онлайн-платформа для карточных настольных игр. Мы даём возможность бесплатно играть в
                классические игры: BlackJack, Poker и другие — как против умного бота, так и в приватных комнатах с друзьями.
                Интуитивный интерфейс, адаптивный дизайн и плавная анимация создают комфортное игровое погружение.
              </p>
            </section>

            <p className="landing-text-description">
              Соревнуйтесь, общайтесь и повышайте мастерство: турниры, косметика и приватные лобби — всё это в планах платформы.
            </p>

            <div className="hero-cta-row">
              <Link to="/lobby" aria-label="Начать игру">
                <motion.button
                  className="landing-button"
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Начать игру
                </motion.button>
              </Link>

              <Link to="/faq" className="landing-cta-muted" aria-label="Часто задаваемые вопросы">
                Часто задаваемые вопросы
              </Link>
            </div>
          </div>

          <div className="landing-cards-container" aria-hidden>
            <div className="landing-cards">
              {cardImages.map((src, index) => (
                <motion.img
                  key={index}
                  src={src}
                  alt={`Card ${index + 1}`}
                  className={`landing-card ${index === 0 ? 'landing-card-left' : index === 2 ? 'landing-card-right' : ''}`}
                  initial={{ y: -60, opacity: 0, rotate: index === 0 ? -6 : index === 2 ? 6 : 0 }}
                  animate={{ y: 0, opacity: 1, rotate: index === 0 ? -5 : index === 2 ? 5 : 0 }}
                  transition={{ duration: 0.6, ease: 'easeOut', delay: index * 0.12 }}
                  whileHover={{ scale: 1.06, boxShadow: '0 10px 30px rgba(0, 209, 255, 0.18)' }}
                  onMouseEnter={() => setHoveredCard(src)}
                  onMouseLeave={() => setHoveredCard(null)}
                  onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                    (e.currentTarget as HTMLImageElement).src = '/assets/cards/cardRedBack.png';
                  }}
                />
              ))}
            </div>

            <div className="cards-caption">
              Нажмите «Начать игру», чтобы сесть за стол и получить стартовый стек фишек.
            </div>
          </div>
        </div>

        <section className="landing-steps">
          <h2 className="landing-steps-title">Как начать играть?</h2>
          <div className="landing-steps-grid">
            {steps.map((step, index) => (
              <motion.div
                key={index}
                className="landing-step"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: 'easeOut', delay: index * 0.14 }}
              >
                <div className="landing-step-icon">{step.icon}</div>
                <h3 className="landing-step-heading">{step.heading}</h3>
                <p className="landing-step-text">{step.text}</p>
              </motion.div>
            ))}
          </div>
        </section>

        <WhyUs />
      </div>

      {/* Футер: фон на всю ширину, внутренний контейнер привязан к max-width */}
      <footer className="site-footer" role="contentinfo" aria-label="Footer">
        <div className="footer-inner">
          <div className="footer-columns" role="navigation" aria-label="Footer links">
            <div className="footer-col">
              <ul className="footer-list">
                <li className="footer-item">
                  <img className="footer-icon" src="/assets/footer/rules-icon.png" alt="Правила сайта" />
                  <Link to="/rules">Правила сайта</Link>
                </li>
                <li className="footer-item">
                  <img className="footer-icon" src="/assets/footer/store-icon.png" alt="Магазин" />
                  <Link to="/store">О магазине</Link>
                </li>
              </ul>
            </div>

            <div className="footer-col">
              <ul className="footer-list">
                <li className="footer-item">
                  <img className="footer-icon" src="/assets/footer/poker-icon.png" alt="Poker" />
                  <Link to="/poker-rules">Poker — правила</Link>
                </li>
                <li className="footer-item">
                  <img className="footer-icon" src="/assets/footer/blackjack-icon.png" alt="BlackJack" />
                  <Link to="/blackjack-rules">BlackJack — правила</Link>
                </li>
              </ul>
            </div>

            <div className="footer-col">
              <ul className="footer-list">
                <li className="footer-item">
                  <img className="footer-icon" src="/assets/footer/support-icon.png" alt="Поддержка" />
                  <Link to="/support">Техподдержка</Link>
                </li>
                <li className="footer-item">
                  <img className="footer-icon" src="/assets/footer/faq-icon.png" alt="FAQ" />
                  <Link to="/faq">Часто задаваемые вопросы</Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="footer-bottom" aria-hidden>
            <div className="footer-copy">© {new Date().getFullYear()} OracleGame</div>
          </div>
        </div>
      </footer>
    </>
  );
};

export default Landing;
