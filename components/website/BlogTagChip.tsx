import { blogTagPath, blogTagSlug } from './blogRoutes';
import { brand, BRAND_GREEN_BRIGHT } from './websiteColors';

/**
 * One tag of a post, linking to that tag's listing. Shared by the post page and the listing cards
 * so the two can't drift apart. A plain anchor, like every other website link (see AGENTS.md).
 * `className` carries only what differs between the two spots (horizontal padding, stacking).
 */
export function BlogTagChip({ className = '', tag }: { className?: string; tag: string }) {
  return (
    <a
      href={blogTagPath(blogTagSlug(tag))}
      className={`rounded-full border py-1 text-xs font-semibold transition-colors hover:border-accent-bright/60 hover:text-accent-pale ${className}`}
      style={{
        backgroundColor: brand(0.09),
        borderColor: brand(0.24),
        color: BRAND_GREEN_BRIGHT,
      }}
    >
      {tag}
    </a>
  );
}
