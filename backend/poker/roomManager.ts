// backend/Poker/roomManager.ts
import { Server, Socket } from 'socket.io';
import { PokerEngine } from './pokerEngine.ts';
import type { Seat } from './pokerEngine.ts';

// pokersolver — CommonJS, берём default и достаём Hand
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import PokerSolver from 'pokersolver';
const { Hand } = PokerSolver as { Hand: any };

type Room = {
  id: string;
  engine: PokerEngine;
  sockets: Map<string, Socket>; // pid -> socket
};

export class RoomManager {
  io: Server | null = null;
  rooms: Map<string, Room> = new Map();

  attach(io: Server) {
    this.io = io;
    io.on('connection', (socket: Socket) => {
      console.log('socket connected (poker):', socket.id);

      socket.on('poker/join', (payload: { roomId?: string; playerId?: string } = {}) => {
        const roomId = payload.roomId ?? 'defaultPokerRoom';
        this.handleJoin(socket, roomId, payload.playerId);
      });

      socket.on('poker/start', () => this.handleStart(socket));
      socket.on('poker/action', (action) => this.handleAction(socket, action));
      socket.on('disconnect', () => this.handleDisconnect(socket));
    });
  }

  ensureRoom(roomId: string) {
    if (!this.rooms.has(roomId)) {
      const seats: Partial<Seat>[] = Array.from({ length: 6 }).map(() => ({ pid: null, chips: 1000 }));
      const engine = new PokerEngine(seats);
      this.rooms.set(roomId, { id: roomId, engine, sockets: new Map() });
      console.log(`Created poker room ${roomId}`);
    }
    return this.rooms.get(roomId)!;
  }

  handleJoin(socket: Socket, roomId: string, providedPid?: string) {
    const room = this.ensureRoom(roomId);
    const pid = providedPid ?? socket.id;

    room.sockets.set(pid, socket);
    socket.join(roomId);

    // assign seat if available and not already assigned
    let seatIdx = room.engine.seats.findIndex(s => s.pid === pid);
    if (seatIdx === -1) {
      seatIdx = room.engine.seats.findIndex(s => s.pid === null);
      if (seatIdx !== -1) {
        room.engine.seats[seatIdx].pid = pid;
        room.engine.seats[seatIdx].chips = room.engine.seats[seatIdx].chips ?? 1000;
        console.log(`Assigned pid=${pid} to seat ${seatIdx} in room ${roomId}`);
      } else {
        console.warn(`No seat available for pid=${pid} in room ${roomId} (spectator)`);
      }
    } else {
      console.log(`Pid=${pid} rejoined room ${roomId} at seat ${seatIdx}`);
    }

    // send joined (with public state)
    const publicState = this.buildPublicState(room.engine);
    socket.emit('poker/joined', { pid, state: publicState });

    // private state (hole cards + combo label) for this player
    this.emitPrivateStateTo(socket, room.engine, pid);

    // broadcast updated public state
    this.broadcastRoom(room);
  }

  handleStart(socket: Socket) {
    const found = this.findRoomAndPidBySocket(socket);
    if (!found) {
      socket.emit('poker/error', { message: 'Комната не найдена при старте' });
      return;
    }
    const { room } = found;

    // rotate button safely; if null -> set to 0
    const seatsLen = Math.max(1, room.engine.seats.length);
    const nextButton = ((room.engine.buttonIdx ?? -1) + 1) % seatsLen;
    room.engine.buttonIdx = nextButton;

    room.engine.startHand(room.engine.buttonIdx);

    try {
      console.log(`Poker: hand started in room=${room.id}, button=${room.engine.buttonIdx}`);
      room.engine.seats.forEach((s, idx) => {
        const codes = (s.cards || []).map(c => c.code).join(',');
        console.log(` seat ${idx}: pid=${s.pid} chips=${s.chips} cards=[${codes}] folded=${s.folded}`);
      });
    } catch (e) {
      console.warn('Debug log failed', e);
    }

    // broadcast public & private states
    this.broadcastRoom(room);
    this.emitPrivateStateToAll(room);
  }

