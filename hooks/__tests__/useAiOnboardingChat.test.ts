/**
 * @jest-environment jsdom
 */

import { act, renderHook, waitFor } from '@testing-library/react';

import { useAiOnboardingChat } from '@/hooks/useAiOnboardingChat';
import { AiService } from '@/services/AiService';
import type { ChatMessage } from '@/utils/aiOnboarding/chatState';
import { newDraft } from '@/utils/aiOnboarding/draftStorage';
import { AiInvalidKeyError } from '@/utils/aiErrors';
import { sendStructuredChatTurn } from '@/utils/structuredChat';

// The real SDK needs fetch globals jsdom lacks; only its connection-error class is read.
jest.mock('openai', () => {
  class APIConnectionError extends Error {}
  const OpenAIMock = jest.fn();
  return Object.assign(OpenAIMock, { __esModule: true, default: OpenAIMock, APIConnectionError });
});
jest.mock('@/utils/gemini', () => ({
  configureBasicGenAI: jest.fn(),
  buildGeminiGenerationConfig: jest.fn(() => ({})),
  extractGeminiText: jest.fn(() => ({ text: '', thoughtOnly: false })),
}));
jest.mock('@/utils/onDeviceAi', () => ({
  sendOnDeviceMessage: jest.fn(),
  sendOnDeviceStructured: jest.fn(),
}));
jest.mock('@/utils/handleError', () => ({ handleError: jest.fn() }));
jest.mock('@/database/services/DebugDumpService', () => ({
  DebugDumpService: { logJsonEvent: jest.fn() },
}));
jest.mock('@/database/services/SettingsService', () => ({ SettingsService: {} }));
jest.mock('@/services/AiService', () => ({
  AiService: { getAiConfigForProvider: jest.fn() },
}));
jest.mock('@/utils/structuredChat', () => ({ sendStructuredChatTurn: jest.fn() }));

const mockConfig = AiService.getAiConfigForProvider as jest.Mock;
const mockSend = sendStructuredChatTurn as jest.Mock;

const turn = (reply: string, patch: Record<string, unknown> = {}, extra = {}) => ({
  kind: 'ok' as const,
  value: { reply, patch, askedFields: [], readyForReview: false, ...extra },
});

function setup(overrides: Partial<ReturnType<typeof newDraft>> = {}) {
  const draft = { ...newDraft('onboarding'), provider: 'gemini' as const, ...overrides };
  const update = jest.fn().mockResolvedValue(undefined);
  const hook = renderHook(() => useAiOnboardingChat({ draft, update }));
  return { ...hook, update, draft };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockConfig.mockResolvedValue({ provider: 'gemini', model: 'm', apiKey: 'k', language: 'en-US' });
});

