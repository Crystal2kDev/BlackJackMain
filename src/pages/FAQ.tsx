import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import '../styles/faq.css';

const FAQ: React.FC = () => {
  const [openQuestion, setOpenQuestion] = useState<number | null>(0);

  const toggleQuestion = (index: number) => {
    setOpenQuestion(openQuestion === index ? null : index);
    const el = document.getElementById(`faq-item-${index}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  // Без технических деталей — только безопасная пользовательская информация
  const faqData = [
    {
      question: 'Что такое OracleGame?',
      answer:
        'OracleGame — современная онлайн-платформа для карточных настольных игр. ' +
        'Мы предоставляем возможность бесплатно играть в популярные игры (BlackJack, Poker и др.) — как против бота, так и в приватных комнатах с друзьями. ' +
        'Проект ориентирован на честную и приятную игровую атмосферу.'
    },
    {
      question: 'Можно ли вывести внутриигровые фишки за реальные деньги?',
      answer:
        'Нет. Все фишки и внутриигровые валюты являются виртуальными и используются только внутри платформы. ' +
        'Платформа не предоставляет услуги обмена внутриигровых фишек на реальные средства.'
    },
    {
      question: 'Как создать аккаунт и зачем он нужен?',
      answer:
        'Регистрация нужна для сохранения прогресса, истории игр, создания приватных лобби и доступа к персональным настройкам. ' +
        'Регистрация производится через email-код. Вы также сможете восстановить доступ по e-mail.'
    },
    {
      question: 'Безопасно ли хранится моя информация?',
      answer:
        'Мы храним минимально необходимую информацию и применяем стандартные меры безопасности. ' +
        'Рекомендуем использовать уникальные пароли и не передавать данные аккаунта третьим лицам.'
    },
    {
      question: 'Что делать, если заметил подозрительную активность?',
      answer:
        'Немедленно сообщите в техподдержку или используйте форму "Сообщить о нарушении". ' +
        'Укажите как можно больше деталей (время, ID комнаты, скриншоты) — это ускорит проверку.'
    },
    {
      question: 'Какие правила поведения на платформе?',
      answer:
        'Запрещены мошенничество, использование читов, сговор с целью манипуляции, оскорбления и преследование. ' +
        'За нарушения применяются санкции: предупреждение, временная или постоянная блокировка.'
    },
    {
      question: 'Как связаться с поддержкой?',
      answer:
        'Через страницу Техподдержки, форму «Сообщить о нарушении» или официальный канал связи (ссылки в шапке/футере сайта). ' +
        'При обращении указывайте как можно больше данных по проблеме.'
    },
    {
      question: 'Можно ли играть с мобильного устройства?',
      answer:
        'Да — интерфейс адаптивен и поддерживает мобильные браузеры. Для удобства на мобильных устройствах рекомендуем использовать горизонтальную ориентацию экрана.'
    },
    {
      question: 'Что даёт VIP/платные функции?',
      answer:
        'VIP/покупки касаются в основном косметики, удобств интерфейса и приоритета поддержки. Они не дают возможности выводить фишки или обходить правила игры.'
    },
    {
      question: 'Что делать, если игра зависла или потерялось соединение?',
      answer:
        'Попробуйте перезагрузить страницу или повторно подключиться. Сервер сохраняет состояние комнаты, поэтому в большинстве случаев можно корректно восстановиться. Если проблема повторяется — обратитесь в техподдержку.'
    },
    {
      question: 'Где найти правила Poker и BlackJack?',
      answer:
        'Подробные правила каждой игры доступны на соответствующих страницах сайта: "Poker — правила" и "BlackJack — правила".'
    },
    {
      question: 'Политика покупок и возвратов',
      answer:
        'Покупки относятся к косметике и платным опциям. Возвраты зависят от условий платёжного провайдера и нашей политики — в спорных случаях обращайтесь в техподдержку.'
    }
  ];

  const sections = [
    { id: 'overview', title: 'Обзор' },
    { id: 'chips', title: 'Фишки' },
    { id: 'accounts', title: 'Аккаунты' },
    { id: 'rules', title: 'Правила' },
    { id: 'support', title: 'Поддержка' },
    { id: 'games', title: 'Игры' },
    { id: 'legal', title: 'Юридическое' },
  ];

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="faq-page">
      <div className="faq-container">
        <header className="faq-header">
          <motion.h1 initial={{ y: -8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.36 }}>
            Часто задаваемые вопросы — OracleGame
          </motion.h1>
          <p className="faq-lead">
            Здесь размещены полезные и безопасные ответы для игроков. Если не нашли нужную информацию — свяжитесь с техподдержкой.
          </p>

          <nav className="faq-toc" aria-label="Оглавление FAQ">
            {sections.map((s) => (
              <button key={s.id} className="toc-link" onClick={() => scrollTo(s.id)}>
                {s.title}
              </button>
            ))}
          </nav>
        </header>

        <main className="faq-main">
          <section id="overview" className="faq-section">
            <h2>Обзор</h2>
            <p>
              OracleGame — это площадка для бесплатной игры в настольные карточные игры онлайн. Здесь вы сможете играть как против бота, так и в приватных комнатах с друзьями.
            </p>
          </section>

          <section id="chips" className="faq-section">
            <h2>Фишки и внутренняя валюта</h2>
            <p>
              Все внутриигровые фишки — виртуальные и действуют только внутри платформы. Они не подлежат обмену на реальные деньги.
            </p>
          </section>

          <section id="accounts" className="faq-section">
            <h2>Аккаунты и безопасность</h2>
            <p>
              Регистрация сохраняет ваш прогресс и открывает дополнительные возможности (приватные лобби, история). Для безопасности используйте надежные пароли и не передавайте доступ третьим лицам.
            </p>
          </section>

          <section id="rules" className="faq-section">
            <h2>Правила поведения</h2>
            <p>
              Соблюдайте честную игру и уважительное общение. Запрещены мошенничество, использование внешних программ и сговоры. Нарушения ведут к санкциям.
            </p>
          </section>

          <section id="support" className="faq-section">
            <h2>Поддержка</h2>
            <p>
              Для вопросов и жалоб используйте страницу Техподдержки или форму "Сообщить о нарушении". Укажите как можно больше деталей (время, ID комнаты, скриншоты).
            </p>
            <div className="support-cta-row">
              <a href="/support" className="support-button">Открыть техподдержку</a>
              <a href="/report" className="support-ghost">Сообщить о нарушении</a>
            </div>
          </section>

          <section id="games" className="faq-section">
            <h2>Игровые режимы</h2>
            <p>
              На платформе доступны BlackJack и Poker. Подробные правила каждой игры находятся на отдельных страницах с руководствами.
            </p>
          </section>

          <section id="legal" className="faq-section">
            <h2>Юридическая информация</h2>
            <p>
              OracleGame не является оператором азартных игр. Пользование платформой должно соответствовать законодательству вашей страны. При юридических вопросах — консультируйтесь со специалистами.
            </p>
          </section>

          <section className="faq-section">
            <h2>Развернутые вопросы</h2>
            <div className="faq-list">
              {faqData.map((item, index) => (
                <div className="faq-item-wrapper" id={`faq-item-${index}`} key={index}>
                  <div
                    className={`faq-item-head ${openQuestion === index ? 'open' : ''}`}
                    role="button"
                    aria-expanded={openQuestion === index}
                    onClick={() => toggleQuestion(index)}
                  >
                    <span className="faq-q-number">{String(index + 1).padStart(2, '0')}</span>
                    <span className="faq-question-text">{item.question}</span>
                    <svg className={`arrow-icon ${openQuestion === index ? 'open' : ''}`} viewBox="0 0 24 24" fill="none">
                      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>

                  <AnimatePresence initial={false}>
                    {openQuestion === index && (
                      <motion.div
                        key="answer"
                        className="faq-answer"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.28 }}
                      >
                        <div className="faq-answer-inner">
                          <p>{item.answer}</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
};

export default FAQ;
