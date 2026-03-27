import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ArcadeGameCanvasOverlay from '../../shared/games/ArcadeGameCanvasOverlay';
import ArcadeGameScoreHud from '../../shared/games/ArcadeGameScoreHud';
import ArcadeGameDifficultyToggle from '../../shared/games/ArcadeGameDifficultyToggle';
import {
  buildArcadeIdleSubtitle,
  formatArcadeOverlaySubtitle,
  getArcadeOverlayTone,
} from '../../shared/games/arcadeGameUi';
import { ARCADE_DIFFICULTY_NORMAL, isArcadeEasy } from '../../shared/games/arcadeDifficulty';
import useArcadeGameAudio from '../../shared/games/useArcadeGameAudio';
import { useArcadeGameLoop } from '../../shared/games/useArcadeGameLoop';
import { filterRowsByGame, getMaxHighScore } from '../../shared/games/leaderboardScope';
import usePanelTabActive from '../../../hooks/usePanelTabActive';
import usePanelPaused from '../../../hooks/usePanelPaused';
import { isEditableTarget } from '../../shared/games/keyboardGuards';
import { useArcadeGameOverlayResume } from '../../shared/games/useArcadeGameOverlayResume';
import useGamePanelPauseResume from '../../shared/games/useGamePanelPauseResume';
import {
  armExtraSpawn,
  createExtraSpawnState,
  isExtraSpawnDue,
} from '../../shared/games/arcadeGameExtra';
import {
  addArcadeScore,
  armArcadeDoubleScore,
} from '../../shared/games/arcadeDoubleScore';
import useArcadeDoubleScoreHud from '../../shared/games/useArcadeDoubleScoreHud';

const GAME_WIDTH = 680;
const GAME_HEIGHT = 430;
const GAME_OVER_HOLD_MS = 5000;
const PANEL_COMPONENT_ID = 'asteroids';

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
  doubleScoreUntil: 0,
  difficulty: ARCADE_DIFFICULTY_NORMAL,
  wave: 1,
  lives: 3,
  ship: { x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2, vx: 0, vy: 0, angle: -Math.PI / 2 },
  bullets: [],
  asteroids: [createAsteroid(3), createAsteroid(3), createAsteroid(2)],
  keys: { left: false, right: false, thrust: false, fire: false },
  fireCooldown: 0,
  frame: 0,
  extraSpawn: createExtraSpawnState(),
  extraUfo: null,
});

