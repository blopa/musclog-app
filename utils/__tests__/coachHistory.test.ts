import {
  describePause,
  formatLocalDateTime,
  historyText,
  LONG_PAUSE_MS,
  OLD_TURN_MAX_CHARS,
  shortenForHistory,
  tagTurnsWithTime,
  timeTag,
  VERBATIM_TURNS,
} from '../coachHistory';

// 2026-11-22 14:05 local
const NOW = new Date(2026, 10, 22, 14, 5).getTime();
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

describe('formatLocalDateTime / timeTag', () => {
  it('uses one local date format with the weekday', () => {
    expect(formatLocalDateTime(NOW)).toBe('2026-11-22 Sun 14:05');
    expect(timeTag(NOW)).toBe('[2026-11-22 Sun 14:05]');
  });

  it('says how long the pause was only when it was long', () => {
    expect(timeTag(NOW, NOW - 2 * HOUR)).toBe('[2026-11-22 Sun 14:05]');
    expect(timeTag(NOW, NOW - LONG_PAUSE_MS)).toContain('since the last message');
    expect(timeTag(NOW, NOW - 21 * DAY)).toBe(
      '[2026-11-22 Sun 14:05 · 3 weeks since the last message]'
    );
  });
});

describe('describePause', () => {
  it.each([
    [HOUR, '1 hour'],
    [30 * HOUR, '30 hours'],
    [3 * DAY, '3 days'],
    [21 * DAY, '3 weeks'],
    [90 * DAY, '3 months'],
  ])('%d ms -> %s', (ms, expected) => {
    expect(describePause(ms)).toBe(expected);
  });
});

describe('shortenForHistory', () => {
  it('leaves short text alone and flattens whitespace', () => {
    expect(shortenForHistory('a\n\n b  c')).toBe('a b c');
  });

  it('cuts at a sentence when one is near the end, else at a word', () => {
    const sentence = `${'Word '.repeat(40)}done. ${'More '.repeat(40)}`;
    const cut = shortenForHistory(sentence, 250);
    expect(cut.endsWith('done.')).toBe(true);
    expect(cut.length).toBeLessThanOrEqual(250);

    const noPunctuation = shortenForHistory('lorem '.repeat(100), 100);
    expect(noPunctuation.endsWith('…')).toBe(true);
    expect(noPunctuation.length).toBeLessThanOrEqual(101);
  });
});

describe('historyText', () => {
  const long = 'This is a long coach reply. '.repeat(30);

  it('returns recent turns word for word', () => {
    expect(historyText(long, 'summary', 0)).toBe(long);
    expect(historyText(long, 'summary', VERBATIM_TURNS - 1)).toBe(long);
  });

  it('uses the stored summary of an older turn, else shortens it locally', () => {
    expect(historyText(long, 'old summary', VERBATIM_TURNS)).toBe('old summary');
    expect(historyText(long, null, VERBATIM_TURNS).length).toBeLessThanOrEqual(OLD_TURN_MAX_CHARS);
    expect(historyText(long, '  ', VERBATIM_TURNS).length).toBeLessThanOrEqual(OLD_TURN_MAX_CHARS);
  });
});

describe('tagTurnsWithTime', () => {
  it('tags user turns and the new message, never coach turns', () => {
    const history = [
      { role: 'user' as const, content: 'hi', at: NOW - 30 * DAY },
      { role: 'coach' as const, content: 'hello', at: NOW - 30 * DAY + 1000 },
    ];

    const out = tagTurnsWithTime(history, 'back again', NOW);

    expect(out.history[0].content).toMatch(/^\[\d{4}-\d{2}-\d{2} \w{3} \d{2}:\d{2}\] hi$/);
    expect(out.history[1].content).toBe('hello');
    expect(out.userMessage).toContain('4 weeks since the last message');
    expect(out.userMessage.endsWith('back again')).toBe(true);
  });

  it('does not mutate the input and skips turns with no timestamp', () => {
    const history = [{ role: 'user' as const, content: 'hi' }];

    const out = tagTurnsWithTime(history, 'x', NOW);

    expect(history[0].content).toBe('hi');
    expect(out.history[0].content).toBe('hi');
    expect(out.userMessage).toBe('[2026-11-22 Sun 14:05] x');
  });
});
