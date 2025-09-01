import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import '../styles/faq.css';

const FAQ: React.FC = () => {
  const [openQuestion, setOpenQuestion] = useState<number | null>(null);

  const faqData = [
    { question: 'Что такое эта игра?', answer: 'Это настольная карточная игра, где вы можете играть в блэкджек с друзьями или против компьютера, используя внутриигровые фишки.' },
    { question: 'Как начать играть?', answer: 'Зарегистрируйтесь или войдите в аккаунт через раздел "Вход" или "Регистрация". Затем выберите режим игры и используйте фишки для ставок.' },
    { question: 'Что даёт VIP-статус?', answer: 'VIP-статус предоставляет доступ к эксклюзивным столам, кастомизации интерфейса и приоритетной поддержке.' },
    { question: 'Можно ли вывести деньги?', answer: 'Нет, все фишки используются только внутри игры.' },
    { question: 'Безопасно ли играть?', answer: 'Да, используется современное шифрование для защиты ваших данных.' },
  ];

  const toggleQuestion = (index: number) => {
    setOpenQuestion(openQuestion === index ? null : index);
  };

  return (
    <div className="faq">
      <motion.div 
        className="faq-card"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      >
        <h2>Часто задаваемые вопросы</h2>
        <div className="faq-list">
          {faqData.map((item, index) => (
            <div key={index} className="faq-item" style={{ '--index': index } as React.CSSProperties}>
              <div className="faq-question" onClick={() => toggleQuestion(index)}>
                <span>{item.question}</span>
                <svg className={`arrow-icon ${openQuestion === index ? 'open' : ''}`} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </div>
              <AnimatePresence>
                {openQuestion === index && (
                  <motion.div 
                    className="faq-answer"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                  >
                    <p>{item.answer}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
        <a href="https://t.me/crystal_dev" className="support-button" target="_blank" rel="noopener noreferrer">
          Связаться с поддержкой
        </a>
      </motion.div>
    </div>
  );
};

export default FAQ;
