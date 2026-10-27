# ShuRaid

《报，蜀军来劫粮》的全新 Cocos Creator 工程。

本仓库从旧 Canvas 原型中只继承已确认的玩法、数值边界和精选素材，不继承旧运行时结构，也不继承上一轮卡顿的 Cocos 战斗实现。目标是在 Cocos Creator 3.8.8 中重新建立一个小而清晰、真机移动流畅、便于持续扩展的微信小游戏。

## 当前状态

- 已建立干净的 Cocos Creator 3.8.8 项目根；
- 已迁入三名武将、四类伙夫敌人、界面背景、音频和武器的精选素材；
- 已整理产品、视觉、技术和素材清单；
- 已建立第一可玩切片 `assets/scenes/BattleSlice.scene`：关羽连续移动、厨师追逐、青龙斩沿玩家朝向挥出、固定步长、显示插值、对象池和性能 HUD；
- 规则层为纯 TypeScript，不引用 `cc`；Cocos 只负责触摸、生命周期和 Sprite 表现；
- 自动测试、TypeScript 检查、移动 Web 构建和微信小游戏构建已通过；微信开发者工具与真机手感仍待人工验收。

## 开始工作

1. 使用 `C:\ProgramData\cocos\editors\Creator\3.8.8\CocosCreator.exe` 打开本目录；
2. 先阅读 `docs/PROJECT-HANDOFF.md`；
3. 运行 `npm test` 和 `npm run check:core` 验证确定性规则；
4. 运行 `npm run build:cocos:wechat` 生成带性能 HUD 的 Debug 包 `build/wechatgame`；运行 `npm run build:cocos:wechat:release` 生成关闭 HUD 的 Release 包 `build/wechatgame-release`；两条命令都会读回校验 AppID、Debug 标志和 390×844 设计分辨率；
5. Debug 包用于观察 Avg/P95/Max 帧耗时，Release 包用于微信开发者工具性能面板和真机最终手感对照；
6. 真机移动通过后，再接升级、专属技能和其余武将。

第一切片的自动验证结果和人工验收表见 `docs/SLICE-01-VALIDATION.md`。

未经明确授权，不执行微信上传、版本发布或远端 Git 推送。
