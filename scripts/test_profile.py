"""Small offline regression check for the public calendar's trust boundary."""
from datetime import date
import json
from pathlib import Path
from xml.etree import ElementTree as ET

from update_contributions import parse_calendar, summarize, render_heatmap, render_hover_calendar, update_readme, HOVER_START, HOVER_END


def check():
    markup = '''
    <td class="ContributionCalendar-day" data-date="2026-10-04" data-level="2" id="b"></td>
    <td class="ContributionCalendar-day" data-date="2026-10-03" data-level="4" id="a"></td>
    <td class="ContributionCalendar-day" data-date="2026-10-05" data-level="0" id="c"></td>
    <tool-tip for="b">1 contribution on October 4th.</tool-tip>
    <tool-tip for="c">No contributions on October 5th.</tool-tip>
    <tool-tip for="a"><span>1,234 contributions</span> on October 3rd.</tool-tip>
    '''
    days = parse_calendar(markup)
    assert [d["count"] for d in days] == [1234, 1, 0]
    stats = summarize(days, date(2026, 10, 5))
    assert stats == {"total": 1235, "active_days": 2, "current_streak": 2, "longest_streak": 2}
    assert summarize(days, date(2026, 10, 6))["current_streak"] == 0
    assert summarize([{"date": "2026-10-05", "count": 0, "level": 0}], date(2026, 10, 5))["longest_streak"] == 0

    # GitHub markup changes must not silently turn real contributions into zeros.
    for broken in (
        "<html>rate limited</html>",
        markup.replace('for="a"', 'for="missing"'),
        markup.replace("1,234 contributions", "unexpected label"),
        markup.replace('data-date="2026-10-04"', 'data-date="2026-10-03"'),
        markup.replace('data-date="2026-10-03"', 'data-date="2026-10-01"'),
        markup.replace('data-level="4"', 'data-level="9"'),
    ):
        try:
            parse_calendar(broken)
        except ValueError:
            pass
        else:
            raise AssertionError("Invalid calendar was accepted")

    svg = render_heatmap({"username": "aniketshukla1", "days": days, "stats": stats})
    root = ET.fromstring(svg)
    cells = root.findall('.//{http://www.w3.org/2000/svg}rect[@class="day"]')
    assert len(cells) == 3
    assert '1,235 contributions' in svg
    assert 'prefers-reduced-motion' in svg
    assert '<script' not in svg
    hover = ET.fromstring(render_hover_calendar({"username": "aniketshukla1", "days": days, "stats": stats}))
    cells = hover.findall('.//img[@title]')
    assert len(cells) == 3
    assert {cell.attrib["title"] for cell in cells} == {
        "2026-10-03: 1,234 contributions", "2026-10-04: 1 contribution", "2026-10-05: 0 contributions"}
    assert {cell.attrib["src"] for cell in cells} == {f"./data/contribution-tiles/{level}.svg" for level in (0, 2, 4)}
    # Refreshes must preserve profile text and project cards outside the calendar.
    document = "bio\n" + HOVER_START + "old calendar" + HOVER_END + "\nprojects"
    updated = update_readme(document, {"username": "aniketshukla1", "days": days, "stats": stats})
    assert updated.startswith("bio\n" + HOVER_START)
    assert updated.endswith(HOVER_END + "\nprojects")
    try:
        update_readme("no markers", {})
    except ValueError:
        pass
    else:
        raise AssertionError("Missing calendar markers were accepted")
    saved = json.loads((Path(__file__).resolve().parents[1] / "data/contributions.json").read_text())
    readme = (Path(__file__).resolve().parents[1] / "README.md").read_text()
    actual_calendar = ET.fromstring(readme.split(HOVER_START, 1)[1].split(HOVER_END, 1)[0].strip())
    actual_cells = actual_calendar.findall('.//img[@title]')
    assert len(actual_cells) == len(saved["days"])
    assert sum(int(cell.attrib["title"].split(": ")[1].split()[0].replace(",", "")) for cell in actual_cells) == saved["stats"]["total"]
    assert saved["stats"] == summarize(saved["days"], date.fromisoformat(saved["generated_on"]))
    assert (Path(__file__).resolve().parents[1] / "contrib-heatmap.svg").read_text() == render_heatmap(saved)
    # The shipped images must work inside GitHub's image-only README sandbox.
    for path in Path(__file__).resolve().parents[1].glob("*.svg"):
        root = ET.parse(path).getroot()
        assert root.find("{http://www.w3.org/2000/svg}title") is not None
        assert root.find("{http://www.w3.org/2000/svg}desc") is not None
        assert "prefers-reduced-motion" in path.read_text()
        for element in root.iter():
            assert element.tag.split("}")[-1] not in {"script", "foreignObject"}
            assert not any(key.split("}")[-1].startswith("on") for key in element.attrib)
            assert not any(value.startswith(("http:", "https:", "//")) for key, value in element.attrib.items() if key.split("}")[-1] == "href")
    print("Calendar parsing, totals, streaks, hover counts, README preservation, and SVG checks passed.")


if __name__ == "__main__":
    check()
