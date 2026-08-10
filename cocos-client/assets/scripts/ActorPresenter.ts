import {
  _decorator,
  Color,
  Component,
  Node,
  NodePool,
  Sprite,
  SpriteFrame,
  Tween,
} from "cc";
import { BattleModel } from "./BattleModel";
import { createSpriteNode } from "./ViewPrimitives";

const { ccclass } = _decorator;

const HURT_COLOR = new Color(255, 145, 118, 255);
const NORMAL_COLOR = new Color(255, 255, 255, 255);
const SHADOW_COLOR = new Color(54, 44, 30, 82);

@ccclass("PooledActorState")
export class PooledActorState extends Component {
  sprite: Sprite | null = null;
  shadowNode: Node | null = null;
  frameIndex = -1;
  facingSign = 1;
  hurt = false;

  resetVisualState(): void {
    this.frameIndex = -1;
    this.facingSign = 1;
    this.hurt = false;
    if (this.sprite) {
      this.sprite.node.setScale(1, 1, 1);
      this.sprite.color = NORMAL_COLOR;
    }
  }
}

export class ActorPresenter {
  readonly hero: PooledActorState;
  readonly enemies = new Map<number, PooledActorState>();

  private readonly enemyPool = new NodePool();
  private readonly layer: number;
  private readonly worldLayer: Node;
  private readonly shadowLayer: Node;
  private readonly heroFrames: SpriteFrame[];
  private readonly enemyFrames: SpriteFrame[];
  private readonly shadowFrame: SpriteFrame;

  constructor(
    layer: number,
    worldLayer: Node,
    shadowLayer: Node,
    heroFrames: SpriteFrame[],
    enemyFrames: SpriteFrame[],
    shadowFrame: SpriteFrame,
    maxEnemies: number,
  ) {
    this.layer = layer;
    this.worldLayer = worldLayer;
    this.shadowLayer = shadowLayer;
    this.heroFrames = heroFrames;
    this.enemyFrames = enemyFrames;
    this.shadowFrame = shadowFrame;
    this.hero = this.createActor("GuanYu", heroFrames, 112, 84, 68, 16);
    this.hero.node.setParent(worldLayer);
    if (this.hero.shadowNode) {
      this.hero.shadowNode.setParent(shadowLayer);
    }
    for (let index = 0; index < maxEnemies; index += 1) {
      const state = this.createActor(`HeadCook-Pooled-${index + 1}`, enemyFrames, 64, 64, 38, 14);
      if (state.shadowNode) {
        state.shadowNode.active = false;
      }
      state.node.active = false;
      this.enemyPool.put(state.node);
    }
  }

  spawnEnemy(enemyId: number): void {
    const node = this.enemyPool.get();
    if (!node) {
      return;
    }
    const state = node.getComponent(PooledActorState);
    if (!state) {
      this.enemyPool.put(node);
      return;
    }
    node.name = `HeadCook-${enemyId}`;
    node.active = true;
    node.setParent(this.worldLayer);
    state.resetVisualState();
    if (state.shadowNode) {
      state.shadowNode.active = true;
      state.shadowNode.setParent(this.shadowLayer);
    }
    this.setFrame(state, this.enemyFrames, 0);
    this.enemies.set(enemyId, state);
  }

  releaseEnemy(enemyId: number): void {
    const state = this.enemies.get(enemyId);
    if (!state) {
      return;
    }
    Tween.stopAllByTarget(state.node);
    state.node.active = false;
    if (state.shadowNode) {
      state.shadowNode.active = false;
    }
    this.enemies.delete(enemyId);
    this.enemyPool.put(state.node);
  }

  resetEnemies(): void {
    const enemyIds = Array.from(this.enemies.keys());
    for (const enemyId of enemyIds) {
      this.releaseEnemy(enemyId);
    }
  }

  sync(model: BattleModel, animationTime: number, moving: boolean, interpolation = 1): void {
    const hero = model.hero;
    const alpha = Math.max(0, Math.min(1, interpolation));
    const heroX = hero.previousX + (hero.x - hero.previousX) * alpha;
    const heroY = hero.previousY + (hero.y - hero.previousY) * alpha;
    this.hero.node.setPosition(heroX, heroY);
    if (this.hero.shadowNode) {
      this.hero.shadowNode.setPosition(heroX, heroY + 4);
    }
    const heroFrame = moving ? 1 + Math.floor(animationTime * 6) % 2 : 0;
    this.setFrame(this.hero, this.heroFrames, heroFrame);
    this.setFacing(this.hero, hero.facing.x < -0.05 ? -1 : 1);

    for (let index = 0; index < model.enemies.length; index += 1) {
      const enemy = model.enemies[index];
      const actor = this.enemies.get(enemy.id);
      if (!actor) {
        continue;
      }
      const enemyX = enemy.previousX + (enemy.x - enemy.previousX) * alpha;
      const enemyY = enemy.previousY + (enemy.y - enemy.previousY) * alpha;
      actor.node.setPosition(enemyX, enemyY);
      if (actor.shadowNode) {
        actor.shadowNode.setPosition(enemyX, enemyY + 3);
      }
      const hurt = enemy.hurtTime > 0;
      const frameIndex = hurt ? 5 : 1 + Math.floor((animationTime + enemy.id * 0.13) * 5) % 2;
      this.setFrame(actor, this.enemyFrames, frameIndex);
      if (actor.hurt !== hurt && actor.sprite) {
        actor.hurt = hurt;
        actor.sprite.color = hurt ? HURT_COLOR : NORMAL_COLOR;
      }
      this.setFacing(actor, enemyX > heroX ? -1 : 1);
    }
  }

  getHeroRenderPosition(): { x: number; y: number } {
    return { x: this.hero.node.position.x, y: this.hero.node.position.y };
  }

  private createActor(
    name: string,
    frames: SpriteFrame[],
    width: number,
    height: number,
    shadowWidth: number,
    shadowHeight: number,
  ): PooledActorState {
    const actor = new Node(name);
    actor.layer = this.layer;
    const state = actor.addComponent(PooledActorState);
    const shadow = createSpriteNode(this.shadowLayer, this.layer, `${name}-Shadow`, this.shadowFrame, shadowWidth, shadowHeight, SHADOW_COLOR);
    const body = createSpriteNode(actor, this.layer, `${name}-Body`, frames[0], width, height, NORMAL_COLOR, 0.5, 0);
    state.sprite = body.sprite;
    state.shadowNode = shadow.node;
    state.frameIndex = 0;
    return state;
  }

  private setFrame(actor: PooledActorState, frames: SpriteFrame[], frameIndex: number): void {
    if (!actor.sprite || actor.frameIndex === frameIndex) {
      return;
    }
    actor.frameIndex = frameIndex;
    actor.sprite.spriteFrame = frames[frameIndex];
  }

  private setFacing(actor: PooledActorState, facingSign: number): void {
    if (!actor.sprite || actor.facingSign === facingSign) {
      return;
    }
    actor.facingSign = facingSign;
    actor.sprite.node.setScale(facingSign, 1, 1);
  }
}