const AsteroidsPresenter = ({
  panelInstanceId,
  gameId,
  gameSoundEnabled,
  highScore,
  onSaveScore,
  leaderboard,
  leaderboardLoading,
}) => {
  const isPanelActive = usePanelTabActive(panelInstanceId);
  const isPanelPaused = usePanelPaused(panelInstanceId, PANEL_COMPONENT_ID);
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const modelRef = useRef(createModel());
  const rafRef = useRef(0);
  const { unlockAudio, playTone, disposeAudio } = useArcadeGameAudio(gameSoundEnabled, 0.023);
  const gameOverReleaseTimeoutRef = useRef(0);
  const gameOverCountdownIntervalRef = useRef(0);
  const [gameState, setGameState] = useState('idle');
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [statusMessage, setStatusMessage] = useState('Press Start and use arrows + Space.');
  const [overlay, setOverlay] = useState(null);
  const [restartInSeconds, setRestartInSeconds] = useState(0);
  const [difficulty, setDifficulty] = useState(ARCADE_DIFFICULTY_NORMAL);
  const doubleScoreHud = useArcadeDoubleScoreHud(modelRef, gameState === 'playing');

  const syncUi = useCallback(() => {
    const m = modelRef.current;
    setScore(m.score);
    setLives(m.lives);
  }, []);

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

    if (m.extraUfo) {
      const u = m.extraUfo;
      ctx.fillStyle = u.variant === 'b' ? 'rgba(255, 120, 200, 0.9)' : 'rgba(160, 220, 255, 0.9)';
      ctx.beginPath();
      ctx.ellipse(u.x, u.y, u.r * 1.1, u.r * 0.62, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 200, 0.85)';
      ctx.fillRect(u.x - 6, u.y - 4, 4, 3);
      ctx.fillRect(u.x + 2, u.y - 4, 4, 3);
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

  const clearGameOverHold = useCallback(() => {
    if (gameOverReleaseTimeoutRef.current) {
      window.clearTimeout(gameOverReleaseTimeoutRef.current);
      gameOverReleaseTimeoutRef.current = 0;
    }
    if (gameOverCountdownIntervalRef.current) {
      window.clearInterval(gameOverCountdownIntervalRef.current);
      gameOverCountdownIntervalRef.current = 0;
    }
    setRestartInSeconds(0);
  }, []);

  const beginGameOverHold = useCallback(() => {
    clearGameOverHold();
    const releaseAt = Date.now() + GAME_OVER_HOLD_MS;
    setRestartInSeconds(Math.ceil(GAME_OVER_HOLD_MS / 1000));
    gameOverCountdownIntervalRef.current = window.setInterval(() => {
      const remainingMs = releaseAt - Date.now();
      if (remainingMs <= 0) {
        if (gameOverCountdownIntervalRef.current) {
          window.clearInterval(gameOverCountdownIntervalRef.current);
          gameOverCountdownIntervalRef.current = 0;
        }
        setRestartInSeconds(0);
        return;
      }
      setRestartInSeconds(Math.ceil(remainingMs / 1000));
    }, 250);
    gameOverReleaseTimeoutRef.current = window.setTimeout(() => {
      gameOverReleaseTimeoutRef.current = 0;
      if (gameOverCountdownIntervalRef.current) {
        window.clearInterval(gameOverCountdownIntervalRef.current);
        gameOverCountdownIntervalRef.current = 0;
      }
      setRestartInSeconds(0);
    }, GAME_OVER_HOLD_MS);
  }, [clearGameOverHold]);

  const finishGame = useCallback(async (reason) => {
    stopGame();
    setGameState('over');
    const finalScore = modelRef.current.score;
    setOverlay({ title: 'Game Over', subtitle: `Final score: ${finalScore}` });
    setStatusMessage(`Game over: ${reason}`);
    beginGameOverHold();
    playTone(340, 80, 'triangle', 0.45);
    setTimeout(() => playTone(250, 120, 'triangle', 0.45), 100);
    await onSaveScore(finalScore);
  }, [beginGameOverHold, onSaveScore, playTone, stopGame]);

  const handleShipCollision = useCallback(async () => {
    const m = modelRef.current;
    m.lives -= 1;
    syncUi();
    playTone(200, 80, 'sawtooth', 0.45);
    setTimeout(() => playTone(140, 120, 'triangle', 0.42), 90);
    if (m.lives <= 0) {
      await finishGame('Ship destroyed');
      return;
    }
    m.ship.x = GAME_WIDTH / 2;
    m.ship.y = GAME_HEIGHT / 2;
    m.ship.vx = 0;
    m.ship.vy = 0;
    m.ship.angle = -Math.PI / 2;
    setOverlay({ title: 'Life Lost', subtitle: `${m.lives} lives left` });
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

    if (isExtraSpawnDue(m.extraSpawn, m.frame, m.extraUfo != null)) {
      const fromLeft = Math.random() < 0.5;
      m.extraUfo = {
        x: fromLeft ? -22 : GAME_WIDTH + 22,
        y: 52 + Math.random() * (GAME_HEIGHT - 120),
        vx: fromLeft ? 2.55 : -2.55,
        vy: (Math.random() - 0.5) * 0.4,
        r: 15,
        points: Math.random() < 0.55 ? 200 : 450,
        wobble: Math.random() * Math.PI * 2,
        variant: Math.random() < 0.5 ? 'a' : 'b',
      };
    }
    if (m.extraUfo) {
      const u = m.extraUfo;
      const ufoMult = isArcadeEasy(m) ? 0.84 : 1;
      u.x += u.vx * ufoMult;
      u.wobble += 0.1;
      u.y += Math.sin(u.wobble) * 0.65 + u.vy;
      u.y = Math.max(28, Math.min(GAME_HEIGHT - 28, u.y));
      if (u.x < -36 || u.x > GAME_WIDTH + 36) {
        m.extraUfo = null;
        armExtraSpawn(m.extraSpawn, m.frame, 520, 960);
      }
    }

    m.bullets.forEach((b) => {
      if (!m.extraUfo) return;
      const u = m.extraUfo;
      const dx = b.x - u.x;
      const dy = b.y - u.y;
      if (dx * dx + dy * dy <= (u.r + 4) ** 2) {
        armArcadeDoubleScore(m);
        addArcadeScore(m, u.points);
        b.ttl = 0;
        m.extraUfo = null;
        armExtraSpawn(m.extraSpawn, m.frame, 520, 960);
        playTone(660, 40, 'triangle', 0.4);
      }
    });
    m.bullets = m.bullets.filter((b) => b.ttl > 0);

    const am = isArcadeEasy(m) ? 0.82 : 1;
    m.asteroids = m.asteroids.map((a) => ({
      ...a,
      x: wrap(a.x + a.vx * am, GAME_WIDTH),
      y: wrap(a.y + a.vy * am, GAME_HEIGHT),
      angle: a.angle + a.spin * am,
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
        addArcadeScore(m, a.size === 3 ? 20 : a.size === 2 ? 50 : 100);
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
      const w = m.wave || 1;
      const celeb = 100 + w * 42;
      addArcadeScore(m, 200);
      addArcadeScore(m, celeb);
      m.wave = w + 1;
      m.asteroids.push(createAsteroid(3), createAsteroid(3), createAsteroid(2), createAsteroid(2));
      syncUi();
      stopGame();
      setOverlay({
        title: 'Sector clear!',
        subtitle: `Wave ${w} · +${celeb} celebration`,
        tone: 'win',
      });
      setStatusMessage('New asteroid field');
      playTone(860, 50, 'triangle', 0.34);
      m.frame += 1;
      return;
    }

    m.frame += 1;
    if (m.frame % 3 === 0) syncUi();
  }, [handleShipCollision, playTone, setOverlay, setStatusMessage, stopGame, syncUi]);

  const loop = useArcadeGameLoop({ modelRef, rafRef, updateModel, draw });

  const resumePlaying = useCallback(() => {
    setOverlay((prev) => (prev?.title === 'Resuming' ? null : prev));
    setStatusMessage('Resumed.');
    modelRef.current.running = true;
    if (rafRef.current) {
      window.cancelAnimationFrame(rafRef.current);
    }
    rafRef.current = window.requestAnimationFrame(loop);
  }, [loop]);

  const { isPanelExecutionActive, clearResumeInterval: clearInactiveResumeCountdown } = useGamePanelPauseResume({
    isPanelActive,
    isPanelPaused,
    gameState,
    modelRef,
    rafRef,
    setOverlay,
    setStatusMessage,
    resumePlaying,
  });

  const dismissWinAndResume = useCallback(() => {
    setOverlay(null);
    modelRef.current.running = true;
    setStatusMessage('Arrow keys turn/thrust, Space fires.');
    if (rafRef.current) {
      window.cancelAnimationFrame(rafRef.current);
    }
    rafRef.current = window.requestAnimationFrame(loop);
    canvasRef.current?.focus();
  }, [loop, setStatusMessage]);

  const startGame = useCallback(() => {
    if (restartInSeconds > 0) return;
    clearGameOverHold();
    unlockAudio();
    modelRef.current = createModel();
    modelRef.current.difficulty = difficulty;
    armExtraSpawn(modelRef.current.extraSpawn, 0, 400, 720);
    modelRef.current.running = true;
    setGameState('playing');
    setStatusMessage('Arrow keys turn/thrust, Space fires.');
    setOverlay(null);
    syncUi();
    if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
    rafRef.current = window.requestAnimationFrame(loop);
    canvasRef.current?.focus();
  }, [clearGameOverHold, difficulty, loop, restartInSeconds, syncUi, unlockAudio]);

  const onOverlayPrimaryClick = useCallback(() => {
    if (overlay?.tone === 'win') {
      dismissWinAndResume();
      return;
    }
    startGame();
  }, [dismissWinAndResume, overlay?.tone, startGame]);

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
    clearGameOverHold();
    disposeAudio();
  }, [clearGameOverHold, clearInactiveResumeCountdown, disposeAudio, stopGame]);

  const topRows = Array.isArray(leaderboard?.top) ? leaderboard.top : [];
  const recentRows = Array.isArray(leaderboard?.recent) ? leaderboard.recent : [];
  const currentGameTopRows = useMemo(() => filterRowsByGame(topRows, gameId), [gameId, topRows]);
  const currentGameRecentRows = useMemo(() => filterRowsByGame(recentRows, gameId), [gameId, recentRows]);
  const globalHighScore = useMemo(() => getMaxHighScore(currentGameTopRows), [currentGameTopRows]);
  const actionLabel = gameState === 'over' ? 'Insert Coin' : (gameState === 'playing' ? 'Restart' : 'Start');
  const showEntryOverlay = gameState !== 'playing';
  const isGameOverHoldActive = gameState === 'over' && restartInSeconds > 0;
  const overlayTitle = overlay?.title || (isGameOverHoldActive ? 'Game Over' : 'Ready');
  const overlaySubtitle = formatArcadeOverlaySubtitle({
    overlaySubtitle: overlay?.subtitle,
    isGameOverHoldActive,
    score,
    restartInSeconds,
    defaultIdle: buildArcadeIdleSubtitle(PANEL_COMPONENT_ID),
  });
  const showStartAction = (showEntryOverlay && !(gameState === 'over' && restartInSeconds > 0))
    || overlay?.tone === 'win';
  const isLifeLossMessage = /(life lost|ship hit|caught|missed)/i.test(overlayTitle) || /(life lost|ship hit|caught|missed)/i.test(statusMessage);
  const overlayTone = getArcadeOverlayTone({
    explicitTone: overlay?.tone,
    overlayTitle,
    isGameOverHoldActive,
    isLifeLossMessage,
  });
  const overlayPrimaryLabel = overlay?.tone === 'win' ? 'Continue' : actionLabel;

  const { onOverlayPointer, arcadeOverlayClickable } = useArcadeGameOverlayResume({
    panelInstanceId,
    panelComponentId: PANEL_COMPONENT_ID,
    overlayTitle,
    isPanelPaused,
    isPanelActive,
  });

  return (
    <div
      className={`talia-report asteroids-game ${isPanelExecutionActive ? '' : 'talia-game-panel--inactive'}`}
      role="region"
      aria-label="Asteroids game panel"
    >
      <header className="talia-report__header">
        <div className="talia-report__header-left">
          <h2 className="talia-report__title">Asteroids</h2>
          <p className="talia-report__subtitle">Turn, thrust, shoot rocks and saucers.</p>
        </div>
        <ArcadeGameDifficultyToggle
          value={difficulty}
          onChange={setDifficulty}
          disabled={gameState === 'playing'}
        />
      </header>

      <main className="talia-report__content talia-game-panel-body">
        <div ref={wrapRef} className="talia-game-canvas-shell">
          <canvas ref={canvasRef} className="talia-arcade-canvas" tabIndex={0} aria-label="Asteroids game area" />
          <ArcadeGameScoreHud
            currentScore={score}
            userHighScore={highScore}
            totalHighScore={globalHighScore}
            meta={`Lives: ${lives}`}
            doubleScoreSeconds={doubleScoreHud}
          />
          <ArcadeGameCanvasOverlay
            open={Boolean(overlay || showEntryOverlay)}
            tone={overlayTone}
            title={overlayTitle}
            subtitle={overlaySubtitle}
            showStartButton={showStartAction}
            startLabel={overlayPrimaryLabel}
            onStartClick={onOverlayPrimaryClick}
            onOverlayPointer={onOverlayPointer}
            arcadeOverlayClickable={arcadeOverlayClickable}
            gameState={gameState}
            leaderboardLoading={leaderboardLoading}
            topRows={currentGameTopRows}
            recentRows={currentGameRecentRows}
          />
        </div>
      </main>
    </div>
  );
};

export default AsteroidsPresenter;
