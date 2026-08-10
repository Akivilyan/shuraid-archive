"use strict";

var config = require("../config");
var math = require("./math");
var skills = require("./skills");
var heroes = require("./heroes");

var ENEMY_HIT_SLOW_AMOUNT = 12;
var ENEMY_HIT_SLOW_DURATION = 2;
var ENEMY_MIN_SLOWED_SPEED = 18;

function tuningAtRank(tuning, rank) {
  if (!tuning || !tuning.ranks || tuning.ranks.length === 0) { return null; }
  return tuning.ranks[Math.max(0, Math.min(tuning.ranks.length - 1, rank - 1))];
}

function makePlayer(mapWidth, mapHeight, hero) {
  return {
    x: mapWidth / 2,
    y: mapHeight / 2,
    radius: config.playerRadius,
    direction: { x: 0, y: -1 },
    facing: { x: 0, y: -1 },
    heroId: hero.id,
    attackType: hero.attackType,
    health: hero.health,
    maxHealth: hero.health,
    attackCooldown: 0,
    skillCooldowns: {},
    invulnerable: 0,
    hurtTime: 0,
    speedBoost: 0,
    moving: false,
    walkTime: 0,
    actionTime: 0
  };
}

function World(width, height, random, options) {
  this.width = width;
  this.height = height;
  this.random = random || Math.random;
  this.topEdge = options && options.topEdge ? options.topEdge : 74;
  this.viewHeight = height - this.topEdge;
  this.mapWidth = Math.max(1600, width * config.mapScale);
  this.mapHeight = Math.max(2600, this.viewHeight * config.mapScale);
  this.heroId = options && options.heroId ? options.heroId : "guan";
  this.state = "intro";
  this.resetData();
  this.state = "intro";
}

World.prototype.resetData = function () {
  this.hero = heroes.get(this.heroId);
  this.player = makePlayer(this.mapWidth, this.mapHeight, this.hero);
  this.enemies = [];
  this.orbs = [];
  this.projectiles = [];
  this.enemyShots = [];
  this.slashes = [];
  this.lightningChains = [];
  this.hitEffects = [];
  this.elapsed = 0;
  this.kills = 0;
  this.level = 1;
  this.experience = 0;
  this.experienceNeeded = this.getExperienceNeeded(1);
  this.pendingLevels = 0;
  this.offers = [];
  this.ranks = {};
  this.ranks[this.hero.baseSkill] = 1;
  this.spawnTimer = 0.5;
  this.waveIndex = 0;
  this.waveSpawned = 0;
  this.bossSpawned = false;
  this.bossDefeated = false;
  this.feedback = "";
  this.feedbackTime = 0;
  this.impactSerial = 0;
  this.audioEvents = [];
};

World.prototype.emitAudioEvent = function (name) {
  if (this.audioEvents.length < 24) { this.audioEvents.push(name); }
};

World.prototype.consumeAudioEvents = function () {
  var events = this.audioEvents.slice();
  this.audioEvents.length = 0;
  return events;
};

World.prototype.getExperienceNeeded = function (level) {
  var step = Math.max(0, level - 1);
  return (4 + step * 2 + Math.floor(step * step / 4)) * 3;
};

World.prototype.reset = function () {
  this.resetData();
  this.state = "playing";
  this.feedback = "拾取军魂 · 领悟战法";
  this.feedbackTime = 2.2;
};

World.prototype.setHero = function (heroId) {
  this.heroId = heroes.get(heroId).id;
  this.resetData();
  this.state = "intro";
};

World.prototype.getCamera = function () {
  return {
    x: this.player.x - this.width / 2,
    y: this.player.y - this.viewHeight / 2,
    width: this.width,
    height: this.viewHeight
  };
};

World.prototype.getViewBounds = function () {
  var camera = this.getCamera();
  return {
    left: camera.x,
    right: camera.x + camera.width,
    top: camera.y,
    bottom: camera.y + camera.height
  };
};

World.prototype.update = function (deltaSeconds, inputDirection) {
  if (this.state !== "playing") {
    return;
  }

  var dt = Math.min(deltaSeconds, 0.05);
  this.elapsed += dt;
  this.feedbackTime = Math.max(0, this.feedbackTime - dt);
  this.player.invulnerable = Math.max(0, this.player.invulnerable - dt);
  this.player.hurtTime = Math.max(0, this.player.hurtTime - dt);
  this.player.speedBoost = Math.max(0, this.player.speedBoost - dt);
  this.player.actionTime = Math.max(0, this.player.actionTime - dt);

  this.updatePlayer(dt, inputDirection);
  this.updateSpawning(dt);
  this.updateEnemies(dt);
  this.updateEnemyShots(dt);
  this.updateLightningChains(dt);
  this.updateCombat(dt);
  this.updateProjectiles(dt);
  this.updateOrbs(dt);
  this.updateEffects(dt);

  if (this.player.health <= 0) {
    this.state = "lost";
    this.emitAudioEvent("defeat");
  }
};

World.prototype.updatePlayer = function (dt, inputDirection) {
  var movement = math.normalize(inputDirection.x, inputDirection.y);
  this.player.moving = movement.length > 0;
  if (movement.length > 0) {
    this.player.direction = { x: movement.x, y: movement.y };
    var hasteRank = this.ranks.haste || 0;
    var speedMultiplier = 1 + hasteRank * 0.08 + (this.player.speedBoost > 0 ? 0.18 : 0);
    this.player.x += movement.x * config.playerSpeed * speedMultiplier * dt;
    this.player.y += movement.y * config.playerSpeed * speedMultiplier * dt;
    this.player.walkTime += dt * speedMultiplier;
  }
  var edge = this.player.radius + 6;
  this.player.x = math.clamp(this.player.x, edge, this.mapWidth - edge);
  this.player.y = math.clamp(this.player.y, edge, this.mapHeight - edge);
};

