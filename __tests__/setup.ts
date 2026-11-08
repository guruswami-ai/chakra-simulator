import '@testing-library/jest-dom/vitest';

// Mock HTMLMediaElement (Audio/Video) — no real playback in tests
const mockPlay = vi.fn().mockResolvedValue(undefined);
const mockPause = vi.fn();
const mockLoad = vi.fn();

Object.defineProperty(globalThis, 'HTMLMediaElement', {
  writable: true,
  value: class MockHTMLMediaElement {
    src = '';
    currentTime = 0;
    duration = 0;
    paused = true;
    volume = 1;
    muted = false;
    playbackRate = 1;
    private listeners: Record<string, Function[]> = {};

    play = mockPlay;
    pause = mockPause;
    load = mockLoad;

    addEventListener(event: string, cb: Function) {
      if (!this.listeners[event]) this.listeners[event] = [];
      this.listeners[event].push(cb);
    }
    removeEventListener(event: string, cb: Function) {
      if (this.listeners[event]) {
        this.listeners[event] = this.listeners[event].filter(fn => fn !== cb);
      }
    }
    dispatchEvent(event: Event) {
      const cbs = this.listeners[event.type] || [];
      cbs.forEach(cb => cb(event));
      return true;
    }
  },
});

// Mock Audio constructor
globalThis.Audio = vi.fn().mockImplementation(() => {
  return new (globalThis.HTMLMediaElement as any)();
}) as any;

// Clean localStorage between tests (happy-dom provides localStorage)
beforeEach(() => {
  if (typeof localStorage !== 'undefined') {
    if (typeof localStorage.clear === 'function') {
      localStorage.clear();
    } else {
      // Fallback: remove items manually
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) keys.push(key);
      }
      keys.forEach(k => localStorage.removeItem(k));
    }
  }
});