  handleAction(socket: Socket, action: any) {
    const found = this.findRoomAndPidBySocket(socket);
    if (!found) {
      socket.emit('poker/error', { message: 'Комната не найдена при действии' });
      return;
    }
    const { room, pid } = found;

    const idx = room.engine.seats.findIndex(s => s.pid === pid);
    if (idx === -1) {
      socket.emit('poker/error', { message: 'Вы не заняли место за столом' });
      return;
    }

    try {
      room.engine.applyAction(idx, action);

      // if moved to showdown stage
      if (room.engine.stage === 'showdown') {
        const result = room.engine.showdownAndDistribute();
        this.broadcastRoom(room);
        this.io?.to(room.id).emit('poker/result', { payouts: result.payouts, winnersDetail: result.winnersDetail });
        return;
      }

      if (room.engine.stage === 'results') {
        this.broadcastRoom(room);
        this.io?.to(room.id).emit('poker/result', { message: 'Hand finished (fold/winner declared)' });
        return;
      }

      // normal update
      this.broadcastRoom(room);
      this.emitPrivateStateToAll(room);
    } catch (err) {
      const message = (err as Error).message ?? 'Action failed';
      console.error('Action error:', message);
      socket.emit('poker/error', { message });
    }
  }

  handleDisconnect(socket: Socket) {
    for (const room of this.rooms.values()) {
      for (const [pid, sock] of room.sockets.entries()) {
        if (sock.id === socket.id) {
          room.sockets.delete(pid);
          console.log(`poker: socket ${socket.id} disconnected for pid=${pid} (room=${room.id})`);
          this.broadcastRoom(room);
          return;
        }
      }
    }
  }

  /* --------------------- PUBLIC / PRIVATE STATE BUILDERS --------------------- */

  // Build public state. Hole cards скрыты до шоудауна.
  buildPublicState(engine: PokerEngine) {
    const showCardsNow = engine.stage === 'showdown' || engine.stage === 'results';

    const seats = engine.seats.map(s => {
      const publicCards = showCardsNow && !s.folded
        ? (s.cards || []).map(c => ({ name: c.code, image: `/assets/cards/${this.serverCodeToImageName(c.code)}` }))
        : [];

      // Публично комбинацию показываем только на шоудауне/результатах
      const publicComboLabel = (showCardsNow && !s.folded)
        ? this.computeComboLabelForSeat(engine, s)
        : undefined;

      return {
        pid: s.pid,
        name: s.name,
        chips: s.chips,
        bet: s.bet,
        cards: publicCards,
        folded: s.folded,
        isAllIn: s.isAllIn,
        isDealer: s.isDealer,
        isActive: engine.currentToActIdx !== null && engine.seats[engine.currentToActIdx].pid === s.pid,
        comboLabel: publicComboLabel, // видна всем только на шоудауне
      };
    });

    const board = (engine.board || []).map(c => ({ name: c.code, image: `/assets/cards/${this.serverCodeToImageName(c.code)}` }));

    return {
      seats,
      board,
      pot: engine.pot,
      sidePots: engine.sidePots,
      currentToActPid: engine.currentToActIdx !== null ? engine.seats[engine.currentToActIdx].pid : null,
      minRaise: engine.minRaise,
      smallBlind: engine.smallBlind,
      bigBlind: engine.bigBlind,
      stage: engine.stage,
      stateId: Date.now(),
    };
  }

  // Emit private hole-cards + combo label to a specific socket (видно только владельцу)
  emitPrivateStateTo(socket: Socket, engine: PokerEngine, pid: string) {
    const seat = engine.seats.find(s => s.pid === pid);
    if (!seat) {
      try { socket.emit('poker/privateState', { yourCards: [], comboLabel: '—' }); } catch (e) {}
      return;
    }
    const yourCards = (seat.cards || []).map(c => ({ name: c.code, image: `/assets/cards/${this.serverCodeToImageName(c.code)}` }));
    const comboLabel = this.computeComboLabelForSeat(engine, seat);
    try {
      socket.emit('poker/privateState', { yourCards, comboLabel });
      console.log(`poker: emitted privateState to pid=${pid} cards=[${yourCards.map(x => x.name).join(',')}] combo=${comboLabel}`);
    } catch (e) {
      console.warn('emit privateState failed', e);
    }
  }

