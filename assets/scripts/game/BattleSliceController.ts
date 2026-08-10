import {
  _decorator,
  Color,
  Component,
  EventTouch,
  Label,
  Node,
  ResolutionPolicy,
  SpriteFrame,
  UITransform,
  Vec2,
  view,
} from 'cc';

import { CHEF_POOL_CAPACITY } from '../core/BattleConfig';
import { BattleWorld } from '../core/BattleWorld';
import { PlatformLifecycle } from '../platform/PlatformLifecycle';
import { BattlePresenter } from '../presentation/BattlePresenter';
import { PerformanceHud } from '../presentation/PerformanceHud';
import { FixedStepRunner } from './FixedStepRunner';

const { ccclass, property } = _decorator;

@ccclass('BattleSliceController')
export class BattleSliceController extends Component {
  @property(Node)
  public playerNode: Node | null = null;

  @property(Node)
  public enemyLayer: Node | null = null;

  @property(Node)
  public slashLayer: Node | null = null;

  @property(Node)
  public hudNode: Node | null = null;

  @property(SpriteFrame)
  public guanAtlas: SpriteFrame | null = null;

  @property(SpriteFrame)
  public chefAtlas: SpriteFrame | null = null;

  private readonly world = new BattleWorld();
  private readonly runner = new FixedStepRunner(this.world);
  private readonly touchStart = new Vec2();
  private readonly touchCurrent = new Vec2();

  private presenter: BattlePresenter | null = null;
  private performanceHud: PerformanceHud | null = null;
  private lifecycle: PlatformLifecycle | null = null;
  private activeTouchId = -1;
  private waitingForResumeTouch = false;

  protected onLoad(): void {
    view.setDesignResolutionSize(390, 844, ResolutionPolicy.FIXED_HEIGHT);
    const rootTransform = this.node.getComponent(UITransform);
    rootTransform?.setContentSize(view.getVisibleSize());

    if (
      this.playerNode === null
      || this.enemyLayer === null
      || this.slashLayer === null
      || this.hudNode === null
      || this.guanAtlas === null
      || this.chefAtlas === null
    ) {
      throw new Error('BattleSlice scene references are incomplete.');
    }

    this.presenter = new BattlePresenter(
      this.playerNode,
      this.enemyLayer,
      this.slashLayer,
      this.guanAtlas,
      this.chefAtlas,
    );

    let hudTransform = this.hudNode.getComponent(UITransform);
    if (hudTransform === null) {
      hudTransform = this.hudNode.addComponent(UITransform);
    }
    hudTransform.setContentSize(360, 72);
    hudTransform.setAnchorPoint(0, 1);
    let label = this.hudNode.getComponent(Label);
    if (label === null) {
      label = this.hudNode.addComponent(Label);
    }
    label.fontSize = 16;
    label.lineHeight = 19;
    label.color = new Color(76, 52, 30, 235);
    label.horizontalAlign = Label.HorizontalAlign.LEFT;
    label.verticalAlign = Label.VerticalAlign.TOP;
    label.string = 'FPS --  Frame --\nDraw --  Nodes --\nChef Pool --';
    this.performanceHud = new PerformanceHud(label, this.node.scene, CHEF_POOL_CAPACITY);

    this.lifecycle = new PlatformLifecycle(
      this.handlePlatformHide,
      this.handlePlatformShow,
    );
    this.lifecycle.start();
  }

  protected onEnable(): void {
    this.node.on(Node.EventType.TOUCH_START, this.handleTouchStart, this);
    this.node.on(Node.EventType.TOUCH_MOVE, this.handleTouchMove, this);
    this.node.on(Node.EventType.TOUCH_END, this.handleTouchEnd, this);
    this.node.on(Node.EventType.TOUCH_CANCEL, this.handleTouchEnd, this);
  }

  protected onDisable(): void {
    this.node.off(Node.EventType.TOUCH_START, this.handleTouchStart, this);
    this.node.off(Node.EventType.TOUCH_MOVE, this.handleTouchMove, this);
    this.node.off(Node.EventType.TOUCH_END, this.handleTouchEnd, this);
    this.node.off(Node.EventType.TOUCH_CANCEL, this.handleTouchEnd, this);
    this.activeTouchId = -1;
    this.world.setMovement(0, 0);
  }

  protected onDestroy(): void {
    this.lifecycle?.stop();
    this.presenter?.destroy();
  }

  protected update(deltaTime: number): void {
    const alpha = this.runner.advance(deltaTime);
    const snapshot = this.world.getSnapshot();
    this.presenter?.sync(snapshot, alpha, deltaTime);
    this.performanceHud?.update(deltaTime, snapshot.activeEnemyCount);
  }

  private readonly handlePlatformHide = (): void => {
    this.world.setMovement(0, 0);
    this.runner.setPaused(true);
    this.waitingForResumeTouch = true;
    this.activeTouchId = -1;
  };

  private readonly handlePlatformShow = (): void => {
    this.runner.setPaused(true);
    this.waitingForResumeTouch = true;
  };

  private handleTouchStart(event: EventTouch): void {
    if (this.activeTouchId >= 0 || event.touch === null) {
      return;
    }
    this.activeTouchId = event.touch.getID();
    event.touch.getUILocation(this.touchStart);
    this.touchCurrent.set(this.touchStart);
    this.world.setMovement(0, 0);
    if (this.waitingForResumeTouch) {
      this.waitingForResumeTouch = false;
      this.runner.setPaused(false);
    }
  }

  private handleTouchMove(event: EventTouch): void {
    if (event.touch === null || event.touch.getID() !== this.activeTouchId) {
      return;
    }
    event.touch.getUILocation(this.touchCurrent);
    const deltaX = this.touchCurrent.x - this.touchStart.x;
    const deltaY = this.touchCurrent.y - this.touchStart.y;
    const distanceSquared = deltaX * deltaX + deltaY * deltaY;
    if (distanceSquared <= 64) {
      this.world.setMovement(0, 0);
      return;
    }
    const inverseDistance = 1 / Math.sqrt(distanceSquared);
    this.world.setMovement(deltaX * inverseDistance, deltaY * inverseDistance);
  }

  private handleTouchEnd(event: EventTouch): void {
    if (event.touch === null || event.touch.getID() !== this.activeTouchId) {
      return;
    }
    this.activeTouchId = -1;
    this.world.setMovement(0, 0);
  }
}
