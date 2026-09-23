import { install } from '@sinonjs/fake-timers';
import type { Clock } from '@sinonjs/fake-timers';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Autosave, AutosaveFixed, realDeps } from './autosave.js';
import type { AutosaveDeps } from './autosave.js';

interface FakeServer {
  saves: string[];
  reply: (index: number) => Promise<void>;
}

function fakeServer(): { server: FakeServer; deps: AutosaveDeps } {
  const replies: (() => void)[] = [];
  const server: FakeServer = {
    saves: [],
    reply: async (index) => {
      replies[index]?.();
      await Promise.resolve();
    },
  };
  const deps: AutosaveDeps = {
    ...realDeps,
    save: async (text) => {
      server.saves.push(text);
      await new Promise<void>((resolve) => {
        replies.push(resolve);
      });
    },
  };
  return { server, deps };
}

describe.each([
  ['Autosave', (deps: AutosaveDeps): Autosave | AutosaveFixed => new Autosave(deps)],
  ['AutosaveFixed', (deps: AutosaveDeps): Autosave | AutosaveFixed => new AutosaveFixed(deps)],
])('%s with fake timers', (_name, create) => {
  let clock: Clock;

  beforeEach(() => {
    clock = install();
  });

  afterEach(() => {
    clock.uninstall();
  });

  it('saves once, 500 ms after the last keystroke', async () => {
    const { server, deps } = fakeServer();
    const editor = create(deps);
    editor.edit('Hello');
    await clock.tickAsync(300);
    editor.edit('Hello world');
    await clock.tickAsync(499);
    expect(server.saves).toEqual([]);
    await clock.tickAsync(1);
    expect(server.saves).toEqual(['Hello world']);
  });

  it('shows saved once the server replies', async () => {
    const { server, deps } = fakeServer();
    const editor = create(deps);
    editor.edit('Hello');
    await clock.tickAsync(500);
    expect(editor.status).toBe('saving');
    await server.reply(0);
    expect(editor.status).toBe('saved');
    expect(editor.savedText).toBe('Hello');
  });

  it('saves the newer text when the user types during a save', async () => {
    const { server, deps } = fakeServer();
    const editor = create(deps);
    editor.edit('Hello');
    await clock.tickAsync(500);
    editor.edit('Hello world');
    await clock.tickAsync(500);
    await server.reply(0);
    await server.reply(1);
    await clock.runAllAsync();
    expect(editor.savedText).toBe('Hello world');
    expect(editor.status).toBe('saved');
  });
});

describe('the order SpecCraft found, pinned with fake timers', () => {
  let clock: Clock;

  beforeEach(() => {
    clock = install();
  });

  afterEach(() => {
    clock.uninstall();
  });

  it('Autosave keeps the older text when the first reply lands last', async () => {
    const { server, deps } = fakeServer();
    const editor = new Autosave(deps);
    editor.edit('Hello');
    await clock.tickAsync(500);
    editor.edit('Hello world');
    await clock.tickAsync(500);
    await server.reply(1);
    await server.reply(0);
    expect(server.saves).toEqual(['Hello', 'Hello world']);
    expect(editor.savedText).toBe('Hello');
    expect(editor.status).toBe('unsaved');
    expect(clock.countTimers()).toBe(0);
  });

  it('AutosaveFixed sends one save at a time', async () => {
    const { server, deps } = fakeServer();
    const editor = new AutosaveFixed(deps);
    editor.edit('Hello');
    await clock.tickAsync(500);
    editor.edit('Hello world');
    await clock.tickAsync(500);
    expect(server.saves).toEqual(['Hello']);
    await server.reply(0);
    expect(server.saves).toEqual(['Hello', 'Hello world']);
    await server.reply(1);
    expect(editor.savedText).toBe('Hello world');
    expect(editor.status).toBe('saved');
  });
});
