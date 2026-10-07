import type { Focused } from '../kd/scene';

/**
 * What the fetch wrapper acts for: the chat on screen. Kept on the page window
 * as `n8nChat` in the shape the pre-package library panel used, so a wrapper
 * installed by either one serves the other.
 */
export interface ChatHandle {
  webhook: string;
  settable: string[];
  stream: boolean;
  setVariables(vars: Record<string, unknown> | null | undefined, names: string[]): Record<string, string>;
  cleanHistory<T>(reply: T): T;
  filterStream(body: ReadableStream<Uint8Array>): ReadableStream<Uint8Array>;
}

/** The page globals the chat keeps. They outlive this module across SPA navigation and package versions. */
export interface ChatWindow extends Window {
  n8nChat?: ChatHandle | null;
  n8nChatWatch?: number;
  n8nChatFetchWrapped?: boolean;
  n8nChatFit?: () => void;
  n8nChatResize?: boolean;
  n8nChatMount?: { key: string; done: boolean; ready: Promise<void> };
  /** The resolver the agent navigates with, for the dashboard's own buttons (Torrent's use it). */
  dashboardFocus?: (target: string | number) => Focused | null;
}

/**
 * Wraps the page's fetch, once per page. The wrapper reads `n8nChat` on every
 * call, which each mount replaces, so it acts for the dashboard on screen and
 * only for its webhook.
 */
export function wrapFetch(win: ChatWindow): void {
  if (win.n8nChatFetchWrapped) return;
  win.n8nChatFetchWrapped = true;
  const base = win.fetch.bind(win);
  win.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const response = await base(input, init);
    const chat = win.n8nChat;
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : String(input?.url ?? '');
    const body = typeof init?.body === 'string' ? init.body : '';
    if (!chat || !chat.webhook || !url.includes(chat.webhook)) return response;
    if (body.includes('"sendMessage"')) {
      // n8n sends the NDJSON stream as application/json too, so the setting
      // decides, not the content type. Filtered even with nothing settable: the
      // control chunk must never render as a message.
      if (chat.stream && response.body) {
        return new Response(chat.filterStream(response.body), {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
        });
      }
      // responseMode lastNode: the variables ride on the JSON reply.
      if (chat.settable.length) {
        response
          .clone()
          .json()
          .then((reply: { dashboard_variables?: unknown }) => {
            let vars = reply?.dashboard_variables;
            if (typeof vars === 'string') vars = JSON.parse(vars);
            chat.setVariables(vars as Record<string, unknown>, chat.settable);
          })
          .catch(() => {});
      }
      return response;
    }
    if (body.includes('"loadPreviousSession"')) {
      try {
        const cleaned = chat.cleanHistory(await response.clone().json());
        return new Response(JSON.stringify(cleaned), { status: response.status, headers: response.headers });
      } catch {
        return response;
      }
    }
    return response;
  };
}
