import { describe, expect, it } from 'vitest';

import { age, duration, quantity } from '../../src/k8s';

describe('quantity', () => {
  it.each([
    ['100m', 0.1],
    ['1', 1],
    ['2.5', 2.5],
    ['.5', 0.5],
    ['250u', 0.00025],
    ['5n', 5e-9],
    ['1k', 1000],
    ['3M', 3e6],
    ['1G', 1e9],
    ['2T', 2e12],
    ['1P', 1e15],
    ['2E', 2e18],
    ['128Mi', 128 * 2 ** 20],
    ['1Ki', 1024],
    ['15793572Ki', 15793572 * 1024],
    ['1.5Gi', 1.5 * 2 ** 30],
    ['1Ti', 2 ** 40],
    ['1Pi', 2 ** 50],
    ['1Ei', 2 ** 60],
    ['1e3', 1000],
    ['1E3', 1000],
    ['12e-3', 0.012],
    ['-1', -1],
    ['+4', 4],
    [' 64Mi ', 64 * 2 ** 20],
  ])('%s is %d', (text, value) => {
    expect(quantity(text)).toBeCloseTo(value, 12);
  });

  it('passes numbers through', () => {
    expect(quantity(3)).toBe(3);
  });

  it.each(['', 'Mi', '1MB', '1mi', '1.2.3', 'abc', '1 Gi', '1e'])('%j is not a quantity', (text) => {
    expect(quantity(text)).toBeNaN();
  });

  it('is NaN for nothing', () => {
    expect(quantity(undefined)).toBeNaN();
    expect(quantity(null)).toBeNaN();
  });
});

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
