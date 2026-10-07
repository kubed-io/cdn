import { html } from 'lit';
import { describe, expect, it } from 'vitest';

import { KdElement, define, json, themedAncestor } from '../../src/kd';

class Probe extends KdElement {
  static override properties = { data: { attribute: 'data', converter: json } };
  declare data: { name: string } | undefined;
  override render() {
    return html`<b>${this.data?.name ?? ''}</b>`;
  }
}
define('kd-test-probe', Probe);

describe('KdElement', () => {
  it('renders from the JSON attribute and from the property', async () => {
    const el = document.createElement('kd-test-probe') as Probe;
    el.setAttribute('data', '{"name":"from attribute"}');
    document.body.append(el);
    await el.updateComplete;
    expect(el.shadowRoot?.textContent).toBe('from attribute');
    el.data = { name: 'from property' };
    await el.updateComplete;
    expect(el.shadowRoot?.textContent).toBe('from property');
    el.remove();
  });

  it('ignores a malformed JSON attribute', async () => {
    const el = document.createElement('kd-test-probe') as Probe;
    el.setAttribute('data', '{not json');
    document.body.append(el);
    await el.updateComplete;
    expect(el.data).toBeUndefined();
    el.remove();
  });

  it('finds a themed ancestor through shadow roots', () => {
    const root = document.createElement('div');
    root.setAttribute('data-theme', 'dark');
    const host = document.createElement('div');
    root.append(host);
    const inner = document.createElement('span');
    host.attachShadow({ mode: 'open' }).append(inner);
    expect(themedAncestor(inner)).toBe(root);
    expect(themedAncestor(document.createElement('i'))).toBeNull();
  });
});
