import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import GameScorePopover from '../../shared/games/GameScorePopover';
import usePanelTabActive from '../../../hooks/usePanelTabActive';
import usePanelPaused from '../../../hooks/usePanelPaused';
import { isEditableTarget } from '../../shared/games/keyboardGuards';

const GAME_WIDTH = 680;
const GAME_HEIGHT = 430;

const rand = (min, max) => min + Math.random() * (max - min);
const wrap = (value, max) => {
  if (value < 0) return value + max;
  if (value >= max) return value - max;
  return value;
};

const createAsteroid = (size = 3, x = rand(0, GAME_WIDTH), y = rand(0, GAME_HEIGHT)) => {
  const radius = size === 3 ? 34 : size === 2 ? 22 : 14;
  return {
    id: `${Date.now()}-${Math.random()}`,
    x,
    y,
    vx: rand(-1.4, 1.4),
    vy: rand(-1.2, 1.2),
    radius,
    size,
    spin: rand(-0.03, 0.03),
    angle: rand(0, Math.PI * 2),
  };
};

const createModel = () => ({
  running: false,
  score: 0,
  lives: 3,
  ship: { x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2, vx: 0, vy: 0, angle: -Math.PI / 2 },
  bullets: [],
  asteroids: [createAsteroid(3), createAsteroid(3), createAsteroid(2)],
  keys: { left: false, right: false, thrust: false, fire: false },
  fireCooldown: 0,
  frame: 0,
});

