import { motion } from 'framer-motion';
import '../styles/why-us.css';

const WhyUs: React.FC = () => {
  const handleItemClick = (title: string) => {
    alert(`Подробности о "${title}"`);
  };

  const advantages = [
    {
      icon: (
        <svg className="why-us-icon" width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm0-14c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm0 10c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z" fill="#00b7eb"/>
        </svg>
      ),
      heading: 'Бесплатная игра',
      text: 'Наслаждайтесь блэкджеком без затрат — играйте для удовольствия и прокачки навыков.',
    },
    {
      icon: (
        <svg className="why-us-icon" width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65c-.03-.24-.24-.42-.49-.42h-4c-.25 0-.46.18-.49-.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z" fill="#00b7eb"/>
        </svg>
      ),
      heading: 'Честный алгоритм',
      text: 'RNG и логика игры прозрачны — честность и предсказуемость результатов.',
    },
    {
      icon: (
        <svg className="why-us-icon" width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.22-1.79L9 14v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 3.08-2.05 5.95-4.9 7.39z" fill="#00b7eb"/>
        </svg>
      ),
      heading: 'Поддержка 24/7',
      text: 'Команда поддержки всегда на связи — поможем с любым вопросом быстро.',
    },
    {
      icon: (
        <svg className="why-us-icon" width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M11 18c0 1.1-.9 2-2 2s-2-.9-2-2  .9-2 2-2 2 .9 2 2zm-2-8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 4c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" fill="#00b7eb"/>
        </svg>
      ),
      heading: 'Внутриигровая валюта',
      text: 'Зарабатывайте фишки, ставьте и соревнуйтесь в турнирах и лобби.',
    },
    {
      icon: (
        <svg className="why-us-icon" width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2L1 7v10l11 5 11-5V7L12 2zm0 2.08L19.61 7 12 10.92 4.39 7 12 4.08zM3 8.86v7.28l9 4.05 9-4.05V8.86L12 13.58 3 8.86z" fill="#00b7eb"/>
        </svg>
      ),
      heading: 'Турниры',
      text: 'Регулярные турниры с рейтингом и призовыми фишками — проверьте свои навыки.',
    },
    {
      icon: (
        <svg className="why-us-icon" width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 3C8.13 3 5 6.13 5 10c0 2.5 1.5 4.67 3.76 5.6L9 20l3-1 3 1-0.76-4.4C17.5 14.67 19 12.5 19 10c0-3.87-3.13-7-7-7zm0 2c2.76 0 5 2.24 5 5 0 1.66-1 3.11-2.5 3.8L15 17l-3-1-3 1 0.5-6.2C8 13.11 7 11.66 7 10c0-2.76 2.24-5 5-5z" fill="#00b7eb"/>
        </svg>
      ),
      heading: 'Кастомизация профиля',
      text: 'Настраивайте аватар, псевдоним и тему профиля — сделайте свой аккаунт уникальным.',
    },
  ];

  return (
    <section className="why-us">
      <h2 className="why-us-title">О нас</h2>
      <div className="why-us-grid">
        {advantages.map((advantage, index) => (
          <motion.div
            key={index}
            className="why-us-item"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut', delay: index * 0.12 }}
            onClick={() => handleItemClick(advantage.heading)}
          >
            {advantage.icon}
            <h3 className="why-us-heading">{advantage.heading}</h3>
            <p className="why-us-text">{advantage.text}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
};

export default WhyUs;
