// Chibi pixel pets, 16x16, facing right, lit from the top left.
// One character per pixel; '.' is transparent. Shared letters:
//   k  outline (a dark shade of the pet's own colour, never pure black)
//   f  main colour      h  highlight (top/left)      s  shadow (bottom/right)
//   l  light belly/muzzle   p  blush / inner ear     n  nose
//   e  eye              i  eye shine (white). Eyes are 2 rows tall so they can blink.
// Anything else is a pet-specific colour from its palette.
//
// Each pet is drawn once as a body plus a few leg poses; `makeFrames` derives
// the blink, walk, landing (squash), sleeping (loaf) and falling frames.
import type { FrameName } from '../engine/pet';

export type Grid = string[];
export type Palette = Record<string, string>;
export interface SpriteSet {
  palette: Palette;
  frames: Record<FrameName, Grid>;
}

export const BLANK = '................';

interface Legs {
  a: Grid;
  b: Grid;
  fall: Grid;
}

const isEye = (c: string | undefined) => c === 'e' || c === 'i';

/**
 * Close the eyes. For an eye 2 rows tall, the top row turns into `fur` and the
 * bottom row stays dark, which reads as a closed, happy "-" lid. A lone
 * one-pixel eye becomes outline.
 */
export function blink(g: Grid, fur: string): Grid {
  const rows = g.map((r) => r.split(''));
  for (let y = 0; y < rows.length; y++) {
    for (let x = 0; x < 16; x++) {
      if (!isEye(g[y][x])) continue;
      const below = isEye(g[y + 1]?.[x]);
      const above = isEye(g[y - 1]?.[x]);
      if (below) rows[y][x] = fur;
      else if (!above) rows[y][x] = 'k';
      else rows[y][x] = 'e'; // bottom row: the closed lid
    }
  }
  return rows.map((r) => r.join(''));
}

function makeFrames(body: Grid, legs: Legs, squashRow: number, fur: string): Record<FrameName, Grid> {
  const idle = [...body, ...legs.a];
  const squashed = [BLANK, ...body.filter((_, i) => i !== squashRow), ...legs.a];
  const loaf = [...legs.a.map(() => BLANK), ...body]; // legs tucked under, sitting low
  return {
    idle,
    blink: blink(idle, fur),
    walk1: idle,
    walk2: [...body, ...legs.b],
    fall: [...body, ...legs.fall],
    squash: squashed,
    sleep: blink(loaf, fur),
  };
}

const EYE_SHINE = '#ffffff';

// ------------------------------------------------------------------ cats

// Pointy ears with pink insides, forehead stripes, big shiny eyes, tail up.
const CAT_BODY: Grid = [
  BLANK,
  '.........k...k..',
  '........kpk.kpk.',
  '.......khpfffpfk',
  '.......khfdfdffk',
  '.k.....kfiefiefk',
  'kfk....kfeefeefk',
  'kfk....kpffnffpk',
  'kfk....kflllllfk',
  '.kfkkkkkkllllllk',
  '..khhffdffdfllfk',
  '..kffffffffflfk.',
  '..ksffffffffssk.',
  '...kkkkkkkkkkk..',
];
const CAT_LEGS: Legs = {
  a: ['...kf.kf..kf.kf.', '...kk.kk..kk.kk.'],
  b: ['....kf.kf.kf.kf.', '....kk.kk.kk.kk.'],
  fall: ['..kf..kf..kf..kf', '..k...k...k...k.'],
};
const SOCK_LEGS: Legs = {
  a: ['...kl.kl..kl.kl.', '...kk.kk..kk.kk.'],
  b: ['....kl.kl.kl.kl.', '....kk.kk.kk.kk.'],
  fall: ['..kl..kl..kl..kl', '..k...k...k...k.'],
};

const ORANGE_CAT: SpriteSet = {
  palette: {
    k: '#7a4220', f: '#f7a64b', h: '#ffc67e', s: '#df8a36', d: '#d8772a',
    l: '#fff1d8', p: '#ff9eb5', n: '#e8607a', e: '#2a1a12', i: EYE_SHINE,
  },
  frames: makeFrames(CAT_BODY, CAT_LEGS, 11, 'f'),
};

const GRAY_CAT: SpriteSet = {
  palette: {
    k: '#4a4e5c', f: '#b9bdc9', h: '#d8dbe4', s: '#9a9fae', d: '#8b909f',
    l: '#f3f4f8', p: '#ffadc0', n: '#e8708a', e: '#22252e', i: EYE_SHINE,
  },
  frames: makeFrames(CAT_BODY, SOCK_LEGS, 11, 'f'),
};

// ------------------------------------------------------------------ dogs

