import { type CoachAIConfig, sendCoachMessage } from '../coachAI';

const mockCreate = jest.fn();

jest.mock('../claude', () => {
  const actual = jest.requireActual('../claude');
  return {
    ...actual,
    buildClaudeClient: jest.fn(() => ({
      messages: { create: (...args: unknown[]) => mockCreate(...args), stream: jest.fn() },
    })),
  };
});
jest.mock('../onDeviceAi', () => ({
  sendOnDeviceMessage: jest.fn(),
  sendOnDeviceStructured: jest.fn(),
  streamOnDeviceMessage: jest.fn(),
}));
const mockChatPrompt = jest.fn().mockResolvedValue('SYSTEM');
jest.mock('../prompts', () => ({
  getNutritionInsightsPrompt: jest.fn().mockResolvedValue('SYSTEM'),
  getChatMessagePromptContent: (...args: unknown[]) => mockChatPrompt(...args),
}));
jest.mock('../handleError', () => ({ handleError: jest.fn() }));
jest.mock('@/database/services/DebugDumpService', () => ({
  DebugDumpService: { logJsonEvent: jest.fn() },
}));
jest.mock('@/database/services/SettingsService', () => ({
  SettingsService: { get: jest.fn().mockResolvedValue('off') },
}));

const claude: CoachAIConfig = {
  provider: 'claude',
  model: 'claude-opus-5-5',
  apiKey: 'k',
  language: 'en-US',
};

const reply = (text: string) => ({
  content: [{ type: 'text', text }],
  stop_reason: 'end_turn',
  usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 90 },
});

describe('chat request', () => {
  beforeEach(() => {
    mockCreate.mockReset();
    mockCreate.mockResolvedValue(reply(JSON.stringify({ msg4User: 'ok', remember_me: '' })));
    mockChatPrompt.mockClear();
  });

  it('sends the message as typed, not escaped', async () => {
    const text = 'I\'m cutting "slowly"\nsecond line with `code` and 5 < 6';

    await sendCoachMessage(claude, [], text);

    const sent = mockCreate.mock.calls[0][0].messages.at(-1).content as string;
    expect(sent).toContain(text);
    expect(sent).not.toContain("\\'");
    expect(sent).not.toContain('&lt;');
  });

  it('tags user turns with their time and leaves coach turns alone', async () => {
    const at = new Date(2026, 10, 1, 9, 30).getTime();

    await sendCoachMessage(
      claude,
      [
        { role: 'user', content: 'first', at },
        { role: 'coach', content: 'answer', at: at + 1000 },
      ],
      'second'
    );

    const messages = mockCreate.mock.calls[0][0].messages;
    expect(messages[0].content).toBe('[2026-11-01 Sun 09:30] first');
    expect(messages[1].content).toBe('answer');
    expect(messages[2].content).toMatch(
      /^\[\d{4}-\d{2}-\d{2} \w{3} \d{2}:\d{2} · .+since the last message\] second$/
    );
  });

  it('no longer asks the model for summaries, and asks for remember_me every time', async () => {
    await sendCoachMessage(
      claude,
      [],
      'a message that is longer than fifty characters, for sure, yes'
    );

    const schema = mockCreate.mock.calls[0][0].output_config.format.schema;
    expect(Object.keys(schema.properties)).toEqual(['msg4User', 'remember_me']);
    expect(schema.required).toEqual(['msg4User', 'remember_me']);
  });

  it('turns on prompt caching for the chat', async () => {
    await sendCoachMessage(claude, [], 'hi');

    expect(mockCreate.mock.calls[0][0].cache_control).toEqual({ type: 'ephemeral' });
  });

  it('asks the prompt to leave out a workout the history already carries in full', async () => {
    await sendCoachMessage(
      claude,
      [{ role: 'user', content: 'finished', workoutLogId: 'w1' }],
      'thoughts?',
      'exercise'
    );

    expect(mockChatPrompt).toHaveBeenCalledWith('en-US', undefined, 'exercise', 'claude', {
      excludeWorkoutLogIds: ['w1'],
    });
  });

  it('returns a reply with no summary fields', async () => {
    const result = await sendCoachMessage(claude, [], 'hi');

    expect(result).toMatchObject({ msg4User: 'ok' });
    expect(result.sumMsg).toBeUndefined();
  });
});

