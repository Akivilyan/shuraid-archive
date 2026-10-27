import {
    _decorator,
    Component,
    game,
    Label,
} from 'cc';
import { GreenDragonSlash } from './GreenDragonSlash';
import { GuanYuController } from './GuanYuController';
import { HeadCookController } from './HeadCookController';

const { ccclass, property } = _decorator;

interface WeChatFramePacingApi {
    setPreferredFramesPerSecond?: (frameRate: number) => void;
}

@ccclass('BattleController')
export class BattleController extends Component {
    @property({ type: GuanYuController })
    public player: GuanYuController | null = null;

    @property({ type: HeadCookController })
    public enemy: HeadCookController | null = null;

    @property({ type: GreenDragonSlash })
    public slash: GreenDragonSlash | null = null;

    @property({ type: Label })
    public scoreLabel: Label | null = null;

    private attackTimer = 0.15;
    private contactTimer = 0;
    private playerHealth = 10;
    private kills = 0;
    private readonly maxPlayerHealth = 10;
    private readonly attackCooldown = 1;
    private readonly contactCooldown = 1;

    protected onLoad(): void {
        this.configureFramePacing();
        if (!this.player || !this.enemy || !this.slash || !this.scoreLabel) {
            throw new Error('BattleController requires player, enemy, slash and scoreLabel references.');
        }
        this.updateHud();
    }

    private configureFramePacing(): void {
        const frameRate = 60;
        game.frameRate = frameRate;

        const platform = globalThis as typeof globalThis & { wx?: WeChatFramePacingApi };
        platform.wx?.setPreferredFramesPerSecond?.(frameRate);
    }

    protected update(deltaTime: number): void {
        const dt = Math.min(deltaTime, 0.05);
        this.attackTimer -= dt;
        this.contactTimer = Math.max(0, this.contactTimer - dt);

        if (this.enemy?.isTouchingTarget() && this.contactTimer <= 0 && this.playerHealth > 0) {
            this.playerHealth = Math.max(0, this.playerHealth - 1);
            this.contactTimer = this.contactCooldown;
            this.player?.playHurt();
            this.updateHud();
        }

        if (this.attackTimer <= 0) {
            this.attackTimer += this.attackCooldown;
            this.performAttack();
        }
    }

    private performAttack(): void {
        if (!this.player || !this.enemy || !this.slash) {
            return;
        }
        this.slash.activate(this.player.node.position, this.player.lastDirection);
        if (!this.enemy.isAlive
            || !this.slash.hitsCircle(this.enemy.node.position, this.enemy.collisionRadius)) {
            return;
        }
        if (this.enemy.takeDamage(1, this.player.node.position)) {
            this.kills += 1;
        }
        this.updateHud();
    }

    private updateHud(): void {
        if (!this.scoreLabel || !this.enemy) {
            return;
        }
        const enemyStatus = this.enemy.isAlive
            ? `厨师长 HP ${this.enemy.health}/${this.enemy.maxHealth}`
            : '厨师长 已击破';
        this.scoreLabel.string = `关羽 HP ${this.playerHealth}/${this.maxPlayerHealth}    击破 ${this.kills}    ${enemyStatus}`;
    }
}
