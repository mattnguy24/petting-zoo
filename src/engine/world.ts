// The engine never touches VS Code directly. It only sees a World: which lines
// are on screen and where the walkable text is. Coordinates:
//   x = visual column of the pet's centre (float)
//   y = line number the pet's feet are on (float). y === 12 means "standing on
//       top of the text of line 12"; the pet's body is drawn in line 11's row.

export interface Platform {
  /** First walkable visual column (inclusive). */
  start: number;
  /** End of walkable text (exclusive). */
  end: number;
}

export interface World {
  firstVisibleLine: number;
  lastVisibleLine: number;
  lineCount: number;
  /**
   * Walkable segments of a line, left to right. A line splits into several
   * segments wherever it has a wide run of spaces; pets must jump those gaps.
   * Empty for blank, hidden or out-of-range lines.
   */
  platforms(line: number): Platform[];
}

/** Lines a pet can stand on and still be fully on screen. */
export function isStandableLine(world: World, line: number): boolean {
  return line >= world.firstVisibleLine + 1 && line <= world.lastVisibleLine && world.platforms(line).length > 0;
}

export function platformContains(p: Platform, x: number, margin = 0.25): boolean {
  return x >= p.start - margin && x <= p.end + margin;
}

/** A range of lines, inclusive, e.g. a text selection or the line being edited. */
export interface LineSpan {
  start: number;
  end: number;
}

/**
 * Lines a pet must not stand on so it doesn't cover any of `spans`. A pet
 * standing on line y is drawn over the row or two above it (y-1 and part of
 * y-2), so a span from A to B rules out standing on A+1 through B+2.
 */
export function coversSpan(line: number, spans: readonly LineSpan[]): boolean {
  return spans.some((s) => line >= s.start + 1 && line <= s.end + 2);
}

/** Wrap a world so the given lines are treated as empty air. */
export function withoutLines(world: World, blocked: (line: number) => boolean): World {
  return {
    firstVisibleLine: world.firstVisibleLine,
    lastVisibleLine: world.lastVisibleLine,
    lineCount: world.lineCount,
    platforms: (line) => (blocked(line) ? [] : world.platforms(line)),
  };
}

/** The segment of `line` under column x, if any. */
export function segmentAt(world: World, line: number, x: number, margin = 0.25): Platform | null {
  for (const p of world.platforms(line)) if (platformContains(p, x, margin)) return p;
  return null;
}

/** The nearest segment of `line` beyond `p` in direction dir (+1 right, -1 left). */
export function neighbourSegment(world: World, line: number, p: Platform, dir: number): Platform | null {
  const segs = world.platforms(line);
  if (dir > 0) return segs.find((s) => s.start >= p.end) ?? null;
  for (let i = segs.length - 1; i >= 0; i--) if (segs[i].end <= p.start) return segs[i];
  return null;
}
