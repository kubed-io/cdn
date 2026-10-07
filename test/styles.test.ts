// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Every light-DOM stylesheet in the package. Business Text loads these into the
// whole page, so each rule must be scoped under .kd, and the look comes only
// from the theme layer's --kd-* properties - a domain entry adds no colours.
const SRC = fileURLToPath(new URL('../src/', import.meta.url));
const sheets = readdirSync(SRC, { recursive: true, encoding: 'utf8' })
  .filter((f) => f.endsWith('.css'))
  .map((f) => ({ file: f, css: readFileSync(join(SRC, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '') }));

const COLOUR_PROPS = /^\s*(color|background(-color)?|border(-\w+)*-color|outline-color|fill|stroke)\s*$/;

it('finds the stylesheets', () => {
  expect(sheets.map((s) => s.file)).toContain('kd/kd.css');
});

describe.each(sheets)('$file', ({ css }) => {
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selectors, body]) => ({
    selectors: selectors.split(',').map((s) => s.trim()).filter(Boolean),
    body,
  }));

  it('has rules', () => {
    expect(rules.length).toBeGreaterThan(0);
  });

  it('scopes every selector under .kd', () => {
    for (const { selectors } of rules) {
      for (const selector of selectors) {
        expect(selector, `unscoped selector: ${selector}`).toMatch(/^\.kd(?![\w-])/);
      }
    }
  });

  it('takes every colour from a --kd-* property', () => {
    expect(css, 'hex colour literal').not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(css, 'colour function literal').not.toMatch(/\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/i);
    for (const { body } of rules) {
      for (const decl of body.split(';')) {
        const [prop, ...rest] = decl.split(':');
        const value = rest.join(':').trim();
        if (!COLOUR_PROPS.test(prop)) continue;
        expect(value, `${prop.trim()}: ${value}`).toMatch(/^(var\(--kd-[\w-]+\)|transparent|inherit|currentcolor)$/i);
      }
    }
  });

  it('reads only --kd-* properties and defines none', () => {
    for (const [, name] of css.matchAll(/var\(\s*(--[\w-]+)/g)) {
      expect(name, `foreign property ${name}`).toMatch(/^--kd-/);
    }
    expect(css, 'a stylesheet defines a --kd-* property').not.toMatch(/(^|[;{\s])--kd-[\w-]+\s*:/);
  });
});
