import './style.css';
import { Game } from './game';
import { Renderer } from './renderer';

const game = new Game();
const renderer = new Renderer(
  document.getElementById('board') as HTMLCanvasElement,
  document.getElementById('next') as HTMLCanvasElement,
);

const el = {
  lines: document.getElementById('lines')!,
  top: document.getElementById('top')!,
  score: document.getElementById('score')!,
  level: document.getElementById('level')!,
  game: document.getElementById('game')!,
};

// debug/testing hook
(window as unknown as { __game: Game }).__game = game;

/* ---------- fit to window ---------- */

function fit(): void {
  const scale = Math.min(window.innerWidth / 732, window.innerHeight / 920);
  el.game.style.transform = `scale(${scale})`;
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

window.addEventListener('keydown', (e) => {
  if (e.repeat) {
    if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
    return;
  }
  switch (e.code) {
    case 'ArrowLeft':
      e.preventDefault();
      if (game.phase === 'start') game.startLevel = Math.max(0, game.startLevel - 1);
      else onDirDown(-1);
      break;
    case 'ArrowRight':
      e.preventDefault();
      if (game.phase === 'start') game.startLevel = Math.min(19, game.startLevel + 1);
      else onDirDown(1);
      break;
    case 'ArrowDown':
      e.preventDefault();
      game.setSoftDrop(true);
      break;
    case 'ArrowUp':
    case 'KeyX':
      e.preventDefault();
      game.rotate(1);
      break;
    case 'KeyZ':
      game.rotate(-1);
      break;
    case 'Enter':
      if (game.phase === 'start' || game.phase === 'gameover') game.start();
      break;
    case 'KeyP':
    case 'Escape':
      game.togglePause();
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

const shown = { lines: '', top: '', score: '', level: '' };

function updateHud(): void {
  const lines = String(game.lines).padStart(3, '0');
  const top = String(Math.max(game.top, game.score)).padStart(6, '0');
  const score = String(game.score).padStart(6, '0');
  const level = String(game.phase === 'start' ? game.startLevel : game.level).padStart(2, '0');
  if (lines !== shown.lines) el.lines.textContent = lines;
  if (top !== shown.top) el.top.textContent = top;
  if (score !== shown.score) el.score.textContent = score;
  if (level !== shown.level) el.level.textContent = level;
  shown.lines = lines;
  shown.top = top;
  shown.score = score;
  shown.level = level;
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
