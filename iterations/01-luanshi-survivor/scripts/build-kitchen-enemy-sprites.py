from pathlib import Path
import runpy

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
HELPERS = runpy.run_path(str(ROOT / "scripts" / "build-pushed-stove-sprites.py"))
connected_background_mask = HELPERS["connected_background_mask"]
keep_largest_component = HELPERS["keep_largest_component"]
checkerboard = HELPERS["checkerboard"]

FRAME_NAMES = ("idle", "move-a", "move-b", "attack-windup", "attack-contact", "hurt")
FRAME_SIZE = (384, 384)
SOURCE_SCALE = 0.72
TARGET_BODY_X = 192

ENEMIES = (
    {
        "name": "head-cook",
        "source": ROOT / "assets" / "concepts" / "enemy-head-cook-motion-study-v1.png",
        "anchors": (258, 260, 258, 248, 266, 260),
    },
    {
        "name": "pot-lid-guard",
        "source": ROOT / "assets" / "concepts" / "enemy-pot-lid-guard-motion-study-v1.png",
        "anchors": (264, 264, 268, 252, 270, 278),
    },
    {
        "name": "bun-thrower",
        "source": ROOT / "assets" / "concepts" / "enemy-bun-thrower-motion-study-v1.png",
        "anchors": (250, 252, 252, 246, 246, 258),
    },
)


def extract_panel(sheet, index):
    column = index % 3
    row = index // 3
    cell_width = sheet.width // 3
    cell_height = sheet.height // 2
    inset = 8
    panel = sheet.crop((
        column * cell_width + inset,
        row * cell_height + inset,
        (column + 1) * cell_width - inset,
        (row + 1) * cell_height - inset,
    )).convert("RGBA")
    alpha = keep_largest_component(connected_background_mask(panel))
    panel.putalpha(alpha)
    return panel


def normalize_frame(panel, body_anchor_x):
    resized = panel.resize(
        (round(panel.width * SOURCE_SCALE), round(panel.height * SOURCE_SCALE)),
        Image.Resampling.LANCZOS,
    )
    bounds = resized.getchannel("A").getbbox()
    if not bounds:
        raise RuntimeError("No enemy subject detected")
    adjusted_anchor = (body_anchor_x - 8) * SOURCE_SCALE
    offset_x = round(TARGET_BODY_X - adjusted_anchor)
    offset_y = 374 - bounds[3]
    frame = Image.new("RGBA", FRAME_SIZE, (0, 0, 0, 0))
    frame.alpha_composite(resized, (offset_x, offset_y))
    return frame


def build_enemy(config):
    output = ROOT / "assets" / "sprites" / "enemies" / config["name"]
    output.mkdir(parents=True, exist_ok=True)
    sheet = Image.open(config["source"])
    frames = []
    for index, frame_name in enumerate(FRAME_NAMES):
        frame = normalize_frame(extract_panel(sheet, index), config["anchors"][index])
        frame.save(output / (frame_name + ".png"), optimize=True)
        frames.append(frame)

    atlas = Image.new("RGBA", (FRAME_SIZE[0] * len(frames), FRAME_SIZE[1]), (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        atlas.alpha_composite(frame, (index * FRAME_SIZE[0], 0))
    atlas_path = output / (config["name"] + "-atlas.png")
    atlas.save(atlas_path, optimize=True)

    preview = checkerboard(atlas.size)
    preview.paste(atlas, (0, 0), atlas)
    preview.save(output / (config["name"] + "-preview.jpg"), quality=88, optimize=True)
    print("Built %s: %s" % (config["name"], atlas_path))


def main():
    for config in ENEMIES:
        build_enemy(config)


if __name__ == "__main__":
    main()
