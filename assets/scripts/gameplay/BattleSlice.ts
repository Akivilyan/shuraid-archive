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

@ccclass('BattleSlice')
export class BattleSlice extends Component {
    private readonly moveTarget = new Vec3();
    private readonly lastDirection = new Vec2(1, 0);
    private readonly touchLocation = new Vec2();
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
    private slashVisual!: Node;
    private slashAnimation!: Animation;
    private enemyHealthBar!: Node;
    private enemyHealthGraphics!: Graphics;
    private scoreLabel!: Label;
    private canvasTransform!: UITransform;
    private arena!: Node;

    private touchActive = false;
    private movementState = '';
    private attackTimer = 0.15;
    private hurtTimer = 0;
    private slashTimer = 0;
    private hitFlashTimer = 0;
    private contactTimer = 0;
    private enemySlowTimer = 0;
    private respawnTimer = 0;
    private enemyHealth = 3;
    private kills = 0;

    private readonly playerSpeed = 280;
    private readonly enemySpeed = 72;
    private readonly attackCooldown = 1.0;
    private readonly attackRadius = 112;
    private readonly attackHalfAngle = 0.48;
    private readonly separationDistance = 72;
    private readonly maxEnemyHealth = 3;
    private readonly slashVisualScale = 0.58;
    private readonly slashVisualOffset = 72;

    protected onLoad(): void {
        this.canvasTransform = this.node.getComponent(UITransform)!;
        this.player = this.requireChild(this.node, 'GuanYu');
        this.playerVisual = this.requireChild(this.player, 'Visual');
        this.playerAnimation = this.playerVisual.getComponent(Animation)!;
        this.enemy = this.requireChild(this.node, 'HeadCook');
        this.enemyVisual = this.requireChild(this.enemy, 'Visual');
        this.enemySprite = this.enemyVisual.getComponent(Sprite)!;
        this.slashVisual = this.requireChild(this.node, 'SlashVisual');
        this.slashAnimation = this.slashVisual.getComponent(Animation)!;
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
        this.attackTimer -= dt;
        this.hurtTimer = Math.max(0, this.hurtTimer - dt);
        this.contactTimer = Math.max(0, this.contactTimer - dt);
        this.enemySlowTimer = Math.max(0, this.enemySlowTimer - dt);
        this.updateTimedFeedback(dt);

        this.updatePlayer(dt);
        this.updateEnemy(dt);
        this.resolveEntityCollision();
        this.updateEnemyHealthBarPosition();

        if (this.attackTimer <= 0) {
            this.attackTimer += this.attackCooldown;
            this.performAttack();
        }
    }

    private readonly onTouchStart = (event: EventTouch): void => {
        this.touchActive = true;
        this.updateTouchTarget(event);
    };

    private readonly onTouchMove = (event: EventTouch): void => {
        if (this.touchActive) {
            this.updateTouchTarget(event);
        }
    };

    private readonly onTouchEnd = (): void => {
        this.touchActive = false;
        this.moveTarget.set(this.player.position);
    };

    private updateTouchTarget(event: EventTouch): void {
        event.getUILocation(this.touchLocation);
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
            const step = this.playerSpeed * dt;
            const directionX = dx * inverseDistance;
            const directionY = dy * inverseDistance;
            this.panWorld(-directionX * step, -directionY * step);
            this.lastDirection.set(directionX, directionY);
            this.faceNode(this.playerVisual, directionX);
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
        } else if (this.contactTimer <= 0) {
            this.contactTimer = 1.05;
            this.playMovement('guan-hurt', true);
            this.hurtTimer = 0.25;
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

    private performAttack(): void {
        this.showSlash();

        if (!this.enemy.active) {
            return;
        }

        const dx = this.enemy.position.x - this.player.position.x;
        const dy = this.enemy.position.y - this.player.position.y;
        const distance = Math.hypot(dx, dy);
        if (distance > this.attackRadius || distance < 0.001) {
            return;
        }

        const inverseDistance = 1 / distance;
        const dot = dx * inverseDistance * this.lastDirection.x
            + dy * inverseDistance * this.lastDirection.y;
        if (dot < Math.cos(this.attackHalfAngle)) {
            return;
        }

        this.enemyHealth -= 1;
        this.enemySlowTimer = 2;
        this.enemySprite.color = this.enemyHitColor;
        this.hitFlashTimer = 0.12;

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

    private showSlash(): void {
        this.slashVisual.active = true;
        this.slashVisual.setPosition(
            this.player.position.x + this.lastDirection.x * this.slashVisualOffset,
            this.player.position.y + this.lastDirection.y * this.slashVisualOffset,
            0,
        );
        this.slashVisual.setRotationFromEuler(
            0,
            0,
            Math.atan2(this.lastDirection.y, this.lastDirection.x) * 180 / Math.PI,
        );
        this.slashVisual.setScale(this.slashVisualScale, this.slashVisualScale, 1);
        this.slashAnimation.play('green-dragon-slash');
        this.slashTimer = 0.24;
    }

    private updateTimedFeedback(dt: number): void {
        if (this.slashTimer > 0) {
            this.slashTimer -= dt;
            if (this.slashTimer <= 0) {
                this.slashVisual.active = false;
            }
        }

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

    private panWorld(offsetX: number, offsetY: number): void {
        this.enemy.setPosition(
            this.enemy.position.x + offsetX,
            this.enemy.position.y + offsetY,
            0,
        );

        const gridSize = 80;
        const halfGrid = gridSize * 0.5;
        const wrappedX = ((this.arena.position.x + offsetX + halfGrid) % gridSize + gridSize) % gridSize - halfGrid;
        const wrappedY = ((this.arena.position.y + offsetY + halfGrid) % gridSize + gridSize) % gridSize - halfGrid;
        this.arena.setPosition(wrappedX, wrappedY, 0);
    }

    private updateHud(): void {
        const enemyStatus = this.enemy.active
            ? `厨师长 HP ${this.enemyHealth}/${this.maxEnemyHealth}`
            : '厨师长 已击破';
        this.scoreLabel.string = `击破 ${this.kills}    ${enemyStatus}    指尖移动 · 青龙斩自动挥出`;
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

    private faceNode(node: Node, directionX: number): void {
        if (Math.abs(directionX) < 0.02) {
            return;
        }
        const nextFacingSign = directionX >= 0 ? 1 : -1;
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
