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
  currentPlayer: number; // index among active players (bet>0)
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

const deck: Card[] = suits.flatMap((suit) =>
  values.map((value) => ({
    name: `${value.name}_of_${suit}`,
    image: `/assets/cards/${value.name}_of_${suit}${
      suit === 'clubs' && ['jack', 'queen', 'king'].includes(value.name) ? '2' : ''
    }.png`,
    value: value.name === 'ace' ? 11 : ['jack', 'queen', 'king'].includes(value.name) ? 10 : parseInt(value.name),
  }))
);

const calculatePoints = (cards: Card[]): number => {
  let points = 0;
  let aces = 0;
  cards.forEach((card) => {
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

// Helper to broadcast canonical game state to all clients in room
const broadcastGameUpdate = (roomId: string) => {
  const room = rooms[roomId];
  if (!room) return;
  room.stateId++;
  const activePlayers = room.players.filter((p) => p.bet > 0);
  const currentTurnId = activePlayers[room.currentPlayer]?.id ?? null;

  io.to(roomId).emit('gameUpdate', {
    stateId: room.stateId,
    dealerCards: room.dealer.cards,
    players: room.players,
    status: room.state,
    dealerPoints: room.dealer.points,
    currentTurnId,
  });
};

// Reset round state (used when a player leaves mid-game)
const resetRound = (roomId: string) => {
  const room = rooms[roomId];
  if (!room) return;
  room.players.forEach((p) => {
    p.cards = [];
    p.points = 0;
    p.bet = 0;
  });
  room.dealer.cards = [];
  room.dealer.points = 0;
  room.state = 'betting';
  room.currentPlayer = 0;
  broadcastGameUpdate(roomId);
};

io.on('connection', (socket: Socket) => {
  console.log('Player connected:', socket.id);

  socket.on('joinRoom', (roomId: string) => {
    if (!rooms[roomId]) {
      socket.emit('error', { message: 'Комната не существует' });
      return;
    }

    // If player already present (same socket id), just reset their transient fields
    const existing = rooms[roomId].players.find((p) => p.id === socket.id);
    if (!existing) {
      // prevent overflow
      if (rooms[roomId].players.length >= 3) {
        socket.emit('error', { message: 'Комната заполнена (максимум 3 игрока)' });
        return;
      }
      rooms[roomId].players.push({
        id: socket.id,
        cards: [],
        points: 0,
        bet: 0,
        chips: 1000,
      });
    } else {
      existing.cards = [];
      existing.points = 0;
      existing.bet = 0;
    }

    socket.join(roomId);
    console.log(`Player ${socket.id} joined room ${roomId}. Players now: ${rooms[roomId].players.length}`);
    broadcastGameUpdate(roomId);
  });

  socket.on('leaveRoom', (roomId: string) => {
    if (!rooms[roomId]) return;
    rooms[roomId].players = rooms[roomId].players.filter((p) => p.id !== socket.id);
    socket.leave(roomId);
    // if leaving during a running game - reset the round to avoid stuck state
    if (rooms[roomId].state !== 'betting') {
      resetRound(roomId);
    } else {
      broadcastGameUpdate(roomId);
    }
  });

  socket.on('placeBet', (amount: number) => {
    const roomId = 'defaultRoom';
    const player = rooms[roomId].players.find((p) => p.id === socket.id);
    if (!player || rooms[roomId].state !== 'betting' || player.chips < amount) {
      socket.emit('error', { message: 'Недостаточно фишек или неверный статус игры' });
      return;
    }
    player.bet = amount;
    player.chips -= amount;
    console.log('Bet placed:', { playerId: socket.id, amount });
    broadcastGameUpdate(roomId);
  });

  socket.on('resetBet', () => {
    const roomId = 'defaultRoom';
    const player = rooms[roomId].players.find((p) => p.id === socket.id);
    if (!player || rooms[roomId].state !== 'betting') return;
    player.chips += player.bet;
    player.bet = 0;
    console.log('Bet reset:', { playerId: socket.id });
    broadcastGameUpdate(roomId);
  });

  socket.on('startGame', () => {
    const roomId = 'defaultRoom';
    const caller = rooms[roomId].players.find((p) => p.id === socket.id);
    if (!caller) {
      socket.emit('error', { message: 'Вы не участвуете в игре' });
      return;
    }
    if (caller.bet <= 0) {
      socket.emit('error', { message: 'Вы должны поставить, чтобы начать игру' });
      return;
    }

    const activePlayers = rooms[roomId].players.filter((p) => p.bet > 0);
    if (activePlayers.length > 0 && rooms[roomId].state === 'betting') {
      rooms[roomId].state = 'dealing';
      console.log('Starting deal, active players:', activePlayers.map((p) => p.id));
      dealCards(roomId);
    } else {
      socket.emit('error', { message: 'Нельзя начать игру в текущем статусе' });
    }
  });

  socket.on('hit', () => {
    const roomId = 'defaultRoom';
    const activePlayers = rooms[roomId].players.filter((p) => p.bet > 0);
    const player = activePlayers[rooms[roomId].currentPlayer];
    if (!player || player.id !== socket.id || rooms[roomId].state !== 'playing') {
      socket.emit('error', { message: 'Недопустимое действие' });
      return;
    }
    const card = rooms[roomId].deck.splice(Math.floor(Math.random() * rooms[roomId].deck.length), 1)[0];
    player.cards.push(card);
    player.points = calculatePoints(player.cards);
    console.log('Hit:', { playerId: socket.id, card: card.name, points: player.points });

    // If bust => move to next player
    if (player.points > 21) {
      rooms[roomId].currentPlayer += 1;
    }

    // if all players finished => dealer's turn
    const newActivePlayers = rooms[roomId].players.filter((p) => p.bet > 0);
    if (rooms[roomId].currentPlayer >= newActivePlayers.length) {
      rooms[roomId].state = 'dealerTurn';
      dealerTurn(roomId);
    } else {
      broadcastGameUpdate(roomId);
    }
  });

  socket.on('stand', () => {
    const roomId = 'defaultRoom';
    const activePlayers = rooms[roomId].players.filter((p) => p.bet > 0);
    const player = activePlayers[rooms[roomId].currentPlayer];
    if (!player || player.id !== socket.id || rooms[roomId].state !== 'playing') {
      socket.emit('error', { message: 'Недопустимое действие' });
      return;
    }
    console.log('Stand:', { playerId: socket.id });
    rooms[roomId].currentPlayer += 1;
    const newActivePlayers = rooms[roomId].players.filter((p) => p.bet > 0);
    if (rooms[roomId].currentPlayer >= newActivePlayers.length) {
      rooms[roomId].state = 'dealerTurn';
      dealerTurn(roomId);
    } else {
      broadcastGameUpdate(roomId);
    }
  });

  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    const roomId = 'defaultRoom';
    rooms[roomId].players = rooms[roomId].players.filter((p) => p.id !== socket.id);

    // If we were mid-game, safer to reset the round to avoid hanging states
    if (rooms[roomId].state !== 'betting') {
      resetRound(roomId);
    } else {
      broadcastGameUpdate(roomId);
    }
  });

  // dealing / game flow helpers ------------------------------------------------
  const dealCards = (roomId: string) => {
    rooms[roomId].deck = [...deck];
    let delay = 0;
    const activePlayers = rooms[roomId].players.filter((p) => p.bet > 0);

    // deal 1st & 2nd card to each active player (sequential with delays)
    activePlayers.forEach((player, index) => {
      setTimeout(() => {
        player.cards = [rooms[roomId].deck.splice(Math.floor(Math.random() * rooms[roomId].deck.length), 1)[0]];
        player.points = calculatePoints(player.cards);
        broadcastGameUpdate(roomId);
      }, delay);
      delay += 300;

      setTimeout(() => {
        player.cards.push(rooms[roomId].deck.splice(Math.floor(Math.random() * rooms[roomId].deck.length), 1)[0]);
        player.points = calculatePoints(player.cards);
        broadcastGameUpdate(roomId);
      }, delay);
      delay += 300;
    });

    // dealer first card
    setTimeout(() => {
      rooms[roomId].dealer.cards = [rooms[roomId].deck.splice(Math.floor(Math.random() * rooms[roomId].deck.length), 1)[0]];
      rooms[roomId].dealer.points = calculatePoints(rooms[roomId].dealer.cards);
      broadcastGameUpdate(roomId);
    }, delay);
    delay += 300;

    // dealer second card -> after this set state to 'playing' and allow player actions
    setTimeout(() => {
      rooms[roomId].dealer.cards.push(
        rooms[roomId].deck.splice(Math.floor(Math.random() * rooms[roomId].deck.length), 1)[0]
      );
      rooms[roomId].dealer.points = calculatePoints(rooms[roomId].dealer.cards);
      rooms[roomId].state = 'playing';
      rooms[roomId].currentPlayer = 0;
      broadcastGameUpdate(roomId);
    }, delay);
  };

  const dealerTurn = (roomId: string) => {
    // Dealer draws until 17+, updating state for clients
    while (rooms[roomId].dealer.points < 17) {
      rooms[roomId].dealer.cards.push(rooms[roomId].deck.splice(Math.floor(Math.random() * rooms[roomId].deck.length), 1)[0]);
      rooms[roomId].dealer.points = calculatePoints(rooms[roomId].dealer.cards);
      // optionally broadcast each draw so clients can animate each new dealer card
      broadcastGameUpdate(roomId);
    }

    // reveal dealer, then wait a bit to show points/animation, then compute results
    rooms[roomId].state = 'dealerTurn';
    broadcastGameUpdate(roomId);

    const RESULT_DELAY_MS = 1300; // short pause so clients can show dealer's final points
    setTimeout(() => {
      rooms[roomId].state = 'results';
      const activePlayers = rooms[roomId].players.filter((p) => p.bet > 0);

      activePlayers.forEach((player) => {
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
      rooms[roomId].players.forEach((player) => {
        player.cards = [];
        player.points = 0;
        player.bet = 0;
      });
      rooms[roomId].dealer.cards = [];
      rooms[roomId].dealer.points = 0;
      rooms[roomId].state = 'betting';
      rooms[roomId].currentPlayer = 0;

      broadcastGameUpdate(roomId);
    }, RESULT_DELAY_MS);
  };
});

server.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
