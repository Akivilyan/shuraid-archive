# 内容迁移记录

## 2026-08-11：关羽最小动作帧

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

- 未迁入 `guan-atlas.png`，避免运行时手工切 SpriteFrame；
- 未迁入展示立绘、预览图、独立大武器、旧脚本、旧 Scene、旧 Prefab、settings 或旧 `.meta`；
- 六个目标文件与来源文件的 SHA-256 已逐一匹配；
- Cocos Creator 3.8.8 CLI 已完成正式导入，六张 PNG 均生成全新的独立 image/texture/SpriteFrame UUID；未发现旧图集 UUID；
- 六张 SpriteFrame 的原始画布均为 512×384，导入器使用自动裁剪；Prefab 的 Sprite 使用 `RAW` Size Mode 保持统一原始画布，避免逐帧尺寸抖动；
- 已由 Cocos 编辑器资源序列化生成四个原生 AnimationClip：待机 1 帧循环、移动 2 帧循环（0.4 秒）、普攻 3 帧单次播放（0.6 秒）、受击 2 帧单次播放（0.25 秒）；
- 已生成 `assets/prefabs/characters/GuanYu.prefab`，根节点为 `GuanYu`，显示节点为 `Visual`，Sprite 和 Animation 均使用编辑器资源引用；
- `assets/Bootstrap.scene` 已放置一个原生 `GuanYu/Visual` 节点并引用上述 SpriteFrame 与 AnimationClip，不在运行时拼装角色节点或手工切帧；
- 2026-08-11 微信小游戏 Release 自动构建成功，Cocos 官方成功退出码为 36；六张角色 PNG 均进入 `assets/main/native` 构建产物。
