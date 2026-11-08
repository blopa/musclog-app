import { fireEvent, renderHook } from '@testing-library/react';

import { renderBlogPostMarkdown } from '../../utils/blogPosts.server';
import { galleryEdges, galleryStep, useBlogGalleries } from '../useBlogGalleries';

const GALLERY = '![One](/a.webp)\n![Two](/b.webp)\n![Three](/c.webp)';

interface Layout {
  clientWidth: number;
  itemOffsets?: number[];
  scrollWidth: number;
}

/** A post's HTML, from the real renderer, in the container the page gives the hook. */
function mountPost(layout: Layout) {
  const container = document.createElement('div');
  container.id = 'post';
  container.innerHTML = renderBlogPostMarkdown(GALLERY);
  document.body.appendChild(container);

  const track = container.querySelector<HTMLElement>('.blog-gallery-track')!;
  let scrollLeft = 0;
  Object.defineProperties(track, {
    clientWidth: { configurable: true, value: layout.clientWidth },
    scrollLeft: {
      configurable: true,
      get: () => scrollLeft,
      set: (value: number) => {
        scrollLeft = value;
      },
    },
    scrollWidth: { configurable: true, value: layout.scrollWidth },
  });
  container.querySelectorAll('.blog-gallery-item').forEach((item, index) => {
    Object.defineProperty(item, 'offsetLeft', {
      configurable: true,
      value: layout.itemOffsets?.[index] ?? 0,
    });
  });
  const scrollBy = jest.fn();
  track.scrollBy = scrollBy;

  return {
    container,
    nav: container.querySelector<HTMLElement>('.blog-gallery-nav')!,
    next: container.querySelector<HTMLButtonElement>('[data-gallery-step="1"]')!,
    previous: container.querySelector<HTMLButtonElement>('[data-gallery-step="-1"]')!,
    scrollBy,
    scrollTo(left: number) {
      scrollLeft = left;
      fireEvent.scroll(track);
    },
    track,
  };
}

const OVERFLOWING: Layout = { clientWidth: 300, itemOffsets: [0, 256], scrollWidth: 900 };

function stubReducedMotion(reduced: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: jest.fn().mockReturnValue({ matches: reduced }),
    writable: true,
  });
}

describe('useBlogGalleries', () => {
  beforeEach(() => {
    stubReducedMotion(false);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('unhides the buttons of a gallery that overflows, starting at its first image', () => {
    const post = mountPost(OVERFLOWING);
    expect(post.nav.hidden).toBe(true);

    renderHook(() => useBlogGalleries('post', 'slug'));

    expect(post.nav.hidden).toBe(false);
    expect(post.previous.disabled).toBe(true);
    expect(post.next.disabled).toBe(false);
  });

  it('keeps the buttons hidden when every image already fits', () => {
    const post = mountPost({ clientWidth: 900, itemOffsets: [0, 256], scrollWidth: 900 });

    renderHook(() => useBlogGalleries('post', 'slug'));

    expect(post.nav.hidden).toBe(true);
  });

  it('moves one image per press, by the distance between two neighbouring images', () => {
    const post = mountPost(OVERFLOWING);
    renderHook(() => useBlogGalleries('post', 'slug'));

    fireEvent.click(post.next);
    expect(post.scrollBy).toHaveBeenLastCalledWith({ behavior: 'smooth', left: 256 });

    fireEvent.click(post.previous);
    expect(post.scrollBy).toHaveBeenLastCalledWith({ behavior: 'smooth', left: -256 });
  });

  it('falls back to most of a page when the spacing cannot be measured', () => {
    const post = mountPost({ clientWidth: 300, scrollWidth: 900 });
    renderHook(() => useBlogGalleries('post', 'slug'));

    fireEvent.click(post.next);

    expect(post.scrollBy).toHaveBeenLastCalledWith({ behavior: 'smooth', left: 240 });
  });

  it('jumps instead of gliding when the reader prefers reduced motion', () => {
    stubReducedMotion(true);
    const post = mountPost(OVERFLOWING);
    renderHook(() => useBlogGalleries('post', 'slug'));

    fireEvent.click(post.next);

    expect(post.scrollBy).toHaveBeenLastCalledWith({ behavior: 'auto', left: 256 });
  });

  it('disables each button at its own end of the track as it scrolls', () => {
    const post = mountPost(OVERFLOWING);
    renderHook(() => useBlogGalleries('post', 'slug'));

    post.scrollTo(300);
    expect([post.previous.disabled, post.next.disabled]).toEqual([false, false]);

    post.scrollTo(600);
    expect([post.previous.disabled, post.next.disabled]).toEqual([false, true]);

    post.scrollTo(0);
    expect([post.previous.disabled, post.next.disabled]).toEqual([true, false]);
  });

  it('stops listening when the page goes away', () => {
    const post = mountPost(OVERFLOWING);
    const { unmount } = renderHook(() => useBlogGalleries('post', 'slug'));

    unmount();
    post.scrollTo(600);
    fireEvent.click(post.next);

    expect(post.next.disabled).toBe(false);
    expect(post.scrollBy).not.toHaveBeenCalled();
  });

  it('wires the galleries of the next post when the page moves to it', () => {
    const first = mountPost(OVERFLOWING);
    const { rerender } = renderHook(({ slug }) => useBlogGalleries('post', slug), {
      initialProps: { slug: 'first' },
    });
    first.container.remove();

    const second = mountPost(OVERFLOWING);
    rerender({ slug: 'second' });
    fireEvent.click(second.next);

    expect(second.nav.hidden).toBe(false);
    expect(second.scrollBy).toHaveBeenCalledTimes(1);
  });

  it('does nothing for a post without a gallery, or a missing container', () => {
    const container = document.createElement('div');
    container.id = 'post';
    container.innerHTML = renderBlogPostMarkdown('![Only](/a.webp)');
    document.body.appendChild(container);

    expect(container.querySelector('.blog-gallery')).toBeNull();
    expect(() => renderHook(() => useBlogGalleries('post', 'slug'))).not.toThrow();
    expect(() => renderHook(() => useBlogGalleries('nowhere', 'slug'))).not.toThrow();
  });
});

describe('gallery scroll maths', () => {
  it('knows the ends, with a little tolerance for fractional scroll positions', () => {
    expect(galleryEdges(0, 300, 900)).toEqual({ atEnd: false, atStart: true });
    expect(galleryEdges(1.5, 300, 900)).toEqual({ atEnd: false, atStart: true });
    expect(galleryEdges(300, 300, 900)).toEqual({ atEnd: false, atStart: false });
    expect(galleryEdges(599, 300, 900)).toEqual({ atEnd: true, atStart: false });
    expect(galleryEdges(0, 900, 900)).toEqual({ atEnd: true, atStart: true });
  });

  it('steps by the image pitch, else by 80% of the track', () => {
    expect(galleryStep([0, 256], 300)).toBe(256);
    expect(galleryStep([0, 0], 300)).toBe(240);
    expect(galleryStep([0], 300)).toBe(240);
    expect(galleryStep([], 0)).toBe(0);
  });
});
