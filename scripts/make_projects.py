"""Render project cards with official embedded logos; no dependencies."""
from base64 import b64encode
from html import escape
from pathlib import Path

from make_profile import frame

ROOT = Path(__file__).resolve().parents[1]
PROJECTS = (
    {
        "name": "mnesio",
        "label": "AI AGENT MEMORY",
        "summary": (
            "Long-term memory that helps AI agents learn",
            "from outcomes. Turns experience into better",
            "policies, with a safety gate before every improvement.",
        ),
        "features": "Rust core / MCP server / Python + Node SDKs",
        "repo": "github.com/mnesio/mnesio",
    },
    {
        "name": "ferro",
        "label": "LOCAL CODE REVIEW",
        "summary": (
            "See what your code changes before you push.",
            "Explore diffs, catch broken callers, and check",
            "tests and security in a private, local workspace.",
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
        svg.append(f'<text class="line" x="258" y="{156 + index * 25}" font-size="15" style="animation-delay:{.4 + index * .12:.2f}s">{escape(line)}</text>')
    svg.append(f'<text class="line" x="258" y="244" font-size="12" style="fill:#8b949e;animation-delay:.8s">{escape(project["features"])}</text>')
    svg.append('<path d="M24 266H836" stroke="#30363d"/>')
    svg.append(f'<text x="24" y="287" font-size="11" style="fill:#8b949e">{escape(project["repo"])}</text>')
    svg.append('<text x="836" y="287" text-anchor="end" font-size="11" style="fill:#7ee787">View project ↗</text></svg>')
    return '\n'.join(svg) + '\n'


if __name__ == "__main__":
    for project in PROJECTS:
        path = ROOT / f'{project["name"]}-card.svg'
        path.write_text(project_card(project), encoding="utf-8")
        print(f"Saved {path.name}")
