/**
 * Pixelated frame renderer using canvas.
 * Draws NES-style frames with stepped corners.
 */

export interface FrameOptions {
  width: number;
  height: number;
  outerColor?: string;
  outerColorLight?: string;
  outerColorDark?: string;
  borderColor?: string;
  borderWidth?: number;
  cornerSize?: number;
  padding?: number;
}

const DEFAULT_OPTIONS: Required<Omit<FrameOptions, 'width' | 'height'>> = {
  outerColor: '#5f5d62',
  outerColorLight: '#6a686e',
  outerColorDark: '#38363c',
  borderColor: '#68c0b8',
  borderWidth: 3,
  cornerSize: 6,
  padding: 7,
};

/**
 * Draw a pixelated rectangle with notched corners.
 */
function drawPixelRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  cornerSize: number,
  fill: string | CanvasGradient
): void {
  ctx.fillStyle = fill;
  ctx.beginPath();
  // Top edge (with corner notches)
  ctx.moveTo(x + cornerSize, y);
  ctx.lineTo(x + w - cornerSize, y);
  // Top-right corner
  ctx.lineTo(x + w - cornerSize, y + cornerSize);
  ctx.lineTo(x + w, y + cornerSize);
  // Right edge
  ctx.lineTo(x + w, y + h - cornerSize);
  // Bottom-right corner
  ctx.lineTo(x + w - cornerSize, y + h - cornerSize);
  ctx.lineTo(x + w - cornerSize, y + h);
  // Bottom edge
  ctx.lineTo(x + cornerSize, y + h);
  // Bottom-left corner
  ctx.lineTo(x + cornerSize, y + h - cornerSize);
  ctx.lineTo(x, y + h - cornerSize);
  // Left edge
  ctx.lineTo(x, y + cornerSize);
  // Top-left corner
  ctx.lineTo(x + cornerSize, y + cornerSize);
  ctx.lineTo(x + cornerSize, y);
  ctx.closePath();
  ctx.fill();
}

/**
 * Draw a complete pixelated frame.
 */
export function drawFrame(canvas: HTMLCanvasElement, options: FrameOptions): void {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const { width, height, outerColorLight, outerColorDark, borderColor, borderWidth, cornerSize, padding } = opts;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;

  const darkBorderWidth = 4;

  // Draw dark gray outer border first
  drawPixelRect(ctx, 0, 0, width, height, cornerSize, '#2a2a2e');

  // Create gradient for gray frame
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, outerColorLight);
  gradient.addColorStop(0.45, outerColorLight);
  gradient.addColorStop(1, outerColorDark);

  // Draw gray frame inside the dark border
  const grayX = darkBorderWidth;
  const grayY = darkBorderWidth;
  const grayW = width - darkBorderWidth * 2;
  const grayH = height - darkBorderWidth * 2;
  const grayCorner = Math.max(2, cornerSize - 2);

  drawPixelRect(ctx, grayX, grayY, grayW, grayH, grayCorner, gradient);

  // Draw black inner area
  const innerX = darkBorderWidth + padding;
  const innerY = darkBorderWidth + padding;
  const innerW = width - (darkBorderWidth + padding) * 2;
  const innerH = height - (darkBorderWidth + padding) * 2;
  const innerCorner = Math.max(2, cornerSize - 4);

  drawPixelRect(ctx, innerX, innerY, innerW, innerH, innerCorner, '#000000');

  // Draw cyan border
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = borderWidth;

  const borderOffset = innerX + borderWidth / 2 + 1;
  const borderW = innerW - borderWidth - 2;
  const borderH = innerH - borderWidth - 2;
  const borderCorner = Math.max(2, innerCorner - 2);

  ctx.beginPath();
  ctx.moveTo(borderOffset + borderCorner, borderOffset);
  ctx.lineTo(borderOffset + borderW - borderCorner, borderOffset);
  ctx.lineTo(borderOffset + borderW - borderCorner, borderOffset + borderCorner);
  ctx.lineTo(borderOffset + borderW, borderOffset + borderCorner);
  ctx.lineTo(borderOffset + borderW, borderOffset + borderH - borderCorner);
  ctx.lineTo(borderOffset + borderW - borderCorner, borderOffset + borderH - borderCorner);
  ctx.lineTo(borderOffset + borderW - borderCorner, borderOffset + borderH);
  ctx.lineTo(borderOffset + borderCorner, borderOffset + borderH);
  ctx.lineTo(borderOffset + borderCorner, borderOffset + borderH - borderCorner);
  ctx.lineTo(borderOffset, borderOffset + borderH - borderCorner);
  ctx.lineTo(borderOffset, borderOffset + borderCorner);
  ctx.lineTo(borderOffset + borderCorner, borderOffset + borderCorner);
  ctx.lineTo(borderOffset + borderCorner, borderOffset);
  ctx.closePath();
  ctx.stroke();
}

