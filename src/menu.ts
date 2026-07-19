/**
 * NES-style pre-game menu screens:
 * 1. Game Type / Music Type selection
 * 2. A-TYPE level select with high scores
 * 3. B-TYPE level + height select with high scores
 */

export type MenuPhase = 'type' | 'atype' | 'btype' | 'settings';
export type MusicType = 1 | 2 | 3 | 0; // 0 = OFF

export interface MenuState {
  phase: MenuPhase;
  gameType: 'a' | 'b';
  musicType: MusicType;
  level: number;
  height: number;
  dropKey: 'space' | 'up' | 'default';
  ghost: boolean;
  // cursor positions
  typeCursor: 'game' | 'music'; // which row is focused
  musicCursor: number; // 0-3 for music options
  btypeFocus: 'level' | 'height'; // which grid is focused in B-TYPE
  settingsCursor: number; // 0 = drop, 1 = ghost
}

export interface HighScoreEntry {
  name: string;
  score: number;
  level: number;
}

const FONT = '"Press Start 2P", monospace';

// Colors from NES palette
const COLORS = {
  red: '#bc3c1d',
  redLight: '#e86850',
  redDark: '#781810',
  blue: '#5898f8',
  blueLight: '#88c0f8',
  blueDark: '#284898',
  gold: '#d8a810',
  goldLight: '#f8d848',
  goldDark: '#885800',
  green: '#38b838',
  greenLight: '#70e070',
  greenDark: '#186818',
  orange: '#e88830',
  orangeLight: '#f8b860',
  white: '#f8f8f8',
  black: '#000000',
  gray: '#808080',
};

export class MenuRenderer {
  private ctx: CanvasRenderingContext2D;
  private width: number;
  private height: number;

