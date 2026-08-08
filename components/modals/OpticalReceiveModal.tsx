/**
 * Optical transfer — the receiving screen, and the guards in front of the restore.
 *
 * `restoreDatabase` WIPES this phone's database. Data arriving off a camera deserves more ceremony
 * than a file the user deliberately picked, so nothing is offered until it has passed both
 * integrity gates (the frame header's FNV over the reassembled container, then the container's
 * SHA-256 over the decrypted, decompressed JSON), and the wipe itself is behind a version check, a
 * destructive confirmation and device biometrics.
 *
 * Progress is FRAMES COLLECTED, not blocks solved — see `docs/OPTICAL_TRANSFER.md`.
 */

import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { OpticalScannerCamera } from '@/components/optical/OpticalScannerCamera';
import { Button } from '@/components/theme/Button';
import { ProgressIndicator } from '@/components/theme/ProgressIndicator';
import { SecretInput } from '@/components/theme/SecretInput';
import { CURRENT_DATABASE_VERSION } from '@/constants/database';
import { useSnackbar } from '@/context/SnackbarContext';
import { restoreDatabase } from '@/database/importDb';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useOpticalReceiver } from '@/hooks/useOpticalReceiver';
import { useSubModalVisibility } from '@/hooks/useSubModalVisibility';
import { useTheme } from '@/hooks/useTheme';
import { reloadApp } from '@/utils/app';
import { authenticateForDangerousAction } from '@/utils/dangerousActionAuth';
import { handleError } from '@/utils/handleError';

import { ConfirmationModal } from './ConfirmationModal';
import { FullScreenModal } from './FullScreenModal';

interface OpticalReceiveModalProps {
  visible: boolean;
  onClose: () => void;
}

