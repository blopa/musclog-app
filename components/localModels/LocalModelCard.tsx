import NetInfo from '@react-native-community/netinfo';
import { type ReactNode, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Text, View } from 'react-native';

import { GenericCard } from '@/components/cards/GenericCard';
import { useLocalModelSpace } from '@/components/localModels/useLocalModelSpace';
import { ConfirmationModal } from '@/components/modals/ConfirmationModal';
import { Button } from '@/components/theme/Button';
import { TextButton } from '@/components/theme/TextButton';
import { ToggleInput } from '@/components/theme/ToggleInput';
import { DEFAULT_LOCAL_MODEL } from '@/constants/localModels';
import { useLocalModel } from '@/hooks/useLocalModel';
import { useStorageSizeFormatter } from '@/hooks/useStorageSizeFormatter';
import { useTheme } from '@/hooks/useTheme';
import {
  deleteLocalModel,
  type LocalModelStore,
  localModelStore,
  localTextModelStore,
} from '@/services/localModels/modelStore';
import {
  downloadFraction,
  type LocalModelFailure,
  type LocalModelSelection,
  modelSupportsLanguage,
  totalDownloadBytes,
} from '@/utils/localModels/install';

/** One whole key per failure, so the translation check sees every sentence. */
const FAILURE_KEYS: Record<LocalModelFailure, string> = {
  noSpace: 'onDeviceAi.model.failure.noSpace',
  network: 'onDeviceAi.model.failure.network',
  checksum: 'onDeviceAi.model.failure.checksum',
  interrupted: 'onDeviceAi.model.failure.interrupted',
  http: 'onDeviceAi.model.failure.http',
  storage: 'onDeviceAi.model.failure.storage',
};

type CardVariant = 'main' | 'text';

/** Whole keys per variant, so the translation check sees every sentence. */
const VARIANT_KEYS: Record<
  CardVariant,
  {
    deleteAction: string;
    deleteTitle: string;
    deleteMessage: string;
    ready: string | null;
  }
> = {
  main: {
    deleteAction: 'onDeviceAi.model.actions.delete',
    deleteTitle: 'onDeviceAi.model.delete.title',
    deleteMessage: 'onDeviceAi.model.delete.message',
    ready: null,
  },
  text: {
    deleteAction: 'onDeviceAi.textModel.actions.delete',
    deleteTitle: 'onDeviceAi.textModel.delete.title',
    deleteMessage: 'onDeviceAi.textModel.delete.message',
    ready: 'onDeviceAi.textModel.state.ready',
  },
};

