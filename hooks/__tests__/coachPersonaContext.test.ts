/**
 * @jest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { Subject } from 'rxjs';

import { CoachPersonaProvider, useCoachPersona } from '@/context/CoachPersonaContext';
import { SettingsService } from '@/database/services/SettingsService';

let mockSettings: { coachPersona: string; aiProvider: string | null };
const mockSubject = new Subject<{ name: string; voice: string; avatar: string }>();

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => `t(${key})` }) }));
jest.mock('@/hooks/useSettings', () => ({ useSettings: () => mockSettings }));
jest.mock('@/components/coach/coachPersonaAvatars', () => ({
  coachAvatarSource: (id: string, custom = '') => ({ id, custom }),
}));
jest.mock('@/database/services/SettingsService', () => ({
  SettingsService: { observe: jest.fn(() => mockSubject) },
}));

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(CoachPersonaProvider, null, children);

beforeEach(() => {
  jest.clearAllMocks();
  mockSettings = { coachPersona: 'loggy', aiProvider: 'gemini' };
});

describe('CoachPersonaProvider', () => {
  it('opens ONE subscription however many components read the coach', () => {
    const { unmount } = renderHook(
      () => [useCoachPersona(), useCoachPersona(), useCoachPersona()],
      { wrapper }
    );

    expect(SettingsService.observe).toHaveBeenCalledTimes(1);
    expect(mockSubject.observed).toBe(true);

    unmount();
    expect(mockSubject.observed).toBe(false);
  });

  it('shows a preset under its translated name', () => {
    mockSettings = { coachPersona: 'sherlock', aiProvider: 'openai' };

    const { result } = renderHook(() => useCoachPersona(), { wrapper });

    expect(result.current).toMatchObject({
      id: 'sherlock',
      name: 't(coach.personas.sherlock.name)',
      selectedId: 'sherlock',
      canChoose: true,
    });
  });

  it('follows the custom persona as it is written, and falls back while it is unfinished', () => {
    mockSettings = { coachPersona: 'custom', aiProvider: 'gemini' };
    const { result } = renderHook(() => useCoachPersona(), { wrapper });

    expect(result.current).toMatchObject({ id: 'loggy', selectedId: 'custom' });

    act(() =>
      mockSubject.next({ name: 'Atlas', voice: 'Calm.', avatar: 'data:image/png;base64,AA' })
    );

    expect(result.current).toMatchObject({
      id: 'custom',
      name: 'Atlas',
      avatarSource: { id: 'custom', custom: 'data:image/png;base64,AA' },
    });
  });

  it('is Loggy and not choosable on on-device AI', () => {
    mockSettings = { coachPersona: 'dracula', aiProvider: 'on-device' };

    const { result } = renderHook(() => useCoachPersona(), { wrapper });

    expect(result.current).toMatchObject({ id: 'loggy', selectedId: 'dracula', canChoose: false });
  });

  it('refuses to be read outside its provider', () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => renderHook(() => useCoachPersona())).toThrow(/CoachPersonaProvider/);
    error.mockRestore();
  });
});
