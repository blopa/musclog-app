import { Link, Text, VStack } from '@expo/ui/swift-ui';
import {
  containerBackground,
  font,
  foregroundStyle,
  frame,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget } from 'expo-widgets';

import { type CycleWidgetSnapshot, INITIAL_CYCLE_SNAPSHOT } from './cycleWidgetSnapshot';

function CycleWidget(props: CycleWidgetSnapshot) {
  'widget';
  return (
    <Link
      destination={props.url}
      modifiers={[containerBackground(props.palette.background, 'widget'), widgetURL(props.url)]}
    >
      <VStack spacing={4} modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}>
        <Text modifiers={[font({ size: 11 }), foregroundStyle(props.palette.secondary)]}>
          {props.title}
        </Text>
        {props.value ? (
          <Text
            modifiers={[font({ size: 32, weight: 'bold' }), foregroundStyle(props.palette.text)]}
          >
            {props.value}
          </Text>
        ) : null}
        <Text modifiers={[font({ size: 12 }), foregroundStyle(props.palette.secondary)]}>
          {props.caption}
        </Text>
        {props.detail ? (
          <Text modifiers={[font({ size: 11 }), foregroundStyle(props.palette.accent)]}>
            {props.detail}
          </Text>
        ) : null}
      </VStack>
    </Link>
  );
}

export default createWidget('Cycle', CycleWidget, INITIAL_CYCLE_SNAPSHOT);
