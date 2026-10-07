// The k8s entry: what only Kubernetes knows - kind icons, links to the k8s-*
// views, and the mapping of API objects onto the kd elements. Importing it
// registers every kd-* element and <kd-k8s-ref>, <kd-k8s-events>, <kd-k8s-object>.
import '../kd/index';
import './elements/events';
import './elements/object';
import './elements/ref';

export { VERSION } from '../kd/define';
export { applyTheme } from '../kd/theme';
export { CRD_ICON, DEFAULT_ICON, GROUP_ICONS, KIND_ICONS, apiGroup, isBuiltInGroup, kindIcon } from './icons';
export {
  DASHBOARDS,
  WORKLOAD_KINDS,
  apiPath,
  definitionRoute,
  kindLink,
  namespaceLink,
  namespaceRoute,
  plural,
  refLink,
  route,
  type LinkOptions,
  type ObjectRef,
  type RefCell,
  type Route,
} from './links';
export {
  HIDDEN_ANNOTATIONS,
  NEGATIVE_CONDITIONS,
  age,
  annotations,
  bar,
  chips,
  conditionOk,
  conditions,
  duration,
  labels,
  owners,
  quantity,
  resources,
  summary,
  trimmed,
  type Condition,
  type ContainerLike,
  type K8sObject,
  type MapOptions,
  type ObjectMeta,
  type OwnerReference,
  type ResourceMeter,
  type ResourceRequirements,
} from './map';
export {
  WARNING_REASONS,
  eventRows,
  eventsTable,
  foldEvents,
  isWarning,
  type EventColumns,
  type EventGroup,
  type EventLabels,
  type EventRow,
} from './events';
export { KdK8sEvents } from './elements/events';
export { KdK8sObject } from './elements/object';
export { KdK8sRef } from './elements/ref';
