import { describe, it, expect } from 'vitest';
import { History, TypingCommand, CompositeCommand } from '../../src/commands';
import type { Command } from '../../src/commands';

/** A command that appends/removes a value on a shared log array. */
function pushCmd(log: number[], value: number, label = `push ${value}`): Command {
  return {
    label,
    execute: () => {
      log.push(value);
    },
    undo: () => {
      log.pop();
    },
  };
}

describe('History: run/undo/redo', () => {
  it('executes commands and undoes/redoes in order', () => {
    const log: number[] = [];
    const h = new History();
    h.run(pushCmd(log, 1));
    h.run(pushCmd(log, 2));
    h.run(pushCmd(log, 3));
    expect(log).toEqual([1, 2, 3]);

    h.undo();
    expect(log).toEqual([1, 2]);
    h.undo();
    expect(log).toEqual([1]);
    h.redo();
    expect(log).toEqual([1, 2]);
    h.redo();
    expect(log).toEqual([1, 2, 3]);
  });

  it('tracks canUndo/canRedo state transitions', () => {
    const log: number[] = [];
    const h = new History();
    expect(h.canUndo).toBe(false);
    expect(h.canRedo).toBe(false);

    h.run(pushCmd(log, 1));
    expect(h.canUndo).toBe(true);
    expect(h.canRedo).toBe(false);

    h.undo();
    expect(h.canUndo).toBe(false);
    expect(h.canRedo).toBe(true);

    h.redo();
    expect(h.canUndo).toBe(true);
    expect(h.canRedo).toBe(false);
  });

  it('clears the redo stack when a new command runs', () => {
    const log: number[] = [];
    const h = new History();
    h.run(pushCmd(log, 1));
    h.run(pushCmd(log, 2));
    h.undo();
    expect(h.canRedo).toBe(true);

    h.run(pushCmd(log, 9));
    expect(h.canRedo).toBe(false);
    expect(log).toEqual([1, 9]);
    h.redo(); // no-op
    expect(log).toEqual([1, 9]);
  });

  it('exposes undoLabel/redoLabel and null when empty', () => {
    const log: number[] = [];
    const h = new History();
    expect(h.undoLabel).toBeNull();
    expect(h.redoLabel).toBeNull();

    h.run(pushCmd(log, 1, 'First'));
    h.run(pushCmd(log, 2, 'Second'));
    expect(h.undoLabel).toBe('Second');

    h.undo();
    expect(h.undoLabel).toBe('First');
    expect(h.redoLabel).toBe('Second');
  });

  it('is a no-op to undo/redo with empty stacks', () => {
    const h = new History();
    expect(() => h.undo()).not.toThrow();
    expect(() => h.redo()).not.toThrow();
    expect(h.canUndo).toBe(false);
  });

  it('evicts the oldest entries beyond capacity', () => {
    const log: number[] = [];
    const h = new History(3);
    for (let i = 1; i <= 5; i++) h.run(pushCmd(log, i));
    expect(log).toEqual([1, 2, 3, 4, 5]);

    h.undo();
    h.undo();
    h.undo();
    // Only 3 kept; the two oldest were evicted and cannot be undone.
    expect(log).toEqual([1, 2]);
    expect(h.canUndo).toBe(false);
    h.undo();
    expect(log).toEqual([1, 2]);
  });

  it('clear() empties both stacks', () => {
    const log: number[] = [];
    const h = new History();
    h.run(pushCmd(log, 1));
    h.run(pushCmd(log, 2));
    h.undo();
    h.clear();
    expect(h.canUndo).toBe(false);
    expect(h.canRedo).toBe(false);
    expect(h.undoLabel).toBeNull();
  });
});

describe('History: onChange', () => {
  it('fires after run, undo and redo, and unsubscribes', () => {
    const log: number[] = [];
    const h = new History();
    let fired = 0;
    const off = h.onChange(() => {
      fired++;
    });

    h.run(pushCmd(log, 1));
    h.run(pushCmd(log, 2));
    expect(fired).toBe(2);

    h.undo();
    expect(fired).toBe(3);
    h.redo();
    expect(fired).toBe(4);

    // No-op undo/redo on empty stacks do not fire.
    h.redo();
    expect(fired).toBe(4);

    off();
    h.run(pushCmd(log, 3));
    expect(fired).toBe(4);
  });

  it('supports multiple subscribers', () => {
    const h = new History();
    let a = 0;
    let b = 0;
    h.onChange(() => a++);
    const offB = h.onChange(() => b++);
    h.run(pushCmd([], 1));
    expect(a).toBe(1);
    expect(b).toBe(1);
    offB();
    h.run(pushCmd([], 2));
    expect(a).toBe(2);
    expect(b).toBe(1);
  });
});