describe('useAiOnboardingChat', () => {
  it('sends a message, merges what the reply learned and saves the session', async () => {
    mockSend.mockResolvedValue(
      turn(
        'How tall are you?',
        { gender: 'female', weightValue: 60, weightUnit: 'kg' },
        { askedFields: ['heightCm'], readyForReview: true }
      )
    );
    const { result, update } = setup();

    await act(async () => {
      await result.current.send('  I am a woman, 60 kg  ');
    });

    expect(result.current.messages.map((m) => [m.role, m.text])).toEqual([
      ['user', 'I am a woman, 60 kg'],
      ['assistant', 'How tall are you?'],
    ]);
    expect(result.current.status).toBe('idle');
    expect(result.current.askedFields).toEqual(['heightCm']);
    expect(result.current.readyForReview).toBe(true);
    expect(update).toHaveBeenCalledWith({ answers: { gender: 'female', weightKg: 60 } });
    expect(update).toHaveBeenCalledWith({ composer: '' });
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith({
        messages: expect.arrayContaining([expect.objectContaining({ role: 'assistant' })]),
      })
    );
    expect(mockConfig).toHaveBeenCalledWith('gemini');
  });

  it('sends the earlier conversation as history, but not the new message', async () => {
    mockSend.mockResolvedValue(turn('ok'));
    const { result } = setup();

    await act(async () => {
      await result.current.send('first');
    });
    await act(async () => {
      await result.current.send('second');
    });

    const second = mockSend.mock.calls[1][1];
    expect(second.history).toEqual([
      { role: 'user', content: 'first' },
      { role: 'coach', content: 'ok' },
    ]);
    expect(second.userMessage).toBe('second');
    expect(second.systemPrompt).toContain('Never invent');
  });

  it('ignores empty messages and a send while one is in flight', async () => {
    let release: (value: unknown) => void = () => {};
    mockSend.mockReturnValue(new Promise((resolve) => (release = resolve)));
    const { result } = setup();

    await act(async () => {
      await result.current.send('   ');
    });
    expect(mockSend).not.toHaveBeenCalled();

    let first: Promise<void> = Promise.resolve();
    act(() => {
      first = result.current.send('one');
    });
    await waitFor(() => expect(mockSend).toHaveBeenCalledTimes(1));
    await act(async () => {
      await result.current.send('two');
    });
    expect(mockSend).toHaveBeenCalledTimes(1);

    await act(async () => {
      release(turn('done'));
      await first;
    });
  });

  it('keeps the message as unanswered when offline, and retry resends the same text', async () => {
    mockSend.mockRejectedValueOnce(new Error('Network request failed'));
    const { result } = setup();

    await act(async () => {
      await result.current.send('I am 30');
    });
    expect(result.current).toMatchObject({ status: 'error', errorKind: 'offline' });
    expect(result.current.messages[0].status).toBe('unanswered');

    mockSend.mockResolvedValueOnce(turn('Thanks'));
    await act(async () => {
      await result.current.retry();
    });

    expect(result.current.status).toBe('idle');
    expect(result.current.messages.map((m) => m.text)).toEqual(['I am 30', 'Thanks']);
    expect(mockSend.mock.calls[1][1]).toMatchObject({ userMessage: 'I am 30', history: [] });
  });

  it('classifies a rejected key', async () => {
    mockSend.mockRejectedValue(new AiInvalidKeyError('gemini'));
    const { result } = setup();

    await act(async () => {
      await result.current.send('hi');
    });

    expect(result.current.errorKind).toBe('invalidKey');
  });

  it('says the provider is unavailable when it is no longer configured', async () => {
    mockConfig.mockResolvedValue(null);
    const { result } = setup();

    await act(async () => {
      await result.current.send('hi');
    });
    expect(result.current.errorKind).toBe('unavailable');
    expect(mockSend).not.toHaveBeenCalled();

    const none = setup({ provider: null });
    await act(async () => {
      await none.result.current.send('hi');
    });
    expect(none.result.current.errorKind).toBe('unavailable');
  });

  it('quietly asks once more when the reply is unreadable, and reports it if that fails too', async () => {
    mockSend
      .mockResolvedValueOnce({ kind: 'malformed', raw: 'text' })
      .mockResolvedValueOnce(turn('Recovered'));
    const { result } = setup();

    await act(async () => {
      await result.current.send('hi');
    });
    expect(mockSend).toHaveBeenCalledTimes(2);
    expect(mockSend.mock.calls[1][1].systemPrompt).toContain('could not be read');
    expect(result.current.messages.at(-1)?.text).toBe('Recovered');

    mockSend.mockReset();
    mockSend.mockResolvedValue({ kind: 'malformed', raw: '' });
    await act(async () => {
      await result.current.send('again');
    });
    expect(result.current.errorKind).toBe('malformed');
  });

  it('treats a reply with no usable reply text as malformed', async () => {
    mockSend.mockResolvedValue({ kind: 'ok', value: { patch: {} } });
    const { result } = setup();

    await act(async () => {
      await result.current.send('hi');
    });

    expect(result.current.errorKind).toBe('malformed');
  });

  it('asks again for a value that was rejected', async () => {
    mockSend.mockResolvedValueOnce(turn('How tall?', { heightCm: 900 }));
    mockSend.mockResolvedValueOnce(turn('Sorry, again?'));
    const { result } = setup();

    await act(async () => {
      await result.current.send('900 cm');
    });
    await act(async () => {
      await result.current.send('ok');
    });

    expect(mockSend.mock.calls[1][1].systemPrompt).toContain(
      'heightCm (was outside the allowed range)'
    );
  });

  it('uses the short prompt for small models', async () => {
    mockConfig.mockResolvedValue({ provider: 'local', model: 'm', apiKey: 'k' });
    mockSend.mockResolvedValue(turn('ok'));
    const { result } = setup({ provider: 'local' });

    await act(async () => {
      await result.current.send('hi');
    });

    expect(mockSend.mock.calls[0][1].systemPrompt).not.toContain('Ranges:');
  });

  it('cancels a turn in flight and gives the text back to the composer', async () => {
    mockSend.mockImplementation(
      (config: { signal: AbortSignal }) =>
        new Promise((_, reject) =>
          config.signal.addEventListener('abort', () => {
            const error = new Error('aborted');
            error.name = 'AiCancelledError';
            reject(error);
          })
        )
    );
    const { result, update } = setup();

    let pending: Promise<void> = Promise.resolve();
    act(() => {
      pending = result.current.send('hello');
    });
    await waitFor(() => expect(mockSend).toHaveBeenCalled());

    // The real helper throws AiCancelledError; mirror it here.
    const { AiCancelledError } = jest.requireActual('@/utils/aiErrors');
    mockSend.mockImplementation(
      (config: { signal: AbortSignal }) =>
        new Promise((_, reject) =>
          config.signal.addEventListener('abort', () => reject(new AiCancelledError()))
        )
    );
    await act(async () => {
      result.current.cancel();
      await pending.catch(() => {});
    });

    expect(update).toHaveBeenCalledWith({ composer: 'hello' });
  });

  it('resumes a conversation that was cut off, showing the last message as unanswered', async () => {
    const messages: ChatMessage[] = [
      { id: '1', role: 'user', text: 'hi', at: 1 },
      { id: '2', role: 'assistant', text: 'hello', at: 2 },
      { id: '3', role: 'user', text: 'I am 30', at: 3 },
    ];
    mockSend.mockResolvedValue(turn('Great'));
    const { result } = setup({ messages });

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.messages[2].status).toBe('unanswered');

    await act(async () => {
      await result.current.retry();
    });

    expect(mockSend.mock.calls[0][1]).toMatchObject({
      userMessage: 'I am 30',
      history: [
        { role: 'user', content: 'hi' },
        { role: 'coach', content: 'hello' },
      ],
    });
    expect(result.current.status).toBe('idle');
  });

  it('does nothing on retry when there is nothing unanswered', async () => {
    const { result } = setup();

    await act(async () => {
      await result.current.retry();
    });

    expect(mockSend).not.toHaveBeenCalled();
  });

  it('carries the answers collected before, so a resumed chat does not start over', async () => {
    mockSend.mockResolvedValue(turn('ok', { weightValue: 70, weightUnit: 'kg' }));
    const { result, update } = setup({ answers: { gender: 'male' } });

    await act(async () => {
      await result.current.send('70 kg');
    });

    expect(mockSend.mock.calls[0][1].systemPrompt).toContain('"gender":"male"');
    expect(update).toHaveBeenCalledWith({ answers: { gender: 'male', weightKg: 70 } });
  });
});
