import { readEnvelope, trimmedText } from '@/utils/externalDocument';

const contract = { schemaId: 'musclog-test', major: 2 };

describe('readEnvelope', () => {
  it('hands back the record of a matching document', () => {
    const document = { schema: 'musclog-test', version: 2, body: 'x' };

    expect(readEnvelope(document, contract)).toEqual({ ok: true, record: document });
  });

  it('treats a fractional version as a minor revision of its integer part', () => {
    expect(readEnvelope({ schema: 'musclog-test', version: 1.5 }, contract).ok).toBe(true);
    expect(readEnvelope({ schema: 'musclog-test', version: 2.9 }, contract).ok).toBe(true);
  });

  it.each([
    ['null', null, 'notAnObject'],
    ['an array', [], 'notAnObject'],
    ['a string', 'text', 'notAnObject'],
    ['another schema', { schema: 'other', version: 1 }, 'wrongSchema'],
    ['no schema', { version: 1 }, 'wrongSchema'],
    ['a text version', { schema: 'musclog-test', version: '1' }, 'invalidVersion'],
    ['no version', { schema: 'musclog-test' }, 'invalidVersion'],
    ['version zero', { schema: 'musclog-test', version: 0 }, 'invalidVersion'],
    ['a non-finite version', { schema: 'musclog-test', version: Infinity }, 'invalidVersion'],
    ['a newer major', { schema: 'musclog-test', version: 3 }, 'newerVersion'],
    ['a newer major with a minor', { schema: 'musclog-test', version: 3.1 }, 'newerVersion'],
  ])('refuses %s', (_label, document, error) => {
    expect(readEnvelope(document, contract)).toEqual({ ok: false, error });
  });
});

describe('trimmedText', () => {
  it('trims and caps text', () => {
    expect(trimmedText('  Bench press  ', 100)).toBe('Bench press');
    expect(trimmedText('abcdef', 3)).toBe('abc');
  });

  it('is nothing for blank text and for anything that is not text', () => {
    expect(trimmedText('   ', 10)).toBeUndefined();
    expect(trimmedText('', 10)).toBeUndefined();
    expect(trimmedText(5, 10)).toBeUndefined();
    expect(trimmedText(null, 10)).toBeUndefined();
  });
});
