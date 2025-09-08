import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/PokerRules.css';

/**
 * PokerRules.tsx
 * Страница правил Poker (No-Limit Texas Hold'em).
 * - Показывает правила, порядок игры, ранжирование комбинаций с примерами (картинки).
 * - Завершается секцией "Полезные советы для новичков" и больше ничего не добавлено внизу.
 */

const comboExamples = [
  {
    key: 'royal',
    title: 'Royal Flush — Роял-флеш',
    desc: '10, J, Q, K, A одной масти — самая старшая комбинация.',
    cards: [
      '/assets/cards/10_of_spades.png',
      '/assets/cards/jack_of_spades.png',
      '/assets/cards/queen_of_spades.png',
      '/assets/cards/king_of_spades.png',
      '/assets/cards/ace_of_spades.png',
    ],
  },
  {
    key: 'straight-flush',
    title: 'Straight Flush — Стрит-флеш',
    desc: 'Пять последовательных карт одной масти (не Роял).',
    cards: [
      '/assets/cards/6_of_hearts.png',
      '/assets/cards/7_of_hearts.png',
      '/assets/cards/8_of_hearts.png',
      '/assets/cards/9_of_hearts.png',
      '/assets/cards/10_of_hearts.png',
    ],
  },
  {
    key: 'four',
    title: 'Four of a Kind — Каре',
    desc: 'Четыре карты одного ранга + любая пятая карта.',
    cards: [
      '/assets/cards/ace_of_clubs.png',
      '/assets/cards/ace_of_hearts.png',
      '/assets/cards/ace_of_spades.png',
      '/assets/cards/ace_of_diamonds.png',
      '/assets/cards/9_of_hearts.png',
    ],
  },
  {
    key: 'full-house',
    title: 'Full House — Фул-хаус',
    desc: 'Три одинаковые карты + пара.',
    cards: [
      '/assets/cards/king_of_spades.png',
      '/assets/cards/king_of_hearts.png',
      '/assets/cards/king_of_diamonds.png',
      '/assets/cards/8_of_clubs.png',
      '/assets/cards/8_of_spades.png',
    ],
  },
  {
    key: 'flush',
    title: 'Flush — Флеш',
    desc: 'Пять карт одной масти (не подряд).',
    cards: [
      '/assets/cards/2_of_clubs.png',
      '/assets/cards/6_of_clubs.png',
      '/assets/cards/9_of_clubs.png',
      '/assets/cards/jack_of_clubs.png',
      '/assets/cards/queen_of_clubs.png',
    ],
  },
  {
    key: 'straight',
    title: 'Straight — Стрит',
    desc: 'Пять последовательных карт разных мастей.',
    cards: [
      '/assets/cards/5_of_diamonds.png',
      '/assets/cards/6_of_clubs.png',
      '/assets/cards/7_of_spades.png',
      '/assets/cards/8_of_hearts.png',
      '/assets/cards/9_of_diamonds.png',
    ],
  },
  {
    key: 'three',
    title: 'Three of a Kind — Сет',
    desc: 'Три карты одного ранга + две любые другие.',
    cards: [
      '/assets/cards/4_of_hearts.png',
      '/assets/cards/4_of_spades.png',
      '/assets/cards/4_of_diamonds.png',
      '/assets/cards/9_of_clubs.png',
      '/assets/cards/king_of_hearts.png',
    ],
  },
  {
    key: 'two-pair',
    title: 'Two Pair — Две пары',
    desc: 'Две пары разных рангов + одна дополнительная карта.',
    cards: [
      '/assets/cards/10_of_hearts.png',
      '/assets/cards/10_of_clubs.png',
      '/assets/cards/7_of_spades.png',
      '/assets/cards/7_of_diamonds.png',
      '/assets/cards/2_of_hearts.png',
    ],
  },
  {
    key: 'pair',
    title: 'Pair — Пара',
    desc: 'Две карты одинакового ранга + три дополнительные карты.',
    cards: [
      '/assets/cards/jack_of_hearts.png',
      '/assets/cards/jack_of_clubs.png',
      '/assets/cards/3_of_spades.png',
      '/assets/cards/8_of_hearts.png',
      '/assets/cards/2_of_clubs.png',
    ],
  },
  {
    key: 'high-card',
    title: 'High Card — Старшая карта',
    desc: 'Если нет комбинации — побеждает самая старшая карта.',
    cards: [
      '/assets/cards/ace_of_hearts.png',
      '/assets/cards/9_of_spades.png',
      '/assets/cards/7_of_clubs.png',
      '/assets/cards/4_of_diamonds.png',
      '/assets/cards/2_of_hearts.png',
    ],
  },
];

