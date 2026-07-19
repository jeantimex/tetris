import './style.css';
import { B_TYPE_GOAL, Game } from './game';
import { Renderer } from './renderer';
import { TYPES, type PieceType } from './pieces';
import { AudioEngine } from './audio';
import { applyWall, syncWallScale } from './wall';
import { MenuRenderer, loadHighScores, isHighScore, addHighScore, type MenuState, type MusicType, type HighScoreEntry } from './menu';
import { initFrames } from './frame';

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

const menuOverlay = document.getElementById('menu-overlay')!;
const menuCanvas = document.getElementById('menu-canvas') as HTMLCanvasElement;
const menuRenderer = new MenuRenderer(menuCanvas);

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
  controls: document.getElementById('game-controls')!,
  btnStart: document.getElementById('btn-start')!,
  btnQuit: document.getElementById('btn-quit')!,
  btnPause: document.getElementById('btn-pause')!,
  btnResume: document.getElementById('btn-resume')!,
  btnRestart: document.getElementById('btn-restart')!,
  keyboardOverlay: document.getElementById('keyboard-overlay')!,
  keyboardInput: document.getElementById('keyboard-input')!,
};

// debug/testing hook
(window as unknown as { __game: Game }).__game = game;

/* ---------- menu state ---------- */

const menuState: MenuState = {
  phase: 'type',
  gameType: 'a',
  musicType: 1,
  level: 0,
  height: 0,
  dropKey: 'space',
  ghost: true,
  typeCursor: 'game',
  musicCursor: 0,
  btypeFocus: 'level',
  settingsCursor: 0,
};

let aScores: HighScoreEntry[] = loadHighScores('a');
let bScores: HighScoreEntry[] = loadHighScores('b');

/* ---------- fit to window ---------- */

let menuScale = 1;

function fit(): void {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Determine game dimensions based on whether stats are hidden
  const isMobile = vw <= 800;
  const gameWidth = isMobile ? 682 : 1006; // 668 + padding
  const gameHeight = 934;

  const scale = Math.min(vw / gameWidth, vh / gameHeight);
  el.frame.style.transform = `translate(-50%, -50%) scale(${scale})`;
  syncWallScale(scale);

  // Scale menu canvas to fill available space
  menuScale = Math.min(vw / 520, vh / 490);
  menuCanvas.style.transform = `scale(${menuScale})`;
  menuRenderer.setScale(menuScale);

  // Redraw frames when layout changes
  initFrames();
}
window.addEventListener('resize', fit);
applyWall();
fit();

/* ---------- menu click handling ---------- */

menuCanvas.addEventListener('click', (e) => {
  const rect = menuCanvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  const region = menuRenderer.handleClick(x, y);
  if (!region) return;

  // Handle the click based on the action and current phase
  if (game.phase === 'menu-type') {
    if (region.action === 'gameType') {
      menuState.gameType = region.value as 'a' | 'b';
      audio.sfxMove();
    } else if (region.action === 'musicType') {
      menuState.musicType = region.value as MusicType;
      menuState.musicCursor = region.value === 0 ? 3 : (region.value as number) - 1;
      audio.sfxMove();
    } else if (region.action === 'nav' && region.value === 'next') {
      // Proceed to level select screen
      game.startMode = menuState.gameType;
      game.musicType = menuState.musicType;
      menuState.phase = menuState.gameType === 'a' ? 'atype' : 'btype';
      menuState.level = game.startLevel;
      menuState.height = game.startHeight;
      game.phase = 'menu-level';
      audio.sfxRotate();
    }
  } else if (game.phase === 'menu-level') {
    if (region.action === 'level') {
      menuState.level = region.value as number;
      if (menuState.gameType === 'b') {
        menuState.btypeFocus = 'level';
      }
      audio.sfxMove();
    } else if (region.action === 'height' && menuState.gameType === 'b') {
      menuState.height = region.value as number;
      menuState.btypeFocus = 'height';
      audio.sfxMove();
    } else if (region.action === 'nav') {
      if (region.value === 'back') {
        // Go back to type selection
        menuState.phase = 'type';
        menuState.btypeFocus = 'level';
        game.phase = 'menu-type';
        audio.sfxMove();
      } else if (region.value === 'next') {
        // Go to settings screen
        game.startLevel = menuState.level;
        game.startHeight = menuState.height;
        menuState.phase = 'settings';
        menuState.settingsCursor = 0;
        game.phase = 'menu-settings';
        audio.sfxRotate();
      }
    }
  } else if (game.phase === 'menu-settings') {
    if (region.action === 'dropKey') {
      menuState.dropKey = region.value as 'space' | 'up' | 'default';
      audio.sfxMove();
    } else if (region.action === 'ghost') {
      menuState.ghost = region.value as boolean;
      audio.sfxMove();
    } else if (region.action === 'nav') {
      if (region.value === 'back') {
        // Go back to level select
        menuState.phase = menuState.gameType === 'a' ? 'atype' : 'btype';
        game.phase = 'menu-level';
        audio.sfxMove();
      } else if (region.value === 'start') {
        // Apply settings and prepare for new game
        game.dropKey = menuState.dropKey;
        game.ghost = menuState.ghost;
        game.saveSettings();
        game.prepareNewGame();
        game.phase = 'start';
        updateMenuVisibility();
        audio.sfxRotate();
      }
    }
  }
});

