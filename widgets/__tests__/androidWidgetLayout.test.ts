import { buildActivityWidgetSnapshot, INITIAL_ACTIVITY_SNAPSHOT } from '../activityWidgetSnapshot';
import { INITIAL_CYCLE_SNAPSHOT } from '../cycleWidgetSnapshot';
import { INITIAL_CAMERA_SNAPSHOT, INITIAL_NUTRITION_SNAPSHOT } from '../widgetSnapshot';

type Node = { name: string; props: Record<string, unknown>; children: Node[] };

// The Android widget runtime (expo-widgets' ExpoWidgetEmittableTree) converts only these views and
// silently ignores any other modifier, so a layout that leans on one renders differently than written.
const mockSupportedViews = [
  'Box',
  'Button',
  'CircularProgressIndicator',
  'Column',
  'Image',
  'LinearProgressIndicator',
  'Row',
  'Spacer',
  'Text',
];
const SUPPORTED_VIEWS = new Set(mockSupportedViews);
// Glance containers hold at most this many children.
const MAX_CHILDREN = 10;
// The activity widget's declared minWidth in app.json, in dp: the narrowest 3-cell footprint.
const ACTIVITY_MIN_WIDTH_DP = 200;
// The shortest one-cell height a portrait launcher gives a widget, in dp.
const ACTIVITY_MIN_HEIGHT_DP = 80;
// The nutrition widget's declared minWidth in app.json, in dp: the narrowest it can be placed.
const NUTRITION_MIN_WIDTH_DP = 250;
// Room the macro column needs for a label, its value and a readable bar.
const MIN_MACRO_COLUMN_DP = 110;
const SUPPORTED_MODIFIERS = new Set([
  'background',
  'cornerRadius',
  'fillMaxHeight',
  'fillMaxSize',
  'fillMaxWidth',
  'height',
  'padding',
  'paddingAll',
  'size',
  'width',
  'wrapContentHeight',
  'wrapContentWidth',
]);

jest.mock('@expo/ui/jetpack-compose', () => {
  const view =
    (name: string) =>
    ({ children, ...props }: { children?: unknown } & Record<string, unknown>): Node => ({
      name,
      props,
      // Text nodes carry their string content as children; only views are layout nodes.
      children: ([] as unknown[])
        .concat(children ?? [])
        .flat(Infinity)
        .filter((child) => typeof child === 'object' && child !== null) as Node[],
    });

  return Object.fromEntries(mockSupportedViews.map((name) => [name, view(name)]));
});
jest.mock('expo-widgets', () => ({
  createWidget: (_name: string, layout: unknown) => layout,
}));

// expo-widgets' babel plugin replaces each layout function with its source text, which the widget
// runtime evaluates with its own imports in scope; do the same here with the mocked views.
function loadLayout(file: string): (props: object) => Node {
  const source = require(file).default as string;
  const views = jest.requireMock('@expo/ui/jetpack-compose') as Record<string, unknown>;
  const modifiers = jest.requireActual('@expo/ui/jetpack-compose/modifiers') as Record<
    string,
    unknown
  >;
  const scope = { ...views, ...modifiers };
  const jsx = (type: (props: object) => Node, props: object) => type(props);

  return new Function('_jsx', '_jsxs', ...Object.keys(scope), `return (${source});`)(
    jsx,
    jsx,
    ...Object.values(scope)
  );
}

const layouts = {
  Nutrition: () => loadLayout('../NutritionWidget.android'),
  SmartCamera: () => loadLayout('../SmartCameraWidget.android'),
  Cycle: () => loadLayout('../CycleWidget.android'),
  ActivityHeatmap: () => loadLayout('../ActivityHeatmapWidget.android'),
} as const;

const palette = INITIAL_NUTRITION_SNAPSHOT.palette;
const nutrition = {
  ...INITIAL_NUTRITION_SNAPSHOT,
  calories: '1,300',
  calorieTarget: '/ 2,500 kcal',
  calorieProgress: 0.52,
  state: 'ready',
  macros: [
    { label: 'Protein', value: '132 g', progress: 0.7, color: palette.protein },
    { label: 'Carbs', value: '99 g', progress: 0.3, color: palette.carbs },
    { label: 'Fat', value: '34 g', progress: 0.4, color: palette.fat },
  ],
};
const activity = buildActivityWidgetSnapshot({
  date: new Date(2026, 9, 17),
  days: {
    workouts: [{ date: '2026-10-17', value: 1 }],
    nutrition: [{ date: '2026-10-16', value: 3 }],
  },
  palette,
  translate: (key) => key,
});
const cases: [string, keyof typeof layouts, object][] = [
  ['nutrition with data', 'Nutrition', nutrition],
  ['nutrition without data', 'Nutrition', INITIAL_NUTRITION_SNAPSHOT],
  ['camera with artwork', 'SmartCamera', { ...INITIAL_CAMERA_SNAPSHOT, imageUri: 'file:///a.png' }],
  ['camera without artwork', 'SmartCamera', INITIAL_CAMERA_SNAPSHOT],
  ['cycle private', 'Cycle', INITIAL_CYCLE_SNAPSHOT],
  ['activity heatmap with data', 'ActivityHeatmap', activity],
  ['activity heatmap without data', 'ActivityHeatmap', INITIAL_ACTIVITY_SNAPSHOT],
  [
    'cycle with a day count',
    'Cycle',
    {
      ...INITIAL_CYCLE_SNAPSHOT,
      state: 'day',
      title: 'Cycle',
      value: '12',
      caption: 'Day',
      detail: 'Oct 28',
    },
  ],
];

