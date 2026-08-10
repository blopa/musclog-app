/**
 * Optical transfer — the sending screen.
 *
 * Shows a QR code and nothing else that matters. Deliberately has NO progress bar: the sender has
 * no back-channel and the fountain is genuinely endless, so any bar here would be a lie. It says
 * so on screen, because a user watching an endless stream and expecting progress is the likeliest
 * support question.
 */

import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, useWindowDimensions, View } from 'react-native';

import { OpticalQrCanvas } from '@/components/optical/OpticalQrCanvas';
import { OpticalQualityControls } from '@/components/optical/OpticalQualityControls';
import { Button } from '@/components/theme/Button';
import { ProgressIndicator } from '@/components/theme/ProgressIndicator';
import { ToggleInput } from '@/components/theme/ToggleInput';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { type OpticalSenderPayload, useOpticalSender } from '@/hooks/useOpticalSender';
import { useTheme } from '@/hooks/useTheme';

import { FullScreenModal } from './FullScreenModal';
import { formatTransferBytes } from './opticalSendBytes';

export interface OpticalSendCopy {
  title: string;
  readyTitle: string;
  instructions: string;
  /** Shown while the payload is being assembled, in place of the generic "dumping" step. */
  buildingStep: string;
}

interface OpticalSendModalProps {
  visible: boolean;
  onClose: () => void;
  passphrase?: string;
  /**
   * Omit to send the whole database — `useOpticalSender` owns that default, so there is exactly
   * one place the fallback lives and no unreachable "no builder provided" branch here.
   */
  buildPayload?: (options: { includeImage: boolean }) => Promise<OpticalSenderPayload>;
  /** Offers the "include the photo" toggle. Only a payload builder can act on it. */
  hasPhoto?: boolean;
  /**
   * What the last build actually did with the photo, already translated by whoever owns the
   * payload — embedded it, linked it, or could not read it.
   *
   * The size readout cannot carry this: a linked photo costs ~90 bytes and a photo whose file has
   * gone missing costs nothing at all, so both leave the number where it was and the toggle looks
   * like it did nothing. This modal only renders the sentence; deciding which one it is belongs to
   * the builder, which is the only thing that knows.
   */
  photoNotice?: string;
  copy?: Partial<OpticalSendCopy>;
}

