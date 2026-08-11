import {
    _decorator,
    Color,
    Component,
    Graphics,
    Node,
    Sprite,
    Vec3,
} from 'cc';

const { ccclass, property } = _decorator;

@ccclass('HeadCookController')
export class HeadCookController extends Component {
    @property({ type: Node })
    public target: Node | null = null;

    @property({ type: Node })
    public visual: Node | null = null;

    @property({ type: Graphics })
    public healthGraphics: Graphics | null = null;

    @property
    public speed = 72;

    @property
    public targetRadius = 58;

    @property
    public collisionRadius = 42;

    @property
    public maxHealth = 3;

    public health = 3;

    private readonly normalColor = new Color(255, 255, 255, 255);
    private readonly hitColor = new Color(255, 105, 78, 255);
    private sprite: Sprite | null = null;
    private slowTimer = 0;
    private flashTimer = 0;
    private respawnTimer = 0;
    private dead = false;
    private respawnIndex = 0;

    protected onLoad(): void {
        if (!this.target || !this.visual || !this.healthGraphics) {
            throw new Error('HeadCookController requires target, visual and healthGraphics references.');
        }
        this.sprite = this.visual.getComponent(Sprite);
        if (!this.sprite) {
            throw new Error('HeadCookController requires Sprite on its Visual node.');
        }
        this.health = this.maxHealth;
        this.drawHealthBar();
    }

    protected update(deltaTime: number): void {
        const dt = Math.min(deltaTime, 0.05);
        this.slowTimer = Math.max(0, this.slowTimer - dt);
        this.updateFlash(dt);

        if (this.dead) {
            this.respawnTimer -= dt;
            if (this.respawnTimer <= 0) {
                this.respawn();
            }
            return;
        }

        this.chaseTarget(dt);
    }

    public get isAlive(): boolean {
        return !this.dead;
    }

    public isTouchingTarget(): boolean {
        return !this.dead
            && !!this.target
            && Vec3.distance(this.node.position, this.target.position)
                <= this.targetRadius + this.collisionRadius + 1;
    }

    public takeDamage(damage: number, origin: Readonly<Vec3>): boolean {
        if (this.dead) {
            return false;
        }

        this.health = Math.max(0, this.health - damage);
        this.slowTimer = 2;
        this.flashTimer = 0.12;
        if (this.sprite) {
            this.sprite.color = this.hitColor;
        }

        const position = this.node.position;
        const dx = position.x - origin.x;
        const dy = position.y - origin.y;
        const distance = Math.max(0.001, Math.hypot(dx, dy));
        this.node.setPosition(
            position.x + dx / distance * 18,
            position.y + dy / distance * 18,
            0,
        );
        this.drawHealthBar();

        if (this.health > 0) {
            return false;
        }

        this.dead = true;
        this.respawnTimer = 0.55;
        if (this.visual) {
            this.visual.active = false;
        }
        if (this.healthGraphics) {
            this.healthGraphics.node.active = false;
        }
        return true;
    }

    private chaseTarget(dt: number): void {
        if (!this.target) {
            return;
        }

        const targetPosition = this.target.position;
        const position = this.node.position;
        const dx = targetPosition.x - position.x;
        const dy = targetPosition.y - position.y;
        const distance = Math.hypot(dx, dy);
        const separation = this.targetRadius + this.collisionRadius;
        if (distance <= separation) {
            return;
        }

        const inverseDistance = 1 / distance;
        const currentSpeed = this.slowTimer > 0 ? Math.max(18, this.speed - 12) : this.speed;
        const step = Math.min(distance - separation, currentSpeed * dt);
        const directionX = dx * inverseDistance;
        this.node.setPosition(
            position.x + directionX * step,
            position.y + dy * inverseDistance * step,
            0,
        );
        this.faceDirection(directionX);
    }

    private respawn(): void {
        if (!this.target) {
            return;
        }

        const target = this.target.position;
        const offsets = [
            new Vec3(520, 210, 0),
            new Vec3(-520, -150, 0),
            new Vec3(230, -360, 0),
            new Vec3(-260, 360, 0),
        ];
        const offset = offsets[this.respawnIndex % offsets.length];
        this.respawnIndex += 1;
        this.node.setPosition(target.x + offset.x, target.y + offset.y, 0);
        this.health = this.maxHealth;
        this.slowTimer = 0;
        this.dead = false;
        if (this.sprite) {
            this.sprite.color = this.normalColor;
        }
        if (this.visual) {
            this.visual.active = true;
        }
        if (this.healthGraphics) {
            this.healthGraphics.node.active = true;
        }
        this.drawHealthBar();
    }

    private updateFlash(dt: number): void {
        if (this.flashTimer <= 0) {
            return;
        }
        this.flashTimer -= dt;
        if (this.flashTimer <= 0 && this.sprite) {
            this.sprite.color = this.normalColor;
        }
    }

    private drawHealthBar(): void {
        if (!this.healthGraphics) {
            return;
        }
        const width = 92;
        const height = 12;
        const ratio = Math.max(0, this.health / this.maxHealth);
        this.healthGraphics.clear();
        this.healthGraphics.fillColor = new Color(37, 24, 20, 230);
        this.healthGraphics.rect(-width * 0.5 - 3, -height * 0.5 - 3, width + 6, height + 6);
        this.healthGraphics.fill();
        this.healthGraphics.fillColor = new Color(206, 62, 47, 255);
        this.healthGraphics.rect(-width * 0.5, -height * 0.5, width * ratio, height);
        this.healthGraphics.fill();
    }

    private faceDirection(directionX: number): void {
        if (!this.visual || Math.abs(directionX) < 0.02) {
            return;
        }
        const nextSign = directionX >= 0 ? 1 : -1;
        const scale = this.visual.scale;
        const currentSign = scale.x >= 0 ? 1 : -1;
        if (nextSign !== currentSign) {
            this.visual.setScale(Math.abs(scale.x) * nextSign, scale.y, scale.z);
        }
    }
}
