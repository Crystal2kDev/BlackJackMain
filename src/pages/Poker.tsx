import React, { useEffect, useMemo, useRef, useState } from 'react';
import ioClient from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import '../styles/Poker.css';
import ChipStack from '../components/Poker/ChipStack';

// pokersolver — CommonJS
// @ts-ignore
import PokerSolver from 'pokersolver';
const { Hand } = PokerSolver as { Hand: any };

const SOCKET_URL = 'http://localhost:3000';
const POKER_PID_KEY = 'poker_player_pid';

/* ---------- Types ---------- */
export type Card = { name?: string; image: string; value?: number; code?: string };
export type Seat = {
  pid: string | null;
  name?: string | null;
  avatar?: string | null;
  chips: number;
  bet: number;
  cards: Card[];
  isActive?: boolean;
  isDealer?: boolean;
  isAllIn?: boolean;
  folded?: boolean;
  comboLabel?: string;
};
export type PokerStage = 'waiting' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown' | 'results';
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

/* ---------- Defaults / helpers ---------- */
const DEFAULT_SEAT_COUNT = 10;
const makeEmptySeat = (): Seat => ({
  pid: null, name: null, avatar: null, chips: 0, bet: 0, cards: [],
  isActive: false, isDealer: false, isAllIn: false, folded: false,
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

function fillSeats(arr?: Seat[], len = DEFAULT_SEAT_COUNT) {
  const base = Array.isArray(arr) ? [...arr] : [];
  if (base.length < len) base.push(...Array.from({ length: len - base.length }, () => makeEmptySeat()));
  return base.slice(0, len);
}

const normalizeCode = (code?: string): string | null => {
  if (!code || code.length < 2) return null;
  const v = code[0]; const s = code[1];
  return (v === 'T' ? '10' : v) + s;
};

function solveLabel(hole: Card[], board: Card[]): string {
  try {
    const holeCodes = (hole ?? []).map((c) => normalizeCode(c.code ?? c.name)).filter(Boolean) as string[];
    const boardCodes = (board ?? []).map((c) => normalizeCode(c.code ?? c.name)).filter(Boolean) as string[];
    const codes = [...holeCodes, ...boardCodes];
    if (!Hand || codes.length < 5) return '—';
    const solved = Hand.solve(codes);
    const name: string | undefined = solved?.name;
    return name ?? '—';
  } catch { return '—'; }
}

/* ---------- CardFlip (анимация только при ПЕРВОМ реальном раскрытии) ---------- */
const FLIP_DURATION_MS = 480;
const BOARD_STAGGER_MS = 240;

type CardFlipProps = {
  frontSrc: string;
  backSrc?: string;
  revealed: boolean;
  size?: 'normal' | 'small';
  delayMs?: number;             // применяется только при ПЕРВОМ раскрытии в рамках ЖИЗНЕННОГО цикла компонента
  altFront?: string;
  altBack?: string;
};

const CardFlip: React.FC<CardFlipProps> = ({
  frontSrc,
  backSrc = '/assets/cards/cardRedBack.png',
  revealed,
  size = 'normal',
  delayMs = 0,
  altFront,
  altBack,
}) => {
  const w = size === 'small' ? 72 : 92;
  const h = size === 'small' ? 108 : 136;

  // Визуальное состояние (что отрисовано), отдельно от логического revealed.
  // Инициализируем текущим значением revealed: если карта сразу "пришла" открытой (перезаход в раздачу) — без анимации.
  const [visualRevealed, setVisualRevealed] = useState<boolean>(revealed);
  const [isAnimating, setIsAnimating] = useState<boolean>(false);

  // Запоминаем предыдущее значение revealed — важнее, чем просто "флаг был анимирован".
  // Это гарантирует, что мы анимируем ТОЛЬКО на переходе false -> true.
  const prevRevealedRef = useRef<boolean>(revealed);
  const delayTimerRef = useRef<number | null>(null);
  const endTimerRef = useRef<number | null>(null);

  // Сбрасываем таймеры при размонтировании
  useEffect(() => {
    return () => {
      if (delayTimerRef.current) window.clearTimeout(delayTimerRef.current);
      if (endTimerRef.current) window.clearTimeout(endTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const was = prevRevealedRef.current;

    // Если карта стала скрытой — сразу убираем визуальный поворот (без анимации).
    if (!revealed) {
      if (delayTimerRef.current) { window.clearTimeout(delayTimerRef.current); delayTimerRef.current = null; }
      if (endTimerRef.current) { window.clearTimeout(endTimerRef.current); endTimerRef.current = null; }
      setIsAnimating(false);
      setVisualRevealed(false);
      prevRevealedRef.current = false;
      return;
    }

    // Переход false -> true: играем анимацию с задержкой (только ОДИН раз для этого перехода)
    if (revealed && !was) {
      if (delayTimerRef.current) window.clearTimeout(delayTimerRef.current);
      delayTimerRef.current = window.setTimeout(() => {
        setIsAnimating(true);
        // делаем flip в следующем кадре, чтобы CSS transition применился корректно
        requestAnimationFrame(() => setVisualRevealed(true));
        if (endTimerRef.current) window.clearTimeout(endTimerRef.current);
        endTimerRef.current = window.setTimeout(() => {
          setIsAnimating(false);
        }, FLIP_DURATION_MS) as unknown as number;
      }, Math.max(0, delayMs)) as unknown as number;

      prevRevealedRef.current = true;
      return;
    }

    // revealed === true и раньше было true (маунт в середине раздачи/повторные апдейты):
    // просто убеждаемся, что визуально карта открыта, без анимации.
    setIsAnimating(false);
    setVisualRevealed(true);
    prevRevealedRef.current = true;
  }, [revealed, delayMs]);

  return (
    <div
      className={`card-flip card-flip--${size} ${isAnimating ? 'is-animating' : ''}`}
      style={{
        width: w,
        height: h,
        // CSS-переменные для читаемости/расширяемости
        // @ts-ignore
        '--flip-duration': `${FLIP_DURATION_MS}ms`,
      } as React.CSSProperties}
    >
      <div
        className="card-flip-inner"
        style={{
          width: '100%',
          height: '100%',
          transform: `rotateY(${visualRevealed ? 180 : 0}deg)`,
        }}
      >
        <img
          src={backSrc}
          alt={altBack ?? 'card back'}
          className="card-face card-back"
          onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/assets/cards/cardRedBack.png'; }}
        />
        <img
          src={frontSrc}
          alt={altFront ?? 'card front'}
          className="card-face card-front"
          onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/assets/cards/cardRedBack.png'; }}
        />
      </div>
    </div>
  );
};

/* ---------- Main ---------- */
const DEFAULT_TURN_MS = 10000;
const USE_IMAGE_TABLE = false;

const Poker: React.FC = () => {
  const [socket, setSocket] = useState<any | null>(null);
  const [state, setState] = useState<PokerState>(initialPokerState);
  const [myPid, setMyPid] = useState<string | null>(() => { try { return localStorage.getItem(POKER_PID_KEY); } catch { return null; } });
  const [myCards, setMyCards] = useState<Card[]>([]);
  const [error, setError] = useState<string | null>(null);

  // board reveal bookkeeping (для задержек/стаггера — но не вызывает повторные флипы)
  const [boardRevealCountLocal, setBoardRevealCountLocal] = useState<number>(0);
  const [boardRevealDelays, setBoardRevealDelays] = useState<number[]>(Array(5).fill(0));
  const prevStageRef = useRef<PokerStage | null>(null);

  // showdown: разовое вскрытие карт игроков
  const showdownRevealRef = useRef(false);
  const myDealAnimRef = useRef(false);
  const prevMyCardsLenRef = useRef(0);

  // winners
  const [resultPayload, setResultPayload] = useState<any | null>(null);
  const [winners, setWinners] = useState<string[]>([]);
  const winnerHighlightTimerRef = useRef<number | null>(null);
  const resultTimerRef = useRef<number | null>(null);

  // turn timer
  const [turnPct, setTurnPct] = useState<number>(100);
  const [turnOwnerPid, setTurnOwnerPid] = useState<string | null>(null);
  const [turnTimeMs, setTurnTimeMs] = useState<number>(DEFAULT_TURN_MS);
  const turnIntervalRef = useRef<number | null>(null);

  // F11 hint
  const [showF11Modal, setShowF11Modal] = useState<boolean>(true);
  const f11ProgressRef = useRef<number>(8000);
  const [f11Pct, setF11Pct] = useState<number>(100);
  const f11IntervalRef = useRef<number | null>(null);

  useEffect(() => {
    f11ProgressRef.current = 8000;
    setF11Pct(100);
    if (f11IntervalRef.current) { window.clearInterval(f11IntervalRef.current); f11IntervalRef.current = null; }
    const tick = window.setInterval(() => {
      f11ProgressRef.current = Math.max(0, f11ProgressRef.current - 200);
      setF11Pct(Math.round((f11ProgressRef.current / 8000) * 100));
      if (f11ProgressRef.current <= 0) { if (f11IntervalRef.current) window.clearInterval(f11IntervalRef.current); setShowF11Modal(false); }
    }, 200) as unknown as number;
    f11IntervalRef.current = tick;
    return () => { if (f11IntervalRef.current) window.clearInterval(f11IntervalRef.current); };
  }, []);

  useEffect(() => {
    const s = ioClient(SOCKET_URL, { transports: ['websocket'], reconnection: true });
    setSocket(s);

    const sendJoin = () => { try { s.emit('poker/join', { roomId: 'defaultPokerRoom', playerId: myPid ?? undefined }); } catch {} };

    s.on('connect', () => { setError(null); sendJoin(); });
    s.on('connect_error', (err: Error) => { setError('Не удалось подключиться к серверу.'); console.error(err); });

    s.on('poker/joined', (payload: { pid: string; state?: Partial<PokerState> }) => {
      try { localStorage.setItem(POKER_PID_KEY, payload.pid); } catch {}
      setMyPid(payload.pid);
      applyPublicUpdate(payload.state);
    });

    s.on('poker/update', (incoming: Partial<PokerState>) => applyPublicUpdate(incoming));
    s.on('poker/privateState', (payload: { yourCards: Card[]; comboLabel?: string }) => {
      setMyCards(Array.isArray(payload?.yourCards) ? payload.yourCards : []);
    });
    s.on('poker/error', ({ message }: { message: string }) => { setError(message); setTimeout(() => setError(null), 2500); });

    s.on('poker/turnTime', (ms: number) => { setTurnTimeMs(Number(ms) || DEFAULT_TURN_MS); });

    s.on('poker/result', (payload: any) => {
      if (resultTimerRef.current) { window.clearTimeout(resultTimerRef.current); resultTimerRef.current = null; }
      const payouts = Array.isArray(payload?.payouts) ? payload.payouts : [];
      const winnersPids: string[] = payouts.map((p: any) => p.pid).filter(Boolean);
      setWinners(winnersPids);
      if (winnerHighlightTimerRef.current) window.clearTimeout(winnerHighlightTimerRef.current);
      winnerHighlightTimerRef.current = window.setTimeout(() => { setWinners([]); winnerHighlightTimerRef.current = null; }, 6500) as unknown as number;

      setResultPayload(payload ?? { message: 'Result' });
      resultTimerRef.current = window.setTimeout(() => { setResultPayload(null); resultTimerRef.current = null; }, 6500) as unknown as number;
    });

    return () => {
      try { s.disconnect(); } catch {}
      if (winnerHighlightTimerRef.current) window.clearTimeout(winnerHighlightTimerRef.current);
      if (resultTimerRef.current) window.clearTimeout(resultTimerRef.current);
      if (turnIntervalRef.current) window.clearInterval(turnIntervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // клиентский прогресс-бар хода
  useEffect(() => {
    const activePid = state.currentToActPid ?? null;
    if (turnIntervalRef.current) { window.clearInterval(turnIntervalRef.current); turnIntervalRef.current = null; }
    setTurnPct(100); setTurnOwnerPid(null);
    if (!activePid) return;

    setTurnOwnerPid(activePid);
    const start = Date.now();
    const tick = window.setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.max(0, 100 - Math.round((elapsed / turnTimeMs) * 100));
      setTurnPct(pct);
      if (elapsed >= turnTimeMs) {
        if (turnIntervalRef.current) { window.clearInterval(turnIntervalRef.current); turnIntervalRef.current = null; }
      }
    }, 80) as unknown as number;
    turnIntervalRef.current = tick;

    return () => { if (turnIntervalRef.current) { window.clearInterval(turnIntervalRef.current); turnIntervalRef.current = null; } };
  }, [state.currentToActPid, turnTimeMs]);

  // разовый триггер (оставлено на будущее — логика вскрытия чужих карт)
  useEffect(() => {
    const prev = prevStageRef.current;
    if (prev && prev !== 'showdown' && prev !== 'results' && (state.stage === 'showdown' || state.stage === 'results')) {
      showdownRevealRef.current = true;
      window.setTimeout(() => { showdownRevealRef.current = false; }, FLIP_DURATION_MS + 300);
    }
  }, [state.stage]);

  // мои карты — первый флип при раздаче (флаг на будущее; сейчас флип делают CardFlip по данным)
  useEffect(() => {
    if (myCards.length > prevMyCardsLenRef.current) {
      if (myCards.length >= 2 && state.stage === 'preflop') {
        myDealAnimRef.current = true;
        window.setTimeout(() => { myDealAnimRef.current = false; }, FLIP_DURATION_MS + 200);
      }
      prevMyCardsLenRef.current = myCards.length;
    }
  }, [myCards.length, state.stage]);

  const applyPublicUpdate = (incoming?: Partial<PokerState>) => {
    setState((prev) => {
      const next: PokerState = {
        ...prev, ...(incoming ?? {}),
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

      // локальный счётчик раскрытых карт борда (для задержек)
      const targetReveal = stageToRevealCount(next.stage, next.board);
      const currentLocal = boardRevealCountLocal;

      if (prevStageRef.current === null) {
        setBoardRevealCountLocal(targetReveal);
        setBoardRevealDelays(Array(5).fill(0));
      } else if (prevStageRef.current !== next.stage) {
        if (targetReveal > currentLocal) {
          const newDelays = [...boardRevealDelays];
          for (let j = currentLocal; j < targetReveal; j++) {
            newDelays[j] = (j - currentLocal) * BOARD_STAGGER_MS;
          }
          setBoardRevealDelays(newDelays);
          setBoardRevealCountLocal(targetReveal);
        } else {
          setBoardRevealCountLocal(targetReveal);
          setBoardRevealDelays(Array(5).fill(0));
        }
      }
      prevStageRef.current = next.stage;
      return next;
    });
  };

  const stageToRevealCount = (stage: PokerStage, board: Card[] = []) => {
    switch (stage) {
      case 'flop': return Math.min(3, board.length);
      case 'turn': return Math.min(4, board.length);
      case 'river': return Math.min(5, board.length);
      case 'showdown':
      case 'results': return board.length;
      default: return 0;
    }
  };

  const sendAction = (action: { type: 'fold' | 'call' | 'check' | 'raise' | 'allin'; amount?: number }) => {
    if (!socket) return;
    const canAct = Boolean(state.currentToActPid && state.currentToActPid === myPid);
    if (!canAct || state.stage === 'results' || state.stage === 'showdown') {
      setError('Действие недоступно в текущем состоянии'); setTimeout(() => setError(null), 1200); return;
    }
    socket.emit('poker/action', action);
  };

  const startGame = () => { if (socket) socket.emit('poker/start'); };
  const onSit = (idx: number) => { if (socket) socket.emit('poker/sit', { seatIdx: idx }); };

  const mySeatIdx = useMemo(() => {
    if (!myPid) return null;
    const idx = state.seats.findIndex((s) => s.pid === myPid);
    return idx >= 0 ? idx : null;
  }, [state.seats, myPid]);
  const mySeat = mySeatIdx !== null && mySeatIdx >= 0 ? state.seats[mySeatIdx] : null;
  const allowAct = (state.currentToActPid && state.currentToActPid === myPid) && state.stage !== 'results' && state.stage !== 'showdown';

  const seatsToRender = useMemo(() => {
    if (state.stage !== 'waiting') return state.seats.filter((s) => !!s.pid);
    return state.seats.slice(0, DEFAULT_SEAT_COUNT);
  }, [state.seats, state.stage]);

  // равномерное распределение до 10 мест
  const seatPositions = useMemo(() => {
    const count = Math.max(1, seatsToRender.length);
    const rx = count >= 9 ? 49 : 46;
    const ry = count >= 9 ? 44 : 40;
    const startAngle = -90 - (count > 1 ? (360 / count) * 0.5 : 0);
    const step = 360 / count;
    return Array.from({ length: count }).map((_, i) => {
      const angleDeg = startAngle + i * step;
      const a = (angleDeg * Math.PI) / 180;
      const left = 50 + rx * Math.cos(a);
      const top = 50 + ry * Math.sin(a);
      return { left, top, rad: a };
    });
  }, [seatsToRender.length]);

  const playerRadialOffsetPx = 16;

  const renderSeat = (seat: Seat, originalIdx: number, posIdx: number) => {
    const pos = seatPositions[posIdx] ?? { left: 50, top: 50, rad: 0 };
    const isMe = !!myPid && seat.pid === myPid;
    const showHole = state.stage === 'showdown' || state.stage === 'results';

    let comboLabel = '—';
    if (isMe) comboLabel = solveLabel(myCards, state.board);
    else if (seat.folded) comboLabel = 'Fold';
    else if (showHole) comboLabel = solveLabel(seat.cards || [], state.board);
    else if (seat.pid) comboLabel = 'Hidden';

    const shiftX = Math.cos(pos.rad) * playerRadialOffsetPx;
    const shiftY = Math.sin(pos.rad) * playerRadialOffsetPx;

    const cardA = isMe ? myCards[0] ?? null : showHole ? seat.cards[0] ?? null : null;
    const cardB = isMe ? myCards[1] ?? null : showHole ? seat.cards[1] ?? null : null;
    const revealedA = Boolean(cardA);
    const revealedB = Boolean(cardB);

    // Для игроков — плавный one-time-флип на первое появление карт.
    const firstRevealA_delay = 0;
    const firstRevealB_delay = 80;

    if (!seat.pid && state.stage === 'waiting') {
      return (
        <div
          key={`empty-${originalIdx}-${posIdx}`}
          className="seat-inline empty-seat"
          style={{ left: `${pos.left}%`, top: `${pos.top}%`, transform: `translate(calc(-50% + ${shiftX}px), calc(-50% + ${shiftY}px))`, position: 'absolute', width: 180, zIndex: 800 }}
        >
          <div className="empty-avatar">+</div>
          <div className="meta-name">Empty</div>
          <button className="pc-sit-btn" onClick={() => onSit(originalIdx)}>Sit</button>
        </div>
      );
    }

    const isActive = Boolean(state.currentToActPid && state.currentToActPid === seat.pid);
    const displayName = seat.pid ? (isMe ? 'You' : seat.name ?? 'Newbie') : 'Empty';
    const staticId = originalIdx + 1;
    const isWinner = seat.pid ? winners.includes(seat.pid) : false;

    return (
      <div
        key={seat.pid ?? `seat-${originalIdx}-${posIdx}`}
        className={`seat-inline ${seat.folded ? 'folded' : ''} ${isMe ? 'me' : ''} ${isActive ? 'active-turn' : ''} ${isWinner ? 'seat-winner' : ''}`}
        style={{ left: `${pos.left}%`, top: `${pos.top}%`, transform: `translate(calc(-50% + ${shiftX}px), calc(-50% + ${shiftY}px))`, position: 'absolute', width: 220, maxWidth: 260, zIndex: isMe ? 1200 : 900 }}
      >
        {isWinner && <div className="winner-badge">Winner</div>}

        {/* затемнение при Fold */}
        {seat.folded && <div className="seat-dim" aria-hidden />}
        {seat.folded && <div className="seat-fold-label" aria-hidden>Fold</div>}

        <div className="seat-top-inline">
          <div className="seat-left-inline">
            <div className="avatar-wrap">
              <img
                src={seat.avatar ?? '/assets/default-avatar.png'}
                alt={seat.name ?? 'avatar'}
                className="avatar-img"
                onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/assets/default-avatar.png'; }}
              />
            </div>

            <div className="meta">
              <div className="meta-name">
                <span className="meta-name-text">{displayName}</span>
                <span className="static-id"> [{staticId}]</span>
              </div>
              <div className="meta-stack-row">
                <div className="meta-stack">{seat.chips.toLocaleString('ru-RU')}</div>
                {seat.bet > 0 && <div className="chip-pill">Bet {seat.bet}</div>}
              </div>
            </div>
          </div>

          <div className="seat-right-inline">
            {seat.isDealer && state.stage !== 'waiting' ? <div className="dealer-pill" title="Dealer">D</div> : null}
          </div>
        </div>

        <div className="seat-cards-inline">
          <CardFlip
            frontSrc={cardA ? cardA.image : '/assets/cards/cardRedBack.png'}
            backSrc="/assets/cards/cardRedBack.png"
            revealed={revealedA}
            size="small"
            delayMs={firstRevealA_delay}
            altFront={cardA?.name}
            altBack="card back"
          />
          <CardFlip
            frontSrc={cardB ? cardB.image : '/assets/cards/cardRedBack.png'}
            backSrc="/assets/cards/cardRedBack.png"
            revealed={revealedB}
            size="small"
            delayMs={firstRevealB_delay}
            altFront={cardB?.name}
            altBack="card back"
          />
        </div>

        <div className="seat-combo-inline">{comboLabel}</div>

        <div className="turn-bar" aria-hidden>
          <div className="turn-bar-inner" style={{ width: isActive && turnOwnerPid === seat.pid ? `${turnPct}%` : '0%' }} />
        </div>
      </div>
    );
  };

  // board
  const renderBoard = () => {
    const boardCards = Array.from({ length: 5 }).map((_, i) => state.board[i] ?? null);
    return (
      <div className="board-cards" role="list" aria-label="Board cards">
        {boardCards.map((card, i) => {
          const shouldReveal = i < boardRevealCountLocal && Boolean(card);
          const delayForCard = boardRevealDelays[i];
          return (
            <CardFlip
              key={`board-${i}`}
              frontSrc={card ? card.image : '/assets/cards/cardRedBack.png'}
              backSrc="/assets/cards/cardRedBack.png"
              revealed={shouldReveal}
              size="normal"
              delayMs={delayForCard}
              altFront={card?.name}
              altBack="board back"
            />
          );
        })}
      </div>
    );
  };

  const renderResultToast = () => {
    if (!resultPayload) return null;
    const payouts = Array.isArray(resultPayload.payouts) ? resultPayload.payouts : [];
    const winnerPids: string[] = payouts.map((p: any) => p.pid).filter(Boolean);
    const msg = resultPayload.message ?? (winnerPids.length ? `Winner: ${winnerPids.join(', ')}` : 'Hand finished');
    return (
      <AnimatePresence>
        <motion.div key="result-toast" className="result-toast" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
          <div className="result-toast-inner"><strong>{msg}</strong></div>
        </motion.div>
      </AnimatePresence>
    );
  };

  const handleF11 = async () => {
    try {
      if (!document.fullscreenElement) {
        const el = document.documentElement as any;
        const request = el.requestFullscreen?.bind(el) || el.webkitRequestFullscreen?.bind(el) || el.msRequestFullscreen?.bind(el);
        if (request) await request();
      } else {
        const exit = (document as any).exitFullscreen?.bind(document) || (document as any).webkitExitFullscreen?.bind(document) || (document as any).msExitFullscreen?.bind(document);
        if (exit) await exit();
      }
    } finally {
      setShowF11Modal(false);
      if (f11IntervalRef.current) { window.clearInterval(f11IntervalRef.current); f11IntervalRef.current = null; }
    }
  };
  const closeF11Modal = () => {
    setShowF11Modal(false);
    if (f11IntervalRef.current) { window.clearInterval(f11IntervalRef.current); f11IntervalRef.current = null; }
  };

  const seatsClass = `seats-count-${Math.max(1, seatsToRender.length)}`;
  const isWaiting = state.stage === 'waiting';

  return (
    <div className="poker-page">
      <div className="poker-container">
        <header className="poker-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h2 style={{ margin: 0 }}>Texas Hold'em — No Limit</h2>
            <ChipStack chips={mySeat?.chips ?? 0} />
          </div>

          <div className="poker-controls">
            <button className="btn big-start" onClick={() => socket?.emit('poker/start')}>Start / Deal</button>
          </div>
        </header>

        {error && <div className="poker-error">{error}</div>}

        <div className={`poker-table ${isWaiting ? 'poker-table--prestart' : ''}`}>
          <div className={`table-oval ${seatsClass} ${USE_IMAGE_TABLE ? 'table-oval--img' : ''}`} role="region" aria-label="Poker table">
            <div className="board-area">
              <div className="table-brand">OracleGame</div>
              <div className="pc-board">
                <div className="pc-board-info">
                  <div className="pc-pot">Ставка: <strong>{state.pot}</strong></div>
                  {state.sidePots && state.sidePots.length > 0 &&
                    <div className="pc-sidepots">Side: {state.sidePots.map((s) => s.amount).join(', ')}</div>}
                </div>
                {renderBoard()}
              </div>
            </div>

            {seatsToRender.map((s, i) => renderSeat(s, state.seats.indexOf(s), i))}
          </div>
        </div>

        <div className="poker-actions">
          <div className="action-info">
            <div>To act: {state.currentToActPid === myPid ? 'YOU' : state.currentToActPid ?? '-'}</div>
            <div>Min Raise: {state.minRaise}</div>
            <div>Blinds: {state.smallBlind}/{state.bigBlind}</div>
            <div>Stage: {state.stage}</div>
            <div>Turn time: {Math.round(turnTimeMs / 1000)}s</div>
          </div>

          <div className="action-buttons">
            <button className="action-btn fold"  disabled={!allowAct} onClick={() => sendAction({ type: 'fold' })}>FOLD</button>
            <button className="action-btn check" disabled={!allowAct} onClick={() => sendAction({ type: 'check' })}>CHECK</button>
            <button className="action-btn call"  disabled={!allowAct} onClick={() => sendAction({ type: 'call' })}>CALL</button>

            <div className="raise-control">
              <input className="raise-input" id="raiseAmount" type="number" min={50} step={50} defaultValue={state.minRaise || state.bigBlind || 100} disabled={!allowAct} />
              <button
                className="action-btn raise"
                disabled={!allowAct}
                onClick={() => {
                  const el = document.getElementById('raiseAmount') as HTMLInputElement | null;
                  const amount = el ? Math.max(50, parseInt(el.value || '0', 10)) : state.minRaise || 100;
                  sendAction({ type: 'raise', amount });
                }}
              >
                RAISE
              </button>
            </div>

            <button className="action-btn allin" disabled={!allowAct} onClick={() => sendAction({ type: 'allin' })}>ALL-IN</button>
          </div>
        </div>

        {renderResultToast()}

        <AnimatePresence>
          {showF11Modal && (
            <motion.div className="f11-modal-wrap" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.28 }}>
              <div className="f11-modal">
                <div className="f11-modal-title">Для лучшего погружения — нажмите F11</div>
                <div className="f11-modal-body">Полноэкранный режим улучшает визуализацию.</div>
                <div className="f11-progress-bar" aria-hidden><div className="f11-progress-inner" style={{ width: `${f11Pct}%` }} /></div>
                <div className="f11-modal-actions">
                  <button className="f11-btn close" onClick={closeF11Modal}>Закрыть</button>
                  <button className="f11-btn f11" onClick={handleF11}>F11</button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Poker;