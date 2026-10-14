import { encryptCycleBackup, recordCycleBackupPrepared } from '@/services/cycleRecovery';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as DocumentPicker from 'expo-document-picker';
import { createElement } from 'react';

import { CycleDiaryPresets } from '@/components/cycle/CycleDiaryPresets';
import { CycleImportMapping } from '@/components/cycle/CycleImportMapping';
import { CycleSharingSettings } from '@/components/cycle/CycleSharingSettings';
import { CyclePortabilityModal } from '@/components/modals/CyclePortabilityModal';
import { CycleTransferService } from '@/database/services/CycleTransferService';
import { useMenstrualCycle } from '@/hooks/useMenstrualCycle';
import { shareTextFile } from '@/utils/file';

jest.mock('@/utils/handleError', () => ({ handleError: jest.fn() }));
jest.mock('@/lang/lang', () => ({ DEFAULT_LANG: 'en-US' }));
jest.mock('@/services/cycleExport', () => ({ exportContextsCsv: jest.fn() }));
const mockUpdate = jest.fn(async (_update: unknown) => {});
jest.mock('@/hooks/useMenstrualCycle', () => ({ useMenstrualCycle: jest.fn() }));
jest.mock('@/hooks/useTheme', () => ({ useTheme: () => require('@/theme').darkTheme }));
jest.mock('@/hooks/useFormatAppNumber', () => ({
  useFormatAppNumber: () => ({ formatInteger: String }),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en-US' } }),
}));
jest.mock('@/components/theme/Button', () => ({
  Button: ({ label, onPress, disabled }: any) =>
    require('react').createElement('button', { onClick: onPress, disabled }, label),
}));
jest.mock('@/components/theme/TextButton', () => ({
  TextButton: ({ label, onPress }: any) =>
    require('react').createElement('button', { onClick: onPress }, label),
}));
jest.mock('@/components/theme/TextInput', () => ({
  TextInput: ({ label, value, onChangeText }: any) =>
    require('react').createElement('input', {
      'aria-label': label,
      value,
      onChange: (event: any) => onChangeText(event.target.value),
    }),
}));
jest.mock('@/components/modals/FullScreenModal', () => ({
  FullScreenModal: ({ children, visible }: any) => (visible ? children : null),
}));
jest.mock('@/components/lock/CycleLockGate', () => ({
  CycleLockGate: ({ children }: any) => children,
}));
jest.mock('@/services/CycleNotificationService', () => ({
  CycleNotificationService: { scheduleMenstrualCycleNotifications: jest.fn(async () => {}) },
}));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('@/database/services/CycleTransferService', () => ({
  CycleTransferService: {
    preview: jest.fn(async () => ({ added: 1, updated: 0, skipped: 0, overlaps: 0 })),
    import: jest.fn(async () => ({ added: 1 })),
  },
}));
jest.mock('@/services/cycleRecovery', () => ({
  getCycleBackupPreparedAt: jest.fn(async () => null),
  decodeCycleFile: jest.fn(async (text) => text),
  recordCycleBackupPrepared: jest.fn(),
  encryptCycleBackup: jest.fn(),
}));
jest.mock('@/utils/file', () => ({
  shareTextFile: jest.fn(async () => {}),
  readFileAsStringAsync: jest.fn(
    async () =>
      '{"format":"musclog-cycle","version":1,"periods":[{"startDate":"2024-01-01","endDate":null,"endKind":"unknown","excludedFromStats":false,"note":""}],"dayLogs":[],"contexts":[],"moods":[]}'
  ),
}));
const config = {
  fallbackCycleLength: 28,
  fallbackPeriodDuration: 5,
  quickLog: ['headache'],
  enabledFields: ['sex'],
};
beforeEach(() => {
  jest.clearAllMocks();
  (useMenstrualCycle as jest.Mock).mockReturnValue({
    cycle: { id: 'c' },
    config,
    periods: [],
    dayLogs: [],
    contexts: [],
    updateConfig: mockUpdate,
    moods: [],
    moodsLoading: false,
    moodsError: false,
    today: new Date(2024, 3, 1).getTime(),
  });
});
it('adds a diary preset without replacing existing fields or favorites', async () => {
  render(createElement(CycleDiaryPresets));
  fireEvent.click(screen.getByRole('button', { name: 'cycle.complete.preset.pms' }));
  await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith(expect.any(Function)));
  const update = mockUpdate.mock.calls[0][0] as (current: unknown) => unknown;
  expect(
    update({ ...config, enabledFields: ['sex', 'tags'], quickLog: ['headache', 'cramps'] })
  ).toEqual(
    expect.objectContaining({
      enabledFields: expect.arrayContaining(['sex', 'tags', 'impact', 'sleepHours', 'medication']),
      quickLog: expect.arrayContaining(['headache', 'cramps']),
    })
  );
});
it('shares nothing by default and exports only the fields the user selects', async () => {
  render(createElement(CycleSharingSettings));
  const button = screen.getByRole('button', {
    name: 'cycle.complete.shareSelected',
  }) as HTMLButtonElement;
  expect(button.disabled).toBe(true);
  expect(shareTextFile).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('checkbox', { name: 'cycle.complete.metrics.pain' }));
  expect(button.disabled).toBe(false);
  fireEvent.click(button);
  await waitFor(() =>
    expect(shareTextFile).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('"pain"'),
      'application/json'
    )
  );
  expect(JSON.parse((shareTextFile as jest.Mock).mock.calls[0][1]).fields).toEqual(['pain']);
});
it('allows local restore preview before a cycle has been set up', async () => {
  (useMenstrualCycle as jest.Mock).mockReturnValue({
    cycle: null,
    pausedCycle: null,
    config,
    periods: [],
    dayLogs: [],
    contexts: [],
  });
  (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file://backup', size: 500 }],
  });
  render(createElement(CyclePortabilityModal, { visible: true, onClose: jest.fn() }));
  fireEvent.click(screen.getByRole('button', { name: 'cycle.portability.chooseFile' }));
  const confirm = await screen.findByRole('button', { name: 'cycle.portability.confirmImport' });
  await waitFor(() => expect((confirm as HTMLButtonElement).disabled).toBe(false));
  expect(CycleTransferService.preview).toHaveBeenCalledWith(null, expect.any(String), 'keep', true);
  fireEvent.click(confirm);
  await waitFor(() =>
    expect(CycleTransferService.import).toHaveBeenCalledWith(null, expect.any(String), 'keep', true)
  );
});
it('keeps an invalid CSV in the mapping step so the user can correct it before import', () => {
  const onPrepared = jest.fn();
  render(
    createElement(CycleImportMapping, {
      text: 'date,flow\n2024-01-01,unknown\n',
      onPrepared,
      onCancel: jest.fn(),
    })
  );
  fireEvent.click(screen.getByRole('button', { name: 'cycle.complete.previewImport' }));
  expect(onPrepared).not.toHaveBeenCalled();
  expect(screen.getByText('cycle.complete.importError')).toBeTruthy();
  fireEvent.change(screen.getByRole('textbox', { name: 'cycle.complete.importColumns.flow' }), {
    target: { value: '' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'cycle.complete.previewImport' }));
  expect(onPrepared).toHaveBeenCalledWith(expect.stringContaining('musclog-cycle'));
});

