"use strict";

var test = require("node:test");
var assert = require("node:assert/strict");
var config = require("../src/config");
var World = require("../src/core/world");

function fixedRandom() { return 0.5; }

test("a new run starts with Guan Yu's innate blade and no meta progression", function () {
  var world = new World(375, 812, fixedRandom, { topEdge: 120 });
  world.reset();
  assert.equal(world.state, "playing");
  assert.equal(world.level, 1);
  assert.deepEqual(world.ranks, { blade: 1 });
  assert.equal(world.experience, 0);
});

test("combat audio events are consumed once", function () {
  var world = new World(375, 812, fixedRandom);
  world.reset();
  world.damagePlayer(1);
  assert.deepEqual(world.consumeAudioEvents(), ["player-hit"]);
  assert.deepEqual(world.consumeAudioEvents(), []);
});

test("gaining enough experience pauses combat with three choices", function () {
  var world = new World(375, 812, fixedRandom);
  world.reset();
  world.gainExperience(world.experienceNeeded);
  assert.equal(world.state, "choosing");
  assert.equal(world.level, 2);
  assert.equal(world.offers.length, 3);
  assert.equal(new Set(world.offers.map(function (offer) { return offer.id; })).size, 3);
});

test("choosing an offered skill applies it and resumes combat", function () {
  var world = new World(375, 812, fixedRandom);
  world.reset();
  world.gainExperience(world.experienceNeeded);
  var choice = world.offers[0];
  assert.equal(world.chooseSkill(choice.id), true);
  assert.equal(world.ranks[choice.id], choice.rank);
  assert.equal(world.state, "playing");
  assert.equal(world.offers.length, 0);
});

test("unoffered skills cannot be selected", function () {
  var world = new World(375, 812, fixedRandom);
  world.reset();
  world.gainExperience(world.experienceNeeded);
  var offeredIds = world.offers.map(function (offer) { return offer.id; });
  var notOffered = ["blade", "whirlwind", "crescent", "firetrail", "might", "haste", "vitality"].filter(function (id) {
    return offeredIds.indexOf(id) < 0;
  })[0];
  assert.equal(world.chooseSkill(notOffered), false);
  assert.equal(world.state, "choosing");
});

test("the automatic blade attack kills a nearby weak enemy and drops experience", function () {
  var world = new World(375, 812, fixedRandom);
  world.reset();
  var enemy = world.makeEnemy("grunt", world.player.x, world.player.y - 50);
  enemy.health = 1;
  world.enemies.push(enemy);
  world.performBladeAttack();
  assert.equal(world.enemies.length, 0);
  assert.equal(world.orbs.length, 1);
  assert.equal(world.kills, 1);
});

test("rank-three blade visibly becomes a full-circle attack", function () {
  var world = new World(375, 812, fixedRandom);
  world.reset();
  world.ranks.blade = 3;
  var enemyBehind = world.makeEnemy("grunt", world.player.x, world.player.y + 60);
  enemyBehind.health = 1;
  world.enemies.push(enemyBehind);
  world.player.facing = { x: 0, y: -1 };
  world.performBladeAttack();
  assert.equal(world.enemies.includes(enemyBehind), false);
  assert.equal(world.slashes.length, 2);
  assert.equal(world.slashes[0].full, true);
});

test("the boss appears at the end of the fixed wave timeline", function () {
  var world = new World(375, 812, fixedRandom);
  world.reset();
  world.elapsed = (config.waveDuration + config.waveBreakDuration) * config.waveEnemyCounts.length;
  world.updateSpawning(0);
  var boss = world.enemies.filter(function (enemy) { return enemy.type === "boss"; })[0];
  assert.ok(boss);
  world.hitEnemy(boss, boss.health, 0);
  assert.equal(world.state, "won");
  assert.equal(world.bossDefeated, true);
});

test("dense simulation respects the enemy budget", function () {
  var world = new World(375, 812, fixedRandom, { topEdge: 120 });
  world.reset();
  world.player.health = 999999;
  world.player.maxHealth = 999999;
  for (var frame = 0; frame < 80 * 60; frame += 1) {
    world.update(1 / 60, { x: 1, y: 0.2 });
    assert.ok(world.enemies.length <= config.enemyLimit);
    if (world.state === "choosing") {
      world.chooseSkill(world.offers[0].id);
    }
  }
});

