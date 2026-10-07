import { describe, expect, it } from 'vitest';

import { CHAT_VERSION, settings } from '../../src/n8n';

describe('settings', () => {
  it('parses the chat_* values', () => {
    const s = settings({
      webhook: ' https://n8n.example/webhook/x/chat ',
      greeting: 'Hi | I watch Redis |',
      context: 'pod=pod, database = datname, namespace',
      settable: 'pod, time_from,time_to,,focus',
      groups: 'Overview=the summary|Storage = disks and buckets|broken',
      stream: 'true',
    });
    expect(s.webhook).toBe('https://n8n.example/webhook/x/chat');
    expect(s.greeting).toEqual(['Hi', 'I watch Redis']);
    expect(s.context).toEqual([['pod', 'pod'], ['database', 'datname'], ['namespace', 'namespace']]);
    expect(s.settable).toEqual(['pod', 'time_from', 'time_to', 'focus']);
    expect(s.groups).toEqual({ overview: 'the summary', storage: 'disks and buckets' });
    expect(s.stream).toBe(true);
    expect(s.chatVersion).toBe(CHAT_VERSION);
  });

  it('reads a variable the dashboard lacks as empty', () => {
    const s = settings({ webhook: '${chat_webhook:percentencode}', label: '${chat_label:percentencode}', stream: '${chat_stream}' });
    expect(s.webhook).toBe('');
    expect(s.label).toBe('');
    expect(s.stream).toBe(false);
  });

  it('defaults everything', () => {
    const s = settings({});
    expect(s).toMatchObject({ webhook: '', greeting: [], context: [], settable: [], stream: false, auth: '', chatVersion: '1.39.2' });
    expect(settings({ stream: true, chatVersion: '1.41.3' })).toMatchObject({ stream: true, chatVersion: '1.41.3' });
  });
});
