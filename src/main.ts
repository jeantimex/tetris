import './style.css';
import { B_TYPE_GOAL, Game } from './game';
import { Renderer } from './renderer';
import { TYPES, type PieceType } from './pieces';
import { AudioEngine } from './audio';

const statCanvases = new Map<PieceType, HTMLCanvasElement>();
for (const canvas of document.querySelectorAll<HTMLCanvasElement>('canvas[data-piece]')) {
  statCanvases.set(canvas.dataset.piece as PieceType, canvas);
}

const game = new Game();
const renderer = new Renderer(
  document.getElementById('board') as HTMLCanvasElement,
  document.getElementById('next') as HTMLCanvasElement,
  statCanvases,
);

const el = {
  lines: document.getElementById('lines')!,
  top: document.getElementById('top')!,
  score: document.getElementById('score')!,
  level: document.getElementById('level')!,
  frame: document.getElementById('game-frame')!,
  atype: document.getElementById('atype')!,
  stats: new Map<PieceType, HTMLElement>(
    TYPES.map((t) => [t, document.getElementById(`stat-${t}`)!]),
  ),
};

// debug/testing hook
(window as unknown as { __game: Game }).__game = game;

/* ---------- fit to window ---------- */

function fit(): void {
  const scale = Math.min(window.innerWidth / 956, window.innerHeight / 934);
  el.frame.style.transform = `scale(${scale})`;
}
window.addEventListener('resize', fit);
fit();

/* ---------- input with NES-style DAS auto-repeat ---------- */

const DAS_DELAY_MS = 170;
const DAS_REPEAT_MS = 55;

const held: (-1 | 1)[] = [];
let dasTimer: number | null = null;
let arrTimer: number | null = null;

function clearRepeat(): void {
  if (dasTimer !== null) window.clearTimeout(dasTimer);
  if (arrTimer !== null) window.clearInterval(arrTimer);
  dasTimer = null;
  arrTimer = null;
}

function startRepeat(dir: -1 | 1): void {
  clearRepeat();
  dasTimer = window.setTimeout(() => {
    arrTimer = window.setInterval(() => game.move(dir), DAS_REPEAT_MS);
  }, DAS_DELAY_MS);
}

function onDirDown(dir: -1 | 1): void {
  const idx = held.indexOf(dir);
  if (idx >= 0) held.splice(idx, 1);
  held.push(dir);
  game.move(dir);
  startRepeat(dir);
}

function onDirUp(dir: -1 | 1): void {
  const idx = held.indexOf(dir);
  if (idx >= 0) held.splice(idx, 1);
  const current = held[held.length - 1];
  if (current === undefined) {
    clearRepeat();
  } else if (current !== dir || held.length > 0) {
    startRepeat(current);
  }
}

/* ---------- start-screen menu ---------- */

function menuRowCount(): number {
  return game.startMode === 'b' ? 3 : 2;
}

function moveMenuCursor(dir: -1 | 1): void {
  const rows = menuRowCount();
  game.menuCursor = (game.menuCursor + dir + rows) % rows;
}

function changeMenuValue(dir: -1 | 1): void {
  if (game.menuCursor === 0) {
    game.startMode = game.startMode === 'a' ? 'b' : 'a';
    if (game.menuCursor >= menuRowCount()) game.menuCursor = menuRowCount() - 1;
  } else if (game.menuCursor === 1) {
    game.startLevel = Math.min(19, Math.max(0, game.startLevel + dir));
  } else {
    game.startHeight = Math.min(5, Math.max(0, game.startHeight + dir));
  }
}

/* ---------- audio ---------- */

const audio = new AudioEngine();
(window as unknown as { __audio: AudioEngine }).__audio = audio; // debug/testing hook

