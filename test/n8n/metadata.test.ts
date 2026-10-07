import { describe, expect, it } from 'vitest';

import { chatMetadata, describeGroups, settings } from '../../src/n8n';
import { dropdown, fakeScene, grid, row, tabs } from '../kd/fake-scene';

describe('chatMetadata', () => {
  it('reports what is on screen at send time', () => {
    const calls: string[] = [];
    const { win, scene } = fakeScene({
      variables: [dropdown('datname', ['a', 'b'], ['a', 'b'], calls), dropdown('chat_groups', 'x', [], calls)],
      rows: [row('', tabs([['Overview', grid(1, 2)], ['Storage', grid(3)]], calls))],
    });
    const s = settings({ user: 'viewer', context: 'database=datname', groups: 'Storage=disks' });
    const meta = chatMetadata(win, s, '/d/abc123/some-app');
    expect(JSON.parse(JSON.stringify(meta))).toMatchObject({
      dashboard: 'abc123',
      user: 'viewer',
      dashboardUrl: 'https://grafana.example/d/abc123/some-app',
      timeFrom: 'now-24h',
      timeTo: 'now',
      timeFromIso: '2026-10-06T00:00:00.000Z',
      refresh: '1m',
      refreshSeconds: 60,
      refreshIntervals: '5s,10s,30s,1m,5m,15m,30m,1h,2h,1d',
      groups: '- Overview (tab, 2 panels, OPEN)\n- Storage (tab, 1 panel): disks',
      openGroups: 'Overview',
      database: 'a,b',
    });
    scene.state.$timeRange.state.from = 'now-3h';
    scene.state.controls.state.refreshPicker.state.refresh = '';
    expect(meta.timeFrom).toBe('now-3h');
    expect(meta.refresh).toBe('off');
    expect(meta.refreshSeconds).toBe(0);
  });
});

describe('describeGroups', () => {
  it('marks pinned rows', () => {
    const g = { name: 'Header', kind: 'row' as const, open: true, focusable: false, panels: [], show() {} };
    expect(describeGroups([g], { header: 'the tile' })).toBe('- Header (row, 0 panels, OPEN, pinned): the tile');
  });
});
