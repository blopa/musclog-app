/**
 * @jest-environment jsdom
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react';

import { CHAT_INTENTION_KEY } from '@/constants/chat';
import { useChatMessages } from '@/hooks/useChatMessages';
import {
  emitCoachReplyEvent,
  setActiveCoachReplyId,
  setCoachReplySnapshot,
} from '@/services/coachReplyStore';
import { consumeRestoredComposerText, startCoachReply } from '@/services/coachReplyStream';

const mockGetMessagesByContext = jest.fn();
const mockSaveMessage = jest.fn();
const mockGetAiConfig = jest.fn();

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/lang/lang', () => ({
  __esModule: true,
  DEFAULT_LANG: 'en-US',
  default: { language: 'en-US', resolvedLanguage: 'en-US', t: (key: string) => key },
}));
jest.mock('react-native-gifted-chat', () => ({}));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'uuid' }));
jest.mock('@/hooks/useConfettiTrigger', () => ({
  useConfettiTrigger: () => ({ triggerConfetti: jest.fn(), showConfetti: false }),
}));
jest.mock('@/context/ConfettiInteractionsContext', () => ({ ConfettiActivity: {} }));
jest.mock('@/database/models', () => ({}));
jest.mock('@/database/models/ChatMessage', () => ({
  __esModule: true,
  default: class ChatMessage {},
  isImagePayload: () => false,
  isLegacyTrackMealPayload: () => false,
  isMealPlanPayload: () => false,
  isTrackMealPayload: () => false,
  isWorkoutCompletedPayload: () => false,
  isWorkoutPlanPayload: () => false,
}));
jest.mock('@/database/services/ChatService', () => ({
  ChatService: {
    getMessagesByContext: (...args: unknown[]) => mockGetMessagesByContext(...args),
    saveMessage: (...args: unknown[]) => mockSaveMessage(...args),
    deleteMessage: jest.fn(),
  },
}));
jest.mock('@/database/services/NutritionGoalService', () => ({ NutritionGoalService: {} }));
jest.mock('@/database/services/NutritionService', () => ({ NutritionService: {} }));
jest.mock('@/database/services/NutritionTargetService', () => ({ NutritionTargetService: {} }));
jest.mock('@/database/services/SettingsService', () => ({ SettingsService: {} }));
jest.mock('@/database/services/UserMetricService', () => ({ UserMetricService: {} }));
jest.mock('@/database/services/UserService', () => ({ UserService: {} }));
jest.mock('@/services/AiService', () => {
  const service = { getAiConfig: (...args: unknown[]) => mockGetAiConfig(...args) };
  return { __esModule: true, default: service, AiService: service };
});
jest.mock('@/services/coachReplyStream', () => ({
  consumeRestoredComposerText: jest.fn(),
  persistCoachReply: jest.fn(),
  startCoachReply: jest.fn(),
}));
jest.mock('@/utils/coachAI', () => {
  class AiCreditsError extends Error {}
  return {
    AiCreditsError,
    isAiCreditsError: (error: unknown) => error instanceof AiCreditsError,
    generateMealPlan: jest.fn(),
    generateWorkoutPlan: jest.fn(),
    trackMeal: jest.fn(),
  };
});
jest.mock('@/utils/file', () => ({ saveBase64ImageToFile: jest.fn() }));
jest.mock('@/utils/handleError', () => ({ handleError: jest.fn() }));
jest.mock('@/utils/nutritionAI', () => ({ processMealPlanResponse: jest.fn() }));
jest.mock('@/utils/nutritionCalculator', () => ({
  calculateNutritionPlan: jest.fn(),
  eatingPhaseToWeightGoal: jest.fn(),
}));
jest.mock('@/utils/workoutAI', () => ({
  buildWorkoutCompletedSummaryForLLM: jest.fn(),
  processWorkoutPlanResponse: jest.fn(),
}));

const mockConsumeRestored = consumeRestoredComposerText as jest.Mock;
const mockStartCoachReply = startCoachReply as jest.Mock;

const record = (id: string, sender: 'user' | 'coach', message: string, createdAt = 1) => ({
  id,
  sender,
  message,
  createdAt,
  context: 'general',
  payloadJson: undefined,
  summarizedMessage: undefined,
});

async function loaded(context: 'general' | 'exercise' | 'nutrition' = 'general') {
  const hook = renderHook(() => useChatMessages(context));
  await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
  return hook;
}

describe('useChatMessages with the reply service', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    await AsyncStorage.clear();
    mockGetMessagesByContext.mockResolvedValue([]);
    mockConsumeRestored.mockResolvedValue(null);
    setCoachReplySnapshot(null);
    setActiveCoachReplyId(null);
  });
  afterEach(() => jest.restoreAllMocks());

  describe('the reply being written', () => {
    it('shows its text as a draft message, and only in the conversation it belongs to', async () => {
      const general = await loaded('general');
      const nutrition = await loaded('nutrition');

      act(() =>
        setCoachReplySnapshot({
          jobId: 'j1',
          context: 'general',
          text: 'Squats are',
          startedAt: 1000,
        })
      );

      expect(general.result.current.streamingMessage).toMatchObject({
        _id: 'streaming-reply',
        text: 'Squats are',
        user: { _id: 2 },
      });
      expect(general.result.current.isSending).toBe(true);
      expect(nutrition.result.current.streamingMessage).toBeNull();
      expect(nutrition.result.current.isSending).toBe(false);
    });

    it('is still waiting, with no draft, until the first words arrive', async () => {
      const { result } = await loaded();

      act(() =>
        setCoachReplySnapshot({ jobId: 'j1', context: 'general', text: '', startedAt: 1000 })
      );

      expect(result.current.streamingMessage).toBeNull();
      expect(result.current.isSending).toBe(true);
    });

    it('picks up a reply that is already under way when the chat opens', async () => {
      act(() =>
        setCoachReplySnapshot({
          jobId: 'j1',
          context: 'general',
          text: 'Already part-way',
          startedAt: 1000,
        })
      );

      const { result } = await loaded();

      expect(result.current.streamingMessage?.text).toBe('Already part-way');
    });
  });

  describe('when the reply is saved', () => {
    it('adds the saved message once, and the draft is gone', async () => {
      const { result } = await loaded();
      const saved = record('c1', 'coach', 'Here is my answer', 2000);
      act(() =>
        setCoachReplySnapshot({ jobId: 'j1', context: 'general', text: 'Here is', startedAt: 1 })
      );

      act(() => {
        emitCoachReplyEvent({
          type: 'saved',
          context: 'general',
          record: saved as never,
          viewed: true,
          consumedIntention: false,
        });
        emitCoachReplyEvent({
          type: 'saved',
          context: 'general',
          record: saved as never,
          viewed: true,
          consumedIntention: false,
        });
        setCoachReplySnapshot(null);
      });

      expect(result.current.messages.map((message) => message._id)).toEqual(['c1']);
      expect(result.current.streamingMessage).toBeNull();
      expect(result.current.isSending).toBe(false);
    });

    it('ignores a reply saved for another conversation', async () => {
      const { result } = await loaded('general');

      act(() =>
        emitCoachReplyEvent({
          type: 'saved',
          context: 'nutrition',
          record: record('c1', 'coach', 'critique') as never,
          viewed: false,
          consumedIntention: false,
        })
      );

      expect(result.current.messages).toHaveLength(0);
    });

    it('disarms the intention the reply used up', async () => {
      await AsyncStorage.setItem(CHAT_INTENTION_KEY, 'NUTRITION_CHECK');
      const { result } = await loaded('nutrition');
      expect(result.current.pendingIntention).toBe('NUTRITION_CHECK');

      act(() =>
        emitCoachReplyEvent({
          type: 'saved',
          context: 'nutrition',
          record: record('c1', 'coach', 'insight') as never,
          viewed: true,
          consumedIntention: true,
        })
      );

      expect(result.current.pendingIntention).toBeNull();
    });
  });

  describe('when the reply fails', () => {
    it('takes the sent message back, restores its text and says what went wrong', async () => {
      mockGetMessagesByContext.mockResolvedValue([record('u1', 'user', 'what should I eat?')]);
      const { result } = await loaded();
      expect(result.current.messages).toHaveLength(1);

      act(() =>
        emitCoachReplyEvent({
          type: 'failed',
          context: 'general',
          kind: 'chat',
          userRecordId: 'u1',
          restoredText: 'what should I eat?',
          error: new Error('boom'),
          fallbackMessage: 'coach.errors.generalError',
        })
      );

      expect(result.current.messages).toHaveLength(0);
      expect(result.current.failedMessageText).toBe('what should I eat?');
      expect(result.current.ephemeralErrorAsMessage?.text).toBe('coach.errors.generalError');
      expect(mockConsumeRestored).toHaveBeenCalledWith('general');
    });

    it('shows the credits message, with the way to Settings, when the credits ran out', async () => {
      const { AiCreditsError } = jest.requireMock('@/utils/coachAI');
      const { result } = await loaded();

      act(() =>
        emitCoachReplyEvent({
          type: 'failed',
          context: 'general',
          kind: 'chat',
          error: new AiCreditsError('quota'),
          fallbackMessage: 'coach.errors.generalError',
        })
      );

      expect(result.current.isCreditsError).toBe(true);
      expect(result.current.ephemeralErrorAsMessage?.text).toBe('coach.errors.creditsExhausted');
    });

    it('shows the failure of a reply that has no message of its own (a critique)', async () => {
      const { result } = await loaded('nutrition');

      act(() =>
        emitCoachReplyEvent({
          type: 'failed',
          context: 'nutrition',
          kind: 'mealCritique',
          error: null,
          fallbackMessage: 'food.actions.getMealInsightsError',
        })
      );

      expect(result.current.failedMessageText).toBeNull();
      expect(result.current.ephemeralErrorAsMessage?.text).toBe(
        'food.actions.getMealInsightsError'
      );
    });
  });

  describe('the composer after a reply that failed while nobody was looking', () => {
    it('is filled with the message that was sent', async () => {
      mockConsumeRestored.mockResolvedValue('what should I eat?');

      const { result } = await loaded();

      expect(mockConsumeRestored).toHaveBeenCalledWith('general');
      expect(result.current.failedMessageText).toBe('what should I eat?');
    });
  });

  describe('sending', () => {
    beforeEach(() => {
      mockGetAiConfig.mockResolvedValue({ provider: 'openai', model: 'm', apiKey: 'k' });
      mockSaveMessage.mockImplementation(async (params: { message: string }) =>
        record('u-new', 'user', params.message, 3000)
      );
    });

    it('hands a chat message to the reply service and returns without waiting for the reply', async () => {
      mockStartCoachReply.mockReturnValue(new Promise(() => {})); // never settles: not awaited
      const { result } = await loaded();

      await act(async () => {
        await result.current.sendMessage('how many sets?');
      });

      expect(mockStartCoachReply).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'chat',
          context: 'general',
          text: 'how many sets?',
          userRecord: expect.objectContaining({ id: 'u-new' }),
          history: [],
        })
      );
      // the sent message is on screen at once; the reply arrives through the service
      expect(result.current.messages.map((message) => message._id)).toEqual(['u-new']);
      expect(result.current.isSending).toBe(false);
    });

    it('does not send while another reply is being written, and says so', async () => {
      setActiveCoachReplyId('other-job');
      const { result } = await loaded();

      await act(async () => {
        await result.current.sendMessage('how many sets?');
      });

      expect(mockSaveMessage).not.toHaveBeenCalled();
      expect(mockStartCoachReply).not.toHaveBeenCalled();
      expect(result.current.ephemeralErrorAsMessage?.text).toBe('coach.errors.replyInProgress');
    });

    it('starts an insight job for an armed Analyze Progress', async () => {
      await AsyncStorage.setItem(CHAT_INTENTION_KEY, 'ANALYZE_PROGRESS');
      mockStartCoachReply.mockReturnValue(new Promise(() => {}));
      const { result } = await loaded('exercise');

      await act(async () => {
        await result.current.sendMessage('how am I doing?');
      });

      expect(mockStartCoachReply).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'analyzeProgress',
          context: 'exercise',
          text: 'how am I doing?',
          startDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
          endDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        })
      );
    });
  });
});
