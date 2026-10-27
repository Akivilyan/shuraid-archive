# 项目交接

## 当前事实

- 主项目：`M:\codex\ShuRaid2D`。
- Cocos Creator：3.8.8，项目由官方 Empty (2D) 模板创建。
- Git：敏捷工作流清理边界为 `329e736 DOCS: reset project workflow for agile Cocos development`；最新提交必须通过当前 `git log -1` 获取，不在文档里长期固定。
- 当前阶段：关羽表现层已按旧版实际运行契约重建，等待用户集中测试后继续扩展内容。
- `assets/Bootstrap.scene` 是当前唯一场景；关羽改用单张旧运行图集生成的原生 SpriteAtlas，身体只保留待机、移动和受击三个 AnimationClip。当前战斗只分角色层与技能特效层，不展示独立武器层；青龙斩生成物独立管理显示、寿命和命中范围。
- 首个可玩切片已改为原生组件结构：`GuanYuController` 挂在关羽上并按虚拟摇杆方向连续移动，Camera 是关羽子节点；`HeadCookController` 挂在厨师长上并独立追击；`GreenDragonSlash` 管理技能生命周期；`ArenaBackground` 只绘制一次场地；Canvas 上的 `BattleController` 只协调伤害、攻击时钟和 HUD。
- 项目扩展 `extensions/shuraid-editor-tools` 只在菜单命令触发时运行，不在项目启动时自动切换或保存场景，避免弹出未命名场景保存框。
- Cocos 编辑器已经识别项目，生成了本地 `library/`、`temp/` 和 `profiles/` 目录。
- 2026-08-11 已使用 Cocos Creator 3.8.8 CLI 完成微信小游戏 Release 构建，官方成功退出码为 36。
- 最新 Release 产物位于 `build/wechatgame`（2026-08-11 23:55）：`debug=false`、竖屏、36 个文件、约 3.79 MiB；节点组件化、虚拟摇杆连续移动、Camera 子节点跟随和独立技能/怪物逻辑均已进入构建包，构建产物已不包含 `BattleSlice`。
- 微信开发者工具 CLI 已成功导入并打开该本地构建包；未执行预览、上传或发布。
- 源工程边界扫描未发现 `project.config.json`、`game.json`、`app.js`、`build-templates` 或原生微信小游戏源码；这些文件只存在于 Cocos 生成的 `build/` 产物中。
- 用户已在微信开发者工具中确认空场景正常启动且控制台无持续错误。
- 空场景阶段不单独记录 DevTools Performance 时间线；帧耗时、尖峰和移动手感将在“移动 + 一种敌人 + 普攻”的首个可玩切片中结合真机验证。
- 尚未完成玩法真机验收。
- 关羽六张独立 512×384 动作图已证明不能作为旧版显示比例的可靠基准；文件未损坏，失真来自源帧、显示尺寸、枢轴和动作选择没有按旧运行契约复现。
- 已确认旧 Canvas 实际使用 `M:\codex\GameOne\luanshi-survivor\assets\runtime\guan-atlas.png`：384×288 源帧、约 101×76 显示尺寸、横向枢轴 `230/384`，身体只使用待机/移动，青龙斩独立表现。
- 原生微信小程序开发 skill 不适用于本 Cocos 项目，今后禁止用它指导场景、资源、动画、战斗或性能工作。
- 已安装项目级 `Funplay MCP for Cocos` v0.4.6，固定监听 `127.0.0.1:8765`，使用 `core` 39 工具、安全检查开启、session 关闭；健康检查、Codex 配置和真实 `get_project_info`/Scene/Prefab/资源调用均已成功。
- MCP 已能打开 `Bootstrap.scene` 并读回 UUID `4baccbd0-bcd1-4d13-986e-affe016c1b66`。场景切换是异步操作，调用后必须等编辑器完成并读回正确场景再继续。
- 底层 `scene/save-scene` 会打开 Windows“另存场景”对话框并等待人工输入，调用端因而超时；后续禁止使用该消息，已知场景只通过 AssetDB 对明确的场景 URL 定向保存并读回。
- 编辑器已运行时，Creator CLI 会额外启动一套 GUI 进程且不一定进入 Builder。当前可靠构建入口是 MCP 在现有编辑器中先调用 Builder `check-and-complete-options`，再用 `add-task` 加入任务队列，并通过 `query-tasks-info` 等待成功。
- 2026-08-11 自动真机调试曾报 `80051`：源码包 4128KB 超过 4MB。当前切片未使用的 Spine 3.8 引擎模块已关闭，Release 包由约 4147KB 降至 3872KB，重新构建成功。
- 后续包体再次持续逼近上限时，备选方案是把场景/角色内容配置为 Cocos 远程 Asset Bundle，并使用微信开发者工具最后一项“开启静态资源服务器”在本地模拟远程下载；正式版本仍需 HTTPS 资源服务器、资源服务器地址和版本/缓存策略。
- 关羽现用图集位于 `assets/art/characters/guan/runtime/guan-atlas.png`，六帧均为 384×288；微信端截图反馈 `76/288` 映射过小，当前统一显示缩放为 `0.44`，锚点保持 `(230/384, 17/76)`。首轮 512×384 独立 PNG 和身体攻击 AnimationClip 已移除，可通过 Git 恢复。

