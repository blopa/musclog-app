import websiteRoutes from '@/components/website/websiteRoutes.json';

/**
 * The lifter-facing tools under /tools, in the order the index page lists them. Each one is a
 * route in `websiteRoutes.json` (path, sitemap, llms.txt) with a `website.seo.routes.<routeKey>`
 * title and description in every locale, so a tool's name on the index page, in the related-tools
 * list and in the search result are one piece of copy.
 */
export const TOOLS = [
  { key: 'oneRepMax', routeKey: 'toolOneRepMax' },
  { key: 'plateCalculator', routeKey: 'toolPlateCalculator' },
  { key: 'strengthLevel', routeKey: 'toolStrengthLevel' },
  { key: 'warmUpCalculator', routeKey: 'toolWarmUpCalculator' },
  { key: 'rpeChart', routeKey: 'toolRpeChart' },
  { key: 'proteinCalculator', routeKey: 'toolProteinCalculator' },
  { key: 'calorieDeficit', routeKey: 'toolCalorieDeficit' },
  { key: 'netCarbs', routeKey: 'toolNetCarbs' },
] as const;

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
