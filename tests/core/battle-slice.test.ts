import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CHEF_INITIAL_COUNT,
  CHEF_POOL_CAPACITY,
  FIXED_STEP_SECONDS,
  GREEN_DRAGON_HALF_ANGLE,
  GREEN_DRAGON_RANGE,
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

test('automatic attack stays idle without a target and fires after a chef enters range', () => {
  const world = new BattleWorld();
  world.step(FIXED_STEP_SECONDS);
  assert.equal(world.getSnapshot().attack.serial, 0);

  for (let index = 0; index < 600 && world.getSnapshot().attack.serial === 0; index += 1) {
    world.step(FIXED_STEP_SECONDS);
  }
  const attack = world.getSnapshot().attack;
  assert.equal(attack.serial, 1);
  assert.ok(Math.abs(Math.hypot(attack.facingX, attack.facingY) - 1) < 0.0001);
  assert.equal(attack.range, GREEN_DRAGON_RANGE);
  assert.equal(attack.halfAngle, GREEN_DRAGON_HALF_ANGLE);
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

