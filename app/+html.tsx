import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

/**
 * Root HTML runs only in Node (static render). Use `public/` static files
 * (https://docs.expo.dev/router/web/static-rendering/#static-files). Avoid `public/assets/`.
 *
 * With experiments.baseUrl `/musclog-app`, the frame must be served at
 * `/musclog-app/images/...`. `scripts/sync-web-phone-frame.js` copies from
 * `assets/phone-wrapper.png` into `public/musclog-app/images/` (gitignored).
 */
const PHONE_FRAME_SRC = '/images/phone-wrapper.png';

/** Prefix URLs when `experiments.baseUrl` is set (e.g. `/musclog-app`). */
function withExpoBaseUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }
  const base = process.env.EXPO_BASE_URL;
  if (base == null || base === '') {
    return path;
  }
  const basePath = String(base).replace(/^\/+|\/+$/g, '');
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (normalized === `/${basePath}` || normalized.startsWith(`/${basePath}/`)) {
    return normalized;
  }
  return `/${basePath}${normalized}`;
}

// Web-only: configures the root HTML for every web page during static rendering.
// Only runs in Node.js; has no access to the DOM or browser APIs.
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        {/*
            viewport-fit=cover is required so the browser exposes
            env(safe-area-inset-*) CSS variables. Without it, the
            Android system navigation bar inset is always 0, causing
            bottom-anchored buttons to be clipped behind the nav bar
            when using the app in Chrome on Android.
        */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <ScrollViewStyleReset />
      </head>
      <body className="expo-web-body">
        <div className="expo-web-root">
          <div className="expo-web-app-shell">{children}</div>
          {/* Desktop-only bezel overlay; see global.css (min-width: 1024px) */}
          <img
            className="expo-web-phone-frame"
            src={withExpoBaseUrl(PHONE_FRAME_SRC)}
            alt=""
            aria-hidden
            draggable={false}
          />
        </div>
      </body>
    </html>
  );
}
