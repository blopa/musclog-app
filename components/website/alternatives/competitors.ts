/**
 * The competitor comparison pages (/alternatives/<id>). Only language-independent data lives here:
 * the app's proper name, the date its facts were last checked and, for each fact row, the page
 * the claim comes from. The wording is in `websiteAlternativesPages.json`, where `apps.<id>.facts`
 * has one entry per source below, in the same order (a test pins the counts).
 *
 * Rules for a row: the competitor's column states only what the linked page says, as of
 * `checkedOn`; free-tier limits change, so the date is shown on the page and the numbers must be
 * re-checked before `checkedOn` is moved forward. The Musclog column states only what the app does.
 * Google Play's metadata policy forbids this kind of comparison in the store listing, never on our
 * own site.
 */
export const COMPETITORS = [
  {
    id: 'strong',
    routeKey: 'alternativesStrong',
    name: 'Strong',
    checkedOn: '2026-11-14',
    sources: [
      'https://apps.apple.com/app/strong/id464254577',
      'https://apps.apple.com/app/strong/id464254577',
    ],
    hasImport: true,
  },
  {
    id: 'hevy',
    routeKey: 'alternativesHevy',
    name: 'Hevy',
    checkedOn: '2026-11-14',
    sources: [
      'https://help.hevyapp.com/hc/en-us/articles/35119778922263-Hevy-Pro-Subscription-How-to-get-Pro-and-What-Does-It-Include',
      'https://help.hevyapp.com/hc/en-us/articles/35119778922263-Hevy-Pro-Subscription-How-to-get-Pro-and-What-Does-It-Include',
      'https://help.hevyapp.com/hc/en-us/articles/35119778922263-Hevy-Pro-Subscription-How-to-get-Pro-and-What-Does-It-Include',
    ],
    hasImport: true,
  },
  {
    id: 'myFitnessPal',
    routeKey: 'alternativesMyFitnessPal',
    name: 'MyFitnessPal',
    checkedOn: '2026-11-14',
    sources: [
      'https://blog.myfitnesspal.com/barcode-scan-moving-to-myfitnesspal-premium/',
      'https://support.myfitnesspal.com/hc/en-us/articles/360032624771-How-to-use-the-Barcode-Scanner',
    ],
    hasImport: false,
  },
] as const;

export type CompetitorId = (typeof COMPETITORS)[number]['id'];
