import { html } from 'lit';
import { describe, expect, it } from 'vitest';

import { KdElement, applyTheme, define, json, themedAncestor } from '../../src/kd';

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

describe('KdElement self-theming', () => {
  const theme = {
    isDark: true,
    colors: { background: { primary: '#bg' }, text: { primary: '#text' } },
  };
  Object.assign(window, {
    System: {
      import: async () => ({
        config: { theme2: theme },
        ThemeChangedEvent: class {},
        getAppEvents: () => ({ subscribe: () => ({ unsubscribe() {} }) }),
      }),
    },
  });
  const frames = () => new Promise((r) => setTimeout(r, 50));

  it('themes itself when nothing above it is themed', async () => {
    const el = document.createElement('kd-test-probe') as Probe;
    document.body.append(el);
    await frames();
    expect(el.style.getPropertyValue('--kd-bg')).toBe('#bg');
    expect(el.getAttribute('data-theme')).toBe('dark');
    el.remove();
  });

  it('inherits when applyTheme reaches the panel root right after the element upgrades', async () => {
    const root = document.createElement('div');
    const el = document.createElement('kd-test-probe') as Probe;
    root.append(el);
    document.body.append(root);
    root.setAttribute('data-theme', 'dark'); // what afterRender's applyTheme does, a tick later
    await frames();
    expect(el.style.getPropertyValue('--kd-bg')).toBe('');
    expect(el.hasAttribute('data-theme')).toBe(false);
    root.remove();
  });

  it('stands down when applyTheme reaches the panel root long after it started theming itself', async () => {
    const root = document.createElement('div');
    const el = document.createElement('kd-test-probe') as Probe;
    root.append(el);
    document.body.append(root);
    await frames();
    expect(el.style.getPropertyValue('--kd-bg')).toBe('#bg');
    applyTheme(root, theme); // the panel's own import resolved late
    expect(el.style.getPropertyValue('--kd-bg')).toBe('');
    expect(el.hasAttribute('data-theme')).toBe(false);
    expect(root.style.getPropertyValue('--kd-bg')).toBe('#bg');
    root.remove();
  });
});
