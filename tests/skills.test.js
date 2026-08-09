"use strict";

var test = require("node:test");
var assert = require("node:assert/strict");
var skills = require("../src/core/skills");

test("an offer contains three different available skills", function () {
  var offers = skills.buildOffers({ blade: 1 }, function () { return 0.4; });
  assert.equal(offers.length, 3);
  assert.equal(new Set(offers.map(function (offer) { return offer.id; })).size, 3);
});

test("an offer prioritizes one owned skill and one new skill", function () {
  var offers = skills.buildOffers({ blade: 2, whirlwind: 1 }, function () { return 0; });
  var owned = offers.filter(function (offer) { return offer.id === "blade" || offer.id === "whirlwind"; });
  var newSkill = offers.filter(function (offer) { return offer.id !== "blade" && offer.id !== "whirlwind"; });
  assert.ok(owned.length >= 1);
  assert.ok(newSkill.length >= 1);
});

test("max-rank skills are removed from future offers", function () {
  var offers = skills.buildOffers({ blade: 3, whirlwind: 3 }, function () { return 0; });
  assert.equal(offers.some(function (offer) { return offer.id === "blade"; }), false);
  assert.equal(offers.some(function (offer) { return offer.id === "whirlwind"; }), false);
});

test("each hero receives its own simple combat skill pool", function () {
  var huang = skills.catalogForHero("huang").map(function (skill) { return skill.id; });
  var zhuge = skills.catalogForHero("zhuge").map(function (skill) { return skill.id; });
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
