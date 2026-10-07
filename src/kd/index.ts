// The core entry: the theme layer, the element base, and the generic elements.
// Importing it registers every kd-* element.
export { applyTheme, followTheme, type ThemeLike } from './theme';
export { define, VERSION } from './define';
export { KdElement, base, json, themedAncestor } from './element';
export { kdjson, registerHelpers } from './helpers';

// The generic elements. Each module registers its tag when imported.
import './elements/bar';
import './elements/data';
import './elements/groups';
import './elements/link';
import './elements/mask';
import './elements/meter';
import './elements/pill';
import './elements/sheet';
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
export { KdBar, type BarData } from './elements/bar';
export { KdData } from './elements/data';
export { KdGroups, jsonValue, type GroupsData } from './elements/groups';
export { KdLink, linkUrl, type LinkData, type Vars } from './elements/link';
export { KdMask } from './elements/mask';
export { KdMeter, type MeterData, type MeterMark } from './elements/meter';
export { KdPill } from './elements/pill';
export { KdSheet, type SheetData, type SheetRow } from './elements/sheet';
export { KdSteps, type Step, type StepStatus } from './elements/steps';
export { KdTable, type TableColumn, type TableData } from './elements/table';
export { KdTabs } from './elements/tabs';
export { KdTile } from './elements/tile';
export * from './scene';
