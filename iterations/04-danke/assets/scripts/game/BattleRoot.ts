import {
  _decorator,
  Color,
  Component,
  EventKeyboard,
  EventTouch,
  Graphics,
  HorizontalTextAlignment,
  input,
  Input,
  KeyCode,
  Label,
  LabelOutline,
  Layers,
  Node,
  ResolutionPolicy,
  UITransform,
  Vec2,
  Vec3,
  VerticalTextAlignment,
  view,
} from 'cc';
import { BattleEvent, BattleModel, DEFAULT_RUN_DURATION, FIXED_STEP, UpgradeId } from '../core/BattleModel';

const { ccclass } = _decorator;
const DESIGN_WIDTH = 390;
const DESIGN_HEIGHT = 844;
const JOYSTICK_RADIUS = 54;
const CARD_WIDTH = 326;
const CARD_HEIGHT = 112;
const RESTART_WIDTH = 280;
const RESTART_HEIGHT = 72;

interface VisualEffect {
  x: number;
  y: number;
  age: number;
  duration: number;
  radius: number;
  color: Color;
}

interface UpgradeCopy {
  title: string;
  detail: string;
  accent: Color;
}

const UPGRADE_COPY: Record<UpgradeId, UpgradeCopy> = {
  pulseDamage: {
    title: '脉冲增幅',
    detail: '弹丸伤害 +7',
    accent: new Color(255, 197, 92, 255),
  },
  pulseRate: {
    title: '超频核心',
    detail: '攻击间隔缩短 14%',
    accent: new Color(91, 226, 255, 255),
  },
  pulseCount: {
    title: '并联发射',
    detail: '每轮额外发射 1 枚',
    accent: new Color(150, 132, 255, 255),
  },
  orbit: {
    title: '磁轨环刃',
    detail: '获得或强化近身环刃',
    accent: new Color(85, 255, 184, 255),
  },
  vitality: {
    title: '生命扩容',
    detail: '生命上限 +20，并回复 30',
    accent: new Color(255, 105, 130, 255),
  },
};

@ccclass('BattleRoot')
export class BattleRoot extends Component {
  private model = new BattleModel();
  private accumulator = 0;
  private touchActive = false;
  private touchOrigin = new Vec2();
  private touchCurrent = new Vec2();
  private keys = new Set<KeyCode>();
  private effects: VisualEffect[] = [];

  private worldStatic!: Graphics;
  private enemyGraphics!: Graphics;
  private gemGraphics!: Graphics;
  private projectileGraphics!: Graphics;
  private actorGraphics!: Graphics;
  private effectGraphics!: Graphics;
  private hudGraphics!: Graphics;
  private joystickGraphics!: Graphics;

  private timerLabel!: Label;
  private killLabel!: Label;
  private hpLabel!: Label;
  private levelLabel!: Label;
  private hintLabel!: Label;
  private modalNode!: Node;

  onLoad(): void {
    view.setDesignResolutionSize(DESIGN_WIDTH, DESIGN_HEIGHT, ResolutionPolicy.FIXED_HEIGHT);
    const transform = this.node.getComponent(UITransform);
    if (transform) {
      transform.setContentSize(DESIGN_WIDTH, DESIGN_HEIGHT);
    }
    this.buildSceneGraph();
    this.drawStaticWorld();
    this.renderAll();
  }