type LocalModelCardProps = {
  /** Which model this card drives; the default is the main on-device model. */
  store?: LocalModelStore;
  /** `text` is the optional chat-only model: its own heading, copy and delete. */
  variant?: CardVariant;
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
  store = localModelStore,
  variant = 'main',
  selection,
  onSelectionChange,
  allowDelete = false,
  hideDownloadButton = false,
}: LocalModelCardProps) {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const manifest = store.manifest;
  const keys = VARIANT_KEYS[variant];
  const isText = variant === 'text';
  const model = useLocalModel(store);
  const textModel = useLocalModel(localTextModelStore);
  const textModelInstalled = !isText && textModel.state.kind !== 'notInstalled';
  const formatSize = useStorageSizeFormatter();
  const [onCellular, setOnCellular] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    let cancelled = false;
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
  const { freeBytes, space } = useLocalModelSpace(store, selection, state.kind);
  const idle = state.kind === 'notInstalled' || state.kind === 'failed';
  const showToggle = Boolean(onSelectionChange) && idle && !isText;
  const textSecondary = {
    color: theme.colors.text.secondary,
    fontSize: theme.typography.fontSize.sm,
  };
  const projectorBytes = manifest.files
    .filter((file) => file.role === 'projector')
    .reduce((sum, file) => sum + file.bytes, 0);

  let spaceNotice: ReactNode = null;

  if (idle && freeBytes !== null) {
    spaceNotice = space.enough ? (
      <Text className="tabular-nums" style={textSecondary}>
        {t('onDeviceAi.model.freeSpace', { size: formatSize(freeBytes) })}
      </Text>
    ) : (
      <Text className="tabular-nums" style={{ ...textSecondary, color: theme.colors.status.error }}>
        {t('onDeviceAi.model.notEnoughSpace', {
          needed: formatSize(space.neededBytes),
          free: formatSize(space.freeBytes),
        })}
      </Text>
    );
  }

  return (
    <GenericCard>
      <View className="gap-3 p-4" testID="local-model-card">
        <View className="gap-1">
          {isText ? (
            <Text
              style={{
                color: theme.colors.text.primary,
                fontSize: theme.typography.fontSize.base,
                fontWeight: theme.typography.fontWeight.semibold,
              }}
            >
              {t('onDeviceAi.textModel.heading')}
            </Text>
          ) : null}
          <Text
            style={{
              color: theme.colors.text.primary,
              fontSize: theme.typography.fontSize.base,
              fontWeight: theme.typography.fontWeight.semibold,
            }}
          >
            {t('onDeviceAi.model.name', { name: manifest.displayName, vendor: manifest.vendor })}
          </Text>
          <Text className="tabular-nums" style={textSecondary}>
            {t('onDeviceAi.model.size', {
              size: formatSize(
                state.kind === 'ready'
                  ? totalDownloadBytes(manifest, { withProjector: model.projectorInstalled })
                  : total
              ),
            })}
          </Text>
          {isText ? (
            <Text style={textSecondary}>
              {t('onDeviceAi.textModel.description', { name: DEFAULT_LOCAL_MODEL.displayName })}
            </Text>
          ) : null}
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
            {keys.ready
              ? t(keys.ready, { name: DEFAULT_LOCAL_MODEL.displayName })
              : t(
                  model.projectorInstalled
                    ? 'onDeviceAi.model.state.readyWithPhotos'
                    : 'onDeviceAi.model.state.readyText'
                )}
          </Text>
        ) : null}

        {spaceNotice}

        {idle && onCellular ? (
          <Text className="tabular-nums" style={textSecondary}>
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
                height: theme.size['2'],
                borderRadius: theme.borderRadius.full,
                backgroundColor: theme.colors.background.cardElevated,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  height: theme.size['2'],
                  width: `${downloadFraction(state.receivedBytes, state.totalBytes) * 100}%`,
                  backgroundColor: theme.colors.accent.primary,
                }}
              />
            </View>
            <Text className="tabular-nums" style={textSecondary}>
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
                onPress={() => void store.pause()}
              />
            </View>
            <View className="grow basis-[140px]">
              <Button
                label={t('onDeviceAi.model.actions.cancel')}
                variant="outline"
                width="full"
                onPress={() => void store.cancel()}
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
                onPress={() => void store.resume()}
              />
            </View>
            <View className="grow basis-[140px]">
              <Button
                label={t('onDeviceAi.model.actions.cancel')}
                variant="outline"
                width="full"
                onPress={() => void store.cancel()}
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
            onPress={() => void store.start(selection)}
          />
        ) : null}

        {state.kind === 'ready' && model.updateAvailable ? (
          <Button
            label={t('onDeviceAi.model.actions.update')}
            variant="accent"
            width="full"
            onPress={() => void store.start({ withProjector: model.projectorInstalled })}
          />
        ) : null}

        {state.kind === 'ready' && allowDelete ? (
          <TextButton
            label={t(keys.deleteAction)}
            tone="danger"
            onPress={() => setConfirmDelete(true)}
          />
        ) : null}

        <View className="flex-row flex-wrap items-center gap-x-2">
          <Text
            style={{ color: theme.colors.text.tertiary, fontSize: theme.typography.fontSize.xs }}
          >
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
            await (isText ? store.remove() : deleteLocalModel());
          }}
          title={t(keys.deleteTitle)}
          message={
            textModelInstalled
              ? t('onDeviceAi.model.delete.messageWithTextModel')
              : t(keys.deleteMessage, { name: DEFAULT_LOCAL_MODEL.displayName })
          }
          confirmLabel={t(keys.deleteAction)}
          variant="destructive"
        />
      </View>
    </GenericCard>
  );
}