World.prototype.updateSpawning = function (dt) {
  if (this.bossSpawned) { return; }
  var waveCounts = config.waveEnemyCounts;
  var waveCycle = config.waveDuration + config.waveBreakDuration;
  var bossSpawnTime = waveCycle * waveCounts.length;
  if (this.elapsed >= bossSpawnTime) {
    this.spawnBoss();
    return;
  }
  var scheduledWave = Math.min(waveCounts.length - 1, Math.floor(this.elapsed / waveCycle));
  var timeInWave = this.elapsed - scheduledWave * waveCycle;
  if (scheduledWave !== this.waveIndex) {
    this.waveIndex = scheduledWave;
    this.waveSpawned = 0;
    this.spawnTimer = 0;
    this.feedback = "第 " + (this.waveIndex + 1) + " 轮来袭";
    this.feedbackTime = 1.5;
  }
  if (timeInWave >= config.waveDuration) { return; }
  var quota = waveCounts[this.waveIndex];
  if (this.waveSpawned >= quota) { return; }

  this.spawnTimer -= dt;
  if (this.spawnTimer <= 0 && this.enemies.length < config.enemyLimit - 1) {
    this.spawnEnemy();
    this.waveSpawned += 1;
    this.spawnTimer = config.waveSpawnIntervals[this.waveIndex];
  }
};

World.prototype.spawnEnemy = function () {
  var roll = this.random();
  var type = "grunt";
  if (this.waveIndex >= 1 && roll > 0.72) { type = "runner"; }
  if (this.waveIndex >= 2 && roll > 0.84) { type = "brute"; }
  if (this.waveIndex >= 2 && roll > 0.91) { type = "archer"; }
  var point = this.randomSpawnPoint();
  this.enemies.push(this.makeEnemy(type, point.x, point.y));
};

World.prototype.randomSpawnPoint = function () {
  var view = this.getViewBounds();
  var edge = Math.floor(this.random() * 4);
  var x = view.left + this.random() * this.width;
  var y = view.top + this.random() * this.viewHeight;
  if (edge === 0) { y = view.top - 32; }
  if (edge === 1) { x = view.right + 32; }
  if (edge === 2) { y = view.bottom + 32; }
  if (edge === 3) { x = view.left - 32; }
  return {
    x: math.clamp(x, 18, this.mapWidth - 18),
    y: math.clamp(y, 18, this.mapHeight - 18)
  };
};

World.prototype.makeEnemy = function (type, x, y) {
  var definitions = {
    grunt: { radius: 11, health: 28, speed: 54, damage: 6, experience: 2 },
    runner: { radius: 15, health: 20, speed: 91, damage: 5, experience: 2 },
    brute: { radius: 16, health: 82, speed: 35, damage: 10, experience: 6 },
    archer: { radius: 11, health: 36, speed: 34, damage: 6, experience: 4 },
    boss: { radius: 31, health: 760, speed: 31, damage: 14, experience: 0 }
  };
  var definition = definitions[type];
  var faction = this.random() < 0.58 ? "wei" : "wu";
  return {
    type: type,
    faction: faction,
    x: x,
    y: y,
    radius: definition.radius,
    health: definition.health,
    maxHealth: definition.health,
    speed: definition.speed,
    damage: definition.damage,
    experience: definition.experience,
    hitFlash: 0,
    contactCooldown: 0,
    shotCooldown: 1.8 + this.random() * 1.4,
    age: this.random() * 2,
    facingX: 0,
    facingY: 1,
    attackTime: 0,
    slowTime: 0,
    knockX: 0,
    knockY: 0
  };
};

World.prototype.spawnBoss = function () {
  var point = this.randomSpawnPoint();
  this.enemies.push(this.makeEnemy("boss", point.x, point.y));
  this.bossSpawned = true;
  this.feedback = "敌将压阵！";
  this.feedbackTime = 2;
  this.impactSerial += 1;
  this.emitAudioEvent("danger");
};

World.prototype.updateEnemies = function (dt) {
  for (var index = this.enemies.length - 1; index >= 0; index -= 1) {
    var enemy = this.enemies[index];
    enemy.age += dt;
    enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
    enemy.contactCooldown = Math.max(0, enemy.contactCooldown - dt);
    enemy.attackTime = Math.max(0, enemy.attackTime - dt);
    enemy.slowTime = Math.max(0, enemy.slowTime - dt);
    enemy.shotCooldown -= dt;
    var toPlayer = math.normalize(this.player.x - enemy.x, this.player.y - enemy.y);
    enemy.facingX = toPlayer.x;
    enemy.facingY = toPlayer.y;
    var distance = toPlayer.length;
    var movementScale = 1;

    if (enemy.type === "archer") {
      if (distance < 175) { movementScale = -0.55; }
      if (distance >= 175 && distance < 250) { movementScale = 0; }
      if (enemy.shotCooldown <= 0 && distance < 320) {
        this.fireEnemyShot(enemy, toPlayer);
        enemy.shotCooldown = 2.8;
        enemy.attackTime = 0.24;
      }
    }

    var movementSpeed = enemy.slowTime > 0 ? Math.max(ENEMY_MIN_SLOWED_SPEED, enemy.speed - ENEMY_HIT_SLOW_AMOUNT) : enemy.speed;
    enemy.x += (toPlayer.x * movementSpeed * movementScale + enemy.knockX) * dt;
    enemy.y += (toPlayer.y * movementSpeed * movementScale + enemy.knockY) * dt;
    enemy.knockX *= Math.max(0, 1 - dt * 8);
    enemy.knockY *= Math.max(0, 1 - dt * 8);
    enemy.x = math.clamp(enemy.x, enemy.radius, this.mapWidth - enemy.radius);
    enemy.y = math.clamp(enemy.y, enemy.radius, this.mapHeight - enemy.radius);
  }
  this.resolveEnemyCrowding();
  this.resolvePlayerContacts();
};

