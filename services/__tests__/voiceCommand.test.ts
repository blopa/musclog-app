import { SettingsService } from '@/database/services/SettingsService';
import { AiService } from '@/services/AiService';
import { interpretVoiceCommand } from '@/services/voiceCommand';
import { AiCancelledError } from '@/utils/aiErrors';
import { reportAiEvent } from '@/utils/aiTelemetry';
import {
  AiCreditsError,
  reportAiError,
  requestNativeToolCall,
  requestStructured,
} from '@/utils/coachAI';
import { prepareChatText, wrapUserContent } from '@/utils/promptSanitizer';
import {
  buildNativeVoiceTools,
  nativeVoiceExamples,
  nativeVoiceMessages,
} from '@/utils/voiceCommand/nativeTools';
import { getVoiceCommandSystemPrompt } from '@/utils/voiceCommand/prompt';
import type { VoiceActionTool } from '@/utils/voiceCommand/types';

jest.mock('@/database/services/SettingsService', () => {
  const { settingsGetMock } = jest.requireActual('@/database/services/__tests__/settingsGetMock');
  return {
    SettingsService: {
      get: settingsGetMock(),
      getUnits: jest.fn().mockResolvedValue('metric'),
    },
  };
});

jest.mock('@/lang/lang', () => ({
  __esModule: true,
  AVAILABLE_LANGUAGES: [],
  default: { t: (key: string) => key },
}));
jest.mock('@/services/AiService', () => ({ AiService: { getAiConfig: jest.fn() } }));
jest.mock('@/utils/aiTelemetry', () => ({ reportAiEvent: jest.fn() }));
jest.mock('@/utils/coachAI', () => {
  class AiCreditsErrorMock extends Error {}
  class GatewayRateLimitErrorMock extends AiCreditsErrorMock {}
  return {
    AiCreditsError: AiCreditsErrorMock,
    GatewayRateLimitError: GatewayRateLimitErrorMock,
    isAiCreditsError: jest.fn(() => false),
    reportAiError: jest.fn(),
    requestNativeToolCall: jest.fn(),
    requestStructured: jest.fn(),
  };
});

const mockGetAiConfig = AiService.getAiConfig as jest.Mock;
const mockGetSetting = SettingsService.get as jest.Mock;

/** The downloaded model without the 1.2B text model: three tools, in native order. */
const GGUF_OFFERED: VoiceActionTool[] = ['search_food', 'copy_meal', 'log_weight'];
/** Every action tool in native order: what a cloud provider is offered by default. */
const ALL_OFFERED: VoiceActionTool[] = [
  'search_food',
  'copy_meal',
  'log_weight',
  'log_meal',
  'add_note',
  'go_to',
];
const mockRequest = requestStructured as jest.Mock;
const mockNativeRequest = requestNativeToolCall as jest.Mock;
const mockReportAiError = reportAiError as jest.Mock;
const mockReportAiEvent = reportAiEvent as jest.Mock;

const NOW = new Date(2026, 10, 26, 12, 0, 0);
const TRANSCRIPT = 'I had the same breakfast as yesterday';

beforeEach(() => {
  jest.clearAllMocks();
  mockGetAiConfig.mockResolvedValue({ provider: 'gemini', apiKey: 'key' });
});

