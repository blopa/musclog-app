import MarkdownIt from 'markdown-it';

import { blogGallery } from '../blogMarkdownGallery';
import { renderBlogPostMarkdown } from '../blogPosts.server';

const renderer = new MarkdownIt({ html: false, typographer: true }).use(blogGallery);
const render = (markdown: string) => renderer.render(markdown);

describe('blog gallery', () => {
  it('turns images on adjacent lines into one gallery with a figure each', () => {
    const html = render(
      '![Start a workout](/a.webp)\n![Log a set](/b.webp)\n![Next time](/c.webp)'
    );

    expect(html.match(/class="blog-gallery"/g)).toHaveLength(1);
    expect(html.match(/<figure class="blog-gallery-item">/g)).toHaveLength(3);
    expect(html).toContain(
      '<img src="/a.webp" alt="Start a workout" loading="lazy" decoding="async">'
    );
    // The track is a named, keyboard-focusable region: a scrolling box with neither is a trap.
    expect(html).toContain(
      '<div class="blog-gallery-track" role="region" aria-label="Image gallery, 3 images" tabindex="0">'
    );
  });

  it('renders the previous/next row hidden, for the browser to unhide', () => {
    const html = render('![One](/a.webp)\n![Two](/b.webp)');

    expect(html).toContain('<div class="blog-gallery-nav" hidden>');
    expect(html).toContain('data-gallery-step="-1" aria-label="Previous image"');
    expect(html).toContain('data-gallery-step="1" aria-label="Next image"');
  });

  it('shows the Markdown title as a caption instead of a hover tooltip', () => {
    const html = render('![One](/a.webp "First screen")\n![Two](/b.webp)');

    expect(html).toContain('<figcaption>First screen</figcaption>');
    expect(html).not.toContain('title=');
    expect(html.match(/<figcaption>/g)).toHaveLength(1);
  });

  it('also groups images separated by spaces on one line', () => {
    expect(render('![One](/a.webp) ![Two](/b.webp)')).toContain('class="blog-gallery"');
  });

  it('escapes what a post author typed into the markup it writes', () => {
    const html = render('![A "quoted" <b>name</b>](/a.webp "Fish & chips <i>")\n![Two](/b.webp)');

    expect(html).toContain('alt="A &quot;quoted&quot; &lt;b&gt;name&lt;/b&gt;"');
    expect(html).toContain('<figcaption>Fish &amp; chips &lt;i&gt;</figcaption>');
    expect(html).not.toContain('<b>');
  });

  it.each([
    ['a blank line between them', '![One](/a.webp)\n\n![Two](/b.webp)'],
    ['a single image', '![One](/a.webp)'],
    ['prose around the images', 'See ![One](/a.webp) and ![Two](/b.webp)'],
    ['an image that is a link', '[![One](/a.webp)](https://musclog.app)\n![Two](/b.webp)'],
    ['images inside a list', '- ![One](/a.webp)\n  ![Two](/b.webp)'],
    ['images inside a quote', '> ![One](/a.webp)\n> ![Two](/b.webp)'],
  ])('leaves %s as ordinary images', (_name, markdown) => {
    const html = render(markdown);

    expect(html).not.toContain('blog-gallery');
    expect(html).toContain('<img');
  });

  it('fails the render when a gallery image has no alt text, naming the file', () => {
    expect(() => render('![](/a.webp)\n![Two](/b.webp)')).toThrow(
      'A blog gallery image needs alt text: /a.webp'
    );
  });

  it('is part of the renderer posts are really built with', () => {
    const html = renderBlogPostMarkdown('![One](/a.webp)\n![Two](/b.webp)');

    expect(html).toContain('class="blog-gallery"');
    expect(renderBlogPostMarkdown('![One](/a.webp)')).not.toContain('blog-gallery');
  });
});
