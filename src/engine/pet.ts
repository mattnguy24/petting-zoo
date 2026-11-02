// Platform-agnostic pet brain + physics. Units: columns and lines, seconds.
import { World, isStandableLine, neighbourSegment, segmentAt } from './world';

// 'cat' is the orange cat (kept as 'cat' so pets saved by older versions still load).
export type PetKind =
  | 'cat'
  | 'graycat'
  | 'shiba'
  | 'puppy'
  | 'golden'
  | 'corgi'
  | 'bunny'
  | 'chicken'
  | 'duckling'
  | 'mushroom'
  | 'guineapig'
  | 'mouse'
  | 'slime'
  | 'bug'
  | 'roach';
export const PET_KINDS: PetKind[] = ['cat', 'graycat', 'shiba', 'puppy', 'golden', 'corgi', 'bunny', 'chicken', 'duckling', 'mushroom', 'guineapig', 'mouse', 'slime', 'bug', 'roach'];

export type PetState = 'idle' | 'walk' | 'fall' | 'jump' | 'sleep';
export type FrameName = 'idle' | 'blink' | 'walk1' | 'walk2' | 'fall' | 'sleep' | 'squash';

export interface Traits {
  /** Columns per second. */
  walkSpeed: number;
  /** 0..1, how often the pet chooses to jump up to a higher line. */
  jumpiness: number;
  /** 0..1, how often an idle pet dozes off. */
  sleepiness: number;
  /** Walk animation speed (frames per second). */
  stepRate: number;
  /** How close (in columns / lines) the cursor can get before the pet bolts. */
  fearRadius: number;
  fearLines: number;
  /** 'walk' slides along on its legs; 'hop' moves in a series of little bounces. */
  gait: 'walk' | 'hop';
  /** Skittish critters scurry off when clicked instead of enjoying a pat. */
  skittish: boolean;
}

type TraitRow = Omit<Traits, 'gait' | 'skittish'> & Partial<Pick<Traits, 'gait' | 'skittish'>>;
const t = (row: TraitRow): Traits => ({ gait: 'walk', skittish: false, ...row });

export const TRAITS: Record<PetKind, Traits> = {
  cat: t({ walkSpeed: 4.5, jumpiness: 0.3, sleepiness: 0.18, stepRate: 8, fearRadius: 1.5, fearLines: 0 }),
  graycat: t({ walkSpeed: 3.5, jumpiness: 0.25, sleepiness: 0.3, stepRate: 7, fearRadius: 1.5, fearLines: 0 }),
  shiba: t({ walkSpeed: 6, jumpiness: 0.3, sleepiness: 0.06, stepRate: 10, fearRadius: 1, fearLines: 0 }),
  puppy: t({ walkSpeed: 5, jumpiness: 0.4, sleepiness: 0.12, stepRate: 11, fearRadius: 1, fearLines: 0 }),
  golden: t({ walkSpeed: 4.5, jumpiness: 0.3, sleepiness: 0.15, stepRate: 9, fearRadius: 1, fearLines: 0 }),
  // Short legs: not fast, but they go like the clappers.
  corgi: t({ walkSpeed: 3.8, jumpiness: 0.2, sleepiness: 0.12, stepRate: 15, fearRadius: 1, fearLines: 0 }),
  bunny: t({ walkSpeed: 3, jumpiness: 0.85, sleepiness: 0.08, stepRate: 5, fearRadius: 3, fearLines: 1, gait: 'hop' }),
  chicken: t({ walkSpeed: 3, jumpiness: 0.2, sleepiness: 0.04, stepRate: 9, fearRadius: 2.5, fearLines: 1 }),
  duckling: t({ walkSpeed: 2.2, jumpiness: 0.12, sleepiness: 0.15, stepRate: 6, fearRadius: 1.5, fearLines: 0 }),
  mushroom: t({ walkSpeed: 1.8, jumpiness: 0.35, sleepiness: 0.35, stepRate: 4, fearRadius: 1.5, fearLines: 0, gait: 'hop' }),
  guineapig: t({ walkSpeed: 2.4, jumpiness: 0.1, sleepiness: 0.25, stepRate: 8, fearRadius: 1.5, fearLines: 0 }),
  // Quick and nervous, like the bugs: scurries off when clicked.
  mouse: t({ walkSpeed: 6.5, jumpiness: 0.3, sleepiness: 0.05, stepRate: 16, fearRadius: 3, fearLines: 1, skittish: true }),
  slime: t({ walkSpeed: 2.5, jumpiness: 0.6, sleepiness: 0.1, stepRate: 4, fearRadius: 1.5, fearLines: 0, gait: 'hop' }),
  bug: t({ walkSpeed: 3, jumpiness: 0.2, sleepiness: 0.06, stepRate: 12, fearRadius: 1.5, fearLines: 0, skittish: true }),
  // Fast, never sleeps, and scatters when the cursor gets anywhere near it.
  roach: t({ walkSpeed: 8, jumpiness: 0.15, sleepiness: 0, stepRate: 16, fearRadius: 5, fearLines: 2, skittish: true }),
};

