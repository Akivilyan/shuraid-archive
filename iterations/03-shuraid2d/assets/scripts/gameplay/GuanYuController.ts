import {
    _decorator,
    Animation,
    Component,
    EventTouch,
    input,
    Input,
    Node,
    Vec2,
} from 'cc';

const { ccclass, property } = _decorator;

@ccclass('GuanYuController')
export class GuanYuController extends Component {
    @property({ type: Node })
    public visual: Node | null = null;

    @property
    public speed = 280;

    @property
    public joystickDeadZone = 12;

    @property
    public movementLimitX = 1360;

    @property
    public movementLimitY = 1140;

    public readonly lastDirection = new Vec2(1, 0);

    private readonly touchStart = new Vec2();
    private readonly touchCurrent = new Vec2();
    private animation: Animation | null = null;
    private touchActive = false;
    private hurtTimer = 0;
    private movementState = '';

    protected onLoad(): void {
        if (!this.visual) {
            throw new Error('GuanYuController requires a Visual node reference.');
        }
        this.animation = this.visual.getComponent(Animation);
        if (!this.animation) {
            throw new Error('GuanYuController requires Animation on its Visual node.');
        }
        this.playMovement('guan-idle');
    }

    protected onEnable(): void {
        input.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
        input.on(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
        input.on(Input.EventType.TOUCH_END, this.onTouchEnd, this);
        input.on(Input.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
    }

    protected onDisable(): void {
        input.off(Input.EventType.TOUCH_START, this.onTouchStart, this);
        input.off(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
        input.off(Input.EventType.TOUCH_END, this.onTouchEnd, this);
        input.off(Input.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
    }

    protected update(deltaTime: number): void {
        const dt = Math.min(deltaTime, 0.05);
        this.hurtTimer = Math.max(0, this.hurtTimer - dt);

        const directionX = this.touchCurrent.x - this.touchStart.x;
        const directionY = this.touchCurrent.y - this.touchStart.y;
        const distance = Math.hypot(directionX, directionY);
        const moving = this.touchActive && distance > this.joystickDeadZone;

        if (moving) {
            const inverseDistance = 1 / distance;
            const normalizedX = directionX * inverseDistance;
            const normalizedY = directionY * inverseDistance;
            const position = this.node.position;
            const nextX = Math.max(
                -this.movementLimitX,
                Math.min(this.movementLimitX, position.x + normalizedX * this.speed * dt),
            );
            const nextY = Math.max(
                -this.movementLimitY,
                Math.min(this.movementLimitY, position.y + normalizedY * this.speed * dt),
            );
            this.node.setPosition(
                nextX,
                nextY,
                0,
            );
            this.lastDirection.set(normalizedX, normalizedY);
            this.faceDirection(normalizedX);
        }

        if (this.hurtTimer <= 0) {
            this.playMovement(moving ? 'guan-move' : 'guan-idle');
        }
    }

    public playHurt(duration = 0.25): void {
        this.hurtTimer = duration;
        this.playMovement('guan-hurt', true);
    }

    private readonly onTouchStart = (event: EventTouch): void => {
        event.getUILocation(this.touchStart);
        this.touchCurrent.set(this.touchStart);
        this.touchActive = true;
    };

    private readonly onTouchMove = (event: EventTouch): void => {
        if (this.touchActive) {
            event.getUILocation(this.touchCurrent);
        }
    };

    private readonly onTouchEnd = (): void => {
        this.touchActive = false;
        this.touchCurrent.set(this.touchStart);
    };

    private faceDirection(directionX: number): void {
        if (!this.visual || Math.abs(directionX) < 0.02) {
            return;
        }
        const nextSign = directionX >= 0 ? -1 : 1;
        const scale = this.visual.scale;
        const currentSign = scale.x >= 0 ? 1 : -1;
        if (nextSign !== currentSign) {
            this.visual.setScale(Math.abs(scale.x) * nextSign, scale.y, scale.z);
        }
    }

    private playMovement(name: string, force = false): void {
        if (!this.animation || (!force && this.movementState === name)) {
            return;
        }
        this.movementState = name;
        this.animation.play(name);
    }
}
