import { motion } from 'framer-motion';
import '../styles/why-us.css';

const WhyUs: React.FC = () => {
  const handleItemClick = (title: string) => {
    alert(`Подробности о "${title}"`);
  };

  const advantages = [
    {
      icon: (
        <svg className="why-us-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm0-14c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm0 10c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z" fill="#00b7eb"/>
        </svg>
      ),
      heading: 'Бесплатная игра',
      text: 'Наслаждайтесь блэкджеком без затрат, играйте в своё удовольствие!',
    },
    {
      icon: (
        <svg className="why-us-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65c-.03-.24-.24-.42-.49-.42h-4c-.25 0-.46.18-.49-.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z" fill="#00b7eb"/>
        </svg>
      ),
      heading: 'Честный алгоритм',
      text: 'Наш RNG сертифицирован, обеспечивая справедливую игру.',
    },
    {
      icon: (
        <svg className="why-us-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.22-1.79L9 14v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 3.08-2.05 5.95-4.9 7.39z" fill="#00b7eb"/>
        </svg>
      ),
      heading: 'Поддержка 24/7',
      text: 'Мы всегда на связи, чтобы помочь вам в любой момент.',
    },
    {
      icon: (
        <svg className="why-us-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M11 18c0 1.1-.9 2-2 2s-2-.9-2-2  .9-2 2-2 2 .9 2 2zm-2-8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 4c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" fill="#00b7eb"/>
        </svg>
      ),
      heading: 'Внутриигровая валюта',
      text: 'Зарабатывайте фишки и участвуйте в крупных играх.',
    },
    {
      icon: (
        <svg className="why-us-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" fill="#00b7eb"/>
        </svg>
      ),
      heading: 'Простой интерфейс',
      text: 'Легко начать играть даже новичкам!',
    },
  ];

  return (
    <section className="why-us">
      <h2 className="why-us-title">О нас</h2>
      <div className="why-us-grid">
        {advantages.map((adv, idx) => (
          <motion.div
            key={idx}
            className="why-us-item"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: idx * 0.2 }}
            onClick={() => handleItemClick(adv.heading)}
          >
            {adv.icon}
            <h3 className="why-us-heading">{adv.heading}</h3>
            <p className="why-us-text">{adv.text}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
};

export default WhyUs;