/** Fraction of each hop cycle spent in the air (the rest is the squishy landing). */
const HOP_AIR = 0.65;
/** Duration of a little hop in place (fidget or angry stomp), seconds. */
const BOUNCE = 0.35;
/** Speed multiplier while running away. */
const FLEE_BOOST = 2.4;

/** Lines per second squared. */
export const GRAVITY = 45;
const MAX_FALL_SPEED = 28;
const MAX_JUMP_REACH = 4; // lines a pet will jump up on its own
const MAX_JUMP_SIDEWAYS = 8; // columns
const MAX_GAP_JUMP = 12; // widest gap in a line a pet will leap across (columns)

export type Rng = () => number;

export class Pet {
  x: number;
  y: number;
  vx = 0;
  vy = 0;
  state: PetState = 'fall';
  facing: 1 | -1 = 1;
  /** True when there is nothing on screen to stand on (e.g. empty file). */
  hidden = false;

  private timer = 0;
  private animTime = 0;
  private squashTime = 0;
  private idleStreak = 0;
  /** During an aimed jump, ignore platforms above this line. */
  private targetLine: number | undefined;
  /** Clock for the hop gait, so each walk starts on a fresh hop. */
  private gaitTime = 0;
  /** Remaining time of a little hop in place. */
  private bounceTime = 0;
  /** Remaining time of a run-away burst. */
  private boostTime = 0;
  /** Builds up while being petted (more hearts), then slowly fades. */
  private affection = 0;
  private emoteText: string | undefined;
  private emoteTime = 0;

  constructor(
    public readonly id: number,
    public readonly kind: PetKind,
    public name: string,
    x: number,
    y: number,
    private readonly rng: Rng = Math.random,
  ) {
    this.x = x;
    this.y = y;
  }

  get traits(): Traits {
    return TRAITS[this.kind];
  }

  get airborne(): boolean {
    return this.state === 'fall' || this.state === 'jump';
  }

  /** Advance the simulation by dt seconds. */
  step(dt: number, world: World): void {
    dt = Math.min(dt, 0.1);
    this.animTime += dt;
    if (this.squashTime > 0) this.squashTime -= dt;
    if (this.bounceTime > 0) this.bounceTime -= dt;
    if (this.boostTime > 0) this.boostTime -= dt;
    if (this.emoteTime > 0) this.emoteTime -= dt;
    this.affection = Math.max(0, this.affection - dt * 0.3);

    if (!this.anyStandable(world)) {
      this.hidden = true;
      return;
    }
    if (this.hidden) {
      this.hidden = false;
      this.enterFromTop(world);
    }

    if (!this.airborne) this.checkFooting(world);

    switch (this.state) {
      case 'fall':
      case 'jump':
        this.stepAir(dt, world);
        break;
      case 'walk':
        this.stepWalk(dt, world);
        break;
      case 'idle':
        this.stepIdle(dt, world);
        break;
      case 'sleep':
        this.timer -= dt;
        if (this.timer <= 0) this.goIdle();
        break;
    }
  }

