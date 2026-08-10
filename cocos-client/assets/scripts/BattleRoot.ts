import {
  _decorator,
  Color,
  Component,
  director,
  EventMouse,
  EventTouch,
  game,
  input,
  Input,
  JsonAsset,
  Label,
  Node,
  Rect,
  ResolutionPolicy,
  resources,
  screen,
  Size,
  Sprite,
  SpriteFrame,
  sys,
  UITransform,
  Vec2,
  view,
} from "cc";
import { ActorPresenter } from "./ActorPresenter";
import { BattleEvent, BattleModel, MigrationRules } from "./BattleModel";
import { CombatVfxPool } from "./CombatVfxPool";
import {
  createSolidNode,
  createSlicedPanel,
  createSpriteNode,
} from "./ViewPrimitives";

const { ccclass } = _decorator;

const DESIGN_WIDTH = 390;
const DESIGN_HEIGHT = 844;
const WORLD_SCALE = 0.84;
const MAX_RENDER_DPR = 1.25;
const FIXED_SIMULATION_STEP = 1 / 60;
const MAX_SIMULATION_STEPS = 3;
const HEALTH_BAR_BACK_COLOR = new Color(33, 27, 20, 190);
const HEALTH_BAR_SAFE_COLOR = new Color(68, 191, 82, 255);
const HEALTH_BAR_DANGER_COLOR = new Color(230, 74, 62, 255);

type ScreenMode = "home" | "battle";

@ccclass("BattleRoot")
export class BattleRoot extends Component {
  private screen: ScreenMode = "home";
  private assetsReady = false;
  private inputBound = false;
  private rules: MigrationRules | null = null;
  private model: BattleModel | null = null;
  private actorPresenter: ActorPresenter | null = null;
  private combatVfx: CombatVfxPool | null = null;
  private homeLayer: Node | null = null;
  private battleLayer: Node | null = null;
  private shadowLayer: Node | null = null;
  private worldLayer: Node | null = null;
  private effectLayer: Node | null = null;
  private homeStatusLabel: Label | null = null;
  private hudLabel: Label | null = null;
  private battleHintLabel: Label | null = null;
  private healthFill: Node | null = null;
  private heroAtlas: SpriteFrame | null = null;
  private enemyAtlas: SpriteFrame | null = null;
  private weaponFrame: SpriteFrame | null = null;
  private homeArtFrame: SpriteFrame | null = null;
  private effectAtlas: SpriteFrame | null = null;
  private heroFrames: SpriteFrame[] = [];
  private enemyFrames: SpriteFrame[] = [];
  private effectFrames: SpriteFrame[] = [];
  private animationTime = 0;
  private pointerActive = false;
  private lastHudSecond = -1;
  private lastHudKills = -1;
  private lastHealth = -1;
  private simulationAccumulator = 0;

  start(): void {
    view.setDesignResolutionSize(DESIGN_WIDTH, DESIGN_HEIGHT, ResolutionPolicy.FIXED_HEIGHT);
    game.frameRate = 60;
    this.configureWechatPerformance();
    this.loadSlice();
  }