describe('History: transactions', () => {
  it('groups 3 commands into ONE undo step', () => {
    const log: number[] = [];
    const h = new History();
    h.beginTransaction('Big Edit');
    h.run(pushCmd(log, 1));
    h.run(pushCmd(log, 2));
    h.run(pushCmd(log, 3));
    h.endTransaction();

    expect(log).toEqual([1, 2, 3]);
    expect(h.undoLabel).toBe('Big Edit');

    h.undo();
    expect(log).toEqual([]);
    expect(h.canUndo).toBe(false);

    h.redo();
    expect(log).toEqual([1, 2, 3]);
    expect(h.undoLabel).toBe('Big Edit');
  });

  it('only the outermost end closes a nested transaction', () => {
    const log: number[] = [];
    const h = new History();
    h.beginTransaction('Outer');
    h.run(pushCmd(log, 1));
    h.beginTransaction('Inner');
    h.run(pushCmd(log, 2));
    h.endTransaction(); // closes inner only
    expect(h.canUndo).toBe(false); // still inside outer
    h.run(pushCmd(log, 3));
    h.endTransaction(); // closes outer

    expect(h.undoLabel).toBe('Outer');
    h.undo();
    expect(log).toEqual([]);
    h.redo();
    expect(log).toEqual([1, 2, 3]);
    h.undo();
    expect(log).toEqual([]);
    expect(h.canUndo).toBe(false);
  });

  it('cancelTransaction undoes the partial group immediately', () => {
    const log: number[] = [];
    const h = new History();
    h.run(pushCmd(log, 0));
    h.beginTransaction('Doomed');
    h.run(pushCmd(log, 1));
    h.run(pushCmd(log, 2));
    h.cancelTransaction();

    expect(log).toEqual([0]);
    expect(h.inTransaction).toBe(false);
    // Prior history untouched.
    expect(h.undoLabel).toBe('push 0');
    h.undo();
    expect(log).toEqual([]);
  });

  it('an empty transaction adds no undo step', () => {
    const h = new History();
    h.beginTransaction('Nothing');
    h.endTransaction();
    expect(h.canUndo).toBe(false);
  });

  it('undo/redo are no-ops while a transaction is open', () => {
    const log: number[] = [];
    const h = new History();
    h.run(pushCmd(log, 1));
    h.beginTransaction('Open');
    h.run(pushCmd(log, 2));
    h.undo(); // must not pop prior history mid-transaction
    expect(log).toEqual([1, 2]);
    h.endTransaction();
    h.undo();
    expect(log).toEqual([1]);
  });

  it('transact() groups and rolls back on throw', () => {
    const log: number[] = [];
    const h = new History();
    h.transact('Good', () => {
      h.run(pushCmd(log, 1));
      h.run(pushCmd(log, 2));
    });
    expect(log).toEqual([1, 2]);
    expect(h.undoLabel).toBe('Good');

    expect(() =>
      h.transact('Bad', () => {
        h.run(pushCmd(log, 3));
        throw new Error('boom');
      }),
    ).toThrow('boom');
    expect(log).toEqual([1, 2]); // rolled back
    expect(h.undoLabel).toBe('Good');
  });
});

