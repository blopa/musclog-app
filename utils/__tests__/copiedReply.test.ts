import {
  COPY_RUN_WORDS,
  copiedShare,
  copyWords,
  createCopyGate,
  isCopiedReply,
  sharedRunShare,
} from '../copiedReply';

const PUSH_PULL_LEGS =
  'Split your week into push, pull and legs. Push covers chest, shoulders and triceps, pull covers back and biceps, and legs covers quads, hamstrings and calves. Train each one about twice a week with at least one day of rest between sessions.';

const EARLIER_ANSWER =
  'Split your week into push, pull and legs. Push covers chest, shoulders and triceps, pull covers back and biceps, and legs covers quads, hamstrings and calves.';

const UNRELATED =
  'Protein around one point six to two grams per kilogram of body weight is a good target for most lifters, spread across the day in four or five meals.';

describe('copyWords', () => {
  it('lowercases, strips accents and punctuation', () => {
    expect(copyWords("Don't stop!")).toEqual(['don', 't', 'stop']);
    expect(copyWords('Café, Ñandú')).toEqual(['cafe', 'nandu']);
  });

  it('returns no words for an empty text', () => {
    expect(copyWords('')).toEqual([]);
    expect(copyWords('  ...  ')).toEqual([]);
  });
});

describe('sharedRunShare', () => {
  it('is 1 for identical text', () => {
    expect(sharedRunShare(PUSH_PULL_LEGS, PUSH_PULL_LEGS)).toBe(1);
  });

  it('is 0 for unrelated text', () => {
    expect(sharedRunShare(UNRELATED, PUSH_PULL_LEGS)).toBe(0);
  });

  it('stays at or above the threshold for a copy with extra words at the end', () => {
    const copy = `${EARLIER_ANSWER} Keep the rest between sets at two minutes for heavy work.`;

    expect(sharedRunShare(copy, EARLIER_ANSWER)).toBeGreaterThanOrEqual(0.5);
    expect(isCopiedReply(copy, [EARLIER_ANSWER])).toBe(true);
  });

  it('ignores case, accents and punctuation', () => {
    const shouted = PUSH_PULL_LEGS.toUpperCase().replace(/[,.]/g, '!!');

    expect(sharedRunShare(shouted, PUSH_PULL_LEGS)).toBe(1);
  });

  it('gives an empty reply a share of 0', () => {
    expect(sharedRunShare('', PUSH_PULL_LEGS)).toBe(0);
  });

  it('compares short replies word for word', () => {
    expect(sharedRunShare('Rest well tonight', 'rest well tonight!')).toBe(1);
    expect(sharedRunShare('Rest well tonight', 'Eat more protein')).toBe(0);
    expect(sharedRunShare('Rest well', 'Rest well tonight')).toBe(0);
    expect(COPY_RUN_WORDS).toBe(6);
  });

  it('detects a Cyrillic copy', () => {
    const earlier =
      'Разбейте неделю на жим, тягу и ноги. Жим включает грудь, плечи и трицепс, тяга включает спину и бицепс.';

    expect(sharedRunShare(earlier, earlier)).toBe(1);
    expect(isCopiedReply(earlier, [earlier])).toBe(true);
    expect(isCopiedReply(UNRELATED, [earlier])).toBe(false);
  });
});

describe('copiedShare and isCopiedReply', () => {
  it('uses the best match over several earlier replies', () => {
    const earlier = [UNRELATED, EARLIER_ANSWER];

    expect(copiedShare(PUSH_PULL_LEGS, earlier)).toBe(
      sharedRunShare(PUSH_PULL_LEGS, EARLIER_ANSWER)
    );
    expect(isCopiedReply(PUSH_PULL_LEGS, earlier)).toBe(true);
  });

  it('is 0 for an empty list of earlier replies', () => {
    expect(copiedShare(PUSH_PULL_LEGS, [])).toBe(0);
    expect(isCopiedReply(PUSH_PULL_LEGS, [])).toBe(false);
  });
});

