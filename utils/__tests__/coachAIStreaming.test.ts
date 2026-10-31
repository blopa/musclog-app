import OpenAI from 'openai';

import {
  type CoachAIConfig,
  getMealCritique,
  getNutritionInsights,
  sendCoachMessage,
} from '../coachAI';
import { configureBasicGenAI } from '../gemini';

const mockCreate = jest.fn();
const mockOpenAIConstructor = jest.fn();
const mockSendOnDeviceMessage = jest.fn();
const mockStreamOnDeviceMessage = jest.fn();

jest.mock('openai', () => {
  const actual = jest.requireActual('openai');
  const Mock: any = function MockOpenAI(this: unknown, ...args: unknown[]) {
    mockOpenAIConstructor(...args);
    return { chat: { completions: { create: (...a: unknown[]) => mockCreate(...a) } } };
  };

  Object.assign(Mock, actual.default ?? actual);
  return { __esModule: true, default: Mock };
});

jest.mock('../onDeviceAi', () => ({
  sendOnDeviceMessage: (...args: unknown[]) => mockSendOnDeviceMessage(...args),
  sendOnDeviceStructured: jest.fn(),
  streamOnDeviceMessage: (...args: unknown[]) => mockStreamOnDeviceMessage(...args),
}));

jest.mock('../gemini', () => ({
  configureBasicGenAI: jest.fn(),
  buildGeminiGenerationConfig: jest.fn(() => ({})),
  extractGeminiText: jest.fn((chunk: { text?: string }) => ({
    text: chunk?.text ?? '',
    thoughtOnly: false,
  })),
}));

jest.mock('../prompts', () => ({
  getNutritionInsightsPrompt: jest.fn().mockResolvedValue('SYSTEM'),
  getMealCritiquePrompt: jest.fn().mockResolvedValue('SYSTEM'),
  getChatMessagePromptContent: jest.fn().mockResolvedValue('SYSTEM'),
}));

jest.mock('../handleError', () => ({ handleError: jest.fn() }));
jest.mock('@/database/services/DebugDumpService', () => ({
  DebugDumpService: { logJsonEvent: jest.fn() },
}));
jest.mock('@/database/services/SettingsService', () => ({ SettingsService: {} }));

const openai: CoachAIConfig = { provider: 'openai', model: 'gpt', apiKey: 'k', language: 'en-US' };
const gemini: CoachAIConfig = { provider: 'gemini', model: 'g', apiKey: 'k', language: 'en-US' };
const onDevice: CoachAIConfig = { provider: 'on-device', model: 'on-device', language: 'en-US' };

const delta = (content: string) => ({ choices: [{ delta: { content } }] });

async function* openAiChunks(...pieces: string[]) {
  for (const piece of pieces) {
    yield delta(piece);
  }
}

async function* chunksThenFailure(pieces: string[], error: Error) {
  for (const piece of pieces) {
    yield delta(piece);
  }

  throw error;
}

