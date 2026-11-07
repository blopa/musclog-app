import { Fragment, ReactNode, useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';

import { useIsCramped } from '@/hooks/useIsCramped';
import { useMeasuredWidth } from '@/hooks/useMeasuredWidth';
import { useTheme } from '@/hooks/useTheme';
import { layoutToggleRow } from '@/utils/fitText';

type ToggleItem = {
  key: string;
  label: string;
  subtitle?: string;
  icon?: ReactNode;
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
};

type TogglableSettingsProps = {
  items: ToggleItem[];
  header?: ReactNode;
};

/** The room a switch takes beside the text on either platform (Android 52, iOS 51), gap excluded. */
const SWITCH_WIDTH = 52;
/** The leading icon tile when it has not been measured yet (`theme.size['10']`). */
const DEFAULT_ICON_WIDTH = 40;
/** The smallest the row's text is drawn when even the whole row cannot hold its longest word. */
const MIN_TEXT_SIZE = 12;

function ToggleRow({ item }: { item: ToggleItem }) {
  const theme = useTheme();
  const cramped = useIsCramped();
  const { width: rowWidth, fontScale, onLayout: onRowLayout } = useMeasuredWidth();
  const [iconWidth, setIconWidth] = useState(DEFAULT_ICON_WIDTH);
  const gap = theme.spacing.gap.sm;
  const rowPadding = theme.spacing.padding.md;

  // A long word (Dutch "Supplementherinneringen", Russian "редактирование") must never be broken.
  // In order: the switch drops under the text so the text gets the whole row, the icon gives its
  // room away (always while cramped), and only then does the type shrink a little.
  const { showIcon, stackSwitch, fontSize } = layoutToggleRow(
    item.subtitle ? [item.label, item.subtitle] : [item.label],
    rowWidth === null ? null : rowWidth - rowPadding * 2,
    {
      fontSize: theme.typography.fontSize.sm,
      minSize: MIN_TEXT_SIZE,
      iconRoom: item.icon ? iconWidth + gap : 0,
      switchRoom: SWITCH_WIDTH + gap,
      dropIcon: cramped,
      fontScale,
    }
  );

  return (
    <Pressable
      disabled={item.disabled}
      onPress={() => !item.disabled && item.onValueChange(!item.value)}
    >
      {({ pressed }) => (
        <View
          onLayout={onRowLayout}
          style={{
            flexDirection: stackSwitch ? 'column' : 'row',
            alignItems: stackSwitch ? 'stretch' : 'center',
            justifyContent: 'space-between',
            // A gap, so a wrapped description never runs under the switch's own box.
            gap,
            padding: rowPadding,
            backgroundColor: pressed ? theme.colors.background.overlay : undefined,
            opacity: item.disabled ? 0.4 : 1,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap,
              flexShrink: stackSwitch ? 0 : 1,
              flexGrow: stackSwitch ? 0 : 1,
              minWidth: 0,
            }}
          >
            {showIcon ? (
              <View onLayout={(event) => setIconWidth(event.nativeEvent.layout.width)}>
                {item.icon}
              </View>
            ) : null}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                style={{
                  fontSize,
                  color: theme.colors.text.primary,
                  fontWeight: theme.typography.fontWeight.medium,
                }}
              >
                {item.label}
              </Text>
              {item.subtitle ? (
                <Text
                  style={{
                    fontSize,
                    color: theme.colors.text.secondary,
                    marginTop: theme.spacing.padding.xsHalf,
                  }}
                >
                  {item.subtitle}
                </Text>
              ) : null}
            </View>
          </View>
          <View style={{ flexShrink: 0, alignSelf: stackSwitch ? 'flex-end' : undefined }}>
            <Switch
              accessibilityLabel={item.label}
              disabled={item.disabled}
              value={item.value}
              onValueChange={item.onValueChange}
              trackColor={{
                false: theme.colors.background.overlay,
                true: theme.colors.accent.primary,
              }}
              thumbColor={theme.colors.background.alwaysWhite}
            />
          </View>
        </View>
      )}
    </Pressable>
  );
}

export function ToggleInput(props: TogglableSettingsProps) {
  const theme = useTheme();
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
      }}
    >
      {props.header}
      {items.map((it, idx) => (
        <Fragment key={it.key}>
          <ToggleRow item={it} />
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
