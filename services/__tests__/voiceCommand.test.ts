import { AiService } from '@/services/AiService';
import { interpretVoiceCommand } from '@/services/voiceCommand';
import { AiCancelledError } from '@/utils/aiErrors';
import { reportAiEvent } from '@/utils/aiTelemetry';
import { AiCreditsError, reportAiError, requestStructured } from '@/utils/coachAI';
import { wrapUserContent } from '@/utils/promptSanitizer';
import { getVoiceCommandSystemPrompt } from '@/utils/voiceCommand/prompt';

jest.mock('@/lang/lang', () => ({ __esModule: true, default: { t: (key: string) => key } }));
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
    requestStructured: jest.fn(),
  };
});

const mockGetAiConfig = AiService.getAiConfig as jest.Mock;
const mockRequest = requestStructured as jest.Mock;
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
    });
  });

  it('rejects none as noAction', async () => {
    mockRequest.mockResolvedValue({ kind: 'ok', value: { commands: [{ tool: 'none' }] } });

    await expect(interpretVoiceCommand(TRANSCRIPT, { now: NOW })).resolves.toEqual({
      kind: 'rejected',
      reason: 'noAction',
    });
  });

  it('treats an empty command list as cantDetermine', async () => {
    mockRequest.mockResolvedValue({ kind: 'ok', value: { commands: [] } });

    await expect(interpretVoiceCommand(TRANSCRIPT, { now: NOW })).resolves.toEqual({
      kind: 'rejected',
      reason: 'cantDetermine',
    });
  });

  it('rejects a malformed reply as unreadable and reports it without the transcript', async () => {
    mockRequest.mockResolvedValue({ kind: 'ok', value: 'not an object' });

    await expect(interpretVoiceCommand(TRANSCRIPT, { now: NOW })).resolves.toEqual({
      kind: 'rejected',
      reason: 'unreadable',
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
