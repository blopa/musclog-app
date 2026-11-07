/**
 * @jest-environment jsdom
 */

import { renderHook } from '@testing-library/react';
import { Children } from 'react';

import { EmptyStateCard } from '@/components/theme/EmptyStateCard';
import { LoggyPose } from '@/components/LoggyPose';

const mockSettings = { showLoggy: true, animatedLoggy: false };

jest.mock('@/hooks/useSettings', () => ({ useSettings: () => mockSettings }));
jest.mock('@/hooks/useTheme', () => ({
  useThemeIdOrNull: () => null,
  useTheme: () => ({
    iconSize: { '5xl': 64 },
    colors: { text: { tertiary: '#999' } },
    maxWidth: { '480': 480 },
  }),
}));
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { createAnimatedComponent: (component: unknown) => component },
  useReducedMotion: () => false,
}));
jest.mock('@/components/loggy/useLoggyClock', () => ({ useLoggyClock: () => 0 }));
jest.mock('@/components/cards/GenericCard', () => ({ GenericCard: 'GenericCard' }));
jest.mock('@/components/theme/Button', () => ({ Button: 'Button' }));

const Icon = () => null;

function renderPose(props: Parameters<typeof LoggyPose>[0]) {
  return renderHook(() => LoggyPose(props)).result.current;
}

/** The first thing the empty state draws above its title: Loggy or its icon. */
function emptyStateArt() {
  const { result } = renderHook(() =>
    EmptyStateCard({
      bare: true,
      pose: 'magnify',
      icon: Icon,
      title: 'Nothing yet',
      description: 'Add one',
      buttonLabel: 'Add',
    })
  );
  const [art] = Children.toArray(result.current.props.children) as any[];

  return art;
}

describe('Show Loggy setting', () => {
  afterEach(() => {
    mockSettings.showLoggy = true;
  });

  it('draws him while the setting is on', () => {
    expect(renderPose({ pose: 'wave', height: 100 })).not.toBeNull();
  });

  it('draws nothing once the setting is off', () => {
    mockSettings.showLoggy = false;

    expect(renderPose({ pose: 'wave', height: 100 })).toBeNull();
    expect(renderPose({ pose: 'flex', height: 100, animated: false })).toBeNull();
  });

  it('lets the test screen force him either way', () => {
    mockSettings.showLoggy = false;
    expect(renderPose({ pose: 'wave', height: 100, visible: true })).not.toBeNull();

    mockSettings.showLoggy = true;
    expect(renderPose({ pose: 'wave', height: 100, visible: false })).toBeNull();
  });

  it('gives a whole-screen empty state its icon back when he is hidden', () => {
    expect(emptyStateArt().type).toBe(LoggyPose);

    mockSettings.showLoggy = false;
    expect(emptyStateArt().type).toBe(Icon);
  });
});
