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

// A 3×1 strip: a label and a row of squares per source, nothing else (the squares are the content;
// a title row would not fit one cell's height). The widget runtime has no weights and no gap
// arrangement, so a square is a fixed-size Box with a Spacer before every square but the first:
// 30 squares at 4dp with 2dp gaps are 178dp, which with 10dp of padding a side fits the narrowest
// 3-cell footprint (about 200dp). A launcher cell is often wider, so the block is centred rather
// than left-aligned against an empty right half. Glance containers take at most 10 children, so
// each row is six groups of five squares, never thirty loose ones. The root must stay a Button:
// it is the interaction target the native provider turns into the deep link.
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
            {group.flatMap((level, index) => {
              const square = (
                <Box
                  key={`${rowKey}-${groupIndex}-${index}`}
                  modifiers={[size(4, 12), background(props.levelColors[level]), cornerRadius(2)]}
                />
              );
              return groupIndex === 0 && index === 0
                ? [square]
                : [
                    <Spacer key={`${rowKey}-${groupIndex}-${index}-gap`} modifiers={[width(2)]} />,
                    square,
                  ];
            })}
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
          modifiers={[fillMaxSize(), paddingAll(12)]}
        >
          <Text style={{ fontSize: 11, fontWeight: 'bold' }} color={palette.accent}>
            {props.title}
          </Text>
          <Spacer modifiers={[height(2)]} />
          <Text style={{ fontSize: 13, fontWeight: 'bold' }} color={palette.text} maxLines={2}>
            {props.refreshMessage}
          </Text>
        </Column>
      ) : (
        <Column
          verticalArrangement="center"
          horizontalAlignment="center"
          modifiers={[fillMaxSize(), padding(10, 8, 10, 8)]}
        >
          <Column horizontalAlignment="start">
            {props.rows.map((row, rowIndex) => (
              <Column key={row.key} horizontalAlignment="start">
                {rowIndex > 0 ? <Spacer modifiers={[height(6)]} /> : null}
                <Text style={{ fontSize: 10 }} color={palette.secondary} maxLines={1}>
                  {row.label}
                </Text>
                <Spacer modifiers={[height(3)]} />
                {squares(row.levels, row.key)}
              </Column>
            ))}
          </Column>
        </Column>
      )}
    </Button>
  );
}

export default createWidget('ActivityHeatmap', ActivityHeatmapWidget, INITIAL_ACTIVITY_SNAPSHOT);
