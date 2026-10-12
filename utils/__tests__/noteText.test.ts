import { MAX_NOTE_LENGTH, normalizeNote } from '@/utils/noteText';

describe('normalizeNote', () => {
  it('trims', () => {
    expect(normalizeNote('  elbows tucked \n')).toBe('elbows tucked');
  });

  it.each([undefined, null, '', '   ', '\n\t '])('treats %p as no note', (raw) => {
    expect(normalizeNote(raw as string | null | undefined)).toBeUndefined();
  });

  it('caps the length', () => {
    expect(normalizeNote('a'.repeat(MAX_NOTE_LENGTH + 10))).toHaveLength(MAX_NOTE_LENGTH);
  });

  it('keeps interior line breaks, which a multi-line note needs', () => {
    expect(normalizeNote('one\ntwo')).toBe('one\ntwo');
  });
});
