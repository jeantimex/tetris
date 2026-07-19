import { SHAPES, TYPES, type PieceType } from './pieces';

export const COLS = 10;
export const ROWS = 20;

export type Cell = PieceType | 0;
export type Phase = 'start' | 'playing' | 'clearing' | 'paused' | 'gameover';
export type GameEvent = 'move' | 'rotate' | 'lock' | 'clear' | 'levelup' | 'gameover';

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
const SOFT_DROP_MS = 35;
const CLEAR_ANIM_MS = 420;
const LINE_POINTS = [40, 100, 300, 1200];
const TOP_KEY = 'tetris-top-score';

export class Game {
  board: Cell[][] = [];
  phase: Phase = 'start';
  active: ActivePiece | null = null;
  nextType: PieceType = 'T';
  score = 0;
  top = 0;
  lines = 0;
  level = 0;
  startLevel = 0;
  clearingRows: number[] = [];
  stats: Record<PieceType, number> = { I: 0, O: 0, T: 0, S: 0, Z: 0, J: 0, L: 0 };

  private prevType: PieceType | null = null;
  private gravityAcc = 0;
  private clearAcc = 0;
  private softDrop = false;
  private listeners: ((e: GameEvent, data: number) => void)[] = [];

  constructor() {
    this.resetBoard();
    this.top = Number(localStorage.getItem(TOP_KEY) ?? 0) || 0;
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
    this.level = this.startLevel;
    this.prevType = null;
    this.clearingRows = [];
    this.gravityAcc = 0;
    this.stats = { I: 0, O: 0, T: 0, S: 0, Z: 0, J: 0, L: 0 };
    this.nextType = this.randomType();
    this.phase = 'playing';
    this.spawn();
  }

  togglePause(): void {
    if (this.phase === 'playing') this.phase = 'paused';
    else if (this.phase === 'paused') this.phase = 'playing';
  }

  setSoftDrop(on: boolean): void {
    this.softDrop = on;
  }

  update(dtMs: number): void {
    if (this.phase === 'playing') {
      const interval = this.softDrop ? SOFT_DROP_MS : this.gravityInterval();
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
        this.phase = 'playing';
        this.spawn();
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

  /** One gravity step: move down or lock. */
  private tick(): void {
    if (!this.active) return;
    if (!this.collides(this.active.type, this.active.rot, this.active.x, this.active.y + 1)) {
      this.active.y += 1;
      if (this.softDrop) this.score += 1;
    } else {
      this.lock();
    }
  }

  private lock(): void {
    if (!this.active) return;
    for (const [cx, cy] of this.cells(this.active)) {
      if (cy >= 0 && cy < ROWS && cx >= 0 && cx < COLS) this.board[cy][cx] = this.active.type;
    }
    this.active = null;
    this.emit('lock');

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
      this.level = this.startLevel + Math.floor(this.lines / 10);
      this.phase = 'clearing';
      this.emit('clear', full.length);
      if (this.level > prevLevel) this.emit('levelup', this.level);
    } else {
      this.spawn();
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
    this.active = { type, rot: 0, x: 3, y: 0 };
    if (this.collides(type, 0, 3, 0)) {
      this.active = null;
      this.phase = 'gameover';
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
}
