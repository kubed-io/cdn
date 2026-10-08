import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Runs only from package.yml, against the unpacked tarball: KD_DIST is its dist/
// (inside the project, where Vitest may load from)
// and KD_VERSION the version package.json names. Proves what jsDelivr will serve
// loads in a DOM, registers its elements, and was built as that version.
const DIST = process.env.KD_DIST;
const VERSION = process.env.KD_VERSION;
const load = (file: string) => import(/* @vite-ignore */ resolve(DIST ?? '', file));

describe.skipIf(!DIST)('the packed dist', () => {
  it.each(['kd', 'openapi', 'k8s', 'n8n', 'github'])('%s.js loads and carries the version', async (entry) => {
    const m = await load(`${entry}.js`);
    expect(m.VERSION).toBe(VERSION);
  });

  it('registers the kd elements', async () => {
    await load('kd.js');
    expect(customElements.get('kd-pill')).toBeDefined();
  });

  it('registers kd-schema', async () => {
    await load('openapi.js');
    expect(customElements.get('kd-schema')).toBeDefined();
  });
});
