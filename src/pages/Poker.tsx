// src/pages/Poker.tsx
import React, { useEffect, useMemo, useState } from 'react';
import ioClient from 'socket.io-client';
import '../styles/Poker.css';
import '../components/Poker/poker-components.css';
import Board from '../components/Poker/Board';
import SeatComponent from '../components/Poker/Seat';
import Controls from '../components/Poker/Controls';
import ChipStack from '../components/Poker/ChipStack';

// pokersolver — CommonJS
// @ts-ignore
import PokerSolver from 'pokersolver';
const { Hand } = PokerSolver as { Hand: any };

const SOCKET_URL = 'http://localhost:3000';
const POKER_PID_KEY = 'poker_player_pid';

/* types omitted here for brevity — keep same as earlier in your file */
/* ...using same types Card, Seat, PokerState, etc. as before... */

export type Card = { name: string; image: string; value?: number };
export type Seat = {
  pid: string | null;
  name?: string | null;
  chips: number;
  bet: number;
  cards: Card[];
  isActive?: boolean;
  isDealer?: boolean;
  isAllIn?: boolean;
  folded?: boolean;
};
export type PokerStage = 'waiting'|'preflop'|'flop'|'turn'|'river'|'showdown'|'results';
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

const DEFAULT_SEAT_COUNT = 6;
const makeEmptySeat = (): Seat => ({
  pid: null, name: null, chips: 0, bet:0, cards: [], isActive:false, isDealer:false, isAllIn:false, folded:false
});

const initialPokerState: PokerState = {
  seats: Array.from({ length: DEFAULT_SEAT_COUNT }, () => makeEmptySeat()),
  board: [], pot:0, sidePots: [], currentToActPid: null, minRaise: 0, smallBlind:50, bigBlind:100, stage:'waiting', stateId:0
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

const RUS_NAME: Record<string,string> = {
  'Royal Flush':'Роял-флеш','Straight Flush':'Стрит-флеш','Four of a Kind':'Каре','Full House':'Фул-хаус',
  'Flush':'Флеш','Straight':'Стрит','Three of a Kind':'Сет','Two Pair':'Две пары','Pair':'Пара','High Card':'Старшая карта'
};

function solveLabel(hole: Card[], board: Card[]): string {
  try {
    const holeCodes = (hole ?? []).map(c => normalizeCode(c.name)).filter(Boolean) as string[];
    const boardCodes = (board ?? []).map(c => normalizeCode(c.name)).filter(Boolean) as string[];
    const codes = [...holeCodes, ...boardCodes];
    if (!Hand || codes.length < 5) return '—';
    const solved = Hand.solve(codes);
    const name: string|undefined = solved?.name;
    if (!name) return '—';
    return RUS_NAME[name] ?? name;
  } catch {
    return '—';
  }
}

const Poker: React.FC = () => {
  const [socket, setSocket] = useState<any | null>(null);
  const [state, setState] = useState<PokerState>(initialPokerState);
  const [myPid, setMyPid] = useState<string | null>(() => {
    try { return localStorage.getItem(POKER_PID_KEY); } catch { return null; }
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

    s.on('connect', () => {
      console.log('[poker] connected', s.id);
      setError(null);
      sendJoin();
    });

    s.on('connect_error', (err: Error) => {
      console.error('[poker] connect_error', err);
      setError('Не удалось подключиться к серверу.');
    });

    s.on('poker/joined', (payload: { pid: string; state?: Partial<PokerState> }) => {
      console.log('[poker] joined', payload);
      // persist pid to localStorage so refresh keeps identity
      try { localStorage.setItem(POKER_PID_KEY, payload.pid); } catch (e) {}
      setMyPid(payload.pid);
      applyPublicUpdate(payload.state);
    });

    s.on('poker/update', (incoming: Partial<PokerState>) => {
      applyPublicUpdate(incoming);
    });

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
    });

    return () => {
      try { s.disconnect(); } catch (e) {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [/* we intentionally don't include myPid here to avoid reconnect loop */]);

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

  const sendAction = (action: { type: 'fold'|'call'|'check'|'raise'|'allin'; amount?: number }) => {
    if (!socket) return;
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

  const mySeatIdx = useMemo(() => {
    if (!myPid) return null;
    const idx = state.seats.findIndex((s) => s.pid === myPid);
    return idx >= 0 ? idx : null;
  }, [state.seats, myPid]);

  const mySeat = mySeatIdx !== null && mySeatIdx >= 0 ? state.seats[mySeatIdx] : null;
  const canAct = Boolean(state.currentToActPid && state.currentToActPid === myPid);

  return (
    <div className="poker-page">
      <div className="poker-container">
        <header className="poker-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h2 style={{ margin: 0 }}>Texas Hold&apos;em — No Limit</h2>
            <ChipStack chips={mySeat?.chips ?? 0} />
          </div>

          <div className="poker-controls">
            <button className="btn" onClick={startGame}>Start / Deal</button>
          </div>
        </header>

        {error && <div className="poker-error">{error}</div>}

        <div className="poker-table">
          <div className="table-center">
            <Board board={state.board} pot={state.pot} sidePots={state.sidePots} stage={state.stage} />

            <div style={{ marginTop: 10, textAlign: 'center', color: '#cfeaff' }}>
              <div>Stage: <strong>{state.stage}</strong></div>
              <div>SB/BB: {state.smallBlind}/{state.bigBlind}</div>
              <div>To act: {state.currentToActPid ? (state.currentToActPid === myPid ? 'YOU' : state.currentToActPid) : '-'}</div>
            </div>
          </div>

          <div className="seats-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, marginTop: 18 }}>
            {state.seats.map((seat, idx) => {
              const isMe = Boolean(myPid && seat.pid === myPid);
              const showHole = state.stage === 'showdown' || state.stage === 'results';

              let comboLabel = '—';
              if (isMe) comboLabel = solveLabel(myCards, state.board);
              else if (seat.folded) comboLabel = 'Пас';
              else if (showHole) comboLabel = solveLabel(seat.cards || [], state.board);
              else if (seat.pid) comboLabel = 'Скрыто';

              return (
                <SeatComponent
                  key={idx}
                  seat={seat}
                  isMe={isMe}
                  myCards={isMe ? myCards : undefined}
                  showHole={showHole}
                  comboLabel={comboLabel}
                  onSit={() => onSit(idx)}
                />
              );
            })}
          </div>
        </div>

        <div className="poker-actions" style={{ marginTop: 18 }}>
          <div className="action-info" style={{ marginBottom: 8 }}>
            <div>To act: {state.currentToActPid === myPid ? 'YOU' : (state.currentToActPid ?? '-')}</div>
            <div>Min Raise: {state.minRaise}</div>
          </div>

          <div className="action-buttons">
            <Controls
              onFold={() => sendAction({ type: 'fold' })}
              onCall={() => sendAction({ type: 'call' })}
              onCheck={() => sendAction({ type: 'check' })}
              onRaise={(amount: number) => sendAction({ type: 'raise', amount })}
              onAllIn={() => sendAction({ type: 'allin' })}
              minRaise={state.minRaise}
              canAct={canAct}
              stack={mySeat?.chips ?? 1000}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Poker;
