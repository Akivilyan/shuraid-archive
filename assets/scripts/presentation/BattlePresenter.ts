import {
  Animation,
  AnimationClip,
  Color,
  Graphics,
  Node,
  Sprite,
  SpriteFrame,
  Tween,
  UIOpacity,
  UITransform,
  Vec3,
  tween,
} from 'cc';

import {
  CHEF_POOL_CAPACITY,
  GREEN_DRAGON_VISUAL_SECONDS,
} from '../core/BattleConfig';
import type { AttackSnapshot, BattleSnapshot } from '../core/BattleTypes';
import { destroyRuntimeFrames, sliceHorizontalAtlas } from './RuntimeAtlas';

interface EnemyView {
  readonly node: Node;
  readonly sprite: Sprite;
}

const PLAYER_IDLE_ANIMATION = 'guan-idle';
const PLAYER_MOVE_ANIMATION = 'guan-move';
const PLAYER_ATTACK_ANIMATION = 'guan-attack';
const FACING_DEAD_ZONE = 0.08;

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

function createSpriteClip(
  name: string,
  frames: SpriteFrame[],
  sample: number,
  loop: boolean,
): AnimationClip {
  const clip = AnimationClip.createWithSpriteFrames(frames, sample);
  clip.name = name;
  clip.wrapMode = loop
    ? AnimationClip.WrapMode.Loop
    : AnimationClip.WrapMode.Normal;
  return clip;
}

function resolveFacingSign(facingX: number, fallback: number): number {
  if (facingX < -FACING_DEAD_ZONE) {
    return -1;
  }
  if (facingX > FACING_DEAD_ZONE) {
    return 1;
  }
  return fallback;
}

export class BattlePresenter {
  private readonly playerFrames: SpriteFrame[];
  private readonly chefFrames: SpriteFrame[];
  private readonly playerVisualNode: Node;
  private readonly playerAnimation: Animation;
  private readonly playerClips: AnimationClip[];
  private readonly enemyViews: EnemyView[] = [];
  private readonly slashNode: Node;
  private readonly slashOuter: Graphics;
  private readonly slashInner: Graphics;
  private readonly slashOpacity: UIOpacity;
  private readonly position = new Vec3();
  private readonly slashStartScale = new Vec3(0.88, 0.88, 1);
  private readonly slashEndScale = new Vec3(1, 1, 1);
  private readonly slashOuterColor = new Color(62, 226, 174, 185);
  private readonly slashInnerColor = new Color(255, 239, 166, 235);

  private lastAttackSerial = 0;
  private attackTime = 0;
  private visualFacingSign = 1;
  private currentPlayerAnimation = '';

  public constructor(
    private readonly playerNode: Node,
    enemyLayer: Node,
    slashLayer: Node,
    guanAtlas: SpriteFrame,
    chefAtlas: SpriteFrame,
  ) {
    this.playerFrames = sliceHorizontalAtlas(guanAtlas, 384, 288, 6);
    this.chefFrames = sliceHorizontalAtlas(chefAtlas, 288, 288, 6);

    const serializedPlayerSprite = playerNode.getComponent(Sprite);
    if (serializedPlayerSprite !== null) {
      serializedPlayerSprite.enabled = false;
    }
    this.playerVisualNode = new Node('GuanVisual');
    this.playerVisualNode.layer = playerNode.layer;
    playerNode.addChild(this.playerVisualNode);
    prepareSpriteNode(this.playerVisualNode, this.playerFrames[0], 101.33, 76, 0.5, 0.22);

    this.playerAnimation = this.playerVisualNode.addComponent(Animation);
    this.playerClips = [
      createSpriteClip(PLAYER_IDLE_ANIMATION, [this.playerFrames[0]], 1, true),
      createSpriteClip(PLAYER_MOVE_ANIMATION, [this.playerFrames[1], this.playerFrames[2]], 8, true),
      createSpriteClip(
        PLAYER_ATTACK_ANIMATION,
        [this.playerFrames[3], this.playerFrames[3], this.playerFrames[4], this.playerFrames[4]],
        12,
        false,
      ),
    ];
    for (let index = 0; index < this.playerClips.length; index += 1) {
      this.playerAnimation.addClip(this.playerClips[index]);
    }
    this.playPlayerAnimation(PLAYER_IDLE_ANIMATION);

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
    const slashTransform = this.slashNode.addComponent(UITransform);
    slashTransform.setContentSize(240, 240);
    slashTransform.setAnchorPoint(0.5, 0.5);
    this.slashOuter = this.slashNode.addComponent(Graphics);
    this.slashOuter.lineCap = Graphics.LineCap.ROUND;

    const slashCoreNode = new Node('GreenDragonSlash-Core');
    slashCoreNode.layer = slashLayer.layer;
    this.slashNode.addChild(slashCoreNode);
    const slashCoreTransform = slashCoreNode.addComponent(UITransform);
    slashCoreTransform.setContentSize(240, 240);
    slashCoreTransform.setAnchorPoint(0.5, 0.5);
    this.slashInner = slashCoreNode.addComponent(Graphics);
    this.slashInner.lineCap = Graphics.LineCap.ROUND;

    this.slashOpacity = this.slashNode.addComponent(UIOpacity);
    this.slashNode.active = false;
  }

