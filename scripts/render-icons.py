"""Render the original branch/check icon to PNG; development-only, requires Pillow."""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent / 'src' / 'icons'
SCALE = 4
image = Image.new('RGBA', (128 * SCALE, 128 * SCALE))
draw = ImageDraw.Draw(image)


def box(values):
    return tuple(round(value * SCALE) for value in values)


def line(points, fill, width):
    scaled = [box(point) for point in points]
    draw.line(scaled, fill=fill, width=width * SCALE, joint='curve')
    for x, y in points:
        r = width / 2
        draw.ellipse(box((x-r, y-r, x+r, y+r)), fill=fill)


dark = '#171b2d'
white = '#f8fafc'
draw.rounded_rectangle(box((4, 4, 124, 124)), radius=28*SCALE, fill=dark)
line([(37, 37), (37, 92)], white, 9)
# Cubic Bezier joining the branch into the main line.
points = [(85, 37), (85, 44)]
for step in range(1, 61):
    t = step / 60
    u = 1-t
    points.append((u**3*85 + 3*u*u*t*85 + 3*u*t*t*37 + t**3*37,
                   u**3*44 + 3*u*u*t*66 + 3*u*t*t*59 + t**3*78))
line(points, white, 9)
for x, y in [(37, 32), (85, 32), (37, 96)]:
    draw.ellipse(box((x-14.5, y-14.5, x+14.5, y+14.5)), fill=white)
    draw.ellipse(box((x-5.5, y-5.5, x+5.5, y+5.5)), fill=dark)
draw.ellipse(box((63, 63, 119, 119)), fill=dark)
draw.ellipse(box((69, 69, 113, 113)), fill='#34d399')
line([(80, 91), (88, 99), (103, 82)], '#13251f', 7)
for size in (16, 32, 48, 96, 128):
    image.resize((size, size), Image.Resampling.LANCZOS).save(ROOT / f'icon-{size}.png')
