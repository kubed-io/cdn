/**
 * The node whose chunks drive the dashboard. Each agent workflow ends with a
 * `Dashboard State` node that writes one chunk carrying the turn's tool calls
 * as JSON, and n8n stamps every chunk with the node that wrote it.
 */
export const CONTROL_NODE = 'Dashboard State';

interface Chunk {
  type?: string;
  content?: string;
  metadata?: { nodeName?: string };
}

/**
 * Rewrites n8n's NDJSON stream on its way to the widget. The control node's
 * chunks are recognised by their author and swallowed whole - begin, item and
 * end alike, since a begin/end that got through would render an empty bubble -
 * and each item's content is handed to `onControl`. Every other line passes
 * untouched.
 *
 * Chunks split anywhere, so a partial line is held back until its newline
 * arrives (or the stream ends): a half-received control chunk never leaks.
 */
export function controlFilter(
  onControl: (payload: unknown) => void,
  node: string = CONTROL_NODE,
): TransformStream<Uint8Array, Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let carry = '';
  const pass = (line: string, out: TransformStreamDefaultController<Uint8Array>): void => {
    if (!line.trim()) return;
    let chunk: Chunk;
    try {
      chunk = JSON.parse(line) as Chunk;
    } catch {
      out.enqueue(encoder.encode(line + '\n'));
      return;
    }
    if (chunk?.metadata?.nodeName === node) {
      if (chunk.type === 'item' && chunk.content) {
        try {
          onControl(JSON.parse(chunk.content));
        } catch (e) {
          console.warn('[n8n-chat] unreadable control chunk', chunk.content, e);
        }
      }
      return;
    }
    out.enqueue(encoder.encode(line + '\n'));
  };
  return new TransformStream<Uint8Array, Uint8Array>({
    transform(bytes, out) {
      carry += decoder.decode(bytes, { stream: true });
      const lines = carry.split('\n');
      carry = lines.pop() ?? '';
      for (const line of lines) pass(line, out);
    },
    flush(out) {
      carry += decoder.decode();
      if (carry.trim()) pass(carry, out);
    },
  });
}
