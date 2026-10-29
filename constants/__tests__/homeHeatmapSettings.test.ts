import { SETTINGS } from '@/constants/settingDefinitions';
import {
  availableHeatmapLayouts,
  effectiveHeatmapLayout,
  HOME_HEATMAP_LAYOUT_OPTIONS,
  homeHeatmapSources,
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

  it('keeps the picker order: none, each source, then both', () => {
    expect(HOME_HEATMAPS_OPTIONS).toEqual(['none', 'workouts', 'nutrition', 'both']);
  });

  it('maps a choice to the heatmaps it shows', () => {
    expect(homeHeatmapSources('none')).toEqual([]);
    expect(homeHeatmapSources('workouts')).toEqual(['workouts']);
    expect(homeHeatmapSources('nutrition')).toEqual(['nutrition']);
    expect(homeHeatmapSources('both')).toEqual(['workouts', 'nutrition']);
  });

  it('draws side by side only for two heatmaps, and a lone one full width', () => {
    expect(effectiveHeatmapLayout('side_by_side', 'both')).toBe('side_by_side');
    expect(effectiveHeatmapLayout('side_by_side', 'workouts')).toBe('full');
    expect(effectiveHeatmapLayout('compact', 'workouts')).toBe('compact');
    expect(effectiveHeatmapLayout('full', 'both')).toBe('full');
  });

  it('offers side by side in the picker only for two heatmaps', () => {
    expect(availableHeatmapLayouts('both')).toEqual(['full', 'side_by_side', 'compact']);
    expect(availableHeatmapLayouts('nutrition')).toEqual(['full', 'compact']);
  });
});
