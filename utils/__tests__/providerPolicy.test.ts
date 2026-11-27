import { providerPolicyFor } from '../providerPolicy';
import { toHostedAiError } from '../hostedAiError';
import { PREMIUM_CONSENT_VERSION } from '../premium/premiumConsent';

describe('providerPolicyFor', () => {
  it('includes recorded consent on hosted requests and leaves legacy requests unmarked', () => {
    const config = { provider: 'hosted', model: 'musclog-hosted' } as const;
    const policy = providerPolicyFor(config);
    expect(policy.requestHeaders?.(config)).not.toHaveProperty('X-Musclog-Consent-Version');
    expect(
      policy.requestHeaders?.({ ...config, hostedConsentVersion: PREMIUM_CONSENT_VERSION })
    ).toHaveProperty('X-Musclog-Consent-Version', String(PREMIUM_CONSENT_VERSION));
  });

  it('tells the person to review consent without retrying a refused hosted request', () => {
    expect(toHostedAiError({ status: 403, error: { code: 'consent_required' } })).toMatchObject({
      hostedKind: 'consentRequired',
      retryable: false,
    });
  });

  it('sends finished-workout cards as one line to every small model and only to them', () => {
    for (const config of [
      { provider: 'local' },
      { provider: 'on-device', engine: 'gguf' },
      { provider: 'on-device', engine: 'apple' },
    ] as const) {
      expect(providerPolicyFor(config).compactWorkoutCards).toBe(true);
    }

    for (const provider of ['openai', 'gemini', 'claude', 'hosted', 'gateway'] as const) {
      expect(providerPolicyFor({ provider }).compactWorkoutCards).toBeUndefined();
    }
  });

  it('asks for voice commands in a native tool-call format only on the downloaded model', () => {
    expect(providerPolicyFor({ provider: 'on-device', engine: 'gguf' }).nativeToolCalls).toBe(true);

    for (const config of [
      { provider: 'on-device', engine: 'apple' },
      { provider: 'local' },
      { provider: 'openai' },
      { provider: 'gemini' },
      { provider: 'claude' },
      { provider: 'hosted' },
      { provider: 'gateway' },
    ] as const) {
      expect(providerPolicyFor(config).nativeToolCalls).toBeUndefined();
    }
  });

  it('never runs the chat review on an on-device engine, and only there', () => {
    for (const config of [
      { provider: 'on-device', engine: 'gguf' },
      { provider: 'on-device', engine: 'apple' },
      { provider: 'on-device', engine: undefined },
    ] as const) {
      expect(providerPolicyFor(config).skipsChatReview).toBe(true);
    }

    for (const provider of ['local', 'openai', 'gemini', 'claude', 'hosted', 'gateway'] as const) {
      expect(providerPolicyFor({ provider }).skipsChatReview).toBeUndefined();
    }
  });

  it('gives a custom local server and the downloaded model the same small-model rules', () => {
    const local = providerPolicyFor({ provider: 'local' });
    const gguf = providerPolicyFor({ provider: 'on-device', engine: 'gguf' });

    expect(gguf).toMatchObject({
      maxChatHistoryTurns: local.maxChatHistoryTurns,
      structuredReplies: local.structuredReplies,
      runsSamplesSequentially: true,
    });
    expect(local.structuredReplies).toBe('repaired');
    expect(local.chatSampling?.frequency_penalty).toBeGreaterThan(0);
    expect(local.chatSampling?.presence_penalty).toBeGreaterThan(0);
    expect(local.maxChatHistoryTurns).toBeGreaterThan(0);
    // The downloaded model takes its vendor sampling from its manifest, not from penalties.
    expect(gguf.chatSampling).toBeUndefined();
  });

  it('rewrites a copied chat reply on the downloaded model only, where it was measured', () => {
    expect(
      providerPolicyFor({ provider: 'on-device', engine: 'gguf' }).regeneratesCopiedChatReply
    ).toBe(true);

    for (const config of [
      { provider: 'on-device', engine: 'apple' },
      { provider: 'on-device', engine: undefined },
      { provider: 'local' },
      { provider: 'openai' },
      { provider: 'gemini' },
      { provider: 'claude' },
      { provider: 'hosted' },
      { provider: 'gateway' },
    ] as const) {
      expect(providerPolicyFor(config).regeneratesCopiedChatReply).toBeUndefined();
    }
  });

  it('skips the insight fact-check rounds on the downloaded model only, where it was measured', () => {
    expect(providerPolicyFor({ provider: 'on-device', engine: 'gguf' }).skipsInsightFactCheck).toBe(
      true
    );

    for (const config of [
      { provider: 'on-device', engine: 'apple' },
      { provider: 'local' },
      { provider: 'openai' },
      { provider: 'gemini' },
      { provider: 'claude' },
      { provider: 'hosted' },
      { provider: 'gateway' },
    ] as const) {
      expect(providerPolicyFor(config).skipsInsightFactCheck).toBeUndefined();
    }
  });

  it("gives Apple's engine only the turn cap (no sampling fields, no repair)", () => {
    for (const engine of ['apple', undefined] as const) {
      const apple = providerPolicyFor({ provider: 'on-device', engine });

      expect(apple.maxChatHistoryTurns).toBe(
        providerPolicyFor({ provider: 'local' }).maxChatHistoryTurns
      );
      expect(apple.chatSampling).toBeUndefined();
      expect(apple.structuredReplies).toBeUndefined();
    }
  });

  it('never repairs or penalises a cloud provider', () => {
    for (const provider of ['openai', 'gemini', 'claude', 'gateway', 'hosted'] as const) {
      const policy = providerPolicyFor({ provider });

      expect(policy.structuredReplies).not.toBe('repaired');
      expect(policy.chatSampling).toBeUndefined();
      expect(policy.maxChatHistoryTurns).toBeUndefined();
    }
  });
});