  onDestroy(): void {
    if (!this.inputBound) {
      return;
    }
    input.off(Input.EventType.TOUCH_START, this.onTouchStart, this);
    input.off(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
    input.off(Input.EventType.TOUCH_END, this.onTouchEnd, this);
    input.off(Input.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
    input.off(Input.EventType.MOUSE_DOWN, this.onMouseDown, this);
    input.off(Input.EventType.MOUSE_MOVE, this.onMouseMove, this);
    input.off(Input.EventType.MOUSE_UP, this.onMouseUp, this);
  }

  update(dt: number): void {
    if (this.screen !== "battle" || !this.model || !this.actorPresenter) {
      return;
    }
    this.animationTime += dt;
    if (!this.model.finished) {
      this.simulationAccumulator = Math.min(
        this.simulationAccumulator + Math.min(dt, FIXED_SIMULATION_STEP * MAX_SIMULATION_STEPS),
        FIXED_SIMULATION_STEP * MAX_SIMULATION_STEPS,
      );
      let simulationSteps = 0;
      while (this.simulationAccumulator >= FIXED_SIMULATION_STEP && simulationSteps < MAX_SIMULATION_STEPS) {
        this.model.update(FIXED_SIMULATION_STEP);
        this.consumeEvents(this.model.drainEvents());
        this.simulationAccumulator -= FIXED_SIMULATION_STEP;
        simulationSteps += 1;
      }
    }
    const interpolation = this.model.finished ? 1 : this.simulationAccumulator / FIXED_SIMULATION_STEP;
    this.actorPresenter.sync(this.model, this.animationTime, this.pointerActive, interpolation);
    if (this.combatVfx) {
      const heroPosition = this.actorPresenter.getHeroRenderPosition();
      this.combatVfx.syncHero(heroPosition.x, heroPosition.y);
    }
    this.updateHud();
  }

  private configureWechatPerformance(): void {
    if (sys.platform !== sys.Platform.WECHAT_GAME) {
      return;
    }
    const root = director.root;
    if (root && root.pipeline) {
      root.pipeline.shadingScale = Math.min(1, MAX_RENDER_DPR / Math.max(1, screen.devicePixelRatio));
    }
  }

  private buildStage(): void {
    if (!this.rules || !this.homeArtFrame || !this.weaponFrame || this.heroFrames.length === 0 || this.enemyFrames.length === 0 || this.effectFrames.length < 5) {
      return;
    }
    const rootTransform = this.node.getComponent(UITransform) || this.node.addComponent(UITransform);
    rootTransform.setContentSize(DESIGN_WIDTH, DESIGN_HEIGHT);
    this.buildHome();
    this.buildBattle();
    this.bindInput();
    this.assetsReady = true;
    if (this.homeStatusLabel) {
      this.homeStatusLabel.string = "Cocos 原生表现版 · 战场已就绪";
    }
  }

  private buildHome(): void {
    if (!this.homeArtFrame) {
      return;
    }
    const panelFrame = this.effectFrames[4];
    this.homeLayer = this.createLayer("HomeScreen", this.node, 1);
    createSolidNode(this.homeLayer, this.node.layer, "HomeBackground", DESIGN_WIDTH, DESIGN_HEIGHT, new Color(34, 91, 58, 255));

    const artFrame = createSlicedPanel(this.homeLayer, this.node.layer, "HomeArtFrame", panelFrame, 362, 650, new Color(255, 246, 208, 255));
    artFrame.node.setPosition(0, 17);
    const art = createSpriteNode(artFrame.node, this.node.layer, "GuanShowcase", this.homeArtFrame, 350, 638);
    art.sprite.sizeMode = Sprite.SizeMode.CUSTOM;

    const topShade = createSlicedPanel(this.homeLayer, this.node.layer, "HomeTopShade", panelFrame, 338, 112, new Color(43, 31, 20, 218));
    topShade.node.setPosition(0, 294);
    this.addLabel(topShade.node, "Chapter", "第一关 · 粮道奇袭", 0, 28, 300, 26, 15, new Color(255, 229, 142, 255));
    this.addLabel(topShade.node, "Mission", "夜袭敌军粮道", 0, -4, 320, 38, 27, new Color(255, 250, 237, 255));
    this.addLabel(topShade.node, "Mode", "关羽出阵 · 自动攻击", 0, -38, 300, 24, 14, new Color(255, 239, 197, 255));

    const heroTag = createSlicedPanel(this.homeLayer, this.node.layer, "HeroTag", panelFrame, 236, 42, new Color(47, 35, 22, 235));
    heroTag.node.setPosition(0, -251);
    this.addLabel(heroTag.node, "HeroName", "关羽 · 长兵横扫", 0, 0, 210, 28, 17, new Color(255, 247, 215, 255));

    const startButton = createSlicedPanel(this.homeLayer, this.node.layer, "StartBattle", panelFrame, 350, 68, new Color(255, 197, 47, 255));
    startButton.node.setPosition(0, -356);
    const buttonInner = createSlicedPanel(startButton.node, this.node.layer, "StartButtonInner", panelFrame, 330, 50, new Color(255, 226, 92, 255));
    buttonInner.node.setPosition(0, 0);
    this.addLabel(startButton.node, "StartLabel", "出阵劫粮", 0, 1, 300, 40, 25, new Color(113, 54, 0, 255));

    const statusNode = new Node("HomeStatus");
    statusNode.layer = this.node.layer;
    statusNode.setParent(this.homeLayer);
    statusNode.setPosition(0, -405);
    statusNode.addComponent(UITransform).setContentSize(350, 24);
    this.homeStatusLabel = statusNode.addComponent(Label);
    this.homeStatusLabel.string = "正在整备粮道战场…";
    this.homeStatusLabel.fontSize = 13;
    this.homeStatusLabel.lineHeight = 20;
    this.homeStatusLabel.color = new Color(224, 239, 211, 255);
    this.homeStatusLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
    this.homeStatusLabel.verticalAlign = Label.VerticalAlign.CENTER;
  }

  private buildBattle(): void {
    if (!this.rules || !this.weaponFrame) {
      return;
    }
    this.battleLayer = this.createLayer("BattleScreen", this.node, 1);
    this.battleLayer.active = false;
    this.buildFieldBackground();

    this.shadowLayer = this.createLayer("ActorShadows", this.battleLayer, WORLD_SCALE);
    this.worldLayer = this.createLayer("Actors", this.battleLayer, WORLD_SCALE);
    this.effectLayer = this.createLayer("CombatEffects", this.battleLayer, WORLD_SCALE);

    this.actorPresenter = new ActorPresenter(
      this.node.layer,
      this.worldLayer,
      this.shadowLayer,
      this.heroFrames,
      this.enemyFrames,
      this.effectFrames[0],
      this.rules.sliceHarness.maxEnemies,
    );
    this.combatVfx = new CombatVfxPool(
      this.node.layer,
      this.effectLayer,
      this.weaponFrame,
      this.heroFrames[1],
      this.effectFrames[1],
      this.effectFrames[2],
      this.effectFrames[3],
    );
    this.buildHud();
  }

  private buildFieldBackground(): void {
    if (!this.battleLayer) {
      return;
    }
    const field = new Node("FieldBackground");
    field.layer = this.node.layer;
    field.setParent(this.battleLayer);
    field.addComponent(UITransform).setContentSize(DESIGN_WIDTH, DESIGN_HEIGHT);
    createSolidNode(field, this.node.layer, "FieldColor", DESIGN_WIDTH, DESIGN_HEIGHT, new Color(169, 221, 99, 255));
    for (let x = -189; x <= 189; x += 42) {
      const line = createSolidNode(field, this.node.layer, `GridV-${x}`, 1, 670, new Color(255, 244, 166, 34));
      line.node.setPosition(x, -25);
    }
    for (let y = -361; y <= 311; y += 42) {
      const line = createSolidNode(field, this.node.layer, `GridH-${y}`, DESIGN_WIDTH, 1, new Color(255, 244, 166, 34));
      line.node.setPosition(0, y);
    }
  }

  private buildHud(): void {
    if (!this.battleLayer) {
      return;
    }
    const panelFrame = this.effectFrames[4];
    const panel = createSlicedPanel(this.battleLayer, this.node.layer, "HudPanel", panelFrame, 358, 78, new Color(62, 47, 27, 238));
    panel.node.setPosition(0, 368);
    this.addLabel(panel.node, "BattleTitle", "粮道奇袭", -54, 20, 210, 28, 20, new Color(255, 239, 178, 255));

    const statsNode = new Node("Stats");
    statsNode.layer = this.node.layer;
    statsNode.setParent(panel.node);
    statsNode.setPosition(-54, -8);
    statsNode.addComponent(UITransform).setContentSize(212, 24);
    this.hudLabel = statsNode.addComponent(Label);
    this.hudLabel.string = "战场整备中…";
    this.hudLabel.fontSize = 14;
    this.hudLabel.lineHeight = 20;
    this.hudLabel.color = new Color(235, 244, 216, 255);
    this.hudLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
    this.hudLabel.verticalAlign = Label.VerticalAlign.CENTER;

    const barNode = new Node("HealthBar");
    barNode.layer = this.node.layer;
    barNode.setParent(panel.node);
    barNode.setPosition(-54, -29);
    barNode.addComponent(UITransform).setContentSize(210, 10);
    createSolidNode(barNode, this.node.layer, "HealthBack", 210, 10, HEALTH_BAR_BACK_COLOR);
    const fill = createSolidNode(barNode, this.node.layer, "HealthFill", 206, 6, HEALTH_BAR_SAFE_COLOR);
    fill.transform.setAnchorPoint(0, 0.5);
    fill.node.setPosition(-103, 0);
    this.healthFill = fill.node;

    const returnButton = createSlicedPanel(panel.node, this.node.layer, "ReturnHome", panelFrame, 92, 50, new Color(255, 241, 191, 255));
    returnButton.node.setPosition(126, 0);
    this.addLabel(returnButton.node, "ReturnLabel", "返回营地", 0, 0, 82, 26, 15, new Color(103, 57, 14, 255));

    const hintNode = new Node("Hint");
    hintNode.layer = this.node.layer;
    hintNode.setParent(this.battleLayer);
    hintNode.setPosition(0, -401);
    hintNode.addComponent(UITransform).setContentSize(356, 28);
    this.battleHintLabel = hintNode.addComponent(Label);
    this.battleHintLabel.string = "按住并拖动走位 · 攻击与武技自动释放";
    this.battleHintLabel.fontSize = 14;
    this.battleHintLabel.lineHeight = 22;
    this.battleHintLabel.color = new Color(66, 50, 31, 255);
    this.battleHintLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
    this.battleHintLabel.verticalAlign = Label.VerticalAlign.CENTER;
  }

  private createLayer(name: string, parent: Node, scale: number): Node {
    const layer = new Node(name);
    layer.layer = this.node.layer;
    layer.setParent(parent);
    layer.setScale(scale, scale, 1);
    layer.addComponent(UITransform).setContentSize(DESIGN_WIDTH / scale, DESIGN_HEIGHT / scale);
    return layer;
  }

  private addLabel(parent: Node, name: string, text: string, x: number, y: number, width: number, height: number, fontSize: number, color: Color): Label {
    const node = new Node(name);
    node.layer = this.node.layer;
    node.setParent(parent);
    node.setPosition(x, y);
    node.addComponent(UITransform).setContentSize(width, height);
    const label = node.addComponent(Label);
    label.string = text;
    label.fontSize = fontSize;
    label.lineHeight = Math.max(fontSize + 4, height - 2);
    label.color = color;
    label.horizontalAlign = Label.HorizontalAlign.CENTER;
    label.verticalAlign = Label.VerticalAlign.CENTER;
    return label;
  }

  private bindInput(): void {
    input.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
    input.on(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
    input.on(Input.EventType.TOUCH_END, this.onTouchEnd, this);
    input.on(Input.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
    input.on(Input.EventType.MOUSE_DOWN, this.onMouseDown, this);
    input.on(Input.EventType.MOUSE_MOVE, this.onMouseMove, this);
    input.on(Input.EventType.MOUSE_UP, this.onMouseUp, this);
    this.inputBound = true;
  }

  private loadSlice(): void {
    let remaining = 6;
    const finish = (): void => {
      remaining -= 1;
      if (remaining !== 0 || !this.rules || !this.heroAtlas || !this.enemyAtlas || !this.weaponFrame || !this.homeArtFrame || !this.effectAtlas) {
        return;
      }
      this.heroFrames = this.buildAtlasFrames(this.heroAtlas, 3, 384, 288);
      this.enemyFrames = this.buildAtlasFrames(this.enemyAtlas, 6, 288, 288);
      this.effectFrames = this.buildAtlasFrames(this.effectAtlas, 5, 128, 128);
      const panelFrame = this.effectFrames[4];
      panelFrame.insetLeft = 24;
      panelFrame.insetRight = 24;
      panelFrame.insetTop = 24;
      panelFrame.insetBottom = 24;
      this.buildStage();
    };

    resources.load("config/guan-slice", JsonAsset, (error, asset) => {
      if (error) {
        this.showLoadError("迁移规则", error);
        return;
      }
      this.rules = asset.json as unknown as MigrationRules;
      finish();
    });
    resources.load("art/guan-atlas/spriteFrame", SpriteFrame, (error, asset) => {
      if (error) {
        this.showLoadError("关羽图集", error);
        return;
      }
      this.heroAtlas = asset;
      finish();
    });
    resources.load("art/head-cook-atlas/spriteFrame", SpriteFrame, (error, asset) => {
      if (error) {
        this.showLoadError("伙夫图集", error);
        return;
      }
      this.enemyAtlas = asset;
      finish();
    });
    resources.load("art/guan-yanyuedao-v1/spriteFrame", SpriteFrame, (error, asset) => {
      if (error) {
        this.showLoadError("偃月刀", error);
        return;
      }
      this.weaponFrame = asset;
      finish();
    });
    resources.load("art/guan-showcase-v1/spriteFrame", SpriteFrame, (error, asset) => {
      if (error) {
        this.showLoadError("关羽立绘", error);
        return;
      }
      this.homeArtFrame = asset;
      finish();
    });
    resources.load("art/battle-fx-atlas/spriteFrame", SpriteFrame, (error, asset) => {
      if (error) {
        this.showLoadError("战斗特效图集", error);
        return;
      }
      this.effectAtlas = asset;
      finish();
    });
  }

  private showLoadError(name: string, error: Error): void {
    console.error(`[Cocos native view] ${name}加载失败: ${error.message}`);
  }

  private buildAtlasFrames(atlas: SpriteFrame, count: number, frameWidth: number, frameHeight: number): SpriteFrame[] {
    const frames: SpriteFrame[] = [];
    for (let index = 0; index < count; index += 1) {
      const frame = new SpriteFrame();
      frame.texture = atlas.texture;
      frame.rect = new Rect(index * frameWidth, 0, frameWidth, frameHeight);
      frame.originalSize = new Size(frameWidth, frameHeight);
      frame.offset = Vec2.ZERO;
      frame.packable = false;
      frames.push(frame);
    }
    return frames;
  }

  private enterBattle(): void {
    if (!this.assetsReady || !this.rules || !this.battleLayer || !this.homeLayer || !this.actorPresenter || !this.combatVfx) {
      return;
    }
    this.screen = "battle";
    this.homeLayer.active = false;
    this.battleLayer.active = true;
    this.pointerActive = false;
    this.animationTime = 0;
    this.lastHudSecond = -1;
    this.lastHudKills = -1;
    this.lastHealth = -1;
    this.simulationAccumulator = 0;
    if (this.battleHintLabel) {
      this.battleHintLabel.string = "按住并拖动走位 · 攻击与武技自动释放";
    }
    this.combatVfx.reset();
    if (!this.model) {
      this.model = new BattleModel(this.rules);
    } else {
      this.model.reset();
    }
    this.consumeEvents(this.model.drainEvents());
    this.actorPresenter.sync(this.model, this.animationTime, false, 1);
    this.updateHud();
  }

  private leaveBattle(): void {
    if (!this.homeLayer || !this.battleLayer) {
      return;
    }
    this.pointerActive = false;
    if (this.model) {
      this.model.setMoveDirection(0, 0);
    }
    if (this.combatVfx) {
      this.combatVfx.reset();
    }
    this.screen = "home";
    this.battleLayer.active = false;
    this.homeLayer.active = true;
  }

  private consumeEvents(events: BattleEvent[]): void {
    if (!this.actorPresenter || !this.combatVfx) {
      return;
    }
    for (const event of events) {
      if (event.type === "reset") {
        this.actorPresenter.resetEnemies();
        this.combatVfx.reset();
      } else if (event.type === "spawn") {
        this.actorPresenter.spawnEnemy(event.enemy.id);
      } else if (event.type === "enemy-down") {
        this.actorPresenter.releaseEnemy(event.enemyId);
      } else if (event.type === "battle-ended") {
        this.pointerActive = false;
        if (this.model) {
          this.model.setMoveDirection(0, 0);
        }
        if (this.battleHintLabel) {
          this.battleHintLabel.string = event.reason === "defeat" ? "关羽败退 · 点击返回营地重新出阵" : "本轮结束 · 点击返回营地重新出阵";
        }
        this.lastHudSecond = -1;
      } else if (event.type === "blade" || event.type === "ringblade" || event.type === "warm-wine") {
        this.combatVfx.play(event);
      }
    }
  }

  private updateHud(): void {
    if (!this.model || !this.hudLabel || !this.healthFill) {
      return;
    }
    const remaining = Math.max(0, this.model.rules.sliceHarness.duration - this.model.elapsed);
    const remainingSecond = Math.ceil(remaining);
    const healthChanged = this.model.hero.health !== this.lastHealth;
    if (remainingSecond !== this.lastHudSecond || this.model.kills !== this.lastHudKills || healthChanged) {
      this.lastHudSecond = remainingSecond;
      this.lastHudKills = this.model.kills;
      const fps = director.root ? Math.round(director.root.fps) : 0;
      const draws = director.root ? director.root.device.numDrawCalls : 0;
      const timeText = this.model.finished ? "结束" : `${remainingSecond}s`;
      this.hudLabel.string = `血${this.model.hero.health}/${this.model.rules.hero.health}　斩${this.model.kills}　${timeText}　${fps}帧 D${draws}`;
    }
    if (healthChanged) {
      this.lastHealth = this.model.hero.health;
      const ratio = this.model.hero.health / this.model.rules.hero.health;
      const fillSprite = this.healthFill.getComponent(Sprite);
      if (fillSprite) {
        fillSprite.color = ratio > 0.3 ? HEALTH_BAR_SAFE_COLOR : HEALTH_BAR_DANGER_COLOR;
      }
      this.healthFill.setScale(Math.max(0, ratio), 1, 1);
    }
  }

  private pointToLocal(x: number, y: number): Vec2 {
    const size = view.getVisibleSize();
    return new Vec2((x - size.width * 0.5) * DESIGN_WIDTH / size.width, (y - size.height * 0.5) * DESIGN_HEIGHT / size.height);
  }

  private isHomeStart(point: Vec2): boolean {
    return point.x >= -175 && point.x <= 175 && point.y >= -390 && point.y <= -322;
  }

  private isReturnHome(point: Vec2): boolean {
    return point.x >= 80 && point.x <= 172 && point.y >= 343 && point.y <= 393;
  }

  private aimAtPoint(point: Vec2): void {
    if (!this.model) {
      return;
    }
    const worldX = point.x / WORLD_SCALE;
    const worldY = point.y / WORLD_SCALE;
    this.model.setMoveDirection(worldX - this.model.hero.x, worldY - this.model.hero.y);
  }

  private pressAtPoint(point: Vec2): void {
    if (this.screen === "home") {
      if (this.isHomeStart(point)) {
        this.enterBattle();
      }
      return;
    }
    if (this.isReturnHome(point)) {
      this.leaveBattle();
      return;
    }
    this.pointerActive = true;
    this.aimAtPoint(point);
  }

  private onTouchStart(event: EventTouch): void {
    const point = event.getUILocation();
    this.pressAtPoint(this.pointToLocal(point.x, point.y));
  }

  private onTouchMove(event: EventTouch): void {
    if (!this.pointerActive || this.screen !== "battle") {
      return;
    }
    const point = event.getUILocation();
    this.aimAtPoint(this.pointToLocal(point.x, point.y));
  }

  private onTouchEnd(): void {
    this.pointerActive = false;
    if (this.model) {
      this.model.setMoveDirection(0, 0);
    }
  }

  private onMouseDown(event: EventMouse): void {
    const point = event.getUILocation();
    this.pressAtPoint(this.pointToLocal(point.x, point.y));
  }

  private onMouseMove(event: EventMouse): void {
    if (!this.pointerActive || this.screen !== "battle") {
      return;
    }
    const point = event.getUILocation();
    this.aimAtPoint(this.pointToLocal(point.x, point.y));
  }

  private onMouseUp(): void {
    this.onTouchEnd();
  }
}
