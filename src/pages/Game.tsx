// src/pages/Game.tsx
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ioClient from 'socket.io-client';
import { useSearchParams } from 'react-router-dom';
import '../styles/Game.css';

const SOCKET_URL = 'http://localhost:3000';

interface Card { name: string; image: string; value: number; }
interface Player { id: string; cards: Card[]; points: number; bet: number; chips: number; }
interface GameState {
  dealerCards: Card[]; players: Player[]; chips: number; bet: number;
  status: 'betting' | 'dealing' | 'playing' | 'dealerTurn' | 'results';
  dealerPoints: number; stateId?: number;
}
interface GameResult { result: string; message: string; }

function Game() {
  const [searchParams] = useSearchParams();
  const mode = (searchParams.get('mode') || 'bot') as 'bot' | 'friend' | 'lobby';

  const [socket, setSocket] = useState<SocketIOClient.Socket | null>(null);
  const [gameState, setGameState] = useState<GameState>({
    dealerCards: [], players: [], chips: 1000, bet: 0, status: 'betting', dealerPoints: 0,
  });
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GameResult | null>(null);

  // dealer svg selection (random between two variants)
  const [dealerSvg, setDealerSvg] = useState<string>('/assets/dealer-1.svg');
  const prevDealerCardsLen = useRef<number>(0);

  // for chip animation when bet changes
  const prevBetRef = useRef<number>(0);
  const [chipPulseKey, setChipPulseKey] = useState<number>(0);

  useEffect(() => {
    const newSocket: SocketIOClient.Socket = ioClient(SOCKET_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Connected to server:', newSocket.id);
      setError(null);
      newSocket.emit('joinRoom', 'defaultRoom');
    });

    newSocket.on('connect_error', (err: Error) => {
      console.error('Socket connection error:', err.message);
      setError('Не удалось подключиться к серверу. Проверьте, запущен ли сервер.');
    });

    newSocket.on('gameUpdate', (state: GameState) => {
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

    newSocket.on('gameResult', (res: GameResult) => {
      setResult(res);
      setTimeout(() => setResult(null), 3000);
    });

    newSocket.on('error', ({ message }: { message: string }) => {
      setError(message);
    });

    return () => { newSocket.disconnect(); };
  }, []);

  useEffect(() => {
    if (prevBetRef.current !== gameState.bet) {
      setChipPulseKey((k) => k + 1);
      prevBetRef.current = gameState.bet;
    }
  }, [gameState.bet]);

  const placeBet = (amount: number) => {
    if (!socket || !socket.connected || gameState.status !== 'betting' || gameState.chips < amount) return;
    socket.emit('placeBet', amount);
  };

  const resetBet = () => {
    if (!socket || !socket.connected || gameState.status !== 'betting') return;
    socket.emit('resetBet');
  };

  const startGame = () => {
    if (!socket || !socket.connected || gameState.bet <= 0) return;
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

  const visibleDealerPoints =
    gameState.dealerCards.length > 0 && gameState.status !== 'results'
      ? gameState.dealerCards.slice(1).reduce((sum, card) => sum + card.value, 0)
      : gameState.dealerPoints;

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
              transition={{ duration: 0.5, ease: 'easeOut' }}
            >
              <h3>{result.result}</h3>
              <p>{result.message}</p>
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
              transition={{ duration: 0.4 }}
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
              transition={{ duration: 0.5, delay: 0.5 }}
            >
              Дилер: {visibleDealerPoints}
            </motion.h3>

            <div className="cards-row">
              {gameState.dealerCards.length > 0 ? (
                gameState.dealerCards.map((card, index) => (
                  <motion.img
                    key={index}
                    src={index === 0 && gameState.status !== 'results' ? '/assets/cards/cardRedBack.png' : card.image}
                    alt={index === 0 && gameState.status !== 'results' ? 'Hidden Card' : card.name}
                    className="game-card"
                    initial={{ x: 0, y: -100, rotateY: 180, opacity: 0 }}
                    animate={{ x: index * 20, y: 0, rotateY: 0, opacity: 1 }}
                    transition={{ duration: 0.7, ease: 'easeOut', delay: index * 0.25 }}
                    onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                      e.currentTarget.src = 'https://via.placeholder.com/80x120?text=Card';
                    }}
                  />
                ))
              ) : (
                <p>Нет карт дилера</p>
              )}
            </div>
          </div>

          {/* Players */}
          <div className="game-players">
            {gameState.players.slice(0, 3).length > 0 ? (
              gameState.players.slice(0, 3).map((player, index) => (
                <div key={index} className={`game-player player-area player-${index + 1}`}>
                  <div className="player-top">
                    <img src="/assets/player-1.svg" alt={`Player ${index + 1}`} className="player-avatar" />
                    <motion.h3
                      initial={{ opacity: 0 }}
                      animate={{ opacity: player.points > 0 ? 1 : 0 }}
                      transition={{ duration: 0.5, delay: (index * 2 + 1) * 0.2 }}
                    >
                      Игрок {index + 1}: {player.points}
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
                          transition={{ duration: 0.7, ease: 'easeOut', delay: (index * 2 + i) * 0.2 }}
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
              ))
            ) : (
              <p>Нет игроков</p>
            )}
          </div>

          {/* Controls */}
          <div className="game-controls">
            {gameState.status === 'betting' && (
              <>
                {[10, 50, 100].map((amt) => (
                  <button key={amt} onClick={() => placeBet(amt)} disabled={gameState.chips < amt} className="bet-button">
                    <img src="/assets/chip.svg" alt="chip" className="chip-btn-icon" onError={(e)=>{ (e.currentTarget as HTMLImageElement).src='https://via.placeholder.com/24?text=¢'; }} />
                    {amt}
                  </button>
                ))}
                <button onClick={resetBet} disabled={gameState.bet === 0} className="game-button">
                  Сбросить
                </button>
                <button onClick={startGame} disabled={gameState.bet === 0} className="game-button">
                  Старт
                </button>
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
              <span>Фишки: {gameState.chips}</span>
            </p>

            <p className="bet-line">
              <span>Ставка: {gameState.bet}</span>
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
}

export default Game;
