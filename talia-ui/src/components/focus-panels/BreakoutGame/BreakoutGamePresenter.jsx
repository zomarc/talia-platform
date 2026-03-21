import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import GameScorePopover from '../../shared/games/GameScorePopover';
import usePanelTabActive from '../../../hooks/usePanelTabActive';
import { isEditableTarget } from '../../shared/games/keyboardGuards';

const GAME_WIDTH = 640;
const GAME_HEIGHT = 420;
const BRICK_ROWS = 5;
const BRICK_COLS = 9;

const createBricks = () => {
  const bricks = [];
  const brickWidth = 60;
  const brickHeight = 18;
  const gap = 8;
  const totalWidth = BRICK_COLS * brickWidth + (BRICK_COLS - 1) * gap;
  const startX = (GAME_WIDTH - totalWidth) / 2;
  const startY = 56;

  for (let row = 0; row < BRICK_ROWS; row += 1) {
    for (let col = 0; col < BRICK_COLS; col += 1) {
      bricks.push({
        x: startX + col * (brickWidth + gap),
        y: startY + row * (brickHeight + gap),
        w: brickWidth,
        h: brickHeight,
        alive: true,
        points: (BRICK_ROWS - row) * 10,
      });
    }
  }
  return bricks;
};

const createInitialModel = () => ({
  running: false,
  waitingForLaunch: true,
  score: 0,
  lives: 3,
  level: 1,
  ball: { x: GAME_WIDTH / 2, y: GAME_HEIGHT - 110, vx: 3.1, vy: -3.2, radius: 7 },
  paddle: { x: GAME_WIDTH / 2 - 52, y: GAME_HEIGHT - 50, w: 104, h: 12, speed: 7.5 },
  bricks: createBricks(),
  leftPressed: false,
  rightPressed: false,
  frame: 0,
});

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const BreakoutGamePresenter = ({
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
  const canvasWrapRef = useRef(null);
  const rafRef = useRef(0);
  const pauseTimerRef = useRef(0);
  const pausedByInactiveRef = useRef(false);
  const inactiveResumeIntervalRef = useRef(0);
  const modelRef = useRef(createInitialModel());
  const audioContextRef = useRef(null);
  const audioMasterGainRef = useRef(null);
  const lastSoundAtRef = useRef(0);
  const renderMetricsRef = useRef({ scale: 1, offsetX: 0, offsetY: 0 });
  const [gameState, setGameState] = useState('idle');
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [statusMessage, setStatusMessage] = useState('Press Start to play.');
  const [overlay, setOverlay] = useState(null);
  const [showScorePopover, setShowScorePopover] = useState(false);

  const userLabel = useMemo(() => String(userId || 'anonymous'), [userId]);
  const updatedLabel = useMemo(() => {
    if (!updatedAt) return 'Not saved yet';
    const date = new Date(updatedAt);
    if (Number.isNaN(date.getTime())) return 'Not saved yet';
    return date.toLocaleString();
  }, [updatedAt]);

  const syncUiFromModel = useCallback(() => {
    const model = modelRef.current;
    setScore(model.score);
    setLives(model.lives);
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const model = modelRef.current;
    const { ball, paddle, bricks } = model;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    const scale = Math.min(canvas.width / GAME_WIDTH, canvas.height / GAME_HEIGHT);
    const offsetX = Math.round((canvas.width - GAME_WIDTH * scale) / 2);
    const offsetY = Math.round((canvas.height - GAME_HEIGHT * scale) / 2);
    renderMetricsRef.current = { scale, offsetX, offsetY };
    ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);

    ctx.fillStyle = 'rgba(21, 33, 58, 0.85)';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    ctx.strokeStyle = 'rgba(151, 168, 201, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(6, 6, GAME_WIDTH - 12, GAME_HEIGHT - 12);

    bricks.forEach((brick) => {
      if (!brick.alive) return;
      const intensity = Math.max(0.22, Math.min(0.86, brick.points / 60));
      ctx.fillStyle = `rgba(126, 185, 255, ${intensity})`;
      ctx.fillRect(brick.x, brick.y, brick.w, brick.h);
      ctx.strokeStyle = 'rgba(187, 214, 255, 0.65)';
      ctx.strokeRect(brick.x, brick.y, brick.w, brick.h);
    });

    ctx.fillStyle = 'rgba(226, 178, 83, 0.95)';
    ctx.fillRect(paddle.x, paddle.y, paddle.w, paddle.h);

    ctx.beginPath();
    ctx.fillStyle = 'rgba(250, 250, 252, 0.95)';
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.closePath();
    ctx.restore();
  }, []);

  const ensureAudioContext = useCallback(() => {
    if (audioContextRef.current) return audioContextRef.current;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    const context = new Ctor();
    const masterGain = context.createGain();
    masterGain.gain.value = 0.025; // keep it subtle
    masterGain.connect(context.destination);
    audioContextRef.current = context;
    audioMasterGainRef.current = masterGain;
    return context;
  }, []);

  const playTick = useCallback((frequency = 520, durationMs = 22) => {
    if (!soundEnabled) return;
    const now = performance.now();
    if (now - lastSoundAtRef.current < 14) return;
    lastSoundAtRef.current = now;
    const context = ensureAudioContext();
    const masterGain = audioMasterGainRef.current;
    if (!context || !masterGain) return;

    if (context.state === 'suspended') {
      context.resume().catch(() => {});
    }

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    gain.gain.value = 0;
    oscillator.connect(gain);
    gain.connect(masterGain);

    const start = context.currentTime;
    const end = start + durationMs / 1000;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.45, start + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    oscillator.start(start);
    oscillator.stop(end);
  }, [ensureAudioContext, soundEnabled]);

  const unlockAudio = useCallback(() => {
    if (!soundEnabled) return;
    const context = ensureAudioContext();
    if (context?.state === 'suspended') {
      context.resume().catch(() => {});
    }
  }, [ensureAudioContext, soundEnabled]);

  const finishRound = useCallback(async () => {
    const model = modelRef.current;
    model.running = false;
    setGameState('over');
    setStatusMessage(`Game over. Final score: ${model.score}`);
    setOverlay({
      title: 'Game Over',
      subtitle: `Final score: ${model.score}`,
    });
    // Dramatic but short game-over cue.
    if (soundEnabled) {
      const context = ensureAudioContext();
      const masterGain = audioMasterGainRef.current;
      if (context && masterGain) {
        const schedule = [
          { f: 620, d: 0.08, t: 0.00 },
          { f: 520, d: 0.08, t: 0.10 },
          { f: 410, d: 0.14, t: 0.22 },
        ];
        schedule.forEach(({ f, d, t }) => {
          const osc = context.createOscillator();
          const gain = context.createGain();
          osc.type = 'triangle';
          osc.frequency.value = f;
          gain.gain.value = 0.0001;
          osc.connect(gain);
          gain.connect(masterGain);
          const start = context.currentTime + t;
          const end = start + d;
          gain.gain.setValueAtTime(0.0001, start);
          gain.gain.exponentialRampToValueAtTime(0.65, start + 0.012);
          gain.gain.exponentialRampToValueAtTime(0.0001, end);
          osc.start(start);
          osc.stop(end);
        });
      }
    }
    await onSaveScore(model.score);
  }, [ensureAudioContext, onSaveScore, soundEnabled]);

  const resetBallToPaddle = useCallback(() => {
    const model = modelRef.current;
    model.ball.x = model.paddle.x + model.paddle.w / 2;
    model.ball.y = model.paddle.y - 14;
    model.ball.vx = 3 * (Math.random() > 0.5 ? 1 : -1);
    model.ball.vy = -3.2;
  }, []);

  const updateModel = useCallback(async () => {
    const model = modelRef.current;
    if (!model.running) return;

    if (model.waitingForLaunch) {
      model.ball.x = model.paddle.x + model.paddle.w / 2;
      model.ball.y = model.paddle.y - 14;
      model.frame += 1;
      if (model.frame % 3 === 0) {
        syncUiFromModel();
      }
      return;
    }

    if (model.leftPressed) {
      model.paddle.x = clamp(model.paddle.x - model.paddle.speed, 8, GAME_WIDTH - model.paddle.w - 8);
    }
    if (model.rightPressed) {
      model.paddle.x = clamp(model.paddle.x + model.paddle.speed, 8, GAME_WIDTH - model.paddle.w - 8);
    }

    model.ball.x += model.ball.vx;
    model.ball.y += model.ball.vy;

    if (model.ball.x - model.ball.radius <= 8 || model.ball.x + model.ball.radius >= GAME_WIDTH - 8) {
      model.ball.vx *= -1;
      playTick(460, 18);
    }
    if (model.ball.y - model.ball.radius <= 8) {
      model.ball.vy *= -1;
      playTick(500, 18);
    }

    if (
      model.ball.y + model.ball.radius >= model.paddle.y
      && model.ball.x >= model.paddle.x
      && model.ball.x <= model.paddle.x + model.paddle.w
      && model.ball.y <= model.paddle.y + model.paddle.h + model.ball.radius
      && model.ball.vy > 0
    ) {
      const impact = (model.ball.x - (model.paddle.x + model.paddle.w / 2)) / (model.paddle.w / 2);
      model.ball.vx = clamp(impact * 5.5, -5.5, 5.5);
      model.ball.vy = -Math.max(2.8, Math.abs(model.ball.vy));
      playTick(580, 20);
    }

    let hitBrick = false;
    model.bricks.forEach((brick) => {
      if (!brick.alive || hitBrick) return;
      const withinX = model.ball.x + model.ball.radius >= brick.x
        && model.ball.x - model.ball.radius <= brick.x + brick.w;
      const withinY = model.ball.y + model.ball.radius >= brick.y
        && model.ball.y - model.ball.radius <= brick.y + brick.h;
      if (!withinX || !withinY) return;

      brick.alive = false;
      model.score += brick.points;
      hitBrick = true;
      model.ball.vy *= -1;
      playTick(680, 24);
    });

    if (model.bricks.every((brick) => !brick.alive)) {
      model.level += 1;
      model.bricks = createBricks();
      model.paddle.w = clamp(model.paddle.w - 5, 76, 120);
      model.ball.vx *= 1.08;
      model.ball.vy *= 1.08;
      resetBallToPaddle();
      model.waitingForLaunch = true;
      setStatusMessage(`Level ${model.level} started.`);
      setOverlay({
        title: `Level ${model.level}`,
        subtitle: 'Click to launch ball',
      });
    }

    if (model.ball.y - model.ball.radius > GAME_HEIGHT) {
      model.lives -= 1;
      playTick(260, 42);
      if (model.lives <= 0) {
        await finishRound();
        return;
      }
      model.running = false;
      resetBallToPaddle();
      model.waitingForLaunch = true;
      syncUiFromModel();
      setStatusMessage(`Ball lost. ${model.lives} lives remaining.`);
      setOverlay({
        title: `Ball lost - lives ${model.lives}`,
        subtitle: 'Next ball in 5 seconds',
      });
      if (pauseTimerRef.current) {
        window.clearTimeout(pauseTimerRef.current);
      }
      pauseTimerRef.current = window.setTimeout(() => {
        pauseTimerRef.current = 0;
        setOverlay({
          title: `Lives ${modelRef.current.lives}`,
          subtitle: 'Click to launch ball',
        });
        setStatusMessage('Click canvas to launch next ball.');
        modelRef.current.running = true;
        const tick = async () => {
          await updateModel();
          draw();
          if (modelRef.current.running) {
            rafRef.current = window.requestAnimationFrame(tick);
          }
        };
        rafRef.current = window.requestAnimationFrame(tick);
      }, 5000);
      return;
    }

    model.frame += 1;
    if (model.frame % 3 === 0) {
      syncUiFromModel();
    }
  }, [draw, finishRound, playTick, resetBallToPaddle, syncUiFromModel]);

  const loop = useCallback(async () => {
    await updateModel();
    draw();
    if (modelRef.current.running) {
      rafRef.current = window.requestAnimationFrame(loop);
    }
  }, [draw, updateModel]);

  const startGame = useCallback(() => {
    unlockAudio();
    if (pauseTimerRef.current) {
      window.clearTimeout(pauseTimerRef.current);
      pauseTimerRef.current = 0;
    }
    modelRef.current = createInitialModel();
    modelRef.current.running = true;
    modelRef.current.waitingForLaunch = true;
    syncUiFromModel();
    setGameState('playing');
    setStatusMessage('Use left/right arrows, then click canvas to launch.');
    setOverlay({
      title: 'Ready',
      subtitle: 'Click to launch ball',
    });
    if (rafRef.current) {
      window.cancelAnimationFrame(rafRef.current);
    }
    rafRef.current = window.requestAnimationFrame(loop);
    canvasRef.current?.focus();
  }, [loop, syncUiFromModel, unlockAudio]);

  const stopGame = useCallback(() => {
    modelRef.current.running = false;
    if (pauseTimerRef.current) {
      window.clearTimeout(pauseTimerRef.current);
      pauseTimerRef.current = 0;
    }
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

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const wrap = canvasWrapRef.current;
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
    const wrap = canvasWrapRef.current;
    if (!wrap) return undefined;
    const onUnlock = () => unlockAudio();
    wrap.addEventListener('pointerdown', onUnlock);
    return () => wrap.removeEventListener('pointerdown', onUnlock);
  }, [unlockAudio]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (!isPanelActive || isEditableTarget(event)) return;
      if (event.key === 'ArrowLeft') {
        modelRef.current.leftPressed = true;
        event.preventDefault();
      } else if (event.key === 'ArrowRight') {
        modelRef.current.rightPressed = true;
        event.preventDefault();
      } else if (event.key === ' ' && gameState !== 'playing') {
        startGame();
        event.preventDefault();
      }
    };

    const handleKeyUp = (event) => {
      if (!isPanelActive || isEditableTarget(event)) return;
      if (event.key === 'ArrowLeft') {
        modelRef.current.leftPressed = false;
      } else if (event.key === 'ArrowRight') {
        modelRef.current.rightPressed = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameState, isPanelActive, startGame]);

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
        rafRef.current = window.requestAnimationFrame(loop);
        return;
      }
      setOverlay((prev) => (prev?.title === 'Resuming' ? { title: 'Resuming', subtitle: `${count}` } : prev));
      setStatusMessage(`Resuming in ${count}...`);
    }, 1000);
  }, [clearInactiveResumeCountdown, gameState, isPanelActive, loop]);

  const handleCanvasMouseMove = (event) => {
    const canvas = canvasRef.current;
    if (!canvas || gameState !== 'playing') return;
    const rect = canvas.getBoundingClientRect();
    const { scale, offsetX } = renderMetricsRef.current;
    const localX = ((event.clientX - rect.left) - offsetX) / Math.max(scale, 0.0001);
    modelRef.current.paddle.x = clamp(localX - modelRef.current.paddle.w / 2, 8, GAME_WIDTH - modelRef.current.paddle.w - 8);
  };

  const handleCanvasClick = () => {
    if (gameState !== 'playing') return;
    const model = modelRef.current;
    if (!model.running) return;
    if (!model.waitingForLaunch) return;
    model.waitingForLaunch = false;
    model.ball.vx = 3 * (Math.random() > 0.5 ? 1 : -1);
    model.ball.vy = -3.2;
    setOverlay(null);
    setStatusMessage('Ball launched.');
    if (soundEnabled) {
      playTick(720, 18);
    }
  };

  const gameActionLabel = gameState === 'playing' ? 'Restart' : 'Start';
  const topRows = Array.isArray(leaderboard?.top) ? leaderboard.top : [];
  const recentRows = Array.isArray(leaderboard?.recent) ? leaderboard.recent : [];

  return (
    <div
      className={`talia-report breakout-game ${isPanelActive ? '' : 'talia-game-panel--inactive'}`}
      role="region"
      aria-label="Breakout game panel"
    >
      <header className="talia-report__header">
        <div className="talia-report__header-left">
          <h2 className="talia-report__title">Breakout</h2>
          <p className="talia-report__subtitle">Self-contained panel game with per-user score tracking.</p>
        </div>
        <div className="talia-report__actions">
          <button type="button" className="talia-btn talia-btn--small talia-btn--primary" onClick={startGame}>
            {gameActionLabel}
          </button>
          <button
            type="button"
            className={`talia-btn talia-btn--small ${soundEnabled ? 'talia-btn--active' : ''}`}
            onClick={() => setSoundEnabled((prev) => !prev)}
            title="Toggle subtle game sound"
          >
            {soundEnabled ? 'Sound On' : 'Sound Off'}
          </button>
          <button type="button" className="talia-btn talia-btn--small" onClick={onReloadScore}>
            Reload Score
          </button>
        </div>
      </header>

      <main className="talia-report__content breakout-game__content">
        <div className="breakout-game__hud" role="status" aria-live="polite">
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

        <div ref={canvasWrapRef} className="breakout-game__canvas-wrap">
          <canvas
            ref={canvasRef}
            className="breakout-game__canvas"
            onMouseMove={handleCanvasMouseMove}
            onClick={handleCanvasClick}
            tabIndex={0}
            aria-label="Breakout game area"
          />
          {overlay && (
            <div className="breakout-game__overlay" role="status" aria-live="polite">
              <div className="breakout-game__overlay-panel">
                <div className="breakout-game__overlay-title">{overlay.title}</div>
                {overlay.subtitle && (
                  <div className="breakout-game__overlay-subtitle">{overlay.subtitle}</div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="breakout-game__meta">
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

export default BreakoutGamePresenter;
