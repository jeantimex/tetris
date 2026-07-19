import { SHAPES, TYPES, type PieceType } from './pieces';

export const COLS = 10;
export const ROWS = 20;

export type Cell = PieceType | 0;
export type Phase = 'menu-type' | 'menu-level' | 'menu-settings' | 'start' | 'playing' | 'clearing' | 'paused' | 'gameover' | 'win';
export type PauseOption = 'continue' | 'quit';
export type GameOverOption = 'restart' | 'quit';
export type GameMode = 'a' | 'b';
export type GameEvent = 'move' | 'rotate' | 'lock' | 'clear' | 'levelup' | 'gameover' | 'win' | 'harddrop';

/** B-Type: lines to clear to win. */
export const B_TYPE_GOAL = 25;
/** Garbage rows per HEIGHT setting (0-5). */
const GARBAGE_ROWS = [0, 2, 4, 6, 8, 10];
const SETTINGS_KEY = 'tetris-settings';

export type MenuRowId = 'mode' | 'level' | 'height';

export interface ActivePiece {
  type: PieceType;
  rot: number;
  x: number;
  y: number;
}

/** NES gravity table: frames per row by level (last entry repeats). */
const GRAVITY_FRAMES = [
  48, 43, 38, 33, 28, 23, 18, 13, 8, 6,
  5, 5, 5, 4, 4, 4, 3, 3, 3, 2,
  2, 2, 2, 2, 2, 2, 2, 2, 2, 1,
];
const FRAME_MS = 1000 / 60;
const CLEAR_ANIM_MS = 300; // NES line clear delay: 17-20 frames
const LINE_POINTS = [40, 100, 300, 1200];
const TOP_KEY = 'tetris-top-score';

export class Game {
  board: Cell[][] = [];
  phase: Phase = 'menu-type';
  active: ActivePiece | null = null;
  nextType: PieceType = 'T';
  score = 0;
  top = 0;
  lines = 0;
  level = 0;
  startLevel = 0;
  startMode: GameMode = 'a';
  startHeight = 0;
  mode: GameMode = 'a';
  musicType: 1 | 2 | 3 | 0 = 1;
  menuCursor = 0;
  dropKey: 'space' | 'up' | 'default' = 'space';
  ghost = true;
  pauseSelection: PauseOption = 'continue';
  gameOverSelection: GameOverOption = 'restart';
  clearingRows: number[] = [];
  stats: Record<PieceType, number> = { I: 0, O: 0, T: 0, S: 0, Z: 0, J: 0, L: 0 };

  private prevType: PieceType | null = null;
  private gravityAcc = 0;
  private clearAcc = 0;
  private softDrop = false;
  private softDropRows = 0; // rows dropped during the current hold (drives acceleration)
  private areAcc = -1; // >= 0 while waiting out the entry delay (ARE)
  private areDelayMs = 0;
  private pendingWin = false;
  private listeners: ((e: GameEvent, data: number) => void)[] = [];

