import { afterEach, describe, expect, it, vi } from 'vitest';

import { html } from 'lit';

import { KdElement, contextVariable, feed, type KdCode } from '../../src/kd';
import { settle, shadow } from './mount';

const theme = { isDark: true, colors: { text: { primary: 'white-ish' } } };

function panel(markup: string): HTMLElement {
  const root = document.createElement('div');
  root.innerHTML = markup;
  document.body.append(root);
  return root;
}

describe('feed', () => {
  afterEach(() => document.body.replaceChildren());

  it('themes the panel root and sets each selector its properties', async () => {
    const element = panel('<kd-code class="a"></kd-code><kd-code class="a"></kd-code><kd-code id="b"></kd-code>');
    const fed = feed({ element, grafana: { theme } }, { '.a': { text: 'x: 1', language: 'yaml' }, '#b': { text: 'y' } });
    expect(element.getAttribute('data-theme')).toBe('dark');
    expect(element.style.getPropertyValue('--kd-text')).toBe('white-ish');
    expect(fed).toHaveLength(3);
    const [a1, a2, b] = fed as KdCode[];
    expect([a1.text, a2.language, b.text]).toEqual(['x: 1', 'yaml', 'y']);
    await settle(a1);
    expect(shadow(a1).querySelector('.hljs-attr')).not.toBeNull();
  });

  it('is idempotent', () => {
    const element = panel('<kd-code></kd-code>');
    const map = { 'kd-code': { text: 'a' } };
    feed({ element, grafana: { theme } }, map);
    const again = feed({ element, grafana: { theme } }, map);
    expect((again[0] as KdCode).text).toBe('a');
    expect(element.querySelectorAll('kd-code')).toHaveLength(1);
  });

  it('sets properties on an element defined after it was created', async () => {
    const element = panel('<kd-later></kd-later>');
    feed({ element }, { 'kd-later': { value: 3 } });
    class Later extends KdElement {
      static override properties = { value: { type: Number } };
      declare value: number;
      override render() {
        return html`${this.value}`;
      }
    }
    customElements.define('kd-later', Later);
    const later = element.firstElementChild as Later;
    await later.updateComplete;
    expect(later.value).toBe(3);
    expect(shadow(later).textContent).toBe('3');
  });

  it('skips a bad selector and does nothing without a root', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const element = panel('<kd-code></kd-code>');
    expect(feed({ element }, { '[': { text: 'a' }, 'kd-code': { text: 'b' } })).toHaveLength(1);
    expect(warn).toHaveBeenCalled();
    expect(feed(undefined, { 'kd-code': { text: 'a' } })).toEqual([]);
    expect(feed({ element: null })).toEqual([]);
    warn.mockRestore();
  });
});

describe('contextVariable', () => {
  const grafana = {
    replaceVariables: (text: string) => text.replace(/\$\{(\w+)\}/g, (all, name) => ({ file: 'abc:README.md', empty: '' })[name as 'file'] ?? all),
  };

  it('reads a variable through replaceVariables', () => {
    expect(contextVariable({ grafana }, 'file')).toBe('abc:README.md');
  });

  it('gives an empty string when the variable is empty, missing, or there is no Grafana', () => {
    expect(contextVariable({ grafana }, 'empty')).toBe('');
    expect(contextVariable({ grafana }, 'nope')).toBe('');
    expect(contextVariable({}, 'file')).toBe('');
    expect(contextVariable(null, 'file')).toBe('');
    expect(contextVariable({ grafana: { replaceVariables: () => { throw new Error('x'); } } }, 'file')).toBe('');
  });
});