export function OpticalSendModal({
  visible,
  onClose,
  passphrase,
  buildPayload,
  hasPhoto = false,
  photoNotice,
  copy,
}: OpticalSendModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const { formatInteger, formatRoundedDecimal } = useFormatAppNumber();

  const [includeImage, setIncludeImage] = useState(false);
  const boundBuildPayload = useMemo(
    () => (buildPayload ? () => buildPayload({ includeImage }) : undefined),
    [buildPayload, includeImage]
  );
  const sender = useOpticalSender({ buildPayload: boundBuildPayload, passphrase });

  const labels: OpticalSendCopy = {
    buildingStep: copy?.buildingStep ?? t('opticalTransfer.send.step.dumping'),
    instructions: copy?.instructions ?? t('opticalTransfer.send.readyInstructions'),
    readyTitle: copy?.readyTitle ?? t('opticalTransfer.send.readyTitle'),
    title: copy?.title ?? t('opticalTransfer.send.title'),
  };
  const { cachedFrames, cacheTarget, framesShown, phase, prepareStep, raster, summary } = sender;

  const formatBytes = useCallback(
    (bytes: number) => formatTransferBytes(bytes, { formatInteger, formatRoundedDecimal }),
    [formatInteger, formatRoundedDecimal]
  );

  const handleShow = useCallback(() => {
    if (phase === 'idle') {
      void sender.prepare();
    }
  }, [phase, sender]);

  const handleClose = useCallback(() => {
    sender.reset();
    setIncludeImage(false);
    onClose();
  }, [onClose, sender]);

  const preparing = phase === 'calibrating' || phase === 'dumping' || phase === 'packing';
  const firstPrepare = preparing && !summary;
  const repacking = preparing && Boolean(summary);
  // Deliberately excludes `error`: the error branch below renders its own message and retry, and
  // showing both left a stale summary card sitting above a failure notice after a failed re-pack.
  const showReadyCard = Boolean(summary) && (phase === 'ready' || repacking);

  const handlePhotoChange = useCallback(
    (value: boolean) => {
      setIncludeImage(value);
      if (buildPayload) {
        void sender.prepare(() => buildPayload({ includeImage: value }));
      }
    },
    [buildPayload, sender]
  );

  // Identical on the ready card and mid-stream: the same knobs, wired to the same sender. The
  // only difference is where they sit, so they are built once.
  const qualityControls = (
    <OpticalQualityControls
      estimatedSeconds={summary?.estimatedSeconds}
      fps={sender.fps}
      onFpsChange={sender.setFps}
      onPresetChange={sender.setPreset}
      presetId={sender.presetId}
    />
  );

  const photoItems = useMemo(
    () => [
      {
        key: 'include-photo',
        label: t('opticalTransfer.share.includePhoto'),
        onValueChange: handlePhotoChange,
        subtitle: t('opticalTransfer.share.includePhotoHint'),
        value: includeImage,
      },
    ],
    [handlePhotoChange, includeImage, t]
  );

  return (
    <FullScreenModal
      onClose={handleClose}
      onShow={handleShow}
      scrollable={phase !== 'streaming'}
      subtitle={phase === 'streaming' ? t('opticalTransfer.send.streamingSubtitle') : undefined}
      title={labels.title}
      visible={visible}
    >
      {phase === 'streaming' ? (
        <View className="flex-1 items-center justify-center gap-4 px-2 py-4">
          <OpticalQrCanvas budgetDp={Math.min(width - 16, 520)} raster={raster} />

          <Text className="text-center text-sm text-text-secondary">
            {t('opticalTransfer.send.noProgressHere')}
          </Text>
          <Text className="text-center text-xs text-text-tertiary">
            {cacheTarget > 0 && cachedFrames < cacheTarget
              ? t('opticalTransfer.send.buildingCache')
              : t('opticalTransfer.send.framesShown', { frames: formatInteger(framesShown) })}
          </Text>

          {/* Reachable here on purpose: a stuck transfer is discovered while it is running, and
              sending the user back to a setup screen to fix it is where they give up. */}
          {qualityControls}

          <Button
            label={t('opticalTransfer.send.stop')}
            onPress={sender.stop}
            size="sm"
            variant="discard"
            width="full"
          />
        </View>
      ) : null}

      {firstPrepare ? (
        <View className="gap-2 px-4 py-10">
          <ProgressIndicator
            message={
              prepareStep === 'dumping'
                ? labels.buildingStep
                : t(`opticalTransfer.send.step.${prepareStep ?? 'calibrating'}`)
            }
          />
          <Text className="text-center text-xs text-text-tertiary">
            {t('opticalTransfer.send.preparingHint')}
          </Text>
        </View>
      ) : null}

      {showReadyCard && summary ? (
        <View className="gap-4 px-4 py-6">
          <View
            className="gap-2 rounded-xl p-4"
            style={{ backgroundColor: theme.colors.background.card }}
          >
            <Text className="font-bold text-text-primary">{labels.readyTitle}</Text>
            <Text className="text-sm text-text-secondary">
              {t('opticalTransfer.send.readySize', {
                compressed: formatBytes(summary.containerBytes),
                original: formatBytes(summary.plainBytes),
              })}
            </Text>
            <Text className="text-sm text-text-secondary">
              {t('opticalTransfer.send.readyEstimate', {
                seconds: formatInteger(summary.estimatedSeconds),
              })}
            </Text>
            {summary.encrypted ? (
              <Text className="text-sm" style={{ color: theme.colors.accent.primary }}>
                {t('opticalTransfer.send.readyEncrypted')}
              </Text>
            ) : null}
          </View>

          {hasPhoto ? (
            <View>
              <ToggleInput items={photoItems} />
              {/* Suppressed mid-repack: the notice describes the build the size card is showing,
                  and the one being rebuilt may reach a different outcome. */}
              {repacking || !photoNotice ? null : (
                <Text className="text-sm text-text-secondary">{photoNotice}</Text>
              )}
            </View>
          ) : null}

          {repacking ? (
            <ProgressIndicator message={t('opticalTransfer.share.recalculating')} />
          ) : null}

          <Text className="text-sm text-text-secondary">{labels.instructions}</Text>

          <Button
            disabled={repacking}
            label={t('opticalTransfer.send.start')}
            onPress={sender.start}
            size="sm"
            variant="accent"
            width="full"
          />

          {qualityControls}
        </View>
      ) : null}

      {phase === 'error' ? (
        <View className="gap-4 px-4 py-10">
          <Text className="text-center" style={{ color: theme.colors.status.error }}>
            {t('opticalTransfer.send.failed')}
          </Text>
          <Text className="text-center text-xs text-text-tertiary">{sender.errorMessage}</Text>
          <Button
            label={t('opticalTransfer.retry')}
            onPress={() => void sender.prepare()}
            size="sm"
            variant="outline"
            width="full"
          />
        </View>
      ) : null}
    </FullScreenModal>
  );
}
