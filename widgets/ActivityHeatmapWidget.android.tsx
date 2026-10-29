import { Box, Button, Column, Row, Spacer, Text } from '@expo/ui/jetpack-compose';
import {
  background,
  cornerRadius,
  fillMaxSize,
  height,
  padding,
  paddingAll,
  size,
  width,
} from '@expo/ui/jetpack-compose/modifiers';
import { createWidget } from 'expo-widgets';

import { type ActivityWidgetSnapshot, INITIAL_ACTIVITY_SNAPSHOT } from './activityWidgetSnapshot';

// Two rows of squares, one per source. The widget runtime has no weights and no gap arrangement,
// so a square is a fixed-size Box followed by a Spacer: 30 squares at 5dp + 2dp are 210dp, which
// fits the narrowest 4-cell footprint (250dp less 12dp of padding a side), and the two rows plus
// the title fit its 110dp height. Glance containers take at most 10 children, so each row is six
// groups of five squares (five Boxes and five Spacers), never thirty loose ones. The root must
// stay a Button: it is the interaction target the native provider turns into the deep link.
function ActivityHeatmapWidget(props: ActivityWidgetSnapshot) {
  'widget';
  const { palette } = props;
  const groupSize = 5;

  const squares = (levels: number[], rowKey: string) => {
    const groups: number[][] = [];
    for (let start = 0; start < levels.length; start += groupSize) {
      groups.push(levels.slice(start, start + groupSize));
    }

    return (
      <Row verticalAlignment="center">
        {groups.map((group, groupIndex) => (
          <Row key={`${rowKey}-${groupIndex}`} verticalAlignment="center">
            {group.flatMap((level, index) => [
              <Box
                key={`${rowKey}-${groupIndex}-${index}`}
                modifiers={[size(5, 14), background(props.levelColors[level]), cornerRadius(2)]}
              />,
              <Spacer key={`${rowKey}-${groupIndex}-${index}-gap`} modifiers={[width(2)]} />,
            ])}
          </Row>
        ))}
      </Row>
    );
  };

  return (
    <Button
      colors={{ containerColor: palette.background, contentColor: palette.text }}
      modifiers={[fillMaxSize(), cornerRadius(24)]}
    >
      {props.state === 'stale' ? (
        <Column
          verticalArrangement="center"
          horizontalAlignment="start"
          modifiers={[fillMaxSize(), paddingAll(16)]}
        >
          <Text style={{ fontSize: 12, fontWeight: 'bold' }} color={palette.accent}>
            {props.title}
          </Text>
          <Spacer modifiers={[height(6)]} />
          <Text style={{ fontSize: 15, fontWeight: 'bold' }} color={palette.text}>
            {props.refreshMessage}
          </Text>
        </Column>
      ) : (
        <Column
          verticalArrangement="center"
          horizontalAlignment="start"
          modifiers={[fillMaxSize(), padding(12, 10, 12, 10)]}
        >
          <Text style={{ fontSize: 11, fontWeight: 'bold' }} color={palette.accent}>
            {props.title}
          </Text>
          {props.rows.map((row) => (
            <Column key={row.key} horizontalAlignment="start">
              <Spacer modifiers={[height(6)]} />
              <Text style={{ fontSize: 10 }} color={palette.secondary} maxLines={1}>
                {row.label}
              </Text>
              <Spacer modifiers={[height(2)]} />
              {squares(row.levels, row.key)}
            </Column>
          ))}
        </Column>
      )}
    </Button>
  );
}

export default createWidget('ActivityHeatmap', ActivityHeatmapWidget, INITIAL_ACTIVITY_SNAPSHOT);
