import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Pet, PET_KINDS, TRAITS } from '../engine/pet';
import { World, coversSpan, segmentAt, withoutLines } from '../engine/world';
import { anchorFor, segmentsForText } from '../engine/text';
import { allFrames, SPRITE_H, SPRITE_W } from '../sprites/sprites';

/** A fake editor: an array of code lines and a scrollable viewport. */
function makeWorld(lines: string[], first = 0, last = lines.length - 1): World & { scrollTo(first: number, last: number): void } {
  const w = {
    firstVisibleLine: first,
    lastVisibleLine: last,
    lineCount: lines.length,
    platforms: (l: number) => (l < 0 || l >= lines.length ? [] : segmentsForText(lines[l], 4)),
    scrollTo(f: number, l: number) {
      w.firstVisibleLine = f;
      w.lastVisibleLine = l;
    },
  };
  return w;
}

/** Deterministic RNG so tests are repeatable. */
function seeded(seed: number): () => number {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

function run(pet: Pet, world: World, seconds: number, dt = 1 / 15): void {
  for (let t = 0; t < seconds; t += dt) pet.step(dt, world);
}

const CODE = [
  'function hello() {',
  '  const x = 1;',
  '',
  '',
  '  if (x) {',
  '    return x;',
  '  }',
  '}',
];

test('platform spans first to last non-whitespace char, tabs expanded', () => {
  assert.deepEqual(segmentsForText('  foo  ', 4), [{ start: 2, end: 5 }]);
  assert.deepEqual(segmentsForText('\tbar', 4), [{ start: 4, end: 7 }]);
  assert.deepEqual(segmentsForText('   ', 4), []);
});

test('5+ blank columns split a line into separate segments; fewer do not', () => {
  assert.deepEqual(segmentsForText('a    b', 4), [{ start: 0, end: 6 }]); // 4 spaces: walkable
  assert.deepEqual(segmentsForText('a     b', 4), [{ start: 0, end: 1 }, { start: 6, end: 7 }]); // 5: hole
  assert.deepEqual(segmentsForText('x = 1;\t\t// note', 4), [{ start: 0, end: 6 }, { start: 12, end: 19 }]); // tabs count by width
  assert.deepEqual(segmentsForText('a     b', 4, 8), [{ start: 0, end: 7 }]); // configurable
});

test('pets never walk across a wide gap, but do jump it', () => {
  // Two islands of code on one line, separated by 8 spaces.
  const lines = ['', 'left_side_code();        right_side_code();'];
  const world = makeWorld(lines);
  const [a, b] = world.platforms(1);
  const pet = new Pet(1, 'cat', 'T', 5, 1, seeded(11));
  pet.state = 'walk';
  // A "leap" is a flight that starts on one side and lands on the other
  // without ever dropping below the line (so it isn't a fall + re-entry).
  let leaps = 0;
  let side: 'L' | 'R' | null = null;
  let inAir = false;
  let lowest = 0;
  for (let t = 0; t < 300; t += 1 / 15) {
    pet.step(1 / 15, world);
    if (pet.airborne) {
      lowest = inAir ? Math.max(lowest, pet.y) : pet.y;
      inAir = true;
      continue;
    }
    assert.ok(segmentAt(world, pet.y, pet.x), `standing in the gap at x=${pet.x.toFixed(2)}`);
    const now = pet.x < a.end + 1 ? 'L' : pet.x > b.start - 1 ? 'R' : null;
    if (inAir && side && now && now !== side && lowest <= 1.01) leaps++;
    inAir = false;
    side = now ?? side;
  }
  assert.ok(leaps >= 3, `only ${leaps} real leaps across the gap`);
});

test('anchor handles positions past the end of the line', () => {
  assert.deepEqual(anchorFor('ab', 5.5, 4), { charIndex: 2, offsetCols: 3.5 });
  assert.deepEqual(anchorFor('\tx', 5, 4), { charIndex: 2, offsetCols: 0 });
});

test('a falling pet lands on the first line with text under it', () => {
  const world = makeWorld(CODE);
  const pet = new Pet(1, 'cat', 'T', 5, 0.5, seeded(1));
  pet.state = 'fall';
  // Column 5 is over line 1 ("  const x = 1;"), the first standable line below.
  for (let i = 0; i < 30 && pet.airborne; i++) pet.step(1 / 15, world);
  assert.equal(pet.airborne, false);
  assert.equal(pet.y, 1);
});

test('a pet falls through blank lines', () => {
  const world = makeWorld(CODE);
  const pet = new Pet(1, 'cat', 'T', 6, 2, seeded(2));
  pet.state = 'fall';
  for (let i = 0; i < 30 && pet.airborne; i++) pet.step(1 / 15, world);
  assert.equal(pet.y, 4); // skipped blank lines 2 and 3, landed on "  if (x) {"
});

test('pets stay on visible text over a long simulation', () => {
  const world = makeWorld(CODE);
  for (const kind of PET_KINDS) {
    const pet = new Pet(1, kind, 'T', 5, 0, seeded(7));
    pet.enterFromTop(world);
    for (let t = 0; t < 120; t += 1 / 15) {
      pet.step(1 / 15, world);
      if (!pet.airborne) {
        assert.ok(world.platforms(pet.y).length, `${kind} standing on blank line ${pet.y}`);
        assert.ok(segmentAt(world, pet.y, pet.x, 0.5), `${kind} standing on air at x=${pet.x}`);
      }
    }
  }
});

test('pets move around and jump up over time', () => {
  const world = makeWorld(CODE);
  const pet = new Pet(1, 'slime', 'T', 5, 7, seeded(3));
  pet.state = 'idle';
  const linesVisited = new Set<number>();
  for (let t = 0; t < 120; t += 1 / 15) {
    pet.step(1 / 15, world);
    if (!pet.airborne) linesVisited.add(pet.y);
  }
  assert.ok(linesVisited.size >= 3, `only visited ${[...linesVisited]}`);
});

test('scrolling down past a pet makes it drop in from the top', () => {
  const lines = Array.from({ length: 200 }, (_, i) => (i % 3 === 2 ? '' : `  line(${i}) + more code here;`));
  const world = makeWorld(lines, 0, 30);
  const pet = new Pet(1, 'cat', 'T', 8, 5, seeded(4));
  pet.state = 'idle';
  world.scrollTo(100, 130);
  pet.step(1 / 15, world);
  assert.equal(pet.airborne, true);
  assert.ok(pet.y <= 101, 'starts at the top edge');
  run(pet, world, 3);
  assert.ok(pet.y >= 101 && pet.y <= 130, `landed inside the viewport, y=${pet.y}`);
});

test('scrolling up past a pet makes it leap up from below', () => {
  const lines = Array.from({ length: 200 }, (_, i) => `    statement_${i}();`);
  const world = makeWorld(lines, 100, 130);
  const pet = new Pet(1, 'cat', 'T', 8, 120, seeded(5));
  pet.state = 'idle';
  world.scrollTo(0, 30);
  pet.step(1 / 15, world);
  assert.equal(pet.state, 'jump');
  assert.ok(pet.vy < 0, 'moving upward');
  for (let i = 0; i < 60 && pet.airborne; i++) pet.step(1 / 15, world);
  assert.equal(pet.airborne, false);
  assert.ok(pet.y >= 20 && pet.y <= 30, `landed near the bottom, y=${pet.y}`);
});

test('deleting the text under a pet makes it fall', () => {
  const lines = [...CODE];
  const world = makeWorld(lines);
  const pet = new Pet(1, 'cat', 'T', 6, 5, seeded(6));
  pet.state = 'idle';
  lines[5] = '';
  pet.step(1 / 15, world);
  assert.equal(pet.airborne, true);
});

test('launchTo lands on the requested line and column', () => {
  const world = makeWorld(CODE);
  const pet = new Pet(1, 'cat', 'T', 3, 7, seeded(8));
  pet.state = 'idle';
  pet.launchTo(4, 6);
  for (let i = 0; i < 60 && pet.airborne; i++) pet.step(1 / 60, world);
  assert.equal(pet.y, 4);
  assert.ok(Math.abs(pet.x - 6) < 0.6, `x=${pet.x}`);
});

test('empty viewport hides pets instead of looping', () => {
  const world = makeWorld(['', '', '', '']);
  const pet = new Pet(1, 'bug', 'T', 3, 0, seeded(9));
  pet.step(1 / 15, world);
  assert.equal(pet.hidden, true);
});

test('every sprite frame is 16x16', () => {
  for (const f of allFrames()) {
    assert.equal(f.grid.length, SPRITE_H, `${f.kind}/${f.frame}`);
    f.grid.forEach((row) => assert.equal(row.length, SPRITE_W, `${f.kind}/${f.frame}`));
  }
});

test('scrolling up while a pet is mid-leap never makes it drop in from the top', () => {
  const lines = Array.from({ length: 400 }, (_, i) => (i % 4 === 3 ? '' : `    some_code_here(${i});`));
  for (const speed of [2, 8, 30, 400]) {
    for (const kind of PET_KINDS) {
      const world = makeWorld(lines, 360, 399);
      const pet = new Pet(1, kind, 'T', 8, 398, seeded(21));
      pet.state = 'idle';
      run(pet, world, 2);
      while (world.firstVisibleLine > 0) {
        const first = Math.max(0, world.firstVisibleLine - speed);
        world.scrollTo(first, first + 39);
        const before = pet.y;
        pet.step(1 / 15, world);
        assert.ok(!(pet.y <= first + 0.01 && before > first + 1), `${kind} dropped in from the top at speed ${speed}`);
      }
    }
  }
});

const LONG_LINE = ['', '    const aVeryLongLineOfCodeForRunningAlong = somethingElse(withArgs);'];

test('clicking a pet pets it: it stays, hops happily, shows hearts (more hearts with more pets)', () => {
  const world = makeWorld(LONG_LINE);
  for (const kind of PET_KINDS.filter((k) => !TRAITS[k].skittish)) {
    const pet = new Pet(1, kind, 'T', 20, 1, seeded(41));
    pet.state = 'idle';
    pet.pet(22);
    assert.equal(pet.emote, '♥', kind);
    assert.equal(pet.state, 'idle', `${kind} should stay put`);
    assert.equal(pet.facing, 1, `${kind} should look toward the click`);
    assert.ok(pet.bob > 0 || pet.frame() === 'fall', `${kind} should do a happy hop`);
    pet.pet(22);
    pet.pet(22);
    assert.equal(pet.emote, '♥♥♥', kind);
    const x0 = pet.x;
    run(pet, world, 1);
    assert.equal(pet.x, x0, `${kind} wandered off while being petted`);
  }
});

test('clicking a sleeping pet startles it awake with a "!"; it stays put, then enjoys the next pat', () => {
  const world = makeWorld(LONG_LINE);
  const pet = new Pet(1, 'graycat', 'T', 20, 1, seeded(43));
  pet.state = 'sleep';
  pet.pet(22);
  assert.equal(pet.sleeping, false);
  assert.equal(pet.emote, '!');
  assert.ok(pet.bob > 0 || pet.frame() === 'fall', 'should jump with a start');
  const x0 = pet.x;
  run(pet, world, 0.5);
  assert.equal(pet.x, x0, 'should not run off');
  pet.pet(22);
  assert.equal(pet.emote, '♥');
});

test('clicking a bug, roach or mouse makes it scurry away with a "!", even from a nap', () => {
  const world = makeWorld(LONG_LINE);
  const skittish = PET_KINDS.filter((k) => TRAITS[k].skittish);
  assert.deepEqual([...skittish].sort(), ['bug', 'mouse', 'roach']);
  for (const kind of skittish) {
    const pet = new Pet(1, kind, 'T', 30, 1, seeded(42));
    pet.state = 'idle';
    pet.pet(28); // clicked just to its left
    assert.equal(pet.state, 'walk', kind);
    assert.equal(pet.emote, '!', kind);
    assert.equal(pet.facing, 1, `${kind} should run away from the click`);
    const x0 = pet.x;
    run(pet, world, 0.5);
    assert.ok(pet.x - x0 > 3, `${kind} only moved ${(pet.x - x0).toFixed(1)} columns`);
  }
});

test('idle pets eventually nap, and show z z z while asleep', () => {
  const world = makeWorld(CODE);
  const pet = new Pet(1, 'graycat', 'T', 5, 1, seeded(51));
  pet.state = 'idle';
  let slept = false;
  for (let t = 0; t < 300 && !slept; t += 1 / 15) {
    pet.step(1 / 15, world);
    if (pet.sleeping) {
      slept = true;
      assert.match(pet.emote ?? '', /^z/);
    }
  }
  assert.ok(slept, 'never fell asleep in 5 minutes');
});

test('hoppers bounce along instead of sliding: they lift off while moving and rest on landing', () => {
  const lines = ['', '    const aVeryLongLineOfCodeForRunningAlong = somethingElse(withArgs);'];
  for (const kind of ['mushroom', 'slime', 'bunny'] as const) {
    const world = makeWorld(lines);
    const pet = new Pet(1, kind, 'T', 30, 1, seeded(61));
    pet.state = 'idle'; // new pets start mid-air
    pet.flee(28); // a sure way to start a walk
    let lifted = false;
    let restedOnGround = false;
    let prevX = pet.x;
    for (let i = 0; i < 20; i++) {
      pet.step(1 / 15, world);
      if ((pet.state as string) !== 'walk') break;
      if (pet.bob > 0.2) lifted = true;
      if (pet.bob === 0 && pet.x === prevX) restedOnGround = true;
      prevX = pet.x;
    }
    assert.ok(lifted && restedOnGround, `${kind}: lifted=${lifted} rested=${restedOnGround}`);
  }
});

test('aimed jumps always reach their target, even tall leaps at a low frame rate', () => {
  const lines = Array.from({ length: 60 }, (_, i) => `    statement_${i}();`);
  for (const fps of [5, 10, 15, 30]) {
    for (let target = 2; target <= 30; target++) {
      const world = makeWorld(lines, 0, 31);
      const pet = new Pet(1, 'cat', 'T', 8, 32.5, seeded(target));
      pet.launchTo(target, 8);
      for (let i = 0; i < fps * 5 && pet.airborne; i++) pet.step(1 / fps, world);
      assert.equal(pet.y, target, `fps ${fps}: aimed at line ${target}, ended on ${pet.y}`);
    }
  }
});

test('no pet gets stuck in the air (regression for the endless bottom-leap loop)', () => {
  for (const seed of [51, 1, 2, 3, 4, 5, 6, 7, 8, 9]) {
    for (const kind of PET_KINDS) {
      const world = makeWorld(CODE);
      const pet = new Pet(1, kind, 'T', 5, 1, seeded(seed));
      pet.state = 'idle';
      let airStreak = 0;
      for (let t = 0; t < 120; t += 1 / 15) {
        pet.step(1 / 15, world);
        airStreak = pet.airborne ? airStreak + 1 : 0;
        assert.ok(airStreak < 15 * 4, `${kind} (seed ${seed}) airborne for over 4s`);
      }
    }
  }
});

test('a selection from line A to B keeps pets off lines A+1 through B+2', () => {
  const spans = [{ start: 10, end: 12 }];
  assert.deepEqual(
    [9, 10, 11, 12, 13, 14, 15].filter((l) => coversSpan(l, spans)),
    [11, 12, 13, 14],
  );
  // No selection, just the text cursor on line 5: only the two lines below it are off limits.
  assert.deepEqual([4, 5, 6, 7, 8].filter((l) => coversSpan(l, [{ start: 5, end: 5 }])), [6, 7]);
});

test('pets never stand where they would cover the selected lines', () => {
  const lines = Array.from({ length: 30 }, (_, i) => `    statement_number_${i}(withSomeArguments);`);
  const spans = [{ start: 12, end: 15 }];
  for (const kind of PET_KINDS) {
    const world = withoutLines(makeWorld(lines), (l) => coversSpan(l, spans));
    const pet = new Pet(1, kind, 'T', 10, 0, seeded(71));
    pet.enterFromTop(world);
    for (let t = 0; t < 120; t += 1 / 15) {
      pet.step(1 / 15, world);
      if (!pet.airborne) assert.ok(!coversSpan(pet.y, spans), `${kind} stood on line ${pet.y}, covering the selection`);
    }
  }
});

test('selecting the lines a pet is covering makes it move out of the way', () => {
  const lines = Array.from({ length: 30 }, (_, i) => `    statement_number_${i}(withSomeArguments);`);
  const pet = new Pet(1, 'cat', 'T', 10, 13, seeded(72));
  pet.state = 'idle'; // standing on line 13, its body drawn over line 12
  // Now the user starts typing on line 12, right under the cat's body.
  const spans = [{ start: 12, end: 12 }];
  const world = withoutLines(makeWorld(lines), (l) => coversSpan(l, spans));
  pet.step(1 / 15, world);
  assert.equal(pet.airborne, true, 'should drop off right away');
  for (let i = 0; i < 60 && pet.airborne; i++) pet.step(1 / 15, world);
  assert.ok(!coversSpan(pet.y, spans), `landed on line ${pet.y}`);
});