test("selecting Huang Zhong starts with the projectile attack family", function () {
  var world = new World(375, 812, fixedRandom);
  world.setHero("huang");
  world.reset();
  assert.equal(world.hero.attackType, "projectile");
  assert.deepEqual(world.ranks, { arrow: 1 });
  var enemy = world.makeEnemy("grunt", world.player.x, world.player.y - 100);
  world.enemies.push(enemy);
  world.performBaseAttack();
  assert.equal(world.projectiles.length, 1);
  assert.equal(world.projectiles[0].kind, "arrow");
});

test("Zhuge Liang's base lightning chain starts nearby and reaches three enemies", function () {
  var world = new World(375, 812, fixedRandom);
  world.setHero("zhuge");
  world.reset();
  assert.equal(world.hero.attackType, "lightning");
  assert.deepEqual(world.ranks, { thunder: 1 });
  var nearEnemy = world.makeEnemy("brute", world.player.x, world.player.y - 60);
  var secondEnemy = world.makeEnemy("brute", world.player.x, world.player.y + 100);
  var thirdEnemy = world.makeEnemy("brute", world.player.x, world.player.y + 260);
  var farEnemy = world.makeEnemy("brute", world.player.x, world.player.y + 350);
  world.enemies.push(nearEnemy, secondEnemy, thirdEnemy, farEnemy);
  var nearHealth = nearEnemy.health;
  world.performBaseAttack();
  assert.ok(nearEnemy.health < nearHealth);
  assert.equal(secondEnemy.health, secondEnemy.maxHealth);
  assert.equal(world.slashes.length, 1);
  world.updateLightningChains(0.1);
  assert.ok(secondEnemy.health < secondEnemy.maxHealth);
  assert.equal(thirdEnemy.health, thirdEnemy.maxHealth);
  assert.equal(world.slashes.length, 2);
  world.updateLightningChains(0.1);
  assert.ok(thirdEnemy.health < thirdEnemy.maxHealth);
  assert.equal(farEnemy.health, farEnemy.maxHealth);
  assert.equal(world.slashes[0].shape, "lightning");
  assert.equal(world.slashes[0].color, "thunder");
  assert.equal(world.slashes[0].fromX, world.player.x);
  assert.equal(world.slashes[0].fromY, world.player.y - 8);
  assert.equal(world.slashes[0].toX, nearEnemy.x);
  assert.equal(world.slashes[0].toY, nearEnemy.y);
  assert.equal(world.slashes.length, 3);
});

test("Lightning Combo extends one chain along the 3-5-7-9 progression", function () {
  var world = new World(375, 812, fixedRandom, { heroId: "zhuge" });
  world.reset();
  world.ranks.chain = 2;
  var targets = [];
  for (var targetIndex = 0; targetIndex < 10; targetIndex += 1) {
    var targetAngle = targetIndex * Math.PI * 2 / 10;
    targets.push(world.makeEnemy(
      "brute",
      world.player.x + Math.cos(targetAngle) * 72,
      world.player.y + Math.sin(targetAngle) * 72
    ));
  }
  world.enemies.push.apply(world.enemies, targets);
  world.performBaseAttack();
  for (var step = 0; step < 6; step += 1) {
    world.updateLightningChains(0.1);
  }
  var damagedTargets = targets.filter(function (target) { return target.health < target.maxHealth; });
  assert.equal(damagedTargets.length, 7);
  assert.equal(world.slashes.filter(function (slash) { return slash.shape === "lightning"; }).length, 7);
});

test("lightning uses the doubled combat radius but still ignores offscreen targets", function () {
  var world = new World(375, 812, fixedRandom, { heroId: "zhuge" });
  world.reset();
  var visible = world.makeEnemy("brute", world.player.x, world.player.y + 260);
  var offscreen = world.makeEnemy("brute", world.player.x + 260, world.player.y);
  world.enemies.push(visible, offscreen);
  world.performBaseAttack();
  assert.ok(visible.health < visible.maxHealth);
  assert.equal(offscreen.health, offscreen.maxHealth);
  assert.equal(world.slashes.length, 1);
  assert.equal(world.lightningChains.length, 0);
});

