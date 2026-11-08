import { useEffect } from 'react';

/**
 * Brings the previous/next buttons of a post's image galleries to life.
 *
 * `utils/blogMarkdownGallery.ts` renders every gallery as a scroll-snap track that already swipes,
 * scrolls with the arrow keys and is readable without JavaScript, plus a `hidden` button row. This
 * unhides the row, scrolls the track one image per press, and keeps each button disabled at its end
 * of the track (and the row hidden when every image already fits, as on a wide screen).
 */

/** How far from an end still counts as being at it: fractional scroll positions never land exactly. */
const EDGE_TOLERANCE_PX = 2;
/** A press moves this share of the track when the images' own spacing cannot be measured. */
const FALLBACK_STEP_SHARE = 0.8;

export function galleryEdges(scrollLeft: number, clientWidth: number, scrollWidth: number) {
  return {
    atStart: scrollLeft <= EDGE_TOLERANCE_PX,
    atEnd: scrollLeft + clientWidth >= scrollWidth - EDGE_TOLERANCE_PX,
  };
}

/** One image plus the gap after it: where the second image starts, measured from the first. */
export function galleryStep(firstTwoOffsets: number[], clientWidth: number): number {
  const pitch = firstTwoOffsets.length > 1 ? firstTwoOffsets[1] - firstTwoOffsets[0] : 0;

  return pitch > 0 ? pitch : Math.round(clientWidth * FALLBACK_STEP_SHARE);
}

function wireGallery(gallery: HTMLElement): () => void {
  const track = gallery.querySelector<HTMLElement>('.blog-gallery-track');
  const nav = gallery.querySelector<HTMLElement>('.blog-gallery-nav');
  const buttons = Array.from(gallery.querySelectorAll<HTMLButtonElement>('[data-gallery-step]'));
  const previous = buttons.find((button) => Number(button.dataset.galleryStep) < 0);
  const next = buttons.find((button) => Number(button.dataset.galleryStep) > 0);
  if (!track || !nav || !previous || !next) {
    return () => undefined;
  }

  const update = () => {
    const { atStart, atEnd } = galleryEdges(track.scrollLeft, track.clientWidth, track.scrollWidth);
    nav.hidden = atStart && atEnd;
    previous.disabled = atStart;
    next.disabled = atEnd;
  };

  const scrollBy = (direction: number) => {
    const offsets = Array.from(track.querySelectorAll<HTMLElement>('.blog-gallery-item'))
      .slice(0, 2)
      .map((item) => item.offsetLeft);
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    track.scrollBy({
      behavior: reduceMotion ? 'auto' : 'smooth',
      left: direction * galleryStep(offsets, track.clientWidth),
    });
  };

  const onPrevious = () => scrollBy(-1);
  const onNext = () => scrollBy(1);

  previous.addEventListener('click', onPrevious);
  next.addEventListener('click', onNext);
  track.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  update();

  return () => {
    previous.removeEventListener('click', onPrevious);
    next.removeEventListener('click', onNext);
    track.removeEventListener('scroll', update);
    window.removeEventListener('resize', update);
  };
}

/**
 * `contentKey` identifies the rendered post (its slug): moving between posts swaps the HTML under
 * the same container, so the galleries have to be found and wired again.
 */
export function useBlogGalleries(containerId: string, contentKey: string): void {
  useEffect(() => {
    const container = document.getElementById(containerId);
    const galleries = container
      ? Array.from(container.querySelectorAll<HTMLElement>('.blog-gallery'))
      : [];
    const cleanups = galleries.map(wireGallery);

    return () => {
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [containerId, contentKey]);
}