World.prototype.resolveEnemyCrowding = function () {
  for (var firstIndex = 0; firstIndex < this.enemies.length; firstIndex += 1) {
    var first = this.enemies[firstIndex];
    for (var secondIndex = firstIndex + 1; secondIndex < this.enemies.length; secondIndex += 1) {
      var second = this.enemies[secondIndex];
      var minimum = (first.radius + second.radius) * 0.72;
      var direction = math.normalize(second.x - first.x, second.y - first.y);
      if (direction.length < minimum) {
        var push = (minimum - direction.length) * 0.5;
        var pushX = direction.length > 0 ? direction.x : (secondIndex % 2 === 0 ? 1 : -1);
        var pushY = direction.length > 0 ? direction.y : 0;
        first.x -= pushX * push;
        first.y -= pushY * push;
        second.x += pushX * push;
        second.y += pushY * push;
      }
    }
  }
};

World.prototype.resolvePlayerContacts = function () {
  for (var index = 0; index < this.enemies.length; index += 1) {
    var enemy = this.enemies[index];
    var minimum = enemy.radius + this.player.radius;
    var away = math.normalize(enemy.x - this.player.x, enemy.y - this.player.y);
    if (away.length >= minimum) { continue; }
    var push = minimum - away.length;
    var pushX = away.length > 0 ? away.x : (index % 2 === 0 ? 1 : -1);
    var pushY = away.length > 0 ? away.y : 0;
    enemy.x += pushX * push * 0.68;
    enemy.y += pushY * push * 0.68;
    this.player.x -= pushX * push * 0.32;
    this.player.y -= pushY * push * 0.32;
    if (enemy.contactCooldown <= 0) {
      this.damagePlayer(enemy.damage);
      enemy.contactCooldown = 0.8;
      enemy.attackTime = 0.2;
      enemy.knockX += pushX * 100;
      enemy.knockY += pushY * 100;
    }
  }
  var edge = this.player.radius + 6;
  this.player.x = math.clamp(this.player.x, edge, this.mapWidth - edge);
  this.player.y = math.clamp(this.player.y, edge, this.mapHeight - edge);
};

World.prototype.fireEnemyShot = function (enemy, direction) {
  this.enemyShots.push({
    x: enemy.x,
    y: enemy.y,
    vx: direction.x * 150,
    vy: direction.y * 150,
    radius: 5,
    damage: enemy.damage,
    kind: "bun",
    life: 3
  });
  this.emitAudioEvent("shot");
};

World.prototype.updateEnemyShots = function (dt) {
  for (var index = this.enemyShots.length - 1; index >= 0; index -= 1) {
    var shot = this.enemyShots[index];
    shot.x += shot.vx * dt;
    shot.y += shot.vy * dt;
    shot.life -= dt;
    var hitDistance = shot.radius + this.player.radius;
    if (math.distanceSquared(shot, this.player) < hitDistance * hitDistance) {
      this.damagePlayer(shot.damage);
      this.enemyShots.splice(index, 1);
    } else if (shot.life <= 0) {
      this.enemyShots.splice(index, 1);
    }
  }
};

World.prototype.damagePlayer = function (damage) {
  if (this.player.invulnerable > 0) {
    return;
  }
  this.player.health -= damage;
  this.player.invulnerable = 0.62;
  this.player.hurtTime = 0.22;
  this.impactSerial += 1;
  this.emitAudioEvent("player-hit");
};

World.prototype.updateCombat = function (dt) {
  var haste = this.ranks.haste || 0;
  this.player.attackCooldown -= dt;
  if (this.player.attackCooldown <= 0) {
    if (this.performBaseAttack()) {
      this.player.attackCooldown = this.hero.attackInterval / (1 + haste * 0.1);
    } else {
      this.player.attackCooldown = 0;
    }
  }

  var ringbladeRank = this.ranks.ringblade || 0;
  var ringbladeTuning = skills.tuningFor("guan", "ringblade");
  if (ringbladeRank > 0 && this.skillReady("ringblade", dt, ringbladeTuning.cooldown)) {
    this.performRingBlade();
  }
  var warmWineRank = this.ranks.warmWine || 0;
  var warmWineTuning = skills.tuningFor("guan", "warmWine");
  if (warmWineRank > 0 && this.skillReady("warmWine", dt, warmWineTuning.cooldown)) {
    if (!this.performWarmWineSlash()) {
      this.player.skillCooldowns.warmWine = 0;
    }
  }
  if ((this.ranks.volley || 0) > 0 && this.skillReady("volley", dt, 3.0 - this.ranks.volley * 0.2)) {
    this.launchVolley();
  }
  if ((this.ranks.arrowrain || 0) > 0 && this.skillReady("arrowrain", dt, 3.4 - this.ranks.arrowrain * 0.2)) {
    this.castArrowRain();
  }
  if ((this.ranks.formation || 0) > 0 && this.skillReady("formation", dt, 4.2)) {
    this.castEightTrigramFormation();
  }
  var gustRank = this.ranks.gust || 0;
  if (gustRank > 0 && this.skillReady("gust", dt, 8 - (gustRank - 1) * 1.25)) {
    this.performGust();
  }

  if ((this.ranks.vitality || 0) >= 3 && this.player.health < this.player.maxHealth * 0.3) {
    this.player.health = Math.min(this.player.maxHealth, this.player.health + dt * 1.8);
  }
};

