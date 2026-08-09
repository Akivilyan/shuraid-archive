"use strict";

var test = require("node:test");
var assert = require("node:assert/strict");
var Renderer = require("../src/render/renderer");

function makeContext() {
  var context = {};
  ["arc", "beginPath", "closePath", "drawImage", "ellipse", "fill", "fillRect", "fillText", "lineTo", "moveTo", "quadraticCurveTo", "restore", "rotate", "save", "scale", "stroke", "strokeRect", "strokeText", "translate"].forEach(function (method) {
    context[method] = function () {};
  });
  return context;
}

function makeHomeWorld(heroId) {
  var heroes = {
    guan: { id: "guan", name: "关羽", className: "长兵" },
    huang: { id: "huang", name: "黄忠", className: "弓箭" },
    zhuge: { id: "zhuge", name: "诸葛亮", className: "法术" }
  };
  return { hero: heroes[heroId], heroId: heroId };
}

test("home screen touch regions keep the primary action large and separate", function () {
  var renderer = new Renderer(null, 375, 812, { safeTop: 44, playTop: 110 });
  assert.equal(renderer.getHomeActionAt(187, 620), "start");
  assert.equal(renderer.getHomeActionAt(90, 760), "hero");
  assert.equal(renderer.getHomeActionAt(285, 760), "settings");
  assert.equal(renderer.getHomeActionAt(10, 200), "none");
});

test("settings touch regions expose vibration, music, sound, and back separately", function () {
  var renderer = new Renderer(null, 375, 812, { safeTop: 44, playTop: 110 });
  var panelY = Math.max(44 + 70, 812 * 0.22);
  assert.equal(renderer.getSettingsActionAt(187, panelY + 105), "vibration");
  assert.equal(renderer.getSettingsActionAt(187, panelY + 170), "music");
  assert.equal(renderer.getSettingsActionAt(187, panelY + 238), "sound");
  assert.equal(renderer.getSettingsActionAt(187, panelY + 325), "back");
});

test("hero screen exposes three large and separate hero choices", function () {
  var renderer = new Renderer(null, 375, 812, { safeTop: 44, playTop: 110 });
  var panelY = Math.max(44 + 24, 76);
  assert.equal(renderer.getHeroActionAt(187, panelY + 100), "guan");
  assert.equal(renderer.getHeroActionAt(187, panelY + 224), "huang");
  assert.equal(renderer.getHeroActionAt(187, panelY + 348), "zhuge");
  assert.equal(renderer.getHeroActionAt(10, panelY + 100), "none");
  assert.equal(renderer.getHeroActionAt(187, 745), "confirm");
});

test("home screen names the game and renders the selected hero portrait", function () {
  var context = makeContext();
  var labels = [];
  var drawImageCalls = 0;
  context.fillText = function (label) { labels.push(label); };
  context.drawImage = function () { drawImageCalls += 1; };
  var renderer = new Renderer(context, 375, 812, {
    safeTop: 44,
    playTop: 110,
    heroAtlases: { zhuge: { width: 2304, height: 288 } }
  });
  renderer.drawHomeScreen(makeHomeWorld("zhuge"), 1.2);
  assert.ok(labels.includes("报，蜀军来劫粮"));
  assert.ok(labels.includes("诸葛亮 · 法术"));
  assert.equal(drawImageCalls, 1);
});

test("selected hero card uses an action frame and explicit selected label", function () {
  var context = makeContext();
  var labels = [];
  var sourceFrames = [];
  context.fillText = function (label) { labels.push(label); };
  context.drawImage = function (image, sourceX) { sourceFrames.push(sourceX); };
  var renderer = new Renderer(context, 375, 812, {
    safeTop: 44,
    playTop: 110,
    heroAtlases: {
      guan: { width: 2304, height: 288 },
      zhuge: { width: 2304, height: 288 }
    }
  });
  renderer.drawHeroScreen("zhuge", 1.2);
  assert.ok(labels.includes("已选中"));
  assert.ok(labels.includes("确认武将"));
  assert.ok(sourceFrames.some(function (sourceX) { return sourceX >= 384 * 3; }));
});

test("the articulated rig renders every hero without a Canvas error", function () {
  var renderer = new Renderer(makeContext(), 375, 812, { safeTop: 44, playTop: 110 });
  ["guan", "huang", "zhuge"].forEach(function (heroId) {
    assert.doesNotThrow(function () {
      renderer.drawPlayer({
        x: 100,
        y: 100,
        facing: { x: 1, y: 0 },
        heroId: heroId,
        moving: true,
        walkTime: 0.4,
        actionTime: 0.09,
        hurtTime: 0.11,
        invulnerable: 0
      }, 1.2);
    });
  });
});