  public sync(snapshot: BattleSnapshot, alpha: number, frameDeltaSeconds: number): void {
    if (snapshot.attack.serial !== this.lastAttackSerial) {
      this.lastAttackSerial = snapshot.attack.serial;
      this.beginAttack(snapshot.attack);
    }
    this.syncPlayer(snapshot, alpha, frameDeltaSeconds);
    this.syncEnemies(snapshot, alpha);
  }

  public destroy(): void {
    Tween.stopAllByTarget(this.slashNode);
    Tween.stopAllByTarget(this.slashOpacity);
    this.playerAnimation.stop();
    for (let index = 0; index < this.playerClips.length; index += 1) {
      this.playerClips[index].destroy();
    }
    destroyRuntimeFrames(this.playerFrames);
    destroyRuntimeFrames(this.chefFrames);
  }

  private syncPlayer(
    snapshot: BattleSnapshot,
    alpha: number,
    frameDeltaSeconds: number,
  ): void {
    const player = snapshot.player;
    this.position.set(
      lerp(player.previousX, player.x, alpha),
      lerp(player.previousY, player.y, alpha),
      0,
    );
    this.playerNode.setPosition(this.position);
    this.visualFacingSign = resolveFacingSign(player.facingX, this.visualFacingSign);
    this.playerVisualNode.setScale(this.visualFacingSign, 1, 1);

    if (this.attackTime > 0) {
      this.playPlayerAnimation(PLAYER_ATTACK_ANIMATION);
      this.attackTime = Math.max(0, this.attackTime - frameDeltaSeconds);
      return;
    }

    this.playPlayerAnimation(
      player.moving ? PLAYER_MOVE_ANIMATION : PLAYER_IDLE_ANIMATION,
    );
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

  private beginAttack(attack: AttackSnapshot): void {
    this.attackTime = GREEN_DRAGON_VISUAL_SECONDS;
    this.playPlayerAnimation(PLAYER_ATTACK_ANIMATION);

    Tween.stopAllByTarget(this.slashNode);
    Tween.stopAllByTarget(this.slashOpacity);
    this.drawSlashEffect(attack.range, attack.halfAngle);
    this.position.set(attack.x, attack.y + 8, 0);
    this.slashNode.setPosition(this.position);
    this.slashNode.angle = Math.atan2(attack.facingY, attack.facingX) * 180 / Math.PI;
    this.slashNode.setScale(this.slashStartScale);
    this.slashOpacity.opacity = 255;
    this.slashNode.active = true;

    tween(this.slashNode)
      .to(GREEN_DRAGON_VISUAL_SECONDS, { scale: this.slashEndScale }, { easing: 'quadOut' })
      .start();
    tween(this.slashOpacity)
      .delay(0.06)
      .to(GREEN_DRAGON_VISUAL_SECONDS - 0.06, { opacity: 0 }, { easing: 'quadIn' })
      .call(() => {
        this.slashNode.active = false;
      })
      .start();
  }

  private drawSlashEffect(range: number, halfAngle: number): void {
    const radius = Math.max(12, range);
    const startX = Math.cos(halfAngle) * radius;
    const startY = -Math.sin(halfAngle) * radius;
    this.slashOuter.clear();
    this.slashOuter.fillColor = this.slashOuterColor;
    this.slashOuter.moveTo(startX, startY);
    this.slashOuter.arc(0, 0, radius, -halfAngle, halfAngle, false);
    this.slashOuter.quadraticCurveTo(radius * 0.42, 0, startX, startY);
    this.slashOuter.close();
    this.slashOuter.fill();

    const innerRadius = Math.max(8, radius - 10);
    const innerHalfAngle = halfAngle * 0.8;
    const innerStartX = Math.cos(innerHalfAngle) * innerRadius;
    const innerStartY = -Math.sin(innerHalfAngle) * innerRadius;
    this.slashInner.clear();
    this.slashInner.fillColor = this.slashInnerColor;
    this.slashInner.moveTo(innerStartX, innerStartY);
    this.slashInner.arc(0, 0, innerRadius, -innerHalfAngle, innerHalfAngle, false);
    this.slashInner.quadraticCurveTo(innerRadius * 0.56, 0, innerStartX, innerStartY);
    this.slashInner.close();
    this.slashInner.fill();
  }

  private playPlayerAnimation(name: string): void {
    if (this.currentPlayerAnimation === name) {
      return;
    }
    this.currentPlayerAnimation = name;
    this.playerAnimation.play(name);
  }
}
