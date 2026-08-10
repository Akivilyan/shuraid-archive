# 第一切片验证记录

更新日期：2026-08-10

## 自动验证

| 项目 | 结果 | 备注 |
| --- | --- | --- |
| `npm test` | 通过，5/5 | 固定快照、移动归一化与停步、扇形边界、自动攻击、补帧上限 |
| `npm run check:core` | 通过 | 纯 TypeScript 规则层严格检查 |
| Cocos TypeScript `tsc -p tsconfig.json --noEmit` | 通过 | 使用 Cocos Creator 3.8.8 自带 TypeScript |
| Cocos 移动 Web 构建 | 通过 | `platform=web-mobile`，Debug |
| `npm run build:cocos:wechat` | 通过 | `platform=wechatgame`，Debug；生成 AppID 已读回为 `wxc99662ee0bfded03`；未上传 |
| 移动 Web 运行日志 | 场景加载成功 | 无脚本错误；仅模板缺少 `favicon.ico` 的无关 404 |
| 引擎裁剪 | 通过 | 未打包 Bullet、Box2D、Spine、音频等首切片未使用模块 |

Web 横屏烟测曾记录约 60 FPS、16.66 ms、5 Draw Call、16 个活动节点。该数据来自桌面浏览器，只能证明 HUD 工作，不能替代微信真机性能数据。

## 人工验收（待完成）

- [ ] 使用 Cocos Creator 3.8.8 打开 `assets/scenes/BattleSlice.scene`，确认无脚本编译错误；
- [ ] 使用微信开发者工具打开 `build/wechatgame`，确认无持续错误或重置循环；
- [ ] 真机单指拖动连续移动，松手立即停止；
- [ ] 连续小角度改变拖动方向，关羽移动和转向无肉眼明显卡顿；
- [ ] 厨师持续追逐，死亡后复用池节点，无突然批量创建/销毁；
- [ ] 无目标时青龙斩不空挥；有目标时刀光方向和扇形伤害一致；
- [ ] 记录下方设备数据并由用户确认手感。

| 项目 | 实测值 |
| --- | --- |
| 手机型号 | 待填写 |
| 系统版本 | 待填写 |
| 微信版本/基础库 | 待填写 |
| 平均 FPS | 待填写 |
| P95 帧耗时 | 待填写 |
| Draw Call | 待填写 |
| 活动节点数 | 待填写 |
| 纹理内存 | 待填写 |
| 手感结论 | 待填写 |

人工验收通过前，不进入经验豆、稳定刷怪、升级、额外技能、黄忠或诸葛亮。
