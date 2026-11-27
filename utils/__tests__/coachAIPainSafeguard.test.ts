import { type CoachAIConfig, sendCoachMessage } from '../coachAI';
import { getChatMessagePromptContent } from '../prompts';

const mockSendLocalMessage = jest.fn();
const mockStreamLocalMessage = jest.fn();
const mockSendApple = jest.fn();
const mockCreate = jest.fn();

jest.mock('openai', () => {
  const OpenAIMock = jest.fn().mockImplementation(() => ({
    chat: { completions: { create: (...args: unknown[]) => mockCreate(...args) } },
  }));
  return Object.assign(OpenAIMock, { __esModule: true, default: OpenAIMock });
});
jest.mock('@/lang/lang', () => ({
  __esModule: true,
  DEFAULT_LANG: 'en-US',
  default: { t: (key: string) => `T:${key}` },
}));
jest.mock('../onDeviceAi', () => ({
  sendOnDeviceMessage: (...args: unknown[]) => mockSendApple(...args),
  sendOnDeviceStructured: jest.fn(),
  streamOnDeviceMessage: jest.fn(),
}));
jest.mock('../onDeviceLocal', () => ({
  sendLocalMessage: (...args: unknown[]) => mockSendLocalMessage(...args),
  streamLocalMessage: (...args: unknown[]) => mockStreamLocalMessage(...args),
  sendLocalStructuredRaw: jest.fn(),
}));
jest.mock('../handleError', () => ({ handleError: jest.fn() }));
jest.mock('../prompts', () => ({
  ...jest.requireActual('../prompts'),
  getChatMessagePromptContent: jest.fn().mockResolvedValue('SYSTEM'),
}));
jest.mock('@/database/services/DebugDumpService', () => ({
  DebugDumpService: { logJsonEvent: jest.fn() },
}));
jest.mock('@/database/services/SettingsService', () => ({
  SettingsService: { get: jest.fn().mockResolvedValue('off') },
}));

const mockPrompt = getChatMessagePromptContent as jest.Mock;

const onDevice = (engine: 'gguf' | 'apple', textModel?: boolean): CoachAIConfig => ({
  provider: 'on-device',
  model: 'on-device',
  language: 'en-US',
  engine,
  vision: false,
  textModel,
});

const PAIN = 'My knee hurts when I squat, what should I do?';

const painFlag = () => mockPrompt.mock.calls[0]?.[4]?.painMentioned;

describe('the on-device pain safeguard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSendLocalMessage.mockResolvedValue('A reply');
    mockStreamLocalMessage.mockResolvedValue('A reply');
    mockSendApple.mockResolvedValue('A reply');
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: '{"msg4User":"hi","remember_me":""}' } }],
    });
  });

  it('answers a pain message on the 450M model with the fixed reply and asks no model', async () => {
    const reply = await sendCoachMessage(onDevice('gguf'), [], PAIN, 'general', {
      onText: jest.fn(),
    });

    expect(reply.msg4User).toBe('T:coach.onDevicePainReply');
    expect(reply.sumMsg).toBe('T:coach.onDevicePainReply');
    expect(mockSendLocalMessage).not.toHaveBeenCalled();
    expect(mockStreamLocalMessage).not.toHaveBeenCalled();
    expect(mockPrompt).not.toHaveBeenCalled();
  });

  it('asks the model with the safety reminder when the text model is installed', async () => {
    await sendCoachMessage(onDevice('gguf', true), [], PAIN);

    expect(mockSendLocalMessage).toHaveBeenCalled();
    expect(painFlag()).toBe(true);
  });

  it("asks Apple's model with the safety reminder", async () => {
    await sendCoachMessage(onDevice('apple'), [], PAIN);

    expect(mockSendApple).toHaveBeenCalled();
    expect(painFlag()).toBe(true);
  });

  it('asks the 450M model as usual for a message that is not about pain', async () => {
    const reply = await sendCoachMessage(onDevice('gguf'), [], 'How much protein per day?');

    expect(mockSendLocalMessage).toHaveBeenCalled();
    expect(reply.msg4User).not.toBe('T:coach.onDevicePainReply');
    expect(painFlag()).toBe(false);
  });

  it('leaves a cloud provider unchanged', async () => {
    await sendCoachMessage(
      { provider: 'openai', model: 'm', apiKey: 'k', language: 'en-US' },
      [],
      PAIN
    );

    expect(mockCreate).toHaveBeenCalled();
    expect(mockPrompt.mock.calls[0]?.[4]?.painMentioned).toBeUndefined();
  });
});
