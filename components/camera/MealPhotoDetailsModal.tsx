import { Plus, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';

import { MealContextFields } from '@/components/camera/MealContextFields';
import { ConfirmationModal } from '@/components/modals/ConfirmationModal';
import { FullScreenModal } from '@/components/modals/FullScreenModal';
import { Button } from '@/components/theme/Button';
import { Chip } from '@/components/theme/Chip';
import { IconButton } from '@/components/theme/IconButton';
import { TextButton } from '@/components/theme/TextButton';
import { TextInput } from '@/components/theme/TextInput';
import { ZoomableThumbnail } from '@/components/ZoomableThumbnail';
import { useSubModalVisibility } from '@/hooks/useSubModalVisibility';
import { useTheme } from '@/hooks/useTheme';
import {
  ADDED_FAT_LEVELS,
  type AddedFat,
  hasDraftInput,
  MEAL_ORIGINS,
  type MealOrigin,
  type MealPhotoDraft,
  type MealPhotoDraftAction,
} from '@/utils/mealPhotoDraft';

const TILE_SIZE = 112;

// Whole-key tables: `check-translations` cannot see template-built keys.
const ORIGIN_KEYS: Record<MealOrigin, string> = {
  home: 'food.mealPhotos.origin.home',
  restaurant: 'food.mealPhotos.origin.restaurant',
  takeaway: 'food.mealPhotos.origin.takeaway',
  packaged: 'food.mealPhotos.origin.packaged',
};

const ADDED_FAT_KEYS: Record<AddedFat, string> = {
  none: 'food.mealPhotos.addedFat.none',
  some: 'food.mealPhotos.addedFat.some',
  lots: 'food.mealPhotos.addedFat.lots',
};

type MealPhotoDetailsModalProps = {
  visible: boolean;
  draft: MealPhotoDraft;
  dispatch: (action: MealPhotoDraftAction) => void;
  /** Already `min(5, provider limit)`. */
  photoLimit: number;
  /** The parent closes the sheet and returns to the viewfinder. */
  onAddPhoto: () => void;
  onEstimate: () => void;
  /** The parent resets the draft and closes everything. */
  onDiscard: () => void;
  errorMessage?: string | null;
};

function FieldLabel({ children }: { children: string }) {
  return <Text className="text-sm font-semibold text-text-secondary">{children}</Text>;
}

/**
 * The step after cropping: the photos taken so far (sideways, with a + tile for more) and a few
 * optional questions about the meal. Everything but the photos is optional, and Estimate works
 * with nothing filled in. Rendered by `SmartCameraModal` as its child, so the discard
 * confirmation lives inside it too.
 */
export function MealPhotoDetailsModal({
  visible,
  draft,
  dispatch,
  photoLimit,
  onAddPhoto,
  onEstimate,
  onDiscard,
  errorMessage,
}: MealPhotoDetailsModalProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [confirmDiscard, setConfirmDiscard] = useSubModalVisibility(visible);

  const canAdd = draft.photos.length < photoLimit;

  const requestClose = () => {
    if (hasDraftInput(draft)) {
      setConfirmDiscard(true);

      return;
    }

    onDiscard();
  };

  return (
    <FullScreenModal
      visible={visible}
      onClose={requestClose}
      title={t('food.mealPhotos.title')}
      footer={
        <View style={{ gap: theme.spacing.gap.sm }}>
          <Button
            label={t('food.mealPhotos.estimate')}
            variant="accent"
            width="full"
            disabled={draft.photos.length === 0}
            onPress={onEstimate}
          />
          <TextButton
            label={t('common.cancel')}
            tone="muted"
            align="center"
            onPress={requestClose}
          />
        </View>
      }
    >
      <View style={{ gap: theme.spacing.gap.lg, paddingTop: theme.spacing.padding.base }}>
        {errorMessage ? (
          <View
            accessibilityRole="alert"
            className="mx-4 rounded-card border border-status-error bg-bg-card p-3"
          >
            <Text className="text-sm font-medium text-status-error">{errorMessage}</Text>
          </View>
        ) : null}

        <View style={{ gap: theme.spacing.gap.sm }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: theme.spacing.padding.base,
              gap: theme.spacing.gap.sm,
            }}
          >
            {draft.photos.map((uri, index) => (
              <View key={uri} style={{ width: TILE_SIZE, height: TILE_SIZE }}>
                <ZoomableThumbnail uri={uri} style={{ width: TILE_SIZE, height: TILE_SIZE }}>
                  <Image
                    source={{ uri }}
                    resizeMode="cover"
                    style={{
                      width: TILE_SIZE,
                      height: TILE_SIZE,
                      borderRadius: theme.borderRadius.card,
                    }}
                  />
                </ZoomableThumbnail>
                <View style={{ position: 'absolute', top: 2, right: 2 }}>
                  <IconButton
                    icon={X}
                    size="sm"
                    variant="media"
                    accessibilityLabel={t('food.mealPhotos.removePhoto', { index: index + 1 })}
                    onPress={() => dispatch({ type: 'removePhoto', index })}
                  />
                </View>
              </View>
            ))}
            {canAdd ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('food.mealPhotos.addPhoto')}
                onPress={onAddPhoto}
                className="items-center justify-center rounded-card border-2 border-dashed border-border-default bg-bg-card active:opacity-70"
                style={{ width: TILE_SIZE, height: TILE_SIZE }}
              >
                <Plus size={theme.iconSize.xl} color={theme.colors.text.secondary} />
              </Pressable>
            ) : null}
          </ScrollView>
          <Text className="px-4 text-sm tabular-nums text-text-secondary">
            {t('food.mealPhotos.photoCount', {
              count: draft.photos.length,
              max: photoLimit,
            })}
          </Text>
        </View>

        <Text className="px-4 text-sm text-text-secondary">
          {t('food.mealPhotos.optionalHint')}
        </Text>

        <View className="px-4" style={{ gap: theme.spacing.gap.lg }}>
          <TextInput
            label={t('food.mealPhotos.nameLabel')}
            placeholder={t('food.mealPhotos.namePlaceholder')}
            value={draft.name}
            maxLength={80}
            onChangeText={(value) => dispatch({ type: 'setName', value })}
          />
          <MealContextFields
            description={draft.description}
            onDescriptionChange={(value) => dispatch({ type: 'setDescription', value })}
            descriptionLabel={t('food.mealPhotos.descriptionLabel')}
            descriptionPlaceholder={t('food.mealPhotos.descriptionPlaceholder')}
            maxLength={400}
            numberOfLines={3}
            tags={draft.tags}
            onToggleTag={(value) => dispatch({ type: 'toggleTag', value })}
            tagsLabel={t('food.mealPhotos.tagsLabel')}
            middleSlot={
              <>
                <View style={{ gap: theme.spacing.gap.sm }}>
                  <FieldLabel>{t('food.mealPhotos.originLabel')}</FieldLabel>
                  <View className="flex-row flex-wrap" style={{ gap: theme.spacing.gap.sm }}>
                    {MEAL_ORIGINS.map((origin) => (
                      <Chip
                        key={origin}
                        role="radio"
                        label={t(ORIGIN_KEYS[origin])}
                        selected={draft.origin === origin}
                        onPress={() => dispatch({ type: 'toggleOrigin', value: origin })}
                      />
                    ))}
                  </View>
                </View>

                <View style={{ gap: theme.spacing.gap.sm }}>
                  <FieldLabel>{t('food.mealPhotos.addedFatLabel')}</FieldLabel>
                  <View className="flex-row flex-wrap" style={{ gap: theme.spacing.gap.sm }}>
                    {ADDED_FAT_LEVELS.map((level) => (
                      <Chip
                        key={level}
                        role="radio"
                        label={t(ADDED_FAT_KEYS[level])}
                        selected={draft.addedFat === level}
                        onPress={() => dispatch({ type: 'toggleAddedFat', value: level })}
                      />
                    ))}
                  </View>
                </View>
              </>
            }
          />
        </View>
      </View>

      <ConfirmationModal
        visible={confirmDiscard}
        onClose={() => setConfirmDiscard(false)}
        onConfirm={() => {
          setConfirmDiscard(false);
          onDiscard();
        }}
        title={t('food.mealPhotos.discardTitle')}
        message={t('food.mealPhotos.discardMessage')}
        confirmLabel={t('food.mealPhotos.discard')}
        cancelLabel={t('food.mealPhotos.keepEditing')}
        variant="destructive"
      />
    </FullScreenModal>
  );
}
