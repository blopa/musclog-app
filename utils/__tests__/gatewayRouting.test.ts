import { withGatewayProviderPin } from '../gatewayRouting';

describe('withGatewayProviderPin', () => {
  it('adds the provider pin to a JSON object body', () => {
    const out = withGatewayProviderPin(
      JSON.stringify({ model: 'm', messages: [] }),
      'google-ai-studio'
    );

    expect(JSON.parse(out as string)).toEqual({
      model: 'm',
      messages: [],
      provider: { only: ['google-ai-studio'], allow_fallbacks: false },
    });
  });

  it('replaces a provider field, so the free tier never asks for zdr or data_collection deny', () => {
    const body = JSON.stringify({
      model: 'm',
      provider: { zdr: true, data_collection: 'deny', order: ['x'] },
    });

    expect(JSON.parse(withGatewayProviderPin(body, 'google-ai-studio') as string).provider).toEqual(
      {
        only: ['google-ai-studio'],
        allow_fallbacks: false,
      }
    );
  });

  it('drops a models fallback list and plugins', () => {
    const out = JSON.parse(
      withGatewayProviderPin(
        JSON.stringify({ model: 'm', models: ['a'], plugins: [{ id: 'web' }] }),
        'g'
      ) as string
    );

    expect(out).not.toHaveProperty('models');
    expect(out).not.toHaveProperty('plugins');
  });

  it('adds max_tokens only when the request names no output limit', () => {
    const parse = (o: object) =>
      JSON.parse(withGatewayProviderPin(JSON.stringify(o), 'g', 2048) as string);

    expect(parse({ model: 'm' }).max_tokens).toBe(2048);
    expect(parse({ model: 'm', max_tokens: 100 }).max_tokens).toBe(100);
    expect(parse({ model: 'm', max_completion_tokens: 50 })).not.toHaveProperty('max_tokens');
  });

  it('leaves non-JSON, non-object and non-string bodies untouched', () => {
    const form = new FormData();

    expect(withGatewayProviderPin('not json', 'g')).toBe('not json');
    expect(withGatewayProviderPin('[1,2]', 'g')).toBe('[1,2]');
    expect(withGatewayProviderPin(form, 'g')).toBe(form);
    expect(withGatewayProviderPin(null, 'g')).toBeNull();
  });

  it('does nothing without a slug', () => {
    expect(withGatewayProviderPin('{"a":1}', '')).toBe('{"a":1}');
  });
});
