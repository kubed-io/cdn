// Times as short text, the way the dashboards show them.

/** Seconds as kubectl-ish text: `42s`, `5m`, `3h 12m`, `2d 4h`. */
export function duration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  return `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h`;
}

/** How long ago a timestamp was, or '' without one. */
export function age(iso: string | null | undefined, now = Date.now()): string {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? duration((now - t) / 1000) : '';
}
