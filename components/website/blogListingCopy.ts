import { useTranslation } from 'react-i18next';

/**
 * The copy for a blog listing page, with the "all posts" / "one category" branch resolved ONCE.
 *
 * Both halves of a listing page need the same five strings: the visible header (`BlogPostListing`)
 * and the page metadata — `<title>`, meta description, and the `CollectionPage` JSON-LD name
 * (`BlogListingPage`). Resolving the branch per string meant the same `category ? … : …` ternary
 * five times in the component and again in its wrapper, with nothing keeping the heading and the
 * meta description in agreement.
 */
export interface BlogListingCopy {
  /** The translated category name, or `undefined` outside a category listing. */
  categoryLabel?: string;
  description: string;
  empty: string;
  eyebrow: string;
  listLabel: string;
  title: string;
}

/**
 * `category` is a category key (translated here); `tagLabel` is a tag as written on the posts, which
 * is free text and so is shown as-is. Pass at most one of them.
 */
export function useBlogListingCopy(category?: string, tagLabel?: string): BlogListingCopy {
  const { t } = useTranslation(undefined, { keyPrefix: 'website.blog' });

  if (tagLabel) {
    return {
      description: t('tagPage.description', { tag: tagLabel }),
      empty: t('tagPage.empty', { tag: tagLabel }),
      eyebrow: t('tagPage.eyebrow'),
      listLabel: t('tagPage.listLabel', { tag: tagLabel }),
      title: t('tagPage.title', { tag: tagLabel }),
    };
  }

  if (!category) {
    return {
      description: t('description'),
      empty: t('empty'),
      eyebrow: t('eyebrow'),
      listLabel: t('listLabel'),
      title: t('title'),
    };
  }

  const categoryLabel = t(`categories.${category}`);

  return {
    categoryLabel,
    description: t('categoryPage.description', { category: categoryLabel }),
    empty: t('categoryPage.empty', { category: categoryLabel }),
    eyebrow: t('categoryPage.eyebrow'),
    listLabel: t('categoryPage.listLabel', { category: categoryLabel }),
    title: t('categoryPage.title', { category: categoryLabel }),
  };
}
