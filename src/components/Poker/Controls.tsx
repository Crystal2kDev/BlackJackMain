// src/components/Poker/Controls.tsx
import React, { useEffect, useState } from 'react';

type Props = {
  onFold: () => void;
  onCall: () => void;
  onCheck: () => void;
  onRaise: (amount: number) => void;
  onAllIn: () => void;
  minRaise: number;
  canAct: boolean;
  stack: number;
  callAmount?: number;
  canCheck?: boolean;
  canCall?: boolean;
  canRaise?: boolean;
};

const Controls: React.FC<Props> = ({
  onFold, onCall, onCheck, onRaise, onAllIn,
  minRaise, canAct, stack,
  callAmount = 0, canCheck = false, canCall = false, canRaise = false
}) => {
  const [raiseValue, setRaiseValue] = useState<number>(Math.max(minRaise, (callAmount || 0) + (minRaise || 0)));

  useEffect(() => {
    // update suggested raise when minRaise or callAmount changes
    setRaiseValue(Math.max(minRaise, (callAmount || 0) + (minRaise || 0)));
  }, [minRaise, callAmount]);

  return (
    <div className="poker-controls-row" aria-hidden={!canAct} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <button className="btn" onClick={onFold} disabled={!canAct}>Fold</button>

      <button className="btn" onClick={onCall} disabled={!canAct || !canCall}>
        Call{callAmount > 0 ? ` ${callAmount}` : ''}
      </button>

      <button className="btn" onClick={onCheck} disabled={!canAct || !canCheck}>Check</button>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          type="number"
          min={Math.max(minRaise, callAmount)}
          value={raiseValue}
          onChange={(e) => setRaiseValue(Math.max(0, Number(e.target.value)))}
          style={{ width: 120, padding: '6px 8px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)', color: '#e6eef6' }}
          disabled={!canAct}
        />
        <button
          className="btn"
          onClick={() => onRaise(raiseValue)}
          disabled={!canAct || !canRaise || raiseValue < Math.max(minRaise, callAmount)}
        >
          Raise
        </button>
      </div>

      <button className="btn" onClick={onAllIn} disabled={!canAct || stack <= 0}>All-in</button>
    </div>
  );
};

export default Controls;
