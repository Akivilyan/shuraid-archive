export interface Vec2Like {
  x: number;
  y: number;
}

export interface MigrationRules {
  hero: {
    health: number;
    attack: number;
    attackInterval: number;
    attackRange: number;
    speed: number;
    radius: number;
  };
  enemy: {
    type: string;
    health: number;
    speed: number;
    damage: number;
    experience: number;
    radius: number;
  };
  blade: {
    damageMultiplier: number;
    knockback: number;
    halfAngle: number;
    visualLife: number;
  };
  ringblade: {
    range: number;
    damage: number;
    cooldown: number;
    knockback: number;
    visualLife: number;
    rotations: number;
    gripPivot: number;
  };
  warmWine: {
    range: number;
    halfWidth: number;
    damage: number;
    cooldown: number;
    knockback: number;
    visualLife: number;
    cloneScale: number;
  };
  sliceHarness: {
    duration: number;
    spawnInterval: number;
    maxEnemies: number;
  };
}

export interface EnemyState extends Vec2Like {
  id: number;
  health: number;
  hurtTime: number;
  contactCooldown: number;
  previousX: number;
  previousY: number;
}

export type BattleEndReason = "time" | "defeat";

export type BattleEvent =
  | { type: "spawn"; enemy: EnemyState }
  | { type: "enemy-hit"; enemyId: number; x: number; y: number }
  | { type: "enemy-down"; enemyId: number; x: number; y: number }
  | { type: "hero-hit"; health: number }
  | { type: "blade"; x: number; y: number; facing: Vec2Like; range: number; halfAngle: number; life: number }
  | { type: "ringblade"; x: number; y: number; range: number; life: number; rotations: number }
  | { type: "warm-wine"; x: number; y: number; facing: Vec2Like; range: number; halfWidth: number; life: number; scale: number }
  | { type: "battle-ended"; reason: BattleEndReason }
  | { type: "reset" };

const NO_EVENTS: BattleEvent[] = [];

function normalize(x: number, y: number): Vec2Like & { length: number } {
  const length = Math.sqrt(x * x + y * y);
  if (length <= 0.0001) {
    return { x: 0, y: 0, length: 0 };
  }
  return { x: x / length, y: y / length, length };
}

export class BattleModel {
  readonly rules: MigrationRules;
  readonly enemies: EnemyState[] = [];
  readonly events: BattleEvent[] = [];
  hero = { x: 0, y: -78, previousX: 0, previousY: -78, health: 0, facing: { x: 1, y: 0 } };
  elapsed = 0;
  kills = 0;
  finished = false;
  endReason: BattleEndReason | null = null;

  private move = { x: 0, y: 0 };
  private nextEnemyId = 1;
  private spawnCooldown = 0;
  private attackCooldown = 0;
  private ringCooldown = 0.5;
  private wineCooldown = 0.5;
  private randomState = 0x5eed1234;

  constructor(rules: MigrationRules) {
    this.rules = rules;
    this.reset();
  }

  setMoveDirection(x: number, y: number): void {
    const length = Math.sqrt(x * x + y * y);
    if (length <= 0.0001) {
      this.move.x = 0;
      this.move.y = 0;
      return;
    }
    this.move.x = x / length;
    this.move.y = y / length;
  }

  reset(): void {
    this.enemies.length = 0;
    this.hero.x = 0;
    this.hero.y = -78;
    this.hero.previousX = this.hero.x;
    this.hero.previousY = this.hero.y;
    this.hero.health = this.rules.hero.health;
    this.hero.facing = { x: 1, y: 0 };
    this.elapsed = 0;
    this.kills = 0;
    this.finished = false;
    this.endReason = null;
    this.nextEnemyId = 1;
    this.spawnCooldown = 0;
    this.attackCooldown = 0;
    this.ringCooldown = 0.5;
    this.wineCooldown = 0.5;
    this.randomState = 0x5eed1234;
    this.events.push({ type: "reset" });
  }

  update(rawDt: number): void {
    if (this.finished) {
      return;
    }
    const dt = Math.min(rawDt, 0.05);
    this.hero.previousX = this.hero.x;
    this.hero.previousY = this.hero.y;
    for (let index = 0; index < this.enemies.length; index += 1) {
      const enemy = this.enemies[index];
      enemy.previousX = enemy.x;
      enemy.previousY = enemy.y;
    }
    this.elapsed = Math.min(this.rules.sliceHarness.duration, this.elapsed + dt);
    this.updateHero(dt);
    this.updateSpawning(dt);
    this.updateEnemies(dt);
    this.updateAttacks(dt);
    if (this.hero.health <= 0) {
      this.finish("defeat");
    } else if (this.elapsed >= this.rules.sliceHarness.duration) {
      this.finish("time");
    }
  }

