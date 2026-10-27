export const FIXED_STEP = 1 / 60;
export const DEFAULT_RUN_DURATION = 180;

export type UpgradeId = 'pulseDamage' | 'pulseRate' | 'pulseCount' | 'orbit' | 'vitality';
export type BattleResult = 'playing' | 'victory' | 'defeat';

export interface Vec2Like {
  x: number;
  y: number;
}

export interface EnemyState extends Vec2Like {
  id: number;
  hp: number;
  maxHp: number;
  radius: number;
  speed: number;
  damage: number;
  elite: boolean;
  orbitCooldown: number;
}

export interface ProjectileState extends Vec2Like {
  id: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  life: number;
  pierce: number;
}

export interface GemState extends Vec2Like {
  id: number;
  value: number;
}

export interface BattleEvent {
  type: 'fire' | 'hit' | 'kill' | 'pickup' | 'playerDamaged' | 'levelUp' | 'result';
  x?: number;
  y?: number;
  value?: number;
  result?: BattleResult;
}

export interface BattleConfig {
  runDuration?: number;
  random?: () => number;
  autoSpawn?: boolean;
}

const WORLD_HALF_WIDTH = 180;
const WORLD_HALF_HEIGHT = 352;
const PLAYER_RADIUS = 20;
const PLAYER_SPEED = 215;
const PROJECTILE_SPEED = 520;
const BASE_FIRE_INTERVAL = 0.68;
const PICKUP_RADIUS = 34;
const MAGNET_RADIUS = 150;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function length(x: number, y: number): number {
  return Math.sqrt(x * x + y * y);
}

function normalize(x: number, y: number): Vec2Like {
  const magnitude = length(x, y);
  if (magnitude <= 0.0001) {
    return { x: 0, y: 0 };
  }
  return { x: x / magnitude, y: y / magnitude };
}

export class BattleModel {
  readonly runDuration: number;
  readonly random: () => number;
  readonly autoSpawn: boolean;

  runTime = 0;
  result: BattleResult = 'playing';
  paused = false;
  level = 1;
  xp = 0;
  xpNeeded = 5;
  kills = 0;
  pendingLevelUps = 0;

  player = {
    x: 0,
    y: -90,
    radius: PLAYER_RADIUS,
    hp: 100,
    maxHp: 100,
    invulnerable: 0,
  };

  input: Vec2Like = { x: 0, y: 0 };
  upgrades: Record<UpgradeId, number> = {
    pulseDamage: 0,
    pulseRate: 0,
    pulseCount: 0,
    orbit: 0,
    vitality: 0,
  };

  enemies: EnemyState[] = [];
  projectiles: ProjectileState[] = [];
  gems: GemState[] = [];

  private nextId = 1;
  private spawnTimer = 0.2;
  private fireTimer = 0.3;
  private nextEliteTime = 30;
  private orbitAngle = 0;
  private events: BattleEvent[] = [];

  constructor(config: BattleConfig = {}) {
    this.runDuration = config.runDuration || DEFAULT_RUN_DURATION;
    this.random = config.random || Math.random;
    this.autoSpawn = config.autoSpawn !== false;
  }

  setMoveInput(x: number, y: number): void {
    const direction = normalize(x, y);
    this.input.x = direction.x;
    this.input.y = direction.y;
  }

  step(dt: number): void {
    if (this.paused || this.result !== 'playing') {
      return;
    }

    const delta = clamp(dt, 0, 0.05);
    this.runTime += delta;
    this.player.invulnerable = Math.max(0, this.player.invulnerable - delta);

    if (this.runTime >= this.runDuration) {
      this.runTime = this.runDuration;
      this.finish('victory');
      return;
    }

    this.movePlayer(delta);
    this.spawnEnemies(delta);
    this.moveEnemies(delta);
    this.updateWeapon(delta);
    this.updateProjectiles(delta);
    this.updateOrbit(delta);
    this.updateGems(delta);
    this.resolvePlayerContact();
  }

