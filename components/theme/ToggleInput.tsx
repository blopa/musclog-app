import { Fragment, ReactNode } from 'react';
import { View, Text, Switch, Pressable } from 'react-native';
import { theme } from '../../theme';

type ToggleItem = {
  key: string;
  label: string;
  subtitle?: string;
  icon?: ReactNode;
  value: boolean;
  onValueChange: (v: boolean) => void;
};

type TogglableSettingsProps = {
  items: ToggleItem[];
  header?: ReactNode;
};

export function ToggleInput(props: TogglableSettingsProps) {
  const items: ToggleItem[] = props.items;
  const hasHeader = !!props.header;

  return (
    <View
      style={{
        backgroundColor: theme.colors.background.card,
        borderRadius: theme.borderRadius.lg,
        marginBottom: theme.spacing.padding.base,
        padding: hasHeader ? 0 : theme.spacing.padding.sm,
        overflow: 'hidden',
        borderWidth: theme.borderWidth.thin,
        borderColor: theme.colors.border.light,
        shadowColor: theme.colors.accent.primary,
        shadowOpacity: theme.shadowOpacity.veryLight,
        shadowRadius: theme.shadowRadius.sm,
        shadowOffset: theme.shadowOffset.sm,
      }}
    >
      {props.header}
      {items.map((it, idx) => (
        <Fragment key={it.key}>
          <Pressable onPress={() => it.onValueChange(!it.value)}>
            {({ pressed }) => (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: theme.spacing.padding.md,
                  backgroundColor: pressed ? theme.colors.background.overlay : undefined,
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: theme.spacing.gap.sm,
                    flex: 1,
                  }}
                >
                  {it.icon}
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: theme.typography.fontSize.sm,
                        color: theme.colors.text.primary,
                        fontWeight: theme.typography.fontWeight.medium,
                      }}
                    >
                      {it.label}
                    </Text>
                    {it.subtitle ? (
                      <Text
                        style={{
                          fontSize: theme.typography.fontSize.sm,
                          color: theme.colors.text.secondary,
                          marginTop: theme.spacing.padding.xsHalf,
                        }}
                      >
                        {it.subtitle}
                      </Text>
                    ) : null}
                  </View>
                </View>
                <Switch
                  value={it.value}
                  onValueChange={it.onValueChange}
                  trackColor={{
                    false: theme.colors.background.overlay,
                    true: theme.colors.accent.primary,
                  }}
                  thumbColor={theme.colors.background.white}
                />
              </View>
            )}
          </Pressable>
          {idx < items.length - 1 ? (
            <View
              style={{
                height: theme.borderWidth.thin,
                backgroundColor: theme.colors.border.light,
                marginHorizontal: theme.spacing.padding.sm,
              }}
            />
          ) : null}
        </Fragment>
      ))}
    </View>
  );
}
