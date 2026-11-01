import AsyncStorage from '@react-native-async-storage/async-storage';

import { CHAT_INTENTION_KEY } from '@/constants/chat';
import { COACH_REPLY_JOURNAL, COACH_RESTORED_COMPOSER } from '@/constants/misc';
import type ChatMessage from '@/database/models/ChatMessage';
import {
  type CoachReplyEvent,
  getCoachReplySnapshot,
  isCoachReplyBusy,
  registerCoachReplyViewer,
  subscribeCoachReply,
  subscribeCoachReplyEvents,
} from '@/services/coachReplyStore';
import {
  consumeRestoredComposerText,
  persistCoachReply,
  recoverInterruptedCoachReply,
  startCoachReply,
} from '@/services/coachReplyStream';
import type { CoachAIConfig, CoachStream } from '@/utils/coachAI';

const mockSendCoachMessage = jest.fn();
const mockGetNutritionInsights = jest.fn();
const mockGetRecentWorkoutsInsights = jest.fn();
const mockGetMealCritique = jest.fn();
const mockGetRecentWorkoutInsights = jest.fn();
const mockSaveMessage = jest.fn();
const mockUpdateMessageSummary = jest.fn();
const mockDeleteMessage = jest.fn();
const mockGetMessagesByContext = jest.fn();
const mockCreatePrompt = jest.fn();
const appState = { currentState: 'active' };
let appStateHandler: ((state: string) => void) | null = null;
let uuidCounter = 0;

jest.mock('react-native', () => ({
  AppState: {
    get currentState() {
      return appState.currentState;
    },
    addEventListener: jest.fn((_event: string, handler: (state: string) => void) => {
      appStateHandler = handler;
      return { remove: jest.fn() };
    }),
  },
}));
jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(() => `job-${(uuidCounter += 1)}`) }));
jest.mock('@/lang/lang', () => ({ __esModule: true, default: { t: (key: string) => key } }));
jest.mock('@/utils/coachAI', () => ({
  sendCoachMessage: (...args: unknown[]) => mockSendCoachMessage(...args),
  getNutritionInsights: (...args: unknown[]) => mockGetNutritionInsights(...args),
  getRecentWorkoutsInsights: (...args: unknown[]) => mockGetRecentWorkoutsInsights(...args),
  getMealCritique: (...args: unknown[]) => mockGetMealCritique(...args),
  getRecentWorkoutInsights: (...args: unknown[]) => mockGetRecentWorkoutInsights(...args),
}));
jest.mock('@/database/services/ChatService', () => ({
  ChatService: {
    saveMessage: (...args: unknown[]) => mockSaveMessage(...args),
    updateMessageSummary: (...args: unknown[]) => mockUpdateMessageSummary(...args),
    deleteMessage: (...args: unknown[]) => mockDeleteMessage(...args),
    getMessagesByContext: (...args: unknown[]) => mockGetMessagesByContext(...args),
  },
}));
jest.mock('@/database/services/AiCustomPromptService', () => ({
  AiCustomPromptService: { createPrompt: (...args: unknown[]) => mockCreatePrompt(...args) },
}));
// The real helper encrypts with the device key; the tests only care about what is stored.
jest.mock('@/utils/encryptedJsonStorage', () => {
  const storage = jest.requireActual(
    '@react-native-async-storage/async-storage/jest/async-storage-mock'
  );
  return {
    readEncryptedJson: async (key: string) => {
      const stored = await storage.getItem(key);
      return stored ? JSON.parse(stored) : null;
    },
    writeEncryptedJson: async (key: string, value: unknown) =>
      storage.setItem(key, JSON.stringify(value)),
  };
});

const config = { provider: 'openai', model: 'm', apiKey: 'k' } as CoachAIConfig;
const userRecord = { id: 'user-1' } as ChatMessage;
const coachRecord = (message: string) =>
  ({ id: `coach-${message}`, sender: 'coach', message, createdAt: Date.now() }) as ChatMessage;

