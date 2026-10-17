import { HStack, Link, ProgressView, Text, VStack } from '@expo/ui/swift-ui';
import {
  containerBackground,
  font,
  foregroundStyle,
  frame,
  tint,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget } from 'expo-widgets';

import { INITIAL_NUTRITION_SNAPSHOT, type NutritionWidgetSnapshot } from './widgetSnapshot';

function NutritionWidget(props: NutritionWidgetSnapshot) {
  'widget';
  return (
    <Link
      destination={props.url}
      modifiers={[containerBackground(props.palette.background, 'widget'), widgetURL(props.url)]}
    >
      <VStack spacing={6} modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}>
        <Text modifiers={[font({ size: 11 }), foregroundStyle(props.palette.secondary)]}>
          {props.dateLabel}
        </Text>
        <HStack spacing={4}>
          <Text
            modifiers={[font({ size: 24, weight: 'bold' }), foregroundStyle(props.palette.text)]}
          >
            {props.calories}
          </Text>
          <Text modifiers={[font({ size: 10 }), foregroundStyle(props.palette.secondary)]}>
            {props.calorieTarget}
          </Text>
        </HStack>
        {props.message ? (
          <Text modifiers={[font({ size: 12 }), foregroundStyle(props.palette.secondary)]}>
            {props.message}
          </Text>
        ) : (
          <VStack spacing={6}>
            <ProgressView value={props.calorieProgress} modifiers={[tint(props.palette.accent)]} />
            <HStack spacing={8}>
              {props.macros.map((macro) => (
                <VStack key={macro.label} spacing={3}>
                  <Text modifiers={[font({ size: 10 }), foregroundStyle(props.palette.secondary)]}>
                    {macro.label}
                  </Text>
                  <Text modifiers={[font({ size: 11 }), foregroundStyle(props.palette.text)]}>
                    {macro.value}
                  </Text>
                  <ProgressView value={macro.progress} modifiers={[tint(macro.color)]} />
                </VStack>
              ))}
            </HStack>
          </VStack>
        )}
      </VStack>
    </Link>
  );
}

export default createWidget('Nutrition', NutritionWidget, INITIAL_NUTRITION_SNAPSHOT);
