/** This build's package version. */
export const VERSION: string = __KD_VERSION__;

/**
 * Registers a custom element unless the name is taken, and says so when it is.
 *
 * Every panel on a page shares one registry, and a definition outlives SPA
 * navigation, so the first version of a tag loaded owns it until a full page
 * reload. A second define would throw; this keeps the first and warns when the
 * two builds differ.
 *
 * @returns whether this call defined the element
 */
export function define(
  name: string,
  element: CustomElementConstructor,
  registry: CustomElementRegistry = customElements,
): boolean {
  const existing = registry.get(name) as (CustomElementConstructor & { kdVersion?: string }) | undefined;
  if (existing) {
    if (existing !== element && existing.kdVersion !== VERSION) {
      console.warn(
        `@kubed.io/cdn ${VERSION}: <${name}> is already defined by ${existing.kdVersion ? `@kubed.io/cdn ${existing.kdVersion}` : 'another script'}; ` +
          'that definition stays until the page is reloaded.',
      );
    }
    return false;
  }
  Object.defineProperty(element, 'kdVersion', { value: VERSION });
  registry.define(name, element);
  return true;
}
