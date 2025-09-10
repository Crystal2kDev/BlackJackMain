// backend/server.ts
import express from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import crypto from 'crypto';

// --- Poker manager (нижний регистр пути) ---
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
const BET_TIMEOUT_MS = 7000; // 7 seconds per player for betting

type Card = { name: string; image: string; value: number };
type Player = {
  pid: string;      // persistent id (keeps across refresh)
  socketId: string; // current socket id ('' when disconnected)
  cards: Card[];
  points: number;
  bet: number;
  chips: number;
  nickname?: string;
  avatar?: string;
  shortId?: number;
};
type Dealer = { cards: Card[]; points: number };
type Room = {
  players: Player[];
  dealer: Dealer;
  state: 'betting' | 'collectingBets' | 'dealing' | 'playing' | 'dealerTurn' | 'results';
  currentPlayer: number; // index among asked-for-bets OR among active players when playing
  deck: Card[];
  stateId: number;
  processing?: boolean; // to avoid concurrent operations per-room
  betTimer?: NodeJS.Timeout | null;
  betInterval?: NodeJS.Timeout | null;
  betRemainingMs?: number;
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
    processing: false,
    betTimer: null,
    betInterval: null,
    betRemainingMs: 0,
  },
};

let globalShortIdCounter = 1;

const genPid = () => crypto.randomBytes(8).toString('hex');

const clearBetTimers = (room: Room) => {
  if (room.betTimer) {
    clearTimeout(room.betTimer);
    room.betTimer = null;
  }
  if (room.betInterval) {
    clearInterval(room.betInterval);
    room.betInterval = null;
  }
  room.betRemainingMs = 0;
};

