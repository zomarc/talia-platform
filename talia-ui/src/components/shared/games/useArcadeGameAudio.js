import { useCallback, useRef } from 'react';

const DEFAULT_MASTER = 0.024;

/**
 * Shared Web Audio “beep” for arcade panels. Call {@link unlock} from user gestures.
 */
export function useArcadeGameAudio(gameSoundEnabled, masterGain = DEFAULT_MASTER) {
  const audioContextRef = useRef(null);
  const audioMasterGainRef = useRef(null);
  const lastSoundAtRef = useRef(0);

  const ensureAudioContext = useCallback(() => {
    if (audioContextRef.current) return audioContextRef.current;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    const context = new Ctor();
    const gain = context.createGain();
    gain.gain.value = masterGain;
    gain.connect(context.destination);
    audioContextRef.current = context;
    audioMasterGainRef.current = gain;
    return context;
  }, [masterGain]);

  const unlockAudio = useCallback(() => {
    if (gameSoundEnabled === false) return;
    const context = ensureAudioContext();
    if (context?.state === 'suspended') {
      context.resume().catch(() => {});
    }
  }, [ensureAudioContext, gameSoundEnabled]);

  /**
   * @param {number} [frequency]
   * @param {number} [durationMs]
   * @param {number} [minIntervalMs] throttle
   */
  const playBeep = useCallback((frequency = 520, durationMs = 22, minIntervalMs = 14) => {
    if (gameSoundEnabled === false) return;
    const now = performance.now();
    if (now - lastSoundAtRef.current < minIntervalMs) return;
    lastSoundAtRef.current = now;
    const context = ensureAudioContext();
    const master = audioMasterGainRef.current;
    if (!context || !master) return;
    if (context.state === 'suspended') {
      context.resume().catch(() => {});
    }
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    gain.gain.value = 0;
    oscillator.connect(gain);
    gain.connect(master);
    const start = context.currentTime;
    const end = start + durationMs / 1000;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.45, start + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    oscillator.start(start);
    oscillator.stop(end);
  }, [ensureAudioContext, gameSoundEnabled]);

  const playTone = useCallback((frequency = 420, durationMs = 30, type = 'square', volume = 0.32, minIntervalMs = 10) => {
    if (gameSoundEnabled === false) return;
    const now = performance.now();
    if (now - lastSoundAtRef.current < minIntervalMs) return;
    lastSoundAtRef.current = now;
    const context = ensureAudioContext();
    const master = audioMasterGainRef.current;
    if (!context || !master) return;
    if (context.state === 'suspended') {
      context.resume().catch(() => {});
    }
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    gain.gain.value = 0.0001;
    osc.connect(gain);
    gain.connect(master);
    const start = context.currentTime;
    const end = start + durationMs / 1000;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    osc.start(start);
    osc.stop(end);
  }, [ensureAudioContext, gameSoundEnabled]);

  const disposeAudio = useCallback(() => {
    try {
      audioContextRef.current?.close?.();
    } catch {
      // no-op
    }
    audioContextRef.current = null;
    audioMasterGainRef.current = null;
  }, []);

  return {
    ensureAudioContext,
    audioMasterGainRef,
    unlockAudio,
    playBeep,
    playTone,
    disposeAudio,
  };
}

export default useArcadeGameAudio;
