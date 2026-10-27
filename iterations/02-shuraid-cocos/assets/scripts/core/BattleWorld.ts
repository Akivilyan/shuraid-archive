import {
  BATTLE_HEIGHT,
  BATTLE_WIDTH,
  CHEF_HIT_SLOW_AMOUNT,
  CHEF_HIT_SLOW_SECONDS,
  CHEF_INITIAL_COUNT,
  CHEF_MAX_HEALTH,
  CHEF_MIN_SLOWED_SPEED,
  CHEF_POOL_CAPACITY,
  CHEF_RADIUS,
  CHEF_SPEED,
  GREEN_DRAGON_DAMAGE,
  GREEN_DRAGON_HALF_ANGLE,
  GREEN_DRAGON_INTERVAL,
  GREEN_DRAGON_KNOCKBACK,
  GREEN_DRAGON_RANGE,
  PLAYER_MAX_HEALTH,
  PLAYER_RADIUS,
  PLAYER_SPEED,
  RESPAWN_BASE_SECONDS,
} from './BattleConfig';
import type {
  AttackSnapshot,
  BattleSnapshot,
  EnemySnapshot,
  PlayerSnapshot,
} from './BattleTypes';
import { isPointInSector } from './BattleMath';

interface MutablePlayer extends PlayerSnapshot {
  x: number;
  y: number;
  previousX: number;
  previousY: number;
  facingX: number;
  facingY: number;
  moving: boolean;
  walkTime: number;
  health: number;
}

interface MutableEnemy extends EnemySnapshot {
  slot: number;
  active: boolean;
  x: number;
  y: number;
  previousX: number;
  previousY: number;
  facingX: number;
  health: number;
  maxHealth: number;
  age: number;
  hitFlash: number;
  slowTime: number;
  knockX: number;
  knockY: number;
  respawnTime: number;
}

interface MutableAttack extends AttackSnapshot {
  serial: number;
  x: number;
  y: number;
  facingX: number;
  facingY: number;
  range: number;
  halfAngle: number;
}

interface MutableBattleSnapshot extends BattleSnapshot {
  activeEnemyCount: number;
  elapsedSeconds: number;
}

const SPAWN_X = [-168, 168, -142, 142, 0, 0, -174, 174];
const SPAWN_Y = [330, -330, -342, 342, 360, -360, 180, -180];
const COLLISION_SOLVER_PASSES = 2;
const COLLISION_EPSILON = 0.0001;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

export class BattleWorld {
  private readonly player: MutablePlayer;
  private readonly enemies: MutableEnemy[];
  private readonly attack: MutableAttack;
  private readonly snapshot: MutableBattleSnapshot;

  private moveX = 0;
  private moveY = 0;
  private attackCooldown = 0;
  private spawnSerial = 0;

  public constructor() {
    this.player = {
      x: 0,
      y: -54,
      previousX: 0,
      previousY: -54,
      facingX: 0,
      facingY: 1,
      moving: false,
      walkTime: 0,
      health: PLAYER_MAX_HEALTH,
    };

    this.enemies = [];
    for (let slot = 0; slot < CHEF_POOL_CAPACITY; slot += 1) {
      this.enemies.push({
        slot,
        active: false,
        x: 0,
        y: 0,
        previousX: 0,
        previousY: 0,
        facingX: 0,
        health: CHEF_MAX_HEALTH,
        maxHealth: CHEF_MAX_HEALTH,
        age: 0,
        hitFlash: 0,
        slowTime: 0,
        knockX: 0,
        knockY: 0,
        respawnTime: 0,
      });
    }

    this.attack = {
      serial: 0,
      x: 0,
      y: 0,
      facingX: 0,
      facingY: 1,
      range: GREEN_DRAGON_RANGE,
      halfAngle: GREEN_DRAGON_HALF_ANGLE,
    };
    this.snapshot = {
      player: this.player,
      enemies: this.enemies,
      attack: this.attack,
      activeEnemyCount: 0,
      elapsedSeconds: 0,
    };

    this.reset();
  }

  public reset(): void {
    this.player.x = 0;
    this.player.y = -54;
    this.player.previousX = this.player.x;
    this.player.previousY = this.player.y;
    this.player.facingX = 0;
    this.player.facingY = 1;
    this.player.moving = false;
    this.player.walkTime = 0;
    this.player.health = PLAYER_MAX_HEALTH;
    this.moveX = 0;
    this.moveY = 0;
    this.attackCooldown = 0;
    this.spawnSerial = 0;
    this.attack.serial = 0;
    this.snapshot.activeEnemyCount = 0;
    this.snapshot.elapsedSeconds = 0;

    for (let slot = 0; slot < this.enemies.length; slot += 1) {
      const enemy = this.enemies[slot];
      enemy.active = false;
      enemy.respawnTime = 0;
      if (slot < CHEF_INITIAL_COUNT) {
        this.activateEnemy(enemy);
      }
    }
  }

