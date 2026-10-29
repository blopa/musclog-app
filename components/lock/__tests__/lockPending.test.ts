/**
 * @jest-environment jsdom
 */

/**
 * While the lock settings are still loading and nothing mirrored them, every area reads as
 * locked — but the lock screen asks the device to authenticate the moment it appears, and most
 * people have no lock at all. So "not known yet" must cover the content WITHOUT drawing the lock
 * screen, and the lock screen must still appear once the lock is known to be on.
 */

import { render } from '@testing-library/react';
import { createElement } from 'react';

import { AppLockOverlay } from '@/components/lock/AppLockOverlay';
import { AreaLockGate } from '@/components/lock/AreaLockGate';

type MockLock = { isLocked: () => boolean; obscured: boolean; pending: boolean };
let mockLock: MockLock;

jest.mock('lucide-react-native', () => ({
  Lock: () => require('react').createElement('span', { 'data-testid': 'lock-icon' }),
}));
jest.mock('@/components/lock/LockScreen', () => ({
  LockScreen: () => require('react').createElement('span', { 'data-testid': 'lock-screen' }),
}));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({ colors: { background: { primary: '#000' }, text: { tertiary: '#fff' } } }),
}));
jest.mock('@/context/AppLockContext', () => ({
  useAppLock: () => mockLock,
  useOptionalAppLock: () => mockLock,
}));

const content = () => createElement('span', { 'data-testid': 'records' });

describe('lock surfaces while the lock settings are pending', () => {
  it('covers the app without prompting', () => {
    mockLock = { isLocked: () => true, obscured: false, pending: true };

    const { queryByTestId } = render(createElement(AppLockOverlay));

    expect(queryByTestId('lock-icon')).not.toBeNull();
    expect(queryByTestId('lock-screen')).toBeNull();
  });

  it('renders neither the records nor the lock screen inside an area gate', () => {
    mockLock = { isLocked: () => true, obscured: false, pending: true };

    const { queryByTestId } = render(
      createElement(AreaLockGate, { area: 'cycle', children: content() })
    );

    expect(queryByTestId('records')).toBeNull();
    expect(queryByTestId('lock-screen')).toBeNull();
  });

  it('shows the lock screen once the whole-app lock is known to be on', () => {
    mockLock = { isLocked: () => true, obscured: false, pending: false };

    const { queryByTestId } = render(createElement(AppLockOverlay));

    expect(queryByTestId('lock-screen')).not.toBeNull();
  });

  it('gets out of the way once no lock is known to be on', () => {
    mockLock = { isLocked: () => false, obscured: false, pending: false };

    const overlay = render(createElement(AppLockOverlay));
    expect(overlay.container.innerHTML).toBe('');

    const gate = render(createElement(AreaLockGate, { area: 'cycle', children: content() }));
    expect(gate.queryByTestId('records')).not.toBeNull();
  });
});
