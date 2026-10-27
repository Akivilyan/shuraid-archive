"use strict";

module.exports = {
  heroId: "huang",
  skills: [
    { id: "arrow", name: "强弓", kind: "固有武艺", slot: "base", descriptions: ["箭矢伤害提高", "箭矢飞行更快", "一次发射三支箭"] },
    { id: "volley", name: "连珠箭", kind: "战法", slot: "active", descriptions: ["周期性发射三支箭", "增加箭矢伤害", "一次发射五支箭"] },
    { id: "piercing", name: "破甲箭", kind: "战法", slot: "active", descriptions: ["基础箭矢额外穿透一名敌人", "再次增加穿透", "穿透数量大幅提高"] },
    { id: "arrowrain", name: "箭雨", kind: "战法", slot: "active", descriptions: ["周期性攻击一片区域", "范围与伤害提高", "同一区域连续落下两轮"] }
  ]
};
