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

const GAME_WIDTH = 640;
const GAME_HEIGHT = 420;
const BRICK_ROWS = 5;
const BRICK_COLS = 9;
const GAME_OVER_HOLD_MS = 5000;
const PANEL_COMPONENT_ID = 'breakout-game';

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
  doubleScoreUntil: 0,
  difficulty: ARCADE_DIFFICULTY_NORMAL,
  lives: 3,
  level: 1,
  ball: { x: GAME_WIDTH / 2, y: GAME_HEIGHT - 110, vx: 3.1, vy: -3.2, radius: 7 },
  paddle: { x: GAME_WIDTH / 2 - 52, y: GAME_HEIGHT - 50, w: 104, h: 12, speed: 7.5 },
  bricks: createBricks(),
  leftPressed: false,
  rightPressed: false,
  frame: 0,
  extraSpawn: createExtraSpawnState(),
  extra: null,
});

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const BreakoutGamePresenter = ({
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
  const canvasWrapRef = useRef(null);
  const rafRef = useRef(0);
  const modelRef = useRef(createInitialModel());
  const {
    ensureAudioContext,
    audioMasterGainRef,
    unlockAudio,
    playBeep: playTick,
    disposeAudio,
  } = useArcadeGameAudio(gameSoundEnabled, 0.025);
  const renderMetricsRef = useRef({ scale: 1, offsetX: 0, offsetY: 0 });
  const gameOverReleaseTimeoutRef = useRef(0);
  const gameOverCountdownIntervalRef = useRef(0);
  const [gameState, setGameState] = useState('idle');
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [statusMessage, setStatusMessage] = useState('Press Start to play.');
  const [overlay, setOverlay] = useState(null);
  const [restartInSeconds, setRestartInSeconds] = useState(0);
  const [difficulty, setDifficulty] = useState(ARCADE_DIFFICULTY_NORMAL);
  const doubleScoreHud = useArcadeDoubleScoreHud(modelRef, gameState === 'playing');

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

    if (model.extra) {
      const e = model.extra;
      ctx.fillStyle = 'rgba(255, 200, 90, 0.92)';
      ctx.fillRect(e.x, e.y, e.w, e.h);
      ctx.strokeStyle = 'rgba(255, 240, 200, 0.85)';
      ctx.strokeRect(e.x, e.y, e.w, e.h);
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(120, 40, 20, 0.95)';
      ctx.fillText('★', e.x + e.w / 2, e.y + e.h / 2);
    }

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

  const finishRound = useCallback(async () => {
    stopGame();
    const model = modelRef.current;
    setGameState('over');
    setStatusMessage(`Game over. Final score: ${model.score}`);
    setOverlay({
      title: 'Game Over',
      subtitle: `Final score: ${model.score}`,
    });
    beginGameOverHold();
    // Dramatic but short game-over cue.
    if (gameSoundEnabled !== false) {
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
  }, [beginGameOverHold, ensureAudioContext, gameSoundEnabled, onSaveScore, stopGame]);

  const resetBallToPaddle = useCallback(() => {
    const model = modelRef.current;
    model.ball.x = model.paddle.x + model.paddle.w / 2;
    model.ball.y = model.paddle.y - 14;
    model.ball.vx = 3 * (Math.random() > 0.5 ? 1 : -1);
    model.ball.vy = -3.2;
  }, []);

  const armLaunch = useCallback((title = 'Ready', subtitle = 'Press Left/Right or move mouse to launch') => {
    const model = modelRef.current;
    model.waitingForLaunch = true;
    setOverlay({ title, subtitle });
    setStatusMessage('Ready to launch.');
  }, []);

  const activateLaunch = useCallback(() => {
    const model = modelRef.current;
    if (!model.running || !model.waitingForLaunch) return;
    model.waitingForLaunch = false;
    setOverlay(null);
    setStatusMessage('Ball launched.');
    playTick(720, 18);
  }, [playTick]);

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
      let nvx = clamp(impact * 5.5, -5.5, 5.5);
      if (Math.abs(nvx) < 0.85) {
        nvx = (nvx >= 0 ? 1 : -1) * 1.1;
      }
      model.ball.vx = nvx;
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
      addArcadeScore(model, brick.points);
      hitBrick = true;
      model.ball.vy *= -1;
      playTick(680, 24);
    });

    const hasActiveExtra = Boolean(model.extra);
    if (isExtraSpawnDue(model.extraSpawn, model.frame, hasActiveExtra)) {
      model.extra = {
        x: 20 + Math.random() * (GAME_WIDTH - 40 - 38),
        y: 38,
        w: 38,
        h: 15,
        vy: 1.85,
        points: 120,
      };
    }
    if (model.extra) {
      const e = model.extra;
      e.y += e.vy;
      const { ball, paddle } = model;
      const hitBall = ball.x + ball.radius >= e.x
        && ball.x - ball.radius <= e.x + e.w
        && ball.y + ball.radius >= e.y
        && ball.y - ball.radius <= e.y + e.h;
      const hitPaddle = e.y + e.h >= paddle.y
        && e.y <= paddle.y + paddle.h
        && e.x + e.w >= paddle.x
        && e.x <= paddle.x + paddle.w;
      if (hitBall || hitPaddle) {
        armArcadeDoubleScore(model);
        addArcadeScore(model, e.points);
        model.extra = null;
        playTick(800, 26);
        armExtraSpawn(model.extraSpawn, model.frame, 220, 520);
      } else if (e.y > GAME_HEIGHT) {
        model.extra = null;
        armExtraSpawn(model.extraSpawn, model.frame, 160, 400);
      }
    }

    if (model.bricks.length > 0 && model.bricks.every((brick) => !brick.alive)) {
      const prevLevel = model.level;
      const celebration = 95 + prevLevel * 28;
      addArcadeScore(model, celebration);
      model.extra = null;
      armExtraSpawn(model.extraSpawn, model.frame, 200, 480);
      model.level += 1;
      model.bricks = createBricks();
      model.paddle.w = clamp(model.paddle.w - 5, 76, 120);
      const speedUp = isArcadeEasy(model) ? 1.04 : 1.08;
      model.ball.vx *= speedUp;
      model.ball.vy *= speedUp;
      resetBallToPaddle();
      syncUiFromModel();
      stopGame();
      setOverlay({
        title: 'Stage clear!',
        subtitle: `Level ${model.level} · +${celebration} celebration`,
        tone: 'win',
      });
      setStatusMessage('Stage cleared.');
      playTick(880, 30);
      model.frame += 1;
      return;
    }

    if (model.ball.y - model.ball.radius > GAME_HEIGHT) {
      model.lives -= 1;
      playTick(260, 42);
      if (model.lives <= 0) {
        await finishRound();
        return;
      }
      model.extra = null;
      armExtraSpawn(model.extraSpawn, model.frame, 180, 420);
      model.running = true;
      resetBallToPaddle();
      model.waitingForLaunch = true;
      syncUiFromModel();
      playTick(180, 96);
      setTimeout(() => playTick(130, 126), 90);
      armLaunch(`Life Lost - ${model.lives} left`, 'Press Left/Right or move mouse to continue');
      model.frame += 1;
      if (model.frame % 3 === 0) {
        syncUiFromModel();
      }
      return;
    }

    model.frame += 1;
    if (model.frame % 3 === 0) {
      syncUiFromModel();
    }
  }, [
    armLaunch,
    finishRound,
    playTick,
    resetBallToPaddle,
    setOverlay,
    setStatusMessage,
    stopGame,
    syncUiFromModel,
  ]);

  const loop = useArcadeGameLoop({ modelRef, rafRef, updateModel, draw });

  const resumePlaying = useCallback(() => {
    modelRef.current.running = true;
    if (modelRef.current.waitingForLaunch) {
      setOverlay({ title: 'Ready', subtitle: 'Press Left/Right or move mouse to launch' });
      setStatusMessage('Ready to launch.');
    } else {
      setOverlay((prev) => (prev?.title === 'Resuming' ? null : prev));
      setStatusMessage('Resumed.');
    }
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
    const model = modelRef.current;
    model.running = true;
    armLaunch(`Level ${model.level}`, 'Press Left/Right or move mouse to launch');
    if (rafRef.current) {
      window.cancelAnimationFrame(rafRef.current);
    }
    rafRef.current = window.requestAnimationFrame(loop);
  }, [armLaunch, loop]);

  const startGame = useCallback(() => {
    if (restartInSeconds > 0) return;
    clearGameOverHold();
    unlockAudio();
    modelRef.current = createInitialModel();
    modelRef.current.difficulty = difficulty;
    if (isArcadeEasy(modelRef.current)) {
      modelRef.current.ball.vx *= 0.74;
      modelRef.current.ball.vy *= 0.74;
      modelRef.current.paddle.w = clamp(modelRef.current.paddle.w + 14, 76, 126);
      modelRef.current.paddle.speed *= 0.9;
    }
    armExtraSpawn(modelRef.current.extraSpawn, 0, 200, 520);
    modelRef.current.running = true;
    modelRef.current.waitingForLaunch = true;
    syncUiFromModel();
    setGameState('playing');
    setOverlay({ title: 'Ready', subtitle: 'Press Left/Right or move mouse to launch' });
    setStatusMessage('Ready to launch.');
    if (rafRef.current) {
      window.cancelAnimationFrame(rafRef.current);
    }
    rafRef.current = window.requestAnimationFrame(loop);
    canvasRef.current?.focus();
  }, [clearGameOverHold, difficulty, loop, restartInSeconds, syncUiFromModel, unlockAudio]);

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
    const onPointerDown = () => {
      unlockAudio();
      activateLaunch();
    };
    wrap.addEventListener('pointerdown', onPointerDown);
    return () => wrap.removeEventListener('pointerdown', onPointerDown);
  }, [activateLaunch, unlockAudio]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (!isPanelExecutionActive || isEditableTarget(event)) return;
      if (event.key === 'ArrowLeft') {
        modelRef.current.leftPressed = true;
        activateLaunch();
        event.preventDefault();
      } else if (event.key === 'ArrowRight') {
        modelRef.current.rightPressed = true;
        activateLaunch();
        event.preventDefault();
      } else if (event.key === ' ' && gameState !== 'playing') {
        startGame();
        event.preventDefault();
      }
    };

    const handleKeyUp = (event) => {
      if (!isPanelExecutionActive || isEditableTarget(event)) return;
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
  }, [activateLaunch, gameState, isPanelExecutionActive, startGame]);

  useEffect(() => () => {
    stopGame();
    clearInactiveResumeCountdown();
    clearGameOverHold();
    disposeAudio();
  }, [clearGameOverHold, clearInactiveResumeCountdown, disposeAudio, stopGame]);

  const handleCanvasMouseMove = (event) => {
    const canvas = canvasRef.current;
    if (!canvas || gameState !== 'playing') return;
    const rect = canvas.getBoundingClientRect();
    const { scale, offsetX } = renderMetricsRef.current;
    const localX = ((event.clientX - rect.left) - offsetX) / Math.max(scale, 0.0001);
    modelRef.current.paddle.x = clamp(localX - modelRef.current.paddle.w / 2, 8, GAME_WIDTH - modelRef.current.paddle.w - 8);
    if (modelRef.current.waitingForLaunch) {
      activateLaunch();
    }
  };

  const gameActionLabel = gameState === 'over' ? 'Insert Coin' : (gameState === 'playing' ? 'Restart' : 'Start');
  const topRows = Array.isArray(leaderboard?.top) ? leaderboard.top : [];
  const recentRows = Array.isArray(leaderboard?.recent) ? leaderboard.recent : [];
  const currentGameTopRows = useMemo(() => filterRowsByGame(topRows, gameId), [gameId, topRows]);
  const currentGameRecentRows = useMemo(() => filterRowsByGame(recentRows, gameId), [gameId, recentRows]);
  const globalHighScore = useMemo(() => getMaxHighScore(currentGameTopRows), [currentGameTopRows]);
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
  const overlayPrimaryLabel = overlay?.tone === 'win' ? 'Continue' : gameActionLabel;

  const { onOverlayPointer, arcadeOverlayClickable } = useArcadeGameOverlayResume({
    panelInstanceId,
    panelComponentId: PANEL_COMPONENT_ID,
    overlayTitle,
    isPanelPaused,
    isPanelActive,
  });

  return (
    <div
      className={`talia-report breakout-game ${isPanelExecutionActive ? '' : 'talia-game-panel--inactive'}`}
      role="region"
      aria-label="Breakout game panel"
    >
      <header className="talia-report__header">
        <div className="talia-report__header-left">
          <h2 className="talia-report__title">Breakout</h2>
          <p className="talia-report__subtitle">Clear bricks; optional bonus brick for extra points.</p>
        </div>
        <ArcadeGameDifficultyToggle
          value={difficulty}
          onChange={setDifficulty}
          disabled={gameState === 'playing'}
        />
      </header>

      <main className="talia-report__content talia-game-panel-body">
        <div ref={canvasWrapRef} className="talia-game-canvas-shell">
          <canvas
            ref={canvasRef}
            className="talia-arcade-canvas"
            onMouseMove={handleCanvasMouseMove}
            tabIndex={0}
            aria-label="Breakout game area"
          />
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

export default BreakoutGamePresenter;
