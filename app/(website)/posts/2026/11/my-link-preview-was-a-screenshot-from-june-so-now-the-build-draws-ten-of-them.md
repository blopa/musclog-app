---
title: 'My link preview was a screenshot from June, so now the build draws ten of them'
date: '2026-11-24'
category: 'engineering'
description: 'Every Musclog page shared the same preview image: an old Home screen, in English, with a promise the app no longer kept. Now a script draws one per language at build time with sharp and pango, and nothing is committed. Here is how, the four sharp gotchas, and why the first version was correct and ugly.'
tags: ['Musclog', 'SEO', 'Open Graph', 'sharp', 'pango', 'i18n', 'Web', 'Design']
---

When you paste a link into a chat or a social network, the card that unfolds under it comes from a few `<meta>` tags: a title, a description and an image (`og:image`, plus `twitter:image` for X). The image does most of the work. It's the only part people look at before deciding whether to tap.

Every page of musclog.app pointed at the same image, `seo-image.png`. I added it at the end of June and didn't think about it again. Last week I did, and I found three problems with it:

1. **The phone in it showed a Home screen from June.** The summary card and the buttons have changed since, and the greeting had my own name in it.
2. **It was in English.** The website is now in [ten languages, each under its own URL](/blog/2026/11/i-put-the-language-in-the-url-and-then-spent-two-days-on-the-urls-that-have-none). A Spanish page with a Spanish title and description unfolded into an English picture.
3. **It made a promise the app no longer keeps.** One of the five features read "No subscriptions, no paywalls". Since [Musclog Iron](/blog/2026/11/meet-musclog-iron-ai-with-nothing-to-set-up-and-nothing-else-locked) there is a subscription. Nothing that was free got locked behind it, but the sentence was still false, and it was on every link I've ever shared.

![The old preview image: a phone with an older Home screen beside "Everything you need to train smarter and eat better" and five features with icons](/images/blog/2026/11/link-preview-before.webp)

I could have opened a design tool and made a fresh one. That would fix June. It would not fix next June, or the Dutch version, or the Turkish one. I already made that mistake [with the app icon](/blog/2026/10/i-lost-my-app-icon-so-a-script-draws-six-of-them), and the lesson was the same: keep the recipe, not the export.

## The recipe was already in the repo

Everything the image needs was already in the repository, kept up to date by something else:

- **The phone screen.** The Google Play listing screenshots are captured by a Playwright suite, per language, into `screenshots/google-play/phone/<language>/01-home.png`. When the app changes, I re-capture them for the store anyway.
- **The device frame.** `assets/phone-wrapper.png`, the same frame the website draws around the app on desktop. Its screen is transparent, so a capture can go underneath.
- **The words.** Every language has a `website.json`. I added a `website.seo.image` block to each: a headline, a line under it, and four short features.
- **The font.** Manrope, which the store screenshots use. More on this below, because it caused most of the trouble.

So `scripts/generate-seo-images.js` puts those together and writes `public/images/seo/<language>.jpg` for each of the ten languages. That folder is in `.gitignore`. The script runs before the static export in `npm run build-android-web`, which is what the GitHub Pages deploy runs, and also before `npm run web` in development. The old PNG is deleted. There's no picture in the history to go stale, only the steps to make one.

The page side is small. There's one function for the address:

```typescript
export function seoImageUrl(prefix: string): string {
  return absoluteUrl(`/images/seo/${prefix}.jpg`);
}
```

`metadataForPage`, which already decides each page's canonical URL and `hreflang` links, now picks the image from the language the page is _published_ in. That matters for the blog: posts are English only, so a blog post opened from the Spanish site still shares the English image, which matches its English title.

## Text, through sharp and pango

