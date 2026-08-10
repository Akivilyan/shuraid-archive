"use strict";

var test = require("node:test");
var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");
var skills = require("../src/core/skills");

test("the WeChat runtime uses an explicit skill data entry module", function () {
  var source = fs.readFileSync(path.resolve(__dirname, "../src/core/skills.js"), "utf8");
  assert.ok(source.includes('require("../data/skills/index")'));
  assert.equal(source.includes('require("../data/skills")'), false);
});

test("an offer contains three different available skills", function () {
  var offers = skills.buildOffers({ blade: 1 }, function () { return 0.4; });
  assert.equal(offers.length, 3);
  assert.equal(new Set(offers.map(function (offer) { return offer.id; })).size, 3);
});

test("an offer prioritizes one owned skill and one new skill", function () {
  var offers = skills.buildOffers({ blade: 2, bladeSweep: 1 }, function () { return 0; });
  var owned = offers.filter(function (offer) { return offer.id === "blade" || offer.id === "bladeSweep"; });
  var newSkill = offers.filter(function (offer) { return offer.id !== "blade" && offer.id !== "bladeSweep"; });
  assert.ok(owned.length >= 1);
  assert.ok(newSkill.length >= 1);
});

test("max-rank skills are removed from future offers", function () {
  var offers = skills.buildOffers({ blade: 3, bladeSweep: 3 }, function () { return 0; });
  assert.equal(offers.some(function (offer) { return offer.id === "blade"; }), false);
  assert.equal(offers.some(function (offer) { return offer.id === "bladeSweep"; }), false);
});

test("each hero receives its own simple combat skill pool", function () {
  var guan = skills.catalogForHero("guan").map(function (skill) { return skill.id; });
  var huang = skills.catalogForHero("huang").map(function (skill) { return skill.id; });
  var zhuge = skills.catalogForHero("zhuge").map(function (skill) { return skill.id; });
  assert.ok(guan.includes("blade"));
  assert.ok(guan.includes("bladeSweep"));
  assert.ok(guan.includes("ringblade"));
  assert.ok(guan.includes("warmWine"));
  assert.equal(guan.length, 7);
  assert.equal(guan.includes("whirlwind"), false);
  assert.equal(guan.includes("crescent"), false);
  assert.equal(guan.includes("firetrail"), false);
  assert.ok(huang.includes("volley"));
  assert.ok(huang.includes("piercing"));
  assert.equal(huang.includes("thunder"), false);
  assert.ok(zhuge.includes("thunder"));
  assert.ok(zhuge.includes("chain"));
  assert.ok(zhuge.includes("formation"));
  assert.equal(zhuge.includes("vermillion"), false);
  assert.ok(zhuge.includes("gust"));
  assert.equal(zhuge.includes("spell"), false);
  assert.equal(zhuge.includes("firefield"), false);
  assert.equal(zhuge.includes("volley"), false);
});

test("two occupied combat slots prevent a third new combat skill", function () {
  var offers = skills.buildOffers({ arrow: 1, volley: 1, piercing: 1 }, function () { return 0; }, "huang");
  assert.equal(offers.some(function (offer) { return offer.id === "arrowrain"; }), false);
  assert.ok(offers.some(function (offer) { return offer.id === "volley" || offer.id === "piercing"; }));
});

test("two occupied passive slots prevent a third new passive", function () {
  var offers = skills.buildOffers({ blade: 1, might: 1, haste: 1 }, function () { return 0.8; }, "guan");
  assert.equal(offers.some(function (offer) { return offer.id === "vitality"; }), false);
});

test("Guan Yu combat tuning is available beside his skill definitions", function () {
  var blade = skills.tuningFor("guan", "blade");
  var bladeSweep = skills.tuningFor("guan", "bladeSweep");
  var ringblade = skills.tuningFor("guan", "ringblade");
  var warmWine = skills.tuningFor("guan", "warmWine");
  assert.equal(skills.find("ringblade", "guan").name, "偃月斩");
  assert.equal(blade.ranks[2].damageMultiplier, 1.65);
  assert.equal(blade.visual.life, 0.34);
  assert.equal(bladeSweep.rangeBonuses[3], 18);
  assert.equal(bladeSweep.halfAngles[3], 0.66);
  assert.equal(ringblade.cooldown, 10);
  assert.equal(ringblade.ranks[2].range, 174);
  assert.equal(ringblade.ranks[2].damage, 76);
  assert.equal(ringblade.visual.life, 0.92);
  assert.equal(ringblade.visual.rotations, 2);
  assert.equal(warmWine.cooldown, 8);
  assert.equal(warmWine.ranks[0].range, 270);
  assert.equal(warmWine.ranks[2].range, 360);
  assert.equal(warmWine.ranks[2].halfWidth, 32);
  assert.equal(warmWine.ranks[2].cloneScale, 1.28);
  assert.equal(warmWine.visual.life, 0.82);
});
