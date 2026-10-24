import { navigateBack, resolveScreenHeaderForm } from '@/components/theme/screenHeaderForm';

const DEFAULT_SLOTS = { 1: 'workouts', 2: 'food', 3: 'profile' } as const;

describe('resolveScreenHeaderForm', () => {
  it('is a root while the screen is one of the bottom bar slots', () => {
    expect(resolveScreenHeaderForm('workouts', DEFAULT_SLOTS)).toBe('root');
    expect(resolveScreenHeaderForm('profile', DEFAULT_SLOTS)).toBe('root');
  });

  it('is pushed when the screen was reached from somewhere other than the bar', () => {
    expect(resolveScreenHeaderForm('cycle', DEFAULT_SLOTS)).toBe('pushed');
    expect(resolveScreenHeaderForm('notes', DEFAULT_SLOTS)).toBe('pushed');
  });

  it('follows the user’s own slot choice', () => {
    const slots = { 1: 'notes', 2: 'cycle', 3: 'checkin' } as const;
    expect(resolveScreenHeaderForm('notes', slots)).toBe('root');
    expect(resolveScreenHeaderForm('workouts', slots)).toBe('pushed');
  });

  it('is always pushed for a screen that hides the bar (no destination)', () => {
    expect(resolveScreenHeaderForm(undefined, DEFAULT_SLOTS)).toBe('pushed');
  });
});

describe('navigateBack', () => {
  const makeRouter = (canGoBack: boolean) => ({
    canGoBack: jest.fn(() => canGoBack),
    back: jest.fn(),
    replace: jest.fn(),
  });

  it('goes back to where the user came from', () => {
    const router = makeRouter(true);
    navigateBack(router);
    expect(router.back).toHaveBeenCalledTimes(1);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('falls back to Home for a screen opened cold, so the button is never dead', () => {
    const router = makeRouter(false);
    navigateBack(router);
    expect(router.back).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith('/app');
  });
});
