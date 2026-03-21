import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import GameScorePopover from '../../shared/games/GameScorePopover';
import usePanelTabActive from '../../../hooks/usePanelTabActive';
import { isEditableTarget } from '../../shared/games/keyboardGuards';

const CELL = 24;
const GRID_W = 21;
const GRID_H = 15;
const GAME_WIDTH = GRID_W * CELL;
const GAME_HEIGHT = GRID_H * CELL;
const DIRS = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
};

const wallAt = (x, y) => {
  if (x < 0 || y < 0 || x >= GRID_W || y >= GRID_H) return true;
  if (x === 0 || y === 0 || x === GRID_W - 1 || y === GRID_H - 1) return true;
  if (x % 4 === 0 && y > 2 && y < GRID_H - 3) return true;
  if (y % 4 === 0 && x > 2 && x < GRID_W - 3) return true;
  return false;
};

const createPellets = () => {
  const set = new Set();
  for (let y = 1; y < GRID_H - 1; y += 1) {
    for (let x = 1; x < GRID_W - 1; x += 1) {
      if (!wallAt(x, y)) {
        set.add(`${x},${y}`);
      }
    }
  }
  set.delete('1,1');
  return set;
};

const createModel = () => ({
  running: false,
  score: 0,
  lives: 3,
  level: 1,
  pellets: createPellets(),
  player: { x: 1, y: 1, dir: { x: 1, y: 0 }, nextDir: { x: 1, y: 0 } },
  ghosts: [
    { x: GRID_W - 2, y: GRID_H - 2, dir: { x: -1, y: 0 }, tint: 'rgba(255, 120, 120, 0.9)' },
    { x: GRID_W - 2, y: 1, dir: { x: 0, y: 1 }, tint: 'rgba(120, 190, 255, 0.9)' },
    { x: 1, y: GRID_H - 2, dir: { x: 0, y: -1 }, tint: 'rgba(255, 195, 110, 0.9)' },
  ],
  tick: 0,
  lastPlayerStepAt: 0,
  lastGhostStepAt: 0,
});

const dirs = Object.values(DIRS);
const canMove = (x, y, dir) => !wallAt(x + dir.x, y + dir.y);
const pickTurn = (x, y, currentDir) => {
  const valid = dirs.filter((d) => canMove(x, y, d));
  if (valid.length === 0) return currentDir;
  const opposite = { x: -currentDir.x, y: -currentDir.y };
  const nonReverse = valid.filter((d) => d.x !== opposite.x || d.y !== opposite.y);
  const pool = nonReverse.length > 0 ? nonReverse : valid;
  return pool[Math.floor(Math.random() * pool.length)];
};

