import {
    _decorator,
    Animation,
    Color,
    Component,
    EventTouch,
    Graphics,
    input,
    Input,
    Label,
    Node,
    Sprite,
    UITransform,
    Vec2,
    Vec3,
} from 'cc';

const { ccclass } = _decorator;

class GreenDragonSlashEffect {
    private remaining = 0;
    private forwardX = 1;
    private forwardY = 0;

    public constructor(
        private readonly node: Node,
        private readonly animation: Animation,
        private readonly visualScale: number,
        private readonly forwardOffset: number,
        private readonly hitRadius: number,
        private readonly rearAllowance: number,
    ) {}

    public activate(origin: Readonly<Vec3>, direction: Readonly<Vec2>): void {
        this.forwardX = direction.x;
        this.forwardY = direction.y;
        this.node.active = true;
        this.node.setPosition(
            origin.x + this.forwardX * this.forwardOffset,
            origin.y + this.forwardY * this.forwardOffset,
            0,
        );
        this.node.setRotationFromEuler(
            0,
            0,
            Math.atan2(this.forwardY, this.forwardX) * 180 / Math.PI,
        );
        this.node.setScale(this.visualScale, this.visualScale, 1);
        this.animation.play('green-dragon-slash');
        this.remaining = 0.24;
    }

    public update(deltaTime: number): void {
        if (this.remaining <= 0) {
            return;
        }

        this.remaining -= deltaTime;
        if (this.remaining <= 0) {
            this.node.active = false;
        }
    }

    public hitsCircle(targetPosition: Readonly<Vec3>, targetRadius: number): boolean {
        const dx = targetPosition.x - this.node.position.x;
        const dy = targetPosition.y - this.node.position.y;
        const originDx = dx + this.forwardX * this.forwardOffset;
        const originDy = dy + this.forwardY * this.forwardOffset;
        const forwardDistance = originDx * this.forwardX + originDy * this.forwardY;
        if (forwardDistance < -this.rearAllowance) {
            return false;
        }

        return Math.hypot(dx, dy) <= this.hitRadius + targetRadius;
    }
}

@ccclass('BattleSlice')
export class BattleSlice extends Component {
    private readonly moveTarget = new Vec3();
    private readonly lastDirection = new Vec2(1, 0);
    private readonly touchLocation = new Vec2();
    private readonly scratchPlayerPosition = new Vec3();
    private readonly scratchEnemyPosition = new Vec3();
    private readonly touchPosition = new Vec3();
    private readonly enemyNormalColor = new Color(255, 255, 255, 255);
    private readonly enemyHitColor = new Color(255, 105, 78, 255);

    private player!: Node;
    private playerVisual!: Node;
    private playerAnimation!: Animation;
    private enemy!: Node;
    private enemyVisual!: Node;
    private enemySprite!: Sprite;
    private slashEffect!: GreenDragonSlashEffect;
    private enemyHealthBar!: Node;
    private enemyHealthGraphics!: Graphics;
    private scoreLabel!: Label;
    private canvasTransform!: UITransform;
    private arena!: Node;

    private touchActive = false;
    private touchTargetDirty = false;
    private movementState = '';
    private attackTimer = 0.15;
    private hurtTimer = 0;
    private hitFlashTimer = 0;
    private contactTimer = 0;
    private enemySlowTimer = 0;
    private respawnTimer = 0;
    private playerHealth = 10;
    private enemyHealth = 3;
    private kills = 0;

    private readonly playerSpeed = 280;
    private readonly enemySpeed = 72;
    private readonly attackCooldown = 1.0;
    private readonly playerCollisionRadius = 58;
    private readonly enemyCollisionRadius = 42;
    private readonly separationDistance = this.playerCollisionRadius + this.enemyCollisionRadius;
    private readonly contactDamage = 1;
    private readonly contactDamageCooldown = 1.0;
    private readonly maxPlayerHealth = 10;
    private readonly maxEnemyHealth = 3;
    private readonly slashVisualScale = 0.58;
    private readonly slashVisualOffset = 72;
    private readonly slashHitRadius = 220;
    private readonly slashRearAllowance = 58;

