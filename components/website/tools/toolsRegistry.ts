import websiteRoutes from '@/components/website/websiteRoutes.json';

/**
 * The lifter-facing tools under /tools, in the order the index page lists them. Each one is a
 * route in `websiteRoutes.json` (path, sitemap, llms.txt) with a `website.seo.routes.<routeKey>`
 * title and description in every locale, so a tool's name on the index page, in the related-tools
 * list and in the search result are one piece of copy.
 */
export const TOOLS = [
  { key: 'oneRepMax', routeKey: 'toolOneRepMax', group: 'strength' },
  { key: 'plateCalculator', routeKey: 'toolPlateCalculator', group: 'strength' },
  { key: 'strengthLevel', routeKey: 'toolStrengthLevel', group: 'strength' },
  { key: 'warmUpCalculator', routeKey: 'toolWarmUpCalculator', group: 'strength' },
  { key: 'rpeChart', routeKey: 'toolRpeChart', group: 'training' },
  { key: 'proteinCalculator', routeKey: 'toolProteinCalculator', group: 'nutrition' },
  { key: 'calorieDeficit', routeKey: 'toolCalorieDeficit', group: 'nutrition' },
  { key: 'netCarbs', routeKey: 'toolNetCarbs', group: 'nutrition' },
  { key: 'progressiveOverload', routeKey: 'toolProgressiveOverload', group: 'training' },
  { key: 'deloadCalculator', routeKey: 'toolDeloadCalculator', group: 'training' },
  { key: 'workoutLogTemplate', routeKey: 'toolWorkoutLogTemplate', group: 'training' },
  { key: 'nutritionLogTemplate', routeKey: 'toolNutritionLogTemplate', group: 'nutrition' },
] as const;

/** How the index page sorts the tools: by what the lifter is trying to do, not by file name. */
export const TOOL_GROUPS = ['strength', 'training', 'nutrition'] as const;
export type ToolGroup = (typeof TOOL_GROUPS)[number];

export type ToolKey = (typeof TOOLS)[number]['key'];
export type ToolRouteKey = (typeof TOOLS)[number]['routeKey'];

export function toolPath(key: ToolKey): string {
  const tool = TOOLS.find((entry) => entry.key === key)!;
  return websiteRoutes[tool.routeKey].path;
}

/** `Title | Musclog` becomes `Title`: the site name belongs in the tab, not on a card. */
export function stripSiteName(title: string): string {
  return title.replace(/\s*\|\s*Musclog\s*$/, '');
}