  debugSpawnEnemy(x: number, y: number, hp = 20, elite = false): EnemyState {
    const enemy: EnemyState = {
      id: this.nextId++,
      x,
      y,
      hp,
      maxHp: hp,
      radius: elite ? 29 : 17,
      speed: elite ? 45 : 55,
      damage: elite ? 18 : 10,
      elite,
      orbitCooldown: 0,
    };
    this.enemies.push(enemy);
    return enemy;
  }

  debugAddXp(value: number): void {
    this.addXp(value);
  }

  getUpgradeChoices(): UpgradeId[] {
    const all: UpgradeId[] = ['pulseDamage', 'pulseRate', 'pulseCount', 'orbit', 'vitality'];
    const available = all.filter((id) => this.upgrades[id] < this.getUpgradeMax(id));
    if (available.length <= 3) {
      return available;
    }

    const selected: UpgradeId[] = [];
    if (this.upgrades.orbit === 0) {
      selected.push('orbit');
    }
    let cursor = (this.level + this.kills) % available.length;
    while (selected.length < 3) {
      const candidate = available[cursor % available.length];
      if (selected.indexOf(candidate) < 0) {
        selected.push(candidate);
      }
      cursor += 2;
    }
    return selected;
  }

  applyUpgrade(id: UpgradeId): void {
    if (!this.paused || this.pendingLevelUps <= 0 || this.upgrades[id] >= this.getUpgradeMax(id)) {
      return;
    }
    this.upgrades[id] += 1;
    if (id === 'vitality') {
      this.player.maxHp += 20;
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + 30);
    }
    this.pendingLevelUps -= 1;
    this.paused = this.pendingLevelUps > 0;
  }

  drainEvents(): BattleEvent[] {
    const drained = this.events;
    this.events = [];
    return drained;
  }

  getOrbitPositions(): Vec2Like[] {
    const level = this.upgrades.orbit;
    if (level <= 0) {
      return [];
    }
    const count = 1 + Math.floor((level - 1) / 2);
    const radius = 72 + level * 4;
    const result: Vec2Like[] = [];
    for (let index = 0; index < count; index += 1) {
      const angle = this.orbitAngle + (Math.PI * 2 * index) / count;
      result.push({
        x: this.player.x + Math.cos(angle) * radius,
        y: this.player.y + Math.sin(angle) * radius,
      });
    }
    return result;
  }

  private getUpgradeMax(id: UpgradeId): number {
    if (id === 'pulseCount') {
      return 4;
    }
    if (id === 'vitality') {
      return 3;
    }
    return 5;
  }

  private movePlayer(dt: number): void {
    this.player.x = clamp(
      this.player.x + this.input.x * PLAYER_SPEED * dt,
      -WORLD_HALF_WIDTH + PLAYER_RADIUS,
      WORLD_HALF_WIDTH - PLAYER_RADIUS,
    );
    this.player.y = clamp(
      this.player.y + this.input.y * PLAYER_SPEED * dt,
      -WORLD_HALF_HEIGHT + PLAYER_RADIUS,
      WORLD_HALF_HEIGHT - PLAYER_RADIUS,
    );
  }

  private spawnEnemies(dt: number): void {
    if (!this.autoSpawn) {
      return;
    }
    this.spawnTimer -= dt;
    const interval = Math.max(0.16, 0.52 - this.runTime * 0.0019);
    while (this.spawnTimer <= 0 && this.enemies.length < 135) {
      this.spawnEnemyAtEdge(false);
      this.spawnTimer += interval;
    }
    if (this.runTime >= this.nextEliteTime) {
      this.spawnEnemyAtEdge(true);
      this.nextEliteTime += 30;
    }
  }

  private spawnEnemyAtEdge(elite: boolean): void {
    const side = Math.floor(this.random() * 4);
    const horizontal = (this.random() * 2 - 1) * WORLD_HALF_WIDTH;
    const vertical = (this.random() * 2 - 1) * WORLD_HALF_HEIGHT;
    let x = horizontal;
    let y = vertical;
    if (side === 0) y = WORLD_HALF_HEIGHT + 28;
    if (side === 1) x = WORLD_HALF_WIDTH + 28;
    if (side === 2) y = -WORLD_HALF_HEIGHT - 28;
    if (side === 3) x = -WORLD_HALF_WIDTH - 28;

    const pressure = 1 + this.runTime / 150;
    const baseHp = elite ? 150 : 20;
    const enemy = this.debugSpawnEnemy(x, y, Math.round(baseHp * pressure), elite);
    enemy.speed += this.random() * 18 + this.runTime * 0.035;
  }

  private moveEnemies(dt: number): void {
    for (const enemy of this.enemies) {
      const direction = normalize(this.player.x - enemy.x, this.player.y - enemy.y);
      const sway = Math.sin(this.runTime * 1.7 + enemy.id * 0.83) * 0.16;
      enemy.x += (direction.x - direction.y * sway) * enemy.speed * dt;
      enemy.y += (direction.y + direction.x * sway) * enemy.speed * dt;
      enemy.orbitCooldown = Math.max(0, enemy.orbitCooldown - dt);
    }
  }

  private updateWeapon(dt: number): void {
    this.fireTimer -= dt;
    const interval = BASE_FIRE_INTERVAL * Math.pow(0.86, this.upgrades.pulseRate);
    while (this.fireTimer <= 0) {
      this.fireTimer += interval;
      this.fireVolley();
    }
  }

  private fireVolley(): void {
    if (this.enemies.length === 0) {
      return;
    }
    let target = this.enemies[0];
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const enemy of this.enemies) {
      const dx = enemy.x - this.player.x;
      const dy = enemy.y - this.player.y;
      const distanceSquared = dx * dx + dy * dy;
      if (distanceSquared < bestDistance) {
        bestDistance = distanceSquared;
        target = enemy;
      }
    }
    const aim = Math.atan2(target.y - this.player.y, target.x - this.player.x);
    const count = 1 + this.upgrades.pulseCount;
    const damage = 12 + this.upgrades.pulseDamage * 7;
    for (let index = 0; index < count; index += 1) {
      const spread = (index - (count - 1) / 2) * 0.13;
      const angle = aim + spread;
      this.projectiles.push({
        id: this.nextId++,
        x: this.player.x,
        y: this.player.y,
        vx: Math.cos(angle) * PROJECTILE_SPEED,
        vy: Math.sin(angle) * PROJECTILE_SPEED,
        radius: 7,
        damage,
        life: 1.35,
        pierce: this.upgrades.pulseDamage >= 4 ? 2 : 1,
      });
    }
    this.events.push({ type: 'fire', x: this.player.x, y: this.player.y });
  }

  private updateProjectiles(dt: number): void {
    for (let projectileIndex = this.projectiles.length - 1; projectileIndex >= 0; projectileIndex -= 1) {
      const projectile = this.projectiles[projectileIndex];
      projectile.x += projectile.vx * dt;
      projectile.y += projectile.vy * dt;
      projectile.life -= dt;
      let removeProjectile = projectile.life <= 0;

      for (let enemyIndex = this.enemies.length - 1; enemyIndex >= 0 && !removeProjectile; enemyIndex -= 1) {
        const enemy = this.enemies[enemyIndex];
        const dx = enemy.x - projectile.x;
        const dy = enemy.y - projectile.y;
        const collisionRadius = enemy.radius + projectile.radius;
        if (dx * dx + dy * dy <= collisionRadius * collisionRadius) {
          enemy.hp -= projectile.damage;
          projectile.pierce -= 1;
          this.events.push({ type: 'hit', x: enemy.x, y: enemy.y, value: projectile.damage });
          if (enemy.hp <= 0) {
            this.killEnemy(enemyIndex);
          }
          removeProjectile = projectile.pierce <= 0;
        }
      }

      if (removeProjectile) {
        this.projectiles.splice(projectileIndex, 1);
      }
    }
  }

  private updateOrbit(dt: number): void {
    const level = this.upgrades.orbit;
    if (level <= 0) {
      return;
    }
    this.orbitAngle += dt * (2.2 + level * 0.18);
    const positions = this.getOrbitPositions();
    for (let enemyIndex = this.enemies.length - 1; enemyIndex >= 0; enemyIndex -= 1) {
      const enemy = this.enemies[enemyIndex];
      if (enemy.orbitCooldown > 0) {
        continue;
      }
      for (const orbiter of positions) {
        const dx = enemy.x - orbiter.x;
        const dy = enemy.y - orbiter.y;
        const collisionRadius = enemy.radius + 15;
        if (dx * dx + dy * dy <= collisionRadius * collisionRadius) {
          const damage = 8 + level * 5;
          enemy.hp -= damage;
          enemy.orbitCooldown = 0.34;
          this.events.push({ type: 'hit', x: enemy.x, y: enemy.y, value: damage });
          if (enemy.hp <= 0) {
            this.killEnemy(enemyIndex);
          }
          break;
        }
      }
    }
  }

  private updateGems(dt: number): void {
    for (let index = this.gems.length - 1; index >= 0; index -= 1) {
      const gem = this.gems[index];
      const dx = this.player.x - gem.x;
      const dy = this.player.y - gem.y;
      const distance = length(dx, dy);
      if (distance <= PICKUP_RADIUS) {
        this.gems.splice(index, 1);
        this.events.push({ type: 'pickup', x: gem.x, y: gem.y, value: gem.value });
        this.addXp(gem.value);
        continue;
      }
      if (distance <= MAGNET_RADIUS) {
        const direction = normalize(dx, dy);
        const speed = 250 + (MAGNET_RADIUS - distance) * 4;
        gem.x += direction.x * speed * dt;
        gem.y += direction.y * speed * dt;
      }
    }
  }

  private resolvePlayerContact(): void {
    if (this.player.invulnerable > 0) {
      return;
    }
    for (const enemy of this.enemies) {
      const dx = enemy.x - this.player.x;
      const dy = enemy.y - this.player.y;
      const collisionRadius = enemy.radius + this.player.radius;
      if (dx * dx + dy * dy <= collisionRadius * collisionRadius) {
        this.player.hp = Math.max(0, this.player.hp - enemy.damage);
        this.player.invulnerable = 0.62;
        this.events.push({ type: 'playerDamaged', x: this.player.x, y: this.player.y, value: enemy.damage });
        if (this.player.hp <= 0) {
          this.finish('defeat');
        }
        return;
      }
    }
  }

  private killEnemy(index: number): void {
    const enemy = this.enemies[index];
    this.enemies.splice(index, 1);
    this.kills += 1;
    this.gems.push({
      id: this.nextId++,
      x: enemy.x,
      y: enemy.y,
      value: enemy.elite ? 5 : 1,
    });
    this.events.push({ type: 'kill', x: enemy.x, y: enemy.y, value: enemy.elite ? 5 : 1 });
  }

  private addXp(value: number): void {
    this.xp += value;
    while (this.xp >= this.xpNeeded) {
      this.xp -= this.xpNeeded;
      this.level += 1;
      this.xpNeeded = 5 + Math.floor(this.level * 1.8);
      this.pendingLevelUps += 1;
      this.events.push({ type: 'levelUp', value: this.level });
    }
    if (this.pendingLevelUps > 0) {
      this.paused = true;
    }
  }

  private finish(result: BattleResult): void {
    this.result = result;
    this.paused = true;
    this.setMoveInput(0, 0);
    this.events.push({ type: 'result', result });
  }
}
