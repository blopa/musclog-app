import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Text, View } from 'react-native';

import { ConfirmationModal } from '@/components/modals/ConfirmationModal';
import { Button } from '@/components/theme/Button';
import { TextButton } from '@/components/theme/TextButton';
import { ToggleInput } from '@/components/theme/ToggleInput';
import { DEFAULT_LOCAL_MODEL } from '@/constants/localModels';
import { useLocalModel } from '@/hooks/useLocalModel';
import { useStorageSizeFormatter } from '@/hooks/useStorageSizeFormatter';
import { useTheme } from '@/hooks/useTheme';
import {
  cancelLocalModelDownload,
  deleteLocalModel,
  getFreeDiskBytes,
  pauseLocalModelDownload,
  resumeLocalModelDownload,
  startLocalModelDownload,
} from '@/services/localModels/modelStore';
import {
  checkSpace,
  downloadFraction,
  type LocalModelFailure,
  type LocalModelSelection,
  modelSupportsLanguage,
  totalDownloadBytes,
} from '@/utils/localModels/install';

const manifest = DEFAULT_LOCAL_MODEL;

/** One whole key per failure, so the translation check sees every sentence. */
const FAILURE_KEYS: Record<LocalModelFailure, string> = {
  noSpace: 'onDeviceAi.model.failure.noSpace',
  network: 'onDeviceAi.model.failure.network',
  checksum: 'onDeviceAi.model.failure.checksum',
  interrupted: 'onDeviceAi.model.failure.interrupted',
  http: 'onDeviceAi.model.failure.http',
  storage: 'onDeviceAi.model.failure.storage',
};

type LocalModelCardProps = {
  selection: LocalModelSelection;
  /** When given, the person can leave the photo projector out (onboarding and settings). */
  onSelectionChange?: (selection: LocalModelSelection) => void;
  /** Settings only: offer deleting an installed model. */
  allowDelete?: boolean;
  /** Onboarding starts the download from its own button, so the card shows no download button. */
  hideDownloadButton?: boolean;
};

/**
 * The downloaded on-device model, in every state it can be in: what it is and costs, whether the
 * phone has room, then the download as it runs. Onboarding and Settings share it, so a download
 * started in one is the same one the other shows.
 */
