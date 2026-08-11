import {
    _decorator,
    Animation,
    Component,
    Vec2,
    Vec3,
} from 'cc';

const { ccclass, property } = _decorator;

@ccclass('GreenDragonSlash')
export class GreenDragonSlash extends Component {
    @property({ type: Animation })
    public animation: Animation | null = null;

    @property
    public visualScale = 0.58;

    @property
    public forwardOffset = 72;

    @property
    public hitRadius = 220;

    @property
    public rearAllowance = 58;

    private remaining = 0;
    private forwardX = 1;
    private forwardY = 0;

    protected onLoad(): void {
        if (!this.animation) {
            throw new Error('GreenDragonSlash requires an Animation reference.');
        }
    }

    protected update(deltaTime: number): void {
        if (this.remaining <= 0) {
            return;
        }
        this.remaining -= Math.min(deltaTime, 0.05);
        if (this.remaining <= 0) {
            this.node.active = false;
        }
    }

    public activate(origin: Readonly<Vec3>, direction: Readonly<Vec2>): void {
        if (!this.animation) {
            return;
        }
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
