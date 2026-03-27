import { useEffect, useState } from 'react';
import { getArcadeDoubleScoreSecondsLeft } from './arcadeDoubleScore';

/**
 * Whole seconds remaining for 2× score HUD tick (cheap interval while playing).
 */
export default function useArcadeDoubleScoreHud(modelRef, isPlaying) {
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (!isPlaying) {
      setSecondsLeft(0);
      return undefined;
    }
    const tick = () => {
      setSecondsLeft(getArcadeDoubleScoreSecondsLeft(modelRef.current));
    };
    tick();
    const id = window.setInterval(tick, 200);
    return () => window.clearInterval(id);
  }, [isPlaying, modelRef]);

  return secondsLeft;
}
