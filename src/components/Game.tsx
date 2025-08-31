import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import io, { Socket } from 'socket.io-client';
import '../styles/Game.css';

const SOCKET_URL = 'http://localhost:3000';

interface Card {
  name: string;
  image: string;
  value: number;
}

interface Player {
  id: string;
  cards: Card[];
  points: number;
  bet: number;
  chips: number;
}

interface GameState {
  dealerCards: Card[];
  playerCards: Card[];
  players: Player[];
  chips: number;
  bet: number;
  status: 'betting' | 'dealing' | 'playing' | 'dealerTurn' | 'results';
  dealerPoints: number;
}

interface GameResult {
  result: string;
  message: string;
}

function Game() {
  const [socket, setSocket] = useState<SocketIOClient.Socket | null>(null);
  const [gameState, setGameState] = useState<GameState>({
    dealerCards: [],
    playerCards: [],
    players: [],
    chips: 1000,
    bet: 0,
    status: 'betting',
    dealerPoints: 0,
  });
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GameResult | null>(null);

  useEffect(() => {
    const newSocket = io(SOCKET_URL, {
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
      console.log('Game update received:', JSON.stringify(state, null, 2));
      setGameState(state);
    });

    newSocket.on('gameResult', (result: GameResult) => {
      console.log('Game result:', result);
      setResult(result);
      setTimeout(() => setResult(null), 3000);
    });

    newSocket.on('error', ({ message }: { message: string }) => {
      console.log('Server error:', message);
      setError(message);
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const placeBet = (amount: number) => {
    if (!socket || !socket.connected) {
      setError('Нет соединения с сервером');
      console.error('Socket not connected');
      return;
    }
    if (gameState.status !== 'betting' || gameState.chips < amount) {
      console.log('Cannot place bet:', { status: gameState.status, chips: gameState.chips, amount });
      return;
    }
    console.log('Placing bet:', amount);
    socket.emit('placeBet', amount);
  };

  const resetBet = () => {
    if (!socket || !socket.connected) {
      setError('Нет соединения с сервером');
      console.error('Socket not connected');
      return;
    }
    if (gameState.status !== 'betting') return;
    console.log('Resetting bet');
    socket.emit('resetBet');
  };

  const startGame = () => {
    if (!socket || !socket.connected) {
      setError('Нет соединения с сервером');
      console.error('Socket not connected');
      return;
    }
    if (gameState.bet <= 0) {
      setError('Сделайте ставку перед началом игры');
      console.log('No bet placed');
      return;
    }
    console.log('Starting game');
    socket.emit('startGame');
  };

  const hit = () => {
    if (!socket || !socket.connected || gameState.status !== 'playing') return;
    console.log('Hit');
    socket.emit('hit');
  };

  const stand = () => {
    if (!socket || !socket.connected || gameState.status !== 'playing') return;
    console.log('Stand');
    socket.emit('stand');
  };

  const visibleDealerPoints = gameState.dealerCards.length > 0 && gameState.status !== 'results'
    ? gameState.dealerCards.slice(1).reduce((sum, card) => sum + card.value, 0)
    : gameState.dealerPoints;

  return (
    <div className="game">
      <div className="game-table">
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
        <motion.div
          className="game-shoe"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <svg
            width="100"
            height="100"
            viewBox="0 0 100 100"
            xmlns="http://www.w3.org/2000/svg"
            className="shoe-card"
          >
            <rect x="20" y="20" width="60" height="60" rx="5" fill="#333" stroke="#fff" strokeWidth="2" />
            <rect x="30" y="10" width="40" height="20" fill="#222" stroke="#fff" strokeWidth="2" />
            <rect x="40" y="30" width="20" height="10" fill="#444" />
            <text x="50" y="65" fontSize="10" fill="#fff" textAnchor="middle">
              Shoe
            </text>
          </svg>
        </motion.div>
        <div className="game-dealer">
          <motion.h3
            initial={{ opacity: 0 }}
            animate={{ opacity: visibleDealerPoints > 0 || gameState.status === 'results' ? 1 : 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            Дилер: {visibleDealerPoints}
          </motion.h3>
          <div className="game-cards">
            {gameState.dealerCards.length > 0 ? (
              gameState.dealerCards.map((card, index) => (
                <motion.img
                  key={index}
                  src={index === 0 && gameState.status !== 'results' ? '/assets/cards/cardRedBack.png' : card.image}
                  alt={index === 0 && gameState.status !== 'results' ? 'Hidden Card' : card.name}
                  className="game-card"
                  initial={{ x: 0, y: -100, rotateY: 180, opacity: 0 }}
                  animate={{ x: index * 20, y: 0, rotateY: 0, opacity: 1 }}
                  transition={{ duration: 0.7, ease: 'easeOut', delay: index * 0.3 }}
                  onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                    console.error('Card image error:', e.currentTarget.src);
                    e.currentTarget.src = 'https://via.placeholder.com/80x120?text=Card';
                  }}
                />
              ))
            ) : (
              <p>Нет карт дилера</p>
            )}
          </div>
        </div>
        <div className="game-players">
          {gameState.players.slice(0, 3).length > 0 ? (
            gameState.players.slice(0, 3).map((player, index) => (
              <div key={index} className={`game-player game-player-${index + 1}`}>
                <motion.h3
                  initial={{ opacity: 0 }}
                  animate={{ opacity: player.points > 0 ? 1 : 0 }}
                  transition={{ duration: 0.5, delay: (index * 2 + 1) * 0.3 }}
                >
                  Игрок {index + 1}: {player.points}
                </motion.h3>
                <div className="game-cards">
                  {player.cards.length > 0 ? (
                    player.cards.map((card, i) => (
                      <motion.img
                        key={i}
                        src={card.image}
                        alt={card.name}
                        className="game-card"
                        initial={{ x: 0, y: -100, rotateY: 180, opacity: 0 }}
                        animate={{ x: i * 20, y: 0, rotateY: 0, opacity: 1 }}
                        transition={{ duration: 0.7, ease: 'easeOut', delay: (index * 2 + i) * 0.3 }}
                        onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                          console.error('Card image error:', e.currentTarget.src);
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
        <div className="game-controls">
          {gameState.status === 'betting' && (
            <>
              <button
                className="game-bet-button"
                onClick={() => placeBet(10)}
                disabled={gameState.chips < 10 || !socket || !socket.connected}
              >
                10
              </button>
              <button
                className="game-bet-button"
                onClick={() => placeBet(50)}
                disabled={gameState.chips < 50 || !socket || !socket.connected}
              >
                50
              </button>
              <button
                className="game-bet-button"
                onClick={() => placeBet(100)}
                disabled={gameState.chips < 100 || !socket || !socket.connected}
              >
                100
              </button>
              <button
                className="game-button"
                onClick={resetBet}
                disabled={gameState.bet === 0 || !socket || !socket.connected}
              >
                Сбросить ставку
              </button>
              <button
                className="game-button"
                onClick={startGame}
                disabled={gameState.bet === 0 || !socket || !socket.connected}
              >
                Старт
              </button>
            </>
          )}
          {gameState.status === 'playing' && (
            <>
              <button className="game-button" onClick={hit} disabled={!socket || !socket.connected}>
                Hit
              </button>
              <button className="game-button" onClick={stand} disabled={!socket || !socket.connected}>
                Stand
              </button>
            </>
          )}
        </div>
        <div className="game-info">
          <p>
            Фишки: {gameState.chips}
            {gameState.bet > 0 && (
              <motion.span
                className="game-chip"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.1 }}
              ></motion.span>
            )}
          </p>
          <p>
            Ставка: {gameState.bet}
            {gameState.bet > 0 && (
              <motion.span
                className="game-chip"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.2 }}
              ></motion.span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

export default Game;