  public setMovement(x: number, y: number): void {
    const lengthSquared = x * x + y * y;
    if (lengthSquared <= 0.0001) {
      this.moveX = 0;
      this.moveY = 0;
      return;
    }
    const inverseLength = 1 / Math.sqrt(lengthSquared);
    const scale = inverseLength < 1 ? inverseLength : 1;
    this.moveX = x * scale;
    this.moveY = y * scale;
  }

  public step(deltaSeconds: number): void {
    this.snapshot.elapsedSeconds += deltaSeconds;
    this.capturePreviousPositions();
    this.updatePlayer(deltaSeconds);
    this.updateEnemies(deltaSeconds);
    this.resolveUnitCollisions();
    this.updateCombat(deltaSeconds);
  }

  public getSnapshot(): BattleSnapshot {
    return this.snapshot;
  }

  private capturePreviousPositions(): void {
    this.player.previousX = this.player.x;
    this.player.previousY = this.player.y;
    for (let index = 0; index < this.enemies.length; index += 1) {
      const enemy = this.enemies[index];
      if (!enemy.active) {
        continue;
      }
      enemy.previousX = enemy.x;
      enemy.previousY = enemy.y;
    }
  }

  private updatePlayer(deltaSeconds: number): void {
    this.player.moving = this.moveX !== 0 || this.moveY !== 0;
    if (!this.player.moving) {
      return;
    }
    this.player.x += this.moveX * PLAYER_SPEED * deltaSeconds;
    this.player.y += this.moveY * PLAYER_SPEED * deltaSeconds;
    this.player.walkTime += deltaSeconds;
    this.player.facingX = this.moveX;
    this.player.facingY = this.moveY;

    const halfWidth = BATTLE_WIDTH * 0.5 - PLAYER_RADIUS;
    const halfHeight = BATTLE_HEIGHT * 0.5 - PLAYER_RADIUS;
    this.player.x = clamp(this.player.x, -halfWidth, halfWidth);
    this.player.y = clamp(this.player.y, -halfHeight, halfHeight);
  }

  private updateEnemies(deltaSeconds: number): void {
    for (let index = 0; index < this.enemies.length; index += 1) {
      const enemy = this.enemies[index];
      if (!enemy.active) {
        if (enemy.respawnTime > 0) {
          enemy.respawnTime -= deltaSeconds;
          if (enemy.respawnTime <= 0) {
            this.activateEnemy(enemy);
          }
        }
        continue;
      }

      enemy.age += deltaSeconds;
      enemy.hitFlash = Math.max(0, enemy.hitFlash - deltaSeconds);
      enemy.slowTime = Math.max(0, enemy.slowTime - deltaSeconds);
      const offsetX = this.player.x - enemy.x;
      const offsetY = this.player.y - enemy.y;
      const distanceSquared = offsetX * offsetX + offsetY * offsetY;
      const inverseDistance = distanceSquared > 0.0001 ? 1 / Math.sqrt(distanceSquared) : 0;
      const directionX = offsetX * inverseDistance;
      const directionY = offsetY * inverseDistance;
      enemy.facingX = directionX;
      const speed = enemy.slowTime > 0
        ? Math.max(CHEF_MIN_SLOWED_SPEED, CHEF_SPEED - CHEF_HIT_SLOW_AMOUNT)
        : CHEF_SPEED;
      enemy.x += (directionX * speed + enemy.knockX) * deltaSeconds;
      enemy.y += (directionY * speed + enemy.knockY) * deltaSeconds;
      const knockDecay = Math.max(0, 1 - deltaSeconds * 8);
      enemy.knockX *= knockDecay;
      enemy.knockY *= knockDecay;
    }
  }

  private updateCombat(deltaSeconds: number): void {
    this.attackCooldown -= deltaSeconds;
    if (this.attackCooldown > 0) {
      return;
    }

    const facingX = this.player.facingX;
    const facingY = this.player.facingY;
    for (let index = 0; index < this.enemies.length; index += 1) {
      const enemy = this.enemies[index];
      if (!enemy.active) {
        continue;
      }
      const range = GREEN_DRAGON_RANGE + CHEF_RADIUS;
      if (!isPointInSector(
        this.player.x,
        this.player.y,
        facingX,
        facingY,
        enemy.x,
        enemy.y,
        range,
        GREEN_DRAGON_HALF_ANGLE,
      )) {
        continue;
      }
      this.hitEnemy(enemy, GREEN_DRAGON_DAMAGE, facingX, facingY);
    }

    this.attack.serial += 1;
    this.attack.x = this.player.x;
    this.attack.y = this.player.y;
    this.attack.facingX = facingX;
    this.attack.facingY = facingY;
    this.attackCooldown = GREEN_DRAGON_INTERVAL;
  }