export function LocalModelCard({
  selection,
  onSelectionChange,
  allowDelete = false,
  hideDownloadButton = false,
}: LocalModelCardProps) {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const model = useLocalModel();
  const formatSize = useStorageSizeFormatter();
  const [freeBytes, setFreeBytes] = useState<number | null>(null);
  const [onCellular, setOnCellular] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getFreeDiskBytes().then((bytes) => {
      if (!cancelled) {
        setFreeBytes(bytes);
      }
    });
    NetInfo.fetch()
      .then((state) => {
        if (!cancelled) {
          setOnCellular(state.type === 'cellular');
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  const state = model.state;
  const total = totalDownloadBytes(manifest, selection);
  const space = checkSpace(freeBytes, manifest, selection);
  const idle = state.kind === 'notInstalled' || state.kind === 'failed';
  const showToggle = Boolean(onSelectionChange) && idle;
  const textSecondary = {
    color: theme.colors.text.secondary,
    fontSize: theme.typography.fontSize.sm,
  };
  const projectorBytes = manifest.files
    .filter((file) => file.role === 'projector')
    .reduce((sum, file) => sum + file.bytes, 0);

  return (
    <View
      className="gap-3 rounded-card p-4"
      testID="local-model-card"
      style={{
        backgroundColor: theme.colors.background.card,
        borderWidth: 1,
        borderColor: theme.colors.border.light,
      }}
    >
      <View className="gap-1">
        <Text
          className="font-bold"
          style={{ color: theme.colors.text.primary, fontSize: theme.typography.fontSize.base }}
        >
          {t('onDeviceAi.model.name', { name: manifest.displayName, vendor: manifest.vendor })}
        </Text>
        <Text style={textSecondary}>
          {t('onDeviceAi.model.size', {
            size: formatSize(
              state.kind === 'ready'
                ? totalDownloadBytes(manifest, { withProjector: model.projectorInstalled })
                : total
            ),
          })}
        </Text>
      </View>

      {showToggle ? (
        <ToggleInput
          items={[
            {
              key: 'photos',
              label: t('onDeviceAi.model.photos.label'),
              subtitle: t('onDeviceAi.model.photos.hint', { size: formatSize(projectorBytes) }),
              value: selection.withProjector,
              onValueChange: (value) => onSelectionChange?.({ withProjector: value }),
            },
          ]}
        />
      ) : null}

      {state.kind === 'ready' ? (
        <Text style={textSecondary}>
          {t(
            model.projectorInstalled
              ? 'onDeviceAi.model.state.readyWithPhotos'
              : 'onDeviceAi.model.state.readyText'
          )}
        </Text>
      ) : null}

      {idle && freeBytes !== null ? (
        space.enough ? (
          <Text style={textSecondary}>
            {t('onDeviceAi.model.freeSpace', { size: formatSize(freeBytes) })}
          </Text>
        ) : (
          <Text style={{ ...textSecondary, color: theme.colors.status.error }}>
            {t('onDeviceAi.model.notEnoughSpace', {
              needed: formatSize(space.neededBytes),
              free: formatSize(space.freeBytes),
            })}
          </Text>
        )
      ) : null}

      {idle && onCellular ? (
        <Text style={textSecondary}>
          {t('onDeviceAi.model.mobileData', { size: formatSize(total) })}
        </Text>
      ) : null}

      {!modelSupportsLanguage(manifest, i18n.language) ? (
        <Text style={textSecondary}>{t('onDeviceAi.model.languageNote')}</Text>
      ) : null}

      {state.kind === 'downloading' || state.kind === 'paused' ? (
        <View className="gap-2">
          <View
            accessibilityRole="progressbar"
            accessibilityValue={{
              min: 0,
              max: 100,
              now: Math.round(downloadFraction(state.receivedBytes, state.totalBytes) * 100),
            }}
            style={{
              height: 8,
              borderRadius: 4,
              backgroundColor: theme.colors.background.cardElevated,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                height: 8,
                width: `${downloadFraction(state.receivedBytes, state.totalBytes) * 100}%`,
                backgroundColor: theme.colors.accent.primary,
              }}
            />
          </View>
          <Text style={textSecondary}>
            {t(
              state.kind === 'paused'
                ? 'onDeviceAi.model.state.paused'
                : 'onDeviceAi.model.state.downloading',
              { received: formatSize(state.receivedBytes), total: formatSize(state.totalBytes) }
            )}
          </Text>
        </View>
      ) : null}

      {state.kind === 'verifying' ? (
        <Text style={textSecondary}>{t('onDeviceAi.model.state.verifying')}</Text>
      ) : null}
      {state.kind === 'installing' ? (
        <Text style={textSecondary}>{t('onDeviceAi.model.state.installing')}</Text>
      ) : null}

      {state.kind === 'failed' ? (
        <Text
          accessibilityRole="alert"
          style={{ ...textSecondary, color: theme.colors.status.error }}
        >
          {t(FAILURE_KEYS[state.reason])}
        </Text>
      ) : null}

      {model.updateAvailable && state.kind !== 'downloading' ? (
        <Text style={textSecondary}>{t('onDeviceAi.model.updateAvailable')}</Text>
      ) : null}

      {state.kind === 'downloading' ? (
        <View className="flex-row flex-wrap gap-2">
          <View className="grow basis-[140px]">
            <Button
              label={t('onDeviceAi.model.actions.pause')}
              variant="outline"
              width="full"
              onPress={() => void pauseLocalModelDownload()}
            />
          </View>
          <View className="grow basis-[140px]">
            <Button
              label={t('onDeviceAi.model.actions.cancel')}
              variant="outline"
              width="full"
              onPress={() => void cancelLocalModelDownload()}
            />
          </View>
        </View>
      ) : null}

      {state.kind === 'paused' ? (
        <View className="flex-row flex-wrap gap-2">
          <View className="grow basis-[140px]">
            <Button
              label={t('onDeviceAi.model.actions.resume')}
              variant="accent"
              width="full"
              onPress={() => void resumeLocalModelDownload()}
            />
          </View>
          <View className="grow basis-[140px]">
            <Button
              label={t('onDeviceAi.model.actions.cancel')}
              variant="outline"
              width="full"
              onPress={() => void cancelLocalModelDownload()}
            />
          </View>
        </View>
      ) : null}

      {idle && !hideDownloadButton ? (
        <Button
          testID="local-model-download"
          label={t(
            state.kind === 'failed'
              ? 'onDeviceAi.model.actions.retry'
              : 'onDeviceAi.model.actions.download',
            { size: formatSize(total) }
          )}
          variant="accent"
          width="full"
          disabled={!space.enough}
          onPress={() => void startLocalModelDownload(selection)}
        />
      ) : null}

      {state.kind === 'ready' && model.updateAvailable ? (
        <Button
          label={t('onDeviceAi.model.actions.update')}
          variant="accent"
          width="full"
          onPress={() => void startLocalModelDownload({ withProjector: model.projectorInstalled })}
        />
      ) : null}

      {state.kind === 'ready' && allowDelete ? (
        <TextButton
          label={t('onDeviceAi.model.actions.delete')}
          tone="danger"
          onPress={() => setConfirmDelete(true)}
        />
      ) : null}

      <View className="flex-row flex-wrap items-center gap-x-2">
        <Text style={{ color: theme.colors.text.tertiary, fontSize: theme.typography.fontSize.xs }}>
          {t('onDeviceAi.model.license', { license: manifest.licenseName })}
        </Text>
        <TextButton
          label={t('onDeviceAi.model.readLicense')}
          onPress={() => void Linking.openURL(manifest.licenseUrl)}
        />
      </View>

      <ConfirmationModal
        visible={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          setConfirmDelete(false);
          await deleteLocalModel();
        }}
        title={t('onDeviceAi.model.delete.title')}
        message={t('onDeviceAi.model.delete.message')}
        confirmLabel={t('onDeviceAi.model.actions.delete')}
        variant="destructive"
      />
    </View>
  );
}
