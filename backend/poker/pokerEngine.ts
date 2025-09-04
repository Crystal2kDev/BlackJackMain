// backend/Poker/pokerEngine.ts
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

  // helper: find next occupied seat index after start (exclude seats with pid === null)
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

  private activeSeatIndexes(): number[] {
    return this.seats.map((s, i) => ({ s, i })).filter(({ s }) => s.pid !== null && !s.folded).map(({ i }) => i);
  }

  maxCurrentBet(): number {
    return Math.max(0, ...this.seats.map(s => s.bet ?? 0));
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
    });

    // mark dealer
    if (this.buttonIdx !== null) {
      const b = this.buttonIdx;
      if (this.seats[b] && this.seats[b].pid) this.seats[b].isDealer = true;
    }

    // find small blind and big blind indices (next occupied after button)
    const sbIdx = this.nextOccupiedIndex(this.buttonIdx, true);
    const bbIdx = sbIdx !== null ? this.nextOccupiedIndex(sbIdx, true) : null;

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

    // set currentToActIdx to first active (not folded) after big blind
    const afterBB = this.nextOccupiedIndex(bbIdx, false);
    this.currentToActIdx = afterBB;
  }

  // Try to advance stage when betting round is settled
  private tryAdvanceStageIfBetEqualized() {
    const active = this.seats.filter(s => s.pid !== null && !s.folded);
    if (active.length === 0) return;

    const maxBet = this.maxCurrentBet();
    const allMatched = active.every(s => (s.bet === maxBet) || s.isAllIn);

    if (!allMatched) return;

    // move bets into pot (simple model; side pots not fully handled here)
    const totalBets = this.seats.reduce((acc, s) => acc + (s.bet ?? 0), 0);
    if (totalBets > 0) {
      this.pot += totalBets;
      this.seats.forEach(s => { s.bet = 0; });
    }

    // Advance stage
    if (this.stage === 'preflop') {
      // flop: burn one, then three (we simulate just pop 3)
      // (we don't model burn cards here)
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
    } else {
      // nothing or already showdown
    }

    // after stage advance, set currentToActIdx to first active after button
    if (this.buttonIdx !== null) {
      const start = this.nextOccupiedIndex(this.buttonIdx, false);
      this.currentToActIdx = start;
    } else {
      this.currentToActIdx = this.nextOccupiedIndex(null, false);
    }
  }

  // Apply an action from seat index (fold/call/check/raise/allin)
  applyAction(seatIdx: number, action: { type: 'fold'|'call'|'check'|'raise'|'allin'; amount?: number }) {
    const seat = this.seats[seatIdx];
    if (!seat || seat.pid === null) throw new Error('Invalid seat');

    if (action.type === 'fold') {
      seat.folded = true;
      // If folded, clear any current bet (we keep committed)
      seat.bet = 0;
    } else if (action.type === 'call') {
      const maxBet = this.maxCurrentBet();
      const need = Math.max(0, maxBet - seat.bet);
      const pay = Math.min(need, seat.chips);
      seat.chips -= pay;
      seat.bet += pay;
      seat.committed += pay;
      if (seat.chips === 0) seat.isAllIn = true;
    } else if (action.type === 'check') {
      const maxBet = this.maxCurrentBet();
      if (seat.bet < maxBet) throw new Error('Cannot check when behind');
      // nothing to do
    } else if (action.type === 'raise') {
      const raiseAmt = Math.max(action.amount ?? this.minRaise, this.minRaise);
      const maxBet = this.maxCurrentBet();
      const needToCall = Math.max(0, maxBet - seat.bet);
      const totalPut = needToCall + raiseAmt;
      const actual = Math.min(totalPut, seat.chips);
      seat.chips -= actual;
      seat.bet += actual;
      seat.committed += actual;
      if (seat.chips === 0) seat.isAllIn = true;
      // update minRaise
      this.minRaise = Math.max(this.minRaise, raiseAmt);
    } else if (action.type === 'allin') {
      const all = seat.chips;
      seat.bet += all;
      seat.committed += all;
      seat.chips = 0;
      seat.isAllIn = true;
    } else {
      throw new Error('Unknown action');
    }

    // Find next to act
    const next = this.nextOccupiedIndex(seatIdx, false);
    this.currentToActIdx = next;

    // If only one player remains (others folded) -> showdown/results early
    const activeRemaining = this.seats.filter(s => s.pid !== null && !s.folded);
    if (activeRemaining.length <= 1) {
      this.stage = 'showdown';
      this.currentToActIdx = null;
      return;
    }

    // attempt stage advance if everyone matched bets
    this.tryAdvanceStageIfBetEqualized();
  }

  // Very simple showdown placeholder — returns payouts & winnersDetail
  // Replace with real evaluator for production (pokersolver/evaluatorAdapter).
  showdownAndDistribute() {
    // Collect active (not folded) seats
    const contenders = this.seats.filter(s => s.pid !== null && !s.folded);
    if (contenders.length === 0) {
      return { payouts: [], winnersDetail: [] };
    }

    // For now, pick the contender with highest first card code (placeholder deterministic)
    // NOTE: this is only placeholder logic — replace with evaluator for correct poker rules.
    const scoreOf = (seat: Seat) => {
      if (!seat.cards || seat.cards.length === 0) return -1;
      // simple scoring: map value rank
      const order = '23456789TJQKA';
      const v = seat.cards[0].code[0];
      return order.indexOf(v);
    };

    let best = contenders[0];
    let bestScore = scoreOf(best);
    for (const s of contenders) {
      const sc = scoreOf(s);
      if (sc > bestScore) {
        best = s;
        bestScore = sc;
      }
    }

    // Award entire pot to winner (no side-pot handling here)
    best.chips += this.pot;
    const payouts = [{ pid: best.pid, amount: this.pot }];
    const winnersDetail = [{ pid: best.pid, reason: 'placeholder-winner' }];

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
    });

    return { payouts, winnersDetail };
  }
}
