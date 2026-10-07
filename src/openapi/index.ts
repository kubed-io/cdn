// The openapi entry: the schema model and the schema viewer. Importing it
// registers <kd-schema>.
import './schema';

export { VERSION } from '../kd/define';
export { applyTheme } from '../kd/theme';
export {
  KEYWORDS,
  find,
  normalize,
  shortName,
  type GroupVersionKind,
  type Keywords,
  type OpenApiDocument,
  type Root,
  type Schema,
  type SchemaNode,
  type Union,
  type Validation,
} from './model';
export { behaviours, brief, constraints, type Behaviour } from './describe';
export { KdSchema } from './schema';
