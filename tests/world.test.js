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
  var notOffered = ["blade", "bladeSweep", "ringblade", "warmWine", "might", "haste", "vitality"].filter(function (id) {
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
  assert.equal(world.orbs[0].value, 2);
  assert.equal(world.kills, 1);
});

test("Guan Yu stays idle and silent when no enemy is inside blade range", function () {
  var world = new World(375, 812, fixedRandom);
  world.reset();
  world.enemies.push(world.makeEnemy("grunt", world.player.x + 200, world.player.y));
  world.updateCombat(0.01);
  assert.equal(world.player.actionTime, 0);
  assert.equal(world.player.attackCooldown, 0);
  assert.equal(world.slashes.length, 0);
  assert.deepEqual(world.consumeAudioEvents(), []);
});

test("Guan Yu's automatic slash does not replace his direction-neutral holding pose", function () {
  var world = new World(375, 812, fixedRandom);
  world.reset();
  var enemy = world.makeEnemy("brute", world.player.x, world.player.y - 60);
  world.enemies.push(enemy);
  assert.equal(world.performBaseAttack(), true);
  assert.equal(world.player.actionTime, 0);
  assert.ok(world.consumeAudioEvents().includes("attack"));
});

test("Green Dragon Slash is a bounded forward sector instead of a linear strike", function () {
  var world = new World(375, 812, fixedRandom);
  world.reset();
  var anchor = world.makeEnemy("brute", world.player.x, world.player.y - 40);
  var inside = world.makeEnemy("grunt", world.player.x + 30, world.player.y - 64);
  var outside = world.makeEnemy("grunt", world.player.x + 50, world.player.y - 50);
  var behind = world.makeEnemy("grunt", world.player.x, world.player.y + 50);
  anchor.health = anchor.maxHealth = 200;
  inside.health = outside.health = behind.health = 1;
  world.enemies.push(anchor, inside, outside, behind);
  world.performBladeAttack();
  assert.equal(world.enemies.includes(inside), false);
  assert.equal(world.enemies.includes(outside), true);
  assert.equal(world.enemies.includes(behind), true);
  assert.equal(world.slashes.length, 1);
  assert.equal(world.slashes[0].shape, "sector");
  assert.equal(world.slashes[0].full, false);
  assert.equal(world.slashes[0].followPlayer, true);
  assert.equal(world.slashes[0].range, 112);
  assert.equal(world.slashes[0].halfAngle, 0.48);
  world.player.x += 24;
  world.player.y -= 16;
  world.updateEffects(0.01);
  assert.equal(world.slashes[0].x, world.player.x);
  assert.equal(world.slashes[0].y, world.player.y);
});

test("Green Dragon Presence expands the fan without reaching a half circle", function () {
  function makeSweepWorld(sweepRank) {
    var world = new World(375, 812, fixedRandom);
    world.reset();
    world.ranks.bladeSweep = sweepRank;
    var anchor = world.makeEnemy("brute", world.player.x, world.player.y - 45);
    var edge = world.makeEnemy("grunt", world.player.x + 72, world.player.y - 102);
    anchor.health = anchor.maxHealth = 200;
    edge.health = 1;
    world.enemies.push(anchor, edge);
    world.performBladeAttack();
    return { world: world, edge: edge };
  }
  var base = makeSweepWorld(0);
  var maximum = makeSweepWorld(3);
  assert.equal(base.world.enemies.includes(base.edge), true);
  assert.equal(maximum.world.enemies.includes(maximum.edge), false);
  assert.equal(maximum.world.slashes[0].range, 130);
  assert.equal(maximum.world.slashes[0].halfAngle, 0.66);
  assert.ok(maximum.world.slashes[0].halfAngle < Math.PI / 4);
});

test("Green Dragon Ring Slash carries fixed defensive timing and rendering data", function () {
  var world = new World(375, 812, fixedRandom);
  world.reset();
  var enemy = world.makeEnemy("grunt", world.player.x + 40, world.player.y);
  enemy.health = 200;
  enemy.maxHealth = 200;
  world.enemies.push(enemy);
  world.ranks.ringblade = 2;
  world.performRingBlade();
  assert.equal(enemy.health, 142);
  assert.equal(world.slashes[0].shape, "ringblade");
  assert.equal(world.slashes[0].range, 150);
  assert.equal(world.slashes[0].full, true);
  assert.equal(world.slashes[0].followPlayer, true);
  assert.equal(world.slashes[0].rotations, 2);
  assert.equal(world.slashes[0].maxLife, 0.92);
  world.player.x -= 20;
  world.updateEffects(0.01);
  assert.equal(world.slashes[0].x, world.player.x);

  world.slashes.length = 0;
  world.player.skillCooldowns = {};
  world.updateCombat(0.6);
  assert.equal(world.slashes.some(function (slash) { return slash.shape === "ringblade"; }), true);
  assert.equal(world.player.skillCooldowns.ringblade, 10);
});

test("Warm Wine Slash targets the densest enemy lane while Guan Yu stays put", function () {
  var world = new World(375, 812, fixedRandom);
  world.reset();
  world.ranks.warmWine = 1;
  var startX = world.player.x;
  var startY = world.player.y;
  var nearest = world.makeEnemy("brute", startX, startY - 60);
  var laneNear = world.makeEnemy("grunt", startX + 100, startY);
  var laneMiddle = world.makeEnemy("grunt", startX + 180, startY + 8);
  var laneFar = world.makeEnemy("grunt", startX + 250, startY - 8);
  nearest.health = nearest.maxHealth = 200;
  laneNear.health = laneMiddle.health = laneFar.health = 1;
  world.enemies.push(nearest, laneNear, laneMiddle, laneFar);
  assert.equal(world.performWarmWineSlash(), true);
  assert.equal(world.player.x, startX);
  assert.equal(world.player.y, startY);
  assert.equal(world.player.actionTime, 0);
  assert.equal(world.enemies.includes(nearest), true);
  assert.equal(world.enemies.includes(laneNear), false);
  assert.equal(world.enemies.includes(laneMiddle), false);
  assert.equal(world.enemies.includes(laneFar), false);
  assert.equal(world.slashes[0].shape, "warmwine");
  assert.equal(world.slashes[0].range, 270);
  assert.equal(world.slashes[0].halfWidth, 20);
  assert.equal(world.slashes[0].cloneScale, 1);
  assert.equal(world.slashes[0].targetCount, 3);
  assert.ok(world.slashes[0].facingX > 0.99);
});

test("every normal enemy now carries twice its former experience value", function () {
  var world = new World(375, 812, fixedRandom);
  assert.deepEqual(
    ["grunt", "runner", "brute", "archer"].map(function (type) { return world.makeEnemy(type, 0, 0).experience; }),
    [2, 2, 6, 4]
  );
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
  world.ranks = { blade: 3, bladeSweep: 3, ringblade: 3, warmWine: 3, might: 3, haste: 3 };
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
  world.ranks = { blade: 2, bladeSweep: 3, ringblade: 3, warmWine: 3, might: 3, haste: 3 };
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
