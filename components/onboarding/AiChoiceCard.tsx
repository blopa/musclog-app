import { Check, CheckCircle2, Circle, Minus } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

export type AiChoicePoint = {
  text: string;
  /** `plus` is something the option gives; `minus` is a limit the person should know about. */
  kind: 'plus' | 'minus';
};

type AiChoiceCardProps = {
  title: string;
  /** A short tag beside the title ("Most private", "Free"). */
  badge?: string;
  /** The option's cost, on its own line under the title. */
  price?: string;
  points: readonly AiChoicePoint[];
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
};

/**
 * One choice on the onboarding AI step: a radio card whose points say what the option gives and
 * what it costs the person, so the three options can be compared without opening anything.
 */
export function AiChoiceCard({
  title,
  badge,
  price,
  points,
  selected,
  onPress,
  disabled,
  testID,
}: AiChoiceCardProps) {
  const theme = useTheme();
  const RadioIcon = selected ? CheckCircle2 : Circle;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityLabel={[title, price].filter(Boolean).join(', ')}
      accessibilityState={{ checked: selected, disabled }}
      // react-native-web does not map accessibilityState to aria-checked; web needs both.
      aria-checked={selected}
      aria-disabled={disabled}
      testID={testID}
    >
      {({ pressed }) => (
        <View
          className="gap-3 rounded-card p-4"
          style={{
            backgroundColor: selected
              ? theme.colors.accent.primary10
              : theme.colors.background.card,
            borderWidth: 2,
            borderColor: selected ? theme.colors.accent.primary : theme.colors.border.light,
            opacity: pressed ? 0.85 : 1,
          }}
        >
          <View className="flex-row items-start gap-3">
            <View className="min-w-0 flex-1 gap-1">
              <View className="flex-row flex-wrap items-center gap-x-2 gap-y-1">
                <Text
                  className="font-bold"
                  style={{
                    color: theme.colors.text.primary,
                    fontSize: theme.typography.fontSize.lg,
                  }}
                >
                  {title}
                </Text>
                {badge ? (
                  <View
                    className="rounded-tag px-2 py-0.5"
                    style={{ backgroundColor: theme.colors.accent.primary20 }}
                  >
                    <Text
                      className="font-semibold"
                      style={{
                        color: theme.colors.accent.primary,
                        fontSize: theme.typography.fontSize.xs,
                      }}
                    >
                      {badge}
                    </Text>
                  </View>
                ) : null}
              </View>
              {price ? (
                <Text
                  className="font-semibold tabular-nums"
                  style={{
                    color: theme.colors.text.primary,
                    fontSize: theme.typography.fontSize.sm,
                  }}
                >
                  {price}
                </Text>
              ) : null}
            </View>
            <View className="shrink-0 pt-0.5">
              <RadioIcon
                size={24}
                color={selected ? theme.colors.accent.primary : theme.colors.text.tertiary}
              />
            </View>
          </View>
          <View className="gap-2">
            {points.map((point) => {
              const PointIcon = point.kind === 'plus' ? Check : Minus;

              return (
                <View key={point.text} className="flex-row items-start gap-2">
                  <View className="shrink-0 pt-0.5">
                    <PointIcon
                      size={16}
                      color={
                        point.kind === 'plus'
                          ? theme.colors.accent.primary
                          : theme.colors.text.tertiary
                      }
                    />
                  </View>
                  <Text
                    className="min-w-0 flex-1"
                    style={{
                      color: theme.colors.text.secondary,
                      fontSize: theme.typography.fontSize.sm,
                      lineHeight: theme.typography.fontSize.sm * 1.4,
                    }}
                  >
                    {point.text}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      )}
    </Pressable>
  );
}
