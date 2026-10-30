import { HStack, Link, RoundedRectangle, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  containerBackground,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget } from 'expo-widgets';

import { type ActivityWidgetSnapshot, INITIAL_ACTIVITY_SNAPSHOT } from './activityWidgetSnapshot';

// The function body is serialized and evaluated by the widget extension, so it can only use its
// imports and its own locals: no helpers or constants from this module. Each square shares the
// row's width equally, like the Home heatmap's compact card.
function ActivityHeatmapWidget(props: ActivityWidgetSnapshot) {
  'widget';
  const { palette } = props;

  const body = () => {
    if (props.state === 'stale') {
      return (
        <VStack
          alignment="leading"
          spacing={4}
          modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'leading' })]}
        >
          <Text
            modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle(palette.accent)]}
          >
            {props.title}
          </Text>
          <Spacer />
          <Text
            modifiers={[
              font({ size: 15, weight: 'semibold', design: 'rounded' }),
              foregroundStyle(palette.text),
            ]}
          >
            {props.refreshMessage}
          </Text>
        </VStack>
      );
    }

    return (
      <VStack
        alignment="leading"
        spacing={0}
        modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'leading' })]}
      >
        <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle(palette.accent)]}>
          {props.title}
        </Text>
        <Spacer />
        <VStack alignment="leading" spacing={12}>
          {props.rows.map((row) => (
            <VStack key={row.key} alignment="leading" spacing={5}>
              <Text
                modifiers={[
                  font({ size: 11, weight: 'medium' }),
                  foregroundStyle(palette.secondary),
                  lineLimit(1),
                ]}
              >
                {row.label}
              </Text>
              <HStack spacing={2}>
                {row.levels.map((level, index) => (
                  <RoundedRectangle
                    key={`${row.key}-${index}`}
                    cornerRadius={2}
                    modifiers={[
                      foregroundStyle(props.levelColors[level]),
                      frame({ maxWidth: Infinity, minHeight: 20, maxHeight: 20 }),
                    ]}
                  />
                ))}
              </HStack>
            </VStack>
          ))}
        </VStack>
        <Spacer />
      </VStack>
    );
  };

  return (
    <Link
      destination={props.url}
      modifiers={[containerBackground(palette.background, 'widget'), widgetURL(props.url)]}
    >
      {body()}
    </Link>
  );
}

export default createWidget('ActivityHeatmap', ActivityHeatmapWidget, INITIAL_ACTIVITY_SNAPSHOT);
