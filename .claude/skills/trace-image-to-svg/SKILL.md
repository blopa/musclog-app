---
name: trace-image-to-svg
description: Redraw all or part of a raster image (AI concept art, a sketch, a screenshot, a mascot) as clean, layered, hand-authored SVG paths, checked against the original with overlay proofs and written in the structured format of assets/avatars/loggy.svg (named groups, style classes, hidden variants). Use this whenever the user attaches a picture and asks to make an SVG look like it, recreate or fix a drawn part (hands, faces, icons, logos, characters), add a new Loggy face or pose, vectorise concept art, or match an illustration's style, even if they never say "trace". Also use it when a drawn SVG shape looks wrong and a reference exists. Not for photos, charts, or UI built from code.
---

# Trace an Image to SVG

Redraw a picture as a small number of deliberate shapes, then prove them against the original.

Nothing here auto-traces. Tools like potrace give one wobbly blob per colour, with no layers, so nothing can pass behind anything and nothing can be animated. The paths are written by hand. The accuracy comes from reading coordinates off a zoomed image and checking the result against it.

## Why the process matters

Drawing from an idea of the subject fails even when the code is tidy. The first attempt at Loggy's hands used rounded rectangles for "a fist" and came out as a stack of sausages. The second attempt looked at the reference first and found what the idea had missed: three fingers rather than four, an oval thumb, and a pencil coming out below the fist. Keep looking at the reference until you can describe it.

## Workflow

Keep the generator and all proofs in the scratchpad. Start from `references/loggy-hands-example.py`, which is a complete generator. Import the helpers from `scripts/tracekit.py`.

### 1. Study the reference

Crop each part at 3x, and add a grid so coordinates are read rather than guessed:

```python
crop('ref.png', 25, 230, 150, 300, 'left.png', zoom=3)
proof('left.png', [], 'left-grid.png', grid=50)
```

View the gridded crop, and write down before drawing:

- how many shapes there are, and which are only lines inside a larger shape
- what overlaps what, and what passes behind or through
- how thick the outline is, in crop pixels
- whether the lines keep one width or taper

### 2. Plan the layers and groups, back to front

SVG paints in order, so overlaps decide the structure. Something that passes through another shape splits that shape in two: the fist became palm, then pencil, then fingers. A part that sits behind something outside its group needs its own group placed earlier, like a thumb behind a clipboard. Say so in your report, because that part won't move with its old group.

Decide the group names now, following the house style below.

### 3. Work out the mapping

Author paths in crop pixels, so every coordinate comes straight off the grid. One `mapper` per part moves them into the SVG:

```python
T = mapper(crop_anchor=(203, 625), svg_anchor=(62.5, 255), scale=0.223, rotate=-7.2)
```

- **Scale:** `svg_width / reference_width / zoom`. Check it against a feature that exists in both images.
- **Anchor:** the same feature in both spaces, ideally what the part touches. Composition usually differs between the two, so give each part its own anchor.
- **Rotate:** the difference in angle of a shared feature, measured in both images. Negative turns counter-clockwise.
- **Outline width:** outline in crop pixels times the scale.

### 4. Draw

- Use absolute `M L C Q Z` only. `map_path` refuses anything else rather than distort it.
- Stroked outlines sit on the centre of the line, so trace half a stroke inside the outer edge.
- Take colours from the target file with `palette(svg)`, not from the reference.
- Use few points. Aim for one curve per visible bump, because extra points bring the wobble back.
- Draw tapered lines as closed lens shapes with `filled`. A stroke has one width and looks mechanical.
- Emit real coordinates rather than a `transform` attribute, so stroke widths stay true to the rest of the file.
- Build with `outlined`, `filled` and `group`. `save` turns them into the house format, so don't hand-write classes.

Two tricks cover most overlaps:

- **Fill with no stroke:** hides an outline underneath, for example where the thumb lies over the fingers.
- **Open stroke:** carries an existing outline into new art without a closed shape's seam.

### 5. Prove it

Rebuild, then compare the render and the overlay side by side:

```python
render('out.svg', 'out.png')
proof('left.png', [PALM, FINGERS, THUMB_FILL], 'left-proof.png')
compare(['crop-of-render.png', 'left-proof.png'], 'cmp.png')
```

