import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';

import { applyTheme } from '../grafana/theme.js';

// The public contract, written out independently of theme.js so a rename there
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

function fakeTheme({ isDark = true } = {}) {
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

function fakeElement() {
  const props = new Map();
  const attrs = new Map();
  return {
    props,
    attrs,
    style: { setProperty: (name, value) => props.set(name, value) },
    setAttribute: (name, value) => attrs.set(name, String(value)),
    dataset: {},
  };
}

describe('applyTheme', () => {
  it('sets every contract property from the theme', () => {
    const el = fakeElement();
    applyTheme(el, fakeTheme());
    assert.deepEqual(Object.fromEntries(el.props), CONTRACT);
  });

  it('sets data-theme from isDark', () => {
    const dark = fakeElement();
    applyTheme(dark, fakeTheme({ isDark: true }));
    assert.equal(dark.attrs.get('data-theme'), 'dark');

    const light = fakeElement();
    applyTheme(light, fakeTheme({ isDark: false }));
    assert.equal(light.attrs.get('data-theme'), 'light');
  });

  it('is idempotent', () => {
    const el = fakeElement();
    applyTheme(el, fakeTheme());
    const props = new Map(el.props);
    const attrs = new Map(el.attrs);
    applyTheme(el, fakeTheme());
    applyTheme(el, fakeTheme());
    assert.deepEqual(el.props, props);
    assert.deepEqual(el.attrs, attrs);
  });

  it('follows a theme switch', () => {
    const el = fakeElement();
    applyTheme(el, fakeTheme({ isDark: true }));
    const light = fakeTheme({ isDark: false });
    light.colors.background.primary = '#fff';
    applyTheme(el, light);
    assert.equal(el.attrs.get('data-theme'), 'light');
    assert.equal(el.props.get('--kd-bg'), '#fff');
  });

  it('skips missing fields without throwing', () => {
    const theme = fakeTheme();
    delete theme.colors.background;
    delete theme.shape;
    theme.colors.info = null;
    theme.spacing = undefined;
    theme.typography.fontFamilyMonospace = { not: 'a string' };
    const el = fakeElement();
    assert.doesNotThrow(() => applyTheme(el, theme));
    for (const name of ['--kd-bg', '--kd-bg-2', '--kd-canvas', '--kd-radius', '--kd-info', '--kd-space', '--kd-font-mono']) {
      assert.equal(el.props.has(name), false, `${name} should be skipped`);
    }
    assert.equal(el.props.get('--kd-text'), '#text');
    assert.equal(el.attrs.get('data-theme'), 'dark');
  });

  it('survives an empty theme, a missing theme and a missing element', () => {
    const el = fakeElement();
    assert.doesNotThrow(() => applyTheme(el, {}));
    assert.equal(el.props.size, 0);
    assert.equal(el.attrs.has('data-theme'), false);
    assert.doesNotThrow(() => applyTheme(el, undefined));
    assert.doesNotThrow(() => applyTheme(null, fakeTheme()));
  });
});

describe('theme.css', async () => {
  const css = (await readFile(new URL('../grafana/theme.css', import.meta.url), 'utf8'))
    .replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selectors, body]) => ({
    selectors: selectors.split(',').map((s) => s.trim()).filter(Boolean),
    body,
  }));

  it('has rules', () => {
    assert.ok(rules.length > 0);
  });

  it('scopes every selector under .kd', () => {
    for (const { selectors } of rules) {
      for (const selector of selectors) {
        assert.match(selector, /^\.kd(?![\w-])/, `unscoped selector: ${selector}`);
      }
    }
  });

  it('takes every colour from a --kd-* property', () => {
    assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b/i, 'hex colour literal');
    assert.doesNotMatch(css, /\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/i, 'colour function literal');
    for (const { body } of rules) {
      for (const decl of body.split(';')) {
        const [prop, ...rest] = decl.split(':');
        const value = rest.join(':').trim();
        if (!/^\s*(color|background(-color)?|border(-\w+)*-color|outline-color|fill|stroke)\s*$/.test(prop)) continue;
        assert.match(value, /^(var\(--kd-[\w-]+\)|transparent|inherit|currentcolor)$/i, `${prop.trim()}: ${value}`);
      }
    }
  });

  it('reads only --kd-* properties', () => {
    for (const [, name] of css.matchAll(/var\(\s*(--[\w-]+)/g)) {
      assert.match(name, /^--kd-/, `foreign property ${name}`);
    }
  });
});
