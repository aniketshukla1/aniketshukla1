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

## Files

- `scripts/update_contributions.py`: fetch, validate, summarize, and render the rolling GitHub calendar.
- `scripts/make_profile.py`: regenerate the portrait and info card from `data/avatar.png` and the details at the top of the script.
- `data/contributions.json`: dated source data behind the graph, committed with the SVG.
- `.github/workflows/update-profile-art.yml`: checks and daily refresh.

Content stays in the existing profile repository, `aniketshukla1/aniketshukla1`. Never publish invented achievements, private repository details, credentials, or the blog URL's access token.
