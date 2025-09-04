// backend/poker/evaluatorAdapter.ts
/**
 * Adapter around pokersolver to evaluate Texas Hold'em hands.
 *
 * Signature:
 *   evaluateHands(holeHands: string[][], board?: string[])
 *
 * Returns:
 *   {
 *     winners: number[]             // indices of winners (can be multiple)
 *     results: { index, name, rank, handString }[]
 *     // also returns winnerIndices & evaluations for backward compatibility
 *   }
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

let Hand: any = null;
try {
  const pkg = require('pokersolver');
  // pokersolver exports Hand as property in CJS
  Hand = pkg && (pkg.Hand ?? pkg);
  if (!Hand) {
    console.warn('pokersolver loaded but Hand not found — adapter will fallback to simplified evaluator.');
  }
} catch (e) {
  console.warn('pokersolver not available — falling back to simple evaluator. Error:', (e as Error).message);
  Hand = null;
}

export type EvaluateResult = {
  winners: number[]; // preferred by pokerEngine
  results: {
    index: number;
    name: string | null;
    rank: number | null;
    handString: string | null;
  }[];
  // backward-compatible fields
  winnerIndices?: number[];
  evaluations?: {
    index: number;
    name: string | null;
    rank: number | null;
    handString: string | null;
  }[];
};

function normalizeCode(c: any): string {
  if (!c || typeof c !== 'string') return '';
  // ensure uppercase value letter and lowercase suit (pokersolver accepts 'As','Td' etc)
  const v = c[0].toUpperCase();
  const s = c[1] ? c[1].toLowerCase() : '';
  return `${v}${s}`;
}

export function evaluateHands(holeHands: string[][], board: string[] = []): EvaluateResult {
  const normalizedHoles = (holeHands || []).map(h => Array.isArray(h) ? h.map(normalizeCode) : []);
  const normalizedBoard = Array.isArray(board) ? board.map(normalizeCode) : [];

  if (Hand) {
    try {
      // Build Hand objects for each player by combining hole + board
      const solved = normalizedHoles.map(h => {
        const allCards = [...h, ...normalizedBoard].filter(Boolean);
        return Hand.solve(allCards);
      });

      // determine winners (may be multiple)
      const winners = Hand.winners(solved);
      const winnerIndices: number[] = winners
        .map((w: any) => solved.findIndex((s: any) => s === w))
        .filter((i: number) => i >= 0);
      const uniqueWinnerIndices = Array.from(new Set(winnerIndices)).sort((a, b) => a - b);

      const evaluations = solved.map((s: any, idx: number) => {
        // s.name may be string like "Two Pair", s.toString() often gives "Two Pair: A A K K ..." etc
        const name = s ? (s.name ?? ((s.describe && typeof s.describe === 'function') ? s.describe() : null)) : null;
        const rank = s ? (s.rank ?? null) : null;
        const handString = s ? (typeof s.toString === 'function' ? s.toString() : null) : null;
        return { index: idx, name, rank, handString };
      });

      return {
        winners: uniqueWinnerIndices,
        results: evaluations,
        winnerIndices: uniqueWinnerIndices,
        evaluations,
      };
    } catch (err) {
      console.warn('pokersolver evaluation error, falling back to simple evaluator:', (err as Error).message);
      // fallthrough to fallback evaluator
    }
  }

  // --- Fallback: compare by sorted highest card values (very simplified) ---
  const rankOrder: Record<string, number> = {
    '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, 'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
  };

  const handScores = normalizedHoles.map(h => {
    const vals = h.map(c => {
      if (!c || typeof c !== 'string') return 0;
      const v = c[0].toUpperCase();
      return rankOrder[v] ?? 0;
    }).sort((a, b) => b - a);
    return vals.join(',');
  });

  let best = '';
  let winnersIdx: number[] = [];
  handScores.forEach((s, i) => {
    if (s > best) { best = s; winnersIdx = [i]; }
    else if (s === best) { winnersIdx.push(i); }
  });

  const fallbackResults = normalizedHoles.map((h, idx) => ({
    index: idx,
    name: null,
    rank: null,
    handString: h.join(','),
  }));

  return {
    winners: winnersIdx,
    results: fallbackResults,
    winnerIndices: winnersIdx,
    evaluations: fallbackResults,
  };
}