const AsteroidsPresenter = ({
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
  const isPanelPaused = usePanelPaused(panelInstanceId, 'asteroids');
  const isPanelExecutionActive = isPanelActive && !isPanelPaused;
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const modelRef = useRef(createModel());
  const rafRef = useRef(0);
  const pausedByInactiveRef = useRef(false);
  const inactiveResumeIntervalRef = useRef(0);
  const audioContextRef = useRef(null);
  const audioMasterGainRef = useRef(null);
  const lastSoundAtRef = useRef(0);
  const [gameState, setGameState] = useState('idle');
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [statusMessage, setStatusMessage] = useState('Press Start and use arrows + Space.');
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
    master.gain.value = 0.023;
    master.connect(context.destination);
    audioContextRef.current = context;
    audioMasterGainRef.current = master;
    return context;
  }, []);

  const playTone = useCallback((freq = 320, durationMs = 30, type = 'square', volume = 0.34) => {
    const now = performance.now();
    if (now - lastSoundAtRef.current < 10) return;
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
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.005);
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
    ctx.fillStyle = 'rgba(10, 14, 27, 0.95)';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    ctx.strokeStyle = 'rgba(150, 174, 213, 0.24)';
    ctx.strokeRect(8, 8, GAME_WIDTH - 16, GAME_HEIGHT - 16);

    ctx.fillStyle = 'rgba(220, 235, 255, 0.8)';
    for (let i = 0; i < 70; i += 1) {
      const sx = (i * 97) % GAME_WIDTH;
      const sy = (i * 41) % GAME_HEIGHT;
      ctx.fillRect(sx, sy, 1.4, 1.4);
    }

    m.asteroids.forEach((a) => {
      ctx.save();
      ctx.translate(a.x, a.y);
      ctx.rotate(a.angle);
      ctx.strokeStyle = 'rgba(173, 201, 235, 0.84)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (let i = 0; i < 8; i += 1) {
        const theta = (i / 8) * Math.PI * 2;
        const r = a.radius * (0.76 + (i % 2 ? 0.24 : 0.05));
        const px = Math.cos(theta) * r;
        const py = Math.sin(theta) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    });

    ctx.strokeStyle = 'rgba(255, 231, 138, 0.96)';
    ctx.lineWidth = 1.8;
    m.bullets.forEach((b) => {
      ctx.beginPath();
      ctx.arc(b.x, b.y, 2.1, 0, Math.PI * 2);
      ctx.stroke();
    });

    const s = m.ship;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.angle);
    ctx.strokeStyle = 'rgba(158, 255, 198, 0.94)';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(15, 0);
    ctx.lineTo(-10, -9);
    ctx.lineTo(-6, 0);
    ctx.lineTo(-10, 9);
    ctx.closePath();
    ctx.stroke();
    if (m.keys.thrust) {
      ctx.strokeStyle = 'rgba(255, 171, 95, 0.92)';
      ctx.beginPath();
      ctx.moveTo(-8, -4);
      ctx.lineTo(-18 - Math.random() * 5, 0);
      ctx.lineTo(-8, 4);
      ctx.stroke();
    }
    ctx.restore();

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
    playTone(340, 80, 'triangle', 0.45);
    setTimeout(() => playTone(250, 120, 'triangle', 0.45), 100);
    await onSaveScore(finalScore);
  }, [onSaveScore, playTone, stopGame]);

  const handleShipCollision = useCallback(async () => {
    const m = modelRef.current;
    m.lives -= 1;
    syncUi();
    playTone(200, 80, 'sawtooth', 0.45);
    if (m.lives <= 0) {
      await finishGame('Ship destroyed');
      return;
    }
    m.ship.x = GAME_WIDTH / 2;
    m.ship.y = GAME_HEIGHT / 2;
    m.ship.vx = 0;
    m.ship.vy = 0;
    m.ship.angle = -Math.PI / 2;
    setOverlay({ title: `Ship hit`, subtitle: `${m.lives} lives left` });
    window.setTimeout(() => setOverlay(null), 900);
  }, [finishGame, playTone, syncUi]);

  const updateModel = useCallback(async () => {
    const m = modelRef.current;
    if (!m.running) return;
    const s = m.ship;

    if (m.keys.left) s.angle -= 0.065;
    if (m.keys.right) s.angle += 0.065;
    if (m.keys.thrust) {
      s.vx += Math.cos(s.angle) * 0.11;
      s.vy += Math.sin(s.angle) * 0.11;
      if (m.frame % 5 === 0) playTone(160, 12, 'square', 0.14);
    }
    s.vx *= 0.992;
    s.vy *= 0.992;
    s.x = wrap(s.x + s.vx, GAME_WIDTH);
    s.y = wrap(s.y + s.vy, GAME_HEIGHT);

    if (m.keys.fire && m.fireCooldown <= 0) {
      m.bullets.push({
        x: s.x + Math.cos(s.angle) * 14,
        y: s.y + Math.sin(s.angle) * 14,
        vx: Math.cos(s.angle) * 6.2 + s.vx,
        vy: Math.sin(s.angle) * 6.2 + s.vy,
        ttl: 75,
      });
      m.fireCooldown = 8;
      playTone(780, 22, 'square', 0.3);
    }
    m.fireCooldown = Math.max(0, m.fireCooldown - 1);

    m.bullets = m.bullets
      .map((b) => ({ ...b, x: wrap(b.x + b.vx, GAME_WIDTH), y: wrap(b.y + b.vy, GAME_HEIGHT), ttl: b.ttl - 1 }))
      .filter((b) => b.ttl > 0);

    m.asteroids = m.asteroids.map((a) => ({
      ...a,
      x: wrap(a.x + a.vx, GAME_WIDTH),
      y: wrap(a.y + a.vy, GAME_HEIGHT),
      angle: a.angle + a.spin,
    }));

    const spawned = [];
    m.bullets.forEach((b) => {
      m.asteroids.forEach((a) => {
        if (a.dead) return;
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        if (dx * dx + dy * dy > (a.radius + 2) ** 2) return;
        a.dead = true;
        b.ttl = 0;
        m.score += a.size === 3 ? 20 : a.size === 2 ? 50 : 100;
        playTone(a.size === 3 ? 420 : 540, 34, 'triangle', 0.34);
        if (a.size > 1) {
          spawned.push(createAsteroid(a.size - 1, a.x + rand(-8, 8), a.y + rand(-8, 8)));
          spawned.push(createAsteroid(a.size - 1, a.x + rand(-8, 8), a.y + rand(-8, 8)));
        }
      });
    });
    m.asteroids = m.asteroids.filter((a) => !a.dead).concat(spawned);

    const shipHit = m.asteroids.some((a) => {
      const dx = a.x - s.x;
      const dy = a.y - s.y;
      return dx * dx + dy * dy <= (a.radius + 10) ** 2;
    });
    if (shipHit) {
      await handleShipCollision();
      if (!m.running) return;
    }

    if (m.asteroids.length === 0) {
      m.score += 200;
      m.asteroids.push(createAsteroid(3), createAsteroid(3), createAsteroid(2), createAsteroid(2));
      setStatusMessage('New asteroid field');
      setOverlay({ title: 'Wave Cleared', subtitle: 'Incoming field' });
      playTone(860, 50, 'triangle', 0.34);
      window.setTimeout(() => setOverlay(null), 800);
    }

    m.frame += 1;
    if (m.frame % 3 === 0) syncUi();
  }, [handleShipCollision, playTone, syncUi]);

  const loop = useCallback(async () => {
    await updateModel();
    draw();
    if (modelRef.current.running) {
      rafRef.current = window.requestAnimationFrame(loop);
    }
  }, [draw, updateModel]);

  const startGame = useCallback(() => {
    unlockAudio();
    modelRef.current = createModel();
    modelRef.current.running = true;
    setGameState('playing');
    setStatusMessage('Arrow keys turn/thrust, Space fires.');
    setOverlay(null);
    syncUi();
    if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
    rafRef.current = window.requestAnimationFrame(loop);
    canvasRef.current?.focus();
  }, [loop, syncUi, unlockAudio]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const wrapEl = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrapEl || !canvas) return undefined;
    const resizeCanvas = () => {
      const rect = wrapEl.getBoundingClientRect();
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
    observer.observe(wrapEl);
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
      if (!isPanelExecutionActive || isEditableTarget(event)) return;
      const keys = modelRef.current.keys;
      if (event.key === 'ArrowLeft') keys.left = true;
      if (event.key === 'ArrowRight') keys.right = true;
      if (event.key === 'ArrowUp') keys.thrust = true;
      if (event.key === ' ') keys.fire = true;
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', ' '].includes(event.key)) {
        event.preventDefault();
      }
    };
    const onKeyUp = (event) => {
      if (!isPanelExecutionActive || isEditableTarget(event)) return;
      const keys = modelRef.current.keys;
      if (event.key === 'ArrowLeft') keys.left = false;
      if (event.key === 'ArrowRight') keys.right = false;
      if (event.key === 'ArrowUp') keys.thrust = false;
      if (event.key === ' ') keys.fire = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [isPanelExecutionActive]);

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
    if (!isPanelExecutionActive) {
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
        subtitle: isPanelPaused ? 'Paused by user (P)' : 'Panel is not active',
      });
      setStatusMessage(isPanelPaused ? 'Paused. Press P to resume.' : 'Paused while another tab is active.');
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
        if (gameState !== 'playing' || !isPanelExecutionActive) return;
        setOverlay((prev) => (prev?.title === 'Resuming' ? null : prev));
        setStatusMessage('Resumed.');
        modelRef.current.running = true;
        rafRef.current = window.requestAnimationFrame(loop);
        return;
      }
      setOverlay((prev) => (prev?.title === 'Resuming' ? { title: 'Resuming', subtitle: `${count}` } : prev));
      setStatusMessage(`Resuming in ${count}...`);
    }, 1000);
  }, [clearInactiveResumeCountdown, gameState, isPanelExecutionActive, isPanelPaused, loop]);

  const topRows = Array.isArray(leaderboard?.top) ? leaderboard.top : [];
  const recentRows = Array.isArray(leaderboard?.recent) ? leaderboard.recent : [];
  const actionLabel = gameState === 'playing' ? 'Restart' : 'Start';

  return (
    <div
      className={`talia-report asteroids-game ${isPanelExecutionActive ? '' : 'talia-game-panel--inactive'}`}
      role="region"
      aria-label="Asteroids game panel"
    >
      <header className="talia-report__header">
        <div className="talia-report__header-left">
          <h2 className="talia-report__title">Asteroids</h2>
          <p className="talia-report__subtitle">Contained arcade demo with shared user score tracking.</p>
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

      <main className="talia-report__content asteroids-game__content">
        <div className="asteroids-game__hud" role="status" aria-live="polite">
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

        <div ref={wrapRef} className="asteroids-game__canvas-wrap">
          <canvas ref={canvasRef} className="asteroids-game__canvas" tabIndex={0} aria-label="Asteroids game area" />
          {overlay && (
            <div className="asteroids-game__overlay" role="status" aria-live="polite">
              <div className="asteroids-game__overlay-panel">
                <div className="asteroids-game__overlay-title">{overlay.title}</div>
                {overlay.subtitle && <div className="asteroids-game__overlay-subtitle">{overlay.subtitle}</div>}
              </div>
            </div>
          )}
        </div>

        <div className="asteroids-game__meta">
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

export default AsteroidsPresenter;
