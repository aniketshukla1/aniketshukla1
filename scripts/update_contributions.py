"""Refresh a self-contained SVG from GitHub's public contribution calendar."""
from datetime import date, datetime, timedelta, timezone
from html import escape
from html.parser import HTMLParser
import json
from pathlib import Path
import re
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
USERNAME = "aniketshukla1"
THEMES = {
    "dark": {"card": "#0f1319", "line": "#2a313c", "text": "#f0f3f6", "muted": "#9198a1", "rest": "#2a313c", "from": "#818cf8", "to": "#2dd4bf"},
    "light": {"card": "#ffffff", "line": "#d1d9e0", "text": "#1f2328", "muted": "#59636e", "rest": "#d1d9e0", "from": "#4f46e5", "to": "#0d9488"},
}


class CalendarParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.cells = []
        self.tooltips = {}
        self.target = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "td" and "ContributionCalendar-day" in attrs.get("class", "").split():
            if attrs.get("data-date"):
                self.cells.append(attrs)
        elif tag == "tool-tip":
            self.target = attrs.get("for")
            if self.target:
                self.tooltips[self.target] = ""

    def handle_data(self, data):
        if self.target:
            self.tooltips[self.target] += data

    def handle_endtag(self, tag):
        if tag == "tool-tip":
            self.target = None


def parse_calendar(markup):
    parser = CalendarParser()
    parser.feed(markup)
    if not parser.cells:
        raise ValueError("No calendar cells found; GitHub markup may have changed")
    days = []
    for cell in parser.cells:
        day = date.fromisoformat(cell["data-date"])
        level = int(cell["data-level"])
        text = parser.tooltips.get(cell.get("id"), "").strip()
        match = re.match(r"([\d,]+) contributions?\b", text, re.I)
        if text.lower().startswith("no contributions"):
            count = 0
        elif match:
            count = int(match[1].replace(",", ""))
        else:
            raise ValueError(f"Missing or unrecognized count for {day}: {text!r}")
        if level not in range(5) or (count == 0) != (level == 0):
            raise ValueError(f"Inconsistent contribution level for {day}")
        days.append({"date": day.isoformat(), "count": count, "level": level})
    days.sort(key=lambda day: day["date"])
    for previous, current in zip(days, days[1:]):
        if date.fromisoformat(current["date"]) - date.fromisoformat(previous["date"]) != timedelta(days=1):
            raise ValueError("Calendar contains duplicate dates or missing days")
    return days


def summarize(days, today):
    run = longest = 0
    for day in days:
        run = run + 1 if day["count"] else 0
        longest = max(longest, run)
    end = len(days) - 1
    # An unfinished today with no contributions should not break yesterday's streak.
    if date.fromisoformat(days[end]["date"]) == today and not days[end]["count"]:
        end -= 1
    streak = 0
    if end >= 0 and date.fromisoformat(days[end]["date"]) >= today - timedelta(days=1):
        for day in reversed(days[:end + 1]):
            if not day["count"]:
                break
            streak += 1
    return {"total": sum(d["count"] for d in days),
            "active_days": sum(d["count"] > 0 for d in days),
            "current_streak": streak, "longest_streak": longest}


def render_activity(data, theme):
    """One bar per day: a waveform of the year, in the same frame as the project cards."""
    t = THEMES[theme]
    days, stats = data["days"], data["stats"]
    first, end = date.fromisoformat(days[0]["date"]), date.fromisoformat(days[-1]["date"])
    total = f'{stats["total"]:,} contributions'
    width, height, left, floor, tallest = 846, 158, 22, 122, 56
    step = (width - 2 * left) / len(days)
    peak = max(day["count"] for day in days) or 1
    svg = [f'''<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" role="img" aria-labelledby="title desc">
<title id="title">{escape(data['username'])}'s contributions over the last 12 months</title>
<desc id="desc">{total} from {first} to {end}. Current streak: {stats['current_streak']} days. Longest streak: {stats['longest_streak']} days.</desc>
<style>
text {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif; fill: {t["muted"]}; }}
.day {{ transform-box: fill-box; transform-origin: bottom; animation: rise .5s cubic-bezier(.2, .7, .2, 1) both; }}
@keyframes rise {{ from {{ transform: scaleY(0); }} to {{ transform: scaleY(1); }} }}
@media (prefers-reduced-motion: reduce) {{ .day {{ animation: none; }} }}
</style>
<defs><linearGradient id="ink" gradientUnits="userSpaceOnUse" x1="{left}" y1="0" x2="{width - left}" y2="0"><stop offset="0" stop-color="{t["from"]}"/><stop offset="1" stop-color="{t["to"]}"/></linearGradient></defs>
<rect x=".5" y=".5" width="{width - 1}" height="{height - 1}" rx="14" fill="{t["card"]}" stroke="{t["line"]}"/>
<text x="{left}" y="40" font-size="24" font-weight="600" letter-spacing="-.4" style="fill:{t["text"]}">{total}</text>
<text x="{width - left}" y="32" text-anchor="end" font-size="12">{stats["active_days"]} active days  ·  {stats["current_streak"]}-day streak  ·  {stats["longest_streak"]}-day best</text>''']
    last_month = None
    for index, day in enumerate(days):
        current = date.fromisoformat(day["date"])
        x = left + index * step
        if current.day == 1 and current.month != last_month and index < len(days) - 14:
            svg.append(f'<text x="{x:.1f}" y="142" font-size="10.5">{current.strftime("%b")}</text>')
            last_month = current.month
        bar = 1.5 if not day["count"] else 4 + (tallest - 4) * (day["count"] / peak) ** .5
        fill = t["rest"] if not day["count"] else "url(#ink)"
        svg.append(f'<rect class="day" x="{x:.1f}" y="{floor - bar:.1f}" width="{max(step - .7, 1):.1f}" height="{bar:.1f}" fill="{fill}" style="animation-delay:{index * .0018:.3f}s"/>')
    svg.append('</svg>')
    return '\n'.join(svg) + '\n'


def main():
    request = Request(f"https://github.com/users/{USERNAME}/contributions", headers={"User-Agent": "animated-profile-readme", "Accept-Language": "en-US"})
    with urlopen(request, timeout=30) as response:
        days = parse_calendar(response.read().decode("utf-8"))
    today = datetime.now(timezone.utc).date()
    if not 365 <= len(days) <= 372 or abs((date.fromisoformat(days[-1]["date"]) - today).days) > 1:
        raise ValueError("Calendar is incomplete or stale; keeping the existing profile art")
    data = {"username": USERNAME, "generated_on": today.isoformat(),
            "source": request.full_url, "days": days, "stats": summarize(days, today)}
    (ROOT / "data").mkdir(exist_ok=True)
    (ROOT / "data/contributions.json").write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    for theme in THEMES:
        (ROOT / f"activity-{theme}.svg").write_text(render_activity(data, theme), encoding="utf-8")
    print(f"Saved {len(days)} days and {data['stats']['total']:,} contributions for {USERNAME}")


if __name__ == "__main__":
    main()
