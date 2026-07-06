/**
 * Command core: undoable command interface, the History (undo/redo) stack
 * with transactions and time-window coalescing, and a ready-made
 * TypingCommand that merges consecutive typing into one undo step.
 */

export interface Command {
  label: string;
  execute(): void;
  undo(): void;
  /** Optional merge for coalescing: absorb `next` into this command. */
  tryMerge?(next: Command): boolean;
}

export interface HistoryOptions {
  /** Injectable clock (ms) for coalescing-window testability. */
  now?: () => number;
}

/** Groups several commands into a single undo step. */
export class CompositeCommand implements Command {
  constructor(
    public label: string,
    private readonly commands: Command[],
  ) {}

  execute(): void {
    for (const cmd of this.commands) cmd.execute();
  }

  undo(): void {
    for (let i = this.commands.length - 1; i >= 0; i--) this.commands[i].undo();
  }

  get size(): number {
    return this.commands.length;
  }
}

interface UndoEntry {
  cmd: Command;
  /** Timestamp of the last execute/merge, for the coalescing window. */
  time: number;
}

/** Coalescing window in milliseconds. */
export const MERGE_WINDOW_MS = 1000;

export class History {
  private undoStack: UndoEntry[] = [];
  private redoStack: Command[] = [];
  private readonly capacity: number;
  private readonly now: () => number;
  private readonly listeners = new Set<() => void>();

  private txDepth = 0;
  private txLabel = '';
  private txBuffer: Command[] = [];

  constructor(capacity = 100, options: HistoryOptions = {}) {
    this.capacity = Math.max(1, capacity);
    this.now = options.now ?? Date.now;
  }

  /** Execute the command and push it onto the undo stack (clearing redo). */
  run(cmd: Command): void {
    cmd.execute();

    if (this.txDepth > 0) {
      this.txBuffer.push(cmd);
      this.emit();
      return;
    }

    this.redoStack = [];
    const time = this.now();
    const top = this.undoStack[this.undoStack.length - 1];
    if (top && time - top.time <= MERGE_WINDOW_MS && top.cmd.tryMerge?.(cmd)) {
      top.time = time;
    } else {
      this.push(cmd, time);
    }
    this.emit();
  }

  undo(): void {
    if (this.txDepth > 0 || this.undoStack.length === 0) return;
    const entry = this.undoStack.pop()!;
    entry.cmd.undo();
    this.redoStack.push(entry.cmd);
    this.emit();
  }

  redo(): void {
    if (this.txDepth > 0 || this.redoStack.length === 0) return;
    const cmd = this.redoStack.pop()!;
    cmd.execute();
    // A redone command should not coalesce with later live edits.
    this.push(cmd, Number.NEGATIVE_INFINITY);
    this.emit();
  }

  get canUndo(): boolean {
    return this.txDepth === 0 && this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.txDepth === 0 && this.redoStack.length > 0;
  }

  get undoLabel(): string | null {
    const top = this.undoStack[this.undoStack.length - 1];
    return top ? top.cmd.label : null;
  }

  get redoLabel(): string | null {
    const top = this.redoStack[this.redoStack.length - 1];
    return top ? top.cmd.label : null;
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.txDepth = 0;
    this.txBuffer = [];
    this.emit();
  }

  /** Subscribe to changes; fired after any run/undo/redo. Returns unsubscribe. */
  onChange(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  // --- Transactions ---------------------------------------------------------

  /**
   * Group all commands run until the matching endTransaction() into ONE undo
   * step. Nested begin/end pairs are allowed; only the outermost end closes
   * the group.
   */
  beginTransaction(label: string): void {
    if (this.txDepth === 0) {
      this.txLabel = label;
      this.txBuffer = [];
    }
    this.txDepth++;
  }

  endTransaction(): void {
    if (this.txDepth === 0) return;
    this.txDepth--;
    if (this.txDepth > 0) return;

    const commands = this.txBuffer;
    this.txBuffer = [];
    if (commands.length === 0) return;

    this.redoStack = [];
    this.push(new CompositeCommand(this.txLabel, commands), this.now());
    this.emit();
  }

  /** Abort the open transaction, undoing its partial work immediately. */
  cancelTransaction(): void {
    if (this.txDepth === 0) return;
    for (let i = this.txBuffer.length - 1; i >= 0; i--) this.txBuffer[i].undo();
    this.txBuffer = [];
    this.txDepth = 0;
    this.emit();
  }

  get inTransaction(): boolean {
    return this.txDepth > 0;
  }

  /** Run `fn` inside a transaction; cancels (rolls back) if it throws. */
  transact(label: string, fn: () => void): void {
    this.beginTransaction(label);
    try {
      fn();
    } catch (err) {
      this.cancelTransaction();
      throw err;
    }
    this.endTransaction();
  }

  // --- internal -------------------------------------------------------------

  private push(cmd: Command, time: number): void {
    this.undoStack.push({ cmd, time });
    if (this.undoStack.length > this.capacity) this.undoStack.shift();
  }

  private emit(): void {
    for (const cb of this.listeners) cb();
  }
}

/**
 * A text-replacement command that coalesces consecutive typing into a single
 * undo step (when run through a History within the merge window).
 */
export class TypingCommand implements Command {
  label = 'Typing';

  constructor(
    private readonly getText: () => string,
    private readonly setText: (text: string) => void,
    private before: string,
    private after: string,
  ) {}

  execute(): void {
    this.setText(this.after);
  }

  undo(): void {
    this.setText(this.before);
  }

  tryMerge(next: Command): boolean {
    if (!(next instanceof TypingCommand)) return false;
    // Only merge if the edits chain contiguously and nothing external changed the text.
    if (next.before !== this.after) return false;
    if (this.getText() !== next.after) return false;
    this.after = next.after;
    return true;
  }
}
