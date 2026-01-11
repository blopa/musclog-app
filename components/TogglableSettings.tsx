import React from 'react';
import { View, Text, Switch, Pressable } from 'react-native';
import { theme } from '../theme';

type ToggleItem = {
  key: string;
  label: string;
  icon?: React.ReactNode;
  value: boolean;
  onValueChange: (v: boolean) => void;
};

type TogglableSettingsProps = {
  items: ToggleItem[];
  header?: React.ReactNode;
};

export function TogglableSettings(props: TogglableSettingsProps) {
  const items: ToggleItem[] = props.items;
  const hasHeader = !!props.header;

  return (
    <View
      style={{
        backgroundColor: theme.colors.background.card,
        borderRadius: 16,
        marginHorizontal: 16,
        marginBottom: 16,
        padding: hasHeader ? 0 : 4,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: theme.colors.border.light,
        shadowColor: theme.colors.accent.primary,
        shadowOpacity: 0.03,
        shadowRadius: 2,
        shadowOffset: { width: 0, height: 1 },
      }}>
      {props.header}
      {items.map((it, idx) => (
        <React.Fragment key={it.key}>
          <Pressable
            style={({ pressed }) => [
              {
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 12,
                backgroundColor: pressed ? theme.colors.background.overlay : undefined,
              },
            ]}
            onPress={() => it.onValueChange(!it.value)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {it.icon}
              <Text style={{ fontSize: 15, color: theme.colors.text.primary, fontWeight: '500' }}>
                {it.label}
              </Text>
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
          </Pressable>
          {idx < items.length - 1 && (
            <View
              style={{ height: 1, backgroundColor: theme.colors.border.light, marginHorizontal: 8 }}
            />
          )}
        </React.Fragment>
      ))}
    </View>
  );
}
