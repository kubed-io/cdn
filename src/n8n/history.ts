interface StoredMessage {
  id?: unknown;
  kwargs?: { content?: unknown; [key: string]: unknown };
  [key: string]: unknown;
}

// LangChain tags each stored message's class in `id`, e.g.
// ['langchain_core', 'messages', 'ToolMessage']; that is the only reliable
// discriminator, as kwargs.type is absent on these.
const HIDDEN = ['ToolMessage', 'SystemMessage', 'FunctionMessage'];

function textOf(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.map((p) => (typeof p === 'string' ? p : (p as { text?: string } | null)?.text || '')).join('');
}

function kindOf(m: StoredMessage | null | undefined): string {
  return Array.isArray(m?.id) ? String(m.id[m.id.length - 1]) : '';
}

/**
 * Cleans a `loadPreviousSession` reply for the widget, whose markdown renderer
 * throws on anything but a string. Tool, system and function messages are
 * dropped (a tool message's content is the tool's raw JSON, a non-empty string
 * that would otherwise fill the reloaded chat); array content is flattened to
 * its text, and a message left with no text is dropped.
 */
export function cleanHistory<T>(reply: T): T {
  const data = (reply as { data?: unknown } | null)?.data;
  if (!Array.isArray(data)) return reply;
  const kept = (data as StoredMessage[]).flatMap((m) => {
    if (HIDDEN.includes(kindOf(m))) return [];
    const text = textOf(m?.kwargs?.content);
    return text.trim() ? [{ ...m, kwargs: { ...m.kwargs, content: text } }] : [];
  });
  return { ...reply, data: kept };
}
