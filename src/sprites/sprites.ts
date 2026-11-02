// Pixel art, 16x16, one character per pixel, facing right.
// '.' is transparent; every other character maps to a palette colour.
// The chibi pets live in critters.ts; the older 16x12 critters below are
// padded to 16x16 so everything shares one canvas.
import type { FrameName, PetKind } from '../engine/pet';
import { BLANK, CRITTERS } from './critters';

export const SPRITE_W = 16;
export const SPRITE_H = 16;

type Grid = string[];
type Palette = Record<string, string>;

// ------------------------------------------------------------------ bug

const BUG_PALETTE: Palette = { k: '#8e3a8e', r: '#e84a4a', w: '#ffffff' };

const BUG_BODY: Grid = [
  BLANK,
  BLANK,
  BLANK,
  BLANK,
  '....kkkkkkk.....',
  '..kkrrrkrrrkk.k.',
  '.krrwrrkrrrrkkk.',
  '.krrrrrkrrrrkkwk',
  '.krrrrrkrrrrkkkk',
  '..kkkkkkkkkkkk..',
];
const BUG_LEGS_A: Grid = ['...k...k...k....', '..k...k...k.....'];
const BUG_LEGS_B: Grid = ['....k...k...k...', '.....k...k...k..'];
const BUG_LEGS_FALL: Grid = ['..k.k.k..k.k.k..', BLANK];

const BUG: Record<FrameName, Grid> = {
  idle: [...BUG_BODY, ...BUG_LEGS_A],
  blink: [...BUG_BODY.map((r) => r.replace('kkwk', 'kkkk')), ...BUG_LEGS_A],
  walk1: [...BUG_BODY, ...BUG_LEGS_A],
  walk2: [...BUG_BODY, ...BUG_LEGS_B],
  fall: [...BUG_BODY, ...BUG_LEGS_FALL],
  squash: [BLANK, ...BUG_BODY, '..k.k.k...k.k.k.'],
  sleep: [BLANK, BLANK, ...BUG_BODY.map((r) => r.replace('kkwk', 'kkkk'))],
};

// ------------------------------------------------------------------ roach

const ROACH_PALETTE: Palette = { b: '#6b3a1a', r: '#9a5626', l: '#d0904e', a: '#b5793f', e: '#fff3dc' };

// Long glossy body, head on the right, antennae sweeping up and forward.
const ROACH_BODY: Grid = [
  BLANK,
  BLANK,
  BLANK,
  '..............aa',
  '............aa..',
  '...bbbbbbbb.a...',
  '.bbrrlrrrrrbbb..',
  'brrrlrrrrrrrbeb.',
  'brrrrrrrrrrrbbb.',
  '.bbbbbbbbbbbbb..',
];
const ROACH_LEGS_A: Grid = ['..a..a...a..a...', '.a...a...a...a..'];
const ROACH_LEGS_B: Grid = ['...a...a..a...a.', '...a....a...a..a'];
const ROACH_LEGS_FALL: Grid = ['a.a.a...a.a.a...', BLANK];
const roachBlink = (g: Grid): Grid => g.map((r) => r.replace('e', 'b'));

const ROACH: Record<FrameName, Grid> = {
  idle: [...ROACH_BODY, ...ROACH_LEGS_A],
  blink: roachBlink([...ROACH_BODY, ...ROACH_LEGS_A]),
  walk1: [...ROACH_BODY, ...ROACH_LEGS_A],
  walk2: [...ROACH_BODY, ...ROACH_LEGS_B],
  fall: [...ROACH_BODY, ...ROACH_LEGS_FALL],
  squash: [BLANK, ...ROACH_BODY, '..aaaaaaaaaaa...'],
  sleep: roachBlink([BLANK, ...ROACH_BODY, BLANK]),
};

// ------------------------------------------------------------------ export

/** Pad a 16x12 frame set up to 16x16 (blank rows on top, feet stay on the ground). */
function tall(frames: Record<FrameName, Grid>): Record<FrameName, Grid> {
  const out = {} as Record<FrameName, Grid>;
  for (const k of Object.keys(frames) as FrameName[]) out[k] = [...Array(SPRITE_H - frames[k].length).fill(BLANK), ...frames[k]];
  return out;
}

const SPRITES: Record<PetKind, { palette: Palette; frames: Record<FrameName, Grid> }> = {
  ...CRITTERS,
  bug: { palette: BUG_PALETTE, frames: tall(BUG) },
  roach: { palette: ROACH_PALETTE, frames: tall(ROACH) },
};

export function spriteGrid(kind: PetKind, frame: FrameName): { grid: Grid; palette: Palette } {
  const s = SPRITES[kind];
  return { grid: s.frames[frame], palette: s.palette };
}

/** Render a grid as a crisp SVG (one rect per horizontal run of same-coloured pixels). */
export function gridToSvg(grid: Grid, palette: Palette): string {
  const rects: string[] = [];
  grid.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const c = row[x];
      let run = 1;
      while (x + run < row.length && row[x + run] === c) run++;
      if (c !== '.' && palette[c]) rects.push(`<rect x="${x}" y="${y}" width="${run}" height="1" fill="${palette[c]}"/>`);
      x += run;
    }
  });
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SPRITE_W} ${SPRITE_H}" ` +
    `width="${SPRITE_W}" height="${SPRITE_H}" shape-rendering="crispEdges">${rects.join('')}</svg>`
  );
}

const uriCache = new Map<string, string>();

/** Base64 data URI (no quotes needed in CSS, which matters for the decoration trick). */
export function spriteDataUri(kind: PetKind, frame: FrameName): string {
  const key = `${kind}:${frame}`;
  let uri = uriCache.get(key);
  if (!uri) {
    const { grid, palette } = spriteGrid(kind, frame);
    uri = 'data:image/svg+xml;base64,' + Buffer.from(gridToSvg(grid, palette)).toString('base64');
    uriCache.set(key, uri);
  }
  return uri;
}

/** Sanity check used by tests: every frame is exactly 16x12. */
export function allFrames(): Array<{ kind: PetKind; frame: FrameName; grid: Grid }> {
  const out: Array<{ kind: PetKind; frame: FrameName; grid: Grid }> = [];
  for (const kind of Object.keys(SPRITES) as PetKind[]) {
    for (const frame of Object.keys(SPRITES[kind].frames) as FrameName[]) {
      out.push({ kind, frame, grid: SPRITES[kind].frames[frame] });
    }
  }
  return out;
}
