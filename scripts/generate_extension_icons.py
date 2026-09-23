"""Generate the extension icons from the site's bar-mark."""

from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "extension" / "icons"
OUT.mkdir(parents=True, exist_ok=True)

size = 512
image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
draw = ImageDraw.Draw(image)
draw.rounded_rectangle((32, 32, 480, 480), radius=124, fill="#5274f4")

for left, top, bottom, alpha in (
    (153, 281, 382, 200),
    (230, 219, 382, 225),
    (307, 151, 382, 255),
):
    draw.rounded_rectangle((left, top, left + 45, bottom), radius=22, fill=(255, 255, 255, alpha))

for icon_size in (16, 32, 48, 128):
    image.resize((icon_size, icon_size), Image.Resampling.LANCZOS).save(
        OUT / f"icon-{icon_size}.png"
    )
