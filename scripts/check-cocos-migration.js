"use strict";

var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");

var root = path.resolve(__dirname, "..");
var clientRoot = path.join(root, "cocos-client");
var contractPath = path.join(clientRoot, "assets", "resources", "config", "guan-slice.json");
var contract = JSON.parse(fs.readFileSync(contractPath, "utf8"));
var heroes = require(path.join(root, "src", "core", "heroes"));
var config = require(path.join(root, "src", "config"));
var guanSkills = require(path.join(root, "src", "data", "skills", "guan"));

var guan = heroes.get("guan");
assert.equal(contract.hero.health, guan.health, "hero health drifted from Canvas");
assert.equal(contract.hero.attack, guan.attack, "hero attack drifted from Canvas");
assert.equal(contract.hero.attackInterval, guan.attackInterval, "attack interval drifted from Canvas");
assert.equal(contract.hero.attackRange, guan.attackRange, "attack range drifted from Canvas");
assert.equal(contract.hero.speed, config.playerSpeed, "movement speed drifted from Canvas");
assert.equal(contract.hero.radius, config.playerRadius, "hero radius drifted from Canvas");

var worldSource = fs.readFileSync(path.join(root, "src", "core", "world.js"), "utf8");
assert.match(worldSource, /grunt:\s*\{\s*radius:\s*11,\s*health:\s*28,\s*speed:\s*54,\s*damage:\s*6,\s*experience:\s*2\s*\}/);
assert.deepEqual(contract.enemy, {
  type: "grunt",
  health: 28,
  speed: 54,
  damage: 6,
  experience: 2,
  radius: 11,
});

assert.deepEqual(contract.blade, {
  damageMultiplier: guanSkills.tuning.blade.ranks[0].damageMultiplier,
  knockback: guanSkills.tuning.blade.ranks[0].knockback,
  halfAngle: guanSkills.tuning.bladeSweep.halfAngles[0],
  visualLife: guanSkills.tuning.blade.visual.life,
});
assert.deepEqual(contract.ringblade, {
  range: guanSkills.tuning.ringblade.ranks[0].range,
  damage: guanSkills.tuning.ringblade.ranks[0].damage,
  cooldown: guanSkills.tuning.ringblade.cooldown,
  knockback: guanSkills.tuning.ringblade.knockback,
  visualLife: guanSkills.tuning.ringblade.visual.life,
  rotations: guanSkills.tuning.ringblade.visual.rotations,
  gripPivot: guanSkills.tuning.ringblade.visual.gripPivot,
});
assert.deepEqual(contract.warmWine, {
  range: guanSkills.tuning.warmWine.ranks[0].range,
  halfWidth: guanSkills.tuning.warmWine.ranks[0].halfWidth,
  damage: guanSkills.tuning.warmWine.ranks[0].damage,
  cooldown: guanSkills.tuning.warmWine.cooldown,
  knockback: guanSkills.tuning.warmWine.knockback,
  visualLife: guanSkills.tuning.warmWine.visual.life,
  cloneScale: guanSkills.tuning.warmWine.ranks[0].cloneScale,
});

[
  "assets/BattleSlice.scene",
  "assets/scripts/BattleRoot.ts",
  "assets/scripts/BattleModel.ts",
  "assets/scripts/ActorPresenter.ts",
  "assets/scripts/CombatVfxPool.ts",
  "assets/scripts/ViewPrimitives.ts",
  "assets/resources/art/guan-atlas.png",
  "assets/resources/art/guan-showcase-v1.jpg",
  "assets/resources/art/head-cook-atlas.png",
  "assets/resources/art/guan-yanyuedao-v1.png",
  "assets/resources/art/battle-fx-atlas.png",
].forEach(function (relativePath) {
  assert.ok(fs.existsSync(path.join(clientRoot, relativePath)), "missing Cocos migration file: " + relativePath);
});