  // ---------------------------------------------------------------- footing

  /** Grounded pets react to scrolling and edits that remove the ground under them. */
  private checkFooting(world: World): void {
    const line = Math.round(this.y);
    this.y = line;
    if (line < world.firstVisibleLine + 1) {
      this.enterFromTop(world); // scrolled down past the pet: it drops in from above
    } else if (line > world.lastVisibleLine) {
      this.enterFromBottom(world); // scrolled up past the pet: it leaps up from below
    } else {
      if (!segmentAt(world, line, this.x)) {
        this.state = 'fall';
        this.targetLine = undefined;
        this.vx = 0;
        this.vy = 0;
      }
    }
  }

  // ---------------------------------------------------------------- states

  private stepAir(dt: number, world: World): void {
    const prevY = this.y;
    // Average of old and new velocity is exact under constant gravity. Plain
    // Euler (y += newVy * dt) loses up to a line of height per jump at 15fps,
    // so aimed leaps fell just short of their target and could loop forever.
    const vy0 = this.vy;
    this.vy = Math.min(vy0 + GRAVITY * dt, MAX_FALL_SPEED);
    this.y += ((vy0 + this.vy) / 2) * dt;
    this.x = Math.max(0, this.x + this.vx * dt);
    if (this.vx !== 0) this.facing = this.vx > 0 ? 1 : -1;
    this.state = this.vy < 0 ? 'jump' : 'fall';

    if (this.vy > 0) {
      // Land on the first line whose top we crossed this frame.
      for (let l = Math.floor(prevY) + 1; l <= Math.floor(this.y); l++) {
        if (this.targetLine !== undefined && l < this.targetLine) continue;
        if (isStandableLine(world, l) && segmentAt(world, l, this.x)) {
          this.land(l);
          return;
        }
      }
      // Below the screen (fell through a hole, or the view scrolled up while we
      // were mid-air): always come back the way we left, leaping up from the bottom.
      if (this.y > world.lastVisibleLine + 1) this.enterFromBottom(world);
    } else if (this.y < world.firstVisibleLine - 3) {
      this.vy = 0; // jumps may arc a little off the top of the screen, but not forever
    }
  }

  private stepWalk(dt: number, world: World): void {
    const line = Math.round(this.y);
    // The segment we're on. Wide runs of spaces split a line into segments,
    // and pets can't walk across those gaps, only jump them.
    const p = segmentAt(world, line, this.x, 0.5);
    if (!p) return;
    const fleeing = this.boostTime > 0;
    let speed = this.traits.walkSpeed * (fleeing ? FLEE_BOOST : 1);
    if (this.traits.gait === 'hop') {
      // Hoppers only travel while in the air, then squish down on landing.
      this.gaitTime += dt * (fleeing ? 1.6 : 1);
      speed = this.hopPhase < HOP_AIR ? speed / HOP_AIR : 0;
    }
    this.x += this.facing * speed * dt;

    const atLeft = this.x < p.start + 0.3;
    const atRight = this.x > p.end - 0.3;
    if (atLeft || atRight) {
      // Code continues on this line past a gap: usually leap across it.
      const dir = atRight ? 1 : -1;
      const next = neighbourSegment(world, line, p, dir);
      if (next && this.rng() < 0.75) {
        const gap = dir > 0 ? next.start - p.end : p.start - next.end;
        if (gap <= MAX_GAP_JUMP) {
          const inset = Math.min(1.5, (next.end - next.start) / 2);
          this.x = atRight ? p.end - 0.3 : p.start + 0.3;
          this.launchTo(line, dir > 0 ? next.start + inset : next.end - inset, 0.8 + gap * 0.08);
          return;
        }
      }
      const r = this.rng();
      // A pet that's running away would rather jump off than turn back.
      if (r < (fleeing ? 0.6 : 0.25)) {
        // Walk off the edge and drop to whatever is below.
        this.x = atRight ? p.end + 0.4 : p.start - 0.4;
        this.vx = this.facing * this.traits.walkSpeed * 0.6;
        this.vy = 0;
        this.state = 'fall';
        this.targetLine = undefined;
        return;
      }
      if (r < 0.25 + this.traits.jumpiness * 0.6 && this.tryHop(world)) return;
      this.x = atRight ? p.end - 0.3 : p.start + 0.3;
      this.facing = atRight ? -1 : 1;
    }

    this.timer -= dt;
    if (this.timer <= 0) this.goIdle();
  }

