import { Library, PlusCircle, Sparkles } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Platform, Text, View } from 'react-native';

import { useTheme } from '../../hooks/useTheme';
import { NewWorkoutCard } from '../cards/NewWorkoutCard';
import { FullScreenModal } from './FullScreenModal';

type CreateWorkoutOptionsModalProps = {
  visible: boolean;
  onClose: () => void;
  onGenerateWithAi: () => void;
  onCreateEmptyTemplate: () => void;
  onBrowseTemplates: () => void;
};

export function CreateWorkoutOptionsModal({
  visible,
  onClose,
  onGenerateWithAi,
  onCreateEmptyTemplate,
  onBrowseTemplates,
}: CreateWorkoutOptionsModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title={t('workouts.createWorkoutOptionsModal.header')}
      scrollable={true}
      withGradient={false}
    >
      {/* Background Glows */}
      <View style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        <View
          style={{
            position: 'absolute',
            top: theme.offset.glowLarge,
            right: theme.offset.glowLarge,
            width: theme.size['300'],
            height: theme.size['300'],
            borderRadius: theme.borderRadius['150'],
            backgroundColor: theme.colors.accent.primary20,
            opacity: theme.colors.opacity.subtle,
          }}
        />
        <View
          style={{
            position: 'absolute',
            bottom: theme.offset.glowLarge,
            left: theme.offset.glowLarge,
            width: theme.size['250'],
            height: theme.size['250'],
            borderRadius: theme.borderRadius['125'],
            backgroundColor: theme.colors.status.indigo10,
            opacity: theme.colors.opacity.subtle,
          }}
        />
      </View>

      <View
        style={{
          flex: 1,
          paddingHorizontal: theme.spacing.padding.xl,
          paddingTop: theme.spacing.padding.xl,
          paddingBottom: theme.spacing.padding['3xl'],
        }}
      >
        {/* Title */}
        <View style={{ marginBottom: theme.spacing.padding['2xl'] }}>
          <Text
            style={{
              fontSize: theme.typography.fontSize['3xl'],
              fontWeight: theme.typography.fontWeight.extrabold,
              color: theme.colors.text.white,
              lineHeight: theme.typography.fontSize['3xl'] * 1.2,
            }}
          >
            {t('workouts.createWorkoutOptionsModal.title')}
          </Text>
          <Text
            style={{
              fontSize: theme.typography.fontSize.sm,
              fontWeight: theme.typography.fontWeight.medium,
              color: theme.colors.text.secondary,
              marginTop: theme.spacing.padding.xs,
            }}
          >
            {t('workouts.createWorkoutOptionsModal.subtitle')}
          </Text>
        </View>

        <View style={{ gap: theme.spacing.gap.base }}>
          {/*TODO: only show if there's AI enabled*/}
          <NewWorkoutCard
            variant="popular"
            icon={<Sparkles size={theme.iconSize.lg} color={theme.colors.text.white} />}
            title={t('workouts.createWorkoutOptions.generateWithAi')}
            subtitle={t('workouts.createWorkoutOptions.generateWithAiSubtitle')}
            onPress={onGenerateWithAi}
          />

          <NewWorkoutCard
            variant="default"
            icon={<PlusCircle size={theme.iconSize.xl} color={theme.colors.text.gray300} />}
            title={t('workouts.createWorkoutOptions.createFromEmptyTemplate')}
            subtitle={t('workouts.createWorkoutOptions.createFromEmptyTemplateSubtitle')}
            onPress={onCreateEmptyTemplate}
          />

          <NewWorkoutCard
            variant="default"
            icon={<Library size={theme.iconSize.xl} color={theme.colors.text.gray300} />}
            title={t('workouts.createWorkoutOptions.browseTemplates')}
            subtitle={t('workouts.createWorkoutOptions.browseTemplatesSubtitle')}
            onPress={onBrowseTemplates}
          />
        </View>
      </View>
    </FullScreenModal>
  );
}
