// src/pages/Poker.tsx
import React, { useEffect, useMemo, useState } from 'react';
import ioClient from 'socket.io-client';
import { motion } from 'framer-motion';
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

/* ---------- CardFlip component (3D) with delay ---------- */
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
};

const CardFlip: React.FC<CardFlipProps> = ({ frontSrc, backSrc = '/assets/cards/cardRedBack.png', revealed, size = 'normal', delayMs = 0, altFront, altBack }) => {
  const w = size === 'small' ? 72 : 92;
  const h = size === 'small' ? 108 : 136;

  return (
    <div className={`card-flip card-flip--${size}`} style={{ width: w, height: h, perspective: 1100 }}>
      <motion.div
        className="card-flip-inner"
        animate={{ rotateY: revealed ? 180 : 0 }}
        initial={false}
        transition={{
          duration: FLIP_DURATION_MS / 1000,
          ease: [0.2, 0.9, 0.3, 1],
          delay: delayMs / 1000,
        }}
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
          onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/assets/cards/cardRedBack.png'; }}
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
          onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/assets/cards/cardRedBack.png'; }}
        />
      </motion.div>
    </div>
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

  useEffect(() => {
    const s = ioClient(SOCKET_URL, { transports: ['websocket'], reconnection: true });
    setSocket(s);

    const sendJoin = () => {
      try {
        s.emit('poker/join', { roomId: 'defaultPokerRoom', playerId: myPid ?? undefined });
      } catch (e) { console.warn('join emit failed', e); }
    };

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
    s.on('poker/error', ({ message }: { message: string }) => {
      setError(message);
      setTimeout(() => setError(null), 2500);
    });

    return () => { try { s.disconnect(); } catch {} };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // guard: only send action if it's your turn
  const sendAction = (action: { type: 'fold' | 'call' | 'check' | 'raise' | 'allin'; amount?: number }) => {
    if (!socket) return;
    const canAct = Boolean(state.currentToActPid && state.currentToActPid === myPid);
    if (!canAct) {
      // UI guard — server should also validate, but we block here to avoid accidental fast clicks
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

  /* Derived */
  const mySeatIdx = useMemo(() => {
    if (!myPid) return null;
    const idx = state.seats.findIndex((s) => s.pid === myPid);
    return idx >= 0 ? idx : null;
  }, [state.seats, myPid]);
  const mySeat = mySeatIdx !== null && mySeatIdx >= 0 ? state.seats[mySeatIdx] : null;
  const canAct = Boolean(state.currentToActPid && state.currentToActPid === myPid);

  // seats to render: before game (waiting) show all (to allow sit). After start show only occupied seats.
  const seatsToRender = useMemo(() => {
    if (state.stage !== 'waiting') {
      return state.seats.filter((s) => !!s.pid);
    }
    return state.seats.slice(0, DEFAULT_SEAT_COUNT);
  }, [state.seats, state.stage]);

  // radial positions for seats around table
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

    // determine which front src for player cards
    const cardA = isMe ? (myCards[0] ?? null) : (showHole ? (seat.cards[0] ?? null) : null);
    const cardB = isMe ? (myCards[1] ?? null) : (showHole ? (seat.cards[1] ?? null) : null);

    const revealedA = Boolean(cardA);
    const revealedB = Boolean(cardB);

    // empty seat in waiting stage
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
          <button className="pc-sit-btn" onClick={() => onSit(originalIdx)}>Sit</button>
        </div>
      );
    }

    return (
      <div
        key={seat.pid ?? `seat-${originalIdx}-${posIdx}`}
        className={`seat-inline ${seat.folded ? 'folded' : ''} ${isMe ? 'me' : ''} ${state.currentToActPid === seat.pid ? 'active-turn' : ''}`}
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
                onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/assets/default-avatar.png'; }}
              />
            </div>

            <div className="meta">
              <div className="meta-name">{seat.pid ? (isMe ? 'You' : (seat.name ?? 'Player')) : 'Empty'}</div>
              <div className="meta-stack">{seat.chips.toLocaleString('ru-RU')}</div>
            </div>
          </div>

          <div className="seat-right-inline">
            {seat.bet > 0 ? <div className="chip-pill">Bet {seat.bet}</div> : null}
            {seat.isDealer ? <div className="dealer-pill">D</div> : null}
          </div>
        </div>

        <div className="seat-cards-inline">
          {/* Card A */}
          <CardFlip
            frontSrc={cardA ? cardA.image : '/assets/cards/cardRedBack.png'}
            backSrc="/assets/cards/cardRedBack.png"
            revealed={revealedA}
            size="small"
            delayMs={0}
            altFront={cardA?.name}
            altBack="card back"
          />
          {/* Card B */}
          <CardFlip
            frontSrc={cardB ? cardB.image : '/assets/cards/cardRedBack.png'}
            backSrc="/assets/cards/cardRedBack.png"
            revealed={revealedB}
            size="small"
            delayMs={80}
            altFront={cardB?.name}
            altBack="card back"
          />
        </div>

        <div className="seat-combo-inline">{comboLabel}</div>
      </div>
    );
  };

  // board reveal logic: how many board cards should be revealed for current stage
  const boardRevealedCount = (() => {
    switch (state.stage) {
      case 'flop': return 3;
      case 'turn': return 4;
      case 'river': return 5;
      case 'showdown':
      case 'results': return state.board.length;
      default: return 0; // preflop/waiting
    }
  })();

  const renderBoard = () => {
    const boardCards = Array.from({ length: 5 }).map((_, i) => state.board[i] ?? null);
    return (
      <div className="board-cards" role="list" aria-label="Board cards">
        {boardCards.map((card, i) => {
          const shouldReveal = i < boardRevealedCount && Boolean(card);
          const delayForCard = i * BOARD_STAGGER_MS;
          return (
            <CardFlip
              key={`board-${i}-${state.stateId ?? 0}`}
              frontSrc={card ? card.image : '/assets/cards/cardRedBack.png'}
              backSrc="/assets/cards/cardRedBack.png"
              revealed={shouldReveal}
              size="normal"
              delayMs={shouldReveal ? delayForCard : 0}
              altFront={card?.name}
              altBack="board back"
            />
          );
        })}
      </div>
    );
  };

  // seats with position mapping
  const seatsRenderList = seatsToRender.map((s, i) => ({ seat: s, originalIdx: state.seats.indexOf(s), posIdx: i }));

  return (
    <div className="poker-page">
      <div className="poker-container">
        <header className="poker-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h2 style={{ margin: 0 }}>Texas Hold'em — No Limit</h2>
            <ChipStack chips={mySeat?.chips ?? 0} />
          </div>

          <div className="poker-controls">
            <button className="btn big-start" onClick={startGame} style={{ color: '#fff' }}>Start / Deal</button>
          </div>
        </header>

        {error && <div className="poker-error">{error}</div>}

        <div className="poker-table">
          <div className="table-oval" role="region" aria-label="Poker table">
            <div className="board-area">
              <div className="pc-board">
                <div className="pc-board-info">
                  <div className="pc-pot">Ставка: <strong>{state.pot}</strong></div>
                  {state.sidePots && state.sidePots.length > 0 && (<div className="pc-sidepots">Side: {state.sidePots.map(s => s.amount).join(', ')}</div>)}
                </div>
                {renderBoard()}
              </div>
            </div>

            {seatsRenderList.map((it, idx) => renderSeat(it.seat, it.originalIdx, idx))}
          </div>
        </div>

        <div className="poker-actions" style={{ marginTop: 18 }}>
          <div className="action-info" style={{ marginBottom: 8 }}>
            <div>To act: {state.currentToActPid === myPid ? 'YOU' : (state.currentToActPid ?? '-')}</div>
            <div>Min Raise: {state.minRaise}</div>
            <div>Blinds: {state.smallBlind}/{state.bigBlind}</div>
            <div>Stage: {state.stage}</div>
          </div>

          <div className="action-buttons">
            <button className="action-btn fold" disabled={!canAct} onClick={() => sendAction({ type: 'fold' })}>FOLD</button>
            <button className="action-btn check" disabled={!canAct} onClick={() => sendAction({ type: 'check' })}>CHECK</button>
            <button className="action-btn call" disabled={!canAct} onClick={() => sendAction({ type: 'call' })}>CALL</button>

            <div className="raise-control">
              <input className="raise-input" id="raiseAmount" type="number" min={50} step={50} defaultValue={state.minRaise || state.bigBlind || 100} disabled={!canAct} />
              <button className="action-btn raise" disabled={!canAct} onClick={() => {
                const el = document.getElementById('raiseAmount') as HTMLInputElement | null;
                const amount = el ? Math.max(50, parseInt(el.value || '0', 10)) : (state.minRaise || 100);
                sendAction({ type: 'raise', amount });
              }}>RAISE</button>
            </div>

            <button className="action-btn allin" disabled={!canAct} onClick={() => sendAction({ type: 'allin' })}>ALL-IN</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Poker;