  private stepIdle(dt: number, world: World): void {
    this.timer -= dt;
    if (this.timer > 0) {
      this.fidget(dt);
      return;
    }
    const t = this.traits;
    const r = this.rng();
    // The longer a pet has been loafing around, the likelier it nods off.
    if (this.idleStreak >= 1 && r < t.sleepiness * 0.6 * Math.min(2, this.idleStreak)) {
      this.state = 'sleep';
      this.timer = 5 + this.rng() * 10;
      return;
    }
    if (r < t.sleepiness + t.jumpiness * 0.8 && this.tryHop(world)) return;
    if (r < 0.8) {
      this.state = 'walk';
      if (this.rng() < 0.4) this.facing = this.facing === 1 ? -1 : 1;
      this.timer = 1.5 + this.rng() * 3;
      this.gaitTime = 0;
      this.idleStreak = 0;
      return;
    }
    this.goIdle();
  }

  /** Little things a pet does while standing around: look about, hop in place, hum. */
  private fidget(dt: number): void {
    if (this.bounceTime > 0 || this.rng() >= dt * 0.4) return;
    const r = this.rng();
    if (r < 0.55) {
      this.facing = this.facing === 1 ? -1 : 1; // look the other way
    } else if (r < 0.85) {
      this.bounceTime = BOUNCE; // happy little hop
    } else {
      this.say('♪', 1.4);
    }
  }

  private say(text: string, seconds: number): void {
    this.emoteText = text;
    this.emoteTime = seconds;
  }

  private goIdle(): void {
    this.state = 'idle';
    this.timer = 1 + this.rng() * 2.5;
    this.idleStreak++;
  }

  private get hopPhase(): number {
    return (this.gaitTime * this.traits.stepRate * 0.4) % 1;
  }

  private land(line: number): void {
    this.targetLine = undefined;
    this.y = line;
    this.vx = 0;
    this.vy = 0;
    this.squashTime = 0.15;
    this.state = 'idle';
    this.timer = 0.3 + this.rng() * 0.6;
    this.idleStreak = 0;
  }

  // ---------------------------------------------------------------- jumps

  /**
   * Hop to a nearby line above or below. Pets near the top of the screen
   * prefer hopping down and vice versa, so they roam the whole viewport.
   */
  private tryHop(world: World): boolean {
    const span = Math.max(1, world.lastVisibleLine - world.firstVisibleLine);
    const rel = (this.y - world.firstVisibleLine) / span; // 0 = top, 1 = bottom
    const pUp = Math.min(0.85, Math.max(0.15, 0.1 + rel * 0.8));
    const first = this.rng() < pUp ? -1 : 1;
    return this.tryJumpDir(world, first) || this.tryJumpDir(world, -first as 1 | -1);
  }

