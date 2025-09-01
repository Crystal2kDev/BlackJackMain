// backend/server.ts
import express from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: 'http://localhost:5173', methods: ['GET', 'POST'] },
});

app.use(cors());

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

interface Dealer {
  cards: Card[];
  points: number;
}

interface Room {
  players: Player[];
  dealer: Dealer;
  state: 'betting' | 'dealing' | 'playing' | 'dealerTurn' | 'results';
  currentPlayer: number;
  deck: Card[];
  stateId: number;
}

const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
const values = [
  { key: '2', name: '2' },
  { key: '3', name: '3' },
  { key: '4', name: '4' },
  { key: '5', name: '5' },
  { key: '6', name: '6' },
  { key: '7', name: '7' },
  { key: '8', name: '8' },
  { key: '9', name: '9' },
  { key: '10', name: '10' },
  { key: 'J', name: 'jack' },
  { key: 'Q', name: 'queen' },
  { key: 'K', name: 'king' },
  { key: 'A', name: 'ace' },
];

const deck: Card[] = suits.flatMap(suit =>
  values.map(value => ({
    name: `${value.name}_of_${suit}`,
    image: `/assets/cards/${value.name}_of_${suit}${suit === 'clubs' && ['jack', 'queen', 'king'].includes(value.name) ? '2' : ''}.png`,
    value: value.name === 'ace' ? 11 : ['jack', 'queen', 'king'].includes(value.name) ? 10 : parseInt(value.name),
  }))
);

const calculatePoints = (cards: Card[]): number => {
  let points = 0;
  let aces = 0;
  cards.forEach(card => {
    points += card.value;
    if (card.name.startsWith('ace')) aces += 1;
  });
  while (points > 21 && aces > 0) {
    points -= 10;
    aces -= 1;
  }
  return points;
};

const rooms: { [key: string]: Room } = {
  defaultRoom: {
    players: [],
    dealer: { cards: [], points: 0 },
    state: 'betting',
    currentPlayer: 0,
    deck: [],
    stateId: 0,
  },
};

