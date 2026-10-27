import {
  Color,
  Node,
  NodePool,
  Sprite,
  SpriteFrame,
  tween,
  Tween,
  UIOpacity,
  Vec3,
} from "cc";
import { BattleEvent } from "./BattleModel";
import { createSpriteNode } from "./ViewPrimitives";

interface BladeParts {
  opacity: UIOpacity;
  trail: Node;
}

interface RingParts {
  opacity: UIOpacity;
  halo: Node;
}

interface WineParts {
  opacity: UIOpacity;
  clones: Node[];
  cloneOpacities: UIOpacity[];
  wind: Node;
}

export class CombatVfxPool {
  private readonly layer: number;
  private readonly effectLayer: Node;
  private readonly weaponFrame: SpriteFrame;
  private readonly heroFrame: SpriteFrame;
  private readonly bladeFrame: SpriteFrame;
  private readonly ringFrame: SpriteFrame;
  private readonly windFrame: SpriteFrame;
  private readonly bladePool = new NodePool();
  private readonly ringPool = new NodePool();
  private readonly winePool = new NodePool();
  private readonly bladeParts = new Map<Node, BladeParts>();
  private readonly ringParts = new Map<Node, RingParts>();
  private readonly wineParts = new Map<Node, WineParts>();
  private readonly active = new Set<Node>();
  private readonly heroFollowers = new Set<Node>();

  constructor(
    layer: number,
    effectLayer: Node,
    weaponFrame: SpriteFrame,
    heroFrame: SpriteFrame,
    bladeFrame: SpriteFrame,
    ringFrame: SpriteFrame,
    windFrame: SpriteFrame,
  ) {
    this.layer = layer;
    this.effectLayer = effectLayer;
    this.weaponFrame = weaponFrame;
    this.heroFrame = heroFrame;
    this.bladeFrame = bladeFrame;
    this.ringFrame = ringFrame;
    this.windFrame = windFrame;
    this.prewarm(this.bladePool, 3, () => this.createBlade());
    this.prewarm(this.ringPool, 2, () => this.createRing());
    this.prewarm(this.winePool, 2, () => this.createWine());
  }

  play(event: BattleEvent): void {
    if (event.type === "blade") {
      this.playBlade(event);
    } else if (event.type === "ringblade") {
      this.playRing(event);
    } else if (event.type === "warm-wine") {
      this.playWarmWine(event);
    }
  }

  syncHero(x: number, y: number): void {
    for (const root of this.heroFollowers) {
      root.setPosition(x, y + 30);
    }
  }

  reset(): void {
    const roots = Array.from(this.active);
    for (const root of roots) {
      if (this.bladeParts.has(root)) {
        this.release(this.bladePool, root);
      } else if (this.ringParts.has(root)) {
        this.release(this.ringPool, root);
      } else if (this.wineParts.has(root)) {
        this.release(this.winePool, root);
      }
    }
  }

  private prewarm(pool: NodePool, count: number, factory: () => Node): void {
    for (let index = 0; index < count; index += 1) {
      const node = factory();
      node.active = false;
      pool.put(node);
    }
  }

  private acquire(pool: NodePool): Node | null {
    const node = pool.get();
    if (!node) {
      return null;
    }
    node.active = true;
    node.setParent(this.effectLayer);
    node.setScale(1, 1, 1);
    this.active.add(node);
    return node;
  }

  private release(pool: NodePool, root: Node): void {
    Tween.stopAllByTarget(root);
    const blade = this.bladeParts.get(root);
    if (blade) {
      Tween.stopAllByTarget(blade.opacity);
    }
    const ring = this.ringParts.get(root);
    if (ring) {
      Tween.stopAllByTarget(ring.opacity);
    }
    const wine = this.wineParts.get(root);
    if (wine) {
      Tween.stopAllByTarget(wine.opacity);
      for (let index = 0; index < wine.clones.length; index += 1) {
        Tween.stopAllByTarget(wine.clones[index]);
        Tween.stopAllByTarget(wine.cloneOpacities[index]);
      }
    }
    root.active = false;
    this.active.delete(root);
    this.heroFollowers.delete(root);
    pool.put(root);
  }

  private createBlade(): Node {
    const root = new Node("BladeFx");
    root.layer = this.layer;
    const opacity = root.addComponent(UIOpacity);
    const trail = createSpriteNode(root, this.layer, "BladeTrail", this.bladeFrame, 150, 86, new Color(145, 255, 176, 238), 0.18, 0.5);
    const weapon = createSpriteNode(root, this.layer, "BladeWeapon", this.weaponFrame, 160, 25, Color.WHITE, 0.18, 0.5);
    weapon.node.setPosition(0, 4);
    this.bladeParts.set(root, { opacity, trail: trail.node });
    return root;
  }

