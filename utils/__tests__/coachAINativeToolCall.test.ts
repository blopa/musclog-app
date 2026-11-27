import { AiCancelledError } from '../aiErrors';
import { type CoachAIConfig, requestNativeToolCall } from '../coachAI';
import { clearLlmUsage, getRecentLlmUsage } from '../llmUsage';

const mockSendLocalToolCall = jest.fn();
const mockLogJsonEvent = jest.fn();

jest.mock('../onDeviceAi', () => ({
  sendOnDeviceMessage: jest.fn(),
  sendOnDeviceStructured: jest.fn(),
  streamOnDeviceMessage: jest.fn(),
}));
jest.mock('../onDeviceLocal', () => ({
  sendLocalMessage: jest.fn(),
  streamLocalMessage: jest.fn(),
  sendLocalStructuredRaw: jest.fn(),
  sendLocalToolCall: (...args: unknown[]) => mockSendLocalToolCall(...args),
}));
jest.mock('../gemini', () => ({ configureBasicGenAI: jest.fn() }));
jest.mock('../handleError', () => ({ handleError: jest.fn() }));
jest.mock('@/database/services/DebugDumpService', () => ({
  DebugDumpService: { logJsonEvent: (...args: unknown[]) => mockLogJsonEvent(...args) },
}));
jest.mock('@/database/services/SettingsService', () => ({
  SettingsService: { get: jest.fn().mockResolvedValue('off') },
}));

const GGUF: CoachAIConfig = { provider: 'on-device', engine: 'gguf', vision: true };
const REQUEST = {
  operation: 'voiceCommand',
  messages: [{ role: 'user' as const, content: 'I had a banana' }],
  tools: [{ name: 'search_food', description: 'Log one food.', parameters: { type: 'object' } }],
};

beforeEach(() => {
  jest.clearAllMocks();
  clearLlmUsage();
});

describe('requestNativeToolCall', () => {
  it('sends the messages and tools as given and returns the engine reply', async () => {
    const reply = {
      text: '',
      toolCalls: [{ name: 'search_food', arguments: '{"food":"banana"}' }],
    };
    mockSendLocalToolCall.mockResolvedValue(reply);

    await expect(requestNativeToolCall(GGUF, REQUEST)).resolves.toEqual(reply);
    expect(mockSendLocalToolCall).toHaveBeenCalledTimes(1);
    expect(mockSendLocalToolCall).toHaveBeenCalledWith(
      REQUEST.messages,
      REQUEST.tools,
      expect.objectContaining({ signal: expect.any(AbortSignal), onDelta: expect.any(Function) })
    );
  });

  it('writes the request and the reply to the debug dump', async () => {
    mockSendLocalToolCall.mockResolvedValue({ text: 'Hi!', toolCalls: [] });

    await requestNativeToolCall(GGUF, REQUEST);

    expect(mockLogJsonEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'on-device',
        direction: 'request',
        operation: 'voiceCommand',
        payload: { messages: REQUEST.messages, tools: REQUEST.tools },
      })
    );
    expect(mockLogJsonEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        direction: 'response',
        payload: { text: 'Hi!', toolCalls: [] },
      })
    );
  });

  it('keeps what was said and answered out of the dump when asked to', async () => {
    mockSendLocalToolCall.mockResolvedValue({ text: 'Hi!', toolCalls: [] });

    await requestNativeToolCall(GGUF, { ...REQUEST, redactDump: true });

    expect(mockLogJsonEvent).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(mockLogJsonEvent.mock.calls)).not.toContain('banana');
    expect(JSON.stringify(mockLogJsonEvent.mock.calls)).not.toContain('Hi!');
    for (const [event] of mockLogJsonEvent.mock.calls) {
      expect(event.payload).toEqual({ redacted: true });
    }
  });

  it('records what the call cost', async () => {
    mockSendLocalToolCall.mockImplementation(async (_messages, _tools, options) => {
      options.onUsage({ inputTokens: 200, cachedInputTokens: 150, outputTokens: 12 });

      return { text: '', toolCalls: [] };
    });

    await requestNativeToolCall(GGUF, REQUEST);

    expect(getRecentLlmUsage().at(-1)).toMatchObject({
      operation: 'voiceCommand',
      provider: 'on-device',
      usage: { inputTokens: 200, cachedInputTokens: 150, outputTokens: 12 },
    });
  });

  it('refuses a provider with no tool-call format of its own before sending anything', async () => {
    for (const config of [
      { provider: 'on-device', engine: 'apple', vision: false },
      { provider: 'gemini', apiKey: 'key' },
    ] as CoachAIConfig[]) {
      await expect(requestNativeToolCall(config, REQUEST)).rejects.toThrow(/no native tool calls/);
    }

    expect(mockSendLocalToolCall).not.toHaveBeenCalled();
  });

  it('passes a cancel through as it is', async () => {
    mockSendLocalToolCall.mockRejectedValue(new AiCancelledError());

    await expect(requestNativeToolCall(GGUF, REQUEST)).rejects.toBeInstanceOf(AiCancelledError);
  });
});
