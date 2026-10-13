import { notifyUserFacingAiError, resetAiErrorNoticeCooldown } from '../aiErrorNotice';
import { AiCancelledError, AiInvalidKeyError, AiTimeoutError } from '../aiErrors';
import { showSnackbar } from '../snackbarService';

jest.mock('../snackbarService', () => ({ showSnackbar: jest.fn() }));
jest.mock('@/lang/lang', () => ({ __esModule: true, default: { t: (key: string) => key } }));

describe('notifyUserFacingAiError', () => {
  beforeEach(() => {
    (showSnackbar as jest.Mock).mockClear();
    resetAiErrorNoticeCooldown();
  });

  it('tells the user about a rejected key or a timeout', () => {
    notifyUserFacingAiError(new AiInvalidKeyError('gemini'), 100_000);
    expect(showSnackbar).toHaveBeenCalledWith('error', 'errors.aiInvalidApiKey');

    notifyUserFacingAiError(new AiTimeoutError(), 200_000);
    expect(showSnackbar).toHaveBeenLastCalledWith('error', 'errors.aiTimeout');
  });

  it('stays silent for a cancel and for ordinary errors', () => {
    notifyUserFacingAiError(new AiCancelledError(), 100_000);
    notifyUserFacingAiError(new Error('boom'), 100_000);
    expect(showSnackbar).not.toHaveBeenCalled();
  });

  it('does not stack identical notices from a screen that keeps retrying', () => {
    notifyUserFacingAiError(new AiTimeoutError(), 100_000);
    notifyUserFacingAiError(new AiTimeoutError(), 101_000);
    expect(showSnackbar).toHaveBeenCalledTimes(1);

    notifyUserFacingAiError(new AiTimeoutError(), 106_000);
    expect(showSnackbar).toHaveBeenCalledTimes(2);
  });
});
