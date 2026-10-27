# 《突围试炼》战斗切片

一个基于 Cocos Creator 3.8.8 官方 `Empty (2D)` 模板制作的竖屏、单手、自动攻击生存战斗切片。

## 可玩内容

- 按住屏幕任意战斗区域拖动，角色跟随虚拟摇杆移动。
- 脉冲弹自动瞄准最近的敌人并持续攻击。
- 击败敌人后拾取能量，升级时从三项能力中选择一项。
- 可构筑脉冲强化、齐射、超频、环刃和生命强化。
- 坚持 3 分钟获胜；生命归零失败；结算后可立即重开。

切片只复现“单手移动 + 自动战斗 + 怪潮 + 局内构筑”的玩法结构，角色、名称和视觉均为原创占位内容。

## 本地验证

```powershell
npm test
npm run verify
npm run typecheck
npm run build:wechat
```

Cocos 构建产物位于 `build/wechatgame`。构建只生成本地微信小游戏工程，不执行预览、上传或发布。

## 工程结构

- `assets/scripts/core/`：不依赖 `cc` 的确定性战斗规则，可用 Node 直接测试。
- `assets/scripts/game/`：Cocos 生命周期、触摸输入、HUD 和批量矢量表现。
- `assets/scenes/`：正式启动场景。
- `tests/`：规则层最小回归测试。
- `docs/SLICE-01.md`：切片范围、验收标准和下一步候选。
