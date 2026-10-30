/**
 * @jest-environment jsdom
 */

import { renderHook } from '@testing-library/react';

import { GUIDED_START_ROUTE, useAiGuidedExit } from '@/hooks/useAiGuidedExit';
import { stageAnswersForGuided } from '@/services/onboardingAnswersApply';

const mockReplace = jest.fn();

jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace }) }));
jest.mock('@/services/onboardingAnswersApply', () => ({ stageAnswersForGuided: jest.fn() }));
jest.mock('@/utils/handleError', () => ({ handleError: jest.fn() }));

const mockStage = stageAnswersForGuided as jest.Mock;
const draftWith = (overrides = {}) => ({
  answers: {},
  skipMusclogApi: false,
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockStage.mockResolvedValue(undefined);
});

const run = (mode: 'onboarding' | 'profile', draft: unknown, hasSaved = false) => {
  const discard = jest.fn();
  const { result } = renderHook(() =>
    useAiGuidedExit(mode, { draft: draft as never, hasSaved, discard })
  );
  return { exit: result.current, discard };
};

describe('useAiGuidedExit', () => {
  it('from the profile just goes back, touching no drafts', async () => {
    const { exit, discard } = run('profile', draftWith({ answers: { gender: 'male' } }), true);

    await exit();

    expect(mockReplace).toHaveBeenCalledWith('/app/profile');
    expect(mockStage).not.toHaveBeenCalled();
    expect(discard).not.toHaveBeenCalled();
  });

  it('in onboarding, hands answers to the forms, drops the AI session, then opens them', async () => {
    const { exit, discard } = run(
      'onboarding',
      draftWith({ answers: { gender: 'female' }, skipMusclogApi: true })
    );

    await exit();

    expect(mockStage).toHaveBeenCalledWith({ gender: 'female' }, { skipMusclogApi: true });
    expect(discard).toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith(GUIDED_START_ROUTE);
  });

  it('carries a chosen provider even when nothing was answered yet', async () => {
    const { exit } = run('onboarding', draftWith({ skipMusclogApi: true }));

    await exit();

    expect(mockStage).toHaveBeenCalledWith({}, { skipMusclogApi: true });
  });

  it('stages nothing when there is nothing to carry over', async () => {
    const { exit, discard } = run('onboarding', draftWith());

    await exit();

    expect(mockStage).not.toHaveBeenCalled();
    expect(discard).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith(GUIDED_START_ROUTE);
  });

  it('still opens the forms if carrying the answers over fails', async () => {
    mockStage.mockRejectedValue(new Error('disk'));
    const { exit, discard } = run('onboarding', draftWith({ answers: { gender: 'male' } }), true);

    await exit();

    expect(discard).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith(GUIDED_START_ROUTE);
  });

  it('copes with a session that has not loaded', async () => {
    const { exit } = run('onboarding', null);

    await exit();

    expect(mockReplace).toHaveBeenCalledWith(GUIDED_START_ROUTE);
  });
});
