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
const GRAVITY_BASE = 0.007;
const THRUST = 0.088;
const ROT = 0.055;
const MAX_ANGLE = (Math.PI * 5) / 12;
const GAME_OVER_HOLD_MS = 5000;
const FOOT_OFFSET = 26;
const PANEL_COMPONENT_ID = 'moon-lander';

const buildTerrain = (level) => {
  const base = GAME_HEIGHT - 24;
  const padW = Math.max(44, 76 - level * 3);
  const span = GAME_WIDTH - padW - 160;
  const ox = ((level * 47) % Math.max(1, span)) + 70;
  const padLeft = ox;
  const padRight = padLeft + padW;
  const segments = [
    { x0: 0, y0: base - 48, x1: padLeft - 32, y1: base - 6, pad: false },
    { x0: padLeft - 32, y0: base - 6, x1: padLeft, y1: base, pad: false },
    { x0: padLeft, y0: base, x1: padRight, y1: base, pad: true },
    { x0: padRight, y0: base, x1: padRight + 42, y1: base - 22 - level * 2, pad: false },
    { x0: padRight + 42, y0: base - 22 - level * 2, x1: GAME_WIDTH, y1: base - 46 - level * 5, pad: false },
  ];
  return segments;
};

const sampleTerrain = (x, segments) => {
  let pick = null;
  for (const s of segments) {
    const xMin = Math.min(s.x0, s.x1);
    const xMax = Math.max(s.x0, s.x1);
    if (x < xMin || x > xMax) continue;
    const dx = s.x1 - s.x0;
    const y = Math.abs(dx) < 1e-6 ? s.y0 : s.y0 + ((x - s.x0) / dx) * (s.y1 - s.y0);
    if (!pick || (s.pad && !pick.pad)) {
      pick = { y, pad: Boolean(s.pad) };
    }
  }
  return pick;
};