function walk(node: Node, visit: (node: Node) => void) {
  visit(node);
  node.children.forEach((child) => walk(child, visit));
}

describe('Android widget layouts', () => {
  it.each(cases)(
    '%s uses only views and modifiers the widget runtime renders',
    (_label, key, props) => {
      const root = layouts[key]()(props);

      // The native provider turns the first interaction target into the deep link.
      expect(root.name).toBe('Button');
      walk(root, (node) => {
        expect(SUPPORTED_VIEWS.has(node.name)).toBe(true);
        const modifiers = (node.props.modifiers ?? []) as { $type: string }[];
        modifiers.forEach((modifier) => expect(SUPPORTED_MODIFIERS.has(modifier.$type)).toBe(true));
      });
    }
  );

  it('leaves the macro column room to fill on the narrowest 4x2 footprint', () => {
    const root = layouts.Nutrition()(nutrition);
    const row = root.children[0];
    type Modifier = { $type: string; width?: number; all?: number };
    const modifiersOf = (node: Node) => (node.props.modifiers ?? []) as Modifier[];
    const fixedWidth = (node: Node) =>
      modifiersOf(node).find((modifier) => modifier.$type === 'width')?.width;
    const padding = modifiersOf(row).find((modifier) => modifier.$type === 'paddingAll')?.all ?? 0;
    const macroColumn = row.children[row.children.length - 1];
    const fixed = row.children.slice(0, -1).map(fixedWidth);

    // The runtime has no weights: everything before the macro column is a fixed width, and the
    // column, as the last child, takes what is left.
    expect(fixed.every((value) => typeof value === 'number')).toBe(true);
    expect(modifiersOf(macroColumn).some((modifier) => modifier.$type === 'fillMaxWidth')).toBe(
      true
    );
    const used = 2 * padding + (fixed as number[]).reduce((a, b) => a + b, 0);
    expect(NUTRITION_MIN_WIDTH_DP - used).toBeGreaterThanOrEqual(MIN_MACRO_COLUMN_DP);
    expect(macroColumn.children).toHaveLength(nutrition.macros.length);
  });

  it('keeps every container within the child limit and the squares within the narrowest footprint', () => {
    type Modifier = { $type: string; width?: number; height?: number; color?: string };
    const root = layouts.ActivityHeatmap()(activity);
    const modifiersOf = (node: Node) => (node.props.modifiers ?? []) as Modifier[];
    const squares: Node[] = [];
    walk(root, (node) => {
      expect(node.children.length).toBeLessThanOrEqual(MAX_CHILDREN);
      if (node.name === 'Box') {
        squares.push(node);
      }
    });

    // 30 squares for each of the two sources, each a fixed box in a level color.
    expect(squares).toHaveLength(2 * 30);
    const colors = new Set(activity.levelColors);
    const SQUARE = { width: 4, height: 12 };
    for (const square of squares) {
      const size = modifiersOf(square).find((modifier) => modifier.$type === 'size');
      const fill = modifiersOf(square).find((modifier) => modifier.$type === 'background');
      expect(size).toMatchObject(SQUARE);
      expect(colors.has(fill?.color as string)).toBe(true);
    }

    // The runtime has no weights to shrink a row, so its squares and gaps (one between each pair,
    // none trailing) must fit the narrowest footprint.
    const content = root.children[0];
    const padding = modifiersOf(content).find((modifier) => modifier.$type === 'padding') as {
      $type: string;
      start: number;
      end: number;
      top: number;
      bottom: number;
    };
    const strips: Node[] = [];
    walk(content, (node) => {
      if (node.name === 'Row' && node.children.every((child) => child.name === 'Row')) {
        strips.push(node);
      }
    });
    expect(strips).toHaveLength(2);
    for (const strip of strips) {
      let rowWidth = 0;
      walk(strip, (node) => {
        const fixed = modifiersOf(node).find(
          (modifier) => modifier.$type === 'size' || modifier.$type === 'width'
        );
        if (node.name !== 'Row' && fixed) {
          rowWidth += fixed.width as number;
        }
      });
      expect(rowWidth).toBe(30 * SQUARE.width + 29 * 2);
      expect(rowWidth + padding.start + padding.end).toBeLessThanOrEqual(ACTIVITY_MIN_WIDTH_DP);
    }

    // One cell of height: two labels (10sp, about 13dp), their strips and the spacers between.
    let spacers = 0;
    walk(content, (node) => {
      const fixed = modifiersOf(node).find((modifier) => modifier.$type === 'height');
      if (node.name === 'Spacer' && fixed) {
        spacers += fixed.height as number;
      }
    });
    const LABEL_DP = 13;
    const columnHeight = 2 * (LABEL_DP + SQUARE.height) + spacers;
    expect(columnHeight + padding.top + padding.bottom).toBeLessThanOrEqual(ACTIVITY_MIN_HEIGHT_DP);
  });

  it('draws the calories on a ring tinted from the palette', () => {
    const rings: Node[] = [];
    walk(layouts.Nutrition()(nutrition), (node) => {
      if (node.name === 'CircularProgressIndicator') {
        rings.push(node);
      }
    });

    expect(rings).toHaveLength(1);
    expect(rings[0].props).toMatchObject({
      progress: nutrition.calorieProgress,
      color: palette.accent,
      trackColor: palette.track,
    });
  });
});
