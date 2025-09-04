// src/pages/Poker.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import ioClient from 'socket.io-client';
import '../styles/Poker.css';

// pokersolver — CommonJS, поэтому берём default и достаём Hand
// @ts-ignore
import PokerSolver from 'pokersolver';
const { Hand } = PokerSolver as { Hand: any };

const SOCKET_URL = 'http://localhost:3000';

/* ---------- Types ---------- */
export type Card = { name: string; image: string; value?: number };
export type Seat = {
  pid: string | null;
  name?: string | null;
  chips: number;
  bet: number;
  cards: Card[];      // в публичном состоянии сервер шлёт [] до шоудауна
  isActive?: boolean;
  isDealer?: boolean;
  isAllIn?: boolean;
  folded?: boolean;
};

export type PokerStage =
  | 'waiting'
  | 'preflop'
  | 'flop'
  | 'turn'
  | 'river'
  | 'showdown'
  | 'results';

export interface PokerState {
  seats: Seat[];
  board: Card[];
  pot: number;
  sidePots?: { amount: number; eligiblePids: string[] }[];
  currentToActPid?: string | null;
  minRaise: number;
  smallBlind: number;
  bigBlind: number;
  stage: PokerStage;
  stateId?: number;
}

/* ---------- Defaults ---------- */
const DEFAULT_SEAT_COUNT = 6;
const makeEmptySeat = (): Seat => ({
  pid: null,
  name: null,
  chips: 0,
  bet: 0,
  cards: [],
  isActive: false,
  isDealer: false,
  isAllIn: false,
  folded: false,
});

const initialPokerState: PokerState = {
  seats: Array.from({ length: DEFAULT_SEAT_COUNT }, () => makeEmptySeat()),
  board: [],
  pot: 0,
  sidePots: [],
  currentToActPid: null,
  minRaise: 0,
  smallBlind: 50,
  bigBlind: 100,
  stage: 'waiting',
  stateId: 0,
};

/* ---------- Helpers ---------- */
function fillSeats(arr?: Seat[], len: number = DEFAULT_SEAT_COUNT): Seat[] {
  const base = Array.isArray(arr) ? [...arr] : [];
  if (base.length < len) {
    base.push(...Array.from({ length: len - base.length }, () => makeEmptySeat()));
  }
  return base.slice(0, len);
}

const CardView: React.FC<{ card?: Card; hidden?: boolean; className?: string }> = ({
  card,
  hidden,
  className,
}) => {
  const src = hidden ? '/assets/cards/cardRedBack.png' : card?.image ?? '/assets/cards/cardRedBack.png';
  const alt = hidden ? 'Hidden card' : card?.name ?? 'Card';
  return (
    <img
      className={`poker-card ${className ?? ''}`}
      src={src}
      alt={alt}
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).src = '/assets/cards/cardRedBack.png';
      }}
    />
  );
};

// 'T' -> '10' для pokersolver
const normalizeCode = (code?: string): string | null => {
  if (!code || code.length < 2) return null;
  const v = code[0];
  const s = code[1];
  return (v === 'T' ? '10' : v) + s;
};

const RUS_NAME: Record<string, string> = {
  'Royal Flush': 'Роял-флеш',
  'Straight Flush': 'Стрит-флеш',
  'Four of a Kind': 'Каре',
  'Full House': 'Фул-хаус',
  'Flush': 'Флеш',
  'Straight': 'Стрит',
  'Three of a Kind': 'Сет',
  'Two Pair': 'Две пары',
  'Pair': 'Пара',
  'High Card': 'Старшая карта',
};

function solveLabel(hole: Card[], board: Card[]): string {
  try {
    const codes = [
      ...hole.map((c) => normalizeCode(c.name)).filter(Boolean),
      ...board.map((c) => normalizeCode(c.name)).filter(Boolean),
    ] as string[];

    if (!Hand || codes.length < 5) return '—';
    const solved = Hand.solve(codes);
    const name: string | undefined = solved?.name;
    if (!name) return '—';
    return RUS_NAME[name] ?? name;
  } catch {
    return '—';
  }
}