/* ---------- menu visibility ---------- */

function updateMenuVisibility(): void {
  const showMenu = game.phase === 'menu-type' || game.phase === 'menu-level' || game.phase === 'menu-settings';
  menuOverlay.classList.toggle('hidden', !showMenu);
  el.frame.style.display = showMenu ? 'none' : '';
  updateGameControls();
}

function updateGameControls(): void {
  const phase = game.phase;
  const showControls = phase === 'start' || phase === 'playing' || phase === 'paused' || phase === 'gameover' || phase === 'enter-name';
  el.controls.style.display = showControls ? 'flex' : 'none';

  // Show/hide individual buttons based on phase
  el.btnStart.classList.toggle('hidden', phase !== 'start');
  el.btnQuit.classList.toggle('hidden', phase !== 'start' && phase !== 'paused' && phase !== 'gameover');
  el.btnPause.classList.toggle('hidden', phase !== 'playing');
  el.btnResume.classList.toggle('hidden', phase !== 'paused');
  el.btnRestart.classList.toggle('hidden', phase !== 'gameover');

  // Show/hide keyboard overlay
  el.keyboardOverlay.classList.toggle('hidden', phase !== 'enter-name');
  if (phase === 'enter-name') {
    updateKeyboardDisplay();
  }
}

function updateKeyboardDisplay(): void {
  const name = game.enteredName.padEnd(6, '_');
  el.keyboardInput.textContent = name;
}

// Game control button handlers
el.btnStart.addEventListener('click', () => {
  if (game.phase === 'start') {
    game.start();
    if (game.musicType !== 0) {
      audio.startMusic(game.musicType);
    }
    updateGameControls();
  }
});

el.btnQuit.addEventListener('click', () => {
  if (game.phase === 'start') {
    // Go back to settings screen
    game.phase = 'menu-settings';
    menuState.phase = 'settings';
    updateMenuVisibility();
    audio.sfxMove();
  } else if (game.phase === 'paused' || game.phase === 'gameover') {
    // Quit to main menu
    audio.setPaused(false);
    audio.stopMusic();
    game.phase = 'menu-type';
    menuState.phase = 'type';
    updateMenuVisibility();
  }
});

el.btnPause.addEventListener('click', () => {
  if (game.phase === 'playing') {
    game.togglePause();
    audio.setPaused(true);
    updateGameControls();
  }
});

el.btnResume.addEventListener('click', () => {
  if (game.phase === 'paused') {
    game.togglePause();
    audio.setPaused(false);
    updateGameControls();
  }
});

el.btnRestart.addEventListener('click', () => {
  if (game.phase === 'gameover') {
    game.prepareNewGame();
    game.start();
    if (game.musicType !== 0) {
      audio.startMusic(game.musicType);
    }
    updateGameControls();
  }
});