  drainEvents(): BattleEvent[] {
    if (this.events.length === 0) {
      return NO_EVENTS;
    }
    return this.events.splice(0, this.events.length);
  }

  private updateHero(dt: number): void {
    this.hero.x += this.move.x * this.rules.hero.speed * dt;
    this.hero.y += this.move.y * this.rules.hero.speed * dt;
    this.hero.x = Math.max(-220, Math.min(220, this.hero.x));
    this.hero.y = Math.max(-410, Math.min(350, this.hero.y));
    if (Math.abs(this.move.x) + Math.abs(this.move.y) > 0.01) {
      this.hero.facing.x = this.move.x;
      this.hero.facing.y = this.move.y;
    }
  }

  private updateSpawning(dt: number): void {
    this.spawnCooldown -= dt;
    if (this.spawnCooldown > 0 || this.enemies.length >= this.rules.sliceHarness.maxEnemies) {
      return;
    }
    this.spawnCooldown = this.rules.sliceHarness.spawnInterval;
    const angle = this.random() * Math.PI * 2;
    const radius = 235 + this.random() * 45;
    const enemy: EnemyState = {
      id: this.nextEnemyId,
      x: this.hero.x + Math.cos(angle) * radius,
      y: this.hero.y + Math.sin(angle) * radius,
      health: this.rules.enemy.health,
      hurtTime: 0,
      contactCooldown: 0,
      previousX: 0,
      previousY: 0,
    };
    enemy.x = Math.max(-230, Math.min(230, enemy.x));
    enemy.y = Math.max(-420, Math.min(365, enemy.y));
    enemy.previousX = enemy.x;
    enemy.previousY = enemy.y;
    this.nextEnemyId += 1;
    this.enemies.push(enemy);
    this.events.push({ type: "spawn", enemy });
  }

  private updateEnemies(dt: number): void {
    for (let index = 0; index < this.enemies.length; index += 1) {
      const enemy = this.enemies[index];
      enemy.hurtTime = Math.max(0, enemy.hurtTime - dt);
      enemy.contactCooldown = Math.max(0, enemy.contactCooldown - dt);
      const dx = this.hero.x - enemy.x;
      const dy = this.hero.y - enemy.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const separation = this.rules.hero.radius + this.rules.enemy.radius;
      if (distance > separation) {
        const speed = this.rules.enemy.speed * dt / distance;
        enemy.x += dx * speed;
        enemy.y += dy * speed;
      } else if (enemy.contactCooldown <= 0) {
        enemy.contactCooldown = 0.7;
        this.hero.health = Math.max(0, this.hero.health - this.rules.enemy.damage);
        this.events.push({ type: "hero-hit", health: this.hero.health });
      }
    }
  }

  private finish(reason: BattleEndReason): void {
    if (this.finished) {
      return;
    }
    this.finished = true;
    this.endReason = reason;
    this.move.x = 0;
    this.move.y = 0;
    this.events.push({ type: "battle-ended", reason });
  }

  private updateAttacks(dt: number): void {
    this.attackCooldown -= dt;
    this.ringCooldown -= dt;
    this.wineCooldown -= dt;

    if (this.attackCooldown <= 0 && this.performBlade()) {
      this.attackCooldown = this.rules.hero.attackInterval;
    }
    if (this.ringCooldown <= 0) {
      this.performRingblade();
      this.ringCooldown = this.rules.ringblade.cooldown;
    }
    if (this.wineCooldown <= 0 && this.performWarmWine()) {
      this.wineCooldown = this.rules.warmWine.cooldown;
    }
  }

  private performBlade(): boolean {
    const target = this.nearestEnemy(this.rules.hero.attackRange);
    if (!target) {
      return false;
    }
    const facing = normalize(target.x - this.hero.x, target.y - this.hero.y);
    this.hero.facing = { x: facing.x, y: facing.y };
    const cosineLimit = Math.cos(this.rules.blade.halfAngle);
    for (const enemy of this.enemies) {
      const offset = normalize(enemy.x - this.hero.x, enemy.y - this.hero.y);
      if (offset.length <= this.rules.hero.attackRange && (offset.length === 0 || offset.x * facing.x + offset.y * facing.y >= cosineLimit)) {
        this.damageEnemy(enemy, this.rules.hero.attack * this.rules.blade.damageMultiplier, this.rules.blade.knockback, facing);
      }
    }
    this.events.push({
      type: "blade",
      x: this.hero.x,
      y: this.hero.y,
      facing: { x: facing.x, y: facing.y },
      range: this.rules.hero.attackRange,
      halfAngle: this.rules.blade.halfAngle,
      life: this.rules.blade.visualLife,
    });
    this.removeDefeated();
    return true;
  }

