// The file elements and the provider contract. Importing it registers
// <kd-files> and <kd-file>.
import './explorer';
import './file';

export { KdFiles, type FileColumn, type FilesEventDetail } from './explorer';
// kd-file's `base` is kd-markdown's MarkdownBase, which kd exports from there.
export { KdFile, blobText, fileKind, looksBinary, type FileKind, type FileLink } from './file';
export { staticProvider, type StaticOptions } from './static';
export {
  basename,
  dirname,
  entryName,
  formatSize,
  modifiedTime,
  normalizePath,
  type Capabilities,
  type Entry,
  type FileContent,
  type Provider,
} from './types';