describe('History: coalescing & TypingCommand', () => {
  function typingSetup() {
    let t = 0;
    const clock = { now: () => t, advance: (ms: number) => (t += ms) };
    const state = { text: '' };
    const getText = () => state.text;
    const setText = (v: string) => {
      state.text = v;
    };
    const h = new History(100, { now: clock.now });
    return { h, state, getText, setText, clock };
  }

  it('merges consecutive typing within the window into one undo step', () => {
    const { h, state, getText, setText, clock } = typingSetup();
    h.run(new TypingCommand(getText, setText, '', 'h'));
    clock.advance(300);
    h.run(new TypingCommand(getText, setText, 'h', 'he'));
    clock.advance(300);
    h.run(new TypingCommand(getText, setText, 'he', 'hey'));
    expect(state.text).toBe('hey');

    h.undo();
    expect(state.text).toBe('');
    expect(h.canUndo).toBe(false);

    h.redo();
    expect(state.text).toBe('hey');
  });

  it('does NOT merge beyond the 1000ms window', () => {
    const { h, state, getText, setText, clock } = typingSetup();
    h.run(new TypingCommand(getText, setText, '', 'hi'));
    clock.advance(1500);
    h.run(new TypingCommand(getText, setText, 'hi', 'hi there'));
    expect(state.text).toBe('hi there');

    h.undo();
    expect(state.text).toBe('hi');
    h.undo();
    expect(state.text).toBe('');
  });

  it('merges exactly at the window boundary but not past it', () => {
    const { h, state, getText, setText, clock } = typingSetup();
    h.run(new TypingCommand(getText, setText, '', 'a'));
    clock.advance(1000);
    h.run(new TypingCommand(getText, setText, 'a', 'ab'));
    h.undo();
    expect(state.text).toBe('');
    expect(h.canUndo).toBe(false);

    h.redo();
    clock.advance(1001);
    h.run(new TypingCommand(getText, setText, 'ab', 'abc'));
    h.undo();
    expect(state.text).toBe('ab');
  });

  it('a merged run keeps extending the window from the last keystroke', () => {
    const { h, state, getText, setText, clock } = typingSetup();
    h.run(new TypingCommand(getText, setText, '', 'a'));
    clock.advance(800);
    h.run(new TypingCommand(getText, setText, 'a', 'ab'));
    clock.advance(800); // 1600ms since first, but only 800 since last merge
    h.run(new TypingCommand(getText, setText, 'ab', 'abc'));
    h.undo();
    expect(state.text).toBe('');
    expect(h.canUndo).toBe(false);
  });

  it('does not merge non-contiguous typing edits', () => {
    const { h, state, getText, setText } = typingSetup();
    h.run(new TypingCommand(getText, setText, '', 'a'));
    // A gap: before 'x' does not chain from 'a'.
    h.run(new TypingCommand(getText, setText, 'x', 'xy'));
    expect(state.text).toBe('xy');
    h.undo();
    expect(state.text).toBe('x');
    h.undo();
    expect(state.text).toBe('');
  });

  it('does not merge across an undo (redo entries do not coalesce)', () => {
    const { h, state, getText, setText } = typingSetup();
    h.run(new TypingCommand(getText, setText, '', 'a'));
    h.undo();
    h.redo();
    h.run(new TypingCommand(getText, setText, 'a', 'ab'));
    h.undo();
    expect(state.text).toBe('a');
    expect(h.canUndo).toBe(true);
  });

  it('honors a custom tryMerge on arbitrary commands', () => {
    let value = 0;
    const setCmd = (to: number): Command => {
      let from = 0;
      const cmd: Command & { to: number } = {
        label: 'set',
        to,
        execute() {
          from = value;
          value = this.to;
        },
        undo() {
          value = from;
        },
        tryMerge(next: Command) {
          if ((next as typeof cmd).label !== 'set') return false;
          this.to = (next as typeof cmd).to;
          return true;
        },
      };
      return cmd;
    };
    const h = new History(100, { now: () => 0 });
    h.run(setCmd(1));
    h.run(setCmd(2));
    h.run(setCmd(3));
    expect(value).toBe(3);
    h.undo();
    expect(value).toBe(0);
    expect(h.canUndo).toBe(false);
  });
});

describe('CompositeCommand', () => {
  it('executes in order and undoes in reverse', () => {
    const log: string[] = [];
    const mk = (name: string): Command => ({
      label: name,
      execute: () => log.push(`+${name}`),
      undo: () => log.push(`-${name}`),
    });
    const composite = new CompositeCommand('Both', [mk('a'), mk('b')]);
    composite.execute();
    composite.undo();
    expect(log).toEqual(['+a', '+b', '-b', '-a']);
    expect(composite.label).toBe('Both');
    expect(composite.size).toBe(2);
  });
});
