import { describe, expect, it, vi } from 'vitest';

import { CONTROL_NODE, controlFilter } from '../../src/n8n';

const enc = new TextEncoder();

function source(pieces: (string | Uint8Array)[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(c) {
      for (const p of pieces) c.enqueue(typeof p === 'string' ? enc.encode(p) : p);
      c.close();
    },
  });
}

async function read(stream: ReadableStream<Uint8Array>): Promise<string> {
  const dec = new TextDecoder();
  let out = '';
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return out + dec.decode();
    out += dec.decode(value, { stream: true });
  }
}

const line = (o: unknown) => JSON.stringify(o) + '\n';
const agent = (type: string, content?: string) => ({ type, content, metadata: { nodeName: 'Agent' } });
const control = (type: string, content?: string) => ({ type, content, metadata: { nodeName: CONTROL_NODE } });

describe('controlFilter', () => {
  it('swallows the control node whole and hands over its payload', async () => {
    const onControl = vi.fn();
    const payload = { tools: [{ args: { pod: 'redis-0' } }] };
    const text =
      line(agent('begin')) +
      line(agent('item', 'All good.')) +
      line(agent('end')) +
      line(control('begin')) +
      line(control('item', JSON.stringify(payload))) +
      line(control('end'));
    const out = await read(source([text]).pipeThrough(controlFilter(onControl)));
    expect(out).toBe(line(agent('begin')) + line(agent('item', 'All good.')) + line(agent('end')));
    expect(onControl).toHaveBeenCalledExactlyOnceWith(payload);
  });

  it('holds back a line split across chunks, even mid-character', async () => {
    const onControl = vi.fn();
    const text = line(agent('item', 'café → ok')) + line(control('item', '{"tools":[]}'));
    const bytes = enc.encode(text);
    const cut = text.indexOf('é') + 1; // inside the two-byte é
    const pieces = [bytes.slice(0, cut), bytes.slice(cut, cut + 40), bytes.slice(cut + 40, bytes.length - 20), bytes.slice(bytes.length - 20)];
    const out = await read(source(pieces).pipeThrough(controlFilter(onControl)));
    expect(out).toBe(line(agent('item', 'café → ok')));
    expect(onControl).toHaveBeenCalledExactlyOnceWith({ tools: [] });
  });

  it('never emits part of a control line before its newline arrives', async () => {
    const chunks: string[] = [];
    const text = line(control('item', '{"tools":[]}'));
    const half = Math.floor(text.length / 2);
    const out = source([text.slice(0, half), text.slice(half)]).pipeThrough(controlFilter(() => chunks.push('applied')));
    expect(await read(out)).toBe('');
    expect(chunks).toEqual(['applied']);
  });

  it('passes unparseable lines and a final line without a newline', async () => {
    const out = await read(source(['not json\n\n', JSON.stringify(agent('end'))]).pipeThrough(controlFilter(() => {})));
    expect(out).toBe('not json\n' + line(agent('end')));
  });

  it('survives an unreadable control payload', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const out = await read(source([line(control('item', '{oops'))]).pipeThrough(controlFilter(() => {})));
    expect(out).toBe('');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
