import {
  AiCancelledError,
  AiInvalidKeyError,
  AiTimeoutError,
  describeAiError,
  isAiTimeoutError,
  isInvalidApiKeyError,
  rethrowUserFacingAiError,
  toUserFacingAiError,
} from '../aiErrors';

/** What `@google/genai` throws for a bad key: HTTP 400, with the reason only in the payload. */
const geminiBadKey = Object.assign(
  new Error(
    '{"error":{"code":400,"message":"API key not valid. Please pass a valid API key.","status":"INVALID_ARGUMENT","details":[{"@type":"type.googleapis.com/google.rpc.ErrorInfo","reason":"API_KEY_INVALID"}]}}'
  ),
  { status: 400, name: 'ApiError' }
);
const geminiExpired = Object.assign(new Error('API key expired. Please renew the API key.'), {
  status: 400,
});
const geminiMalformed = Object.assign(
  new Error(
    '{"error":{"code":400,"message":"Invalid JSON payload received.","status":"INVALID_ARGUMENT"}}'
  ),
  { status: 400 }
);
const openAiBadKey = Object.assign(new Error('401 Incorrect API key provided: sk-***'), {
  status: 401,
  code: 'invalid_api_key',
  error: { code: 'invalid_api_key' },
});

describe('isInvalidApiKeyError', () => {
  it("recognises Gemini's HTTP 400 API_KEY_INVALID, which is not a 401", () => {
    expect(isInvalidApiKeyError(geminiBadKey)).toBe(true);
    expect(isInvalidApiKeyError(geminiExpired)).toBe(true);
  });

  it('does NOT blame the key for a malformed request that is also a 400', () => {
    expect(isInvalidApiKeyError(geminiMalformed)).toBe(false);
    expect(isInvalidApiKeyError(Object.assign(new Error('Bad schema'), { status: 400 }))).toBe(
      false
    );
  });

  it('recognises OpenAI 401 / invalid_api_key', () => {
    expect(isInvalidApiKeyError(openAiBadKey)).toBe(true);
    expect(isInvalidApiKeyError(Object.assign(new Error('x'), { status: 401 }))).toBe(true);
    expect(isInvalidApiKeyError(Object.assign(new Error('x'), { code: 'invalid_api_key' }))).toBe(
      true
    );
  });

  it('treats a 403 as a key problem only with a permission or key signal', () => {
    expect(
      isInvalidApiKeyError(
        Object.assign(new Error('Permission denied: API key lacks access'), { status: 403 })
      )
    ).toBe(true);
    expect(
      isInvalidApiKeyError(Object.assign(new Error('Region not supported'), { status: 403 }))
    ).toBe(false);
  });

  it('leaves rate limits, server errors and plain errors alone', () => {
    expect(isInvalidApiKeyError(Object.assign(new Error('rate limited'), { status: 429 }))).toBe(
      false
    );
    expect(isInvalidApiKeyError(Object.assign(new Error('overloaded'), { status: 503 }))).toBe(
      false
    );
    expect(isInvalidApiKeyError(new Error('boom'))).toBe(false);
    expect(isInvalidApiKeyError(undefined)).toBe(false);
    expect(isInvalidApiKeyError(null)).toBe(false);
  });
});

describe('toUserFacingAiError', () => {
  it('maps a bad key to AiInvalidKeyError carrying the provider', () => {
    const mapped = toUserFacingAiError(geminiBadKey, 'gemini');
    expect(mapped).toBeInstanceOf(AiInvalidKeyError);
    expect((mapped as AiInvalidKeyError).provider).toBe('gemini');
    expect(toUserFacingAiError(openAiBadKey, 'openai')).toBeInstanceOf(AiInvalidKeyError);
  });

  it('never blames a key the user did not supply (gateway, on-device, local)', () => {
    for (const provider of ['gateway', 'on-device', 'local'] as const) {
      expect(toUserFacingAiError(openAiBadKey, provider)).toBeNull();
    }
  });

  it('maps stalled requests to AiTimeoutError and passes typed errors through', () => {
    expect(
      toUserFacingAiError(
        Object.assign(new Error('x'), { name: 'APIConnectionTimeoutError' }),
        'openai'
      )
    ).toBeInstanceOf(AiTimeoutError);
    expect(toUserFacingAiError(new Error('Request timed out.'), 'gemini')).toBeInstanceOf(
      AiTimeoutError
    );
    const typed = new AiInvalidKeyError('openai');
    expect(toUserFacingAiError(typed, 'openai')).toBe(typed);
  });

  it('returns null for anything else, so the caller keeps its own fallback', () => {
    expect(toUserFacingAiError(new Error('boom'), 'gemini')).toBeNull();
    expect(
      toUserFacingAiError(Object.assign(new Error('x'), { status: 429 }), 'gemini')
    ).toBeNull();
  });
});

describe('isAiTimeoutError', () => {
  it('does not mistake a quota message for a timeout', () => {
    expect(isAiTimeoutError(new Error('You exceeded your current quota'))).toBe(false);
  });
});

describe('rethrowUserFacingAiError', () => {
  it('throws typed errors and returns for everything else', () => {
    expect(() => rethrowUserFacingAiError(new AiInvalidKeyError('gemini'))).toThrow(
      AiInvalidKeyError
    );
    expect(() => rethrowUserFacingAiError(new AiTimeoutError())).toThrow(AiTimeoutError);
    expect(() => rethrowUserFacingAiError(new AiCancelledError())).toThrow(AiCancelledError);
    expect(() => rethrowUserFacingAiError(new Error('boom'))).not.toThrow();
  });
});

describe('describeAiError', () => {
  const t = (key: string, options?: Record<string, unknown>) =>
    options ? `${key}:${JSON.stringify(options)}` : key;

  it('names the provider for a rejected key', () => {
    expect(describeAiError(new AiInvalidKeyError('gemini'), t)).toBe(
      'errors.aiInvalidApiKey:{"provider":"Gemini"}'
    );
    expect(describeAiError(new AiInvalidKeyError('openai'), t)).toContain('OpenAI');
    expect(describeAiError(new AiInvalidKeyError('claude'), t)).toContain('Claude');
  });

  it('describes a timeout and says nothing about anything else', () => {
    expect(describeAiError(new AiTimeoutError(), t)).toBe('errors.aiTimeout');
    expect(describeAiError(new AiCancelledError(), t)).toBeNull();
    expect(describeAiError(new Error('boom'), t)).toBeNull();
  });
});
