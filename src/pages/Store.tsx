import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import '../styles/Store.css';

type ChipPack = { id: string; chips: number; price: string; bonus?: string; desc?: string };
type SubPlan = { id: string; title: string; price: string; perks: string[]; tag?: string };

const CHIP_PACKS: ChipPack[] = [
  { id: 'p1', chips: 10000, price: '99₽', bonus: '', desc: 'Начальный пакет' },
  { id: 'p2', chips: 25000, price: '149₽', bonus: '+5%', desc: 'Популярный пакет' },
  { id: 'p3', chips: 50000, price: '249₽', bonus: '+10%', desc: 'Выгодный выбор' },
  { id: 'p4', chips: 100000, price: '349₽', bonus: '+20%', desc: 'Профессиональный пакет' },
];

const SUB_PLANS: SubPlan[] = [
  {
    id: 's1',
    title: '1 месяц',
    price: '199₽ / мес',
    tag: 'Лучшее',
    perks: [
      'Каждую неделю по 30.000 фишек',
      'Кастомизация профиля',
      'Создание приватных лобби',
      'Участие в турнирах',
    ],
  },
];

const PAYMENT_METHODS = [
  { id: 'pm1', name: 'СБП', img: '/assets/payments/sbp_icon.svg' },
  { id: 'pm2', name: 'Мир', img: '/assets/payments/mir_icon.svg' },
  { id: 'pm3', name: 'Visa', img: '/assets/payments/visa_icon.svg' },
  { id: 'pm4', name: 'MasterCard', img: '/assets/payments/mastercard_icon.svg' },
];

const Store: React.FC = () => {
  const navigate = useNavigate();
  const [selectedPack, setSelectedPack] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  const handleBuyChips = (pack: ChipPack) => {
    const ok = window.confirm(`Купить ${pack.chips.toLocaleString('ru-RU')} фишек за ${pack.price}?`);
    if (!ok) return;
    // TODO: реальная интеграция с бэкендом/платежной системой
    alert(`Покупка оформлена — ${pack.chips.toLocaleString('ru-RU')} фишек за ${pack.price} (имитация).`);
    setSelectedPack(pack.id);
  };

  const handleSubscribe = (plan: SubPlan) => {
    const ok = window.confirm(`Оформить подписку ${plan.title} — ${plan.price}?`);
    if (!ok) return;
    // TODO: интеграция с платежным провайдером и бэкендом
    alert(`Подписка ${plan.title} оформлена (имитация). Спасибо!`);
    setSelectedPlan(plan.id);
  };

  return (
    <div className="store-page">
      <div className="store-container">
        <motion.header className="store-header" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <h1>Магазин</h1>
          <p className="store-sub">Подписки, покупка фишек и безопасные способы оплаты. Всё честно и прозрачно.</p>
        </motion.header>

        <div className="store-grid">
          {/* Left column: Subscriptions */}
          <section className="store-column">
            <h2>Подписка</h2>
            <p className="muted">Оформи премиум-подписку и получай регулярные фишки и дополнительные возможности.</p>

            <div className="plans-row">
              {SUB_PLANS.map((p) => (
                <motion.article
                  key={p.id}
                  className={`plan-card ${selectedPlan === p.id ? 'selected' : ''}`}
                  whileHover={{ translateY: -6 }}
                  onClick={() => handleSubscribe(p)}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSubscribe(p);
                    }
                  }}
                  aria-pressed={selectedPlan === p.id}
                >
                  <div className="plan-top">
                    <h3>{p.title}</h3>
                    {p.tag && <span className="plan-tag">{p.tag}</span>}
                  </div>
                  <div className="plan-price">{p.price}</div>
                  <ul className="plan-perks">
                    {p.perks.map((perk, i) => <li key={i}>{perk}</li>)}
                  </ul>
                  <div className="plan-cta">
                    <button
                      className="btn-primary"
                      onClick={(e) => { e.stopPropagation(); handleSubscribe(p); }}
                      aria-label={`Оформить подписку ${p.title}`}
                    >
                      Оформить подписку
                    </button>
                  </div>
                </motion.article>
              ))}
            </div>

            <div className="store-fineprint">
              <h4>Условия</h4>
              <p className="muted">Подписка автоматически продлевается. Отменить можно в настройках аккаунта. Возвраты зависят от платёжных правил.</p>
            </div>
          </section>

          {/* Right column: Buy chips & payment methods */}
          <aside className="store-column store-aside">
            <h2>Купить фишки</h2>
            <p className="muted">Выберите пакет фишек и способ оплаты. Цены указаны в рублях.</p>

            <div className="chips-grid">
              {CHIP_PACKS.map((pack) => (
                <motion.div
                  key={pack.id}
                  className={`chip-pack ${selectedPack === pack.id ? 'selected' : ''}`}
                  whileHover={{ translateY: -6 }}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleBuyChips(pack);
                    }
                  }}
                  onClick={() => handleBuyChips(pack)}
                  role="button"
                  aria-pressed={selectedPack === pack.id}
                >
                  <div className="chip-pack-left">
                    <div className="chip-amount">
                      <img
                        src="/assets/poker_chips.png"
                        alt="chips"
                        className="chip-icon"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/assets/cards/cardRedBack.png'; }}
                      />
                      {pack.chips.toLocaleString('ru-RU')}
                    </div>
                    <div className="chip-desc">{pack.desc}</div>
                  </div>
                  <div className="chip-pack-right">
                    <div className="chip-price">{pack.price}</div>
                    {pack.bonus && <div className="chip-bonus">{pack.bonus}</div>}
                    <button className="btn-ghost" onClick={(e) => { e.stopPropagation(); handleBuyChips(pack); }}>Купить</button>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="payments">
              <h3>Способы оплаты</h3>
              <div className="payments-row">
                {PAYMENT_METHODS.map((pm) => (
                  <div className="payment-item" key={pm.id}>
                    <img src={pm.img} alt={pm.name} onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/assets/payments/generic-pay.svg'; }} />
                    <span>{pm.name}</span>
                  </div>
                ))}
              </div>
              <p className="muted small">Все платежи защищены и проходят через надёжных платёжных провайдеров. Мы не храним данные карт на наших серверах.</p>
            </div>

            <div className="support-cta">
              <button className="btn-primary" onClick={() => navigate('/support')}>Связаться с поддержкой</button>
            </div>
          </aside>
        </div>

        <section className="store-faq">
          <h3>FAQ — Частые вопросы</h3>
          <details>
            <summary>Можно ли вернуть средства?</summary>
            <p className="muted">Возвраты зависят от платёжной системы. По вопросам возврата обращайтесь в поддержку.</p>
          </details>

          <details>
            <summary>Что даёт подписку?</summary>
            <p className="muted">Подписка даёт регулярные фишки, кастомизацию профиля, возможность создавать приватные лобби и участвовать в турнирах.</p>
          </details>

          <details>
            <summary>Можно ли купить фишки оффлайн?</summary>
            <p className="muted">Пока нет. В будущем планируем добавить локальные способы оплаты и партнёрские магазины.</p>
          </details>
        </section>
      </div>
    </div>
  );
};

export default Store;
