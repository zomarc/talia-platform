import { useCallback, useEffect, useRef } from 'react';
import { isGamePanelExecutionActive } from './gamePanelExecution';

/**
 * When the panel execution gate closes (inactive tab or P-pause), stops the loop
 * and shows the shared pause overlay. When it opens again, runs the resume countdown
 * then calls resumePlaying() to restart RAF.
 */
const useGamePanelPauseResume = ({
  isPanelActive,
  isPanelPaused,
  gameState,
  playingGameState = 'playing',
  modelRef,
  rafRef,
  setOverlay,
  setStatusMessage,
  resumePlaying,
}) => {
  const isExecutionActive = isGamePanelExecutionActive(isPanelActive, isPanelPaused);
  const pausedByGateRef = useRef(false);
  const resumeIntervalRef = useRef(0);

  const gameStateRef = useRef(gameState);
  const execActiveRef = useRef(isExecutionActive);
  gameStateRef.current = gameState;
  execActiveRef.current = isExecutionActive;

  const resumePlayingRef = useRef(resumePlaying);
  resumePlayingRef.current = resumePlaying;

  const clearResumeInterval = useCallback(() => {
    if (resumeIntervalRef.current) {
      window.clearInterval(resumeIntervalRef.current);
      resumeIntervalRef.current = 0;
    }
  }, []);

  useEffect(() => {
    if (!isExecutionActive) {
      clearResumeInterval();
      if (gameState !== playingGameState) return;

      if (modelRef.current.running) {
        pausedByGateRef.current = true;
        modelRef.current.running = false;
        if (rafRef.current) {
          window.cancelAnimationFrame(rafRef.current);
          rafRef.current = 0;
        }
      }

      setOverlay({
        title: 'Paused',
        subtitle: isPanelActive ? 'P · CLICK' : 'SWITCH TAB',
      });
      setStatusMessage(
        isPanelActive ? 'Paused. Press P or click to resume.' : 'Paused. Switch to this tab to continue.'
      );
      return;
    }

    if (!pausedByGateRef.current) return;
    pausedByGateRef.current = false;
    if (gameState !== playingGameState) return;
    if (modelRef.current.running) return;

    let count = 5;
    setOverlay({ title: 'Resuming', subtitle: `${count}` });
    setStatusMessage(`Resuming in ${count}...`);
    clearResumeInterval();
    resumeIntervalRef.current = window.setInterval(() => {
      count -= 1;
      if (count <= 0) {
        clearResumeInterval();
        if (gameStateRef.current !== playingGameState || !execActiveRef.current) return;
        resumePlayingRef.current();
        return;
      }
      setOverlay((prev) => (prev?.title === 'Resuming' ? { title: 'Resuming', subtitle: `${count}` } : prev));
      setStatusMessage(`Resuming in ${count}...`);
    }, 1000);
  }, [
    clearResumeInterval,
    gameState,
    isPanelActive,
    isExecutionActive,
    modelRef,
    playingGameState,
    rafRef,
    setOverlay,
    setStatusMessage,
  ]);

  return {
    isPanelExecutionActive: isExecutionActive,
    clearResumeInterval,
  };
};

export default useGamePanelPauseResume;
