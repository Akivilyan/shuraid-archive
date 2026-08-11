# 内容迁移记录

## 2026-08-11：关羽最小动作帧（已判定不适合作为视觉基线）

> 状态说明：以下记录保留为迁移证据，但“六张独立动作图 + 自动裁剪 + 默认中心枢轴”的方案已过时。文件本身没有损坏，问题是它没有恢复旧 Canvas 的运行图集和显示契约。替换方案验证前不删除现有资产。

当前对象：阶段 1 的第一名人物——关羽。

来源目录：`M:\codex\ShuRaid\art-source\sprite-frames\heroes\guan`。

目标目录：`assets/art/characters/guan/frames`。

| 文件 | 立即用途 | SHA-256 |
| --- | --- | --- |
| `idle.png` | 待机 SpriteFrame | `5FF23F479B7039FAFDF9C006A03FB639840CD6273E7CC89A13C5D3E6384CD542` |
| `move-a.png` | 移动 AnimationClip 第 1 帧 | `E21FA6B7ACDB306F09CC2FF6CF0D983CD1479D6C6EE22E6B9CBC8199B2DBBA96` |
| `move-b.png` | 移动 AnimationClip 第 2 帧 | `2796930A0D86C59BD1FB6907DD77ADF1A72F319384A7A65E0A547A1E13E111B3` |
| `attack-windup.png` | 普攻 AnimationClip 蓄力帧 | `756ACA67E624B873FA5306FD762EE3308C90E15ED199BFDFAE19F945A770FB71` |
| `attack-sweep.png` | 普攻 AnimationClip 挥击帧 | `8899A59D64E5A8836ED33523EE20DE35F9B22399A22D11B60041563FA3AC7903` |
| `hurt.png` | 受击 SpriteFrame | `56E9A7D95C17A771C90AC30FAED0BDD71A3A28489AED69AE958687BB957A405F` |

迁移边界：

- 当时未迁入 `guan-atlas.png`。该判断已废止：图集可以由 Cocos 在导入阶段生成 SpriteFrame，并不等于运行时手工切图；
- 未迁入展示立绘、预览图、独立大武器、旧脚本、旧 Scene、旧 Prefab、settings 或旧 `.meta`；
- 六个目标文件与来源文件的 SHA-256 已逐一匹配；
- Cocos Creator 3.8.8 CLI 已完成正式导入，六张 PNG 均生成全新的独立 image/texture/SpriteFrame UUID；未发现旧图集 UUID；
- 六张 SpriteFrame 的原始画布均为 512×384，导入器使用自动裁剪；Prefab 的 Sprite 使用 `RAW` Size Mode 保持统一原始画布，避免逐帧尺寸抖动；
- 已由 Cocos 编辑器资源序列化生成四个原生 AnimationClip：待机 1 帧循环、移动 2 帧循环（0.4 秒）、普攻 3 帧单次播放（0.6 秒）、受击 2 帧单次播放（0.25 秒）；
- 已生成 `assets/prefabs/characters/GuanYu.prefab`，根节点为 `GuanYu`，显示节点为 `Visual`，Sprite 和 Animation 均使用编辑器资源引用；
- `assets/Bootstrap.scene` 已放置一个原生 `GuanYu/Visual` 节点并引用上述 SpriteFrame 与 AnimationClip，不在运行时拼装角色节点或手工切帧；
- 2026-08-11 微信小游戏 Release 自动构建成功，Cocos 官方成功退出码为 36；六张角色 PNG 均进入 `assets/main/native` 构建产物。

### 后续诊断

- 旧 Canvas 实际加载的是 `M:\codex\GameOne\luanshi-survivor\assets\runtime\guan-atlas.png`，而不是上述六张独立帧；
- 旧版每帧源尺寸为 384×288，显示尺寸约为 101×76，横向身体枢轴为 `230/384`，基线偏移为 17；
- 关羽身体只使用待机和移动轮廓，自动普攻由独立青龙斩表现，不播放会改变身体占幅的攻击帧；
- 当前下一步是在 Cocos 编辑器中按上述契约重建 SpriteAtlas、AnimationClip 和 Prefab，而不是继续微调现有缩放值。

## 2026-08-11：厨师长与首个可玩切片

