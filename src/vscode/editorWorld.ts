import * as vscode from 'vscode';
import { Platform, World } from '../engine/world';
import { DEFAULT_GAP_WIDTH, segmentsForText, visualColumns } from '../engine/text';

export function tabSizeOf(editor: vscode.TextEditor): number {
  const t = editor.options.tabSize;
  return typeof t === 'number' ? t : 4;
}

/** Snapshot of the editor as terrain. Cheap to build; rebuild it every frame. */
export function buildWorld(editor: vscode.TextEditor): World {
  const doc = editor.document;
  const ranges = editor.visibleRanges;
  const tabSize = tabSizeOf(editor);
  const gapWidth = Math.max(2, vscode.workspace.getConfiguration('pettingZoo').get<number>('gapWidth', DEFAULT_GAP_WIDTH));
  const first = ranges.length ? ranges[0].start.line : 0;
  const last = ranges.length ? ranges[ranges.length - 1].end.line : 0;
  const cache = new Map<number, Platform[]>();

  // Folded lines are not in any visible range, so they behave like empty air.
  const isShown = (line: number) => ranges.some((r) => line >= r.start.line && line <= r.end.line);

  return {
    firstVisibleLine: first,
    lastVisibleLine: last,
    lineCount: doc.lineCount,
    platforms(line: number): Platform[] {
      if (line < 0 || line >= doc.lineCount) return [];
      let segs = cache.get(line);
      if (segs === undefined) {
        segs = isShown(line) ? segmentsForText(doc.lineAt(line).text, tabSize, gapWidth) : [];
        cache.set(line, segs);
      }
      return segs;
    },
  };
}

export function visualColumnAt(editor: vscode.TextEditor, pos: vscode.Position): number {
  const text = editor.document.lineAt(pos.line).text;
  return visualColumns(text, tabSizeOf(editor))[Math.min(pos.character, text.length)];
}

/** Mirrors how VS Code resolves editor.lineHeight into pixels. */
export function lineHeightPx(editor: vscode.TextEditor): number {
  const cfg = vscode.workspace.getConfiguration('editor', editor.document);
  const fontSize = cfg.get<number>('fontSize', 14);
  const lh = cfg.get<number>('lineHeight', 0);
  if (lh === 0) return Math.round((process.platform === 'darwin' ? 1.5 : 1.35) * fontSize);
  if (lh < 8) return Math.round(lh * fontSize);
  return lh;
}
