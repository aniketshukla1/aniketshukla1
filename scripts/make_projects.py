"""Render project cards with official embedded logos; no dependencies."""
from base64 import b64encode
from html import escape
from pathlib import Path
from textwrap import wrap

from make_profile import frame

ROOT = Path(__file__).resolve().parents[1]
PROJECTS = (
    {
        "name": "mnesio",
        "label": "AI AGENT MEMORY",
        "summary": (
            "Memory that helps AI agents learn from outcomes.",
            "Improves agent policies through a safety gate.",
        ),
        "features": "Rust core / MCP server / Python + Node SDKs",
        "repo": "github.com/mnesio/mnesio",
    },
    {
        "name": "ferro",
        "label": "LOCAL CODE REVIEW",
        "summary": (
            "Understand your code changes before you push.",
            "Review diffs, tests, and security on your own machine.",
        ),
        "features": "Rust core / Local-first / GitHub + GitLab",
        "repo": "github.com/aniketshukla1/ferro",
    },
)


def project_card(project):
    name = project["name"]
    description = f"{name} logo. " + " ".join(project["summary"]) + " " + project["features"]
    logo = b64encode((ROOT / "data" / f"{name}-logo.png").read_bytes()).decode("ascii")
    svg = [frame(860, f"~/projects/{name}", description, height=302)]
    svg.append(f'<image class="line" x="46" y="87" width="156" height="156" href="data:image/png;base64,{logo}" style="animation-delay:.1s"/>')
    svg.append('<path d="M230 68V256" stroke="#30363d"/>')
    svg.append(f'<text class="line" x="258" y="89" font-size="28" font-weight="600" style="fill:#7ee787;animation-delay:.2s">{escape(name)}</text>')
    svg.append(f'<text class="line" x="258" y="116" font-size="11" style="fill:#8b949e;animation-delay:.3s">{escape(project["label"])}</text>')
    for index, line in enumerate(project["summary"]):
        svg.append(f'<text class="line" x="258" y="{156 + index * 28}" font-size="17" style="animation-delay:{.4 + index * .12:.2f}s">{escape(line)}</text>')
    svg.append(f'<text class="line" x="258" y="244" font-size="12" style="fill:#8b949e;animation-delay:.8s">{escape(project["features"])}</text>')
    svg.append('<path d="M24 266H836" stroke="#30363d"/>')
    svg.append(f'<text x="24" y="287" font-size="11" style="fill:#8b949e">{escape(project["repo"])}</text>')
    svg.append('<text x="836" y="287" text-anchor="end" font-size="11" style="fill:#7ee787">View project ↗</text></svg>')
    return '\n'.join(svg) + '\n'


def mobile_card(project):
    name = project["name"]
    lines = wrap(" ".join(project["summary"]), width=34)
    features = wrap(project["features"], width=40)
    height = 265 + len(lines) * 26 + len(features) * 21
    description = f"{name}. " + " ".join(project["summary"]) + " " + project["features"]
    logo = b64encode((ROOT / "data" / f"{name}-logo.png").read_bytes()).decode("ascii")
    svg = [frame(430, f"~/projects/{name}", description, height)]
    svg.append(f'<image class="line" x="24" y="66" width="72" height="72" href="data:image/png;base64,{logo}" style="animation-delay:.1s"/>')
    svg.append(f'<text class="line" x="118" y="99" font-size="29" font-weight="600" style="fill:#7ee787;animation-delay:.2s">{escape(name)}</text>')
    svg.append(f'<text class="line" x="118" y="126" font-size="12" style="fill:#8b949e;animation-delay:.3s">{escape(project["label"])}</text>')
    svg.append('<path d="M24 158H406" stroke="#30363d"/>')
    for index, line in enumerate(lines):
        svg.append(f'<text class="line" x="24" y="{194 + index * 26}" font-size="18" style="animation-delay:{.4 + index * .08:.2f}s">{escape(line)}</text>')
    y = 222 + len(lines) * 26
    for index, line in enumerate(features):
        svg.append(f'<text class="line" x="24" y="{y + index * 21}" font-size="14" style="fill:#8b949e;animation-delay:.9s">{escape(line)}</text>')
    svg.append(f'<text x="24" y="{height - 21}" font-size="11" style="fill:#7ee787">OPEN SOURCE / RUST</text></svg>')
    return '\n'.join(svg) + '\n'


if __name__ == "__main__":
    for project in PROJECTS:
        path = ROOT / f'{project["name"]}-card.svg'
        path.write_text(project_card(project), encoding="utf-8")
        (ROOT / f'{project["name"]}-mobile.svg').write_text(mobile_card(project), encoding="utf-8")
        print(f"Saved {path.name}")