View `cmp.png`, adjust the paths, and repeat. The overlay shows whether the shapes match. The render shows whether it reads as the thing. Trust the render when they disagree: the goal is the same drawing, not the same pixels.

### 6. Connect it to the existing art

Most of the remaining flaws are here, where the reference can't help. The first render of the right hand had good fingers, a gap at the wrist, a clipboard corner poking out, and a thumb hidden behind the board. Zoom in on every join, and write joining shapes directly in SVG units.

### 7. Finish

- Write with `save(svg, 'out.svg')`. It applies the house format, then runs `check`, which reports broken XML, repeated ids, undefined classes and points outside the viewBox. A bounds warning can be a control point rather than visible art, so confirm it in the render.
- View the full figure as well as the zoomed crop. The whole figure has to hold together, and a detail can look right alone but wrong in place.
- Tell the user about anything the reference has that you left out.

## Working rules

**Rebuild from the source.** Every run reads the untouched original and writes a new file, so a bad attempt costs nothing. Don't hand-edit the output. Use `replace_group` and `insert_before_group`, which count nested groups so the right `</g>` is found.

**Save to a new versioned file** unless the user asks to overwrite. They'll want to compare.

**Keep existing group ids.** Other code may animate them, so search for an id before changing it.

**Fail loudly when patching the generator.** Assert that the old text exists before a scripted replace. A silent no-op once left a fix unapplied, and only the render revealed it.

## House style

`assets/avatars/loggy.svg` is the model for all Musclog art. Its structure is what makes one file able to hold dozens of expressions and still be edited by hand. When in doubt, open it and copy what's there.

`save` handles the file format:

- root is `<svg version="1.2" xmlns=... viewBox=... width=... height=...>`
- colours and strokes live in numbered `<style>` classes (`.s0`, `.s1`, ...), and existing classes keep their numbers
- one element per line, tab indentation
- a path carries only `class` and `d`, with relative commands and one decimal place
- a group carries only `id`, plus `display="none"` when hidden
- nothing but `g`, `path` and comments: no `title`, `desc`, `transform` or `data-*`

Passing the real `loggy.svg` through `house_style` returns it byte for byte, and existing paths are left alone, so editing it gives a small diff.

The structure is your call, and these are the rules to follow:

- **Name every group** in kebab-case after the body part or object: `arm-l`, `sweatband`, `clipboard`. No `group1`, no `path` outside a group.
- **`-l` and `-r` mean the viewer's left and right.** `hand-l` is on the left of the image.
- **Top level is paint order:** `leg-l`, `leg-r`, `arm-l`, `hand-l`, `arm-r`, `body`, `clipboard`, `hand-r`. A new prop or limb slots in where it should paint.
- **Nest only what moves with its parent:** `foot-l` in `leg-l`, `pencil` in `hand-l`, and `log`, `leaf`, `sweatband` and `face` in `body`. Arms and hands are siblings, so a hand can sit in front of the body while its arm sits behind.
- **Variants are hidden sibling groups.** The default `face` has `brow-l`, `brow-r`, `eye-l`, `eye-r`, `nose` and `mouth`. A variant goes in `body` as `<g id="face-wink" display="none">`, with every child prefixed: `face-wink-brow-l`, `face-wink-mouth`. Anything beyond the usual features goes in `face-<name>-extras`, or a named part such as `face-cool-glasses`. Only one face is visible at a time: to swap, add `display="none"` to `face` and remove it from the variant. Keep the comment in `body` that says so.

`face_variant` builds that shape, and `append_to_group` puts it at the end of `body`:

```python
svg = append_to_group(svg, 'body', face_variant('proud',
    brow_l=filled(BROW_L, T, INK), brow_r=filled(BROW_R, T, INK),
    eye_l=filled(EYE_L, T, INK), eye_r=filled(EYE_R, T, INK),
    nose=filled(NOSE, T, INK), mouth=filled(MOUTH, T, INK)))
save(svg, 'out.svg')
```

For a new drawing, start from `document(512, 640, group('body', ...))`.

## Requirements

ImageMagick (`magick`), Python 3, Node and `sharp`, which this repo already has in `node_modules`. Run from the repo root so `render.js` finds it.
