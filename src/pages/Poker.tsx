// src/pages/Poker.tsx
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
  cards: Card[]; // public cards (empty until showdown)
  isActive?: boolean;
  isDealer?: boolean;
  isAllIn?: boolean;
  folded?: boolean;
};
export type PokerStage = 'waiting' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown' | 'results';
export interface PokerState {
  seats: Seat[];
  board: Card[]; // up to 5
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
  pid: null,
  name: null,
  avatar: null,
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

function fillSeats(arr?: Seat[], len = DEFAULT_SEAT_COUNT) {
  const base = Array.isArray(arr) ? [...arr] : [];
  if (base.length < len) base.push(...Array.from({ length: len - base.length }, () => makeEmptySeat()));
  return base.slice(0, len);
}

const normalizeCode = (code?: string): string | null => {
  if (!code || code.length < 2) return null;
  const v = code[0];
  const s = code[1];
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
    if (!name) return '—';
    return name;
  } catch {
    return '—';
  }
}

/* ---------- CardFlip component (3D) with conditional animation ---------- */
const FLIP_DURATION_MS = 480;
const BOARD_STAGGER_MS = 240; // delay between board card flips

type CardFlipProps = {
  frontSrc: string;
  backSrc?: string;
  revealed: boolean;
  size?: 'normal' | 'small';
  delayMs?: number;
  altFront?: string;
  altBack?: string;
  shouldAnimate?: boolean; // if false -> instant reveal (no flip)
};

const CardFlip: React.FC<CardFlipProps> = ({
  frontSrc,
  backSrc = '/assets/cards/cardRedBack.png',
  revealed,
  size = 'normal',
  delayMs = 0,
  altFront,
  altBack,
  shouldAnimate = true,
}) => {
  const w = size === 'small' ? 72 : 92;
  const h = size === 'small' ? 108 : 136;

  const rotate = revealed ? 180 : 0;
  // cast to any to avoid TS/Framer mismatch on dynamic transition shape
  const transition: any = shouldAnimate
    ? {
        duration: FLIP_DURATION_MS / 1000,
        ease: [0.2, 0.9, 0.3, 1],
        delay: delayMs / 1000,
      }
    : { duration: 0, delay: 0 };

  return (
    <motion.div
      className={`card-flip card-flip--${size}`}
      style={{ width: w, height: h, perspective: 1100 }}
      initial={false}
      animate={{ opacity: 1, y: 0 }}
    >
      <motion.div
        className="card-flip-inner"
        animate={{ rotateY: rotate }}
        initial={false}
        transition={transition}
        style={{ width: '100%', height: '100%', position: 'relative', transformStyle: 'preserve-3d' }}
      >
        <img
          src={backSrc}
          alt={altBack ?? 'card back'}
          className="card-face card-back"
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            left: 0,
            top: 0,
            borderRadius: 8,
            backfaceVisibility: 'hidden',
            transform: 'rotateY(0deg)',
            objectFit: 'cover',
          }}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = '/assets/cards/cardRedBack.png';
          }}
        />

        <img
          src={frontSrc}
          alt={altFront ?? 'card front'}
          className="card-face card-front"
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            left: 0,
            top: 0,
            borderRadius: 8,
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            objectFit: 'cover',
          }}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = '/assets/cards/cardRedBack.png';
          }}
        />
      </motion.div>
    </motion.div>
  );
};

