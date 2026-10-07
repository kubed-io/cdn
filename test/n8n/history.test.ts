import { describe, expect, it } from 'vitest';

import { cleanHistory } from '../../src/n8n';

const msg = (kind: string, content: unknown) => ({ lc: 1, id: ['langchain_core', 'messages', kind], kwargs: { content, extra: 1 } });

describe('cleanHistory', () => {
  it('keeps text turns, flattens parts, drops tools, systems and empties', () => {
    const reply = {
      data: [
        msg('HumanMessage', 'show me the pods'),
        msg('AIMessage', [{ type: 'text', text: 'Three ' }, 'pods', { type: 'tool_use', id: 'x' }]),
        msg('AIMessage', []),
        msg('AIMessage', '   '),
        msg('ToolMessage', '[{"ok":true,"panelId":5}]'),
        msg('SystemMessage', 'You are...'),
        msg('FunctionMessage', 'x'),
      ],
    };
    const cleaned = cleanHistory(reply);
    expect(cleaned.data).toEqual([msg('HumanMessage', 'show me the pods'), msg('AIMessage', 'Three pods')]);
    expect(reply.data).toHaveLength(7);
  });

  it('leaves anything else alone', () => {
    expect(cleanHistory(null)).toBeNull();
    const other = { data: 'nope' };
    expect(cleanHistory(other)).toBe(other);
  });
});