  constructor(canvas: HTMLCanvasElement) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = 512;
    this.height = 480;
    canvas.width = Math.round(this.width * dpr);
    canvas.height = Math.round(this.height * dpr);
    canvas.style.width = `${this.width}px`;
    canvas.style.height = `${this.height}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no 2d context');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx = ctx;
  }

  draw(state: MenuState, aScores: HighScoreEntry[], bScores: HighScoreEntry[]): void {
    const ctx = this.ctx;
    // Clear canvas to transparent so wall background shows through
    ctx.clearRect(0, 0, this.width, this.height);

    switch (state.phase) {
      case 'type':
        this.drawTypeScreen(state);
        break;
      case 'atype':
        this.drawATypeScreen(state, aScores);
        break;
      case 'btype':
        this.drawBTypeScreen(state, bScores, state.btypeFocus);
        break;
      case 'settings':
        this.drawSettingsScreen(state);
        break;
    }
  }

  private drawTypeScreen(state: MenuState): void {
    const cx = this.width / 2;

    // GAME TYPE label
    this.drawLabelBox(cx, 60, 200, 44, 'GAME TYPE', 'gold');

    // A-TYPE and B-TYPE buttons - arrows always show on selected type
    this.drawTypeButton(cx - 110, 140, 'A-TYPE', 'red', state.gameType === 'a', state.gameType === 'a');
    this.drawTypeButton(cx + 110, 140, 'B-TYPE', 'blue', state.gameType === 'b', state.gameType === 'b');

    // MUSIC TYPE label
    this.drawLabelBox(cx, 220, 220, 44, 'MUSIC TYPE', 'gold');

    // Music selection box - arrows always show on selected music
    this.drawMusicBox(cx, 360, state.musicType);
  }

  private drawATypeScreen(state: MenuState, scores: HighScoreEntry[]): void {
    const cx = this.width / 2;

    // Full frame border (red)
    this.drawFullFrame('red');

    // A-TYPE title
    this.drawTitleBox(cx, 30, 'A-TYPE', 'red');

    // LEVEL label
    this.drawLabelBox(cx, 100, 120, 36, 'LEVEL', 'red');

    // Level grid (0-9)
    this.drawLevelGrid(cx, 170, state.level, 10, 'green');

    // High scores
    this.drawHighScores(cx, 310, scores);
  }

  private drawBTypeScreen(state: MenuState, scores: HighScoreEntry[], focus: 'level' | 'height'): void {
    const cx = this.width / 2;

    // Full frame border (blue)
    this.drawFullFrame('blue');

    // B-TYPE title
    this.drawTitleBox(cx, 30, 'B-TYPE', 'blue');

    // LEVEL label and grid
    this.drawLabelBox(cx - 90, 100, 120, 36, 'LEVEL', 'blue');
    this.drawLevelGrid(cx - 90, 170, state.level, 10, focus === 'level' ? 'green' : 'blue');

    // HEIGHT label and grid
    this.drawLabelBox(cx + 90, 100, 140, 36, 'HEIGHT', 'blue');
    this.drawHeightGrid(cx + 90, 170, state.height, focus === 'height');

    // High scores
    this.drawHighScores(cx, 310, scores);
  }

  private drawSettingsScreen(state: MenuState): void {
    const cx = this.width / 2;

    // DROP MODE section
    this.drawLabelBox(cx, 80, 220, 44, 'DROP MODE', 'gold');

    const dropY = 160;
    // Always show arrows around the selected drop option
    const dropSpacing = 145;
    this.drawSettingsButton(cx - dropSpacing, dropY, 'SPACE', 'red', state.dropKey === 'space', state.dropKey === 'space');
    this.drawSettingsButton(cx, dropY, 'UP', 'green', state.dropKey === 'up', state.dropKey === 'up');
    this.drawSettingsButton(cx + dropSpacing, dropY, 'DEFAULT', 'blue', state.dropKey === 'default', state.dropKey === 'default');

    // GHOST MODE section
    this.drawLabelBox(cx, 250, 230, 44, 'GHOST MODE', 'gold');

    // Ghost selection box (vertical list like music)
    this.drawGhostBox(cx, 360, state.ghost);
  }

  private drawGhostBox(x: number, y: number, ghostOn: boolean): void {
    const ctx = this.ctx;
    const w = 160;
    const h = 100;

    // Dotted border
    ctx.strokeStyle = COLORS.goldLight;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(x - w/2, y - h/2, w, h);
    ctx.setLineDash([]);

    // Fill
    ctx.fillStyle = COLORS.black;
    ctx.fillRect(x - w/2 + 2, y - h/2 + 2, w - 4, h - 4);

    // Options
    const options = ['ON', 'OFF'];
    ctx.font = `16px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = COLORS.white;

