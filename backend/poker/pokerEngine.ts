// backend/Poker/pokerEngine.ts
import { evaluateHands } from './evaluatorAdapter.ts';

export type CardCode = string; // e.g. "As", "Td", "9h"

export type Seat = {
  pid: string | null;
  name?: string | null;
  chips: number;
  bet: number;           // current bet in this betting round
  committed: number;     // total committed so far this hand (for pot calculation / sidepots)
  cards: { code: CardCode }[]; // hole cards, each { code: 'As' } etc.
  folded: boolean;
  isAllIn: boolean;
  isDealer?: boolean;
  acted?: boolean; // track whether player already acted this betting round
};

export type PokerStage = 'waiting' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown' | 'results';

export class PokerEngine {
  seats: Seat[];
  board: { code: CardCode }[];
  pot: number;
  sidePots: { amount: number; eligiblePids: string[] }[];
  minRaise: number;
  smallBlind: number;
  bigBlind: number;
  stage: PokerStage;
  buttonIdx: number | null;
  currentToActIdx: number | null;
  deck: CardCode[];

  constructor(initialSeats?: Partial<Seat>[]) {
    const N = initialSeats?.length ?? 6;
    this.seats = Array.from({ length: N }).map((_, i) => {
      const p = initialSeats?.[i] ?? {};
      return {
        pid: p.pid ?? null,
        name: p.name ?? null,
        chips: p.chips ?? 1000,
        bet: p.bet ?? 0,
        committed: p.committed ?? 0,
        cards: p.cards ? (p.cards as { code: CardCode }[]) : [],
        folded: p.folded ?? false,
        isAllIn: p.isAllIn ?? false,
        isDealer: p.isDealer ?? false,
        acted: false,
      } as Seat;
    });

    this.board = [];
    this.pot = 0;
    this.sidePots = [];
    this.minRaise = 100;
    this.smallBlind = 50;
    this.bigBlind = 100;
    this.stage = 'waiting';
    this.buttonIdx = null;
    this.currentToActIdx = null;
    this.deck = [];
  }

  // Build standard 52-card deck (T for Ten)
  buildDeck(): CardCode[] {
    const values = ['2','3','4','5','6','7','8','9','T','J','Q','K','A'];
    const suits = ['s','h','d','c']; // spades hearts diamonds clubs
    const deck: CardCode[] = [];
    for (const v of values) {
      for (const s of suits) {
        deck.push(v + s);
      }
    }
    return deck;
  }

  shuffleDeck() {
    this.deck = this.buildDeck();
    for (let i = this.deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
    }
  }

  // helper: find next occupied seat index after start (includeFolded = true to include folded seats)
  private nextOccupiedIndex(startIdx: number | null, includeFolded = true): number | null {
    const n = this.seats.length;
    if (n === 0) return null;
    let s = startIdx === null ? -1 : startIdx;
    for (let i = 1; i <= n; i++) {
      const idx = (s + i) % n;
      const seat = this.seats[idx];
      if (seat && seat.pid !== null) {
        if (includeFolded) return idx;
        if (!seat.folded) return idx;
      }
    }
    return null;
  }

  // next to act index (skips folded, null pid and all-in players)
  private nextToActIndex(startIdx: number | null): number | null {
    const n = this.seats.length;
    if (n === 0) return null;
    let s = startIdx === null ? -1 : startIdx;
    for (let i = 1; i <= n; i++) {
      const idx = (s + i) % n;
      const seat = this.seats[idx];
      if (!seat) continue;
      if (seat.pid === null) continue;
      if (seat.folded) continue;
      if (seat.isAllIn) continue;
      return idx;
    }
    return null;
  }

  private activeSeatIndexes(): number[] {
    return this.seats.map((s, i) => ({ s, i })).filter(({ s }) => s.pid !== null && !s.folded).map(({ i }) => i);
  }

  maxCurrentBet(): number {
    return Math.max(0, ...this.seats.map(s => s.bet ?? 0));
  }

  // Helper to reset acted flags (call at new betting round start)
  private resetActedFlags() {
    this.seats.forEach(s => { s.acted = false; });
  }

