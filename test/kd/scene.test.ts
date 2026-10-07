import { Window as HappyWindow } from 'happy-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  fitPanel,
  focusPanel,
  gridHeight,
  groups,
  intervalSeconds,
  pageWindow,
  refresh,
  refreshIntervals,
  scene,
  setRefresh,
  setTimeRange,
  setVariable,
  setVariables,
  snapInterval,
  timeRange,
  variableValue,
} from '../../src/kd/scene';
import { dropdown, fakeScene, grid, row, tabs, textbox } from './fake-scene';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the page', () => {
  it('is found from the window, a document or any node in it', () => {
    const { win } = fakeScene();
    const el = win.document.createElement('div');
    expect(pageWindow(win)).toBe(win);
    expect(pageWindow(win.document)).toBe(win);
    expect(pageWindow(el)).toBe(win);
    expect(pageWindow(null)).toBeNull();
    expect(scene(el)).toBe((win as any).__grafanaSceneContext);
  });

  it('has no scene off a dashboard, and every reader copes', () => {
    const win = new HappyWindow() as unknown as Window;
    expect(scene(win)).toBeNull();
    expect(variableValue(win, 'x')).toBe('');
    expect(timeRange(win)).toBeNull();
    expect(refresh(win)).toBeNull();
    expect(refreshIntervals(win)).toEqual([]);
    expect(groups(win)).toEqual([]);
    expect(setTimeRange(win, 'now-1h')).toBeNull();
    expect(setRefresh(win, '5m')).toBeNull();
  });
});

describe('variables', () => {
  it('reads a multi-value as comma-joined text', () => {
    const calls: string[] = [];
    const { win } = fakeScene({ variables: [dropdown('pod', ['a', 'b'], ['a', 'b'], calls)] });
    expect(variableValue(win, 'pod')).toBe('a,b');
  });

  it('sets a dropdown only to one of its options, or All', () => {
    const calls: string[] = [];
    const { win } = fakeScene({ variables: [dropdown('pod', 'a', ['a', 'b'], calls)] });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(setVariable(win, 'pod', 'b')).toBe('b');
    expect(setVariable(win, 'pod', 'zzz')).toBeNull();
    expect(setVariable(win, 'pod', '$__all')).toBe('$__all');
    expect(calls).toEqual(['pod=b (B)', 'pod=$__all (All)']);
  });

  it('sets a text box to anything, and skips no-ops', () => {
    const calls: string[] = [];
    const { win } = fakeScene({ variables: [textbox('pattern', 'old', calls)] });
    expect(setVariable(win, 'pattern', 'old')).toBeNull();
    expect(setVariable(win, 'pattern', '')).toBeNull();
    expect(setVariable(win, 'missing', 'x')).toBeNull();
    expect(setVariable(win, 'pattern', 'new')).toBe('new');
    expect(calls).toEqual(['pattern=new']);
  });

  it('applies only the allowed names, in the allowed order', () => {
    const calls: string[] = [];
    const { win } = fakeScene({
      variables: [textbox('pattern', '', calls), dropdown('category', 'all', ['all', 'movies'], calls), textbox('secret', '', calls)],
    });
    const applied = setVariables(win, { pattern: 'dune', category: 'movies', secret: 'x' }, ['category', 'pattern']);
    expect(calls).toEqual(['category=movies (MOVIES)', 'pattern=dune']);
    expect(applied).toEqual({ category: 'movies', pattern: 'dune' });
  });
});

