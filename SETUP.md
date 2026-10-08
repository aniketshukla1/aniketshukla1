# How this profile is made

The header and project cards are flocks simulated on the GPU with [Murmuration](https://github.com/aniketshukla1/murmuration)'s engine: a few thousand birds write the name, then form each project's own logo in its colour. A falcon (a scripted pointer) crosses each one on a fixed loop, so the recordings repeat seamlessly.

## Files

- `art/*.webp`: the animated header and cards in `README.md`, each with a `-still.webp` first frame for visitors who prefer reduced motion.
- `art/src/banner.html`, `art/src/card.html?p=superuser|mnesio|murmuration|ferro`: the pages that draw them. Open them through any local server to see them live.
- `art/src/shapes.js`: turns a logo's pixels, or a word drawn on a canvas, into a shape the flock gathers into, and runs the falcon.
- `art/src/flock.js`, `art/src/vendor/three.module.min.js`, `art/src/fonts/`: the engine, Three.js (MIT) and the fonts (SIL OFL), copied in so the art builds without anything else.
- `data/mnesio-logo.png`, `data/ferro-logo.png`: the logos the cards sample.
- `contrib-heatmap.svg`, `data/contributions.json`, `scripts/update_contributions.py`: the contribution calendar, refreshed daily.

## Re-render the art

After changing a card's name, kicker or logo (in `art/src/card.html`) or the header (in `art/src/banner.html`):

```sh
art/src/make.sh
```

It serves the repo, records each loop in headless Chrome on a virtual clock (`art/src/record.mjs`), and encodes the WebP files (`art/src/encode.py`). It needs Node 22+, Chrome, Chromium, Edge or Brave, and Python 3 with Pillow. The card descriptions, tags and links are plain text in `README.md`, so they reflow on phones; edit them there.

## Daily contribution refresh

`.github/workflows/update-profile-art.yml` runs around **11:47 IST** (06:17 UTC) and can be run by hand from the Actions tab. It checks the calendar logic (`python3 scripts/test_profile.py`), fetches the public calendar, and commits `contrib-heatmap.svg` and `data/contributions.json` when they change. It uses the workflow's built-in token; no secret is needed. An HTTP, parsing or validation error fails the run and leaves the last good graph in place.