World.prototype.skillReady = function (id, dt, interval) {
  var cooldown = this.player.skillCooldowns[id];
  if (cooldown === undefined) {
    cooldown = Math.min(0.5, interval * 0.25);
  }
  cooldown -= dt;
  if (cooldown <= 0) {
    this.player.skillCooldowns[id] = interval;
    return true;
  }
  this.player.skillCooldowns[id] = cooldown;
  return false;
};

World.prototype.performBaseAttack = function () {
  var attacked = false;
  if (this.hero.attackType === "projectile") {
    attacked = this.performArrowAttack();
  } else if (this.hero.attackType === "lightning") {
    attacked = this.performLightningAttack();
  } else {
    attacked = this.performBladeAttack();
  }
  if (!attacked) { return false; }
  // Guan Yu keeps a direction-neutral holding/running silhouette. The current
  // attack frames are baked facing left, so the independent guandao sweep
  // communicates arbitrary aim directions without a conflicting body pose.
  if (this.heroId !== "guan") {
    this.player.actionTime = this.hero.attackType === "lightning" ? 0.3 : 0.18;
  }
  this.emitAudioEvent(this.hero.attackType === "projectile" ? "shot" : "attack");
  return true;
};

World.prototype.isEnemyInCombatView = function (enemy, margin) {
  var bounds = this.getViewBounds();
  var inset = margin || 0;
  return enemy.x >= bounds.left + inset && enemy.x <= bounds.right - inset &&
    enemy.y >= bounds.top + inset && enemy.y <= bounds.bottom - inset;
};

World.prototype.findNearestEnemy = function (maxDistance, visibleOnly) {
  var nearest = null;
  var nearestDistance = maxDistance === undefined ? Infinity : maxDistance * maxDistance;
  for (var index = 0; index < this.enemies.length; index += 1) {
    if (visibleOnly && !this.isEnemyInCombatView(this.enemies[index], 12)) { continue; }
    var distance = math.distanceSquared(this.player, this.enemies[index]);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = this.enemies[index];
    }
  }
  return nearest;
};

World.prototype.getDamageMultiplier = function (enemy) {
  var rank = this.ranks.might || 0;
  var multiplier = 1 + rank * 0.15;
  if (rank >= 3 && enemy.health > enemy.maxHealth * 0.5) {
    multiplier += 0.25;
  }
  return multiplier;
};

World.prototype.performBladeAttack = function () {
  var rank = this.ranks.blade || 1;
  var tuning = skills.tuningFor("guan", "blade");
  var rankTuning = tuningAtRank(tuning, rank);
  var sweepTuning = skills.tuningFor("guan", "bladeSweep");
  var sweepRank = this.ranks.bladeSweep || 0;
  var range = this.hero.attackRange + sweepTuning.rangeBonuses[sweepRank];
  var halfAngle = sweepTuning.halfAngles[sweepRank];
  var target = null;
  var nearestDistance = Infinity;
  for (var targetIndex = 0; targetIndex < this.enemies.length; targetIndex += 1) {
    var candidate = this.enemies[targetIndex];
    var candidateDistance = math.distanceSquared(this.player, candidate);
    var candidateRange = range + candidate.radius;
    if (candidateDistance <= candidateRange * candidateRange && candidateDistance < nearestDistance) {
      target = candidate;
      nearestDistance = candidateDistance;
    }
  }
  if (!target) { return false; }
  var direction = math.normalize(target.x - this.player.x, target.y - this.player.y);
  this.player.facing = { x: direction.x, y: direction.y };
  var cosineLimit = Math.cos(halfAngle);
  for (var index = this.enemies.length - 1; index >= 0; index -= 1) {
    var enemy = this.enemies[index];
    var offset = math.normalize(enemy.x - this.player.x, enemy.y - this.player.y);
    var facingDot = offset.length === 0 ? 1 : offset.x * direction.x + offset.y * direction.y;
    if (offset.length <= range + enemy.radius && facingDot >= cosineLimit) {
      var damage = this.hero.attack * rankTuning.damageMultiplier * this.getDamageMultiplier(enemy);
      this.hitEnemy(enemy, damage, rankTuning.knockback);
    }
  }
  this.slashes.push({
    shape: "sector",
    x: this.player.x,
    y: this.player.y,
    facingX: direction.x,
    facingY: direction.y,
    range: range,
    halfAngle: halfAngle,
    full: false,
    followPlayer: true,
    rank: Math.max(rank, sweepRank),
    life: tuning.visual.life,
    maxLife: tuning.visual.life,
    color: "blade"
  });
  return true;
};

World.prototype.performArrowAttack = function () {
  var target = this.findNearestEnemy();
  if (!target) { return false; }
  var direction = math.normalize(target.x - this.player.x, target.y - this.player.y);
  this.player.facing = { x: direction.x, y: direction.y };
  var rank = this.ranks.arrow || 1;
  var count = rank >= 3 ? 3 : 1;
  var speed = 310 + rank * 25;
  var damage = this.hero.attack * (1 + (rank - 1) * 0.28);
  var maxHits = 1 + (this.ranks.piercing || 0);
  this.launchProjectileFan(count, 0.22, speed, damage, 5, maxHits, "arrow");
  return true;
};