/* ---------- Main ---------- */
const Poker: React.FC = () => {
  const [socket, setSocket] = useState<any | null>(null);

  // Публичное состояние от сервера
  const [state, setState] = useState<PokerState>(initialPokerState);

  // Локальные, НЕ затираемые публичным состоянием
  const [myPid, setMyPid] = useState<string | null>(null);
  const [myCards, setMyCards] = useState<Card[]>([]);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const s = ioClient(SOCKET_URL, { transports: ['websocket'], reconnection: true });
    setSocket(s);

    s.on('connect', () => {
      console.log('[poker] connected', s.id);
      setError(null);
      s.emit('poker/join', { roomId: 'defaultPokerRoom' });
    });

    s.on('connect_error', (err: Error) => {
      console.error('[poker] connect_error', err);
      setError('Не удалось подключиться к серверу.');
    });

    // При входе сервер возвращает pid и публичное состояние
    s.on('poker/joined', (payload: { pid: string; state?: Partial<PokerState> }) => {
      console.log('[poker] joined', payload);
      setMyPid(payload.pid);
      applyPublicUpdate(payload.state);
    });

    // Публичные апдейты стола (без hole-cards до шоудауна)
    s.on('poker/update', (incoming: Partial<PokerState>) => {
      applyPublicUpdate(incoming);
    });

    // Приватные карты ТОЛЬКО для меня
    s.on('poker/privateState', (payload: { yourCards: Card[] }) => {
      console.log('[poker] privateState', payload);
      setMyCards(Array.isArray(payload?.yourCards) ? payload.yourCards : []);
    });

    s.on('poker/error', ({ message }: { message: string }) => {
      console.warn('[poker] error:', message);
      setError(message);
    });

    s.on('poker/result', (data: any) => {
      console.log('[poker] result', data);
      // Ничего особенного делать не нужно — на шоудауне сервер раскрывает карты в public state,
      // а мы уже умеем на их основе посчитать подписи-комбинации ниже.
    });

    return () => {
      s.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Аккуратный merge публичного состояния (не трогаем myPid/myCards)
  const applyPublicUpdate = (incoming?: Partial<PokerState>) => {
    setState((prev) => {
      const next: PokerState = {
        ...prev,
        ...(incoming ?? {}),
        seats: fillSeats(incoming?.seats ?? prev.seats, DEFAULT_SEAT_COUNT),
        board: incoming?.board ?? prev.board,
        sidePots: incoming?.sidePots ?? prev.sidePots,
        stage: incoming?.stage ?? prev.stage,
        pot: incoming?.pot ?? prev.pot,
        minRaise: incoming?.minRaise ?? prev.minRaise,
        smallBlind: incoming?.smallBlind ?? prev.smallBlind,
        bigBlind: incoming?.bigBlind ?? prev.bigBlind,
        currentToActPid: incoming?.currentToActPid ?? prev.currentToActPid,
        stateId: incoming?.stateId ?? (prev.stateId ?? 0),
      };
      return next;
    });
  };

  /* Actions to server */
  const sendAction = (action: { type: 'fold' | 'call' | 'check' | 'raise' | 'allin'; amount?: number }) => {
    if (!socket) return;
    socket.emit('poker/action', action);
  };

  const startGame = () => {
    if (!socket) return;
    socket.emit('poker/start');
  };

  /* Derived */
  const mySeatIdx = useMemo(() => {
    if (!myPid) return null;
    const idx = state.seats.findIndex((s) => s.pid === myPid);
    return idx >= 0 ? idx : null;
  }, [state.seats, myPid]);

  /* UI */
  return (
    <div className="poker-page">
      <div className="poker-container">
        <header className="poker-header">
          <h2>Texas Hold&apos;em — No Limit</h2>
          <div className="poker-controls">
            <button className="btn" onClick={startGame}>Start / Deal</button>
          </div>
        </header>

        {error && <div className="poker-error">{error}</div>}

        <div className="poker-table">
          <div className="table-center">
            <div className="board-cards" aria-hidden={false}>
              {Array.from({ length: 5 }).map((_, i) => (
                <CardView key={i} card={state.board?.[i]} hidden={!state.board?.[i]} />
              ))}
            </div>

            <div className="pot-row">
              <div className="pot">Pot: {state.pot}</div>
              {state.sidePots && state.sidePots.length > 0 && (
                <div className="sidepots">
                  Side pots: {state.sidePots.map((sp) => sp.amount).join(', ')}
                </div>
              )}
            </div>

            <div className="table-info">
              <div>Stage: {state.stage}</div>
              <div>SB/BB: {state.smallBlind}/{state.bigBlind}</div>
              <div>To act: {state.currentToActPid ? (state.currentToActPid === myPid ? 'YOU' : state.currentToActPid) : '-'}</div>
            </div>
          </div>

          <div className="seats-row">
            {state.seats.map((seat, idx) => {
              const isMe = !!myPid && seat.pid === myPid;
              const isActive = !!seat.isActive || (state.currentToActPid && seat.pid === state.currentToActPid);
              const isDealer = !!seat.isDealer;

              // КАРТЫ ДЛЯ ОТОБРАЖЕНИЯ:
              // - Мой seat → показываем myCards (из приватного события).
              // - Чужие сидения:
              //   * до шоудауна — две рубашки (если игрок в раздаче и не сфолдил),
              //   * на шоудауне/результатах — показываем их карты из public state (сервер их раскрывает).
              let cardsToShow: { card?: Card; hidden?: boolean }[] = [];

              if (isMe) {
                if (myCards.length >= 1) cardsToShow.push({ card: myCards[0], hidden: false });
                else cardsToShow.push({ hidden: true });
                if (myCards.length >= 2) cardsToShow.push({ card: myCards[1], hidden: false });
                else cardsToShow.push({ hidden: true });
              } else {
                if (seat.folded) {
                  // сфолдил — ничего не показываем
                  cardsToShow = [];
                } else if (state.stage === 'showdown' || state.stage === 'results') {
                  // карты раскрыты сервером в public state
                  if (seat.cards?.length) {
                    cardsToShow = seat.cards.map((c) => ({ card: c, hidden: false }));
                  } else {
                    // на всякий случай
                    cardsToShow = [{ hidden: true }, { hidden: true }];
                  }
                } else {
                  // до шоудауна — две рубашки если игрок за столом
                  if (seat.pid) {
                    cardsToShow = [{ hidden: true }, { hidden: true }];
                  } else {
                    cardsToShow = [];
                  }
                }
              }

              // ПОДПИСЬ-КОМБИНАЦИЯ:
              // - Для вас — считаем по myCards + board.
              // - Для остальных — "Скрыто" до шоудауна, на шоудауне считаем по seat.cards + board.
              let comboLabel = '—';
              if (isMe) {
                comboLabel = solveLabel(myCards, state.board);
              } else if (seat.folded) {
                comboLabel = 'Пас';
              } else if (state.stage === 'showdown' || state.stage === 'results') {
                comboLabel = solveLabel(seat.cards || [], state.board);
              } else if (seat.pid) {
                comboLabel = 'Скрыто';
              }

              return (
                <div
                  key={idx}
                  className={`seat ${seat.folded ? 'folded' : ''} ${isActive ? 'active' : ''} ${isDealer ? 'dealer' : ''}`}
                >
                  <div className="seat-top">
                    <div className="seat-name">
                      {seat.pid ? (isMe ? 'You' : 'Player') : 'Empty'}
                      {isDealer && <span className="dealer-badge">D</span>}
                    </div>
                    <div className="seat-chips">{seat.chips.toLocaleString('ru-RU')}</div>
                  </div>

                  <div className="seat-cards">
                    {cardsToShow.length > 0 ? (
                      cardsToShow.map((c, i) => (
                        <CardView key={i} card={c.card} hidden={c.hidden} />
                      ))
                    ) : (
                      <div className="no-cards">—</div>
                    )}
                  </div>

                  <div
                    className="seat-combo"
                    style={{ marginTop: 4, fontSize: '0.8rem', color: '#b9cfe0', textAlign: 'center' }}
                    aria-label="Комбинация игрока"
                  >
                    {comboLabel}
                  </div>

                  <div className="seat-bet">{seat.bet > 0 ? `Bet: ${seat.bet}` : null}</div>
                  {isMe && <div className="you-badge">You</div>}
                </div>
              );
            })}
          </div>
        </div>

        <div className="poker-actions">
          <div className="action-info">
            <div>To act: {state.currentToActPid === myPid ? 'YOU' : (state.currentToActPid ?? '-')}</div>
            <div>Min Raise: {state.minRaise}</div>
          </div>

          <div className="action-buttons">
            <button className="btn" onClick={() => sendAction({ type: 'fold' })}>Fold</button>
            <button className="btn" onClick={() => sendAction({ type: 'call' })}>Call</button>
            <button className="btn" onClick={() => sendAction({ type: 'check' })}>Check</button>
            <button className="btn" onClick={() => sendAction({ type: 'raise', amount: state.minRaise || 100 })}>Raise</button>
            <button className="btn" onClick={() => sendAction({ type: 'allin' })}>All-in</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Poker;