io.on('connection', (socket: Socket) => {
  console.log('Player connected:', socket.id);

  socket.on('joinRoom', (roomId: string) => {
    if (!rooms[roomId]) {
      socket.emit('error', { message: 'Комната не существует' });
      return;
    }
    const existingIndex = rooms[roomId].players.findIndex(p => p.id === socket.id);
    if (existingIndex === -1 && rooms[roomId].players.length >= 3) {
      socket.emit('error', { message: 'Комната заполнена (максимум 3 игрока)' });
      return;
    }

    if (!rooms[roomId].players.find(p => p.id === socket.id)) {
      rooms[roomId].players.push({
        id: socket.id,
        cards: [],
        points: 0,
        bet: 0,
        chips: 1000,
      });
    } else {
      const p = rooms[roomId].players.find(p => p.id === socket.id)!;
      p.cards = [];
      p.points = 0;
      p.bet = 0;
    }

    socket.join(roomId);
    console.log(`Player ${socket.id} joined room ${roomId}. Players now: ${rooms[roomId].players.length}`);

    io.to(roomId).emit('gameUpdate', {
      stateId: rooms[roomId].stateId,
      dealerCards: rooms[roomId].dealer.cards,
      players: rooms[roomId].players,
      chips: rooms[roomId].players.find(p => p.id === socket.id)!.chips,
      bet: rooms[roomId].players.find(p => p.id === socket.id)!.bet,
      status: rooms[roomId].state,
      dealerPoints: rooms[roomId].dealer.points,
    });
  });

  socket.on('placeBet', (amount: number) => {
    const roomId = 'defaultRoom';
    const player = rooms[roomId].players.find(p => p.id === socket.id);
    if (!player || rooms[roomId].state !== 'betting' || player.chips < amount) {
      socket.emit('error', { message: 'Недостаточно фишек или неверный статус игры' });
      return;
    }
    player.bet = amount;
    player.chips -= amount;
    console.log('Bet placed:', { playerId: socket.id, amount });
    io.to(roomId).emit('gameUpdate', {
      stateId: ++rooms[roomId].stateId,
      dealerCards: rooms[roomId].dealer.cards,
      players: rooms[roomId].players,
      chips: player.chips,
      bet: player.bet,
      status: rooms[roomId].state,
      dealerPoints: rooms[roomId].dealer.points,
    });
  });

  socket.on('resetBet', () => {
    const roomId = 'defaultRoom';
    const player = rooms[roomId].players.find(p => p.id === socket.id);
    if (!player || rooms[roomId].state !== 'betting') return;
    player.chips += player.bet;
    player.bet = 0;
    console.log('Bet reset:', { playerId: socket.id });
    io.to(roomId).emit('gameUpdate', {
      stateId: ++rooms[roomId].stateId,
      dealerCards: rooms[roomId].dealer.cards,
      players: rooms[roomId].players,
      chips: player.chips,
      bet: player.bet,
      status: rooms[roomId].state,
      dealerPoints: rooms[roomId].dealer.points,
    });
  });

  socket.on('startGame', () => {
    const roomId = 'defaultRoom';
    const caller = rooms[roomId].players.find(p => p.id === socket.id);
    if (!caller) {
      socket.emit('error', { message: 'Вы не участвуете в игре' });
      console.log('StartGame denied: caller not in players', socket.id);
      return;
    }
    if (caller.bet <= 0) {
      socket.emit('error', { message: 'Вы должны поставить, чтобы начать игру' });
      console.log('StartGame denied: caller has no bet', socket.id);
      return;
    }

    const activePlayers = rooms[roomId].players.filter(p => p.bet > 0);
    if (activePlayers.length > 0 && rooms[roomId].state === 'betting') {
      console.log('Starting game with active players (triggered by):', { by: socket.id, activePlayers: activePlayers.map(p => ({ id: p.id, bet: p.bet })) });
      rooms[roomId].state = 'dealing';
      dealCards(roomId);
    } else {
      socket.emit('error', { message: 'Нельзя начать игру в текущем статусе' });
      console.log('Start game failed: no players with bets or wrong state', { state: rooms[roomId].state, activeCount: activePlayers.length });
    }
  });

  socket.on('hit', () => {
    const roomId = 'defaultRoom';
    const activePlayers = rooms[roomId].players.filter(p => p.bet > 0);
    const player = activePlayers[rooms[roomId].currentPlayer];
    if (!player || player.id !== socket.id || rooms[roomId].state !== 'playing') {
      socket.emit('error', { message: 'Недопустимое действие' });
      return;
    }
    const card = rooms[roomId].deck.splice(Math.floor(Math.random() * rooms[roomId].deck.length), 1)[0];
    player.cards.push(card);
    player.points = calculatePoints(player.cards);
    console.log('Hit:', { playerId: socket.id, card: card.name, image: card.image, points: player.points });
    if (player.points > 21) {
      rooms[roomId].currentPlayer += 1;
    }
    if (rooms[roomId].currentPlayer >= activePlayers.length) {
      rooms[roomId].state = 'dealerTurn';
      dealerTurn(roomId);
    }
    io.to(roomId).emit('gameUpdate', {
      stateId: ++rooms[roomId].stateId,
      dealerCards: rooms[roomId].dealer.cards,
      players: rooms[roomId].players,
      chips: player.chips,
      bet: player.bet,
      status: rooms[roomId].state,
      dealerPoints: rooms[roomId].dealer.points,
    });
  });

  socket.on('stand', () => {
    const roomId = 'defaultRoom';
    const activePlayers = rooms[roomId].players.filter(p => p.bet > 0);
    const player = activePlayers[rooms[roomId].currentPlayer];
    if (!player || player.id !== socket.id || rooms[roomId].state !== 'playing') {
      socket.emit('error', { message: 'Недопустимое действие' });
      return;
    }
    console.log('Stand:', { playerId: socket.id });
    rooms[roomId].currentPlayer += 1;
    if (rooms[roomId].currentPlayer >= activePlayers.length) {
      rooms[roomId].state = 'dealerTurn';
      dealerTurn(roomId);
    }
    io.to(roomId).emit('gameUpdate', {
      stateId: ++rooms[roomId].stateId,
      dealerCards: rooms[roomId].dealer.cards,
      players: rooms[roomId].players,
      chips: player.chips,
      bet: player.bet,
      status: rooms[roomId].state,
      dealerPoints: rooms[roomId].dealer.points,
    });
  });

  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    const roomId = 'defaultRoom';
    const wasInRoom = rooms[roomId].players.some(p => p.id === socket.id);

    // remove the player
    rooms[roomId].players = rooms[roomId].players.filter(p => p.id !== socket.id);

    // If the game was in progress (not betting), reset the round so a reconnecting player won't see a stuck game
    if (wasInRoom && rooms[roomId].state !== 'betting') {
      console.log('Player left during a round — resetting current round to betting state:', socket.id);

      // Refund active bets to remaining players and clear hands
      rooms[roomId].players.forEach(p => {
        if (p.bet > 0) {
          p.chips += p.bet; // refund
          p.bet = 0;
        }
        p.cards = [];
        p.points = 0;
      });

      // Clear dealer
      rooms[roomId].dealer.cards = [];
      rooms[roomId].dealer.points = 0;

      // Reset room state
      rooms[roomId].state = 'betting';
      rooms[roomId].currentPlayer = 0;
      rooms[roomId].deck = [];
      rooms[roomId].stateId++;

      // Notify everyone in the room about the reset state
      io.to(roomId).emit('gameUpdate', {
        stateId: rooms[roomId].stateId,
        dealerCards: rooms[roomId].dealer.cards,
        players: rooms[roomId].players,
        chips: rooms[roomId].players.find(p => p.id !== socket.id)?.chips || 1000,
        bet: 0,
        status: rooms[roomId].state,
        dealerPoints: rooms[roomId].dealer.points,
      });

      return;
    }

    // If game was not in-progress, just emit updated player list/status
    io.to(roomId).emit('gameUpdate', {
      stateId: ++rooms[roomId].stateId,
      dealerCards: rooms[roomId].dealer.cards,
      players: rooms[roomId].players,
      chips: 1000,
      bet: 0,
      status: rooms[roomId].state,
      dealerPoints: rooms[roomId].dealer.points,
    });
  });

  const dealCards = (roomId: string) => {
    rooms[roomId].deck = [...deck];
    let delay = 0;
    const activePlayers = rooms[roomId].players.filter(p => p.bet > 0);
    console.log('Starting deal for room:', roomId, 'Active players:', activePlayers.map(p => ({ id: p.id, bet: p.bet })));
    activePlayers.forEach((player, index) => {
      setTimeout(() => {
        player.cards = [rooms[roomId].deck.splice(Math.floor(Math.random() * rooms[roomId].deck.length), 1)[0]];
        player.points = calculatePoints(player.cards);
        console.log('Dealing to player (1):', { playerId: player.id, card: player.cards[0].name, points: player.points });
        io.to(roomId).emit('gameUpdate', {
          stateId: ++rooms[roomId].stateId,
          dealerCards: rooms[roomId].dealer.cards,
          players: rooms[roomId].players,
          chips: player.chips,
          bet: player.bet,
          status: rooms[roomId].state,
          dealerPoints: rooms[roomId].dealer.points,
        });
      }, delay);
      delay += 300;
      setTimeout(() => {
        player.cards.push(rooms[roomId].deck.splice(Math.floor(Math.random() * rooms[roomId].deck.length), 1)[0]);
        player.points = calculatePoints(player.cards);
        console.log('Dealing to player (2):', { playerId: player.id, card: player.cards[1].name, points: player.points });
        io.to(roomId).emit('gameUpdate', {
          stateId: ++rooms[roomId].stateId,
          dealerCards: rooms[roomId].dealer.cards,
          players: rooms[roomId].players,
          chips: player.chips,
          bet: player.bet,
          status: rooms[roomId].state,
          dealerPoints: rooms[roomId].dealer.points,
        });
      }, delay);
      delay += 300;
    });

    // dealer first card
    setTimeout(() => {
      rooms[roomId].dealer.cards = [rooms[roomId].deck.splice(Math.floor(Math.random() * rooms[roomId].deck.length), 1)[0]];
      rooms[roomId].dealer.points = calculatePoints(rooms[roomId].dealer.cards);
      console.log('Dealing to dealer (1):', { card: rooms[roomId].dealer.cards[0].name, points: rooms[roomId].dealer.points });
      io.to(roomId).emit('gameUpdate', {
        stateId: ++rooms[roomId].stateId,
        dealerCards: rooms[roomId].dealer.cards,
        players: rooms[roomId].players,
        chips: rooms[roomId].players.find(p => p.id === socket.id)?.chips || 1000,
        bet: rooms[roomId].players.find(p => p.id === socket.id)?.bet || 0,
        status: rooms[roomId].state,
        dealerPoints: rooms[roomId].dealer.points,
      });
    }, delay);
    delay += 300;

    // dealer second card -> AFTER THIS: set state to 'playing' so players can act
    setTimeout(() => {
      rooms[roomId].dealer.cards.push(rooms[roomId].deck.splice(Math.floor(Math.random() * rooms[roomId].deck.length), 1)[0]);
      rooms[roomId].dealer.points = calculatePoints(rooms[roomId].dealer.cards);
      // IMPORTANT: set to 'playing' so clients show Hit/Stand
      rooms[roomId].state = 'playing';
      rooms[roomId].currentPlayer = 0;
      console.log('Dealing to dealer (2):', { card: rooms[roomId].dealer.cards[1].name, points: rooms[roomId].dealer.points, state: rooms[roomId].state });

      io.to(roomId).emit('gameUpdate', {
        stateId: ++rooms[roomId].stateId,
        dealerCards: rooms[roomId].dealer.cards,
        players: rooms[roomId].players,
        chips: rooms[roomId].players.find(p => p.id === socket.id)?.chips || 1000,
        bet: rooms[roomId].players.find(p => p.id === socket.id)?.bet || 0,
        status: rooms[roomId].state,
        dealerPoints: rooms[roomId].dealer.points,
      });
    }, delay);
  };

  const dealerTurn = (roomId: string) => {
    // Dealer draws until 17+, then reveal, wait, then compute results
    while (rooms[roomId].dealer.points < 17) {
      rooms[roomId].dealer.cards.push(rooms[roomId].deck.splice(Math.floor(Math.random() * rooms[roomId].deck.length), 1)[0]);
      rooms[roomId].dealer.points = calculatePoints(rooms[roomId].dealer.cards);
      console.log('Dealer drawing:', { card: rooms[roomId].dealer.cards[rooms[roomId].dealer.cards.length - 1].name, points: rooms[roomId].dealer.points });
    }

    // Tell clients dealer completed drawing and reveal points
    rooms[roomId].state = 'dealerTurn';
    io.to(roomId).emit('gameUpdate', {
      stateId: ++rooms[roomId].stateId,
      dealerCards: rooms[roomId].dealer.cards,
      players: rooms[roomId].players,
      chips: rooms[roomId].players.find(p => p.id === socket.id)?.chips || 1000,
      bet: rooms[roomId].players.find(p => p.id === socket.id)?.bet || 0,
      status: rooms[roomId].state,
      dealerPoints: rooms[roomId].dealer.points,
    });

    // Wait so clients can show dealer's points/animations, then compute results
    const RESULT_DELAY_MS = 1800;
    setTimeout(() => {
      rooms[roomId].state = 'results';
      const activePlayers = rooms[roomId].players.filter(p => p.bet > 0);

      activePlayers.forEach(player => {
        let result: string, message: string;
        if (player.points > 21) {
          result = 'lose';
          message = `Игрок ${rooms[roomId].players.indexOf(player) + 1} проиграл: перебор (${player.points})`;
        } else if (rooms[roomId].dealer.points > 21) {
          result = 'win';
          message = `Игрок ${rooms[roomId].players.indexOf(player) + 1} выиграл: дилер перебрал (${rooms[roomId].dealer.points})`;
          player.chips += player.bet * 2;
        } else if (player.points > rooms[roomId].dealer.points) {
          result = 'win';
          message = `Игрок ${rooms[roomId].players.indexOf(player) + 1} выиграл: ${player.points} против ${rooms[roomId].dealer.points}`;
          player.chips += player.bet * 2;
        } else if (player.points === rooms[roomId].dealer.points) {
          result = 'draw';
          message = `Игрок ${rooms[roomId].players.indexOf(player) + 1}: ничья (${player.points})`;
          player.chips += player.bet;
        } else {
          result = 'lose';
          message = `Игрок ${rooms[roomId].players.indexOf(player) + 1} проиграл: ${player.points} против ${rooms[roomId].dealer.points}`;
        }
        io.to(player.id).emit('gameResult', { result, message });
      });

      // Cleanup for next round
      rooms[roomId].players.forEach(player => {
        player.cards = [];
        player.points = 0;
        if (player.bet > 0) {
          player.bet = 0;
        }
      });
      rooms[roomId].dealer.cards = [];
      rooms[roomId].dealer.points = 0;
      rooms[roomId].state = 'betting';

      console.log('Resetting game state after results');

      io.to(roomId).emit('gameUpdate', {
        stateId: ++rooms[roomId].stateId,
        dealerCards: rooms[roomId].dealer.cards,
        players: rooms[roomId].players,
        chips: rooms[roomId].players.find(p => p.id === socket.id)?.chips || 1000,
        bet: rooms[roomId].players.find(p => p.id === socket.id)?.bet || 0,
        status: rooms[roomId].state,
        dealerPoints: rooms[roomId].dealer.points,
      });
    }, RESULT_DELAY_MS);
  };
});

server.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
