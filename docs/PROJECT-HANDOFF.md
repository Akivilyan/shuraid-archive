# 项目交接

## 当前事实

- 主项目：`M:\codex\ShuRaid2D`。
- Cocos Creator：3.8.8，项目由官方 Empty (2D) 模板创建。
- Git：阶段 0 基线已提交为 `9dc40e9 PROJECT-BASELINE: establish clean Cocos WeChat baseline`。
- 当前阶段：`CONTENT-MIGRATION.md` 的阶段 1——第一名人物，已确定为关羽。
- `assets/Bootstrap.scene` 是当前唯一场景；阶段 1 已迁入关羽待机、移动、攻击和受击所需的六张独立透明 PNG，并完成四个 AnimationClip、`GuanYu.prefab` 及场景内原生关羽节点。
- 首个可玩切片已落地：连续单指移动、待机/移动/攻击/受击动画切换、厨师长追击与接触伤害、按最后移动朝向每 0.6 秒发动青龙斩、命中减速、三次命中击杀及边缘重生。
- 项目扩展 `extensions/shuraid-editor-tools` 只在菜单命令触发时运行，不在项目启动时自动切换或保存场景，避免弹出未命名场景保存框。
- Cocos 编辑器已经识别项目，生成了本地 `library/`、`temp/` 和 `profiles/` 目录。
- 2026-08-11 已使用 Cocos Creator 3.8.8 CLI 完成微信小游戏 Release 构建，官方成功退出码为 36。
- 最新 Release 产物位于 `build/wechatgame`：`debug=false`、竖屏、50 个文件、约 3.855 MiB；关羽、厨师长 SpriteAtlas 和 `BattleSlice` 均已进入构建包。
- 微信开发者工具 CLI 已成功导入并打开该本地构建包；未执行预览、上传或发布。
- 源工程边界扫描未发现 `project.config.json`、`game.json`、`app.js`、`build-templates` 或原生微信小游戏源码；这些文件只存在于 Cocos 生成的 `build/` 产物中。
- 用户已在微信开发者工具中确认空场景正常启动且控制台无持续错误。
- 空场景阶段不单独记录 DevTools Performance 时间线；帧耗时、尖峰和移动手感将在“移动 + 一种敌人 + 普攻”的首个可玩切片中结合真机验证。
- 尚未完成玩法真机验收。

当前磁盘文件和 Git 状态高于本交接文档；开始工作前必须重新检查两者。

## 当前切片

阶段 0 的空工程微信小游戏 Release 性能基线已完成：

1. [x] 在 Cocos 编辑器中原生创建并保存一个空 Scene；
2. [x] 使用保存的微信小游戏 Release 配置完成 Cocos CLI 构建；
3. [x] 使用微信开发者工具 CLI 导入并打开构建包；
4. [x] 由用户手动确认空场景正常启动且控制台无持续错误；
5. [x] 记录 Release 包体与工程边界；玩法性能和真机手感留到首个可玩切片验证。

阶段 1 的人物资源基础已完成：

1. [x] 迁入关羽当前马上需要的六张独立动作帧；
2. [x] 由 Cocos 生成全新 SpriteFrame 元数据；
3. [x] 创建待机、移动、普攻、受击四个原生 AnimationClip；
4. [x] 创建 `GuanYu.prefab`，Sprite 使用 `RAW` Size Mode；
5. [x] 在 `Bootstrap.scene` 中放置关羽原生节点并完成 Release 构建验证。

首个可玩切片已实现：

1. [x] 指尖目标移动与边界限制；
2. [x] 最后移动朝向驱动关羽翻面和青龙斩方向；
3. [x] 青龙斩严格使用 0.6 秒间隔、112 半径和 0.48 弧度半角；
4. [x] 厨师长追击、接触受击、命中减速刷新、击杀和复用重生；
5. [x] 原生 SpriteAtlas、敌人 Prefab、场景节点和 Release 构建通过。

尚未加入多敌人对象池、经验升级、正式场景美术和音频。

## 实现边界

- 使用 Scene、Prefab、SpriteFrame、SpriteAtlas、AnimationClip 和编辑器资源引用。
- 不用脚本动态拼装整棵场景树，不在运行时手工切 SpriteFrame。
- 旧项目 `M:\codex\ShuRaid` 只可作为逐项候选来源，不复制其脚本、场景、settings、旧 `.meta`、构建配置或运行时切帧方案。
- `M:\codex\ShuRaid-Cocos` 不再使用。
- 每次迁移只取当前功能马上需要的最小文件集合，并记录来源、用途、目标路径和验证结果。
- 未经用户明确同意，不推送远端、不上传或发布微信版本。

## 下一步

首个“移动 + 一种敌人 + 普攻”切片已经可以交给用户测试。下一步以用户反馈为准调整移动手感、角色比例、青龙斩可读性和接触距离；通过后再扩为多敌人对象池。当前自动构建成功不代表真机验收完成。
