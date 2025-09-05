// src/components/Poker/Controls.tsx
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import '../Poker/poker-components.css';

interface ControlsProps {
  onFold: () => void;
  onCall: () => void;
  onCheck: () => void;
  onRaise: (amount: number) => void;
  onAllIn: () => void;
  minRaise: number;
  canAct?: boolean;
  stack?: number;
}

const Controls: React.FC<ControlsProps> = ({ onFold, onCall, onCheck, onRaise, onAllIn, minRaise, canAct = true, stack = 1000 }) => {
  const [raiseValue, setRaiseValue] = useState<number>(minRaise || 100);

  const handleRaise = () => {
    const amount = Math.max(minRaise, Math.min(stack, Math.floor(raiseValue)));
    onRaise(amount);
  };

  return (
    <div className="pc-controls">
      <div className="pc-raise-row">
        <input
          type="number"
          min={minRaise}
          max={stack}
          value={raiseValue}
          onChange={(e) => setRaiseValue(Number(e.target.value))}
          className="pc-raise-input"
          aria-label="Raise amount"
        />
        <button className="pc-raise-btn" onClick={handleRaise} disabled={!canAct}>Raise</button>
      </div>

      <div className="pc-action-row">
        <motion.button className="pc-btn pc-btn-ghost" whileHover={{ scale: 1.03 }} onClick={onFold} disabled={!canAct}>Fold</motion.button>
        <motion.button className="pc-btn pc-btn-primary" whileHover={{ scale: 1.03 }} onClick={onCall} disabled={!canAct}>Call</motion.button>
        <motion.button className="pc-btn pc-btn-outline" whileHover={{ scale: 1.03 }} onClick={onCheck} disabled={!canAct}>Check</motion.button>
        <motion.button className="pc-btn pc-btn-danger" whileHover={{ scale: 1.03 }} onClick={onAllIn} disabled={!canAct}>All-in</motion.button>
      </div>
    </div>
  );
};

export default Controls;
