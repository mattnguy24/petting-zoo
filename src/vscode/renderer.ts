import * as vscode from 'vscode';
import { Pet } from '../engine/pet';
import { SPRITE_H, SPRITE_W, spriteDataUri } from '../sprites/sprites';
import { lineHeightPx } from './editorWorld';

/**
 * Draws pets with text-editor decorations.
 *
 * VS Code pastes a decoration's `textDecoration` value straight into a CSS
 * rule, so a value like "none; position: absolute; ..." lets us style the
 * decoration's ::before pseudo-element freely. Each pet becomes an
 * absolutely positioned, zero-width box anchored at a character in the line
 * its feet are on, then nudged with `ch` (columns) and px (sub-line falls).
 */
export class PetRenderer implements vscode.Disposable {
  private readonly type = vscode.window.createTextEditorDecorationType({
    rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
  });
  private lastKey = '';
  private lastEditor: vscode.TextEditor | undefined;

  render(editor: vscode.TextEditor, pets: Pet[], scaleSetting: number): void {
    const doc = editor.document;
    const lh = lineHeightPx(editor);
    const scale = scaleSetting > 0 ? scaleSetting : Math.max(1, Math.round((lh * 1.7) / SPRITE_H));
    const w = SPRITE_W * scale;
    const h = SPRITE_H * scale;

    const options: vscode.DecorationOptions[] = [];
    for (const pet of pets) {
      if (pet.hidden) continue;
      const line = Math.floor(pet.y);
      if (line < 0 || line >= doc.lineCount) continue;

      // pet.bob lifts the sprite for hops that don't move the pet off its line.
      const dy = Math.round((pet.y - line - pet.bob) * lh);
      // Position from the start of the line (the .view-line box) in columns.
      // Don't rely on the box's "static" inline position: an absolutely
      // positioned block snaps to the line start, which pinned every pet to
      // column 0.
      const xCols = Math.round(pet.x * 10) / 10;
      const flip = pet.facing < 0 ? ' scaleX(-1)' : '';
      const uri = spriteDataUri(pet.kind, pet.frame());

      const before: vscode.ThemableDecorationAttachmentRenderOptions = {
        contentText: '',
        textDecoration: css({
          position: 'absolute',
          top: '0',
          left: `calc(${xCols}ch - ${w / 2}px)`,
          'z-index': '5',
          'pointer-events': 'none',
          display: 'block',
          width: `${w}px`,
          height: `${h}px`,
          background: `url(${uri}) no-repeat center / 100% 100%`,
          transform: `translateY(calc(${dy}px - 100%))${flip}`,
        }),
      };

      // Small, quiet bubble just above the head: z z z asleep, ! spooked, ♥ petted, ♪ content.
      let after: vscode.ThemableDecorationAttachmentRenderOptions | undefined;
      const emote = pet.emote;
      if (emote) {
        after = {
          contentText: emote,
          textDecoration: css({
            position: 'absolute',
            top: '0',
            left: `calc(${xCols}ch + ${Math.round(w * 0.12)}px)`,
            'z-index': '6',
            'pointer-events': 'none',
            'white-space': 'pre',
            // Keep the editor's font size: `left` is in `ch`, and `ch` scales
            // with font size, so changing the font would push the bubble
            // sideways (more the further right the pet is). Resize with scale().
            'line-height': '1',
            color: EMOTE_COLORS[emote[0]] ?? '#8ea0c4',
            opacity: '0.75',
            'transform-origin': 'left bottom',
            transform: `translateY(calc(${dy}px - ${h + Math.round(lh * 0.3)}px)) scale(0.75)`,
          }),
        };
      }

      // Any spot on the line works as an anchor now; column 0 always exists, even on blank lines.
      const pos = new vscode.Position(line, 0);
      options.push({ range: new vscode.Range(pos, pos), renderOptions: { before, after } });
    }

    // Skip the update entirely when nothing visible changed (idle pets).
    const key = JSON.stringify(options.map((o) => [o.range.start.line, o.range.start.character, o.renderOptions]));
    if (key === this.lastKey && editor === this.lastEditor) return;
    this.lastKey = key;
    this.lastEditor = editor;
    editor.setDecorations(this.type, options);
  }

  clear(editor: vscode.TextEditor): void {
    editor.setDecorations(this.type, []);
    this.lastKey = '';
  }

  dispose(): void {
    this.type.dispose();
  }
}

const EMOTE_COLORS: Record<string, string> = { z: '#8ea0c4', '!': '#e0b04a', '♪': '#d98aa8', '♥': '#f27a9b' };

/** First property is `text-decoration` itself, so start the string with "none". */
function css(props: Record<string, string>): string {
  return ['none', ...Object.entries(props).map(([k, v]) => `${k}: ${v}`)].join('; ');
}