当前磁盘文件和 Git 状态高于本交接文档；开始工作前必须重新检查两者。

## 当前切片

阶段 0 的空工程微信小游戏 Release 性能基线已完成：

1. [x] 在 Cocos 编辑器中原生创建并保存一个空 Scene；
2. [x] 使用保存的微信小游戏 Release 配置完成 Cocos CLI 构建；
3. [x] 使用微信开发者工具 CLI 导入并打开构建包；
4. [x] 由用户手动确认空场景正常启动且控制台无持续错误；
5. [x] 记录 Release 包体与工程边界；玩法性能和真机手感留到首个可玩切片验证。

阶段 1 的人物资源与视觉基线已完成替换：

1. [x] 迁入旧版实际运行的关羽图集并切出六个 384×288 SpriteFrame；
2. [x] 由 Cocos 生成全新 SpriteAtlas/SpriteFrame 元数据；
3. [x] 创建待机、移动、受击三个身体 AnimationClip，攻击效果继续独立播放；
4. [x] 创建 `GuanYu.prefab`，Sprite 使用 `RAW` Size Mode；
5. [x] 在 `Bootstrap.scene` 中放置关羽原生节点并完成 Release 构建验证；
6. [x] 使用旧运行图集和精确显示契约重建关羽表现层。

首个可玩切片已实现：

1. [x] 指尖目标移动与边界限制；
2. [x] 最后移动朝向驱动关羽翻面和青龙斩方向；
3. [x] 青龙斩使用 1.0 秒间隔；技能生成物以自身表现中心为圆心持有 220 半径命中范围，并额外计入敌人碰撞半径；
4. [x] 厨师长追击、接触受击、命中减速刷新、击杀和复用重生；
5. [x] 原生 SpriteAtlas、敌人 Prefab、场景节点和 Release 构建通过。

尚未加入多敌人对象池、经验升级、正式场景美术和音频。

## 实现边界

- 使用 Scene、Prefab、SpriteFrame、SpriteAtlas、AnimationClip 和编辑器资源引用。
- 不用脚本动态拼装整棵场景树，不在运行时手工切 SpriteFrame。
- 旧 Canvas 项目 `M:\codex\GameOne\luanshi-survivor` 可作为已验证玩法、运行素材和显示参数来源；旧 Cocos 项目 `M:\codex\ShuRaid` 只可作为逐项候选资源来源，不复制其脚本、场景、settings、旧 `.meta`、构建配置或表现架构。
- `M:\codex\ShuRaid-Cocos` 不再使用。
- 最高原则是敏捷开发、快速落地。旧版已验证资源可按最快实现方式直接使用，不要求逐文件迁移或验证；只排除已证明有问题的旧 Cocos 脚本、场景、settings、`.meta`、构建配置和表现架构。
- 未经用户明确同意，不推送远端、不上传或发布微信版本。

## 下一步

1. 用户重点测试虚拟摇杆：按下后拖出死区并保持不动时，关羽应持续匀速移动，Camera 跟随，小怪持续追击；确认不再出现“追上手指后等待下一次触摸事件”的停走卡顿；
2. 根据集中反馈一次性调整表现参数；
3. 关羽表现通过后扩展多敌人对象池，并开始迁入第一张真实场景的必要美术资源。

`AGENTS.md` 已在 MCP 实测后重写为正式敏捷工作流：不再逐文件验证、不设逐阶段门禁、不手写编辑器序列化资源、不在每个小改动后重复构建。