World.prototype.findNearestChainTarget = function (origin, hit, range, playerRange, visibleOnly) {
  var nearest = null;
  var nearestDistance = range * range;
  var playerDistanceLimit = playerRange === undefined ? Infinity : playerRange * playerRange;
  for (var index = 0; index < this.enemies.length; index += 1) {
    var enemy = this.enemies[index];
    if (hit.indexOf(enemy) >= 0) { continue; }
    if (visibleOnly && !this.isEnemyInCombatView(enemy, 12)) { continue; }
    if (math.distanceSquared(this.player, enemy) > playerDistanceLimit) { continue; }
    var distance = math.distanceSquared(origin, enemy);
    if (distance <= nearestDistance) {
      nearestDistance = distance;
      nearest = enemy;
    }
  }
  return nearest;
};

World.prototype.addLightningEffect = function (from, to, branch) {
  this.slashes.push({
    shape: "lightning",
    fromX: from.x,
    fromY: from.y,
    toX: to.x,
    toY: to.y,
    branch: branch,
    life: 0.24,
    maxLife: 0.24,
    color: "thunder"
  });
};

World.prototype.performLightningAttack = function () {
  var target = this.findNearestEnemy(300, true);
  if (!target) { return false; }
  var direction = math.normalize(target.x - this.player.x, target.y - this.player.y);
  this.player.facing = { x: direction.x, y: direction.y };
  var thunderRank = this.ranks.thunder || 1;
  var bounceRank = this.ranks.chain || 0;
  var damage = this.hero.attack * (1 + (thunderRank - 1) * 0.25);
  var maxTargets = 3 + bounceRank * 2;
  var chain = {
    timer: 0,
    interval: 0.1,
    remaining: maxTargets,
    damage: damage,
    strike: 0,
    hit: [],
    origin: { x: this.player.x, y: this.player.y - 8 },
    nextTarget: target
  };
  this.advanceLightningChain(chain);
  if (chain.remaining > 0 && chain.nextTarget) {
    this.lightningChains.push(chain);
  }
  return true;
};

World.prototype.advanceLightningChain = function (chain) {
  var target = chain.nextTarget;
  if (!target || this.enemies.indexOf(target) < 0) {
    target = this.findNextLightningTarget(chain);
  }
  if (!target) {
    chain.remaining = 0;
    chain.nextTarget = null;
    return;
  }

  this.addLightningEffect(chain.origin, target, chain.strike);
  chain.hit.push(target);
  var chainFalloff = Math.pow(0.9, chain.strike);
  this.hitEnemy(target, chain.damage * chainFalloff * this.getDamageMultiplier(target), 24);
  chain.origin = target;
  chain.strike += 1;
  chain.remaining -= 1;
  chain.nextTarget = chain.remaining > 0 ? this.findNextLightningTarget(chain) : null;
  chain.timer = chain.interval;
};

World.prototype.findNextLightningTarget = function (chain) {
  var target = this.findNearestChainTarget(chain.origin, chain.hit, 176, 330, true);
  if (target) { return target; }
  return this.findNearestChainTarget(chain.origin, [chain.origin], 176, 330, true);
};

World.prototype.updateLightningChains = function (dt) {
  for (var index = this.lightningChains.length - 1; index >= 0; index -= 1) {
    var chain = this.lightningChains[index];
    chain.timer -= dt;
    if (chain.timer <= 0 && chain.remaining > 0) {
      this.advanceLightningChain(chain);
    }
    if (chain.remaining <= 0 || !chain.nextTarget) {
      this.lightningChains.splice(index, 1);
    }
  }
};

World.prototype.launchProjectileFan = function (count, spread, speed, damage, radius, maxHits, kind, details) {
  var target = this.findNearestEnemy();
  if (!target) { return; }
  var direction = math.normalize(target.x - this.player.x, target.y - this.player.y);
  this.player.facing = { x: direction.x, y: direction.y };
  for (var index = 0; index < count; index += 1) {
    var offset = count === 1 ? 0 : (index / (count - 1) - 0.5) * spread * (count - 1);
    var cosine = Math.cos(offset);
    var sine = Math.sin(offset);
    var dx = direction.x * cosine - direction.y * sine;
    var dy = direction.x * sine + direction.y * cosine;
    this.projectiles.push({
      x: this.player.x,
      y: this.player.y,
      vx: dx * speed,
      vy: dy * speed,
      radius: radius,
      damage: damage,
      life: details && details.life ? details.life : 1.35,
      maxLife: details && details.life ? details.life : 1.35,
      hit: [],
      maxHits: maxHits,
      kind: kind,
      rank: details && details.rank ? details.rank : 1
    });
  }
};

World.prototype.damageArea = function (x, y, radius, damage, knockback, color) {
  for (var index = this.enemies.length - 1; index >= 0; index -= 1) {
    var enemy = this.enemies[index];
    if (math.distanceSquared({ x: x, y: y }, enemy) <= (radius + enemy.radius) * (radius + enemy.radius)) {
      this.hitEnemy(enemy, damage * this.getDamageMultiplier(enemy), knockback);
    }
  }
  this.slashes.push({ x: x, y: y, range: radius, full: true, life: 0.3, color: color });
};

