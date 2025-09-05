// src/components/Poker/ChipStack.tsx
import React from 'react';
import '../Poker/poker-components.css';

interface ChipStackProps {
  chips: number;
  compact?: boolean;
}

const ChipStack: React.FC<ChipStackProps> = ({ chips, compact = false }) => {
  return (
    <div className={`pc-chips ${compact ? 'compact' : ''}`} aria-hidden>
      <img src="/assets/poker_chips.png" alt="chips" className="pc-chips-icon" onError={(e)=>{ (e.currentTarget as HTMLImageElement).src='/assets/poker_chips.png'; }} />
      <div className="pc-chips-amount">{chips.toLocaleString('ru-RU')}</div>
    </div>
  );
};

export default ChipStack;
