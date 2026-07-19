import { COLS, ROWS, type Game } from './game';
import { SHAPES, type PieceType } from './pieces';
import { colorsFor, type BlockColors } from './palettes';

const BOARD_W = 380;
const BOARD_H = 760;
const CELL = BOARD_W / COLS; // 38
const NEXT_W = 172;
const NEXT_H = 160;
const NEXT_CELL = 32;
const STAT_W = 82;
const STAT_H = 42;
const STAT_CELL = 20;

const FONT = '"Press Start 2P", monospace';

function setupCanvas(canvas: HTMLCanvasElement, w: number, h: number): CanvasRenderingContext2D {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d context');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

export class Renderer {
  private bctx: CanvasRenderingContext2D;
  private nctx: CanvasRenderingContext2D;
  private statCtx = new Map<PieceType, CanvasRenderingContext2D>();

  constructor(
    boardCanvas: HTMLCanvasElement,
    nextCanvas: HTMLCanvasElement,
    statCanvases: Map<PieceType, HTMLCanvasElement>,
  ) {
    this.bctx = setupCanvas(boardCanvas, BOARD_W, BOARD_H);
    this.nctx = setupCanvas(nextCanvas, NEXT_W, NEXT_H);
    for (const [type, canvas] of statCanvases) {
      this.statCtx.set(type, setupCanvas(canvas, STAT_W, STAT_H));
    }
  }

  draw(game: Game, now: number): void {
    this.drawBoard(game, now);
    this.drawNext(game);
  }

  private drawBoard(game: Game, now: number): void {
    const ctx = this.bctx;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, BOARD_W, BOARD_H);

    const flashOn = game.phase === 'clearing' && Math.floor(now / 110) % 2 === 0;
    const clearing = new Set(game.clearingRows);

    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const cell = game.board[y][x];
        if (cell === 0) continue;
        if (flashOn && clearing.has(y)) {
          this.drawBlock(ctx, x * CELL, y * CELL, CELL, FLASH_COLORS);
        } else {
          this.drawBlock(ctx, x * CELL, y * CELL, CELL, colorsFor(cell, game.level));
        }
      }
    }

    if (game.active) {
      const colors = colorsFor(game.active.type, game.level);
      for (const [x, y] of game.cells(game.active)) {
        if (y >= 0) this.drawBlock(ctx, x * CELL, y * CELL, CELL, colors);
      }
    }

    if (game.phase === 'start') this.overlay(this.startLines(game));
    else if (game.phase === 'paused') this.overlay([{ text: 'PAUSED', size: 24, gap: 0 }]);
    else if (game.phase === 'gameover') {
      this.overlay([
        { text: 'GAME OVER', size: 24, gap: 40 },
        { text: 'PRESS ENTER', size: 13, gap: 0 },
      ]);
    }
  }

  private drawNext(game: Game): void {
    const ctx = this.nctx;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, NEXT_W, NEXT_H);
    if (game.phase === 'start') return;

    const shape = SHAPES[game.nextType][0];
    const xs = shape.map(([x]) => x);
    const ys = shape.map(([, y]) => y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const w = (maxX - minX + 1) * NEXT_CELL;
    const h = (maxY - minY + 1) * NEXT_CELL;
    const ox = (NEXT_W - w) / 2 - minX * NEXT_CELL;
    const oy = (NEXT_H - h) / 2 - minY * NEXT_CELL;

    const colors = colorsFor(game.nextType, game.level);
    for (const [x, y] of shape) {
      this.drawBlock(ctx, ox + x * NEXT_CELL, oy + y * NEXT_CELL, NEXT_CELL, colors);
    }
  }

  /** Piece icons in the statistics panel; recolors with the level palette. */
  drawStatistics(game: Game): void {
    for (const [type, ctx] of this.statCtx) {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, STAT_W, STAT_H);

      const shape = SHAPES[type][0];
      const xs = shape.map(([x]) => x);
      const ys = shape.map(([, y]) => y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      const w = (maxX - minX + 1) * STAT_CELL;
      const h = (maxY - minY + 1) * STAT_CELL;
      const ox = (STAT_W - w) / 2 - minX * STAT_CELL;
      const oy = (STAT_H - h) / 2 - minY * STAT_CELL;

      const colors = colorsFor(type, game.level);
      for (const [x, y] of shape) {
        this.drawBlock(ctx, ox + x * STAT_CELL, oy + y * STAT_CELL, STAT_CELL, colors);
      }
    }
  }

  /** NES-style beveled block. */
  private drawBlock(ctx: CanvasRenderingContext2D, px: number, py: number, s: number, c: BlockColors): void {
    const o = Math.max(2, Math.round(s * 0.055)); // outer edge
    const b = Math.max(3, Math.round(s * 0.1)); // bevel width
    const a = Math.round(s * 0.19); // corner accent size

    ctx.fillStyle = c.edge;
    ctx.fillRect(px, py, s, s);

    ctx.fillStyle = c.fill;
    ctx.fillRect(px + o, py + o, s - 2 * o, s - 2 * o);

    ctx.fillStyle = c.dark;
    ctx.fillRect(px + o, py + s - o - b, s - 2 * o, b);
    ctx.fillRect(px + s - o - b, py + o, b, s - 2 * o);

    ctx.fillStyle = c.light;
    ctx.fillRect(px + o, py + o, s - 2 * o, b);
    ctx.fillRect(px + o, py + o, b, s - 2 * o);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(px + o + b, py + o + b, a, a);
  }

  private overlay(lines: { text: string; size: number; gap: number }[]): void {
    const ctx = this.bctx;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#f4f8f8';

    const total = lines.reduce((sum, l) => sum + l.size * 1.6 + l.gap, 0);
    const pad = 28;
    const top = (BOARD_H - total) / 2;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, top - pad, BOARD_W, total + pad * 2);
    ctx.fillStyle = '#f4f8f8';

    let y = top;
    for (const line of lines) {
      y += (line.size * 1.6) / 2;
      ctx.font = `${line.size}px ${FONT}`;
      ctx.fillText(line.text, BOARD_W / 2, y);
      y += (line.size * 1.6) / 2 + line.gap;
    }
  }

  private startLines(game: Game): { text: string; size: number; gap: number }[] {
    const lv = String(game.startLevel).padStart(2, '0');
    return [
      { text: 'TETRIS', size: 28, gap: 34 },
      { text: 'PRESS ENTER', size: 13, gap: 30 },
      { text: `LEVEL < ${lv} >`, size: 13, gap: 44 },
      { text: 'ARROWS  MOVE', size: 10, gap: 14 },
      { text: 'Z X     ROTATE', size: 10, gap: 14 },
      { text: 'P       PAUSE', size: 10, gap: 14 },
      { text: 'M       SOUND', size: 10, gap: 0 },
    ];
  }
}

const FLASH_COLORS: BlockColors = {
  fill: '#e8e8e8',
  light: '#ffffff',
  dark: '#909090',
  edge: '#282828',
};