// The replay set: real failures from the maintainer's own chats. The request side is checked here;
// each scenario's `replyRubric` is what to read a live reply against (see docs/RESEARCH.md → Coach
// conversation quality).
import scenarios from './fixtures/coachReplay/scenarios.json';

type Scenario = (typeof scenarios)[number];

describe('replay scenarios (request side)', () => {
  const HOUR = 60 * 60 * 1000;

  beforeEach(() => {
    mockCreate.mockReset();
    mockCreate.mockResolvedValue(reply(JSON.stringify({ msg4User: 'ok', remember_me: '' })));
    mockChatPrompt.mockClear();
  });

  it.each(scenarios.map((s) => [s.name, s] as [string, Scenario]))(
    '%s',
    async (_name, scenario) => {
      const now = Date.now();
      const history = scenario.history.map((turn) => ({
        role: turn.role as 'user' | 'coach',
        content: turn.content,
        at: now - turn.hoursAgo * HOUR,
        ...('workoutLogId' in turn ? { workoutLogId: turn.workoutLogId as string } : {}),
      }));

      await sendCoachMessage(
        claude,
        history,
        scenario.userMessage,
        scenario.context as 'general' | 'exercise'
      );

      const messages = mockCreate.mock.calls[0][0].messages as { role: string; content: string }[];
      const checks = scenario.requestChecks as Record<string, unknown>;

      if (checks.lastCoachTurnVerbatim) {
        const lastCoach = [...scenario.history].reverse().find((t) => t.role === 'coach')!;
        expect(messages.some((m) => m.content === lastCoach.content)).toBe(true);
      }

      if (checks.userTurnsTimeTagged) {
        const userMessages = messages.filter((m) => m.role === 'user');
        expect(userMessages.length).toBeGreaterThan(0);
        userMessages.forEach((m) =>
          expect(m.content).toMatch(/^\[\d{4}-\d{2}-\d{2} \w{3} \d{2}:\d{2}/)
        );
      }

      if (checks.excludesWorkoutFromPrompt) {
        expect(mockChatPrompt.mock.calls[0][4]).toEqual({
          excludeWorkoutLogIds: [checks.excludesWorkoutFromPrompt],
        });
      }

      if (checks.newestMessageMentionsPause) {
        expect(messages[messages.length - 1].content).toContain('since the last message');
      }
    }
  );
});

describe('replay scenario shape', () => {
  const CONTEXTS = ['general', 'nutrition', 'exercise'];
  const ROLES = ['user', 'coach'];

  it('keeps every scenario well formed', () => {
    const names = scenarios.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);

    for (const s of scenarios) {
      expect(s.name.trim().length).toBeGreaterThan(0);
      expect(CONTEXTS).toContain(s.context);
      expect(s.userMessage.trim().length).toBeGreaterThan(0);
      expect(s.replyRubric.length).toBeGreaterThanOrEqual(2);
      s.replyRubric.forEach((line) => expect(line.trim().length).toBeGreaterThan(0));
      for (const turn of s.history) {
        expect(ROLES).toContain(turn.role);
        expect(typeof turn.hoursAgo).toBe('number');
        expect(turn.hoursAgo).toBeGreaterThanOrEqual(0);
      }
      const snapshot = (s as { snapshot?: string }).snapshot;
      if (snapshot !== undefined) {
        expect(snapshot.startsWith('Right now, read from the app')).toBe(true);
      }
    }
  });

  it('has at least 20 scenarios, 4 of them non-English', () => {
    expect(scenarios.length).toBeGreaterThanOrEqual(20);
    const nonAscii = scenarios.filter((s) => /[^\x00-\x7F]/.test(s.userMessage));
    expect(nonAscii.length).toBeGreaterThanOrEqual(4);
  });
});
