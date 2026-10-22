import { Gauge, HStack, Link, ProgressView, Spacer, Text, VStack, ZStack } from '@expo/ui/swift-ui';
import {
  containerBackground,
  font,
  foregroundStyle,
  frame,
  gaugeStyle,
  lineLimit,
  minimumScaleFactor,
  scaleEffect,
  tint,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

import { INITIAL_NUTRITION_SNAPSHOT, type NutritionWidgetSnapshot } from './widgetSnapshot';

// The function body is serialized and evaluated by the widget extension, so it can only use its
// imports and its own locals: no helpers or constants from this module.
function NutritionWidget(props: NutritionWidgetSnapshot, environment: WidgetEnvironment) {
  'widget';
  const { palette } = props;
  const isMedium = environment.widgetFamily === 'systemMedium';
  const ringSize = isMedium ? 104 : 96;

  const background = containerBackground(palette.background, 'widget');
  const open = widgetURL(props.url);

  if (props.message) {
    return (
      <Link destination={props.url} modifiers={[background, open]}>
        <VStack
          alignment="leading"
          spacing={4}
          modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'leading' })]}
        >
          <Text
            modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle(palette.accent)]}
          >
            {props.dateLabel}
          </Text>
          <Spacer />
          <Text
            modifiers={[
              font({ size: 15, weight: 'semibold', design: 'rounded' }),
              foregroundStyle(palette.text),
            ]}
          >
            {props.message}
          </Text>
        </VStack>
      </Link>
    );
  }

  // The gauge draws only the ring; its own value label is not rendered by the widget runtime.
  const ring = (
    <ZStack alignment="center" modifiers={[frame({ width: ringSize, height: ringSize })]}>
      <Gauge
        value={props.calorieProgress}
        min={0}
        max={1}
        modifiers={[
          gaugeStyle('circularCapacity'),
          tint(palette.accent),
          frame({ width: ringSize * 0.7, height: ringSize * 0.7 }),
          scaleEffect(1.43),
        ]}
      />
      <VStack spacing={0} modifiers={[frame({ width: ringSize - 28 })]}>
        <Text
          modifiers={[
            font({ size: 23, weight: 'bold', design: 'rounded' }),
            foregroundStyle(palette.text),
            lineLimit(1),
            minimumScaleFactor(0.5),
          ]}
        >
          {props.calories}
        </Text>
        <Text
          modifiers={[
            font({ size: 10, weight: 'medium' }),
            foregroundStyle(palette.secondary),
            lineLimit(1),
            minimumScaleFactor(0.6),
          ]}
        >
          {props.calorieTarget}
        </Text>
      </VStack>
    </ZStack>
  );

  if (!isMedium) {
    return (
      <Link destination={props.url} modifiers={[background, open]}>
        <VStack
          alignment="leading"
          spacing={0}
          modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}
        >
          <Text
            modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle(palette.secondary)]}
          >
            {props.dateLabel}
          </Text>
          <Spacer />
          <HStack>
            <Spacer />
            {ring}
            <Spacer />
          </HStack>
          <Spacer />
        </VStack>
      </Link>
    );
  }

  return (
    <Link destination={props.url} modifiers={[background, open]}>
      <HStack spacing={16} modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}>
        <VStack alignment="leading" spacing={0}>
          <Text
            modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle(palette.secondary)]}
          >
            {props.dateLabel}
          </Text>
          <Spacer />
          {ring}
          <Spacer />
        </VStack>
        <VStack spacing={10} modifiers={[frame({ maxWidth: Infinity })]}>
          {props.macros.map((macro) => (
            <VStack key={macro.label} alignment="leading" spacing={4}>
              <HStack>
                <Text
                  modifiers={[
                    font({ size: 12, weight: 'medium' }),
                    foregroundStyle(palette.secondary),
                  ]}
                >
                  {macro.label}
                </Text>
                <Spacer />
                <Text
                  modifiers={[
                    font({ size: 14, weight: 'bold', design: 'rounded' }),
                    foregroundStyle(palette.text),
                  ]}
                >
                  {macro.value}
                </Text>
              </HStack>
              <ProgressView value={macro.progress} modifiers={[tint(macro.color)]} />
            </VStack>
          ))}
        </VStack>
      </HStack>
    </Link>
  );
}

export default createWidget('Nutrition', NutritionWidget, INITIAL_NUTRITION_SNAPSHOT);
