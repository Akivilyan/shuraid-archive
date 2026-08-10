import { Rect, Size, SpriteFrame, Vec2 } from 'cc';

export function sliceHorizontalAtlas(
  source: SpriteFrame,
  frameWidth: number,
  frameHeight: number,
  frameCount: number,
): SpriteFrame[] {
  const frames: SpriteFrame[] = [];
  for (let index = 0; index < frameCount; index += 1) {
    const frame = new SpriteFrame();
    frame.reset({
      texture: source.texture,
      rect: new Rect(index * frameWidth, 0, frameWidth, frameHeight),
      originalSize: new Size(frameWidth, frameHeight),
      offset: new Vec2(0, 0),
    }, true);
    frames.push(frame);
  }
  return frames;
}

export function destroyRuntimeFrames(frames: readonly SpriteFrame[]): void {
  for (let index = 0; index < frames.length; index += 1) {
    frames[index].destroy();
  }
}

