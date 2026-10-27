"use strict";

var test = require("node:test");
var assert = require("node:assert/strict");
var heroes = require("../src/core/heroes");

test("the first roster covers exactly the three reusable attack algorithms", function () {
  assert.equal(heroes.list.length, 3);
  assert.deepEqual(heroes.list.map(function (hero) { return hero.attackType; }), ["arc", "projectile", "lightning"]);
  assert.deepEqual(heroes.list.map(function (hero) { return hero.id; }), ["guan", "huang", "zhuge"]);
});

test("unknown hero ids safely fall back to Guan Yu", function () {
  assert.equal(heroes.get("unknown").id, "guan");
});
