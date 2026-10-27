"""Build the compact runtime copy from the approved Guan Yu weapon master."""

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
MASTER = ROOT / "assets" / "concepts" / "guan-yanyuedao-master-v1.png"
RUNTIME = ROOT / "assets" / "runtime" / "guan-yanyuedao-v1.png"
RUNTIME_WIDTH = 1024


def main():
    master = Image.open(MASTER).convert("RGBA")
    if not master.getchannel("A").getbbox():
        raise RuntimeError("Weapon master contains no opaque pixels")

    runtime_height = round(master.height * RUNTIME_WIDTH / master.width)
    runtime = master.resize((RUNTIME_WIDTH, runtime_height), Image.Resampling.LANCZOS)
    runtime.save(RUNTIME, optimize=True)

    print(f"Source: {MASTER.name} {master.width}x{master.height}")
    print(f"Runtime: {RUNTIME.name} {runtime.width}x{runtime.height}")


if __name__ == "__main__":
    main()