test("Zhuge Liang stays idle and silent when lightning has no valid target", function () {
  var world = new World(375, 812, fixedRandom, { heroId: "zhuge" });
  world.reset();
  var distantVisible = world.makeEnemy("brute", world.player.x + 170, world.player.y + 300);
  var nearbyOffscreen = world.makeEnemy("brute", world.player.x + 260, world.player.y);
  world.enemies.push(distantVisible, nearbyOffscreen);
  world.updateCombat(0.01);
  assert.equal(world.player.actionTime, 0);
  assert.equal(world.player.attackCooldown, 0);
  assert.deepEqual(world.consumeAudioEvents(), []);
  assert.equal(world.slashes.length, 0);
});

test("lightning prefers unique targets before bouncing back between survivors", function () {
  var world = new World(375, 812, fixedRandom, { heroId: "zhuge" });
  world.reset();
  world.ranks.chain = 3;
  var left = world.makeEnemy("brute", world.player.x - 32, world.player.y - 45);
  var right = world.makeEnemy("brute", world.player.x + 32, world.player.y - 45);
  left.health = left.maxHealth = 400;
  right.health = right.maxHealth = 400;
  world.enemies.push(left, right);
  world.performBaseAttack();
  for (var step = 0; step < 8; step += 1) {
    world.updateLightningChains(0.1);
  }
  assert.equal(world.slashes.filter(function (slash) { return slash.shape === "lightning"; }).length, 9);
  assert.ok(left.health < left.maxHealth);
  assert.ok(right.health < right.maxHealth);
});

test("Eight Trigram Formation lands remotely on the densest enemy group", function () {
  var world = new World(375, 812, fixedRandom, { heroId: "zhuge" });
  world.reset();
  world.ranks.formation = 1;
  var lone = world.makeEnemy("brute", world.player.x - 90, world.player.y);
  var group = [
    world.makeEnemy("brute", world.player.x + 190, world.player.y),
    world.makeEnemy("brute", world.player.x + 215, world.player.y + 10),
    world.makeEnemy("brute", world.player.x + 205, world.player.y - 20)
  ];
  world.enemies.push.apply(world.enemies, [lone].concat(group));
  world.castEightTrigramFormation();
  assert.equal(lone.health, lone.maxHealth);
  group.forEach(function (enemy) { assert.ok(enemy.health < enemy.maxHealth); });
  assert.equal(world.slashes[0].shape, "trigram");
  assert.equal(world.slashes[0].color, "trigram");
  assert.ok(world.slashes[0].x > world.player.x + 150);
  assert.equal(world.slashes[0].maxLife, 1.5);
});

test("fixed-time waves pause briefly and then advance while earlier enemies remain", function () {
  var world = new World(375, 812, fixedRandom);
  world.reset();
  world.spawnTimer = 0;
  world.updateSpawning(0.01);
  assert.equal(world.enemies.length, 1);
  assert.equal(world.waveSpawned, 1);

  world.elapsed = config.waveDuration;
  world.updateSpawning(0);
  assert.equal(world.waveIndex, 0);
  assert.equal(world.enemies.length, 1);
  assert.equal(world.getWaveLabel(), "整备 敌1 5秒");

  world.elapsed = config.waveDuration + config.waveBreakDuration;
  world.updateSpawning(0);
  assert.equal(world.waveIndex, 1);
  assert.equal(world.waveSpawned, 1);
  assert.equal(world.bossSpawned, false);
  assert.equal(world.enemies.length, 2);
  assert.equal(world.getWaveLabel(), "第2/6轮 · 敌2");
});

test("the six finite waves contain exactly 360 scheduled enemies", function () {
  assert.equal(config.waveEnemyCounts.reduce(function (sum, count) { return sum + count; }, 0), 360);
});

