import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import GameScorePopover from '../../shared/games/GameScorePopover';
import usePanelTabActive from '../../../hooks/usePanelTabActive';
import usePanelPaused from '../../../hooks/usePanelPaused';
import { isEditableTarget } from '../../shared/games/keyboardGuards';

const GAME_WIDTH = 680;
const GAME_HEIGHT = 420;

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

const createModel = () => ({
  running: false,
  waitingForServe: true,
  score: 0,
  lives: 3,
  paddle: { x: 28, y: GAME_HEIGHT / 2 - 46, w: 10, h: 92, speed: 7.2 },
  ai: { x: GAME_WIDTH - 38, y: GAME_HEIGHT / 2 - 46, w: 10, h: 92, speed: 4.6 },
  ball: { x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2, vx: 4.2, vy: 2.4, r: 7 },
  upPressed: false,
  downPressed: false,
  frame: 0,
});

const PongPresenter = ({
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
  const isPanelPaused = usePanelPaused(panelInstanceId, 'pong');
  const isPanelExecutionActive = isPanelActive && !isPanelPaused;
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const rafRef = useRef(0);
  const pausedByInactiveRef = useRef(false);
  const inactiveResumeIntervalRef = useRef(0);
  const modelRef = useRef(createModel());
  const renderMetricsRef = useRef({ scale: 1, offsetX: 0, offsetY: 0 });
  const audioContextRef = useRef(null);
  const audioMasterGainRef = useRef(null);
  const lastSoundAtRef = useRef(0);
  const [gameState, setGameState] = useState('idle');
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [statusMessage, setStatusMessage] = useState('Press Start, then click to serve.');
  const [overlay, setOverlay] = useState(null);
  const [showScorePopover, setShowScorePopover] = useState(false);

  const userLabel = useMemo(() => String(userId || 'anonymous'), [userId]);
  const updatedLabel = useMemo(() => {
    if (!updatedAt) return 'Not saved yet';
    const date = new Date(updatedAt);
    return Number.isNaN(date.getTime()) ? 'Not saved yet' : date.toLocaleString();
  }, [updatedAt]);

  const syncUi = useCallback(() => {
    setScore(modelRef.current.score);
    setLives(modelRef.current.lives);
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

  const playTone = useCallback((freq = 420, durationMs = 30, type = 'square', volume = 0.32) => {
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
    const { paddle, ai, ball } = m;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const scale = Math.min(canvas.width / GAME_WIDTH, canvas.height / GAME_HEIGHT);
    const offsetX = Math.round((canvas.width - GAME_WIDTH * scale) / 2);
    const offsetY = Math.round((canvas.height - GAME_HEIGHT * scale) / 2);
    renderMetricsRef.current = { scale, offsetX, offsetY };
    ctx.save();
    ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);

    ctx.fillStyle = 'rgba(8, 13, 28, 0.95)';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    ctx.strokeStyle = 'rgba(146, 168, 211, 0.24)';
    ctx.strokeRect(8, 8, GAME_WIDTH - 16, GAME_HEIGHT - 16);

    ctx.setLineDash([8, 8]);
    ctx.strokeStyle = 'rgba(150, 170, 220, 0.28)';
    ctx.beginPath();
    ctx.moveTo(GAME_WIDTH / 2, 12);
    ctx.lineTo(GAME_WIDTH / 2, GAME_HEIGHT - 12);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = 'rgba(244, 231, 150, 0.95)';
    ctx.fillRect(paddle.x, paddle.y, paddle.w, paddle.h);
    ctx.fillStyle = 'rgba(132, 196, 255, 0.95)';
    ctx.fillRect(ai.x, ai.y, ai.w, ai.h);

    ctx.fillStyle = 'rgba(245, 249, 255, 0.95)';
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.closePath();

    ctx.restore();
  }, []);

  const resetBall = useCallback((serveToRight = true) => {
    const m = modelRef.current;
    m.ball.x = GAME_WIDTH / 2;
    m.ball.y = GAME_HEIGHT / 2;
    m.ball.vx = (serveToRight ? 1 : -1) * (4 + Math.random() * 0.9);
    m.ball.vy = (Math.random() > 0.5 ? 1 : -1) * (2 + Math.random() * 1.2);
    m.waitingForServe = true;
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
    playTone(360, 80, 'triangle', 0.44);
    setTimeout(() => playTone(260, 120, 'triangle', 0.44), 90);
    await onSaveScore(finalScore);
  }, [onSaveScore, playTone, stopGame]);

  const updateModel = useCallback(async () => {
    const m = modelRef.current;
    if (!m.running) return;
    const { paddle, ai, ball } = m;

    if (m.upPressed) paddle.y = clamp(paddle.y - paddle.speed, 10, GAME_HEIGHT - paddle.h - 10);
    if (m.downPressed) paddle.y = clamp(paddle.y + paddle.speed, 10, GAME_HEIGHT - paddle.h - 10);

    const aiTarget = ball.y - ai.h / 2;
    const aiStep = clamp(aiTarget - ai.y, -ai.speed, ai.speed);
    ai.y = clamp(ai.y + aiStep, 10, GAME_HEIGHT - ai.h - 10);

    if (m.waitingForServe) {
      ball.y = paddle.y + paddle.h / 2;
      ball.x = paddle.x + paddle.w + ball.r + 4;
      m.frame += 1;
      if (m.frame % 3 === 0) syncUi();
      return;
    }

    ball.x += ball.vx;
    ball.y += ball.vy;

    if (ball.y - ball.r <= 10 || ball.y + ball.r >= GAME_HEIGHT - 10) {
      ball.vy *= -1;
      playTone(460, 22, 'square', 0.26);
    }

    const hitPlayer = ball.x - ball.r <= paddle.x + paddle.w
      && ball.y >= paddle.y
      && ball.y <= paddle.y + paddle.h
      && ball.vx < 0;
    if (hitPlayer) {
      const impact = (ball.y - (paddle.y + paddle.h / 2)) / (paddle.h / 2);
      ball.vx = Math.abs(ball.vx) + 0.25;
      ball.vy = clamp(impact * 4.2, -4.2, 4.2);
      m.score += 5;
      playTone(620, 24, 'square', 0.3);
    }

    const hitAi = ball.x + ball.r >= ai.x
      && ball.y >= ai.y
      && ball.y <= ai.y + ai.h
      && ball.vx > 0;
    if (hitAi) {
      const impact = (ball.y - (ai.y + ai.h / 2)) / (ai.h / 2);
      ball.vx = -Math.abs(ball.vx) - 0.22;
      ball.vy = clamp(impact * 3.9, -3.9, 3.9);
      playTone(520, 20, 'triangle', 0.24);
    }

    if (ball.x + ball.r >= GAME_WIDTH - 10) {
      m.score += 25;
      playTone(760, 36, 'triangle', 0.33);
      setOverlay({ title: 'Point!', subtitle: 'Click to serve next ball' });
      resetBall(false);
    }

    if (ball.x - ball.r <= 10) {
      m.lives -= 1;
      playTone(220, 70, 'sawtooth', 0.36);
      if (m.lives <= 0) {
        await finishGame('No lives remaining');
        return;
      }
      setOverlay({ title: `Missed - lives ${m.lives}`, subtitle: 'Click to serve next ball' });
      resetBall(true);
    }

    m.frame += 1;
    if (m.frame % 3 === 0) syncUi();
  }, [finishGame, playTone, resetBall, syncUi]);

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
    setStatusMessage('W/S or Arrow keys move. Click to serve.');
    setOverlay({ title: 'Ready', subtitle: 'Click to serve' });
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
      const m = modelRef.current;
      if (event.key === 'ArrowUp' || event.key === 'w' || event.key === 'W') m.upPressed = true;
      if (event.key === 'ArrowDown' || event.key === 's' || event.key === 'S') m.downPressed = true;
      if (['ArrowUp', 'ArrowDown', 'w', 'W', 's', 'S'].includes(event.key)) event.preventDefault();
    };
    const onKeyUp = (event) => {
      if (!isPanelExecutionActive || isEditableTarget(event)) return;
      const m = modelRef.current;
      if (event.key === 'ArrowUp' || event.key === 'w' || event.key === 'W') m.upPressed = false;
      if (event.key === 'ArrowDown' || event.key === 's' || event.key === 'S') m.downPressed = false;
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

  const handleCanvasClick = () => {
    const m = modelRef.current;
    if (gameState !== 'playing' || !m.running || !m.waitingForServe) return;
    m.waitingForServe = false;
    setOverlay(null);
    setStatusMessage('Ball in play.');
    playTone(680, 20, 'square', 0.28);
  };

  const handleMouseMove = (event) => {
    if (gameState !== 'playing') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const { scale, offsetY } = renderMetricsRef.current;
    const localY = ((event.clientY - rect.top) - offsetY) / Math.max(scale, 0.0001);
    modelRef.current.paddle.y = clamp(localY - modelRef.current.paddle.h / 2, 10, GAME_HEIGHT - modelRef.current.paddle.h - 10);
  };

  const topRows = Array.isArray(leaderboard?.top) ? leaderboard.top : [];
  const recentRows = Array.isArray(leaderboard?.recent) ? leaderboard.recent : [];
  const actionLabel = gameState === 'playing' ? 'Restart' : 'Start';

  return (
    <div
      className={`talia-report pong-game ${isPanelExecutionActive ? '' : 'talia-game-panel--inactive'}`}
      role="region"
      aria-label="Pong game panel"
    >
      <header className="talia-report__header">
        <div className="talia-report__header-left">
          <h2 className="talia-report__title">Pong</h2>
          <p className="talia-report__subtitle">Contained panel demo with shared per-user score tracking.</p>
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

      <main className="talia-report__content pong-game__content">
        <div className="pong-game__hud" role="status" aria-live="polite">
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

        <div ref={wrapRef} className="pong-game__canvas-wrap">
          <canvas
            ref={canvasRef}
            className="pong-game__canvas"
            tabIndex={0}
            aria-label="Pong game area"
            onClick={handleCanvasClick}
            onMouseMove={handleMouseMove}
          />
          {overlay && (
            <div className="pong-game__overlay" role="status" aria-live="polite">
              <div className="pong-game__overlay-panel">
                <div className="pong-game__overlay-title">{overlay.title}</div>
                {overlay.subtitle && <div className="pong-game__overlay-subtitle">{overlay.subtitle}</div>}
              </div>
            </div>
          )}
        </div>

        <div className="pong-game__meta">
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

export default PongPresenter;
