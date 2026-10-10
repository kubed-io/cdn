// The core entry: the theme layer, the element base, and the generic elements.
// Importing it registers every kd-* element.
export { applyTheme, followTheme, type ThemeLike } from './theme';
export { define, VERSION } from './define';
export { KdElement, base, json, themedAncestor } from './element';
export { kdjson, registerHelpers } from './helpers';

// The generic elements. Each module registers its tag when imported.
import './elements/accordion';
import './elements/bar';
import './elements/card';
import './elements/code';
import './elements/data';
import './elements/groups';
import './elements/link';
import './elements/markdown';
import './elements/mask';
import './elements/meter';
import './elements/pill';
import './elements/reveal';
import './elements/sheet';
import './elements/split';
import './elements/status';
import './elements/steps';
import './elements/table';
import './elements/tabs';
import './elements/tile';

export {
  renderCell,
  cellStyles,
  isEmpty,
  type Cell,
  type PillCell,
  type HrefCell,
  type DashboardCell,
  type DataCell,
  type CodeCell,
} from './cell';
export { renderIcon, safeHref, tone, tones, type Tone } from './parts';
export { toYaml, yamlLines, quote, type YamlKind, type YamlLine, type YamlToken } from './yaml';
export { age, duration } from './time';
export { KdAccordion } from './elements/accordion';
export { KdBar, type BarData } from './elements/bar';
export { KdCard, type CardData } from './elements/card';
export { KdCode, highlighter, lineSet } from './elements/code';
export { KdData } from './elements/data';
export { KdGroups, jsonValue, type GroupsData } from './elements/groups';
export { KdLink, linkUrl, type LinkData, type Vars } from './elements/link';
export { KdMarkdown, rebase, slug, type MarkdownBase } from './elements/markdown';
export { KdMask, revealAll } from './elements/mask';
export { KdMeter, type MeterData, type MeterMark } from './elements/meter';
export { KdPill } from './elements/pill';
export { KdReveal } from './elements/reveal';
export { KdSheet, type SheetData, type SheetRow } from './elements/sheet';
export { KdSplit, type SplitDetail, type SplitItem } from './elements/split';
export { KdStatus, checkTone, type Check, type StatusData } from './elements/status';
export { KdSteps, type Step, type StepStatus } from './elements/steps';
export { KdTable, type TableColumn, type TableData } from './elements/table';
export { KdTabs } from './elements/tabs';
export { KdTile } from './elements/tile';
export * from './scene';
// The scene's variable() is a SceneVariable; this one is the panel's view of its value.
export { feed, variable as contextVariable, type FeedContext, type FeedMap } from './feed';
export type { Highlighted } from './highlight';
import './files';
export * from './files';