describe('streaming coach replies', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockCreate.mockReset();
    mockOpenAIConstructor.mockReset();
    mockSendOnDeviceMessage.mockReset();
    mockStreamOnDeviceMessage.mockReset();
    (configureBasicGenAI as jest.Mock).mockReset();
  });
  afterEach(() => jest.restoreAllMocks());

  describe('plain text (insights, critique)', () => {
    it('streams through the OpenAI client and returns the whole text', async () => {
      mockCreate.mockResolvedValue(openAiChunks('Your ', 'protein ', 'is on track.'));
      const seen: string[] = [];

      const result = await getNutritionInsights(
        openai,
        '2026-01-01',
        '2026-01-07',
        undefined,
        undefined,
        'nutrition',
        { onText: (text) => seen.push(text) }
      );

      expect(result).toBe('Your protein is on track.');
      expect(seen).toEqual(['Your ', 'Your protein ', 'Your protein is on track.']);
      expect(mockCreate.mock.calls[0][0]).toMatchObject({ stream: true });
    });

    it('sends the ordinary one-shot request when no stream is asked for', async () => {
      mockCreate.mockResolvedValue({ choices: [{ message: { content: 'All good.' } }] });

      const result = await getMealCritique(openai, 'lunch', [], {
        calories: 1,
        protein: 1,
        carbs: 1,
        fat: 1,
      });

      expect(result).toBe('All good.');
      expect(mockCreate.mock.calls[0][0]).not.toHaveProperty('stream');
    });

    it('streams through Gemini and skips empty chunks', async () => {
      async function* geminiChunks() {
        yield { text: 'Nice ' };
        yield { text: '' };
        yield { text: 'meal.' };
      }
      const generateContentStream = jest.fn().mockResolvedValue(geminiChunks());
      (configureBasicGenAI as jest.Mock).mockResolvedValue({ generateContentStream });
      const seen: string[] = [];

      const result = await getMealCritique(
        gemini,
        'lunch',
        [],
        { calories: 1, protein: 1, carbs: 1, fat: 1 },
        undefined,
        { onText: (text) => seen.push(text) }
      );

      expect(result).toBe('Nice meal.');
      expect(seen).toEqual(['Nice ', 'Nice meal.']);
    });

    it('does not retry once text has been shown, and fails the call', async () => {
      mockCreate.mockResolvedValue(
        chunksThenFailure(['Half of an ans'], Object.assign(new Error('boom'), { status: 500 }))
      );
      const seen: string[] = [];

      const result = await getNutritionInsights(
        openai,
        '2026-01-01',
        '2026-01-07',
        undefined,
        undefined,
        'nutrition',
        { onText: (text) => seen.push(text) }
      );

      expect(result).toBeNull();
      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(seen).toEqual(['Half of an ans']);
    });
  });

  describe('free chat (JSON reply)', () => {
    const reply = JSON.stringify({
      msg4User: 'Squats are great — "heavy" ones too.',
      sumMsg: 'About squats.',
      sumUserMsg: 'asked about squats',
      remember_me: 'likes squats',
    });
    const pieces = reply.match(/.{1,6}/gs) ?? [];

    it('shows only msg4User while the object is written, then parses the whole object', async () => {
      mockCreate.mockResolvedValue(openAiChunks(...pieces));
      const seen: string[] = [];

      const result = await sendCoachMessage(
        openai,
        [],
        'tell me about squats please, in detail',
        'general',
        {
          onText: (text) => seen.push(text),
        }
      );

      expect(result).toEqual({
        msg4User: 'Squats are great — "heavy" ones too.',
        sumMsg: 'About squats.',
        sumUserMsg: 'asked about squats',
        rememberMe: 'likes squats',
      });
      expect(seen.length).toBeGreaterThan(1);
      for (const text of seen) {
        expect(result.msg4User.startsWith(text)).toBe(true);
      }

      expect(seen[seen.length - 1]).toBe(result.msg4User);
    });

    it('throws, rather than saving a friendly error as the answer, when it fails after text was shown', async () => {
      mockCreate.mockResolvedValue(
        chunksThenFailure(pieces.slice(0, 4), Object.assign(new Error('boom'), { status: 500 }))
      );
      const seen: string[] = [];

      await expect(
        sendCoachMessage(openai, [], 'hello', 'general', { onText: (text) => seen.push(text) })
      ).rejects.toThrow('boom');
      expect(seen.length).toBeGreaterThan(0);
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it('streams a Gemini reply the same way', async () => {
      async function* geminiChunks() {
        for (const piece of pieces) {
          yield { text: piece };
        }
      }
      (configureBasicGenAI as jest.Mock).mockResolvedValue({
        generateContentStream: jest.fn().mockResolvedValue(geminiChunks()),
      });
      const seen: string[] = [];

      const result = await sendCoachMessage(gemini, [], 'hello', 'general', {
        onText: (text) => seen.push(text),
      });

      expect(result.msg4User).toBe('Squats are great — "heavy" ones too.');
      expect(result.rememberMe).toBe('likes squats');
      expect(seen[seen.length - 1]).toBe(result.msg4User);
    });
  });

  describe('on-device plain-text generation', () => {
    it('never builds an OpenAI client (it used to send the prompt to api.openai.com)', async () => {
      mockSendOnDeviceMessage.mockResolvedValue('  On-device answer.  ');

      const result = await getNutritionInsights(onDevice, '2026-01-01', '2026-01-07');

      expect(result).toBe('On-device answer.');
      expect(mockOpenAIConstructor).not.toHaveBeenCalled();
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('keeps the recent conversation, within the on-device budget', async () => {
      mockSendOnDeviceMessage.mockResolvedValue('ok');

      await getNutritionInsights(onDevice, '2026-01-01', '2026-01-07', 'remarks', [
        { role: 'user', content: 'hi' },
        { role: 'coach', content: 'hello' },
      ]);

      const messages = mockSendOnDeviceMessage.mock.calls[0][0] as { role: string }[];
      expect(messages.map((m) => m.role)).toEqual(['user', 'assistant', 'user']);
      expect(mockOpenAIConstructor).not.toHaveBeenCalled();
    });

    it('streams through the on-device model', async () => {
      mockStreamOnDeviceMessage.mockImplementation(
        async (_messages: unknown, _system: unknown, onDelta: (delta: string) => void) => {
          onDelta('Local ');
          onDelta('answer.');
          return 'Local answer.';
        }
      );
      const seen: string[] = [];

      const result = await getMealCritique(
        onDevice,
        'lunch',
        [],
        { calories: 1, protein: 1, carbs: 1, fat: 1 },
        undefined,
        { onText: (text) => seen.push(text) }
      );

      expect(result).toBe('Local answer.');
      expect(seen).toEqual(['Local ', 'Local answer.']);
      expect(mockOpenAIConstructor).not.toHaveBeenCalled();
    });
  });
});

// keep the real SDK referenced so the mock keeps its static error classes
void OpenAI;
