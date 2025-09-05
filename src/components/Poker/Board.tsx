// src/components/Poker/Board.tsx
import React from 'react';
import { motion } from 'framer-motion';
import '../Poker/poker-components.css';

export type Card = { name: string; image: string };

interface BoardProps {
  board: Card[];
  pot: number;
  sidePots?: { amount: number }[];
  stage?: string;
}

const Board: React.FC<BoardProps> = ({ board, pot, sidePots, stage }) => {
  return (
    <div className="pc-board">
      <div className="pc-board-cards" aria-hidden>
        {Array.from({ length: 5 }).map((_, i) => {
          const c = board?.[i];
          return (
            <motion.img
              key={i}
              src={c?.image ?? '/assets/cards/cardRedBack.png'}
              alt={c?.name ?? `Board ${i}`}
              className={`pc-board-card ${c ? 'revealed' : 'hidden'}`}
              initial={{ y: -8, opacity: 0 }}
              animate={{ y: 0, opacity: c ? 1 : 0.18 }}
              transition={{ duration: 0.28, delay: i * 0.06 }}
              onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/assets/cards/cardRedBack.png'; }}
            />
          );
        })}
      </div>

      <div className="pc-board-info">
        <div className="pc-pot">Pot: <strong>{pot}</strong></div>
        {sidePots && sidePots.length > 0 && (
          <div className="pc-sidepots">{sidePots.map((s, idx) => <span key={idx}>Side {idx+1}: {s.amount}</span>)}</div>
        )}
        <div className="pc-stage">Stage: <span>{stage ?? '-'}</span></div>
      </div>
    </div>
  );
};

export default Board;