const PokerRules: React.FC = () => {
  return (
    <div className="poker-rules-page">
      <div className="rules-inner">
        <header className="rules-header">
          <h1>Poker — Правила (No-Limit Texas Hold'em)</h1>
          <p className="rules-lead">
            Короткий обзор правил и ключевых моментов игры. Эта страница объясняет порядок игры, ранжирование комбинаций и даёт полезные советы для новичков.
          </p>
        </header>

        <nav className="rules-nav">
          <Link to="/poker" className="back-to-table">← Вернуться к столу</Link>
        </nav>

        <section className="rules-section">
          <h2>Общий порядок игры</h2>
          <ol>
            <li><strong>Раздача</strong>: каждому игроку раздают по 2 закрытые карты (hole cards).</li>
            <li><strong>Блайнды</strong>: до начала раздачи два игрока ставят малый и большой блайнд.</li>
            <li><strong>Раунды ставок</strong>: preflop → flop → turn → river. Между этапами игроки делают ставки, коллы, рейзы, чек или фолд.</li>
            <li><strong>Флоп / Тёрн / Ривер</strong>: открываются 3 карты (флоп), затем 1 (тёрн), затем последняя (ривер).</li>
            <li><strong>Шоудаун</strong>: если после всех ставок остаются 2+ игрока — вскрывают карты и сравнивают комбинации.</li>
            <li><strong>No-Limit</strong>: в любой момент игрок может поставить любые фишки (all-in) в пределах своего стека.</li>
          </ol>
        </section>

        <section className="rules-section">
          <h2>Порядок ставок и общие рекомендации</h2>
          <p>
            Ставки ведутся по очереди — игроки должны действовать тогда, когда к ним приходит очередь. Ход переходит к следующему игроку только после того, как
            текущий игрок сделал допустимое действие (check/call/fold/raise/all-in). Повышение ставки (raise) требует реакции от остальных игроков — либо принять (call), либо ответить повышением, либо сбросить карты.
          </p>
          <p className="muted">
            В многопользовательской игре фронтенд показывает, чей сейчас ход. Сервер валидацию действий тоже проверяет — UI является дополнительной удобной подсказкой.
          </p>
        </section>

        <section className="rules-section combos">
          <h2>Ранжирование комбинаций (от старшей к младшей)</h2>
          <p className="muted">Внизу — примеры комбинаций. Нажмите на картинку, чтобы открыть в полном размере.</p>

          <div className="combos-grid">
            {comboExamples.map((c) => (
              <div className="combo-card" key={c.key}>
                <div className="combo-header">
                  <h3>{c.title}</h3>
                  <p className="combo-desc">{c.desc}</p>
                </div>

                <div className="combo-cards">
                  {c.cards.map((src, i) => (
                    <img
                      key={i}
                      src={src}
                      alt={`${c.title} card ${i + 1}`}
                      className="combo-card-img"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/assets/cards/cardRedBack.png'; }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rules-section">
          <h2>Шоудаун и деление банка</h2>
          <p>
            В шоудауне все оставшиеся в руке игроки показывают свои карты. Выигрывает игрок с лучшей 5-карточной комбинацией, собранной из 7 возможных карт (2 свои + 5 общих).
            Если несколько игроков имеют ровные лучшие комбинации, банк делится между ними (поровну или с учётом сайд-потов).
          </p>
          <p className="muted">
            В нашем движке возможны сайд-поты (если кто-то идёт all-in), и распределение происходит по правилам — вклад пользователя учитывается.
          </p>
        </section>

        <section className="rules-section">
          <h2>Поведение при дисконнекте</h2>
          <p>
            Если игрок отключается во время раунда, его место может быть сохранено (reconnect по PID). Если игрок не вернулся — по правилам конкретного стола его руки могут быть автоматически сброшены (fold), либо оставлены до конца хода — смотрите настройки столов.
          </p>
        </section>

        <section className="rules-section">
          <h2>Полезные советы для новичков</h2>
          <ul>
            <li><strong>Не играйте все фишки сразу.</strong> Научитесь оценивать силу руки и шансы на улучшение на флопе/тёрне/ривере.</li>
            <li><strong>Учитывайте позицию.</strong> Игроки, которые действуют последними, имеют преимущество — вы увидите реакции соперников прежде, чем действовать.</li>
            <li><strong>Будьте дисциплинированы.</strong> Fold — тоже правильное действие, если вероятность выиграть низка.</li>
            <li><strong>Чтение банок и оппонентов.</strong> Обращайте внимание на размеры ставок соперников: крупные рейзы часто означают сильную руку.</li>
            <li><strong>Практикуйтесь на малых ставках.</strong> Тренируйтесь в режиме с ботом, прежде чем переходить в игры с реальными людьми.</li>
          </ul>
        </section>

        {/* По запросу: НИЧЕГО после этого блока — убрано (нет 'подробная часть' и т.д.) */}

      </div>
    </div>
  );
};

export default PokerRules;
