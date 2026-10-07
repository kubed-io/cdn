// Small pieces several elements share: tones, icons and link safety.
import { css, html, nothing, type TemplateResult } from 'lit';

/** A semantic colour. Each maps to `--kd-<tone>`; neutral is the secondary text colour. */
export type Tone = 'primary' | 'success' | 'warning' | 'error' | 'info' | 'neutral';

const TONES = new Set<string>(['primary', 'success', 'warning', 'error', 'info', 'neutral']);

/** `value` when it names a tone, else `fallback`. */
export function tone(value: unknown, fallback: Tone = 'neutral'): Tone {
  return typeof value === 'string' && TONES.has(value) ? (value as Tone) : fallback;
}

/**
 * Tone classes. Each sets `--tone` (the colour), `--tone-ink` (text in that
 * colour, pulled towards the text colour so it reads on either theme) and
 * `--tone-line` (a border in that colour).
 */
export const tones = css`
  .primary {
    --tone: var(--kd-primary, currentColor);
  }
  .success {
    --tone: var(--kd-success, currentColor);
  }
  .warning {
    --tone: var(--kd-warning, currentColor);
  }
  .error {
    --tone: var(--kd-error, currentColor);
  }
  .info {
    --tone: var(--kd-info, currentColor);
  }
  .primary,
  .success,
  .warning,
  .error,
  .info {
    --tone-ink: color-mix(in srgb, var(--tone) 75%, var(--kd-text, currentColor));
    --tone-line: color-mix(in srgb, var(--tone) 50%, transparent);
  }
  .neutral {
    --tone: var(--kd-text-2, currentColor);
    --tone-ink: var(--kd-text-2, currentColor);
    --tone-line: var(--kd-border-strong, currentColor);
  }
`;

const IMAGE = /^(https?:|data:image\/|\/|\.\.?\/)/i;

/** An icon that is either an image URL or a short text such as an emoji. */
export function renderIcon(value: string | null | undefined, cls = 'icon'): TemplateResult | typeof nothing {
  if (!value) return nothing;
  return IMAGE.test(value) ? html`<img class=${cls} src=${value} alt="" />` : html`<span class=${cls}>${value}</span>`;
}

/** `href` unless it is a script or data URL, which data must never smuggle into a link. */
export function safeHref(href: string | null | undefined): string | undefined {
  if (href == null || href === '') return undefined;
  return /^\s*(javascript|vbscript|data):/i.test(href) ? undefined : href;
}
