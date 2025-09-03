// backend/server.ts
import express from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import crypto from 'crypto';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: 'http://localhost:5173', methods: ['GET', 'POST'] },
});

app.use(cors());

/**
 * SERVER CONFIG
 */
const CARD_ANIM_DURATION_MS = 420;
const PER_CARD_DELAY_MS = 250;
const PLAYER_BUST_NOTIFY_DELAY_MS = 1200;
const RESULTS_EXTRA_DELAY_MS = 1120; // 120 + 1000 earlier

type Card = { name: string; image: string; value: number; };
type Player = {
  pid: string;        // persistent id (keeps across refresh)
  socketId: string;   // current socket id
  cards: Card[];
  points: number;
  bet: number;
  chips: number;
};
type Dealer = { cards: Card[]; points: number; };
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
    image: `/assets/cards/${value.name}_of_${suit}${suit === 'clubs' && ['jack','queen','king'].includes(value.name) ? '2' : ''}.png`,
    value: value.name === 'ace' ? 11 : ['jack','queen','king'].includes(value.name) ? 10 : parseInt(value.name),
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

// helper: create random pid
const genPid = () => crypto.randomBytes(8).toString('hex');

// Send sanitized game state to clients (don't expose socketId)
const broadcastGameUpdate = (roomId: string) => {
  const room = rooms[roomId];
  if (!room) return;
  room.stateId++;
  const activePlayers = room.players.filter((p) => p.bet > 0);
  const currentTurnPid = activePlayers[room.currentPlayer]?.pid ?? null;

  // prepare players for broadcasting (exclude socketId)
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

io.on('connection', (socket: Socket) => {
  console.log('Socket connected:', socket.id);

  /**
   * joinRoom payload can be:
   *  - string: roomId (legacy)
   *  - { roomId: string, playerId?: string } newer
   */
  socket.on('joinRoom', (payload: any) => {
    try {
      let roomId = 'defaultRoom';
      let incomingPid: string | undefined = undefined;

      if (!payload) {
        // nothing — assume default room and treat socket.id as transient
      } else if (typeof payload === 'string') {
        roomId = payload;
      } else if (typeof payload === 'object') {
        roomId = payload.roomId || 'defaultRoom';
        incomingPid = payload.playerId;
      }

      if (!rooms[roomId]) {
        socket.emit('error', { message: 'Комната не существует' });
        return;
      }

      // If player with that pid exists — update socketId (reconnect after refresh)
      if (incomingPid) {
        const existing = rooms[roomId].players.find((p) => p.pid === incomingPid);
        if (existing) {
          existing.socketId = socket.id;
          // keep existing cards/chips/bet etc.
          socket.join(roomId);
          console.log(`Player rejoined pid=${incomingPid} socket=${socket.id} room=${roomId}`);
          broadcastGameUpdate(roomId);
          return;
        }
      }

      // Otherwise create new player with pid
      // (prevent overflow - max 3 persistent players as before)
      if (rooms[roomId].players.length >= 3) {
        socket.emit('error', { message: 'Комната заполнена (максимум 3 игрока)' });
        return;
      }

      const pid = incomingPid || genPid();
      const newPlayer: Player = {
        pid,
        socketId: socket.id,
        cards: [],
        points: 0,
        bet: 0,
        chips: 1000,
      };
      rooms[roomId].players.push(newPlayer);
      socket.join(roomId);
      console.log(`New player pid=${pid} socket=${socket.id} joined ${roomId}`);
      // send back the pid so client can persist it to localStorage
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
    // remove player by socketId
    room.players = room.players.filter((p) => p.socketId !== socket.id);
    socket.leave(roomId);
    console.log(`Socket ${socket.id} left ${roomId}`);
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
    console.log('Bet placed:', { pid: player.pid, amount });
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
      console.log('Starting deal, active players:', activePlayers.map((p) => p.pid));
      dealCards(roomId);
    } else {
      socket.emit('error', { message: 'Нельзя начать игру в текущем статусе' });
    }
  });

  // make hit/stand async because we may await delays (bust notify)
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
    console.log('Hit:', { pid: player.pid, card: card.name, points: player.points });

    broadcastGameUpdate(roomId);

    if (player.points > 21) {
      room.currentPlayer += 1;
    }

    const newActivePlayers = room.players.filter((p) => p.bet > 0);
    const anyNotBusted = newActivePlayers.some((p) => p.points <= 21);

    if (!anyNotBusted) {
      // allow client to display bust animation/cards
      await sleep(PLAYER_BUST_NOTIFY_DELAY_MS);

      // all busted -> results (everyone loses)
      room.state = 'results';
      newActivePlayers.forEach((pl) => {
        io.to(pl.socketId).emit('gameResult', { result: 'lose', message: `Вы проиграли: перебор (${pl.points})` });
      });
      // cleanup
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
    console.log('Stand:', { pid: player.pid });
    room.currentPlayer += 1;

    const newActivePlayers = room.players.filter((p) => p.bet > 0);
    if (room.currentPlayer >= newActivePlayers.length) {
      const anyNotBusted = newActivePlayers.some((p) => p.points <= 21);
      if (!anyNotBusted) {
        // let clients show final cards
        await sleep(PLAYER_BUST_NOTIFY_DELAY_MS);
        room.state = 'results';
        newActivePlayers.forEach((pl) => {
          io.to(pl.socketId).emit('gameResult', { result: 'lose', message: `Вы проиграли: перебор (${pl.points})` });
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
    // mark the player as disconnected (but KEEP their player entry so they can reconnect by pid)
    // we won't remove player from room instantly to allow refresh+reconnect
    // For safety, we could implement TTL removal of stale players later
    for (const roomId of Object.keys(rooms)) {
      const room = rooms[roomId];
      // if there is a player with this socketId, clear socketId (so we can detect reconnect)
      const p = room.players.find((x) => x.socketId === socket.id);
      if (p) {
        console.log(`Marking player pid=${p.pid} socket left; keeping their state for reconnect`);
        p.socketId = ''; // empty until reconnect
        // Do not reset round here; keep game running for others — optionally you might want to reset
        // If needed: if room.state !== 'betting' -> resetRound(roomId);
        broadcastGameUpdate(roomId);
      }
    }
  });

  // dealing logic ------------------------------------------------
  const dealCards = (roomId: string) => {
    const room = rooms[roomId];
    if (!room) return;
    room.deck = [...deckTemplate];
    let delay = 0;
    const activePlayers = room.players.filter((p) => p.bet > 0);

    // sequential dealing with timeouts
    activePlayers.forEach((player, index) => {
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

    // dealer second card -> switch to playing
    setTimeout(() => {
      room.dealer.cards.push(room.deck.splice(Math.floor(Math.random() * room.deck.length), 1)[0]);
      room.dealer.points = calculatePoints(room.dealer.cards);
      room.state = 'playing';
      room.currentPlayer = 0;
      broadcastGameUpdate(roomId);
    }, delay);
  };

  const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

  // dealerTurn: reveal hole card, draw while <17, then results (with waits tuned to client)
  const dealerTurn = async (roomId: string) => {
    const room = rooms[roomId];
    if (!room) return;

    const revealDelayMs = CARD_ANIM_DURATION_MS + 120;
    const perDrawWaitMs = PER_CARD_DELAY_MS + CARD_ANIM_DURATION_MS;
    const extraBufferMs = RESULTS_EXTRA_DELAY_MS;

    // reveal hole card
    room.state = 'dealerTurn';
    broadcastGameUpdate(roomId);

    await sleep(revealDelayMs);

    // draw one by one
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

    // compute results
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
      // make sure to use socketId for sending
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

server.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