test("the complete fixed timeline actually deploys 360 troops before one boss", function () {
  var world = new World(375, 812, fixedRandom);
  world.reset();
  var spawned = 0;
  world.spawnEnemy = function () { spawned += 1; };
  var cycle = config.waveDuration + config.waveBreakDuration;
  var bossTime = cycle * config.waveEnemyCounts.length;
  for (var elapsed = 0; elapsed < bossTime; elapsed += 0.05) {
    world.elapsed = elapsed;
    world.updateSpawning(0.05);
  }
  assert.equal(spawned, 360);
  world.elapsed = bossTime;
  world.updateSpawning(0);
  assert.equal(world.enemies.filter(function (enemy) { return enemy.type === "boss"; }).length, 1);
});

test("skill choices follow the selected hero", function () {
  var world = new World(375, 812, fixedRandom);
  world.setHero("huang");
  world.reset();
  world.gainExperience(world.experienceNeeded);
  var ids = world.offers.map(function (offer) { return offer.id; });
  assert.equal(ids.includes("blade"), false);
  assert.equal(ids.includes("thunder"), false);
  assert.ok(ids.includes("arrow") || ids.includes("volley") || ids.includes("piercing") || ids.includes("arrowrain"));
});

test("a level gained after every available skill is maxed cannot soft-lock combat", function () {
  var world = new World(375, 812, fixedRandom);
  world.reset();
  world.ranks = { blade: 3, whirlwind: 3, crescent: 3, might: 3, haste: 3 };
  world.player.health = 50;
  world.gainExperience(world.experienceNeeded);
  assert.equal(world.state, "playing");
  assert.equal(world.pendingLevels, 0);
  assert.equal(world.offers.length, 0);
  assert.ok(world.player.health > 50);
  assert.match(world.feedback, /武艺已成/);
});

test("queued levels resume combat when the final available upgrade is selected", function () {
  var world = new World(375, 812, fixedRandom);
  world.reset();
  world.ranks = { blade: 2, whirlwind: 3, crescent: 3, might: 3, haste: 3 };
  world.player.health = 50;
  world.gainExperience(world.getExperienceNeeded(1) + world.getExperienceNeeded(2));
  assert.equal(world.state, "choosing");
  assert.deepEqual(world.offers.map(function (offer) { return offer.id; }), ["blade"]);
  assert.equal(world.chooseSkill("blade"), true);
  assert.equal(world.ranks.blade, 3);
  assert.equal(world.state, "playing");
  assert.equal(world.pendingLevels, 0);
  assert.equal(world.offers.length, 0);
  assert.ok(world.player.health > 50);
});

test("battle experience becomes progressively steeper and stops at the level cap", function () {
  var world = new World(375, 812, fixedRandom);
  var requirements = [];
  for (var level = 1; level < config.maxBattleLevel; level += 1) {
    requirements.push(world.getExperienceNeeded(level));
  }
  assert.deepEqual(requirements.slice(0, 5), [12, 18, 27, 36, 48]);
  assert.ok(requirements[requirements.length - 1] - requirements[requirements.length - 2] > requirements[1] - requirements[0]);

  world.reset();
  world.gainExperience(9999);
  assert.equal(world.level, config.maxBattleLevel);
  assert.equal(world.experience, 0);
  assert.equal(world.experienceNeeded, 0);
  while (world.state === "choosing") {
    world.chooseSkill(world.offers[0].id);
  }
  var ranksBefore = JSON.stringify(world.ranks);
  world.gainExperience(9999);
  assert.equal(world.level, config.maxBattleLevel);
  assert.equal(JSON.stringify(world.ranks), ranksBefore);
});

test("enemies stop dropping experience after the battle level cap", function () {
  var world = new World(375, 812, fixedRandom);
  world.reset();
  world.level = config.maxBattleLevel;
  world.experience = 0;
  world.experienceNeeded = 0;
  var enemy = world.makeEnemy("grunt", world.player.x, world.player.y - 40);
  world.enemies.push(enemy);
  world.killEnemy(enemy);
  assert.equal(world.orbs.length, 0);
});

