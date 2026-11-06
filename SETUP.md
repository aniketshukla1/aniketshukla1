# How this profile is made

The header and the project cards are HTML pages rendered to WebP, once for GitHub's dark theme and once for light. Each card holds a real screenshot of the project, cropped into `art/shots/`. The Superuser and agent-cli screens are drawn in `art/src/card.html` from those projects' own text.

| Files | What they are |
|---|---|
| `art/src/header.html` | The header |
| `art/src/card.html`, `art/src/projects.js` | The card layout, and each project's name, line, logo and screenshot |
| `art/header-*.webp`, `art/cards/*.webp` | The rendered images that `README.md` shows |
| `activity-*.svg` | The activity chart, one bar per day, refreshed daily |

## Change a card or the header

Edit the page or `projects.js`, then run this from the repo root:

```sh
node art/src/render.mjs            # everything
node art/src/render.mjs glaux      # one card
```

It needs Node 22+, Chrome and Python 3 with Pillow. Set `CHROME_PATH` if Chrome isn't in `/Applications`.

To add a project, add it to `projects.js`, put a 2:1 screenshot in `art/shots/`, render, and add its `<picture>` to `README.md`.

## Daily activity refresh

`.github/workflows/update-profile-art.yml` runs around **11:47 IST** (06:17 UTC) and can be run by hand from the Actions tab. It reads the public contribution calendar with `scripts/update_contributions.py`, redraws both `activity-*.svg` files and commits them if anything changed. `scripts/test_profile.py` checks the calendar logic, the SVGs, and that every image in `README.md` exists.

`art/src/fonts/` holds Geist and Geist Mono (SIL OFL).
