import * as vscode from 'vscode';
import { Pet, PetKind, PET_KINDS } from '../engine/pet';
import { buildWorld, visualColumnAt } from './editorWorld';
import { PetRenderer } from './renderer';

interface SavedPet {
  kind: PetKind;
  name: string;
}

const STATE_KEY = 'pettingZoo.pets';
const INIT_KEY = 'pettingZoo.initialized';
const NAMES = ['Pixel', 'Byte', 'Mochi', 'Nibble', 'Tofu', 'Bit', 'Ziggy', 'Pip', 'Sprocket', 'Dot', 'Kernel', 'Lint'];
const CATALOG: Record<PetKind, { icon: string; label: string; description: string }> = {
  cat: { icon: '🐱', label: 'Orange Cat', description: 'Curious and hoppy, naps a lot' },
  graycat: { icon: '🐈', label: 'Gray Cat', description: 'Calm, little white socks, the sleepiest cat' },
  shiba: { icon: '🐕', label: 'Shiba Inu', description: 'Zoomies! Fast and full of energy' },
  puppy: { icon: '🐶', label: 'Puppy', description: 'Floppy ears, happy to follow you around' },
  golden: { icon: '🦮', label: 'Golden Retriever', description: 'Big friendly goofball, loves everyone' },
  corgi: { icon: '🐕', label: 'Corgi', description: 'Tiny legs, huge ears, endless enthusiasm' },
  bunny: { icon: '🐰', label: 'Bunny', description: 'Hops everywhere, loves a gentle pat' },
  chicken: { icon: '🐔', label: 'Chicken', description: 'Busy and chatty, always on the move' },
  duckling: { icon: '🐥', label: 'Duckling', description: 'Slow waddler, takes cozy naps' },
  mushroom: { icon: '🍄', label: 'Mushroom', description: 'Tiny and sleepy, hops slowly' },
  guineapig: { icon: '🐹', label: 'Guinea Pig', description: 'Round, slow and sleepy, adores being petted' },
  mouse: { icon: '🐭', label: 'Mouse', description: 'Quick and nervous, scurries off when you click it' },
  slime: { icon: '🟢', label: 'Slime', description: 'Bouncy and slow, loves to hop up' },
  bug: { icon: '🐞', label: 'Bug', description: 'Scuttles around, skitters off when you click it' },
  roach: { icon: '🪳', label: 'Roach', description: 'Very fast, never sleeps, scatters at the slightest touch' },
};

export class PetManager implements vscode.Disposable {
  private pets: Pet[] = [];
  private nextId = 1;
  private editor: vscode.TextEditor | undefined;
  private timer: NodeJS.Timeout | undefined;
  private lastTick = Date.now();
  private paused = false;
  /**
   * Where the text cursor landed when you clicked a pet to pet it. Clicking
   * isn't typing, so that cursor shouldn't chase the pet away. Cleared as soon
   * as you type, select, or move the cursor anywhere else.
   */
  private pettingCursor: vscode.Position | undefined;
  private readonly renderer = new PetRenderer();
  private readonly disposables: vscode.Disposable[] = [];

  constructor(private readonly context: vscode.ExtensionContext) {}

