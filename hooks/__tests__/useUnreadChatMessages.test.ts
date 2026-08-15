/**
 * @jest-environment jsdom
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';

import { UNREAD_CHAT_MESSAGES_COUNT } from '@/constants/misc';
import { UnreadChatProvider, useUnreadChat } from '@/context/UnreadChatContext';

// Under jsdom the real module reports a static web export, which makes the provider skip its
// hydration read — exactly the path these tests are about.
jest.mock('@/constants/platform', () => ({ isStaticExport: false }));

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(UnreadChatProvider, null, children);

const renderUnreadChat = () => renderHook(() => useUnreadChat(), { wrapper });

const readStoredCounts = async () =>
  JSON.parse((await AsyncStorage.getItem(UNREAD_CHAT_MESSAGES_COUNT)) ?? 'null');

describe('unread chat counts', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('counts each conversation context separately and totals them', async () => {
    const { result } = renderUnreadChat();

    await act(async () => {
      await result.current.setUnreadCount('exercise', (prev) => prev + 1);
      await result.current.setUnreadCount('nutrition', 2);
    });

    expect(result.current.unreadCountsByContext).toEqual({
      general: 0,
      exercise: 1,
      nutrition: 2,
    });
    expect(result.current.unreadCount).toBe(3);
    expect(await readStoredCounts()).toEqual({ general: 0, exercise: 1, nutrition: 2 });
  });

  it('clears only the context that was read', async () => {
    const { result } = renderUnreadChat();

    await act(async () => {
      await result.current.setUnreadCount('exercise', 1);
      await result.current.setUnreadCount('nutrition', 1);
    });

    await act(async () => {
      await result.current.clearUnreadCount('nutrition');
    });

    expect(result.current.unreadCountsByContext.exercise).toBe(1);
    expect(result.current.unreadCountsByContext.nutrition).toBe(0);
    expect(result.current.unreadCount).toBe(1);
  });

  it('clears every context when called without one', async () => {
    const { result } = renderUnreadChat();

    await act(async () => {
      await result.current.setUnreadCount('general', 4);
      await result.current.setUnreadCount('exercise', 5);
    });

    await act(async () => {
      await result.current.clearUnreadCount();
    });

    expect(result.current.unreadCount).toBe(0);
    expect(await readStoredCounts()).toEqual({ general: 0, exercise: 0, nutrition: 0 });
  });

  it('never goes negative', async () => {
    const { result } = renderUnreadChat();

    await act(async () => {
      await result.current.setUnreadCount('general', (prev) => prev - 1);
    });

    expect(result.current.unreadCountsByContext.general).toBe(0);
  });

  it('reads a legacy bare total as exercise unreads', async () => {
    await AsyncStorage.setItem(UNREAD_CHAT_MESSAGES_COUNT, '3');

    const { result } = renderUnreadChat();

    await waitFor(() => expect(result.current.unreadCount).toBe(3));
    expect(result.current.unreadCountsByContext).toEqual({
      general: 0,
      exercise: 3,
      nutrition: 0,
    });
  });

  it('starts clean when the stored value is unusable', async () => {
    await AsyncStorage.setItem(UNREAD_CHAT_MESSAGES_COUNT, 'not-json');

    const { result } = renderUnreadChat();

    await waitFor(() => expect(result.current.unreadCount).toBe(0));
  });
});
