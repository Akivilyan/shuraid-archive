import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CHEF_RADIUS,
  CHEF_INITIAL_COUNT,
  CHEF_POOL_CAPACITY,
  FIXED_STEP_SECONDS,
  GREEN_DRAGON_HALF_ANGLE,
  GREEN_DRAGON_INTERVAL,
  GREEN_DRAGON_RANGE,
  PLAYER_RADIUS,
  PLAYER_SPEED,
} from '../../assets/scripts/core/BattleConfig';
import { isPointInSector } from '../../assets/scripts/core/BattleMath';
import { BattleWorld } from '../../assets/scripts/core/BattleWorld';
import { FixedStepRunner } from '../../assets/scripts/game/FixedStepRunner';

test('battle world exposes a stable preallocated snapshot', () => {
  const world = new BattleWorld();
  const first = world.getSnapshot();
  world.step(FIXED_STEP_SECONDS);
  const second = world.getSnapshot();

  assert.equal(first, second);
  assert.equal(first.enemies, second.enemies);
  assert.equal(first.enemies.length, CHEF_POOL_CAPACITY);
  assert.equal(first.activeEnemyCount, CHEF_INITIAL_COUNT);
});

test('movement is normalized, fixed-step friendly, and stops immediately', () => {
  const world = new BattleWorld();
  const start = world.getSnapshot().player;
  const startX = start.x;
  const startY = start.y;

  world.setMovement(1, 1);
  world.step(0.5);
  const moved = world.getSnapshot().player;
  const distance = Math.hypot(moved.x - startX, moved.y - startY);
  assert.ok(Math.abs(distance - PLAYER_SPEED * 0.5) < 0.0001);

  const stoppedX = moved.x;
  const stoppedY = moved.y;
  world.setMovement(0, 0);
  world.step(0.5);
  assert.equal(world.getSnapshot().player.x, stoppedX);
  assert.equal(world.getSnapshot().player.y, stoppedY);
  assert.equal(world.getSnapshot().player.moving, false);
});

test('Green Dragon Slash remains a bounded forward sector', () => {
  assert.equal(
    isPointInSector(0, 0, 0, 1, 30, 64, GREEN_DRAGON_RANGE, GREEN_DRAGON_HALF_ANGLE),
    true,
  );
  assert.equal(
    isPointInSector(0, 0, 0, 1, 50, 50, GREEN_DRAGON_RANGE, GREEN_DRAGON_HALF_ANGLE),
    false,
  );
  assert.equal(
    isPointInSector(0, 0, 0, 1, 0, -50, GREEN_DRAGON_RANGE, GREEN_DRAGON_HALF_ANGLE),
    false,
  );
  assert.equal(
    isPointInSector(0, 0, 0, 1, 0, GREEN_DRAGON_RANGE + 1, GREEN_DRAGON_RANGE, GREEN_DRAGON_HALF_ANGLE),
    false,
  );
});

test('automatic attack keeps a fixed cadence without requiring a target', () => {
  const world = new BattleWorld();
  const snapshot = world.getSnapshot();
  for (let index = 0; index < snapshot.enemies.length; index += 1) {
    (snapshot.enemies[index] as { active: boolean }).active = false;
  }

  world.step(FIXED_STEP_SECONDS);
  assert.equal(snapshot.attack.serial, 1);

  const stepsPerAttack = Math.round(GREEN_DRAGON_INTERVAL / FIXED_STEP_SECONDS);
  for (let index = 1; index < stepsPerAttack; index += 1) {
    world.step(FIXED_STEP_SECONDS);
  }
  assert.equal(snapshot.attack.serial, 1);
  world.step(FIXED_STEP_SECONDS);

  const attack = snapshot.attack;
  assert.equal(attack.serial, 2);
  assert.equal(attack.facingX, 0);
  assert.equal(attack.facingY, 1);
  assert.equal(attack.range, GREEN_DRAGON_RANGE);
  assert.equal(attack.halfAngle, GREEN_DRAGON_HALF_ANGLE);
});