// Shiba: upright ears, red-orange coat, white cheeks/muzzle/chest, curly tail.
const SHIBA_BODY: Grid = [
  BLANK,
  '.........k...k..',
  '........klk.klk.',
  '.......khlffflfk',
  '.......khffffffk',
  '..kkk..kfiefiefk',
  '.khllk.kleefeelk',
  '.kflk..kllfnfllk',
  '..kfk..klllllllk',
  '..kfkkkkkllllllk',
  '..khhfffffffllk.',
  '..kfffffffflllk.',
  '..ksffffffffssk.',
  '...kkkkkkkkkkk..',
];
const SHIBA: SpriteSet = {
  palette: {
    k: '#6b3a1f', f: '#ec8f3b', h: '#ffb469', s: '#cf7428',
    l: '#fff6e8', n: '#2b1a12', e: '#2b1a12', i: EYE_SHINE,
  },
  frames: makeFrames(SHIBA_BODY, SOCK_LEGS, 11, 'f'),
};

// Puppy: round cream head, floppy brown ears, a brown spot, wagging tail.
const PUPPY_BODY: Grid = [
  BLANK,
  BLANK,
  '.........kkkk...',
  '.......kkhhffkk.',
  '......kdhfffffdk',
  '......kdiefiefdk',
  '.k....kdeefeefdk',
  'kfk...kdpfnfpfdk',
  'kfk....kflllllfk',
  '.kfkkkkkkfllllfk',
  '..khhdddffffllfk',
  '..kffdddffffflk.',
  '..ksffffffffssk.',
  '...kkkkkkkkkkk..',
];
const PUPPY: SpriteSet = {
  palette: {
    k: '#5b3a24', f: '#f6e0b5', h: '#fff4dc', s: '#e0c38c', d: '#b06d3c',
    l: '#ffffff', p: '#ffadc0', n: '#3b2416', e: '#2b1a12', i: EYE_SHINE,
  },
  frames: makeFrames(PUPPY_BODY, CAT_LEGS, 11, 'f'),
};

// Golden retriever: golden coat, long floppy ears, cream muzzle and chest,
// and a big feathery tail.
const GOLDEN_BODY: Grid = [
  BLANK,
  BLANK,
  '.........kkkk...',
  '.......kkhhffkk.',
  '......kdhfffffdk',
  '.kk...kdiefiefdk',
  'khk...kdeefeefdk',
  'kfk...kdplnlpldk',
  'kfdk..kdlllllldk',
  '.kfdkkkkkfllllfk',
  '..khhfffffffllfk',
  '..kfffffffffflk.',
  '..ksffffffffssk.',
  '...kkkkkkkkkkk..',
];
const GOLDEN: SpriteSet = {
  palette: {
    k: '#74400f', f: '#ebb553', h: '#f9d891', s: '#cc9131', d: '#a8651d',
    l: '#fdf0d2', p: '#ffadc0', n: '#3b2416', e: '#2b1a12', i: EYE_SHINE,
  },
  frames: makeFrames(GOLDEN_BODY, CAT_LEGS, 11, 'f'),
};

// Corgi: huge upright ears, white blaze and cheeks, long low body, fluffy
// white bum and tiny stubby legs.
const CORGI_BODY: Grid = [
  BLANK,
  '.........k...k..',
  '........kpk.kpk.',
  '........kppkppk.',
  '.......khfflfffk',
  '.......kfieliefk',
  '.......kleeleelk',
  '.......kpllnllpk',
  '.......klllllllk',
  '..kkkkkkkllllllk',
  '.khhhfffffffllk.',
  'klhfffffffffllk.',
  'kllffffffffflk..',
  '.ksssffffffssk..',
  '..kkkkkkkkkkk...',
];
const CORGI: SpriteSet = {
  palette: {
    k: '#7a3f18', f: '#e8923a', h: '#ffb56a', s: '#c97428', l: '#fff8ee',
    p: '#ffadc0', n: '#2b1a12', e: '#2b1a12', i: EYE_SHINE,
  },
  frames: makeFrames(
    CORGI_BODY,
    {
      a: ['..kl.kl..kl.kl..'],
      b: ['...kl.kl.kl.kl..'],
      fall: ['.kl..kl..kl..kl.'],
    },
    11,
    'f',
  ),
};

// ------------------------------------------------------------------ bunny