- 来源：`M:\codex\ShuRaid\assets\art\runtime\enemies\head-cook-atlas.png`；只迁入当前敌人需要的这一张透明图集，不迁入旧脚本、旧 `.meta` 或运行时切帧逻辑；
- 当前工程使用 `head-cook-atlas.plist` 在编辑器导入阶段生成 6 个 SpriteFrame，运行时不手工切图；
- 已创建 `assets/prefabs/enemies/HeadCook.prefab` 和场景内厨师长节点；
- 已新增 `assets/scripts/gameplay/BattleSlice.ts`，负责现阶段的移动、朝向、厨师长追击、接触反馈、青龙斩判定、减速刷新、击杀和复用重生；
- 青龙斩保持设计值：间隔 0.6 秒、半径 112、半角 0.48 弧度，按最后移动朝向攻击，不自动锁定敌人；
- 微信小游戏 Release 构建成功，退出码 36；未执行真机验收、上传或发布。

## 2026-08-11：首轮战斗反馈修正

- 关羽普攻 AnimationClip 改为“待机 → 蓄力 → 待机”，不再播放横向占幅过大的挥刀帧；原图未修改；
- 新增 `assets/art/effects/green-dragon-slash/green-dragon-slash-atlas.png` 与 `.plist`，由 Cocos 导入为 6 个 SpriteFrame；
- 新增 `green-dragon-slash.anim` 和 `GreenDragonSlash.prefab`，场景 `SlashVisual` 使用 Sprite + Animation 播放序列帧，脚本不再用 Graphics 生成刀光；
- 青龙斩仍按最后移动朝向判定，不自动锁敌；显示节点可整体缩放，判定半径仍为 112；
- 玩家与厨师长增加 72 逻辑像素的圆形实体分离；每次命中即时刷新敌人血条和 HUD HP；
- 第二轮反馈将自动青龙斩与人物移动动画解耦：发动技能不再重播人物攻击 Clip，移动 AnimationClip 可连续播放；
- 触摸坐标改为复用 `Vec2` 输出参数，斩击消失与命中闪白改为 update 计时器，不再为每次触摸或攻击创建临时对象和回调；
- 青龙斩显示缩放由 0.42 提高到 0.58，并沿攻击方向前移到 72；判定数据不变；
- 微信小游戏 Release 自动构建成功，Cocos 官方退出码 36；未执行真机验收、上传或发布。

## 2026-08-11：微信端第二轮比例与节奏校准

- 根据微信开发者工具截图，旧 Canvas 的约 101×76 显示尺寸直接映射后关羽明显偏小；Scene 与 `GuanYu.prefab` 的统一缩放由 `76/288` 提高到 `0.44`，图集帧、宽高比、枢轴和基线不变；
- 青龙斩自动攻击间隔由 0.6 秒调整为 1.0 秒，判定半径、角度、伤害和独立序列帧表现不变；
- 本轮仍由用户验证视觉比例、攻击节奏和移动卡顿体感，不把自动构建结果当作真机验收。

## 2026-08-11：自动真机调试主包瘦身

- 微信开发者工具返回 `80051`，源码包 4128KB 超过 4MB；本地 Release 文件总量约 4147KB；
- 当前切片没有 Spine 资源，关闭 Spine 3.8 引擎模块后重新构建成功，文件总量降至约 3872KB；
- 微信开发者工具“开启静态资源服务器”已记录为远程 Asset Bundle 的本地模拟入口；等场景和角色资源持续增长时再引入远程包，不为本次小幅超限提前增加网络加载链路。

## 2026-08-11：角色层与技能特效层定型

- 当前批次放弃独立武器展示层，角色层只播放待机、移动和受击；武器展示等角色素材重做后再设计；
- `GreenDragonSlashEffect` 独立管理青龙斩的出生位置、朝向、序列帧播放、0.24 秒寿命和圆形命中范围；角色只提供当前位置与最后移动方向；
- 固定 1.0 秒攻击时钟继续无目标空挥，是否命中不影响下一次技能生成；
- Cocos MCP 场景检查无错误或警告，3 个 Prefab 共 9 个资源引用完整；项目 TypeScript 在跳过 Creator 3.8.8 引擎声明库检查后通过；
- 微信小游戏 Release 构建成功，产物 36 个文件、约 3.78 MiB；未执行真机验收、上传或发布。

## 2026-08-11：拖动输入合并

- 真机反馈持续拖动时场景与小怪明显卡顿；排查范围收紧到高频 `TOUCH_MOVE` 输入路径；
- 触摸事件现在只记录最新 UI 坐标和脏标记，Canvas 坐标转换移到 `update()`，每个渲染帧最多执行一次；
- 角色移动、世界滚动、敌人追击与技能时钟仍只在 `update()` 中推进，避免一帧内重复输入工作挤占世界更新。
