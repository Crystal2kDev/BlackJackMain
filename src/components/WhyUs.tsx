import { motion } from 'framer-motion';
import '../styles/WhyUs.css';

const WhyUs: React.FC = () => {
  const advantages = [
    {
      icon: (
        <svg className="whyus-icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm0-14c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm0 10c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z" />
        </svg>
      ),
      title: 'Бесплатная игра',
      description: 'Наслаждайтесь блэкджеком без затрат, играйте в своё удовольствие!',
    },
    {
      icon: (
        <svg className="whyus-icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.30-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.30.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z" />
        </svg>
      ),
      title: 'Честный алгоритм',
      description: 'Наш RNG сертифицирован, обеспечивая справедливую игру.',
    },
    {
      icon: (
        <svg className="whyus-icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.22-1.79L9 14v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 3.08-2.05 5.95-4.9 7.39z" />
        </svg>
      ),
      title: 'Поддержка 24/7',
      description: 'Мы всегда на связи, чтобы помочь вам в любой момент.',
    },
    {
      icon: (
        <svg className="whyus-icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M11 18c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm-2-8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 4c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
        </svg>
      ),
      title: 'Внутриигровая валюта',
      description: 'Зарабатывайте фишки и участвуйте в крупных играх.',
    },
    {
      icon: (
        <svg className="whyus-icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2L1 7v10l11 5 11-5V7L12 2zm0 2.08L19.61 7 12 10.92 4.39 7 12 4.08zM3 8.86v7.28l9 4.05 9-4.05V8.86L12 13.58 3 8.86z" />
        </svg>
      ),
      title: 'Турниры',
      description: 'Соревнуйтесь с другими игроками за крупные призы.',
    },
    {
      icon: (
        <svg className="whyus-icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
        </svg>
      ),
      title: 'Простой интерфейс',
      description: 'Легко начать играть даже новичкам!',
    },
  ];

  const handleItemClick = (title: string) => {
    console.log(`Подробности о "${title}"`);
  };

  return (
    <section className="whyus">
      <h2 className="whyus-title">О нас</h2>
      <div className="whyus-grid">
        {advantages.map((advantage, index) => (
          <motion.div
            key={index}
            className="whyus-item"
            onClick={() => handleItemClick(advantage.title)}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut', delay: index * 0.2 }}
          >
            {advantage.icon}
            <h3 className="whyus-heading">{advantage.title}</h3>
            <p className="whyus-text">{advantage.description}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
};

export default WhyUs;