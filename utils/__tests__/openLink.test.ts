import {
  buildOpenHttpsUrl,
  buildOpenSchemeUrl,
  encodeOpenPayload,
  findOpenLinkInText,
  MAX_OPEN_LINK_PAYLOAD_CHARS,
  OPEN_LINK_BASE_URL,
  parseOpenFragment,
  parseOpenLink,
} from '../openLink';
import {
  setPendingOpenLink,
  subscribePendingOpenLink,
  takePendingOpenLink,
} from '../openLinkInbox';

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

describe('encodeOpenPayload', () => {
  it('leaves only the RFC 3986 unreserved characters alone', () => {
    expect(encodeOpenPayload('AZaz09-_.~')).toBe('AZaz09-_.~');
    expect(encodeOpenPayload('Bench press (barbell)!')).toBe('Bench%20press%20%28barbell%29%21');
    expect(encodeOpenPayload("it's 5*5")).toBe('it%27s%205%2A5');
    expect(encodeOpenPayload('100% ñ ✓ 🥦')).toMatch(
      /^100%25%20%C3%B1%20%E2%9C%93%20%F0%9F%A5%A6$/
    );
  });

  it('never emits a character that ends a markdown link or a URL early', () => {
    expect(encodeOpenPayload(`${PLAN}() []<>"'\\`)).toMatch(/^[A-Za-z0-9\-_.~%]*$/);
  });

  it('round-trips through decodeURIComponent', () => {
    const text = `${PLAN} (x) ! * ' ñ 🥦`;
    expect(decodeURIComponent(encodeOpenPayload(text))).toBe(text);
  });
});

describe('buildOpenHttpsUrl', () => {
  it('is the shape the assistant is told to write and parses back', () => {
    const link = { kind: 'workout', payload: `${PLAN} (barbell) ñ` } as const;
    const url = buildOpenHttpsUrl(link);

    expect(url.startsWith(`${OPEN_LINK_BASE_URL}#workout=`)).toBe(true);
    expect(parseOpenLink(url)).toEqual({ matches: true, link });
  });
});

describe('findOpenLinkInText', () => {
  const link = { kind: 'food', payload: '{"a":"(b)"}' } as const;
  const url = buildOpenHttpsUrl(link);

  it.each([
    ['a markdown link', `Here you go: [Open in Musclog](${url}) enjoy`],
    ['an angle-bracket link', `<${url}>`],
    ['a bare URL', `Tap ${url}\nthen done`],
    ['a quoted URL', `href="${url}"`],
    ['the custom scheme', buildOpenSchemeUrl(link)],
    ['a whole copied message', `Sure!\n\n[Open in Musclog](${url})\n\n\`\`\`json\n{}\n\`\`\`\n`],
  ])('finds the link in %s', (_name, text) => {
    expect(findOpenLinkInText(text)).toEqual(link);
  });

  it('returns the first link that carries a payload', () => {
    expect(findOpenLinkInText(`${OPEN_LINK_BASE_URL} then ${url}`)).toEqual(link);
  });

  it.each([
    'no link here',
    'https://evil.example/open#food=%7B%7D',
    'https://musclog.app/download#food=%7B%7D',
    'https://musclog.app/openfoo#food=%7B%7D',
    'https://musclog.app/open',
    'https://musclog.app/open#cycle=%7B%7D',
  ])('finds nothing in %s', (text) => {
    expect(findOpenLinkInText(text)).toBeNull();
  });
});

describe('subscribePendingOpenLink', () => {
  it('notifies listeners when a link is stored, until they unsubscribe', () => {
    const listener = jest.fn();
    const unsubscribe = subscribePendingOpenLink(listener);

    setPendingOpenLink({ kind: 'food', payload: 'p' });
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    setPendingOpenLink({ kind: 'food', payload: 'q' });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
