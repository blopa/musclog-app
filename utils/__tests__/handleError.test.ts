import { handleError } from '../handleError';

const mockCaptureException = jest.fn();

jest.mock('../sentry', () => ({
  captureException: (...args: unknown[]) => mockCaptureException(...args),
}));

jest.mock('../snackbarService', () => ({ showSnackbar: jest.fn() }));

jest.mock('@/utils/app', () => ({ isProduction: () => true }));

describe('handleError', () => {
  beforeEach(() => {
    mockCaptureException.mockReset();
  });

  it('sends the context as a Sentry tag, where it is actually attached to the event', async () => {
    const error = new Error('boom');

    await handleError(error, 'FoodSearchModal.handleSameAsYesterday');

    // A hint's `data` field never reaches the event, so the context must be in captureContext.
    expect(mockCaptureException).toHaveBeenCalledWith(error, {
      captureContext: { tags: { context: 'FoodSearchModal.handleSameAsYesterday' } },
    });
  });

  it('does not report when sendToSentry is false', async () => {
    await handleError(new Error('boom'), 'ctx', { sendToSentry: false });

    expect(mockCaptureException).not.toHaveBeenCalled();
  });
});