/**
 * Draw a bevel-style frame (for playfield, next box).
 */
export function drawBevelFrame(canvas: HTMLCanvasElement, options: FrameOptions): void {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const { width, height, outerColorLight, outerColorDark, cornerSize, padding } = opts;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;

  const darkBorderWidth = 4;

  // Draw dark gray outer border first
  drawPixelRect(ctx, 0, 0, width, height, cornerSize, '#2a2a2e');

  // Create gradient for gray frame
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, outerColorLight);
  gradient.addColorStop(0.45, outerColorLight);
  gradient.addColorStop(1, outerColorDark);

  // Draw gray frame inside the dark border
  const grayX = darkBorderWidth;
  const grayY = darkBorderWidth;
  const grayW = width - darkBorderWidth * 2;
  const grayH = height - darkBorderWidth * 2;
  const grayCorner = Math.max(2, cornerSize - 2);

  drawPixelRect(ctx, grayX, grayY, grayW, grayH, grayCorner, gradient);

  // Draw black gap
  const blackX = darkBorderWidth + padding;
  const blackY = darkBorderWidth + padding;
  const blackW = width - (darkBorderWidth + padding) * 2;
  const blackH = height - (darkBorderWidth + padding) * 2;
  const blackCorner = Math.max(2, cornerSize - 4);

  drawPixelRect(ctx, blackX, blackY, blackW, blackH, blackCorner, '#000000');

  // Draw cyan bevel gradient
  const bevelPadding = 4;
  const bevelX = blackX + bevelPadding;
  const bevelY = blackY + bevelPadding;
  const bevelW = blackW - bevelPadding * 2;
  const bevelH = blackH - bevelPadding * 2;
  const bevelCorner = Math.max(2, blackCorner - 2);

  const cyanGradient = ctx.createLinearGradient(bevelX, bevelY, bevelX + bevelW, bevelY + bevelH);
  cyanGradient.addColorStop(0, '#d6faf9');
  cyanGradient.addColorStop(0.3, '#c8eeeb');
  cyanGradient.addColorStop(0.62, '#a8d0cc');
  cyanGradient.addColorStop(1, '#88a09c');

  drawPixelRect(ctx, bevelX, bevelY, bevelW, bevelH, bevelCorner, cyanGradient);

  // Draw inner black area
  const innerPadding = 13;
  const innerX = bevelX + innerPadding;
  const innerY = bevelY + innerPadding;
  const innerW = bevelW - innerPadding * 2;
  const innerH = bevelH - innerPadding * 2;
  const innerCorner = Math.max(2, bevelCorner - 2);

  drawPixelRect(ctx, innerX, innerY, innerW, innerH, innerCorner, '#000000');
}

/**
 * Initialize all frame canvases in the document.
 * Can be called multiple times - will update existing canvases.
 */
export function initFrames(): void {
  const frames = document.querySelectorAll<HTMLElement>('.frame');

  frames.forEach((frame) => {
    const isBevel = frame.classList.contains('frame--bevel');
    const width = frame.offsetWidth;
    const height = frame.offsetHeight;
    if (width === 0 || height === 0) return;

    // Check if canvas already exists, otherwise create one
    let canvas = frame.querySelector<HTMLCanvasElement>('.frame__canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.className = 'frame__canvas';
      canvas.style.position = 'absolute';
      canvas.style.left = '0';
      canvas.style.top = '0';
      canvas.style.pointerEvents = 'none';
      frame.insertBefore(canvas, frame.firstChild);
    }

    // Get custom properties if set
    const style = getComputedStyle(frame);
    const borderColor = style.getPropertyValue('--frame-border-color').trim() || undefined;
    const borderWidth = parseInt(style.getPropertyValue('--frame-border-width')) || undefined;
    const cornerSize = parseInt(style.getPropertyValue('--frame-corner-size')) || undefined;

    const options = {
      width,
      height,
      borderColor,
      borderWidth,
      cornerSize,
    };

    if (isBevel) {
      drawBevelFrame(canvas, options);
    } else {
      drawFrame(canvas, options);
    }
  });
}
