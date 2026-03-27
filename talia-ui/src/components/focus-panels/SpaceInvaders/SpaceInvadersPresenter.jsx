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
const GAME_HEIGHT = 440;
const GAME_OVER_HOLD_MS = 5000;
const PANEL_COMPONENT_ID = 'space-invaders';

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
  doubleScoreUntil: 0,
  difficulty: ARCADE_DIFFICULTY_NORMAL,
  wave: 1,
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
  extraSpawn: createExtraSpawnState(),
  extra: null,
});

const primeSpaceInvadersExtraSpawn = (model) => {
  armExtraSpawn(model.extraSpawn, 0, 220, 480);
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const SpaceInvadersPresenter = ({
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
  const modelRef = useRef(createInitialModel());
  const rafRef = useRef(0);
  const hitOverlayTimerRef = useRef(0);
  const { unlockAudio, playTone, disposeAudio } = useArcadeGameAudio(gameSoundEnabled, 0.03);
  const gameOverReleaseTimeoutRef = useRef(0);
  const gameOverCountdownIntervalRef = useRef(0);
  const renderMetricsRef = useRef({ scale: 1, offsetX: 0, offsetY: 0 });
  const [gameState, setGameState] = useState('idle');
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [statusMessage, setStatusMessage] = useState('Press Start to defend the fleet.');
  const [overlay, setOverlay] = useState(null);
  const [restartInSeconds, setRestartInSeconds] = useState(0);
  const [difficulty, setDifficulty] = useState(ARCADE_DIFFICULTY_NORMAL);
  const doubleScoreHud = useArcadeDoubleScoreHud(modelRef, gameState === 'playing');

  const syncUi = useCallback(() => {
    const model = modelRef.current;
    setScore(model.score);
    setLives(model.lives);
  }, []);

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

    if (model.extra) {
      const u = model.extra;
      ctx.fillStyle = 'rgba(255, 100, 160, 0.92)';
      ctx.beginPath();
      ctx.ellipse(u.x + u.w / 2, u.y + u.h / 2, u.w / 2, u.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 220, 120, 0.95)';
      ctx.fillRect(u.x + 4, u.y + 2, 4, 3);
      ctx.fillRect(u.x + u.w - 8, u.y + 2, 4, 3);
      ctx.strokeStyle = 'rgba(255, 200, 200, 0.6)';
      ctx.strokeRect(u.x, u.y, u.w, u.h);
    }

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
    setStatusMessage(`Game over: ${reason}`);
    setOverlay({ title: 'Game Over', subtitle: `Final score: ${finalScore}` });
    beginGameOverHold();
    playTone(480, 70, 'triangle', 0.5);
    setTimeout(() => playTone(360, 90, 'triangle', 0.5), 85);
    setTimeout(() => playTone(240, 120, 'triangle', 0.5), 190);
    await onSaveScore(finalScore);
  }, [beginGameOverHold, onSaveScore, playTone, stopGame]);

  const updateModel = useCallback(async () => {
    const model = modelRef.current;
    if (!model.running) return;

    if (model.leftPressed) {
      model.player.x = clamp(model.player.x - model.player.speed, 12, GAME_WIDTH - model.player.w - 12);
    }
    if (model.rightPressed) {
      model.player.x = clamp(model.player.x + model.player.speed, 12, GAME_WIDTH - model.player.w - 12);
    }

    const invMult = isArcadeEasy(model) ? 0.76 : 1;
    let hitEdge = false;
    model.invaders.forEach((inv) => {
      if (!inv.alive) return;
      inv.x += model.invaderDirection * model.invaderSpeed * invMult;
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
    const ebStep = isArcadeEasy(model) ? 2.5 : 3.1;
    model.enemyBullets = model.enemyBullets
      .map((b) => ({ ...b, y: b.y + ebStep }))
      .filter((b) => b.y < GAME_HEIGHT - 8);

    const saucerPointsTable = [50, 50, 100, 100, 150, 150, 300];
    if (isExtraSpawnDue(model.extraSpawn, model.frame, model.extra != null)) {
      const fromLeft = Math.random() < 0.5;
      model.extra = {
        x: fromLeft ? -28 : GAME_WIDTH + 4,
        y: 40,
        w: 28,
        h: 12,
        vx: fromLeft ? 2.35 : -2.35,
        points: saucerPointsTable[Math.floor(Math.random() * saucerPointsTable.length)],
      };
    }
    if (model.extra) {
      const e = model.extra;
      e.x += e.vx;
      if (e.x < -36 || e.x > GAME_WIDTH + 36) {
        model.extra = null;
        armExtraSpawn(model.extraSpawn, model.frame, 420, 780);
      }
    }

    model.bullets.forEach((bullet) => {
      if (model.extra) {
        const e = model.extra;
        if (bullet.x >= e.x && bullet.x <= e.x + e.w && bullet.y >= e.y && bullet.y <= e.y + e.h) {
          armArcadeDoubleScore(model);
          addArcadeScore(model, e.points);
          bullet.y = -100;
          model.extra = null;
          armExtraSpawn(model.extraSpawn, model.frame, 420, 780);
          playTone(880, 55, 'triangle', 0.52);
        }
      }
      model.invaders.forEach((inv) => {
        if (!inv.alive) return;
        if (bullet.x < inv.x || bullet.x > inv.x + inv.w || bullet.y < inv.y || bullet.y > inv.y + inv.h) return;
        inv.alive = false;
        bullet.y = -100;
        addArcadeScore(model, inv.points);
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
      setTimeout(playExplosion, 90);
      setStatusMessage('Life lost!');
      setOverlay({
        title: 'Life Lost',
        subtitle: `Lives ${Math.max(0, model.lives)}`,
      });
      if (hitOverlayTimerRef.current) {
        window.clearTimeout(hitOverlayTimerRef.current);
      }
      hitOverlayTimerRef.current = window.setTimeout(() => {
        hitOverlayTimerRef.current = 0;
        setOverlay((prev) => (prev?.title === 'Life Lost' ? null : prev));
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
      const w = model.wave || 1;
      const celeb = 115 + w * 36;
      addArcadeScore(model, celeb);
      model.wave = w + 1;
      model.invaders = createInvaders();
      model.shields = createShields();
      const ramp = isArcadeEasy(model) ? 0.09 : 0.12;
      model.invaderSpeed = Math.min(1.8, model.invaderSpeed + ramp);
      syncUi();
      stopGame();
      setOverlay({
        title: 'Wave cleared!',
        subtitle: `Wave ${w} complete · +${celeb} celebration`,
        tone: 'win',
      });
      setStatusMessage('Wave cleared.');
      playTone(820, 55, 'triangle', 0.48);
      model.frame += 1;
      return;
    }

    model.frame += 1;
    if (model.frame % 3 === 0) {
      syncUi();
    }
  }, [finishGame, playExplosion, setOverlay, setStatusMessage, stopGame, syncUi]);

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
    setStatusMessage('Arrows move, Space shoots.');
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
    modelRef.current = createInitialModel();
    modelRef.current.difficulty = difficulty;
    primeSpaceInvadersExtraSpawn(modelRef.current);
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
  }, [clearGameOverHold, difficulty, loop, playTone, restartInSeconds, syncUi, unlockAudio]);

  const onOverlayPrimaryClick = useCallback(() => {
    if (overlay?.tone === 'win') {
      dismissWinAndResume();
      return;
    }
    startGame();
  }, [dismissWinAndResume, overlay?.tone, startGame]);

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
      if (!isPanelExecutionActive || isEditableTarget(event)) return;
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
      if (!isPanelExecutionActive || isEditableTarget(event)) return;
      if (event.key === 'ArrowLeft') modelRef.current.leftPressed = false;
      if (event.key === 'ArrowRight') modelRef.current.rightPressed = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [fireBullet, gameState, isPanelExecutionActive]);

  useEffect(() => () => {
    stopGame();
    clearInactiveResumeCountdown();
    clearGameOverHold();
    if (hitOverlayTimerRef.current) {
      window.clearTimeout(hitOverlayTimerRef.current);
      hitOverlayTimerRef.current = 0;
    }
    disposeAudio();
  }, [clearGameOverHold, clearInactiveResumeCountdown, disposeAudio, stopGame]);

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
      className={`talia-report space-invaders ${isPanelExecutionActive ? '' : 'talia-game-panel--inactive'}`}
      role="region"
      aria-label="Space Invaders panel"
    >
      <header className="talia-report__header">
        <div className="talia-report__header-left">
          <h2 className="talia-report__title">Space Invaders</h2>
          <p className="talia-report__subtitle">Shoot invaders; bonus saucer for points.</p>
        </div>
        <ArcadeGameDifficultyToggle
          value={difficulty}
          onChange={setDifficulty}
          disabled={gameState === 'playing'}
        />
      </header>

      <main className="talia-report__content talia-game-panel-body">
        <div ref={wrapRef} className="talia-game-canvas-shell">
          <canvas
            ref={canvasRef}
            className="talia-arcade-canvas"
            tabIndex={0}
            aria-label="Space Invaders game area"
            onMouseMove={handlePointerMove}
            onClick={fireBullet}
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

export default SpaceInvadersPresenter;
