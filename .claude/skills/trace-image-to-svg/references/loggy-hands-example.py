"""Worked example: the generator behind loggy-a-v4-gripping-hands.svg.

This is here to read. Its source, loggy-a-v1-pencil-up.svg, now lives only in git history
(`git show aec9e70c7^:assets/avatars/loggy-concepts/loggy-a-v1-pencil-up.svg`), and
assets/avatars/loggy.svg has since moved on. To run it, from the repo root:
  python3 -B .claude/skills/trace-image-to-svg/references/loggy-hands-example.py source.svg out.svg

Copy the shape of this file, not its numbers. Things to notice:
- every traced path is in crop pixels, and a mapper moves it into the SVG
- each hand has its own mapper, anchored on what it touches (pencil axis, clipboard edge)
- the output is rebuilt from the untouched source on every run
- save() writes the loggy.svg format, so nothing here spells out classes or indentation
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'scripts'))
from tracekit import filled, get_group, insert_before_group, mapper, outlined, replace_group, save

INK, GREEN, STRIPE, PAPER = '#1B314D', '#47AD92', '#2F7E78', '#FCF9F4'
STROKE = 4.8  # the reference outline, 22 crop px, times the 0.223 scale

# 512 / 765 / 3 = 0.223. The rotation is the gap between the pencil's lean in each image
# (6.7 and 13.9 degrees); the anchor puts the fist on this file's pencil axis.
left = mapper((203, 625), (62.5, 255), 0.223, rotate=-7.2)
right = mapper((555, 545), (506, 292), 0.223)

# Back to front. The pencil has to pass through the fist, so the hand is two layers around it.
PALM = 'M262 476C285 460 322 460 348 474C378 492 388 528 382 565C377 600 358 632 332 662C344 690 344 722 332 748C320 775 302 794 280 806L200 806L220 600Z'
FINGERS = 'M78 494C100 472 136 462 170 460C205 458 245 460 275 476L296 640C304 668 300 700 278 720C250 732 205 738 178 738C176 748 174 756 170 762C130 762 92 742 74 708C68 694 66 684 70 672C52 656 44 628 49 602C53 584 60 574 70 566C56 546 58 516 78 494Z'
# Fill only: it hides the fingers' outline where the thumb lies over them.
THUMB_FILL = 'M270 470C244 500 240 590 264 626C290 646 338 612 356 530C360 500 332 472 300 468Z'
# Ink lines are closed lens shapes rather than strokes, so they taper like the rest of the art.
INK_LINES = [
    'M274 462C236 498 232 592 258 632C290 656 346 616 362 526C346 590 300 630 272 620C250 596 252 506 284 470Z',
    'M104 553C150 528 205 526 246 532L244 546C200 538 150 540 104 553Z',
    'M116 650C165 620 225 622 282 634L276 648C225 636 170 636 116 650Z',
    'M130 735C150 730 165 732 180 736L178 744C160 740 146 738 130 735Z',
    'M326 656C334 662 342 672 348 684L336 676Z',
]

# Painted bottom-up: in the reference each finger overlaps the one below it.
RIGHT_FINGERS = [
    'M262 826C262 798 288 782 316 790C364 800 432 820 468 840C494 856 498 886 476 906C456 924 410 928 372 918C330 908 290 892 272 868C264 856 262 840 262 826Z',
    'M278 742C282 716 312 702 340 712C384 724 440 744 474 764C496 778 500 806 482 826C464 842 430 846 398 838C356 828 316 812 296 790C284 776 276 758 278 742Z',
    'M312 664C318 638 346 626 374 636C418 648 474 668 506 688C526 702 528 728 512 748C494 764 462 768 430 760C390 750 350 734 330 712C318 698 310 680 312 664Z',
    'M362 588C368 562 396 550 424 558C458 566 496 584 528 610C548 626 550 654 534 674C516 690 486 692 454 684C416 674 386 656 370 632C362 618 358 602 362 588Z',
]
RIGHT_THUMB = 'M484 610C494 560 508 506 524 470C534 452 558 458 561 482C564 520 552 566 534 610Z'

# Joining new art to old art happens in SVG units, with no reference to trace: a fill with no
# stroke hides the arm's old stump, and open strokes carry its outline up into the hand.
WRIST = (
    f'<path fill="{GREEN}" d="M431 376L444 352L490 352L486 368C473 392 450 403 436 403L428 398L424 388Z"/>'
    f'<path fill="none" stroke="{INK}" stroke-width="7.4" stroke-linecap="round" d="M436 404.6C450 403 473 392 486 368"/>'
    f'<path fill="none" stroke="{INK}" stroke-width="{STROKE}" stroke-linecap="round" d="M432 366.5L443 356"/>'
)


def pencil_tail():
    """Continue the existing pencil along its own axis, so it comes out below the fist."""
    axis = (0.2425, 0.9701)
    edge_l, edge_r, stripe = (53.8, 268.3), (75.1, 263.0), (67.3, 265.0)

    def along(point, distance):
        return point[0] + axis[0] * distance, point[1] + axis[1] * distance

    def polygon(points):
        return 'M' + 'L'.join(f'{x:.1f} {y:.1f}' for x, y in points) + 'Z'

    body = polygon([along(edge_l, -14), along(edge_r, -14), along(edge_r, 40), along(edge_l, 40)])
    band = polygon([along(stripe, -14), along(edge_r, -14), along(edge_r, 40), along(stripe, 40)])
    return (
        f'<path fill="{PAPER}" stroke="{INK}" stroke-width="{STROKE}" stroke-linejoin="round" d="{body}"/>'
        f'<path fill="{STRIPE}" d="{band}"/>'
    )


def build(source):
    svg = Path(source).read_text()

    pencil = get_group(svg, 'pencil')
    pencil = pencil[: -len('</g>')] + pencil_tail() + '</g>'
    svg = replace_group(
        svg,
        'hand-l',
        '<g id="hand-l" data-pivot="68 280">'
        + outlined(PALM, left, GREEN, INK, STROKE)
        + pencil
        + outlined(FINGERS, left, GREEN, INK, STROKE)
        + filled(THUMB_FILL, left, GREEN)
        + ''.join(filled(line, left, INK) for line in INK_LINES)
        + '</g>',
    )

    svg = replace_group(
        svg,
        'hand-r',
        '<g id="hand-r" data-pivot="470 340">'
        + WRIST
        + ''.join(outlined(finger, right, GREEN, INK, STROKE) for finger in RIGHT_FINGERS)
        + '</g>',
    )

    # The thumb is behind the board, so it can't live inside hand-r, which is painted after it.
    return insert_before_group(
        svg,
        'clipboard',
        '<g id="thumb-r" data-pivot="470 340">' + outlined(RIGHT_THUMB, right, GREEN, INK, STROKE) + '</g>',
    )


if __name__ == '__main__':
    save(build(sys.argv[1]), sys.argv[2])
