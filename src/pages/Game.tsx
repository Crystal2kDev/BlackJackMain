import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ioClient from 'socket.io-client';
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
    players: [],
    chips: 1000,
    bet: 0,
    status: 'betting',
    dealerPoints: 0,
  });
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GameResult | null>(null);

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
      setGameState(state);
    });

    newSocket.on('gameResult', (res: GameResult) => {
      setResult(res);
      setTimeout(() => setResult(null), 3000);
    });

    newSocket.on('error', ({ message }: { message: string }) => {
      setError(message);
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

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
          <div className="shoe">
            <img src="/assets/shoe.png" alt="Shoe" />
          </div>

          {/* Дилер */}
          <div className="dealer-area">
            <h3>Дилер: {visibleDealerPoints}</h3>
            <div className="cards-row">
              {gameState.dealerCards.map((card, idx) => (
                <motion.img
                  key={idx}
                  src={idx === 0 && gameState.status !== 'results' ? '/assets/cards/cardRedBack.png' : card.image}
                  alt={card.name}
                  className="game-card"
                  initial={{ y: -100, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: idx * 0.2 }}
                />
              ))}
            </div>
          </div>

          {/* Игроки */}
          {gameState.players.map((player, idx) => (
            <div key={idx} className={`player-area player-${idx + 1}`}>
              <h3>
                Игрок {idx + 1}: {player.points}
              </h3>
              <div className="cards-row">
                {player.cards.map((card, i) => (
                  <motion.img
                    key={i}
                    src={card.image}
                    alt={card.name}
                    className="game-card"
                    initial={{ y: 100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: i * 0.2 }}
                  />
                ))}
              </div>
            </div>
          ))}

          {/* Контролы */}
          <div className="game-controls">
            {gameState.status === 'betting' && (
              <>
                {[10, 50, 100].map((amt) => (
                  <button key={amt} onClick={() => placeBet(amt)} disabled={gameState.chips < amt}>
                    {amt}
                  </button>
                ))}
                <button onClick={resetBet} disabled={gameState.bet === 0}>
                  Сбросить
                </button>
                <button onClick={startGame} disabled={gameState.bet === 0}>
                  Старт
                </button>
              </>
            )}
            {gameState.status === 'playing' && (
              <>
                <button onClick={hit}>Hit</button>
                <button onClick={stand}>Stand</button>
              </>
            )}
          </div>

          {/* Инфо */}
          <div className="game-info">
            <p>Фишки: {gameState.chips}</p>
            <p>Ставка: {gameState.bet}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Game;