// Keyboard click handlers
el.keyboardOverlay.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  if (!target.classList.contains('keyboard__key')) return;

  const key = target.dataset.key;
  if (!key) return;

  if (key === 'DEL') {
    if (game.enteredName.length > 0) {
      game.enteredName = game.enteredName.slice(0, -1);
      audio.sfxMove();
    }
  } else if (key === 'OK') {
    if (game.enteredName.length > 0) {
      // Save high score
      addHighScore(game.mode, {
        name: game.enteredName,
        score: game.score,
        level: game.level,
      });
      game.phase = 'gameover';
      game.gameOverSelection = 'restart';
      audio.sfxRotate();
      updateGameControls();
    }
  } else if (game.enteredName.length < 6) {
    game.enteredName += key;
    audio.sfxMove();
  }

  updateKeyboardDisplay();
});

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
  return game.menuRows().length;
}

function moveMenuCursor(dir: -1 | 1): void {
  const rows = menuRowCount();
  game.menuCursor = (game.menuCursor + dir + rows) % rows;
}

function changeMenuValue(dir: -1 | 1): void {
  switch (game.menuRows()[game.menuCursor]) {
    case 'mode':
      game.startMode = game.startMode === 'a' ? 'b' : 'a';
      if (game.menuCursor >= menuRowCount()) game.menuCursor = menuRowCount() - 1;
      break;
    case 'level':
      game.startLevel = Math.min(19, Math.max(0, game.startLevel + dir));
      break;
    case 'height':
      game.startHeight = Math.min(5, Math.max(0, game.startHeight + dir));
      break;
  }
}

/* ---------- pre-game menu input handling ---------- */

function handleMenuTypeInput(code: string): void {
  switch (code) {
    case 'ArrowLeft':
      // Select A-TYPE
      menuState.gameType = 'a';
      audio.sfxMove();
      break;
    case 'ArrowRight':
      // Select B-TYPE
      menuState.gameType = 'b';
      audio.sfxMove();
      break;
    case 'ArrowUp':
      // Cycle music selection up
      menuState.musicCursor = (menuState.musicCursor - 1 + 4) % 4;
      menuState.musicType = menuState.musicCursor === 3 ? 0 : (menuState.musicCursor + 1) as MusicType;
      audio.sfxMove();
      break;
    case 'ArrowDown':
      // Cycle music selection down
      menuState.musicCursor = (menuState.musicCursor + 1) % 4;
      menuState.musicType = menuState.musicCursor === 3 ? 0 : (menuState.musicCursor + 1) as MusicType;
      audio.sfxMove();
      break;
    case 'Enter':
    case 'Space':
      // Proceed to level select screen
      game.startMode = menuState.gameType;
      game.musicType = menuState.musicType;
      menuState.phase = menuState.gameType === 'a' ? 'atype' : 'btype';
      menuState.level = game.startLevel;
      menuState.height = game.startHeight;
      game.phase = 'menu-level';
      audio.sfxRotate();
      break;
  }
}

function handleMenuLevelInput(code: string): void {
  const isAType = menuState.phase === 'atype';
  const focusLevel = isAType || menuState.btypeFocus === 'level';

  switch (code) {
    case 'ArrowUp':
      if (focusLevel) {
        if (menuState.level >= 5) menuState.level -= 5;
      } else {
        if (menuState.height >= 3) menuState.height -= 3;
      }
      audio.sfxMove();
      break;
    case 'ArrowDown':
      if (focusLevel) {
        if (menuState.level < 5) menuState.level += 5;
      } else {
        if (menuState.height < 3) menuState.height += 3;
      }
      audio.sfxMove();
      break;
    case 'ArrowLeft':
      if (focusLevel) {
        if (menuState.level > 0) menuState.level--;
      } else {
        if (menuState.height > 0) menuState.height--;
      }
      audio.sfxMove();
      break;
    case 'ArrowRight':
      if (focusLevel) {
        if (menuState.level < 9) menuState.level++;
      } else {
        if (menuState.height < 5) menuState.height++;
      }
      audio.sfxMove();
      break;
    case 'Tab':
      // Switch focus between level and height (B-type only)
      if (!isAType) {
        menuState.btypeFocus = menuState.btypeFocus === 'level' ? 'height' : 'level';
        audio.sfxMove();
      }
      break;
    case 'Escape':
    case 'Backspace':
      // Go back to type selection
      menuState.phase = 'type';
      menuState.btypeFocus = 'level';
      game.phase = 'menu-type';
      audio.sfxMove();
      break;
    case 'Enter':
    case 'Space':
      // Go to settings screen
      game.startLevel = menuState.level;
      game.startHeight = menuState.height;
      menuState.phase = 'settings';
      menuState.settingsCursor = 0;
      game.phase = 'menu-settings';
      audio.sfxRotate();
      break;
  }
}

