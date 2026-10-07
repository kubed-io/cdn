/**
 * Data for a JSON attribute. Double-stash it so Handlebars escapes the quotes:
 * `<kd-table data="{{kdjson rows}}">`. Never triple-stash JSON into an
 * attribute: one `'` in the data turns the whole tag into escaped text.
 */
export function kdjson(value: unknown): string {
  return JSON.stringify(value ?? null);
}

interface Handlebars {
  registerHelper(name: string, helper: (...args: unknown[]) => unknown): void;
}

/** Registers `kdjson` on Business Text's `context.handlebars`. */
export function registerHelpers(handlebars: Handlebars): void {
  handlebars.registerHelper('kdjson', (value) => kdjson(value));
}
