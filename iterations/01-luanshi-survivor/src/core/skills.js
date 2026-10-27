"use strict";

var skillData = require("../data/skills/index");
var common = skillData.common;

function catalogForHero(heroId) {
  return skillData.catalogForHero(heroId).concat(common);
}

function find(id, heroId) {
  var catalog = catalogForHero(heroId || "guan");
  for (var index = 0; index < catalog.length; index += 1) {
    if (catalog[index].id === id) {
      return catalog[index];
    }
  }
  return null;
}

function makeOffer(id, currentRank, heroId) {
  var skill = find(id, heroId);
  var nextRank = currentRank + 1;
  return {
    id: id,
    name: skill.name,
    kind: skill.kind,
    slot: skill.slot,
    rank: nextRank,
    description: skill.descriptions[nextRank - 1]
  };
}

function buildOffers(ranks, random, heroId) {
  var catalog = catalogForHero(heroId || "guan");
  var available = [];
  var activeOwned = countOwned(catalog, ranks, "active");
  var passiveOwned = countOwned(catalog, ranks, "passive");
  for (var index = 0; index < catalog.length; index += 1) {
    var rank = ranks[catalog[index].id] || 0;
    var hasRoom = rank > 0 || catalog[index].slot === "base" || (catalog[index].slot === "active" && activeOwned < 2) || (catalog[index].slot === "passive" && passiveOwned < 2);
    if (rank < 3 && hasRoom) {
      available.push(catalog[index].id);
    }
  }

  var existing = [];
  var newSkills = [];
  for (var itemIndex = 0; itemIndex < available.length; itemIndex += 1) {
    if ((ranks[available[itemIndex]] || 0) > 0) {
      existing.push(available[itemIndex]);
    } else {
      newSkills.push(available[itemIndex]);
    }
  }

  var selected = [];
  takeRandom(existing, selected, random);
  takeRandom(newSkills, selected, random);
  while (selected.length < 3 && available.length > selected.length) {
    takeRandom(available, selected, random);
  }

  return selected.map(function (id) {
    return makeOffer(id, ranks[id] || 0, heroId);
  });
}

function countOwned(catalog, ranks, slot) {
  var count = 0;
  for (var index = 0; index < catalog.length; index += 1) {
    if (catalog[index].slot === slot && (ranks[catalog[index].id] || 0) > 0) {
      count += 1;
    }
  }
  return count;
}

function takeRandom(source, selected, random) {
  var candidates = source.filter(function (id) { return selected.indexOf(id) < 0; });
  if (candidates.length === 0) { return; }
  selected.push(candidates[Math.floor(random() * candidates.length)]);
}

module.exports = {
  common: common,
  catalogForHero: catalogForHero,
  find: find,
  buildOffers: buildOffers,
  tuningFor: skillData.tuningFor
};
