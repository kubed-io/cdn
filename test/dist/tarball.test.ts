import { describe, expect, it } from 'vitest';

// Runs only from package.yml, against the unpacked tarball: KD_DIST is its dist/
// and KD_VERSION the version package.json names. Proves what jsDelivr will serve
// loads in a DOM, registers its elements, and was built as that version.
const DIST = process.env.KD_DIST;
const VERSION = process.env.KD_VERSION;

describe.skipIf(!DIST)('the packed dist', () => {
  it.each(['kd', 'openapi', 'k8s', 'n8n'])('%s.js loads and carries the version', async (entry) => {
    const m = await import(/* @vite-ignore */ `${DIST}/${entry}.js`);
    expect(m.VERSION).toBe(VERSION);
  });

  it('registers the kd elements', async () => {
    await import(/* @vite-ignore */ `${DIST}/kd.js`);
    expect(customElements.get('kd-pill')).toBeDefined();
  });

  it('registers kd-schema', async () => {
    await import(/* @vite-ignore */ `${DIST}/openapi.js`);
    expect(customElements.get('kd-schema')).toBeDefined();
  });
});
