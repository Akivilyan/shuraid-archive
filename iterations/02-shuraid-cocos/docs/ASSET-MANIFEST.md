# 素材迁移清单

所有来源均来自冻结仓库 `M:\codex\GameOne\luanshi-survivor` 的提交 `4a3652e`。本清单只记录迁入新仓库的精选素材；未列出的候选稿、旧特效图集、旧 Cocos `.meta` 和构建产物均未迁入。

## Cocos 运行资源

| 新路径 | 来源 | 用途 |
| --- | --- | --- |
| `assets/art/runtime/heroes/guan-atlas.png` | `assets/runtime/guan-atlas.png` | 关羽战斗图集 |
| `assets/art/runtime/heroes/huang-atlas.png` | `assets/runtime/huang-atlas.png` | 黄忠战斗图集 |
| `assets/art/runtime/heroes/zhuge-atlas.png` | `assets/runtime/zhuge-atlas.png` | 诸葛亮战斗图集 |
| `assets/art/runtime/heroes/*-showcase-v1.jpg` | `assets/runtime/` 同名文件 | 三名武将界面立绘 |
| `assets/art/runtime/heroes/guan-yanyuedao-v1.png` | `assets/runtime/guan-yanyuedao-v1.png` | 关羽独立长柄武器 |
| `assets/art/runtime/enemies/*-atlas.png` | `assets/runtime/` 四个伙夫图集 | 厨师长、推灶车、锅盖兵、包子投手 |
| `assets/art/runtime/ui/home-cartoon-v1.jpg` | `assets/ui/home-cartoon-v1.jpg` | 现有营地背景参考/运行资源 |
| `assets/audio/` | `assets/audio/` | 三段 BGM 与九个 SFX |

## 引擎外源素材

| 新路径 | 来源 | 状态 |
| --- | --- | --- |
| `art-source/accepted/showcases/hero-guan-red-hare-showcase-v4-legs-fixed.png` | `assets/concepts/` 同名文件 | 关羽展示母图定稿 |
| `art-source/accepted/showcases/hero-huang-chicken-showcase-v1.png` | `assets/concepts/` 同名文件 | 黄忠展示母图定稿 |
| `art-source/accepted/showcases/hero-zhuge-wooden-ox-convoy-showcase-v2-candidate.png` | `assets/concepts/` 同名文件 | 当前采用的诸葛展示母图 |
| `art-source/accepted/weapons/guan-yanyuedao-master-v1.png` | `assets/concepts/` 同名文件 | 青龙偃月刀透明母图 |
| `art-source/accepted/characters/*motion-study*.png` | `assets/concepts/` 精选动作稿 | 三名武将动作参考 |
| `art-source/accepted/enemies/*.png` | `assets/concepts/` 四类敌人动作稿及明亮配色表 | 伙夫军团参考 |
| `art-source/sprite-frames/heroes/` | `assets/sprites/heroes/` | 三名武将已拆分的动作帧 |

## 明确不迁入

- 上一轮 `cocos-client/` 的场景、脚本、设置、`.meta` 和战斗特效图集；
- Canvas 渲染器、输入循环、微信平台胶水和旧入口；
- 未确认的赤兔坐骑/表情候选、替代笑点和大量过程稿；
- `build/`、`library/`、`temp/`、日志、测试截图和 Playwright 输出。
