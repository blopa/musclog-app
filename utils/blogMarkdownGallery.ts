import MarkdownIt from 'markdown-it';

// Derived from the constructor rather than imported by name: the package's typings expose these
// names under different paths depending on how `markdown-it` resolves, and the constructor always
// resolves.
type Parser = InstanceType<typeof MarkdownIt>;
type Token = ReturnType<Parser['parse']>[number];
type StateCore = InstanceType<Parser['core']['State']>;

/**
 * Images on adjacent lines of a post become one swipeable gallery; a blank line keeps them apart.
 *
 *     ![Start a workout](/images/blog/start.webp "Today's workout")
 *     ![Log a set](/images/blog/log.webp "Weight, reps and effort")
 *
 * The same authoring rule as the other site's `remark-gallery`, but written for this blog's
 * pipeline: a post is rendered to an HTML string on the server, so the gallery is plain markup
 * (`<figure>`s in a scroll-snap track) that already works, swipes and is indexed with no
 * JavaScript. `hooks/useBlogGalleries.ts` then unhides the previous/next buttons rendered here.
 * The classes are styled under `.blog-prose` in `global.css`.
 */
const MIN_GALLERY_IMAGES = 2;

/** A paragraph holds a gallery only when it is images and the whitespace between them. */
function galleryImages(inline: Token): Token[] | null {
  const children = inline.children ?? [];
  const images = children.filter((child) => child.type === 'image');
  const hasOtherContent = children.some(
    (child) =>
      child.type !== 'image' &&
      child.type !== 'softbreak' &&
      child.type !== 'hardbreak' &&
      !(child.type === 'text' && child.content.trim() === '')
  );

  return images.length >= MIN_GALLERY_IMAGES && !hasOtherContent ? images : null;
}

function renderGallery(images: Token[], state: StateCore): string {
  const { escapeHtml } = state.md.utils;
  const label = `Image gallery, ${images.length} images`;

  const figures = images.map((image) => {
    // `attrGet` is typed `string | number | null` here, though `src` and `title` are always text.
    const src = String(image.attrGet('src') ?? '');
    // The same alt text markdown-it's own image rule would write (inline markup flattened).
    const alt = state.md.renderer
      .renderInlineAsText(image.children ?? [], state.md.options, state.env)
      .trim();
    if (alt === '') {
      // Alt text is the image's text for crawlers and screen readers; a gallery is made of nothing
      // else, so a missing one fails the build like a bad frontmatter field does.
      throw new Error(`A blog gallery image needs alt text: ${src}`);
    }

    // The Markdown title is the visible caption, so it is not repeated as a hover tooltip.
    const title = String(image.attrGet('title') ?? '').trim();
    const caption = title ? `<figcaption>${escapeHtml(title)}</figcaption>` : '';

    return (
      `<figure class="blog-gallery-item">` +
      `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async">` +
      `${caption}</figure>`
    );
  });

  return (
    `<div class="blog-gallery">\n` +
    `<div class="blog-gallery-track" role="region" aria-label="${label}" tabindex="0">\n` +
    `${figures.join('\n')}\n</div>\n` +
    // Hidden until the browser has run `useBlogGalleries`: a button that does nothing is worse
    // than none. Scrolling the track works without it.
    `<div class="blog-gallery-nav" hidden>\n` +
    `<button type="button" class="blog-gallery-button" data-gallery-step="-1" aria-label="Previous image">←</button>\n` +
    `<button type="button" class="blog-gallery-button" data-gallery-step="1" aria-label="Next image">→</button>\n` +
    `</div>\n</div>\n`
  );
}

export const blogGallery = (md: Parser): void => {
  md.core.ruler.after('inline', 'blog_gallery', (state) => {
    const tokens = state.tokens;

    for (let index = 0; index < tokens.length; index += 1) {
      const [open, inline, close] = [tokens[index], tokens[index + 1], tokens[index + 2]];
      // Top-level paragraphs only: images inside a list item or a quote stay ordinary images.
      if (
        open.type !== 'paragraph_open' ||
        open.level !== 0 ||
        inline?.type !== 'inline' ||
        close?.type !== 'paragraph_close'
      ) {
        continue;
      }

      const images = galleryImages(inline);
      if (!images) {
        continue;
      }

      const gallery = new state.Token('html_block', '', 0);
      gallery.block = true;
      gallery.content = renderGallery(images, state);
      tokens.splice(index, 3, gallery);
    }
  });
};