World.prototype.performRingBlade = function () {
  var rank = this.ranks.ringblade;
  var tuning = skills.tuningFor("guan", "ringblade");
  var rankTuning = tuningAtRank(tuning, rank);
  var range = rankTuning.range;
  for (var index = this.enemies.length - 1; index >= 0; index -= 1) {
    var enemy = this.enemies[index];
    if (math.distanceSquared(enemy, this.player) <= (range + enemy.radius) * (range + enemy.radius)) {
      this.hitEnemy(enemy, rankTuning.damage * this.getDamageMultiplier(enemy), tuning.knockback);
    }
  }
  this.slashes.push({
    shape: "ringblade",
    x: this.player.x,
    y: this.player.y,
    range: range,
    full: true,
    followPlayer: true,
    rank: rank,
    rotations: tuning.visual.rotations,
    gripPivot: tuning.visual.gripPivot,
    life: tuning.visual.life,
    maxLife: tuning.visual.life,
    color: "ringblade"
  });
};

World.prototype.findDensestLaneDirection = function (range, halfWidth) {
  var bestDirection = null;
  var bestCount = 0;
  var bestDistance = Infinity;
  for (var candidateIndex = 0; candidateIndex < this.enemies.length; candidateIndex += 1) {
    var candidate = this.enemies[candidateIndex];
    if (!this.isEnemyInCombatView(candidate, 12)) { continue; }
    var candidateOffset = math.normalize(candidate.x - this.player.x, candidate.y - this.player.y);
    if (candidateOffset.length > range + candidate.radius) { continue; }
    var count = 0;
    for (var enemyIndex = 0; enemyIndex < this.enemies.length; enemyIndex += 1) {
      var enemy = this.enemies[enemyIndex];
      var offsetX = enemy.x - this.player.x;
      var offsetY = enemy.y - this.player.y;
      var forward = offsetX * candidateOffset.x + offsetY * candidateOffset.y;
      var sideways = Math.abs(offsetX * -candidateOffset.y + offsetY * candidateOffset.x);
      if (forward >= -enemy.radius && forward <= range + enemy.radius && sideways <= halfWidth + enemy.radius) {
        count += 1;
      }
    }
    if (count > bestCount || (count === bestCount && candidateOffset.length < bestDistance)) {
      bestDirection = { x: candidateOffset.x, y: candidateOffset.y, count: count };
      bestCount = count;
      bestDistance = candidateOffset.length;
    }
  }
  return bestDirection;
};

World.prototype.performWarmWineSlash = function () {
  var rank = this.ranks.warmWine || 0;
  if (rank <= 0) { return false; }
  var tuning = skills.tuningFor("guan", "warmWine");
  var rankTuning = tuningAtRank(tuning, rank);
  var direction = this.findDensestLaneDirection(rankTuning.range, rankTuning.halfWidth);
  if (!direction) { return false; }
  this.player.facing = { x: direction.x, y: direction.y };
  for (var index = this.enemies.length - 1; index >= 0; index -= 1) {
    var enemy = this.enemies[index];
    var offsetX = enemy.x - this.player.x;
    var offsetY = enemy.y - this.player.y;
    var forward = offsetX * direction.x + offsetY * direction.y;
    var sideways = Math.abs(offsetX * -direction.y + offsetY * direction.x);
    if (forward >= -enemy.radius && forward <= rankTuning.range + enemy.radius && sideways <= rankTuning.halfWidth + enemy.radius) {
      this.hitEnemy(enemy, rankTuning.damage * this.getDamageMultiplier(enemy), tuning.knockback);
    }
  }
  this.slashes.push({
    shape: "warmwine",
    x: this.player.x,
    y: this.player.y,
    facingX: direction.x,
    facingY: direction.y,
    range: rankTuning.range,
    halfWidth: rankTuning.halfWidth,
    cloneScale: rankTuning.cloneScale,
    targetCount: direction.count,
    rank: rank,
    life: tuning.visual.life,
    maxLife: tuning.visual.life,
    color: "warmwine"
  });
  this.impactSerial += 1;
  this.emitAudioEvent("attack");
  return true;
};

World.prototype.launchVolley = function () {
  var rank = this.ranks.volley;
  this.launchProjectileFan(rank >= 3 ? 5 : 3, 0.18, 330, 12 + rank * 5, 4, 1 + (this.ranks.piercing || 0), "arrow");
};

World.prototype.castArrowRain = function () {
  var target = this.findNearestEnemy();
  if (!target) { return; }
  var rank = this.ranks.arrowrain;
  var radius = 46 + rank * 10;
  this.damageArea(target.x, target.y, radius, 13 + rank * 7, 18, "arrowrain");
  if (rank >= 3) {
    this.damageArea(target.x, target.y, radius * 0.82, 16, 15, "arrowrainEcho");
  }
};

World.prototype.damageSector = function (direction, range, halfAngle, damage, knockback, color) {
  var cosineLimit = Math.cos(halfAngle);
  for (var index = this.enemies.length - 1; index >= 0; index -= 1) {
    var enemy = this.enemies[index];
    var offset = math.normalize(enemy.x - this.player.x, enemy.y - this.player.y);
    var facingDot = offset.x * direction.x + offset.y * direction.y;
    if (offset.length <= range + enemy.radius && facingDot >= cosineLimit) {
      this.hitEnemy(enemy, damage * this.getDamageMultiplier(enemy), knockback);
    }
  }
  this.slashes.push({
    shape: "sector",
    x: this.player.x,
    y: this.player.y,
    facingX: direction.x,
    facingY: direction.y,
    range: range,
    halfAngle: halfAngle,
    life: 0.42,
    maxLife: 0.42,
    color: color
  });
};

