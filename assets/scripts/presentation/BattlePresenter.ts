import {
  Color,
  Node,
  Sprite,
  SpriteFrame,
  UITransform,
  Vec3,
} from 'cc';

import {
  CHEF_POOL_CAPACITY,
  GREEN_DRAGON_VISUAL_SECONDS,
} from '../core/BattleConfig';
import type { BattleSnapshot } from '../core/BattleTypes';
import { destroyRuntimeFrames, sliceHorizontalAtlas } from './RuntimeAtlas';

interface EnemyView {
  readonly node: Node;
  readonly sprite: Sprite;
}

function lerp(previous: number, current: number, alpha: number): number {
  return previous + (current - previous) * alpha;
}

function prepareSpriteNode(
  node: Node,
  frame: SpriteFrame,
  width: number,
  height: number,
  anchorX: number,
  anchorY: number,
): Sprite {
  let transform = node.getComponent(UITransform);
  if (transform === null) {
    transform = node.addComponent(UITransform);
  }
  transform.setContentSize(width, height);
  transform.setAnchorPoint(anchorX, anchorY);
  let sprite = node.getComponent(Sprite);
  if (sprite === null) {
    sprite = node.addComponent(Sprite);
  }
  sprite.sizeMode = Sprite.SizeMode.CUSTOM;
  sprite.spriteFrame = frame;
  return sprite;
}

export class BattlePresenter {
  private readonly playerFrames: SpriteFrame[];
  private readonly chefFrames: SpriteFrame[];
  private readonly playerSprite: Sprite;
  private readonly enemyViews: EnemyView[] = [];
  private readonly slashNode: Node;
  private readonly slashSprite: Sprite;
  private readonly position = new Vec3();
  private readonly slashColor = new Color(255, 244, 194, 225);

  private lastAttackSerial = 0;
  private slashTime = 0;
  private slashFacingX = 0;
  private slashFacingY = 1;
  private slashHalfAngle = 0;

  public constructor(
    private readonly playerNode: Node,
    enemyLayer: Node,
    slashLayer: Node,
    guanAtlas: SpriteFrame,
    chefAtlas: SpriteFrame,
    guandaoFrame: SpriteFrame,
  ) {
    this.playerFrames = sliceHorizontalAtlas(guanAtlas, 384, 288, 6);
    this.chefFrames = sliceHorizontalAtlas(chefAtlas, 288, 288, 6);
    this.playerSprite = prepareSpriteNode(playerNode, this.playerFrames[0], 101.33, 76, 0.599, 0.22);

    for (let slot = 0; slot < CHEF_POOL_CAPACITY; slot += 1) {
      const node = new Node(`Chef-${slot + 1}`);
      node.layer = enemyLayer.layer;
      enemyLayer.addChild(node);
      const sprite = prepareSpriteNode(node, this.chefFrames[1], 60, 60, 0.5, 0.2);
      node.active = false;
      this.enemyViews.push({ node, sprite });
    }

    this.slashNode = new Node('GreenDragonSlash-1');
    this.slashNode.layer = slashLayer.layer;
    slashLayer.addChild(this.slashNode);
    this.slashSprite = prepareSpriteNode(this.slashNode, guandaoFrame, 128, 20.25, 0.18, 0.5);
    this.slashSprite.color = this.slashColor;
    this.slashNode.active = false;
  }

  public sync(snapshot: BattleSnapshot, alpha: number, frameDeltaSeconds: number): void {
    this.syncPlayer(snapshot, alpha);
    this.syncEnemies(snapshot, alpha);
    if (snapshot.attack.serial !== this.lastAttackSerial) {
      this.lastAttackSerial = snapshot.attack.serial;
      this.slashTime = GREEN_DRAGON_VISUAL_SECONDS;
      this.slashFacingX = snapshot.attack.facingX;
      this.slashFacingY = snapshot.attack.facingY;
      this.slashHalfAngle = snapshot.attack.halfAngle;
      this.slashNode.active = true;
    }
    this.syncSlash(snapshot, frameDeltaSeconds);
  }

  public destroy(): void {
    destroyRuntimeFrames(this.playerFrames);
    destroyRuntimeFrames(this.chefFrames);
  }

  private syncPlayer(snapshot: BattleSnapshot, alpha: number): void {
    const player = snapshot.player;
    this.position.set(
      lerp(player.previousX, player.x, alpha),
      lerp(player.previousY, player.y, alpha),
      0,
    );
    this.playerNode.setPosition(this.position);
    const frameIndex = player.moving ? 1 + Math.floor(player.walkTime * 4) % 2 : 0;
    if (this.playerSprite.spriteFrame !== this.playerFrames[frameIndex]) {
      this.playerSprite.spriteFrame = this.playerFrames[frameIndex];
    }
    this.playerNode.setScale(player.facingX < 0 ? -1 : 1, 1, 1);
  }

  private syncEnemies(snapshot: BattleSnapshot, alpha: number): void {
    for (let slot = 0; slot < this.enemyViews.length; slot += 1) {
      const enemy = snapshot.enemies[slot];
      const view = this.enemyViews[slot];
      if (!enemy.active) {
        view.node.active = false;
        continue;
      }
      view.node.active = true;
      this.position.set(
        lerp(enemy.previousX, enemy.x, alpha),
        lerp(enemy.previousY, enemy.y, alpha),
        0,
      );
      view.node.setPosition(this.position);
      const frameIndex = 1 + Math.floor(enemy.age * 4) % 2;
      if (view.sprite.spriteFrame !== this.chefFrames[frameIndex]) {
        view.sprite.spriteFrame = this.chefFrames[frameIndex];
      }
      const directionScale = enemy.facingX > 0 ? -1 : 1;
      if (enemy.hitFlash > 0) {
        view.node.setScale(directionScale * 1.08, 0.92, 1);
      } else {
        view.node.setScale(directionScale, 1, 1);
      }
    }
  }

  private syncSlash(snapshot: BattleSnapshot, frameDeltaSeconds: number): void {
    if (this.slashTime <= 0) {
      this.slashNode.active = false;
      return;
    }
    this.slashTime = Math.max(0, this.slashTime - frameDeltaSeconds);
    const progress = 1 - this.slashTime / GREEN_DRAGON_VISUAL_SECONDS;
    const player = snapshot.player;
    this.position.set(player.x, player.y + 8, 0);
    this.slashNode.setPosition(this.position);
    const baseAngle = Math.atan2(this.slashFacingY, this.slashFacingX);
    const sweepAngle = -this.slashHalfAngle + this.slashHalfAngle * 2 * Math.min(1, progress);
    this.slashNode.angle = (baseAngle + sweepAngle) * 180 / Math.PI;
    const sweepScale = 0.68 + Math.sin(Math.min(1, progress) * Math.PI) * 0.42;
    this.slashNode.setScale(sweepScale, sweepScale, 1);
    const alpha = Math.round(225 * Math.max(0, 1 - progress * progress));
    this.slashColor.a = alpha;
    this.slashSprite.color = this.slashColor;
  }
}