  // Start a new hand; rotates button index externally before calling if desired
  startHand(buttonIdx: number) {
    // Reset deck/board/bets/pot
    this.shuffleDeck();
    this.board = [];
    this.pot = 0;
    this.sidePots = [];
    this.stage = 'preflop';
    this.buttonIdx = buttonIdx % this.seats.length;

    // Reset seat flags and bets
    this.seats.forEach(s => {
      s.bet = 0;
      s.committed = 0;
      s.cards = [];
      s.folded = false;
      s.isAllIn = false;
      s.isDealer = false;
      s.acted = false;
    });

    // mark dealer (button)
    if (this.buttonIdx !== null) {
      const b = this.buttonIdx;
      if (this.seats[b] && this.seats[b].pid) this.seats[b].isDealer = true;
    }

    // find small blind and big blind indices (next occupied after button)
    const sbIdx = this.nextOccupiedIndex(this.buttonIdx, false);
    const bbIdx = sbIdx !== null ? this.nextOccupiedIndex(sbIdx, false) : null;

    if (sbIdx === null || bbIdx === null) {
      // not enough players to start properly
      this.currentToActIdx = null;
      return;
    }

    // post blinds (if player has insufficient chips, they go all-in)
    const postBlind = (seat: Seat, amount: number) => {
      const actual = Math.min(seat.chips, amount);
      seat.chips -= actual;
      seat.bet += actual;
      seat.committed += actual;
      if (seat.chips === 0) seat.isAllIn = true;
      this.pot += actual;
    };

    postBlind(this.seats[sbIdx], this.smallBlind);
    postBlind(this.seats[bbIdx], this.bigBlind);

    // set minRaise to bigBlind as baseline
    this.minRaise = this.bigBlind;

    // deal hole cards: deal one card per seat (occupied) in order, twice
    // dealing order typical: next after button -> clockwise
    for (let round = 0; round < 2; round++) {
      for (let offset = 1; offset <= this.seats.length; offset++) {
        const idx = ((this.buttonIdx ?? -1) + offset) % this.seats.length;
        const s = this.seats[idx];
        if (s && s.pid !== null) {
          const c = this.deck.pop();
          if (c) s.cards.push({ code: c });
        }
      }
    }

    // start a new betting round: clear acted flags
    this.resetActedFlags();

    // set currentToActIdx to first active (not folded, not all-in) after big blind
    this.currentToActIdx = this.nextToActIndex(bbIdx);
  }

  // Try to advance stage when betting round is settled
  // Returns true if stage changed to showdown (so server may schedule showdown distribution)
  private tryAdvanceStageIfBetEqualized(): boolean {
    const active = this.seats.filter(s => s.pid !== null && !s.folded);
    if (active.length === 0) return false;

    const prevStage = this.stage;

    const maxBet = this.maxCurrentBet();
    const allBetsEqualOrAllIn = active.every(s => (s.bet === maxBet) || s.isAllIn);

    // require that everyone either acted this round (or is all-in) — prevents premature advancement after first check
    const everyoneActedOrAllIn = active.every(s => s.isAllIn || (s.acted === true));

    if (!(allBetsEqualOrAllIn && everyoneActedOrAllIn)) return false;

    // move bets into pot (simple model; side pots not fully handled here)
    const totalBets = this.seats.reduce((acc, s) => acc + (s.bet ?? 0), 0);
    if (totalBets > 0) {
      this.pot += totalBets;
      this.seats.forEach(s => { s.bet = 0; });
    }

    // Advance stage
    if (this.stage === 'preflop') {
      // flop: draw three
      this.board.push({ code: this.deck.pop() as CardCode });
      this.board.push({ code: this.deck.pop() as CardCode });
      this.board.push({ code: this.deck.pop() as CardCode });
      this.stage = 'flop';
    } else if (this.stage === 'flop') {
      this.board.push({ code: this.deck.pop() as CardCode });
      this.stage = 'turn';
    } else if (this.stage === 'turn') {
      this.board.push({ code: this.deck.pop() as CardCode });
      this.stage = 'river';
    } else if (this.stage === 'river') {
      this.stage = 'showdown';
      this.currentToActIdx = null;
      // reset acted? not necessary for showdown
      return prevStage !== this.stage && this.stage === 'showdown';
    } else {
      // nothing or already showdown
    }

    // after stage advance, reset acted flags for new betting round
    this.resetActedFlags();

    // after stage advance, set currentToActIdx to first active after button (skip all-in/fold)
    if (this.buttonIdx !== null) {
      this.currentToActIdx = this.nextToActIndex(this.buttonIdx);
    } else {
      this.currentToActIdx = this.nextToActIndex(null);
    }

    return prevStage !== this.stage && this.stage === 'showdown';
  }