function handleMenuSettingsInput(code: string): void {
  switch (code) {
    case 'ArrowLeft': {
      // Cycle drop key left
      const dropKeys: ('space' | 'up' | 'default')[] = ['space', 'up', 'default'];
      const idx = dropKeys.indexOf(menuState.dropKey);
      menuState.dropKey = dropKeys[(idx - 1 + dropKeys.length) % dropKeys.length];
      audio.sfxMove();
      break;
    }
    case 'ArrowRight': {
      // Cycle drop key right
      const dropKeys: ('space' | 'up' | 'default')[] = ['space', 'up', 'default'];
      const idx = dropKeys.indexOf(menuState.dropKey);
      menuState.dropKey = dropKeys[(idx + 1) % dropKeys.length];
      audio.sfxMove();
      break;
    }
    case 'ArrowUp':
    case 'ArrowDown':
      // Toggle ghost mode
      menuState.ghost = !menuState.ghost;
      audio.sfxMove();
      break;
    case 'Escape':
    case 'Backspace':
      // Go back to level select
      menuState.phase = menuState.gameType === 'a' ? 'atype' : 'btype';
      game.phase = 'menu-level';
      audio.sfxMove();
      break;
    case 'Enter':
    case 'Space':
      // Apply settings and prepare for new game
      game.dropKey = menuState.dropKey;
      game.ghost = menuState.ghost;
      game.saveSettings();
      game.prepareNewGame();
      game.phase = 'start';
      updateMenuVisibility();
      audio.sfxRotate();
      break;
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
    case 'harddrop':
      audio.sfxHardDrop();
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
      // Check for high score
      if (isHighScore(game.mode, game.score)) {
        game.enteredName = '';
        game.phase = 'enter-name';
      } else {
        game.phase = 'gameover';
      }
      updateGameControls();
      break;
    case 'win':
      audio.stopMusic();
      audio.sfxWin();
      // Check for high score
      if (isHighScore(game.mode, game.score)) {
        game.enteredName = '';
        game.phase = 'enter-name';
      } else {
        game.phase = 'gameover';
      }
      updateGameControls();
      break;
  }
});