World.prototype.findDensestEnemyCluster = function (acquisitionRange, effectRadius) {
  var best = null;
  var bestCount = -1;
  var bestDistance = Infinity;
  var acquisitionSquared = acquisitionRange * acquisitionRange;
  var effectSquared = effectRadius * effectRadius;
  for (var candidateIndex = 0; candidateIndex < this.enemies.length; candidateIndex += 1) {
    var candidate = this.enemies[candidateIndex];
    var playerDistance = math.distanceSquared(this.player, candidate);
    if (playerDistance > acquisitionSquared) { continue; }
    var count = 0;
    for (var enemyIndex = 0; enemyIndex < this.enemies.length; enemyIndex += 1) {
      if (math.distanceSquared(candidate, this.enemies[enemyIndex]) <= effectSquared) { count += 1; }
    }
    if (count > bestCount || (count === bestCount && playerDistance < bestDistance)) {
      best = candidate;
      bestCount = count;
      bestDistance = playerDistance;
    }
  }
  return best;
};

World.prototype.castEightTrigramFormation = function () {
  var rank = this.ranks.formation;
  var radius = 48 + rank * 12;
  var target = this.findDensestEnemyCluster(360, radius * 1.15);
  if (!target) { return; }
  var direction = math.normalize(target.x - this.player.x, target.y - this.player.y);
  this.player.facing = { x: direction.x, y: direction.y };
  this.player.actionTime = 0.32;
  var damage = 14 + rank * 9;
  for (var index = this.enemies.length - 1; index >= 0; index -= 1) {
    var enemy = this.enemies[index];
    if (math.distanceSquared(target, enemy) <= (radius + enemy.radius) * (radius + enemy.radius)) {
      this.hitEnemy(enemy, damage * this.getDamageMultiplier(enemy), 34);
    }
  }
  this.slashes.push({
    shape: "trigram",
    x: target.x,
    y: target.y,
    range: radius,
    life: 1.5,
    maxLife: 1.5,
    color: "trigram"
  });
};

World.prototype.performGust = function () {
  this.player.actionTime = 0.32;
  var radius = 210;
  var knockback = 900;
  var affected = 0;
  for (var index = this.enemies.length - 1; index >= 0; index -= 1) {
    var enemy = this.enemies[index];
    if (math.distanceSquared(this.player, enemy) > (radius + enemy.radius) * (radius + enemy.radius)) { continue; }
    var away = math.normalize(enemy.x - this.player.x, enemy.y - this.player.y);
    var pushX = away.length > 0 ? away.x : (index % 2 === 0 ? 1 : -1);
    var pushY = away.length > 0 ? away.y : 0;
    affected += 1;
    this.hitEnemy(enemy, 5, 0);
    if (this.enemies.indexOf(enemy) < 0) { continue; }
    var bossScale = enemy.type === "boss" ? 0.35 : 1;
    enemy.knockX += pushX * knockback * bossScale;
    enemy.knockY += pushY * knockback * bossScale;
    enemy.hitFlash = Math.max(enemy.hitFlash, 0.08);
    this.addHitEffect(enemy.x, enemy.y, 0, "push");
  }
  if (affected > 0) {
    this.impactSerial += 1;
    this.emitAudioEvent("attack");
  }
  this.slashes.push({
    shape: "gust",
    x: this.player.x,
    y: this.player.y,
    range: radius,
    life: 1.05,
    maxLife: 1.05,
    color: "gust"
  });
};

World.prototype.updateProjectiles = function (dt) {
  for (var index = this.projectiles.length - 1; index >= 0; index -= 1) {
    var projectile = this.projectiles[index];
    projectile.x += projectile.vx * dt;
    projectile.y += projectile.vy * dt;
    projectile.life -= dt;
    for (var enemyIndex = this.enemies.length - 1; enemyIndex >= 0; enemyIndex -= 1) {
      var enemy = this.enemies[enemyIndex];
      var hitDistance = projectile.radius + enemy.radius;
      if (projectile.hit.indexOf(enemy) < 0 && math.distanceSquared(projectile, enemy) < hitDistance * hitDistance) {
        projectile.hit.push(enemy);
        this.hitEnemy(enemy, projectile.damage * this.getDamageMultiplier(enemy), 45);
        if (projectile.hit.length >= (projectile.maxHits || 1)) {
          projectile.life = 0;
          break;
        }
      }
    }
    if (projectile.life <= 0) {
      this.projectiles.splice(index, 1);
    }
  }
};

World.prototype.hitEnemy = function (enemy, damage, knockback) {
  if (this.enemies.indexOf(enemy) < 0) { return; }
  enemy.health -= damage;
  enemy.hitFlash = 0.1;
  enemy.slowTime = ENEMY_HIT_SLOW_DURATION;
  this.addHitEffect(enemy.x, enemy.y, damage, "hit");
  this.emitAudioEvent("enemy-hit");
  if (knockback > 0 && enemy.type !== "boss") {
    var away = math.normalize(enemy.x - this.player.x, enemy.y - this.player.y);
    enemy.knockX += away.x * knockback;
    enemy.knockY += away.y * knockback;
  }
  if (enemy.health <= 0) {
    this.killEnemy(enemy);
  }
};

World.prototype.addHitEffect = function (x, y, damage, kind) {
  if (this.hitEffects.length >= 36) {
    this.hitEffects.shift();
  }
  this.hitEffects.push({
    x: x,
    y: y,
    damage: Math.max(1, Math.round(damage)),
    kind: kind || "hit",
    life: kind === "defeat" ? 0.3 : 0.18,
    maxLife: kind === "defeat" ? 0.3 : 0.18
  });
};

