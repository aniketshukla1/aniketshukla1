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
PALETTE = ("#1b2530", "#0e4429", "#006d32", "#26a641", "#39d353")


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


def render_heatmap(data):
    days, stats = data["days"], data["stats"]
    first = date.fromisoformat(days[0]["date"])
    start = first - timedelta(days=(first.weekday() + 1) % 7)
    end = date.fromisoformat(days[-1]["date"])
    weeks = (end - start).days // 7 + 1
    step = 740 / weeks
    total = f'{stats["total"]:,} contributions'
    svg = [f'''<svg xmlns="http://www.w3.org/2000/svg" width="860" height="272" viewBox="0 0 860 272" role="img" aria-labelledby="title desc">
<title id="title">{escape(data['username'])}'s contribution calendar</title>
<desc id="desc">{total} from {first} to {end}. Current streak: {stats['current_streak']} days. Longest streak: {stats['longest_streak']} days.</desc>
<style>
text {{ font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace; fill: #c9d1d9; }}
.day {{ animation: reveal .35s ease-out both; }}
@keyframes reveal {{ from {{ opacity: 0; transform: translateY(-6px); }} to {{ opacity: 1; transform: translateY(0); }} }}
@media (prefers-reduced-motion: reduce) {{ .day {{ animation: none; }} }}
</style>
<rect x=".5" y=".5" width="859" height="271" rx="12" fill="#0d1117" stroke="#30363d"/>
<path d="M1 44H859" stroke="#30363d"/>
<circle cx="22" cy="23" r="4" fill="#ff5f57"/><circle cx="37" cy="23" r="4" fill="#febc2e"/><circle cx="52" cy="23" r="4" fill="#28c840"/>
<text x="72" y="28" font-size="13">aniket@github: ~/activity</text>
<text x="836" y="28" text-anchor="end" font-size="11" style="fill:#8b949e">last 12 months</text>''']
    for row, label in ((1, "Mon"), (3, "Wed"), (5, "Fri")):
        svg.append(f'<text x="24" y="{89 + row * 15}" font-size="10" style="fill:#8b949e">{label}</text>')
    last_month = None
    for day in days:
        current = date.fromisoformat(day["date"])
        offset = (current - start).days
        col, row = divmod(offset, 7)
        x, y = 70 + col * step, 80 + row * 15
        # Label a month only where its first week fits, avoiding edge collisions.
        if current.day == 1 and col < weeks - 2 and current.month != last_month:
            svg.append(f'<text x="{x:.2f}" y="65" font-size="10" style="fill:#8b949e">{current.strftime("%b")}</text>')
            last_month = current.month
        delay = col * .025 + row * .04
        svg.append(f'<rect class="day" x="{x:.2f}" y="{y}" width="{step - 2:.2f}" height="12" rx="2" fill="{PALETTE[day["level"]]}" style="animation-delay:{delay:.3f}s"><title>{current}: {day["count"]:,} contributions</title></rect>')
    svg.append(f'<text x="24" y="218" font-size="15" style="fill:#7ee787">{total}</text>')
    svg.append('<text x="672" y="217" font-size="10" style="fill:#8b949e">Less</text>')
    for level, color in enumerate(PALETTE):
        svg.append(f'<rect x="{706 + level * 15}" y="207" width="12" height="12" rx="2" fill="{color}"/>')
    svg.append('<text x="788" y="217" font-size="10" style="fill:#8b949e">More</text>')
    svg.append(f'<text x="24" y="245" font-size="11" style="fill:#8b949e">{stats["active_days"]} active days  ·  {stats["current_streak"]} day streak  ·  {stats["longest_streak"]} day best streak</text>')
    svg.append(f'<text x="836" y="245" text-anchor="end" font-size="10" style="fill:#8b949e">through {end}</text>')
    svg.append('</svg>')
    return '\n'.join(svg) + '\n'


def main():
    request = Request(f"https://github.com/users/{USERNAME}/contributions", headers={"User-Agent": "animated-profile-readme", "Accept-Language": "en-US"})
    with urlopen(request, timeout=30) as response:
        days = parse_calendar(response.read().decode("utf-8"))
    today = datetime.now(timezone.utc).date()
    if not 350 <= len(days) <= 371 or date.fromisoformat(days[-1]["date"]) < today - timedelta(days=1):
        raise ValueError("Calendar is incomplete or stale; keeping the existing profile art")
    data = {"username": USERNAME, "generated_on": today.isoformat(),
            "source": request.full_url, "days": days, "stats": summarize(days, today)}
    svg = render_heatmap(data)
    (ROOT / "data").mkdir(exist_ok=True)
    (ROOT / "data/contributions.json").write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    (ROOT / "contrib-heatmap.svg").write_text(svg, encoding="utf-8")
    print(f"Saved {len(days)} days and {data['stats']['total']:,} contributions for {USERNAME}")


if __name__ == "__main__":
    main()
