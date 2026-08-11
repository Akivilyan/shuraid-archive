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
    private readonly scratchPosition = new Vec3();
    private readonly touchPosition = new Vec3();

    private player!: Node;
    private playerVisual!: Node;
    private playerAnimation!: Animation;
    private enemy!: Node;
    private enemyVisual!: Node;
    private enemySprite!: Sprite;
    private slashVisual!: Node;
    private scoreLabel!: Label;
    private canvasTransform!: UITransform;

    private touchActive = false;
    private movementState = '';
    private attackTimer = 0.15;
    private attackLock = 0;
    private contactTimer = 0;
    private enemySlowTimer = 0;
    private respawnTimer = 0;
    private enemyHealth = 3;
    private kills = 0;

    private readonly playerSpeed = 280;
    private readonly enemySpeed = 72;
    private readonly attackCooldown = 0.6;
    private readonly attackRadius = 112;
    private readonly attackHalfAngle = 0.48;

    protected onLoad(): void {
        this.canvasTransform = this.node.getComponent(UITransform)!;
        this.player = this.requireChild(this.node, 'GuanYu');
        this.playerVisual = this.requireChild(this.player, 'Visual');
        this.playerAnimation = this.playerVisual.getComponent(Animation)!;
        this.enemy = this.requireChild(this.node, 'HeadCook');
        this.enemyVisual = this.requireChild(this.enemy, 'Visual');
        this.enemySprite = this.enemyVisual.getComponent(Sprite)!;
        this.slashVisual = this.requireChild(this.node, 'SlashVisual');

        const scoreNode = this.requireChild(this.node, 'Score');
        const scoreTransform = scoreNode.getComponent(UITransform) ?? scoreNode.addComponent(UITransform);
        scoreTransform.setContentSize(560, 54);
        this.scoreLabel = scoreNode.getComponent(Label) ?? scoreNode.addComponent(Label);
        this.scoreLabel.fontSize = 28;
        this.scoreLabel.lineHeight = 36;
        this.scoreLabel.color = new Color(255, 238, 196, 255);

        this.moveTarget.set(this.player.position);
        this.drawArena();
        this.drawSlash();
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
        this.attackLock = Math.max(0, this.attackLock - dt);
        this.contactTimer = Math.max(0, this.contactTimer - dt);
        this.enemySlowTimer = Math.max(0, this.enemySlowTimer - dt);

        this.updatePlayer(dt);
        this.updateEnemy(dt);

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
        const location = event.getUILocation();
        this.touchPosition.set(location.x, location.y, 0);
        this.canvasTransform.convertToNodeSpaceAR(this.touchPosition, this.moveTarget);
        this.clampToArena(this.moveTarget, 44);
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
            this.scratchPosition.set(
                position.x + directionX * step,
                position.y + directionY * step,
                0,
            );
            this.clampToArena(this.scratchPosition, 44);
            this.player.setPosition(this.scratchPosition);
            this.lastDirection.set(directionX, directionY);
            this.faceNode(this.playerVisual, directionX);
            moving = true;
        }

        if (this.attackLock <= 0) {
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

        if (distance > 48) {
            const inverseDistance = 1 / distance;
            const speed = this.enemySlowTimer > 0 ? Math.max(18, this.enemySpeed - 12) : this.enemySpeed;
            const step = Math.min(distance - 48, speed * dt);
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
            this.attackLock = Math.max(this.attackLock, 0.25);
            if (distance > 0.001) {
                const push = 22 / distance;
                this.scratchPosition.set(
                    playerPosition.x + dx * push,
                    playerPosition.y + dy * push,
                    0,
                );
                this.clampToArena(this.scratchPosition, 44);
                this.player.setPosition(this.scratchPosition);
                this.moveTarget.set(this.scratchPosition);
            }
        }
    }

    private performAttack(): void {
        this.playerAnimation.play('guan-attack');
        this.movementState = 'guan-attack';
        this.attackLock = 0.6;
        this.showSlash();

        if (!this.enemy.active) {
            return;
        }

        const playerPosition = this.player.position;
        const enemyPosition = this.enemy.position;
        const dx = enemyPosition.x - playerPosition.x;
        const dy = enemyPosition.y - playerPosition.y;
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
        this.enemySprite.color = new Color(255, 120, 92, 255);
        this.scheduleOnce(() => {
            if (this.enemySprite.isValid) {
                this.enemySprite.color = new Color(255, 255, 255, 255);
            }
        }, 0.1);

        this.enemy.setPosition(
            enemyPosition.x + dx * inverseDistance * 18,
            enemyPosition.y + dy * inverseDistance * 18,
            0,
        );

        if (this.enemyHealth <= 0) {
            this.enemy.active = false;
            this.respawnTimer = 0.55;
            this.kills += 1;
            this.updateHud();
        }
    }

    private showSlash(): void {
        this.slashVisual.active = true;
        this.slashVisual.setPosition(this.player.position);
        this.slashVisual.setRotationFromEuler(
            0,
            0,
            Math.atan2(this.lastDirection.y, this.lastDirection.x) * 180 / Math.PI,
        );
        this.slashVisual.setScale(1, 1, 1);
        this.scheduleOnce(() => {
            if (this.slashVisual.isValid) {
                this.slashVisual.active = false;
            }
        }, 0.16);
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
        this.enemyHealth = 3;
        this.enemySlowTimer = 0;
        this.enemySprite.color = new Color(255, 255, 255, 255);
        this.enemy.active = true;
    }

    private drawSlash(): void {
        const graphics = this.slashVisual.getComponent(Graphics) ?? this.slashVisual.addComponent(Graphics);
        graphics.clear();
        graphics.fillColor = new Color(255, 188, 48, 118);
        graphics.strokeColor = new Color(255, 232, 140, 230);
        graphics.lineWidth = 8;
        graphics.moveTo(0, 0);
        graphics.lineTo(
            Math.cos(-this.attackHalfAngle) * this.attackRadius,
            Math.sin(-this.attackHalfAngle) * this.attackRadius,
        );
        graphics.arc(0, 0, this.attackRadius, -this.attackHalfAngle, this.attackHalfAngle, false);
        graphics.close();
        graphics.fill();
        graphics.stroke();
        this.slashVisual.active = false;
    }

    private drawArena(): void {
        const arena = this.requireChild(this.node, 'Arena');
        const graphics = arena.getComponent(Graphics) ?? arena.addComponent(Graphics);
        const size = this.canvasTransform.contentSize;
        const left = -size.width * 0.5;
        const bottom = -size.height * 0.5;
        graphics.clear();
        graphics.fillColor = new Color(44, 35, 30, 255);
        graphics.rect(left, bottom, size.width, size.height);
        graphics.fill();
        graphics.strokeColor = new Color(111, 82, 54, 90);
        graphics.lineWidth = 2;
        for (let x = left; x <= -left; x += 80) {
            graphics.moveTo(x, bottom);
            graphics.lineTo(x, -bottom);
        }
        for (let y = bottom; y <= -bottom; y += 80) {
            graphics.moveTo(left, y);
            graphics.lineTo(-left, y);
        }
        graphics.stroke();
    }

    private updateHud(): void {
        this.scoreLabel.string = `击破 ${this.kills}    指尖移动 · 青龙斩自动挥击`;
        const size = this.canvasTransform.contentSize;
        this.scoreLabel.node.setPosition(-size.width * 0.5 + 300, size.height * 0.5 - 48, 0);
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
        const scale = node.scale;
        node.setScale(Math.abs(scale.x) * (directionX >= 0 ? 1 : -1), scale.y, scale.z);
    }

    private clampToArena(position: Vec3, margin: number): void {
        const size = this.canvasTransform.contentSize;
        const halfWidth = Math.max(0, size.width * 0.5 - margin);
        const halfHeight = Math.max(0, size.height * 0.5 - margin);
        position.x = Math.max(-halfWidth, Math.min(halfWidth, position.x));
        position.y = Math.max(-halfHeight, Math.min(halfHeight, position.y));
    }

    private requireChild(parent: Node, name: string): Node {
        const child = parent.getChildByName(name);
        if (!child) {
            throw new Error(`BattleSlice requires ${parent.name}/${name}`);
        }
        return child;
    }
}
