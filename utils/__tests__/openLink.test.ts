import {
  buildOpenSchemeUrl,
  MAX_OPEN_LINK_PAYLOAD_CHARS,
  parseOpenFragment,
  parseOpenLink,
  setPendingOpenLink,
  takePendingOpenLink,
} from '../openLink';

const PLAN = JSON.stringify({ schema: 'musclog-workout-plan', note: 'a=b&c=d #1 100%' });

beforeEach(() => setPendingOpenLink(null));

describe('parseOpenLink', () => {
  it.each([
    ['https', 'https://musclog.app/open'],
    ['scheme', 'com.werules.logger://open'],
    ['scheme with an empty authority', 'com.werules.logger:///open'],
  ])('reads a %s workout link', (_name, base) => {
    expect(parseOpenLink(`${base}#workout=${encodeURIComponent(PLAN)}`)).toEqual({
      matches: true,
      link: { kind: 'workout', payload: PLAN },
    });
  });

  it('reads a food link and ignores the kind casing', () => {
    expect(parseOpenLink('https://musclog.app/open#FOOD=%7B%7D')).toEqual({
      matches: true,
      link: { kind: 'food', payload: '{}' },
    });
  });

  it('never splits the payload, so JSON with "=" and "&" survives raw too', () => {
    expect(parseOpenLink('https://musclog.app/open#workout={"a":"b=c&d=e"}')).toEqual({
      matches: true,
      link: { kind: 'workout', payload: '{"a":"b=c&d=e"}' },
    });
  });

  it('tolerates a trailing slash and a query on the path', () => {
    expect(parseOpenLink('https://musclog.app/open/?utm_source=x#food=1').matches).toBe(true);
  });

  it.each([
    ['no fragment', 'https://musclog.app/open'],
    ['an unknown kind', 'https://musclog.app/open#cycle=%7B%7D'],
    ['no separator', 'https://musclog.app/open#workout'],
    ['an empty payload', 'https://musclog.app/open#workout='],
    ['a blank payload', 'https://musclog.app/open#workout=%20%20'],
  ])('matches but carries nothing for %s', (_name, url) => {
    expect(parseOpenLink(url)).toEqual({ matches: true, link: null });
  });

  it('refuses a payload over the size ceiling', () => {
    const big = 'x'.repeat(MAX_OPEN_LINK_PAYLOAD_CHARS + 1);
    expect(parseOpenLink(`https://musclog.app/open#workout=${big}`)).toEqual({
      matches: true,
      link: null,
    });
    expect(
      parseOpenLink(`https://musclog.app/open#workout=${'x'.repeat(MAX_OPEN_LINK_PAYLOAD_CHARS)}`)
        .matches
    ).toBe(true);
  });

  it('hands on a payload whose escapes are broken as typed', () => {
    expect(parseOpenLink('https://musclog.app/open#workout=100%')).toEqual({
      matches: true,
      link: { kind: 'workout', payload: '100%' },
    });
  });

  it.each([
    'https://musclog.app/openfoo#workout=1',
    'https://musclog.app/open/more#workout=1',
    'https://musclog.app/download#workout=1',
    'https://musclog.app/#workout=1',
    'http://musclog.app/open#workout=1',
    'https://www.musclog.app/open#workout=1',
    'https://musclog.app.evil.example/open#workout=1',
    'https://evil.example/open#workout=1',
    'https://evil.example/?next=https://musclog.app/open#workout=1',
    'com.werules.logger://?action=open-nutrition',
    'com.werules.logger://openfoo#workout=1',
    '/app/progress',
  ])('does not claim %s', (url) => {
    expect(parseOpenLink(url)).toEqual({ matches: false });
  });
});

describe('parseOpenFragment', () => {
  it('reads a fragment with or without the leading #', () => {
    expect(parseOpenFragment('#food=abc')).toEqual({ kind: 'food', payload: 'abc' });
    expect(parseOpenFragment('food=abc')).toEqual({ kind: 'food', payload: 'abc' });
  });

  it('is null for an empty fragment', () => {
    expect(parseOpenFragment('')).toBeNull();
    expect(parseOpenFragment('#')).toBeNull();
  });
});

describe('buildOpenSchemeUrl', () => {
  it('round-trips any payload through the custom-scheme link', () => {
    const link = { kind: 'food', payload: `${PLAN} ñ ✓ 🥦` } as const;
    const url = buildOpenSchemeUrl(link);

    expect(url.startsWith('com.werules.logger://open#food=')).toBe(true);
    expect(parseOpenLink(url)).toEqual({ matches: true, link });
  });
});

describe('pending open link', () => {
  it('is handed to its screen exactly once', () => {
    setPendingOpenLink({ kind: 'workout', payload: 'p' });

    expect(takePendingOpenLink('workout')).toEqual({ kind: 'workout', payload: 'p' });
    expect(takePendingOpenLink('workout')).toBeNull();
  });

  it("keeps another kind's payload for the screen that owns it", () => {
    setPendingOpenLink({ kind: 'food', payload: 'p' });

    expect(takePendingOpenLink('workout')).toBeNull();
    expect(takePendingOpenLink('food')).toEqual({ kind: 'food', payload: 'p' });
  });

  it('is replaced by a newer link', () => {
    setPendingOpenLink({ kind: 'food', payload: 'old' });
    setPendingOpenLink({ kind: 'food', payload: 'new' });

    expect(takePendingOpenLink('food')).toEqual({ kind: 'food', payload: 'new' });
  });
});
