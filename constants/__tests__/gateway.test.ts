import {
  DEFAULT_GATEWAY_BASE_URL,
  DEFAULT_GATEWAY_MODEL,
  resolveGatewaySetting,
} from '@/constants/gateway';

const CLOUDFLARE = /gateway\.ai\.cloudflare\.com/i;

describe('resolveGatewaySetting', () => {
  it('ignores the retired Cloudflare AI Gateway URL', () => {
    expect(
      resolveGatewaySetting(
        'https://gateway.ai.cloudflare.com/v1/abc/musclog/compat',
        DEFAULT_GATEWAY_BASE_URL,
        CLOUDFLARE
      )
    ).toBe(DEFAULT_GATEWAY_BASE_URL);
  });

  it('ignores a retired model id and empty values', () => {
    const retired = /^google-ai-studio\//i;

    expect(
      resolveGatewaySetting('google-ai-studio/gemini-2.5-flash', DEFAULT_GATEWAY_MODEL, retired)
    ).toBe(DEFAULT_GATEWAY_MODEL);
    expect(resolveGatewaySetting('  ', DEFAULT_GATEWAY_MODEL, retired)).toBe(DEFAULT_GATEWAY_MODEL);
    expect(resolveGatewaySetting(undefined, DEFAULT_GATEWAY_MODEL, retired)).toBe(
      DEFAULT_GATEWAY_MODEL
    );
  });

  it('keeps a real override', () => {
    expect(
      resolveGatewaySetting('http://localhost:8787/v1', DEFAULT_GATEWAY_BASE_URL, CLOUDFLARE)
    ).toBe('http://localhost:8787/v1');
  });
});