game.on((e, data) => {
  switch (e) {
    case 'move':
      audio.sfxMove();
      break;
    case 'rotate':
      audio.sfxRotate();
      break;
    case 'lock':
      audio.sfxLock();
      break;
    case 'clear':
      audio.sfxClear(data);
      break;
    case 'levelup':
      audio.sfxLevelUp();
      break;
    case 'gameover':
      audio.stopMusic();
      audio.sfxGameOver();
      break;
    case 'win':
      audio.stopMusic();
      audio.sfxWin();
      break;
  }
});

window.addEventListener('keydown', (e) => {
  audio.unlock(); // browsers require a user gesture before audio
  if (e.repeat) {
    if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
    return;
  }
  switch (e.code) {
    case 'ArrowLeft':
      e.preventDefault();
      if (game.phase === 'start') changeMenuValue(-1);
      else onDirDown(-1);
      break;
    case 'ArrowRight':
      e.preventDefault();
      if (game.phase === 'start') changeMenuValue(1);
      else onDirDown(1);
      break;
    case 'ArrowDown':
      e.preventDefault();
      if (game.phase === 'start') moveMenuCursor(1);
      else game.setSoftDrop(true);
      break;
    case 'ArrowUp':
      e.preventDefault();
      if (game.phase === 'start') moveMenuCursor(-1);
      else game.rotate(1);
      break;
    case 'KeyX':
      e.preventDefault();
      game.rotate(1);
      break;
    case 'KeyZ':
      game.rotate(-1);
      break;
    case 'Enter':
      if (game.phase === 'win') {
        game.phase = 'start';
      } else if (game.phase === 'start' || game.phase === 'gameover') {
        game.start();
        audio.startMusic();
      }
      break;
    case 'KeyP':
    case 'Escape':
      game.togglePause();
      audio.setPaused(game.phase === 'paused');
      break;
    case 'KeyM':
      audio.toggleMute();
      break;
  }
});

window.addEventListener('keyup', (e) => {
  switch (e.code) {
    case 'ArrowLeft':
      onDirUp(-1);
      break;
    case 'ArrowRight':
      onDirUp(1);
      break;
    case 'ArrowDown':
      game.setSoftDrop(false);
      break;
  }
});

/* ---------- HUD ---------- */

const shown = { lines: '', top: '', score: '', level: '', stats: '', atype: '' };
let iconLevel = -1;

function updateHud(): void {
  const linesValue =
    game.phase === 'start'
      ? game.startMode === 'b'
        ? B_TYPE_GOAL
        : 0
      : game.mode === 'b'
        ? Math.max(0, B_TYPE_GOAL - game.lines)
        : game.lines;
  const lines = String(linesValue).padStart(3, '0');
  const top = String(Math.max(game.top, game.score)).padStart(6, '0');
  const score = String(game.score).padStart(6, '0');
  const level = String(game.phase === 'start' ? game.startLevel : game.level).padStart(2, '0');
  const atype = game.startMode === 'b' ? 'B-TYPE' : 'A-TYPE';
  const stats = TYPES.map((t) => Math.min(999, game.stats[t]).toString().padStart(3, '0'));
  if (lines !== shown.lines) el.lines.textContent = lines;
  if (top !== shown.top) el.top.textContent = top;
  if (score !== shown.score) el.score.textContent = score;
  if (level !== shown.level) el.level.textContent = level;
  if (atype !== shown.atype) el.atype.textContent = atype;
  const statsKey = stats.join();
  if (statsKey !== shown.stats) {
    TYPES.forEach((t, i) => {
      el.stats.get(t)!.textContent = stats[i];
    });
  }
  shown.lines = lines;
  shown.top = top;
  shown.score = score;
  shown.level = level;
  shown.stats = statsKey;
  shown.atype = atype;

  // statistics icons follow the level palette
  if (game.level !== iconLevel) {
    iconLevel = game.level;
    renderer.drawStatistics(game);
  }
}

/* ---------- main loop ---------- */

let last = performance.now();

function frame(now: number): void {
  const dt = Math.min(now - last, 100);
  last = now;
  game.update(dt);
  updateHud();
  renderer.draw(game, now);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
