import { WEBSITE_LOCALES } from './localeRoutes';

/**
 * The `generateStaticParams` of every page under `app/(website)/[locale]/`: one export per language.
 *
 * It is exported by each page, not by a layout, on purpose: Expo hands a page's `generateMetadata`
 * only the params of the page's own route, so a `[locale]` owned by a parent layout never reaches it
 * (every Spanish page came out with English titles and an English canonical). With no layout in
 * `[locale]/`, the segment is part of each page's route and arrives in `params.locale`.
 */
export async function localeStaticParams(): Promise<{ locale: string }[]> {
  return WEBSITE_LOCALES.map(({ prefix }) => ({ locale: prefix }));
}
