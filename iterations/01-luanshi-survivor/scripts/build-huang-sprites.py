from pathlib import Path
import runpy

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "concepts" / "hero-huang-motion-study-v1.png"
OUTPUT = ROOT / "assets" / "sprites" / "heroes" / "huang"
HELPERS = runpy.run_path(str(ROOT / "scripts" / "build-pushed-stove-sprites.py"))

checkerboard = HELPERS["checkerboard"]

FRAME_NAMES = ("idle", "move-a", "move-b", "attack-windup", "attack-release", "hurt")
FRAME_SIZE = (512, 384)
SOURCE_SCALE = 0.72
TARGET_BASELINE_Y = 374


def extract_panel(sheet, index):
    column = index % 3
    row = index // 3
    cell_width = sheet.width // 3
    cell_height = sheet.height // 2
    return sheet.crop((
        column * cell_width,
        row * cell_height,
        (column + 1) * cell_width,
        (row + 1) * cell_height,
    )).convert("RGBA")


def normalize_frame(panel, index):
    resized = panel.resize(
        (round(panel.width * SOURCE_SCALE), round(panel.height * SOURCE_SCALE)),
        Image.Resampling.LANCZOS,
    )
    bounds = resized.getchannel("A").getbbox()
    if not bounds:
        raise RuntimeError("No Huang Zhong subject detected in panel %d" % index)
    offset_x = (FRAME_SIZE[0] - resized.width) // 2
    offset_y = TARGET_BASELINE_Y - bounds[3]
    frame = Image.new("RGBA", FRAME_SIZE, (0, 0, 0, 0))
    frame.alpha_composite(resized, (offset_x, offset_y))
    return frame


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    sheet = Image.open(SOURCE)
    if sheet.size != (1536, 1024):
        raise RuntimeError("Unexpected Huang Zhong motion study size: %s" % (sheet.size,))

    frames = []
    for index, name in enumerate(FRAME_NAMES):
        frame = normalize_frame(extract_panel(sheet, index), index)
        frame.save(OUTPUT / (name + ".png"), optimize=True)
        frames.append(frame)

    atlas = Image.new("RGBA", (FRAME_SIZE[0] * len(frames), FRAME_SIZE[1]), (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        atlas.alpha_composite(frame, (index * FRAME_SIZE[0], 0))
    atlas.save(OUTPUT / "huang-atlas.png", optimize=True)

    preview = checkerboard(atlas.size)
    preview.paste(atlas, (0, 0), atlas)
    preview.save(OUTPUT / "huang-preview.jpg", quality=88, optimize=True)

    print("Built %d Huang Zhong frames at %dx%d" % (len(frames), FRAME_SIZE[0], FRAME_SIZE[1]))
    print("Atlas: %s" % (OUTPUT / "huang-atlas.png"))


if __name__ == "__main__":
    main()
