import { describe, expect, it, vi } from 'vitest';

import { rememberVariables, submitOnEnter } from '../../src/kd/scene';
import { dropdown, fakeScene, textbox } from './fake-scene';

const KEY = 'films-search';

function page(url = 'https://grafana.example/d/abc/films', saved?: Record<string, string>) {
  const calls: string[] = [];
  const variables = [textbox('pattern', '', calls), textbox('limit', '100', calls)] as const;
  const engine = dropdown('engine', 'all', ['all', 'yts'], calls);
  const fake = fakeScene({ url, variables: [...variables, engine], calls });
  if (saved) fake.win.localStorage.setItem(KEY, JSON.stringify(saved));
  return { ...fake, variables, engine };
}

describe('rememberVariables', () => {
  it('saves the variables whenever one changes', () => {
    const { win, variables, engine } = page();
    rememberVariables(win, KEY, ['pattern', 'limit', 'engine']);
    variables[0].setValue('alien');
    expect(JSON.parse(win.localStorage.getItem(KEY)!)).toEqual({ pattern: 'alien', limit: '100', engine: 'all' });
    engine.changeValueTo('yts', 'YTS');
    expect(JSON.parse(win.localStorage.getItem(KEY)!).engine).toBe('yts');
  });

  it('restores them when the dashboard is opened without them', () => {
    const { win, calls } = page(undefined, { pattern: 'alien', limit: '100', engine: 'yts' });
    rememberVariables(win, KEY, ['pattern', 'limit', 'engine']);
    // limit is unchanged and is not set again.
    expect(calls).toEqual(['pattern=alien', 'engine=yts (YTS)']);
  });

  it('leaves a link that carries its own values alone', () => {
    const { win, calls } = page('https://grafana.example/d/abc/films?var-pattern=heat', { pattern: 'alien' });
    rememberVariables(win, KEY, ['pattern', 'limit']);
    expect(calls).toEqual([]);
  });

  it('only counts the variables named in unless', () => {
    const { win, calls } = page('https://grafana.example/d/abc/films?var-limit=5', { pattern: 'alien' });
    rememberVariables(win, KEY, ['pattern', 'limit'], ['pattern']);
    expect(calls).toEqual(['pattern=alien']);
  });

  it('never restores an empty value', () => {
    const { win, calls } = page(undefined, { pattern: '', limit: '50' });
    rememberVariables(win, KEY, ['pattern', 'limit']);
    expect(calls).toEqual(['limit=50']);
  });

  it('restores once per page and keeps one set of listeners, however often a panel renders', () => {
    const { win, calls, variables } = page(undefined, { pattern: 'alien' });
    rememberVariables(win, KEY, ['pattern', 'limit']);
    variables[0].setValue('heat');
    rememberVariables(win, KEY, ['pattern', 'limit']);
    expect(calls).toEqual(['pattern=alien', 'pattern=heat']);
    expect(variables[0].listeners.size).toBe(1);
  });

  it('stops saving when told to', () => {
    const { win, variables } = page();
    const stop = rememberVariables(win, KEY, ['pattern']);
    stop();
    variables[0].setValue('alien');
    expect(win.localStorage.getItem(KEY)).toBeNull();
  });

  it('copes with storage that throws and with no dashboard', () => {
    const { win, variables } = page();
    vi.spyOn(win.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    rememberVariables(win, KEY, ['pattern']);
    expect(() => variables[0].setValue('alien')).not.toThrow();
    const bare = fakeScene();
    delete (bare.win as any).__grafanaSceneContext;
    expect(() => rememberVariables(bare.win, KEY, ['pattern'])()).not.toThrow();
  });
});

describe('submitOnEnter', () => {
  function form(win: Window, { disabled = false, field = 'input' } = {}) {
    const doc = win.document;
    doc.body.innerHTML = `<div data-viz-panel-key="panel-4"><${field} class="field"></${field}>
      <button data-testid="data-testid panel button-submit" ${disabled ? 'disabled' : ''}>Submit</button></div>`;
    const submit = doc.querySelector('button')!;
    const clicks = vi.fn();
    submit.addEventListener('click', clicks);
    const press = (init: KeyboardEventInit = {}) => {
      const e = new (win as any).KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true, ...init });
      doc.querySelector('.field')!.dispatchEvent(e);
      return e as KeyboardEvent;
    };
    return { clicks, press };
  }

  it('clicks the form panel\'s own submit button on Enter', () => {
    const { win } = fakeScene();
    submitOnEnter(win);
    const { clicks, press } = form(win);
    expect(press().defaultPrevented).toBe(true);
    expect(clicks).toHaveBeenCalledTimes(1);
  });

  it('binds once per page', () => {
    const { win } = fakeScene();
    submitOnEnter(win);
    submitOnEnter(win);
    const { clicks, press } = form(win);
    press();
    expect(clicks).toHaveBeenCalledTimes(1);
  });

  it('respects a disabled button, a modifier and a textarea', () => {
    const { win } = fakeScene();
    submitOnEnter(win);
    let f = form(win, { disabled: true });
    f.press();
    expect(f.clicks).not.toHaveBeenCalled();
    f = form(win);
    f.press({ shiftKey: true });
    f.press({ key: 'a' });
    expect(f.clicks).not.toHaveBeenCalled();
    f = form(win, { field: 'textarea' });
    f.press();
    expect(f.clicks).not.toHaveBeenCalled();
  });
});
