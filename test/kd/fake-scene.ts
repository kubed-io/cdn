import { Window as HappyWindow } from 'happy-dom';

// A stand-in for Grafana's dashboard scene, with only the parts the scene
// helpers read and call. `calls` records every change in order.

export interface Fake {
  win: Window;
  scene: any;
  calls: string[];
}

export function dropdown(name: string, value: unknown, options: string[], calls: string[]) {
  return {
    state: { name, value, options: options.map((o) => ({ value: o, label: o.toUpperCase() })) },
    getValue() {
      return this.state.value;
    },
    changeValueTo(value: unknown, label: unknown) {
      calls.push(`${name}=${value} (${label})`);
      this.state.value = value;
    },
  };
}

export function textbox(name: string, value: string, calls: string[]) {
  return {
    state: { name, value },
    getValue() {
      return this.state.value;
    },
    setValue(value: string) {
      calls.push(`${name}=${value}`);
      this.state.value = value;
    },
  };
}

export function panel(id: number) {
  return { state: { key: `panel-${id}` } };
}

export function grid(...ids: number[]) {
  return { state: { children: ids.map((id) => ({ state: { body: panel(id), height: 4 } })) } };
}

export function row(title: string, layout: unknown, { collapsed = false, hideHeader = false } = {}, calls: string[] = []) {
  return {
    state: { title, hideHeader, layout },
    collapsed,
    getCollapsedState() {
      return this.collapsed;
    },
    setCollapsedState(c: boolean) {
      calls.push(`row ${title} ${c ? 'collapsed' : 'open'}`);
      this.collapsed = c;
    },
  };
}

export function tabs(entries: [string, unknown][], calls: string[]) {
  const list = entries.map(([title, layout]) => ({ state: { title, layout } }));
  return {
    state: { tabs: list },
    current: list[0],
    getCurrentTab() {
      return this.current;
    },
    switchToTab(tab: { state: { title: string } }) {
      calls.push(`tab ${tab.state.title}`);
      this.current = tab as (typeof list)[number];
    },
  };
}

export function fakeScene({
  url = 'https://grafana.example/d/abc123/some-app',
  variables = [] as any[],
  from = 'now-24h',
  to = 'now',
  refresh = '1m',
  intervals = ['5s', '10s', '30s', '1m', '5m', '15m', '30m', '1h', '2h', '1d'],
  rows = [] as any[],
  calls = [] as string[],
} = {}): Fake {
  const win = new HappyWindow({ url }) as unknown as Window;
  const timeRange = {
    state: { from, to, value: { from: new Date('2026-10-06T00:00:00Z'), to: new Date('2026-10-07T00:00:00Z') } },
    onTimeRangeChange(range: { raw: { from: string; to: string } }) {
      calls.push(`time ${range.raw.from}..${range.raw.to}`);
      this.state.from = range.raw.from;
      this.state.to = range.raw.to;
    },
  };
  const refreshPicker = {
    state: { refresh, intervals },
    setState(patch: { refresh: string }) {
      calls.push(`refresh ${patch.refresh || 'off'}`);
      this.state.refresh = patch.refresh;
    },
  };
  const scene = {
    state: {
      $variables: {
        state: { variables },
        getByName: (name: string) => variables.find((v) => v.state.name === name),
      },
      $timeRange: timeRange,
      controls: { state: { refreshPicker } },
      body: { state: { rows } },
    },
  };
  (win as any).__grafanaSceneContext = scene;
  return { win, scene, calls };
}
