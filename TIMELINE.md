# TIMELINE — 从文件系统还原的五天

本文只记录可验证的客观事实：NTFS 目录创建时间、`.git` 目录创建时间、提交时间戳、工作区文件最后修改时间、提交内容。不做心理解读，解读在 `POSTMORTEM.md`。

数据采集于 2026-10-27，源目录为 `M:/codex/GameOne/` 与 `M:/codex/`。

## 原始时间线

```
08-07 20:29:44  01 目录创建（luanshi-survivor）
                ↓ 40 小时 03 分，无任何版本记录
08-09 13:32:28  01 .git 创建
08-09 13:39:57  [01] INIT: 建立《报，蜀军来劫粮》项目基线
08-09 15:52:58  [01] UI-01: 重构底部导航与单页选将
08-09 16:24:00  [01] ART-01: 接入黄忠射小鸡英雄立绘
08-09 16:31:25  [01] UI-02: 选将立绘改为全屏展示
                ↓ 22 小时 42 分，无提交
08-10 15:13:35  [01] MIGRATION-SNAPSHOT: freeze prototype before clean Cocos rebuild
                ↓ 35 秒 ← 整条线最关键的 35 秒
08-10 15:14:10  02 目录创建（ShuRaid）
08-10 15:17:48  02 .git 创建
08-10 15:19:20  [02] PROJECT-RESET: initialize clean Cocos rebuild
08-10 17:00:45  [02] SLICE-01: establish playable Cocos WeChat baseline
08-10 17:17:16  [02] SLICE-01: smooth Guan Yu attack turning
                ↓ 3 小时 25 分
08-10 20:42:55  [02] SLICE-01: restore required Cocos runtime modules
08-10 21:41:08  [02] SLICE-01: align Guan Yu slash with player facing
08-10 22:07:44  [02] SLICE-01: stabilize melee cadence and unit separation   ← 02 末提交
08-10 23:31:12  OpenCode/ShuRaid 目录创建（02 的完整副本，同一批 sha）
                ↓ 2 小时 34 分
08-11 02:05:51  02 工作区最后改动
08-11 02:06:26  03 目录创建（ShuRaid2D）
                ↓ 33 分钟
08-11 02:39:35  [03] PROJECT-BASELINE: establish clean Cocos WeChat baseline
08-11 03:19:06  [03] CONTENT-01: add GuanYu native animation assets
                ↓ 8 小时 54 分（睡眠）
08-11 12:13:17  [03] PLAYABLE-01: add movement enemy and directional slash
08-11 12:45:47  [03] FIX-PLAYABLE-01: add atlas slash and combat feedback
08-11 13:21:25  [03] FIX-PLAYABLE-02: smooth movement and reposition slash
08-11 14:02:34  [03] DOCS: reset project workflow for agile Cocos development
08-11 14:19:10  [03] TOOLS: add Cocos editor MCP workflow
08-11 14:48:25  [03] FIX-PLAYABLE-03: restore Guan runtime atlas contract
08-11 15:09:43  [03] TUNE-PLAYABLE-04: slow attacks and enlarge Guan
08-11 15:14:25  [03] TUNE-PLAYABLE-05: double Guan display scale
08-11 15:23:44  [03] BUILD-WECHAT-01: trim unused Spine runtime
08-11 15:43:17  [03] FIX-PLAYABLE-06: center Guan and scroll world
08-11 15:48:16  [03] FIX-COMBAT-07: harden contact and slash hitboxes
                ↓ 17 分钟
08-11 16:05:38  04 目录创建（danke）← 从 03 的中途插出来
08-11 16:13:24  04 .git 创建
08-11 16:29:17  [04] feat: build survivor combat slice   ← 唯一一次提交
08-11 17:24:50  04 工作区最后改动（提交后又试了 55 分钟）
                ↓ 5 小时 58 分
08-11 23:23:01  [03] REFACTOR-COMBAT-08: separate character and skill effects  ← 回到 03
08-11 23:29:15  [03] FIX-INPUT-09: coalesce touch movement per frame
08-11 23:40:10  [03] FIX-MOVEMENT-10: move Guan directly and correct facing
08-11 23:56:20  [03] REFACTOR-RUNTIME-11: replace god script with node components ← 03 末提交
08-12 00:17:43  03 工作区最后改动
                —— 此后四个目录再无写入
```

## 重建间隔