    protected onLoad(): void {
        this.canvasTransform = this.node.getComponent(UITransform)!;
        this.player = this.requireChild(this.node, 'GuanYu');
        this.playerVisual = this.requireChild(this.player, 'Visual');
        this.playerAnimation = this.playerVisual.getComponent(Animation)!;
        this.enemy = this.requireChild(this.node, 'HeadCook');
        this.enemyVisual = this.requireChild(this.enemy, 'Visual');
        this.enemySprite = this.enemyVisual.getComponent(Sprite)!;
        const slashVisual = this.requireChild(this.node, 'SlashVisual');
        this.slashEffect = new GreenDragonSlashEffect(
            slashVisual,
            slashVisual.getComponent(Animation)!,
            this.slashVisualScale,
            this.slashVisualOffset,
            this.slashHitRadius,
            this.slashRearAllowance,
        );
        this.arena = this.requireChild(this.node, 'Arena');
        this.enemyHealthBar = this.requireChild(this.node, 'EnemyHealthBar');
        this.enemyHealthGraphics = this.enemyHealthBar.getComponent(Graphics)
            ?? this.enemyHealthBar.addComponent(Graphics);

        const scoreNode = this.requireChild(this.node, 'Score');
        const scoreTransform = scoreNode.getComponent(UITransform) ?? scoreNode.addComponent(UITransform);
        scoreTransform.setContentSize(860, 60);
        this.scoreLabel = scoreNode.getComponent(Label) ?? scoreNode.addComponent(Label);
        this.scoreLabel.fontSize = 38;
        this.scoreLabel.lineHeight = 46;
        this.scoreLabel.color = new Color(255, 238, 196, 255);

        this.player.setPosition(0, 0, 0);
        this.moveTarget.set(this.player.position);
        this.drawArena();
        this.drawEnemyHealthBar();
        this.updateHud();
        this.playMovement('guan-idle');

        input.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
        input.on(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
        input.on(Input.EventType.TOUCH_END, this.onTouchEnd, this);
        input.on(Input.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
    }

    protected onDestroy(): void {
        input.off(Input.EventType.TOUCH_START, this.onTouchStart, this);
        input.off(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
        input.off(Input.EventType.TOUCH_END, this.onTouchEnd, this);
        input.off(Input.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
    }

    protected update(deltaTime: number): void {
        const dt = Math.min(deltaTime, 0.05);
        this.flushTouchTarget();
        this.attackTimer -= dt;
        this.hurtTimer = Math.max(0, this.hurtTimer - dt);
        this.contactTimer = Math.max(0, this.contactTimer - dt);
        this.enemySlowTimer = Math.max(0, this.enemySlowTimer - dt);
        this.slashEffect.update(dt);
        this.updateTimedFeedback(dt);

        this.updatePlayer(dt);
        this.updateEnemy(dt);
        this.resolveEntityCollision();
        this.applyContactDamage();
        this.updateEnemyHealthBarPosition();

        if (this.attackTimer <= 0) {
            this.attackTimer += this.attackCooldown;
            this.performAttack();
        }
    }

    private readonly onTouchStart = (event: EventTouch): void => {
        this.touchActive = true;
        this.captureTouchTarget(event);
    };

    private readonly onTouchMove = (event: EventTouch): void => {
        if (this.touchActive) {
            this.captureTouchTarget(event);
        }
    };

    private readonly onTouchEnd = (): void => {
        this.touchActive = false;
        this.touchTargetDirty = false;
        this.moveTarget.set(this.player.position);
    };

    private captureTouchTarget(event: EventTouch): void {
        event.getUILocation(this.touchLocation);
        this.touchTargetDirty = true;
    }

    private flushTouchTarget(): void {
        if (!this.touchTargetDirty) {
            return;
        }

        this.touchTargetDirty = false;
        this.touchPosition.set(this.touchLocation.x, this.touchLocation.y, 0);
        this.canvasTransform.convertToNodeSpaceAR(this.touchPosition, this.moveTarget);
    }

    private updatePlayer(dt: number): void {
        const position = this.player.position;
        const dx = this.moveTarget.x - position.x;
        const dy = this.moveTarget.y - position.y;
        const distance = Math.hypot(dx, dy);
        let moving = false;

        if (this.touchActive && distance > 2) {
            const inverseDistance = 1 / distance;
            const step = Math.min(distance, this.playerSpeed * dt);
            const directionX = dx * inverseDistance;
            const directionY = dy * inverseDistance;
            this.scratchPlayerPosition.set(
                position.x + directionX * step,
                position.y + directionY * step,
                0,
            );
            this.clampPlayerPosition(this.scratchPlayerPosition);
            this.player.setPosition(this.scratchPlayerPosition);
            this.lastDirection.set(directionX, directionY);
            this.faceNode(this.playerVisual, directionX, false);
            moving = true;
        }

        if (this.hurtTimer <= 0) {
            this.playMovement(moving ? 'guan-move' : 'guan-idle');
        }
    }

    private updateEnemy(dt: number): void {
        if (!this.enemy.active) {
            this.respawnTimer -= dt;
            if (this.respawnTimer <= 0) {
                this.respawnEnemy();
            }
            return;
        }

        const playerPosition = this.player.position;
        const enemyPosition = this.enemy.position;
        const dx = playerPosition.x - enemyPosition.x;
        const dy = playerPosition.y - enemyPosition.y;
        const distance = Math.hypot(dx, dy);

        if (distance > this.separationDistance) {
            const inverseDistance = 1 / distance;
            const speed = this.enemySlowTimer > 0 ? Math.max(18, this.enemySpeed - 12) : this.enemySpeed;
            const step = Math.min(distance - this.separationDistance, speed * dt);
            const directionX = dx * inverseDistance;
            const directionY = dy * inverseDistance;
            this.enemy.setPosition(
                enemyPosition.x + directionX * step,
                enemyPosition.y + directionY * step,
                0,
            );
            this.faceNode(this.enemyVisual, directionX);
        }
    }

    private resolveEntityCollision(): void {
        if (!this.enemy.active) {
            return;
        }

        const playerPosition = this.player.position;
        const enemyPosition = this.enemy.position;
        let dx = enemyPosition.x - playerPosition.x;
        let dy = enemyPosition.y - playerPosition.y;
        let distance = Math.hypot(dx, dy);
        if (distance >= this.separationDistance) {
            return;
        }

        if (distance < 0.001) {
            dx = this.lastDirection.x;
            dy = this.lastDirection.y;
            distance = 1;
        }

        const inverseDistance = 1 / distance;
        const directionX = dx * inverseDistance;
        const directionY = dy * inverseDistance;
        const overlap = this.separationDistance - distance;

        this.scratchEnemyPosition.set(
            enemyPosition.x + directionX * overlap,
            enemyPosition.y + directionY * overlap,
            0,
        );
        this.enemy.setPosition(this.scratchEnemyPosition);
    }

    private applyContactDamage(): void {
        if (!this.enemy.active || this.contactTimer > 0 || this.playerHealth <= 0) {
            return;
        }

        const distance = Vec3.distance(this.player.position, this.enemy.position);
        if (distance > this.separationDistance + 1) {
            return;
        }

        this.playerHealth = Math.max(0, this.playerHealth - this.contactDamage);
        this.contactTimer = this.contactDamageCooldown;
        this.playMovement('guan-hurt', true);
        this.hurtTimer = 0.25;
        this.updateHud();
    }

    private performAttack(): void {
        this.slashEffect.activate(this.player.position, this.lastDirection);

        if (!this.enemy.active) {
            return;
        }

        const dx = this.enemy.position.x - this.player.position.x;
        const dy = this.enemy.position.y - this.player.position.y;
        if (!this.slashEffect.hitsCircle(this.enemy.position, this.enemyCollisionRadius)) {
            return;
        }

        this.enemyHealth -= 1;
        this.enemySlowTimer = 2;
        this.enemySprite.color = this.enemyHitColor;
        this.hitFlashTimer = 0.12;

        const distance = Math.max(0.001, Math.hypot(dx, dy));
        const inverseDistance = 1 / distance;
        this.scratchEnemyPosition.set(
            this.enemy.position.x + dx * inverseDistance * 18,
            this.enemy.position.y + dy * inverseDistance * 18,
            0,
        );
        this.enemy.setPosition(this.scratchEnemyPosition);

        if (this.enemyHealth <= 0) {
            this.enemy.active = false;
            this.respawnTimer = 0.55;
            this.kills += 1;
        }

        this.drawEnemyHealthBar();
        this.updateHud();
    }

    private updateTimedFeedback(dt: number): void {
        if (this.hitFlashTimer > 0) {
            this.hitFlashTimer -= dt;
            if (this.hitFlashTimer <= 0) {
                this.enemySprite.color = this.enemyNormalColor;
            }
        }
    }

    private respawnEnemy(): void {
        const size = this.canvasTransform.contentSize;
        const halfWidth = size.width * 0.5 - 70;
        const halfHeight = size.height * 0.5 - 90;
        const edge = this.kills % 4;
        const positions = [
            new Vec3(halfWidth, halfHeight * 0.55, 0),
            new Vec3(-halfWidth, -halfHeight * 0.35, 0),
            new Vec3(halfWidth * 0.45, -halfHeight, 0),
            new Vec3(-halfWidth * 0.55, halfHeight, 0),
        ];
        this.enemy.setPosition(positions[edge]);
        this.enemyHealth = this.maxEnemyHealth;
        this.enemySlowTimer = 0;
        this.enemySprite.color = this.enemyNormalColor;
        this.enemy.active = true;
        this.drawEnemyHealthBar();
        this.updateHud();
    }

    private drawEnemyHealthBar(): void {
        this.enemyHealthBar.active = this.enemy.active;
        if (!this.enemy.active) {
            return;
        }

        const width = 92;
        const height = 12;
        const ratio = Math.max(0, this.enemyHealth / this.maxEnemyHealth);
        this.enemyHealthGraphics.clear();
        this.enemyHealthGraphics.fillColor = new Color(37, 24, 20, 230);
        this.enemyHealthGraphics.rect(-width * 0.5 - 3, -height * 0.5 - 3, width + 6, height + 6);
        this.enemyHealthGraphics.fill();
        this.enemyHealthGraphics.fillColor = new Color(206, 62, 47, 255);
        this.enemyHealthGraphics.rect(-width * 0.5, -height * 0.5, width * ratio, height);
        this.enemyHealthGraphics.fill();
        this.updateEnemyHealthBarPosition();
    }

    private updateEnemyHealthBarPosition(): void {
        this.enemyHealthBar.active = this.enemy.active;
        if (this.enemy.active) {
            this.enemyHealthBar.setPosition(this.enemy.position.x, this.enemy.position.y + 104, 0);
        }
    }

    private drawArena(): void {
        const graphics = this.arena.getComponent(Graphics) ?? this.arena.addComponent(Graphics);
        const size = this.canvasTransform.contentSize;
        const gridSize = 80;
        const left = -size.width * 0.5 - gridSize;
        const right = size.width * 0.5 + gridSize;
        const bottom = -size.height * 0.5 - gridSize;
        const top = size.height * 0.5 + gridSize;
        graphics.clear();
        graphics.fillColor = new Color(44, 35, 30, 255);
        graphics.rect(left, bottom, right - left, top - bottom);
        graphics.fill();
        graphics.strokeColor = new Color(111, 82, 54, 90);
        graphics.lineWidth = 2;
        for (let x = left; x <= right; x += gridSize) {
            graphics.moveTo(x, bottom);
            graphics.lineTo(x, top);
        }
        for (let y = bottom; y <= top; y += gridSize) {
            graphics.moveTo(left, y);
            graphics.lineTo(right, y);
        }
        graphics.stroke();
    }

    private clampPlayerPosition(position: Vec3): void {
        const size = this.canvasTransform.contentSize;
        const halfWidth = size.width * 0.5 - 92;
        const halfHeight = size.height * 0.5 - 82;
        position.x = Math.max(-halfWidth, Math.min(halfWidth, position.x));
        position.y = Math.max(-halfHeight, Math.min(halfHeight, position.y));
    }

    private updateHud(): void {
        const enemyStatus = this.enemy.active
            ? `厨师长 HP ${this.enemyHealth}/${this.maxEnemyHealth}`
            : '厨师长 已击破';
        this.scoreLabel.string = `关羽 HP ${this.playerHealth}/${this.maxPlayerHealth}    击破 ${this.kills}    ${enemyStatus}`;
        const size = this.canvasTransform.contentSize;
        this.scoreLabel.node.setPosition(0, size.height * 0.5 - 52, 0);
    }

    private playMovement(name: string, force = false): void {
        if (!force && this.movementState === name) {
            return;
        }
        this.movementState = name;
        this.playerAnimation.play(name);
    }

    private faceNode(node: Node, directionX: number, sourceFacesRight = true): void {
        if (Math.abs(directionX) < 0.02) {
            return;
        }
        const rightFacingSign = sourceFacesRight ? 1 : -1;
        const nextFacingSign = directionX >= 0 ? rightFacingSign : -rightFacingSign;
        const scale = node.scale;
        const currentFacingSign = scale.x >= 0 ? 1 : -1;
        if (nextFacingSign === currentFacingSign) {
            return;
        }
        node.setScale(Math.abs(scale.x) * nextFacingSign, scale.y, scale.z);
    }

    private requireChild(parent: Node, name: string): Node {
        const child = parent.getChildByName(name);
        if (!child) {
            throw new Error(`BattleSlice requires ${parent.name}/${name}`);
        }
        return child;
    }
}
