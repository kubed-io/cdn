// The github entry: a git tree as kd-files entries, URLs at a commit, and the
// Repo dashboard's activity joins. Importing it registers <kd-files> and
// <kd-file> (and every kd element, kd-code and kd-markdown among them, which
// kd-file renders); feed() and variable() make a panel's afterRender one line.
import '../kd/index';
import '../kd/files';

export { VERSION } from '../kd/define';
export { applyTheme } from '../kd/theme';
export { feed, variable, type FeedContext, type FeedMap } from '../kd/feed';
export { pathHash } from './hash';
export { blobUrl, codeServerUrl, rawUrl, readmeBase, treeUrl, type CodeServerOptions } from './urls';
export { treeEntries, treeOid, treeRows, type TreeOptions, type TreeRow } from './tree';
export {
  ACTIVITY_COLUMNS,
  ACTIVITY_EVENTS,
  activityByHash,
  activityStats,
  claudeEdits,
  lineCount,
  lineDiff,
  projectPrefixes,
  withActivity,
  withStats,
  type Activity,
  type ClaudeEdit,
} from './activity';
