import {
  builtinResMgr,
  Color,
  Node,
  Rect,
  Size,
  Sprite,
  SpriteFrame,
  Texture2D,
  UITransform,
  Vec2,
} from "cc";

export interface SpriteNode {
  node: Node;
  sprite: Sprite;
  transform: UITransform;
}

let sharedSolidFrame: SpriteFrame | null = null;

export function getSolidFrame(): SpriteFrame {
  if (sharedSolidFrame) {
    return sharedSolidFrame;
  }
  const texture = builtinResMgr.get<Texture2D>("white-texture");
  const frame = new SpriteFrame();
  frame.texture = texture;
  frame.rect = new Rect(0, 0, 2, 2);
  frame.originalSize = new Size(2, 2);
  frame.offset = Vec2.ZERO;
  frame.packable = false;
  sharedSolidFrame = frame;
  return frame;
}

export function createSpriteNode(
  parent: Node,
  layer: number,
  name: string,
  frame: SpriteFrame,
  width: number,
  height: number,
  color: Color = Color.WHITE,
  anchorX = 0.5,
  anchorY = 0.5,
): SpriteNode {
  const node = new Node(name);
  node.layer = layer;
  node.setParent(parent);
  const transform = node.addComponent(UITransform);
  transform.setContentSize(width, height);
  transform.setAnchorPoint(anchorX, anchorY);
  const sprite = node.addComponent(Sprite);
  sprite.sizeMode = Sprite.SizeMode.CUSTOM;
  sprite.trim = false;
  sprite.spriteFrame = frame;
  sprite.color = color;
  return { node, sprite, transform };
}

export function createSolidNode(
  parent: Node,
  layer: number,
  name: string,
  width: number,
  height: number,
  color: Color,
): SpriteNode {
  return createSpriteNode(parent, layer, name, getSolidFrame(), width, height, color);
}

export function createSlicedPanel(
  parent: Node,
  layer: number,
  name: string,
  frame: SpriteFrame,
  width: number,
  height: number,
  color: Color,
): SpriteNode {
  const result = createSpriteNode(parent, layer, name, frame, width, height, color);
  result.sprite.type = Sprite.Type.SLICED;
  return result;
}