const broadcastGameUpdate = (roomId: string) => {
  const room = rooms[roomId];
  if (!room) return;
  room.stateId++;
  let currentTurnPid: string | null = null;
  if (room.state === 'collectingBets') {
    currentTurnPid = room.players[room.currentPlayer]?.pid ?? null;
  } else {
    const activePlayers = room.players.filter((p) => p.bet > 0);
    currentTurnPid = activePlayers[room.currentPlayer]?.pid ?? null;
  }

  const publicPlayers = room.players.map((p) => ({
    pid: p.pid,
    cards: p.cards,
    points: p.points,
    bet: p.bet,
    chips: p.chips,
    nickname: p.nickname,
    avatar: p.avatar,
    shortId: p.shortId,
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

const emitBetTimer = (roomId: string) => {
  const room = rooms[roomId];
  if (!room) return;
  io.to(roomId).emit('betTimer', {
    remainingMs: room.betRemainingMs ?? 0,
    totalMs: BET_TIMEOUT_MS,
    currentPid: room.players[room.currentPlayer]?.pid ?? null,
  });
};

const scheduleBetForCurrent = (roomId: string) => {
  const room = rooms[roomId];
  if (!room) return;
  clearBetTimers(room);
  room.betRemainingMs = BET_TIMEOUT_MS;
  room.betInterval = setInterval(() => {
    room.betRemainingMs = Math.max(0, (room.betRemainingMs ?? 0) - 200);
    emitBetTimer(roomId);
  }, 200);
  room.betTimer = setTimeout(() => {
    // auto-skip current player
    const player = room.players[room.currentPlayer];
    if (player) {
      let i = room.currentPlayer + 1;
      while (i < room.players.length && room.players[i].socketId === '') i++;
      room.currentPlayer = i;
      clearBetTimers(room);
      if (room.currentPlayer >= room.players.length) {
        const hasBets = room.players.some(p => p.bet > 0);
        if (hasBets) {
          room.state = 'dealing';
          room.processing = true;
          broadcastGameUpdate(roomId);
          setTimeout(() => dealCards(roomId), 180);
        } else {
          resetRound(roomId);
          io.to(roomId).emit('error', { message: 'Никто не поставил ставку, раунд сброшен.' });
        }
      } else {
        broadcastGameUpdate(roomId);
        scheduleBetForCurrent(roomId);
      }
    }
  }, BET_TIMEOUT_MS);
  emitBetTimer(roomId);
};

const resetRound = (roomId: string) => {
  const room = rooms[roomId];
  if (!room) return;
  clearBetTimers(room);
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

/**
 * IMPORTANT: declare dealCards and dealerTurn as function declarations
 * so they are hoisted and available from any handler ordering.
 */

/* Dealer's turn function — function declaration (hoisted) */
async function dealerTurn(roomId: string) {
  const room = rooms[roomId];
  if (!room) return;
  room.processing = true;

  try {
    const revealDelayMs = CARD_ANIM_DURATION_MS + 120;
    const perDrawWaitMs = PER_CARD_DELAY_MS + CARD_ANIM_DURATION_MS;
    const extraBufferMs = RESULTS_EXTRA_DELAY_MS;

    room.state = 'dealerTurn';
    broadcastGameUpdate(roomId);
    await new Promise((r) => setTimeout(r, revealDelayMs));

    while (room.dealer.points < 17) {
      const drawn = room.deck.splice(Math.floor(Math.random() * room.deck.length), 1)[0];
      room.dealer.cards.push(drawn);
      room.dealer.points = calculatePoints(room.dealer.cards);
      broadcastGameUpdate(roomId);

      const activePlayers = room.players.filter((p) => p.bet > 0);
      const anyNotBusted = activePlayers.some((p) => p.points <= 21);
      if (!anyNotBusted) break;

      await new Promise((r) => setTimeout(r, perDrawWaitMs));
    }

    await new Promise((r) => setTimeout(r, extraBufferMs));

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
  } finally {
    room.processing = false;
  }
}

/* Dealing function — function declaration (hoisted) */
function dealCards(roomId: string) {
  const room = rooms[roomId];
  if (!room) return;
  clearBetTimers(room);
  room.deck = [...deckTemplate];
  // shuffle
  for (let i = room.deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [room.deck[i], room.deck[j]] = [room.deck[j], room.deck[i]];
  }

  let delay = 0;
  const activePlayers = room.players.filter((p) => p.bet > 0);

  // sequential dealing to players
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

  // dealer first card
  setTimeout(() => {
    room.dealer.cards = [room.deck.splice(Math.floor(Math.random() * room.deck.length), 1)[0]];
    room.dealer.points = calculatePoints(room.dealer.cards);
    broadcastGameUpdate(roomId);
  }, delay);
  delay += 300;

  // dealer second card -> evaluate naturals
  setTimeout(() => {
    room.dealer.cards.push(room.deck.splice(Math.floor(Math.random() * room.deck.length), 1)[0]);
    room.dealer.points = calculatePoints(room.dealer.cards);
    broadcastGameUpdate(roomId);

    // slight wait then natural check
    setTimeout(() => {
      const allActive = room.players.filter((p) => p.bet > 0);
      const playersWithBJ = allActive.filter((p) => p.cards.length === 2 && calculatePoints(p.cards) === 21);
      const dealerBJ = room.dealer.cards.length === 2 && room.dealer.points === 21;

      if (dealerBJ) {
        room.state = 'results';
        allActive.forEach((pl) => {
          if (!pl.socketId) return;
          if (pl.cards.length === 2 && calculatePoints(pl.cards) === 21) {
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
          }
        });
        setTimeout(() => {
          allActive.forEach((pl) => { pl.cards = []; pl.points = 0; pl.bet = 0; });
          room.dealer.cards = []; room.dealer.points = 0;
          room.state = 'betting';
          room.currentPlayer = 0;
          room.processing = false;
          broadcastGameUpdate(roomId);
        }, 700);
        return;
      }

      if (playersWithBJ.length > 0) {
        playersWithBJ.forEach((pl) => {
          const payout = Math.floor(pl.bet * 2.5);
          pl.chips += payout;
          if (pl.socketId) {
            io.to(pl.socketId).emit('gameResult', {
              result: 'win',
              message: `Блэкджек! Выплата 2.5× (ставка ${pl.bet} → ${payout}).`,
            });
          }
          pl.bet = 0; // exclude from active
        });

        const remain = room.players.filter((p) => p.bet > 0);
        if (remain.length === 0) {
          setTimeout(() => {
            room.players.forEach((p) => { p.cards = []; p.points = 0; p.bet = 0; });
            room.dealer.cards = []; room.dealer.points = 0;
            room.state = 'betting';
            room.currentPlayer = 0;
            room.processing = false;
            broadcastGameUpdate(roomId);
          }, 700);
          return;
        }
      }

      room.state = 'playing';
      room.currentPlayer = 0;
      room.processing = false;
      broadcastGameUpdate(roomId);
    }, 700);
  }, delay);
}

// ========================= SOCKET IO HANDLERS =========================
io.on('connection', (socket: Socket) => {
  console.log('Socket connected:', socket.id);

  socket.on('joinRoom', (payload: any) => {
    try {
      let roomId = 'defaultRoom';
      let incomingPid: string | undefined;
      let incomingName: string | undefined;
      let incomingAvatar: string | undefined;

      if (typeof payload === 'string') roomId = payload;
      else if (payload && typeof payload === 'object') {
        roomId = payload.roomId || 'defaultRoom';
        incomingPid = payload.playerId;
        incomingName = payload.name;
        incomingAvatar = payload.avatar;
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
          if (incomingName) existing.nickname = incomingName;
          if (incomingAvatar) existing.avatar = incomingAvatar;
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
        nickname: incomingName || `Newbie`,
        avatar: incomingAvatar || '',
        shortId: globalShortIdCounter++,
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

  socket.on('placeBet', (amount: any) => {
    const roomId = 'defaultRoom';
    const room = rooms[roomId];
    if (!room) return;
    const player = room.players.find((p) => p.socketId === socket.id);
    const numeric = Number(amount);
    if (!player || room.state === 'dealing' || !Number.isFinite(numeric) || numeric <= 0 || player.chips < numeric) {
      socket.emit('error', { message: 'Недостаточно фишек или неверный статус игры' });
      return;
    }

    // If in collectingBets, ensure it's player's turn
    if (room.state === 'collectingBets') {
      const cur = room.players[room.currentPlayer];
      if (!cur || cur.pid !== player.pid) {
        socket.emit('error', { message: 'Сейчас не ваш ход на ставку' });
        return;
      }
    } else if (room.state !== 'betting') {
      socket.emit('error', { message: 'Ставки сейчас не принимаются' });
      return;
    }

    player.bet = Math.floor(numeric);
    player.chips -= player.bet;
    console.log('BJ: bet', { pid: player.pid, amount: player.bet });

    if (room.state === 'collectingBets') {
      clearBetTimers(room);
      let i = room.currentPlayer + 1;
      while (i < room.players.length && room.players[i].socketId === '') i++;
      room.currentPlayer = i;

      if (room.currentPlayer >= room.players.length) {
        const hasBets = room.players.some(p => p.bet > 0);
        if (hasBets) {
          room.state = 'dealing';
          room.processing = true;
          broadcastGameUpdate(roomId);
          setTimeout(() => dealCards(roomId), 180);
        } else {
          resetRound(roomId);
          io.to(roomId).emit('error', { message: 'Никто не поставил ставку, раунд сброшен.' });
        }
        return;
      }
      broadcastGameUpdate(roomId);
      scheduleBetForCurrent(roomId);
      return;
    }

    broadcastGameUpdate(roomId);
  });

  socket.on('skipBet', () => {
    const roomId = 'defaultRoom';
    const room = rooms[roomId];
    if (!room) return;
    if (room.state !== 'collectingBets') return;
    const player = room.players.find((p) => p.socketId === socket.id);
    if (!player) return;
    const cur = room.players[room.currentPlayer];
    if (!cur || cur.pid !== player.pid) return;

    clearBetTimers(room);
    let i = room.currentPlayer + 1;
    while (i < room.players.length && room.players[i].socketId === '') i++;
    room.currentPlayer = i;

    if (room.currentPlayer >= room.players.length) {
      const hasBets = room.players.some(p => p.bet > 0);
      if (hasBets) {
        room.state = 'dealing';
        room.processing = true;
        broadcastGameUpdate(roomId);
        setTimeout(() => dealCards(roomId), 180);
      } else {
        resetRound(roomId);
        io.to(roomId).emit('error', { message: 'Никто не поставил ставку, раунд сброшен.' });
      }
      return;
    }

    broadcastGameUpdate(roomId);
    scheduleBetForCurrent(roomId);
  });

  socket.on('startGame', () => {
    const roomId = 'defaultRoom';
    const room = rooms[roomId];
    if (!room) return;
    if (room.processing) {
      socket.emit('error', { message: 'Operation in progress, try again' });
      return;
    }
    const caller = room.players.find((p) => p.socketId === socket.id);
    if (!caller) {
      socket.emit('error', { message: 'Вы не участвуете в игре' });
      return;
    }

    if (room.state === 'betting') {
      // begin sequential collecting bets
      room.state = 'collectingBets';
      room.currentPlayer = 0;
      while (room.currentPlayer < room.players.length && room.players[room.currentPlayer].socketId === '') {
        room.currentPlayer++;
      }
      broadcastGameUpdate(roomId);
      if (room.currentPlayer < room.players.length) {
        scheduleBetForCurrent(roomId);
      } else {
        resetRound(roomId);
        io.to(roomId).emit('error', { message: 'Нет активных игроков.' });
      }
      return;
    } else {
      socket.emit('error', { message: 'Нельзя начать сбор ставок в текущем статусе' });
    }
  });

  const getActivePlayers = (room: Room) => room.players.filter((p) => p.bet > 0);
  const getActivePlayerByTurn = (room: Room) => {
    const active = getActivePlayers(room);
    if (active.length === 0) return null;
    const idx = room.currentPlayer;
    if (idx < 0 || idx >= active.length) return null;
    return active[idx];
  };

  socket.on('hit', async () => {
    const roomId = 'defaultRoom';
    const room = rooms[roomId];
    if (!room) return;

    if (room.processing) {
      socket.emit('error', { message: 'Operation in progress, try again' });
      return;
    }
    room.processing = true;
    try {
      const activePlayers = getActivePlayers(room);
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

      const newActivePlayers = getActivePlayers(room);
      const anyNotBusted = newActivePlayers.some((p) => p.points <= 21);

      if (!anyNotBusted) {
        await new Promise((r) => setTimeout(r, PLAYER_BUST_NOTIFY_DELAY_MS));
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
        broadcastGameUpdate(roomId);
        await dealerTurn(roomId);
      } else {
        broadcastGameUpdate(roomId);
      }
    } finally {
      room.processing = false;
    }
  });

  socket.on('stand', async () => {
    const roomId = 'defaultRoom';
    const room = rooms[roomId];
    if (!room) return;

    if (room.processing) {
      socket.emit('error', { message: 'Operation in progress, try again' });
      return;
    }
    room.processing = true;
    try {
      const activePlayers = getActivePlayers(room);
      const player = activePlayers[room.currentPlayer];
      if (!player || player.socketId !== socket.id || room.state !== 'playing') {
        socket.emit('error', { message: 'Недопустимое действие' });
        return;
      }
      console.log('BJ: stand', { pid: player.pid });
      room.currentPlayer += 1;

      const newActivePlayers = getActivePlayers(room);
      if (room.currentPlayer >= newActivePlayers.length) {
        const anyNotBusted = newActivePlayers.some((p) => p.points <= 21);
        if (!anyNotBusted) {
          await new Promise((r) => setTimeout(r, PLAYER_BUST_NOTIFY_DELAY_MS));
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
          broadcastGameUpdate(roomId);
          await dealerTurn(roomId);
        }
      } else {
        broadcastGameUpdate(roomId);
      }
    } finally {
      room.processing = false;
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

}); // end io.on('connection')

// ========================= ATTACH POKER MANAGER =========================
const pokerRooms = new RoomManager();
pokerRooms.attach(io);

// ========================= START SERVER =========================
server.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});