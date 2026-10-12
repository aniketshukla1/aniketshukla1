# How this profile is made

The header and each project card are small 3D scenes, recorded to animated WebP. Each one has its own identity, taken from the project's brand:

| Image | Page | Scene |
|---|---|---|
| `art/name.webp` | `art/src/name.html` | a laser rises and builds the name from blocks that land hot and cool to ceramic, on a glossy studio floor (Three.js) |
| `art/superuser.webp` | `art/src/superuser.html` | Superuser's charcoal and violet: a glass window in 3D where it asks before it acts and shows that nothing left the computer (CSS 3D) |
| `art/mnesio.webp` | `art/src/mnesio.html` | mnesio's node-graph logo built from glass nodes, with memory pulses running from the root to the leaves (Three.js) |
| `art/murmuration.webp` | `art/src/murmuration.html` | Murmuration's sunset: a flock forms its serif M and a falcon cuts through it ([Murmuration](https://github.com/aniketshukla1/murmuration)'s engine) |
| `art/ferro.webp` | `art/src/ferro.html` | ferro's F forged in dark iron, heat climbing through it, embers rising, a code review behind (Three.js) |

Every scene runs on a fixed loop, so the recordings repeat seamlessly. Each image has a `-still.webp` for visitors who prefer reduced motion. The card descriptions, tags and links are plain text in `README.md`, so they reflow on phones.

## Re-render the art

After changing a scene in `art/src/`:

```sh
art/src/make.sh
```

It serves the repo, records each loop in headless Chrome on a virtual clock (`art/src/record.mjs`), and encodes the WebP files (`art/src/encode.py`). It needs Node 22+, Chrome, Chromium, Edge or Brave, and uv (or Python 3 with Pillow). Open any page in `art/src/` through a local server to see it live.

`art/src/vendor/` holds Three.js and its RoomEnvironment add-on (MIT); `art/src/fonts/` holds Fraunces, Geist and Geist Mono (SIL OFL); `data/mnesio-logo.png` and `data/ferro-logo.png` are the projects' logos.

## Daily contribution refresh

`.github/workflows/update-profile-art.yml` runs around **11:47 IST** (06:17 UTC) and can be run by hand from the Actions tab. It checks the calendar logic (`python3 scripts/test_profile.py`), fetches the public calendar, and commits `contrib-heatmap.svg` and `data/contributions.json` when they change. It uses the workflow's built-in token; no secret is needed. An HTTP, parsing or validation error fails the run and leaves the last good graph in place.
