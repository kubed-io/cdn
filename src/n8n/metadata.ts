import { groups, intervalSeconds, refresh, refreshIntervals, timeRange, variableValue, type Group } from '../kd/scene';
import type { Settings } from './config';

/** The navigation map for the agent: one line per group, with its purpose from `chat_groups`. */
export function describeGroups(list: Group[], notes: Record<string, string>): string {
  return list
    .map((g) => {
      const count = `${g.panels.length} ${g.panels.length === 1 ? 'panel' : 'panels'}`;
      const head = `- ${g.name} (${g.kind}, ${count}${g.open ? ', OPEN' : ''}${g.focusable ? '' : ', pinned'})`;
      const note = notes[g.name.toLowerCase()];
      return note ? `${head}: ${note}` : head;
    })
    .join('\n');
}

/**
 * The metadata sent with every message. @n8n/chat serialises this same object
 * on each send, so every live field is a getter: the agent hears about the
 * window, refresh and layout on screen at send time, not at page load.
 */
export function chatMetadata(win: Window, s: Settings, home: string): Record<string, unknown> {
  const meta: Record<string, unknown> = {
    dashboard: home.split('/')[2] || 'unknown',
    user: s.user,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
  const live = (key: string, get: () => unknown): void => {
    Object.defineProperty(meta, key, { enumerable: true, configurable: true, get });
  };
  live('dashboardUrl', () => win.location.href);
  live('timestamp', () => new Date().toISOString());
  // Raw is what to say to a person ("now-24h"); ISO is what a query needs.
  live('timeFrom', () => timeRange(win)?.from ?? '');
  live('timeTo', () => timeRange(win)?.to ?? '');
  live('timeFromIso', () => timeRange(win)?.fromIso ?? '');
  live('timeToIso', () => timeRange(win)?.toIso ?? '');
  live('refresh', () => {
    const r = refresh(win);
    return r === null ? '' : r || 'off';
  });
  live('refreshSeconds', () => intervalSeconds(refresh(win)));
  // The only intervals the picker accepts; anything else blanks it.
  live('refreshIntervals', () => refreshIntervals(win).join(','));
  live('groups', () => describeGroups(groups(win), s.groups));
  live('openGroups', () =>
    groups(win)
      .filter((g) => g.open && g.focusable)
      .map((g) => g.name)
      .join(', '),
  );
  for (const [key, name] of s.context) live(key, () => variableValue(win, name));
  return meta;
}
