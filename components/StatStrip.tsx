import type { ReactNode } from 'react';
import { Pressable, type StyleProp, Text, type TextStyle, View } from 'react-native';

/**
 * One cell of a stat strip. The value arrives already formatted for the active locale —
 * the strip draws numbers, it never formats them.
 */
export type StatStripItem = {
  key: string;
  value: string;
  /** Rendered small next to the value; omit for a unitless figure such as a step count. */
  unit?: string;
  label: string;
  valueColor: string;
  icon?: ReactNode;
  /** Extra style for the number — today only the intuitive-eating blur. */
  valueStyle?: StyleProp<TextStyle>;
  onPress?: () => void;
  accessibilityLabel?: string;
};

/**
 * The colors a strip needs, so one layout can sit on a plain card or on the hero
 * gradient without the layout itself knowing which surface it is on.
 */
export type StatStripPalette = {
  background: string;
  /** Container outline and the hairlines between cells. */
  border: string;
  label: string;
  unit: string;
};

type StatStripProps = {
  items: StatStripItem[];
  palette: StatStripPalette;
  className?: string;
};

/**
 * A row of labelled figures divided by hairlines: the number first, its label under it.
 *
 * This is the single implementation of that layout. The home screen's energy strip
 * (`DailyHomeFooter`) and the daily summary card's weekly-average macros are the same
 * kind of read — a handful of numbers to scan across — and drew themselves two
 * different ways before this component existed.
 */
export function StatStrip({ className, items, palette }: StatStripProps) {
  if (items.length === 0) {
    return null;
  }

  const renderBody = (item: StatStripItem) => (
    <View className="flex-1 items-center justify-center px-1 py-2.5">
      <View className="flex-row items-center">
        {item.icon ?? null}
        <Text
          className="text-[15px] font-semibold"
          numberOfLines={1}
          style={[{ color: item.valueColor }, item.valueStyle]}
        >
          {item.value}
        </Text>
        {item.unit ? (
          <Text className="ml-1 text-[10px] font-medium" style={{ color: palette.unit }}>
            {item.unit}
          </Text>
        ) : null}
      </View>
      {/*
        Two lines, because "Burned so far" and its translations do not fit a quarter of
        the row on one. The number stays on the first line in every cell either way, so
        the row still reads across.
      */}
      <Text
        className="mt-1 text-center text-[10px] font-semibold uppercase"
        numberOfLines={2}
        style={{ color: palette.label, letterSpacing: 0.7 }}
      >
        {item.label}
      </Text>
    </View>
  );

  const renderCell = (item: StatStripItem) => {
    if (!item.onPress) {
      return renderBody(item);
    }

    return (
      <Pressable
        accessibilityLabel={item.accessibilityLabel}
        accessibilityRole="button"
        className="flex-1 flex-row"
        onPress={item.onPress}
      >
        {renderBody(item)}
      </Pressable>
    );
  };

  return (
    <View
      className={`flex-row items-stretch overflow-hidden rounded-2xl ${className ?? ''}`}
      style={{
        backgroundColor: palette.background,
        borderColor: palette.border,
        borderWidth: 1,
      }}
    >
      {items.map((item, index) => (
        <View key={item.key} className="flex-1 flex-row items-stretch">
          {index > 0 ? (
            <View className="my-2.5 w-px" style={{ backgroundColor: palette.border }} />
          ) : null}
          {renderCell(item)}
        </View>
      ))}
    </View>
  );
}
