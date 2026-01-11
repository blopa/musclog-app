import { LucideIcon } from 'lucide-react-native';
import { theme } from '../../theme';

// Helper to determine an item's position within its group
export type GroupPosition = 'none' | 'first' | 'middle' | 'last' | 'only';

export type SelectorOption<T extends string | number> = {
  id: T;
  label: string;
  description: string;
  icon: LucideIcon | React.ComponentType<{ size: number; color: string }>;
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

// Helper to get a consistent color for each group
export function getGroupColor(groupId: string | undefined): string {
  if (!groupId) return theme.colors.accent.primary;

  // Simple hash to consistently pick a color for a groupId
  const colors = [
    theme.colors.accent.primary,
    theme.colors.status.purple,
    theme.colors.status.indigo,
    '#10B981', // emerald green
    '#F59E0B', // amber
    '#EF4444', // red
  ];

  const hash = groupId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
}
