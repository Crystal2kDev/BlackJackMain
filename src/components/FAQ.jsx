import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import '../styles/faq.css';

function FAQ() {
  const [openQuestion, setOpenQuestion] = useState(null);

  const faqData = [
    { 
      question: 'Что такое эта игра?', 
      answer: 'Это настольная карточная игра, где вы можете играть в блэкджек с друзьями или против компьютера, используя внутриигровые фишки. Денежные выводы не поддерживаются, но вы можете приобрести фишки и VIP-статус для улучшения игрового опыта.' 
    },
    { 
      question: 'Как начать играть?', 
      answer: 'Зарегистрируйтесь или войдите в аккаунт через раздел "Вход" или "Регистрация". После этого выберите режим игры в разделе "Игра" и используйте фишки для ставок.' 
    },
    { 
      question: 'Что даёт VIP-статус?', 
      answer: 'VIP-статус предоставляет доступ к эксклюзивным столам, кастомизации интерфейса, дополнительным фишкам и приоритетной поддержке.' 
    },
    { 
      question: 'Как купить фишки или VIP-статус?', 
      answer: 'Перейдите в раздел "Магазин" в вашем аккаунте, выберите нужный пакет фишек или VIP-статус и следуйте инструкциям для оплаты.' 
    },
    { 
      question: 'Можно ли вывести деньги?', 
      answer: 'Нет, это настольная игра, а не казино. Все фишки используются только внутри игры, и вывод средств не предусмотрен.' 
    },
    { 
      question: 'Безопасно ли играть?', 
      answer: 'Да, мы используем современное шифрование для защиты ваших данных. Ваши покупки и игровой прогресс надёжно хранятся.' 
    },
  ];

  const toggleQuestion = (index) => {
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
            <div key={index} className="faq-item" style={{ '--index': index }}>
              <div 
                className="faq-question" 
                onClick={() => toggleQuestion(index)}
              >
                <span>{item.question}</span>
                <svg 
                  className={`arrow-icon ${openQuestion === index ? 'open' : ''}`}
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="#ffffff" 
                  strokeWidth="2"
                >
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
}

export default FAQ;