/* ---------- Main component ---------- */
const Poker: React.FC = () => {
  const [socket, setSocket] = useState<any | null>(null);
  const [state, setState] = useState<PokerState>(initialPokerState);
  const [myPid, setMyPid] = useState<string | null>(() => {
    try {
      return localStorage.getItem(POKER_PID_KEY);
    } catch {
      return null;
    }
  });
  const [myCards, setMyCards] = useState<Card[]>([]);
  const [error, setError] = useState<string | null>(null);

  // local reveal counter & animation indices
  const [boardRevealCountLocal, setBoardRevealCountLocal] = useState<number>(0);
  const prevStageRef = useRef<PokerStage | null>(null);
  const revealTimersRef = useRef<number[]>([]);
  const animateIndicesRef = useRef<Set<number>>(new Set()); // indices that should animate when revealed

  // result overlay
  const [resultPayload, setResultPayload] = useState<any | null>(null);
  const resultTimerRef = useRef<number | null>(null);

  /* F11 modal state */
  const [showF11Modal, setShowF11Modal] = useState<boolean>(true);
  const f11ProgressRef = useRef<number>(8000); // ms remaining
  const [f11Pct, setF11Pct] = useState<number>(100);
  const f11IntervalRef = useRef<number | null>(null);

  useEffect(() => {
    // start countdown for modal (8 seconds)
    f11ProgressRef.current = 8000;
    setF11Pct(100);
    if (f11IntervalRef.current) {
      window.clearInterval(f11IntervalRef.current);
      f11IntervalRef.current = null;
    }
    const tick = window.setInterval(() => {
      f11ProgressRef.current = Math.max(0, f11ProgressRef.current - 200);
      const pct = Math.round((f11ProgressRef.current / 8000) * 100);
      setF11Pct(pct);
      if (f11ProgressRef.current <= 0) {
        if (f11IntervalRef.current) { window.clearInterval(f11IntervalRef.current); f11IntervalRef.current = null; }
        setShowF11Modal(false);
      }
    }, 200) as unknown as number;
    f11IntervalRef.current = tick;

    return () => {
      if (f11IntervalRef.current) { window.clearInterval(f11IntervalRef.current); f11IntervalRef.current = null; }
    };
  }, []); // run once on mount

  useEffect(() => {
    const s = ioClient(SOCKET_URL, { transports: ['websocket'], reconnection: true });
    setSocket(s);

    const sendJoin = () => {
      try {
        s.emit('poker/join', { roomId: 'defaultPokerRoom', playerId: myPid ?? undefined });
      } catch (e) {
        console.warn('join emit failed', e);
      }
    };

    s.on('connect', () => {
      setError(null);
      sendJoin();
    });
    s.on('connect_error', (err: Error) => {
      setError('Не удалось подключиться к серверу.');
      console.error(err);
    });

    s.on('poker/joined', (payload: { pid: string; state?: Partial<PokerState> }) => {
      try {
        localStorage.setItem(POKER_PID_KEY, payload.pid);
      } catch {}
      setMyPid(payload.pid);
      applyPublicUpdate(payload.state);
    });

    s.on('poker/update', (incoming: Partial<PokerState>) => applyPublicUpdate(incoming));
    s.on('poker/privateState', (payload: { yourCards: Card[]; comboLabel?: string }) => {
      setMyCards(Array.isArray(payload?.yourCards) ? payload.yourCards : []);
    });
    s.on('poker/error', ({ message }: { message: string }) => {
      setError(message);
      setTimeout(() => setError(null), 2500);
    });

    s.on('poker/result', (payload: any) => {
      if (resultTimerRef.current) {
        window.clearTimeout(resultTimerRef.current);
        resultTimerRef.current = null;
      }
      setResultPayload(payload ?? { message: 'Result' });

      // clear after some time
      resultTimerRef.current = window.setTimeout(() => {
        setResultPayload(null);
        resultTimerRef.current = null;
      }, 6500) as unknown as number;
    });

    return () => {
      try {
        s.disconnect();
      } catch {}
      revealTimersRef.current.forEach((t) => {
        try {
          window.clearTimeout(t);
        } catch {}
      });
      revealTimersRef.current = [];
      if (resultTimerRef.current) {
        window.clearTimeout(resultTimerRef.current);
        resultTimerRef.current = null;
      }
      animateIndicesRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply server public update
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

      // compute target reveal count for new stage
      const targetReveal = stageToRevealCount(next.stage, next.board);
      const prevStage = prev.stage;

      // If first load (no prev) -> show proper count immediately (no animation)
      if (prevStageRef.current === null) {
        clearAllRevealTimers();
        animateIndicesRef.current.clear();
        setBoardRevealCountLocal(targetReveal);
      } else if (prevStageRef.current !== next.stage) {
        // stage changed -> animate only if reveal increases
        const currentLocal = boardRevealCountLocal;
        if (targetReveal > currentLocal) {
          animateBoardReveal(currentLocal, targetReveal);
        } else {
          clearAllRevealTimers();
          animateIndicesRef.current.clear();
          setBoardRevealCountLocal(targetReveal);
        }
      } else {
        // stage unchanged -> keep local reveal count (prevents re-animation on unrelated updates)
      }

      prevStageRef.current = next.stage;
      return next;
    });
  };

  const clearAllRevealTimers = () => {
    revealTimersRef.current.forEach((t) => {
      try {
        window.clearTimeout(t);
      } catch {}
    });
    revealTimersRef.current = [];
  };

  // animateBoardReveal: schedule incremental reveals; set animateIndicesRef for each newly revealed index
  const animateBoardReveal = (fromCount: number, toCount: number) => {
    clearAllRevealTimers();
    animateIndicesRef.current.clear();

    for (let next = fromCount + 1; next <= toCount; next++) {
      const idx = next - 1;
      const delay = (next - fromCount - 1) * BOARD_STAGGER_MS;

      const timer = window.setTimeout(() => {
        animateIndicesRef.current.add(idx);
        setBoardRevealCountLocal(next);
        // after flip finishes, remove animation flag
        const removal = window.setTimeout(() => {
          animateIndicesRef.current.delete(idx);
        }, FLIP_DURATION_MS + 120) as unknown as number;
        revealTimersRef.current.push(removal);
      }, delay) as unknown as number;

      revealTimersRef.current.push(timer);
    }
  };

  // stage -> reveal mapping
  const stageToRevealCount = (stage: PokerStage, board: Card[] = []) => {
    switch (stage) {
      case 'flop':
        return Math.min(3, board.length);
      case 'turn':
        return Math.min(4, board.length);
      case 'river':
        return Math.min(5, board.length);
      case 'showdown':
      case 'results':
        return board.length;
      default:
        return 0;
    }
  };

  // actions
  const sendAction = (action: { type: 'fold' | 'call' | 'check' | 'raise' | 'allin'; amount?: number }) => {
    if (!socket) return;
    const canAct = Boolean(state.currentToActPid && state.currentToActPid === myPid);
    if (!canAct) {
      setError('Не ваш ход — дождитесь своей очереди');
      setTimeout(() => setError(null), 1200);
      return;
    }
    socket.emit('poker/action', action);
  };

  const startGame = () => {
    if (!socket) return;
    socket.emit('poker/start');
  };
  const onSit = (idx: number) => {
    if (!socket) return;
    socket.emit('poker/sit', { seatIdx: idx });
  };

  // Derived
  const mySeatIdx = useMemo(() => {
    if (!myPid) return null;
    const idx = state.seats.findIndex((s) => s.pid === myPid);
    return idx >= 0 ? idx : null;
  }, [state.seats, myPid]);
  const mySeat = mySeatIdx !== null && mySeatIdx >= 0 ? state.seats[mySeatIdx] : null;
  const canAct = Boolean(state.currentToActPid && state.currentToActPid === myPid);

  // seats to render and positions
  const seatsToRender = useMemo(() => {
    if (state.stage !== 'waiting') return state.seats.filter((s) => !!s.pid);
    return state.seats.slice(0, DEFAULT_SEAT_COUNT);
  }, [state.seats, state.stage]);

  const seatPositions = useMemo(() => {
    const count = Math.max(1, seatsToRender.length);
    const rx = 44;
    const ry = 36;
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

  const playerRadialOffsetPx = 20;

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

    if (!seat.pid && state.stage === 'waiting') {
      return (
        <div
          key={`empty-${originalIdx}-${posIdx}`}
          className="seat-inline empty-seat"
          style={{
            left: `${pos.left}%`,
            top: `${pos.top}%`,
            transform: `translate(calc(-50% + ${shiftX}px), calc(-50% + ${shiftY}px))`,
            position: 'absolute',
            width: 180,
            zIndex: 800,
          }}
        >
          <div className="empty-avatar">+</div>
          <div className="meta-name">Empty</div>
          <button className="pc-sit-btn" onClick={() => onSit(originalIdx)}>
            Sit
          </button>
        </div>
      );
    }

    return (
      <div
        key={seat.pid ?? `seat-${originalIdx}-${posIdx}`}
        className={`seat-inline ${seat.folded ? 'folded' : ''} ${isMe ? 'me' : ''} ${
          state.currentToActPid === seat.pid ? 'active-turn' : ''
        }`}
        style={{
          left: `${pos.left}%`,
          top: `${pos.top}%`,
          transform: `translate(calc(-50% + ${shiftX}px), calc(-50% + ${shiftY}px))`,
          position: 'absolute',
          width: 220,
          maxWidth: 260,
          zIndex: isMe ? 1200 : 900,
        }}
      >
        <div className="seat-top-inline">
          <div className="seat-left-inline">
            <div className="avatar-wrap">
              <img
                src={seat.avatar ?? '/assets/default-avatar.png'}
                alt={seat.name ?? 'avatar'}
                className="avatar-img"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = '/assets/default-avatar.png';
                }}
              />
            </div>

            <div className="meta">
              <div className="meta-name">{seat.pid ? (isMe ? 'You' : seat.name ?? 'Player') : 'Empty'}</div>
              <div className="meta-stack">{seat.chips.toLocaleString('ru-RU')}</div>
            </div>
          </div>

          <div className="seat-right-inline">
            {seat.bet > 0 ? <div className="chip-pill">Bet {seat.bet}</div> : null}
            {seat.isDealer ? <div className="dealer-pill">D</div> : null}
          </div>
        </div>

        <div className="seat-cards-inline">
          <CardFlip
            frontSrc={cardA ? cardA.image : '/assets/cards/cardRedBack.png'}
            backSrc="/assets/cards/cardRedBack.png"
            revealed={revealedA}
            size="small"
            delayMs={0}
            altFront={cardA?.name}
            altBack="card back"
            shouldAnimate={true}
          />
          <CardFlip
            frontSrc={cardB ? cardB.image : '/assets/cards/cardRedBack.png'}
            backSrc="/assets/cards/cardRedBack.png"
            revealed={revealedB}
            size="small"
            delayMs={80}
            altFront={cardB?.name}
            altBack="card back"
            shouldAnimate={true}
          />
        </div>

        <div className="seat-combo-inline">{comboLabel}</div>
      </div>
    );
  };

  // board rendering: use boardRevealCountLocal & animateIndicesRef
  const renderBoard = () => {
    const boardCards = Array.from({ length: 5 }).map((_, i) => state.board[i] ?? null);
    return (
      <div className="board-cards" role="list" aria-label="Board cards">
        {boardCards.map((card, i) => {
          const shouldReveal = i < boardRevealCountLocal && Boolean(card);
          const delayForCard = i * BOARD_STAGGER_MS;
          const shouldAnimate = animateIndicesRef.current.has(i);
          return (
            <CardFlip
              key={`board-${i}`}
              frontSrc={card ? card.image : '/assets/cards/cardRedBack.png'}
              backSrc="/assets/cards/cardRedBack.png"
              revealed={shouldReveal}
              size="normal"
              delayMs={shouldAnimate ? delayForCard : 0}
              altFront={card?.name}
              altBack="board back"
              shouldAnimate={shouldAnimate}
            />
          );
        })}
      </div>
    );
  };

  // render result overlay
  const renderResultOverlay = () => {
    if (!resultPayload) return null;
    const payouts = Array.isArray(resultPayload.payouts) ? resultPayload.payouts : [];
    const winnersDetail = Array.isArray(resultPayload.winnersDetail) ? resultPayload.winnersDetail : [];
    const msg = resultPayload.message ?? null;
    const winnerPids: string[] = payouts.map((p: any) => p.pid).filter(Boolean);
    const fallbackMessage =
      msg ??
      (winnerPids.length > 0
        ? `Winner${winnerPids.length > 1 ? 's' : ''}: ${winnerPids
            .map((pid) => {
              const seat = state.seats.find((s) => s.pid === pid);
              return seat ? (seat.pid === myPid ? 'You' : seat.name ?? 'Player') : pid;
            })
            .join(', ')}`
        : 'Hand finished');

    return (
      <AnimatePresence>
        <motion.div key="result-overlay" className="result-overlay-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div
            className="result-overlay-card"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 24 }}
          >
            <div className="result-header">Hand result</div>
            <div className="result-message">{fallbackMessage}</div>

            {payouts.length > 0 && (
              <div className="result-payouts">
                {payouts.map((p: any, idx: number) => {
                  const seat = state.seats.find((s) => s.pid === p.pid);
                  const friendly = seat ? (seat.pid === myPid ? 'You' : seat.name ?? 'Player') : p.pid;
                  return (
                    <div className="result-row" key={idx}>
                      <div className="result-player">{friendly}</div>
                      <div className="result-amt">+{p.amount}</div>
                    </div>
                  );
                })}
              </div>
            )}

            {winnersDetail && winnersDetail.length > 0 && payouts.length === 0 && (
              <div className="result-winners">
                {winnersDetail.map((w: any, i: number) => {
                  const seat = state.seats.find((s) => s.pid === w.pid);
                  const friendly = seat ? (seat.pid === myPid ? 'You' : seat.name ?? 'Player') : w.pid ?? `#${i + 1}`;
                  return (
                    <div className="result-row" key={i}>
                      <div className="result-player">{friendly}</div>
                      <div className="result-amt">{w.reason ?? ''}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
  };

  /* ---------- Fullscreen handling for F11 modal ---------- */
  const handleF11 = async () => {
    try {
      if (!document.fullscreenElement) {
        const el = document.documentElement as any;
        const request = el.requestFullscreen?.bind(el) || el.webkitRequestFullscreen?.bind(el) || el.msRequestFullscreen?.bind(el);
        if (request) {
          await request();
        } else {
          console.warn('Fullscreen API not available (request).');
        }
      } else {
        const exit =
          (document as any).exitFullscreen?.bind(document) ||
          (document as any).webkitExitFullscreen?.bind(document) ||
          (document as any).msExitFullscreen?.bind(document);
        if (exit) {
          await exit();
        } else {
          console.warn('Fullscreen API not available (exit).');
        }
      }
    } catch (e) {
      console.warn('Fullscreen API failed', e);
    } finally {
      setShowF11Modal(false);
      if (f11IntervalRef.current) {
        window.clearInterval(f11IntervalRef.current);
        f11IntervalRef.current = null;
      }
    }
  };

  const closeF11Modal = () => {
    setShowF11Modal(false);
    if (f11IntervalRef.current) {
      window.clearInterval(f11IntervalRef.current);
      f11IntervalRef.current = null;
    }
  };

  /* ---------- Render ---------- */
  return (
    <div className="poker-page">
      <div className="poker-container">
        <header className="poker-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h2 style={{ margin: 0 }}>Texas Hold'em — No Limit</h2>
            <ChipStack chips={mySeat?.chips ?? 0} />
          </div>

          <div className="poker-controls">
            <button className="btn big-start" onClick={startGame} style={{ color: '#fff' }}>
              Start / Deal
            </button>
          </div>
        </header>

        {error && <div className="poker-error">{error}</div>}

        <div className="poker-table">
          <div className="table-oval" role="region" aria-label="Poker table">
            <div className="board-area">
              <div className="pc-board">
                <div className="pc-board-info">
                  <div className="pc-pot">
                    Ставка: <strong>{state.pot}</strong>
                  </div>
                  {state.sidePots && state.sidePots.length > 0 && <div className="pc-sidepots">Side: {state.sidePots.map((s) => s.amount).join(', ')}</div>}
                </div>
                {renderBoard()}
              </div>
            </div>

            {seatsToRender.map((s, i) => renderSeat(s, state.seats.indexOf(s), i))}
          </div>
        </div>

        <div className="poker-actions" style={{ marginTop: 18 }}>
          <div className="action-info" style={{ marginBottom: 8 }}>
            <div>To act: {state.currentToActPid === myPid ? 'YOU' : state.currentToActPid ?? '-'}</div>
            <div>Min Raise: {state.minRaise}</div>
            <div>
              Blinds: {state.smallBlind}/{state.bigBlind}
            </div>
            <div>Stage: {state.stage}</div>
          </div>

          <div className="action-buttons">
            <button className="action-btn fold" disabled={!canAct} onClick={() => sendAction({ type: 'fold' })}>
              FOLD
            </button>
            <button className="action-btn check" disabled={!canAct} onClick={() => sendAction({ type: 'check' })}>
              CHECK
            </button>
            <button className="action-btn call" disabled={!canAct} onClick={() => sendAction({ type: 'call' })}>
              CALL
            </button>

            <div className="raise-control">
              <input className="raise-input" id="raiseAmount" type="number" min={50} step={50} defaultValue={state.minRaise || state.bigBlind || 100} disabled={!canAct} />
              <button
                className="action-btn raise"
                disabled={!canAct}
                onClick={() => {
                  const el = document.getElementById('raiseAmount') as HTMLInputElement | null;
                  const amount = el ? Math.max(50, parseInt(el.value || '0', 10)) : state.minRaise || 100;
                  sendAction({ type: 'raise', amount });
                }}
              >
                RAISE
              </button>
            </div>

            <button className="action-btn allin" disabled={!canAct} onClick={() => sendAction({ type: 'allin' })}>
              ALL-IN
            </button>
          </div>
        </div>

        {/* Result overlay */}
        {renderResultOverlay()}

        {/* F11 modal (bottom-right) */}
        <AnimatePresence>
          {showF11Modal && (
            <motion.div
              className="f11-modal-wrap"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.28 }}
            >
              <div className="f11-modal">
                <div className="f11-modal-title">Для лучшего погружения в игру — нажмите F11</div>
                <div className="f11-modal-body">Режим полного экрана улучшает визуализацию и анимации.</div>

                <div className="f11-progress-bar" aria-hidden>
                  <div className="f11-progress-inner" style={{ width: `${f11Pct}%` }} />
                </div>

                <div className="f11-modal-actions">
                  <button className="f11-btn close" onClick={closeF11Modal}>
                    Закрыть
                  </button>
                  <button
                    className="f11-btn f11"
                    onClick={() => {
                      handleF11();
                    }}
                  >
                    F11
                  </button>
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
