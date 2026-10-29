import { useEffect } from 'react';

/**
 * Draws the ```mermaid fences of a rendered post.
 *
 * `utils/blogPosts.server.ts` turns each fence into `<pre class="mermaid">source</pre>`; this finds
 * them under `containerId`, loads Mermaid on demand (a post without a diagram never downloads it)
 * and replaces each with an SVG. The diagram is coloured from the live `--c-*` custom properties
 * rather than a fixed palette, so it follows the site theme — and `MutationObserver` redraws it when
 * the picker changes the theme, which writes those properties inline on `<html>`.
 */
const SOURCE_ATTRIBUTE = 'data-mermaid-source';

function cssColor(name: string, fallback: string): string {
  const triple = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  // Mermaid's color parser wants the comma form; the custom properties hold space-separated triples.
  return triple ? `rgb(${triple.split(/\s+/).join(', ')})` : fallback;
}

function themeVariables(fontFamily: string) {
  const ink = cssColor('--c-text-primary', '#e5e7eb');
  const surface = cssColor('--c-bg-card', '#1f2937');
  const line = cssColor('--c-text-tertiary', '#9ca3af');
  const accent = cssColor('--c-accent-primary', '#22c55e');

  return {
    background: 'transparent',
    edgeLabelBackground: surface,
    fontFamily,
    lineColor: line,
    primaryBorderColor: accent,
    primaryColor: surface,
    primaryTextColor: ink,
    secondaryColor: surface,
    tertiaryColor: surface,
    textColor: ink,
  };
}

export function BlogMermaid({ containerId }: { containerId: string }) {
  useEffect(() => {
    const container = document.getElementById(containerId);
    if (!container || !container.querySelector('pre.mermaid')) {
      return undefined;
    }

    let cancelled = false;

    const draw = async () => {
      const { default: mermaid } = await import('mermaid');
      if (cancelled) {
        return;
      }

      mermaid.initialize({
        // `strict` keeps Mermaid from running click handlers or HTML labels from the source.
        securityLevel: 'strict',
        startOnLoad: false,
        theme: 'base',
        // Mermaid measures labels in this exact font and the SVG must be drawn in the same one, or
        // the boxes clip their text. `pre.mermaid` resets to the body font once processed.
        themeVariables: themeVariables(getComputedStyle(container).fontFamily),
      });

      const nodes = Array.from(container.querySelectorAll<HTMLElement>('pre.mermaid'));
      for (const node of nodes) {
        // Mermaid replaces the element's text with the SVG, so keep the source for a redraw.
        const source = node.getAttribute(SOURCE_ATTRIBUTE) ?? node.textContent ?? '';
        node.setAttribute(SOURCE_ATTRIBUTE, source);
        node.textContent = source;
        node.removeAttribute('data-processed');
      }

      try {
        await mermaid.run({ nodes });
      } catch {
        // A diagram that fails to parse stays as its readable source.
      }
    };

    void draw();

    let queued = false;
    const observer = new MutationObserver(() => {
      if (queued) {
        return;
      }

      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        void draw();
      });
    });
    observer.observe(document.documentElement, { attributeFilter: ['style'], attributes: true });

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [containerId]);

  return null;
}
