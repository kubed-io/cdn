import { describe, expect, it } from 'vitest';

import { eventRows, eventsTable, foldEvents, isWarning, kindIcon } from '../../src/k8s';
import { events } from './fixtures';

const T = events.frames[1] as Record<string, unknown>[];

describe('eventRows', () => {
  it('takes the log rows out of every frame, skipping the jq rows beside them', () => {
    expect(eventRows(events.frames)).toHaveLength(8);
    expect(eventRows(T)).toHaveLength(8);
    expect(eventRows(null)).toEqual([]);
  });

  it('reads data frames with fields, as Grafana hands them over', () => {
    const frame = {
      fields: [
        { name: 'labels', values: T.map((r) => r.labels) },
        { name: 'Time', values: { toArray: () => T.map((r) => r.Time) } },
        { name: 'Line', values: T.map((r) => r.Line) },
      ],
    };
    const rows = eventRows([frame]);
    expect(rows).toHaveLength(8);
    expect(rows[0].Line).toBe('Container started');
  });
});

describe('foldEvents', () => {
  it('folds by object, reason and message, the most recent first', () => {
    const groups = foldEvents(events.frames);
    expect(groups.map((g) => g.reason)).toEqual(['Started', 'Pulled', 'Created', 'BackOff', 'ScalingReplicaSet', 'SuccessfulCreate']);
    const backoff = groups[3];
    expect(backoff).toMatchObject({
      kind: 'Pod',
      name: 'web-5c57db9dff-6fkrm',
      namespace: 'shop',
      apiVersion: 'v1',
      source: 'kubelet',
      warning: true,
      count: 3,
      first: (T[5].Time as number),
      last: (T[3].Time as number),
    });
    expect(groups[0].warning).toBe(false);
  });

  it('reads labels sent as a JSON string, and times as Time, timestamp or tsNs', () => {
    const groups = foldEvents([
      { labels: JSON.stringify({ reason: 'Killing', kind: 'Pod', name: 'a' }), Line: 'Stopping', timestamp: '2026-10-07T10:00:00Z' },
      { labels: '{broken', body: 'x', tsNs: '1791366661000000000' },
    ]);
    expect(groups[0]).toMatchObject({ reason: 'Killing', warning: true, last: Date.parse('2026-10-07T10:00:00Z') });
    expect(groups[1]).toMatchObject({ reason: '', message: 'x', last: 1791366661000 });
  });

  it('calls an event a warning by its type label or its reason', () => {
    expect(isWarning({ type: 'Warning', reason: 'Anything' })).toBe(true);
    expect(isWarning({ reason: 'FailedMount' })).toBe(true);
    expect(isWarning({ reason: 'Unhealthy' })).toBe(true);
    expect(isWarning({ reason: 'Pulled' })).toBe(false);
    expect(isWarning({})).toBe(false);
  });
});

describe('eventsTable', () => {
  const groups = foldEvents(events.frames);

  it('is a kd-table of reason, message, count and last seen', () => {
    const t = eventsTable(groups, { now: events.now });
    expect(t.columns?.map((c) => c.key)).toEqual(['reason', 'message', 'count', 'last']);
    expect(t.rows[0]).toMatchObject({
      reason: { text: 'Started', tone: 'info', title: 'Normal · from kubelet' },
      message: 'Container started',
      count: '',
      last: '1m ago',
    });
    expect(t.rows[3]).toMatchObject({
      reason: { text: 'BackOff', tone: 'error', title: 'Warning · from kubelet' },
      count: '×3',
      last: ['1m ago', '(first 1h 1m)'],
    });
  });

  it('adds the object and the namespace columns', () => {
    const t = eventsTable(groups, { now: events.now, object: true, namespace: true });
    expect(t.columns?.map((c) => c.key)).toEqual(['reason', 'namespace', 'object', 'message', 'count', 'last']);
    expect(t.rows[4].object).toEqual({
      dashboard: 'k8s-workload',
      vars: { kind: 'apps/v1/deployments', app_namespace: 'shop', workload: 'web' },
      back: true,
      text: 'web',
      title: 'Deployment',
      icon: kindIcon('Deployment', 'apps/v1'),
    });
    expect(t.rows[4].namespace).toMatchObject({ dashboard: 'k8s-namespace', vars: { app_namespace: 'shop' } });
  });
});
