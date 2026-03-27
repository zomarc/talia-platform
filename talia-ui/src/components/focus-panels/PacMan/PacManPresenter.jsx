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

const CELL = 24;
const GRID_W = 21;
const GRID_H = 15;
const GAME_WIDTH = GRID_W * CELL;
const GAME_HEIGHT = GRID_H * CELL;
const GAME_OVER_HOLD_MS = 5000;
const DIRS = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
};

const wallAt = (x, y) => {
  if (x < 0 || y < 0 || x >= GRID_W || y >= GRID_H) return true;
  if (x === 0 || y === 0 || x === GRID_W - 1 || y === GRID_H - 1) return true;
  if (x % 4 === 0 && y > 2 && y < GRID_H - 3 && y % 4 !== 2) return true;
  if (y % 4 === 0 && x > 2 && x < GRID_W - 3 && x % 4 !== 2) return true;
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
  doubleScoreUntil: 0,
  difficulty: ARCADE_DIFFICULTY_NORMAL,
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
  extraSpawn: createExtraSpawnState(),
  extra: null,
});

const dirs = Object.values(DIRS);
const canMove = (x, y, dir) => !wallAt(x + dir.x, y + dir.y);

const pickRandomWalkableForExtra = (m) => {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const x = 1 + Math.floor(Math.random() * (GRID_W - 2));
    const y = 1 + Math.floor(Math.random() * (GRID_H - 2));
    if (wallAt(x, y)) continue;
    if (m.player.x === x && m.player.y === y) continue;
    if (m.ghosts.some((g) => g.x === x && g.y === y)) continue;
    return { gx: x, gy: y };
  }
  return null;
};
const PANEL_COMPONENT_ID = 'pac-man';

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
  const rafRef = useRef(0);
  const modelRef = useRef(createModel());
  const loopStableRef = useRef(null);
  const { unlockAudio, playTone, disposeAudio } = useArcadeGameAudio(gameSoundEnabled, 0.024);
  const gameOverReleaseTimeoutRef = useRef(0);
  const gameOverCountdownIntervalRef = useRef(0);
  const [gameState, setGameState] = useState('idle');
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [statusMessage, setStatusMessage] = useState('Press Start to begin.');
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

    if (m.extra) {
      const cx = m.extra.gx * CELL + CELL / 2;
      const cy = m.extra.gy * CELL + CELL / 2;
      ctx.fillStyle = 'rgba(220, 40, 60, 0.95)';
      ctx.beginPath();
      ctx.arc(cx - 3, cy + 2, 6, 0, Math.PI * 2);
      ctx.arc(cx + 3, cy + 2, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(40, 120, 40, 0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 4);
      ctx.lineTo(cx + 2, cy - 10);
      ctx.stroke();
    }

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
    playTone(350, 80, 'triangle', 0.4);
    setTimeout(() => playTone(260, 110, 'triangle', 0.4), 90);
    await onSaveScore(finalScore);
  }, [beginGameOverHold, onSaveScore, playTone, stopGame]);

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
    const easy = isArcadeEasy(m);
    const playerStepMs = Math.max(112, 162 - m.level * 6) * (easy ? 1.22 : 1);
    const ghostStepMs = Math.max(132, 192 - m.level * 5) * (easy ? 1.15 : 1);

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
          addArcadeScore(m, 10);
          playTone(640, 16, 'square', 0.2);
        }
        if (m.extra && m.player.x === m.extra.gx && m.player.y === m.extra.gy) {
          armArcadeDoubleScore(m);
          addArcadeScore(m, m.extra.points);
          playTone(920, 28, 'square', 0.34);
          m.extra = null;
          armExtraSpawn(m.extraSpawn, m.tick, 180, 420);
        }
      }
    }

    if (m.extra) {
      m.extra.ttl -= 1;
      if (m.extra.ttl <= 0) {
        m.extra = null;
        armExtraSpawn(m.extraSpawn, m.tick, 160, 380);
      }
    }
    if (isExtraSpawnDue(m.extraSpawn, m.tick, m.extra != null)) {
      const cell = pickRandomWalkableForExtra(m);
      if (cell) {
        m.extra = { ...cell, points: 100, ttl: 520 };
      } else {
        armExtraSpawn(m.extraSpawn, m.tick, 60, 120);
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
      setTimeout(() => playTone(150, 120, 'triangle', 0.4), 95);
      if (m.lives <= 0) {
        await finishGame('Ghost collision');
        return;
      }
      m.running = false;
      setOverlay({ title: `Life Lost! ${m.lives} left`, subtitle: 'Resuming in 2 seconds' });
      setStatusMessage('Caught by a ghost.');
      window.setTimeout(() => {
        resetPositions();
        setOverlay(null);
        setStatusMessage('Keep going.');
        m.running = true;
        rafRef.current = window.requestAnimationFrame(loopStableRef.current);
      }, 2000);
      return;
    }

    if (m.pellets.size === 0) {
      const nextLevel = m.level + 1;
      const celebration = 125 + nextLevel * 38;
      addArcadeScore(m, 150);
      addArcadeScore(m, celebration);
      m.level = nextLevel;
      m.pellets = createPellets();
      m.extra = null;
      armExtraSpawn(m.extraSpawn, m.tick, 200, 400);
      resetPositions();
      syncUi();
      stopGame();
      setOverlay({
        title: 'Maze cleared!',
        subtitle: `Level ${m.level} · +${celebration} celebration`,
        tone: 'win',
      });
      setStatusMessage(`Level ${m.level}`);
      playTone(760, 50, 'triangle', 0.35);
      m.tick += 1;
      return;
    }

    m.tick += 1;
    if (m.tick % 2 === 0) syncUi();
  }, [finishGame, playTone, resetPositions, stopGame, syncUi]);

  const loop = useArcadeGameLoop({ modelRef, rafRef, updateModel, draw });
  loopStableRef.current = loop;

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
    modelRef.current = createModel();
    modelRef.current.difficulty = difficulty;
    armExtraSpawn(modelRef.current.extraSpawn, 0, 140, 320);
    modelRef.current.running = true;
    modelRef.current.lastGhostStepAt = performance.now();
    modelRef.current.lastPlayerStepAt = performance.now();
    setGameState('playing');
    setStatusMessage('Arrow keys move through the maze.');
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
      if (!DIRS[event.key]) return;
      modelRef.current.player.nextDir = { ...DIRS[event.key] };
      event.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
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
      className={`talia-report pacman-game ${isPanelExecutionActive ? '' : 'talia-game-panel--inactive'}`}
      role="region"
      aria-label="Pac-Man game panel"
    >
      <header className="talia-report__header">
        <div className="talia-report__header-left">
          <h2 className="talia-report__title">Pac-Man</h2>
          <p className="talia-report__subtitle">Maze, dots, ghosts, bonus fruit.</p>
        </div>
        <ArcadeGameDifficultyToggle
          value={difficulty}
          onChange={setDifficulty}
          disabled={gameState === 'playing'}
        />
      </header>

      <main className="talia-report__content talia-game-panel-body">
        <div ref={wrapRef} className="talia-game-canvas-shell">
          <canvas ref={canvasRef} className="talia-arcade-canvas" tabIndex={0} aria-label="Pac-Man game area" />
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

export default PacManPresenter;
