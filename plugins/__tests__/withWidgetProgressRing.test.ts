import { readFileSync } from 'fs';
import { join } from 'path';

const { RESOURCES, progressRingDrawable } = require('../withWidgetProgressRing') as {
  RESOURCES: Record<string, () => string>;
  progressRingDrawable: () => string;
};

const root = join(__dirname, '../..');

it('overrides the peek-glance ring with a thin one that starts at 12 o’clock', () => {
  const drawable = progressRingDrawable();
  const ratio = (name: string) =>
    [...drawable.matchAll(new RegExp(`android:${name}="([\\d.]+)"`, 'g'))].map((match) =>
      Number(match[1])
    );

  expect(drawable).toContain('android:id="@android:id/background"');
  expect(drawable).toContain('android:id="@android:id/progress"');
  expect(drawable).toContain('android:fromDegrees="-90"');
  expect(drawable).toContain('android:toDegrees="-90"');
  // Track and progress are the same ring, and its outer edge touches the box.
  const [inner, innerProgress] = ratio('innerRadiusRatio');
  const [thickness, thicknessProgress] = ratio('thicknessRatio');
  expect(innerProgress).toBe(inner);
  expect(thicknessProgress).toBe(thickness);
  expect(2 / inner + 2 / thickness).toBeCloseTo(1);
});

it('lets the ring fill the box Glance sizes, keeping the view id peek-glance addresses', () => {
  const layout = Object.entries(RESOURCES).find(([file]) => file.includes('/layout/'))![1]();

  expect(layout).toContain('android:id="@+id/peek_progress"');
  expect(layout).toContain('android:layout_width="match_parent"');
  expect(layout).toContain('android:layout_height="match_parent"');
});

it.each(Object.entries(RESOURCES))('%s is committed to the native project', (file, render) => {
  expect(readFileSync(join(root, 'android/app', file), 'utf8')).toBe(render());
});