describe('interpretVoiceCommand', () => {
  it('is unavailable and makes no request when no provider is configured', async () => {
    mockGetAiConfig.mockResolvedValue(null);

    await expect(interpretVoiceCommand(TRANSCRIPT, { now: NOW })).resolves.toEqual({
      kind: 'unavailable',
    });
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it('turns an ok reply into a copyMeal action', async () => {
    mockRequest.mockResolvedValue({
      kind: 'ok',
      value: {
        commands: [{ tool: 'copy_meal', meal: 'breakfast', from_day: 'yesterday' }],
      },
    });

    const outcome = await interpretVoiceCommand(TRANSCRIPT, { now: NOW });

    expect(outcome).toEqual({
      kind: 'action',
      offered: expect.any(Array),
      action: expect.objectContaining({
        kind: 'copyMeal',
        meals: { source: 'breakfast', target: 'breakfast' },
      }),
    });
  });

  it('rejects cant_determine_tool as cantDetermine', async () => {
    mockRequest.mockResolvedValue({
      kind: 'ok',
      value: { commands: [{ tool: 'cant_determine_tool' }] },
    });

    await expect(interpretVoiceCommand(TRANSCRIPT, { now: NOW })).resolves.toEqual({
      kind: 'rejected',
      reason: 'cantDetermine',
      offered: expect.any(Array),
    });
  });

  it('rejects none as noAction', async () => {
    mockRequest.mockResolvedValue({ kind: 'ok', value: { commands: [{ tool: 'none' }] } });

    await expect(interpretVoiceCommand(TRANSCRIPT, { now: NOW })).resolves.toEqual({
      kind: 'rejected',
      reason: 'noAction',
      offered: expect.any(Array),
    });
  });

  it('treats an empty command list as cantDetermine', async () => {
    mockRequest.mockResolvedValue({ kind: 'ok', value: { commands: [] } });

    await expect(interpretVoiceCommand(TRANSCRIPT, { now: NOW })).resolves.toEqual({
      kind: 'rejected',
      reason: 'cantDetermine',
      offered: expect.any(Array),
    });
  });

  it('rejects a malformed reply as unreadable and reports it without the transcript', async () => {
    mockRequest.mockResolvedValue({ kind: 'ok', value: 'not an object' });

    await expect(interpretVoiceCommand(TRANSCRIPT, { now: NOW })).resolves.toEqual({
      kind: 'rejected',
      reason: 'unreadable',
      offered: expect.any(Array),
    });
    expect(mockReportAiEvent).toHaveBeenCalledWith(
      'voice-command-unusable',
      expect.objectContaining({ provider: 'gemini', operation: 'voiceCommand' })
    );
    expect(JSON.stringify(mockReportAiEvent.mock.calls)).not.toContain(TRANSCRIPT);
  });

  it('makes one extraction request with the transcript wrapped and no custom prompts', async () => {
    mockRequest.mockResolvedValue({ kind: 'ok', value: { commands: [{ tool: 'none' }] } });
    const controller = new AbortController();

    await interpretVoiceCommand(TRANSCRIPT, { now: NOW, signal: controller.signal });

    expect(mockRequest).toHaveBeenCalledTimes(1);
    expect(mockRequest).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'gemini', apiKey: 'key', signal: controller.signal }),
      expect.objectContaining({
        operation: 'voiceCommand',
        task: 'extraction',
        history: [],
        systemPrompt: getVoiceCommandSystemPrompt(),
        userMessage: wrapUserContent(TRANSCRIPT),
      })
    );
  });

  it('rejects a search for a food that was never said, whichever tool picked it', async () => {
    mockRequest.mockResolvedValue({
      kind: 'ok',
      value: { commands: [{ tool: 'search_food', food: 'banana' }] },
    });

    await expect(interpretVoiceCommand('What did I eat yesterday?', { now: NOW })).resolves.toEqual(
      { kind: 'rejected', reason: 'cantDetermine', offered: expect.any(Array) }
    );
  });

  it('rejects a command whose argument is not an allowed value', async () => {
    mockRequest.mockResolvedValue({
      kind: 'ok',
      value: { commands: [{ tool: 'copy_meal', meal: 'breakfast', from_day: 'tomorrow' }] },
    });

    await expect(interpretVoiceCommand(TRANSCRIPT, { now: NOW })).resolves.toEqual({
      kind: 'rejected',
      reason: 'cantDetermine',
      offered: expect.any(Array),
    });
  });

  it('rethrows a generic error and reports it through reportAiError', async () => {
    const error = new Error('boom');
    mockRequest.mockRejectedValue(error);

    await expect(interpretVoiceCommand(TRANSCRIPT, { now: NOW })).rejects.toBe(error);
    expect(mockReportAiError).toHaveBeenCalledWith(error, 'voiceCommand.interpret');
  });

  it('rethrows a cancel as it is and does not report it', async () => {
    const cancelled = new AiCancelledError();
    mockRequest.mockRejectedValue(cancelled);

    await expect(interpretVoiceCommand(TRANSCRIPT, { now: NOW })).rejects.toBe(cancelled);
    expect(mockReportAiError).not.toHaveBeenCalled();
  });

  it('turns a spent allowance into a credits error and reports it', async () => {
    const error = new Error('402');
    mockRequest.mockRejectedValue(error);
    const { isAiCreditsError } = jest.requireMock('@/utils/coachAI') as {
      isAiCreditsError: jest.Mock;
    };
    isAiCreditsError.mockReturnValueOnce(true);

    await expect(interpretVoiceCommand(TRANSCRIPT, { now: NOW })).rejects.toBeInstanceOf(
      AiCreditsError
    );
    expect(mockReportAiError).toHaveBeenCalledWith(error, 'voiceCommand.interpret');
  });
});

