import assert from 'node:assert/strict';
import test from 'node:test';
import { BattleModel, FIXED_STEP } from '../assets/scripts/core/BattleModel.ts';

function advance(model: BattleModel, seconds: number): void {
  const steps = Math.ceil(seconds / FIXED_STEP);
  for (let index = 0; index < steps; index += 1) {
    model.step(FIXED_STEP);
  }
}

test('auto weapon fires on cadence without an attack input', () => {
  const model = new BattleModel({ autoSpawn: false, random: () => 0.5 });
  model.debugSpawnEnemy(160, -90, 100);
  advance(model, 0.35);
  assert.ok(model.projectiles.length > 0);
  assert.ok(model.drainEvents().some((event) => event.type === 'fire'));
});

test('contact damage respects the player invulnerability window', () => {
  const model = new BattleModel({ autoSpawn: false });
  model.debugSpawnEnemy(model.player.x, model.player.y, 999);
  model.step(FIXED_STEP);
  assert.equal(model.player.hp, 90);
  advance(model, 0.3);
  assert.equal(model.player.hp, 90);
  advance(model, 0.4);
  assert.equal(model.player.hp, 80);
});

test('experience pauses combat and applying an upgrade resumes it', () => {
  const model = new BattleModel({ autoSpawn: false });
  model.debugAddXp(5);
  assert.equal(model.level, 2);
  assert.equal(model.paused, true);
  assert.equal(model.pendingLevelUps, 1);
  assert.ok(model.getUpgradeChoices().includes('orbit'));
  model.applyUpgrade('orbit');
  assert.equal(model.upgrades.orbit, 1);
  assert.equal(model.paused, false);
});

test('run ends in victory at the configured duration', () => {
  const model = new BattleModel({ autoSpawn: false, runDuration: 0.2 });
  advance(model, 0.25);
  assert.equal(model.result, 'victory');
  assert.equal(model.paused, true);
  assert.ok(model.drainEvents().some((event) => event.type === 'result' && event.result === 'victory'));
});
