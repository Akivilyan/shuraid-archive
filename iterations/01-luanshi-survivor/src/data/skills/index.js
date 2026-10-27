"use strict";

var common = require("./common");
var heroFiles = [require("./guan"), require("./huang"), require("./zhuge")];
var heroCatalogs = {};
var heroTuning = {};

for (var index = 0; index < heroFiles.length; index += 1) {
  heroCatalogs[heroFiles[index].heroId] = heroFiles[index].skills;
  heroTuning[heroFiles[index].heroId] = heroFiles[index].tuning || {};
}

function catalogForHero(heroId) {
  return heroCatalogs[heroId] || heroCatalogs.guan;
}

function tuningFor(heroId, skillId) {
  var tuning = heroTuning[heroId] || {};
  return tuning[skillId] || null;
}

module.exports = {
  common: common,
  catalogForHero: catalogForHero,
  tuningFor: tuningFor
};
