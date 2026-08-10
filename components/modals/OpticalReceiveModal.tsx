/**
 * Optical transfer — the receiving screen, and the guards in front of the restore.
 *
 * `restoreDatabase` WIPES this phone's database. Data arriving off a camera deserves more ceremony
 * than a file the user deliberately picked, so nothing is offered until it has passed both
 * integrity gates (the frame header's FNV over the reassembled container, then the container's
 * SHA-256 over the decrypted, decompressed JSON), and the wipe itself is behind a version check, a
 * destructive confirmation and device biometrics.
 *
 * Which of the eight screens is showing is decided once, by `resolveOpticalReceiveScreen` — see
 * `./opticalReceiveScreen.ts` for why that is not inlined here.
 *
 * Progress is FRAMES COLLECTED, not blocks solved — see `docs/OPTICAL_TRANSFER.md`.
 */

import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { OpticalCameraHintCard } from '@/components/optical/OpticalCameraHintCard';
import { OpticalFoodSharePreview } from '@/components/optical/OpticalFoodSharePreview';
import { OpticalMealSharePreview } from '@/components/optical/OpticalMealSharePreview';
import { OpticalScannerCamera } from '@/components/optical/OpticalScannerCamera';
import { SmartCameraTopActions } from '@/components/SmartCameraActions';
import { Button } from '@/components/theme/Button';
import { ProgressIndicator } from '@/components/theme/ProgressIndicator';
import { SecretInput } from '@/components/theme/SecretInput';
import { useSnackbar } from '@/context/SnackbarContext';
import { restoreDatabase } from '@/database/importDb';
import { importShareEnvelope, type ShareImportResult } from '@/database/share/importShareEnvelope';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useOpticalReceiver } from '@/hooks/useOpticalReceiver';
import { useSubModalVisibility } from '@/hooks/useSubModalVisibility';
import { useTheme } from '@/hooks/useTheme';
import { reloadApp } from '@/utils/app';
import { formatLocalInstantIntl } from '@/utils/calendarDate';
import { authenticateForDangerousAction } from '@/utils/dangerousActionAuth';
import { handleError } from '@/utils/handleError';
import { OPTICAL_PAYLOAD_KIND_SHARE } from '@/utils/optical/container';
import { MusclogShareError, parseShareEnvelope } from '@/utils/share/shareEnvelope';

import { ConfirmationModal } from './ConfirmationModal';
import { FullScreenModal } from './FullScreenModal';
import { type ParsedShare, resolveOpticalReceiveScreen } from './opticalReceiveScreen';

interface OpticalReceiveModalProps {
  visible: boolean;
  onClose: () => void;
  accept?: 'any' | 'share';
  onShareImported?: () => void;
}

