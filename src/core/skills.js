"use strict";

var common = [
  {
    id: "might",
    name: "武勇",
    kind: "体魄",
    slot: "passive",
    descriptions: ["所有伤害提高 15%", "所有伤害再提高 15%", "对生命过半的敌人额外增伤"]
  },
  {
    id: "haste",
    name: "疾行",
    kind: "体魄",
    slot: "passive",
    descriptions: ["移动与攻击速度提高", "移动与攻击速度再次提高", "拾取经验后短暂加速"]
  },
  {
    id: "vitality",
    name: "强身",
    kind: "体魄",
    slot: "passive",
    descriptions: ["提高生命上限并治疗", "再次提高生命上限并治疗", "濒危时缓慢恢复生命"]
  }
];

var heroCatalogs = {
  guan: [
    { id: "blade", name: "偃月斩", kind: "固有武艺", slot: "base", descriptions: ["横扫范围扩大，伤害提高", "横扫范围再次扩大", "横扫化为环身斩"] },
    { id: "whirlwind", name: "旋风斩", kind: "战法", slot: "active", descriptions: ["周期性攻击周围敌人", "范围与伤害提高", "每次连续斩击两轮"] },
    { id: "crescent", name: "青龙刀气", kind: "战法", slot: "active", descriptions: ["向最近敌人释放穿透刀气", "刀气变宽并提高伤害", "同时向三个方向释放刀气"] },
    { id: "firetrail", name: "赤焰行军", kind: "战法", slot: "active", descriptions: ["移动时周期性留下火焰", "火焰持续更久", "火焰熄灭时爆发"] }
  ],
  huang: [
    { id: "arrow", name: "强弓", kind: "固有武艺", slot: "base", descriptions: ["箭矢伤害提高", "箭矢飞行更快", "一次发射三支箭"] },
    { id: "volley", name: "连珠箭", kind: "战法", slot: "active", descriptions: ["周期性发射三支箭", "增加箭矢伤害", "一次发射五支箭"] },
    { id: "piercing", name: "破甲箭", kind: "战法", slot: "active", descriptions: ["基础箭矢额外穿透一名敌人", "再次增加穿透", "穿透数量大幅提高"] },
    { id: "arrowrain", name: "箭雨", kind: "战法", slot: "active", descriptions: ["周期性攻击一片区域", "范围与伤害提高", "同一区域连续落下两轮"] }
  ],
  zhuge: [
    { id: "thunder", name: "闪电链", kind: "固有奇术", slot: "base", descriptions: ["闪电连续攻击附近 3 名敌军", "闪电链伤害提高 25%", "闪电链伤害再次提高 25%"] },
    { id: "chain", name: "闪电连击", kind: "奇术强化", slot: "base", descriptions: ["闪电链弹射次数增加至 5 次", "闪电链弹射次数增加至 7 次", "闪电链弹射次数增加至 9 次"] },
    { id: "formation", name: "八阵图", kind: "战法", slot: "active", descriptions: ["周期性在最密集的敌群中布下八阵图", "八阵图伤害与范围提高", "八阵图伤害与范围再次提高"] },
    { id: "gust", name: "东风摧阵", kind: "保命战法", slot: "active", descriptions: ["每 8 秒以东风大范围推开并轻伤周身敌军", "东风范围不变，释放间隔缩短至 6.75 秒", "东风范围不变，释放间隔缩短至 5.5 秒"] }
  ]
};

function catalogForHero(heroId) {
  return (heroCatalogs[heroId] || heroCatalogs.guan).concat(common);
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
  buildOffers: buildOffers
};
