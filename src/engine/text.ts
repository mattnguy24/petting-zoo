// Pure helpers that turn a line of source text into walkable terrain.
// Everything is in *visual* columns, so tabs count as `tabSize` columns.

import { Platform } from './world';

/** Visual column where each character starts, plus the total visual width at the end. */
export function visualColumns(text: string, tabSize: number): number[] {
  const cols: number[] = [];
  let col = 0;
  for (let i = 0; i < text.length; i++) {
    cols.push(col);
    col += text[i] === '\t' ? tabSize - (col % tabSize) : 1;
  }
  cols.push(col);
  return cols;
}

/** Default: a run of this many blank columns (or more) inside a line is a hole. */
export const DEFAULT_GAP_WIDTH = 5;

/**
 * Walkable segments of a line. Text from the first to the last non-whitespace
 * character is floor, except runs of `gapWidth`+ blank columns, which split it
 * into separate segments the pet has to jump between. Indentation and trailing
 * whitespace are never floor. Blank lines have no segments, so pets fall through.
 */
export function segmentsForText(text: string, tabSize: number, gapWidth = DEFAULT_GAP_WIDTH): Platform[] {
  const cols = visualColumns(text, tabSize);
  const segs: Platform[] = [];
  let i = 0;
  while (i < text.length) {
    if (/\s/.test(text[i])) {
      i++;
      continue;
    }
    let j = i;
    while (j < text.length && !/\s/.test(text[j])) j++;
    const run = { start: cols[i], end: cols[j] };
    const prev = segs[segs.length - 1];
    if (prev && run.start - prev.end < gapWidth) prev.end = run.end;
    else segs.push(run);
    i = j;
  }
  return segs;
}

/**
 * Decorations can only attach at a real character position. Given a visual
 * column x (possibly past the end of the line), find the character index to
 * anchor at and how many columns past that anchor the pet actually is.
 */
export function anchorFor(text: string, x: number, tabSize: number): { charIndex: number; offsetCols: number } {
  const cols = visualColumns(text, tabSize);
  let idx = 0;
  for (let i = 0; i < cols.length; i++) {
    if (cols[i] <= x) idx = i;
    else break;
  }
  return { charIndex: idx, offsetCols: x - cols[idx] };
}
