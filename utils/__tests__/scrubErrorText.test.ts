import { MAX_ERROR_TEXT_CHARS, scrubErrorText } from '@/utils/scrubErrorText';

describe('scrubErrorText', () => {
  it('keeps an ordinary message and its identifiers', () => {
    const message = "Cannot read property 'name' of undefined";

    expect(scrubErrorText(message)).toBe(message);
  });

  it.each([
    ['sk-proj-abcdef123456', 'key sk-proj-abcdef123456 refused'],
    ['AIzaSyA1234567890abcdef', 'bad key AIzaSyA1234567890abcdef'],
    ['Bearer abc.def.ghi-123', 'sent Bearer abc.def.ghi-123'],
  ])('removes %s', (secret, message) => {
    expect(scrubErrorText(message)).not.toContain(secret);
  });

  it('removes quoted free text, object bodies, emails and query strings', () => {
    const scrubbed = scrubErrorText(
      'No food "Grandma apple pie" for jane@example.com at https://x.test/s?q=oats {"weight":81}'
    );

    expect(scrubbed).not.toMatch(/apple pie|jane@|q=oats|81/);
    expect(scrubbed).toContain('https://x.test/s');
  });

  it('cuts a very long message', () => {
    expect(scrubErrorText('x'.repeat(2000))).toHaveLength(MAX_ERROR_TEXT_CHARS);
  });
});
