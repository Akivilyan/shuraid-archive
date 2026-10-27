"use strict";

module.exports = {
  heroId: "guan",
  skills: [
    { id: "blade", name: "青龙斩", kind: "固有武艺", slot: "base", descriptions: ["以青龙偃月刀横扫前方扇形区域", "青龙斩伤害提高 30%", "青龙斩伤害再次提高 35%"] },
    { id: "bladeSweep", name: "青龙威势", kind: "武艺强化", slot: "base", descriptions: ["横扫半径提高至 118，扇面扩大至 62°", "横扫半径提高至 124，扇面扩大至 69°", "横扫半径提高至 130，扇面扩大至 76°"] },
    { id: "ringblade", name: "偃月斩", kind: "保命武艺", slot: "active", descriptions: ["每 10 秒挥动长柄偃月刀环斩周身两周", "环斩范围与伤害提高", "环斩范围与伤害再次提高"] },
    { id: "warmWine", name: "温酒斩", kind: "战法", slot: "active", descriptions: ["半透明分身冲向敌军最密集的直线", "冲击距离、宽度与伤害提高", "分身变大，冲击距离、宽度与伤害再次提高"] }
  ],
  tuning: {
    blade: {
      ranks: [
        { damageMultiplier: 1, knockback: 50 },
        { damageMultiplier: 1.3, knockback: 50 },
        { damageMultiplier: 1.65, knockback: 50 }
      ],
      visual: { life: 0.34, family: "guan-sector-sweep" }
    },
    bladeSweep: {
      rangeBonuses: [0, 6, 12, 18],
      halfAngles: [0.48, 0.54, 0.6, 0.66]
    },
    ringblade: {
      ranks: [
        { range: 126, damage: 42 },
        { range: 150, damage: 58 },
        { range: 174, damage: 76 }
      ],
      cooldown: 10,
      knockback: 145,
      visual: { life: 0.92, rotations: 2, gripPivot: 0.18, family: "guan-ringblade" }
    },
    warmWine: {
      ranks: [
        { range: 270, halfWidth: 20, damage: 32, cloneScale: 1 },
        { range: 315, halfWidth: 26, damage: 46, cloneScale: 1.14 },
        { range: 360, halfWidth: 32, damage: 64, cloneScale: 1.28 }
      ],
      cooldown: 8,
      knockback: 110,
      visual: { life: 0.82, family: "guan-warm-wine" }
    }
  }
};