var sceneUuid = "b13f9f32-594a-4f64-a2d8-2f13c7e6dd91";
["web-mobile", "wechatgame"].forEach(function (target) {
  var buildConfig = JSON.parse(fs.readFileSync(path.join(root, "scripts", "cocos-build-config", target + ".json"), "utf8"));
  assert.equal(buildConfig.platform, target);
  assert.equal(buildConfig.startScene, sceneUuid);
  assert.equal(buildConfig.scenes[0].uuid, sceneUuid);
});

var battleRootSource = fs.readFileSync(path.join(clientRoot, "assets", "scripts", "BattleRoot.ts"), "utf8");
assert.match(battleRootSource, /private screen: ScreenMode = "home"/, "Cocos slice must open on the home screen");
assert.match(battleRootSource, /this\.heroFrames = this\.buildAtlasFrames/, "hero atlas frames must be cached");
assert.match(battleRootSource, /const WORLD_SCALE = 0\.84/, "battlefield zoom-out contract changed unexpectedly");
assert.match(battleRootSource, /const MAX_RENDER_DPR = 1\.25/, "WeChat render scale cap changed unexpectedly");
assert.match(battleRootSource, /const FIXED_SIMULATION_STEP = 1 \/ 60/, "movement must use a stable simulation step");
assert.doesNotMatch(battleRootSource, /frameFromAtlas/, "per-frame SpriteFrame creation must not return");
assert.doesNotMatch(battleRootSource, /\bGraphics\b/, "battle root must not return to immediate-mode Graphics");
assert.doesNotMatch(battleRootSource, /\.destroy\(/, "battle root must not destroy nodes during combat");
assert.match(battleRootSource, /frame\.packable = false/, "pre-sliced atlas frames must bypass the dynamic atlas");

var actorPresenterSource = fs.readFileSync(path.join(clientRoot, "assets", "scripts", "ActorPresenter.ts"), "utf8");
var combatVfxSource = fs.readFileSync(path.join(clientRoot, "assets", "scripts", "CombatVfxPool.ts"), "utf8");
var primitivesSource = fs.readFileSync(path.join(clientRoot, "assets", "scripts", "ViewPrimitives.ts"), "utf8");
assert.match(actorPresenterSource, /new NodePool\(/, "enemy actors must use a Cocos NodePool");
assert.match(combatVfxSource, /new NodePool\(/, "combat effects must use Cocos NodePool instances");
assert.doesNotMatch(combatVfxSource, /\.destroy\(/, "pooled combat effects must not destroy nodes");
assert.match(combatVfxSource, /angle: -360 \* event\.rotations/, "ringblade must rotate around its Cocos pivot");
assert.match(combatVfxSource, /syncHero\(x: number, y: number\)/, "hero-bound weapon effects must follow the moving actor");
assert.match(primitivesSource, /frame\.packable = false/, "the shared in-memory solid frame must bypass the dynamic atlas");

var battleModelSource = fs.readFileSync(path.join(clientRoot, "assets", "scripts", "BattleModel.ts"), "utf8");
assert.match(battleModelSource, /type: "battle-ended"/, "the Cocos slice must expose an explicit battle end event");
assert.doesNotMatch(battleModelSource, /if \(this\.hero\.health <= 0 \|\| this\.elapsed >= this\.rules\.sliceHarness\.duration\) \{\s*this\.reset\(\)/, "battle completion must not auto-reset the run");

var engineSettings = JSON.parse(fs.readFileSync(path.join(clientRoot, "settings", "v2", "packages", "engine.json"), "utf8"));
var engineModules = engineSettings.modules.configs.defaultConfig;
assert.equal(engineModules.cache.graphics._value, false, "Graphics engine module should be disabled after the native Sprite migration");
assert.equal(engineModules.includeModules.includes("graphics"), false, "Graphics must not remain in the explicit engine module list");

var wechatBuildConfig = JSON.parse(fs.readFileSync(path.join(root, "scripts", "cocos-build-config", "wechatgame.json"), "utf8"));
assert.equal(wechatBuildConfig.debug, false, "WeChat playtest build should not carry debug runtime overhead");
assert.equal(wechatBuildConfig.packages.wechatgame.highPerformanceMode, true, "WeChat high performance mode must stay enabled");

console.log("Cocos migration contract matches the Canvas Guan Yu slice.");
