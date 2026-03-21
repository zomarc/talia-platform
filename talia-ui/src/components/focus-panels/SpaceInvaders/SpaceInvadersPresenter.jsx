import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import GameScorePopover from '../../shared/games/GameScorePopover';
import usePanelTabActive from '../../../hooks/usePanelTabActive';
import { isEditableTarget } from '../../shared/games/keyboardGuards';

const GAME_WIDTH = 640;
const GAME_HEIGHT = 440;

const createInvaders = () => {
  const invaders = [];
  const rows = 4;
  const cols = 9;
  const spacingX = 52;
  const spacingY = 38;
  const startX = 96;
  const startY = 62;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      invaders.push({
        x: startX + c * spacingX,
        y: startY + r * spacingY,
        w: 20,
        h: 14,
        alive: true,
        points: (rows - r) * 12,
      });
    }
  }
  return invaders;
};

const createShields = () => {
  const shields = [];
  const shieldCount = 4;
  const shieldW = 56;
  const shieldH = 26;
  const topY = GAME_HEIGHT - 116;
  const spacing = (GAME_WIDTH - shieldCount * shieldW) / (shieldCount + 1);
  for (let i = 0; i < shieldCount; i += 1) {
    shields.push({
      x: Math.round(spacing + i * (shieldW + spacing)),
      y: topY,
      w: shieldW,
      h: shieldH,
      hp: 6,
      maxHp: 6,
    });
  }
  return shields;
};

