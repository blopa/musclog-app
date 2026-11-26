import { act, fireEvent, render, screen } from '@testing-library/react';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

import { AppErrorBoundary } from '@/components/AppErrorBoundary';
import { FatalErrorOverlay } from '@/components/FatalErrorOverlay';
import { reloadApp } from '@/utils/app';
import { resetFatalErrorStoreForTests, showFatalError } from '@/utils/fatalErrorStore';
import { captureException } from '@/utils/sentry';

jest.mock('@/hooks/useTheme', () => ({ useTheme: () => require('@/theme').darkTheme }));
jest.mock('@/utils/sentry', () => ({ captureException: jest.fn(() => Promise.resolve()) }));
jest.mock('@/utils/app', () => ({ reloadApp: jest.fn(() => Promise.resolve()) }));
jest.mock('@/components/ErrorFallbackScreen', () => ({
  ErrorFallbackScreen: ({ error, resetError }: { error: unknown; resetError: () => void }) => (
    <div>
      <span>fallback: {(error as Error).message}</span>
      <button onClick={resetError}>reset</button>
    </div>
  ),
}));
jest.mock('@/components/theme/Button', () => ({
  Button: ({ label, onPress }: { label: string; onPress: () => void }) => (
    <button onClick={onPress}>{label}</button>
  ),
}));
jest.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => undefined },
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en-US' } }),
}));

/** Shaped like vision-camera's CameraError: `cause` is a getter, so assigning to it throws. */
class GetterCauseError extends Error {
  get cause(): undefined {
    return undefined;
  }
}

let shouldThrow = true;

function Screen() {
  if (shouldThrow) {
    throw new GetterCauseError('device/invalid-device');
  }

  return <span>app content</span>;
}

describe('AppErrorBoundary', () => {
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    shouldThrow = true;
    jest.clearAllMocks();
    // React logs every caught render error; the test asserts on the outcome instead.
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => consoleError.mockRestore());

  it('shows the fallback and reports once, even for an error whose cause cannot be set', () => {
    render(
      <AppErrorBoundary>
        <Screen />
      </AppErrorBoundary>
    );

    expect(screen.getByText('fallback: device/invalid-device')).toBeTruthy();
    expect(captureException).toHaveBeenCalledTimes(1);
    expect(jest.mocked(captureException).mock.calls[0][1]).toMatchObject({
      captureContext: { tags: { context: 'app.errorBoundary' } },
    });
  });

  it('stays on the fallback when reporting throws', () => {
    jest.mocked(captureException).mockImplementationOnce(() => {
      throw new Error('sentry broke');
    });

    render(
      <AppErrorBoundary>
        <Screen />
      </AppErrorBoundary>
    );

    expect(screen.getByText('fallback: device/invalid-device')).toBeTruthy();
  });

  it('renders the app again after a reset', () => {
    render(
      <AppErrorBoundary>
        <Screen />
      </AppErrorBoundary>
    );
    shouldThrow = false;

    fireEvent.click(screen.getByText('reset'));

    expect(screen.getByText('app content')).toBeTruthy();
  });
});

describe('FatalErrorOverlay', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetFatalErrorStoreForTests();
  });

  it('shows nothing until a fatal error is handed to it', () => {
    render(<FatalErrorOverlay />);

    expect(screen.queryByText('errors.somethingWentWrong')).toBeNull();
  });

  it('shows the error screen and restarts the app from it', () => {
    render(<FatalErrorOverlay />);

    act(() => showFatalError(new Error('uncaught')));

    expect(screen.getByText('errors.somethingWentWrong')).toBeTruthy();

    fireEvent.click(screen.getByText('errors.reload'));

    expect(reloadApp).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('errors.somethingWentWrong')).toBeNull();
  });
});

describe('error boundary guard', () => {
  function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);

      if (name === '__tests__' || name === 'node_modules') {
        return [];
      }

      if (statSync(path).isDirectory()) {
        return sourceFiles(path);
      }

      return /\.tsx?$/.test(name) ? [path] : [];
    });
  }

  // Sentry.ErrorBoundary assigns `error.cause`, which throws for vision-camera's getter-only
  // `cause`: the boundary then crashed itself and React Native closed the app (docs/FIXES.md).
  it('no screen uses Sentry.ErrorBoundary', () => {
    const root = join(__dirname, '..', '..');
    const offenders = ['app', 'components']
      .flatMap((dir) => sourceFiles(join(root, dir)))
      .filter((path) =>
        /<Sentry\.ErrorBoundary\b|withErrorBoundary\(/.test(readFileSync(path, 'utf8'))
      )
      .map((path) => path.slice(root.length + 1));

    expect(offenders).toEqual([]);
  });
});
