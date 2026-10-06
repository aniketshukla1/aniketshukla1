"""Refresh a self-contained SVG from GitHub's public contribution calendar."""
from datetime import date, datetime, timedelta, timezone
from html import escape
from html.parser import HTMLParser
from hashlib import sha256
import json
from pathlib import Path
import re
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
USERNAME = "aniketshukla1"
PALETTE = ("#1b2530", "#0e4429", "#006d32", "#26a641", "#39d353")
HOVER_START = "<!-- DAILY-COUNTS:START -->"
HOVER_END = "<!-- DAILY-COUNTS:END -->"


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
    svg = [f'''<svg xmlns="http://www.w3.org/2000/svg" id="static" viewBox="0 0 860 272" role="img" aria-labelledby="title desc">
<title id="title">{escape(data['username'])}'s contribution calendar</title>
<desc id="desc">{total} from {first} to {end}. Current streak: {stats['current_streak']} days. Longest streak: {stats['longest_streak']} days.</desc>
<style>
text {{ font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace; fill: #c9d1d9; }}
.day {{ animation: reveal .35s ease-out both; }}
:root:target .day {{ animation: none; }}
view[id^="static-"]:target ~ .day {{ animation: none; }}
view[id^="day-"]:target ~ .day, view[id^="static-day-"]:target ~ .day {{ visibility: hidden; }}
view[id^="day-"]:target + view + .day, view[id^="static-day-"]:target + .day {{ visibility: visible; }}
view[id^="axis-"]:target ~ .weekday-label {{ visibility: hidden; }}
view#axis-1:target ~ text#weekday-1, view#axis-3:target ~ text#weekday-3, view#axis-5:target ~ text#weekday-5 {{ visibility: visible; }}
@keyframes reveal {{ from {{ opacity: 0; transform: translateY(-6px); }} to {{ opacity: 1; transform: translateY(0); }} }}
@media (prefers-reduced-motion: reduce) {{ .day {{ animation: none; }} }}
</style>
<rect x=".5" y=".5" width="859" height="271" rx="12" fill="#0d1117" stroke="#30363d"/>
<path d="M1 44H859" stroke="#30363d"/>
<circle cx="22" cy="23" r="4" fill="#ff5f57"/><circle cx="37" cy="23" r="4" fill="#febc2e"/><circle cx="52" cy="23" r="4" fill="#28c840"/>
<text x="72" y="28" font-size="13">aniket@github: ~/activity</text>
<text x="836" y="28" text-anchor="end" font-size="11" style="fill:#8b949e">last 12 months</text>''']
    for name, box in (("header", "0 0 860 78"), ("footer", "0 191 860 81")):
        for prefix in ("", "static-"):
            svg.append(f'<view id="{prefix}{name}" viewBox="{box}"/>')
    for row in range(7):
        svg.append(f'<view id="axis-{row}" viewBox="0 {80 + row * 15} 70 28"/>')
    for row, label in ((1, "Mon"), (3, "Wed"), (5, "Fri")):
        svg.append(f'<text id="weekday-{row}" class="weekday-label" x="24" y="{89 + row * 15}" font-size="10" style="fill:#8b949e">{label}</text>')
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
        for prefix in ("", "static-"):
            svg.append(f'<view id="{prefix}day-{current}" viewBox="{x:.2f} {y} {step:.2f} 28"/>')
        svg.append(f'<rect class="day" x="{x:.2f}" y="{y}" width="{step - 2:.2f}" height="12" rx="2" fill="{PALETTE[day["level"]]}" style="animation-delay:{delay:.3f}s"><title>{current}: {day["count"]:,} contributions</title></rect>')
    svg.append('<view id="right-edge" viewBox="810 80 50 28"/>')
    svg.append('<view id="blank" viewBox="820 80 14 28"/>')
    svg.append(f'<text x="24" y="218" font-size="15" style="fill:#7ee787">{total}</text>')
    svg.append('<text x="672" y="217" font-size="10" style="fill:#8b949e">Less</text>')
    for level, color in enumerate(PALETTE):
        svg.append(f'<rect x="{706 + level * 15}" y="207" width="12" height="12" rx="2" fill="{color}"/>')
    svg.append('<text x="788" y="217" font-size="10" style="fill:#8b949e">More</text>')
    svg.append(f'<text x="24" y="245" font-size="11" style="fill:#8b949e">{stats["active_days"]} active days  ·  {stats["current_streak"]} day streak  ·  {stats["longest_streak"]} day best streak</text>')
    svg.append(f'<text x="836" y="245" text-anchor="end" font-size="10" style="fill:#8b949e">through {end}</text>')
    svg.append('</svg>')
    return '\n'.join(svg) + '\n'