  /**
   * Apply an action from seat index (fold/call/check/raise/allin)
   * Returns object { stageChangedToShowdown: boolean } so caller (RoomManager) can schedule distribution
   */
  applyAction(seatIdx: number, action: { type: 'fold'|'call'|'check'|'raise'|'allin'; amount?: number }): { stageChangedToShowdown: boolean } {
    const seat = this.seats[seatIdx];
    if (!seat || seat.pid === null) throw new Error('Invalid seat');

    // Basic stage validation
    if (this.stage === 'waiting' || this.stage === 'results') {
      throw new Error('Hand not active');
    }

    // Validate that it's this seat's turn
    if (this.currentToActIdx === null) {
      throw new Error('No active player to act');
    }
    if (seatIdx !== this.currentToActIdx) {
      throw new Error('Not your turn');
    }

    // Validate that seat is allowed to act
    if (seat.folded) throw new Error('Seat already folded');
    if (seat.isAllIn) throw new Error('Cannot act when all-in');

    // record previous maxBet to detect raises
    const prevMax = this.maxCurrentBet();
    const prevStage = this.stage;

    if (action.type === 'fold') {
      seat.folded = true;
      seat.bet = 0;
      seat.acted = true;
    } else if (action.type === 'call') {
      const need = Math.max(0, prevMax - seat.bet);
      const pay = Math.min(need, seat.chips);
      seat.chips -= pay;
      seat.bet += pay;
      seat.committed += pay;
      if (seat.chips === 0) seat.isAllIn = true;
      seat.acted = true;
    } else if (action.type === 'check') {
      const maxBet = prevMax;
      if (seat.bet < maxBet) throw new Error('Cannot check when behind');
      seat.acted = true;
    } else if (action.type === 'raise') {
      const raiseAmt = Math.max(Number(action.amount ?? this.minRaise), this.minRaise);
      if (!Number.isFinite(raiseAmt) || raiseAmt <= 0) throw new Error('Invalid raise amount');
      const maxBet = prevMax;
      const needToCall = Math.max(0, maxBet - seat.bet);
      const totalPut = needToCall + raiseAmt;
      if (totalPut <= 0) throw new Error('Invalid total put');
      const actual = Math.min(totalPut, seat.chips);
      seat.chips -= actual;
      seat.bet += actual;
      seat.committed += actual;
      if (seat.chips === 0) seat.isAllIn = true;
      // update minRaise
      this.minRaise = Math.max(this.minRaise, raiseAmt);
      seat.acted = true;
    } else if (action.type === 'allin') {
      const all = seat.chips;
      seat.bet += all;
      seat.committed += all;
      seat.chips = 0;
      seat.isAllIn = true;
      seat.acted = true;
    } else {
      throw new Error('Unknown action');
    }

    // detect if this action increased max bet (i.e., was an aggression/raise)
    const newMax = this.maxCurrentBet();
    const isAggression = newMax > prevMax;

    if (isAggression) {
      // when someone raises/increases max, all other active (non-folded, non-allin) players must be given another chance
      this.seats.forEach(s => {
        if (s.pid !== seat.pid && s.pid !== null && !s.folded && !s.isAllIn) {
          s.acted = false;
        }
      });
      // ensure raiser remains acted=true
      seat.acted = true;
    }

    // If only one player remains (others folded) -> showdown/results early
    const activeRemaining = this.seats.filter(s => s.pid !== null && !s.folded);
    if (activeRemaining.length <= 1) {
      this.stage = 'showdown';
      this.currentToActIdx = null;
      return { stageChangedToShowdown: prevStage !== this.stage && this.stage === 'showdown' };
    }

    // attempt stage advance if everyone matched bets and acted
    const advancedToShowdown = this.tryAdvanceStageIfBetEqualized();

    // If after stage advance it's showdown, clear currentToActIdx and return indicator
    if (advancedToShowdown || this.stage === 'showdown') {
      this.currentToActIdx = null;
      return { stageChangedToShowdown: prevStage !== this.stage && this.stage === 'showdown' };
    }

    // Otherwise compute next to act (skip folded and all-in) starting after current seat
    const next = this.nextToActIndex(seatIdx);
    this.currentToActIdx = next;

    return { stageChangedToShowdown: false };
  }