test("enemy bodies separate from one another and push against the player", function () {
  var world = new World(375, 812, fixedRandom);
  world.reset();
  var first = world.makeEnemy("grunt", world.player.x + 80, world.player.y);
  var second = world.makeEnemy("grunt", first.x, first.y);
  world.enemies.push(first, second);
  world.resolveEnemyCrowding();
  assert.ok(Math.sqrt((first.x - second.x) * (first.x - second.x) + (first.y - second.y) * (first.y - second.y)) > 0);

  first.x = world.player.x;
  first.y = world.player.y;
  second.x += 100;
  var healthBefore = world.player.health;
  world.resolvePlayerContacts();
  assert.ok(world.player.health < healthBefore);
  assert.ok(Math.sqrt((first.x - world.player.x) * (first.x - world.player.x) + (first.y - world.player.y) * (first.y - world.player.y)) >= first.radius + world.player.radius - 0.001);
});

test("enemy faction changes both identity data and hit feedback", function () {
  var weiWorld = new World(375, 812, function () { return 0.5; });
  var wuWorld = new World(375, 812, function () { return 0.9; });
  var wei = weiWorld.makeEnemy("grunt", 10, 10);
  var wu = wuWorld.makeEnemy("grunt", 10, 10);
  assert.equal(wei.faction, "wei");
  assert.equal(wu.faction, "wu");
  weiWorld.enemies.push(wei);
  weiWorld.hitEnemy(wei, 1, 0);
  assert.equal(weiWorld.hitEffects.length, 1);
  assert.equal(weiWorld.hitEffects[0].kind, "hit");
});

test("enemy hit slow refreshes for two seconds without stacking", function () {
  var world = new World(375, 812, fixedRandom);
  world.reset();
  var enemy = world.makeEnemy("grunt", world.player.x + 300, world.player.y);
  world.enemies.push(enemy);
  world.hitEnemy(enemy, 1, 0);
  assert.equal(enemy.slowTime, 2);
  assert.equal(enemy.speed, 54);
  world.updateEnemies(0.5);
  assert.equal(enemy.slowTime, 1.5);
  world.hitEnemy(enemy, 1, 0);
  assert.equal(enemy.slowTime, 2);
  assert.equal(enemy.speed, 54);
  var xBefore = enemy.x;
  world.updateEnemies(0.5);
  assert.ok(xBefore - enemy.x > 20);
  assert.ok(xBefore - enemy.x < 22);
});

test("the ranged kitchen enemy fires one simple bun projectile", function () {
  var world = new World(375, 812, fixedRandom);
  world.fireEnemyShot({ x: 30, y: 40, damage: 7 }, { x: 1, y: 0 });
  assert.equal(world.enemyShots.length, 1);
  assert.equal(world.enemyShots[0].kind, "bun");
  assert.equal(world.enemyShots[0].radius, 5);
  assert.equal(world.enemyShots[0].damage, 7);
});

test("Zhuge Liang's East Wind reaches beyond the old close-range circle", function () {
  var world = new World(375, 812, fixedRandom, { heroId: "zhuge" });
  world.reset();
  world.ranks.gust = 1;
  var enemy = world.makeEnemy("brute", world.player.x + 112, world.player.y);
  world.enemies.push(enemy);
  world.performGust();
  assert.equal(enemy.health, enemy.maxHealth - 5);
  assert.equal(enemy.slowTime, 2);
  assert.ok(enemy.knockX > 880);
  assert.equal(world.slashes[0].color, "gust");
  assert.equal(world.slashes[0].shape, "gust");
  assert.equal(world.slashes[0].range, 210);
  assert.equal(world.slashes[0].maxLife, 1.05);
});

test("rank-three East Wind keeps its fixed range and only shortens cooldown", function () {
  var world = new World(375, 812, fixedRandom, { heroId: "zhuge" });
  world.reset();
  world.ranks.gust = 3;
  var enemy = world.makeEnemy("brute", world.player.x + 205, world.player.y);
  world.enemies.push(enemy);
  world.performGust();
  assert.equal(enemy.health, enemy.maxHealth - 5);
  assert.equal(enemy.slowTime, 2);
  assert.ok(enemy.knockX > 880);
  assert.equal(world.slashes.length, 1);
  assert.equal(world.slashes[0].color, "gust");
  assert.equal(world.slashes[0].range, 210);
  world.player.skillCooldowns.gust = 0;
  world.updateCombat(0.01);
  assert.equal(world.player.skillCooldowns.gust, 5.5);
});
