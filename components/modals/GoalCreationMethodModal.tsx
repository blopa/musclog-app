import { Calculator, ChevronRight, PenLine, Sparkles } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

import { FullScreenModal } from './FullScreenModal';

type GoalCreationMethodModalProps = {
  visible: boolean;
  onClose: () => void;
  onSelectManual: () => void;
  onSelectGuided: () => void;
  onSelectAutoCalculate: () => void;
};

export function GoalCreationMethodModal({
  visible,
  onClose,
  onSelectManual,
  onSelectGuided,
  onSelectAutoCalculate,
}: GoalCreationMethodModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title={t('goalsManagement.goalCreationMethod.title')}
    >
      <View style={{ padding: 16, gap: 12 }}>
        <Text
          style={{
            fontSize: theme.typography.fontSize.sm,
            color: theme.colors.text.secondary,
            marginBottom: 8,
          }}
        >
          {t('goalsManagement.goalCreationMethod.subtitle')}
        </Text>

        {/* Guided option — recommended */}
        <Pressable
          onPress={onSelectGuided}
          style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
        >
          <View
            style={{
              borderRadius: 16,
              borderWidth: 1.5,
              borderColor: theme.colors.accent.primary,
              backgroundColor: theme.colors.accent.primary10,
              padding: 20,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
              <View
                style={{
                  borderRadius: 12,
                  padding: 12,
                  backgroundColor: theme.colors.accent.primary20,
                }}
              >
                <Sparkles size={theme.iconSize.md} color={theme.colors.accent.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 4,
                    flexWrap: 'wrap',
                  }}
                >
                  <Text
                    style={{
                      fontSize: theme.typography.fontSize.base,
                      fontWeight: theme.typography.fontWeight.bold,
                      color: theme.colors.text.primary,
                    }}
                  >
                    {t('goalsManagement.goalCreationMethod.guidedTitle')}
                  </Text>
                  <View
                    style={{
                      borderRadius: 999,
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                      backgroundColor: theme.colors.accent.primary,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: theme.typography.fontSize.xs,
                        fontWeight: theme.typography.fontWeight.bold,
                        color: '#fff',
                      }}
                    >
                      {t('goalsManagement.goalCreationMethod.recommended')}
                    </Text>
                  </View>
                </View>
                <Text
                  style={{
                    fontSize: theme.typography.fontSize.sm,
                    color: theme.colors.text.secondary,
                  }}
                >
                  {t('goalsManagement.goalCreationMethod.guidedDescription')}
                </Text>
              </View>
              <ChevronRight
                size={theme.iconSize.sm}
                color={theme.colors.accent.primary}
                style={{ marginTop: 2 }}
              />
            </View>
          </View>
        </Pressable>

        {/* Auto-calculate option */}
        <Pressable
          onPress={onSelectAutoCalculate}
          style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
        >
          <View
            style={{
              borderRadius: 16,
              borderWidth: 1,
              borderColor: theme.colors.border.light,
              backgroundColor: theme.colors.background.card,
              padding: 20,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
              <View
                style={{
                  borderRadius: 12,
                  padding: 12,
                  backgroundColor: theme.colors.background.secondaryDark,
                }}
              >
                <Calculator size={theme.iconSize.md} color={theme.colors.text.secondary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: theme.typography.fontSize.base,
                    fontWeight: theme.typography.fontWeight.bold,
                    color: theme.colors.text.primary,
                    marginBottom: 4,
                  }}
                >
                  {t('goalsManagement.goalCreationMethod.autoCalculateTitle')}
                </Text>
                <Text
                  style={{
                    fontSize: theme.typography.fontSize.sm,
                    color: theme.colors.text.secondary,
                  }}
                >
                  {t('goalsManagement.goalCreationMethod.autoCalculateDescription')}
                </Text>
              </View>
              <ChevronRight
                size={theme.iconSize.sm}
                color={theme.colors.text.secondary}
                style={{ marginTop: 2 }}
              />
            </View>
          </View>
        </Pressable>

        {/* Manual option */}
        <Pressable
          onPress={onSelectManual}
          style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
        >
          <View
            style={{
              borderRadius: 16,
              borderWidth: 1,
              borderColor: theme.colors.border.light,
              backgroundColor: theme.colors.background.card,
              padding: 20,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
              <View
                style={{
                  borderRadius: 12,
                  padding: 12,
                  backgroundColor: theme.colors.background.secondaryDark,
                }}
              >
                <PenLine size={theme.iconSize.md} color={theme.colors.text.secondary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: theme.typography.fontSize.base,
                    fontWeight: theme.typography.fontWeight.bold,
                    color: theme.colors.text.primary,
                    marginBottom: 4,
                  }}
                >
                  {t('goalsManagement.goalCreationMethod.manualTitle')}
                </Text>
                <Text
                  style={{
                    fontSize: theme.typography.fontSize.sm,
                    color: theme.colors.text.secondary,
                  }}
                >
                  {t('goalsManagement.goalCreationMethod.manualDescription')}
                </Text>
              </View>
              <ChevronRight
                size={theme.iconSize.sm}
                color={theme.colors.text.secondary}
                style={{ marginTop: 2 }}
              />
            </View>
          </View>
        </Pressable>
      </View>
    </FullScreenModal>
  );
}
