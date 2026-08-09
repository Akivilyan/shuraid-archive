from pathlib import Path
import runpy

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "concepts" / "hero-zhuge-motion-study-v1.png"
OUTPUT = ROOT / "assets" / "sprites" / "heroes" / "zhuge"
HELPERS = runpy.run_path(str(ROOT / "scripts" / "build-pushed-stove-sprites.py"))

connected_background_mask = HELPERS["connected_background_mask"]
keep_largest_component = HELPERS["keep_largest_component"]
checkerboard = HELPERS["checkerboard"]

FRAME_NAMES = ("idle", "move-a", "move-b", "cast-windup", "cast-release", "hurt")
FRAME_SIZE = (512, 384)
BODY_ANCHOR_X = (260, 258, 258, 272, 274, 260)
TARGET_BODY_X = 256
SOURCE_SCALE = 0.7


def extract_panel(sheet, index):
    column = index % 3
    row = index // 3
    cell_width = sheet.width // 3
    cell_height = sheet.height // 2
    panel = sheet.crop((
        column * cell_width + (3 if column else 0),
        row * cell_height + (3 if row else 0),
        (column + 1) * cell_width - (3 if column < 2 else 0),
        (row + 1) * cell_height - (3 if row < 1 else 0),
    )).convert("RGBA")
    alpha = keep_largest_component(connected_background_mask(panel))
    panel.putalpha(alpha)
    return panel


def normalize_frame(panel, index):
    resized = panel.resize(
        (round(panel.width * SOURCE_SCALE), round(panel.height * SOURCE_SCALE)),
        Image.Resampling.LANCZOS,
    )
    bounds = resized.getchannel("A").getbbox()
    if not bounds:
        raise RuntimeError("No Zhuge Liang subject detected in panel %d" % index)
    body_x = round(BODY_ANCHOR_X[index] * SOURCE_SCALE)
    offset_x = TARGET_BODY_X - body_x
    offset_y = 376 - bounds[3]
    frame = Image.new("RGBA", FRAME_SIZE, (0, 0, 0, 0))
    frame.alpha_composite(resized, (offset_x, offset_y))
    return frame


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    sheet = Image.open(SOURCE)
    frames = []
    for index, name in enumerate(FRAME_NAMES):
        frame = normalize_frame(extract_panel(sheet, index), index)
        frame.save(OUTPUT / (name + ".png"), optimize=True)
        frames.append(frame)

    atlas = Image.new("RGBA", (FRAME_SIZE[0] * len(frames), FRAME_SIZE[1]), (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        atlas.alpha_composite(frame, (index * FRAME_SIZE[0], 0))
    atlas.save(OUTPUT / "zhuge-atlas.png", optimize=True)

    preview = checkerboard(atlas.size)
    preview.paste(atlas, (0, 0), atlas)
    preview.save(OUTPUT / "zhuge-preview.jpg", quality=88, optimize=True)

    print("Built %d Zhuge Liang frames at %dx%d" % (len(frames), FRAME_SIZE[0], FRAME_SIZE[1]))
    print("Atlas: %s" % (OUTPUT / "zhuge-atlas.png"))


if __name__ == "__main__":
    main()
