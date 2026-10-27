from collections import deque
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "concepts" / "enemy-pushed-stove-motion-study-v1.png"
OUTPUT = ROOT / "assets" / "sprites" / "enemies" / "pushed-stove"

FRAME_NAMES = ("idle", "move-a", "move-b", "attack", "hurt")
FRAME_SIZE = (512, 320)
HORIZONTAL_RESTORE = 1.45


def is_background(pixel):
    red, green, blue = pixel
    return min(red, green, blue) >= 215 and max(pixel) - min(pixel) <= 48


def connected_background_mask(image):
    rgb = image.convert("RGB")
    width, height = rgb.size
    pixels = rgb.load()
    visited = bytearray(width * height)
    queue = deque()

    def enqueue(x, y):
        offset = y * width + x
        if visited[offset] or not is_background(pixels[x, y]):
            return
        visited[offset] = 1
        queue.append((x, y))

    for x in range(width):
        enqueue(x, 0)
        enqueue(x, height - 1)
    for y in range(height):
        enqueue(0, y)
        enqueue(width - 1, y)

    while queue:
        x, y = queue.popleft()
        if x > 0:
            enqueue(x - 1, y)
        if x + 1 < width:
            enqueue(x + 1, y)
        if y > 0:
            enqueue(x, y - 1)
        if y + 1 < height:
            enqueue(x, y + 1)

    alpha = Image.new("L", (width, height), 255)
    alpha_pixels = alpha.load()
    for y in range(height):
        row = y * width
        for x in range(width):
            if visited[row + x]:
                alpha_pixels[x, y] = 0
    return alpha


def keep_largest_component(alpha):
    width, height = alpha.size
    source = alpha.load()
    visited = bytearray(width * height)
    largest = []

    for start_y in range(height):
        for start_x in range(width):
            start_offset = start_y * width + start_x
            if visited[start_offset] or source[start_x, start_y] == 0:
                continue
            visited[start_offset] = 1
            queue = deque([(start_x, start_y)])
            component = []
            while queue:
                x, y = queue.popleft()
                component.append((x, y))
                for next_x, next_y in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                    if next_x < 0 or next_y < 0 or next_x >= width or next_y >= height:
                        continue
                    offset = next_y * width + next_x
                    if visited[offset] or source[next_x, next_y] == 0:
                        continue
                    visited[offset] = 1
                    queue.append((next_x, next_y))
            if len(component) > len(largest):
                largest = component

    result = Image.new("L", (width, height), 0)
    result_pixels = result.load()
    for x, y in largest:
        result_pixels[x, y] = 255
    return result.filter(ImageFilter.GaussianBlur(0.65))


def extract_panel(sheet, index):
    sheet_width, sheet_height = sheet.size
    left = round(index * sheet_width / len(FRAME_NAMES)) + (3 if index else 0)
    right = round((index + 1) * sheet_width / len(FRAME_NAMES)) - (3 if index < len(FRAME_NAMES) - 1 else 0)
    panel = sheet.crop((left, 0, right, sheet_height)).convert("RGBA")
    alpha = keep_largest_component(connected_background_mask(panel))
    panel.putalpha(alpha)
    bounds = alpha.getbbox()
    if not bounds:
        raise RuntimeError("No subject detected in panel %d" % index)
    panel = panel.crop(bounds)
    restored_width = round(panel.width * HORIZONTAL_RESTORE)
    return panel.resize((restored_width, panel.height), Image.Resampling.LANCZOS)


def checkerboard(size, tile=16):
    image = Image.new("RGB", size, "#d9dee5")
    draw = ImageDraw.Draw(image)
    for y in range(0, size[1], tile):
        for x in range(0, size[0], tile):
            if (x // tile + y // tile) % 2:
                draw.rectangle((x, y, x + tile - 1, y + tile - 1), fill="#f1f3f6")
    return image


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    sheet = Image.open(SOURCE)
    extracted = [extract_panel(sheet, index) for index in range(len(FRAME_NAMES))]

    max_width = max(image.width for image in extracted)
    max_height = max(image.height for image in extracted)
    common_scale = min(484 / max_width, 292 / max_height)
    frames = []
    for name, image in zip(FRAME_NAMES, extracted):
        resized = image.resize(
            (round(image.width * common_scale), round(image.height * common_scale)),
            Image.Resampling.LANCZOS,
        )
        frame = Image.new("RGBA", FRAME_SIZE, (0, 0, 0, 0))
        x = (FRAME_SIZE[0] - resized.width) // 2
        y = 300 - resized.height
        frame.alpha_composite(resized, (x, y))
        frame.save(OUTPUT / (name + ".png"), optimize=True)
        frames.append(frame)

    atlas = Image.new("RGBA", (FRAME_SIZE[0] * len(frames), FRAME_SIZE[1]), (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        atlas.alpha_composite(frame, (index * FRAME_SIZE[0], 0))
    atlas.save(OUTPUT / "pushed-stove-atlas.png", optimize=True)

    preview = checkerboard(atlas.size)
    preview.paste(atlas, (0, 0), atlas)
    preview.save(OUTPUT / "pushed-stove-preview.jpg", quality=88, optimize=True)

    print("Built %d frames at %dx%d" % (len(frames), FRAME_SIZE[0], FRAME_SIZE[1]))
    print("Atlas: %s" % (OUTPUT / "pushed-stove-atlas.png"))


if __name__ == "__main__":
    main()
