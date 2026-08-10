from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "assets" / "runtime"

ATLASES = (
    ("pushed-stove-atlas.png", ROOT / "assets" / "sprites" / "enemies" / "pushed-stove" / "pushed-stove-atlas.png", 5, (512, 320), (384, 240)),
    ("guan-atlas.png", ROOT / "assets" / "sprites" / "heroes" / "guan" / "guan-atlas.png", 6, (512, 384), (384, 288)),
    ("huang-atlas.png", ROOT / "assets" / "sprites" / "heroes" / "huang" / "huang-atlas.png", 6, (512, 384), (384, 288)),
    ("zhuge-atlas.png", ROOT / "assets" / "sprites" / "heroes" / "zhuge" / "zhuge-atlas.png", 6, (512, 384), (384, 288)),
    ("head-cook-atlas.png", ROOT / "assets" / "sprites" / "enemies" / "head-cook" / "head-cook-atlas.png", 6, (384, 384), (288, 288)),
    ("pot-lid-guard-atlas.png", ROOT / "assets" / "sprites" / "enemies" / "pot-lid-guard" / "pot-lid-guard-atlas.png", 6, (384, 384), (288, 288)),
    ("bun-thrower-atlas.png", ROOT / "assets" / "sprites" / "enemies" / "bun-thrower" / "bun-thrower-atlas.png", 6, (384, 384), (288, 288)),
)

SHOWCASES = (
    ("guan-showcase-v1.jpg", ROOT / "assets" / "concepts" / "hero-guan-red-hare-showcase-v4-legs-fixed.png"),
    ("huang-showcase-v1.jpg", ROOT / "assets" / "concepts" / "hero-huang-chicken-showcase-v1.png"),
    ("zhuge-showcase-v1.jpg", ROOT / "assets" / "concepts" / "hero-zhuge-wooden-ox-convoy-showcase-v2-candidate.png"),
)


def resize_atlas(source_path, frame_count, source_size, target_size):
    source = Image.open(source_path).convert("RGBA")
    expected_size = (source_size[0] * frame_count, source_size[1])
    if source.size != expected_size:
        raise RuntimeError("Unexpected atlas size for %s: %s" % (source_path, source.size))
    target = Image.new("RGBA", (target_size[0] * frame_count, target_size[1]), (0, 0, 0, 0))
    for index in range(frame_count):
        frame = source.crop((index * source_size[0], 0, (index + 1) * source_size[0], source_size[1]))
        frame = frame.resize(target_size, Image.Resampling.LANCZOS)
        target.alpha_composite(frame, (index * target_size[0], 0))
    return target


def build_showcase(source_path):
    source = Image.open(source_path).convert("RGB")
    if source.size != (1024, 1536):
        raise RuntimeError("Unexpected showcase size for %s: %s" % (source_path, source.size))
    return source.resize((720, 1080), Image.Resampling.LANCZOS)


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    total = 0
    for filename, source, frame_count, source_size, target_size in ATLASES:
        atlas = resize_atlas(source, frame_count, source_size, target_size)
        destination = OUTPUT / filename
        atlas.save(destination, optimize=True)
        total += destination.stat().st_size
        print("Built %s: %dx%d, %d bytes" % (filename, atlas.width, atlas.height, destination.stat().st_size))
    print("Runtime atlases: %d bytes" % total)

    showcase_total = 0
    for filename, source in SHOWCASES:
        showcase = build_showcase(source)
        destination = OUTPUT / filename
        showcase.save(destination, quality=80, optimize=True)
        showcase_total += destination.stat().st_size
        print("Built %s: %dx%d, %d bytes" % (filename, showcase.width, showcase.height, destination.stat().st_size))
    print("Runtime showcases: %d bytes" % showcase_total)


if __name__ == "__main__":
    main()
