/** @jest-environment jsdom */
import { act, render, screen } from '@testing-library/react';
import { createElement } from 'react';

import Open from '@/app/(website)/open.web';
import { buildOpenSchemeUrl, OPEN_FORWARD_SECONDS } from '@/utils/openLink';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en-US', resolvedLanguage: 'en-US' },
    t: (key: string, options?: { seconds?: string }) =>
      options?.seconds === undefined ? key : `${key}:${options.seconds}`,
  }),
}));
jest.mock('@/components/website/WebsiteLoggy', () => ({ WebsiteLoggy: () => null }));
jest.mock('@/components/website/websiteMetadata', () => ({ fixedPageMetadata: jest.fn() }));

const WORKOUT = { kind: 'workout' as const, payload: '{"name":"Push (A)"}' };

/**
 * jsdom cannot navigate (`window.location.assign` is unforgeable, so it cannot be spied on) and
 * reports an attempt to leave the page as a "Not implemented: navigation" error instead. That
 * report is how a forward shows up here.
 */
function navigationAttempts(consoleError: jest.SpyInstance): number {
  return consoleError.mock.calls.filter(([error]) =>
    String(error?.message ?? error).includes('Not implemented: navigation')
  ).length;
}

function visit(hash: string) {
  window.history.replaceState(null, '', `/open${hash}`);
}

describe('the /open bridge page', () => {
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 10, 7, 12, 0, 0, 0));
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
    visit('');
  });

  it('counts down from the configured seconds before forwarding', () => {
    visit(`#workout=${encodeURIComponent(WORKOUT.payload)}`);
    render(createElement(Open));

    expect(screen.getByText(`countdown:${OPEN_FORWARD_SECONDS}`)).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(2_000);
    });
    expect(screen.getByText(`countdown:${OPEN_FORWARD_SECONDS - 2}`)).toBeTruthy();
  });

  it('forwards to the app by itself, once, when the countdown ends', () => {
    visit(`#workout=${encodeURIComponent(WORKOUT.payload)}`);
    render(createElement(Open));

    act(() => {
      jest.advanceTimersByTime(OPEN_FORWARD_SECONDS * 1_000 - 250);
    });
    expect(navigationAttempts(consoleError)).toBe(0);

    act(() => {
      jest.advanceTimersByTime(OPEN_FORWARD_SECONDS * 1_000);
    });
    expect(navigationAttempts(consoleError)).toBe(1);
  });

  it('says the app was asked to open once the countdown ends, and keeps the button', () => {
    visit(`#workout=${encodeURIComponent(WORKOUT.payload)}`);
    render(createElement(Open));

    act(() => {
      jest.advanceTimersByTime(OPEN_FORWARD_SECONDS * 1_000);
    });

    expect(screen.getByText('forwarded')).toBeTruthy();
    expect(screen.getByText('openButton').closest('a')?.getAttribute('href')).toBe(
      buildOpenSchemeUrl(WORKOUT)
    );
  });

  it('removes the payload from the address bar but still forwards it', () => {
    visit(`#workout=${encodeURIComponent(WORKOUT.payload)}`);
    render(createElement(Open));

    expect(window.location.hash).toBe('');
    expect(screen.getByText('openButton').closest('a')?.getAttribute('href')).toBe(
      buildOpenSchemeUrl(WORKOUT)
    );
  });

  it('has nothing to forward, and no countdown or button, without a payload', () => {
    visit('');
    render(createElement(Open));

    act(() => {
      jest.advanceTimersByTime(OPEN_FORWARD_SECONDS * 2_000);
    });

    expect(navigationAttempts(consoleError)).toBe(0);
    expect(screen.getByText('descriptionEmpty')).toBeTruthy();
    expect(screen.queryByText(/^countdown/)).toBeNull();
    expect(screen.queryByText('forwarded')).toBeNull();
    expect(screen.queryByText('openButton')).toBeNull();
  });
});
