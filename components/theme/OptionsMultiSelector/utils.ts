import { LucideIcon } from 'lucide-react-native';
import { ComponentType } from 'react';

import { Theme } from '../../../theme';

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
  if (!item?.groupId) {
    return 'none';
  }

  const prevItem = index > 0 ? options[index - 1] : null;
  const nextItem = index < options.length - 1 ? options[index + 1] : null;

  const hasPrevInGroup = prevItem?.groupId === item.groupId;
  const hasNextInGroup = nextItem?.groupId === item.groupId;

  if (!hasPrevInGroup && !hasNextInGroup) {
    return 'only';
  }
  if (!hasPrevInGroup && hasNextInGroup) {
    return 'first';
  }
  if (hasPrevInGroup && !hasNextInGroup) {
    return 'last';
  }
  return 'middle';
}

// 14 distinct colors for exercise groups
const getGroupColors = (theme: Theme) => {
  return [
    theme.colors.accent.primary,
    theme.colors.status.purple,
    theme.colors.status.indigo,
    theme.colors.status.info,
    theme.colors.status.amber,
    theme.colors.status.warning,
    theme.colors.status.error,
    theme.colors.status.pink500,
    theme.colors.status.rose600,
    theme.colors.status.emerald,
    theme.colors.status.yellow,
    theme.colors.status.teal400,
    theme.colors.status.violet500,
    theme.colors.status.purple400,
  ] as const;
};

// Helper to get a consistent color for each group
// This function assigns colors to groups based on their first appearance order
// ensuring each group gets a unique color from the 14 available colors
export function getGroupColor(
  groupId: string | undefined,
  theme: Theme,
  allOptions?: { groupId?: string }[]
): string {
  if (!groupId) {
    return theme.colors.accent.primary;
  }

  const groupColors = getGroupColors(theme);

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
      return groupColors[colorIndex % groupColors.length];
    }
  }

  // Fallback: use hash for backward compatibility or when allOptions not provided
  const hash = groupId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return groupColors[hash % groupColors.length];
}