export function OpticalReceiveModal({ visible, onClose }: OpticalReceiveModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { showSnackbar } = useSnackbar();
  const { formatInteger, formatRoundedDecimal } = useFormatAppNumber();

  // KB throughout: a transfer this size never reaches MB, and switching units partway through
  // would make the two halves of "12.3 KB / 130.4 KB" incomparable at a glance.
  const formatKb = useCallback(
    (bytes: number) => `${formatRoundedDecimal(bytes / 1024, 1)} KB`,
    [formatRoundedDecimal]
  );

  const receiver = useOpticalReceiver({ active: visible });
  const [confirmVisible, setConfirmVisible] = useSubModalVisibility(visible);
  const [passphrase, setPassphrase] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [restored, setRestored] = useState(false);

  const { analysisFrame, fraction, meta, phase, showNoSignalHint } = receiver;

  // A backup written by a newer app cannot be understood by this one. Zod would eventually reject
  // it, but only after the wipe and a wall of validation errors — so refuse up front.
  const tooNew = Boolean(meta && meta.exportVersion > CURRENT_DATABASE_VERSION);

  const handleClose = useCallback(() => {
    receiver.reset();
    setPassphrase('');
    setRestored(false);
    onClose();
  }, [onClose, receiver]);

  const handleRestore = useCallback(async () => {
    const json = receiver.takeJson();
    if (!json) {
      return;
    }

    // Set before the biometric prompt, not after: the confirmation modal is still on screen while
    // the system sheet is up and again while the write runs, and on a large database that write
    // can take a minute. Without this the user comes back from the fingerprint to a dialog that
    // looks identical to the one they just tapped, with no indication anything is happening.
    setRestoring(true);

    const authenticated = await authenticateForDangerousAction(
      t('opticalTransfer.receive.authPrompt'),
      'OpticalReceiveModal.handleRestore'
    );
    if (!authenticated) {
      setRestoring(false);
      return;
    }

    try {
      // One argument: our passphrase lives at the container layer and has already been removed.
      // Passing it here would make restoreDatabase try to AES-decrypt already-plain JSON.
      await restoreDatabase(json);
      setRestored(true);
      showSnackbar('success', t('opticalTransfer.receive.restored'));
    } catch (error) {
      handleError(error, 'OpticalReceiveModal.handleRestore', {
        snackbarMessage: t('opticalTransfer.receive.restoreFailed'),
      });
    } finally {
      setRestoring(false);
    }
  }, [receiver, showSnackbar, t]);

  return (
    <FullScreenModal
      onClose={handleClose}
      scrollable={false}
      subtitle={t('opticalTransfer.receive.subtitle')}
      title={t('opticalTransfer.receive.title')}
      visible={visible}
    >
      <View className="flex-1">
        {phase === 'collecting' ? (
          <View className="flex-1">
            <View className="flex-1 overflow-hidden">
              <OpticalScannerCamera
                active={visible}
                onCodeScanned={receiver.onCodeScanned}
                onStarted={receiver.cameraStarted}
              />
              {showNoSignalHint ? (
                <View
                  className="absolute inset-x-4 bottom-4 gap-2 rounded-xl p-4"
                  style={{ backgroundColor: theme.colors.background.card }}
                >
                  <Text className="font-bold text-text-primary">
                    {t('opticalTransfer.receive.noSignalTitle')}
                  </Text>
                  <Text className="text-xs text-text-secondary">
                    {/* Every tip is something to change on the OTHER phone or in the setup: the
                        receiver is where the problem is visible, the sender is where it is fixable. */}
                    {t('opticalTransfer.receive.noSignalTips')}
                  </Text>
                  {analysisFrame && Math.min(analysisFrame.width, analysisFrame.height) < 600 ? (
                    <Text className="text-xs" style={{ color: theme.colors.status.warning }}>
                      {t('opticalTransfer.receive.noSignalLowResolution')}
                    </Text>
                  ) : null}
                  <Button
                    label={t('opticalTransfer.receive.noSignalDismiss')}
                    onPress={receiver.dismissNoSignalHint}
                    size="xs"
                    variant="outline"
                  />
                </View>
              ) : null}
            </View>

            <View className="gap-2 p-4" style={{ backgroundColor: theme.colors.background.card }}>
              <Text className="text-2xl font-bold text-text-primary">
                {/*
                  Two decimals because a slow transfer moves less than a whole percent a second,
                  and a number that sits still reads as a stall. The KB pair is derived from the
                  same fraction rather than from solved blocks: peeling back-loads, so a literal
                  "bytes reconstructed" counter would read 0 KB for most of the transfer and then
                  jump to the total.
                */}
                {receiver.payloadBytes > 0
                  ? t('opticalTransfer.receive.percentWithSize', {
                      percent: formatRoundedDecimal(fraction * 100, 2),
                      received: formatKb(fraction * receiver.payloadBytes),
                      total: formatKb(receiver.payloadBytes),
                    })
                  : t('opticalTransfer.receive.percent', {
                      percent: formatRoundedDecimal(fraction * 100, 2),
                    })}
              </Text>
              <View
                className="h-2 overflow-hidden rounded-full"
                style={{ backgroundColor: theme.colors.background.cardElevated }}
              >
                <View
                  style={{
                    backgroundColor: theme.colors.accent.primary,
                    height: '100%',
                    // Unrounded, so the bar creeps visibly on a slow transfer instead of sitting
                    // still for several seconds and then stepping a whole percent.
                    width: `${Math.min(100, fraction * 100)}%`,
                  }}
                />
              </View>
              <Text className="text-xs text-text-tertiary">
                {receiver.etaSeconds
                  ? t('opticalTransfer.receive.eta', {
                      seconds: formatInteger(Math.ceil(receiver.etaSeconds)),
                    })
                  : t('opticalTransfer.receive.aimHint')}
              </Text>
            </View>
          </View>
        ) : null}

        {phase === 'unpacking' ? (
          <View className="flex-1 justify-center px-4">
            <ProgressIndicator message={t('opticalTransfer.receive.verifying')} />
          </View>
        ) : null}

        {phase === 'passphrase' ? (
          <View className="gap-4 px-4 py-8">
            <Text className="text-text-secondary">
              {t('opticalTransfer.receive.passphrasePrompt')}
            </Text>
            {receiver.errorCode === 'bad-passphrase' ? (
              <Text className="text-sm" style={{ color: theme.colors.status.error }}>
                {t('opticalTransfer.receive.passphraseWrong')}
              </Text>
            ) : null}
            <SecretInput
              label={t('opticalTransfer.passphrase')}
              onChangeText={setPassphrase}
              value={passphrase}
            />
            <Button
              disabled={!passphrase}
              label={t('opticalTransfer.receive.passphraseSubmit')}
              onPress={() => receiver.submitPassphrase(passphrase)}
              size="sm"
              variant="accent"
              width="full"
            />
          </View>
        ) : null}

        {phase === 'verified' && meta ? (
          <View className="gap-4 px-4 py-6">
            <View
              className="gap-2 rounded-xl p-4"
              style={{ backgroundColor: theme.colors.background.card }}
            >
              <Text className="font-bold" style={{ color: theme.colors.status.success }}>
                {t('opticalTransfer.receive.verifiedTitle')}
              </Text>
              <Text className="text-sm text-text-secondary">
                {t('opticalTransfer.receive.verifiedDetails', {
                  date: new Date(meta.createdAtSec * 1000).toLocaleString(),
                  size: `${formatInteger(Math.round(meta.plainLen / 1024))} KB`,
                })}
              </Text>
            </View>

            {restored ? (
              <>
                <Text className="text-center text-text-secondary">
                  {t('opticalTransfer.receive.restartPrompt')}
                </Text>
                {/* A guaranteed manual path: this feature depends on a reload to re-read the
                    restored database, and reloadApp() has historically been unreliable in release
                    builds. Never leave the user with no way forward. */}
                <Button
                  label={t('opticalTransfer.receive.restartNow')}
                  onPress={() => void reloadApp()}
                  size="sm"
                  variant="accent"
                  width="full"
                />
              </>
            ) : null}

            {!restored && restoring ? (
              // A large database takes tens of seconds to write. Say so, and say not to leave.
              <View className="gap-2 py-4">
                <ProgressIndicator message={t('opticalTransfer.receive.restoring')} />
                <Text className="text-center text-xs text-text-tertiary">
                  {t('opticalTransfer.receive.restoringHint')}
                </Text>
              </View>
            ) : null}

            {!restored && !restoring ? (
              <>
                {tooNew ? (
                  <Text style={{ color: theme.colors.status.error }}>
                    {t('opticalTransfer.receive.tooNew')}
                  </Text>
                ) : (
                  <Text className="text-sm text-text-secondary">
                    {t('opticalTransfer.receive.replaceExplainer')}
                  </Text>
                )}
                <Button
                  disabled={tooNew}
                  label={t('opticalTransfer.receive.replace')}
                  onPress={() => setConfirmVisible(true)}
                  size="sm"
                  variant="discard"
                  width="full"
                />
              </>
            ) : null}
          </View>
        ) : null}

        {phase === 'error' ? (
          <View className="gap-4 px-4 py-10">
            <Text className="text-center" style={{ color: theme.colors.status.error }}>
              {t(
                receiver.errorCode === 'checksum-failed'
                  ? 'opticalTransfer.receive.checksumFailed'
                  : 'opticalTransfer.receive.failed'
              )}
            </Text>
            {/* Nothing was wiped: the guards run before the restore, not after. */}
            <Text className="text-center text-xs text-text-tertiary">
              {t('opticalTransfer.receive.nothingChanged')}
            </Text>
            <Button
              label={t('opticalTransfer.receive.scanAgain')}
              onPress={receiver.reset}
              size="sm"
              variant="outline"
              width="full"
            />
          </View>
        ) : null}

        <ConfirmationModal
          confirmLabel={
            restoring
              ? t('opticalTransfer.receive.replacing')
              : t('opticalTransfer.receive.replace')
          }
          // Disables both buttons, spins the confirm button, and blocks backdrop/back dismissal
          // for the whole biometric-plus-write sequence.
          isLoading={restoring}
          message={t('opticalTransfer.receive.confirmMessage')}
          onClose={() => setConfirmVisible(false)}
          onConfirm={handleRestore}
          title={t('opticalTransfer.receive.confirmTitle')}
          variant="destructive"
          visible={confirmVisible}
          warning={t('opticalTransfer.receive.confirmWarning')}
        />
      </View>
    </FullScreenModal>
  );
}
