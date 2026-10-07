import { Window } from 'happy-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { define, VERSION } from '../../src/kd';

// Each test gets its own registry, the way each page load does.
function registry(): CustomElementRegistry {
  return new Window().customElements as unknown as CustomElementRegistry;
}

describe('define', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('defines a new element and stamps it with the package version', () => {
    const reg = registry();
    class Probe extends HTMLElement {}
    expect(define('kd-probe', Probe, reg)).toBe(true);
    expect(reg.get('kd-probe')).toBe(Probe);
    expect((Probe as unknown as { kdVersion: string }).kdVersion).toBe(VERSION);
  });

  it('keeps the first definition instead of throwing', () => {
    const reg = registry();
    class First extends HTMLElement {}
    class Second extends HTMLElement {}
    define('kd-probe', First, reg);
    expect(define('kd-probe', Second, reg)).toBe(false);
    expect(reg.get('kd-probe')).toBe(First);
  });

  it('is silent when the same build defines twice', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const reg = registry();
    class First extends HTMLElement {}
    class Again extends HTMLElement {}
    define('kd-probe', First, reg);
    define('kd-probe', First, reg);
    define('kd-probe', Again, reg);
    expect(warn).not.toHaveBeenCalled();
  });

  it('warns, naming both versions, when another build owns the tag', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const reg = registry();
    class Older extends HTMLElement {
      static kdVersion = '0.0.0-older';
    }
    reg.define('kd-probe', Older);
    class Newer extends HTMLElement {}
    expect(define('kd-probe', Newer, reg)).toBe(false);
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0][0]).toContain('0.0.0-older');
    expect(warn.mock.calls[0][0]).toContain(VERSION);
  });

  it('warns when a script outside this package owns the tag', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const reg = registry();
    reg.define('kd-probe', class extends HTMLElement {});
    define('kd-probe', class extends HTMLElement {}, reg);
    expect(warn.mock.calls[0][0]).toContain('another script');
  });
});