  constructor() {
    this.resetBoard();
    this.top = Number(localStorage.getItem(TOP_KEY) ?? 0) || 0;
    try {
      const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}');
      if (s.dropKey === 'up' || s.dropKey === 'space' || s.dropKey === 'default') this.dropKey = s.dropKey;
      if (typeof s.ghost === 'boolean') this.ghost = s.ghost;
    } catch {
      // ignore corrupt settings
    }
  }

  saveSettings(): void {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ dropKey: this.dropKey, ghost: this.ghost }));
  }

  menuRows(): MenuRowId[] {
    const rows: MenuRowId[] = ['mode', 'level'];
    if (this.startMode === 'b') rows.push('height');
    return rows;
  }

  on(fn: (e: GameEvent, data: number) => void): void {
    this.listeners.push(fn);
  }

  private emit(e: GameEvent, data = 0): void {
    for (const fn of this.listeners) fn(e, data);
  }

  private resetBoard(): void {
    this.board = Array.from({ length: ROWS }, () => Array<Cell>(COLS).fill(0));
  }

  start(): void {
    this.resetBoard();
    this.score = 0;
    this.lines = 0;
    this.mode = this.startMode;
    this.level = this.startLevel;
    this.prevType = null;
    this.clearingRows = [];
    this.pendingWin = false;
    this.gravityAcc = 0;
    this.softDrop = false;
    this.areAcc = -1;
    this.stats = { I: 0, O: 0, T: 0, S: 0, Z: 0, J: 0, L: 0 };
    if (this.mode === 'b') this.generateGarbage();
    this.nextType = this.randomType();
    this.phase = 'playing';
    this.spawn();
  }

  togglePause(): void {
    if (this.phase === 'playing') {
      this.phase = 'paused';
      this.pauseSelection = 'continue';
    } else if (this.phase === 'paused') {
      this.phase = 'playing';
    }
  }

  setSoftDrop(on: boolean): void {
    if (on && this.phase === 'playing' && this.active && !this.softDrop) {
      // fresh press starts a new hold: reset acceleration, instantly drop one row
      this.softDropRows = 0;
      if (!this.collides(this.active.type, this.active.rot, this.active.x, this.active.y + 1)) {
        this.active.y += 1;
        this.score += 1;
        this.softDropRows += 1;
        this.gravityAcc = 0;
      }
    }
    this.softDrop = on;
  }

  update(dtMs: number): void {
    if (this.phase === 'playing') {
      if (this.areAcc >= 0) {
        // entry delay before the next piece spawns
        this.areAcc += dtMs;
        if (this.areAcc >= this.areDelayMs) {
          this.areAcc = -1;
          this.spawn();
        }
        return;
      }
      const interval = this.dropInterval();
      this.gravityAcc += dtMs;
      while (this.gravityAcc >= interval && this.phase === 'playing') {
        this.gravityAcc -= interval;
        this.tick();
        if (this.softDrop && this.active) break; // re-evaluate after lock
      }
    } else if (this.phase === 'clearing') {
      this.clearAcc += dtMs;
      if (this.clearAcc >= CLEAR_ANIM_MS) {
        this.collapseRows();
        if (this.pendingWin) {
          this.pendingWin = false;
          this.win();
        } else {
          this.phase = 'playing';
          this.beginAre();
        }
      }
    }
  }

  move(dir: -1 | 1): void {
    if (this.phase !== 'playing' || !this.active) return;
    if (!this.collides(this.active.type, this.active.rot, this.active.x + dir, this.active.y)) {
      this.active.x += dir;
      this.emit('move');
    }
  }

  rotate(dir: -1 | 1): void {
    if (this.phase !== 'playing' || !this.active) return;
    const states = SHAPES[this.active.type].length;
    const rot = (this.active.rot + dir + states) % states;
    if (!this.collides(this.active.type, rot, this.active.x, this.active.y)) {
      this.active.rot = rot;
      this.emit('rotate');
    }
  }

  /** Row the active piece would land on if dropped straight down. */
  ghostY(): number | null {
    if (!this.active) return null;
    let y = this.active.y;
    while (!this.collides(this.active.type, this.active.rot, this.active.x, y + 1)) y += 1;
    return y;
  }

  /** Instantly drop and lock the active piece (+2 points per row). */
  hardDrop(): void {
    if (this.phase !== 'playing' || !this.active) return;
    const y = this.ghostY();
    if (y === null) return;
    this.score += (y - this.active.y) * 2;
    this.active.y = y;
    this.gravityAcc = 0;
    this.emit('harddrop');
    this.lock();
  }

  /** One gravity step: move down or lock. */
  private tick(): void {
    if (!this.active) return;
    if (!this.collides(this.active.type, this.active.rot, this.active.x, this.active.y + 1)) {
      this.active.y += 1;
      if (this.softDrop) {
        this.score += 1;
        this.softDropRows += 1;
      }
    } else {
      this.lock();
    }
  }

  private lock(): void {
    if (!this.active) return;
    let topRow = ROWS - 2;
    for (const [cx, cy] of this.cells(this.active)) {
      if (cy >= 0 && cy < ROWS && cx >= 0 && cx < COLS) this.board[cy][cx] = this.active.type;
      if (cy < topRow) topRow = cy;
    }
    this.active = null;
    this.emit('lock');
    this.areDelayMs = this.areFrames(topRow) * FRAME_MS;

    const full: number[] = [];
    for (let y = 0; y < ROWS; y++) {
      if (this.board[y].every((c) => c !== 0)) full.push(y);
    }

    if (full.length > 0) {
      const prevLevel = this.level;
      this.clearingRows = full;
      this.clearAcc = 0;
      this.lines += full.length;
      this.score += LINE_POINTS[full.length - 1] * (this.level + 1);
      if (this.mode === 'a') {
        this.level = this.startLevel + Math.floor(this.lines / 10);
        if (this.level > prevLevel) this.emit('levelup', this.level);
      }
      if (this.mode === 'b' && this.lines >= B_TYPE_GOAL) this.pendingWin = true;
      this.phase = 'clearing';
      this.emit('clear', full.length);
    } else {
      this.beginAre();
    }
  }

  /** NES entry delay: 10 frames locking in the bottom two rows, +2 per 4 rows above (max 18). */
  private areFrames(topRow: number): number {
    return Math.min(18, 10 + 2 * Math.floor((18 - Math.min(18, Math.max(0, topRow))) / 4));
  }

  private beginAre(): void {
    this.areAcc = 0;
  }

  private win(): void {
    this.phase = 'win';
    if (this.score > this.top) {
      this.top = this.score;
      localStorage.setItem(TOP_KEY, String(this.top));
    }
    this.emit('win');
  }

  /** NES B-Type: random garbage rows at the bottom; every row gets at least one block and one hole. */
  private generateGarbage(): void {
    const rows = GARBAGE_ROWS[Math.min(this.startHeight, GARBAGE_ROWS.length - 1)];
    for (let r = 0; r < rows; r++) {
      const y = ROWS - 1 - r;
      const row: Cell[] = Array.from({ length: COLS }, () =>
        Math.random() < 0.5 ? TYPES[Math.floor(Math.random() * TYPES.length)] : 0,
      );
      const filled = row.filter((c) => c !== 0).length;
      if (filled === 0) row[Math.floor(Math.random() * COLS)] = 'T';
      if (filled === COLS) row[Math.floor(Math.random() * COLS)] = 0;
      this.board[y] = row;
    }
  }

  private collapseRows(): void {
    for (const y of this.clearingRows) {
      this.board.splice(y, 1);
      this.board.unshift(Array<Cell>(COLS).fill(0));
    }
    this.clearingRows = [];
  }

  private spawn(): void {
    const type = this.nextType;
    this.nextType = this.randomType();
    this.stats[type] += 1;
    this.gravityAcc = 0;
    this.softDropRows = 0;
    this.active = { type, rot: 0, x: 3, y: 0 };
    if (this.collides(type, 0, 3, 0)) {
      this.active = null;
      this.phase = 'gameover';
      this.gameOverSelection = 'restart';
      if (this.score > this.top) {
        this.top = this.score;
        localStorage.setItem(TOP_KEY, String(this.top));
      }
      this.emit('gameover');
    }
  }

  /** NES-style randomizer: one reroll on repeat of the previous piece. */
  private randomType(): PieceType {
    let t = TYPES[Math.floor(Math.random() * TYPES.length)];
    if (t === this.prevType) t = TYPES[Math.floor(Math.random() * TYPES.length)];
    this.prevType = t;
    return t;
  }

  cells(piece: ActivePiece): [number, number][] {
    return SHAPES[piece.type][piece.rot].map(([cx, cy]) => [piece.x + cx, piece.y + cy]);
  }

  private collides(type: PieceType, rot: number, x: number, y: number): boolean {
    for (const [cx, cy] of SHAPES[type][rot]) {
      const bx = x + cx;
      const by = y + cy;
      if (bx < 0 || bx >= COLS || by >= ROWS) return true;
      if (by >= 0 && this.board[by][bx] !== 0) return true;
    }
    return false;
  }

  private gravityInterval(): number {
    const frames = GRAVITY_FRAMES[Math.min(this.level, GRAVITY_FRAMES.length - 1)];
    return frames * FRAME_MS;
  }

  /** NES soft drop is 1/2G: twice the current level's gravity. */
  private dropInterval(): number {
    const normal = this.gravityInterval();
    return this.softDrop ? Math.max(FRAME_MS, normal / (2 + 4 * this.softDropRows)) : normal;
  }
}
