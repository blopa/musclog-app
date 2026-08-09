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

interface OpticalSendModalProps {
  visible: boolean;
  onClose: () => void;
  passphrase?: string;
  buildPayload?: (options: { includeImage: boolean }) => Promise<OpticalSenderPayload>;
  photoToggle?: { available: boolean };
  copy?: {
    title: string;
    readyTitle: string;
    instructions: string;
    buildingStep: string;
  };
}

export function OpticalSendModal({
  visible,
  onClose,
  passphrase,
  buildPayload,
  photoToggle,
  copy,
}: OpticalSendModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const { formatInteger, formatRoundedDecimal } = useFormatAppNumber();

  const [includeImage, setIncludeImage] = useState(false);
  const boundBuildPayload = useCallback(
    () =>
      buildPayload
        ? buildPayload({ includeImage })
        : Promise.reject(new Error('No optical payload builder was provided')),
    [buildPayload, includeImage]
  );
  const sender = useOpticalSender({
    buildPayload: buildPayload ? boundBuildPayload : undefined,
    passphrase,
  });
  const { cachedFrames, cacheTarget, framesShown, phase, prepareStep, raster, summary } = sender;

  const formatBytes = useCallback(
    (bytes: number) =>
      bytes < 1024 * 1024
        ? `${formatInteger(Math.round(bytes / 1024))} KB`
        : `${formatRoundedDecimal(bytes / 1048576, 1)} MB`,
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
  const showReadyCard = Boolean(summary) && (phase === 'ready' || phase === 'error' || repacking);

  const handlePhotoChange = useCallback(
    (value: boolean) => {
      setIncludeImage(value);
      if (buildPayload) {
        void sender.prepare(() => buildPayload({ includeImage: value }));
      }
    },
    [buildPayload, sender]
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
      title={copy?.title ?? t('opticalTransfer.send.title')}
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
          <OpticalQualityControls
            estimatedSeconds={summary?.estimatedSeconds}
            fps={sender.fps}
            onFpsChange={sender.setFps}
            onPresetChange={sender.setPreset}
            presetId={sender.presetId}
          />

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
              prepareStep === 'dumping' && copy?.buildingStep
                ? copy.buildingStep
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
            <Text className="font-bold text-text-primary">
              {copy?.readyTitle ?? t('opticalTransfer.send.readyTitle')}
            </Text>
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

          {photoToggle?.available ? <ToggleInput items={photoItems} /> : null}

          {repacking ? (
            <ProgressIndicator message={t('opticalTransfer.share.recalculating')} />
          ) : null}

          <Text className="text-sm text-text-secondary">
            {copy?.instructions ?? t('opticalTransfer.send.readyInstructions')}
          </Text>

          <Button
            disabled={repacking || phase === 'error'}
            label={t('opticalTransfer.send.start')}
            onPress={sender.start}
            size="sm"
            variant="accent"
            width="full"
          />

          <OpticalQualityControls
            estimatedSeconds={summary.estimatedSeconds}
            fps={sender.fps}
            onFpsChange={sender.setFps}
            onPresetChange={sender.setPreset}
            presetId={sender.presetId}
          />
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
