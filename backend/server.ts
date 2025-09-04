// backend/server.ts
import express from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import crypto from 'crypto';

// --- Poker room manager (нижний регистр пути) ---
import { RoomManager } from './poker/roomManager.ts';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: 'http://localhost:5173', methods: ['GET', 'POST'] },
});

app.use(cors());

// ========================= BLACKJACK CONFIG =========================
const CARD_ANIM_DURATION_MS = 420;
const PER_CARD_DELAY_MS = 250;
const PLAYER_BUST_NOTIFY_DELAY_MS = 1200;
const RESULTS_EXTRA_DELAY_MS = 1120; // 120 + 1000 earlier

type Card = { name: string; image: string; value: number };
type Player = {
  pid: string;      // persistent id (keeps across refresh)
  socketId: string; // current socket id
  cards: Card[];
  points: number;
  bet: number;
  chips: number;
};
type Dealer = { cards: Card[]; points: number };
type Room = {
  players: Player[];
  dealer: Dealer;
  state: 'betting' | 'dealing' | 'playing' | 'dealerTurn' | 'results';
  currentPlayer: number;
  deck: Card[];
  stateId: number;
};

const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
const values = [
  { key: '2', name: '2' }, { key: '3', name: '3' }, { key: '4', name: '4' },
  { key: '5', name: '5' }, { key: '6', name: '6' }, { key: '7', name: '7' },
  { key: '8', name: '8' }, { key: '9', name: '9' }, { key: '10', name: '10' },
  { key: 'J', name: 'jack' }, { key: 'Q', name: 'queen' }, { key: 'K', name: 'king' },
  { key: 'A', name: 'ace' },
];