def render_hover_calendar(data):
    days = {date.fromisoformat(day["date"]): day for day in data["days"]}
    first, last = min(days), max(days)
    start = first - timedelta(days=(first.weekday() + 1) % 7)
    weeks = (last - start).days // 7 + 1
    rows = []
    width = 104 + weeks * 12
    # Native SVG views keep the original animation while each image owns its tooltip.
    source = "./contrib-heatmap.svg?v=" + sha256(render_heatmap(data).encode()).hexdigest()[:12]
    def picture(fragment, width, height, label, tooltip=""):
        title = f' title="{escape(tooltip)}"' if tooltip else ""
        return (f'<picture><source media="(prefers-reduced-motion: reduce)" srcset="{source}#static-{fragment}"/>'
                f'<img src="{source}#{fragment}" width="{width}" height="{height}" alt="{escape(label)}"{title} align="top"/></picture>')

    for row in range(7):
        cells = [f'<img src="{source}#axis-{row}" width="60" height="24" alt="" align="top"/>']
        for col in range(weeks):
            day = days.get(start + timedelta(days=col * 7 + row))
            if day is None:
                cells.append(f'<img src="{source}#blank" width="12" height="24" alt="" align="top"/>')
                continue
            word = "contribution" if day["count"] == 1 else "contributions"
            tooltip = f'{day["date"]}: {day["count"]:,} {word}'
            cells.append(picture(f'day-{day["date"]}', 12, 24, tooltip, tooltip))
        cells.append(f'<img src="{source}#right-edge" width="44" height="24" alt="" align="top"/>')
        rows.append(''.join(cells))
    # ponytail: GitHub strips min-width CSS; a hidden mono ruler prevents partial chart scaling.
    ruler = '<br/><tt aria-hidden="true">' + '\u00a0' * 120 + '</tt>'
    return (f'<table><tr><td width="{width}" nowrap="nowrap"><div align="left">' + picture("header", width, round(width * 78 / 860), "Aniket's animated contribution calendar") + '<br/>\n' +
            '<br/>\n'.join(rows) + '<br/>\n' + picture("footer", width, round(width * 81 / 860), f'{data["stats"]["total"]:,} contributions; current streak {data["stats"]["current_streak"]} days; longest streak {data["stats"]["longest_streak"]} days') + ruler + '</div></td></tr></table>')


def update_readme(markdown, data):
    if markdown.count(HOVER_START) != 1 or markdown.count(HOVER_END) != 1:
        raise ValueError("README needs one DAILY-COUNTS marker pair; keeping the existing files")
    before, _, remainder = markdown.partition(HOVER_START)
    _, found, after = remainder.partition(HOVER_END)
    if not found:
        raise ValueError("DAILY-COUNTS markers are out of order")
    return before + HOVER_START + "\n" + render_hover_calendar(data) + "\n" + HOVER_END + after


def main():
    request = Request(f"https://github.com/users/{USERNAME}/contributions", headers={"User-Agent": "animated-profile-readme", "Accept-Language": "en-US"})
    with urlopen(request, timeout=30) as response:
        days = parse_calendar(response.read().decode("utf-8"))
    today = datetime.now(timezone.utc).date()
    if not 365 <= len(days) <= 372 or abs((date.fromisoformat(days[-1]["date"]) - today).days) > 1:
        raise ValueError("Calendar is incomplete or stale; keeping the existing profile art")
    data = {"username": USERNAME, "generated_on": today.isoformat(),
            "source": request.full_url, "days": days, "stats": summarize(days, today)}
    svg = render_heatmap(data)
    readme = update_readme((ROOT / "README.md").read_text(encoding="utf-8"), data)
    (ROOT / "data").mkdir(exist_ok=True)
    (ROOT / "data/contributions.json").write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    (ROOT / "contrib-heatmap.svg").write_text(svg, encoding="utf-8")
    (ROOT / "README.md").write_text(readme, encoding="utf-8")
    print(f"Saved {len(days)} days and {data['stats']['total']:,} contributions for {USERNAME}")


if __name__ == "__main__":
    main()