const BUNNY_BODY: Grid = [
  '........kkk.kkk.',
  '........kpk.kpk.',
  '........kpk.kpk.',
  '........kpk.kpk.',
  '.......khffffffk',
  '.......kfiefiefk',
  '.......kfeefeefk',
  '.......kpffnffpk',
  '.......kfflllffk',
  '..kkkkkkffffffk.',
  'kllkhhhfffffffk.',
  'kllkffffffffffk.',
  '.kkksffffffssk..',
  '...kkkkkkkkkkk..',
];
const BUNNY: SpriteSet = {
  palette: {
    k: '#7a6a62', f: '#f4efe9', h: '#ffffff', s: '#dcd2c6',
    l: '#ffffff', p: '#ffb3c6', n: '#e8708a', e: '#2b2222', i: EYE_SHINE,
  },
  frames: makeFrames(
    BUNNY_BODY,
    {
      a: ['...kff....kff...', '...kkk....kkk...'],
      b: ['....kff..kff....', '....kkk..kkk....'],
      fall: ['..kff......kff..', '..kk........kk..'],
    },
    11,
    'f',
  ),
};

// ------------------------------------------------------------------ birds

const CHICKEN_BODY: Grid = [
  BLANK,
  '..........r.r...',
  '.........krrrk..',
  '........khhfffk.',
  '........kfffefk.',
  '........kfffefyy',
  '........kffffkr.',
  '.kk.....kffffk..',
  '.khk...kfffffk..',
  '.khfkkkffffffk..',
  '.kffffffffffffk.',
  '.kfffddddffffk..',
  '..ksfddddffsk...',
  '...kkkkkkkk.....',
];
const CHICKEN: SpriteSet = {
  palette: {
    k: '#7d6b5d', f: '#fbfaf7', h: '#ffffff', s: '#e2dbd1', d: '#e9e2d7',
    r: '#e8463c', y: '#f5b82e', o: '#ec8a2c', e: '#2b2222',
  },
  frames: makeFrames(
    CHICKEN_BODY,
    {
      a: ['.....o..o.......', '....oo.oo.......'],
      b: ['....o....o......', '...oo...oo......'],
      fall: ['......o.o.......', BLANK],
    },
    10,
    'f',
  ),
};

const DUCK_BODY: Grid = [
  BLANK,
  BLANK,
  '.........kkkk...',
  '........khhffk..',
  '........kffefk..',
  '........kffefooo',
  '........kpfffqq.',
  '........kffffk..',
  '.k.....kffffffk.',
  '.khkkkkhhfffffk.',
  '.kffffffffffffk.',
  '.kffffddddffffk.',
  '..ksfffddfffsk..',
  '...kkkkkkkkkk...',
];
const DUCKLING: SpriteSet = {
  palette: {
    k: '#9a6a10', f: '#ffd84d', h: '#ffec99', s: '#f0b429', d: '#f5c33b',
    o: '#ff8a2a', q: '#e0661a', p: '#ffab8a', e: '#2b2222',
  },
  frames: makeFrames(
    DUCK_BODY,
    {
      a: ['.....oo..oo.....', '....ooo.ooo.....'],
      b: ['......oo.oo.....', '.....ooo.ooo....'],
      fall: ['.....o....o.....', BLANK],
    },
    10,
    'f',
  ),
};

// ------------------------------------------------------------------ mushroom

// No legs: the mushroom gets around by hopping. Shaded cap with a lit top
// left, cream gills underneath, and a little face on the stem.
const CAP: Grid = [
  '.....kkkkkk.....',
  '...kkhhwwrrkk...',
  '..khhrwwrrrrrk..',
  '.khwwrrrrrrwwrk.',
  '.krwwrrrrrrwwqk.',
  'krrrrrrwwrrrrrqk',
  'kqrrrrrwwrrrrqqk',
  'kkggggggggggggkk',
];
const STEM_PLAIN = '....kssssstk....';
const FACE: Grid = ['....ksiesiek....', '....kseeseek....', '....kpsssspk....'];
const STEM_BASE = '....kkkkkkkk....';
const MUSHROOM_IDLE: Grid = [BLANK, BLANK, ...CAP, STEM_PLAIN, ...FACE, STEM_PLAIN, STEM_BASE];
const MUSHROOM_STRETCH: Grid = [BLANK, ...CAP, STEM_PLAIN, ...FACE, STEM_PLAIN, STEM_PLAIN, STEM_BASE];
const MUSHROOM_SQUISH: Grid = [BLANK, BLANK, BLANK, ...CAP, STEM_PLAIN, ...FACE, STEM_BASE];
const MUSHROOM: SpriteSet = {
  palette: {
    k: '#7a2a2a', r: '#e84a4a', h: '#ff7d72', q: '#c23434', w: '#ffffff', g: '#ead2b2',
    s: '#f8e9cb', t: '#e6cfa6', p: '#ffadc0', e: '#2b2222', i: EYE_SHINE,
  },
  frames: {
    idle: MUSHROOM_IDLE,
    blink: blink(MUSHROOM_IDLE, 's'),
    walk1: MUSHROOM_IDLE,
    walk2: MUSHROOM_SQUISH,
    fall: MUSHROOM_STRETCH,
    squash: MUSHROOM_SQUISH,
    sleep: blink(MUSHROOM_SQUISH, 's'),
  },
};

