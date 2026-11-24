import { providerPolicyFor } from '../providerPolicy';

describe('providerPolicyFor', () => {
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
