import type { Locale } from 'date-fns';
import { format, isThisWeek, isToday, isYesterday } from 'date-fns';
import type { TFunction } from 'i18next';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ChatService } from '../database/services';
import { useDateFnsLocale } from './useDateFnsLocale';
import { useTheme } from './useTheme';

export type ChatMessageDataDisplayItem = {
  id: string;
  name: string; // sender label: "You" | "Loggy"
  messageText: string; // truncated message preview
  icon: string; // MaterialIcons name
  iconColor: string;
  iconBgColor: string;
  isFavorite?: boolean;
};

export type ChatMessageDataDayGroup = {
  date: string;
  dateTimestamp: number;
  items: ChatMessageDataDisplayItem[];
};

const BATCH_SIZE = 30;
const PREVIEW_LENGTH = 80;

function formatRelativeDate(timestamp: number, t: TFunction, locale: Locale): string {
  const date = new Date(timestamp);
  if (isToday(date)) {
    return t('common.today');
  }
  if (isYesterday(date)) {
    return t('common.yesterday');
  }
  if (isThisWeek(date)) {
    return format(date, 'EEEE', { locale });
  }
  return format(date, 'MMM d', { locale });
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength) + '…';
}

function groupByDate(
  items: { item: ChatMessageDataDisplayItem; dateTimestamp: number }[],
  t: TFunction,
  locale: Locale
): ChatMessageDataDayGroup[] {
  const groupMap = new Map<number, ChatMessageDataDisplayItem[]>();

  items.forEach(({ item, dateTimestamp }) => {
    if (!groupMap.has(dateTimestamp)) {
      groupMap.set(dateTimestamp, []);
    }
    groupMap.get(dateTimestamp)!.push(item);
  });

  return Array.from(groupMap.entries())
    .map(([dateTimestamp, groupItems]) => ({
      date: formatRelativeDate(dateTimestamp, t, locale),
      dateTimestamp,
      items: groupItems,
    }))
    .sort((a, b) => b.dateTimestamp - a.dateTimestamp);
}

function mergeIntoDayGroups(
  existing: ChatMessageDataDayGroup[],
  newItemsWithDates: { item: ChatMessageDataDisplayItem; dateTimestamp: number }[],
  t: TFunction,
  locale: Locale
): ChatMessageDataDayGroup[] {
  const groupMap = new Map<number, ChatMessageDataDisplayItem[]>();
  const existingIds = new Set<string>();

  existing.forEach((g) => {
    groupMap.set(g.dateTimestamp, [...g.items]);
    g.items.forEach((i) => existingIds.add(i.id));
  });

  newItemsWithDates.forEach(({ item, dateTimestamp }) => {
    if (existingIds.has(item.id)) {
      return;
    }
    existingIds.add(item.id);
    if (!groupMap.has(dateTimestamp)) {
      groupMap.set(dateTimestamp, []);
    }
    groupMap.get(dateTimestamp)!.push(item);
  });

  return Array.from(groupMap.entries())
    .map(([dateTimestamp, groupItems]) => ({
      date: formatRelativeDate(dateTimestamp, t, locale),
      dateTimestamp,
      items: groupItems,
    }))
    .sort((a, b) => b.dateTimestamp - a.dateTimestamp);
}

function filterBySearch(
  groups: ChatMessageDataDayGroup[],
  searchQuery: string
): ChatMessageDataDayGroup[] {
  if (!searchQuery.trim()) {
    return groups;
  }
  const q = searchQuery.toLowerCase().trim();
  return groups
    .map((g) => ({
      ...g,
      items: g.items.filter(
        (item) => item.messageText.toLowerCase().includes(q) || item.name.toLowerCase().includes(q)
      ),
    }))
    .filter((g) => g.items.length > 0);
}

export interface UseChatMessageDataLogsParams {
  visible?: boolean;
  batchSize?: number;
  searchQuery?: string;
}

export interface UseChatMessageDataLogsResult {
  dayGroups: ChatMessageDataDayGroup[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useChatMessageDataLogs({
  visible = true,
  batchSize = BATCH_SIZE,
  searchQuery = '',
}: UseChatMessageDataLogsParams = {}): UseChatMessageDataLogsResult {
  const theme = useTheme();
  const { t } = useTranslation();
  const dateFnsLocale = useDateFnsLocale();

  const userColor = useMemo(
    () => ({ color: theme.colors.accent.primary, bg: theme.colors.accent.primary10 }),
    [theme]
  );
  const coachColor = useMemo(
    () => ({ color: theme.colors.status.info, bg: theme.colors.status.info10 }),
    [theme]
  );

  const [dayGroups, setDayGroups] = useState<ChatMessageDataDayGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);

  const toDisplayItem = useCallback(
    (record: { id: string; sender: string; message: string }): ChatMessageDataDisplayItem => {
      const isUser = record.sender === 'user';
      const colors = isUser ? userColor : coachColor;
      return {
        id: record.id,
        name: isUser ? t('coach.you') : t('coach.name'),
        messageText: truncate(record.message, PREVIEW_LENGTH),
        icon: isUser ? 'person' : 'smart-toy',
        iconColor: colors.color,
        iconBgColor: colors.bg,
      };
    },
    [t, userColor, coachColor]
  );

  const loadInitial = useCallback(async () => {
    if (!visible) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setOffset(0);

    try {
      const records = await ChatService.getAllMessages(batchSize, 0);
      const itemsWithDates = records.map((r) => ({
        item: toDisplayItem(r),
        dateTimestamp: new Date(r.createdAt).setUTCHours(0, 0, 0, 0),
      }));
      setDayGroups(groupByDate(itemsWithDates, t, dateFnsLocale));
      setHasMore(records.length === batchSize);
      setOffset(records.length);
    } catch (err) {
      console.error('[useChatMessageDataLogs] loadInitial error:', err);
      setDayGroups([]);
      setHasMore(false);
    } finally {
      setIsLoading(false);
    }
  }, [visible, batchSize, t, toDisplayItem, dateFnsLocale]);

  const loadMore = useCallback(async () => {
    if (!visible || isLoadingMore || !hasMore) {
      return;
    }

    setIsLoadingMore(true);

    try {
      const records = await ChatService.getAllMessages(batchSize, offset);
      if (records.length === 0) {
        setHasMore(false);
        return;
      }

      const itemsWithDates = records.map((r) => ({
        item: toDisplayItem(r),
        dateTimestamp: new Date(r.createdAt).setUTCHours(0, 0, 0, 0),
      }));

      setDayGroups((prev) => mergeIntoDayGroups(prev, itemsWithDates, t, dateFnsLocale));
      setHasMore(records.length === batchSize);
      setOffset((prev) => prev + records.length);
    } catch (err) {
      console.error('[useChatMessageDataLogs] loadMore error:', err);
      setHasMore(false);
    } finally {
      setIsLoadingMore(false);
    }
  }, [visible, isLoadingMore, hasMore, offset, batchSize, t, toDisplayItem, dateFnsLocale]);

  const refresh = useCallback(async () => {
    if (isLoading) {
      return;
    }
    await loadInitial();
  }, [loadInitial, isLoading]);

  useEffect(() => {
    if (!visible) {
      return;
    }
    loadInitial();
  }, [visible, loadInitial]);

  const filteredGroups = useMemo(
    () => filterBySearch(dayGroups, searchQuery),
    [dayGroups, searchQuery]
  );

  return {
    dayGroups: filteredGroups,
    isLoading,
    isLoadingMore,
    hasMore,
    loadMore,
    refresh,
  };
}
