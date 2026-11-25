import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';

import { CameraErrorBoundary, CameraUnavailable } from '@/components/CameraErrorBoundary';

jest.mock('@/hooks/useTheme', () => ({ useTheme: () => require('@/theme').darkTheme }));
jest.mock('@/utils/handleError', () => ({ handleError: jest.fn(() => Promise.resolve()) }));
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

function FlakyCamera() {
  if (shouldThrow) {
    throw new GetterCauseError('device/invalid-device: no formats');
  }

  return <span>camera preview</span>;
}

/** Throws from a session callback the way CameraView rethrows `onError` during render. */
function SessionErrorCamera() {
  const [error, setError] = useState<Error | null>(null);

  if (error) {
    throw error;
  }

  return <button onClick={() => setError(new GetterCauseError('session failed'))}>fail</button>;
}

function renderBoundary(child: React.ReactNode, onError = jest.fn()) {
  render(
    <CameraErrorBoundary
      onError={onError}
      fallback={(retry) => <CameraUnavailable body="withGallery" onRetry={retry} />}
    >
      {child}
    </CameraErrorBoundary>
  );

  return onError;
}

describe('CameraErrorBoundary', () => {
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    shouldThrow = true;
    // React logs every caught render error; the test asserts on the outcome instead.
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => consoleError.mockRestore());

  it('shows the fallback instead of crashing on an error whose cause cannot be set', () => {
    const onError = renderBoundary(<FlakyCamera />);

    expect(screen.getByText('camera.unavailable.title')).toBeTruthy();
    expect(screen.getByText('camera.unavailable.bodyWithGallery')).toBeTruthy();
    expect(onError).toHaveBeenCalledTimes(1);
    expect((onError.mock.calls[0][0] as Error).message).toContain('device/invalid-device');
  });

  it('stays contained when reporting itself throws', () => {
    renderBoundary(
      <FlakyCamera />,
      jest.fn(() => {
        throw new Error('reporter broke');
      })
    );

    expect(screen.getByText('camera.unavailable.title')).toBeTruthy();
  });

  it('remounts the camera on Try again', () => {
    renderBoundary(<FlakyCamera />);
    shouldThrow = false;

    fireEvent.click(screen.getByText('camera.unavailable.retry'));

    expect(screen.getByText('camera preview')).toBeTruthy();
    expect(screen.queryByText('camera.unavailable.title')).toBeNull();
  });

  it('catches a session error rethrown during render', () => {
    const onError = renderBoundary(<SessionErrorCamera />);

    fireEvent.click(screen.getByText('fail'));

    expect(screen.getByText('camera.unavailable.title')).toBeTruthy();
    expect(onError).toHaveBeenCalledTimes(1);
  });
});

describe('CameraUnavailable', () => {
  it('offers no Try again when it cannot help', () => {
    render(<CameraUnavailable body="plain" />);

    expect(screen.getByText('camera.unavailable.body')).toBeTruthy();
    expect(screen.queryByText('camera.unavailable.retry')).toBeNull();
  });
});