  /** Leap onto a nearby line in direction dir (-1 up, +1 down). */
  private tryJumpDir(world: World, dir: number): boolean {
    const line = Math.round(this.y);
    const options: Array<{ line: number; x: number }> = [];
    const reach = dir < 0 ? MAX_JUMP_REACH : MAX_JUMP_REACH + 2;
    for (let d = 1; d <= reach; d++) {
      const l = line + d * dir;
      if (!isStandableLine(world, l)) continue;
      for (const p of world.platforms(l)) {
        const lo = Math.max(p.start + 0.5, this.x - MAX_JUMP_SIDEWAYS);
        const hi = Math.min(p.end - 0.5, this.x + MAX_JUMP_SIDEWAYS);
        if (lo > hi) continue;
        options.push({ line: l, x: lo + this.rng() * (hi - lo) });
      }
    }
    if (options.length === 0) return false;
    const pick = options[Math.floor(this.rng() * options.length)];
    this.launchTo(pick.line, pick.x);
    return true;
  }

  /** Ballistic jump that lands on top of `line` at column `tx`, peaking `arc` lines above the higher end. */
  launchTo(line: number, tx: number, arc = 0.8): void {
    const apex = Math.min(this.y, line) - arc;
    const vy0 = -Math.sqrt(2 * GRAVITY * (this.y - apex));
    const tUp = -vy0 / GRAVITY;
    const tDown = Math.sqrt((2 * (line - apex)) / GRAVITY);
    this.vy = vy0;
    this.vx = Math.max(-40, Math.min(40, (tx - this.x) / (tUp + tDown)));
    if (this.vx !== 0) this.facing = this.vx > 0 ? 1 : -1;
    this.state = 'jump';
    this.targetLine = line; // fly over lines in between instead of clipping them
  }

  // ---------------------------------------------------------------- viewport

  /** Drop in from the top edge of the viewport. */
  enterFromTop(world: World): void {
    const spot = this.pickSpot(world, world.firstVisibleLine + 1, world.lastVisibleLine, true);
    if (spot) this.x = spot.x;
    this.y = world.firstVisibleLine;
    this.vx = 0;
    this.vy = 0;
    this.state = 'fall';
    this.targetLine = undefined;
  }

  /** Leap up from below the bottom edge of the viewport onto a line near the bottom. */
  enterFromBottom(world: World): void {
    const lo = Math.max(world.firstVisibleLine + 1, world.lastVisibleLine - 10);
    const spot = this.pickSpot(world, lo, world.lastVisibleLine, true);
    if (!spot) {
      this.enterFromTop(world);
      return;
    }
    this.y = world.lastVisibleLine + 1.5;
    this.launchTo(spot.line, spot.x);
  }

  /** A standable spot in [fromLine, toLine], preferring one under the pet's current x. */
  private pickSpot(world: World, fromLine: number, toLine: number, preferCurrentX: boolean): { line: number; x: number } | null {
    const spots: Array<{ line: number; x: number }> = [];
    for (let l = fromLine; l <= toLine; l++) {
      if (!isStandableLine(world, l)) continue;
      if (preferCurrentX && segmentAt(world, l, this.x)) return { line: l, x: this.x };
      for (const p of world.platforms(l)) {
        spots.push({ line: l, x: p.start + Math.max(0, p.end - p.start) * (0.2 + this.rng() * 0.6) });
      }
    }
    return spots.length ? spots[Math.floor(this.rng() * spots.length)] : null;
  }

  private anyStandable(world: World): boolean {
    for (let l = world.firstVisibleLine + 1; l <= world.lastVisibleLine; l++) {
      if (world.platforms(l).length) return true;
    }
    return false;
  }

  // ---------------------------------------------------------------- interaction

  /** Something poked the pet (e.g. the cursor). Hop away from it. */
  startle(fromX: number): void {
    if (this.airborne) return;
    const dir: 1 | -1 = this.x >= fromX ? 1 : -1;
    this.vy = -Math.sqrt(2 * GRAVITY * 1.3);
    this.vx = dir * Math.max(5, this.traits.walkSpeed * 1.2);
    this.facing = dir;
    this.targetLine = undefined;
    this.state = 'jump';
  }