it('prepares a password-protected backup only after an explicit user action and matching passwords', async () => {
  (encryptCycleBackup as jest.Mock).mockResolvedValue('encrypted-backup');
  render(createElement(CyclePortabilityModal, { visible: true, onClose: jest.fn() }));
  expect(shareTextFile).not.toHaveBeenCalled();
  expect(encryptCycleBackup).not.toHaveBeenCalled();
  const create = screen.getByRole('button', {
    name: 'cycle.portability.createBackup',
  }) as HTMLButtonElement;
  expect(create.disabled).toBe(true);
  fireEvent.change(screen.getByRole('textbox', { name: 'cycle.portability.password' }), {
    target: { value: 'manual-backup-password' },
  });
  fireEvent.change(screen.getByRole('textbox', { name: 'cycle.portability.repeatPassword' }), {
    target: { value: 'different-password' },
  });
  expect(create.disabled).toBe(true);
  fireEvent.change(screen.getByRole('textbox', { name: 'cycle.portability.repeatPassword' }), {
    target: { value: 'manual-backup-password' },
  });
  expect(create.disabled).toBe(false);
  fireEvent.click(create);
  await waitFor(() =>
    expect(shareTextFile).toHaveBeenCalledWith(
      expect.stringContaining('-encrypted.json'),
      'encrypted-backup',
      'application/json'
    )
  );
  expect(encryptCycleBackup).toHaveBeenCalledWith(
    expect.stringContaining('musclog-cycle'),
    'manual-backup-password'
  );
  expect(recordCycleBackupPrepared).toHaveBeenCalledTimes(1);
});
