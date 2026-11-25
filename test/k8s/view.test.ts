// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { registerViewHelpers } from '../../src/k8s';
import { events } from './fixtures';

// The helpers code the k8s-* view panels carried before registerViewHelpers, run the way
// Business Text runs it: `new Function('context', code)`. Each helper must answer the same.
const ORIGINAL = readFileSync(new URL('./fixtures/view.helpers.js', import.meta.url), 'utf8');

type Helpers = Record<string, (...args: unknown[]) => unknown>;

function context(now: number) {
  const helpers: Helpers = {};
  return {
    helpers,
    handlebars: { helpers, registerHelper: (name: string, fn: (...args: unknown[]) => unknown) => { helpers[name] = fn; } },
    grafana: { timeRange: { to: { valueOf: () => now } } },
  };
}

function both(now: number): [Helpers, Helpers] {
  const before = context(now);
  new Function('context', ORIGINAL)(before);
  const after = context(now);
  registerViewHelpers(after);
  return [before.helpers, after.helpers];
}

const NOW = Date.parse('2026-11-25T12:00:00Z');
const head = { section: 'head', html: '<div class="bar">pod web-0</div>' };
const summary = {
  section: 'summary',
  html: '<div class="ctabs"><input type="radio" name="t1" id="t1-a" checked/><div class="strip"><label for="t1-a">Spec</label></div>'
    + '<div class="panes"><div class="pane">spec</div></div></div>',
};
const frames = [[head, summary], ...(events.frames.slice(1) as unknown[][])];

describe('registerViewHelpers', () => {
  it('registers what the panels used', () => {
    const [before, after] = both(NOW);
    expect(Object.keys(after).sort()).toEqual(Object.keys(before).sort());
  });

  it('answers every helper the same as the panels\' own code', () => {
    const [before, after] = both(NOW);
    const rows = (events.frames[1] as unknown[]).filter((r) => (r as { Line?: string }).Line !== undefined);
    const cases: [string, unknown[]][] = [
      ['events', [rows]],
      ['events', [[]]],
      ['events', [null]],
      ['evhead', [frames]],
      ['evhead', [[]]],
      ['evtabs', [summary.html, frames]],
      ['evtabs', ['<div>no tabs</div>', frames]],
      ['evsum', [frames]],
      ['evcount', [frames]],
      ['evtable', [frames]],
      ['evtable', [[]]],
    ];
    for (const [name, args] of cases) {
      expect(after[name](...args), `${name}(${JSON.stringify(args).slice(0, 60)})`).toBe(before[name](...args));
    }
  });

  it('adds the Events tab with its count to a summary', () => {
    const [, after] = both(NOW);
    const html = after.evsum(frames) as string;
    expect(html).toContain('id="t1-ev"');
    expect(html).toMatch(/<label for="t1-ev">Events <span class="n">\d+<\/span><\/label>/);
    expect(html).toContain('<table class="st ev">');
  });
});
