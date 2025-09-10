import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ioClient from 'socket.io-client';
import { useSearchParams } from 'react-router-dom';
import '../styles/Game.css';

const SOCKET_URL = 'http://localhost:3000';

// Animation timing constants (should match server config)
const CARD_ANIM_DURATION_MS = 420;
const PER_CARD_DELAY_MS = 250;
const BLACKJACK_RESULT_DELAY_MS = 1200;

interface Card { name: string; image: string; value: number; }
interface PlayerPublic {
  pid: string;
  cards: Card[];
  points: number;
  bet: number;
  chips: number;
}
interface GameUpdatePayload {
  stateId?: number;
  dealerCards: Card[];
  players: PlayerPublic[];
  status: 'betting' | 'collectingBets' | 'dealing' | 'playing' | 'dealerTurn' | 'results';
  dealerPoints: number;
  currentTurnPid?: string | null;
}
interface GameResult { result: string; message: string; }

function genLocalPid() { return 'pid_' + Math.random().toString(36).slice(2, 10); }
const storedPidKey = 'blackjack_player_pid';

// 7 мест вокруг краёв стола (2 по бокам, 5 по нижнему краю)
const seatClass = (i: number) => `seat-${(i % 7) + 1}`;

const Game: React.FC = () => {
  const [searchParams] = useSearchParams();
  const mode = (searchParams.get('mode') || 'bot') as 'bot' | 'friend' | 'lobby';

  const [socket, setSocket] = useState<any | null>(null);
  const [gameState, setGameState] = useState<GameUpdatePayload>({
    dealerCards: [], players: [], status: 'betting', dealerPoints: 0,
  } as GameUpdatePayload);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GameResult | null>(null);

  const [playerPid, setPlayerPid] = useState<string>(() => {
    try { const ex = localStorage.getItem(storedPidKey); if (ex) return ex; } catch {}
    const pid = genLocalPid();
    try { localStorage.setItem(storedPidKey, pid); } catch {}
    return pid;
  });

  // visuals
  const [dealerSvg, setDealerSvg] = useState<string>('/assets/dealer-1.svg');
  const [showBlackjack, setShowBlackjack] = useState(false);
  const [blackjackWho, setBlackjackWho] = useState<string | null>(null);

  // betting sequence (server-side)
  const [betSecondsLeft, setBetSecondsLeft] = useState<number>(0);

  // timers used for blackjack overlay/result
  const blackjackAutoHideTimer = useRef<number | null>(null);
  const delayedResultTimer = useRef<number | null>(null);
  const resultAutoHideTimer = useRef<number | null>(null);

  const [reflowKey, setReflowKey] = useState(0); // to force small re-render when players change

  useEffect(() => {
    const s = ioClient(SOCKET_URL, {
      transports: ['websocket'], reconnection: true, reconnectionAttempts: 5, reconnectionDelay: 1000,
    });
    setSocket(s);

    const joinRoomWithPid = () => {
      try { s.emit('joinRoom', { roomId: 'defaultRoom', playerId: playerPid }); } catch {}
    };

    s.on('connect', () => { setError(null); joinRoomWithPid(); });

    s.on('joined', (payload: { roomId: string; playerId?: string }) => {
      if (payload && payload.playerId && payload.playerId !== playerPid) {
        try { localStorage.setItem(storedPidKey, payload.playerId); } catch {}
        setPlayerPid(payload.playerId);
      }
    });

    s.on('connect_error', (err: Error) => {
      console.error('Socket connection error:', err);
      setError('Не удалось подключиться к серверу.');
    });

    s.on('gameUpdate', (state: GameUpdatePayload) => {
      // pick dealer avatar on first reveal
      try {
        if ((state.dealerCards?.length ?? 0) > 0 && (gameState.dealerCards?.length ?? 0) === 0) {
          const pick = Math.random() < 0.5 ? '/assets/dealer-1.svg' : '/assets/dealer-2.svg';
          setDealerSvg(pick);
        }
      } catch {}
      setGameState(state);
      setReflowKey(k => k + 1);
    });

    s.on('betTimer', (payload: { remainingMs: number; totalMs: number; currentPid: string | null }) => {
      setBetSecondsLeft(payload.remainingMs / 1000);
    });

    s.on('gameResult', (res: GameResult) => {
      try {
        const message = res.message ?? '';
        const isBlackjack = res.result === 'blackjack' || /блэкджек|blackjack/i.test(message);
        let whoLabel: string | null = null;
        if (isBlackjack) {
          if (/дилер|dealer/i.test(message)) whoLabel = 'Дилер';
          else if (/Вы\b|Вы\s|you/i.test(message)) whoLabel = 'Вы';
          else {
            const playerMatch = message.match(/Игрок\s*\d+/i);
            whoLabel = playerMatch ? playerMatch[0] : 'Игрок';
          }
        }
        if (isBlackjack) {
          setBlackjackWho(whoLabel);
          setShowBlackjack(true);
          if (blackjackAutoHideTimer.current) window.clearTimeout(blackjackAutoHideTimer.current);
          blackjackAutoHideTimer.current = window.setTimeout(() => {
            setShowBlackjack(false);
            setBlackjackWho(null);
            blackjackAutoHideTimer.current = null;
          }, 2200);
          if (delayedResultTimer.current) window.clearTimeout(delayedResultTimer.current);
          delayedResultTimer.current = window.setTimeout(() => {
            setResult(res);
            if (resultAutoHideTimer.current) window.clearTimeout(resultAutoHideTimer.current);
            resultAutoHideTimer.current = window.setTimeout(() => setResult(null), 3000);
            delayedResultTimer.current = null;
          }, BLACKJACK_RESULT_DELAY_MS);
        } else {
          setResult(res);
          if (resultAutoHideTimer.current) window.clearTimeout(resultAutoHideTimer.current);
          resultAutoHideTimer.current = window.setTimeout(() => setResult(null), 3000);
        }
      } catch (e) { console.error(e); setResult(res); setTimeout(() => setResult(null), 3000); }
    });

    s.on('error', ({ message }: any) => { setError(message || 'Ошибка'); });

    return () => {
      if (blackjackAutoHideTimer.current) window.clearTimeout(blackjackAutoHideTimer.current);
      if (delayedResultTimer.current) window.clearTimeout(delayedResultTimer.current);
      if (resultAutoHideTimer.current) window.clearTimeout(resultAutoHideTimer.current);
      s.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerPid]);

  // helper - find local "me"
  const me = useMemo(() => gameState.players.find(p => p.pid === playerPid), [gameState.players, playerPid]);

  const placeBet = (amount: number) => {
    if (!socket || !socket.connected || (gameState.status !== 'betting' && gameState.status !== 'collectingBets')) return;
    socket.emit('placeBet', amount);
  };

  const skipBet = () => {
    if (!socket || !socket.connected || gameState.status !== 'collectingBets') return;
    socket.emit('skipBet');
  };

  const resetBet = () => {
    if (!socket || !socket.connected || gameState.status !== 'betting') return;
    socket.emit('resetBet');
  };

  const startGame = () => {
    if (!socket || !socket.connected) return;
    socket.emit('startGame');
  };

  const hit = () => {
    if (!socket || !socket.connected || gameState.status !== 'playing') return;
    socket.emit('hit');
  };

  const stand = () => {
    if (!socket || !socket.connected || gameState.status !== 'playing') return;
    socket.emit('stand');
  };

  // helpers
  const cardDelaySeconds = (index: number) => (index * PER_CARD_DELAY_MS) / 1000;
  const currentTurnPid = gameState.currentTurnPid ?? null;
  const betSequenceActive = gameState.status === 'collectingBets';

  // Форматирование количества фишек: 1000 → 1к, 52500 → 52.5к
  const formatChips = (chips: number) => {
    if (chips >= 1000) {
      return (chips / 1000).toFixed(chips % 1000 === 0 ? 0 : 1) + 'к';
    }
    return chips.toString();
  };

  // clean up on unmount (stop interval)
  useEffect(() => {
    return () => {
      if (blackjackAutoHideTimer.current) window.clearTimeout(blackjackAutoHideTimer.current);
      if (delayedResultTimer.current) window.clearTimeout(delayedResultTimer.current);
      if (resultAutoHideTimer.current) window.clearTimeout(resultAutoHideTimer.current);
    };
  }, []);

  // read profile (nickname/avatar) from localStorage profile_{pid}
  const getProfile = (pid: string) => {
    try {
      const raw = localStorage.getItem(`profile_${pid}`);
      if (!raw) return null;
      return JSON.parse(raw) as { nickname?: string; avatar?: string };
    } catch { return null; }
  };

  const compact = (gameState.players?.length || 0) > 5;
  const numPlayers = gameState.players.length;
  const centerIndex = (numPlayers - 1) / 2;

  return (
    <div className={`game ${compact ? 'seats-compact' : ''}`}>
      <div className="game-table-wrapper">
        <div className="game-mode-badge">
          Режим: {mode === 'bot' ? 'С ботом' : mode === 'friend' ? 'С друзьями (демо)' : 'Лобби (демо)'}
        </div>

        {error && <div className="game-error">{error}</div>}

        <AnimatePresence>
          {result && (
            <motion.div
              className="game-result"
              initial={{ x: 300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 300, opacity: 0 }}
              transition={{ duration: 0.45 }}
            >
              <h3>{result.result}</h3>
              <p>{result.message}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showBlackjack && (
            <motion.div
              className="blackjack-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              aria-live="polite"
              role="status"
            >
              <motion.div
                className="blackjack-banner"
                initial={{ scale: 0.92, rotate: -2, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                exit={{ scale: 0.98, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 120, damping: 12 }}
              >
                <span className="blackjack-title">BLACKJACK!</span>
                <span className="blackjack-sub">
                  {blackjackWho ? `${blackjackWho} — Выплата 2.5×` : 'Выплата 2.5×'}
                </span>
                <div className="blackjack-sparkles" />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Полукруглый стол с коричневыми краями и зелёным центром */}
        <div className="game-table table-oval">
          {/* Dealer avatar */}
          <div className="dealer-avatar-wrapper">
            <motion.img
              src={dealerSvg}
              alt="Dealer avatar"
              className="dealer-avatar"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.35 }}
              onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/assets/player-1.svg'; }}
            />
          </div>

          {/* Shoe */}
          <div className="shoe" aria-hidden>
            <svg width="60" height="40" viewBox="0 0 60 40" className="shoe-svg" xmlns="http://www.w3.org/2000/svg" aria-hidden>
              <rect x="2" y="6" rx="4" width="52" height="28" fill="#222" stroke="#fff" strokeOpacity="0.06" />
              <rect x="10" y="2" rx="3" width="32" height="12" fill="#0f1724" stroke="#fff" strokeOpacity="0.06" />
            </svg>
          </div>

          {/* Dealer area */}
          <div className="dealer-area">
            <motion.h3
              initial={{ opacity: 0 }}
              animate={{ opacity: ((gameState.dealerCards.length > 0 && gameState.status === 'results') || gameState.dealerPoints > 0) ? 1 : 0 }}
              transition={{ duration: 0.45, delay: 0.3 }}
            >
              Дилер: {(gameState.status === 'playing' && gameState.dealerCards.length > 0)
                ? (gameState.dealerCards.slice(1).reduce((s, c) => s + c.value, 0))
                : gameState.dealerPoints}
            </motion.h3>

            <div className="cards-row" aria-live="polite">
              {gameState.dealerCards.length > 0 ? (
                gameState.dealerCards.map((card, index) => {
                  const reveal = gameState.status === 'dealerTurn' || gameState.status === 'results';
                  if (index === 0) {
                    return (
                      <motion.div
                        key={index}
                        className="card-flip-wrapper"
                        initial={{ x: 0, y: -40, opacity: 0 }}
                        animate={{ x: index * 22, y: 0, opacity: 1 }}
                        transition={{ duration: 0.38, ease: 'easeOut', delay: cardDelaySeconds(index) }}
                      >
                        <div className="card-flip-container" aria-hidden={false}>
                          <motion.img
                            className="game-card card-back"
                            src="/assets/cards/cardRedBack.png"
                            alt="Hidden Card Back"
                            initial={false}
                            animate={reveal ? { rotateY: 180, opacity: 0 } : { rotateY: 0, opacity: 1 }}
                            transition={{ duration: CARD_ANIM_DURATION_MS / 1000, ease: 'easeOut' }}
                            onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/assets/cards/cardRedBack.png'; }}
                          />
                          <motion.img
                            className="game-card card-front"
                            src={card.image}
                            alt={card.name}
                            initial={false}
                            animate={reveal ? { rotateY: 0, opacity: 1 } : { rotateY: -180, opacity: 0 }}
                            transition={{ duration: CARD_ANIM_DURATION_MS / 1000, ease: 'easeOut', delay: reveal ? 0.02 : 0 }}
                            onError={(e) => { (e.currentTarget as HTMLImageElement).src = 'https://via.placeholder.com/80x120?text=Card'; }}
                          />
                        </div>
                      </motion.div>
                    );
                  }
                  return (
                    <motion.img
                      key={index}
                      src={card.image}
                      alt={card.name}
                      className="game-card"
                      initial={{ x: 0, y: -100, rotateY: 180, opacity: 0 }}
                      animate={{ x: index * 22, y: 0, rotateY: 0, opacity: 1 }}
                      transition={{ duration: CARD_ANIM_DURATION_MS / 1000, ease: 'easeOut', delay: cardDelaySeconds(index) }}
                      onError={(e) => { (e.currentTarget as HTMLImageElement).src = 'https://via.placeholder.com/80x120?text=Card'; }}
                    />
                  );
                })
              ) : <p>Нет карт дилера</p>}
            </div>
          </div>

          {/* Players — 1..7 мест вдоль краёв стола */}
          <div className="game-players seats-layer" role="region" aria-label="Игроки">
            {gameState.players.length > 0 ? gameState.players.slice(0, 7).map((player, index) => {
              const isActive = Boolean(currentTurnPid && currentTurnPid === player.pid && gameState.status === 'playing');
              const isBetTurn = betSequenceActive && currentTurnPid === player.pid;
              const profile = getProfile(player.pid);
              const displayName = player.pid === playerPid ? (profile?.nickname ?? 'Вы') : (profile?.nickname ?? `Игрок`);
              const avatar = profile?.avatar ?? undefined;
              const staticId = index + 1;
              const initialOffsetX = (centerIndex - index) * 100; // Spread factor for flying from center

              return (
                <div key={player.pid} className={`game-player player-area ${seatClass(index)} ${isActive ? 'player-active' : ''}`}>
                  <div className="player-top">
                    <img src={avatar || '/assets/player-1.svg'} alt={displayName} className="player-avatar"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/assets/player-1.svg'; }} />
                    <div className="player-name-row">
                      <span className="player-name">{displayName}</span>
                      <span className="player-shortid">[#{staticId}]</span>
                      {isActive && <span className="your-turn-badge">Ход</span>}
                      <span className="player-points">Очки: {player.points}</span>
                    </div>

                    <div className="player-stats-row">
                      <span className="stat-badge chips" title="Фишки">🪙 {formatChips(player.chips)}</span>
                      <span className="stat-badge bet" title="Ставка">💵 {player.bet}</span>
                    </div>
                  </div>

                  <div className="cards-row">
                    {player.cards.length > 0 ? player.cards.map((card, i) => (
                      <motion.img
                        key={i}
                        src={card.image}
                        alt={card.name}
                        className="game-card"
                        initial={{ x: initialOffsetX, y: -300, rotateY: 180, opacity: 0 }}
                        animate={{ x: 0, y: 0, rotateY: 0, opacity: 1 }}
                        transition={{ duration: CARD_ANIM_DURATION_MS / 1000, ease: 'easeOut', delay: (index * 2 + i) * 0.12 }}
                        onError={(e) => { (e.currentTarget as HTMLImageElement).src = 'https://via.placeholder.com/80x120?text=Card'; }}
                      />
                    )) : <p className="no-cards">Нет карт</p>}
                  </div>

                  {/* betting loader under each player when it's their turn */}
                  <div className={`player-bet-area ${isBetTurn ? 'bet-turn' : ''}`}>
                    <div className="player-bet-controls">
                      {betSequenceActive ? (
                        <>
                          {isBetTurn ? (
                            <>
                              {player.pid === playerPid ? (
                                <>
                                  <div className="bet-buttons-inline">
                                    {[10, 50, 100].map(a => (
                                      <button key={a} onClick={() => placeBet(a)} className="bet-button small">{a}</button>
                                    ))}
                                    <button onClick={skipBet} className="game-button small">Пропустить</button>
                                  </div>
                                  <div className="player-bet-timer" role="progressbar" aria-valuemin={0} aria-valuemax={7} aria-valuenow={betSecondsLeft}>
                                    <div className="player-bet-timer-bar" style={{ width: `${(betSecondsLeft / 7) * 100}%` }} />
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div className="player-bet-wait">Ожидание хода</div>
                                  <div className="player-bet-timer">
                                    <div className="player-bet-timer-bar" style={{ width: `${(betSecondsLeft / 7) * 100}%` }} />
                                  </div>
                                </>
                              )}
                            </>
                          ) : (
                            <div className="player-bet-static">
                              <span>{player.bet > 0 ? `Ставка ${player.bet}` : '—'}</span>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="player-bet-static">
                          <span>{player.bet > 0 ? `Ставка ${player.bet}` : '—'}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            }) : <p>Нет игроков</p>}
          </div>

          {/* Controls centered under table */}
          <div className="game-controls" role="toolbar" aria-label="Игровые действия">
            {gameState.status === 'betting' && (
              <>
                <button
                  onClick={startGame}
                  className="game-button large"
                >
                  Start
                </button>
              </>
            )}

            {gameState.status === 'playing' && currentTurnPid === playerPid && (
              <>
                <button onClick={hit} className="game-button">Hit</button>
                <button onClick={stand} className="game-button">Stand</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Game;