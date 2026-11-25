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

  it('gives a custom local server and the downloaded model the same small-model rules', () => {
    const local = providerPolicyFor({ provider: 'local' });
    const gguf = providerPolicyFor({ provider: 'on-device', engine: 'gguf' });

    expect(gguf).toBe(local);
    expect(local.repairsStructuredReplies).toBe(true);
    expect(local.chatSampling?.frequency_penalty).toBeGreaterThan(0);
    expect(local.chatSampling?.presence_penalty).toBeGreaterThan(0);
    expect(local.maxChatHistoryTurns).toBeGreaterThan(0);
  });

  it("gives Apple's engine only the turn cap (no sampling fields, no repair)", () => {
    for (const engine of ['apple', undefined] as const) {
      const apple = providerPolicyFor({ provider: 'on-device', engine });

      expect(apple.maxChatHistoryTurns).toBe(
        providerPolicyFor({ provider: 'local' }).maxChatHistoryTurns
      );
      expect(apple.chatSampling).toBeUndefined();
      expect(apple.repairsStructuredReplies).toBeUndefined();
    }
  });

  it('never repairs or penalises a cloud provider', () => {
    for (const provider of ['openai', 'gemini', 'claude', 'gateway', 'hosted'] as const) {
      const policy = providerPolicyFor({ provider });

      expect(policy.repairsStructuredReplies).toBeUndefined();
      expect(policy.chatSampling).toBeUndefined();
      expect(policy.maxChatHistoryTurns).toBeUndefined();
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