describe('createCopyGate', () => {
  it('holds text until the window is full, then releases it once in order', () => {
    const released: string[] = [];
    const onCopied = jest.fn();
    const gate = createCopyGate({
      earlierReplies: [EARLIER_ANSWER],
      windowWords: 10,
      release: (delta) => released.push(delta),
      onCopied,
    });

    gate.push('Protein around one point ');
    expect(released).toEqual([]);

    gate.push('six to two grams per kilogram ');
    expect(released).toEqual(['Protein around one point six to two grams per kilogram ']);

    gate.push('of body weight.');
    expect(released).toHaveLength(2);
    expect(released[1]).toBe('of body weight.');
    expect(onCopied).not.toHaveBeenCalled();
    expect(gate.isCopied()).toBe(false);
  });

  it('marks a copy once, releases nothing and ignores later pushes', () => {
    const released: string[] = [];
    const onCopied = jest.fn();
    const gate = createCopyGate({
      earlierReplies: [PUSH_PULL_LEGS],
      windowWords: 8,
      release: (delta) => released.push(delta),
      onCopied,
    });

    gate.push('Split your week into push, pull ');
    gate.push('and legs. Push covers chest');
    gate.push(', shoulders and triceps.');
    gate.finish();

    expect(onCopied).toHaveBeenCalledTimes(1);
    expect(released).toEqual([]);
    expect(gate.isCopied()).toBe(true);
  });

  it('decides a reply shorter than the window on finish, both ways', () => {
    const releasedCopy: string[] = [];
    const copyGate = createCopyGate({
      earlierReplies: ['Rest well tonight'],
      windowWords: 20,
      release: (delta) => releasedCopy.push(delta),
      onCopied: jest.fn(),
    });

    copyGate.push('Rest well tonight');
    copyGate.finish();
    expect(copyGate.isCopied()).toBe(true);
    expect(releasedCopy).toEqual([]);

    const releasedNew: string[] = [];
    const freshGate = createCopyGate({
      earlierReplies: ['Rest well tonight'],
      windowWords: 20,
      release: (delta) => releasedNew.push(delta),
      onCopied: jest.fn(),
    });

    freshGate.push('Eat more protein');
    freshGate.finish();
    expect(freshGate.isCopied()).toBe(false);
    expect(releasedNew).toEqual(['Eat more protein']);
  });

  it('does nothing on finish for an empty buffer', () => {
    const release = jest.fn();
    const onCopied = jest.fn();
    const gate = createCopyGate({
      earlierReplies: [EARLIER_ANSWER],
      windowWords: 5,
      release,
      onCopied,
    });

    gate.push('  ...  ');
    gate.finish();

    expect(release).not.toHaveBeenCalled();
    expect(onCopied).not.toHaveBeenCalled();
    expect(gate.isCopied()).toBe(false);
  });

  it('starts over after reset', () => {
    const released: string[] = [];
    const onCopied = jest.fn();
    const gate = createCopyGate({
      earlierReplies: [EARLIER_ANSWER],
      windowWords: 6,
      release: (delta) => released.push(delta),
      onCopied,
    });

    gate.push(EARLIER_ANSWER);
    expect(gate.isCopied()).toBe(true);

    gate.reset();
    expect(gate.isCopied()).toBe(false);

    gate.push(UNRELATED);
    expect(gate.isCopied()).toBe(false);
    expect(released).toEqual([UNRELATED]);
    expect(onCopied).toHaveBeenCalledTimes(1);
  });

  it('applies clean before counting words but releases the raw buffer', () => {
    const released: string[] = [];
    const gate = createCopyGate({
      earlierReplies: [EARLIER_ANSWER],
      windowWords: 6,
      clean: (raw) => raw.replace('<|im_start|>assistant\n', ''),
      release: (delta) => released.push(delta),
      onCopied: jest.fn(),
    });

    gate.push('<|im_start|>assistant\n');
    gate.push('Protein around one point six to two grams per kilogram');
    gate.finish();

    expect(gate.isCopied()).toBe(false);
    expect(released).toEqual([
      '<|im_start|>assistant\nProtein around one point six to two grams per kilogram',
    ]);
  });
});