  /** Scurry away from column fromX, with a little "!". Wakes the pet if needed. */
  flee(fromX: number): void {
    if (this.airborne) return;
    this.facing = this.x >= fromX ? 1 : -1;
    this.state = 'walk';
    this.timer = 1.4 + this.rng() * 0.6;
    this.boostTime = this.timer;
    this.gaitTime = 0;
    this.idleStreak = 0;
    this.say('!', 0.9);
  }

  /**
   * The pet was clicked. Skittish critters (bugs, the mouse) scurry off.
   * Everyone else loves it: a happy hop and a heart, more hearts the more
   * you pet them. A sleeping pet startles awake with a "!" first.
   */
  pet(fromX: number): void {
    if (this.airborne) return;
    if (this.traits.skittish) {
      this.flee(fromX);
      return;
    }
    if (this.sleeping) {
      // Woken with a start: jump, "!", then look around at who did it.
      this.state = 'idle';
      this.timer = 1.2 + this.rng();
      this.idleStreak = 0;
      this.facing = fromX >= this.x ? 1 : -1;
      this.bounceTime = BOUNCE;
      this.say('!', 1);
      return;
    }
    this.affection = Math.min(3, this.affection + 1);
    const hearts = '♥'.repeat(Math.max(1, Math.round(this.affection)));
    this.state = 'idle';
    this.timer = 1.5 + this.rng(); // stay put and enjoy it
    this.facing = fromX >= this.x ? 1 : -1; // look up at you
    this.bounceTime = BOUNCE;
    this.say(hearts, 1.5);
  }

  /** Come to a spot the user pointed at. */
  callTo(line: number, x: number, world: World): void {
    if (this.airborne || !isStandableLine(world, line)) return;
    // Aim for the closest bit of code on that line to the requested column.
    let best = x;
    let bestDist = Infinity;
    for (const p of world.platforms(line)) {
      const tx = Math.max(p.start + 0.3, Math.min(p.end - 0.3, x));
      if (Math.abs(tx - x) < bestDist) {
        best = tx;
        bestDist = Math.abs(tx - x);
      }
    }
    this.launchTo(line, best);
  }

  /** Keep pets riding on their line when lines are inserted/removed above them. */
  shiftLines(afterLine: number, delta: number): void {
    if (Math.floor(this.y) > afterLine) this.y = Math.max(0, this.y + delta);
  }

  // ---------------------------------------------------------------- animation

  frame(): FrameName {
    if (this.airborne || this.bounceTime > 0) return 'fall';
    if (this.squashTime > 0) return 'squash';
    switch (this.state) {
      case 'walk':
        if (this.traits.gait === 'hop') return this.hopPhase < HOP_AIR ? 'fall' : 'squash';
        return Math.floor(this.animTime * this.traits.stepRate) % 2 === 0 ? 'walk1' : 'walk2';
      case 'sleep':
        return 'sleep';
      default:
        return this.animTime % 3.2 < 0.15 ? 'blink' : 'idle';
    }
  }

  /**
   * Purely visual lift off the ground, in lines (positive = up), for hops
   * that don't change where the pet actually stands.
   */
  get bob(): number {
    if (this.bounceTime > 0) return Math.sin((Math.PI * this.bounceTime) / BOUNCE) * 0.5;
    if (this.state === 'walk' && this.traits.gait === 'hop') {
      const ph = this.hopPhase;
      return ph < HOP_AIR ? Math.sin((Math.PI * ph) / HOP_AIR) * 0.55 : 0;
    }
    return 0;
  }

  /** Speech-bubble text to show above the pet right now, if any. */
  get emote(): string | undefined {
    if (this.emoteTime > 0 && this.emoteText) return this.emoteText;
    if (this.sleeping) return ['z', 'z z', 'z z z'][Math.floor(this.animTime * 1.2) % 3];
    return undefined;
  }

  get sleeping(): boolean {
    return this.state === 'sleep';
  }

  get animationTime(): number {
    return this.animTime;
  }
}
