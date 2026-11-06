# How this profile is made

The header, the project cards and their link strips are HTML pages rendered to WebP, once for GitHub's dark theme and once for light. A README image can only hold one link, so each card opens the repo, and the strip below it opens the website. Each card holds a real screenshot of the project, cropped into `art/shots/`. The agent-cli screen is drawn in `art/src/card.html` from that project's own README.

| Files | What they are |
|---|---|
| `art/src/header.html` | The header |
| `art/src/card.html`, `art/src/link.html`, `art/src/theme.css` | The card and link strip layouts |
| `art/src/projects.js` | Each project's name, line, logo, screenshot, tech badges and link label |
| `art/src/tech.js` | Badge colours for each theme, and icons from Simple Icons (CC0) |
| `art/header-*.webp`, `art/cards/*.webp`, `art/links/*.webp` | The rendered images that `README.md` shows |
| `activity-*.svg` | The activity chart, one bar per day, refreshed daily |

## Change a card or the header

Edit the page or `projects.js`, then run this from the repo root:

```sh
node art/src/render.mjs            # everything
node art/src/render.mjs glaux      # one card
```

It needs Node 22+, Chrome and Python 3 with Pillow. Set `CHROME_PATH` if Chrome isn't in `/Applications`.

To add a project, add it to `projects.js`, put a 2:1 screenshot in `art/shots/`, render, and add its card and link `<picture>`s to `README.md`. The URLs live in `README.md`. Rendering stops with an error if the badges don't fit a card.

## Daily activity refresh

`.github/workflows/update-profile-art.yml` runs around **11:47 IST** (06:17 UTC) and can be run by hand from the Actions tab. It reads the public contribution calendar with `scripts/update_contributions.py`, redraws both `activity-*.svg` files and commits them if anything changed. `scripts/test_profile.py` checks the calendar logic, the SVGs, and that every image in `README.md` exists.

`art/src/fonts/` holds Geist and Geist Mono (SIL OFL).
