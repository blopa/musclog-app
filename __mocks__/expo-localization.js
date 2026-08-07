// Manual mock for `expo-localization` — a native module, so its real implementation
// cannot load in Jest. Pinned to a fixed locale/timezone so locale-sensitive assertions
// do not depend on the machine running the tests.

module.exports = {
  getCalendars: () => [
    {
      calendar: 'gregorian',
      timeZone: 'America/New_York',
      uses24HourClock: false,
      firstDayOfWeek: 1,
    },
  ],
  getLocales: () => [{ languageTag: 'en-US', languageCode: 'en', regionCode: 'US' }],
};