  // showdown using evaluatorAdapter and simple equal-split payouts (basic side-pot handling not fully implemented)
  showdownAndDistribute() {
    // Collect active (not folded) seats
    const contenders = this.seats
      .map((s, idx) => ({ s, idx }))
      .filter(({ s }) => s.pid !== null && !s.folded);

    if (contenders.length === 0) {
      this.stage = 'results';
      this.currentToActIdx = null;
      return { payouts: [], winnersDetail: [] };
    }

    // Build holeHands and board arrays (strings like "As", "Td")
    const holeHands: string[][] = contenders.map(({ s }) =>
      (s.cards || []).map(c => String(c.code))
    );
    const board: string[] = (this.board || []).map(c => String(c.code));

    let evalResult;
    try {
      evalResult = evaluateHands(holeHands, board);
    } catch (err) {
      console.warn('Evaluator error, falling back to simple selection', err);
      evalResult = null;
    }

    // Determine winner seat indices (relative to contenders array)
    let winnerIndicesRel: number[] = [];
    let resultsInfo: any[] = [];

    if (evalResult && Array.isArray(evalResult.winners) && evalResult.winners.length > 0) {
      winnerIndicesRel = evalResult.winners.slice();
      resultsInfo = evalResult.results ?? [];
    } else {
      // fallback: highest first hole card
      const order = '23456789TJQKA';
      let bestRel = 0;
      let bestScore = -1;
      contenders.forEach(({ s }, relIdx) => {
        const v = s.cards?.[0]?.code?.[0] ?? '';
        const sc = order.indexOf(v);
        if (sc > bestScore) {
          bestScore = sc;
          bestRel = relIdx;
        }
      });
      winnerIndicesRel = [bestRel];
      resultsInfo = contenders.map(({ s }, idx) => ({ index: idx, name: null, rank: null, handString: (s.cards || []).map(c => c.code).join(',') }));
    }

    // Map relative winner indices back to seat pids
    const winners = winnerIndicesRel.map(rel => {
      const seatEntry = contenders[rel];
      return seatEntry ? seatEntry.s.pid : null;
    }).filter(Boolean) as string[];

    // Simplified payout distribution: split pot equally between winners
    const payoutPerWinner = Math.floor(this.pot / Math.max(1, winners.length));
    const payouts: { pid: string | null; amount: number }[] = winners.map((pid) => ({ pid, amount: payoutPerWinner }));

    // distribute remainder to first winner if any
    const remainder = this.pot - payoutPerWinner * winners.length;
    if (remainder > 0 && payouts.length > 0) {
      payouts[0].amount += remainder;
    }

    // apply chips to winners (update seat objects)
    for (const p of payouts) {
      const seat = this.seats.find(s => s.pid === p.pid);
      if (seat) seat.chips += p.amount;
    }

    // Construct winnersDetail
    const winnersDetail = winners.map((pid, idx) => ({
      pid,
      reason: resultsInfo[idx]?.name ?? 'winner',
      index: idx,
    }));

    // Reset hand basic fields
    this.pot = 0;
    this.board = [];
    this.stage = 'results';
    this.currentToActIdx = null;
    // Clear bets/committed/folded etc for next hand (caller/room manager might also reset)
    this.seats.forEach(s => {
      s.bet = 0;
      s.committed = 0;
      s.cards = [];
      s.folded = false;
      s.isAllIn = false;
      s.acted = false;
    });

    return { payouts, winnersDetail };
  }
}
