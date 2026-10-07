import { expect, it } from 'vitest';

import { VERSION } from '../../src/kd';

const TAGS = ['bar', 'data', 'groups', 'link', 'mask', 'meter', 'pill', 'sheet', 'steps', 'table', 'tabs', 'tile'];

it.each(TAGS)('importing kd registers kd-%s', (tag) => {
  const element = customElements.get(`kd-${tag}`) as (CustomElementConstructor & { kdVersion?: string }) | undefined;
  expect(element).toBeDefined();
  expect(element?.kdVersion).toBe(VERSION);
});
