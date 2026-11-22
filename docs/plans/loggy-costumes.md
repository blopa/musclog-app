# Loggy costume poses

The design reference is `~/Downloads/Gemini_Generated_Image_d7yx31d7yx31d7yx.jpg`. From left to right it shows Sherlock Holmes, Dracula, and Cthulhu. The pose IDs are `sherlock`, `dracula`, and `cthulhu`.

## Artwork in progress

| Pose            | Elements to match on the sheet                                                                                                          | Status                                                                                    |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Sherlock Holmes | Bow-topped checked deerstalker, checked shoulder cape and clasp, smoking pipe at the corner of the smile, magnifier in his right hand   | Parts assemble. Adjusting the cape hem and keeping pipe smoke clear of the lens.          |
| Dracula         | Leaf crown ending in a widow’s peak, two fangs, tall collar, teal cape with navy lining, bow tie over a buttoned white bib, raised palm | Parts assemble. Adjusting the collar, wave height, and spacing between the fangs and bow. |
| Cthulhu         | Bare cut-log top, leaf-like temples, narrowed eyes, curling tentacles, two scalloped wings, hanging arms with open hands                | Parts assemble. Refining the overlapping curls, suction cups, and ribs of the wings.      |

## Source and build

The editable artwork lives in `assets/avatars/loggy-parts/<part>/<pose>.svg`. Each costume uses `log/default`, `leg-l/standing`, and `leg-r/standing`. The hat, crown, or bare log top takes the place of Loggy’s usual headband and sprout. His skin and living foliage follow the active theme. The detective’s cloth and the vampire’s cape use fixed fabric colors from the drawing.

The assembly order and view boxes belong in `assets/avatars/loggy-parts/poses.json`. Motion lives in `assets/avatars/loggy-parts/animations/<pose>.css`. After editing, run `npm run generate-loggy` to build the stills, animated SVGs, React Native components, and offline gallery at `assets/avatars/index.html`. The app gallery is `/app/test/loggy` in a development build.

All three recipes and animation sheets are present. The still and animated SVG composers can read them. The owner confirmed that the costumes should fit the normal, shorter torso. Next checkpoint: review the revised renders, generate the deliverables, then check animation joins, theme colors, and app registration.