test("the articulated rig renders all soldier classes in both factions", function () {
  var renderer = new Renderer(makeContext(), 375, 812, { safeTop: 44, playTop: 110 });
  var enemies = [];
  ["grunt", "runner", "brute", "archer", "boss"].forEach(function (type, index) {
    ["wei", "wu"].forEach(function (faction, factionIndex) {
      enemies.push({
        type: type,
        faction: faction,
        x: 60 + index * 40,
        y: 100 + factionIndex * 50,
        radius: type === "boss" ? 31 : type === "brute" ? 16 : 11,
        age: 0.6,
        attackTime: 0.12,
        hitFlash: 0.05,
        facingX: 0,
        facingY: 1,
        health: 20,
        maxHealth: 40
      });
    });
  });
  assert.doesNotThrow(function () { renderer.drawEnemies(enemies); });
});

test("the pushed stove atlas replaces the runner drawing when loaded", function () {
  var context = makeContext();
  var drawCalls = 0;
  context.drawImage = function () { drawCalls += 1; };
  var renderer = new Renderer(context, 375, 812, {
    safeTop: 44,
    playTop: 110,
    enemyAtlases: { pushedStove: { width: 1920, height: 240 } }
  });
  renderer.drawEnemies([{
    type: "runner",
    faction: "wei",
    x: 120,
    y: 160,
    radius: 15,
    age: 0.6,
    attackTime: 0,
    hitFlash: 0,
    facingX: -1,
    facingY: 0,
    health: 20,
    maxHealth: 20
  }]);
  assert.equal(drawCalls, 1);
});

test("the Guan Yu atlas renders the default hero when loaded", function () {
  var context = makeContext();
  var drawCalls = 0;
  context.drawImage = function () { drawCalls += 1; };
  var renderer = new Renderer(context, 375, 812, {
    safeTop: 44,
    playTop: 110,
    heroAtlases: { guan: { width: 2304, height: 288 } }
  });
  renderer.drawPlayer({
    x: 120,
    y: 160,
    facing: { x: 1, y: 0 },
    heroId: "guan",
    moving: true,
    walkTime: 0.4,
    actionTime: 0,
    hurtTime: 0,
    invulnerable: 0
  }, 1.2);
  assert.equal(drawCalls, 1);
});

test("the Zhuge Liang atlas replaces the fallback drawing when loaded", function () {
  var drawImageCalls = 0;
  var context = makeContext();
  context.drawImage = function () { drawImageCalls += 1; };
  var renderer = new Renderer(context, 375, 812, {
    safeTop: 44,
    playTop: 110,
    heroAtlases: { zhuge: { width: 2304, height: 288 } }
  });
  renderer.drawPlayer({
    heroId: "zhuge", x: 100, y: 120, facing: { x: 1, y: 0 },
    moving: false, walkTime: 0, actionTime: 0, hurtTime: 0, invulnerable: 0
  }, 0);
  assert.equal(drawImageCalls, 1);
});

test("the Eight Trigram Formation renders with the lightweight Canvas path", function () {
  var renderer = new Renderer(makeContext(), 375, 812, { safeTop: 44, playTop: 110 });
  assert.doesNotThrow(function () {
    renderer.drawSlashes([{ shape: "trigram", color: "trigram", x: 120, y: 180, range: 60, life: 0.5, maxLife: 0.68 }]);
  });
});

test("the three kitchen atlases replace grunt brute and archer drawings", function () {
  var context = makeContext();
  var drawCalls = 0;
  context.drawImage = function () { drawCalls += 1; };
  var image = { width: 1728, height: 288 };
  var renderer = new Renderer(context, 375, 812, {
    safeTop: 44,
    playTop: 110,
    enemyAtlases: { headCook: image, potLidGuard: image, bunThrower: image }
  });
  var enemies = ["grunt", "brute", "archer"].map(function (type, index) {
    return {
      type: type,
      faction: "wei",
      x: 80 + index * 60,
      y: 160,
      radius: type === "brute" ? 16 : 11,
      age: 0.6,
      attackTime: 0,
      hitFlash: 0,
      facingX: -1,
      facingY: 0,
      health: 20,
      maxHealth: 40
    };
  });
  renderer.drawEnemies(enemies);
  assert.equal(drawCalls, 3);
});