  private performRingblade(): void {
    const range = this.rules.ringblade.range;
    const rangeSquared = range * range;
    for (const enemy of this.enemies) {
      const dx = enemy.x - this.hero.x;
      const dy = enemy.y - this.hero.y;
      const distanceSquared = dx * dx + dy * dy;
      if (distanceSquared <= rangeSquared) {
        const direction = normalize(dx, dy);
        this.damageEnemy(enemy, this.rules.ringblade.damage, this.rules.ringblade.knockback, direction);
      }
    }
    this.events.push({
      type: "ringblade",
      x: this.hero.x,
      y: this.hero.y,
      range,
      life: this.rules.ringblade.visualLife,
      rotations: this.rules.ringblade.rotations,
    });
    this.removeDefeated();
  }

  private performWarmWine(): boolean {
    if (this.enemies.length === 0) {
      return false;
    }
    let bestFacing: Vec2Like | null = null;
    let bestCount = 0;
    for (const candidate of this.enemies) {
      const facing = normalize(candidate.x - this.hero.x, candidate.y - this.hero.y);
      let count = 0;
      for (const enemy of this.enemies) {
        const dx = enemy.x - this.hero.x;
        const dy = enemy.y - this.hero.y;
        const forward = dx * facing.x + dy * facing.y;
        const sideways = Math.abs(dx * -facing.y + dy * facing.x);
        if (forward >= 0 && forward <= this.rules.warmWine.range && sideways <= this.rules.warmWine.halfWidth) {
          count += 1;
        }
      }
      if (count > bestCount) {
        bestCount = count;
        bestFacing = { x: facing.x, y: facing.y };
      }
    }
    if (!bestFacing) {
      return false;
    }
    for (const enemy of this.enemies) {
      const dx = enemy.x - this.hero.x;
      const dy = enemy.y - this.hero.y;
      const forward = dx * bestFacing.x + dy * bestFacing.y;
      const sideways = Math.abs(dx * -bestFacing.y + dy * bestFacing.x);
      if (forward >= 0 && forward <= this.rules.warmWine.range && sideways <= this.rules.warmWine.halfWidth) {
        this.damageEnemy(enemy, this.rules.warmWine.damage, this.rules.warmWine.knockback, bestFacing);
      }
    }
    this.events.push({
      type: "warm-wine",
      x: this.hero.x,
      y: this.hero.y,
      facing: bestFacing,
      range: this.rules.warmWine.range,
      halfWidth: this.rules.warmWine.halfWidth,
      life: this.rules.warmWine.visualLife,
      scale: this.rules.warmWine.cloneScale,
    });
    this.removeDefeated();
    return true;
  }

  private nearestEnemy(range: number): EnemyState | null {
    let best: EnemyState | null = null;
    let bestDistanceSquared = range * range;
    for (const enemy of this.enemies) {
      const dx = enemy.x - this.hero.x;
      const dy = enemy.y - this.hero.y;
      const distanceSquared = dx * dx + dy * dy;
      if (distanceSquared <= bestDistanceSquared) {
        best = enemy;
        bestDistanceSquared = distanceSquared;
      }
    }
    return best;
  }

  private damageEnemy(enemy: EnemyState, damage: number, knockback: number, direction: Vec2Like): void {
    enemy.health -= damage;
    enemy.hurtTime = 0.16;
    enemy.x += direction.x * knockback * 0.12;
    enemy.y += direction.y * knockback * 0.12;
    this.events.push({ type: "enemy-hit", enemyId: enemy.id, x: enemy.x, y: enemy.y });
  }

  private removeDefeated(): void {
    for (let index = this.enemies.length - 1; index >= 0; index -= 1) {
      const enemy = this.enemies[index];
      if (enemy.health > 0) {
        continue;
      }
      this.enemies.splice(index, 1);
      this.kills += 1;
      this.events.push({ type: "enemy-down", enemyId: enemy.id, x: enemy.x, y: enemy.y });
    }
  }

  private random(): number {
    this.randomState = (this.randomState * 1664525 + 1013904223) >>> 0;
    return this.randomState / 0x100000000;
  }
}
