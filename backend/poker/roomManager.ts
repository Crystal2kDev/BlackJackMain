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
  showdownTimer?: any; // optional timer id for scheduled showdown distribution
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

      socket.on('poker/sit', (payload: { seatIdx?: number }) => {
        this.handleSit(socket, payload?.seatIdx);
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
      this.rooms.set(roomId, { id: roomId, engine, sockets: new Map(), showdownTimer: null });
      console.log(`Created poker room ${roomId}`);
    }
    return this.rooms.get(roomId)!;
  }

  handleJoin(socket: Socket, roomId: string, providedPid?: string) {
    const room = this.ensureRoom(roomId);
    const pid = providedPid ?? socket.id;

    room.sockets.set(pid, socket);
    socket.join(roomId);

    // if pid already assigned to seat, just update socket mapping
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

    // send joined + public state
    const publicState = this.buildPublicState(room.engine);
    socket.emit('poker/joined', { pid, state: publicState });

    // send private (hole) state and combo
    this.emitPrivateStateTo(socket, room.engine, pid);

    // broadcast updated public state
    this.broadcastRoom(room);
  }

  handleSit(socket: Socket, seatIdx?: number) {
    const found = this.findRoomAndPidBySocket(socket);
    if (!found) {
      socket.emit('poker/error', { message: 'Комната не найдена при садке за стол' });
      return;
    }
    const { room, pid } = found;
    if (typeof seatIdx !== 'number' || seatIdx < 0 || seatIdx >= room.engine.seats.length) {
      socket.emit('poker/error', { message: 'Неверный индекс места' });
      return;
    }

    // if seat occupied by other pid, refuse
    const target = room.engine.seats[seatIdx];
    if (target.pid && target.pid !== pid) {
      socket.emit('poker/error', { message: 'Место занято' });
      return;
    }

    // clear any previous seat the pid had
    room.engine.seats.forEach((s) => { if (s.pid === pid) { s.pid = null; } });

    // assign pid to seat
    target.pid = pid;
    target.chips = target.chips ?? 1000;
    target.bet = target.bet ?? 0;
    target.cards = target.cards ?? [];
    console.log(`pid=${pid} sat at ${seatIdx} in room ${room.id}`);

    // send updates
    this.broadcastRoom(room);
    this.emitPrivateStateToAll(room);
  }

  handleStart(socket: Socket) {
    const found = this.findRoomAndPidBySocket(socket);
    if (!found) {
      socket.emit('poker/error', { message: 'Комната не найдена при старте' });
      return;
    }
    const { room } = found;

    // rotate button (safe)
    const seatsLen = Math.max(1, room.engine.seats.length);
    const nextButton = ((room.engine.buttonIdx ?? -1) + 1) % seatsLen;
    room.engine.buttonIdx = nextButton;

    room.engine.startHand(room.engine.buttonIdx);

    try {
      console.log(`Poker: hand started in room=${room.id}, button=${room.engine.buttonIdx}`);
      room.engine.seats.forEach((s, idx) => {
        const codes = (s.cards || []).map((c: any) => c.code).join(',');
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
      // clear any scheduled showdown if player acts (prevent double-run)
      if (room.showdownTimer) {
        clearTimeout(room.showdownTimer);
        room.showdownTimer = null;
      }

      const result = room.engine.applyAction(idx, action); // returns { stageChangedToShowdown }

      // normal update first (clients need to see card flips / bets)
      this.broadcastRoom(room);
      this.emitPrivateStateToAll(room);

      // if moved to showdown stage (either returned flag or state now is showdown)
      const SHOWDOWN_DELAY_MS = 1600; // allow client reveal animations to finish (stagger + flip duration)
      if ((result && result.stageChangedToShowdown) || room.engine.stage === 'showdown') {
        // schedule distribution after small delay so clients can flip last card
        if (!room.showdownTimer) {
          room.showdownTimer = setTimeout(() => {
            try {
              const distribution = room.engine.showdownAndDistribute();
              this.broadcastRoom(room);
              this.io?.to(room.id).emit('poker/result', { payouts: distribution.payouts, winnersDetail: distribution.winnersDetail });
              // private + public states (showdown should reveal)
              this.emitPrivateStateToAll(room);
              room.showdownTimer = null;
            } catch (err) {
              console.error('Showdown schedule error', err);
              room.showdownTimer = null;
            }
          }, SHOWDOWN_DELAY_MS);
        }
        return;
      }

      if (room.engine.stage === 'results') {
        // immediate results (fold/winner declared path)
        this.broadcastRoom(room);
        this.io?.to(room.id).emit('poker/result', { message: 'Hand finished (fold/winner declared)' });
        return;
      }

      // otherwise nothing special (we already broadcast above)
    } catch (err) {
      const message = (err as Error).message ?? 'Action failed';
      console.error('Action error:', message);
      socket.emit('poker/error', { message });
      // after error, broadcast to keep clients consistent
      this.broadcastRoom(room);
    }
  }

  handleDisconnect(socket: Socket) {
    for (const room of this.rooms.values()) {
      for (const [pid, sock] of room.sockets.entries()) {
        if (sock.id === socket.id) {
          room.sockets.delete(pid);
          console.log(`poker: socket ${socket.id} disconnected for pid=${pid} (room=${room.id})`);
          // keep seat.pid so player can reconnect by pid
          this.broadcastRoom(room);
          return;
        }
      }
    }
  }

  /* --------------------- PUBLIC / PRIVATE BUILDERS --------------------- */

  // Build public state (hide hole cards unless showdown/results)
  buildPublicState(engine: PokerEngine) {
    const showCardsNow = engine.stage === 'showdown' || engine.stage === 'results';

    const seats = engine.seats.map((s: any) => {
      const publicCards = showCardsNow && !s.folded
        ? (s.cards || []).map((c: any) => ({ name: c.code, image: `/assets/cards/${this.serverCodeToImageName(c.code)}` }))
        : [];

      const publicComboLabel = (showCardsNow && !s.folded) ? this.computeComboLabelForSeat(engine, s) : undefined;

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
        comboLabel: publicComboLabel,
      };
    });

    const board = (engine.board || []).map((c: any) => ({ name: c.code, image: `/assets/cards/${this.serverCodeToImageName(c.code)}` }));

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
    const seat = engine.seats.find((s: any) => s.pid === pid);
    if (!seat) {
      try { socket.emit('poker/privateState', { yourCards: [], comboLabel: '—' }); } catch (e) {}
      return;
    }
    const yourCards = (seat.cards || []).map((c: any) => ({ name: c.code, image: `/assets/cards/${this.serverCodeToImageName(c.code)}` }));
    const comboLabel = this.computeComboLabelForSeat(engine, seat);
    try {
      socket.emit('poker/privateState', { yourCards, comboLabel });
      console.log(`poker: emitted privateState to pid=${pid} yourCards=[${yourCards.map(x => x.name).join(',')}] combo=${comboLabel}`);
    } catch (e) {
      console.warn('emit privateState failed', e);
    }
  }

  // Emit private states to all seated sockets
  emitPrivateStateToAll(room: Room) {
    for (const [pid, sock] of room.sockets.entries()) {
      const seat = room.engine.seats.find((s: any) => s.pid === pid);
      if (seat) {
        const yourCards = (seat.cards || []).map((c: any) => ({ name: c.code, image: `/assets/cards/${this.serverCodeToImageName(c.code)}` }));
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

  // Compute readable combo label for a seat given current board.
  private computeComboLabelForSeat(engine: PokerEngine, seat: Seat): string {
    if (!seat || !seat.pid) return '—';
    if (seat.folded) return 'Пас';

    const hole = (seat.cards || []) as any[];
    const board = (engine.board || []) as any[];

    if (board.length < 3) {
      if (hole.length < 2) return '—';
      const v1 = hole[0].code?.[0];
      const v2 = hole[1].code?.[0];
      if (v1 && v2 && v1 === v2) return 'Пара';
      return 'Старшая карта';
    }

    try {
      const codes: string[] = [
        ...hole.map((c: any) => this.normalizeCode(c.code)).filter(Boolean) as string[],
        ...board.map((c: any) => this.normalizeCode(c.code)).filter(Boolean) as string[],
      ];
      if (!Hand || codes.length < 5) return '—';
      const solved = Hand.solve(codes);
      const name: string | undefined = solved?.name;
      return (name && (this.rusName(name) ?? name)) || '—';
    } catch (err) {
      console.warn('computeComboLabel failed', err);
      return '—';
    }
  }

  private normalizeCode(code?: string): string | null {
    if (!code || code.length < 2) return null;
    const v = code[0];
    const s = code[1];
    return (v === 'T' ? '10' : v) + s;
  }

  private rusName(name: string) {
    const map: Record<string,string> = {
      'Royal Flush':'Роял-флеш','Straight Flush':'Стрит-флеш','Four of a Kind':'Каре','Full House':'Фул-хаус',
      'Flush':'Флеш','Straight':'Стрит','Three of a Kind':'Сет','Two Pair':'Две пары','Pair':'Пара','High Card':'Старшая карта'
    };
    return map[name];
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

    // Robustness: schedule showdown when appropriate (extra safety)
    try {
      const SHOWDOWN_DELAY_MS = 1600; // should be >= client board flip total duration
      // If engine already in showdown and not scheduled -> schedule distribution
      if (room.engine.stage === 'showdown' && !room.showdownTimer) {
        room.showdownTimer = setTimeout(() => {
          try {
            const distribution = room.engine.showdownAndDistribute();
            this.broadcastRoom(room);
            this.io?.to(room.id).emit('poker/result', { payouts: distribution.payouts, winnersDetail: distribution.winnersDetail });
            this.emitPrivateStateToAll(room);
            room.showdownTimer = null;
          } catch (err) {
            console.error('Scheduled showdown (from broadcast) failed', err);
            room.showdownTimer = null;
          }
        }, SHOWDOWN_DELAY_MS);
        return;
      }

      // Extra condition: if on river round and there are no actionable players or bets are equal/all-in,
      // schedule a showdown — this handles edge cases where acted flags or turn pointer may be in ambiguous state.
      if (room.engine.stage === 'river' && !room.showdownTimer) {
        const engine = room.engine;
        const active = engine.seats.filter(s => s.pid !== null && !s.folded);
        if (active.length > 0) {
          const maxBet = engine.maxCurrentBet();
          const betsEqualOrAllIn = active.every(s => (s.bet === maxBet) || s.isAllIn);
          const anyCanAct = active.some(s => !s.isAllIn);
          // if everyone's bets are matched (or everyone is all-in) and there is no one able to act — schedule showdown
          if (betsEqualOrAllIn && (!anyCanAct || engine.currentToActIdx === null)) {
            room.showdownTimer = setTimeout(() => {
              try {
                const distribution = engine.showdownAndDistribute();
                this.broadcastRoom(room);
                this.io?.to(room.id).emit('poker/result', { payouts: distribution.payouts, winnersDetail: distribution.winnersDetail });
                this.emitPrivateStateToAll(room);
                room.showdownTimer = null;
              } catch (err) {
                console.error('Scheduled showdown (river auto) failed', err);
                room.showdownTimer = null;
              }
            }, SHOWDOWN_DELAY_MS);
          }
        }
      }
    } catch (err) {
      console.warn('broadcastRoom scheduling error', err);
    }
  }
}