describe('interpretVoiceCommand on the downloaded model', () => {
  const GGUF = { provider: 'on-device', engine: 'gguf', vision: true };

  beforeEach(() => {
    mockGetAiConfig.mockResolvedValue(GGUF);
  });

  it("asks in the model's own tool-call format: the example turns, then the sentence", async () => {
    mockNativeRequest.mockResolvedValue({ text: 'Hello Pablo!', toolCalls: [] });
    const controller = new AbortController();

    await interpretVoiceCommand('Hello my name is Pablo', { now: NOW, signal: controller.signal });

    expect(mockRequest).not.toHaveBeenCalled();
    expect(mockNativeRequest).toHaveBeenCalledTimes(1);
    expect(mockNativeRequest).toHaveBeenCalledWith(
      expect.objectContaining({ ...GGUF, signal: controller.signal }),
      {
        operation: 'voiceCommand',
        redactDump: true,
        messages: [
          ...nativeVoiceExamples(GGUF_OFFERED),
          { role: 'user', content: prepareChatText('Hello my name is Pablo') },
        ],
        tools: buildNativeVoiceTools(GGUF_OFFERED),
      }
    );
  });

  it('gives the text model its instruction and its own tool wording on a first try', async () => {
    mockGetAiConfig.mockResolvedValue({ ...GGUF, textModel: true });
    mockNativeRequest.mockResolvedValue({ text: 'Okay.', toolCalls: [] });

    await interpretVoiceCommand('Hello my name is Pablo', { now: NOW });

    expect(mockNativeRequest).toHaveBeenCalledWith(
      expect.objectContaining({ ...GGUF, textModel: true }),
      {
        operation: 'voiceCommand',
        redactDump: true,
        messages: [
          ...nativeVoiceMessages(ALL_OFFERED.slice(0, 5), undefined, 'text'),
          { role: 'user', content: prepareChatText('Hello my name is Pablo') },
        ],
        tools: buildNativeVoiceTools(ALL_OFFERED.slice(0, 5), undefined, 'text'),
      }
    );
  });

  it('sends the example turns once the person picked a tool, with the text model wording', async () => {
    mockGetAiConfig.mockResolvedValue({ ...GGUF, textModel: true });
    mockNativeRequest.mockResolvedValue({ text: '', toolCalls: [] });

    await interpretVoiceCommand('I had the same breakfast as yesterday.', {
      now: NOW,
      tool: 'copy_meal',
    });

    const [, request] = mockNativeRequest.mock.calls[mockNativeRequest.mock.calls.length - 1];

    expect(request.messages.slice(0, -1)).toEqual(nativeVoiceExamples(ALL_OFFERED.slice(0, 5)));
    expect(request.tools).toEqual(
      buildNativeVoiceTools(ALL_OFFERED.slice(0, 5), 'copy_meal', 'text')
    );
  });

  it('reads a reply with no tool call as not a request', async () => {
    mockNativeRequest.mockResolvedValue({ text: 'Hello Pablo!', toolCalls: [] });

    await expect(interpretVoiceCommand('Hello my name is Pablo', { now: NOW })).resolves.toEqual({
      kind: 'rejected',
      reason: 'noAction',
      offered: expect.any(Array),
    });
  });

  it('turns a tool call into an action', async () => {
    mockNativeRequest.mockResolvedValue({
      text: '',
      toolCalls: [{ name: 'search_food', arguments: '{"food":"eggs","meal":"breakfast"}' }],
    });

    await expect(
      interpretVoiceCommand('I had two eggs for breakfast', { now: NOW })
    ).resolves.toEqual({
      kind: 'action',
      offered: expect.any(Array),
      action: expect.objectContaining({ kind: 'searchFood', query: 'eggs', mealType: 'breakfast' }),
    });
  });

  it('rejects the filler arguments the model writes when it has nothing to copy', async () => {
    mockNativeRequest.mockResolvedValue({
      text: '',
      toolCalls: [{ name: 'copy_meal', arguments: '{"meal":"lunch","from_day":"tomorrow"}' }],
    });

    await expect(interpretVoiceCommand('I went to the gym', { now: NOW })).resolves.toEqual({
      kind: 'rejected',
      reason: 'cantDetermine',
      offered: expect.any(Array),
    });
  });

  it('reports arguments that are not JSON as an unreadable reply', async () => {
    mockNativeRequest.mockResolvedValue({
      text: '',
      toolCalls: [{ name: 'search_food', arguments: 'food=eggs' }],
    });

    await expect(interpretVoiceCommand('I had eggs', { now: NOW })).resolves.toEqual({
      kind: 'rejected',
      reason: 'unreadable',
      offered: expect.any(Array),
    });
    expect(mockReportAiEvent).toHaveBeenCalledWith(
      'voice-command-unusable',
      expect.objectContaining({ provider: 'on-device', operation: 'voiceCommand' })
    );
  });
});

