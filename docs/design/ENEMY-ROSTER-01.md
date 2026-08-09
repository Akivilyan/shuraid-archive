# 敌军名单 01：伙夫军团

## 目标

首版固定 10 个兵种、4 个行为大类。角色外观可以荒诞，伤害判定必须简单、统一、可批量优化。

## 四类模型

| 大类 | 最终兵种 | 移动 | 伤害判定 |
| --- | --- | --- | --- |
| 骑兵 | 烤乳猪骑兵、推灶车 | 高速直接追踪 | 敌人圆形碰撞体接触玩家圆形碰撞体 |
| 近战 | 厨师长、背锅兵、挑担兵 | 中速直接追踪 | 敌人圆形碰撞体接触玩家圆形碰撞体 |
| 盾兵 | 锅盖兵、菜板兵 | 低速直接追踪，高生命、低击退 | 敌人圆形碰撞体接触玩家圆形碰撞体 |
| 远程 | 包子投手、整根辣椒投手、鸡蛋投手 | 与玩家保持固定距离 | 共用移动圆形弹丸碰撞体，仅更换弹丸图像 |

同一大类只允许调整速度、生命、伤害、体型和击退系数，不新增专属 AI 状态。

## 明确不做

- 不做治疗、增益、减益、缠绕和减速。
- 不做方向格挡、武器独立碰撞框和冲锋轨迹。
- 不做爆炸、地面持续伤害、锥形喷射和作用域判定。
- 推灶车的蒸汽只作移动表现，不造成伤害。
- 辣椒投手投掷整根辣椒；鸡蛋与包子都是单体弹丸。
- Boss 不复用这 10 个普通兵种，留到名将阶段单独设计。

## 视觉来源

- 基础伙夫角色：`assets/concepts/enemy-logistics-kitchen-corps-v1.png`
- 食材组合角色：`assets/concepts/enemy-food-fusion-corps-v1.png`
- 推灶车：`assets/concepts/enemy-pushed-stove-cavalry-v1.png`
- 整根辣椒投手：`assets/concepts/enemy-whole-chili-thrower-v2.png`
- 鸡蛋投手：`assets/concepts/enemy-egg-thrower-v1.png`

## 当前试玩映射

| 程序类型 | 当前美术 | 图集 |
| --- | --- | --- |
| `grunt` | 厨师长 | `assets/sprites/enemies/head-cook/head-cook-atlas.png` |
| `runner` | 推灶车 | `assets/sprites/enemies/pushed-stove/pushed-stove-atlas.png` |
| `brute` | 锅盖兵 | `assets/sprites/enemies/pot-lid-guard/pot-lid-guard-atlas.png` |
| `archer` | 包子投手 | `assets/sprites/enemies/bun-thrower/bun-thrower-atlas.png` |

四种类型继续共用现有追踪、接触碰撞和圆形弹丸逻辑；当前美术接入不代表为兵种增加专属 AI。

## 动画边界

每个兵种首版只制作待机、移动、攻击、受击四种状态。优先使用透明母图配合整体弹跳、倾斜、挤压和水平翻转；只有辨识度确实不足时，才追加独立武器或腿部帧。
