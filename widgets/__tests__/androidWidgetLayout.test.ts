import { INITIAL_CYCLE_SNAPSHOT } from '../cycleWidgetSnapshot';
import { INITIAL_CAMERA_SNAPSHOT, INITIAL_NUTRITION_SNAPSHOT } from '../widgetSnapshot';

type Node = { name: string; props: Record<string, unknown>; children: Node[] };

// The Android widget runtime (expo-widgets' ExpoWidgetEmittableTree) converts only these views and
// silently ignores any other modifier, so a layout that leans on one renders differently than written.
const SUPPORTED_VIEWS = new Set([
  'Box',
  'Button',
  'Column',
  'Image',
  'LinearProgressIndicator',
  'Row',
  'Spacer',
  'Text',
]);
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

  return Object.fromEntries(
    ['Box', 'Button', 'Column', 'Image', 'LinearProgressIndicator', 'Row', 'Spacer', 'Text'].map(
      (name) => [name, view(name)]
    )
  );
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
} as const;

const palette = INITIAL_NUTRITION_SNAPSHOT.palette;
const nutrition = {
  ...INITIAL_NUTRITION_SNAPSHOT,
  hasGoal: true,
  calories: '1,300',
  calorieTarget: '/ 2,500 kcal',
  calorieProgress: 0.52,
  message: '',
  macros: [
    { label: 'Protein', value: '132 g', progress: 0.7, color: palette.protein },
    { label: 'Carbs', value: '99 g', progress: 0.3, color: palette.carbs },
    { label: 'Fat', value: '34 g', progress: 0.4, color: palette.fat },
  ],
};
const cases: [string, keyof typeof layouts, object][] = [
  ['nutrition with data', 'Nutrition', nutrition],
  ['nutrition without data', 'Nutrition', INITIAL_NUTRITION_SNAPSHOT],
  ['camera with artwork', 'SmartCamera', { ...INITIAL_CAMERA_SNAPSHOT, imageUri: 'file:///a.png' }],
  ['camera without artwork', 'SmartCamera', INITIAL_CAMERA_SNAPSHOT],
  ['cycle private', 'Cycle', INITIAL_CYCLE_SNAPSHOT],
  [
    'cycle with a day count',
    'Cycle',
    { ...INITIAL_CYCLE_SNAPSHOT, title: 'Cycle', value: '12', caption: 'Day', detail: 'Oct 28' },
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

  it('keeps the 4x1 nutrition row narrow enough for small phones', () => {
    const root = layouts.Nutrition()(nutrition);
    const row = root.children[0];
    const widthOf = (node: Node): number => {
      const modifiers = (node.props.modifiers ?? []) as { $type: string; width?: number }[];
      const fixed = modifiers.find((modifier) => modifier.$type === 'width');
      if (fixed?.width != null) {
        return fixed.width;
      }

      return node.children.reduce((sum, child) => sum + widthOf(child), 0);
    };
    const padding = ((row.props.modifiers ?? []) as { $type: string; all?: number }[]).find(
      (modifier) => modifier.$type === 'paddingAll'
    )?.all;

    expect(widthOf(row) + 2 * (padding ?? 0)).toBeLessThanOrEqual(280);
  });
});