describe('interpretVoiceCommand with the tool the person picked', () => {
  const config = { provider: 'on-device', engine: 'gguf' };
  const call = (name: string, args: string) => ({
    text: '',
    toolCalls: [{ id: 'c', name, arguments: args }],
  });

  beforeEach(() => {
    mockGetAiConfig.mockResolvedValue(config);
  });

  it('offers only that tool and ignores the values it cannot use', async () => {
    mockNativeRequest.mockResolvedValue(
      call('copy_meal', '{"meal":"breakfast","from_meal":"tomorrow","from_day":"yesterday"}')
    );

    const outcome = await interpretVoiceCommand('I had the same breakfast as yesterday.', {
      now: NOW,
      tool: 'copy_meal',
    });

    expect(
      mockNativeRequest.mock.calls[0][1].tools.map((tool: { name: string }) => tool.name)
    ).toEqual(['copy_meal']);
    expect(outcome).toEqual({
      kind: 'action',
      offered: expect.any(Array),
      action: expect.objectContaining({
        kind: 'copyMeal',
        meals: { source: 'breakfast', target: 'breakfast' },
      }),
    });
  });

  it.each([
    ['a plain-text answer', { text: 'Done.', toolCalls: [] }],
    ['unreadable arguments', call('search_food', '{oops')],
    ['a food nobody said', call('search_food', '{"food":"banana"}')],
  ])('still opens an empty food search for %s', async (_label, reply) => {
    mockNativeRequest.mockResolvedValue(reply);

    const outcome = await interpretVoiceCommand('the usual', { now: NOW, tool: 'search_food' });

    expect(outcome).toEqual({
      kind: 'action',
      offered: expect.any(Array),
      action: expect.objectContaining({ kind: 'searchFood', query: '' }),
    });
  });
});

describe('interpretVoiceCommand: how many tools a request offers', () => {
  const NONE = { kind: 'ok', value: { commands: [{ tool: 'none' }] } };

  beforeEach(() => {
    mockRequest.mockResolvedValue(NONE);
    mockNativeRequest.mockResolvedValue({ text: 'Hi', toolCalls: [] });
  });

  async function offeredFor(config: object): Promise<VoiceActionTool[]> {
    mockGetAiConfig.mockResolvedValue(config);
    const outcome = await interpretVoiceCommand(TRANSCRIPT, { now: NOW });

    return outcome.kind === 'rejected' || outcome.kind === 'action' ? outcome.offered : [];
  }

  it('offers all six tools to a cloud provider by default', async () => {
    expect(await offeredFor({ provider: 'gemini', apiKey: 'key' })).toEqual(ALL_OFFERED);
  });

  it('offers three tools to the downloaded model without its text model', async () => {
    expect(await offeredFor({ provider: 'on-device', engine: 'gguf' })).toEqual(GGUF_OFFERED);
  });

  it('offers five tools to the downloaded model with its text model', async () => {
    expect(await offeredFor({ provider: 'on-device', engine: 'gguf', textModel: true })).toEqual(
      ALL_OFFERED.slice(0, 5)
    );
  });

  it('offers five tools to a custom local server', async () => {
    expect(await offeredFor({ provider: 'local' })).toEqual(ALL_OFFERED.slice(0, 5));
  });

  it('offers the first picks in the order the person chose them, then in native order', async () => {
    mockGetSetting.mockResolvedValueOnce('go_to,log_weight');

    expect(await offeredFor({ provider: 'gemini', apiKey: 'key' })).toEqual([
      'log_weight',
      'go_to',
    ]);
  });
});
