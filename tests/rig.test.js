"use strict";

var test = require("node:test");
var assert = require("node:assert/strict");
var rig = require("../src/render/character-rig");

test("the player rig exposes separate walk, attack and hurt poses", function () {
  var idle = rig.playerPose({ heroId: "guan", moving: false, walkTime: 0, actionTime: 0, hurtTime: 0 }, 0);
  var moving = rig.playerPose({ heroId: "guan", moving: true, walkTime: 0.01, actionTime: 0, hurtTime: 0 }, 0);
  var attacking = rig.playerPose({ heroId: "guan", moving: true, walkTime: 0.01, actionTime: 0.09, hurtTime: 0 }, 0);
  var hurt = rig.playerPose({ heroId: "guan", moving: true, walkTime: 0.01, actionTime: 0.09, hurtTime: 0.11 }, 0);
  assert.equal(idle.state, "idle");
  assert.equal(moving.state, "move");
  assert.equal(attacking.state, "attack");
  assert.equal(hurt.state, "hurt");
  assert.equal(moving.bodyTilt, 0);
  assert.equal(attacking.bodyTilt, 0);
  assert.ok(attacking.action > 0.9);
  assert.ok(hurt.hurt > 0.9);
  assert.notEqual(moving.leftLeg, moving.rightLeg);
  assert.ok(hurt.bodyScaleX > idle.bodyScaleX);
});

test("each hero maps the same bones to a different weapon pose", function () {
  function pose(heroId) {
    return rig.playerPose({ heroId: heroId, moving: false, walkTime: 0, actionTime: 0.09, hurtTime: 0 }, 0);
  }
  var guan = pose("guan");
  var huang = pose("huang");
  var zhuge = pose("zhuge");
  assert.notEqual(guan.weaponAngle, huang.weaponAngle);
  assert.notEqual(huang.weaponAngle, zhuge.weaponAngle);
  assert.notEqual(guan.frontArm, zhuge.frontArm);
});

test("enemy attack and hit states deform the reusable soldier rig", function () {
  var neutral = rig.enemyPose({ type: "grunt", age: 0, attackTime: 0, hitFlash: 0 });
  var active = rig.enemyPose({ type: "runner", age: 0.1, attackTime: 0.12, hitFlash: 0 });
  var hurt = rig.enemyPose({ type: "runner", age: 0.1, attackTime: 0.12, hitFlash: 0.05 });
  assert.equal(neutral.state, "move");
  assert.equal(active.state, "attack");
  assert.equal(hurt.state, "hurt");
  assert.equal(neutral.bodyTilt, 0);
  assert.equal(active.bodyTilt, 0);
  assert.equal(neutral.attack, 0);
  assert.ok(active.attack > 0.9);
  assert.ok(hurt.hurt > 0.9);
  assert.notEqual(active.frontArm, neutral.frontArm);
});
