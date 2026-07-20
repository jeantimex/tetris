/// <reference types="vite/client" />
/**
 * NES-style pre-game menu screens:
 * 1. Game Type / Music Type selection
 * 2. A-TYPE level select with high scores
 * 3. B-TYPE level + height select with high scores
 */

export type MenuPhase = 'welcome' | 'type' | 'atype' | 'btype' | 'settings';
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

export interface ClickRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  action: string;
  value?: string | number | boolean;
}

// Mode selection configuration
interface SelectionOption {
  text: string;
  value: string | number | boolean;
  color?: 'red' | 'green' | 'blue' | 'gold';
}

interface ModeSelectionConfig {
  title: string;
  titleColor: 'red' | 'green' | 'blue' | 'gold';
  titleWidth?: number;
  layout: 'horizontal' | 'vertical';
  options: SelectionOption[];
  selectedValue: string | number | boolean;
  x: number;
  y: number;
  action: string;
  gap?: number;
}

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
  private clickRegions: ClickRegion[] = [];
  private scale: number = 1;
  private redSquareImg: HTMLImageElement;
  private redSquareLoaded = false;

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

    this.redSquareImg = new Image();
    const baseUrl = import.meta.env.BASE_URL || '/';
    const normalizedBase = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
    const primarySrc = `${normalizedBase}assets/red_square.png`;
    const fallbackSrc = 'assets/red_square.png';

    this.redSquareImg.onload = () => {
      this.redSquareLoaded = true;
    };
    this.redSquareImg.onerror = () => {
      if (this.redSquareImg.src !== fallbackSrc && !this.redSquareImg.src.endsWith('/' + fallbackSrc)) {
        this.redSquareImg.src = fallbackSrc;
      } else {
        this.redSquareLoaded = false;
      }
    };
    this.redSquareImg.src = primarySrc;
  }

  setScale(scale: number): void {
    this.scale = scale;
  }

  getClickRegions(): ClickRegion[] {
    return this.clickRegions;
  }

  handleClick(x: number, y: number): ClickRegion | null {
    // Adjust for canvas scale
    const canvasX = x / this.scale;
    const canvasY = y / this.scale;

    for (const region of this.clickRegions) {
      if (
        canvasX >= region.x &&
        canvasX <= region.x + region.width &&
        canvasY >= region.y &&
        canvasY <= region.y + region.height
      ) {
        return region;
      }
    }
    return null;
  }

  draw(state: MenuState, aScores: HighScoreEntry[], bScores: HighScoreEntry[]): void {
    const ctx = this.ctx;
    // Clear click regions for this frame
    this.clickRegions = [];
    // Clear canvas to transparent so wall background shows through
    ctx.clearRect(0, 0, this.width, this.height);

    switch (state.phase) {
      case 'welcome':
        this.drawWelcomeScreen();
        break;
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

  private drawModeSelection(config: ModeSelectionConfig): void {
    const ctx = this.ctx;
    const { title, titleColor, titleWidth = 200, layout, options, selectedValue, x, y, action, gap = 20 } = config;
    const titleH = 44;
    const spacing = 15; // Space between title and content

    // Draw title label
    this.drawLabelBox(x, y, titleWidth, titleH, title, titleColor);

    // Content starts below title
    const contentY = y + titleH / 2 + spacing;

    if (layout === 'horizontal') {
      // Calculate button dimensions
      const buttonH = 56;
      const fontSize = 16;
      const arrowSpace = 24;
      const innerPadding = 16;

      ctx.font = `${fontSize}px ${FONT}`;
      const widths = options.map(opt => ctx.measureText(opt.text).width + (arrowSpace + innerPadding) * 2);
      const totalWidth = widths.reduce((sum, w) => sum + w, 0) + gap * (widths.length - 1);

      // Position buttons centered
      let currentX = x - totalWidth / 2;
      const buttonY = contentY + buttonH / 2;

      for (let i = 0; i < options.length; i++) {
        const opt = options[i];
        const btnX = currentX + widths[i] / 2;
        const isSelected = opt.value === selectedValue;
        const color = opt.color || 'gold';

        this.drawButton(btnX, buttonY, opt.text, color, isSelected, fontSize);

        // Register click region
        this.clickRegions.push({
          x: btnX - widths[i] / 2 - 4,
          y: buttonY - buttonH / 2 - 4,
          width: widths[i] + 8,
          height: buttonH + 8,
          action,
          value: opt.value,
        });

        currentX += widths[i] + gap;
      }
    } else {
      // Vertical layout - list style with dotted border
      const itemH = 32;
      const listH = options.length * itemH + 20;
      const listY = contentY + listH / 2;

      // Calculate longest text width for arrow positioning
      ctx.font = `14px ${FONT}`;
      const maxTextWidth = Math.max(...options.map(opt => ctx.measureText(opt.text).width));
      const arrowSpacing = 12; // Space between text and arrows
      const arrowOffset = maxTextWidth / 2 + arrowSpacing;

      // List width based on content
      const listW = Math.max(200, maxTextWidth + arrowSpacing * 2 + 40);

      // Dotted border
      ctx.strokeStyle = COLORS.goldLight;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(x - listW / 2, listY - listH / 2, listW, listH);
      ctx.setLineDash([]);

      // Fill
      ctx.fillStyle = COLORS.black;
      ctx.fillRect(x - listW / 2 + 2, listY - listH / 2 + 2, listW - 4, listH - 4);

      // Draw options
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      for (let i = 0; i < options.length; i++) {
        const opt = options[i];
        const optY = listY - listH / 2 + 18 + i * itemH;
        const isSelected = opt.value === selectedValue;

        ctx.font = `14px ${FONT}`;
        ctx.fillStyle = COLORS.white;
        ctx.fillText(opt.text, x, optY);

        // Show arrows for selected option with consistent spacing
        if (isSelected) {
          ctx.font = `12px ${FONT}`;
          ctx.fillText('▶', x - arrowOffset, optY - 3);
          ctx.fillText('◀', x + arrowOffset, optY - 3);
        }

        // Register click region
        this.clickRegions.push({
          x: x - listW / 2,
          y: optY - itemH / 2,
          width: listW,
          height: itemH,
          action,
          value: opt.value,
        });
      }
    }
  }

  private drawTypeScreen(state: MenuState): void {
    const cx = this.width / 2;

    // GAME TYPE selection (horizontal)
    this.drawModeSelection({
      title: 'GAME TYPE',
      titleColor: 'gold',
      layout: 'horizontal',
      options: [
        { text: 'A-TYPE', value: 'a', color: 'red' },
        { text: 'B-TYPE', value: 'b', color: 'blue' },
      ],
      selectedValue: state.gameType,
      x: cx,
      y: 50,
      action: 'gameType',
      gap: 40,
    });

    // MUSIC TYPE selection (vertical)
    this.drawModeSelection({
      title: 'MUSIC TYPE',
      titleColor: 'gold',
      titleWidth: 220,
      layout: 'vertical',
      options: [
        { text: 'MUSIC - 1', value: 1 },
        { text: 'MUSIC - 2', value: 2 },
        { text: 'MUSIC - 3', value: 3 },
        { text: 'OFF', value: 0 },
      ],
      selectedValue: state.musicType,
      x: cx,
      y: 195,
      action: 'musicType',
    });

    // Navigation button - NEXT only (first screen)
    this.drawNavButton(cx, 450, 'NEXT', 'green');
    this.clickRegions.push({
      x: cx - 60,
      y: 450 - 20,
      width: 120,
      height: 40,
      action: 'nav',
      value: 'next',
    });
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
    this.drawHighScores(cx, 280, scores);

    // Navigation buttons - positioned below the frame
    this.drawNavButtons(cx, 460);
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
    this.drawHighScores(cx, 280, scores);

    // Navigation buttons - positioned below the frame
    this.drawNavButtons(cx, 460);
  }

  private drawSettingsScreen(state: MenuState): void {
    const cx = this.width / 2;

    // DROP MODE selection (horizontal)
    this.drawModeSelection({
      title: 'DROP MODE',
      titleColor: 'gold',
      titleWidth: 220,
      layout: 'horizontal',
      options: [
        { text: 'SPACE', value: 'space', color: 'red' },
        { text: 'UP', value: 'up', color: 'green' },
        { text: 'DEFAULT', value: 'default', color: 'blue' },
      ],
      selectedValue: state.dropKey,
      x: cx,
      y: 50,
      action: 'dropKey',
      gap: 20,
    });

    // GHOST MODE selection (vertical)
    this.drawModeSelection({
      title: 'GHOST MODE',
      titleColor: 'gold',
      titleWidth: 230,
      layout: 'vertical',
      options: [
        { text: 'ON', value: true },
        { text: 'OFF', value: false },
      ],
      selectedValue: state.ghost,
      x: cx,
      y: 195,
      action: 'ghost',
    });

    // Navigation buttons - BACK and START
    this.drawNavButton(cx - 80, 450, 'BACK', 'red');
    this.drawNavButton(cx + 80, 450, 'START', 'green');
    this.clickRegions.push({
      x: cx - 80 - 60,
      y: 450 - 20,
      width: 120,
      height: 40,
      action: 'nav',
      value: 'back',
    });
    this.clickRegions.push({
      x: cx + 80 - 60,
      y: 450 - 20,
      width: 120,
      height: 40,
      action: 'nav',
      value: 'start',
    });
  }

  private drawLabelBox(x: number, y: number, w: number, h: number, text: string, color: 'gold' | 'red' | 'blue' | 'green'): void {
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
  private drawButton(x: number, y: number, text: string, color: 'red' | 'blue' | 'green' | 'gold', showArrows: boolean, fontSize = 16): void {
    const ctx = this.ctx;
    const arrowSpace = 24; // Space for arrow on each side
    const innerPadding = 16; // Padding between arrow and text

    // Measure text width and calculate button width
    ctx.font = `${fontSize}px ${FONT}`;
    const textWidth = ctx.measureText(text).width;
    const w = textWidth + (arrowSpace + innerPadding) * 2;
    const h = 48;
    const colors = this.getColorSet(color);
    const cornerSize = 10;
    const borderWidth = 3;
    const frameInset = 4; // How far the frame is inset from the black background

    // Fill black background (larger, extends beyond frame)
    ctx.fillStyle = COLORS.black;
    ctx.fillRect(x - w/2 - frameInset, y - h/2 - frameInset, w + frameInset * 2, h + frameInset * 2);

    // Draw colored border lines
    ctx.strokeStyle = colors.main;
    ctx.lineWidth = borderWidth;

    // Top line
    ctx.beginPath();
    ctx.moveTo(x - w/2 + cornerSize, y - h/2 + borderWidth/2);
    ctx.lineTo(x + w/2 - cornerSize, y - h/2 + borderWidth/2);
    ctx.stroke();

    // Bottom line
    ctx.beginPath();
    ctx.moveTo(x - w/2 + cornerSize, y + h/2 - borderWidth/2);
    ctx.lineTo(x + w/2 - cornerSize, y + h/2 - borderWidth/2);
    ctx.stroke();

    // Left line
    ctx.beginPath();
    ctx.moveTo(x - w/2 + borderWidth/2, y - h/2 + cornerSize);
    ctx.lineTo(x - w/2 + borderWidth/2, y + h/2 - cornerSize);
    ctx.stroke();

    // Right line
    ctx.beginPath();
    ctx.moveTo(x + w/2 - borderWidth/2, y - h/2 + cornerSize);
    ctx.lineTo(x + w/2 - borderWidth/2, y + h/2 - cornerSize);
    ctx.stroke();

    // Draw corner decorations with highlight
    const cs = cornerSize;
    const hl = 4; // highlight size

    // Top-left corner
    ctx.fillStyle = colors.main;
    ctx.fillRect(x - w/2, y - h/2, cs, cs);
    ctx.fillStyle = colors.light;
    ctx.fillRect(x - w/2 + 2, y - h/2 + 2, hl, hl);

    // Top-right corner
    ctx.fillStyle = colors.main;
    ctx.fillRect(x + w/2 - cs, y - h/2, cs, cs);
    ctx.fillStyle = colors.light;
    ctx.fillRect(x + w/2 - cs + 2, y - h/2 + 2, hl, hl);

    // Bottom-left corner
    ctx.fillStyle = colors.main;
    ctx.fillRect(x - w/2, y + h/2 - cs, cs, cs);
    ctx.fillStyle = colors.light;
    ctx.fillRect(x - w/2 + 2, y + h/2 - cs + 2, hl, hl);

    // Bottom-right corner
    ctx.fillStyle = colors.main;
    ctx.fillRect(x + w/2 - cs, y + h/2 - cs, cs, cs);
    ctx.fillStyle = colors.light;
    ctx.fillRect(x + w/2 - cs + 2, y + h/2 - cs + 2, hl, hl);

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

  private drawFullFrame(color: 'red' | 'blue'): void {
    const ctx = this.ctx;
    const colors = this.getColorSet(color);
    const m = 20; // margin
    const mb = 60; // bottom margin (leave room for nav buttons)
    const w = this.width - m * 2;
    const h = this.height - m - mb;

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

      // Register click region for this level cell
      this.clickRegions.push({
        x: cx - cellSize / 2,
        y: cy - cellSize / 2,
        width: cellSize,
        height: cellSize,
        action: 'level',
        value: i,
      });
    }
  }

  private drawHeightGrid(x: number, y: number, selected: number, focused = true): void {
    const ctx = this.ctx;
    const cellSize = 32;
    const cols = 3;
    const rows = 2;
    const gw = cols * cellSize;
    const gh = rows * cellSize;
    // Display actual row counts that correspond to each HEIGHT index
    const rowCounts = [0, 2, 4, 6, 8, 10];

    // Border - green when focused, blue when not
    ctx.strokeStyle = focused ? COLORS.green : COLORS.blue;
    ctx.lineWidth = 3;
    ctx.strokeRect(x - gw/2 - 4, y - gh/2 - 4, gw + 8, gh + 8);

    // Cells (0-5) showing actual row counts
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
      ctx.fillText(String(rowCounts[i]), cx, cy);

      // Register click region for this height cell
      this.clickRegions.push({
        x: cx - cellSize / 2,
        y: cy - cellSize / 2,
        width: cellSize,
        height: cellSize,
        action: 'height',
        value: i,
      });
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

  private drawNavButton(x: number, y: number, text: string, color: 'red' | 'green' | 'blue'): void {
    const ctx = this.ctx;
    const colors = this.getColorSet(color);
    const w = 100;
    const h = 32;

    // Background
    ctx.fillStyle = COLORS.black;
    ctx.fillRect(x - w/2, y - h/2, w, h);

    // Border
    ctx.strokeStyle = colors.main;
    ctx.lineWidth = 2;
    ctx.strokeRect(x - w/2, y - h/2, w, h);

    // Corner highlights
    ctx.fillStyle = colors.light;
    ctx.fillRect(x - w/2 + 2, y - h/2 + 2, 4, 4);
    ctx.fillRect(x + w/2 - 6, y - h/2 + 2, 4, 4);
    ctx.fillRect(x - w/2 + 2, y + h/2 - 6, 4, 4);
    ctx.fillRect(x + w/2 - 6, y + h/2 - 6, 4, 4);

    // Text
    ctx.fillStyle = colors.light;
    ctx.font = `12px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
  }

  private drawNavButtons(cx: number, y: number): void {
    // BACK button on left
    this.drawNavButton(cx - 80, y, 'BACK', 'red');
    this.clickRegions.push({
      x: cx - 80 - 50,
      y: y - 16,
      width: 100,
      height: 32,
      action: 'nav',
      value: 'back',
    });

    // NEXT button on right
    this.drawNavButton(cx + 80, y, 'NEXT', 'green');
    this.clickRegions.push({
      x: cx + 80 - 50,
      y: y - 16,
      width: 100,
      height: 32,
      action: 'nav',
      value: 'next',
    });
  }

  private drawWelcomeScreen(): void {
    const ctx = this.ctx;
    const cx = this.width / 2;

    // 1. Picture in center: red_square.png (enlarged hero image)
    const imgW = 430;
    const imgH = 310;
    const imgX = cx;
    const imgY = 226;
    const inset = 4;

    ctx.fillStyle = COLORS.black;
    ctx.fillRect(imgX - imgW / 2 - inset, imgY - imgH / 2 - inset, imgW + inset * 2, imgH + inset * 2);

    ctx.strokeStyle = COLORS.gold;
    ctx.lineWidth = 4;
    ctx.strokeRect(imgX - imgW / 2 - inset, imgY - imgH / 2 - inset, imgW + inset * 2, imgH + inset * 2);

    ctx.strokeStyle = COLORS.goldLight;
    ctx.lineWidth = 2;
    ctx.strokeRect(imgX - imgW / 2 - 2, imgY - imgH / 2 - 2, imgW + 4, imgH + 4);

    const isImageReady = this.redSquareLoaded && this.redSquareImg.complete && this.redSquareImg.naturalWidth !== 0;
    if (isImageReady) {
      ctx.drawImage(this.redSquareImg, imgX - imgW / 2, imgY - imgH / 2, imgW, imgH);
    } else {
      ctx.fillStyle = COLORS.black;
      ctx.fillRect(imgX - imgW / 2, imgY - imgH / 2, imgW, imgH);
    }

    // Corner decorations on image frame
    const frameColors = { main: COLORS.gold, light: COLORS.goldLight, dark: COLORS.goldDark };
    this.drawCornerDeco(imgX - imgW / 2 - inset + 4, imgY - imgH / 2 - inset + 4, frameColors);
    this.drawCornerDeco(imgX + imgW / 2 + inset - 4, imgY - imgH / 2 - inset + 4, frameColors, true);
    this.drawCornerDeco(imgX - imgW / 2 - inset + 4, imgY + imgH / 2 + inset - 4, frameColors, false, true);
    this.drawCornerDeco(imgX + imgW / 2 + inset - 4, imgY + imgH / 2 + inset - 4, frameColors, true, true);

    // 2. TETRIS Title Banner at top
    const titleW = 260;
    const titleH = 44;
    const titleY = 32;

    const colors = this.getColorSet('red');
    ctx.strokeStyle = colors.dark;
    ctx.lineWidth = 4;
    ctx.strokeRect(cx - titleW / 2, titleY - titleH / 2, titleW, titleH);

    ctx.strokeStyle = colors.main;
    ctx.lineWidth = 2;
    ctx.strokeRect(cx - titleW / 2 + 4, titleY - titleH / 2 + 4, titleW - 8, titleH - 8);

    ctx.fillStyle = COLORS.black;
    ctx.fillRect(cx - titleW / 2 + 6, titleY - titleH / 2 + 6, titleW - 12, titleH - 12);

    ctx.fillStyle = COLORS.white;
    ctx.font = `24px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('TETRIS', cx, titleY);

    // 3. Start Button at bottom
    const btnY = 434;
    this.drawButton(cx, btnY, 'START', 'green', true, 18);

    // Click regions for Start button & full screen start action
    this.clickRegions.push({
      x: cx - 110,
      y: btnY - 26,
      width: 220,
      height: 52,
      action: 'start',
    });
    this.clickRegions.push({
      x: 0,
      y: 0,
      width: this.width,
      height: this.height,
      action: 'start',
    });
  }
}

// High score storage
const A_SCORES_KEY = 'tetris-a-scores';
const B_SCORES_KEY = 'tetris-b-scores';

const DEFAULT_A_SCORES: HighScoreEntry[] = [];

const DEFAULT_B_SCORES: HighScoreEntry[] = [];

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

export function isHighScore(type: 'a' | 'b', score: number): boolean {
  if (score <= 0) return false;
  const scores = loadHighScores(type);
  if (scores.length < 3) return true;
  return score > scores[scores.length - 1].score;
}

export function addHighScore(type: 'a' | 'b', entry: HighScoreEntry): void {
  const scores = loadHighScores(type);
  scores.push(entry);
  scores.sort((a, b) => b.score - a.score);
  saveHighScores(type, scores.slice(0, 3));
}