/** Lander silhouette: hull, viewport, skids, engine bell, optional thrust plume. */
const drawMoonLanderShip = (ctx, m) => {
  const thrustOn = m.thrust && m.fuel > 0 && m.running;
  const bodyGrad = ctx.createLinearGradient(-14, -18, 12, 16);
  bodyGrad.addColorStop(0, 'rgba(222, 230, 244, 0.99)');
  bodyGrad.addColorStop(0.4, 'rgba(168, 178, 202, 0.96)');
  bodyGrad.addColorStop(1, 'rgba(88, 96, 118, 0.94)');
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.moveTo(0, -19);
  ctx.lineTo(-12, 6);
  ctx.quadraticCurveTo(-13, 13, -8, 15);
  ctx.lineTo(8, 15);
  ctx.quadraticCurveTo(13, 13, 12, 6);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(48, 58, 78, 0.88)';
  ctx.lineWidth = 1.35;
  ctx.stroke();

  ctx.fillStyle = 'rgba(55, 165, 255, 0.42)';
  ctx.beginPath();
  ctx.ellipse(0, -7, 5.5, 4.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(190, 235, 255, 0.75)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
  ctx.beginPath();
  ctx.ellipse(-1.5, -8, 2, 1.6, -0.35, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(175, 184, 206, 0.92)';
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-9, 14);
  ctx.lineTo(-15, 24);
  ctx.moveTo(9, 14);
  ctx.lineTo(15, 24);
  ctx.stroke();

  ctx.fillStyle = 'rgba(205, 145, 85, 0.96)';
  ctx.beginPath();
  ctx.ellipse(-16, 25, 4.5, 2.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(16, 25, 4.5, 2.4, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(115, 122, 142, 0.96)';
  ctx.beginPath();
  ctx.moveTo(-7, 11);
  ctx.lineTo(0, 18);
  ctx.lineTo(7, 11);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(60, 68, 88, 0.9)';
  ctx.lineWidth = 1;
  ctx.stroke();

  if (thrustOn) {
    const flicker = Math.random() * 6;
    const flame = ctx.createLinearGradient(0, 16, 0, 34 + flicker);
    flame.addColorStop(0, 'rgba(255, 245, 160, 0.98)');
    flame.addColorStop(0.35, 'rgba(255, 150, 50, 0.88)');
    flame.addColorStop(0.75, 'rgba(255, 70, 30, 0.45)');
    flame.addColorStop(1, 'rgba(255, 40, 10, 0)');
    ctx.fillStyle = flame;
    ctx.beginPath();
    ctx.moveTo(-6, 14);
    ctx.lineTo(0, 28 + flicker);
    ctx.lineTo(6, 14);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 220, 0.55)';
    ctx.beginPath();
    ctx.moveTo(-2.5, 15);
    ctx.lineTo(0, 22 + flicker * 0.4);
    ctx.lineTo(2.5, 15);
    ctx.closePath();
    ctx.fill();
  }
};

const createPlayingModel = () => ({
  running: false,
  score: 0,
  doubleScoreUntil: 0,
  difficulty: ARCADE_DIFFICULTY_NORMAL,
  lives: 3,
  level: 1,
  fuel: 100,
  fuelMax: 100,
  ship: { x: GAME_WIDTH / 2, y: 52, vx: 0, vy: 0.03, angle: 0 },
  terrain: buildTerrain(1),
  leftPressed: false,
  rightPressed: false,
  thrust: false,
  frame: 0,
  extraSpawn: createExtraSpawnState(),
  extra: null,
});

const resetShip = (model) => {
  model.ship.x = GAME_WIDTH / 2;
  model.ship.y = 52;
  model.ship.vx = 0;
  model.ship.vy = 0.03;
  model.ship.angle = 0;
  model.fuel = model.fuelMax;
};

const MoonLanderGamePresenter = ({
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
  const modelRef = useRef(createPlayingModel());
  const {
    ensureAudioContext,
    audioMasterGainRef,
    unlockAudio,
    playBeep: playTick,
    disposeAudio,
  } = useArcadeGameAudio(gameSoundEnabled, 0.024);
  const renderMetricsRef = useRef({ scale: 1, offsetX: 0, offsetY: 0 });
  const gameOverReleaseTimeoutRef = useRef(0);
  const gameOverCountdownIntervalRef = useRef(0);
  const [gameState, setGameState] = useState('idle');
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [fuel, setFuel] = useState(100);
  const [level, setLevel] = useState(1);
  const [, setStatusMessage] = useState('');
  const [overlay, setOverlay] = useState(null);
  const [restartInSeconds, setRestartInSeconds] = useState(0);
  const [difficulty, setDifficulty] = useState(ARCADE_DIFFICULTY_NORMAL);
  const doubleScoreHud = useArcadeDoubleScoreHud(modelRef, gameState === 'playing');

  const syncUiFromModel = useCallback(() => {
    const m = modelRef.current;
    setScore(m.score);
    setLives(m.lives);
    setFuel(m.fuel);
    setLevel(m.level);
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const m = modelRef.current;
    const { ship, terrain } = m;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    const scale = Math.min(canvas.width / GAME_WIDTH, canvas.height / GAME_HEIGHT);
    const offsetX = Math.round((canvas.width - GAME_WIDTH * scale) / 2);
    const offsetY = Math.round((canvas.height - GAME_HEIGHT * scale) / 2);
    renderMetricsRef.current = { scale, offsetX, offsetY };
    ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);

    ctx.fillStyle = 'rgba(8, 10, 22, 0.96)';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    ctx.strokeStyle = 'rgba(120, 140, 180, 0.25)';
    ctx.strokeRect(6, 6, GAME_WIDTH - 12, GAME_HEIGHT - 12);

    ctx.fillStyle = 'rgba(55, 48, 42, 0.95)';
    ctx.beginPath();
    ctx.moveTo(0, GAME_HEIGHT);
    ctx.lineTo(terrain[0].x0, terrain[0].y0);
    terrain.forEach((s) => {
      ctx.lineTo(s.x1, s.y1);
    });
    ctx.lineTo(GAME_WIDTH, GAME_HEIGHT);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'rgba(160, 200, 140, 0.5)';
    ctx.lineWidth = 2;
    terrain.forEach((s) => {
      if (!s.pad) return;
      ctx.beginPath();
      ctx.moveTo(s.x0, s.y0);
      ctx.lineTo(s.x1, s.y1);
      ctx.stroke();
    });

    if (m.extra) {
      const e = m.extra;
      ctx.fillStyle = 'rgba(120, 220, 255, 0.85)';
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(200, 250, 255, 0.9)';
      ctx.stroke();
    }

    ctx.save();
    ctx.translate(ship.x, ship.y);
    ctx.rotate(ship.angle);
    drawMoonLanderShip(ctx, m);
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

  const finishRound = useCallback(async () => {
    stopGame();
    const m = modelRef.current;
    setGameState('over');
    setStatusMessage('Game over.');
    setOverlay({ title: 'Game Over', subtitle: `Final score: ${m.score}` });
    beginGameOverHold();
    if (gameSoundEnabled !== false) {
      const context = ensureAudioContext();
      const masterGain = audioMasterGainRef.current;
      if (context && masterGain) {
        [520, 380, 280].forEach((f, i) => {
          const osc = context.createOscillator();
          const gain = context.createGain();
          osc.type = 'triangle';
          osc.frequency.value = f;
          osc.connect(gain);
          gain.connect(masterGain);
          const t0 = context.currentTime + i * 0.09;
          gain.gain.setValueAtTime(0.0001, t0);
          gain.gain.exponentialRampToValueAtTime(0.5, t0 + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);
          osc.start(t0);
          osc.stop(t0 + 0.13);
        });
      }
    }
    await onSaveScore(m.score);
  }, [beginGameOverHold, ensureAudioContext, audioMasterGainRef, gameSoundEnabled, onSaveScore, stopGame]);

  const crashOrOob = useCallback(async () => {
    const m = modelRef.current;
    m.lives -= 1;
    playTick(220, 60);
    if (m.lives <= 0) {
      await finishRound();
      return;
    }
    resetShip(m);
    m.extra = null;
    armExtraSpawn(m.extraSpawn, m.frame, 320, 640);
    syncUiFromModel();
  }, [finishRound, playTick, syncUiFromModel]);

  const tryLand = useCallback(() => {
    const m = modelRef.current;
    const landedLevel = m.level;
    const landingBonus = Math.floor(m.fuel * 5) + 280 + landedLevel * 40;
    const celebrationBonus = 200 + landedLevel * 42;
    const scoreBefore = m.score;
    addArcadeScore(m, landingBonus);
    addArcadeScore(m, celebrationBonus);
    const gained = m.score - scoreBefore;
    m.level += 1;
    m.fuelMax = Math.min(130, m.fuelMax + 4);
    m.terrain = buildTerrain(m.level);
    resetShip(m);
    m.extra = null;
    armExtraSpawn(m.extraSpawn, m.frame, 400, 720);
    playTick(560, 22);
    window.setTimeout(() => playTick(720, 24, 1), 70);
    window.setTimeout(() => playTick(480, 30, 1), 150);
    syncUiFromModel();
    stopGame();
    setOverlay({
      title: 'Landing successful!',
      subtitle: `+${gained} total · Next: level ${m.level}`,
      tone: 'win',
    });
    setStatusMessage('Great landing!');
  }, [addArcadeScore, playTick, stopGame, syncUiFromModel]);

  const updateModel = useCallback(async () => {
    const m = modelRef.current;
    if (!m.running) return;

    const { ship } = m;
    if (m.leftPressed) {
      ship.angle = Math.max(-MAX_ANGLE, ship.angle - ROT);
    }
    if (m.rightPressed) {
      ship.angle = Math.min(MAX_ANGLE, ship.angle + ROT);
    }
    if (m.thrust && m.fuel > 0) {
      const thrustMult = isArcadeEasy(m) ? 1.1 : 1;
      m.fuel = Math.max(0, m.fuel - 0.12);
      ship.vx += Math.sin(ship.angle) * THRUST * thrustMult;
      ship.vy -= Math.cos(ship.angle) * THRUST * thrustMult;
    }
    const gRamp = GRAVITY_BASE + Math.min(0.004, (m.level - 1) * 0.0007);
    const gMult = isArcadeEasy(m) ? 0.5 : 1;
    ship.vy += gRamp * gMult;
    ship.x += ship.vx;
    ship.y += ship.vy;

    if (ship.x < 10 || ship.x > GAME_WIDTH - 10 || ship.y < 8) {
      await crashOrOob();
      m.frame += 1;
      return;
    }

    const footY = ship.y + FOOT_OFFSET;
    const ground = sampleTerrain(ship.x, m.terrain);
    if (ground && footY >= ground.y - 2) {
      const easy = isArcadeEasy(m);
      const softY = Math.abs(ship.vy) < (easy ? 0.54 : 0.48);
      const softX = Math.abs(ship.vx) < (easy ? 0.48 : 0.42);
      const upright = Math.abs(ship.angle) < (easy ? 0.42 : 0.36);
      if (ground.pad && softY && softX && upright) {
        tryLand();
      } else {
        await crashOrOob();
      }
      m.frame += 1;
      if (m.frame % 3 === 0) {
        syncUiFromModel();
      }
      return;
    }

    const hasEx = Boolean(m.extra);
    if (isExtraSpawnDue(m.extraSpawn, m.frame, hasEx)) {
      m.extra = {
        x: 80 + Math.random() * (GAME_WIDTH - 160),
        y: 70,
        r: 11,
        vy: 0.55,
        fuel: 32,
      };
    }
    if (m.extra) {
      const e = m.extra;
      e.y += e.vy;
      const dx = ship.x - e.x;
      const dy = ship.y - e.y;
      if (dx * dx + dy * dy < (e.r + 14) ** 2) {
        armArcadeDoubleScore(m);
        m.fuel = Math.min(m.fuelMax, m.fuel + e.fuel);
        m.extra = null;
        armExtraSpawn(m.extraSpawn, m.frame, 360, 680);
        playTick(740, 20);
      } else if (e.y > GAME_HEIGHT) {
        m.extra = null;
        armExtraSpawn(m.extraSpawn, m.frame, 240, 520);
      }
    }

    m.frame += 1;
    if (m.frame % 3 === 0) {
      syncUiFromModel();
    }
  }, [crashOrOob, playTick, syncUiFromModel, tryLand]);

  const loop = useArcadeGameLoop({ modelRef, rafRef, updateModel, draw });

  const resumePlaying = useCallback(() => {
    modelRef.current.running = true;
    setOverlay((prev) => (prev?.title === 'Resuming' ? null : prev));
    setStatusMessage('Resumed.');
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
    setStatusMessage('Playing.');
    if (rafRef.current) {
      window.cancelAnimationFrame(rafRef.current);
    }
    rafRef.current = window.requestAnimationFrame(loop);
    canvasRef.current?.focus();
  }, [loop]);

  const startGame = useCallback(() => {
    if (restartInSeconds > 0) return;
    clearGameOverHold();
    unlockAudio();
    modelRef.current = createPlayingModel();
    modelRef.current.difficulty = difficulty;
    armExtraSpawn(modelRef.current.extraSpawn, 0, 280, 560);
    modelRef.current.running = true;
    syncUiFromModel();
    setGameState('playing');
    setOverlay(null);
    setStatusMessage('Playing.');
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
    const handleKeyDown = (event) => {
      if (!isPanelExecutionActive || isEditableTarget(event)) return;
      if (event.key === ' ' && gameState !== 'playing') {
        startGame();
        event.preventDefault();
        return;
      }
      if (event.key === 'ArrowLeft') {
        modelRef.current.leftPressed = true;
        event.preventDefault();
      } else if (event.key === 'ArrowRight') {
        modelRef.current.rightPressed = true;
        event.preventDefault();
      } else if (event.key === ' ' || event.key === 'ArrowUp') {
        modelRef.current.thrust = true;
        event.preventDefault();
      }
    };

    const handleKeyUp = (event) => {
      if (!isPanelExecutionActive || isEditableTarget(event)) return;
      if (event.key === 'ArrowLeft') {
        modelRef.current.leftPressed = false;
      } else if (event.key === 'ArrowRight') {
        modelRef.current.rightPressed = false;
      } else if (event.key === ' ' || event.key === 'ArrowUp') {
        modelRef.current.thrust = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameState, isPanelExecutionActive, startGame]);

  useEffect(() => () => {
    stopGame();
    clearInactiveResumeCountdown();
    clearGameOverHold();
    disposeAudio();
  }, [clearGameOverHold, clearInactiveResumeCountdown, disposeAudio, stopGame]);

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
  const overlayTone = getArcadeOverlayTone({
    explicitTone: overlay?.tone,
    overlayTitle,
    isGameOverHoldActive,
    isLifeLossMessage: false,
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
      className={`talia-report moon-lander-game ${isPanelExecutionActive ? '' : 'talia-game-panel--inactive'}`}
      role="region"
      aria-label="Moon Lander game panel"
    >
      <header className="talia-report__header">
        <div className="talia-report__header-left">
          <h2 className="talia-report__title">Moon Lander</h2>
          <p className="talia-report__subtitle">Land softly on the pad; cyan orbs add fuel. Inspired by Moonlander (1973).</p>
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
            tabIndex={0}
            aria-label="Moon Lander playfield"
          />
          <ArcadeGameScoreHud
            currentScore={score}
            userHighScore={highScore}
            totalHighScore={globalHighScore}
            meta={`Lvl ${level} · Lives ${lives} · Fuel ${Math.round(fuel)}`}
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

export default MoonLanderGamePresenter;