describe('time range', () => {
  it('reads raw and ISO', () => {
    const { win } = fakeScene();
    expect(timeRange(win)).toEqual({
      from: 'now-24h',
      to: 'now',
      fromIso: '2026-10-06T00:00:00.000Z',
      toIso: '2026-10-07T00:00:00.000Z',
    });
  });

  it('moves both ends in one call, keeping a missing end', () => {
    const { win, calls } = fakeScene({ to: 'now-1h' });
    expect(setTimeRange(win, 'now-3h')).toEqual({ from: 'now-3h', to: 'now-1h' });
    expect(calls).toEqual(['time now-3h..now-1h']);
  });

  it('falls back to updateFromUrl', () => {
    const { win, scene: s } = fakeScene();
    const updateFromUrl = vi.fn();
    s.state.$timeRange = { state: { from: 'now-1h', to: 'now' }, updateFromUrl };
    setTimeRange(win, 'now-6h', 'now');
    expect(updateFromUrl).toHaveBeenCalledWith({ from: 'now-6h', to: 'now' });
  });
});

describe('refresh', () => {
  it('reads the picker wherever it hangs', () => {
    const { win, scene: s } = fakeScene({ refresh: '' });
    expect(refresh(win)).toBe('');
    expect(refreshIntervals(win)).toContain('15m');
    const picker = s.state.controls.state.refreshPicker;
    s.state.controls = [{ state: {} }, picker];
    expect(refreshIntervals(win)).toContain('15m');
    s.state.controls = undefined;
    s.state.refreshPicker = picker;
    expect(refreshIntervals(win)).toContain('15m');
  });

  it('converts intervals to seconds', () => {
    expect(intervalSeconds('5m')).toBe(300);
    expect(intervalSeconds('1d')).toBe(86400);
    expect(intervalSeconds('')).toBe(0);
    expect(intervalSeconds('off')).toBe(0);
  });

  it('snaps on a log scale, ties to the slower interval', () => {
    const offered = ['5s', '10s', '30s', '1m', '5m', '15m', '30m', '1h', '2h', '1d'];
    expect(snapInterval('10m', offered)).toBe('15m');
    expect(snapInterval('45s', offered)).toBe('1m');
    expect(snapInterval('1m', offered)).toBe('1m');
    expect(snapInterval('2m', ['1m', '4m'])).toBe('4m');
    expect(snapInterval('soon', offered)).toBeNull();
    expect(snapInterval('5m', [])).toBeNull();
  });

  it('sets an offered interval, snaps an unoffered one, turns off', () => {
    const { win, calls } = fakeScene();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(setRefresh(win, '5m')).toBe('5m');
    expect(setRefresh(win, '10m')).toBe('15m');
    expect(setRefresh(win, 'off')).toBe('off');
    expect(setRefresh(win, 'whenever')).toBeNull();
    expect(calls).toEqual(['refresh 5m', 'refresh 15m', 'refresh off']);
  });
});

describe('groups and focus', () => {
  function dashboard() {
    const calls: string[] = [];
    const rows = [
      row('Header', grid(1), { hideHeader: true }, calls),
      row('', tabs([['Overview', grid(2, 3)], ['Storage', { state: { rows: [row('Nested', grid(7))] } }]], calls)),
      row('Logs', grid(9), { collapsed: true }, calls),
    ];
    return fakeScene({ rows, calls });
  }

  it('lists tabs and rows with their panels, including closed ones', () => {
    const { win } = dashboard();
    expect(groups(win).map(({ show, ...g }) => g)).toEqual([
      { name: 'Header', kind: 'row', open: true, focusable: false, panels: ['panel-1'] },
      { name: 'Overview', kind: 'tab', open: true, focusable: true, panels: ['panel-2', 'panel-3'] },
      { name: 'Storage', kind: 'tab', open: false, focusable: true, panels: ['panel-7'] },
      { name: 'Logs', kind: 'row', open: false, focusable: true, panels: ['panel-9'] },
    ]);
  });

  it('opens the group holding a panel and scrolls to it once it mounts', async () => {
    const { win, calls } = dashboard();
    const target = win.document.createElement('div');
    const scrolled = vi.fn();
    target.scrollIntoView = scrolled;
    target.setAttribute('data-viz-panel-key', 'panel-7');
    expect(focusPanel(win, 7)).toEqual({ group: 'Storage', kind: 'tab', panel: 7 });
    expect(calls).toEqual(['tab Storage']);
    win.document.body.append(target);
    await new Promise((r) => setTimeout(r, 100));
    expect(scrolled).toHaveBeenCalled();
  });

  it('opens a group by name, and refuses what cannot be focused', () => {
    const { win, calls } = dashboard();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(focusPanel(win, 'logs')).toEqual({ group: 'Logs', kind: 'row', panel: null });
    expect(calls).toEqual(['row Logs open']);
    expect(focusPanel(win, 'Header')).toBeNull();
    expect(focusPanel(win, 'panel-404')).toBeNull();
    expect(focusPanel(win, '')).toBeNull();
  });
});

