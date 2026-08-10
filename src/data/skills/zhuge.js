"use strict";

module.exports = {
  heroId: "zhuge",
  skills: [
    { id: "thunder", name: "闪电链", kind: "固有奇术", slot: "base", descriptions: ["闪电连续攻击附近 3 名敌军", "闪电链伤害提高 25%", "闪电链伤害再次提高 25%"] },
    { id: "chain", name: "闪电连击", kind: "奇术强化", slot: "base", descriptions: ["闪电链弹射次数增加至 5 次", "闪电链弹射次数增加至 7 次", "闪电链弹射次数增加至 9 次"] },
    { id: "formation", name: "八阵图", kind: "战法", slot: "active", descriptions: ["周期性在最密集的敌群中布下八阵图", "八阵图伤害与范围提高", "八阵图伤害与范围再次提高"] },
    { id: "gust", name: "东风摧阵", kind: "保命战法", slot: "active", descriptions: ["每 8 秒以东风大范围推开并轻伤周身敌军", "东风范围不变，释放间隔缩短至 6.75 秒", "东风范围不变，释放间隔缩短至 5.5 秒"] }
  ]
};
