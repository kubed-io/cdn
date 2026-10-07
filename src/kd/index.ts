// The core entry: the theme layer, the element base, and the generic elements.
// Importing it registers every kd-* element.
export { applyTheme, followTheme, type ThemeLike } from './theme';
export { define, VERSION } from './define';
export { KdElement, base, json, themedAncestor } from './element';
export { kdjson, registerHelpers } from './helpers';