describe('fitPanel', () => {
  it('converts pixels to grid rows', () => {
    expect(gridHeight(0)).toBe(1);
    expect(gridHeight(26)).toBe(1);
    expect(gridHeight(27)).toBe(2);
    expect(gridHeight(300)).toBe(9);
  });

  function sized(win: Window, height: number, key: string) {
    const host = win.document.createElement('div');
    host.setAttribute('data-viz-panel-key', key);
    const content = win.document.createElement('div');
    Object.defineProperty(content, 'offsetHeight', { value: height });
    host.append(content);
    win.document.body.append(host);
    return content as unknown as HTMLElement;
  }

  function layout(win: Window, items: any[]) {
    const parent: any = {
      state: { children: items },
      setState: vi.fn((patch: any) => Object.assign(parent.state, patch)),
      forEachChild: (fn: (c: any) => void) => parent.state.children.forEach(fn),
    };
    for (const i of items) i.parent = parent;
    (win as any).__grafanaSceneContext = { state: {}, forEachChild: (fn: (c: any) => void) => fn(parent) };
    return parent;
  }

  function item(key: string, height: number) {
    return { state: { body: { state: { key } }, height }, setState: vi.fn(function (this: any, p: any) { Object.assign(this.state, p); }) };
  }

  it('sets the grid item height and relays the grid out, once', () => {
    const win = new HappyWindow() as unknown as Window;
    const target = item('panel-4', 8);
    const parent = layout(win, [item('panel-3', 2), target]);
    const content = sized(win, 100, 'panel-4');
    expect(fitPanel(content)).toBe(3);
    expect(target.state.height).toBe(3);
    expect(parent.setState).toHaveBeenCalledTimes(1);
    expect(parent.state.children).toContain(target);
    expect(fitPanel(content)).toBe(3);
    expect(parent.setState).toHaveBeenCalledTimes(1);
  });

  it('picks the repeat clone whose variable matches', () => {
    const win = new HappyWindow() as unknown as Window;
    const clone = (value: string) => {
      const i: any = item('panel-1', 5);
      i.parent = { state: { $variables: { state: { variables: [{ state: { name: 'group' }, getValue: () => value }] } } } };
      return i;
    };
    const a = clone('apps');
    const b = clone('batch');
    const parent: any = { state: { children: [a, b] }, setState: vi.fn(), forEachChild: (fn: any) => [a, b].forEach(fn) };
    (win as any).__grafanaSceneContext = { state: {}, forEachChild: (fn: any) => fn(parent) };
    const content = sized(win, 10, 'panel-1');
    const replaceVariables = (s: string) => (s === '${group}' ? 'batch' : s);
    expect(fitPanel(content, { grafana: { replaceVariables } })).toBe(1);
    expect(b.state.height).toBe(1);
    expect(a.state.height).toBe(5);
  });

  it('takes the panel from the context, and gives up without one', () => {
    const win = new HappyWindow() as unknown as Window;
    const target = item('panel-6', 1);
    layout(win, [target]);
    const loose = win.document.createElement('div') as unknown as HTMLElement;
    Object.defineProperty(loose, 'offsetHeight', { value: 200 });
    win.document.body.append(loose);
    expect(fitPanel(loose)).toBeNull();
    expect(fitPanel(loose, { panel: 6 })).toBe(6);
    expect(target.state.height).toBe(6);
  });
});
