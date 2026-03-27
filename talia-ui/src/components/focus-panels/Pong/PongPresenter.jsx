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
const GAME_HEIGHT = 420;
const GAME_OVER_HOLD_MS = 5000;
const PANEL_COMPONENT_ID = 'pong';
const PONG_FULL_PADDLE_H = 92;
const PONG_MATCH_WIN_EASY = 6;
const PONG_MATCH_WIN_NORMAL = 10;

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

const shrinkPongPaddleOnEdgeHit = (paddle, impactNorm) => {
  if (Math.abs(impactNorm) < 0.62) return;
  const nextH = Math.max(48, paddle.h - 8);
  if (nextH >= paddle.h) return;
  const cy = paddle.y + paddle.h / 2;
  paddle.h = nextH;
  paddle.y = clamp(cy - paddle.h / 2, 10, GAME_HEIGHT - paddle.h - 10);
};

const createModel = () => ({
  running: false,
  waitingForServe: true,
  score: 0,
  doubleScoreUntil: 0,
  difficulty: ARCADE_DIFFICULTY_NORMAL,
  matchPoints: 0,
  lives: 3,
  paddle: { x: 28, y: GAME_HEIGHT / 2 - PONG_FULL_PADDLE_H / 2, w: 10, h: PONG_FULL_PADDLE_H, speed: 7.2 },
  ai: { x: GAME_WIDTH - 38, y: GAME_HEIGHT / 2 - PONG_FULL_PADDLE_H / 2, w: 10, h: PONG_FULL_PADDLE_H, speed: 4.6 },
  ball: { x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2, vx: 4.2, vy: 2.4, r: 7 },
  upPressed: false,
  downPressed: false,
  frame: 0,
  extraSpawn: createExtraSpawnState(),
  extra: null,
});