[sharp](https://sharp.pixelplumbing.com/) can render text directly: give it a `text` input and libvips hands it to pango, which does the hard parts. Word wrapping, Cyrillic, Turkish dotted and dotless i, Polish ł. Every block of text becomes its own transparent image, and I get its real width and height back:

```javascript
const { data, info } = await sharp({
  text: {
    text: `<span foreground="${color}">${escapeMarkup(text)}</span>`,
    rgba: true,
    font: `${font.family} ${size}`,
    width,
    wrap: 'word',
    spacing: Math.round(size * leading),
  },
})
  .png()
  .toBuffer({ resolveWithObject: true });
```

Measuring is what makes ten languages work. German and Russian run long. Instead of guessing a font size that fits all of them, the script lays out the whole text column, checks whether it fits the image, and if not shrinks everything by 4% and tries again. It stops at 70%. Below that the text is too small to read in a chat preview, so the build fails with the name of the language and tells you to shorten its copy. A preview that quietly turns into fine print would be worse than a failed build.

One more rule just for the headline: a short headline that wraps leaves one word alone on the second line ("Train better, eat / better"). So the headline is laid out at full width, then again at narrower and narrower widths, and the script keeps the narrowest one that still has the same number of lines:

```javascript
async function balancedHeadline(text, size, width) {
  const options = { font: FONTS.bold, size, color: INK, leading: 0.06 };
  const full = await textBlock(text, { ...options, width });
  for (let share = 0.5; share < 1; share += 0.05) {
    const block = await textBlock(text, { ...options, width: Math.round(width * share) });
    if (block.height <= full.height) {
      return block;
    }
  }

  return full;
}
```

The two lines come out about the same length. It's `text-wrap: balance` from CSS, done by trial.

## Four things sharp did that I did not expect

**1. One font file per text block.** The `text` input has a `fontfile` option, so I passed Manrope ExtraBold to the headline and Manrope SemiBold to the body text. The headline came out in Manrope. The body text came out in whatever sans-serif my machine had. There was no error. The fix is to tell fontconfig, which pango uses to find fonts, about the whole folder. The script writes a throw-away config that includes the system one and adds the repo's fonts, and points `FONTCONFIG_FILE` at it before sharp loads:

```javascript
function registerBundledFonts() {
  const config = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'musclog-fonts-')), 'fonts.conf');
  fs.writeFileSync(
    config,
    `<?xml version="1.0"?>\n<!DOCTYPE fontconfig SYSTEM "fonts.dtd">\n<fontconfig>\n` +
      `  <include ignore_missing="yes">/etc/fonts/fonts.conf</include>\n` +
      `  <dir>${FONT_DIR}</dir>\n</fontconfig>\n`
  );
  process.env.FONTCONFIG_FILE = config;
  process.on('exit', () => fs.rmSync(path.dirname(config), { recursive: true, force: true }));
}

registerBundledFonts();
const sharp = require('sharp');
```

That also meant committing the fonts. Until now Manrope only existed in a download cache that the store-screenshot script fills on first use. A CI runner doesn't have it, and the whole point of generating the image at build time is that the build machine draws it. The two weights are about 95 KB each and licensed under the SIL Open Font License, so they now live in `assets/fonts/manrope/`.

**2. Text blocks are cropped to their ink.** A line with no tall letters or descenders came back a few pixels shorter than a line with them. Stacked under each other, the gaps between rows looked random. Every title and description now gets a fixed line box, so the row spacing comes from the font size and not from which letters happen to be in the sentence.

**3. `extract` runs before `composite`.** To show only the top part of the phone, I masked the capture to the screen's rounded corners and then cut it at the image's bottom edge, in one chain. sharp answered with `Image to composite must have same dimensions or smaller`. In one pipeline sharp applies `extract` before `composite`, whatever order you write them in, so the mask was now taller than the image it was masking. Two pipelines fixed it: mask first, `toBuffer()`, then crop.

**4. Positions must be whole numbers.** `Expected integer between -100000000 and 100000000 for top but received 351.5`. Fair enough. Everything gets `Math.round` now.

## The first version was correct and ugly

The first image the script produced had everything I'd asked for: the current Home screen, translated text, the right size. Next to the old one, it was clearly worse. The phone was a flat dark rectangle. The capture started at the very top of the screen, because the store captures have no status bar. The features were separated by thin lines. Nothing about it looked like a phone you could hold.

So I put the old and new images side by side and took back what had made the old one work:

- **The real device frame.** The same `phone-wrapper.png`, with its speaker and side buttons, drawn on top of the capture.
- **A status bar.** A time, signal, Wi-Fi and battery, drawn in the colour of the capture's top row. Without it, the app's header pressed against the bezel and the screen looked cropped, which it was.
- **The phone running off the bottom edge,** sized so the bottom of the image cuts through the "Start workout" and "Track food" buttons below their labels. That's the part of the Home screen that says what the app is for.
- **An icon beside each feature,** in a soft gray tile. The icons come from the lucide set the website already uses. The script reads each icon's shapes straight from the package and draws them as SVG.
- **White space and a white background.**

One more problem showed up with the real frame: at the two top corners, a sliver of square status bar poked out past the phone's rounded corners. The frame's cut-out is rounded, but the frame is transparent outside its own outline there, so it doesn't cover the corners of a square screen. Clipping the screen to a rounded rectangle before placing it fixed that.

![The new preview image: the current Home screen in the original device frame, with a status bar, beside "Train better, eat better" and four features with icons](/images/blog/2026/11/link-preview-after.webp)

## My own tests didn't like my headline

The first English headline was "Train smarter and eat better", close to the old one. The test suite rejected it. Musclog has a test that scans every English string for marketing filler (journey, powerful, seamless, effortless, supercharge, elevate, and, it turns out, smarter), because a feature should say what it does instead. I had forgotten "smarter" was on the list.

It was right to fail. "Train better, eat better" says the same thing without claiming the app makes anyone smart.

The features changed too. The old image had five. The fifth was "Free & open source: no subscriptions, no paywalls", and only the open-source half is still true. It now lives in the line under the headline ("in one private, open-source app"), and nothing on the image says "free".

## Ten languages, one run

![Four of the ten previews: Spanish, Russian, German and Turkish](/images/blog/2026/11/link-preview-languages.webp)

Each language gets its own headline, features and Home screen. All ten fit at full size, including German's _Trainingsprotokoll und Ernährungstracking_. The whole run takes under two seconds on my machine, and each image is a 1200×630 JPEG of about 65 KB, the size most networks expect for a large card.

There's one gap, and you can see it in the bottom right: the Turkish card has a Turkish headline beside an English phone. The app gained German, French, Italian, Polish and Turkish recently, and the store screenshots haven't been captured in those languages yet. Until they are, the script uses the English Home screen for them. When I run the capture, their previews switch over on the next deploy without any other change.

## What it costs now

Changing the Home screen costs nothing extra: the next store capture updates every preview. A new language costs one `website.seo.image` block in its `website.json`, and the build refuses to finish without it. Changing what the preview says is a JSON edit, translated like the rest of the site.

The old image was out of date five months after I made it. The new one is redrawn on every deploy, so it can't be more out of date than the last deploy.