  private resolveUnitCollisions(): void {
    for (let pass = 0; pass < COLLISION_SOLVER_PASSES; pass += 1) {
      this.resolveEnemyEnemyCollisions();
      for (let index = 0; index < this.enemies.length; index += 1) {
        const enemy = this.enemies[index];
        if (enemy.active) {
          this.separateEnemyFromPlayer(enemy);
        }
      }
    }
  }

  private resolveEnemyEnemyCollisions(): void {
    const minimumDistance = CHEF_RADIUS * 2;
    const minimumDistanceSquared = minimumDistance * minimumDistance;
    for (let firstIndex = 0; firstIndex < this.enemies.length; firstIndex += 1) {
      const first = this.enemies[firstIndex];
      if (!first.active) {
        continue;
      }
      for (let secondIndex = firstIndex + 1; secondIndex < this.enemies.length; secondIndex += 1) {
        const second = this.enemies[secondIndex];
        if (!second.active) {
          continue;
        }
        const offsetX = second.x - first.x;
        const offsetY = second.y - first.y;
        const distanceSquared = offsetX * offsetX + offsetY * offsetY;
        if (distanceSquared >= minimumDistanceSquared) {
          continue;
        }
        const distance = Math.sqrt(distanceSquared);
        const fallbackAngle = (first.slot * 37 + second.slot * 61) * 0.73;
        const normalX = distance > COLLISION_EPSILON
          ? offsetX / distance
          : Math.cos(fallbackAngle);
        const normalY = distance > COLLISION_EPSILON
          ? offsetY / distance
          : Math.sin(fallbackAngle);
        const correction = (minimumDistance - distance) * 0.5;
        first.x -= normalX * correction;
        first.y -= normalY * correction;
        second.x += normalX * correction;
        second.y += normalY * correction;
      }
    }
  }

  private separateEnemyFromPlayer(enemy: MutableEnemy): void {
    const minimumDistance = PLAYER_RADIUS + CHEF_RADIUS;
    const offsetX = enemy.x - this.player.x;
    const offsetY = enemy.y - this.player.y;
    const distanceSquared = offsetX * offsetX + offsetY * offsetY;
    if (distanceSquared >= minimumDistance * minimumDistance) {
      return;
    }
    const distance = Math.sqrt(distanceSquared);
    const normalX = distance > COLLISION_EPSILON
      ? offsetX / distance
      : -this.player.facingX;
    const normalY = distance > COLLISION_EPSILON
      ? offsetY / distance
      : -this.player.facingY;
    const correction = minimumDistance - distance;
    enemy.x += normalX * correction;
    enemy.y += normalY * correction;
  }

  private hitEnemy(enemy: MutableEnemy, damage: number, facingX: number, facingY: number): void {
    enemy.health -= damage;
    enemy.hitFlash = 0.12;
    enemy.slowTime = CHEF_HIT_SLOW_SECONDS;
    enemy.knockX += facingX * GREEN_DRAGON_KNOCKBACK;
    enemy.knockY += facingY * GREEN_DRAGON_KNOCKBACK;
    if (enemy.health > 0) {
      return;
    }
    enemy.active = false;
    enemy.respawnTime = RESPAWN_BASE_SECONDS + enemy.slot * 0.025;
    this.snapshot.activeEnemyCount -= 1;
  }

  private activateEnemy(enemy: MutableEnemy): void {
    const spawnIndex = this.spawnSerial % SPAWN_X.length;
    this.spawnSerial += 1;
    enemy.active = true;
    enemy.x = SPAWN_X[spawnIndex];
    enemy.y = SPAWN_Y[spawnIndex];
    enemy.previousX = enemy.x;
    enemy.previousY = enemy.y;
    enemy.facingX = enemy.x > this.player.x ? -1 : 1;
    enemy.health = CHEF_MAX_HEALTH;
    enemy.maxHealth = CHEF_MAX_HEALTH;
    enemy.age = enemy.slot * 0.17;
    enemy.hitFlash = 0;
    enemy.slowTime = 0;
    enemy.knockX = 0;
    enemy.knockY = 0;
    enemy.respawnTime = 0;
    this.snapshot.activeEnemyCount += 1;
  }
}
