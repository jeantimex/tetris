import { SHAPES, TYPES } from './pieces';

/**
 * Generates the NES-style wall as a random seamless tessellation of all 7
 * tetromino types: an exact cover of a toroidal grid (so the SVG tiles without
 * seams), solved with a most-constrained-cell-first backtracking search.
 * Regenerated on every page load, so the wall is different each time.
 */

const GRID = 16;
const CELL = 32;
const SIZE = GRID * CELL; // 512

type Cells = [number, number][];

function normalize(cells: Cells): Cells {
  const mx = Math.min(...cells.map((c) => c[0]));
  const my = Math.min(...cells.map((c) => c[1]));
  return cells.map(([x, y]) => [x - mx, y - my]);
}

const ORIENTS: Cells[][] = TYPES.map((t) => SHAPES[t].map((o) => normalize(o as Cells)));

function shuffle<T>(a: T[]): void {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
}

function generateBricks(maxAttempts = 20): Cells[] | null {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const grid = Array.from({ length: GRID }, () => Array<number>(GRID).fill(-1));
    const bricks: Cells[] = [];

    const placementsFor = (ex: number, ey: number): Cells[] => {
      const cands: Cells[] = [];
      for (const piece of ORIENTS) {
        for (const o of piece) {
          for (const [ax, ay] of o) {
            const dx = ex - ax;
            const dy = ey - ay;
            const cells = o.map(
              ([cx, cy]) => [(cx + dx + GRID) % GRID, (cy + dy + GRID) % GRID] as [number, number],
            );
            if (cells.every(([cx, cy]) => grid[cy][cx] === -1)) cands.push(cells);
          }
        }
      }
      return cands;
    };

    const solve = (): boolean => {
      // pick the most constrained empty cell
      let best: Cells[] | null = null;
      for (let y = 0; y < GRID; y++) {
        for (let x = 0; x < GRID; x++) {
          if (grid[y][x] !== -1) continue;
          const c = placementsFor(x, y);
          if (c.length === 0) return false;
          if (best === null || c.length < best.length) best = c;
        }
      }
      if (best === null) return true; // fully covered
      shuffle(best);
      for (const cells of best) {
        const id = bricks.length;
        for (const [cx, cy] of cells) grid[cy][cx] = id;
        bricks.push(cells);
        if (solve()) return true;
        bricks.pop();
        for (const [cx, cy] of cells) grid[cy][cx] = -1;
      }
      return false;
    };

    if (solve()) return bricks;
  }
  return null;
}

function buildSvg(bricks: Cells[]): string {
  const grid = Array.from({ length: GRID }, () => Array<number>(GRID).fill(-1));
  bricks.forEach((cells, id) => {
    for (const [x, y] of cells) grid[y][x] = id;
  });

  const light: string[] = [];
  const dark: string[] = [];
  const IN = 1.5; // accents sit inside their own cell, forming a dark+light groove
  bricks.forEach((cells, id) => {
    for (const [x, y] of cells) {
      const px = x * CELL;
      const py = y * CELL;
      // bevel accents only on boundaries between different bricks
      if (grid[(y + GRID - 1) % GRID][x] !== id) light.push(`M${px} ${py + IN}H${px + CELL}`);
      if (grid[y][(x + GRID - 1) % GRID] !== id) light.push(`M${px + IN} ${py}V${py + CELL}`);
      if (grid[(y + 1) % GRID][x] !== id) dark.push(`M${px} ${py + CELL - IN}H${px + CELL}`);
      if (grid[y][(x + 1) % GRID] !== id) dark.push(`M${px + CELL - IN} ${py}V${py + CELL}`);
    }
  });

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">` +
    `<rect width="${SIZE}" height="${SIZE}" fill="#7e7e7e"/>` +
    `<path d="${light.join('')}" fill="none" stroke="#68c8c0" stroke-width="2.5"/>` +
    `<path d="${dark.join('')}" fill="none" stroke="#161616" stroke-width="3"/>` +
    `</svg>`
  );
}

export function applyWall(): void {
  const bricks = generateBricks();
  if (!bricks) return; // keep the flat CSS color as fallback
  const uri = `url("data:image/svg+xml,${encodeURIComponent(buildSvg(bricks))}")`;
  document.body.style.backgroundImage = uri;
}

/** Keep the surround wall's brick size in sync with the scaled game frame. */
export function syncWallScale(scale: number): void {
  document.body.style.backgroundSize = `${SIZE * scale}px`;
}
