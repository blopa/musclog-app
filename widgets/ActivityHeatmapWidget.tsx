import { HStack, Link, RoundedRectangle, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  containerBackground,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

import { type ActivityWidgetSnapshot, INITIAL_ACTIVITY_SNAPSHOT } from './activityWidgetSnapshot';

// The function body is serialized and evaluated by the widget extension, so it can only use its
// imports and its own locals: no helpers or constants from this module. Each square shares the
// row's width equally, like the Home heatmap's compact card. The small widget wraps each source's
// 30 days into three rows of ten (oldest first, read left to right) so the square stays filled;
// the medium one keeps the single strip per source.
function ActivityHeatmapWidget(props: ActivityWidgetSnapshot, environment: WidgetEnvironment) {
  'widget';
  const { palette } = props;
  const isSmall = environment.widgetFamily === 'systemSmall';
  const smallRowLength = 10;

  const strip = (levels: number[], key: string, squareHeight: number) => (
    <HStack key={key} spacing={2}>
      {levels.map((level, index) => (
        <RoundedRectangle
          key={`${key}-${index}`}
          cornerRadius={2}
          modifiers={[
            foregroundStyle(props.levelColors[level]),
            frame({ maxWidth: Infinity, minHeight: squareHeight, maxHeight: squareHeight }),
          ]}
        />
      ))}
    </HStack>
  );

  const grid = (levels: number[], key: string) => {
    const lines: number[][] = [];
    for (let start = 0; start < levels.length; start += smallRowLength) {
      lines.push(levels.slice(start, start + smallRowLength));
    }

    return (
      <VStack alignment="leading" spacing={2}>
        {lines.map((line, lineIndex) => strip(line, `${key}-${lineIndex}`, 8))}
      </VStack>
    );
  };

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
        <Spacer minLength={isSmall ? 4 : 8} />
        <VStack alignment="leading" spacing={isSmall ? 6 : 12}>
          {props.rows.map((row) => (
            <VStack key={row.key} alignment="leading" spacing={isSmall ? 3 : 5}>
              <Text
                modifiers={[
                  font({ size: 11, weight: 'medium' }),
                  foregroundStyle(palette.secondary),
                  lineLimit(1),
                ]}
              >
                {row.label}
              </Text>
              {isSmall ? grid(row.levels, row.key) : strip(row.levels, row.key, 20)}
            </VStack>
          ))}
        </VStack>
        <Spacer minLength={0} />
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
