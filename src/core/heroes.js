"use strict";

var definitions = [
  {
    id: "guan",
    name: "关羽",
    className: "长兵",
    attackType: "arc",
    baseSkill: "blade",
    health: 152,
    attack: 24,
    attackInterval: 0.6,
    attackRange: 178,
    color: "#39a957",
    description: "大范围横扫，适合贴近敌群。"
  },
  {
    id: "huang",
    name: "黄忠",
    className: "弓箭",
    attackType: "projectile",
    baseSkill: "arrow",
    health: 112,
    attack: 24,
    attackInterval: 0.86,
    attackRange: 290,
    color: "#e39a31",
    description: "远程射击，用距离换取安全。"
  },
  {
    id: "zhuge",
    name: "诸葛亮",
    className: "法术",
    attackType: "lightning",
    baseSkill: "thunder",
    health: 104,
    attack: 22,
    attackInterval: 1.02,
    attackRange: 235,
    color: "#5e91d8",
    description: "闪电链优先清除近身敌军。"
  }
];

function get(id) {
  for (var index = 0; index < definitions.length; index += 1) {
    if (definitions[index].id === id) {
      return definitions[index];
    }
  }
  return definitions[0];
}

module.exports = {
  list: definitions,
  get: get
};
