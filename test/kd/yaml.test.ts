import { describe, expect, it } from 'vitest';

import { quote, toYaml, yamlLines } from '../../src/kd';

describe('toYaml', () => {
  it('writes scalars plainly', () => {
    expect(toYaml('web')).toBe('web');
    expect(toYaml(42)).toBe('42');
    expect(toYaml(1.5)).toBe('1.5');
    expect(toYaml(true)).toBe('true');
    expect(toYaml(null)).toBe('null');
    expect(toYaml({})).toBe('{}');
    expect(toYaml([])).toBe('[]');
  });

  it('quotes only strings a plain scalar would misread', () => {
    for (const s of ['', 'true', 'No', 'null', '~', '123', '1.5', '0x1f', '1e3', '2026-10-07', '2026-10-07T10:00:00Z']) {
      expect(quote(s), s).toBe(JSON.stringify(s));
    }
    for (const s of ['- x', ': x', '? x', '#x', '*x', '&x', '!x', '|x', '>x', '%x', '@x', '`x', '{x', '[x', '"x', "'x"]) {
      expect(quote(s), s).toBe(JSON.stringify(s));
    }
    for (const s of ['a: b', 'a #b', 'a:', ' a', 'a ', 'a\tb', 'a\u0007b']) {
      expect(quote(s), s).toBe(JSON.stringify(s));
    }
    for (const s of ['web', '-x', 'a:b', 'http://example.com/a?b=c', 'a#b', 'v1.2.3', 'Hello, world', 'trueish', '500m', 'éclair']) {
      expect(quote(s), s).toBe(s);
    }
  });

  it('lays out objects and lists the way kubectl does', () => {
    const value = {
      metadata: { name: 'web', labels: { app: 'web', 'app.kubernetes.io/part-of': 'shop' } },
      spec: {
        replicas: 2,
        containers: [{ name: 'c', ports: [80, 443], env: [] }],
        selector: {},
      },
    };
    expect(toYaml(value)).toBe(
      [
        'metadata:',
        '  name: web',
        '  labels:',
        '    app: web',
        '    app.kubernetes.io/part-of: shop',
        'spec:',
        '  replicas: 2',
        '  containers:',
        '  - name: c',
        '    ports:',
        '    - 80',
        '    - 443',
        '    env: []',
        '  selector: {}',
      ].join('\n'),
    );
  });

  it('nests lists in lists and objects in lists', () => {
    expect(toYaml([[1, 2], [3], { a: 1, b: [true] }, null])).toBe(
      ['- - 1', '  - 2', '- - 3', '- a: 1', '  b:', '  - true', '- null'].join('\n'),
    );
  });

  it('writes multi-line strings as literal blocks', () => {
    expect(toYaml({ run: 'echo a\necho b' })).toBe('run: |-\n  echo a\n  echo b');
    expect(toYaml({ run: 'echo a\n' })).toBe('run: |\n  echo a');
    expect(toYaml({ run: 'a\n\n' })).toBe('run: |+\n  a\n');
    expect(toYaml(['  indented\nnext'])).toBe('- |2-\n    indented\n  next');
    expect(toYaml({ s: 'a\n\nb' })).toBe('s: |-\n  a\n\n  b');
  });

  it('quotes keys that need it and skips undefined values', () => {
    expect(toYaml({ 'a: b': 1, true: 2, gone: undefined, '': 3 })).toBe('"a: b": 1\n"true": 2\n"": 3');
    expect(toYaml([{ gone: undefined }])).toBe('- {}');
  });

  it('tags tokens for highlighting', () => {
    const kinds = yamlLines({ s: 'x', num: 1, b: false, z: null }).map((line) =>
      line.tokens.filter((t) => t.kind !== 'plain').map((t) => `${t.kind}:${t.text}`),
    );
    expect(kinds).toEqual([
      ['key:s', 'str:x'],
      ['key:num', 'num:1'],
      ['key:b', 'bool:false'],
      ['key:z', 'null:null'],
    ]);
  });
});