export function OpticalReceiveModal({
  visible,
  onClose,
  accept = 'any',
  onShareImported,
}: OpticalReceiveModalProps) {
  const theme = useTheme();
  const { i18n, t } = useTranslation();
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
  const [savingShare, setSavingShare] = useState(false);
  const [shareResult, setShareResult] = useState<ShareImportResult>();
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);

  const { analysisFrame, errorCode, fraction, meta, phase, showNoSignalHint } = receiver;

  // Depends on `takeJson` (a stable `useCallback(…, [])`) rather than on `receiver`, which
  // `useOpticalReceiver` rebuilds as a fresh object on every render — that would re-run a full
  // JSON.parse plus envelope validation on each of them.
  const { takeJson } = receiver;
  const isShare = phase === 'verified' && meta?.payloadKind === OPTICAL_PAYLOAD_KIND_SHARE;
  const parsedShare = useMemo<ParsedShare | undefined>(() => {
    if (!isShare) {
      return undefined;
    }

    const json = takeJson();
    if (!json) {
      return { code: 'malformed' };
    }

    try {
      return { envelope: parseShareEnvelope(json) };
    } catch (error) {
      return { code: error instanceof MusclogShareError ? error.code : 'malformed' };
    }
  }, [isShare, takeJson]);

  const screen = resolveOpticalReceiveScreen({ accept, errorCode, meta, parsedShare, phase });

  // Only the scanning phase goes full-bleed camera; every later phase is an ordinary sheet of text
  // and buttons that still wants the modal's header (and its back arrow, which is the only way out
  // of them — the in-camera close button is gone by then).
  const isScanning = screen.kind === 'scanning';

  // Identity-stable: the scanner reports availability from an effect, so a fresh function each
  // render would re-run it on every parent render.
  const handleTorchAvailabilityChange = useCallback((available: boolean) => {
    setTorchAvailable(available);
    if (!available) {
      setTorchEnabled(false);
    }
  }, []);

  const handleClose = useCallback(() => {
    receiver.reset();
    setPassphrase('');
    setRestored(false);
    setSavingShare(false);
    setShareResult(undefined);
    // Never leave the torch burning behind a closed modal.
    setTorchEnabled(false);
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

  const handleScanAgain = useCallback(() => {
    setPassphrase('');
    setSavingShare(false);
    setShareResult(undefined);
    receiver.reset();
  }, [receiver]);

  const handleSaveShare = useCallback(
    async (envelope: Parameters<typeof importShareEnvelope>[0]) => {
      setSavingShare(true);
      try {
        const result = await importShareEnvelope(envelope);
        setShareResult(result);
        const alreadyHadFood =
          envelope.kind === 'food' && result.reused.some((item) => item.table === 'foods');
        showSnackbar(
          'success',
          t(
            envelope.kind === 'food'
              ? alreadyHadFood
                ? 'opticalTransfer.share.savedFoodExisted'
                : 'opticalTransfer.share.savedFoodTitle'
              : 'opticalTransfer.share.savedTitle'
          )
        );
        onShareImported?.();
      } catch (error) {
        handleError(error, 'OpticalReceiveModal.handleSaveShare', {
          snackbarMessage: t('opticalTransfer.share.saveFailed'),
        });
      } finally {
        setSavingShare(false);
      }
    },
    [onShareImported, showSnackbar, t]
  );

  const scanAgainButton = (
    <Button
      label={t('opticalTransfer.receive.scanAgain')}
      onPress={handleScanAgain}
      size="sm"
      variant="outline"
      width="full"
    />
  );

  const renderScreen = () => {
    switch (screen.kind) {
      case 'scanning':
        return (
          <View className="flex-1">
            <View className="flex-1 overflow-hidden">
              <OpticalScannerCamera
                active={visible}
                onCodeScanned={receiver.onCodeScanned}
                onStarted={receiver.cameraStarted}
                onTorchAvailabilityChange={handleTorchAvailabilityChange}
                torchEnabled={torchEnabled}
              />

              {/* The camera's own chrome, in place of the modal header: close on the left, torch on
                  the right (dropped entirely on web and on torchless devices). Absolute so it floats
                  over the feed on both platforms — the native scanner fills its parent, the web one
                  lays out in flow. */}
              <View className="absolute inset-x-0 top-0">
                <SmartCameraTopActions
                  flashEnabled={torchEnabled}
                  onClose={handleClose}
                  onFlashToggle={
                    torchAvailable ? () => setTorchEnabled((enabled) => !enabled) : undefined
                  }
                />
              </View>

              {showNoSignalHint ? (
                <OpticalCameraHintCard
                  className="absolute inset-x-4 bottom-4"
                  // Every tip is something to change on the OTHER phone or in the setup: the
                  // receiver is where the problem is visible, the sender is where it is fixable.
                  message={t('opticalTransfer.receive.noSignalTips')}
                  title={t('opticalTransfer.receive.noSignalTitle')}
                  warning={
                    analysisFrame && Math.min(analysisFrame.width, analysisFrame.height) < 600
                      ? t('opticalTransfer.receive.noSignalLowResolution')
                      : undefined
                  }
                >
                  <Button
                    label={t('opticalTransfer.receive.noSignalDismiss')}
                    onPress={receiver.dismissNoSignalHint}
                    size="xs"
                    variant="outline"
                  />
                </OpticalCameraHintCard>
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
              {receiver.averageBytesPerSecond > 0 ? (
                <Text className="text-xs text-text-tertiary">
                  {t('opticalTransfer.receive.speed', {
                    speed: formatRoundedDecimal(receiver.averageBytesPerSecond / 1024, 1),
                  })}
                </Text>
              ) : null}
              <Text className="text-xs text-text-tertiary">
                {receiver.etaSeconds
                  ? t('opticalTransfer.receive.eta', {
                      seconds: formatInteger(Math.ceil(receiver.etaSeconds)),
                    })
                  : t('opticalTransfer.receive.aimHint')}
              </Text>
            </View>
          </View>
        );

      case 'refused':
        return (
          <View className="gap-4 px-4 py-10">
            <Text className="text-center" style={{ color: theme.colors.status.error }}>
              {screen.reason === 'database'
                ? t('opticalTransfer.share.notShareable')
                : t('opticalTransfer.receive.tooNew')}
            </Text>
            {scanAgainButton}
          </View>
        );

      case 'unpacking':
        return (
          <View className="flex-1 justify-center px-4">
            <ProgressIndicator message={t('opticalTransfer.receive.verifying')} />
          </View>
        );

      case 'passphrase':
        return (
          <View className="gap-4 px-4 py-8">
            <Text className="text-text-secondary">
              {t('opticalTransfer.receive.passphrasePrompt')}
            </Text>
            {screen.wrongPassphrase ? (
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
        );

      case 'database':
        return (
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
                  date: formatLocalInstantIntl(
                    screen.meta.createdAtSec * 1000,
                    i18n.resolvedLanguage ?? i18n.language
                  ),
                  size: formatKb(screen.meta.plainLen),
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
                {screen.tooNew ? (
                  <Text style={{ color: theme.colors.status.error }}>
                    {t('opticalTransfer.receive.tooNew')}
                  </Text>
                ) : (
                  <Text className="text-sm text-text-secondary">
                    {t('opticalTransfer.receive.replaceExplainer')}
                  </Text>
                )}
                <Button
                  disabled={screen.tooNew}
                  label={t('opticalTransfer.receive.replace')}
                  onPress={() => setConfirmVisible(true)}
                  size="sm"
                  variant="discard"
                  width="full"
                />
              </>
            ) : null}
          </View>
        );

      case 'share': {
        const { envelope } = screen;
        const isFood = envelope.kind === 'food';
        // A food share collapses to nothing when the receiver already had that food: the whole
        // envelope is one food, so "saved" would be a lie. A meal is always created, and the reused
        // count is about its ingredients.
        const reusedRootFood =
          isFood && shareResult?.reused.some((item) => item.table === 'foods') === true;
        const reusedFoods =
          shareResult?.reused.filter((item) => item.table === 'foods').length ?? 0;
        return (
          <View className="gap-4 px-4 py-6">
            {shareResult ? (
              <View className="gap-4">
                <Text
                  className="text-center text-lg font-bold"
                  style={{ color: theme.colors.status.success }}
                >
                  {t(
                    isFood
                      ? reusedRootFood
                        ? 'opticalTransfer.share.savedFoodExisted'
                        : 'opticalTransfer.share.savedFoodTitle'
                      : 'opticalTransfer.share.savedTitle'
                  )}
                </Text>
                {!isFood && reusedFoods > 0 ? (
                  <Text className="text-center text-sm text-text-secondary">
                    {t('opticalTransfer.share.savedReusedFoods', { count: reusedFoods })}
                  </Text>
                ) : null}
                <Button
                  label={t('common.close')}
                  onPress={handleClose}
                  size="sm"
                  variant="accent"
                  width="full"
                />
              </View>
            ) : (
              <>
                {envelope.kind === 'food' ? (
                  <OpticalFoodSharePreview summary={envelope.summary} />
                ) : (
                  <OpticalMealSharePreview summary={envelope.summary} />
                )}
                {savingShare ? (
                  <ProgressIndicator
                    message={t(
                      isFood ? 'opticalTransfer.share.savingFood' : 'opticalTransfer.share.saving'
                    )}
                  />
                ) : (
                  <Button
                    label={t(
                      isFood
                        ? 'opticalTransfer.share.saveToMyFoods'
                        : 'opticalTransfer.share.saveToMyMeals'
                    )}
                    onPress={() => void handleSaveShare(envelope)}
                    size="sm"
                    variant="accent"
                    width="full"
                  />
                )}
              </>
            )}
          </View>
        );
      }

      case 'share-unreadable':
        return (
          <View className="gap-4 px-4 py-10">
            <Text className="text-center" style={{ color: theme.colors.status.error }}>
              {screen.tooNew
                ? t('opticalTransfer.receive.tooNew')
                : t('opticalTransfer.share.unreadable')}
            </Text>
            {scanAgainButton}
          </View>
        );

      case 'error':
        return (
          <View className="gap-4 px-4 py-10">
            <Text className="text-center" style={{ color: theme.colors.status.error }}>
              {t(
                screen.checksumFailed
                  ? 'opticalTransfer.receive.checksumFailed'
                  : 'opticalTransfer.receive.failed'
              )}
            </Text>
            {/* Nothing was wiped: the guards run before the restore, not after. */}
            <Text className="text-center text-xs text-text-tertiary">
              {t('opticalTransfer.receive.nothingChanged')}
            </Text>
            {scanAgainButton}
          </View>
        );
    }
  };

  return (
    <FullScreenModal
      onClose={handleClose}
      scrollable={false}
      showHeader={!isScanning}
      subtitle={t('opticalTransfer.receive.subtitle')}
      // Generic on purpose: which kind of share is arriving is unknowable until the whole stream
      // has been reassembled, and this header is up from the first frame.
      title={
        accept === 'share'
          ? t('opticalTransfer.share.receiveTitle')
          : t('opticalTransfer.receive.title')
      }
      visible={visible}
    >
      <View className="flex-1">
        {renderScreen()}

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
          visible={Boolean(screen.kind === 'database' && confirmVisible)}
          warning={t('opticalTransfer.receive.confirmWarning')}
        />
      </View>
    </FullScreenModal>
  );
}
