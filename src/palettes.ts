import type { PieceType } from './pieces';

export interface BlockColors {
  /** main fill */
  fill: string;
  /** top / left bevel */
  light: string;
  /** bottom / right shade */
  dark: string;
  /** outer edge line */
  edge: string;
}

interface LevelPalette {
  /** T, J pieces */
  warm: BlockColors;
  /** S, Z, L pieces */
  bright: BlockColors;
  /** I piece (always white-ish, shaded with the warm color) */
  white: BlockColors;
  /** O piece (pale tint) */
  pale: BlockColors;
}

function block(fill: string, light: string, dark: string, edge: string): BlockColors {
  return { fill, light, dark, edge };
}

const WHITE = (shade: string, edge: string): BlockColors =>
  block('#f4f4ee', '#ffffff', shade, edge);

/** NES-style level color schemes, indexed by level % 10. Level 9/19 matches the reference screenshot. */
const LEVEL_PALETTES: LevelPalette[] = [
  // 0: blues
  {
    warm: block('#3b3bd9', '#6a6af0', '#1a1a7a', '#08083a'),
    bright: block('#7c94f8', '#a8bcf8', '#3a4a9a', '#101040'),
    white: WHITE('#3a4a9a', '#101040'),
    pale: block('#a8c8f8', '#d0e0f8', '#5868a8', '#182040'),
  },
  // 1: greens
  {
    warm: block('#00a800', '#38d038', '#005800', '#002800'),
    bright: block('#58d858', '#90f090', '#189818', '#084008'),
    white: WHITE('#189818', '#084008'),
    pale: block('#a8e8a8', '#d0f8d0', '#489848', '#103810'),
  },
  // 2: purple / magenta
  {
    warm: block('#b830c8', '#d860e8', '#681078', '#280830'),
    bright: block('#f078f8', '#f8a8f8', '#9838a0', '#381040'),
    white: WHITE('#9838a0', '#381040'),
    pale: block('#e8a8e8', '#f8d0f8', '#884888', '#301030'),
  },
  // 3: blue / green
  {
    warm: block('#0058d8', '#3888f0', '#083078', '#081030'),
    bright: block('#00b800', '#40d840', '#086808', '#082808'),
    white: WHITE('#086808', '#082828'),
    pale: block('#a8d8c8', '#d0f0e0', '#488068', '#103028'),
  },
  // 4: red / light blue
  {
    warm: block('#d82800', '#f05838', '#781800', '#300800'),
    bright: block('#5ca8f8', '#90c8f8', '#285898', '#101838'),
    white: WHITE('#285898', '#101838'),
    pale: block('#a8c8e8', '#d0e8f8', '#486888', '#182430'),
  },
  // 5: light blue / pink
  {
    warm: block('#5898f8', '#88bcf8', '#284898', '#101838'),
    bright: block('#f898c8', '#f8bce0', '#984868', '#381828'),
    white: WHITE('#984868', '#381828'),
    pale: block('#e0b8d0', '#f8e0f0', '#785868', '#281820'),
  },
  // 6: dark red / gray
  {
    warm: block('#a80000', '#d03828', '#580000', '#200000'),
    bright: block('#989898', '#c0c0c0', '#505050', '#202020'),
    white: WHITE('#505050', '#202020'),
    pale: block('#c8c8c8', '#e8e8e8', '#686868', '#282828'),
  },
  // 7: purple / dark blue
  {
    warm: block('#8000a8', '#a838d0', '#400058', '#180020'),
    bright: block('#4040c8', '#6868e8', '#181878', '#080828'),
    white: WHITE('#181878', '#080828'),
    pale: block('#a8a8e8', '#d0d0f8', '#505088', '#181830'),
  },
  // 8: blue / red
  {
    warm: block('#0038a8', '#3868d0', '#081858', '#080820'),
    bright: block('#d82800', '#f05838', '#781800', '#300800'),
    white: WHITE('#781800', '#300800'),
    pale: block('#e0a898', '#f8d0c0', '#885040', '#301810'),
  },
  // 9: red / orange (screenshot, level 19)
  {
    warm: block('#bc3c1d', '#d85a2e', '#5b0f07', '#1a0500'),
    bright: block('#e88c30', '#f8b050', '#6b2f0f', '#1a0800'),
    white: WHITE('#903018', '#200800'),
    pale: block('#a8e0e8', '#e0f8f8', '#5898a0', '#104048'),
  },
];

export function paletteFor(level: number): LevelPalette {
  return LEVEL_PALETTES[level % LEVEL_PALETTES.length];
}

export function colorsFor(type: PieceType, level: number): BlockColors {
  const p = paletteFor(level);
  switch (type) {
    case 'T':
    case 'J':
      return p.warm;
    case 'S':
    case 'Z':
    case 'L':
      return p.bright;
    case 'I':
      return p.white;
    case 'O':
      return p.pale;
  }
}