describe('answersPainWithFixedReply', () => {
  it('is set only on the downloaded model without its text model', () => {
    expect(
      providerPolicyFor({ provider: 'on-device', engine: 'gguf' }).answersPainWithFixedReply
    ).toBe(true);
    expect(
      providerPolicyFor({ provider: 'on-device', engine: 'gguf', textModel: false })
        .answersPainWithFixedReply
    ).toBe(true);

    for (const config of [
      { provider: 'on-device', engine: 'gguf', textModel: true },
      { provider: 'on-device', engine: 'apple' },
      { provider: 'local' },
      { provider: 'openai' },
      { provider: 'hosted' },
    ] as const) {
      expect(providerPolicyFor(config).answersPainWithFixedReply).toBeUndefined();
    }
  });
});

describe('runsSamplesSequentially', () => {
  it('is set for the small model and both on-device engines only', () => {
    expect(providerPolicyFor({ provider: 'local' }).runsSamplesSequentially).toBe(true);
    expect(
      providerPolicyFor({ provider: 'on-device', engine: 'gguf' }).runsSamplesSequentially
    ).toBe(true);
    expect(
      providerPolicyFor({ provider: 'on-device', engine: 'apple' }).runsSamplesSequentially
    ).toBe(true);
    expect(providerPolicyFor({ provider: 'openai' }).runsSamplesSequentially).toBeUndefined();
    expect(providerPolicyFor({ provider: 'hosted' }).runsSamplesSequentially).toBeUndefined();
  });
});

describe('what a provider does with a structured reply', () => {
  it('trusts the schema of the cloud providers that enforce it', () => {
    for (const provider of ['openai', 'gemini', 'claude', 'hosted'] as const) {
      expect(providerPolicyFor({ provider }).structuredReplies).toBe('enforced');
    }
  });

  it('checks and repairs what a small model writes', () => {
    expect(providerPolicyFor({ provider: 'local' }).structuredReplies).toBe('repaired');
    expect(providerPolicyFor({ provider: 'on-device', engine: 'gguf' }).structuredReplies).toBe(
      'repaired'
    );
  });

  it('leaves the free tier and Apple’s engine as they are', () => {
    expect(providerPolicyFor({ provider: 'gateway' }).structuredReplies).toBeUndefined();
    expect(
      providerPolicyFor({ provider: 'on-device', engine: 'apple' }).structuredReplies
    ).toBeUndefined();
  });
});

describe('what only the on-device engines and a custom server do differently', () => {
  const onDevice = [
    providerPolicyFor({ provider: 'on-device', engine: 'gguf' }),
    providerPolicyFor({ provider: 'on-device', engine: 'apple' }),
  ];

  it('skips the first look at a meal, and estimates foods by label, on both on-device engines', () => {
    for (const policy of onDevice) {
      expect(policy.skipsMealFirstLook).toBe(true);
      expect(policy.estimatesFoodsFromLabels).toBe(true);
      expect(policy.structuredFailureIsNoAnswer).toBe(true);
    }
  });

  it('leaves a custom local server and the cloud providers on the full pipeline', () => {
    for (const provider of ['local', 'openai', 'gemini', 'claude', 'gateway', 'hosted'] as const) {
      const policy = providerPolicyFor({ provider });

      expect(policy.skipsMealFirstLook).toBeUndefined();
      expect(policy.estimatesFoodsFromLabels).toBeUndefined();
      expect(policy.structuredFailureIsNoAnswer).toBeUndefined();
    }
  });

  it('keeps a custom server’s partial structured reply and no other provider’s', () => {
    expect(providerPolicyFor({ provider: 'local' }).keepsPartialStructuredReply).toBe(true);
    expect(
      providerPolicyFor({ provider: 'on-device', engine: 'gguf' }).keepsPartialStructuredReply
    ).toBeUndefined();
    expect(providerPolicyFor({ provider: 'openai' }).keepsPartialStructuredReply).toBeUndefined();
  });
});

describe('maxVoiceTools', () => {
  it('limits the downloaded models to three tools, with or without the text model', () => {
    expect(providerPolicyFor({ provider: 'on-device', engine: 'gguf' }).maxVoiceTools).toBe(3);
    expect(
      providerPolicyFor({ provider: 'on-device', engine: 'gguf', textModel: true }).maxVoiceTools
    ).toBe(3);
  });

  it('limits Apple and a custom local server to five tools', () => {
    expect(providerPolicyFor({ provider: 'on-device', engine: 'apple' }).maxVoiceTools).toBe(5);
    expect(providerPolicyFor({ provider: 'local' }).maxVoiceTools).toBe(5);
  });

  it('leaves cloud providers unlimited', () => {
    for (const provider of ['hosted', 'gateway', 'gemini', 'openai', 'claude'] as const) {
      expect(providerPolicyFor({ provider }).maxVoiceTools).toBeUndefined();
    }
  });
});