  private createRing(): Node {
    const root = new Node("RingBladeFx");
    root.layer = this.layer;
    const opacity = root.addComponent(UIOpacity);
    const halo = createSpriteNode(root, this.layer, "RingHalo", this.ringFrame, 260, 260, new Color(231, 252, 255, 220));
    const weapon = createSpriteNode(root, this.layer, "RingWeapon", this.weaponFrame, 176, 28, Color.WHITE, 0.18, 0.5);
    weapon.node.setPosition(0, 3);
    this.ringParts.set(root, { opacity, halo: halo.node });
    return root;
  }

  private createWine(): Node {
    const root = new Node("WarmWineFx");
    root.layer = this.layer;
    const opacity = root.addComponent(UIOpacity);
    const wind = createSpriteNode(root, this.layer, "WindLane", this.windFrame, 270, 72, new Color(255, 230, 126, 176), 0, 0.5);
    wind.node.setPosition(0, 16);
    const clones: Node[] = [];
    const cloneOpacities: UIOpacity[] = [];
    for (let index = 0; index < 3; index += 1) {
      const clone = createSpriteNode(root, this.layer, `WineClone-${index}`, this.heroFrame, 112, 84, Color.WHITE, 0.5, 0);
      const cloneOpacity = clone.node.addComponent(UIOpacity);
      clones.push(clone.node);
      cloneOpacities.push(cloneOpacity);
    }
    this.wineParts.set(root, { opacity, clones, cloneOpacities, wind: wind.node });
    return root;
  }

  private playBlade(event: Extract<BattleEvent, { type: "blade" }>): void {
    const root = this.acquire(this.bladePool);
    if (!root) {
      return;
    }
    const parts = this.bladeParts.get(root) as BladeParts;
    const angle = Math.atan2(event.facing.y, event.facing.x) * 180 / Math.PI;
    const halfAngle = event.halfAngle * 180 / Math.PI;
    root.setPosition(event.x, event.y + 30);
    this.heroFollowers.add(root);
    root.angle = angle - halfAngle;
    root.setScale(0.82, 0.82, 1);
    parts.opacity.opacity = 255;
    parts.trail.setScale(event.range / 112, event.range / 112, 1);
    tween(root)
      .to(event.life * 0.76, { angle: angle + halfAngle, scale: new Vec3(1, 1, 1) }, { easing: "sineOut" })
      .start();
    tween(parts.opacity)
      .delay(event.life * 0.42)
      .to(event.life * 0.58, { opacity: 0 }, { easing: "sineIn" })
      .call(() => this.release(this.bladePool, root))
      .start();
  }

  private playRing(event: Extract<BattleEvent, { type: "ringblade" }>): void {
    const root = this.acquire(this.ringPool);
    if (!root) {
      return;
    }
    const parts = this.ringParts.get(root) as RingParts;
    root.setPosition(event.x, event.y + 30);
    this.heroFollowers.add(root);
    root.angle = 0;
    root.setScale(0.88, 0.88, 1);
    parts.opacity.opacity = 255;
    const ringScale = event.range / 126;
    parts.halo.setScale(ringScale, ringScale, 1);
    tween(root)
      .to(event.life, { angle: -360 * event.rotations }, { easing: "linear" })
      .start();
    tween(parts.opacity)
      .delay(event.life * 0.62)
      .to(event.life * 0.38, { opacity: 0 }, { easing: "sineIn" })
      .call(() => this.release(this.ringPool, root))
      .start();
  }

  private playWarmWine(event: Extract<BattleEvent, { type: "warm-wine" }>): void {
    const root = this.acquire(this.winePool);
    if (!root) {
      return;
    }
    const parts = this.wineParts.get(root) as WineParts;
    const angle = Math.atan2(event.facing.y, event.facing.x) * 180 / Math.PI;
    const facingSign = event.facing.x < 0 ? -1 : 1;
    root.setPosition(event.x, event.y);
    root.angle = angle;
    parts.opacity.opacity = 255;
    parts.wind.setScale(event.range / 270, Math.max(0.72, event.halfWidth / 20), 1);
    for (let index = 0; index < parts.clones.length; index += 1) {
      const clone = parts.clones[index];
      const cloneOpacity = parts.cloneOpacities[index];
      const speedRatio = 1 - index * 0.09;
      clone.angle = -angle;
      clone.setPosition(-index * 16, 0);
      clone.setScale(facingSign * event.scale, event.scale, 1);
      cloneOpacity.opacity = 146 - index * 34;
      tween(clone)
        .to(event.life * (0.84 + index * 0.06), { position: new Vec3(event.range * speedRatio, 0, 0) }, { easing: "sineOut" })
        .start();
      tween(cloneOpacity)
        .delay(event.life * 0.46)
        .to(event.life * 0.54, { opacity: 0 }, { easing: "sineIn" })
        .start();
    }
    tween(parts.opacity)
      .delay(event.life * 0.48)
      .to(event.life * 0.52, { opacity: 0 }, { easing: "sineIn" })
      .call(() => this.release(this.winePool, root))
      .start();
  }
}
