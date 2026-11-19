# SDK 58 verification

`npm run check-widget-bundles` builds and executes both isolated widget runtimes (the iOS half needs `npm run prebuild` on a Mac first, which regenerates the widget target's registry). After `npm run build-android-web`, `npm run test:upgrade:web` checks exported SEO, blog navigation, public controls, and fresh app seeding in Chromium. Set `MUSCLOG_TEST_PORT` when another local test server is already running. The iOS widget extension requires App Groups on both app identifiers and matching signing profiles.