test('Green Dragon Slash ignores enemies behind and attacks along player facing', () => {
  const world = new BattleWorld();
  world.setMovement(1, 0);
  world.step(FIXED_STEP_SECONDS);
  world.setMovement(0, 0);

  const snapshot = world.getSnapshot();
  const player = snapshot.player;
  for (let index = 0; index < snapshot.enemies.length; index += 1) {
    const enemy = snapshot.enemies[index] as {
      active: boolean;
      x: number;
      y: number;
      previousX: number;
      previousY: number;
    };
    enemy.active = index === 0;
    enemy.x = player.x - 30;
    enemy.y = player.y;
    enemy.previousX = enemy.x;
    enemy.previousY = enemy.y;
  }
  const target = snapshot.enemies[0];
  const healthBeforeBehindSlash = target.health;
  const stepsPerAttack = Math.round(GREEN_DRAGON_INTERVAL / FIXED_STEP_SECONDS);
  for (let index = 0; index < stepsPerAttack; index += 1) {
    world.step(FIXED_STEP_SECONDS);
  }
  assert.equal(snapshot.attack.serial, 2);
  assert.equal(target.health, healthBeforeBehindSlash);

  const mutableTarget = target as {
    x: number;
    y: number;
    previousX: number;
    previousY: number;
  };
  mutableTarget.x = player.x + 30;
  mutableTarget.y = player.y;
  mutableTarget.previousX = mutableTarget.x;
  mutableTarget.previousY = mutableTarget.y;
  for (let index = 0; index < stepsPerAttack; index += 1) {
    world.step(FIXED_STEP_SECONDS);
  }
  assert.equal(snapshot.attack.serial, 3);
  assert.ok(target.health < healthBeforeBehindSlash);
  assert.equal(snapshot.attack.facingX, 1);
  assert.equal(snapshot.attack.facingY, 0);
  assert.equal(snapshot.player.facingX, 1);
  assert.equal(snapshot.player.facingY, 0);
});

test('circle separation prevents player-enemy and enemy-enemy overlap', () => {
  const playerWorld = new BattleWorld();
  const playerSnapshot = playerWorld.getSnapshot();
  for (let index = 0; index < playerSnapshot.enemies.length; index += 1) {
    const enemy = playerSnapshot.enemies[index] as {
      active: boolean;
      x: number;
      y: number;
    };
    enemy.active = index === 0;
    enemy.x = playerSnapshot.player.x;
    enemy.y = playerSnapshot.player.y;
  }
  playerWorld.step(FIXED_STEP_SECONDS);
  assert.ok(
    Math.hypot(
      playerSnapshot.enemies[0].x - playerSnapshot.player.x,
      playerSnapshot.enemies[0].y - playerSnapshot.player.y,
    ) >= PLAYER_RADIUS + CHEF_RADIUS - 0.0001,
  );

  const enemyWorld = new BattleWorld();
  const enemySnapshot = enemyWorld.getSnapshot();
  for (let index = 0; index < enemySnapshot.enemies.length; index += 1) {
    const enemy = enemySnapshot.enemies[index] as {
      active: boolean;
      x: number;
      y: number;
    };
    enemy.active = index < 2;
    enemy.x = 100;
    enemy.y = 100;
  }
  enemyWorld.step(FIXED_STEP_SECONDS);
  assert.ok(
    Math.hypot(
      enemySnapshot.enemies[1].x - enemySnapshot.enemies[0].x,
      enemySnapshot.enemies[1].y - enemySnapshot.enemies[0].y,
    ) >= CHEF_RADIUS * 2 - 0.0001,
  );
});

test('fixed-step runner caps catch-up and clears accumulated time when paused', () => {
  let steps = 0;
  const runner = new FixedStepRunner({
    step(deltaSeconds: number): void {
      assert.equal(deltaSeconds, FIXED_STEP_SECONDS);
      steps += 1;
    },
  });

  runner.advance(1);
  assert.equal(steps, 5);
  runner.setPaused(true);
  runner.advance(1);
  assert.equal(steps, 5);
  runner.setPaused(false);
  runner.advance(FIXED_STEP_SECONDS);
  assert.equal(steps, 6);
});
