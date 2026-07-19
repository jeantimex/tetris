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
      if (game.phase === 'playing' && game.ghost) {
        const gy = game.ghostY();
        if (gy !== null && gy !== game.active.y) {
          // ghost piece: dashed landing outline
          ctx.save();
          ctx.globalAlpha = 0.75;
          ctx.setLineDash([5, 4]);
          ctx.lineWidth = 2;
          ctx.strokeStyle = colorsFor(game.active.type, game.level).light;
          for (const [x, y] of game.cells({ ...game.active, y: gy })) {
            if (y >= 0) ctx.strokeRect(x * CELL + 2, y * CELL + 2, CELL - 4, CELL - 4);
          }
          ctx.restore();
        }
      }
      const colors = colorsFor(game.active.type, game.level);
      for (const [x, y] of game.cells(game.active)) {
        if (y >= 0) this.drawBlock(ctx, x * CELL, y * CELL, CELL, colors);
      }
    }

    if (game.phase === 'start') this.overlay(this.startLines(game));
    else if (game.phase === 'paused') this.drawPauseMenu(game);
    else if (game.phase === 'win') {
      this.overlay([
        { text: 'B-TYPE', size: 22, gap: 16 },
        { text: 'COMPLETE!', size: 22, gap: 40 },
        { text: 'PRESS ENTER', size: 13, gap: 0 },
      ]);
    } else if (game.phase === 'gameover') {
      this.drawGameOverMenu(game);
    } else if (game.phase === 'enter-name') {
      this.drawNameEntry(game);
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

  private startLines(_game: Game): { text: string; size: number; gap: number }[] {
    return [
      { text: 'TETRIS', size: 26, gap: 50 },
      { text: 'ENTER   START', size: 14, gap: 24 },
      { text: 'Z X   ROTATE', size: 14, gap: 24 },
      { text: 'P PAUSE  M SOUND', size: 14, gap: 0 },
    ];
  }

  private drawPauseMenu(game: Game): void {
    const ctx = this.bctx;
    const cx = BOARD_W / 2;
    const cy = BOARD_H / 2;

    // Background
    ctx.fillStyle = '#000';
    ctx.fillRect(0, cy - 100, BOARD_W, 200);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#f4f8f8';

    // Title
    ctx.font = `24px ${FONT}`;
    ctx.fillText('PAUSED', cx, cy - 50);

    // Options
    const options: { text: string; key: 'continue' | 'quit' }[] = [
      { text: 'CONTINUE', key: 'continue' },
      { text: 'QUIT', key: 'quit' },
    ];

    ctx.font = `14px ${FONT}`;
    options.forEach((opt, i) => {
      const y = cy + 20 + i * 40;
      const selected = game.pauseSelection === opt.key;
      if (selected) {
        ctx.fillStyle = '#f4f8f8';
        ctx.fillText('>', cx - 80, y);
        ctx.fillText('<', cx + 80, y);
      }
      ctx.fillStyle = selected ? '#f4f8f8' : '#888888';
      ctx.fillText(opt.text, cx, y);
    });
  }

  private drawGameOverMenu(game: Game): void {
    const ctx = this.bctx;
    const cx = BOARD_W / 2;
    const cy = BOARD_H / 2;

    // Background
    ctx.fillStyle = '#000';
    ctx.fillRect(0, cy - 100, BOARD_W, 200);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#f4f8f8';

    // Title
    ctx.font = `24px ${FONT}`;
    ctx.fillText('GAME OVER', cx, cy - 50);

    // Options
    const options: { text: string; key: 'restart' | 'quit' }[] = [
      { text: 'RESTART', key: 'restart' },
      { text: 'QUIT', key: 'quit' },
    ];

    ctx.font = `14px ${FONT}`;
    options.forEach((opt, i) => {
      const y = cy + 20 + i * 40;
      const selected = game.gameOverSelection === opt.key;
      if (selected) {
        ctx.fillStyle = '#f4f8f8';
        ctx.fillText('>', cx - 80, y);
        ctx.fillText('<', cx + 80, y);
      }
      ctx.fillStyle = selected ? '#f4f8f8' : '#888888';
      ctx.fillText(opt.text, cx, y);
    });
  }

  private drawNameEntry(game: Game): void {
    const ctx = this.bctx;
    const cx = BOARD_W / 2;
    const cy = BOARD_H / 2;

    // Background
    ctx.fillStyle = '#000';
    ctx.fillRect(0, cy - 120, BOARD_W, 240);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#f4f8f8';

    // Title
    ctx.font = `18px ${FONT}`;
    ctx.fillText('HIGH SCORE!', cx, cy - 80);

    // Score display
    ctx.font = `14px ${FONT}`;
    ctx.fillText(`SCORE: ${String(game.score).padStart(6, '0')}`, cx, cy - 40);

    // Name entry prompt
    ctx.fillText('ENTER YOUR NAME', cx, cy);

    // Name input box
    const name = game.enteredName.padEnd(6, '_');
    ctx.font = `20px ${FONT}`;
    ctx.fillText(name, cx, cy + 50);

    // Instructions
    ctx.font = `10px ${FONT}`;
    ctx.fillStyle = '#888888';
    ctx.fillText('ENTER TO CONFIRM', cx, cy + 100);
  }
}

const FLASH_COLORS: BlockColors = {
  fill: '#e8e8e8',
  light: '#ffffff',
  dark: '#909090',
  edge: '#282828',
};
