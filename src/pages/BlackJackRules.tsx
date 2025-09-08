import React from 'react';
import { motion } from 'framer-motion';
import '../styles/blackjack-rules.css';

const CardExample: React.FC<{ src: string; alt?: string }> = ({ src, alt }) => (
  <div className="bj-example-card">
    <img
      src={src}
      alt={alt ?? 'card'}
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).src = '/assets/cards/cardRedBack.png';
      }}
    />
  </div>
);

const BlackJackRules: React.FC = () => {
  return (
    <div className="bj-page">
      <div className="bj-container">
        <motion.header initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.32 }}>
          <h1>BlackJack — правила</h1>
          <p className="bj-lead">
            Короткое и понятное руководство по классическому блекджеку на платформе OracleGame.
            Здесь описаны базовые правила, поведение дилера, варианты ставок и выплаты.
          </p>
        </motion.header>

        <main className="bj-main">
          <section className="bj-section">
            <h2>Обзор</h2>
            <p>
              BlackJack (21) — карточная игра, где цель игрока — набрать сумму очков ближе к 21, чем у дилера,
              но не превышая 21. Игра ведётся против дилера (казино), а не против других игроков.
            </p>
          </section>

          <section className="bj-section">
            <h2>Значение карт</h2>
            <ul className="bj-list">
              <li>2–10 — номинал карты равен её числу.</li>
              <li>J, Q, K — каждая стоит 10 очков.</li>
              <li>
                A (туз) — может считаться как <strong>1</strong> или <strong>11</strong>, в зависимости от выгодного для руки значения.
                Пример: если у вас {`A + 9`} — туз считается как 11 → 20. Если у вас {`A + 9 + K`} — туз будет засчитан как 1, чтобы не было перебора
                (1 + 9 + 10 = 20).
              </li>
            </ul>

            <div className="bj-examples-row" aria-hidden>
              <div className="bj-examples-col">
                <div className="ex-title">Туз считается как 11 — A + 9 = 20</div>
                <div className="cards-row">
                  <CardExample src="/assets/cards/ace_of_spades.png" alt="Ace" />
                  <CardExample src="/assets/cards/9_of_hearts.png" alt="9" />
                </div>
              </div>

              <div className="bj-examples-col">
                <div className="ex-title">Туз пересчитан как 1, чтобы избежать перебора — A + 9 + K = 20</div>
                <div className="cards-row">
                  <CardExample src="/assets/cards/ace_of_spades.png" alt="Ace" />
                  <CardExample src="/assets/cards/9_of_hearts.png" alt="9" />
                  <CardExample src="/assets/cards/king_of_clubs2.png" alt="King" />
                </div>
              </div>
            </div>
          </section>

          <section className="bj-section">
            <h2>Ход игры (общее)</h2>
            <ol className="bj-ordered">
              <li>Игроки ставят свои фишки (bet).</li>
              <li>Дилер раздаёт по две карты игрокам и себе (обычно одна карта дилера закрыта).</li>
              <li>Игроки по очереди принимают решения: <strong>Hit</strong> (взять карту), <strong>Stand</strong> (остаться),
                <strong>Double</strong> (удвоить ставку и получить ровно одну карту), <strong>Split</strong> (разделить пару), <strong>Surrender</strong> (сдаться) — если доступно).</li>
              <li>Когда все игроки завершили, дилер открывает свою закрытую карту и добирает по правилам дилера.</li>
              <li>Сравнение: победители получают выплаты, ничья — возврат ставки (push), проигрыш — ставка теряется.</li>
            </ol>
          </section>

          <section className="bj-section">
            <h2>Поведение дилера</h2>
            <p>
              Дилер действует строго по правилам:
            </p>
            <ul className="bj-list">
              <li>Дилер обязан добирать карту, если у него меньше 17 очков.</li>
              <li>Если у дилера "мягкая" сумма (soft) 17 — правило зависит от варианта: на нашей платформе дилер <strong>останавливается на 17</strong> (то есть не берёт при soft 17).</li>
              <li>Если у дилера больше 21 — он "перебрал" (bust) — все оставшиеся игроки выигрывают.</li>
            </ul>
          </section>

          <section className="bj-section">
            <h2>Натуральный (Blackjack) и выплаты</h2>
            <p>
              Если первые две карты игрока дают 21 (A + 10-карта), это именуется "натуральный" или Blackjack.
              Натуральный обычно оплачивается по коэффициенту <strong>3:2</strong> (ставка 100 → выплата 250: игрок получает обратно 150 прибыли + возвращается ставка).
            </p>

            <ul className="bj-list">
              <li>Если у игрока натуральный, а у дилера натуральный — это ничья (push), ставка возвращается.</li>
              <li>Если у игрока натуральный, а у дилера нет — игрок получает выплату 3:2.</li>
              <li>Обычная выигрышная рука — выплата 1:1 (ставка возвращается + равный выигрыш).</li>
            </ul>
          </section>

          <section className="bj-section">
            <h2>Split, Double и Insurance</h2>
            <dl className="bj-dl">
              <dt>Split</dt>
              <dd>
                Если первые две карты одинакового ранга (например, 8+8), игрок может разделить их на две отдельные руки, поставив дополнительно ещё одну ставку равную первоначальной.
                Далее каждая рука играется отдельно.
              </dd>

              <dt>Double (удвоение)</dt>
              <dd>
                Игрок удваивает ставку, получает ровно одну карту и больше не может брать. Обычно доступно только сразу после раздачи (в некоторых вариантах также после Split).
              </dd>

              <dt>Insurance (страховка)</dt>
              <dd>
                Если у дилера открытая карта — туз, игрокам предлагается страховать свою ставку. Страховка — отдельная ставка до половины первоначальной.
                Если дилер имеет натуральный — страховка оплачивается 2:1; иначе страховка теряется.
                На нашей платформе страховка доступна/отображается в UI, но использовать её не обязательно.
              </dd>
            </dl>
          </section>

          <section className="bj-section">
            <h2>Примеры выплат</h2>
            <ul className="bj-list">
              <li>Ставка 100, обычный выигрыш → получаете 200 (ставка 100 + выигрыш 100).</li>
              <li>Ставка 100, натуральный → получаете 250 (ставка 100 + выигрыш 150).</li>
              <li>Ставка 100, дилер перебрал → получаете 200 (ставка 100 + выигрыш 100).</li>
            </ul>
          </section>

          <section className="bj-section">
            <h2>Советы и добросовестная игра</h2>
            <p>
              OracleGame стремится обеспечить честную и комфортную игру. Рекомендуем:
            </p>
            <ul className="bj-list">
              <li>Не использовать сторонние программы и не пытаться манипулировать клиентом — это нарушает правила.</li>
              <li>Играйте ответственно — используйте только виртуальные фишки и не пытайтесь обменивать их на реальные деньги.</li>
              <li>При возникновении спорных ситуаций обращайтесь в техподдержку и прикладывайте скриншоты/логи комнаты.</li>
            </ul>
          </section>

          <section className="bj-section bj-contact">
            <h2>Техподдержка и жалобы</h2>
            <p>
              Если вы заметили нарушение правил или технический баг — сообщите через раздел "Техподдержка" или форму "Сообщить о нарушении".
              Укажите как можно больше информации: ID комнаты, время, описания действий и скриншоты.
            </p>

            <div className="bj-actions-row">
              <a href="/support" className="bj-btn bj-btn-primary">Открыть техподдержку</a>
              <a href="/report" className="bj-btn bj-btn-ghost">Сообщить о нарушении</a>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
};

export default BlackJackRules;