| 事件 | 间隔 |
|---|---|
| 01 目录创建 → 01 首次 `git init` | **40 小时 03 分** |
| 01 冻结提交 → 02 目录创建 | **35 秒** |
| 02 最后提交 → 02 工作区最后改动 | 2 小时 34 分 |
| 02 最后改动 → 03 目录创建 | **35 秒** |
| 03 上一个提交 → 04 目录创建（中途另起） | 17 分钟 |
| 04 最后改动 → 回到 03 继续 | 5 小时 58 分 |
| 03 最后改动 → 至今 | 已停手 76 天 |

两次整项目重建，都是 35 秒。不是"想了很久决定重来"，是"关掉，立刻开新的"。

## 提交密度

```
08-09 13:00  #                    1
08-09 15:00  #                    1
08-09 16:00  ##                   2     01 共 5 个
08-10 15:00  #                    1
---------------------------------------------
08-10 15:00  #                    1
08-10 17:00  ##                   2
08-10 20:00  #                    1
08-10 21:00  #                    1     02 共 6 个
08-10 22:00  #                    1
---------------------------------------------
08-11 02:00  #                    1
08-11 03:00  #                    1
08-11 12:00  ##                   2
08-11 13:00  #                    1
08-11 14:00  ###                  3
08-11 15:00  #####                5     03 共 17 个
08-11 23:00  ####                 4
---------------------------------------------
08-11 16:00  #                    1     04 共 1 个
```

## 03 的内部节奏

03 的 17 个提交，按内容分组：

- **建基线**（2 个）：02:39、03:19
- **功能推进**（2 个）：12:13、12:45
- **流程与工具**（2 个）：14:02、14:19
- **反复修关羽**（9 个）：13:21、14:48、15:09、15:14、15:43、15:48、23:29、23:40、23:56

14 分钟内两次参数微调（15:09「慢一点」、15:14「放大一倍」），说明当时在肉眼试手感，没有可度量的验收标准。

## 磁盘上能看到的五类"调整行为"

1. **整目录重置**：02 和 03，各 35 秒完成。旧项目不删、不归档，直接开新目录。
2. **换工具复制**：08-10 23:31 建 `M:/OpenCode/ShuRaid`，是 02 的完整副本，同一批提交 sha，只换了宿主工具。
3. **中途切方向**：08-11 16:05 从 03 中途插出 04（danke），改了玩法路线，24 分钟出结果。
4. **补架构**：08-11 23:56 回到 03，最后一个提交是「把 god script 拆成组件」—— 崩盘前最后一小时在补欠下的架构债。
5. **加控制链路**：08-11 14:19 引入 `funplay-cocos-mcp`（55 个文件、14,845 行的第三方 Cocos 编辑器 MCP 扩展，含中英双语文档与商店上架文案）。**这部分不是自研代码**，但它是当时方向的一部分：让 AI 能直接操作编辑器，而不是写代码。

## 代码量

| 版本 | 游戏代码 | 文件 | 说明 |
|---|---|---|---|
| 01 | 6,672 行 | 33 | JS 原型，非 Cocos |
| 02 | 1,400 行 | 11 | Cocos TS，从零重建 |
| 03 | 591 行 | 5 | 相比 02 再缩 58% |
| 04 | 1,236 行 | 4 | 纯 Graphics 绘制，无美术资源依赖 |

02 → 03 缩水了 58%。同一个方向第二次重建，代码反而更少，而 03 的提交数是 02 的近三倍。

## 未提交现场

停手时工作区里还有未提交的改动，`.git` 里没有，只在磁盘上存在过：

- **02**：11 项。README、`BattleSliceController.ts`、`BattlePresenter.ts`、`PerformanceHud.ts`、`PROJECT-HANDOFF.md`、`SLICE-01-VALIDATION.md`、`package.json`、构建脚本、微信构建配置。
- **03**：3 项。删除 `green-dragon-slash-atlas.png`，修改 `BattleController.ts`、`GuanYuController.ts`。

这些已固化进本仓库的 `final-state` 提交，源仓库未做任何改动。清单见 `_meta/uncommitted-changes.txt`。

## 数据口径说明

- “目录创建”取 NTFS `st_birthtime`，不是 `.git` 创建时间。01 两者相差 40 小时，这段空白期没有任何版本记录。
- “工作区最后改动”取文件 `mtime` 最大值，已排除 `.git` 和 Cocos 引擎生成的 `engine-adapter.js` / `web-adapter.js`。部分版本含构建产物，数值偏晚。
- 工作区里存在一批 `2026-06-01 14:41:29` 的文件，是 Cocos 引擎模板自带资源（OpenSans 字体、engine-adapter），与项目起始无关，已排除。