const deckTemplate: Card[] = suits.flatMap((suit) =>
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

const rooms: Record<string, Room> = {
  defaultRoom: {
    players: [],
    dealer: { cards: [], points: 0 },
    state: 'betting',
    currentPlayer: 0,
    deck: [],
    stateId: 0,
  },
};

// helper: create random pid
const genPid = () => crypto.randomBytes(8).toString('hex');

// Send sanitized game state to clients (don't expose socketId)
const broadcastGameUpdate = (roomId: string) => {
  const room = rooms[roomId];
  if (!room) return;
  room.stateId++;
  const activePlayers = room.players.filter((p) => p.bet > 0);
  const currentTurnPid = activePlayers[room.currentPlayer]?.pid ?? null;

  const publicPlayers = room.players.map((p) => ({
    pid: p.pid,
    cards: p.cards,
    points: p.points,
    bet: p.bet,
    chips: p.chips,
  }));

  io.to(roomId).emit('gameUpdate', {
    stateId: room.stateId,
    dealerCards: room.dealer.cards,
    players: publicPlayers,
    status: room.state,
    dealerPoints: room.dealer.points,
    currentTurnPid,
  });
};

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

// ========================= SOCKET IO HANDLERS =========================
io.on('connection', (socket: Socket) => {
  console.log('Socket connected:', socket.id);

  // ---------- Blackjack: joinRoom ----------
  socket.on('joinRoom', (payload: any) => {
    try {
      let roomId = 'defaultRoom';
      let incomingPid: string | undefined;

      if (typeof payload === 'string') roomId = payload;
      else if (payload && typeof payload === 'object') {
        roomId = payload.roomId || 'defaultRoom';
        incomingPid = payload.playerId;
      }

      if (!rooms[roomId]) {
        socket.emit('error', { message: 'Комната не существует' });
        return;
      }

      // reconnect by pid
      if (incomingPid) {
        const existing = rooms[roomId].players.find((p) => p.pid === incomingPid);
        if (existing) {
          existing.socketId = socket.id;
          socket.join(roomId);
          console.log(`BJ: rejoin pid=${incomingPid} socket=${socket.id}`);
          broadcastGameUpdate(roomId);
          return;
        }
      }

      // create new player (max 3)
      if (rooms[roomId].players.length >= 3) {
        socket.emit('error', { message: 'Комната заполнена (максимум 3 игрока)' });
        return;
      }

      const pid = incomingPid || genPid();
      rooms[roomId].players.push({
        pid,
        socketId: socket.id,
        cards: [],
        points: 0,
        bet: 0,
        chips: 1000,
      });
      socket.join(roomId);
      console.log(`BJ: new player pid=${pid} socket=${socket.id}`);
      socket.emit('joined', { roomId, playerId: pid });
      broadcastGameUpdate(roomId);
    } catch (err) {
      console.error('joinRoom error', err);
      socket.emit('error', { message: 'Ошибка при joinRoom' });
    }
  });

  socket.on('leaveRoom', (roomId: string) => {
    const room = rooms[roomId];
    if (!room) return;
    room.players = room.players.filter((p) => p.socketId !== socket.id);
    socket.leave(roomId);
    console.log(`BJ: socket ${socket.id} left ${roomId}`);
    if (room.state !== 'betting') {
      resetRound(roomId);
    } else {
      broadcastGameUpdate(roomId);
    }
  });

  socket.on('placeBet', (amount: number) => {
    const roomId = 'defaultRoom';
    const room = rooms[roomId];
    if (!room) return;
    const player = room.players.find((p) => p.socketId === socket.id);
    if (!player || room.state !== 'betting' || player.chips < amount) {
      socket.emit('error', { message: 'Недостаточно фишек или неверный статус игры' });
      return;
    }
    player.bet = amount;
    player.chips -= amount;
    console.log('BJ: bet', { pid: player.pid, amount });
    broadcastGameUpdate(roomId);
  });

  socket.on('resetBet', () => {
    const roomId = 'defaultRoom';
    const room = rooms[roomId];
    if (!room) return;
    const player = room.players.find((p) => p.socketId === socket.id);
    if (!player || room.state !== 'betting') return;
    player.chips += player.bet;
    player.bet = 0;
    broadcastGameUpdate(roomId);
  });

  socket.on('startGame', () => {
    const roomId = 'defaultRoom';
    const room = rooms[roomId];
    if (!room) return;
    const caller = room.players.find((p) => p.socketId === socket.id);
    if (!caller) {
      socket.emit('error', { message: 'Вы не участвуете в игре' });
      return;
    }
    if (caller.bet <= 0) {
      socket.emit('error', { message: 'Вы должны поставить, чтобы начать игру' });
      return;
    }

    const activePlayers = room.players.filter((p) => p.bet > 0);
    if (activePlayers.length > 0 && room.state === 'betting') {
      room.state = 'dealing';
      console.log('BJ: start dealing, active:', activePlayers.map((p) => p.pid));
      dealCards(roomId);
    } else {
      socket.emit('error', { message: 'Нельзя начать игру в текущем статусе' });
    }
  });

  socket.on('hit', async () => {
    const roomId = 'defaultRoom';
    const room = rooms[roomId];
    if (!room) return;
    const activePlayers = room.players.filter((p) => p.bet > 0);
    const player = activePlayers[room.currentPlayer];
    if (!player || player.socketId !== socket.id || room.state !== 'playing') {
      socket.emit('error', { message: 'Недопустимое действие' });
      return;
    }
    const card = room.deck.splice(Math.floor(Math.random() * room.deck.length), 1)[0];
    player.cards.push(card);
    player.points = calculatePoints(player.cards);
    console.log('BJ: hit', { pid: player.pid, card: card.name, points: player.points });

    broadcastGameUpdate(roomId);

    if (player.points > 21) {
      room.currentPlayer += 1;
    }

    const newActivePlayers = room.players.filter((p) => p.bet > 0);
    const anyNotBusted = newActivePlayers.some((p) => p.points <= 21);

    if (!anyNotBusted) {
      await sleep(PLAYER_BUST_NOTIFY_DELAY_MS);
      room.state = 'results';
      newActivePlayers.forEach((pl) => {
        if (pl.socketId) {
          io.to(pl.socketId).emit('gameResult', { result: 'lose', message: `Вы проиграли: перебор (${pl.points})` });
        }
      });
      newActivePlayers.forEach((pl) => { pl.cards = []; pl.points = 0; pl.bet = 0; });
      room.dealer.cards = []; room.dealer.points = 0;
      room.state = 'betting'; room.currentPlayer = 0;
      broadcastGameUpdate(roomId);
      return;
    }

    if (room.currentPlayer >= newActivePlayers.length) {
      room.state = 'dealerTurn';
      dealerTurn(roomId);
    } else {
      broadcastGameUpdate(roomId);
    }
  });

  socket.on('stand', async () => {
    const roomId = 'defaultRoom';
    const room = rooms[roomId];
    if (!room) return;
    const activePlayers = room.players.filter((p) => p.bet > 0);
    const player = activePlayers[room.currentPlayer];
    if (!player || player.socketId !== socket.id || room.state !== 'playing') {
      socket.emit('error', { message: 'Недопустимое действие' });
      return;
    }
    console.log('BJ: stand', { pid: player.pid });
    room.currentPlayer += 1;

    const newActivePlayers = room.players.filter((p) => p.bet > 0);
    if (room.currentPlayer >= newActivePlayers.length) {
      const anyNotBusted = newActivePlayers.some((p) => p.points <= 21);
      if (!anyNotBusted) {
        await sleep(PLAYER_BUST_NOTIFY_DELAY_MS);
        room.state = 'results';
        newActivePlayers.forEach((pl) => {
          if (pl.socketId) {
            io.to(pl.socketId).emit('gameResult', { result: 'lose', message: `Вы проиграли: перебор (${pl.points})` });
          }
        });
        newActivePlayers.forEach((pl) => { pl.cards = []; pl.points = 0; pl.bet = 0; });
        room.dealer.cards = []; room.dealer.points = 0;
        room.state = 'betting'; room.currentPlayer = 0;
        broadcastGameUpdate(roomId);
      } else {
        room.state = 'dealerTurn';
        dealerTurn(roomId);
      }
    } else {
      broadcastGameUpdate(roomId);
    }
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected:', socket.id);
    for (const roomId of Object.keys(rooms)) {
      const room = rooms[roomId];
      const p = room.players.find((x) => x.socketId === socket.id);
      if (p) {
        console.log(`BJ: mark player pid=${p.pid} disconnected; keep state for reconnect`);
        p.socketId = '';
        broadcastGameUpdate(roomId);
      }
    }
  });

  // ========================= Dealing / Flow =========================
  const dealCards = (roomId: string) => {
    const room = rooms[roomId];
    if (!room) return;
    room.deck = [...deckTemplate];
    let delay = 0;
    const activePlayers = room.players.filter((p) => p.bet > 0);

    // First + second cards to each player (sequential)
    activePlayers.forEach((player) => {
      setTimeout(() => {
        player.cards = [room.deck.splice(Math.floor(Math.random() * room.deck.length), 1)[0]];
        player.points = calculatePoints(player.cards);
        broadcastGameUpdate(roomId);
      }, delay);
      delay += 300;

      setTimeout(() => {
        player.cards.push(room.deck.splice(Math.floor(Math.random() * room.deck.length), 1)[0]);
        player.points = calculatePoints(player.cards);
        broadcastGameUpdate(roomId);
      }, delay);
      delay += 300;
    });

    // Dealer first card
    setTimeout(() => {
      room.dealer.cards = [room.deck.splice(Math.floor(Math.random() * room.deck.length), 1)[0]];
      room.dealer.points = calculatePoints(room.dealer.cards);
      broadcastGameUpdate(roomId);
    }, delay);
    delay += 300;

    // Dealer second card -> THEN handle naturals, else go to playing
    setTimeout(() => {
      room.dealer.cards.push(room.deck.splice(Math.floor(Math.random() * room.deck.length), 1)[0]);
      room.dealer.points = calculatePoints(room.dealer.cards);

      // === NATURAL BLACKJACK LOGIC START ===
      const allActive = room.players.filter((p) => p.bet > 0);
      const playersWithBJ = allActive.filter(
        (p) => p.cards.length === 2 && calculatePoints(p.cards) === 21
      );
      const dealerBJ = room.dealer.cards.length === 2 && room.dealer.points === 21;

      if (dealerBJ) {
        // Dealer has blackjack -> resolve immediately: BJ players push, others lose
        room.state = 'results';
        allActive.forEach((pl) => {
          if (!pl.socketId) return;
          if (pl.cards.length === 2 && calculatePoints(pl.cards) === 21) {
            // push
            io.to(pl.socketId).emit('gameResult', {
              result: 'draw',
              message: 'Ничья: у дилера и у вас блэкджек.',
            });
            pl.chips += pl.bet; // return bet
          } else {
            io.to(pl.socketId).emit('gameResult', {
              result: 'lose',
              message: `Поражение: у дилера блэкджек (${room.dealer.points}).`,
            });
            // no payout
          }
          // clear player for next round
          pl.cards = [];
          pl.points = 0;
          pl.bet = 0;
        });
        // cleanup dealer
        room.dealer.cards = [];
        room.dealer.points = 0;
        room.state = 'betting';
        room.currentPlayer = 0;
        broadcastGameUpdate(roomId);
        return;
      }

      if (playersWithBJ.length > 0) {
        // Pay naturals 3:2 (2.5x total back), skip their turns (mark not active by bet=0)
        playersWithBJ.forEach((pl) => {
          const payout = Math.floor(pl.bet * 2.5); // 100 -> 250
          pl.chips += payout;
          if (pl.socketId) {
            io.to(pl.socketId).emit('gameResult', {
              result: 'win',
              message: `Блэкджек! Выплата 2.5× (ставка ${pl.bet} → ${payout}).`,
            });
          }
          // исключаем из активных ходов
          pl.bet = 0;
        });

        // Если больше нет активных — сразу конец раунда
        const remain = room.players.filter((p) => p.bet > 0);
        if (remain.length === 0) {
          // очистка всех
          room.players.forEach((p) => { p.cards = []; p.points = 0; p.bet = 0; });
          room.dealer.cards = []; room.dealer.points = 0;
          room.state = 'betting';
          room.currentPlayer = 0;
          broadcastGameUpdate(roomId);
          return;
        }
      }
      // === NATURAL BLACKJACK LOGIC END ===

      // Продолжаем обычную игру для оставшихся
      room.state = 'playing';
      room.currentPlayer = 0;
      broadcastGameUpdate(roomId);
    }, delay);
  };

  const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

  // Dealer draws then compute results
  const dealerTurn = async (roomId: string) => {
    const room = rooms[roomId];
    if (!room) return;

    const revealDelayMs = CARD_ANIM_DURATION_MS + 120;
    const perDrawWaitMs = PER_CARD_DELAY_MS + CARD_ANIM_DURATION_MS;
    const extraBufferMs = RESULTS_EXTRA_DELAY_MS;

    room.state = 'dealerTurn';
    broadcastGameUpdate(roomId);
    await sleep(revealDelayMs);

    while (room.dealer.points < 17) {
      const drawn = room.deck.splice(Math.floor(Math.random() * room.deck.length), 1)[0];
      room.dealer.cards.push(drawn);
      room.dealer.points = calculatePoints(room.dealer.cards);
      broadcastGameUpdate(roomId);

      const activePlayers = room.players.filter((p) => p.bet > 0);
      const anyNotBusted = activePlayers.some((p) => p.points <= 21);
      if (!anyNotBusted) break;

      await sleep(perDrawWaitMs);
    }

    await sleep(extraBufferMs);

    room.state = 'results';
    const activePlayers = room.players.filter((p) => p.bet > 0);

    activePlayers.forEach((player) => {
      let result: string, message: string;
      if (player.points > 21) {
        result = 'lose';
        message = `Игрок ${room.players.indexOf(player) + 1} проиграл: перебор (${player.points})`;
      } else if (room.dealer.points > 21) {
        result = 'win';
        message = `Игрок ${room.players.indexOf(player) + 1} выиграл: дилер перебрал (${room.dealer.points})`;
        player.chips += player.bet * 2;
      } else if (player.points > room.dealer.points) {
        result = 'win';
        message = `Игрок ${room.players.indexOf(player) + 1} выиграл: ${player.points} против ${room.dealer.points}`;
        player.chips += player.bet * 2;
      } else if (player.points === room.dealer.points) {
        result = 'draw';
        message = `Игрок ${room.players.indexOf(player) + 1}: ничья (${player.points})`;
        player.chips += player.bet;
      } else {
        result = 'lose';
        message = `Игрок ${room.players.indexOf(player) + 1} проиграл: ${player.points} против ${room.dealer.points}`;
      }
      if (player.socketId) {
        io.to(player.socketId).emit('gameResult', { result, message });
      }
    });

    // cleanup
    room.players.forEach((p) => { p.cards = []; p.points = 0; p.bet = 0; });
    room.dealer.cards = []; room.dealer.points = 0;
    room.state = 'betting'; room.currentPlayer = 0;
    broadcastGameUpdate(roomId);
  };

});

// ========================= ATTACH POKER MANAGER =========================
const pokerRooms = new RoomManager();
pokerRooms.attach(io);

// ========================= START SERVER =========================
server.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
