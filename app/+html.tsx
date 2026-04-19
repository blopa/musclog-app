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

/**
 * Patches the landing panel text from localStorage before React boots.
 * Serialized via .toString() so the logic lives as real code, not a string.
 * Storage key must match LANDING_LANGUAGE_STORAGE_KEY in lang/lang.ts.
 */
function landingI18nPatcher() {
  try {
    let t = {
      'en-US': {
        cta: 'Try it live',
        f1: 'Smart workout tracking',
        f2: 'AI photo nutrition logging',
        f3: 'Detailed progress charts',
        f4: '100% private & on-device',
        tagline: 'AI-powered fitness & nutrition tracking — free & open source.',
        qrcode_title: 'Download the App',
        qrcode_text: 'Scan to download for Android',
      },
      'pt-BR': {
        cta: 'Experimente agora',
        f1: 'Rastreamento inteligente de treinos',
        f2: 'Registro de nutrição por foto com IA',
        f3: 'Gráficos detalhados de progresso',
        f4: '100% privado e no dispositivo',
        tagline: 'Acompanhamento de fitness e nutrição com IA — gratuito e open source.',
        qrcode_title: 'Baixe o App',
        qrcode_text: 'Escaneie para baixar no Android',
      },
      'ru-RU': {
        cta: 'Попробуйте сейчас',
        f1: 'Умный учёт тренировок',
        f2: 'Запись питания по фото с ИИ',
        f3: 'Подробные графики прогресса',
        f4: '100% приватно и на устройстве',
        tagline: 'Трекинг фитнеса и питания на базе ИИ — бесплатно и с открытым кодом.',
        qrcode_title: 'Скачать приложение',
        qrcode_text: 'Сканируйте для загрузки на Android',
      },
    };

    let lang = localStorage.getItem('musclog_lang');
    let s = (lang && t[lang as keyof typeof t]) || t['en-US'];

    document.querySelectorAll('[data-landing-i18n]').forEach(function (el) {
      let k = el.getAttribute('data-landing-i18n') as keyof typeof s;
      if (k && s[k]) {
        el.textContent = s[k];
      }
    });
  } catch (_) {}
}

const LANDING_I18N_SCRIPT = `(${landingI18nPatcher.toString()})();`;

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
        {/* Desktop-only landing panel — hidden on mobile via CSS */}
        <div className="expo-web-landing">
          <div className="expo-web-landing-brand">
            <svg
              className="expo-web-landing-logo"
              width="36"
              height="36"
              viewBox="0 0 24 24"
              aria-hidden
              fill="currentColor"
            >
              <rect x="1" y="9.5" width="3.5" height="5" rx="1.2" />
              <rect x="19.5" y="9.5" width="3.5" height="5" rx="1.2" />
              <rect x="4.5" y="7.5" width="2.5" height="9" rx="1" />
              <rect x="17" y="7.5" width="2.5" height="9" rx="1" />
              <rect x="7" y="10.5" width="10" height="3" rx="0.8" />
            </svg>
            <span className="expo-web-landing-name">Musclog</span>
          </div>
          <p className="expo-web-landing-tagline" data-landing-i18n="tagline">
            AI-powered fitness &amp; nutrition tracking — free &amp; open source.
          </p>
          <div className="expo-web-landing-features">
            <div className="expo-web-landing-feature">
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <polyline points="23 12 19 12 16 20 10 4 7 12 1 12" />
              </svg>
              <span data-landing-i18n="f1">Smart workout tracking</span>
            </div>
            <div className="expo-web-landing-feature">
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              <span data-landing-i18n="f2">AI photo nutrition logging</span>
            </div>
            <div className="expo-web-landing-feature">
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
              <span data-landing-i18n="f3">Detailed progress charts</span>
            </div>
            <div className="expo-web-landing-feature">
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <span data-landing-i18n="f4">100% private &amp; on-device</span>
            </div>
          </div>
          <div className="expo-web-landing-cta">
            <span data-landing-i18n="cta">Try it live</span>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </div>
          <div className="expo-web-landing-platforms">
            <span>Android</span>
            <span aria-hidden>·</span>
            <span>iOS</span>
            <span aria-hidden>·</span>
            <span>Web</span>
          </div>
          <div className="expo-web-landing-qrcode">
            <span className="expo-web-landing-qrcode-title" data-landing-i18n="qrcode_title">Download the App</span>
            <img
              src="/google_play_qrcode.png"
              alt="Google Play Store QR Code"
              className="expo-web-landing-qrcode-image"
              draggable={false}
            />
            <span className="expo-web-landing-qrcode-text" data-landing-i18n="qrcode_text">Scan to download for Android</span>
          </div>
        </div>
        {/* Patches landing panel text from localStorage before React boots */}
        <script dangerouslySetInnerHTML={{ __html: LANDING_I18N_SCRIPT }} />
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
