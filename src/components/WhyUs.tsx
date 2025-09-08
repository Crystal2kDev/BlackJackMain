import React from 'react';
import { motion } from 'framer-motion';
import '../styles/why-us.css';

const assetsBase = '/assets/whyus';

const advantages = [
  {
    img: `${assetsBase}/freegame-icon.png`,
    alt: 'Бесплатная игра',
    heading: 'Бесплатная игра',
    text: 'Играй бесплатно и получай удовольствие без лишних затрат — идеален для практики и отдыха.',
  },
  {
    img: `${assetsBase}/fairgame-icon.png`,
    alt: 'Честность алгоритмов',
    heading: 'Честные алгоритмы',
    text: 'Мы придерживаемся прозрачных правил — игра строится на честных механизмах.',
  },
  {
    img: `${assetsBase}/usercare-icon.png`,
    alt: 'Поддержка',
    heading: 'Поддержка 24/7',
    text: 'Наша служба поддержки оперативно решает вопросы игроков и помогает в спорных ситуациях.',
  },
  {
    img: `${assetsBase}/currency-icon.png`,
    alt: 'Внутриигровая валюта',
    heading: 'Внутриигровая валюта',
    text: 'Зарабатывайте фишки, участвуйте в матчах и соревнованиях — всё в одном месте.',
  },
  {
    img: `${assetsBase}/tournaments-icon.png`,
    alt: 'Турниры',
    heading: 'Турниры',
    text: 'Регулярные турниры и рейтинговые события — проверьте свои навыки и поднимитесь в таблице.',
  },
  {
    img: `${assetsBase}/customprofile-icon.png`,
    alt: 'Кастомизация профиля',
    heading: 'Кастомизация профиля',
    text: 'Настройте профиль: аватар, ник и тему — сделайте аккаунт уникальным.',
  },
];

const cardVariant = {
  hidden: { opacity: 0, y: 12 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.42 } }),
};

const WhyUs: React.FC = () => {
  const handleItemClick = (title: string) => {
    // TODO: заменить alert на модалку при необходимости
    alert(`Подробности: ${title}`);
  };

  return (
    <section id="why-us" className="why-us" aria-labelledby="why-us-title">
      <div className="why-us-inner">
        <h2 id="why-us-title" className="why-us-title">Почему выбирают нас</h2>

        <div className="why-us-grid" role="list">
          {advantages.map((a, idx) => (
            <motion.div
              key={a.heading}
              className="why-us-item"
              role="button"
              tabIndex={0}
              onClick={() => handleItemClick(a.heading)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleItemClick(a.heading);
                }
              }}
              initial="hidden"
              animate="show"
              custom={idx}
              variants={cardVariant}
              aria-label={a.heading}
            >
              <div className="why-us-img-wrap">
                <img src={a.img} alt={a.alt} className="why-us-img" />
              </div>

              <div className="why-us-body">
                <h3 className="why-us-heading">{a.heading}</h3>
                <p className="why-us-text">{a.text}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default WhyUs;
