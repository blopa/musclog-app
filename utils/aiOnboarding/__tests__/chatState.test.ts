import OpenAI from 'openai';

import {
  chatReducer,
  classifyAiOnboardingError,
  type ChatMessage,
  initialChatState,
  MAX_STORED_MESSAGES,
  toHistory,
} from '@/utils/aiOnboarding/chatState';
import { AiCancelledError, AiInvalidKeyError, AiTimeoutError } from '@/utils/aiErrors';
import { AiCreditsError, GatewayRateLimitError } from '@/utils/coachAI';

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

const user = (text: string, extra: Partial<ChatMessage> = {}): ChatMessage => ({
  id: `u-${text}`,
  role: 'user',
  text,
  at: 1,
  ...extra,
});
const assistant = (text: string): ChatMessage => ({
  id: `a-${text}`,
  role: 'assistant',
  text,
  at: 2,
});

describe('chatReducer', () => {
  it('sends, then replies', () => {
    const sending = chatReducer(initialChatState, { type: 'send', message: user('hi') });
    expect(sending).toMatchObject({ status: 'sending', errorKind: null });

    const answered = chatReducer(sending, { type: 'reply', message: assistant('hello') });
    expect(answered.status).toBe('idle');
    expect(answered.messages.map((message) => message.text)).toEqual(['hi', 'hello']);
  });

  it('marks the unanswered message on failure and clears it on a later reply', () => {
    const sending = chatReducer(initialChatState, { type: 'send', message: user('hi') });
    const failed = chatReducer(sending, { type: 'fail', kind: 'offline' });

    expect(failed).toMatchObject({ status: 'error', errorKind: 'offline' });
    expect(failed.messages[0].status).toBe('unanswered');

    const retrying = chatReducer(failed, { type: 'retry' });
    expect(retrying).toMatchObject({ status: 'sending', errorKind: null });
    expect(retrying.messages[0].status).toBe('unanswered');

    const answered = chatReducer(retrying, { type: 'reply', message: assistant('ok') });
    expect(answered.messages[0]).not.toHaveProperty('status');
  });

  it('stops flagging an earlier unanswered message once a newer one is sent', () => {
    const failed = chatReducer(
      chatReducer(initialChatState, { type: 'send', message: user('first') }),
      { type: 'fail', kind: 'offline' }
    );
    expect(failed.messages[0].status).toBe('unanswered');

    const resent = chatReducer(failed, { type: 'send', message: user('second') });
    expect(resent.messages.map((message) => message.status)).toEqual([undefined, undefined]);
  });

  it('only marks the last message when it is the person’s', () => {
    const state = { ...initialChatState, messages: [user('a'), assistant('b')] };

    expect(chatReducer(state, { type: 'fail', kind: 'timeout' }).messages).toEqual(state.messages);
  });

  it('removes a cancelled message from the transcript', () => {
    const sending = chatReducer(
      { ...initialChatState, messages: [assistant('first')] },
      { type: 'send', message: user('hi') }
    );
    const cancelled = chatReducer(sending, { type: 'cancel' });

    expect(cancelled.messages.map((message) => message.text)).toEqual(['first']);
    expect(cancelled.status).toBe('idle');
    expect(chatReducer(cancelled, { type: 'cancel' }).messages).toHaveLength(1);
  });

  it('hydrates a saved conversation, flagging one cut off mid-turn', () => {
    const complete = chatReducer(initialChatState, {
      type: 'hydrate',
      messages: [user('hi'), assistant('hello')],
    });
    expect(complete.status).toBe('idle');

    const cutOff = chatReducer(initialChatState, { type: 'hydrate', messages: [user('hi')] });
    expect(cutOff.status).toBe('error');
    expect(cutOff.messages[0].status).toBe('unanswered');

    expect(chatReducer(initialChatState, { type: 'hydrate', messages: [] }).status).toBe('idle');
  });

  it('caps the stored transcript', () => {
    const many = Array.from({ length: MAX_STORED_MESSAGES + 10 }, (_, index) =>
      index % 2 ? assistant(`a${index}`) : user(`u${index}`)
    );

    expect(
      chatReducer(initialChatState, { type: 'hydrate', messages: many }).messages
    ).toHaveLength(MAX_STORED_MESSAGES);
    expect(
      chatReducer({ ...initialChatState, messages: many }, { type: 'send', message: user('x') })
        .messages
    ).toHaveLength(MAX_STORED_MESSAGES);
  });

  it('resets', () => {
    expect(chatReducer({ ...initialChatState, messages: [user('x')] }, { type: 'reset' })).toBe(
      initialChatState
    );
  });
});

describe('toHistory', () => {
  it('maps assistant messages to the coach role', () => {
    expect(toHistory([user('hi'), assistant('hello')])).toEqual([
      { role: 'user', content: 'hi' },
      { role: 'coach', content: 'hello' },
    ]);
  });
});

describe('classifyAiOnboardingError', () => {
  it.each([
    [new AiCancelledError(), 'cancelled'],
    [new AiInvalidKeyError('openai'), 'invalidKey'],
    [new AiTimeoutError(), 'timeout'],
    [new GatewayRateLimitError('daily'), 'gatewayLimit'],
    [new AiCreditsError('no credit'), 'credits'],
    [Object.assign(new Error('Too Many Requests'), { status: 429 }), 'credits'],
    [new Error('You exceeded your current quota'), 'credits'],
    [new OpenAI.APIConnectionError({ message: 'offline' }), 'offline'],
    [new Error('Network request failed'), 'offline'],
    [new Error('fetch failed: ECONNRESET'), 'offline'],
    [new Error('something else'), 'unknown'],
    ['a string', 'unknown'],
    [null, 'unknown'],
  ])('classifies %p as %s', (error, kind) => {
    expect(classifyAiOnboardingError(error)).toBe(kind);
  });
});
