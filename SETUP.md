# Animated profile

Recreates the [terminal profile from Avi Vashishta's blog](https://www.avivashishta.com/blog/build-animated-github-profile-readme) with Aniket's existing bio, projects, social links, and public avatar.

## What must work

1. Real daily contribution counts render as a calendar with correct totals and streaks. Invalid or incomplete GitHub HTML fails before replacing saved data.
2. A monochrome ASCII portrait prints once, alongside an info card revealing Aniket's existing profile details.
3. All SVGs are self-contained, readable without animation, and honor reduced motion. The README provides descriptive image alternatives.
4. GitHub Actions validates the generator and refreshes the graph daily without a personal access token or third-party stats service.

## Commands

```sh
python3 scripts/test_profile.py
python3 scripts/update_contributions.py
python3 scripts/make_profile.py
```

The daily contribution generator uses Python 3.11+ and its standard library. The portrait generator requires Pillow locally (`python3 -m pip install -r scripts/requirements-portrait.txt`).

To change profile details, edit `ROWS` in `scripts/make_profile.py` and run it again. The included background mask follows the current GitHub avatar. To change the photo, replace `data/avatar.png` with a transparent PNG; the generator uses its alpha channel automatically. `STATIC=1 python3 scripts/make_profile.py` generates a frozen portrait and card for local previews; run without `STATIC` again before committing.

The README uses `<picture>` to select the same SVG's `#static` view when reduced motion is enabled. Its `:target` rules disable animations without duplicating images. This also covers browsers that do not pass the motion preference into embedded SVGs.

## Files

- `scripts/update_contributions.py`: fetch, validate, summarize, and render the rolling GitHub calendar.
- `scripts/make_profile.py`: regenerate the portrait and info card from `data/avatar.png` and the details at the top of the script.
- `data/contributions.json`: dated source data behind the graph, committed with the SVG.
- `.github/workflows/update-profile-art.yml`: checks and daily refresh.

## Daily refresh

The workflow runs around **11:47 IST** (06:17 UTC) and supports a manual run from the Actions tab. Only the graph and its data change daily; the portrait and card stay committed. GitHub supplies the workflow's built-in repository token for the commit, so no personal access token or secret needs to be added. Pull requests run checks with read permissions; only main-branch refreshes can write. An HTTP, parsing, or validation error fails the run and leaves the last good art in place.

For a local `CERTIFICATE_VERIFY_FAILED` error, use Python with a configured trusted certificate store (the Codex bundled runtime was verified). Keep TLS verification enabled.

Content stays in the existing profile repository, `aniketshukla1/aniketshukla1`. Never publish invented achievements, private repository details, credentials, or the blog URL's access token.
