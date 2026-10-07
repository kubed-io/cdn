// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

// Every shadow stylesheet (a Lit css`` block) in the package takes its look
// from the theme's --kd-* properties. A colour literal - even as a var()
// fallback - would pin one theme's colour into the other.
const SRC = fileURLToPath(new URL('../../src/', import.meta.url));
const blocks = readdirSync(SRC, { recursive: true, encoding: 'utf8' })
  .filter((f) => f.endsWith('.ts'))
  .flatMap((f) =>
    [...readFileSync(join(SRC, f), 'utf8').matchAll(/css`([\s\S]*?)`/g)].map((m, i) => ({
      where: `${f} block ${i + 1}`,
      css: m[1].replace(/\/\*[\s\S]*?\*\//g, ''),
    })),
  );

it('finds the shadow stylesheets', () => {
  expect(blocks.length).toBeGreaterThan(0);
});

it.each(blocks)('$where has no colour literal', ({ css }) => {
  expect(css, 'hex colour').not.toMatch(/#[0-9a-f]{3,8}\b/i);
  expect(css, 'colour function').not.toMatch(/\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(/i);
  expect(css, 'named colour').not.toMatch(/:\s*(white|black|red|green|blue|gray|grey)\b/i);
});