const PacManPresenter = ({
  panelInstanceId,
  loading,
  loadError,
  saveError,
  saving,
  userId,
  highScore,
  lastScore,
  updatedAt,
  onReloadScore,
  onSaveScore,
  leaderboard,
  leaderboardLoading,
}) => {
  const isPanelActive = usePanelTabActive(panelInstanceId);
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const rafRef = useRef(0);
  const pausedByInactiveRef = useRef(false);
  const inactiveResumeIntervalRef = useRef(0);
  const modelRef = useRef(createModel());
  const audioContextRef = useRef(null);
  const audioMasterGainRef = useRef(null);
  const lastSoundAtRef = useRef(0);
  const [gameState, setGameState] = useState('idle');
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [statusMessage, setStatusMessage] = useState('Press Start to begin.');
  const [overlay, setOverlay] = useState(null);
  const [showScorePopover, setShowScorePopover] = useState(false);

  const userLabel = useMemo(() => String(userId || 'anonymous'), [userId]);
  const updatedLabel = useMemo(() => {
    if (!updatedAt) return 'Not saved yet';
    const date = new Date(updatedAt);
    return Number.isNaN(date.getTime()) ? 'Not saved yet' : date.toLocaleString();
  }, [updatedAt]);

  const syncUi = useCallback(() => {
    const m = modelRef.current;
    setScore(m.score);
    setLives(m.lives);
  }, []);

  const ensureAudioContext = useCallback(() => {
    if (audioContextRef.current) return audioContextRef.current;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    const context = new Ctor();
    const master = context.createGain();
    master.gain.value = 0.024;
    master.connect(context.destination);
    audioContextRef.current = context;
    audioMasterGainRef.current = master;
    return context;
  }, []);

  const playTone = useCallback((freq = 400, durationMs = 22, type = 'square', volume = 0.3) => {
    const now = performance.now();
    if (now - lastSoundAtRef.current < 14) return;
    lastSoundAtRef.current = now;
    const context = ensureAudioContext();
    const master = audioMasterGainRef.current;
    if (!context || !master) return;
    if (context.state === 'suspended') context.resume().catch(() => {});
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.value = freq;
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
  }, [ensureAudioContext]);

  const unlockAudio = useCallback(() => {
    const context = ensureAudioContext();
    if (context?.state === 'suspended') {
      context.resume().catch(() => {});
    }
  }, [ensureAudioContext]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const m = modelRef.current;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const scale = Math.min(canvas.width / GAME_WIDTH, canvas.height / GAME_HEIGHT);
    const offsetX = Math.round((canvas.width - GAME_WIDTH * scale) / 2);
    const offsetY = Math.round((canvas.height - GAME_HEIGHT * scale) / 2);
    ctx.save();
    ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
    ctx.fillStyle = 'rgba(9, 14, 34, 0.95)';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    for (let y = 0; y < GRID_H; y += 1) {
      for (let x = 0; x < GRID_W; x += 1) {
        if (!wallAt(x, y)) continue;
        ctx.fillStyle = 'rgba(84, 120, 255, 0.34)';
        ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
      }
    }

    m.pellets.forEach((key) => {
      const [x, y] = key.split(',').map(Number);
      const cx = x * CELL + CELL / 2;
      const cy = y * CELL + CELL / 2;
      ctx.fillStyle = 'rgba(246, 223, 152, 0.92)';
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.closePath();
    });

    const playerCx = m.player.x * CELL + CELL / 2;
    const playerCy = m.player.y * CELL + CELL / 2;
    const mouth = (m.tick % 20) < 10 ? 0.28 : 0.08;
    const heading = m.player.dir.x > 0 ? 0 : m.player.dir.x < 0 ? Math.PI : m.player.dir.y > 0 ? Math.PI / 2 : -Math.PI / 2;
    ctx.fillStyle = 'rgba(255, 222, 94, 0.98)';
    ctx.beginPath();
    ctx.moveTo(playerCx, playerCy);
    ctx.arc(playerCx, playerCy, CELL * 0.38, heading + mouth, heading + Math.PI * 2 - mouth);
    ctx.fill();
    ctx.closePath();

    m.ghosts.forEach((g) => {
      const gx = g.x * CELL + CELL / 2;
      const gy = g.y * CELL + CELL / 2;
      ctx.fillStyle = g.tint;
      ctx.beginPath();
      ctx.arc(gx, gy - 2, CELL * 0.33, Math.PI, Math.PI * 2);
      ctx.lineTo(gx + CELL * 0.33, gy + CELL * 0.26);
      ctx.lineTo(gx - CELL * 0.33, gy + CELL * 0.26);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(16, 16, 28, 0.9)';
      ctx.fillRect(gx - 7, gy - 4, 3, 4);
      ctx.fillRect(gx + 4, gy - 4, 3, 4);
    });

    ctx.restore();
  }, []);

  const stopGame = useCallback(() => {
    modelRef.current.running = false;
    if (rafRef.current) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
  }, []);

  const clearInactiveResumeCountdown = useCallback(() => {
    if (inactiveResumeIntervalRef.current) {
      window.clearInterval(inactiveResumeIntervalRef.current);
      inactiveResumeIntervalRef.current = 0;
    }
  }, []);

  const finishGame = useCallback(async (reason) => {
    stopGame();
    setGameState('over');
    const finalScore = modelRef.current.score;
    setOverlay({ title: 'Game Over', subtitle: `Final score: ${finalScore}` });
    setStatusMessage(`Game over: ${reason}`);
    playTone(350, 80, 'triangle', 0.4);
    setTimeout(() => playTone(260, 110, 'triangle', 0.4), 90);
    await onSaveScore(finalScore);
  }, [onSaveScore, playTone, stopGame]);

  const resetPositions = useCallback(() => {
    const m = modelRef.current;
    m.player.x = 1;
    m.player.y = 1;
    m.player.dir = { x: 1, y: 0 };
    m.player.nextDir = { x: 1, y: 0 };
    m.ghosts[0].x = GRID_W - 2; m.ghosts[0].y = GRID_H - 2; m.ghosts[0].dir = { x: -1, y: 0 };
    m.ghosts[1].x = GRID_W - 2; m.ghosts[1].y = 1; m.ghosts[1].dir = { x: 0, y: 1 };
    m.ghosts[2].x = 1; m.ghosts[2].y = GRID_H - 2; m.ghosts[2].dir = { x: 0, y: -1 };
  }, []);

  const updateModel = useCallback(async () => {
    const m = modelRef.current;
    if (!m.running) return;
    const now = performance.now();
    const playerStepMs = Math.max(82, 120 - m.level * 7);
    const ghostStepMs = Math.max(92, 138 - m.level * 5);

    if (now - m.lastPlayerStepAt >= playerStepMs) {
      m.lastPlayerStepAt = now;
      if (canMove(m.player.x, m.player.y, m.player.nextDir)) {
        m.player.dir = { ...m.player.nextDir };
      }
      if (canMove(m.player.x, m.player.y, m.player.dir)) {
        m.player.x += m.player.dir.x;
        m.player.y += m.player.dir.y;
        const pelletKey = `${m.player.x},${m.player.y}`;
        if (m.pellets.has(pelletKey)) {
          m.pellets.delete(pelletKey);
          m.score += 10;
          playTone(640, 16, 'square', 0.2);
        }
      }
    }

    if (now - m.lastGhostStepAt >= ghostStepMs) {
      m.lastGhostStepAt = now;
      m.ghosts.forEach((g) => {
        if (!canMove(g.x, g.y, g.dir) || Math.random() < 0.22) {
          g.dir = pickTurn(g.x, g.y, g.dir);
        }
        if (canMove(g.x, g.y, g.dir)) {
          g.x += g.dir.x;
          g.y += g.dir.y;
        }
      });
    }

    const hitGhost = m.ghosts.some((g) => g.x === m.player.x && g.y === m.player.y);
    if (hitGhost) {
      m.lives -= 1;
      syncUi();
      playTone(210, 70, 'sawtooth', 0.34);
      if (m.lives <= 0) {
        await finishGame('Ghost collision');
        return;
      }
      m.running = false;
      setOverlay({ title: `Caught! Lives ${m.lives}`, subtitle: 'Resuming in 2 seconds' });
      setStatusMessage('Caught by a ghost.');
      window.setTimeout(() => {
        resetPositions();
        setOverlay(null);
        setStatusMessage('Keep going.');
        m.running = true;
        rafRef.current = window.requestAnimationFrame(loopRef.current);
      }, 2000);
      return;
    }

    if (m.pellets.size === 0) {
      m.level += 1;
      m.score += 150;
      m.pellets = createPellets();
      resetPositions();
      setStatusMessage(`Level ${m.level}`);
      setOverlay({ title: `Level ${m.level}`, subtitle: 'Maze reset' });
      playTone(760, 50, 'triangle', 0.35);
      window.setTimeout(() => setOverlay(null), 900);
    }

    m.tick += 1;
    if (m.tick % 2 === 0) syncUi();
  }, [finishGame, playTone, resetPositions, syncUi]);

  const loopRef = useRef(async () => {});
  loopRef.current = async () => {
    await updateModel();
    draw();
    if (modelRef.current.running) {
      rafRef.current = window.requestAnimationFrame(loopRef.current);
    }
  };

  const startGame = useCallback(() => {
    unlockAudio();
    modelRef.current = createModel();
    modelRef.current.running = true;
    modelRef.current.lastGhostStepAt = performance.now();
    modelRef.current.lastPlayerStepAt = performance.now();
    setGameState('playing');
    setStatusMessage('Arrow keys move through the maze.');
    setOverlay(null);
    syncUi();
    if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
    rafRef.current = window.requestAnimationFrame(loopRef.current);
    canvasRef.current?.focus();
  }, [syncUi, unlockAudio]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return undefined;
    const resizeCanvas = () => {
      const rect = wrap.getBoundingClientRect();
      const width = Math.max(320, Math.floor(rect.width));
      const height = Math.max(220, Math.floor(rect.height));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        draw();
      }
    };
    resizeCanvas();
    const observer = new ResizeObserver(() => resizeCanvas());
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [draw]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return undefined;
    const onUnlock = () => unlockAudio();
    wrap.addEventListener('pointerdown', onUnlock);
    return () => wrap.removeEventListener('pointerdown', onUnlock);
  }, [unlockAudio]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (!isPanelActive || isEditableTarget(event)) return;
      if (!DIRS[event.key]) return;
      modelRef.current.player.nextDir = { ...DIRS[event.key] };
      event.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isPanelActive]);

  useEffect(() => () => {
    stopGame();
    clearInactiveResumeCountdown();
    try {
      audioContextRef.current?.close?.();
    } catch {
      // no-op
    }
    audioContextRef.current = null;
    audioMasterGainRef.current = null;
  }, [clearInactiveResumeCountdown, stopGame]);

  useEffect(() => {
    if (!isPanelActive) {
      clearInactiveResumeCountdown();
      if (!modelRef.current.running) return;
      pausedByInactiveRef.current = true;
      modelRef.current.running = false;
      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
      setOverlay({
        title: 'Paused',
        subtitle: 'Panel is not active',
      });
      setStatusMessage('Paused while another tab is active.');
      return;
    }
    if (!pausedByInactiveRef.current) return;
    pausedByInactiveRef.current = false;
    if (gameState !== 'playing') return;
    if (modelRef.current.running) return;

    let count = 5;
    setOverlay({ title: 'Resuming', subtitle: `${count}` });
    setStatusMessage(`Resuming in ${count}...`);
    clearInactiveResumeCountdown();
    inactiveResumeIntervalRef.current = window.setInterval(() => {
      count -= 1;
      if (count <= 0) {
        clearInactiveResumeCountdown();
        if (gameState !== 'playing' || !isPanelActive) return;
        setOverlay((prev) => (prev?.title === 'Resuming' ? null : prev));
        setStatusMessage('Resumed.');
        modelRef.current.running = true;
        rafRef.current = window.requestAnimationFrame(loopRef.current);
        return;
      }
      setOverlay((prev) => (prev?.title === 'Resuming' ? { title: 'Resuming', subtitle: `${count}` } : prev));
      setStatusMessage(`Resuming in ${count}...`);
    }, 1000);
  }, [clearInactiveResumeCountdown, gameState, isPanelActive]);

  const topRows = Array.isArray(leaderboard?.top) ? leaderboard.top : [];
  const recentRows = Array.isArray(leaderboard?.recent) ? leaderboard.recent : [];
  const actionLabel = gameState === 'playing' ? 'Restart' : 'Start';

  return (
    <div
      className={`talia-report pacman-game ${isPanelActive ? '' : 'talia-game-panel--inactive'}`}
      role="region"
      aria-label="Pac-Man game panel"
    >
      <header className="talia-report__header">
        <div className="talia-report__header-left">
          <h2 className="talia-report__title">Pac-Man</h2>
          <p className="talia-report__subtitle">Lightweight maze demo using shared score services.</p>
        </div>
        <div className="talia-report__actions">
          <button type="button" className="talia-btn talia-btn--small talia-btn--primary" onClick={startGame}>
            {actionLabel}
          </button>
          <button type="button" className="talia-btn talia-btn--small" onClick={onReloadScore}>
            Reload Score
          </button>
        </div>
      </header>

      <main className="talia-report__content pacman-game__content">
        <div className="pacman-game__hud" role="status" aria-live="polite">
          <span className="talia-event-meta__chip">User: {userLabel}</span>
          <span className="talia-event-meta__chip">Score: {score}</span>
          <span className="talia-event-meta__chip">Lives: {lives}</span>
          <button
            type="button"
            className="talia-btn talia-btn--small"
            onClick={() => setShowScorePopover((prev) => !prev)}
            title="Show top and recent game highs"
          >
            Top High
          </button>
          <span className="talia-event-meta__chip talia-event-meta__chip--secondary">High: {highScore}</span>
          <span className="talia-event-meta__chip talia-event-meta__chip--secondary">Last: {lastScore}</span>
        </div>

        <div ref={wrapRef} className="pacman-game__canvas-wrap">
          <canvas ref={canvasRef} className="pacman-game__canvas" tabIndex={0} aria-label="Pac-Man game area" />
          {overlay && (
            <div className="pacman-game__overlay" role="status" aria-live="polite">
              <div className="pacman-game__overlay-panel">
                <div className="pacman-game__overlay-title">{overlay.title}</div>
                {overlay.subtitle && <div className="pacman-game__overlay-subtitle">{overlay.subtitle}</div>}
              </div>
            </div>
          )}
        </div>

        <div className="pacman-game__meta">
          <span>{statusMessage}</span>
          <span>{loading ? 'Loading score...' : `Last saved: ${updatedLabel}`}</span>
          {saving && <span>Saving score...</span>}
          {loadError && <span>Score load failed. You can still play.</span>}
          {saveError && <span>Score save failed. Retry after next game.</span>}
        </div>

        <GameScorePopover
          open={showScorePopover}
          onClose={() => setShowScorePopover(false)}
          title="Game Scores"
          loading={leaderboardLoading}
          top={topRows}
          recent={recentRows}
        />
      </main>
    </div>
  );
};

export default PacManPresenter;
