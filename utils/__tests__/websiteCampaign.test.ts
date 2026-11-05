/** @jest-environment jsdom */
import { captureCampaign, getCampaign, withPlayReferrer } from '../websiteAnalytics.web';

const PLAY = 'https://play.google.com/store/apps/details?id=com.werules.logger';

describe('website campaign attribution', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  it('leaves the Play URL alone without a campaign', () => {
    captureCampaign();

    expect(withPlayReferrer(PLAY)).toBe(PLAY);
  });

  it('remembers utm tags from the landing URL and adds them as the install referrer', () => {
    window.history.replaceState({}, '', '/?utm_source=reddit&utm_medium=post&utm_campaign=launch');
    captureCampaign();

    expect(getCampaign()).toEqual({
      utm_source: 'reddit',
      utm_medium: 'post',
      utm_campaign: 'launch',
    });
    expect(withPlayReferrer(PLAY)).toBe(
      `${PLAY}&referrer=${encodeURIComponent('utm_source=reddit&utm_medium=post&utm_campaign=launch')}`
    );
  });

  it('keeps the first touch and ignores unrelated query params', () => {
    window.history.replaceState({}, '', '/?utm_source=reddit&foo=bar');
    captureCampaign();
    window.history.replaceState({}, '', '/download?utm_source=x');
    captureCampaign();

    expect(getCampaign()).toEqual({ utm_source: 'reddit' });
  });
});