const createInitialModel = () => ({
  running: false,
  score: 0,
  lives: 3,
  player: { x: GAME_WIDTH / 2 - 14, y: GAME_HEIGHT - 48, w: 28, h: 14, speed: 5.4 },
  bullets: [],
  enemyBullets: [],
  invaders: createInvaders(),
  shields: createShields(),
  invaderDirection: 1,
  invaderSpeed: 0.56,
  invaderAnimFrame: 0,
  frame: 0,
  leftPressed: false,
  rightPressed: false,
});

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const SpaceInvadersPresenter = ({
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
  const modelRef = useRef(createInitialModel());
  const rafRef = useRef(0);
  const pausedByInactiveRef = useRef(false);
  const inactiveResumeIntervalRef = useRef(0);
  const hitOverlayTimerRef = useRef(0);
  const audioContextRef = useRef(null);
  const audioMasterGainRef = useRef(null);
  const lastSoundAtRef = useRef(0);
  const renderMetricsRef = useRef({ scale: 1, offsetX: 0, offsetY: 0 });
  const [gameState, setGameState] = useState('idle');
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [statusMessage, setStatusMessage] = useState('Press Start to defend the fleet.');
  const [overlay, setOverlay] = useState(null);
  const [showScorePopover, setShowScorePopover] = useState(false);

  const userLabel = useMemo(() => String(userId || 'anonymous'), [userId]);
  const updatedLabel = useMemo(() => {
    if (!updatedAt) return 'Not saved yet';
    const date = new Date(updatedAt);
    return Number.isNaN(date.getTime()) ? 'Not saved yet' : date.toLocaleString();
  }, [updatedAt]);

  const syncUi = useCallback(() => {
    const model = modelRef.current;
    setScore(model.score);
    setLives(model.lives);
  }, []);

  const ensureAudioContext = useCallback(() => {
    if (audioContextRef.current) return audioContextRef.current;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    const context = new Ctor();
    const masterGain = context.createGain();
    masterGain.gain.value = 0.03;
    masterGain.connect(context.destination);
    audioContextRef.current = context;
    audioMasterGainRef.current = masterGain;
    return context;
  }, []);

  const playTone = useCallback((frequency = 420, durationMs = 40, type = 'square', volume = 0.45) => {
    const now = performance.now();
    if (now - lastSoundAtRef.current < 12) return;
    lastSoundAtRef.current = now;
    const context = ensureAudioContext();
    const masterGain = audioMasterGainRef.current;
    if (!context || !masterGain) return;
    if (context.state === 'suspended') context.resume().catch(() => {});

    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    gain.gain.value = 0.0001;
    osc.connect(gain);
    gain.connect(masterGain);
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

  const playExplosion = useCallback(() => {
    playTone(220, 60, 'sawtooth', 0.55);
    setTimeout(() => playTone(160, 70, 'square', 0.48), 45);
    setTimeout(() => playTone(110, 90, 'triangle', 0.42), 95);
  }, [playTone]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const model = modelRef.current;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const scale = Math.min(canvas.width / GAME_WIDTH, canvas.height / GAME_HEIGHT);
    const offsetX = Math.round((canvas.width - GAME_WIDTH * scale) / 2);
    const offsetY = Math.round((canvas.height - GAME_HEIGHT * scale) / 2);
    renderMetricsRef.current = { scale, offsetX, offsetY };

    ctx.save();
    ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
    ctx.fillStyle = 'rgba(18, 18, 32, 0.95)';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    ctx.strokeStyle = 'rgba(152, 175, 216, 0.25)';
    ctx.strokeRect(8, 8, GAME_WIDTH - 16, GAME_HEIGHT - 16);

    model.invaders.forEach((inv) => {
      if (!inv.alive) return;
      const frame = model.invaderAnimFrame % 2;
      ctx.fillStyle = 'rgba(128, 227, 159, 0.92)';
      ctx.fillRect(inv.x, inv.y, inv.w, inv.h);
      ctx.fillStyle = 'rgba(18, 48, 26, 0.9)';
      ctx.fillRect(inv.x + 3, inv.y + 3, 3, 3);
      ctx.fillRect(inv.x + inv.w - 6, inv.y + 3, 3, 3);
      if (frame === 0) {
        ctx.fillRect(inv.x + 2, inv.y + inv.h, 4, 3);
        ctx.fillRect(inv.x + inv.w - 6, inv.y + inv.h, 4, 3);
      } else {
        ctx.fillRect(inv.x + 6, inv.y + inv.h, 4, 3);
        ctx.fillRect(inv.x + inv.w - 10, inv.y + inv.h, 4, 3);
      }
    });

    model.shields.forEach((shield) => {
      if (shield.hp <= 0) return;
      const alpha = 0.26 + 0.62 * (shield.hp / shield.maxHp);
      ctx.fillStyle = `rgba(106, 205, 160, ${alpha.toFixed(3)})`;
      ctx.fillRect(shield.x, shield.y, shield.w, shield.h);
      ctx.strokeStyle = 'rgba(182, 238, 212, 0.55)';
      ctx.strokeRect(shield.x, shield.y, shield.w, shield.h);
    });

    ctx.fillStyle = 'rgba(247, 213, 117, 0.94)';
    ctx.beginPath();
    ctx.moveTo(model.player.x + model.player.w / 2, model.player.y);
    ctx.lineTo(model.player.x + model.player.w, model.player.y + model.player.h);
    ctx.lineTo(model.player.x, model.player.y + model.player.h);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(173, 231, 255, 0.95)';
    model.bullets.forEach((b) => ctx.fillRect(b.x, b.y, 3, 10));

    ctx.fillStyle = 'rgba(255, 132, 132, 0.9)';
    model.enemyBullets.forEach((b) => ctx.fillRect(b.x, b.y, 3, 10));

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
    setStatusMessage(`Game over: ${reason}`);
    setOverlay({ title: 'Game Over', subtitle: `Final score: ${finalScore}` });
    playTone(480, 70, 'triangle', 0.5);
    setTimeout(() => playTone(360, 90, 'triangle', 0.5), 85);
    setTimeout(() => playTone(240, 120, 'triangle', 0.5), 190);
    await onSaveScore(finalScore);
  }, [onSaveScore, playTone, stopGame]);

  const updateModel = useCallback(async () => {
    const model = modelRef.current;
    if (!model.running) return;

    if (model.leftPressed) {
      model.player.x = clamp(model.player.x - model.player.speed, 12, GAME_WIDTH - model.player.w - 12);
    }
    if (model.rightPressed) {
      model.player.x = clamp(model.player.x + model.player.speed, 12, GAME_WIDTH - model.player.w - 12);
    }

    let hitEdge = false;
    model.invaders.forEach((inv) => {
      if (!inv.alive) return;
      inv.x += model.invaderDirection * model.invaderSpeed;
      if (inv.x <= 14 || inv.x + inv.w >= GAME_WIDTH - 14) {
        hitEdge = true;
      }
    });
    if (hitEdge) {
      model.invaderDirection *= -1;
      model.invaders.forEach((inv) => {
        if (inv.alive) inv.y += 12;
      });
    }
    if (model.frame % 18 === 0) {
      model.invaderAnimFrame = (model.invaderAnimFrame + 1) % 2;
      playTone(model.invaderAnimFrame === 0 ? 180 : 210, 14, 'square', 0.22);
    }

    model.bullets = model.bullets
      .map((b) => ({ ...b, y: b.y - 5.2 }))
      .filter((b) => b.y > 10);
    model.enemyBullets = model.enemyBullets
      .map((b) => ({ ...b, y: b.y + 3.1 }))
      .filter((b) => b.y < GAME_HEIGHT - 8);

    model.bullets.forEach((bullet) => {
      model.invaders.forEach((inv) => {
        if (!inv.alive) return;
        if (bullet.x < inv.x || bullet.x > inv.x + inv.w || bullet.y < inv.y || bullet.y > inv.y + inv.h) return;
        inv.alive = false;
        bullet.y = -100;
        model.score += inv.points;
        playTone(640, 40, 'triangle', 0.5);
      });
    });

    model.bullets.forEach((bullet) => {
      model.shields.forEach((shield) => {
        if (shield.hp <= 0) return;
        if (bullet.x < shield.x || bullet.x > shield.x + shield.w || bullet.y < shield.y || bullet.y > shield.y + shield.h) return;
        shield.hp -= 1;
        bullet.y = -100;
        playTone(300, 24, 'square', 0.32);
      });
    });

    const aliveInvaders = model.invaders.filter((inv) => inv.alive);
    if (aliveInvaders.length > 0 && model.frame % 52 === 0) {
      const shooter = aliveInvaders[Math.floor(Math.random() * aliveInvaders.length)];
      model.enemyBullets.push({
        x: shooter.x + shooter.w / 2,
        y: shooter.y + shooter.h + 2,
      });
    }

    model.enemyBullets.forEach((bullet) => {
      model.shields.forEach((shield) => {
        if (shield.hp <= 0) return;
        if (bullet.x < shield.x || bullet.x > shield.x + shield.w || bullet.y < shield.y || bullet.y > shield.y + shield.h) return;
        shield.hp -= 1;
        bullet.y = GAME_HEIGHT + 100;
        playTone(240, 22, 'square', 0.28);
      });
    });

    let playerHit = false;
    model.enemyBullets.forEach((bullet) => {
      if (playerHit) return;
      const p = model.player;
      if (bullet.x >= p.x && bullet.x <= p.x + p.w && bullet.y >= p.y && bullet.y <= p.y + p.h) {
        bullet.y = GAME_HEIGHT + 100;
        playerHit = true;
      }
    });

    if (playerHit) {
      model.lives -= 1;
      playExplosion();
      setStatusMessage('Ship hit!');
      setOverlay({
        title: 'Ship Hit!',
        subtitle: `Lives ${Math.max(0, model.lives)}`,
      });
      if (hitOverlayTimerRef.current) {
        window.clearTimeout(hitOverlayTimerRef.current);
      }
      hitOverlayTimerRef.current = window.setTimeout(() => {
        hitOverlayTimerRef.current = 0;
        setOverlay((prev) => (prev?.title === 'Ship Hit!' ? null : prev));
      }, 700);
    }

    if (model.lives <= 0) {
      await finishGame('Fleet destroyed');
      return;
    }

    if (aliveInvaders.some((inv) => inv.y + inv.h >= model.player.y)) {
      await finishGame('Invaders landed');
      return;
    }

    if (aliveInvaders.length === 0) {
      model.invaders = createInvaders();
      model.shields = createShields();
      model.invaderSpeed = Math.min(1.8, model.invaderSpeed + 0.12);
      setStatusMessage('Wave cleared. Next wave!');
      playTone(760, 60, 'triangle', 0.45);
    }

    model.frame += 1;
    if (model.frame % 3 === 0) {
      syncUi();
    }
  }, [finishGame, playExplosion, syncUi]);

  const loop = useCallback(async () => {
    await updateModel();
    draw();
    if (modelRef.current.running) {
      rafRef.current = window.requestAnimationFrame(loop);
    }
  }, [draw, updateModel]);

  const startGame = useCallback(() => {
    unlockAudio();
    modelRef.current = createInitialModel();
    modelRef.current.running = true;
    setGameState('playing');
    setStatusMessage('Arrows move, Space shoots.');
    setOverlay(null);
    syncUi();
    if (rafRef.current) {
      window.cancelAnimationFrame(rafRef.current);
    }
    rafRef.current = window.requestAnimationFrame(loop);
    canvasRef.current?.focus();
    playTone(520, 36, 'triangle', 0.38);
  }, [loop, playTone, syncUi, unlockAudio]);

  const fireBullet = useCallback(() => {
    const model = modelRef.current;
    if (!model.running || model.bullets.length >= 4) return;
    model.bullets.push({
      x: model.player.x + model.player.w / 2,
      y: model.player.y - 6,
    });
    playTone(780, 20, 'square', 0.38);
  }, [playTone]);

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
      if (event.key === 'ArrowLeft') {
        modelRef.current.leftPressed = true;
        event.preventDefault();
      } else if (event.key === 'ArrowRight') {
        modelRef.current.rightPressed = true;
        event.preventDefault();
      } else if (event.key === ' ' && gameState === 'playing') {
        fireBullet();
        event.preventDefault();
      }
    };
    const onKeyUp = (event) => {
      if (!isPanelActive || isEditableTarget(event)) return;
      if (event.key === 'ArrowLeft') modelRef.current.leftPressed = false;
      if (event.key === 'ArrowRight') modelRef.current.rightPressed = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [fireBullet, gameState, isPanelActive]);

  useEffect(() => () => {
    stopGame();
    clearInactiveResumeCountdown();
    if (hitOverlayTimerRef.current) {
      window.clearTimeout(hitOverlayTimerRef.current);
      hitOverlayTimerRef.current = 0;
    }
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
        rafRef.current = window.requestAnimationFrame(loop);
        return;
      }
      setOverlay((prev) => (prev?.title === 'Resuming' ? { title: 'Resuming', subtitle: `${count}` } : prev));
      setStatusMessage(`Resuming in ${count}...`);
    }, 1000);
  }, [clearInactiveResumeCountdown, gameState, isPanelActive, loop]);

  const handlePointerMove = (event) => {
    if (gameState !== 'playing') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const { scale, offsetX } = renderMetricsRef.current;
    const localX = ((event.clientX - rect.left) - offsetX) / Math.max(scale, 0.0001);
    modelRef.current.player.x = clamp(localX - modelRef.current.player.w / 2, 12, GAME_WIDTH - modelRef.current.player.w - 12);
  };

  const topRows = Array.isArray(leaderboard?.top) ? leaderboard.top : [];
  const recentRows = Array.isArray(leaderboard?.recent) ? leaderboard.recent : [];
  const actionLabel = gameState === 'playing' ? 'Restart' : 'Start';

  return (
    <div
      className={`talia-report space-invaders ${isPanelActive ? '' : 'talia-game-panel--inactive'}`}
      role="region"
      aria-label="Space Invaders panel"
    >
      <header className="talia-report__header">
        <div className="talia-report__header-left">
          <h2 className="talia-report__title">Space Invaders</h2>
          <p className="talia-report__subtitle">Standalone arcade panel with shared game score service.</p>
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

      <main className="talia-report__content space-invaders__content">
        <div className="space-invaders__hud" role="status" aria-live="polite">
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

        <div ref={wrapRef} className="space-invaders__canvas-wrap">
          <canvas
            ref={canvasRef}
            className="space-invaders__canvas"
            tabIndex={0}
            aria-label="Space Invaders game area"
            onMouseMove={handlePointerMove}
            onClick={fireBullet}
          />
          {overlay && (
            <div className="space-invaders__overlay" role="status" aria-live="polite">
              <div className="space-invaders__overlay-panel">
                <div className="space-invaders__overlay-title">{overlay.title}</div>
                {overlay.subtitle && <div className="space-invaders__overlay-subtitle">{overlay.subtitle}</div>}
              </div>
            </div>
          )}
        </div>

        <div className="space-invaders__meta">
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

export default SpaceInvadersPresenter;
