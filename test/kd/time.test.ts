import { describe, expect, it } from 'vitest';

import * as k8s from '../../src/k8s';
import { age, duration } from '../../src/kd';

describe('duration and age', () => {
  it.each([
    [0, '0s'],
    [59.9, '59s'],
    [60, '1m'],
    [3599, '59m'],
    [3600, '1h 0m'],
    [3 * 3600 + 12 * 60, '3h 12m'],
    [86400 * 2 + 4 * 3600 + 5, '2d 4h'],
    [-5, '0s'],
  ])('%d seconds is %s', (s, text) => {
    expect(duration(s)).toBe(text);
  });

  it('measures an age to now', () => {
    expect(age('2026-10-07T10:00:00Z', Date.parse('2026-10-07T12:30:00Z'))).toBe('2h 30m');
    expect(age(undefined)).toBe('');
    expect(age('not a time')).toBe('');
  });
});

it('k8s re-exports the same time helpers', () => {
  expect(k8s.age).toBe(age);
  expect(k8s.duration).toBe(duration);
});