    for (let i = 0; i < options.length; i++) {
      const oy = y - 30 + i * 40;
      const isSelected = (i === 0 && ghostOn) || (i === 1 && !ghostOn);

      ctx.fillText(options[i], x, oy);

      // Show arrows around selected option (offset up to center)
      if (isSelected) {
        ctx.font = `12px ${FONT}`;
        ctx.fillText('▶', x - 50, oy - 3);
        ctx.fillText('◀', x + 50, oy - 3);
        ctx.font = `16px ${FONT}`;
      }
    }
  }

  private drawSettingsButton(x: number, y: number, text: string, color: 'red' | 'blue' | 'green', _selected: boolean, showArrows: boolean): void {
    this.drawButton(x, y, text, color, showArrows, 14);
  }

  private drawLabelBox(x: number, y: number, w: number, h: number, text: string, color: 'gold' | 'red' | 'blue'): void {
    const ctx = this.ctx;
    const colors = this.getColorSet(color);

    // Outer border
    ctx.strokeStyle = colors.dark;
    ctx.lineWidth = 4;
    ctx.strokeRect(x - w/2, y - h/2, w, h);

    // Inner border
    ctx.strokeStyle = colors.main;
    ctx.lineWidth = 2;
    ctx.strokeRect(x - w/2 + 4, y - h/2 + 4, w - 8, h - 8);

    // Fill
    ctx.fillStyle = COLORS.black;
    ctx.fillRect(x - w/2 + 6, y - h/2 + 6, w - 12, h - 12);

    // Text
    ctx.fillStyle = COLORS.white;
    ctx.font = `16px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
  }

  /** Unified button with consistent padding - arrows always have space reserved */
  private drawButton(x: number, y: number, text: string, color: 'red' | 'blue' | 'green', showArrows: boolean, fontSize = 16): void {
    const ctx = this.ctx;
    const arrowSpace = 24; // Space for arrow on each side
    const innerPadding = 16; // Padding between arrow and text

    // Measure text width and calculate button width
    ctx.font = `${fontSize}px ${FONT}`;
    const textWidth = ctx.measureText(text).width;
    const w = textWidth + (arrowSpace + innerPadding) * 2;
    const h = 44;
    const colors = this.getColorSet(color);

    // Border
    ctx.strokeStyle = colors.dark;
    ctx.lineWidth = 4;
    ctx.strokeRect(x - w/2, y - h/2, w, h);

    ctx.strokeStyle = colors.main;
    ctx.lineWidth = 2;
    ctx.strokeRect(x - w/2 + 4, y - h/2 + 4, w - 8, h - 8);

    // Fill
    ctx.fillStyle = COLORS.black;
    ctx.fillRect(x - w/2 + 6, y - h/2 + 6, w - 12, h - 12);

    // Text with color matching the border
    ctx.fillStyle = colors.light;
    ctx.font = `${fontSize}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);

    // Selection arrows (centered vertically, positioned inside padding area)
    if (showArrows) {
      ctx.fillStyle = COLORS.white;
      ctx.font = `12px ${FONT}`;
      ctx.fillText('▶', x - w/2 + 18, y - 3);
      ctx.fillText('◀', x + w/2 - 18, y - 3);
    }
  }

  private drawTypeButton(x: number, y: number, text: string, color: 'red' | 'blue', _filled: boolean, showArrows: boolean): void {
    this.drawButton(x, y, text, color, showArrows, 16);
  }

  private drawMusicBox(x: number, y: number, selected: MusicType): void {
    const ctx = this.ctx;
    const w = 200;
    const h = 160;

    // Dotted border
    ctx.strokeStyle = COLORS.goldLight;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(x - w/2, y - h/2, w, h);
    ctx.setLineDash([]);

    // Fill
    ctx.fillStyle = COLORS.black;
    ctx.fillRect(x - w/2 + 2, y - h/2 + 2, w - 4, h - 4);

    // Options
    const options = ['MUSIC - 1', 'MUSIC - 2', 'MUSIC - 3', 'OFF'];
    ctx.font = `14px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < options.length; i++) {
      const oy = y - 50 + i * 32;
      const isSelected = selected === (i === 3 ? 0 : i + 1);

      ctx.fillStyle = COLORS.white;
      ctx.fillText(options[i], x, oy);

      // Show arrows around selected music option (offset up to center)
      if (isSelected) {
        ctx.font = `12px ${FONT}`;
        ctx.fillText('▶', x - 80, oy - 3);
        ctx.fillText('◀', x + 80, oy - 3);
        ctx.font = `14px ${FONT}`;
      }
    }
  }

  private drawFullFrame(color: 'red' | 'blue'): void {
    const ctx = this.ctx;
    const colors = this.getColorSet(color);
    const m = 20; // margin
    const w = this.width - m * 2;
    const h = this.height - m * 2;

    // Fill inside with black
    ctx.fillStyle = COLORS.black;
    ctx.fillRect(m + 8, m + 8, w - 16, h - 16);

    // Outer frame
    ctx.strokeStyle = colors.dark;
    ctx.lineWidth = 6;
    ctx.strokeRect(m, m, w, h);

    ctx.strokeStyle = colors.main;
    ctx.lineWidth = 3;
    ctx.strokeRect(m + 5, m + 5, w - 10, h - 10);

    // Corner decorations
    this.drawCornerDeco(m + 8, m + 8, colors);
    this.drawCornerDeco(m + w - 8, m + 8, colors, true);
    this.drawCornerDeco(m + 8, m + h - 8, colors, false, true);
    this.drawCornerDeco(m + w - 8, m + h - 8, colors, true, true);
  }

  private drawCornerDeco(x: number, y: number, colors: { main: string; light: string; dark: string }, flipX = false, flipY = false): void {
    const ctx = this.ctx;
    const s = 12;
    const dx = flipX ? -1 : 1;
    const dy = flipY ? -1 : 1;

    ctx.fillStyle = colors.light;
    ctx.fillRect(x, y, s * dx, s * dy);
    ctx.fillStyle = colors.main;
    ctx.fillRect(x + 3 * dx, y + 3 * dy, (s - 6) * dx, (s - 6) * dy);
  }

  private drawTitleBox(x: number, y: number, text: string, color: 'red' | 'blue'): void {
    const ctx = this.ctx;
    const w = 160;
    const h = 36;
    const colors = this.getColorSet(color);

    // Border with decorations
    ctx.strokeStyle = colors.main;
    ctx.lineWidth = 3;
    ctx.strokeRect(x - w/2, y - h/2, w, h);

    // Side decorations
    ctx.fillStyle = colors.light;
    ctx.fillRect(x - w/2 - 16, y - 8, 14, 16);
    ctx.fillRect(x + w/2 + 2, y - 8, 14, 16);
    ctx.fillStyle = colors.main;
    ctx.fillRect(x - w/2 - 12, y - 4, 6, 8);
    ctx.fillRect(x + w/2 + 6, y - 4, 6, 8);

    // Fill
    ctx.fillStyle = COLORS.black;
    ctx.fillRect(x - w/2 + 2, y - h/2 + 2, w - 4, h - 4);

    // Text
    ctx.fillStyle = COLORS.white;
    ctx.font = `18px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
  }

  private drawLevelGrid(x: number, y: number, selected: number, count: number, borderColor: 'green' | 'blue'): void {
    const ctx = this.ctx;
    const cellSize = 32;
    const cols = 5;
    const rows = Math.ceil(count / cols);
    const gw = cols * cellSize;
    const gh = rows * cellSize;
    const colors = borderColor === 'green' ?
      { main: COLORS.green, light: COLORS.greenLight, dark: COLORS.greenDark } :
      { main: COLORS.blue, light: COLORS.blueLight, dark: COLORS.blueDark };

    // Border
    ctx.strokeStyle = colors.main;
    ctx.lineWidth = 3;
    ctx.strokeRect(x - gw/2 - 4, y - gh/2 - 4, gw + 8, gh + 8);

    // Cells
    for (let i = 0; i < count; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cx = x - gw/2 + col * cellSize + cellSize/2;
      const cy = y - gh/2 + row * cellSize + cellSize/2;

      if (i === selected) {
        // Selected cell - orange background
        ctx.fillStyle = COLORS.orange;
        ctx.fillRect(cx - cellSize/2 + 2, cy - cellSize/2 + 2, cellSize - 4, cellSize - 4);
        ctx.fillStyle = COLORS.orangeLight;
        ctx.fillRect(cx - cellSize/2 + 4, cy - cellSize/2 + 4, 6, 6);
      }

      // Number
      ctx.fillStyle = i === selected ? COLORS.redDark : COLORS.orange;
      ctx.font = `14px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(i), cx, cy);
    }
  }

  private drawHeightGrid(x: number, y: number, selected: number, focused = true): void {
    const ctx = this.ctx;
    const cellSize = 32;
    const cols = 3;
    const rows = 2;
    const gw = cols * cellSize;
    const gh = rows * cellSize;

    // Border - green when focused, blue when not
    ctx.strokeStyle = focused ? COLORS.green : COLORS.blue;
    ctx.lineWidth = 3;
    ctx.strokeRect(x - gw/2 - 4, y - gh/2 - 4, gw + 8, gh + 8);

    // Cells (0-5)
    for (let i = 0; i < 6; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cx = x - gw/2 + col * cellSize + cellSize/2;
      const cy = y - gh/2 + row * cellSize + cellSize/2;

      if (i === selected) {
        ctx.fillStyle = COLORS.orange;
        ctx.fillRect(cx - cellSize/2 + 2, cy - cellSize/2 + 2, cellSize - 4, cellSize - 4);
        ctx.fillStyle = COLORS.orangeLight;
        ctx.fillRect(cx - cellSize/2 + 4, cy - cellSize/2 + 4, 6, 6);
      }

      ctx.fillStyle = i === selected ? COLORS.redDark : COLORS.orange;
      ctx.font = `14px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(i), cx, cy);
    }
  }

  private drawHighScores(x: number, y: number, scores: HighScoreEntry[]): void {
    const ctx = this.ctx;
    const w = 340;
    const h = 140;

    // Dotted border
    ctx.strokeStyle = COLORS.goldLight;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(x - w/2, y - 10, w, h);
    ctx.setLineDash([]);

    // Header
    ctx.fillStyle = COLORS.white;
    ctx.font = `14px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('NAME', x - w/2 + 50, y);
    ctx.fillText('SCORE', x - w/2 + 140, y);
    ctx.fillText('LV', x - w/2 + 260, y);

    // Entries
    for (let i = 0; i < Math.min(3, scores.length); i++) {
      const entry = scores[i];
      const ey = y + 30 + i * 32;

      ctx.fillStyle = COLORS.white;
      ctx.fillText(String(i + 1), x - w/2 + 20, ey);
      ctx.fillText(entry.name.padEnd(6, ' ').slice(0, 6), x - w/2 + 50, ey);
      ctx.fillText(String(entry.score).padStart(6, '0'), x - w/2 + 140, ey);
      ctx.fillText(String(entry.level).padStart(2, '0'), x - w/2 + 260, ey);
    }
  }

  private getColorSet(color: 'gold' | 'red' | 'blue' | 'green'): { main: string; light: string; dark: string } {
    switch (color) {
      case 'gold':
        return { main: COLORS.gold, light: COLORS.goldLight, dark: COLORS.goldDark };
      case 'red':
        return { main: COLORS.red, light: COLORS.redLight, dark: COLORS.redDark };
      case 'blue':
        return { main: COLORS.blue, light: COLORS.blueLight, dark: COLORS.blueDark };
      case 'green':
        return { main: COLORS.green, light: COLORS.greenLight, dark: COLORS.greenDark };
    }
  }
}

// High score storage
const A_SCORES_KEY = 'tetris-a-scores';
const B_SCORES_KEY = 'tetris-b-scores';

const DEFAULT_A_SCORES: HighScoreEntry[] = [
  { name: 'HOWARD', score: 10000, level: 9 },
  { name: 'OTASAN', score: 7500, level: 5 },
  { name: 'LANCE', score: 5000, level: 0 },
];

const DEFAULT_B_SCORES: HighScoreEntry[] = [
  { name: 'ALEX', score: 2000, level: 9 },
  { name: 'TONY', score: 1000, level: 5 },
  { name: 'NINTEN', score: 500, level: 0 },
];

export function loadHighScores(type: 'a' | 'b'): HighScoreEntry[] {
  const key = type === 'a' ? A_SCORES_KEY : B_SCORES_KEY;
  const defaults = type === 'a' ? DEFAULT_A_SCORES : DEFAULT_B_SCORES;
  try {
    const data = localStorage.getItem(key);
    if (data) return JSON.parse(data);
  } catch {
    // ignore
  }
  return defaults;
}

export function saveHighScores(type: 'a' | 'b', scores: HighScoreEntry[]): void {
  const key = type === 'a' ? A_SCORES_KEY : B_SCORES_KEY;
  localStorage.setItem(key, JSON.stringify(scores.slice(0, 3)));
}