  start(): void {
    this.restore();
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument((e) => this.onEdit(e)),
      vscode.window.onDidChangeTextEditorSelection((e) => this.onSelection(e)),
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('pettingZoo.fps')) this.restartLoop();
      }),
      vscode.window.onDidChangeWindowState(() => (this.lastTick = Date.now())),
    );
    this.restartLoop();
  }

  // ---------------------------------------------------------------- loop

  private restartLoop(): void {
    if (this.timer) clearInterval(this.timer);
    const fps = Math.min(30, Math.max(5, this.config().get<number>('fps', 15)));
    this.lastTick = Date.now();
    this.timer = setInterval(() => this.tick(), 1000 / fps);
  }

  private tick(): void {
    const now = Date.now();
    const dt = (now - this.lastTick) / 1000;
    this.lastTick = now;

    const editor = this.pickEditor();
    if (editor !== this.editor) {
      if (this.editor) this.renderer.clear(this.editor);
      this.pettingCursor = undefined;
      this.editor = editor;
      // Pets follow you to the new editor by dropping in from the top.
      if (editor) {
        const world = buildWorld(editor, this.pettingCursor);
        this.pets.forEach((p) => p.enterFromTop(world));
      }
    }
    if (!editor || this.paused || this.pets.length === 0) {
      if (editor) this.renderer.clear(editor);
      return;
    }
    if (!vscode.window.state.focused) return; // freeze in place, save CPU

    const world = buildWorld(editor, this.pettingCursor);
    for (const pet of this.pets) pet.step(dt, world);
    this.renderer.render(editor, this.pets, this.config().get<number>('scale', 0));
  }

  /** The active editor, or the last one we used if focus moved to e.g. the terminal. */
  private pickEditor(): vscode.TextEditor | undefined {
    const usable = (e: vscode.TextEditor | undefined) => e && e.document.uri.scheme !== 'output' && e.document.uri.scheme !== 'debug';
    const active = vscode.window.activeTextEditor;
    if (usable(active)) return active;
    if (this.editor && vscode.window.visibleTextEditors.includes(this.editor)) return this.editor;
    return undefined;
  }

  // ---------------------------------------------------------------- events

  private onEdit(e: vscode.TextDocumentChangeEvent): void {
    if (!this.editor || e.document !== this.editor.document) return;
    if (e.contentChanges.length) this.pettingCursor = undefined; // typing: now pets should move
    for (const change of e.contentChanges) {
      const added = (change.text.match(/\n/g)?.length ?? 0) - (change.range.end.line - change.range.start.line);
      if (added !== 0) this.pets.forEach((p) => p.shiftLines(change.range.end.line, added));
    }
  }

  private reactionsOn(): boolean {
    return this.config().get<boolean>('reactions', true);
  }

  /**
   * Is (line, col) on the pet? A pet stands on line `feet` and its body is
   * drawn over the one or two rows above, so count those too.
   */
  private hits(pet: Pet, line: number, col: number, radius = 2): boolean {
    const feet = Math.round(pet.y);
    return line >= feet - 2 && line <= feet && Math.abs(col - pet.x) <= radius;
  }

  /**
   * Clicking a pet pets it (bugs and the mouse scurry off instead); moving the
   * text cursor into one makes it hop out of the way.
   */
  private onSelection(e: vscode.TextEditorSelectionChangeEvent): void {
    if (e.textEditor !== this.editor) return;
    // Any cursor move away from where you petted ends the "just petting" grace.
    if (this.pettingCursor) {
      const only = e.selections.length === 1 ? e.selections[0] : undefined;
      if (!only || !only.isEmpty || !only.active.isEqual(this.pettingCursor)) this.pettingCursor = undefined;
    }
    if (!this.reactionsOn()) return;
    if (e.kind === vscode.TextEditorSelectionChangeKind.Command) return;
    const sel = e.selections[0];
    const pos = sel.active;
    const col = visualColumnAt(e.textEditor, pos);

    if (e.kind === vscode.TextEditorSelectionChangeKind.Mouse) {
      if (!sel.isEmpty) return; // dragging a selection isn't a click
      const clicked = this.pets.find((p) => !p.airborne && this.hits(p, pos.line, col));
      if (clicked) {
        this.pettingCursor = pos;
        clicked.pet(col);
      }
      return;
    }

    for (const pet of this.pets) {
      if (pet.airborne) continue;
      const feet = Math.round(pet.y);
      const { fearRadius, fearLines } = pet.traits;
      const nearLine = pos.line >= feet - 1 - fearLines && pos.line <= feet + fearLines;
      if (nearLine && Math.abs(col - pet.x) <= fearRadius) pet.startle(col);
    }
  }


  // ---------------------------------------------------------------- commands

  async spawnInteractive(): Promise<void> {
    const pick = await vscode.window.showQuickPick(
      PET_KINDS.map((kind) => ({ label: `${CATALOG[kind].icon} ${CATALOG[kind].label}`, description: CATALOG[kind].description, petKind: kind })),
      { placeHolder: 'Which pet?' },
    );
    if (!pick) return;
    const name = await vscode.window.showInputBox({ prompt: 'Name your pet', value: this.randomName() });
    if (name === undefined) return;
    this.spawn(pick.petKind, name.trim() || this.randomName());
    this.save();
  }

  async removeInteractive(): Promise<void> {
    if (this.pets.length === 0) {
      vscode.window.showInformationMessage('No pets to remove.');
      return;
    }
    const pick = await vscode.window.showQuickPick(
      this.pets.map((p) => ({ label: `${CATALOG[p.kind].icon} ${p.name}`, description: CATALOG[p.kind].label, pet: p })),
      { placeHolder: 'Which pet should go home?' },
    );
    if (!pick) return;
    this.pets = this.pets.filter((p) => p !== pick.pet);
    this.save();
  }

  removeAll(): void {
    this.pets = [];
    if (this.editor) this.renderer.clear(this.editor);
    this.save();
  }

  callHere(): void {
    const editor = this.editor;
    if (!editor) return;
    const pos = editor.selection.active;
    const world = buildWorld(editor, this.pettingCursor);
    if (world.platforms(pos.line).length === 0) {
      vscode.window.showInformationMessage('Put your cursor on a line with some code for your pets to land on.');
      return;
    }
    const col = visualColumnAt(editor, pos);
    this.pets.forEach((p, i) => p.callTo(pos.line, col + (i - (this.pets.length - 1) / 2) * 2, world));
  }

  togglePause(): void {
    this.paused = !this.paused;
    vscode.window.setStatusBarMessage(this.paused ? 'Petting Zoo paused' : 'Petting Zoo resumed', 2000);
  }

  // ---------------------------------------------------------------- state

  private spawn(kind: PetKind, name: string): Pet {
    const pet = new Pet(this.nextId++, kind, name, 4 + Math.random() * 20, 0);
    if (this.editor) pet.enterFromTop(buildWorld(this.editor, this.pettingCursor));
    this.pets.push(pet);
    return pet;
  }

  private restore(): void {
    const saved = this.context.globalState.get<SavedPet[]>(STATE_KEY, []);
    saved.filter((s) => PET_KINDS.includes(s.kind)).forEach((s) => this.spawn(s.kind, s.name));
    if (!this.context.globalState.get<boolean>(INIT_KEY)) {
      this.context.globalState.update(INIT_KEY, true);
      if (this.pets.length === 0) {
        this.spawn(this.config().get<PetKind>('defaultPet', 'cat'), this.randomName());
        this.save();
      }
    }
  }

  private save(): void {
    const data: SavedPet[] = this.pets.map((p) => ({ kind: p.kind, name: p.name }));
    this.context.globalState.update(STATE_KEY, data);
  }

  private randomName(): string {
    const used = new Set(this.pets.map((p) => p.name));
    const free = NAMES.filter((n) => !used.has(n));
    const pool = free.length ? free : NAMES;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  private config(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration('pettingZoo');
  }

  dispose(): void {
    if (this.timer) clearInterval(this.timer);
    if (this.editor) this.renderer.clear(this.editor);
    this.renderer.dispose();
    this.disposables.forEach((d) => d.dispose());
  }
}
