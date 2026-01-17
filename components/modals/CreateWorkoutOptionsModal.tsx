import { View, Text, Platform } from 'react-native';
import { Sparkles, PlusCircle, Library } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../../theme';
import { FullScreenModal } from './FullScreenModal';
import { GradientText } from '../GradientText';
import { NewWorkoutCard } from '../cards/NewWorkoutCard';

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
  const { t } = useTranslation();

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title=""
      scrollable={true}
      withGradient={false}>
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
            // Blur is handled via opacity/size here since React Native blur is limited
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

      {/* Custom Header to match mockup */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: theme.spacing.padding.base,
          paddingTop: Platform.OS === 'ios' ? theme.size['16'] : theme.size['10'],
          paddingBottom: theme.spacing.padding.sm,
          zIndex: theme.zIndex.popover,
        }}>
        <Text
          style={{
            fontSize: theme.typography.fontSize.sm,
            fontWeight: theme.typography.fontWeight.bold,
            color: theme.colors.text.secondary,
            textTransform: 'uppercase',
            letterSpacing: theme.typography.letterSpacing.extraWide,
            opacity: theme.colors.opacity.strong,
          }}>
          New Session
        </Text>
        <View style={{ width: theme.size['10'] }} />
      </View>

      <View
        style={{
          flex: 1,
          paddingHorizontal: theme.spacing.padding.xl,
          paddingTop: theme.spacing.padding.xl,
          paddingBottom: theme.spacing.padding['3xl'],
        }}>
        {/* Title */}
        <View style={{ marginBottom: theme.spacing.padding['2xl'] }}>
          <Text
            style={{
              fontSize: theme.typography.fontSize['3xl'],
              fontWeight: theme.typography.fontWeight.extrabold,
              color: theme.colors.text.white,
              lineHeight: theme.typography.fontSize['3xl'] * 1.2,
            }}>
            {"Let's crush a"}
          </Text>
          <GradientText
            colors={theme.colors.gradients.cta}
            style={{
              fontSize: theme.typography.fontSize['3xl'],
              fontWeight: theme.typography.fontWeight.extrabold,
              lineHeight: theme.typography.fontSize['3xl'] * 1.2,
              marginBottom: theme.spacing.padding.xs,
            }}>
            new workout.
          </GradientText>
          <Text
            style={{
              fontSize: theme.typography.fontSize.sm,
              fontWeight: theme.typography.fontWeight.medium,
              color: theme.colors.text.secondary,
              marginTop: theme.spacing.padding.xs,
            }}>
            Select how you want to build your routine today.
          </Text>
        </View>

        <View style={{ gap: theme.spacing.gap.base }}>
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
