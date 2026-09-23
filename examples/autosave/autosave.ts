import * as spec from '../../src/annotated.js';

export const DEBOUNCE_MS = 500;

export type SaveStatus = 'saved' | 'unsaved' | 'saving';

export interface AutosaveDeps {
  save: (text: string) => Promise<void>;
  schedule: (fire: () => void, ms: number) => () => void;
}

export const realDeps: AutosaveDeps = {
  save: async (text) => {
    const response = await fetch('/api/document', { method: 'PUT', body: text });
    if (!response.ok) {
      throw new Error(`save failed with ${String(response.status)}`);
    }
  },
  schedule: (fire, ms) => {
    const id = setTimeout(fire, ms);
    return () => {
      clearTimeout(id);
    };
  },
};

export function explorableDeps(env: spec.Environment): AutosaveDeps {
  const timer = env.channel<undefined>('timer');
  return {
    save: env.channel<undefined>('save'),
    schedule: (fire, ms) => {
      const handle = { ms };
      let cancelled = false;
      timer(handle).then(
        () => {
          if (!cancelled) {
            fire();
          }
        },
        (error: unknown) => {
          console.error(error);
        },
      );
      return () => {
        cancelled = true;
        env.deliver('timer', env.requests('timer').indexOf(handle), undefined);
      };
    },
  };
}

type Text = '' | 'Hello' | 'Hello world';

interface EditorState {
  text: Text;
  savedText: Text;
  status: SaveStatus;
  pending: { timer: readonly number[]; save: readonly Text[] };
}

const texts: readonly [Text][] = [['Hello'], ['Hello world']];

const invariants = {
  'once nothing is pending, the saved text is the current text': (s: EditorState): boolean =>
    s.pending.timer.length > 0 || s.pending.save.length > 0 || s.savedText === s.text,
};

const typed = (s: EditorState, text: Text): EditorState => ({
  ...s,
  text,
  status: 'unsaved',
  pending: { ...s.pending, timer: [DEBOUNCE_MS] },
});

function removed<T>(items: readonly T[], index: number): T[] {
  return items.filter((_, i) => i !== index);
}

@spec.Model<EditorState>({ invariants })
export class Autosave {
  @spec.State text = '';
  @spec.State savedText = '';
  @spec.State status: SaveStatus = 'saved';
  private cancelTimer: (() => void) | undefined;
  private readonly deps: AutosaveDeps;

  constructor(deps: AutosaveDeps = realDeps) {
    this.deps = deps;
  }

  @spec.Action<EditorState, [Text]>({ name: 'type', args: texts, guard: () => true, effect: typed })
  edit(text: string): void {
    this.text = text;
    this.status = 'unsaved';
    this.cancelTimer?.();
    this.cancelTimer = this.deps.schedule(() => {
      this.cancelTimer = undefined;
      this.flush();
    }, DEBOUNCE_MS);
  }

  @spec.Action<EditorState, [number]>({
    name: 'debounce fires',
    delivers: 'timer',
    requestAs: (handle: { ms: number }) => handle.ms,
    args: [[0]],
    guard: (s) => s.pending.timer.length > 0,
    effect: (s) => ({
      ...s,
      status: 'saving',
      pending: { timer: [], save: [...s.pending.save, s.text] },
    }),
  })
  flush(): void {
    const text = this.text;
    this.status = 'saving';
    this.deps.save(text).then(
      () => {
        this.onSaved(text);
      },
      (error: unknown) => {
        console.error(error);
        this.status = 'unsaved';
      },
    );
  }

  @spec.Action<EditorState, [number]>({
    name: 'save returns',
    delivers: 'save',
    maxPending: 2,
    args: [[0], [1]],
    guard: (s, index) => index < s.pending.save.length,
    effect: (s, index) => {
      const text = s.pending.save[index] ?? '';
      return {
        ...s,
        savedText: text,
        status: s.text === text ? 'saved' : 'unsaved',
        pending: { ...s.pending, save: removed(s.pending.save, index) },
      };
    },
  })
  onSaved(text: string): void {
    this.savedText = text;
    this.status = this.text === text ? 'saved' : 'unsaved';
  }
}

@spec.Model<EditorState>({ invariants })
export class AutosaveFixed {
  @spec.State text = '';
  @spec.State savedText = '';
  @spec.State status: SaveStatus = 'saved';
  private cancelTimer: (() => void) | undefined;
  private inFlight = false;
  private readonly deps: AutosaveDeps;

  constructor(deps: AutosaveDeps = realDeps) {
    this.deps = deps;
  }

  @spec.Action<EditorState, [Text]>({ name: 'type', args: texts, guard: () => true, effect: typed })
  edit(text: string): void {
    this.text = text;
    this.status = 'unsaved';
    this.cancelTimer?.();
    this.cancelTimer = this.deps.schedule(() => {
      this.cancelTimer = undefined;
      this.flush();
    }, DEBOUNCE_MS);
  }

  @spec.Action<EditorState, [number]>({
    name: 'debounce fires',
    delivers: 'timer',
    requestAs: (handle: { ms: number }) => handle.ms,
    args: [[0]],
    guard: (s) => s.pending.timer.length > 0,
    effect: (s) =>
      s.pending.save.length > 0
        ? { ...s, pending: { ...s.pending, timer: [] } }
        : { ...s, status: 'saving', pending: { timer: [], save: [s.text] } },
  })
  flush(): void {
    if (this.inFlight) {
      return;
    }
    const text = this.text;
    this.inFlight = true;
    this.status = 'saving';
    this.deps.save(text).then(
      () => {
        this.onSaved(text);
      },
      (error: unknown) => {
        console.error(error);
        this.inFlight = false;
        this.status = 'unsaved';
      },
    );
  }

  @spec.Action<EditorState, [number]>({
    name: 'save returns',
    delivers: 'save',
    args: [[0]],
    guard: (s, index) => index < s.pending.save.length,
    effect: (s, index) => {
      const text = s.pending.save[index] ?? '';
      const saved = { ...s, savedText: text, pending: { ...s.pending, save: removed(s.pending.save, index) } };
      if (s.text === text) {
        return { ...saved, status: 'saved' };
      }
      return s.pending.timer.length > 0
        ? saved
        : { ...saved, status: 'saving', pending: { ...saved.pending, save: [s.text] } };
    },
  })
  onSaved(text: string): void {
    this.inFlight = false;
    this.savedText = text;
    if (this.text === text) {
      this.status = 'saved';
    } else if (this.cancelTimer === undefined) {
      this.flush();
    }
  }
}