  // Emit private states (hole + combo) to all seated sockets
  emitPrivateStateToAll(room: Room) {
    for (const [pid, sock] of room.sockets.entries()) {
      const seat = room.engine.seats.find(s => s.pid === pid);
      if (seat) {
        const yourCards = (seat.cards || []).map(c => ({ name: c.code, image: `/assets/cards/${this.serverCodeToImageName(c.code)}` }));
        const comboLabel = this.computeComboLabelForSeat(room.engine, seat);
        try {
          sock.emit('poker/privateState', { yourCards, comboLabel });
          console.log(`poker: privateState pid=${pid} combo=${comboLabel}`);
        } catch (e) {
          console.warn('emit privateState to all failed for pid', pid, e);
        }
      } else {
        try { sock.emit('poker/privateState', { yourCards: [], comboLabel: '—' }); } catch (e) {}
      }
    }
  }

  /* ------------------------------ EVALUATION ------------------------------ */

  // Возвращает читаемый label комбинации для конкретного seat с учётом текущего борда.
  // До флопа считаем упрощённо: пара в руке или High Card.
  private computeComboLabelForSeat(engine: PokerEngine, seat: Seat): string {
    if (!seat || !seat.pid || seat.folded) return seat?.folded ? 'Fold' : '—';
    const hole = seat.cards || [];
    const board = engine.board || [];

    // До флопа — упрощённые названия (не спойлим через сервер)
    if (board.length < 3) {
      if (hole.length < 2) return '—';
      const v1 = hole[0].code?.[0];
      const v2 = hole[1].code?.[0];
      if (v1 && v2 && v1 === v2) return 'Pair';
      return 'High Card';
    }

    // Нормальная оценка от флопа и дальше
    try {
      const codes: string[] = [
        ...hole.map(c => this.normalizeCode(c.code)).filter(Boolean) as string[],
        ...board.map(c => this.normalizeCode(c.code)).filter(Boolean) as string[],
      ];
      if (!Hand || codes.length < 5) return '—';
      const solved = Hand.solve(codes);
      const name: string | undefined = solved?.name;
      return name || '—';
    } catch {
      return '—';
    }
  }

  private normalizeCode(code?: string): string | null {
    if (!code || code.length < 2) return null;
    const v = code[0];
    const s = code[1];
    return (v === 'T' ? '10' : v) + s;
  }

  /* ----------------------------- UTIL / FINDERS ----------------------------- */

  // Find room and pid by socket instance
  findRoomAndPidBySocket(socket: Socket): { room: Room; pid: string } | null {
    for (const room of this.rooms.values()) {
      for (const [pid, sock] of room.sockets.entries()) {
        if (sock.id === socket.id) return { room, pid };
      }
    }
    return null;
  }

  serverCodeToImageName(code: string) {
    // 'As','Td','9h' -> 'ace_of_spades.png'
    const v = code[0];
    const s = code[1];
    const valueMap: Record<string, string> = { 'T': '10', 'J': 'jack', 'Q': 'queen', 'K': 'king', 'A': 'ace' };
    const suitMap: Record<string, string> = { s: 'spades', h: 'hearts', d: 'diamonds', c: 'clubs' };
    const vnode = valueMap[v] ?? v;
    const suit = suitMap[s] ?? s;
    return `${vnode}_of_${suit}.png`;
  }

  broadcastRoom(room: Room) {
    if (!this.io) return;
    const publicState = this.buildPublicState(room.engine);
    this.io.to(room.id).emit('poker/update', publicState);
  }
}