// ------------------------------------------------------------------ slime

// Glossy jelly blob with a shine on top; stretches mid-hop, squishes on landing.
const SLIME_TOP: Grid = [
  '......kkkk......',
  '....kkhhggkk....',
  '...khwhgggggk...',
  '..khhggggggggk..',
];
const SLIME_FACE: Grid = [
  '..kggiegiegggk..',
  '.kgggeegeeggggk.',
  '.kggpgggggpggsk.',
];
const SLIME_BOTTOM: Grid = ['.ksggggggggsssk.', '..kssssssssssk..', '...kkkkkkkkkk...'];
const SLIME_IDLE: Grid = [...Array(6).fill(BLANK), ...SLIME_TOP, ...SLIME_FACE, ...SLIME_BOTTOM];
const SLIME_SQUISH: Grid = [
  ...Array(7).fill(BLANK),
  ...SLIME_TOP.slice(0, 3),
  ...SLIME_FACE,
  '.ksggggggggggssk', // wider and flatter on landing
  '.kssssssssssssk.',
  '..kkkkkkkkkkkk..',
];
const SLIME_STRETCH: Grid = [...Array(5).fill(BLANK), ...SLIME_TOP, SLIME_TOP[3], ...SLIME_FACE, ...SLIME_BOTTOM];
const SLIME: SpriteSet = {
  palette: {
    k: '#2f8f3a', g: '#6ddc6d', h: '#a6f09c', s: '#4fbf55', w: '#ffffff',
    p: '#9fe8a0', e: '#123d18', i: EYE_SHINE,
  },
  frames: {
    idle: SLIME_IDLE,
    blink: blink(SLIME_IDLE, 'g'),
    walk1: SLIME_IDLE,
    walk2: SLIME_SQUISH,
    fall: SLIME_STRETCH,
    squash: SLIME_SQUISH,
    sleep: blink(SLIME_SQUISH, 'g'),
  },
};

// ------------------------------------------------------------------ mouse

// Little gray mouse: big round pink ears, shiny eyes, pointy snout, curly tail.
const MOUSE_BODY: Grid = [
  BLANK,
  BLANK,
  BLANK,
  BLANK,
  BLANK,
  '........kkk.kkk.',
  '........kppkppk.',
  '........kppkppk.',
  '.........kffffk.',
  '........khfieffk',
  '..kkkkkkkffeeffk',
  '.khhffffffffffpk',
  '.kfffffffllllk..',
  'p.ksffffsllk....',
  '.p.kkkkkkkk.....',
];
const MOUSE: SpriteSet = {
  palette: {
    k: '#5c5763', f: '#cfcad6', h: '#ece8f2', s: '#aea8b8', l: '#f4f1f7',
    p: '#ffadc2', e: '#22202a', i: EYE_SHINE,
  },
  frames: makeFrames(
    MOUSE_BODY,
    {
      a: ['....pp...pp.....'],
      b: ['.....pp.pp......'],
      fall: ['...p.p...p.p....'],
    },
    12,
    'f',
  ),
};

// ------------------------------------------------------------------ guinea pig

// Chubby potato with tiny ears, orange and white patches, no tail.
const GUINEA_BODY: Grid = [
  BLANK,
  BLANK,
  BLANK,
  BLANK,
  BLANK,
  '.....kkkkkkkpk..',
  '...kkwwwwgggfk..',
  '..kwwwwwffffiek.',
  '.kwwwwwwffffeek.',
  '.kfffwwwwfffpffk',
  'kffffwwwwwffffnk',
  'kfffffwwwwwffffk',
  'ksfffffwwwwfffsk',
  '.ksssffffffsssk.',
  '..kkkkkkkkkkkk..',
];
const GUINEA_PIG: SpriteSet = {
  palette: {
    k: '#5b3a24', f: '#e09450', g: '#f2b070', s: '#c57a3a', w: '#fff6ea',
    p: '#ffab9e', n: '#5b3a24', e: '#22180f', i: EYE_SHINE,
  },
  frames: makeFrames(
    GUINEA_BODY,
    {
      a: ['...kk..kk..kk...'],
      b: ['....kk..kk..kk..'],
      fall: ['..k..k....k..k..'],
    },
    11,
    'f',
  ),
};

export const CRITTERS = {
  cat: ORANGE_CAT,
  graycat: GRAY_CAT,
  shiba: SHIBA,
  puppy: PUPPY,
  golden: GOLDEN,
  corgi: CORGI,
  bunny: BUNNY,
  chicken: CHICKEN,
  duckling: DUCKLING,
  mushroom: MUSHROOM,
  mouse: MOUSE,
  guineapig: GUINEA_PIG,
  slime: SLIME,
};
