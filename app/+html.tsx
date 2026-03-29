import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

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
        <div className="expo-web-app-shell">{children}</div>
      </body>
    </html>
  );
}
