"""Generate the one-shot ASCII portrait and terminal info card (Pillow locally)."""
from html import escape
import os
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageOps

ROOT = Path(__file__).resolve().parents[1]
STATIC = os.environ.get("STATIC") == "1"
ROWS = (
    ("Role", "Staff Software Engineer"),
    ("Now", "Synopsys Inc."),
    ("Based", "Bangalore, India"),
    ("Focus", "AI x Stuff"),
    ("Stack", "Python / Rust / Go / JavaScript"),
    ("Build", "mnesio / Superuser"),
    ("Craft", "Full-Stack / System Design / DSA"),
)


def frame(width, title, description):
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="420" viewBox="0 0 {width} 420" role="img" aria-labelledby="title desc">
<title id="title">{escape(title)}</title><desc id="desc">{escape(description)}</desc>
<style>
text {{ font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace; fill: #c9d1d9; }}
.line {{ animation: print .4s ease-out both; }}
@keyframes print {{ from {{ opacity: 0; transform: translateY(4px); }} to {{ opacity: 1; transform: translateY(0); }} }}
.cursor {{ animation: cursor 4.2s step-end forwards; }}
@keyframes cursor {{ 0%, 40%, 80% {{ opacity: 1; }} 20%, 60%, 100% {{ opacity: 0; }} }}
@media (prefers-reduced-motion: reduce) {{ .line {{ animation: none; }} .cursor {{ display: none; }} .wipe {{ display: none; }} }}
{'* { animation: none !important; } .wipe, .cursor { display: none; }' if STATIC else ''}
</style>
<rect x=".5" y=".5" width="{width - 1}" height="419" rx="12" fill="#0d1117" stroke="#30363d"/>
<path d="M1 44H{width - 1}" stroke="#30363d"/>
<circle cx="22" cy="23" r="4" fill="#ff5f57"/><circle cx="37" cy="23" r="4" fill="#febc2e"/><circle cx="52" cy="23" r="4" fill="#28c840"/>
<text x="72" y="28" font-size="12" style="fill:#8b949e">{escape(title)}</text>'''


def portrait():
    image = ImageOps.fit(Image.open(ROOT / "data/avatar.png"), (460, 460)).convert("RGBA")
    if image.getextrema()[3][0] < 255:
        mask = image.getchannel("A")
    else:
        # ponytail: silhouette is tuned to this avatar; use a transparent PNG for a different photo.
        outline = [(175, 108), (179, 74), (193, 52), (215, 38), (236, 33), (251, 37),
                   (267, 37), (289, 44), (307, 56), (314, 74), (311, 99), (298, 121),
                   (298, 145), (283, 169), (280, 197), (311, 217), (346, 232),
                   (369, 250), (390, 301), (407, 365), (418, 460), (52, 460),
                   (57, 408), (73, 341), (78, 302), (99, 267), (111, 245),
                   (170, 214), (183, 199), (183, 172), (174, 152), (171, 128)]
        mask = Image.new("L", image.size, 0)
        ImageDraw.Draw(mask).polygon(outline, fill=255)
    gray = ImageOps.autocontrast(image.convert("L"), cutoff=1, mask=mask)
    gray = ImageEnhance.Contrast(gray).enhance(1.12)
    gray = Image.composite(gray, Image.new("L", image.size, 255), mask)
    grid = gray.resize((88, 49), Image.Resampling.LANCZOS)
    ramp = " .`:-=+*cs#%@"
    svg = [frame(370, "./portrait.sh", "A monochrome ASCII portrait of Aniket Shukla, typed row by row.")]
    svg.append('<g font-size="6.2" xml:space="preserve" style="white-space:pre">')
    for row in range(grid.height):
        chars = ''.join(ramp[round((255 - grid.getpixel((col, row))) / 255 * (len(ramp) - 1))] for col in range(grid.width))
        y = 64 + row * 6.7
        svg.append(f'<text x="21" y="{y:.1f}" xml:space="preserve" style="white-space:pre">{escape(chars)}</text>')
        # A moving cover keeps the complete portrait visible if animation is unsupported.
        if not STATIC:
            begin = row * .052 + .1
            duration = begin + .2
            hold = begin / duration
            svg.append(f'<rect class="wipe" x="21" y="{y - 5.4:.1f}" width="0" height="6.7" fill="#0d1117"><animate attributeName="x" values="21;21;349" keyTimes="0;{hold:.5f};1" begin="0s" dur="{duration:.3f}s" fill="freeze"/><animate attributeName="width" values="328;328;0" keyTimes="0;{hold:.5f};1" begin="0s" dur="{duration:.3f}s" fill="freeze"/></rect>')
    svg.append('</g><text x="21" y="401" font-size="10" style="fill:#8b949e">portrait rendered in ASCII</text></svg>')
    return '\n'.join(svg) + '\n'


def info_card():
    description = "Aniket Shukla. " + ". ".join(f"{key}: {value}" for key, value in ROWS)
    svg = [frame(490, "neofetch --user aniket", description)]
    svg.append('<text class="line" x="26" y="83" font-size="22" font-weight="600" style="fill:#7ee787;animation-delay:.1s">Aniket Shukla</text>')
    svg.append('<text class="line" x="26" y="107" font-size="12" style="fill:#8b949e;animation-delay:.2s">aniketshukla1@github</text>')
    svg.append('<path d="M26 124H464" stroke="#30363d"/>')
    for index, (key, value) in enumerate(ROWS):
        y = 155 + index * 28
        svg.append(f'<g class="line" style="animation-delay:{.3 + index * .15:.2f}s"><text x="26" y="{y}" font-size="12" style="fill:#7ee787">{escape(key)}</text><text x="99" y="{y}" font-size="12">{escape(value)}</text></g>')
    svg.append('<g class="line" style="animation-delay:1.6s"><text x="26" y="376" font-size="12" style="fill:#7ee787">$</text><text x="42" y="376" font-size="12">building scalable systems</text><rect class="cursor" x="237" y="365" width="7" height="13" fill="#7ee787"/></g>')
    for index, color in enumerate(("#1b2530", "#0e4429", "#006d32", "#26a641", "#39d353", "#7ee787", "#c9d1d9", "#8b949e")):
        svg.append(f'<rect x="{26 + index * 17}" y="397" width="17" height="7" fill="{color}"/>')
    svg.append('</svg>')
    return '\n'.join(svg) + '\n'


if __name__ == "__main__":
    (ROOT / "aniket-ascii.svg").write_text(portrait(), encoding="utf-8")
    (ROOT / "info-card.svg").write_text(info_card(), encoding="utf-8")
    print("Saved aniket-ascii.svg and info-card.svg")
