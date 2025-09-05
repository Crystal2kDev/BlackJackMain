// src/components/Poker/Seat.tsx
import React from 'react';
import { motion } from 'framer-motion';
import '../Poker/poker-components.css';

export type Card = { name: string; image: string };
export type SeatType = {
  pid: string | null;
  name?: string | null;
  chips: number;
  bet: number;
  cards: Card[];
  isActive?: boolean;
  isDealer?: boolean;
  isAllIn?: boolean;
  folded?: boolean;
};

interface SeatProps {
  seat: SeatType;
  isMe?: boolean;
  myCards?: Card[]; // private cards for local player
  showHole?: boolean; // reveal hole cards (server side)
  comboLabel?: string;
  onSit?: () => void;
}

const Seat: React.FC<SeatProps> = ({ seat, isMe, myCards, showHole, comboLabel, onSit }) => {
  const renderCards = () => {
    // my cards
    if (isMe) {
      return [
        <img key="c0" className="pc-seat-card" src={(myCards?.[0]?.image) ?? '/assets/cards/cardRedBack.png'} alt={myCards?.[0]?.name ?? 'card'} />,
        <img key="c1" className="pc-seat-card" src={(myCards?.[1]?.image) ?? '/assets/cards/cardRedBack.png'} alt={myCards?.[1]?.name ?? 'card'} />,
      ];
    }

    // folded -> nothing
    if (seat.folded) return null;

    // other players: show backs until reveal
    if (!showHole) {
      if (seat.pid) {
        return [
          <img key="b0" className="pc-seat-card" src="/assets/cards/cardRedBack.png" alt="back" />,
          <img key="b1" className="pc-seat-card" src="/assets/cards/cardRedBack.png" alt="back" />,
        ];
      }
      return null;
    }

    // show their cards (revealed)
    return (seat.cards || []).map((c, i) => (
      <img key={i} className="pc-seat-card" src={c.image} alt={c.name} onError={(e)=>{ (e.currentTarget as HTMLImageElement).src='/assets/cards/cardRedBack.png'; }} />
    ));
  };

  return (
    <div className={`pc-seat ${seat.folded ? 'folded' : ''} ${seat.isActive ? 'active' : ''} ${seat.isDealer ? 'dealer' : ''}`}>
      <div className="pc-seat-top">
        <div className="pc-seat-name">{seat.pid ? (isMe ? 'You' : (seat.name ?? 'Player')) : 'Empty'}</div>
        <div className="pc-seat-chips">{seat.chips.toLocaleString('ru-RU')}</div>
      </div>

      <div className="pc-seat-cards" aria-hidden>
        {renderCards() ?? <div className="pc-no-cards">—</div>}
      </div>

      <div className="pc-seat-bottom">
        <div className="pc-seat-bet">{seat.bet > 0 ? `Bet: ${seat.bet}` : null}</div>
        <div className="pc-seat-combo">{comboLabel ?? '—'}</div>
      </div>

      {!seat.pid && onSit && (
        <motion.button whileHover={{ y: -4 }} className="pc-sit-btn" onClick={onSit}>Сесть</motion.button>
      )}
    </div>
  );
};

export default Seat;
