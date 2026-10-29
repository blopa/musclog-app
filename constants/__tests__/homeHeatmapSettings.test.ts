import { SETTINGS } from '@/constants/settingDefinitions';
import {
  HOME_HEATMAP_LAYOUT_OPTIONS,
  HOME_HEATMAPS_OPTIONS,
  parseHomeHeatmapLayout,
  parseHomeHeatmaps,
} from '@/constants/settings';

describe('home heatmap settings', () => {
  it('leaves the home screen unchanged until the user opts in', () => {
    expect(SETTINGS.homeHeatmaps.defaultValue).toBe('none');
    expect(SETTINGS.homeHeatmapLayout.defaultValue).toBe('full');
  });

  it('round-trips every offered choice', () => {
    for (const choice of HOME_HEATMAPS_OPTIONS) {
      expect(SETTINGS.homeHeatmaps.parse(SETTINGS.homeHeatmaps.serialize(choice))).toBe(choice);
    }

    for (const layout of HOME_HEATMAP_LAYOUT_OPTIONS) {
      expect(SETTINGS.homeHeatmapLayout.parse(SETTINGS.homeHeatmapLayout.serialize(layout))).toBe(
        layout
      );
    }
  });

  it('offers the compact strip beside the two grid layouts', () => {
    expect(HOME_HEATMAP_LAYOUT_OPTIONS).toEqual(['full', 'side_by_side', 'compact']);
    expect(parseHomeHeatmapLayout('compact')).toBe('compact');
  });

  it('reads anything unknown, as a newer build or a hand-edited backup can leave, as the default', () => {
    expect(parseHomeHeatmaps('everything')).toBe('none');
    expect(parseHomeHeatmaps('')).toBe('none');
    expect(parseHomeHeatmaps(null)).toBe('none');
    expect(parseHomeHeatmapLayout('grid')).toBe('full');
    expect(parseHomeHeatmapLayout(undefined)).toBe('full');
  });
});