const chatJob = (overrides: Record<string, unknown> = {}) =>
  ({
    kind: 'chat',
    aiConfig: config,
    context: 'general',
    text: 'hello coach',
    userRecord,
    history: [],
    ...overrides,
  }) as Parameters<typeof startCoachReply>[0];

function collectEvents() {
  const events: CoachReplyEvent[] = [];
  const unsubscribe = subscribeCoachReplyEvents((event) => events.push(event));
  return { events, unsubscribe };
}

describe('coachReplyStream', () => {
  beforeEach(async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.clearAllMocks();
    uuidCounter = 0;
    appState.currentState = 'active';
    appStateHandler = null;
    await AsyncStorage.clear();
    mockSaveMessage.mockImplementation(async (params: { message: string }) =>
      coachRecord(params.message)
    );
    mockDeleteMessage.mockResolvedValue(undefined);
    mockGetMessagesByContext.mockResolvedValue([]);
  });
  afterEach(() => jest.restoreAllMocks());

  describe('a streamed chat reply', () => {
    it('shows the text as it arrives, then saves the reply exactly as a non-streamed one is saved', async () => {
      mockSendCoachMessage.mockImplementation(
        async (_c: unknown, _h: unknown, _t: unknown, _x: unknown, stream: CoachStream) => {
          stream.onText('Hel');
          return {
            msg4User: 'Hello!',
            sumMsg: 'A greeting.',
            sumUserMsg: 'said hello',
            rememberMe: 'is polite',
          };
        }
      );
      const seen: (string | null)[] = [];
      const unsubscribeSnapshot = subscribeCoachReply(() =>
        seen.push(getCoachReplySnapshot()?.text ?? null)
      );
      const { events, unsubscribe } = collectEvents();

      await startCoachReply(chatJob());
      unsubscribeSnapshot();
      unsubscribe();

      expect(seen).toContain('Hel');
      expect(getCoachReplySnapshot()).toBeNull();
      expect(isCoachReplyBusy()).toBe(false);
      expect(mockUpdateMessageSummary).toHaveBeenCalledWith(userRecord, 'said hello');
      expect(mockCreatePrompt).toHaveBeenCalledWith(
        expect.stringContaining('Memory from'),
        'is polite',
        true,
        'general',
        'memory'
      );
      expect(mockSaveMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          sender: 'coach',
          message: 'Hello!',
          summarizedMessage: 'A greeting.',
          context: 'general',
        })
      );
      expect(events).toEqual([
        expect.objectContaining({ type: 'saved', context: 'general', viewed: false }),
      ]);
      expect(await AsyncStorage.getItem(COACH_REPLY_JOURNAL)).toBeNull();
    });

    it('reports a reply as viewed when a chat for that conversation is on screen', async () => {
      mockSendCoachMessage.mockResolvedValue({ msg4User: 'Hi', sumMsg: 'Hi' });
      const { events, unsubscribe } = collectEvents();
      const unregister = registerCoachReplyViewer('general');

      await startCoachReply(chatJob());
      unregister();
      unsubscribe();

      expect(events[0]).toMatchObject({ type: 'saved', viewed: true });
    });

    it('writes one reply at a time', async () => {
      let finish: (value: unknown) => void = () => {};
      mockSendCoachMessage.mockReturnValue(new Promise((resolve) => (finish = resolve)));

      const first = startCoachReply(chatJob());
      expect(isCoachReplyBusy()).toBe(true);
      expect(() => startCoachReply(chatJob({ context: 'nutrition' }))).toThrow(/already/);

      finish({ msg4User: 'Done', sumMsg: 'Done' });
      await first;
      expect(isCoachReplyBusy()).toBe(false);
    });
  });

  describe('insights', () => {
    it('saves the text with a cut summary and uses up the armed intention', async () => {
      await AsyncStorage.setItem(CHAT_INTENTION_KEY, 'ANALYZE_PROGRESS');
      const longText = 'x'.repeat(500);
      mockGetRecentWorkoutsInsights.mockResolvedValue(longText);
      const { events, unsubscribe } = collectEvents();

      await startCoachReply({
        kind: 'analyzeProgress',
        aiConfig: config,
        context: 'exercise',
        text: 'how am I doing?',
        userRecord,
        startDate: '2026-01-01',
        endDate: '2026-01-07',
        recentConversation: [],
      });
      unsubscribe();

      expect(mockGetRecentWorkoutsInsights).toHaveBeenCalledWith(
        config,
        '2026-01-01',
        '2026-01-07',
        'how am I doing?',
        [],
        'exercise',
        expect.objectContaining({ onText: expect.any(Function) })
      );
      expect(mockSaveMessage).toHaveBeenCalledWith(
        expect.objectContaining({ message: longText, summarizedMessage: 'x'.repeat(200) })
      );
      expect(await AsyncStorage.getItem(CHAT_INTENTION_KEY)).toBeNull();
      expect(events[0]).toMatchObject({ type: 'saved', consumedIntention: true });
    });

    it('leaves the intention armed when the reply fails', async () => {
      await AsyncStorage.setItem(CHAT_INTENTION_KEY, 'NUTRITION_CHECK');
      mockGetNutritionInsights.mockResolvedValue(null);

      await startCoachReply({
        kind: 'nutritionCheck',
        aiConfig: config,
        context: 'nutrition',
        text: 'check',
        userRecord,
        startDate: '2026-01-01',
        endDate: '2026-01-07',
        recentConversation: [],
      });

      expect(await AsyncStorage.getItem(CHAT_INTENTION_KEY)).toBe('NUTRITION_CHECK');
    });
  });

  describe('a reply without a message of its own (critique, feedback)', () => {
    it('streams a critique into the nutrition conversation', async () => {
      mockGetMealCritique.mockResolvedValue('Good protein, low fiber.');

      await startCoachReply({
        kind: 'mealCritique',
        aiConfig: config,
        context: 'nutrition',
        mealType: 'lunch',
        foods: [],
        totals: { calories: 1, protein: 1, carbs: 1, fat: 1 },
      });

      expect(mockSaveMessage).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Good protein, low fiber.', context: 'nutrition' })
      );
      expect(mockUpdateMessageSummary).not.toHaveBeenCalled();
    });

    it('reports a failed critique without deleting or restoring anything', async () => {
      mockGetMealCritique.mockResolvedValue(null);
      const { events, unsubscribe } = collectEvents();

      await startCoachReply({
        kind: 'mealCritique',
        aiConfig: config,
        context: 'nutrition',
        mealType: 'lunch',
        foods: [],
        totals: { calories: 1, protein: 1, carbs: 1, fat: 1 },
      });
      unsubscribe();

      expect(mockDeleteMessage).not.toHaveBeenCalled();
      expect(events).toEqual([
        expect.objectContaining({
          type: 'failed',
          kind: 'mealCritique',
          error: null,
          fallbackMessage: 'food.actions.getMealInsightsError',
        }),
      ]);
      expect(events[0]).not.toHaveProperty('restoredText', expect.anything());
      expect(await AsyncStorage.getItem(COACH_RESTORED_COMPOSER)).toBeNull();
    });
  });

  describe('a reply that fails', () => {
    it('in the foreground takes the half-written reply and the message back', async () => {
      mockSendCoachMessage.mockImplementation(
        async (_c: unknown, _h: unknown, _t: unknown, _x: unknown, stream: CoachStream) => {
          stream.onText('Half of an ans');
          throw new Error('connection lost');
        }
      );
      const { events, unsubscribe } = collectEvents();

      await startCoachReply(chatJob());
      unsubscribe();

      expect(mockSaveMessage).not.toHaveBeenCalled();
      expect(mockDeleteMessage).toHaveBeenCalledWith('user-1');
      expect(events).toEqual([
        expect.objectContaining({
          type: 'failed',
          userRecordId: 'user-1',
          restoredText: 'hello coach',
          error: expect.objectContaining({ message: 'connection lost' }),
        }),
      ]);
      expect(await AsyncStorage.getItem(COACH_REPLY_JOURNAL)).toBeNull();
      // nobody was listening to put it in the composer, so it waits for the next time
      expect(await consumeRestoredComposerText('general')).toBe('hello coach');
      expect(await consumeRestoredComposerText('general')).toBeNull();
    });

    it('keeps what arrived when the app is in the background, as it would after a kill', async () => {
      appState.currentState = 'background';
      mockSendCoachMessage.mockImplementation(
        async (_c: unknown, _h: unknown, _t: unknown, _x: unknown, stream: CoachStream) => {
          stream.onText('Squats are a great place to start');
          throw new Error('network suspended');
        }
      );
      const { events, unsubscribe } = collectEvents();

      await startCoachReply(chatJob());
      unsubscribe();

      expect(mockDeleteMessage).not.toHaveBeenCalled();
      expect(mockSaveMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Squats are a great place to start',
          summarizedMessage: 'Squats are a great place to start',
        })
      );
      expect(events[0]).toMatchObject({ type: 'saved' });
    });

    it('still takes everything back in the background when nothing had arrived', async () => {
      appState.currentState = 'background';
      mockSendCoachMessage.mockRejectedValue(new Error('network suspended'));

      await startCoachReply(chatJob());

      expect(mockSaveMessage).not.toHaveBeenCalled();
      expect(mockDeleteMessage).toHaveBeenCalledWith('user-1');
    });

    it('keeps another conversation’s restored text out of the way', async () => {
      mockSendCoachMessage.mockRejectedValue(new Error('boom'));
      await startCoachReply(chatJob({ context: 'nutrition' }));

      expect(await consumeRestoredComposerText('general')).toBeNull();
      expect(await consumeRestoredComposerText('nutrition')).toBe('hello coach');
    });
  });

  describe('the journal', () => {
    it('holds what has arrived while the reply is written, and is flushed when the app is backgrounded', async () => {
      let finish: (value: unknown) => void = () => {};
      let stream: CoachStream | null = null;
      mockSendCoachMessage.mockImplementation(
        (_c: unknown, _h: unknown, _t: unknown, _x: unknown, s: CoachStream) => {
          stream = s;
          return new Promise((resolve) => (finish = resolve));
        }
      );

      const done = startCoachReply(chatJob());
      await new Promise((resolve) => setImmediate(resolve));
      expect(JSON.parse((await AsyncStorage.getItem(COACH_REPLY_JOURNAL)) ?? 'null')).toMatchObject(
        {
          kind: 'chat',
          context: 'general',
          userRecordId: 'user-1',
          composerText: 'hello coach',
          text: '',
        }
      );

      stream!.onText('first words');
      stream!.onText('first words, then more');
      appStateHandler?.('background');
      await new Promise((resolve) => setImmediate(resolve));
      expect(JSON.parse((await AsyncStorage.getItem(COACH_REPLY_JOURNAL)) ?? 'null').text).toBe(
        'first words, then more'
      );

      finish({ msg4User: 'done', sumMsg: 'done' });
      await done;
      expect(await AsyncStorage.getItem(COACH_REPLY_JOURNAL)).toBeNull();
    });
  });

  describe('recoverInterruptedCoachReply', () => {
    const journal = (overrides: Record<string, unknown> = {}) =>
      AsyncStorage.setItem(
        COACH_REPLY_JOURNAL,
        JSON.stringify({
          jobId: 'old',
          kind: 'chat',
          context: 'general',
          userRecordId: 'user-9',
          composerText: 'what should I eat?',
          text: 'You could start with',
          startedAt: 1000,
          ...overrides,
        })
      );

    it('keeps the text that had arrived as the coach’s reply', async () => {
      await journal();
      const { events, unsubscribe } = collectEvents();

      await recoverInterruptedCoachReply();
      unsubscribe();

      expect(mockSaveMessage).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'You could start with', context: 'general' })
      );
      expect(mockDeleteMessage).not.toHaveBeenCalled();
      expect(events[0]).toMatchObject({ type: 'saved', viewed: false });
      expect(await AsyncStorage.getItem(COACH_REPLY_JOURNAL)).toBeNull();
    });

    it('does not save it twice when the app stopped after saving but before clearing', async () => {
      await journal();
      mockGetMessagesByContext.mockResolvedValue([
        { ...coachRecord('You could start with oats and eggs.'), createdAt: 2000 },
      ]);

      await recoverInterruptedCoachReply();

      expect(mockSaveMessage).not.toHaveBeenCalled();
      expect(await AsyncStorage.getItem(COACH_REPLY_JOURNAL)).toBeNull();
    });

    it('uses up the intention an interrupted insight had armed', async () => {
      await AsyncStorage.setItem(CHAT_INTENTION_KEY, 'NUTRITION_CHECK');
      await journal({ kind: 'nutritionCheck', context: 'nutrition' });

      await recoverInterruptedCoachReply();

      expect(await AsyncStorage.getItem(CHAT_INTENTION_KEY)).toBeNull();
    });

    it('takes the message back and keeps its text for the composer when nothing had arrived', async () => {
      await journal({ text: '   ' });

      await recoverInterruptedCoachReply();

      expect(mockSaveMessage).not.toHaveBeenCalled();
      expect(mockDeleteMessage).toHaveBeenCalledWith('user-9');
      expect(await consumeRestoredComposerText('general')).toBe('what should I eat?');
      expect(await AsyncStorage.getItem(COACH_REPLY_JOURNAL)).toBeNull();
    });

    it('only clears the journal for a reply that has no message of its own', async () => {
      await journal({
        kind: 'mealCritique',
        context: 'nutrition',
        userRecordId: undefined,
        composerText: undefined,
        text: '',
      });

      await recoverInterruptedCoachReply();

      expect(mockSaveMessage).not.toHaveBeenCalled();
      expect(mockDeleteMessage).not.toHaveBeenCalled();
      expect(await AsyncStorage.getItem(COACH_RESTORED_COMPOSER)).toBeNull();
      expect(await AsyncStorage.getItem(COACH_REPLY_JOURNAL)).toBeNull();
    });

    it('discards a journal it cannot read', async () => {
      await AsyncStorage.setItem(COACH_REPLY_JOURNAL, '{"kind": "chat", "text": 12}');

      await recoverInterruptedCoachReply();

      expect(mockSaveMessage).not.toHaveBeenCalled();
      expect(await AsyncStorage.getItem(COACH_REPLY_JOURNAL)).toBeNull();
    });

    it('does nothing when there is no journal', async () => {
      await recoverInterruptedCoachReply();

      expect(mockSaveMessage).not.toHaveBeenCalled();
      expect(mockDeleteMessage).not.toHaveBeenCalled();
    });
  });

  describe('persistCoachReply', () => {
    it('saves the reply alone when there is nothing else to keep', async () => {
      await persistCoachReply({
        context: 'exercise',
        reply: { msg4User: 'Plan ready', sumMsg: 'Plan ready' },
        payloadJson: '{"type":"workoutPlan"}',
      });

      expect(mockUpdateMessageSummary).not.toHaveBeenCalled();
      expect(mockCreatePrompt).not.toHaveBeenCalled();
      expect(mockSaveMessage).toHaveBeenCalledWith({
        sender: 'coach',
        message: 'Plan ready',
        summarizedMessage: 'Plan ready',
        payloadJson: '{"type":"workoutPlan"}',
        context: 'exercise',
      });
    });
  });
});
