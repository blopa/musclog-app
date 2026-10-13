import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createElement } from 'react';

import { WhatsNewModal } from '@/components/whatsNew/WhatsNewModal';
import type { WhatsNewFlow } from '@/utils/whatsNew/flow';

jest.mock('@/database/services/SettingsService', () => ({ SettingsService: {} }));
jest.mock('@/hooks/useTheme', () => ({ useTheme: () => require('@/theme').darkTheme }));
jest.mock('@/hooks/useFormatAppNumber', () => ({
  useFormatAppNumber: () => ({ formatInteger: String }),
}));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/hooks/useWhatsNewChoiceValues', () => ({
  useWhatsNewChoiceValues: () => ({ values: {}, errors: {}, saving: {} }),
}));
jest.mock('@/components/theme/Button', () => ({
  Button: ({ label, onPress, disabled }: any) =>
    require('react').createElement('button', { onClick: onPress, disabled }, label),
}));
jest.mock('@/components/theme/TextButton', () => ({
  TextButton: ({ label, onPress, disabled }: any) =>
    require('react').createElement('button', { onClick: onPress, disabled }, label),
}));
jest.mock('@/components/theme/IconButton', () => ({
  IconButton: ({ accessibilityLabel, onPress, disabled }: any) =>
    require('react').createElement('button', {
      onClick: onPress,
      disabled,
      'aria-label': accessibilityLabel,
    }),
}));
jest.mock('@/components/modals/FullScreenModal', () => ({
  FullScreenModal: ({ visible, children, onClose, closable }: any) =>
    visible
      ? require('react').createElement(
          'section',
          null,
          require('react').createElement(
            'button',
            { onClick: onClose, disabled: !closable },
            'System back'
          ),
          children
        )
      : null,
}));
jest.mock('@/components/modals/WorkoutSettingsModal', () => ({
  WorkoutSettingsModal: ({ onClose }: any) =>
    require('react').createElement('button', { onClick: onClose }, 'Close settings'),
}));
jest.mock('@/components/modals/LogCardioModal', () => ({
  LogCardioModal: ({ onClose }: any) =>
    require('react').createElement('button', { onClick: onClose }, 'Close cardio'),
}));

const flow: WhatsNewFlow = {
  releaseVersions: ['2.13.1'],
  truncated: false,
  pages: [
    {
      key: 'settings',
      version: '2.13.1',
      blocks: [
        {
          id: 'settings',
          type: 'action',
          action: 'openWorkoutSettings',
          labelKey: 'whatsNew.openSettings',
        },
        { id: 'cardio', type: 'action', action: 'openCardioLog', labelKey: 'whatsNew.openCardio' },
      ],
    },
    {
      key: 'review',
      version: '2.13.1',
      blocks: [
        {
          id: 'review',
          type: 'action',
          action: 'openWeeklyReview',
          labelKey: 'whatsNew.openReview',
        },
      ],
    },
  ],
};
function setup(onDismiss = jest.fn(async () => undefined)) {
  const onNavigate = jest.fn();
  const props = { visible: true, flow, mode: 'upgrade' as const, onDismiss, onNavigate };
  return { ...render(createElement(WhatsNewModal, props)), props, onDismiss, onNavigate };
}
const click = (name: string) => fireEvent.click(screen.getByRole('button', { name, exact: true }));

test('child modals return to the same page without dismissing and clear when the parent closes', () => {
  const { onDismiss, rerender, props } = setup();
  click('whatsNew.next');
  click('whatsNew.openSettings');
  expect((screen.getByRole('button', { name: 'System back' }) as HTMLButtonElement).disabled).toBe(
    true
  );
  click('System back');
  expect(onDismiss).not.toHaveBeenCalled();
  click('Close settings');
  expect(screen.getByRole('button', { name: 'whatsNew.openSettings' })).toBeTruthy();
  click('whatsNew.openCardio');
  expect(screen.getByRole('button', { name: 'Close cardio' })).toBeTruthy();
  rerender(createElement(WhatsNewModal, { ...props, visible: false }));
  rerender(createElement(WhatsNewModal, props));
  expect(screen.queryByRole('button', { name: 'Close cardio' })).toBeNull();
  expect(screen.getByRole('heading', { name: 'whatsNew.intro.title' })).toBeTruthy();
});
test('route actions wait for dismissal persistence, then navigate exactly once', async () => {
  let resolve!: () => void;
  const onDismiss = jest.fn(
    () =>
      new Promise<void>((done) => {
        resolve = done;
      })
  );
  const { onNavigate } = setup(onDismiss);
  click('whatsNew.next');
  click('whatsNew.next');
  click('whatsNew.openReview');
  expect(onNavigate).not.toHaveBeenCalled();
  click('whatsNew.openReview');
  expect(onDismiss).toHaveBeenCalledTimes(1);
  await act(async () => resolve());
  expect(onNavigate).toHaveBeenCalledWith('/app/weekly-review');
});
test('failed route dismissal stays open, reports an error, and permits retry', async () => {
  const onDismiss = jest.fn(async () => undefined).mockRejectedValueOnce(new Error('disk'));
  const { onNavigate } = setup(onDismiss);
  click('whatsNew.next');
  click('whatsNew.next');
  click('whatsNew.openReview');
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'whatsNew.dismissFailed');
  expect(onNavigate).not.toHaveBeenCalled();
  click('whatsNew.openReview');
  await waitFor(() => expect(onNavigate).toHaveBeenCalledTimes(1));
});
test.each(['skip', 'back', 'done'])('%s dismisses the tour', async (method) => {
  const { onDismiss, onNavigate } = setup();
  if (method === 'skip') {
    fireEvent.click(screen.getAllByRole('button', { name: 'whatsNew.skip' }).at(-1)!);
  } else if (method === 'back') {
    click('System back');
  } else {
    click('whatsNew.next');
    click('whatsNew.next');
    click('whatsNew.done');
  }
  await waitFor(() => expect(onDismiss).toHaveBeenCalledTimes(1));
  expect(onNavigate).not.toHaveBeenCalled();
});

test('the intro offers Skip and Next side by side, and Skip dismisses without paging', async () => {
  const { onDismiss } = setup();
  expect(screen.getByRole('button', { name: 'whatsNew.next' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'whatsNew.back' })).toBeNull();
  // The header's close button and the footer's Skip both read "skip"; the footer's is the last.
  const skips = screen.getAllByRole('button', { name: 'whatsNew.skip' });
  expect(skips).toHaveLength(2);
  fireEvent.click(skips[skips.length - 1]);
  await waitFor(() => expect(onDismiss).toHaveBeenCalledTimes(1));
});

test('Skip becomes Back after the intro, and the intro lists what the tour covers', () => {
  setup();
  // One numbered line per page that has a heading of its own (an action's label stands in).
  expect(screen.getByText('whatsNew.intro.inside')).toBeTruthy();
  expect(screen.getByText('whatsNew.openSettings')).toBeTruthy();
  expect(screen.getByText('whatsNew.openReview')).toBeTruthy();
  click('whatsNew.next');
  // Only the header's close button is left: the footer's Skip has become Back.
  expect(screen.getAllByRole('button', { name: 'whatsNew.skip' })).toHaveLength(1);
  click('whatsNew.back');
  expect(screen.getByRole('heading', { name: 'whatsNew.intro.title' })).toBeTruthy();
});
