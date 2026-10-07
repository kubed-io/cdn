import { Window } from 'happy-dom';
import { describe, expect, it } from 'vitest';

import { applyTheme, followTheme, type ThemeLike } from '../../src/kd';

// The public contract, written out independently of theme.ts so a rename there
// fails here.
const CONTRACT = {
  '--kd-bg': '#bg',
  '--kd-bg-2': '#bg2',
  '--kd-canvas': '#canvas',
  '--kd-text': '#text',
  '--kd-text-2': '#text2',
  '--kd-text-dim': '#dim',
  '--kd-link': '#link',
  '--kd-border': '#weak',
  '--kd-border-strong': '#medium',
  '--kd-primary': '#primary',
  '--kd-success': '#success',
  '--kd-warning': '#warning',
  '--kd-error': '#error',
  '--kd-info': '#info',
  '--kd-font': 'Inter, sans-serif',
  '--kd-font-mono': 'Roboto Mono, monospace',
  '--kd-radius': '6px',
  '--kd-space': '8px',
};

function fakeTheme({ isDark = true } = {}): any {
  return {
    isDark,
    isLight: !isDark,
    colors: {
      background: { primary: '#bg', secondary: '#bg2', canvas: '#canvas' },
      text: { primary: '#text', secondary: '#text2', disabled: '#dim', link: '#link' },
      border: { weak: '#weak', medium: '#medium', strong: '#strong' },
      primary: { main: '#primary' },
      success: { main: '#success' },
      warning: { main: '#warning' },
      error: { main: '#error' },
      info: { main: '#info' },
    },
    typography: { fontFamily: 'Inter, sans-serif', fontFamilyMonospace: 'Roboto Mono, monospace' },
    shape: { radius: { default: '6px' } },
    spacing: (n = 1) => `${n * 8}px`,
  };
}

function properties(el: HTMLElement): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < el.style.length; i++) {
    const name = el.style.item(i);
    out[name] = el.style.getPropertyValue(name);
  }
  return out;
}

describe('applyTheme', () => {
  it('sets every contract property from the theme', () => {
    const el = document.createElement('div');
    applyTheme(el, fakeTheme());
    expect(properties(el)).toEqual(CONTRACT);
  });

  it('sets data-theme from isDark', () => {
    const dark = document.createElement('div');
    applyTheme(dark, fakeTheme({ isDark: true }));
    expect(dark.getAttribute('data-theme')).toBe('dark');

    const light = document.createElement('div');
    applyTheme(light, fakeTheme({ isDark: false }));
    expect(light.getAttribute('data-theme')).toBe('light');
  });

  it('is idempotent', () => {
    const el = document.createElement('div');
    applyTheme(el, fakeTheme());
    const once = el.outerHTML;
    applyTheme(el, fakeTheme());
    applyTheme(el, fakeTheme());
    expect(el.outerHTML).toBe(once);
  });

  it('follows a theme switch', () => {
    const el = document.createElement('div');
    applyTheme(el, fakeTheme({ isDark: true }));
    const light = fakeTheme({ isDark: false });
    light.colors.background.primary = '#fff';
    applyTheme(el, light);
    expect(el.getAttribute('data-theme')).toBe('light');
    expect(el.style.getPropertyValue('--kd-bg')).toBe('#fff');
  });

  it('skips missing fields without throwing', () => {
    const theme = fakeTheme();
    delete theme.colors.background;
    delete theme.shape;
    theme.colors.info = null;
    theme.spacing = undefined;
    theme.typography.fontFamilyMonospace = { not: 'a string' };
    const el = document.createElement('div');
    expect(() => applyTheme(el, theme)).not.toThrow();
    const set = properties(el);
    for (const name of ['--kd-bg', '--kd-bg-2', '--kd-canvas', '--kd-radius', '--kd-info', '--kd-space', '--kd-font-mono']) {
      expect(set, `${name} should be skipped`).not.toHaveProperty(name);
    }
    expect(set['--kd-text']).toBe('#text');
    expect(el.getAttribute('data-theme')).toBe('dark');
  });

  it('survives an empty theme, a missing theme and a missing element', () => {
    const el = document.createElement('div');
    expect(() => applyTheme(el, {})).not.toThrow();
    expect(el.style.length).toBe(0);
    expect(el.hasAttribute('data-theme')).toBe(false);
    expect(() => applyTheme(el, undefined)).not.toThrow();
    expect(() => applyTheme(null, fakeTheme())).not.toThrow();
  });
});

// A page with Grafana's SystemJS and a runtime whose event bus can be fired.
function grafanaPage(theme: ThemeLike) {
  const win = new Window();
  const handlers = new Set<(event: { payload?: ThemeLike }) => void>();
  const ThemeChangedEvent = class {};
  const rt = {
    config: { theme2: theme },
    ThemeChangedEvent,
    getAppEvents: () => ({
      subscribe(event: unknown, handler: (event: { payload?: ThemeLike }) => void) {
        expect(event).toBe(ThemeChangedEvent);
        handlers.add(handler);
        return { unsubscribe: () => handlers.delete(handler) };
      },
    }),
  };
  let imports = 0;
  Object.assign(win, {
    System: {
      import: async (id: string) => {
        imports++;
        if (id !== '@grafana/runtime') throw new Error(`unexpected import ${id}`);
        return rt;
      },
    },
  });
  const switchTo = (next: ThemeLike) => {
    rt.config.theme2 = next;
    for (const h of handlers) h({ payload: next });
  };
  return {
    element: () => win.document.createElement('div') as unknown as HTMLElement,
    switchTo,
    handlers,
    imports: () => imports,
  };
}

describe('followTheme', () => {
  it('themes an element from the live config', async () => {
    const page = grafanaPage(fakeTheme({ isDark: true }));
    const el = page.element();
    await followTheme(el);
    expect(properties(el)).toEqual(CONTRACT);
    expect(el.getAttribute('data-theme')).toBe('dark');
  });

  it('follows a live theme switch until stopped', async () => {
    const page = grafanaPage(fakeTheme({ isDark: true }));
    const el = page.element();
    const stop = await followTheme(el);

    const light = fakeTheme({ isDark: false });
    light.colors.background.primary = '#fff';
    page.switchTo(light);
    expect(el.getAttribute('data-theme')).toBe('light');
    expect(el.style.getPropertyValue('--kd-bg')).toBe('#fff');

    stop();
    expect(page.handlers.size).toBe(0);
    page.switchTo(fakeTheme({ isDark: true }));
    expect(el.getAttribute('data-theme')).toBe('light');
  });

  it('imports the runtime once per page', async () => {
    const page = grafanaPage(fakeTheme());
    await Promise.all([followTheme(page.element()), followTheme(page.element()), followTheme(page.element())]);
    expect(page.imports()).toBe(1);
  });

  it('is a no-op outside Grafana', async () => {
    const el = new Window().document.createElement('div') as unknown as HTMLElement;
    const stop = await followTheme(el);
    expect(el.style.length).toBe(0);
    expect(() => stop()).not.toThrow();
  });

  it('is a no-op when the runtime cannot be imported', async () => {
    const win = new Window();
    Object.assign(win, { System: { import: () => Promise.reject(new Error('no such module')) } });
    const el = win.document.createElement('div') as unknown as HTMLElement;
    await expect(followTheme(el)).resolves.toBeTypeOf('function');
    expect(el.style.length).toBe(0);
  });
});
