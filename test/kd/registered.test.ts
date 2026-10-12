import { expect, it } from 'vitest';

import { VERSION } from '../../src/kd';

const TAGS = ['accordion', 'bar', 'card', 'data', 'feature', 'groups', 'link', 'mask', 'meter', 'pill', 'reveal', 'sheet', 'shelf', 'split', 'status', 'steps', 'table', 'tabs', 'tile'];

it.each(TAGS)('importing kd registers kd-%s', (tag) => {
  const element = customElements.get(`kd-${tag}`) as (CustomElementConstructor & { kdVersion?: string }) | undefined;
  expect(element).toBeDefined();
  expect(element?.kdVersion).toBe(VERSION);
});
