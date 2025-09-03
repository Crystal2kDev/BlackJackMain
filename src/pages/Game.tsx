// src/pages/Game.tsx
import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ioClient from 'socket.io-client';
import { useSearchParams } from 'react-router-dom';
import '../styles/Game.css';

const SOCKET_URL = 'http://localhost:3000';

// Animation timing constants (should match server config)
const CARD_ANIM_DURATION_MS = 420;
const PER_CARD_DELAY_MS = 250;

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

  // handle socket connection + events
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
      // server may return assigned pid — persist it
      if (payload && payload.playerId && payload.playerId !== playerPid) {
        try { localStorage.setItem(storedPidKey, payload.playerId); } catch (e) {}
        setPlayerPid(payload.playerId);
      }
    });

    s.on('connect_error', (err: Error) => {
      console.error('Socket connect error', err);
      setError('Не удалось подключиться к серверу.');
    });

    s.on('gameUpdate', (state: GameUpdatePayload) => {
      try {
        const newDealerLen = state.dealerCards ? state.dealerCards.length : 0;
        if (prevDealerCardsLen.current === 0 && newDealerLen > 0) {
          const pick = Math.random() < 0.5 ? '/assets/dealer-1.svg' : '/assets/dealer-2.svg';
          setDealerSvg(pick);
        }
        prevDealerCardsLen.current = newDealerLen;
      } catch (e) {
        console.error('Error handling dealer svg selection', e);
      }
      setGameState(state);
    });

    s.on('gameResult', (res: GameResult) => {
      setResult(res);
      // auto-hide after a bit
      setTimeout(() => setResult(null), 3000);
    });

    s.on('error', ({ message }: { message: string }) => {
      setError(message);
    });

    // beforeunload: warn user if leaving during active game and try to notify server
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      try {
        // if game active (not betting) -> show confirmation
        if (gameState.status && gameState.status !== 'betting') {
          // notify server that we are leaving (best-effort)
          try { s.emit('leaveRoom', 'defaultRoom'); } catch (err) {}
          e.preventDefault();
          // Some browsers ignore custom text, but setting returnValue is required to show dialog
          e.returnValue = 'Вы действительно хотите покинуть игру?';
          return e.returnValue;
        }
      } catch (err) {
        // swallow
      }
      return undefined;
    };
    window.addEventListener('beforeunload', onBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      s.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerPid]); // only recreate socket when playerPid changes (rare)

  // pulse on bet change (keeps prior behavior)
  useEffect(() => {
    if (prevBetRef.current !== (gameState.players.find((p) => p.pid === playerPid)?.bet ?? 0)) {
      setChipPulseKey((k) => k + 1);
      prevBetRef.current = gameState.players.find((p) => p.pid === playerPid)?.bet ?? 0;
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
    // ensure local player has bet > 0
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

  // visible dealer points logic: while playing hide hole card
  const visibleDealerPoints =
    gameState.dealerCards.length > 0 && gameState.status === 'playing'
      ? gameState.dealerCards.slice(1).reduce((s, c) => s + c.value, 0)
      : gameState.dealerPoints;

  const cardDelaySeconds = (index: number) => (index * PER_CARD_DELAY_MS) / 1000;

  // helper to get local player object
  const me = gameState.players.find((p) => p.pid === playerPid);

  // Determine current turn pid for UI highlighting (server sends currentTurnPid)
  const currentTurnPid = (gameState as any).currentTurnPid as string | undefined;

  return (
    <div className="game">
      <div className="game-table-wrapper">
        <div className="game-mode-badge">Режим: {mode === 'bot' ? 'С ботом' : mode === 'friend' ? 'С друзьями (демо)' : 'Лобби (демо)'}</div>

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

          {/* Dealer area */}
          <div className="dealer-area">
            <motion.h3 initial={{ opacity: 0 }} animate={{ opacity: visibleDealerPoints > 0 || gameState.status === 'results' ? 1 : 0 }} transition={{ duration: 0.45, delay: 0.3 }}>
              Дилер: {visibleDealerPoints}
            </motion.h3>

            <div className="cards-row" aria-live="polite">
              {gameState.dealerCards.length > 0 ? (
                gameState.dealerCards.map((card, index) => {
                  const reveal = gameState.status === 'dealerTurn' || gameState.status === 'results';

                  // hole card handling: show back during dealing/playing, flip to front on reveal
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
                              e.currentTarget.src = 'https://via.placeholder.com/96x144?text=Card';
                            }}
                          />
                        </div>
                      </motion.div>
                    );
                  }

                  // other dealer cards (open)
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
                        e.currentTarget.src = 'https://via.placeholder.com/96x144?text=Card';
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
            {gameState.players.length > 0 ? (
              gameState.players.slice(0, 3).map((player, index) => {
                const isActive = currentTurnPid && currentTurnPid === player.pid;
                return (
                  <div
                    key={player.pid}
                    className={`game-player player-area player-${index + 1} ${isActive ? 'player-active' : ''}`}
                    aria-current={isActive ? 'true' : 'false'}
                  >
                    <div className="player-top">
                      <img src="/assets/player-1.svg" alt={`Player ${index + 1}`} className="player-avatar" />
                      <motion.h3
                        initial={{ opacity: 0 }}
                        animate={{ opacity: player.points > 0 ? 1 : 0 }}
                        transition={{ duration: 0.45, delay: (index * 2 + 1) * 0.18 }}
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
                            src={card.image}
                            alt={card.name}
                            className="game-card"
                            initial={{ x: 0, y: -100, rotateY: 180, opacity: 0 }}
                            animate={{ x: i * 18, y: 0, rotateY: 0, opacity: 1 }}
                            transition={{ duration: CARD_ANIM_DURATION_MS / 1000, ease: 'easeOut', delay: (index * 2 + i) * 0.18 }}
                            onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                              e.currentTarget.src = 'https://via.placeholder.com/96x144?text=Card';
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
                  <button key={amt} onClick={() => placeBet(amt)} disabled={(me?.chips ?? 0) < amt} className="bet-button">
                    <img src="/assets/chip.svg" alt="chip" className="chip-btn-icon" onError={(e)=>{ (e.currentTarget as HTMLImageElement).src='https://via.placeholder.com/24?text=¢'; }} />
                    {amt}
                  </button>
                ))}
                <button onClick={resetBet} disabled={(me?.bet ?? 0) === 0} className="game-button">Сбросить</button>
                <button onClick={startGame} disabled={(me?.bet ?? 0) === 0} className="game-button">Старт</button>
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
