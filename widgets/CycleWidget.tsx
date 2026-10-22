import { HStack, Image, Link, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  containerBackground,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  minimumScaleFactor,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget } from 'expo-widgets';

import { type CycleWidgetSnapshot, INITIAL_CYCLE_SNAPSHOT } from './cycleWidgetSnapshot';

// Outside the `day` state the widget is only a quiet brand shortcut, so the layout never hints at
// what the app tracks.
function CycleWidget(props: CycleWidgetSnapshot) {
  'widget';
  const { palette } = props;
  return (
    <Link
      destination={props.url}
      modifiers={[containerBackground(palette.background, 'widget'), widgetURL(props.url)]}
    >
      <VStack
        alignment="leading"
        spacing={0}
        modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'leading' })]}
      >
        <Text modifiers={[font({ size: 13, weight: 'semibold' }), foregroundStyle(palette.accent)]}>
          {props.title}
        </Text>
        <Spacer />
        {props.state === 'day' ? (
          <VStack alignment="leading" spacing={0}>
            <Text
              modifiers={[
                font({ size: 52, weight: 'bold', design: 'rounded' }),
                foregroundStyle(palette.text),
                lineLimit(1),
                minimumScaleFactor(0.5),
              ]}
            >
              {props.value}
            </Text>
            <Text
              modifiers={[font({ size: 14, weight: 'medium' }), foregroundStyle(palette.secondary)]}
            >
              {props.caption}
            </Text>
          </VStack>
        ) : (
          <HStack>
            <Text
              modifiers={[
                font({ size: 16, weight: 'semibold', design: 'rounded' }),
                foregroundStyle(palette.text),
                lineLimit(2),
                minimumScaleFactor(0.8),
              ]}
            >
              {props.caption}
            </Text>
            <Spacer />
            <Image systemName="arrow.up.right.circle.fill" size={24} color={palette.accent} />
          </HStack>
        )}
      </VStack>
    </Link>
  );
}

export default createWidget('Cycle', CycleWidget, INITIAL_CYCLE_SNAPSHOT);
