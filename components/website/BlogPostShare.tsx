import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BlueskyIcon,
  BlueskyShareButton,
  LinkedinIcon,
  LinkedinShareButton,
  PinterestIcon,
  PinterestShareButton,
  RedditIcon,
  RedditShareButton,
  TelegramIcon,
  TelegramShareButton,
  VKIcon,
  VKShareButton,
  WhatsappIcon,
  WhatsappShareButton,
  XIcon,
  XShareButton,
} from 'react-share';

import { BODY_TEXT_SOFT, ink } from './websiteColors';
import { absoluteUrl, SEO_IMAGE_URL } from './WebsiteSeo';

/**
 * Every icon is drawn monochrome — a transparent background plus `currentColor` on the glyph — so
 * the row reads as one cluster of controls instead of eight competing brand blocks. The network's
 * real color still arrives per button as the `--share-color` custom property, which
 * `.blog-share-button:hover` in `global.css` picks up. X is the exception: its brand black
 * disappears on the dark palettes and its white mark disappears on the light ones, so it hovers to
 * the page's own ink instead.
 */
const ICON_PROPS = {
  bgStyle: { fill: 'transparent' },
  iconFillColor: 'currentColor',
  round: true,
  size: 22,
} as const;

const SHARE_COLOR = {
  bluesky: '#1185FE',
  linkedin: '#0A66C2',
  pinterest: '#E60023',
  reddit: '#FF4500',
  telegram: '#26A5E4',
  vk: '#0077FF',
  whatsapp: '#25D366',
  x: ink(1),
} as const;

const BUTTON_CLASS =
  'blog-share-button inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-ink/10 bg-ink/[0.04] p-0 transition duration-200';

export interface BlogPostShareProps {
  /** The post's site-relative path, as given to `BlogPostSeo`. */
  canonicalPath: string;
  description?: string;
  title: string;
}

export function BlogPostShare({ canonicalPath, description, title }: BlogPostShareProps) {
  const { t } = useTranslation(undefined, { keyPrefix: 'website.blog.share' });
  const url = absoluteUrl(canonicalPath);
  const summary = description || title;

  /**
   * The chrome every button shares. `resetButtonStyle={false}` is load-bearing: react-share's reset
   * writes `background`, `border`, `padding` and `border-radius` as *inline* styles, which beat
   * every Tailwind class on the element — with it left on, the buttons render as bare glyphs.
   */
  const chrome = (network: keyof typeof SHARE_COLOR, label: string) => ({
    'aria-label': t('shareOn', { network: label }),
    className: BUTTON_CLASS,
    htmlTitle: t('shareOn', { network: label }),
    resetButtonStyle: false,
    style: { '--share-color': SHARE_COLOR[network] } as CSSProperties,
  });

  return (
    <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <h2
        className="text-xs font-bold uppercase tracking-[0.18em]"
        style={{ color: BODY_TEXT_SOFT }}
      >
        {t('title')}
      </h2>

      {/*
        Eight 44px targets do not fit one row on a phone, and letting them wrap leaves a lone
        button stranded on the second line — so narrow screens lay them out as an even 4x2 grid
        and only the wider layout puts them back on a single row.
      */}
      <div className="grid grid-cols-4 place-items-center gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-end sm:gap-3">
        <XShareButton url={url} title={title} {...chrome('x', 'X')}>
          <XIcon {...ICON_PROPS} />
        </XShareButton>

        <BlueskyShareButton url={url} title={title} {...chrome('bluesky', 'Bluesky')}>
          <BlueskyIcon {...ICON_PROPS} />
        </BlueskyShareButton>

        <LinkedinShareButton
          url={url}
          title={title}
          summary={summary}
          {...chrome('linkedin', 'LinkedIn')}
        >
          <LinkedinIcon {...ICON_PROPS} />
        </LinkedinShareButton>

        <RedditShareButton url={url} title={title} {...chrome('reddit', 'Reddit')}>
          <RedditIcon {...ICON_PROPS} />
        </RedditShareButton>

        <TelegramShareButton url={url} title={title} {...chrome('telegram', 'Telegram')}>
          <TelegramIcon {...ICON_PROPS} />
        </TelegramShareButton>

        <WhatsappShareButton url={url} title={title} {...chrome('whatsapp', 'WhatsApp')}>
          <WhatsappIcon {...ICON_PROPS} />
        </WhatsappShareButton>

        <PinterestShareButton
          url={url}
          media={SEO_IMAGE_URL}
          description={summary}
          {...chrome('pinterest', 'Pinterest')}
        >
          <PinterestIcon {...ICON_PROPS} />
        </PinterestShareButton>

        <VKShareButton url={url} title={title} image={SEO_IMAGE_URL} {...chrome('vk', 'VK')}>
          <VKIcon {...ICON_PROPS} />
        </VKShareButton>
      </div>
    </section>
  );
}
