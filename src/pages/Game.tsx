// src/pages/Game.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ioClient from 'socket.io-client';
import { useSearchParams } from 'react-router-dom';
import '../styles/Game.css';

const SOCKET_URL = 'http://localhost:3000';

// Animation timing constants (should match server config)
const CARD_ANIM_DURATION_MS = 420;
const PER_CARD_DELAY_MS = 250;

// Delay to wait when player gets blackjack before announcing result (ms)
const BLACKJACK_RESULT_DELAY_MS = 1200;

interface Card {
  name: string;
  image: string;
  value: number;
}

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
  status: 'betting' | 'dealing' | 'playing' | 'dealerTurn' | 'results';
  dealerPoints: number;
  currentTurnPid?: string | null;
}

interface GameResult {
  result: string;
  message: string;
}

function genLocalPid() {
  return 'pid_' + Math.random().toString(36).slice(2, 10);
}

const storedPidKey = 'blackjack_player_pid';

const Game: React.FC = () => {
  const [searchParams] = useSearchParams();
  const mode = (searchParams.get('mode') || 'bot') as 'bot' | 'friend' | 'lobby';

  const [socket, setSocket] = useState<any | null>(null);
  const [gameState, setGameState] = useState<GameUpdatePayload>({
    dealerCards: [],
    players: [],
    status: 'betting',
    dealerPoints: 0,
  } as GameUpdatePayload);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GameResult | null>(null);

  const [playerPid, setPlayerPid] = useState<string>(() => {
    try {
      const ex = localStorage.getItem(storedPidKey);
      if (ex) return ex;
    } catch (e) { /* ignore */ }
    const pid = genLocalPid();
    try { localStorage.setItem(storedPidKey, pid); } catch (e) {}
    return pid;
  });

  const prevDealerCardsLen = useRef<number>(0);
  const prevBetRef = useRef<number>(0);
  const [chipPulseKey, setChipPulseKey] = useState<number>(0);

  // chosen dealer avatar
  const [dealerSvg, setDealerSvg] = useState<string>('/assets/dealer-1.svg');

  // Blackjack overlay state
  const [showBlackjack, setShowBlackjack] = useState<boolean>(false);
  const [blackjackWho, setBlackjackWho] = useState<string | null>(null);

  // timers refs to clean up
  const blackjackAutoHideTimer = useRef<number | null>(null);
  const delayedResultTimer = useRef<number | null>(null);
  const resultAutoHideTimer = useRef<number | null>(null);

  useEffect(() => {
    const s = ioClient(SOCKET_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    setSocket(s);

    const joinRoomWithPid = () => {
      try {
        s.emit('joinRoom', { roomId: 'defaultRoom', playerId: playerPid });
      } catch (e) {
        console.warn('joinRoom emit failed', e);
      }
    };

    s.on('connect', () => {
      setError(null);
      joinRoomWithPid();
    });

    s.on('joined', (payload: { roomId: string; playerId?: string }) => {
      if (payload && payload.playerId && payload.playerId !== playerPid) {
        try { localStorage.setItem(storedPidKey, payload.playerId); } catch (e) {}
        setPlayerPid(payload.playerId);
      }
    });

    s.on('connect_error', (err: Error) => {
      console.error('Socket connection error:', err);
      setError('Не удалось подключиться к серверу. Проверьте, запущен ли сервер.');
    });

    s.on('gameUpdate', (state: GameUpdatePayload) => {
      try {
        const newDealerLen = state.dealerCards ? state.dealerCards.length : 0;
        if (prevDealerCardsLen.current === 0 && newDealerLen > 0) {
          const pick = Math.random() < 0.5 ? '/assets/dealer-1.svg' : '/assets/dealer-2.svg';
          setDealerSvg(pick);
        }
        prevDealerCardsLen.current = newDealerLen;
      } catch (e) { console.error('Error handling dealer svg selection:', e); }

      setGameState(state);
    });

    // gameResult handling: if blackjack -> show blackjack overlay and delay showing result
    s.on('gameResult', (res: GameResult) => {
      try {
        const message = res.message ?? '';
        const isBlackjack = res.result === 'blackjack' || /блэкджек|blackjack/i.test(message);

        // determine who — prefer explicit detection in message; otherwise, if server sent 'blackjack' directly to this client, assume it's "Вы"
        let whoLabel: string | null = null;
        if (isBlackjack) {
          if (/дилер|dealer/i.test(message)) {
            whoLabel = 'Дилер';
          } else if (/Вы\b|Вы\s|you/i.test(message)) {
            whoLabel = 'Вы';
          } else {
            const playerMatch = message.match(/Игрок\s*\d+/i);
            whoLabel = playerMatch ? playerMatch[0] : 'Вы';
          }
        }

        if (isBlackjack) {
          // show overlay immediately
          setBlackjackWho(whoLabel);
          setShowBlackjack(true);

          // clear previous timers if any
          if (blackjackAutoHideTimer.current) window.clearTimeout(blackjackAutoHideTimer.current);
          if (delayedResultTimer.current) window.clearTimeout(delayedResultTimer.current);
          if (resultAutoHideTimer.current) window.clearTimeout(resultAutoHideTimer.current);

          // hide overlay after ~2.2s (visual)
          blackjackAutoHideTimer.current = window.setTimeout(() => {
            setShowBlackjack(false);
            setBlackjackWho(null);
            blackjackAutoHideTimer.current = null;
          }, 2200);

          // delay announcing the toast/result to allow card animation to finish
          delayedResultTimer.current = window.setTimeout(() => {
            setResult(res);
            // auto-hide toast after 3s
            resultAutoHideTimer.current = window.setTimeout(() => setResult(null), 3000);
            delayedResultTimer.current = null;
          }, BLACKJACK_RESULT_DELAY_MS);
        } else {
          // not blackjack: show result immediately (as before)
          if (delayedResultTimer.current) {
            window.clearTimeout(delayedResultTimer.current);
            delayedResultTimer.current = null;
          }
          if (resultAutoHideTimer.current) {
            window.clearTimeout(resultAutoHideTimer.current);
            resultAutoHideTimer.current = null;
          }
          setResult(res);
          resultAutoHideTimer.current = window.setTimeout(() => setResult(null), 3000);
        }
      } catch (e) {
        console.error('Error handling gameResult:', e);
        setResult(res);
        setTimeout(() => setResult(null), 3000);
      }
    });

    s.on('error', ({ message }: { message: string }) => {
      setError(message);
    });

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      try {
        if (gameState.status && gameState.status !== 'betting') {
          try { s.emit('leaveRoom', 'defaultRoom'); } catch (err) {}
          e.preventDefault();
          e.returnValue = 'Вы действительно хотите покинуть игру?';
          return e.returnValue;
        }
      } catch (err) { /* ignore */ }
      return undefined;
    };
    window.addEventListener('beforeunload', onBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      if (blackjackAutoHideTimer.current) window.clearTimeout(blackjackAutoHideTimer.current);
      if (delayedResultTimer.current) window.clearTimeout(delayedResultTimer.current);
      if (resultAutoHideTimer.current) window.clearTimeout(resultAutoHideTimer.current);
      s.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerPid]);

  // pulse on bet change (keeps prior behavior)
  useEffect(() => {
    const meBet = gameState.players.find((p) => p.pid === playerPid)?.bet ?? 0;
    if (prevBetRef.current !== meBet) {
      setChipPulseKey((k) => k + 1);
      prevBetRef.current = meBet;
    }
  }, [gameState.players, playerPid]);

  const placeBet = (amount: number) => {
    if (!socket || !socket.connected || gameState.status !== 'betting') return;
    socket.emit('placeBet', amount);
  };

  const resetBet = () => {
    if (!socket || !socket.connected || gameState.status !== 'betting') return;
    socket.emit('resetBet');
  };

  const startGame = () => {
    if (!socket || !socket.connected) return;
    const me = gameState.players.find((p) => p.pid === playerPid);
    if (!me || me.bet <= 0) return;
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

  // visible dealer points: when playing hide hole card
  const visibleDealerPoints =
    gameState.dealerCards.length > 0 && gameState.status === 'playing'
      ? gameState.dealerCards.slice(1).reduce((s, c) => s + c.value, 0)
      : gameState.dealerPoints;

  const cardDelaySeconds = (index: number) => (index * PER_CARD_DELAY_MS) / 1000;

  // helper to get local player object
  const me = useMemo(() => gameState.players.find((p) => p.pid === playerPid), [gameState.players, playerPid]);

  const currentTurnPid = (gameState as any).currentTurnPid as string | undefined;

  return (
    <div className="game">
      <div className="game-table-wrapper">
        {/* mode badge */}
        <div className="game-mode-badge">Режим: {mode === 'bot' ? 'С ботом' : mode === 'friend' ? 'С друзьями (демо)' : 'Лобби (демо)'}</div>

        {error && <div className="game-error">{error}</div>}

        <AnimatePresence>
          {result && (
            <motion.div
              className="game-result"
              initial={{ x: 300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 300, opacity: 0 }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
            >
              <h3>{result.result}</h3>
              <p>{result.message}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Blackjack overlay */}
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
                <span className="blackjack-sub">{blackjackWho ? `${blackjackWho} — Выплата 2.5×` : 'Выплата 2.5×'}</span>
                <div className="blackjack-sparkles" />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Полукруглый стол */}
        <div className="game-table">
          {/* Dealer avatar */}
          <div className="dealer-avatar-wrapper">
            <motion.img
              src={dealerSvg}
              alt="Dealer avatar"
              className="dealer-avatar"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.35 }}
              onError={(e: React.SyntheticEvent<HTMLImageElement>) => { e.currentTarget.src = '/assets/player-1.svg'; }}
            />
          </div>

          {/* Shoe */}
          <div className="shoe">
            <svg width="60" height="40" viewBox="0 0 60 40" className="shoe-svg" xmlns="http://www.w3.org/2000/svg" aria-hidden>
              <rect x="2" y="6" rx="4" width="52" height="28" fill="#222" stroke="#fff" strokeOpacity="0.06" />
              <rect x="10" y="2" rx="3" width="32" height="12" fill="#0f1724" stroke="#fff" strokeOpacity="0.06" />
            </svg>
          </div>

          {/* Dealer */}
          <div className="dealer-area">
            <motion.h3
              initial={{ opacity: 0 }}
              animate={{ opacity: visibleDealerPoints > 0 || gameState.status === 'results' ? 1 : 0 }}
              transition={{ duration: 0.45, delay: 0.3 }}
            >
              Дилер: {visibleDealerPoints}
            </motion.h3>

            <div className="cards-row" aria-live="polite">
              {gameState.dealerCards.length > 0 ? (
                gameState.dealerCards.map((card, index) => {
                  const reveal = gameState.status === 'dealerTurn' || gameState.status === 'results';

                  // hole card handling
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
                            onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                              e.currentTarget.src = '/assets/cards/cardRedBack.png';
                            }}
                          />

                          <motion.img
                            className="game-card card-front"
                            src={card.image}
                            alt={card.name}
                            initial={false}
                            animate={reveal ? { rotateY: 0, opacity: 1 } : { rotateY: -180, opacity: 0 }}
                            transition={{ duration: CARD_ANIM_DURATION_MS / 1000, ease: 'easeOut', delay: reveal ? 0.02 : 0 }}
                            onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                              e.currentTarget.src = 'https://via.placeholder.com/80x120?text=Card';
                            }}
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
                      onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                        e.currentTarget.src = 'https://via.placeholder.com/80x120?text=Card';
                      }}
                    />
                  );
                })
              ) : (
                <p>Нет карт дилера</p>
              )}
            </div>
          </div>

          {/* Players */}
          <div className="game-players">
            {gameState.players.slice(0, 3).length > 0 ? (
              gameState.players.slice(0, 3).map((player, index) => {
                const isActive = Boolean(currentTurnPid && currentTurnPid === player.pid);
                return (
                  <div key={player.pid} className={`game-player player-area player-${index + 1} ${isActive ? 'player-active' : ''}`}>
                    <div className="player-top">
                      <img src="/assets/player-1.svg" alt={`Player ${index + 1}`} className="player-avatar" />
                      <motion.h3
                        initial={{ opacity: 0 }}
                        animate={{ opacity: player.points > 0 ? 1 : 0 }}
                        transition={{ duration: 0.45, delay: (index * 2 + 1) * 0.2 }}
                      >
                        {player.pid === playerPid ? 'Вы' : `Игрок ${index + 1}`}: {player.points}
                        {isActive && <span className="your-turn-badge">Ход</span>}
                      </motion.h3>
                    </div>

                    <div className="cards-row">
                      {player.cards.length > 0 ? (
                        player.cards.map((card, i) => (
                          <motion.img
                            key={i}
                            src={player.pid === playerPid ? card.image : '/assets/cards/cardRedBack.png'}
                            alt={player.pid === playerPid ? card.name : 'Hidden'}
                            className="game-card"
                            initial={{ x: 0, y: -100, rotateY: 180, opacity: 0 }}
                            animate={{ x: i * 18, y: 0, rotateY: 0, opacity: 1 }}
                            transition={{ duration: CARD_ANIM_DURATION_MS / 1000, ease: 'easeOut', delay: (index * 2 + i) * 0.18 }}
                            onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                              e.currentTarget.src = 'https://via.placeholder.com/80x120?text=Card';
                            }}
                          />
                        ))
                      ) : (
                        <p>Нет карт</p>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <p>Нет игроков</p>
            )}
          </div>

          {/* Controls */}
          <div className="game-controls">
            {gameState.status === 'betting' && (
              <>
                {[10, 50, 100].map((amt) => (
                  <button key={amt} onClick={() => placeBet(amt)} disabled={(gameState.players.find(p => p.pid === playerPid)?.chips ?? 0) < amt} className="bet-button">
                    <img src="/assets/chip.svg" alt="chip" className="chip-btn-icon" onError={(e)=>{ (e.currentTarget as HTMLImageElement).src='https://via.placeholder.com/24?text=¢'; }} />
                    {amt}
                  </button>
                ))}
                <button onClick={resetBet} disabled={(gameState.players.find(p => p.pid === playerPid)?.bet ?? 0) === 0} className="game-button">Сбросить</button>
                <button onClick={startGame} disabled={(gameState.players.find(p => p.pid === playerPid)?.bet ?? 0) === 0} className="game-button">Старт</button>
              </>
            )}
            {gameState.status === 'playing' && (
              <>
                <button onClick={hit} className="game-button">Hit</button>
                <button onClick={stand} className="game-button">Stand</button>
              </>
            )}
          </div>

          {/* Info */}
          <div className="game-info">
            <p className="chips-line">
              <img src="/assets/chip.svg" alt="chip" className="chip-icon-inline" onError={(e)=>{ (e.currentTarget as HTMLImageElement).src='https://via.placeholder.com/20?text=¢'; }} />
              <span>Фишки: {me?.chips ?? 0}</span>
            </p>

            <p className="bet-line">
              <span>Ставка: {me?.bet ?? 0}</span>
              <div className="bet-chip-anim">
                <AnimatePresence mode="wait">
                  <motion.img
                    key={chipPulseKey}
                    src="/assets/chip.svg"
                    alt="chip pulse"
                    className="chip-pulse"
                    initial={{ scale: 0.4, opacity: 0 }}
                    animate={{ scale: [0.8, 1.08, 0.95, 1], opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    onError={(e)=>{ (e.currentTarget as HTMLImageElement).src='https://via.placeholder.com/20?text=¢'; }}
                  />
                </AnimatePresence>
              </div>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Game;