window.addEventListener('keydown', (e) => {
  audio.unlock(); // browsers require a user gesture before audio
  if (e.repeat) {
    if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
    return;
  }

  // Handle pre-game menu phases
  if (game.phase === 'menu-type') {
    e.preventDefault();
    handleMenuTypeInput(e.code);
    return;
  }

  if (game.phase === 'menu-level') {
    e.preventDefault();
    handleMenuLevelInput(e.code);
    return;
  }

  if (game.phase === 'menu-settings') {
    e.preventDefault();
    handleMenuSettingsInput(e.code);
    return;
  }

  // Handle pause menu
  if (game.phase === 'paused') {
    e.preventDefault();
    switch (e.code) {
      case 'ArrowUp':
      case 'ArrowDown':
        game.pauseSelection = game.pauseSelection === 'continue' ? 'quit' : 'continue';
        audio.sfxMove();
        break;
      case 'Enter':
      case 'Space':
        if (game.pauseSelection === 'continue') {
          game.togglePause();
          audio.setPaused(false);
          updateGameControls();
        } else {
          // Quit to main menu
          audio.setPaused(false); // Reset audio state before stopping
          audio.stopMusic();
          game.phase = 'menu-type';
          menuState.phase = 'type';
          updateMenuVisibility();
        }
        audio.sfxRotate();
        break;
      case 'Escape':
      case 'KeyP':
        // Resume on ESC/P
        game.togglePause();
        audio.setPaused(false);
        updateGameControls();
        break;
    }
    return;
  }

  // Handle game over menu
  if (game.phase === 'gameover') {
    e.preventDefault();
    switch (e.code) {
      case 'ArrowUp':
      case 'ArrowDown':
        game.gameOverSelection = game.gameOverSelection === 'restart' ? 'quit' : 'restart';
        audio.sfxMove();
        break;
      case 'Enter':
      case 'Space':
        if (game.gameOverSelection === 'restart') {
          game.start();
          if (game.musicType !== 0) {
            audio.startMusic(game.musicType);
          }
        } else {
          // Quit to main menu
          audio.setPaused(false); // Ensure audio state is reset
          game.phase = 'menu-type';
          menuState.phase = 'type';
          updateMenuVisibility();
        }
        audio.sfxRotate();
        break;
    }
    return;
  }

  // Handle name entry
  if (game.phase === 'enter-name') {
    e.preventDefault();
    if (e.code === 'Enter') {
      // Save score if name was entered
      if (game.enteredName.length > 0) {
        addHighScore(game.mode, {
          name: game.enteredName,
          score: game.score,
          level: game.level,
        });
        // Reload scores
        if (game.mode === 'a') {
          aScores = loadHighScores('a');
        } else {
          bScores = loadHighScores('b');
        }
      }
      // Go to game over menu
      game.phase = 'gameover';
      game.gameOverSelection = 'restart';
      audio.sfxRotate();
    } else if (e.code === 'Backspace') {
      // Delete last character
      if (game.enteredName.length > 0) {
        game.enteredName = game.enteredName.slice(0, -1);
        audio.sfxMove();
      }
    } else if (e.code === 'Escape') {
      // Skip name entry
      game.phase = 'gameover';
      game.gameOverSelection = 'restart';
    } else if (e.key.length === 1 && /[A-Za-z0-9]/.test(e.key) && game.enteredName.length < 6) {
      // Add character (letters and numbers only)
      game.enteredName += e.key.toUpperCase();
      audio.sfxMove();
    }
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
      else if (game.dropKey === 'up') game.hardDrop();
      else game.rotate(1);
      break;
    case 'KeyX':
      e.preventDefault();
      game.rotate(1);
      break;
    case 'KeyZ':
      game.rotate(-1);
      break;
    case 'Space':
      e.preventDefault();
      if (game.dropKey === 'space') game.hardDrop();
      else game.rotate(1);
      break;
    case 'KeyG':
      game.ghost = !game.ghost;
      game.saveSettings();
      break;
    case 'Enter':
      if (game.phase === 'win') {
        game.phase = 'menu-type';
        menuState.phase = 'type';
        updateMenuVisibility();
      } else if (game.phase === 'start') {
        game.start();
        if (game.musicType !== 0) {
          audio.startMusic(game.musicType);
        }
        updateGameControls();
      }
      break;
    case 'KeyP':
    case 'Escape':
      if (game.phase === 'start') {
        // Go back to settings screen before game starts
        game.phase = 'menu-settings';
        menuState.phase = 'settings';
        updateMenuVisibility();
        audio.sfxMove();
      } else if (game.phase === 'playing') {
        game.togglePause();
        audio.setPaused(true);
        updateGameControls();
      }
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

/* ---------- touch/gesture handling for mobile ---------- */

const boardCanvas = document.getElementById('board') as HTMLCanvasElement;

let pointerStartX = 0;
let pointerStartY = 0;
let pointerStartTime = 0;
let activePointerId: number | null = null;

const SWIPE_THRESHOLD = 30; // minimum distance for swipe
const TAP_THRESHOLD = 10; // max movement for tap
const TAP_TIME_THRESHOLD = 300; // max time for tap in ms

boardCanvas.addEventListener('pointerdown', (e) => {
  if (game.phase !== 'playing' && game.phase !== 'start') return;
  if (activePointerId !== null) return; // already tracking a pointer

  activePointerId = e.pointerId;
  pointerStartX = e.clientX;
  pointerStartY = e.clientY;
  pointerStartTime = Date.now();

  // Capture pointer to receive events even outside the element
  boardCanvas.setPointerCapture(e.pointerId);

  e.preventDefault();
});

boardCanvas.addEventListener('pointermove', (e) => {
  if (activePointerId !== e.pointerId) return;
  if (game.phase !== 'playing' && game.phase !== 'start') return;
  e.preventDefault();
});

function handlePointerEnd(e: PointerEvent): void {
  if (activePointerId !== e.pointerId) return;

  const currentPhase = game.phase;
  activePointerId = null;

  // Release pointer capture
  boardCanvas.releasePointerCapture(e.pointerId);

  if (currentPhase !== 'playing' && currentPhase !== 'start') return;

  const deltaX = e.clientX - pointerStartX;
  const deltaY = e.clientY - pointerStartY;
  const deltaTime = Date.now() - pointerStartTime;
  const absX = Math.abs(deltaX);
  const absY = Math.abs(deltaY);

  // Handle tap to start game
  if (currentPhase === 'start') {
    if (absX < TAP_THRESHOLD && absY < TAP_THRESHOLD && deltaTime < TAP_TIME_THRESHOLD) {
      game.start();
      if (game.musicType !== 0) {
        audio.startMusic(game.musicType);
      }
      updateGameControls();
    }
    return;
  }

  // Below is for 'playing' phase only
  // Check if it's a tap (small movement, short time)
  if (absX < TAP_THRESHOLD && absY < TAP_THRESHOLD && deltaTime < TAP_TIME_THRESHOLD) {
    // Tap to rotate
    game.rotate(1);
    return;
  }

  // Check for swipe
  if (absX > SWIPE_THRESHOLD || absY > SWIPE_THRESHOLD) {
    if (absX > absY) {
      // Horizontal swipe
      if (deltaX > 0) {
        game.move(1); // swipe right
      } else {
        game.move(-1); // swipe left
      }
    } else {
      // Vertical swipe
      if (deltaY > 0 && game.dropKey !== 'default') {
        // Swipe down - hard drop (only if drop mode is not default)
        game.hardDrop();
      }
    }
  }
}

boardCanvas.addEventListener('pointerup', handlePointerEnd);
boardCanvas.addEventListener('pointercancel', handlePointerEnd);

// Prevent context menu on long press
boardCanvas.addEventListener('contextmenu', (e) => {
  e.preventDefault();
});

// Prevent page scroll and zoom on mobile
document.addEventListener('touchmove', (e) => {
  e.preventDefault();
}, { passive: false });

document.addEventListener('gesturestart', (e) => {
  e.preventDefault();
});

document.addEventListener('gesturechange', (e) => {
  e.preventDefault();
});

document.addEventListener('gestureend', (e) => {
  e.preventDefault();
});

/* ---------- HUD ---------- */

const shown = { lines: '', top: '', score: '', level: '', stats: '', atype: '' };
let iconLevel = -1;

function updateHud(): void {
  const isStart = game.phase === 'start';
  const linesValue = isStart
    ? game.startMode === 'b'
      ? B_TYPE_GOAL
      : 0
    : game.mode === 'b'
      ? Math.max(0, B_TYPE_GOAL - game.lines)
      : game.lines;
  const lines = String(linesValue).padStart(3, '0');
  const top = String(game.top).padStart(6, '0');
  const score = String(isStart ? 0 : game.score).padStart(6, '0');
  const level = String(isStart ? game.startLevel : game.level).padStart(2, '0');
  const atype = game.startMode === 'b' ? 'B-TYPE' : 'A-TYPE';
  const stats = TYPES.map((t) => (isStart ? '000' : Math.min(999, game.stats[t]).toString().padStart(3, '0')));
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

  updateMenuVisibility();

  if (game.phase === 'menu-type' || game.phase === 'menu-level' || game.phase === 'menu-settings') {
    // Draw menu
    if (game.phase === 'menu-type') {
      menuState.phase = 'type';
    } else if (game.phase === 'menu-level') {
      menuState.phase = menuState.gameType === 'a' ? 'atype' : 'btype';
    } else {
      menuState.phase = 'settings';
    }
    menuRenderer.draw(menuState, aScores, bScores);
  } else {
    game.update(dt);
    updateHud();
    renderer.draw(game, now);
  }

  requestAnimationFrame(frame);
}

// Initialize menu visibility
updateMenuVisibility();
requestAnimationFrame(frame);