const PongPresenter = ({
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
  const renderMetricsRef = useRef({ scale: 1, offsetX: 0, offsetY: 0 });
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
  const [matchPoints, setMatchPoints] = useState(0);
  const doubleScoreHud = useArcadeDoubleScoreHud(modelRef, gameState === 'playing');

  const syncUi = useCallback(() => {
    setScore(modelRef.current.score);
    setLives(modelRef.current.lives);
    setMatchPoints(modelRef.current.matchPoints);
  }, []);

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

    if (m.extra) {
      const e = m.extra;
      ctx.strokeStyle = 'rgba(255, 210, 80, 0.95)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255, 230, 120, 0.35)';
      ctx.fill();
    }

    ctx.fillStyle = 'rgba(245, 249, 255, 0.95)';
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.closePath();

    ctx.restore();
  }, []);

  const resetBall = useCallback((serveToRight = true) => {
    const m = modelRef.current;
    const spd = isArcadeEasy(m) ? 0.84 : 1;
    m.ball.x = GAME_WIDTH / 2;
    m.ball.y = GAME_HEIGHT / 2;
    m.ball.vx = (serveToRight ? 1 : -1) * (4 + Math.random() * 0.9) * spd;
    m.ball.vy = (Math.random() > 0.5 ? 1 : -1) * (2 + Math.random() * 1.2) * spd;
    m.waitingForServe = true;
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

  const activateServe = useCallback(() => {
    const m = modelRef.current;
    if (!m.running || !m.waitingForServe) return;
    m.waitingForServe = false;
    setOverlay(null);
    setStatusMessage('Ball in play.');
    playTone(680, 20, 'square', 0.28);
    canvasRef.current?.focus();
  }, [playTone]);

  const finishGame = useCallback(async (reason) => {
    stopGame();
    setGameState('over');
    const finalScore = modelRef.current.score;
    setOverlay({ title: 'Game Over', subtitle: `Final score: ${finalScore}` });
    setStatusMessage(`Game over: ${reason}`);
    beginGameOverHold();
    playTone(360, 80, 'triangle', 0.44);
    setTimeout(() => playTone(260, 120, 'triangle', 0.44), 90);
    await onSaveScore(finalScore);
  }, [beginGameOverHold, onSaveScore, playTone, stopGame]);

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

    if (isExtraSpawnDue(m.extraSpawn, m.frame, m.extra != null)) {
      m.extra = {
        x: GAME_WIDTH / 2 + (Math.random() - 0.5) * 200,
        y: GAME_HEIGHT / 2 + (Math.random() - 0.5) * 160,
        r: 10,
        vx: (Math.random() - 0.5) * 3.4,
        vy: (Math.random() - 0.5) * 3.4,
        points: 80,
      };
    }
    if (m.extra) {
      const e = m.extra;
      e.x += e.vx;
      e.y += e.vy;
      if (e.x < 22 || e.x > GAME_WIDTH - 22) e.vx *= -1;
      if (e.y < 22 || e.y > GAME_HEIGHT - 22) e.vy *= -1;
      e.x = clamp(e.x, 22, GAME_WIDTH - 22);
      e.y = clamp(e.y, 22, GAME_HEIGHT - 22);
      const dx = ball.x - e.x;
      const dy = ball.y - e.y;
      const hitR = ball.r + e.r;
      if (dx * dx + dy * dy <= hitR * hitR) {
        armArcadeDoubleScore(m);
        addArcadeScore(m, e.points);
        m.extra = null;
        armExtraSpawn(m.extraSpawn, m.frame, 380, 760);
        playTone(820, 32, 'triangle', 0.36);
      }
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
      shrinkPongPaddleOnEdgeHit(paddle, impact);
      ball.vx = Math.abs(ball.vx) + 0.25;
      ball.vy = clamp(impact * 4.2, -4.2, 4.2);
      addArcadeScore(m, 5);
      playTone(620, 24, 'square', 0.3);
    }

    const hitAi = ball.x + ball.r >= ai.x
      && ball.y >= ai.y
      && ball.y <= ai.y + ai.h
      && ball.vx > 0;
    if (hitAi) {
      const impact = (ball.y - (ai.y + ai.h / 2)) / (ai.h / 2);
      shrinkPongPaddleOnEdgeHit(ai, impact);
      ball.vx = -Math.abs(ball.vx) - 0.22;
      ball.vy = clamp(impact * 3.9, -3.9, 3.9);
      playTone(520, 20, 'triangle', 0.24);
    }

    if (ball.x + ball.r >= GAME_WIDTH - 10) {
      addArcadeScore(m, 25);
      m.matchPoints += 1;
      const need = isArcadeEasy(m) ? PONG_MATCH_WIN_EASY : PONG_MATCH_WIN_NORMAL;
      if (m.matchPoints >= need) {
        const vic = 380 + need * 35;
        addArcadeScore(m, vic);
        m.matchPoints = 0;
        syncUi();
        stopGame();
        setOverlay({
          title: 'Match won!',
          subtitle: `+${vic} victory bonus · Play again`,
          tone: 'win',
        });
        setStatusMessage('Match won!');
        playTone(920, 40, 'triangle', 0.42);
        m.frame += 1;
        return;
      }
      playTone(760, 36, 'triangle', 0.33);
      resetBall(false);
      setStatusMessage('Point scored. Move paddle to serve.');
    }

    if (ball.x - ball.r <= 10) {
      m.lives -= 1;
      playTone(220, 70, 'sawtooth', 0.36);
      setTimeout(() => playTone(160, 120, 'triangle', 0.42), 85);
      if (m.lives <= 0) {
        await finishGame('No lives remaining');
        return;
      }
      resetBall(true);
      setOverlay({ title: `Life Lost - ${m.lives} left`, subtitle: 'Move paddle to continue' });
      setStatusMessage('Move paddle to continue.');
    }

    m.frame += 1;
    if (m.frame % 3 === 0) syncUi();
  }, [finishGame, playTone, resetBall, stopGame, syncUi]);

  const loop = useArcadeGameLoop({ modelRef, rafRef, updateModel, draw });

  const resumePlaying = useCallback(() => {
    modelRef.current.running = true;
    if (modelRef.current.waitingForServe) {
      setOverlay({ title: 'Ready', subtitle: 'Move paddle to serve' });
      setStatusMessage('Move paddle to serve.');
    } else {
      setOverlay((prev) => (prev?.title === 'Resuming' ? null : prev));
      setStatusMessage('Resumed.');
    }
    if (rafRef.current) {
      window.cancelAnimationFrame(rafRef.current);
    }
    rafRef.current = window.requestAnimationFrame(loop);
    canvasRef.current?.focus();
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
    const m = modelRef.current;
    m.paddle.h = PONG_FULL_PADDLE_H;
    m.ai.h = PONG_FULL_PADDLE_H;
    m.paddle.y = clamp(GAME_HEIGHT / 2 - m.paddle.h / 2, 10, GAME_HEIGHT - m.paddle.h - 10);
    m.ai.y = clamp(GAME_HEIGHT / 2 - m.ai.h / 2, 10, GAME_HEIGHT - m.ai.h - 10);
    setOverlay({ title: 'Ready', subtitle: 'Move paddle to serve' });
    setStatusMessage('Move paddle to serve.');
    m.running = true;
    m.waitingForServe = true;
    resetBall(false);
    syncUi();
    if (rafRef.current) {
      window.cancelAnimationFrame(rafRef.current);
    }
    rafRef.current = window.requestAnimationFrame(loop);
    canvasRef.current?.focus();
  }, [loop, resetBall, syncUi]);

  const startGame = useCallback(() => {
    if (restartInSeconds > 0) return;
    clearGameOverHold();
    unlockAudio();
    modelRef.current = createModel();
    modelRef.current.difficulty = difficulty;
    if (isArcadeEasy(modelRef.current)) {
      modelRef.current.ai.speed *= 0.74;
      modelRef.current.paddle.speed *= 1.05;
    }
    armExtraSpawn(modelRef.current.extraSpawn, 0, 280, 560);
    modelRef.current.running = true;
    setGameState('playing');
    setOverlay({ title: 'Ready', subtitle: 'Move paddle to serve' });
    setStatusMessage('Move paddle to serve.');
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
    const onPointerDown = () => {
      unlockAudio();
      activateServe();
    };
    wrap.addEventListener('pointerdown', onPointerDown);
    return () => wrap.removeEventListener('pointerdown', onPointerDown);
  }, [activateServe, unlockAudio]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (!isPanelExecutionActive || isEditableTarget(event)) return;
      const m = modelRef.current;
      if (event.key === 'ArrowUp') {
        m.upPressed = true;
        activateServe();
      }
      if (event.key === 'ArrowDown' || event.key === 's' || event.key === 'S') {
        m.downPressed = true;
        activateServe();
      }
      if (['ArrowUp', 'ArrowDown', 's', 'S'].includes(event.key)) event.preventDefault();
    };
    const onKeyUp = (event) => {
      if (!isPanelExecutionActive || isEditableTarget(event)) return;
      const m = modelRef.current;
      if (event.key === 'ArrowUp') m.upPressed = false;
      if (event.key === 'ArrowDown' || event.key === 's' || event.key === 'S') m.downPressed = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [activateServe, isPanelExecutionActive]);

  useEffect(() => () => {
    stopGame();
    clearInactiveResumeCountdown();
    clearGameOverHold();
    disposeAudio();
  }, [clearGameOverHold, clearInactiveResumeCountdown, disposeAudio, stopGame]);

  const handleMouseMove = (event) => {
    if (gameState !== 'playing') return;
    activateServe();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const { scale, offsetY } = renderMetricsRef.current;
    const localY = ((event.clientY - rect.top) - offsetY) / Math.max(scale, 0.0001);
    modelRef.current.paddle.y = clamp(localY - modelRef.current.paddle.h / 2, 10, GAME_HEIGHT - modelRef.current.paddle.h - 10);
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
  const rallyTarget = difficulty === ARCADE_DIFFICULTY_NORMAL ? PONG_MATCH_WIN_NORMAL : PONG_MATCH_WIN_EASY;
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
      className={`talia-report pong-game ${isPanelExecutionActive ? '' : 'talia-game-panel--inactive'}`}
      role="region"
      aria-label="Pong game panel"
    >
      <header className="talia-report__header">
        <div className="talia-report__header-left">
          <h2 className="talia-report__title">Pong</h2>
          <p className="talia-report__subtitle">One-player vs AI; optional bonus orb.</p>
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
            aria-label="Pong game area"
            onMouseMove={handleMouseMove}
          />
          <ArcadeGameScoreHud
            currentScore={score}
            userHighScore={highScore}
            totalHighScore={globalHighScore}
            meta={`Lives ${lives} · Rallies ${matchPoints}/${rallyTarget}`}
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

export default PongPresenter;
