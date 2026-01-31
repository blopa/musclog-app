import { LucideIcon } from 'lucide-react-native';
import { theme } from '../../../theme';
import { ComponentType } from 'react';

// Helper to determine an item's position within its group
export type GroupPosition = 'none' | 'first' | 'middle' | 'last' | 'only';

export type SelectorOption<T extends string | number> = {
  id: T;
  label: string;
  description: string;
  icon: LucideIcon | ComponentType<{ size: number; color: string }>;
  iconBgColor: string;
  iconColor: string;
  groupId?: string;
};

// Helper to ensure items with the same groupId are contiguous
export function normalizeGroups<T extends string | number>(
  options: SelectorOption<T>[]
): SelectorOption<T>[] {
  const result: SelectorOption<T>[] = [];
  const processedGroupIds = new Set<string>();

  for (const option of options) {
    // If no groupId, just add it
    if (!option.groupId) {
      result.push(option);
      continue;
    }

    // If we've already processed this group, skip (it was added when we first encountered it)
    if (processedGroupIds.has(option.groupId)) {
      continue;
    }

    // First time encountering this group - add all members of the group together
    processedGroupIds.add(option.groupId);
    const groupMembers = options.filter((o) => o.groupId === option.groupId);
    result.push(...groupMembers);
  }

  return result;
}

export function getGroupPosition<T extends string | number>(
  options: SelectorOption<T>[],
  index: number
): GroupPosition {
  const item = options[index];
  if (!item?.groupId) return 'none';

  const prevItem = index > 0 ? options[index - 1] : null;
  const nextItem = index < options.length - 1 ? options[index + 1] : null;

  const hasPrevInGroup = prevItem?.groupId === item.groupId;
  const hasNextInGroup = nextItem?.groupId === item.groupId;

  if (!hasPrevInGroup && !hasNextInGroup) return 'only';
  if (!hasPrevInGroup && hasNextInGroup) return 'first';
  if (hasPrevInGroup && !hasNextInGroup) return 'last';
  return 'middle';
}

// 14 distinct colors for exercise groups
const GROUP_COLORS = [
  theme.colors.accent.primary, // Green - #22c55e
  theme.colors.status.purple, // Purple - #a855f7
  theme.colors.status.indigo, // Indigo - #6366f1
  theme.colors.status.info, // Blue - #3b82f6
  theme.colors.status.amber, // Amber - #fbbf24
  theme.colors.status.warning, // Orange - #f97316
  theme.colors.status.error, // Red - #ef4444
  theme.colors.status.pink500, // Pink - #ec4899
  theme.colors.status.rose600, // Rose - #e11d48
  theme.colors.status.emerald, // Emerald - #10b981
  theme.colors.status.yellow, // Yellow - #eab308
  theme.colors.status.teal400, // Teal - #2dd4bf
  theme.colors.status.violet500, // Violet - #8b5cf6
  theme.colors.status.purple400, // Purple-400 - #a78bfa
] as const;

// Helper to get a consistent color for each group
// This function assigns colors to groups based on their first appearance order
// ensuring each group gets a unique color from the 14 available colors
export function getGroupColor(
  groupId: string | undefined,
  allOptions?: { groupId?: string }[]
): string {
  if (!groupId) return theme.colors.accent.primary;

  // If we have all options, assign colors based on unique groupId order
  if (allOptions) {
    const uniqueGroupIds = new Set<string>();

    // Extract all unique groupIds
    for (const option of allOptions) {
      if (option.groupId) {
        uniqueGroupIds.add(option.groupId);
      }
    }

    // Sort groupIds alphabetically for stable color assignment
    // This ensures the same set of groups always get the same colors
    // regardless of their order in the list
    const sortedGroupIds = Array.from(uniqueGroupIds).sort();

    // Find the index of this groupId in the sorted list
    const colorIndex = sortedGroupIds.indexOf(groupId);
    if (colorIndex !== -1) {
      return GROUP_COLORS[colorIndex % GROUP_COLORS.length];
    }
  }

  // Fallback: use hash for backward compatibility or when allOptions not provided
  const hash = groupId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return GROUP_COLORS[hash % GROUP_COLORS.length];
}
