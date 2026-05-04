import { runEntryOnboardingRedirect } from '@/utils/entryOnboardingRedirect';
import * as onboardingService from '@/utils/onboardingService';

const mockHandleError = jest.fn();

jest.mock('@/utils/handleError', () => ({
  handleError: (...args: unknown[]) => mockHandleError(...args),
}));

describe('utils/entryOnboardingRedirect', () => {
  const router = {
    replace: jest.fn(),
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not self-redirect when onboarding is complete and already on /app', async () => {
    jest.spyOn(onboardingService, 'isOnboardingCompleted').mockResolvedValue(true);

    await runEntryOnboardingRedirect(router, 'entry.redirect', '/app');

    expect(router.replace).not.toHaveBeenCalled();
  });

  it('redirects to the saved onboarding step when onboarding is incomplete', async () => {
    jest.spyOn(onboardingService, 'isOnboardingCompleted').mockResolvedValue(false);
    jest
      .spyOn(onboardingService, 'getCurrentOnboardingStep')
      .mockResolvedValue('/app/onboarding/personalized-goals');

    await runEntryOnboardingRedirect(router, 'entry.redirect', '/app');

    expect(router.replace).toHaveBeenCalledWith('/app/onboarding/personalized-goals');
  });

  it('falls back to landing when restoring the step fails', async () => {
    jest.spyOn(onboardingService, 'isOnboardingCompleted').mockResolvedValue(false);
    jest
      .spyOn(onboardingService, 'getCurrentOnboardingStep')
      .mockRejectedValue(new Error('storage failed'));

    await runEntryOnboardingRedirect(router, 'entry.redirect', '/app');

    expect(mockHandleError).toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith('/app/onboarding/landing');
  });
});