  onEnable(): void {
    this.node.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
    this.node.on(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
    this.node.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
    this.node.on(Node.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
    input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
    input.on(Input.EventType.KEY_UP, this.onKeyUp, this);
  }

  onDisable(): void {
    this.node.off(Node.EventType.TOUCH_START, this.onTouchStart, this);
    this.node.off(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
    this.node.off(Node.EventType.TOUCH_END, this.onTouchEnd, this);
    this.node.off(Node.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
    input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
    input.off(Input.EventType.KEY_UP, this.onKeyUp, this);
  }

  update(dt: number): void {
    this.applyKeyboardInput();
    this.accumulator += Math.min(dt, 0.1);
    while (this.accumulator >= FIXED_STEP) {
      this.model.step(FIXED_STEP);
      this.accumulator -= FIXED_STEP;
    }
    this.processEvents(this.model.drainEvents());
    this.updateEffects(dt);
    this.renderAll();
  }

  private buildSceneGraph(): void {
    const staticNode = this.makeNode('ArenaBackground', this.node);
    this.worldStatic = staticNode.addComponent(Graphics);

    const gemNode = this.makeNode('ExperienceDrops', this.node);
    this.gemGraphics = gemNode.addComponent(Graphics);

    const enemyNode = this.makeNode('Enemies', this.node);
    this.enemyGraphics = enemyNode.addComponent(Graphics);

    const projectileNode = this.makeNode('Projectiles', this.node);
    this.projectileGraphics = projectileNode.addComponent(Graphics);

    const actorNode = this.makeNode('PlayerAndOrbit', this.node);
    this.actorGraphics = actorNode.addComponent(Graphics);

    const effectNode = this.makeNode('CombatFeedback', this.node);
    this.effectGraphics = effectNode.addComponent(Graphics);

    const hudNode = this.makeNode('HUD', this.node);
    this.hudGraphics = hudNode.addComponent(Graphics);
    this.timerLabel = this.makeLabel('Timer', hudNode, 24, new Color(255, 255, 255, 255));
    this.timerLabel.node.setPosition(0, 363);
    this.killLabel = this.makeLabel('Kills', hudNode, 17, new Color(221, 231, 240, 255));
    this.killLabel.node.setPosition(120, 334);
    this.hpLabel = this.makeLabel('Health', hudNode, 17, new Color(255, 225, 229, 255));
    this.hpLabel.node.setPosition(-112, 334);
    this.levelLabel = this.makeLabel('Level', hudNode, 16, new Color(191, 255, 222, 255));
    this.levelLabel.node.setPosition(-132, 396);
    this.hintLabel = this.makeLabel('Hint', hudNode, 15, new Color(198, 211, 222, 235));
    this.hintLabel.node.setPosition(0, -388);
    this.hintLabel.string = '按住并拖动屏幕移动';

    const joystickNode = this.makeNode('VirtualJoystick', this.node);
    this.joystickGraphics = joystickNode.addComponent(Graphics);

    this.modalNode = this.makeNode('Modal', this.node);
    this.modalNode.active = false;
  }

  private makeNode(name: string, parent: Node): Node {
    const node = new Node(name);
    node.layer = Layers.Enum.UI_2D;
    node.addComponent(UITransform).setContentSize(DESIGN_WIDTH, DESIGN_HEIGHT);
    parent.addChild(node);
    return node;
  }

  private makeLabel(name: string, parent: Node, fontSize: number, color: Color): Label {
    const node = new Node(name);
    node.layer = Layers.Enum.UI_2D;
    parent.addChild(node);
    const transform = node.addComponent(UITransform);
    transform.setContentSize(340, Math.max(48, fontSize * 2.2));
    const label = node.addComponent(Label);
    label.fontSize = fontSize;
    label.lineHeight = Math.round(fontSize * 1.25);
    label.color = color;
    label.horizontalAlign = HorizontalTextAlignment.CENTER;
    label.verticalAlign = VerticalTextAlignment.CENTER;
    const outline = node.addComponent(LabelOutline);
    outline.color = new Color(16, 24, 35, 230);
    outline.width = 2;
    return label;
  }

  private drawStaticWorld(): void {
    const graphics = this.worldStatic;
    graphics.clear();
    graphics.fillColor = new Color(15, 29, 42, 255);
    graphics.rect(-DESIGN_WIDTH / 2, -DESIGN_HEIGHT / 2, DESIGN_WIDTH, DESIGN_HEIGHT);
    graphics.fill();

    graphics.strokeColor = new Color(44, 73, 86, 110);
    graphics.lineWidth = 1;
    for (let x = -180; x <= 180; x += 36) {
      graphics.moveTo(x, -354);
      graphics.lineTo(x, 354);
    }
    for (let y = -354; y <= 354; y += 36) {
      graphics.moveTo(-180, y);
      graphics.lineTo(180, y);
    }
    graphics.stroke();

    graphics.strokeColor = new Color(72, 121, 131, 180);
    graphics.lineWidth = 3;
    graphics.roundRect(-181, -354, 362, 708, 18);
    graphics.stroke();
  }

  private renderAll(): void {
    this.renderGems();
    this.renderEnemies();
    this.renderProjectiles();
    this.renderPlayer();
    this.renderEffects();
    this.renderHud();
    this.renderJoystick();
  }

  private renderGems(): void {
    const graphics = this.gemGraphics;
    graphics.clear();
    graphics.fillColor = new Color(78, 255, 191, 255);
    graphics.strokeColor = new Color(210, 255, 239, 255);
    graphics.lineWidth = 2;
    for (const gem of this.model.gems) {
      const size = gem.value > 1 ? 10 : 7;
      graphics.moveTo(gem.x, gem.y + size);
      graphics.lineTo(gem.x + size * 0.72, gem.y);
      graphics.lineTo(gem.x, gem.y - size);
      graphics.lineTo(gem.x - size * 0.72, gem.y);
      graphics.close();
      graphics.fill();
      graphics.stroke();
    }
  }

  private renderEnemies(): void {
    const graphics = this.enemyGraphics;
    graphics.clear();

    graphics.fillColor = new Color(244, 91, 104, 255);
    graphics.strokeColor = new Color(255, 190, 179, 255);
    graphics.lineWidth = 2;
    for (const enemy of this.model.enemies) {
      if (!enemy.elite) {
        graphics.circle(enemy.x, enemy.y, enemy.radius);
      }
    }
    graphics.fill();
    graphics.stroke();

    graphics.fillColor = new Color(255, 155, 58, 255);
    graphics.strokeColor = new Color(255, 234, 150, 255);
    graphics.lineWidth = 4;
    for (const enemy of this.model.enemies) {
      if (!enemy.elite) {
        continue;
      }
      graphics.circle(enemy.x, enemy.y, enemy.radius);
      graphics.fill();
      graphics.circle(enemy.x, enemy.y, enemy.radius + 6);
      graphics.stroke();
      const healthRatio = Math.max(0, enemy.hp / enemy.maxHp);
      graphics.fillColor = new Color(47, 35, 41, 230);
      graphics.roundRect(enemy.x - 32, enemy.y + enemy.radius + 9, 64, 7, 3);
      graphics.fill();
      graphics.fillColor = new Color(255, 208, 71, 255);
      graphics.roundRect(enemy.x - 31, enemy.y + enemy.radius + 10, 62 * healthRatio, 5, 2);
      graphics.fill();
      graphics.fillColor = new Color(255, 155, 58, 255);
    }
  }

  private renderProjectiles(): void {
    const graphics = this.projectileGraphics;
    graphics.clear();
    graphics.fillColor = new Color(101, 222, 255, 255);
    graphics.strokeColor = new Color(223, 250, 255, 255);
    graphics.lineWidth = 2;
    for (const projectile of this.model.projectiles) {
      graphics.circle(projectile.x, projectile.y, projectile.radius);
    }
    graphics.fill();
    graphics.stroke();
  }

  private renderPlayer(): void {
    const graphics = this.actorGraphics;
    graphics.clear();
    const player = this.model.player;
    const flashing = player.invulnerable > 0 && Math.floor(player.invulnerable * 18) % 2 === 0;

    graphics.fillColor = flashing ? new Color(255, 255, 255, 150) : new Color(82, 224, 177, 255);
    graphics.strokeColor = new Color(218, 255, 241, 255);
    graphics.lineWidth = 3;
    graphics.circle(player.x, player.y, player.radius);
    graphics.fill();
    graphics.stroke();

    graphics.fillColor = new Color(18, 58, 65, 255);
    graphics.moveTo(player.x, player.y + 11);
    graphics.lineTo(player.x + 9, player.y - 8);
    graphics.lineTo(player.x - 9, player.y - 8);
    graphics.close();
    graphics.fill();

    graphics.fillColor = new Color(132, 255, 217, 255);
    graphics.strokeColor = new Color(236, 255, 248, 255);
    graphics.lineWidth = 2;
    for (const orbiter of this.model.getOrbitPositions()) {
      graphics.moveTo(orbiter.x, orbiter.y + 15);
      graphics.lineTo(orbiter.x + 8, orbiter.y);
      graphics.lineTo(orbiter.x, orbiter.y - 15);
      graphics.lineTo(orbiter.x - 8, orbiter.y);
      graphics.close();
      graphics.fill();
      graphics.stroke();
    }
  }

  private renderEffects(): void {
    const graphics = this.effectGraphics;
    graphics.clear();
    graphics.lineWidth = 3;
    for (const effect of this.effects) {
      const ratio = effect.age / effect.duration;
      const color = new Color(effect.color.r, effect.color.g, effect.color.b, Math.round(255 * (1 - ratio)));
      graphics.strokeColor = color;
      graphics.circle(effect.x, effect.y, effect.radius * (0.5 + ratio));
      graphics.stroke();
    }
  }

  private renderHud(): void {
    const graphics = this.hudGraphics;
    graphics.clear();
    graphics.fillColor = new Color(8, 18, 28, 220);
    graphics.roundRect(-181, 315, 362, 98, 16);
    graphics.fill();

    const xpRatio = Math.max(0, Math.min(1, this.model.xp / this.model.xpNeeded));
    graphics.fillColor = new Color(32, 58, 66, 255);
    graphics.roundRect(-172, 390, 344, 13, 6);
    graphics.fill();
    graphics.fillColor = new Color(71, 238, 180, 255);
    graphics.roundRect(-171, 391, 342 * xpRatio, 11, 5);
    graphics.fill();

    const hpRatio = this.model.player.hp / this.model.player.maxHp;
    graphics.fillColor = new Color(55, 39, 48, 255);
    graphics.roundRect(-172, 317, 116, 10, 5);
    graphics.fill();
    graphics.fillColor = hpRatio <= 0.3 ? new Color(255, 71, 90, 255) : new Color(255, 112, 129, 255);
    graphics.roundRect(-171, 318, 114 * hpRatio, 8, 4);
    graphics.fill();

    const remaining = Math.max(0, DEFAULT_RUN_DURATION - this.model.runTime);
    const minutes = Math.floor(remaining / 60);
    const seconds = Math.floor(remaining % 60);
    const secondsText = seconds < 10 ? '0' + seconds : seconds.toString();
    this.timerLabel.string = minutes + ':' + secondsText;
    this.killLabel.string = '击破 ' + this.model.kills;
    this.hpLabel.string = '生命 ' + Math.ceil(this.model.player.hp) + '/' + this.model.player.maxHp;
    this.levelLabel.string = 'LV.' + this.model.level;
    this.hintLabel.node.active = this.model.runTime < 6 && this.model.result === 'playing';
  }

  private renderJoystick(): void {
    const graphics = this.joystickGraphics;
    graphics.clear();
    if (!this.touchActive || this.model.paused) {
      return;
    }
    const dx = this.touchCurrent.x - this.touchOrigin.x;
    const dy = this.touchCurrent.y - this.touchOrigin.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const ratio = distance > JOYSTICK_RADIUS ? JOYSTICK_RADIUS / distance : 1;
    const knobX = this.touchOrigin.x + dx * ratio;
    const knobY = this.touchOrigin.y + dy * ratio;
    graphics.fillColor = new Color(25, 43, 55, 145);
    graphics.strokeColor = new Color(179, 239, 224, 180);
    graphics.lineWidth = 3;
    graphics.circle(this.touchOrigin.x, this.touchOrigin.y, JOYSTICK_RADIUS);
    graphics.fill();
    graphics.stroke();
    graphics.fillColor = new Color(111, 245, 207, 210);
    graphics.circle(knobX, knobY, 22);
    graphics.fill();
  }

  private processEvents(events: BattleEvent[]): void {
    for (const event of events) {
      if (event.type === 'hit' && event.x !== undefined && event.y !== undefined) {
        this.effects.push({
          x: event.x,
          y: event.y,
          age: 0,
          duration: 0.18,
          radius: 24,
          color: new Color(255, 229, 138, 255),
        });
      }
      if (event.type === 'playerDamaged') {
        this.effects.push({
          x: this.model.player.x,
          y: this.model.player.y,
          age: 0,
          duration: 0.34,
          radius: 46,
          color: new Color(255, 74, 92, 255),
        });
      }
      if (event.type === 'levelUp') {
        this.showUpgradePanel();
      }
      if (event.type === 'result') {
        this.showResultPanel();
      }
    }
  }

  private updateEffects(dt: number): void {
    for (let index = this.effects.length - 1; index >= 0; index -= 1) {
      this.effects[index].age += dt;
      if (this.effects[index].age >= this.effects[index].duration) {
        this.effects.splice(index, 1);
      }
    }
  }

  private showUpgradePanel(): void {
    this.clearModal();
    this.modalNode.active = true;
    const overlay = this.modalNode.addComponent(Graphics);
    overlay.fillColor = new Color(5, 12, 20, 225);
    overlay.rect(-DESIGN_WIDTH / 2, -DESIGN_HEIGHT / 2, DESIGN_WIDTH, DESIGN_HEIGHT);
    overlay.fill();
    overlay.fillColor = new Color(23, 43, 58, 255);
    overlay.strokeColor = new Color(101, 235, 193, 255);
    overlay.lineWidth = 3;
    overlay.roundRect(-178, -242, 356, 520, 20);
    overlay.fill();
    overlay.stroke();

    const title = this.makeLabel('UpgradeTitle', this.modalNode, 30, new Color(239, 255, 250, 255));
    title.string = '选择强化';
    title.node.setPosition(0, 225);
    const subtitle = this.makeLabel('UpgradeSubtitle', this.modalNode, 16, new Color(157, 190, 199, 255));
    subtitle.string = '战斗已暂停 · LV.' + this.model.level;
    subtitle.node.setPosition(0, 185);

    const choices = this.model.getUpgradeChoices();
    const yPositions = [105, -25, -155];
    for (let index = 0; index < choices.length; index += 1) {
      this.createUpgradeCard(choices[index], yPositions[index]);
    }
  }

  private createUpgradeCard(id: UpgradeId, y: number): void {
    const copy = UPGRADE_COPY[id];
    const card = this.makeNode('UpgradeCard-' + id, this.modalNode);
    card.getComponent(UITransform)!.setContentSize(CARD_WIDTH, CARD_HEIGHT);
    card.setPosition(0, y);
    const graphics = card.addComponent(Graphics);
    graphics.fillColor = new Color(37, 62, 76, 255);
    graphics.strokeColor = copy.accent;
    graphics.lineWidth = 3;
    graphics.roundRect(-CARD_WIDTH / 2, -CARD_HEIGHT / 2, CARD_WIDTH, CARD_HEIGHT, 16);
    graphics.fill();
    graphics.stroke();
    graphics.fillColor = copy.accent;
    graphics.roundRect(-CARD_WIDTH / 2 + 13, -CARD_HEIGHT / 2 + 13, 8, CARD_HEIGHT - 26, 4);
    graphics.fill();

    const title = this.makeLabel('Title', card, 23, new Color(246, 251, 253, 255));
    title.string = copy.title + '  Lv.' + (this.model.upgrades[id] + 1);
    title.node.setPosition(12, 20);
    const detail = this.makeLabel('Detail', card, 16, new Color(183, 205, 213, 255));
    detail.string = copy.detail;
    detail.node.setPosition(12, -20);
    card.on(Node.EventType.TOUCH_END, (event: EventTouch) => {
      event.propagationStopped = true;
      this.chooseUpgrade(id);
    }, this);
  }

  private chooseUpgrade(id: UpgradeId): void {
    this.model.applyUpgrade(id);
    if (this.model.pendingLevelUps > 0) {
      this.showUpgradePanel();
      return;
    }
    this.modalNode.active = false;
    this.clearTouchInput();
  }

  private showResultPanel(): void {
    this.clearModal();
    this.modalNode.active = true;
    const victory = this.model.result === 'victory';
    const overlay = this.modalNode.addComponent(Graphics);
    overlay.fillColor = new Color(4, 10, 18, 226);
    overlay.rect(-DESIGN_WIDTH / 2, -DESIGN_HEIGHT / 2, DESIGN_WIDTH, DESIGN_HEIGHT);
    overlay.fill();
    overlay.fillColor = new Color(23, 43, 58, 255);
    overlay.strokeColor = victory ? new Color(94, 245, 188, 255) : new Color(255, 98, 116, 255);
    overlay.lineWidth = 4;
    overlay.roundRect(-170, -175, 340, 350, 22);
    overlay.fill();
    overlay.stroke();

    const title = this.makeLabel('ResultTitle', this.modalNode, 34, victory ? new Color(124, 255, 207, 255) : new Color(255, 132, 145, 255));
    title.string = victory ? '突围成功' : '行动终止';
    title.node.setPosition(0, 105);
    const summary = this.makeLabel('ResultSummary', this.modalNode, 18, new Color(226, 238, 241, 255));
    summary.string = '等级 ' + this.model.level + '   ·   击破 ' + this.model.kills;
    summary.node.setPosition(0, 46);

    const button = this.makeNode('RestartButton', this.modalNode);
    button.getComponent(UITransform)!.setContentSize(RESTART_WIDTH, RESTART_HEIGHT);
    button.setPosition(0, -78);
    const buttonGraphics = button.addComponent(Graphics);
    buttonGraphics.fillColor = new Color(79, 222, 174, 255);
    buttonGraphics.roundRect(-RESTART_WIDTH / 2, -RESTART_HEIGHT / 2, RESTART_WIDTH, RESTART_HEIGHT, 18);
    buttonGraphics.fill();
    const label = this.makeLabel('RestartLabel', button, 23, new Color(11, 42, 43, 255));
    label.string = '再来一局';
    button.on(Node.EventType.TOUCH_END, (event: EventTouch) => {
      event.propagationStopped = true;
      this.restart();
    }, this);
  }

  private restart(): void {
    this.model = new BattleModel();
    this.accumulator = 0;
    this.effects = [];
    this.modalNode.active = false;
    this.clearTouchInput();
  }

  private clearModal(): void {
    this.modalNode.removeComponent(Graphics);
    const children = this.modalNode.children.slice();
    for (const child of children) {
      child.destroy();
    }
  }

  private toCanvasPosition(event: EventTouch): Vec2 {
    const location = event.getUILocation();
    const transform = this.node.getComponent(UITransform);
    if (!transform) {
      return new Vec2();
    }
    const local = transform.convertToNodeSpaceAR(new Vec3(location.x, location.y, 0));
    return new Vec2(local.x, local.y);
  }

  private onTouchStart(event: EventTouch): void {
    if (this.model.paused) {
      return;
    }
    const point = this.toCanvasPosition(event);
    this.touchActive = true;
    this.touchOrigin.set(point.x, point.y);
    this.touchCurrent.set(point.x, point.y);
    this.updateTouchInput();
  }

  private onTouchMove(event: EventTouch): void {
    if (!this.touchActive || this.model.paused) {
      return;
    }
    const point = this.toCanvasPosition(event);
    this.touchCurrent.set(point.x, point.y);
    this.updateTouchInput();
  }

  private onTouchEnd(): void {
    this.clearTouchInput();
  }

  private updateTouchInput(): void {
    const dx = this.touchCurrent.x - this.touchOrigin.x;
    const dy = this.touchCurrent.y - this.touchOrigin.y;
    this.model.setMoveInput(dx / JOYSTICK_RADIUS, dy / JOYSTICK_RADIUS);
  }

  private clearTouchInput(): void {
    this.touchActive = false;
    this.model.setMoveInput(0, 0);
  }

  private onKeyDown(event: EventKeyboard): void {
    this.keys.add(event.keyCode);
  }

  private onKeyUp(event: EventKeyboard): void {
    this.keys.delete(event.keyCode);
  }

  private applyKeyboardInput(): void {
    if (this.touchActive || this.model.paused) {
      return;
    }
    let x = 0;
    let y = 0;
    if (this.keys.has(KeyCode.KEY_A) || this.keys.has(KeyCode.ARROW_LEFT)) x -= 1;
    if (this.keys.has(KeyCode.KEY_D) || this.keys.has(KeyCode.ARROW_RIGHT)) x += 1;
    if (this.keys.has(KeyCode.KEY_W) || this.keys.has(KeyCode.ARROW_UP)) y += 1;
    if (this.keys.has(KeyCode.KEY_S) || this.keys.has(KeyCode.ARROW_DOWN)) y -= 1;
    this.model.setMoveInput(x, y);
  }
}