World.prototype.killEnemy = function (enemy) {
  var index = this.enemies.indexOf(enemy);
  if (index < 0) { return; }
  this.enemies.splice(index, 1);
  this.kills += 1;
  this.addHitEffect(enemy.x, enemy.y, 0, "defeat");
  if (enemy.type === "boss") {
    this.bossDefeated = true;
    this.state = "won";
    this.feedback = "阵斩敌将！";
    this.feedbackTime = 3;
    this.impactSerial += 1;
    this.emitAudioEvent("victory");
    return;
  }
  if (this.level < config.maxBattleLevel) {
    this.orbs.push({ x: enemy.x, y: enemy.y, value: enemy.experience, radius: 5 });
  }
};

World.prototype.updateOrbs = function (dt) {
  for (var index = this.orbs.length - 1; index >= 0; index -= 1) {
    var orb = this.orbs[index];
    var direction = math.normalize(this.player.x - orb.x, this.player.y - orb.y);
    var attractionRadius = config.pickupRadius + (this.ranks.haste || 0) * 12;
    if (direction.length < attractionRadius * 2.4) {
      orb.x += direction.x * 210 * dt;
      orb.y += direction.y * 210 * dt;
    }
    if (direction.length <= config.pickupRadius) {
      this.emitAudioEvent("pickup");
      this.gainExperience(orb.value);
      this.orbs.splice(index, 1);
    }
  }
};

World.prototype.gainExperience = function (amount) {
  if (this.level >= config.maxBattleLevel) {
    return;
  }
  this.experience += amount;
  if ((this.ranks.haste || 0) >= 3) {
    this.player.speedBoost = 0.7;
  }
  while (this.level < config.maxBattleLevel && this.experience >= this.experienceNeeded) {
    this.experience -= this.experienceNeeded;
    this.level += 1;
    this.pendingLevels += 1;
    if (this.level >= config.maxBattleLevel) {
      this.experience = 0;
      this.experienceNeeded = 0;
    } else {
      this.experienceNeeded = this.getExperienceNeeded(this.level);
    }
  }
  if (this.pendingLevels > 0 && this.state === "playing") {
    this.openSkillChoice();
  }
};

World.prototype.openSkillChoice = function () {
  this.offers = skills.buildOffers(this.ranks, this.random, this.heroId);
  if (this.offers.length > 0) {
    this.state = "choosing";
    this.emitAudioEvent("level-up");
    return;
  }

  this.resolveMasteredLevels();
};

World.prototype.resolveMasteredLevels = function () {
  var recovered = 0;
  while (this.pendingLevels > 0) {
    var healing = Math.max(1, Math.round(this.player.maxHealth * 0.08));
    var previousHealth = this.player.health;
    this.player.health = Math.min(this.player.maxHealth, this.player.health + healing);
    recovered += this.player.health - previousHealth;
    this.pendingLevels -= 1;
  }
  this.offers = [];
  this.state = "playing";
  this.feedback = recovered > 0 ? "武艺已成 · 回复 " + recovered : "武艺已成 · 战斗继续";
  this.feedbackTime = 1.6;
};

World.prototype.chooseSkill = function (id) {
  if (this.state !== "choosing") { return false; }
  var valid = this.offers.some(function (offer) { return offer.id === id; });
  if (!valid) { return false; }
  this.ranks[id] = (this.ranks[id] || 0) + 1;
  if (id === "vitality") {
    this.player.maxHealth += 18;
    this.player.health = Math.min(this.player.maxHealth, this.player.health + 24);
  }
  this.pendingLevels -= 1;
  this.feedback = skills.find(id, this.heroId).name + " · " + this.ranks[id] + "级";
  this.feedbackTime = 1.4;
  if (this.pendingLevels > 0) {
    this.openSkillChoice();
  } else {
    this.offers = [];
    this.state = "playing";
  }
  return true;
};

World.prototype.updateEffects = function (dt) {
  for (var index = this.slashes.length - 1; index >= 0; index -= 1) {
    var slash = this.slashes[index];
    if (slash.followPlayer) {
      slash.x = this.player.x;
      slash.y = this.player.y;
    }
    slash.life -= dt;
    if (slash.life <= 0) {
      this.slashes.splice(index, 1);
    }
  }
  for (var effectIndex = this.hitEffects.length - 1; effectIndex >= 0; effectIndex -= 1) {
    this.hitEffects[effectIndex].life -= dt;
    if (this.hitEffects[effectIndex].life <= 0) {
      this.hitEffects.splice(effectIndex, 1);
    }
  }
};

World.prototype.getRemainingSeconds = function () {
  if (this.bossSpawned) { return 0; }
  var cycle = config.waveDuration + config.waveBreakDuration;
  var timeInWave = this.elapsed - this.waveIndex * cycle;
  var end = timeInWave >= config.waveDuration ? cycle : config.waveDuration;
  return Math.max(0, Math.ceil(end - timeInWave));
};

World.prototype.getWaveLabel = function () {
  if (this.bossSpawned) { return "斩杀敌将"; }
  var total = config.waveEnemyCounts.length;
  var current = Math.min(total, this.waveIndex + 1);
  var cycle = config.waveDuration + config.waveBreakDuration;
  var timeInWave = this.elapsed - this.waveIndex * cycle;
  if (timeInWave >= config.waveDuration) {
    return "整备 敌" + this.enemies.length + " " + this.getRemainingSeconds() + "秒";
  }
  return "第" + current + "/" + total + "轮 · 敌" + this.enemies.length;
};

module.exports = World;
